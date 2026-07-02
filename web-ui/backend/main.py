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
# from HERMES_HOME (e.g. /Users/zachb/.hermes/profiles/web-dev-backend).
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

class TokenVerificationResponse(BaseModel):
    valid: bool


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

        # Always allow health checks.
        if path == "/health":
            return await call_next(request)

        # Allow static-frontend requests (the HTML / JS / CSS itself).
        # API routes are under /analyze, /stream, /reports, /auth — everything
        # else is assumed to be a static asset.
        _api_prefixes = ("/analyze", "/stream", "/reports", "/auth", "/config")
        if not any(path.startswith(p) for p in _api_prefixes):
            return await call_next(request)

        # Token not configured — allow all (local dev / LAN mode).
        if not API_TOKEN:
            return await call_next(request)

        # Query-param token (needed by browser EventSource for SSE).
        if request.query_params.get("token", "") == API_TOKEN:
            return await call_next(request)

        # Standard Authorization header.
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer ") and auth[len("Bearer "):] == API_TOKEN:
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
        invalid = set(v) - allowed
        if invalid:
            raise ValueError(f"Invalid analysts: {invalid}. Allowed: {allowed}")
        if not v:
            raise ValueError("At least one analyst must be selected")
        return v

    @field_validator("research_depth")
    @classmethod
    def validate_depth(cls, v: str) -> str:
        if v not in ("standard", "deep", "quick"):
            raise ValueError(f"Invalid research_depth: {v!r}. Must be 'standard', 'deep', or 'quick'.")
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

# Maximum time (seconds) a single analysis job is allowed to run before
# the worker thread is considered stalled and the job is failed.
JOB_TIMEOUT_SECONDS = int(os.environ.get("TRADINGAGENTS_JOB_TIMEOUT", "600"))

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
    elif request.research_depth == "quick":
        # Minimal debate: no back-and-forth, just first-pass analysis
        cfg["max_debate_rounds"] = 0
        cfg["max_risk_discuss_rounds"] = 0
    return cfg


def _safe_ticker_dir(ticker: str) -> str:
    """Resolve safe directory name for a ticker."""
    return safe_ticker_component(ticker)


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
        job.put_event("status", {"message": "Building graph...", "status": "building"})

        graph = TradingAgentsGraph(
            selected_analysts=request.analysts,
            debug=False,
            config=config,
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

        job.final_state = final_state
        job.result = {
            "ticker": request.ticker,
            "date": request.date,
            "decision": final_state.get("final_trade_decision", ""),
            "signal": short_signal,
        }
        job.status = "done"
        job.put_event("complete", {"message": "Analysis complete", "result": job.result})

    except Exception:
        tb = traceback.format_exc()
        logger.error("Analysis job %s crashed:\n%s", job.job_id, tb)
        job.status = "error"
        job.error = tb
        job.put_event("error", {"message": f"Analysis failed: {tb[-300:]}"})
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
)

# Auth middleware goes first (innermost) so that CORS headers are
# added to 403 responses the auth gate may produce.
app.add_middleware(BearerAuthMiddleware)

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
        ".".join(str(loc) for loc in err["loc"] if loc != "body") + ": " + err["msg"]
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
async def verify_token():
    """Validate the API token. Always returns 200; the auth middleware
    already rejected invalid tokens before this handler runs, so reaching
    here means the token is valid."""
    return TokenVerificationResponse(valid=True)


@app.get("/config/defaults")
async def config_defaults():
    """Effective server defaults for the GUI's advanced summon form.

    Non-secret values only — model names and provider, never keys.
    """
    return {
        "llm_provider": DEFAULT_CONFIG.get("llm_provider"),
        "deep_think_llm": DEFAULT_CONFIG.get("deep_think_llm"),
        "quick_think_llm": DEFAULT_CONFIG.get("quick_think_llm"),
        "output_language": DEFAULT_CONFIG.get("output_language"),
        "research_depth_rounds": {"quick": 0, "standard": 1, "deep": 2},
        "providers_with_keys": sorted(
            p for p, var in PROVIDER_KEY_ENV.items() if os.environ.get(var)
        ),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """Kick off a new analysis.  Returns immediately with a ``job_id``.

    Validation (ticker format, date range, analyst names) is performed
    by the Pydantic model.  A pre-flight API-key check ensures the
    required credentials are present before the job starts.
    """
    # ── pre-flight: API key for the provider this request selects ─────
    provider = (req.llm_provider or DEFAULT_CONFIG.get("llm_provider", "")).lower()
    key_var = PROVIDER_KEY_ENV.get(provider)
    if key_var and not os.environ.get(key_var):
        raise HTTPException(
            503,
            f"Backend not ready for provider '{provider}': missing environment "
            f"variable {key_var}. Set it in the project .env file.",
        )

    job_id = str(uuid.uuid4())[:8]
    job = Job(job_id, req.ticker, req.date)
    _jobs[job_id] = job

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
                    yield f"data: {json.dumps({'type': 'error', 'data': {'message': job.error or 'unknown'}})}\n\n"
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
async def list_reports():
    """List all past analysis reports from the results directory."""
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
                    path=str(log_file),
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
    return {
        "ticker": symbol,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "series": series,
    }


@app.get("/reports/{ticker}/{date}")
async def get_report(ticker: str, date: str):
    """Return the full analysis JSON for a ticker + date."""
    safe = _safe_ticker_dir(ticker)
    path = RESULTS_DIR / safe / "TradingAgentsStrategy_logs" / f"full_states_log_{date}.json"
    if not path.exists():
        raise HTTPException(404, f"Report not found: {ticker}/{date}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@app.get("/reports/{ticker}/{date}/markdown")
async def get_report_markdown(ticker: str, date: str):
    """Render the analysis report as markdown."""
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

    risk = data.get("risk_debate_state", {})
    if isinstance(risk, dict) and risk.get("judge_decision"):
        sections.append(
            f"## Risk Assessment\n\n```json\n{json.dumps(risk['judge_decision'], indent=2)}\n```\n"
        )

    debate = data.get("investment_debate_state", {})
    if isinstance(debate, dict) and debate.get("judge_decision"):
        sections.append(
            f"## Investment Debate Decision\n\n```json\n{json.dumps(debate['judge_decision'], indent=2)}\n```\n"
        )

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
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
