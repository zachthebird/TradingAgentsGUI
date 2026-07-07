"""
TradingAgents FastAPI Backend
=============================
Wraps TradingAgentsGraph as a REST + SSE API.

Endpoints:
  POST /analyze          — start an analysis job
  GET  /stream/{job_id}  — SSE stream of live progress
  GET  /reports          — list past analyses
  GET  /reports/{ticker}/{date}         — full JSON report
  GET  /reports/{ticker}/{date}/markdown — rendered markdown
  GET  /health           — liveness probe
"""

import asyncio
import hmac
import json
import logging
import os
import queue
import re
import sys
import threading
import traceback
import uuid
from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.base import BaseHTTPMiddleware

# ── project path ──────────────────────────────────────────────────────
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENV_PATH = _PROJECT_ROOT / ".env"
sys.path.insert(0, str(_PROJECT_ROOT))

# ⚠️ Load .env BEFORE importing DEFAULT_CONFIG so env-var overrides
# (TRADINGAGENTS_QUICK_THINK_LLM, etc.) take effect at module-init time.
dotenv.load_dotenv(_ENV_PATH)

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.dataflows.utils import safe_ticker_component

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("tradingagents.api")

# Resolve the *real* user home, even when running inside a Hermes profile
# whose HOME is sandboxed to ~/.hermes/profiles/<name>/home/.  Derive it
# from HERMES_HOME (e.g. ~/.hermes/profiles/<profile>).
_hermes_home = os.environ.get("HERMES_HOME", "")
if _hermes_home and "/.hermes/profiles/" in _hermes_home:
    _REAL_USER_HOME = Path(_hermes_home.split("/.hermes/profiles/")[0])
else:
    _REAL_USER_HOME = Path.home()

# Override results_dir with the real path so /reports finds the same
# data as the CLI (which runs outside the profile sandbox).  If
# TRADINGAGENTS_RESULTS_DIR is explicitly set in .env, that wins.
_results_override = os.environ.get("TRADINGAGENTS_RESULTS_DIR")
if _results_override:
    RESULTS_DIR = Path(_results_override)
else:
    RESULTS_DIR = _REAL_USER_HOME / ".tradingagents" / "logs"

logger.info("RESULTS_DIR resolved to %s", RESULTS_DIR)

# ── auth ───────────────────────────────────────────────────────────────
API_TOKEN = os.getenv("TRADINGAGENTS_API_TOKEN", "")

# Guest tier (Tier C "live desk"): a second, shareable passcode with hard
# server-side guardrails.  Guests cannot spend beyond the clamps below no
# matter what the request body claims.
GUEST_TOKEN = os.getenv("TRADINGAGENTS_GUEST_TOKEN", "")
GUEST_DAILY_CAP = int(os.getenv("TRADINGAGENTS_GUEST_DAILY_CAP", "8"))
GUEST_COOLDOWN_SECONDS = int(os.getenv("TRADINGAGENTS_GUEST_COOLDOWN", "90"))
# Optional cheap/free model routing for guest runs (e.g. provider=google
# with a free-tier flash model).  Unset → server defaults.
GUEST_PROVIDER = os.getenv("TRADINGAGENTS_GUEST_PROVIDER", "")
GUEST_DEEP_LLM = os.getenv("TRADINGAGENTS_GUEST_DEEP_LLM", "")
GUEST_QUICK_LLM = os.getenv("TRADINGAGENTS_GUEST_QUICK_LLM", "")
# Dedicated API key for guest runs ONLY (e.g. a separate, spend-capped
# OpenRouter key for the public tier).  Injected per-run via config so it
# never touches the env key the local/admin tier uses.  Falls back to the
# provider's normal env key when unset.
GUEST_API_KEY = os.getenv("TRADINGAGENTS_GUEST_API_KEY", "")
# When enabled, unauthenticated public traffic runs as GUEST (no passcode).
# Only honored if a guest provider is configured (else open traffic would
# hit the paid default). The guest tier stays hard-clamped regardless.
GUEST_OPEN = os.getenv("TRADINGAGENTS_GUEST_OPEN", "").strip().lower() in ("1", "true", "yes", "on")

# Per-IP guest sub-limit so one visitor can't consume the whole global
# daily cap and starve everyone else (the global cap remains the ceiling).
GUEST_PER_IP_DAILY_CAP = int(os.getenv("TRADINGAGENTS_GUEST_PER_IP_CAP", "3"))

# Max request body size (bytes). JSON bodies for this API are tiny; this is
# a host-protection brake against oversized-payload memory exhaustion.
_MAX_BODY_BYTES = int(os.getenv("TRADINGAGENTS_MAX_BODY_BYTES", str(64 * 1024)))

# Guest accounting (in-memory; resets on service restart, which is fine
# for a personal desk — the cap is a spend brake, not billing).
_guest_lock = threading.Lock()
_guest_day: str = ""
_guest_runs_today: int = 0
_guest_last_submit: float = 0.0
# Per-IP counters (reset with the day). Identity is CF-Connecting-IP (set by
# Cloudflare at the edge); X-Forwarded-For is a fallback only and spoofable,
# so binding to 127.0.0.1 keeps direct off-tunnel access — and forged
# CF-Connecting-IP — out of reach.
_guest_ip_runs: Dict[str, int] = {}
_guest_ip_last: Dict[str, float] = {}


def _client_ip(request: "Request") -> str:
    """Best-effort client identity for per-visitor rate limiting."""
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

class TokenVerificationResponse(BaseModel):
    valid: bool
    tier: Optional[str] = None


class BearerAuthMiddleware(BaseHTTPMiddleware):
    """Simple bearer-token gate for all API routes.

    Allows unauthenticated access to the health endpoint and static
    frontend files.  When TRADINGAGENTS_API_TOKEN is unset the gate is
    effectively disabled (local-dev mode).

    Tokens are accepted via the standard ``Authorization: Bearer <token>``
    header OR a ``?token=<token>`` query parameter (so that EventSource /
    SSE connections, which cannot carry custom headers, still work).
    """

    async def dispatch(self, request, call_next):
        path = request.url.path

        # Reject oversized request bodies early (before any parsing/accounting)
        # so a huge POST can't buffer into memory and OOM the host. JSON bodies
        # for this API are tiny; 64 KiB is very generous.
        clen = request.headers.get("content-length")
        if clen:
            try:
                if int(clen) > _MAX_BODY_BYTES:
                    return JSONResponse(status_code=413, content={"detail": "Request body too large."})
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length."})
        elif request.method in ("POST", "PUT", "PATCH"):
            # No Content-Length on a body-bearing request means chunked transfer,
            # which would stream past the size cap above. This API's clients
            # always send Content-Length, so require it (chunked bodies → 411).
            return JSONResponse(status_code=411, content={"detail": "Content-Length required."})

        # Always allow health checks.
        if path == "/health":
            return await call_next(request)

        # Allow static-frontend requests (the HTML / JS / CSS itself).
        # API routes are under /analyze, /stream, /reports, /auth — everything
        # else is assumed to be a static asset.
        _api_prefixes = ("/analyze", "/stream", "/reports", "/auth", "/config")
        if not any(path.startswith(p) for p in _api_prefixes):
            # Don't serve source or metadata files out of the static tree:
            # dotfiles (.DS_Store, .git*) and design source (.py/.md). The
            # UI's runtime art under design/ (.png/.jpg) is unaffected.
            _last = path.rsplit("/", 1)[-1].lower()
            if _last.startswith(".") or _last.endswith((".py", ".pyc", ".md")):
                return JSONResponse(status_code=404, content={"detail": "Not found"})
            resp = await call_next(request)
            # Force revalidation on the app shell/assets so a frontend update
            # (e.g. the public-desk lockdown) always reaches visitors instead
            # of a stale cached copy. no-cache = "revalidate before use" (304
            # when unchanged), so it's cheap but never serves stale HTML/JS.
            if path.endswith((".html", ".js", ".css")) or path.endswith("/") or "." not in path.rsplit("/", 1)[-1]:
                resp.headers["Cache-Control"] = "no-cache, must-revalidate"
            return resp

        # Token not configured — allow all (local dev / LAN mode).
        if not API_TOKEN:
            request.state.tier = "admin"
            return await call_next(request)

        # Resolve the presented token to a tier.  The guest passcode is
        # shareable; its requests get hard-clamped in /analyze.
        presented = request.query_params.get("token", "")
        if not presented:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                presented = auth[len("Bearer "):]
        # Constant-time comparison so the token can't be recovered byte-by-byte
        # via response-timing over the public tunnel. Compare on UTF-8 bytes:
        # hmac.compare_digest raises TypeError on non-ASCII str, and the
        # presented token is fully attacker-controlled (a crafted Unicode token
        # would otherwise 500 the request instead of cleanly falling through).
        presented_b = presented.encode("utf-8")
        if presented and hmac.compare_digest(presented_b, API_TOKEN.encode("utf-8")):
            request.state.tier = "admin"
            return await call_next(request)
        if GUEST_TOKEN and presented and hmac.compare_digest(presented_b, GUEST_TOKEN.encode("utf-8")):
            request.state.tier = "guest"
            return await call_next(request)

        # Open public desk: when GUEST_OPEN is enabled, an unrecognized/absent
        # token drops to the GUEST tier instead of 403 — no passcode needed.
        # Safe because the guest tier is hard-clamped in /analyze (free model,
        # dedicated key, caps). Requires a guest provider to be configured, or
        # this would route open traffic to the paid default.
        if GUEST_OPEN and GUEST_PROVIDER:
            request.state.tier = "guest"
            return await call_next(request)

        return JSONResponse(
            status_code=403,
            content={
                "detail": (
                    "Invalid or missing API token.  Provide it via an "
                    "Authorization: Bearer <token> header or ?token=<token> "
                    "query parameter."
                )
            },
        )

# ── Pydantic models ───────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    ticker: str
    date: str  # YYYY-MM-DD
    analysts: List[str] = Field(
        default=["market", "social", "news", "fundamentals"],
        description="Which analyst nodes to include",
    )
    research_depth: str = Field(
        default="standard", description="'standard' or 'deep'"
    )
    llm_provider: Optional[str] = None
    deep_think_llm: Optional[str] = None
    quick_think_llm: Optional[str] = None
    backend_url: Optional[str] = None
    output_language: Optional[str] = None

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Ticker symbol is required")
        if not re.match(r"^[A-Z]{1,10}$", v):
            raise ValueError(f"Invalid ticker symbol: {v!r}. Must be 1-10 uppercase letters.")
        return v

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        if not v:
            raise ValueError("Analysis date is required")
        try:
            parsed = datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Invalid date format: {v!r}. Expected YYYY-MM-DD.")
        if parsed > date_type.today():
            raise ValueError(f"Date {v} is in the future. Analysis requires a past or current date.")
        return v

    @field_validator("analysts")
    @classmethod
    def validate_analysts(cls, v: List[str]) -> List[str]:
        allowed = {"market", "social", "news", "fundamentals"}
        if len(v) > len(allowed):
            raise ValueError("Too many analysts selected")
        invalid = set(v) - allowed
        if invalid:
            raise ValueError(f"Invalid analysts: {invalid}. Allowed: {allowed}")
        if not v:
            raise ValueError("At least one analyst must be selected")
        return v

    @field_validator("research_depth")
    @classmethod
    def validate_depth(cls, v: str) -> str:
        if v not in ("standard", "deep", "quick", "exhaustive"):
            raise ValueError(
                f"Invalid research_depth: {v!r}. Must be 'quick', 'standard', 'deep', or 'exhaustive'."
            )
        return v


class AnalyzeResponse(BaseModel):
    job_id: str


class ReportSummary(BaseModel):
    ticker: str
    date: str
    path: str


class ReportList(BaseModel):
    reports: List[ReportSummary]


# ── job manager ───────────────────────────────────────────────────────

class Job:
    """Mutable state for a single analysis run."""

    def __init__(self, job_id: str, ticker: str, date: str):
        self.job_id: str = job_id
        self.ticker: str = ticker
        self.date: str = date
        self.status: str = "running"
        self.created_at: str = datetime.now(timezone.utc).isoformat()
        # Thread-safe queue — one end written by the worker thread,
        # the other end drained by the async SSE generator.
        self._q: queue.Queue = queue.Queue()
        self.thread: Optional[threading.Thread] = None
        self.meter: Optional["TokenMeter"] = None
        self.usage: Optional[Dict[str, Any]] = None
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.final_state: Optional[Dict[str, Any]] = None

    def put_event(self, event_type: str, data: Dict[str, Any]) -> None:
        payload = json.dumps(
            {
                "type": event_type,
                "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        self._q.put(payload)

    def get_event(self, timeout: float = 0.25) -> Optional[str]:
        try:
            return self._q.get(timeout=timeout)
        except queue.Empty:
            return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "ticker": self.ticker,
            "date": self.date,
            "status": self.status,
            "created_at": self.created_at,
            "error": self.error,
            "result": self.result,
        }


# In-memory store.  Sufficient for short-lived jobs; a real deployment
# would swap this for Redis.
_jobs: Dict[str, Job] = {}


# ── token / cost metering ──────────────────────────────────────────────
# Price per 1M tokens (USD).  DeepSeek V4, official docs, 2026-07:
# (cache_hit_input, cache_miss_input, output).  Add rows as providers are
# used; unknown models fall back to a deliberately-high estimate so a run
# is never under-quoted.
MODEL_PRICING: Dict[str, tuple] = {
    "deepseek-v4-pro":   (0.003625, 0.435, 0.87),
    "deepseek-v4-flash": (0.0028,   0.14,  0.28),
    "deepseek-chat":     (0.0028,   0.14,  0.28),
    "deepseek-reasoner": (0.003625, 0.435, 0.87),
    "gpt-5.4":           (0.075,    0.75,  6.0),
    "gpt-5.4-mini":      (0.0125,   0.125, 1.0),
    # Free OpenRouter models (":free" slugs) cost $0 — price them at zero so
    # the guest desk's cost readout shows $0.00, not the fallback estimate.
    "nemotron":          (0.0,      0.0,   0.0),
    "nvidia/":           (0.0,      0.0,   0.0),
}
_FALLBACK_PRICE = (0.005, 0.60, 1.20)


def _price_for(model: str) -> tuple:
    m = (model or "").lower()
    # Any explicitly-free OpenRouter model is $0 regardless of family.
    if m.endswith(":free"):
        return (0.0, 0.0, 0.0)
    for key, price in MODEL_PRICING.items():
        if key in m:
            return price
    return _FALLBACK_PRICE


try:
    from langchain_core.callbacks import BaseCallbackHandler as _BaseCB
except Exception:  # pragma: no cover — langchain always present at runtime
    _BaseCB = object


class TokenMeter(_BaseCB):
    """LangChain callback that tallies token usage + cost across a run.

    Attached to the graph's LLM constructor (callbacks=[...]); every
    on_llm_end fans in here.  Captures cache-hit tokens where the provider
    reports them (DeepSeek's prompt_cache_hit_tokens / OpenAI's
    prompt_tokens_details.cached_tokens), so the cost reflects real
    prompt-cache savings.
    """

    def __init__(self) -> None:
        super().__init__()
        self.calls = 0
        self.by_model: Dict[str, Dict[str, int]] = {}
        self._lock = threading.Lock()

    def on_llm_end(self, response, **kwargs) -> None:  # noqa: D401
        try:
            usage, model = self._extract(response)
            if not usage:
                return
            prompt = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
            completion = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
            cached = usage.get("prompt_cache_hit_tokens")
            if cached is None:
                details = usage.get("prompt_tokens_details") or {}
                if isinstance(details, dict):
                    cached = details.get("cached_tokens", 0)
                elif details is not None:
                    cached = getattr(details, "cached_tokens", 0)
            cached = int(cached or 0)
            model = (model or "unknown").lower()
            with self._lock:
                self.calls += 1
                b = self.by_model.setdefault(model, {"prompt": 0, "cached": 0, "completion": 0})
                b["prompt"] += prompt
                b["cached"] += cached
                b["completion"] += completion
        except Exception:  # noqa: BLE001 — metering must never break a run
            pass

    # Accept both callback styles langchain may use.
    on_llm_error = lambda self, *a, **k: None  # noqa: E731

    @staticmethod
    def _extract(response):
        out = getattr(response, "llm_output", None) or {}
        usage = None
        model = None
        if isinstance(out, dict):
            usage = out.get("token_usage") or out.get("usage")
            model = out.get("model_name") or out.get("model")
        if not usage:
            for gen_list in getattr(response, "generations", []) or []:
                for gen in gen_list:
                    msg = getattr(gen, "message", None)
                    um = getattr(msg, "usage_metadata", None)
                    if um:
                        usage = um
                        break
                    info = getattr(gen, "generation_info", None) or {}
                    if isinstance(info, dict) and info.get("model_name"):
                        model = info["model_name"]
                if usage:
                    break
        return usage, model

    def summary(self) -> Dict[str, Any]:
        tp = tc = tcomp = 0
        cost = 0.0
        with self._lock:
            for model, b in self.by_model.items():
                hit_in, miss_in, out_p = _price_for(model)
                cached = b["cached"]
                miss = max(0, b["prompt"] - cached)
                cost += cached / 1e6 * hit_in + miss / 1e6 * miss_in + b["completion"] / 1e6 * out_p
                tp += b["prompt"]
                tc += cached
                tcomp += b["completion"]
            by_model = {k: dict(v) for k, v in self.by_model.items()}
        return {
            "llm_calls": self.calls,
            "prompt_tokens": tp,
            "cached_tokens": tc,
            "completion_tokens": tcomp,
            "total_tokens": tp + tcomp,
            "cost_usd": round(cost, 4),
            "by_model": by_model,
        }

# Maximum time (seconds) a single analysis job is allowed to run before
# the worker thread is considered stalled and the job is failed.
JOB_TIMEOUT_SECONDS = int(os.environ.get("TRADINGAGENTS_JOB_TIMEOUT", "900"))

# API-key env var per LLM provider.  Checked at analysis-submit time —
# against the provider the request actually selects — so users get
# immediate feedback instead of an opaque SSE error 30 seconds later.
# Providers absent here (glm, minimax, azure, ollama…) skip the check;
# their key conventions vary / they may not need one.
PROVIDER_KEY_ENV = {
    "deepseek": "DEEPSEEK_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "xai": "XAI_API_KEY",
    "qwen": "DASHSCOPE_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}

# ── helpers ────────────────────────────────────────────────────────────

def _build_config(request: AnalyzeRequest) -> Dict[str, Any]:
    """Merge API-request overrides into DEFAULT_CONFIG."""
    cfg = dict(DEFAULT_CONFIG)
    if request.llm_provider:
        cfg["llm_provider"] = request.llm_provider
    if request.deep_think_llm:
        cfg["deep_think_llm"] = request.deep_think_llm
    if request.quick_think_llm:
        cfg["quick_think_llm"] = request.quick_think_llm
    if request.backend_url:
        cfg["backend_url"] = request.backend_url
    if request.output_language:
        cfg["output_language"] = request.output_language
    if request.research_depth == "deep":
        cfg["max_debate_rounds"] = 2
        cfg["max_risk_discuss_rounds"] = 2
    elif request.research_depth == "exhaustive":
        # CLI-parity "Deep": the CLI wizard's deepest setting runs 5
        # debate + 5 risk rounds (cli/main.py feeds the raw selection
        # into both) — long and comparatively expensive.
        cfg["max_debate_rounds"] = 5
        cfg["max_risk_discuss_rounds"] = 5
    elif request.research_depth == "quick":
        # Minimal debate: no back-and-forth, just first-pass analysis
        cfg["max_debate_rounds"] = 0
        cfg["max_risk_discuss_rounds"] = 0
    # Per-LLM-call resilience: cap a single hung/queued call (free-tier models
    # queue) so one stall can't silently burn the whole run toward the job
    # watchdog; retries ride out transient rate-limits/hiccups.
    cfg["llm_timeout"] = int(os.getenv("TRADINGAGENTS_LLM_TIMEOUT", "180"))
    cfg["llm_max_retries"] = int(os.getenv("TRADINGAGENTS_LLM_MAX_RETRIES", "3"))
    return cfg


def _safe_ticker_dir(ticker: str) -> str:
    """Resolve safe directory name for a ticker.

    ``safe_ticker_component`` raises ``ValueError`` on a malformed ticker
    (bad chars, over-length, dots-only); translate that into a clean 400 so
    the report routes return a proper client error instead of a 500.
    """
    try:
        return safe_ticker_component(ticker)
    except ValueError:
        raise HTTPException(400, f"Invalid ticker: {ticker!r}")


# ── background runner ──────────────────────────────────────────────────

def _run_analysis(job: Job, request: AnalyzeRequest) -> None:
    """Execute the full TradingAgents pipeline in a daemon thread.

    Events are pushed into ``job._q`` so the SSE endpoint can stream them
    in real time.  Errors are caught, logged, and reflected in the job
    status so consumers see a terminal ``error`` event.

    A watchdog timer (JOB_TIMEOUT_SECONDS) prevents runaway jobs from
    holding connections open indefinitely.
    """
    def _timeout_handler():
        if job.status == "running":
            logger.error("Job %s timed out after %ds", job.job_id, JOB_TIMEOUT_SECONDS)
            job.status = "error"
            job.error = f"Analysis timed out after {JOB_TIMEOUT_SECONDS}s"
            job.put_event("error", {"message": job.error})

    timer = threading.Timer(JOB_TIMEOUT_SECONDS, _timeout_handler)
    timer.start()

    try:
        job.put_event(
            "status",
            {
                "message": f"Starting analysis for {request.ticker} on {request.date}",
                "status": "initializing",
            },
        )

        config = _build_config(request)
        # Guest/public runs use their own dedicated API key (scoped to this
        # run's LLM clients — never the env key the local/admin tier uses).
        if getattr(job, "tier", "admin") == "guest" and GUEST_API_KEY:
            config["llm_api_key"] = GUEST_API_KEY
        job.put_event("status", {"message": "Building graph...", "status": "building"})

        meter = TokenMeter()
        job.meter = meter
        graph = TradingAgentsGraph(
            selected_analysts=request.analysts,
            debug=False,
            config=config,
            callbacks=[meter],
        )

        job.put_event(
            "status",
            {"message": "Graph ready. Resolving pending entries...", "status": "preparing"},
        )

        # ── replicate the non-checkpoint-path of propagate() ──────────
        graph.ticker = request.ticker
        graph._resolve_pending_entries(request.ticker)

        past_context = graph.memory_log.get_past_context(request.ticker)
        init_agent_state = graph.propagator.create_initial_state(
            request.ticker, request.date, asset_type="stock", past_context=past_context
        )
        args = graph.propagator.get_graph_args()
        # The propagator (shared with the CLI) asks for stream_mode="values",
        # where every chunk is the FULL state dict — its first key is
        # "messages" (a list), so _dispatch_chunk_event's isinstance-dict
        # guard rejected every chunk and NO typed events (report/debate/
        # decision) ever reached live clients. "updates" mode yields
        # {node_name: state_delta} — real node names, per-node deltas —
        # which is the shape the dispatcher was written for.
        args["stream_mode"] = "updates"

        job.put_event(
            "status", {"message": "Graph running — streaming nodes now.", "status": "running"}
        )

        # ── stream every langgraph node delta as SSE events ───────────
        trace: List[Dict[str, Any]] = []
        for chunk in graph.graph.stream(init_agent_state, **args):
            if not isinstance(chunk, dict):
                continue
            for node, node_data in chunk.items():
                _dispatch_chunk_event(job, graph, node, node_data)
                if isinstance(node_data, dict):
                    trace.append(node_data)

        # ── merge into final state (init ∪ node deltas == the final
        #    values-mode state: unwritten channels only exist in init) ──
        final_state: Dict[str, Any] = dict(init_agent_state)
        for delta in trace:
            final_state.update(delta)

        graph.curr_state = final_state
        graph._log_state(request.date, final_state)
        graph.memory_log.store_decision(
            ticker=request.ticker,
            trade_date=request.date,
            final_trade_decision=final_state.get("final_trade_decision", ""),
        )

        short_signal = graph.process_signal(
            final_state.get("final_trade_decision", "")
        )

        usage = meter.summary()
        logging.getLogger("uvicorn.error").info(
            "Run %s cost: $%.4f | %d LLM calls | %d prompt (%d cached) + %d completion tokens",
            job.job_id, usage["cost_usd"], usage["llm_calls"],
            usage["prompt_tokens"], usage["cached_tokens"], usage["completion_tokens"],
        )

        job.final_state = final_state
        job.usage = usage
        job.result = {
            "ticker": request.ticker,
            "date": request.date,
            "decision": final_state.get("final_trade_decision", ""),
            "signal": short_signal,
            "usage": usage,
        }
        job.status = "done"
        job.put_event("usage", usage)
        job.put_event("complete", {"message": "Analysis complete", "result": job.result})

    except Exception:
        tb = traceback.format_exc()
        # uvicorn swallows the app logger — mirror crashes to its namespace
        # so they're visible in the service log, not just eaten silently.
        logger.error("Analysis job %s crashed:\n%s", job.job_id, tb)
        logging.getLogger("uvicorn.error").error("Analysis job %s crashed:\n%s", job.job_id, tb)
        job.status = "error"
        job.error = tb
        # Never ship the traceback to the public tier — it leaks file paths,
        # library versions, and internal structure. Admin (local) keeps the
        # tail for debugging; the full trace is always in the server log above.
        if getattr(job, "tier", "admin") == "admin":
            job.put_event("error", {"message": f"Analysis failed: {tb[-300:]}"})
        else:
            job.put_event("error", {"message": "Analysis failed — the desk hit an error. Please try again."})
    finally:
        timer.cancel()


# Which risk_debate_state response field belongs to which node — the
# debator turns carry their argument here, NOT in judge_decision.
_RISK_RESPONSE_FIELDS = {
    "Aggressive Analyst": "current_aggressive_response",
    "Risky Analyst": "current_aggressive_response",
    "Conservative Analyst": "current_conservative_response",
    "Safe Analyst": "current_conservative_response",
    "Neutral Analyst": "current_neutral_response",
}


def _dispatch_chunk_event(
    job: Job,
    graph: TradingAgentsGraph,
    node: str,
    node_data: Dict[str, Any],
) -> None:
    """Emit typed SSE events for one updates-mode node delta.

    A single delta can carry several state fields (e.g. the Research
    Manager returns investment_debate_state AND investment_plan), so
    this emits every applicable event rather than first-match-return.
    """
    if not isinstance(node_data, dict):
        return

    emitted = False

    # ── analyst reports ──
    for section in ("market_report", "sentiment_report", "news_report", "fundamentals_report"):
        if node_data.get(section):
            job.put_event("report", {
                "section": section,
                "report": node_data[section],
                "node": node,
            })
            emitted = True

    # ── investment debate (bull/bear turns + the manager's directive) ──
    if "investment_debate_state" in node_data:
        deb = node_data["investment_debate_state"] or {}
        if deb.get("judge_decision"):
            # Research Manager's ruling doubles as the investment plan
            # (research_manager sets current_response == judge_decision ==
            # investment_plan). Emit it ONCE, as the plan report — the
            # terminal keys its "directive received" tracking off this frame.
            plan = node_data.get("investment_plan") or deb["judge_decision"]
            job.put_event("report", {
                "section": "trader_plan",
                "report": plan,
                "node": node,
            })
        else:
            job.put_event("debate", {
                "debate_type": "investment",
                "current_response": deb.get("current_response", ""),
                "judge_decision": "",
                "node": node,
            })
        emitted = True
    elif node_data.get("investment_plan"):
        job.put_event("report", {
            "section": "trader_plan",
            "report": node_data["investment_plan"],
            "node": node,
        })
        emitted = True

    # ── risk chamber ──
    if "risk_debate_state" in node_data:
        risk = node_data["risk_debate_state"] or {}
        resp_field = _RISK_RESPONSE_FIELDS.get(node)
        response = risk.get(resp_field, "") if resp_field else ""
        if response:
            job.put_event("debate", {
                "debate_type": "risk",
                "current_response": response,
                "judge_decision": "",
                "node": node,
            })
            emitted = True
        # The PM's risk judge_decision == final_trade_decision, which the
        # decision event below carries verbatim — no duplicate frame.

    # ── trader plan ──
    if node_data.get("trader_investment_plan"):
        job.put_event("report", {
            "section": "trader_plan",
            "report": node_data["trader_investment_plan"],
            "node": node,
        })
        emitted = True

    # ── final decision ──
    if node_data.get("final_trade_decision"):
        decide = node_data["final_trade_decision"]
        try:
            sig = graph.process_signal(decide)
        except Exception:
            sig = ""
        job.put_event("decision", {
            "final_decision": decide,
            "signal": sig,
            "node": node,
        })
        emitted = True

    if emitted:
        return

    # ── messages (LLM tool-calls, etc.) ──
    if "messages" in node_data:
        msgs = node_data["messages"]
        if msgs:
            last = msgs[-1]
            content = getattr(last, "content", str(last))
            job.put_event("message", {
                "content": content[:500] if isinstance(content, str) else str(content)[:500],
                "node": node,
            })
            return

    # ── catch-all ──
    job.put_event("chunk", {
        "node": node,
        "keys": list(node_data.keys()),
    })


# ── FastAPI app ────────────────────────────────────────────────────────

app = FastAPI(
    title="TradingAgents API",
    description="REST + SSE wrapper around the TradingAgents multi-agent pipeline.",
    version="0.1.0",
    # Interactive docs / schema are a recon gift on a public deployment —
    # they'd advertise every route + parameter. Disabled in the public build.
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


# Frame-ancestors allow-list: the desk is embedded from the personal site,
# so arbitrary third-party framing (clickjacking) is blocked while the
# intended embed still works. Resource-restricting CSP directives are left
# off for now because the current build loads React/Babel from a CDN and
# uses inline bootstrap scripts; tightening those requires self-hosting first.
_FRAME_ANCESTORS = (
    "frame-ancestors 'self' https://zachbird.com https://www.zachbird.com "
    "https://zacharybird.com https://www.zacharybird.com"
)

# Full CSP. Scripts are locked to 'self' — React/ReactDOM/Babel are now
# vendored under gui/vendor/ (no runtime CDN), so a CDN compromise can no
# longer inject script into visitors. 'unsafe-inline'/'unsafe-eval' remain
# only because the page still uses inline bootstrap scripts + runtime Babel
# JSX; dropping those (precompile + externalize) is a later build-step change.
# Google Fonts is the sole allowed external origin (styles + font files).
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob:; "
    "connect-src 'self'; "
    "base-uri 'self'; object-src 'none'; "
    + _FRAME_ANCESTORS
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach baseline security headers to every response."""

    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("Content-Security-Policy", _CSP)
        return resp


# Auth middleware goes first (innermost) so that CORS headers are
# added to 403 responses the auth gate may produce.
app.add_middleware(BearerAuthMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── global error handlers ──────────────────────────────────────────────


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    # Return a flat array of messages so the frontend can join them
    messages = [
        (".".join(str(loc) for loc in err["loc"] if loc != "body") or "request") + ": " + err["msg"]
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": messages},
    )


# ── endpoints ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    running = sum(1 for j in _jobs.values() if j.status == "running")
    return {"status": "ok", "active_jobs": running}


@app.get("/auth/verify", response_model=TokenVerificationResponse)
async def verify_token(request: Request):
    """Report the resolved tier for the presented credentials.

    Reaching this handler means the request passed the auth gate (admin
    token, guest passcode, or the open guest desk). ``valid`` reflects
    whether the token actually resolved to ``admin`` — so on the open desk
    an absent/wrong token reads ``valid: false, tier: guest`` instead of a
    misleading ``valid: true``."""
    tier = getattr(request.state, "tier", "guest")
    return TokenVerificationResponse(valid=(tier == "admin"), tier=tier)


@app.get("/config/defaults")
async def config_defaults(request: Request):
    """Effective server defaults for the GUI's advanced summon form.

    Non-secret values only — model names and provider, never keys.
    Guests get their tier + limits instead of server internals.
    """
    # Fail closed: an unset tier defaults to the least-privileged guest, never admin.
    tier = getattr(request.state, "tier", "guest")
    if tier == "guest":
        with _guest_lock:
            remaining = max(0, GUEST_DAILY_CAP - _guest_runs_today) \
                if _guest_day == date_type.today().isoformat() else GUEST_DAILY_CAP
        return {
            "tier": "guest",
            "research_depth_rounds": {"quick": 0, "standard": 1},
            "limits": {
                "depth_max": "standard",
                "daily_cap": GUEST_DAILY_CAP,
                "daily_remaining": remaining,
                "cooldown_seconds": GUEST_COOLDOWN_SECONDS,
            },
        }
    return {
        "tier": "admin",
        "llm_provider": DEFAULT_CONFIG.get("llm_provider"),
        "deep_think_llm": DEFAULT_CONFIG.get("deep_think_llm"),
        "quick_think_llm": DEFAULT_CONFIG.get("quick_think_llm"),
        "output_language": DEFAULT_CONFIG.get("output_language"),
        "research_depth_rounds": {"quick": 0, "standard": 1, "deep": 2, "exhaustive": 5},
        "providers_with_keys": sorted(
            p for p, var in PROVIDER_KEY_ENV.items() if os.environ.get(var)
        ),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, request: Request):
    """Kick off a new analysis.  Returns immediately with a ``job_id``.

    Validation (ticker format, date range, analyst names) is performed
    by the Pydantic model.  A pre-flight API-key check ensures the
    required credentials are present before the job starts.  Guest-tier
    requests are hard-clamped server-side regardless of the body.
    """
    # Fail closed: an unset tier defaults to the least-privileged guest, never admin.
    tier = getattr(request.state, "tier", "guest")
    if tier == "guest":
        # Fail CLOSED: if the guest desk isn't fully configured with its own
        # dedicated provider AND key, refuse rather than silently falling back
        # to the owner's paid default provider/env key.
        if not (GUEST_PROVIDER and GUEST_API_KEY):
            raise HTTPException(503, "The guest desk is temporarily unavailable.")
        # Clamp the request FIRST: guests never choose models, providers,
        # endpoints, output language, or expensive depths — no matter what
        # they sent. output_language is free-form and flows into every
        # agent's prompt, so it must be neutralized too (prompt-injection
        # + token-inflation vector).
        req.llm_provider = GUEST_PROVIDER or None
        req.deep_think_llm = GUEST_DEEP_LLM or None
        req.quick_think_llm = GUEST_QUICK_LLM or None
        req.backend_url = None
        req.output_language = None
        if req.research_depth not in ("quick", "standard"):
            req.research_depth = "standard"

    # ── pre-flight: API key for the provider this request selects ─────
    provider = (req.llm_provider or DEFAULT_CONFIG.get("llm_provider", "")).lower()
    key_var = PROVIDER_KEY_ENV.get(provider)
    # Guest runs may carry their own dedicated key (GUEST_API_KEY); that
    # satisfies the preflight even when the provider's env key is unset.
    guest_key_ok = tier == "guest" and bool(GUEST_API_KEY)
    if key_var and not os.environ.get(key_var) and not guest_key_ok:
        raise HTTPException(
            503,
            f"Backend not ready for provider '{provider}': missing environment "
            f"variable {key_var}. Set it in the project .env file.",
        )

    # ── guest accounting — AFTER preflight so a 503 never burns a run ──
    if tier == "guest":
        global _guest_day, _guest_runs_today, _guest_last_submit
        import time as _time
        client_ip = _client_ip(request)
        with _guest_lock:
            today = date_type.today().isoformat()
            if _guest_day != today:
                _guest_day = today
                _guest_runs_today = 0
                _guest_ip_runs.clear()
                _guest_ip_last.clear()
            # Global ceiling (overall spend brake).
            if _guest_runs_today >= GUEST_DAILY_CAP:
                raise HTTPException(429, "The guest desk has hit today's run limit. Come back tomorrow.")
            # Per-visitor sub-limit so one actor can't drain the whole cap and
            # starve everyone else.
            if _guest_ip_runs.get(client_ip, 0) >= GUEST_PER_IP_DAILY_CAP:
                raise HTTPException(429, "You've reached today's run limit for this desk. Come back tomorrow.")
            now = _time.time()
            wait = max(
                GUEST_COOLDOWN_SECONDS - (now - _guest_last_submit),
                GUEST_COOLDOWN_SECONDS - (now - _guest_ip_last.get(client_ip, 0.0)),
            )
            if wait > 0:
                raise HTTPException(429, f"The guest desk is cooling down — try again in {int(wait) + 1}s.")
            if any(j.status == "running" and getattr(j, "tier", "admin") == "guest" for j in _jobs.values()):
                raise HTTPException(429, "Another guest run is already in session. One council at a time.")
            _guest_runs_today += 1
            _guest_last_submit = now
            _guest_ip_runs[client_ip] = _guest_ip_runs.get(client_ip, 0) + 1
            _guest_ip_last[client_ip] = now
        # uvicorn's log config swallows app loggers — use its namespace so
        # the guest audit trail lands in the service log.
        logging.getLogger("uvicorn.error").info(
            "Guest run accepted: ticker=%s depth=%s (run %d/%d today)",
            req.ticker, req.research_depth, _guest_runs_today, GUEST_DAILY_CAP,
        )

    # Full 128-bit id: a truncated id is guessable/collidable, and any holder
    # of a job id can read its SSE stream — so it must be unpredictable.
    job_id = uuid.uuid4().hex
    job = Job(job_id, req.ticker, req.date)
    job.tier = tier
    _jobs[job_id] = job
    # Bound memory: keep every running job plus the 20 most-recent finished
    # ones; drop older finished jobs (insertion order = recency).
    if len(_jobs) > 40:
        _finished = [jid for jid, j in list(_jobs.items()) if j.status in ("done", "error")]
        for jid in _finished[:-20]:
            _jobs.pop(jid, None)

    thread = threading.Thread(
        target=_run_analysis, args=(job, req), daemon=True
    )
    job.thread = thread
    thread.start()

    logger.info("Job %s started for %s on %s", job_id, req.ticker, req.date)
    return AnalyzeResponse(job_id=job_id)


@app.get("/stream/{job_id}")
async def stream(job_id: str):
    """Server-Sent Events stream of live analysis progress."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(404, f"Job {job_id!r} not found")

    async def _generator():
        loop = asyncio.get_running_loop()
        while True:
            event = await loop.run_in_executor(None, job.get_event, 0.25)
            if event is not None:
                yield f"data: {event}\n\n"
                # If terminal event was just sent, stop.
                evt = json.loads(event)
                if evt.get("type") in ("complete", "error"):
                    return
            elif job.status in ("done", "error"):
                # Queue drained and job is finished — send final event
                # as a safety net in case the terminal event was missed.
                if job.status == "done" and job.result:
                    yield f"data: {json.dumps({'type': 'complete', 'data': {'message': 'Analysis complete', 'result': job.result}})}\n\n"
                elif job.status == "error":
                    _emsg = (
                        (job.error or "unknown")[-300:]
                        if getattr(job, "tier", "admin") == "admin"
                        else "Analysis failed — please try again."
                    )
                    yield f"data: {json.dumps({'type': 'error', 'data': {'message': _emsg}})}\n\n"
                return
            # Still running but no events yet — heartbeat so the
            # connection doesn't look dead.
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"

    return StreamingResponse(
        _generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/reports", response_model=ReportList)
async def list_reports(request: Request):
    """List all past analysis reports from the results directory (admin only).

    The archive is the owner's private analysis history — never exposed to the
    public/guest tier. Guests see only their own live run via the SSE stream.
    """
    if getattr(request.state, "tier", "guest") != "admin":
        raise HTTPException(403, "Reports are private.")
    reports: List[ReportSummary] = []
    if not RESULTS_DIR.exists():
        return ReportList(reports=reports)

    for ticker_dir in sorted(RESULTS_DIR.iterdir()):
        if not ticker_dir.is_dir():
            continue
        log_dir = ticker_dir / "TradingAgentsStrategy_logs"
        if not log_dir.exists():
            continue
        for log_file in sorted(
            log_dir.glob("full_states_log_*.json"), reverse=True
        ):
            date_str = log_file.stem.replace("full_states_log_", "")
            reports.append(
                ReportSummary(
                    ticker=ticker_dir.name,
                    date=date_str,
                    # Relative id only — don't leak the absolute results path
                    # (OS username + home layout). The UI keys off ticker/date.
                    path=f"{ticker_dir.name}/{date_str}",
                )
            )

    return ReportList(reports=reports)


# NOTE: must be registered BEFORE /reports/{ticker}/{date} — Starlette matches
# routes in registration order and "prices" would otherwise bind as {ticker}.
@app.get("/reports/prices/{ticker}")
def get_price_history(
    ticker: str,
    date: Optional[str] = Query(None, description="End date YYYY-MM-DD (default: today)"),
    days: int = Query(120, ge=5, le=365),
):
    """OHLCV history for the terminal UI's chart backdrop (read-only, additive).

    Sync `def` on purpose: FastAPI runs it in the threadpool, so the
    yfinance call (with its rate-limit retries) never blocks the SSE loop.
    """
    import yfinance as yf

    from tradingagents.dataflows.stockstats_utils import yf_retry

    symbol = ticker.strip().upper()
    if not re.fullmatch(r"[A-Z]{1,10}", symbol):
        raise HTTPException(400, f"Invalid ticker: {ticker!r}")
    try:
        end = (
            datetime.strptime(date, "%Y-%m-%d").date() if date else date_type.today()
        )
    except ValueError:
        raise HTTPException(400, f"Invalid date (want YYYY-MM-DD): {date!r}")
    start = end - timedelta(days=days)

    try:
        df = yf_retry(
            lambda: yf.Ticker(symbol).history(
                start=start.isoformat(),
                end=(end + timedelta(days=1)).isoformat(),
            )
        )
    except Exception:  # noqa: BLE001 — surface feed failures as 502
        logger.warning("Price feed failure for %s:\n%s", symbol, traceback.format_exc())
        raise HTTPException(502, "Price feed unavailable (upstream error)")

    if df is None or df.empty:
        raise HTTPException(404, f"No price data for {symbol}")
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)

    series = []
    for idx, row in df.iterrows():
        try:
            o, h, l, c = (float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"]))
        except (KeyError, TypeError, ValueError):
            continue
        if any(v != v for v in (o, h, l, c)):
            # NaN OHLC rows (halts, dividend-only days) must not 500 the
            # whole series — JSONResponse renders with allow_nan=False.
            continue
        try:
            vol = int(row.get("Volume", 0) or 0)
        except (TypeError, ValueError):
            vol = 0
        series.append(
            {
                "date": idx.strftime("%Y-%m-%d"),
                "o": round(o, 2),
                "h": round(h, 2),
                "l": round(l, 2),
                "c": round(c, 2),
                "v": vol,
            }
        )
    if not series:
        raise HTTPException(404, f"No usable price rows for {symbol}")
    # Report the real trading-day span the series covers (not the requested
    # calendar window, which can name a weekend/holiday the data omits).
    return {
        "ticker": symbol,
        "start": series[0]["date"],
        "end": series[-1]["date"],
        "series": series,
    }


@app.get("/reports/{ticker}/{date}")
async def get_report(ticker: str, date: str, request: Request):
    """Return the full analysis JSON for a ticker + date (admin only)."""
    if getattr(request.state, "tier", "guest") != "admin":
        raise HTTPException(403, "Reports are private.")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise HTTPException(400, "Invalid date (want YYYY-MM-DD).")
    safe = _safe_ticker_dir(ticker)
    path = RESULTS_DIR / safe / "TradingAgentsStrategy_logs" / f"full_states_log_{date}.json"
    if not path.exists():
        raise HTTPException(404, f"Report not found: {ticker}/{date}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@app.get("/reports/{ticker}/{date}/markdown")
async def get_report_markdown(ticker: str, date: str, request: Request):
    """Render the analysis report as markdown (admin only)."""
    if getattr(request.state, "tier", "guest") != "admin":
        raise HTTPException(403, "Reports are private.")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise HTTPException(400, "Invalid date (want YYYY-MM-DD).")
    safe = _safe_ticker_dir(ticker)
    path = RESULTS_DIR / safe / "TradingAgentsStrategy_logs" / f"full_states_log_{date}.json"
    if not path.exists():
        raise HTTPException(404, f"Report not found: {ticker}/{date}")

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    # Build markdown from raw JSON keys.  Every field is optional so
    # downstream UIs don't break on edge cases.
    sections = []

    def _add(title: str, key: str, default: str = "N/A"):
        val = data.get(key, default)
        if val and val != default:
            sections.append(f"## {title}\n\n{val}\n")

    sections.append(
        f"# {data.get('company_of_interest', ticker)} — "
        f"{data.get('trade_date', date)}\n"
    )

    _add("Final Decision", "final_trade_decision")
    _add("Market Report", "market_report")
    _add("Sentiment Report", "sentiment_report")
    _add("News Report", "news_report")
    _add("Fundamentals Report", "fundamentals_report")
    _add("Investment Plan", "investment_plan", "N/A")
    _add("Trader Investment Plan", "trader_investment_plan")
    _add("Portfolio Manager Decision", "final_trade_decision")

    def _dec_md(val):
        # judge_decision is prose markdown in practice — render it as-is;
        # only JSON-fence genuinely structured values.
        if isinstance(val, (dict, list)):
            return "```json\n" + json.dumps(val, indent=2) + "\n```"
        return str(val)

    risk = data.get("risk_debate_state", {})
    if isinstance(risk, dict) and risk.get("judge_decision"):
        sections.append(f"## Risk Assessment\n\n{_dec_md(risk['judge_decision'])}\n")

    debate = data.get("investment_debate_state", {})
    if isinstance(debate, dict) and debate.get("judge_decision"):
        sections.append(f"## Investment Debate Decision\n\n{_dec_md(debate['judge_decision'])}\n")

    sections.append("\n---\n*Generated by TradingAgents*")
    return StreamingResponse(
        iter(["\n".join(sections)]),
        media_type="text/markdown",
    )


# ── Root redirect → the GUI ───────────────────────────────────────────


@app.get("/")
async def root_redirect():
    """Redirect the root URL to the TradingAgentsGUI frontend."""
    return RedirectResponse(url="/gui/", status_code=307)


@app.get("/the-bazaar/{rest:path}")
async def legacy_bazaar_redirect(rest: str, request: Request):
    """Legacy path: the frontend dir was renamed the-bazaar → gui."""
    query = f"?{request.url.query}" if request.url.query else ""
    return RedirectResponse(url=f"/gui/{rest}{query}", status_code=307)


# ── Static files (mounted last so API routes take precedence) ──────────
_FRONTEND_DIR = _PROJECT_ROOT / "web-ui" / "frontend"
if _FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="static")


# ── entrypoint ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    # Bind loopback by default so the desk is reachable only through the
    # cloudflared tunnel (which connects to localhost), not the LAN. Override
    # with HOST=0.0.0.0 only if you deliberately want LAN exposure.
    uvicorn.run(
        app,
        host=os.getenv("HOST", "127.0.0.1"),
        port=8000,
        reload=False,
        log_level="info",
    )
