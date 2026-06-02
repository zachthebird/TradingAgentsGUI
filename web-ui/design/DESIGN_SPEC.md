# TradingAgents Web GUI — Design Specification

## 1. Design Principles

**Data-Dense, Not Cluttered.** The CLI packs agent status, message log, report, and stats into a single terminal view. The web GUI must preserve that information density while using the extra real estate to improve scannability.

**Live First.** The core experience is watching an analysis run. Layout must prioritize the real-time streaming view — static screens (input form, history) orbit around it.

**Dark Financial Theme.** All screens use a dark background with high-contrast data presentation. Color is reserved for buy/sell signals, status indicators, and section hierarchy — never decoration.

**Responsive.** Three breakpoints: Full (>=1280px), Compact (768-1279px), Mobile (<768px). The live analysis panel arrangement collapses from 3-column to stacked on smaller viewports.

---

## 2. Color Palette

```
┌─────────────────────────────────────────────────────────┐
│ TOKEN              │ HEX       │ USAGE                   │
├─────────────────────────────────────────────────────────┤
│ --bg-root          │ #0B0E14   │ Page background         │
│ --bg-surface       │ #131820   │ Cards, panels           │
│ --bg-elevated      │ #1A2230   │ Modals, popovers        │
│ --bg-input         │ #0F141C   │ Input fields, selects   │
│ --border-default   │ #212A36   │ Panel borders, dividers │
│ --border-active    │ #2A5A4A   │ Focus/hover borders     │
│ --text-primary     │ #E8EDF4   │ Body text, headings     │
│ --text-secondary   │ #788896   │ Labels, metadata        │
│ --text-muted       │ #4A5568   │ Disabled, placeholder   │
│ --accent-teal      │ #00C897   │ Primary CTAs, links     │
│ --accent-teal-hover│ #00E0A8   │ Hover state             │
│ --signal-bullish   │ #26A69A   │ Buy, positive, up       │
│ --signal-bearish   │ #EF5350   │ Sell, negative, down    │
│ --signal-neutral   │ #FFA726   │ Hold, warning           │
│ --status-pending   │ #546E7A   │ Pending agent status    │
│ --status-active    │ #42A5F5   │ In-progress status      │
│ --status-done      │ #66BB6A   │ Completed status        │
│ --status-error     │ #EF5350   │ Error status            │
│ --chart-line       │ #00C897   │ Chart line stroke       │
│ --chart-grid       │ #1A2230   │ Chart grid lines        │
└─────────────────────────────────────────────────────────┘
```

Font stack: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
Monospace: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`

---

## 3. Component Hierarchy

```
AppShell
├── Sidebar (icon rail + expandable)
│   ├── NavItem("New Analysis")
│   ├── NavItem("History")
│   ├── NavItem("Settings")
│   └── Brand lockup (bottom)
├── MainArea
│   ├── [Screen: InputForm]
│   │   └── FormCard
│   │       ├── TickerInput
│   │       ├── DatePicker
│   │       ├── AnalystCheckboxGroup
│   │       ├── ResearchDepthSlider
│   │       ├── LLMProviderSelect
│   │       ├── ModelSelect (shallow + deep)
│   │       └── SubmitButton
│   ├── [Screen: LiveAnalysis]
│   │   ├── StatusBar (ticker, date, elapsed, agent count, token count)
│   │   ├── PanelRow
│   │   │   ├── AgentPanel
│   │   │   │   └── AgentTable
│   │   │   │       └── AgentRow (team, name, status spinner, wall time)
│   │   │   ├── MessageLog
│   │   │   │   └── MessageRow (timestamp, type badge, content)
│   │   │   └── ReportPanel
│   │   │       └── MarkdownBlock (streaming)
│   │   └── StatsBar (agents done/total, LLM calls, tools, tokens, reports)
│   ├── [Screen: ReportView]
│   │   ├── ReportHeader (ticker, date, decision badge, download btn)
│   │   ├── ReportNav (sidebar section links)
│   │   └── ReportBody
│   │       └── CollapsibleSection[] (MarkdownBlock per section)
│   └── [Screen: HistoryView]
│       ├── SearchBar + FilterChips
│       └── HistoryTable
│           └── HistoryRow (ticker, date, decision, analysts, duration, actions)
└── ToastContainer (notifications)
```

---

## 4. Screen Layouts

### 4.1 Input Form Screen

```
┌──────────────────────────────────────────────────────────┐
│  ☰ SIDEBAR  │  ┌─────────────────────────────────────┐  │
│             │  │         New Analysis                 │  │
│  New        │  │                                     │  │
│  Analysis ● │  │  Ticker Symbol                      │  │
│             │  │  ┌─────────────────────────────┐    │  │
│  History    │  │  │ AAPL                        │    │  │
│             │  │  └─────────────────────────────┘    │  │
│  Settings   │  │                                     │  │
│             │  │  Analysis Date                      │  │
│             │  │  ┌─────────────────────────────┐    │  │
│             │  │  │ 2026-05-21                  │    │  │
│             │  │  └─────────────────────────────┘    │  │
│             │  │                                     │  │
│             │  │  Analyst Team                       │  │
│             │  │  ☑ Market Analyst                  │  │
│             │  │  ☑ Sentiment Analyst               │  │
│             │  │  ☑ News Analyst                    │  │
│             │  │  ☑ Fundamentals Analyst            │  │
│             │  │                                     │  │
│             │  │  Research Depth                     │  │
│             │  │  ○───●───○───○───○  2 rounds      │  │
│             │  │                                     │  │
│             │  │  LLM Provider                       │  │
│             │  │  ┌─────────────────────────────┐    │  │
│             │  │  │ DeepSeek              ▼     │    │  │
│             │  │  └─────────────────────────────┘    │  │
│             │  │                                     │  │
│             │  │  Quick Thinking Model               │  │
│             │  │  ┌─────────────────────────────┐    │  │
│             │  │  │ DeepSeek V4 Pro         ▼   │    │  │
│             │  │  └─────────────────────────────┘    │  │
│             │  │                                     │  │
│             │  │  Deep Thinking Model                │  │
│             │  │  ┌─────────────────────────────┐    │  │
│             │  │  │ DeepSeek V4 Pro         ▼   │    │  │
│             │  │  └─────────────────────────────┘    │  │
│             │  │                                     │  │
│             │  │  ┌─────────────────────────────┐    │  │
│             │  │  │      ▶ Run Analysis         │    │  │
│             │  │  └─────────────────────────────┘    │  │
│             │  └─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Form states:**
- Default: All fields empty, defaults populated from localStorage
- Valid: Submit button enabled with accent-teal
- Invalid: Red border on offending field, inline error message
- Submitting: Button shows spinner, all fields disabled

### 4.2 Live Analysis Screen (Primary Deliverable)

```
┌──────────────────────────────────────────────────────────┐
│  ☰  │  ● AAPL  │  2026-05-21  │  ⏱ 02:34  │  Tokens: 12.4k↑ 8.2k↓ │
├─────┴────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │   AGENTS     │ │  LOG         │ │  CURRENT REPORT    │ │
│  │              │ │              │ │                    │ │
│  │ Team  Agent  │ │ 14:32:15     │ │ ## Market Analysis │ │
│  │ ──────────── │ │ [Agent]      │ │                    │ │
│  │ Analyst      │ │ Market       │ │ Analysis for AAPL  │ │
│  │  Market   ✓  │ │ Analyst is   │ │ as of May 21...    │ │
│  │  Sentiment ◉ │ │ researching  │ │                    │ │
│  │  News      ○ │ │ AAPL market  │ │ The 50-day SMA is  │ │
│  │  Fundam.   ○ │ │ data...      │ │ at 185.42, showing  │ │
│  │ ──────────── │ │              │ │ strong support...   │ │
│  │ Research     │ │ 14:32:18     │ │                    │ │
│  │  Bull      ○ │ │ [Tool]       │ │ RSI at 58.3 in a    │ │
│  │  Bear      ○ │ │ get_stock... │ │ neutral-bullish     │ │
│  │  Manager   ○ │ │              │ │ zone, suggesting    │ │
│  │ ──────────── │ │ 14:32:20     │ │ further upside...   │ │
│  │ Trading      │ │ [Data]       │ │                    │ │
│  │  Trader    ○ │ │ Received     │ │ MACD crossover      │ │
│  │ ──────────── │ │ stock data   │ │ above signal line   │ │
│  │ Risk Mgmt    │ │ for AAPL...  │ │ confirms...         │ │
│  │  Aggress.  ○ │ │              │ │                    │ │
│  │  Neutral   ○ │ │              │ │                    │ │
│  │  Conserv.  ○ │ │              │ │                    │ │
│  │ ──────────── │ │              │ │                    │ │
│  │ Portfolio    │ │              │ │                    │ │
│  │  Manager   ○ │ │              │ │                    │ │
│  └──────────────┘ └──────────────┘ └────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Agents: 3/11  │  LLM: 4  │  Tools: 12  │  Reports: 1/7  │
└──────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Agent rows pulse a subtle glow when status is "in_progress"
- Agent name becomes a link when completed — clicking jumps to that agent's report section
- Message log auto-scrolls to bottom, with a "pinned to bottom" toggle
- Report panel streams markdown content character-by-character or chunk-by-chunk
- Report panel has a sticky header showing the current section being generated
- Stats bar updates in real-time via WebSocket/SSE

### 4.3 Report View Screen

```
┌──────────────────────────────────────────────────────────┐
│  ☰  │  ← Back to Analysis    [SELL ▼]    ⬇ Download     │
├─────┴────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌────────────────────────────────────┐ │
│  │ SECTIONS     │ │ # AAPL Trading Analysis Report     │ │
│  │              │ │                                    │ │
│  │ ● Analyst    │ │ ## I. Analyst Team Reports         │ │
│  │   Reports    │ │                                    │ │
│  │   Market     │ │ ### Market Analyst ▲               │ │
│  │   Sentiment  │ │ ┌────────────────────────────────┐ │ │
│  │   News       │ │ │ Analysis for AAPL...           │ │ │
│  │   Fundam.    │ │ │                                │ │ │
│  │              │ │ │ The 50-day SMA sits at 185.42  │ │ │
│  │ ○ Research   │ │ │ providing strong support...    │ │ │
│  │   Decision   │ │ │                                │ │ │
│  │              │ │ │ RSI of 58.3 indicates...       │ │ │
│  │ ○ Trading    │ │ └────────────────────────────────┘ │ │
│  │   Plan       │ │                                    │ │
│  │              │ │ ### Sentiment Analyst ▼            │ │
│  │ ○ Risk Mgmt  │ │                                    │ │
│  │              │ │ ### News Analyst ▼                 │ │
│  │ ○ Portfolio  │ │                                    │ │
│  │   Decision   │ │ ### Fundamentals Analyst ▼         │ │
│  │              │ │                                    │ │
│  └──────────────┘ └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Sidebar dots show which sections have content (●) vs empty (○)
- Active section highlighted with accent-teal left border
- Sections are collapsible — click header to toggle
- All sections expanded by default on page load
- Download button exports full markdown file
- Decision badge (BUY/SELL/HOLD) color-coded at top

### 4.4 History View Screen

```
┌──────────────────────────────────────────────────────────┐
│  ☰  │  🔍 Search...   [All] [Buy] [Sell] [Hold]        │
├─────┴────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │ Ticker  │ Date       │ Decision │ Analysts │ Time  │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ SMCI    │ 2026-05-21 │ SELL  🔴 │ M S N F  │ 4:32  │  │
│  │ SHAK    │ 2026-05-19 │ BUY   🟢 │ M S N F  │ 3:18  │  │
│  │ PLTR    │ 2026-05-21 │ SELL  🔴 │ M S N F  │ 5:01  │  │
│  │ AAPL    │ 2026-05-19 │ HOLD  🟡 │ M S N F  │ 2:45  │  │
│  │ NVDA    │ 2026-05-18 │ BUY   🟢 │ M N    │ 3:52    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ← 1  2  3  4  5  →                                     │
└──────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Click a row to open that analysis in ReportView
- Filter chips toggle to show/hide specific decisions
- Search filters by ticker symbol (instant client-side)
- Analysts column shows shorthand letters (M=Market, S=Sentiment, N=News, F=Fundamentals)
- Pagination at bottom, 20 rows per page
- Hover reveals action buttons: View Report, Re-run with same config, Delete

---

## 5. Responsive Breakpoints

### Full (>=1280px)
- Sidebar visible as icon rail (48px) with expand-on-hover to 220px
- Live Analysis: 3-column layout (agents 280px | log 400px | report flex)
- Report View: 2-column (nav 220px | body flex)

### Compact (768-1279px)
- Sidebar collapses to icon rail only (48px), no expand
- Live Analysis: 2-column (agents + log stacked left 50% | report right 50%)
- Report View: nav becomes horizontal tabs above body

### Mobile (<768px)
- Sidebar becomes bottom tab bar
- Live Analysis: single column with tab switcher between Agents/Log/Report panels
- Report View: nav hidden, sections become sequential with sticky section header
- History: cards instead of table rows

---

## 6. Data Flow

```
Browser                          Server (Python/FastAPI)
──────                          ─────────
WebSocket ◄────────────────────► SSE / WS endpoint
  │                                  │
  │  stream_chunk                   │  TradingAgentsGraph.stream()
  │  {                              │  yields per-node dicts
  │    messages: [...],             │
  │    agent_status: {...},         │
  │    report_section: {...},       │
  │    stats: {...}                 │
  │  }                              │
  │                                  │
  │  POST /api/analyze/start        │
  │  {ticker, date, analysts, ...}  │
  │                                  │
  │  GET /api/history               │
  │  GET /api/reports/:id           │
  ────────                          ─────────
```

The server wraps `TradingAgentsGraph.propagate()` and streams chunks via WebSocket. Each chunk maps 1:1 with what the CLI's `update_display()` currently renders — same data, different surface.

---

## 7. Motion & Micro-interactions

| Element | Animation |
|---------|-----------|
| Agent status change | 150ms color transition + brief pulse on "in_progress" |
| New message in log | Slide up (200ms ease-out) |
| Report streaming | Fade in new markdown blocks (300ms) |
| Stats update | Number counter roll-up |
| Form submission | Button compresses → spinner → success/error state |
| Section collapse | Height transition 250ms ease |
| Decision badge | Scale bounce on first render |

---

## 8. Accessibility

- All status colors paired with text labels (never color-only signals)
- Focus rings on all interactive elements (2px accent-teal)
- ARIA live region on streaming report panel
- Keyboard navigation: Tab through form, arrow keys through history table
- Screen reader announces agent status changes and report completion
