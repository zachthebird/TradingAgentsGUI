# TradingAgentsGUI — frontend

The GUI served at `http://localhost:8000/gui/`. Two complete, toggleable views over the same backend SSE stream:

| Mode | Files | Look |
|---|---|---|
| `terminal` *(default)* | `terminal-live.js` + `terminal.css` | PC-98 trading terminal — advisor portraits present full reports, pipeline HUD, candlestick backdrop |
| `adv` | `castle-council.js` + `castle.css` + `castle-audio.js` / `castle-share.js` | Game Boy ADV battle — painterly medieval council, typewriter dialogue, verdict banner |

Switch with the in-app button, or `?ui=terminal` / `?ui=adv` (persisted in `localStorage.tradingagents_ui_mode`). The mode loader at the bottom of `index.html` loads exactly one pack per page load.

`index.html` also contains the legacy inline React app (token gate + original screens) that runs beneath the overlays; the token gate (`localStorage.tradingagents_token`) is still the auth UX.

Art: `design/pc98-cast/` (terminal cast, sliced from `design/pc98-asset-sheet-finance.png`), `design/comic-cast/` (ADV cast). Design docs and reference sheets live in `design/`.

Built on [TradingAgents](https://github.com/TauricResearch/TradingAgents) by Tauric Research (Apache-2.0).
