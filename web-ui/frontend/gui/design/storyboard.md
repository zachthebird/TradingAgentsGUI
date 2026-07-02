# Round Table Debate Arc — Storyboard

Full debate animation sequence with character states, transitions, timing, and CSS class targets.
All seat IDs match `castle-council.js` (market, social, news, fundamentals, debater, risk, trader, judge).
Portrait symbols are `#portrait-{seat}-{state}`.

## Phase 0: LOADING / ENTRANCE
**Duration:** 2s total (staggered)

| Beat | Time | What Happens | Portrait State |
|------|------|-------------|----------------|
| 0.1 | 0ms | Stage fades in. Table and candles already present. | — |
| 0.2 | 200ms | Judge seat (270°) scales up from 0→1 with throne glow. | `portrait-judge-idle` |
| 0.3 | 400ms | Analysts circle (315°/0°/45°/90°) pop in clockwise: Flint → Vera → Reed → Sage. | all `idle` |
| 0.4 | 600ms | Debate pair (135°/180°) slide in: Balthazar and Morwen face each other. | `idle` |
| 0.5 | 800ms | Trader (225°) appears. | `idle` |
| 0.6 | 1000ms | All 8 seated. Subtle one-breath idle animation begins. | all `idle` |
| 0.7 | 1500ms | Status text: "The council awaits..." | all `idle` |

**CSS execution:** Add `.entering` class to each seat with staggered `animation-delay`. Remove after settle.

---

## Phase 1: OPENING — Elder Aldric Calls the Session
**Duration:** 3s

| Beat | Time | Actor | Portrait State | Other Seats | Speech Bubble | Stage Effects |
|------|------|-------|----------------|-------------|---------------|---------------|
| 1.1 | 0ms | All dim except judge. | — | `.dimmed` | — | Fade stage slightly darker. |
| 1.2 | 500ms | **Elder Aldric** (judge) | `portrait-judge-speaking` | All others `.dimmed` | `bubble-emphatic`<br>"The council convenes. Let analysis commence." | Throne glow intensifies (`filter: glow-gold`). Candle flames jump. |
| 1.3 | 2000ms | Elder Aldric | `portrait-judge-idle` | All `.dimmed` removed | Fade out | Status: "Analysts take your seats..." |
| 1.4 | 2500ms | — | all `idle` | All idle, no dimming | — | Status clear. Candle flames normalize. |

**CSS classes:** `.dimmed`, `.speaking` on judge; `.emphatic` bubble variant.

---

## Phase 2: ANALYSIS — Sequential Analyst Reports
**Duration:** ~12s (4 analysts × 3s each)

Each analyst cycle: **THINK → SPEAK → DONE** with cross-reactions.

### 2A. Flint (Market Analyst) — Seat: market
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 2A.1 | 0ms | Flint | `portrait-market-thinking` | — | — |
| 2A.2 | 800ms | Flint | `portrait-market-speaking` | Vera: `portrait-social-thinking`<br>Sage: `portrait-fundamentals-thinking` | `bubble-standard`<br>"Bearish divergence on the MACD histogram..." |
| 2A.3 | 2500ms | Flint | `portrait-market-idle` + `.done` | Vera/Sage return to idle | Fade out |

### 2B. Vera (Sentiment Analyst) — Seat: social
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 2B.1 | 0ms | Vera | `portrait-social-thinking` | — | — |
| 2B.2 | 800ms | Vera | `portrait-social-speaking` | Kael: `portrait-trader-agree`<br>Balthazar: `portrait-debater-thinking` | `bubble-standard`<br>"Sentiment held strong through the week, but volume cooling..." |
| 2B.3 | 2500ms | Vera | `portrait-social-idle` + `.done` | Others return to idle | Fade out |

### 2C. Reed (News Analyst) — Seat: news
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 2C.1 | 0ms | Reed | `portrait-news-thinking` | — | — |
| 2C.2 | 800ms | Reed | `portrait-news-speaking` | Sage: `portrait-fundamentals-agree`<br>Flint: `portrait-market-disagree` | `bubble-standard`<br>"Services revenue narrative intact..." |
| 2C.3 | 2500ms | Reed | `portrait-news-idle` + `.done` | Others return to idle | Fade out |

### 2D. Sage (Fundamentals Analyst) — Seat: fundamentals
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 2D.1 | 0ms | Sage | `portrait-fundamentals-thinking` | — | — |
| 2D.2 | 800ms | Sage | `portrait-fundamentals-speaking` | Reed: `portrait-news-agree`<br>Balthazar: `portrait-debater-disagree` | `bubble-standard`<br>"Margins are healthy and FCF is expanding..." |
| 2D.3 | 2500ms | Sage | `portrait-fundamentals-idle` + `.done` | Others return to idle | Fade out |

**CSS transitions:** Each analyst gets `.thinking` → `.speaking` → `.done` class chain.
Cross-reactions appear as floating chips with portrait miniatures (existing `.rt-reaction`).

---

## Phase 3: DEBATE — Bull vs Bear Sparring
**Duration:** ~10s (2-3 rounds of rapid back-and-forth)

### 3A. Balthazar opens (Bull)
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 3A.1 | 0ms | Balthazar (debater) | `portrait-debater-speaking` | Flint: `agree`<br>Sage: `disagree` | `bubble-bull`<br>"With respect — fundamentals are a 12-month story..." |
| 3A.2 | 2000ms | Balthazar | `portrait-debater-idle` (still active) | — | Fade out |

### 3B. Morwen counters (Bear)
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 3B.1 | 0ms | Morwen (risk) | `portrait-risk-speaking` | Kael: `agree`<br>Balthazar: `disagree` | `bubble-bear`<br>"A pullback would only improve the entry..." |
| 3B.2 | 2000ms | Morwen | `portrait-risk-idle` (still active) | — | Fade out |

### 3C. Balthazar rebuts
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 3C.1 | 0ms | Balthazar | `portrait-debater-speaking` | Morwen: `thinking`<br>Aldric: `agree` | `bubble-bull` + `.rebuttal`<br>"Then we agree we wait. A tactical hold, not a fresh buy." |

### 3D. Morwen closes + Kael responds
| Beat | Time | Actor | State | Reactions | Bubble |
|------|------|-------|-------|-----------|--------|
| 3D.1 | 0ms | Morwen | `portrait-risk-speaking` | Kael: `agree` | `bubble-bear`<br>"Position sizing matters more than direction here..." |
| 3D.2 | 2000ms | **Kael** (trader) | `portrait-trader-speaking` | Morwen: `agree`<br>Balthazar: `agree` | `bubble-standard`<br>"I can defend the current position..." |

**Visual treatment:** 
- Bull/Bear bubbles get alternating green/red tinted backgrounds.
- During rebuttals, the `.rebuttal.shake` animation plays.
- Debate seats (135° and 180°) face each other; camera could do a subtle push-in.
- Tilt meter needle drifts with each sentiment shift.

---

## Phase 4: VERDICT — Elder Aldric's Final Decree
**Duration:** 5s (the dramatic climax)

| Beat | Time | Actor | State | Others | Bubble | Effects |
|------|------|-------|-------|--------|--------|---------|
| 4.1 | 0ms | All → `.dimmed` | — | All dimmed except judge | — | Stage darkens. Candle flames low. |
| 4.2 | 600ms | Verdict banner slides in | — | — | — | `#rt-verdict-banner` with `.show` class: **"FINAL VERDICT"**. Banner has verdictBannerFloat animation. |
| 4.3 | 1200ms | **Elder Aldric** | `portrait-judge-speaking` | All `.dimmed` held | `bubble-emphatic`<br>"Trend is up. Conviction is down. The council rules: HOLD." | Throne glow max. Crest glows. Status: "The council renders its verdict..." |
| 4.4 | 3500ms | — | — | — | — | Verdict card `#rt-verdict-card` fades in below stage: large HOLD/BUY/SELL text with seal. Ticker symbol displayed. |
| 4.5 | 4500ms | Elder Aldric | `portrait-judge-idle` | — | Fade out | Status: "Verdict rendered. Long may the council reign." |

---

## Phase 5: CLOSING — Reactions & Fade
**Duration:** 2s

| Beat | Time | Actor | State | Others | Effects |
|------|------|-------|-------|--------|---------|
| 5.1 | 0ms | All → mix of reactions | Flint: `agree`, Vera: `surprised`, Reed: `agree`, Sage: `thinking`, Balthazar: `agree`, Morwen: `agree`, Kael: `agree`, Aldric: `idle` | All `.done` | Tilt needle returns to center. |
| 5.2 | 1500ms | All → `idle` | `portrait-*-idle` | — | Stage dims gently. Report carousel visible below. |

---

## Implementation Notes for Frontend

**State-to-symbol mapping (JavaScript reference):**
```js
const STATE_SYMBOLS = {
  market:       { idle: '#portrait-market-idle', thinking: '#portrait-market-thinking', speaking: '#portrait-market-speaking', agree: '#portrait-market-agree', disagree: '#portrait-market-disagree', surprised: '#portrait-market-surprised' },
  social:       { idle: '#portrait-social-idle', thinking: '#portrait-social-thinking', speaking: '#portrait-social-speaking', agree: '#portrait-social-agree', disagree: '#portrait-social-disagree', surprised: '#portrait-social-surprised' },
  news:         { idle: '#portrait-news-idle', thinking: '#portrait-news-thinking', speaking: '#portrait-news-speaking', agree: '#portrait-news-agree', disagree: '#portrait-news-disagree', surprised: '#portrait-news-surprised' },
  fundamentals: { idle: '#portrait-fundamentals-idle', thinking: '#portrait-fundamentals-thinking', speaking: '#portrait-fundamentals-speaking', agree: '#portrait-fundamentals-agree', disagree: '#portrait-fundamentals-disagree', surprised: '#portrait-fundamentals-surprised' },
  debater:      { idle: '#portrait-debater-idle', thinking: '#portrait-debater-thinking', speaking: '#portrait-debater-speaking', agree: '#portrait-debater-agree', disagree: '#portrait-debater-disagree', surprised: '#portrait-debater-surprised' },
  risk:         { idle: '#portrait-risk-idle', thinking: '#portrait-risk-thinking', speaking: '#portrait-risk-speaking', agree: '#portrait-risk-agree', disagree: '#portrait-risk-disagree', surprised: '#portrait-risk-surprised' },
  trader:       { idle: '#portrait-trader-idle', thinking: '#portrait-trader-thinking', speaking: '#portrait-trader-speaking', agree: '#portrait-trader-agree', disagree: '#portrait-trader-disagree', surprised: '#portrait-trader-surprised' },
  judge:        { idle: '#portrait-judge-idle', thinking: '#portrait-judge-thinking', speaking: '#portrait-judge-speaking', agree: '#portrait-judge-agree', disagree: '#portrait-judge-disagree', surprised: '#portrait-judge-surprised' },
};
```

**Bubble type mapping:**
```js
const BUBBLE_TYPES = {
  standard: '#bubble-standard',
  emphatic: '#bubble-emphatic',
  bull:     '#bubble-bull',
  bear:     '#bubble-bear',
};
```

**How to swap portraits:** Change the `<use href="...">` inside `.rt-portrait svg` for each seat element. The existing JS code creates `<svg viewBox="0 0 100 100"><use href="#portrait-{seat.id}"/></svg>`. Extend so `setSeatState(seatId, state)` updates the `href`.

**CSS modifications needed in castle.css:**
- Add class selectors for each state that can coexist with existing `.speaking`/`.thinking`/`.done`/`.dimmed`
- Add `.rt-bubble.bull` and `.rt-bubble.bear` styles (distinct background/border tints)
- Add `.rt-bubble.emphatic` style for dramatic moments
