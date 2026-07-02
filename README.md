# Traders of the Round Table — TradingAgentsGUI

A Game Boy–style **ADV / Pokémon-battle interface** for the [TradingAgents](https://github.com/TauricResearch/TradingAgents) multi-agent LLM trading framework. Eight illustrated council members debate a stock — analysts testify, the Bull and Bear researchers battle with conviction bars, and the High Judge hands down the ruling.

**▶ Live demo: [zachbird.com/tradingAgentsGUI](https://zachbird.com/tradingAgentsGUI)** *(scripted replay — canned debate, any ticker, not financial advice)*

## What's in here

| Piece | Where | What it does |
|---|---|---|
| ADV/battle UI | `web-ui/frontend/the-bazaar/` | `castle-council.js` — DMG shell, typewriter dialogue, battle view, verdict; driven by live SSE from the backend |
| Backend | `web-ui/backend/main.py` | FastAPI: `POST /analyze` runs a real TradingAgents graph, `GET /stream/{job_id}` streams SSE; token-gated |
| Static demo | `web-ui/static-demo/` | Self-contained scripted replay (no backend, no keys) + three.js cinematic FX layer; what the public demo serves |
| Character art | `web-ui/frontend/the-bazaar/design/comic-cast/` | 8 painterly personas × idle/speaking/reacting frames |
| Framework | `tradingagents/`, `cli/` | Upstream TradingAgents (TauricResearch) — the actual agent pipeline |

## Pipeline → cast

Market/Sentiment/News/Fundamentals analysts → **Flint, Vera, Reed, Sage** (testimonies) · Bull vs Bear researchers → **Balthazar 〈BULL〉 vs Morwen 〈BEAR〉** (battle view) · Trader → **Kael** · Research Manager & Portfolio Manager → **High Judge Aldric** (verdict, shown verbatim). The risk-team debate is voiced by Balthazar (aggressive), Morwen (conservative), and Kael (neutral).

## Run it live (self-hosted)

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env   # add your LLM API key(s); optional TRADINGAGENTS_API_TOKEN gate
cd web-ui && bash start.sh   # serves UI + API at http://localhost:8000
```

Type a ticker and summon the council — a real multi-agent analysis streams into the battle UI (takes a few minutes; costs whatever your LLM provider charges).

> Built on TradingAgents by TauricResearch. Research/portfolio project — not financial, investment, or trading advice.
