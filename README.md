# TradingAgentsGUI — PC-98 Council Terminal

A retro **PC-98 trading-terminal interface** for the [TradingAgents](https://github.com/TauricResearch/TradingAgents) multi-agent LLM trading framework — an eight-seat council analyzes a stock while you watch every report stream in live: analysts testify, Bull and Bear researchers debate, the risk chamber weighs in, and the Portfolio Manager hands down a verbatim ruling over a live candlestick chart.

Two complete UIs ship in one app, **toggleable in-GUI**:

- **PC-98 Council Terminal** *(default)* — 90s VGA/CRT terminal: advisor portraits present full reports in cream dialog windows, pipeline HUD (ANALYSTS → DEBATE → TRADER → RISK → VERDICT), live price chart backdrop, attract-mode idle screen, report INDEX/ARCHIVE/EXPORT.
- **Game Boy ADV battle** — DMG-green Pokémon-style battle view with the painterly medieval council (the earlier design, kept fully working — switch with the in-app button or `?ui=adv`).

**▶ Live demo: [zachbird.com/tradingAgentsGUI](https://zachbird.com/tradingAgentsGUI)** *(no keys needed — toggle between both UIs in-app; not financial advice)*

## What's in here

| Piece | Where | What it does |
|---|---|---|
| PC-98 terminal UI | `web-ui/frontend/gui/terminal-live.js` + `terminal.css` | Default live view: SSE-driven report pages, typewriter + talk-bob animation, candlestick chart, attract mode, archive reader, stream-drop recovery |
| ADV/battle UI | `web-ui/frontend/gui/castle-council.js` + `castle.css` | Game Boy shell, battle view, verdict banner — loads only in `?ui=adv` mode |
| Backend | `web-ui/backend/main.py` | FastAPI: `POST /analyze` runs a real TradingAgents graph, `GET /stream/{job_id}` streams typed SSE events per agent, `GET /reports/prices/…` feeds the chart; token-gated |
| Static demo | `web-ui/static-demo/` | Self-contained public demo (no backend, no keys): scripted Game Boy battle + recorded-session PC-98 replay, toggle between them |
| Character art | `web-ui/frontend/gui/design/pc98-cast/` (terminal) · `design/comic-cast/` (ADV) | 21 PC-98 finance-firm portraits · 8 painterly personas × 3 frames |
| Design refs | `web-ui/frontend/gui/design/` | UI spec, PC-98 reference image, full asset sheets |
| Framework | `tradingagents/`, `cli/` | Upstream TradingAgents (TauricResearch) — the actual agent pipeline |

## Pipeline → cast (PC-98 terminal)

Market **Amy** · Sentiment **Natsumi** · News **Satomi** · Fundamentals **Misaki** → full-report testimony · Bull **Reika** vs Bear **Aoi** → research debate · Trader **Chika** → execution plan · Research Manager & Portfolio Manager **Sabrina** → directive + verbatim ruling. The risk chamber is voiced by Reika (aggressive), Aoi (conservative), and Chika (neutral); junior analyst **Shinji** runs the data pulls, and the wider firm (Karen in Compliance, Hojo the Auditor, mascot CALC-98…) staffs the idle roster, archives, and error screens.

*(ADV mode keeps the medieval cast: Flint, Vera, Reed, Sage, Balthazar, Morwen, Kael, and High Judge Aldric.)*

## Run it live (self-hosted)

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env   # add your LLM API key(s); optional TRADINGAGENTS_API_TOKEN gate
cd web-ui && bash start.sh   # serves UI + API at http://localhost:8000
```

Type a ticker and begin the analysis — a real multi-agent run streams into the terminal page by page (takes a few minutes; costs whatever your LLM provider charges). Switch UIs any time: menu button in either view, or `?ui=terminal` / `?ui=adv`.

**Live runs are self-hosted only, by design.** The public site serves recorded/scripted demos; there is no hosted backend, no shared API keys, and nothing to abuse. Run it yourself with your own keys for live analyses.

## License & attribution

This project is a fork of, and built on, **[TradingAgents](https://github.com/TauricResearch/TradingAgents) by [Tauric Research](https://github.com/TauricResearch)** — the multi-agent pipeline (`tradingagents/`, `cli/`) is their work, used and redistributed under the [Apache License 2.0](LICENSE), which this repository retains. The GUIs, web backend wrapper, and demos in `web-ui/` are original additions under the same license. Both UIs display an on-screen attribution to Tauric Research.

> Research/portfolio project — not financial, investment, or trading advice.
