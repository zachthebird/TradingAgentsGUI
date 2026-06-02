# TradingAgents Backend API

FastAPI server wrapping the TradingAgents multi-agent trading analysis pipeline.
Streams live LangGraph node progress via Server-Sent Events.

## Quick Start

```bash
# Activate the project venv
source .venv/bin/activate

# Install API dependencies
pip install -r web-ui/backend/requirements.txt

# Run the server
cd web-ui/backend
python main.py
```

Server listens on **http://0.0.0.0:8000**.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze` | Start an analysis job. Returns `{job_id}`. |
| `GET` | `/stream/{job_id}` | SSE stream of live analysis progress. |
| `GET` | `/reports` | List all past analyses. |
| `GET` | `/reports/{ticker}/{date}` | Full report as JSON. |
| `GET` | `/reports/{ticker}/{date}/markdown` | Report rendered as markdown. |
| `GET` | `/health` | Liveness probe. |

### POST /analyze

```json
{
  "ticker": "AAPL",
  "date": "2026-01-15",
  "analysts": ["market", "social", "news", "fundamentals"],
  "research_depth": "standard",
  "llm_provider": "deepseek",
  "deep_think_llm": "deepseek-v4-pro",
  "quick_think_llm": "deepseek-v4-flash",
  "output_language": "English"
}
```

All fields except `ticker` and `date` are optional.  Omitted fields fall
back to the values in `tradingagents/default_config.py` and the project
`.env` file.

### GET /stream/{job_id} — SSE Event Types

| Type | Description |
|------|-------------|
| `status` | Progress updates (initializing, building, running, etc.) |
| `report` | Analyst report section completed (market, sentiment, news, fundamentals, trader_plan) |
| `debate` | Debate round output (investment or risk) |
| `message` | LLM message or tool call |
| `decision` | Final trade decision with extracted signal |
| `chunk` | Generic graph node output |
| `complete` | Analysis finished successfully |
| `error` | Analysis failed |
| `heartbeat` | Periodic keepalive while running |

## Architecture

- **Background threads**: each `/analyze` request spawns a daemon thread
  that calls `TradingAgentsGraph.graph.stream()`.  The synchronous
  LangGraph generator is driven from the thread; events are pushed into a
  thread-safe `queue.Queue`.

- **SSE draining**: the `/stream` endpoint reads from the queue via
  `loop.run_in_executor()` so the async event loop is never blocked.

- **Reports**: served directly from `~/.tradingagents/logs/` (the same
  directory used by the CLI).  Path-traversal protection is provided by
  `safe_ticker_component`.

## Environment

The server loads the project `.env` at startup.  The `TRADINGAGENTS_*`
variables in that file control LLM provider choice, model selection, and
output language — see `tradingagents/default_config.py` for the full list.
