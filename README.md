# TradingAgentsGUI

A GUI / front-end project for the [TradingAgents](https://github.com/TauricResearch/TradingAgents) multi-agent LLM financial trading framework. This repository contains the **"The Bazaar"** alternative UI prototype and the **"Traders of the Round Table"** castle-themed UI pack, built on top of the upstream TradingAgents backend.

## The Bazaar -- TradingAgents Alternative UI Prototype

A character-driven conversational trading interface. Summon your analyst team, watch them debate in real time as distinct personas, and receive a dramatic verdict on your trade.

The UI lives in `web-ui/frontend/the-bazaar/`. See its [README](web-ui/frontend/the-bazaar/README.md) for full design notes, and the [castle UI pack README](web-ui/frontend/the-bazaar/README%202castle.md) for the Round Table theme.

### Quick Start

```bash
# Make sure the TradingAgents backend is running first:
cd web-ui
bash start.sh

# Then open the prototype, or serve with a static file server:
python3 -m http.server 8081
# then visit http://localhost:8081
```

The prototype connects to the existing TradingAgents API at `http://localhost:8000` by default. Set `?api=http://other-host:8000` to change the backend URL.

### Design System

The Bazaar is the recommended primary UI concept from the TradingAgents redesign project. Its key principles are a **warm, inviting atmosphere** (amber/gold on dark earth tones); a **character-driven** approach where each analyst is a distinct persona with avatar, color, and voice; a **conversational** flow where analysis unfolds as a chat between agents and user; and **lively animations** including typing indicators, entrance animations, and dramatic verdict reveals.

#### Agent Personas

| # | Character | Role | Color | Avatar |
| --- | --- | --- | --- | --- |
| 1 | Flint | Market Analyst | #8B6B4A | Bull |
| 2 | Vera | Sentiment Analyst | #C44B4B | Crystal |
| 3 | Reed | News Analyst | #4B7A9E | Scroll |
| 4 | Sage | Fundamentals Analyst | #5C8A6F | Chart |
| 5 | Balthazar | Investment Debater | #D4A030 | Scales |
| 6 | Morwen | Risk Debater | #7B8B9A | Shield |
| 7 | Kael | Trader | #C07840 | Runner |
| 8 | Elder Aldric | Judge | #9B8BAA | Crown |

### Flow

```
Bazaar Input -> Debate Hall (SSE stream) -> The Ledger (Verdict)
```

## Underlying Framework

This project is built on the TradingAgents framework (in this repo under `tradingagents/`, `cli/`, and related directories), a multi-agent trading framework that mirrors the dynamics of real-world trading firms. For full framework installation, CLI, and package usage docs, see the upstream project: https://github.com/TauricResearch/TradingAgents

> TradingAgents is designed for research purposes. It is not intended as financial, investment, or trading advice.
> 
