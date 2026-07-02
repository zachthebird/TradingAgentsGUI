# Intro Flow Interaction Spec — Round Table Battle Demo

**Version:** 1.0  
**Date:** 2026-06-10  
**Author:** UX Designer (Hermes Agent, web-dev-ux-designer profile)  
**Implementation Files:** `demo-driver.js`, `index.html`, `demo-overrides.css` (NEW)  
**Untouchable Files:** `castle-council.js`, `castle.css`, `castle-audio.js`, `castle-share.js`, `castle-sprites.svg`

---

## 0. Implementation Boundary (READ FIRST)

Every behavior, element, style, and transition described in this spec MUST be achievable
entirely from `demo-driver.js` + `index.html` + a new `demo-overrides.css`. The following
files are **byte-identical snapshots** of the real app and MUST NOT be edited:

- `castle-council.js` — builds the ADV device DOM, owns the scene lifecycle
- `castle.css` — the DMG design system, all `.adv-*` and `.rt-*` styles
- `castle-audio.js` — audio playback
- `castle-share.js` — share/download button
- `castle-sprites.svg` — sprite sheet

If any design idea below would require editing one of those five files, it is invalid.
All new behavior is layered on top via:
- **demo-driver.js:** state machine, DOM manipulation, injecting new elements adjacent to
  existing ones, toggling visibility classes
- **index.html:** optional hidden scaffolding (input template, etc.)
- **demo-overrides.css:** all new CSS scoped to new element IDs/classes, with identical
  specificity to castle.css so the cascade works predictably

---

## 1. Problem Summary

The current demo auto-plays a debate for NVDA ~1.7s after page load. The visitor
becomes a spectator before they ever get to be a participant. Core issues:

| # | Severity | Problem |
|---|----------|---------|
| 1 | P0 | Auto-play of unchosen ticker; inverted participant→spectator flow |
| 2 | P0 | Ticker input is the LAST element on the page, below a tall empty verdict card, labeled "Challenge another stock" before any first stock was run |
| 3 | P1 | Premature chrome: 4 AWAITING slots, momentum bar at 50% NEUTRAL, empty verdict card ("—"), all render before anything meaningful has happened |
| 4 | P1 | Mid-run, no visible way to start your own trial |
| 5 | P2 | Control discoverability: typewriter skip, audio toggle, Chronicle key prompt |
| 6 | P2 | Cast anonymity: testimony starts with zero introduction of who the eight agents are |

This spec addresses P0 and P1 directly (P2 items are noted for a future pass).

---

## 2. Three-State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
    ┌──────────────────────────────┐                          │
    │  STATE A: THE COURT AWAITS   │                          │
    │  Greeter screen. Aldric      │                          │
    │  asks for a ticker.          │                          │
    └──────┬──────────────┬────────┘                          │
           │              │                                    │
           │ user enters   │ user clicks                       │
           │ ticker +      │ "witness sample trial"            │
           │ "Summon"      │ or equivalent                     │
           ▼              ▼                                    │
    ┌──────────────────────────────┐                          │
    │  STATE B: THE TRIAL          │──────────────────────────┼──┐
    │  Debate in progress.         │  "New trial" button       │  │
    │  Today's show, unchanged,    │  (returns to State A)     │  │
    │  + persistent "New trial"    │                           │  │
    │  affordance in controls.     │                           │  │
    └──────────────┬───────────────┘                           │  │
                   │                                            │  │
                   │ verdict event fires                        │  │
                   │ (decision type w/ signal)                  │  │
                   ▼                                            │  │
    ┌──────────────────────────────┐                           │  │
    │  STATE C: THE VERDICT        │                           │  │
    │  Verdict banner + card +     │───────────────────────────┼──┘
    │  challenge card + chronicles │  user enters new ticker    │
    │  carousel all revealed.      │  → State B                 │
    │                              │                           │
    │  "Replay" → State B (same    │  user clicks "New trial"   │
    │  ticker, replay from start)  │  → State A                 │
    └──────────────────────────────┘                           │
```

### 2.1 Transition Table

| From | Trigger | To | Notes |
|------|---------|----|-------|
| A | Ticker input + Enter or "Summon the Council" click | B | `run(ticker)` called. Validated: non-empty, ≤10 chars, alphanumeric + `.` |
| A | Click "or witness a sample trial (NVDA)" | B | `run('NVDA')` called immediately |
| A | Invalid/empty input submitted | A | Shake animation on input + inline error message in dialogue body (no state change) |
| B | Verdict `decision` event fires (step with `applyVerdictChrome`) | C | Automatic. No user action required. |
| B | Click "New trial" button in controls row | A | Stops current run via `stop()`, returns to greeter |
| C | Ticker input + Enter or "Analyze" click in challenge card | B | `run(ticker)` called (existing `#rt-challenge-card` behavior, unchanged) |
| C | Click "Replay" button | B | `run(state.ticker)` called (existing behavior, unchanged) |
| C | Click "New trial" button in controls row | A | Stops current run, returns to greeter |
| A | Page load | A | First visit lands here. No auto-play. |

### 2.2 State Tracking

`demo-driver.js` owns a `state.phase` variable:
```js
var state = { ..., phase: 'awaiting' };  // 'awaiting' | 'trial' | 'verdict'
```

State transitions call a `setPhase(newPhase)` function that:
1. Updates `state.phase`
2. Applies the visibility table (Section 5)
3. If entering State A: focuses the ticker input
4. If entering State B: calls `run(ticker)` (the existing replay engine)
5. If entering State C: reveals post-verdict chrome (the existing `applyVerdictChrome` logic)

---

## 3. Per-State Screen Layout

### 3.1 State A — "THE COURT AWAITS"

```
┌─────────────────────────────────────────────────────────────┐
│  —        THE ROUND TABLE        AWAITING CHALLENGE         │ ← status strip
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   ┌─────────────────┐                       │
│                   │                 │                       │
│                   │  Elder Aldric   │                       │ ← solo screen
│                   │  (idle sprite)  │                       │
│                   │                 │                       │
│                   └─────────────────┘                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ELDER ALDRIC                                         │  │ ← dialogue box
│  │ ──────────────────────────────────────────────────── │  │   (speaker + text)
│  │ Hark, traveler. Which stock shall stand trial        │  │
│  │ before the council this day?                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [   Enter ticker symbol...          ] [Summon the    ]│  │ ← greeter input area
│  │                                      [  Council     ]│  │   (new: #adv-greeter)
│  │                                                       │  │
│  │        or witness a sample trial (NVDA)               │  │ ← sample link
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  (deliberation grid HIDDEN)                                 │
│  (momentum bar HIDDEN)                                      │
│  (sentiment readout HIDDEN)                                 │
│  (move flourish HIDDEN)                                     │
│  (verdict banner HIDDEN)                                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ● Awaiting challenge...              [Unmute audio]   │  │ ← controls row
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↑ device bezel

(verdict card HIDDEN)
(challenge card HIDDEN)
(chronicles carousel HIDDEN)
```

### 3.2 State B — "THE TRIAL"

```
┌─────────────────────────────────────────────────────────────┐
│  NVDA      THE ROUND TABLE        COUNCIL CONVENES          │ ← status strip (live)
├─────────────────────────────────────────────────────────────┤
│  VS overlay → battle screen (bull vs bear)                  │
│  Momentum bar (live sentiment)                              │
│  Sentiment readout                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ BALTHAZAR (BULL)                                     │  │ ← dialogue box (live)
│  │ ──────────────────────────────────────────────────── │  │
│  │ Every kingdom races to raise AI citadels...          │  │
│  └───────────────────────────────────────────────────────┘  │
│  4 analyst slots (FLINT/VERA/REED/SAGE, status live)        │
│  (verdict banner HIDDEN until verdict)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ● The council chamber stirs...  [New Trial] [Replay]  │  │ ← controls row
│  │                               [Hide Chronicles] [🔇]  │  │   (New Trial is new)
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

(verdict card HIDDEN until verdict)
(challenge card HIDDEN until verdict)
(chronicles carousel HIDDEN until verdict)
```

### 3.3 State C — "THE VERDICT"

Identical to the current post-verdict state, with one addition:

```
┌─────────────────────────────────────────────────────────────┐
│  NVDA      THE ROUND TABLE        VERDICT REACHED ⚖️       │ ← status strip
├─────────────────────────────────────────────────────────────┤
│  Verdict banner (THE COUNCIL HAS RULED — BUY)               │
│  Battle screen (frozen, final state)                        │
│  Dialogue box (final ruling text)                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ● Idle                           [New Trial] [Replay]  │  │ ← controls row
│  │                               [Hide Chronicles] [🔇]  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      BY DECREE OF THE ROUND TABLE           │ ← verdict card
│                           BUY                                │
│                   NVDA · Unanimous Council                   │
│                      [SHARE / DOWNLOAD]                      │
├─────────────────────────────────────────────────────────────┤
│                    Challenge another stock                   │ ← challenge card
│  [   Enter ticker symbol...          ] [Analyze]            │
├─────────────────────────────────────────────────────────────┤
│              COUNCIL CHRONICLES · ANALYST REPORTS            │ ← chronicles carousel
│  [‹] [Flint card] [Vera card] [Reed card] ...        [›]   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Exact Copy (All User-Facing Strings)

Voice: medieval-court register, consistent with existing strings ("The heralds sound
the call…", "By decree of the council", "Hark, traveler").

### 4.1 State A — Greeter

| Element | Copy | Notes |
|---------|------|-------|
| Status strip left (`#adv-ticker`) | `—` | No ticker yet |
| Status strip right (`#adv-turn-counter`) | `AWAITING CHALLENGE` | Replaces existing "AWAITING COUNCIL" |
| Dialogue speaker (`#adv-dialogue-speaker`) | `ELDER ALDRIC` | Set programmatically in State A |
| Dialogue text (`#adv-dialogue-text`) | `Hark, traveler. Which stock shall stand trial before the council this day?` | Static text, no typewriter animation |
| Ticker input placeholder | `Enter a ticker symbol...` | Matches existing challenge input placeholder |
| CTA button | `Summon the Council` | Primary action |
| Sample trial link | `or witness a sample trial (NVDA)` | Secondary, low-key affordance |
| Live indicator text (`#adv-live-text`) | `Awaiting challenge...` | |
| Disclaimer badge | `SCRIPTED DEMO — canned debate, any ticker. Not financial advice.` | Unchanged, always visible |

### 4.2 State A — Validation Error

| Element | Copy |
|---------|------|
| Inline error (empty input) | `The council requires a ticker symbol.` |
| Inline error (invalid chars) | `A ticker holds only letters and the occasional dot, traveler.` |

These appear inside `#adv-dialogue-body`, replacing the normal greeter text for 2.5s,
then the greeter text fades back in. The input shakes once (horizontal translate ±4px,
150ms, two oscillations).

### 4.3 State B — Ongoing Trial

| Element | Copy | Notes |
|---------|------|-------|
| "New trial" button in controls | `New Trial` | `.adv-btn` class, same visual weight as Replay |
| Everything else | Unchanged from current | Typewriter text, live status, analyst slot labels all as-is |

### 4.4 State C — Verdict

| Element | Copy | Notes |
|---------|------|-------|
| Challenge card label | `Challenge another stock` | Now correct — there was a first stock |
| Everything else | Unchanged from current | Verdict banner, card, carousel all as-is |

---

## 5. Element Visibility Table

```
Element                              │ State A │ State B │ State C
─────────────────────────────────────┼─────────┼─────────┼─────────
#adv-device (entire bezel)           │ VISIBLE │ VISIBLE │ VISIBLE
#adv-status-strip                    │ VISIBLE │ VISIBLE │ VISIBLE
#adv-ticker                          │ VISIBLE │ VISIBLE │ VISIBLE
#adv-turn-counter                    │ VISIBLE │ VISIBLE │ VISIBLE
#adv-vs-overlay                      │ HIDDEN  │ LIVE    │ FROZEN
#adv-solo-screen                     │ VISIBLE │ HIDDEN  │ HIDDEN
#adv-battle-screen                   │ HIDDEN  │ LIVE    │ FROZEN
#adv-momentum-bar                    │ HIDDEN  │ LIVE    │ FROZEN
#adv-sentiment-readout               │ HIDDEN  │ LIVE    │ FROZEN
#adv-move-flourish                   │ HIDDEN  │ LIVE    │ FROZEN
#adv-dialogue-box                    │ VISIBLE │ LIVE    │ LIVE
#adv-dialogue-speaker                │ VISIBLE │ LIVE    │ LIVE
#adv-dialogue-text                   │ VISIBLE │ LIVE    │ LIVE
#adv-dialogue-cursor                 │ HIDDEN  │ LIVE    │ HIDDEN
#adv-dialogue-advance                │ HIDDEN  │ LIVE    │ HIDDEN
#adv-greeter (NEW)                   │ VISIBLE │ HIDDEN  │ HIDDEN
#adv-greeter-input (NEW)             │ VISIBLE │ HIDDEN  │ HIDDEN
#adv-greeter-btn (NEW)               │ VISIBLE │ HIDDEN  │ HIDDEN
#adv-greeter-sample (NEW)            │ VISIBLE │ HIDDEN  │ HIDDEN
#adv-greeter-error (NEW)             │ DYNAMIC │ HIDDEN  │ HIDDEN
#adv-deliberation-grid               │ HIDDEN  │ LIVE    │ LIVE
#adv-verdict-banner                  │ HIDDEN  │ HIDDEN  │ VISIBLE
.adv-controls                        │ VISIBLE │ VISIBLE │ VISIBLE
#adv-live-indicator                  │ VISIBLE │ VISIBLE │ VISIBLE
#adv-live-text                       │ VISIBLE │ VISIBLE │ VISIBLE
#adv-toggle-reports                  │ HIDDEN  │ VISIBLE │ VISIBLE
#demo-replay-btn                     │ HIDDEN  │ VISIBLE │ VISIBLE
#demo-new-trial-btn (NEW)            │ HIDDEN  │ VISIBLE │ VISIBLE
─────────────────────────────────────────────────────────────
#rt-verdict-card                     │ HIDDEN  │ HIDDEN  │ VISIBLE
#rt-challenge-card                   │ HIDDEN  │ HIDDEN  │ VISIBLE
#rt-report-carousel                  │ HIDDEN  │ HIDDEN  │ VISIBLE
#demo-disclaimer-badge               │ VISIBLE │ VISIBLE │ VISIBLE
```

**Visibility mechanics:**
- "VISIBLE" = `element.style.display = ''` (restore CSS default)
- "HIDDEN" = `element.style.display = 'none'`
- "LIVE" = controlled by castle-council.js normally; demo-driver does NOT touch display
- "FROZEN" = visible but not animated; the council already handles this at verdict
- "DYNAMIC" = shown only during error feedback, then hidden

---

## 6. Mount Points — Where New Elements Go

### 6.1 The Greeter Input Area (`#adv-greeter`)

**Parent element:** Inserted as a sibling immediately AFTER `#adv-dialogue-box`, within
the device flow (before `#adv-deliberation-grid` in DOM order).

**DOM injection target:** `#adv-dialogue-box` → `insertAdjacentElement('afterend', greeterEl)`

**Structure:**
```html
<div id="adv-greeter" class="adv-greeter">
  <div class="adv-greeter-row">
    <input type="text"
           id="adv-greeter-input"
           class="adv-greeter-input"
           placeholder="Enter a ticker symbol..."
           maxlength="10"
           autocomplete="off"
           autocapitalize="characters"
           aria-label="Enter a stock ticker symbol">
    <button type="button"
            id="adv-greeter-btn"
            class="adv-greeter-btn">
      Summon the Council
    </button>
  </div>
  <button type="button"
          id="adv-greeter-sample"
          class="adv-greeter-sample">
    or witness a sample trial (NVDA)
  </button>
  <div id="adv-greeter-error"
       class="adv-greeter-error"
       aria-live="polite"
       style="display:none;"></div>
</div>
```

### 6.2 The "New Trial" Button (`#demo-new-trial-btn`)

**Parent element:** `.adv-controls` (same row as Replay button)

**DOM injection target:** `.adv-controls` → `insertBefore(newTrialBtn, document.getElementById('adv-toggle-reports'))`

This mirrors how the existing Replay button is injected in `wireChrome()`.

**Structure:**
```html
<button id="demo-new-trial-btn" class="adv-btn" type="button">New Trial</button>
```

### 6.3 Interaction Wiring

| Element | Event | Action |
|---------|-------|--------|
| `#adv-greeter-input` | `keydown` Enter | If value non-empty after trim + validation → `run(value)`. If empty → show error. |
| `#adv-greeter-btn` | `click` | Same as Enter on input |
| `#adv-greeter-sample` | `click` | `run('NVDA')` |
| `#demo-new-trial-btn` | `click` | `stop()` then `setPhase('awaiting')` |
| `#adv-greeter-input` | `input` | Clear error state on any keystroke |

**Keyboard safety note:** The council's global space/enter handlers check for
`document.activeElement.tagName === 'INPUT'` and skip their action when an input
is focused. Since `#adv-greeter-input` is a real `<input>`, the typewriter skip
and other global handlers are naturally suppressed while the user types.

---

## 7. Styling (via demo-overrides.css)

All new styles use the existing DMG design tokens from castle.css:
`--dmg-darkest` (#081820), `--dmg-dark` (#346856), `--dmg-mid` (#88C070),
`--dmg-lightest` (#E0F8D0), `--font-pixel` ('Press Start 2P', 'Courier New', monospace).

### 7.1 Greeter Container

```css
#adv-greeter {
  width: 520px;
  margin: 8px auto 0;
  background: var(--dmg-dark);
  border: 4px solid var(--dmg-darkest);
  box-shadow: 4px 4px 0 var(--dmg-darkest), inset 0 0 0 2px var(--dmg-mid);
  padding: 14px 16px;
  box-sizing: border-box;
  font-family: var(--font-pixel);
}
```

Matches the `.adv-dialogue-box` dimensions (520px wide, same border/shadow treatment).

### 7.2 Input Row

```css
.adv-greeter-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
```

### 7.3 Ticker Input

```css
.adv-greeter-input {
  flex: 1;
  min-width: 0;
  background: var(--dmg-darkest);
  border: 2px solid var(--dmg-mid);
  color: var(--dmg-lightest);
  font-family: var(--font-pixel);
  font-size: 10px;
  padding: 8px 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  outline: none;
  box-sizing: border-box;
}

.adv-greeter-input::placeholder {
  color: var(--dmg-mid);
  text-transform: none;
  font-size: 8px;
  letter-spacing: 0;
}

.adv-greeter-input:focus {
  border-color: var(--dmg-lightest);
  box-shadow: 0 0 0 2px var(--dmg-mid);
}
```

### 7.4 CTA Button

```css
.adv-greeter-btn {
  flex-shrink: 0;
  background: var(--dmg-mid);
  border: 2px solid var(--dmg-darkest);
  color: var(--dmg-darkest);
  font-family: var(--font-pixel);
  font-size: 9px;
  padding: 8px 12px;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 2px 2px 0 var(--dmg-darkest);
  transition: all 0.1s;
}

.adv-greeter-btn:hover {
  background: var(--dmg-lightest);
}

.adv-greeter-btn:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--dmg-darkest);
}

.adv-greeter-btn:focus-visible {
  outline: 2px solid var(--dmg-lightest);
  outline-offset: 2px;
}
```

### 7.5 Sample Trial Link

```css
.adv-greeter-sample {
  display: block;
  width: 100%;
  margin-top: 10px;
  background: none;
  border: none;
  color: var(--dmg-mid);
  font-family: var(--font-pixel);
  font-size: 7px;
  text-align: center;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 4px 0;
}

.adv-greeter-sample:hover {
  color: var(--dmg-lightest);
}

.adv-greeter-sample:focus-visible {
  outline: 2px solid var(--dmg-mid);
  outline-offset: 2px;
}
```

### 7.6 Error Message

```css
.adv-greeter-error {
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--dmg-darkest);
  border-left: 3px solid var(--dmg-mid);
  color: var(--dmg-lightest);
  font-family: var(--font-pixel);
  font-size: 8px;
  line-height: 1.6;
}
```

### 7.7 Validation Shake Animation

```css
@keyframes adv-shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-4px); }
  75%      { transform: translateX(4px); }
}

.adv-greeter-input.adv-shake {
  animation: adv-shake 0.15s ease-in-out 2;
}
```

Triggered by adding class `.adv-shake` to the input, removed on `animationend`.

### 7.8 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .adv-greeter-input.adv-shake {
    animation: none;
    border-color: var(--dmg-mid);
    /* Visual-only: flash the border to indicate error */
    transition: border-color 0.15s ease-in-out;
  }

  @keyframes adv-greeter-error-flash {
    0%, 100% { border-color: var(--dmg-mid); }
    50%      { border-color: var(--dmg-lightest); }
  }
  .adv-greeter-input.adv-shake {
    animation: adv-greeter-error-flash 0.5s ease-in-out;
  }

  /* Instant show/hide for all state transitions */
  #adv-greeter,
  #rt-verdict-card,
  #rt-challenge-card,
  #rt-report-carousel,
  #adv-deliberation-grid,
  #adv-momentum-bar,
  #adv-sentiment-readout,
  #adv-move-flourish {
    transition: none !important;
  }
}
```

---

## 8. Transitions Between States

### 8.1 A → B (User Initiates Trial)

1. CTA button shows loading state: text changes to `"Summoning..."`, button is disabled
   (`pointer-events: none`, opacity 0.6). Duration: until `run()` starts the VS overlay
   (~250ms fetch + 400ms initial delay in `schedule()`).
2. `#adv-greeter` fades out (opacity 0, 200ms ease-out), then `display: none`.
3. `#adv-deliberation-grid`, `#adv-momentum-bar`, `#adv-sentiment-readout`,
   `#adv-move-flourish` all fade in simultaneously (opacity 0→1, 300ms ease-in).
4. `#adv-solo-screen` fades out (opacity 0, 250ms) as the VS overlay begins (the
   council already handles the VS overlay animation internally).
5. `#demo-replay-btn` and `#demo-new-trial-btn` fade in (opacity 0→1, 300ms).
6. `#adv-turn-counter` text changes from "AWAITING CHALLENGE" to the council's live
   status text (handled by castle-council.js).

### 8.2 B → C (Verdict Reached)

This transition is already handled by castle-council.js (verdict banner slides in,
turn counter updates, verdict card builds). The demo driver only needs to:
1. Call the existing `applyVerdictChrome()` (unchanged)
2. Reveal `#rt-verdict-card`, `#rt-challenge-card`, `#rt-report-carousel`:
   fade in sequence, staggered 150ms each (opacity 0→1, 300ms ease-in)
3. `#adv-dialogue-cursor` and `#adv-dialogue-advance` hide (display: none)

### 8.3 B → A or C → A (New Trial)

1. Call `stop()` to cancel any running timer/EventSource
2. Reset verdict chrome via `resetVerdictChrome()`
3. Hide all trial/verdict chrome: `#adv-deliberation-grid`, `#adv-momentum-bar`,
   `#adv-sentiment-readout`, `#adv-move-flourish`, `#adv-battle-screen`,
   `#adv-verdict-banner`, `#rt-verdict-card`, `#rt-challenge-card`,
   `#rt-report-carousel`, `#demo-replay-btn`, `#demo-new-trial-btn`
   → all fade out (opacity 0, 200ms ease-out) then `display: none`
4. Show `#adv-solo-screen`, `#adv-greeter`, and set `#adv-dialogue-text` to greeter copy
   → all fade in (opacity 0→1, 300ms ease-in)
5. Set `#adv-dialogue-speaker` to "ELDER ALDRIC"
6. Set `#adv-turn-counter` to "AWAITING CHALLENGE"
7. Set `#adv-ticker` to "—"
8. Clear `#adv-greeter-input` value
9. Focus `#adv-greeter-input`

### 8.4 C → B (Replay / New Ticker Challenge)

Already handled by existing demo-driver.js `run()` logic (fetch → EventSource → schedule).
No new transitions needed beyond what the council already does for the VS intro overlay.

---

## 9. Mobile Note (≤480px viewport)

Demo-overrides.css must include:

```css
@media (max-width: 480px) {
  #adv-greeter {
    width: calc(100vw - 32px);  /* device bezel padding */
    max-width: 520px;
    padding: 10px 12px;
  }

  .adv-greeter-row {
    flex-direction: column;
    gap: 6px;
  }

  .adv-greeter-input {
    font-size: 10px;
    padding: 10px;
    width: 100%;
  }

  .adv-greeter-btn {
    width: 100%;
    font-size: 10px;
    padding: 10px;
    text-align: center;
  }

  .adv-greeter-sample {
    font-size: 7px;
  }
}
```

The greeting input + CTA must remain above the fold. On mobile (≤480px), the device
already stacks vertically. The greeter area width matches the device width minus bezel
padding.

Castle.css already has a `@media (max-width: 640px)` block at line 692 and a
`@media (max-width: 500px)` block at line 1753. The demo-overrides.css
responsive block loads after castle.css and can safely override in the same breakpoints.

---

## 10. Accessibility

### 10.1 Focus Management

- **State A, on enter:** `#adv-greeter-input` receives `focus()` programmatically
- **State A, after error:** Focus remains in `#adv-greeter-input` (no focus trap escape)
- **State B → A transition:** `#adv-greeter-input` receives `focus()`
- **Tabbing order in State A:** Input → CTA → Sample link (natural DOM order)
- **Tabbing in State B/C:** Unchanged from current behavior

### 10.2 Labels and ARIA

| Element | Attribute | Value |
|---------|-----------|-------|
| `#adv-greeter-input` | `aria-label` | `"Enter a stock ticker symbol"` |
| `#adv-greeter-input` | `aria-describedby` | Points to `#adv-greeter-error` when error is visible |
| `#adv-greeter-error` | `aria-live` | `"polite"` — screen reader announces error |
| `#adv-greeter-error` | `role` | `"alert"` (added dynamically when error appears) |
| `#adv-greeter-btn` | `aria-label` | Implicit from text content; no extra label needed |
| `#adv-greeter-sample` | `aria-label` | `"Watch a sample trial for NVDA stock"` |

### 10.3 Keyboard

- **Enter** on `#adv-greeter-input` submits (same as clicking "Summon the Council")
- **Space** on `#adv-greeter-btn` activates (native `<button>` behavior)
- **Space** on `#adv-greeter-sample` activates (native `<button>` behavior)
- **Global space/enter** for typewriter skip: naturally suppressed when input is focused
  (castle-council.js already checks `document.activeElement.tagName !== 'INPUT'`)
- **Escape** while in `#adv-greeter-input`: clears input value (no state change)
- **Tab** order in State A: Input → CTA → Sample link → (device chrome, if any)
- **Tab** in State B/C: unchanged from current behavior

### 10.4 Screen Reader Flow — State A

1. Landmark: "Traders of the Round Table — Battle Demo" (page title)
2. Status strip: "Ticker: dash. THE ROUND TABLE. Status: AWAITING CHALLENGE"
3. Solo portrait: "Council awaits" (existing alt text on `#adv-solo-img`)
4. Dialogue box: "ELDER ALDRIC. Hark, traveler. Which stock shall stand trial before the council this day?"
5. Input: "Enter a stock ticker symbol, edit text" (via `aria-label` + native input role)
6. Button: "Summon the Council, button"
7. Link: "or witness a sample trial (NVDA), button"
8. Disclaimer: "SCRIPTED DEMO — canned debate, any ticker. Not financial advice."

---

## 11. demo-driver.js Changes (Implementation Notes)

These are implementation notes for the frontend dev; the UX spec defines *what* must
happen. This section sketches *how* to achieve it within the architectural constraint.

### 11.1 Boot Sequence Change

**Current (line 286-298):**
```
boot() → poll for #adv-arena → wireChrome() → setTimeout(run('NVDA'), 700)
```

**New:**
```
boot() → poll for #adv-arena → wireChrome() → injectGreeterElements() → setPhase('awaiting')
```

No auto-play. The `injectGreeterElements()` function creates and inserts the greeter
DOM (Section 6.1) and the New Trial button (Section 6.2).

### 11.2 New Functions Needed

| Function | Purpose |
|----------|---------|
| `injectGreeterElements()` | Creates `#adv-greeter` DOM and `#demo-new-trial-btn`, inserts at correct mount points, wires event listeners. Must be idempotent (check if elements already exist). |
| `setPhase(phase)` | State machine transition: updates `state.phase`, calls `applyVisibility(phase)`, handles focus. |
| `applyVisibility(phase)` | Applies the visibility table (Section 5) by toggling `display` on each element. |
| `showGreeterError(msg)` | Shows error text in `#adv-greeter-error`, adds `.adv-shake` to input, sets `aria-describedby`. Auto-clears after 2.5s. |
| `clearGreeterError()` | Hides error, removes shake class, clears `aria-describedby`. |

### 11.3 Modified Functions

| Function | Change |
|----------|--------|
| `run(ticker)` | At start of execution, call `setPhase('trial')` if not already in trial phase |
| `applyVerdictChrome()` | After existing verdict chrome logic, call `setPhase('verdict')` |
| `wireChrome()` | Also inject `#demo-new-trial-btn` alongside the existing `#demo-replay-btn` |
| `stop()` | Unchanged (just clears timer + EventSource) |

### 11.4 State B → C Detection

The existing `applyVerdictChrome()` function is called from the `decision` step in
`buildSteps()` (line 133). This is the natural hook for transitioning to State C.
Add `setPhase('verdict')` at the end of `applyVerdictChrome()`.

### 11.5 Loader States

While `fetch('./api/analyze')` is in flight during State A → B:
- Disable `#adv-greeter-btn` (text: "Summoning...")
- Disable `#adv-greeter-input`
- `#adv-greeter-sample` pointer-events disabled

The council already shows its own "deliberation" overlay during this window. Restore
button state on fetch resolve or failure.

---

## 12. Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| Input inside device, not below it | Zach's direction: the input should feel like part of the ADV device bezel, not a separate page element. Matches Pokemon-ADV convention where the player types inside the game screen. |
| Sample trial as a secondary link, not a button | Keeps visual hierarchy clear: primary CTA dominates. "or witness a sample trial" is intentionally low-key so users type their own ticker first. |
| Greeter mounted after dialogue box, not inside it | The dialogue box is fully owned by castle-council.js (typewriter engine, scroll management). Injecting elements inside it risks collision. Mounting as an adjacent sibling with matching dimensions achieves the "inside the device" feel without touching castle code. |
| Error as inline message, not a toast | Toasts would break the ADV device illusion. Inline error inside the greeter block keeps the error in the user's focal area. Shake animation provides immediate feedback; the text message explains what went wrong. |
| "New Trial" in controls row for State B | Mid-run, the user needs a visible way to start over. The existing Replay button re-runs the same ticker; "New Trial" is distinct and returns to State A. Both have equal visual weight as `.adv-btn`. |
| No cast introduction in this spec | P2 item (cast anonymity). Introducing 8 agents requires sprite assets, typewriter sequences, and potentially significant demo-driver.js rework. Deferred to a future pass. |
| Focus stays in input on error | Trapping the user in a broken input is worse UX than letting them correct. The error is announced via `aria-live`, and the shake draws visual attention. |
| `display: none` for hidden elements (not `visibility: hidden` or `opacity: 0`) | Hidden elements should not occupy layout space (empty verdict card creates the "broken" impression). `display: none` removes them from the flow entirely. |

---

## 13. Open Questions for Zach

1. **Cast introduction (P2):** Should a future State "A.5" introduce the eight council members
   before the ticker prompt? E.g., a short typewriter sequence where Aldric names each
   member while their sprite flashes on the solo screen. This would add meaningful
   narrative weight but requires careful orchestration with demo-driver.js timing.

2. **Sample trial ticker:** Should "NVDA" be hardcoded or configurable? If the demo
   should showcase variety, we could rotate through a few tickers (NVDA, AAPL, TSLA)
   or let Zach specify the sample ticker in a data attribute.

3. **Audio in State A:** Should the audio toggle be visible in State A? Currently the
   controls row shows the live indicator. The mute toggle could be available so users
   who want silence can mute before starting. On the other hand, keeping State A
   minimal reduces distraction.

4. **Replay during trial:** The current Replay button restarts mid-trial. Should it
   remain, or should we only show "New Trial" during State B and move "Replay" to
   State C only? Two side-by-side buttons ("New Trial" + "Replay") during State B
   might be confusing — they do different things but look identical.
