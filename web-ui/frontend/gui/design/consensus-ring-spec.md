# Thesis Consensus Ring — Design Specification

An information-rich visual upgrade to the `.rt-tilt` bar. Replaces the simple left/right needle
with a semi-circular arc beneath the round table showing per-analyst stance, conviction, and
cumulative council tilt.

---

## Deliverable 1: Wireframe — Layout & Context

### 1A. Full-scene context (ASCII wireframe)

```
┌──────────────────────────────────────────────────────────────────────┐
│  🏰  The Council Convenes        [Idle]  [Replay] [1x] [Play] [Hide]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
│      ▓▓▓▓                    ▓▓▓▓                                   │
│    ▓▓▓▓              ┌──────┐  ▓▓▓▓                                 │
│   ▓▓▓▓               │Flint │   ▓▓▓▓        STAGE (560px)            │
│  ▓▓▓▓                │Market│    ▓▓▓▓                                │
│  ▓▓▓▓                └──┬───┘    ▓▓▓▓                                │
│  ▓▓▓▓     Vera          │        ▓▓▓▓                                │
│  ▓▓▓▓   ┌──────┐    ┌───┴──┐    ▓▓▓▓                                │
│  ▓▓▓▓   │Sentim│    │ TABLE│    ▓▓▓▓                                │
│  ▓▓▓▓   └──┬───┘    │ 380px│    ▓▓▓▓                                │
│  ▓▓▓▓      │         └──┬───┘    ▓▓▓▓                                │
│  ▓▓▓▓      │   ┌────┐  │         ▓▓▓▓                                │
│   ▓▓▓▓     │   │Crest│ │        ▓▓▓▓                                 │
│    ▓▓▓▓    │   └────┘  │       ▓▓▓▓                                  │
│     ▓▓▓▓   └───────────┘     ▓▓▓▓                                    │
│       ▓▓▓▓                 ▓▓▓▓                                      │
│         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                        │
│                                                                      │
│ ╔══════════════════════════════════════════════════════════════════╗ │
│ ║         CONSENSUS RING (SVG, replaces .rt-tilt bar)              ║ │
│ ║   ◄─ crimson ────┤     stone-gray     ├──── gold/green ──►      ║ │
│ ║  Bearish  ●  ●  ●      ◆       ●  ●  ●  ●           Bullish     ║ │
│ ║          Flint  Vera   TILT    Sage Reed Balthazar               ║ │
│ ╚══════════════════════════════════════════════════════════════════╝ │
│                                                                      │
│  ● ● ● ○ ○ ○ ○ ○ ○ ○              (progress pips, unchanged)        │
└──────────────────────────────────────────────────────────────────────┘
```

### 1B. Consensus Ring detail (ASCII)

```
              ┌─────────────────────────────────────────────┐
              │          Consensus Ring — 220° arc           │
              │                                             │
        140°  │  ······································     │  40°
 Bear extreme│·      ●                ◆                ●·   │Bull extreme
         (-3)│·    Flint          council tilt      Sage ·   │   (+3)
              │·   (r=10)                           (r=10)·  │
              │ ·                                        ·   │
              │  ·     ●              ●              ●      │
              │   ·  Balthazar       Reed          Vera    · │
              │    ·  (r=10)         (r=5)         (r=5)     │
              │     ·    ●            ●             ●       ·│
              │      · Morwen       Trader       Social      │
              │       · (r=7)       (r=5)        (r=5)       │
              │        ·                                     │
              │         ·                                   ·│
              │          ··································  │
              │               160°          270°        340° │
              │            Bearish      Neutral       Bullish│
              └─────────────────────────────────────────────┘

              Arc color: gradient from --castle-crimson-bright
              through --castle-stone-light to --castle-gold-bright
              
              ◆ = Tilt needle (cumulative council tilt)
              ● = Analyst dot (sized by conviction |sentiment|)
                  r = 5 + |sentiment| × 2  (range 5–11px)
```

### 1C. SVG structure (key elements)

```
<svg viewBox="0 0 800 160" class="rt-consensus-ring">

  <!-- Track: the arc itself -->
  <path class="rt-ring-track"
        d="M 80,140 A 320,320 0 0,1 320,12 ... 480,12 A 320,320 0 0,1 720,140"
        fill="none" stroke="var(--castle-stone-dark)" stroke-width="14" />

  <!-- Gradient fill: crimson → stone → gold -->
  <linearGradient id="tilt-gradient">
    <stop offset="0%"   stop-color="var(--castle-crimson-bright)"/>
    <stop offset="35%"  stop-color="var(--castle-crimson)"/>
    <stop offset="50%"  stop-color="var(--castle-stone-light)"/>
    <stop offset="65%"  stop-color="var(--castle-gold-soft)"/>
    <stop offset="100%" stop-color="var(--castle-gold-bright)"/>
  </linearGradient>

  <!-- Glow arc: overall tilt fill (proportional to cumulative tilt) -->
  <path class="rt-ring-glow" />

  <!-- Tilt Needle: diamond pointer on the arc -->
  <polygon class="rt-ring-needle" points="0,-10 8,0 0,10 -8,0" />

  <!-- Analyst dots: one per seat, positioned by sentiment -->
  <circle class="rt-ring-dot" data-analyst="market"       r="10" />
  <circle class="rt-ring-dot" data-analyst="social"        r="5"  />
  <circle class="rt-ring-dot" data-analyst="news"          r="8"  />
  <circle class="rt-ring-dot" data-analyst="fundamentals"  r="10" />
  <circle class="rt-ring-dot" data-analyst="debater"       r="10" />
  <circle class="rt-ring-dot" data-analyst="risk"           r="7"  />
  <circle class="rt-ring-dot" data-analyst="trader"         r="5"  />
  <circle class="rt-ring-dot" data-analyst="judge"          r="6"  />

  <!-- Labels -->
  <text class="rt-ring-label" x="40"  y="130">Bearish</text>
  <text class="rt-ring-label" x="680" y="130" text-anchor="end">Bullish</text>

</svg>
```

### 1D. Layout integration

The consensus ring replaces `.rt-tilt` in the HTML structure:

```
.rt-chrome
  ├── .rt-header
  ├── .rt-stage          (unchanged — 560px, table at center, seats on circle)
  ├── .rt-consensus-ring (NEW — replaces .rt-tilt, SVG semi-circular arc below stage)
  └── .rt-progress        (unchanged)
```

Positioning: The ring sits in the same DOM slot as `.rt-tilt` — immediately after `.rt-stage`,
before `.rt-progress`. It overlaps the bottom of the stage slightly for a seamless feel
(negative margin-top of ~30px so the arc visually wraps under the table edge).

---

## Deliverable 2: Color & Visual Spec

### 2.1 Palette mapping

| Element                 | CSS Variable           | Hex       | Purpose |
|--------------------------|------------------------|-----------|---------|
| Arc track (base)         | `--castle-stone-dark`  | `#2a3043` | Dark ring background — the unlit arc |
| Arc gradient — bearish   | `--castle-crimson-bright` | `#c43f54` | Far-left arc (sentiment -3 to -1) |
| Arc gradient — cautious  | `--castle-crimson`     | `#8e2a3a` | Mid-left arc (sentiment -1 to 0) |
| Arc gradient — neutral   | `--castle-stone-light` | `#5b6379` | Center arc (sentiment ~0) |
| Arc gradient — leaning   | `--castle-gold-soft`   | `#b89243` | Mid-right arc (sentiment 0 to +1) |
| Arc gradient — bullish   | `--castle-gold-bright` | `#f2c761` | Far-right arc (sentiment +1 to +3) |
| Tilt needle fill         | `--castle-gold-bright` | `#f2c761` | Glowing diamond pointer |
| Tilt needle glow         | `rgba(242,199,97,0.6)` | —         | Box-shadow / filter glow |
| Bull dot fill            | `--castle-gold-bright` | `#f2c761` | Analyst dot for positive sentiment |
| Bull dot glow            | `rgba(242,199,97,0.4)` | —         | Dot glow for bullish analysts |
| Bear dot fill            | `--castle-crimson-bright` | `#c43f54` | Analyst dot for negative sentiment |
| Bear dot glow            | `rgba(196,63,84,0.4)`  | —         | Dot glow for bearish analysts |
| Neutral dot fill         | `--castle-stone-light` | `#5b6379` | Analyst dot for sentiment = 0 |
| Label text               | `--text-dim`           | `#a8a89e` | "Bearish" / "Bullish" labels |
| Label font               | Cinzel, serif          | —         | Matches `.rt-tilt-labels` |

### 2.2 Arc gradient construction

The arc uses a `conic-gradient`-like effect achieved via SVG `<linearGradient>` or a
multi-stop radial approach. The recommended approach: SVG `<linearGradient>` applied to
the arc path, with stops at:

- 0%: `--castle-crimson-bright` + subtle darkening for depth
- 15%: `--castle-crimson`
- 35%: `--castle-stone-dark` mixed with crimson (transition zone)
- 50%: `--castle-stone-light` (neutral center)
- 65%: `--castle-stone-dark` mixed with gold (transition zone)
- 85%: `--castle-gold-soft`
- 100%: `--castle-gold-bright`

### 2.3 Dot sizing (conviction intensity)

| sentiment | absolute | radius (px) | opacity | glow radius |
|-----------|----------|-------------|---------|-------------|
| -3        | 3        | 11          | 1.0     | 18px        |
| -2        | 2        | 9           | 0.83    | 14px        |
| -1        | 1        | 7           | 0.67    | 10px        |
| 0         | 0        | 5           | 0.50    | 6px         |
| +1        | 1        | 7           | 0.67    | 10px        |
| +2        | 2        | 9           | 0.83    | 14px        |
| +3        | 3        | 11          | 1.0     | 18px        |

Formula: `r = 5 + abs(sentiment) * 2`

### 2.4 Tilt needle

The tilt needle is a diamond-shaped polygon (~16×20px) positioned at the cumulative tilt
angle on the arc. It has:

- Fill: `white` → `--castle-gold-bright` gradient (top to bottom, like current needle)
- Glow: `filter: drop-shadow(0 0 12px rgba(242,199,97,0.7))` plus `drop-shadow(0 0 24px rgba(242,199,97,0.3))`
- Stroke: 1px `--castle-gold-bright` for definition

### 2.5 Arc "hot zone" highlighting

The region of the arc where dots cluster gets a subtle glow overlay — a second arc path
with `opacity` proportional to the number of dots in that region. This highlights where
consensus is forming vs where analysts are scattered.

---

## Deliverable 3: Animation Spec

### 3.1 Dot movement — smooth drift on stance change

When an analyst's sentiment changes (e.g., Flint moves from -2 to -1 after a cross-reaction):

```css
.rt-ring-dot {
  transition: cx 0.6s cubic-bezier(0.4, 0.0, 0.2, 1),
              cy 0.6s cubic-bezier(0.4, 0.0, 0.2, 1),
              r 0.4s ease,
              opacity 0.4s ease;
}
```

**Timing curve rationale:** `cubic-bezier(0.4, 0.0, 0.2, 1)` (Material standard deceleration)
gives a natural settle — dots accelerate quickly from old position and decelerate into
new one. Matches the existing tilt needle transition.

**Simultaneous updates:** When a debate line fires:
1. The speaking analyst's dot moves to new position (if sentiment changed)
2. Cross-reacted analysts' dots may also shift
3. The tilt needle repositions to the new cumulative average
4. All three transitions run concurrently and complete within 600ms

### 3.2 Tilt needle movement

```css
.rt-ring-needle {
  transition: transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1);
  transform-origin: center center;
  /* rotated via JS to point at cumulative tilt angle */
}
```

The needle uses `transform: rotate(angle)` with SVG `transform-origin` at the arc center.
Timing: 800ms — slightly longer than dot movement so the needle appears to follow the
dots, like a physical gauge needle settling.

### 3.3 Arc glow fill

The arc fill extent (how much of the arc is "lit" toward bullish or bearish) animates
via `stroke-dashoffset`:

```css
.rt-ring-glow {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0.0, 0.2, 1);
}
```

The glow path is the same arc geometry but with a bright gradient stroke. It uses
`stroke-dasharray` set to the full arc length, and `stroke-dashoffset` reduced from
the bear/bull side to "fill" the arc toward the tilt position.

### 3.4 Dot entrance animation

When the council scene first loads, dots fade in sequentially (clockwise, staggered 150ms per analyst):

```css
@keyframes dot-enter {
  0%   { r: 0; opacity: 0; }
  60%  { r: calc(var(--dot-r-target) * 1.3); opacity: 0.9; }
  100% { r: var(--dot-r-target); opacity: 1; }
}
.rt-ring-dot.entering {
  animation: dot-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```

Stagger matches the seat entrance order: market (315°) → social (0°) → news (45°) →
fundamentals (90°) → debater (135°) → risk (180°) → trader (225°).

### 3.5 Judge verdict arrival

When the judge delivers the verdict (the final line in SCRIPT), the consensus ring
enters a "verdict mode":

```css
.rt-consensus-ring.verdict-mode .rt-ring-track {
  stroke: var(--castle-gold-soft);
  transition: stroke 0.5s ease;
}
.rt-consensus-ring.verdict-mode .rt-ring-needle {
  filter: drop-shadow(0 0 20px rgba(242,199,97,0.9))
          drop-shadow(0 0 40px rgba(242,199,97,0.5));
  transition: filter 0.5s ease;
}
```

The ring track shifts to gold, and the needle glow intensifies — matching the existing
verdict banner and verdict-mode stage effects.

### 3.6 Reduced-motion fallback

```css
@media (prefers-reduced-motion: reduce) {
  .rt-ring-dot,
  .rt-ring-needle,
  .rt-ring-glow,
  .rt-ring-track {
    transition: none !important;
    animation: none !important;
  }
  .rt-ring-dot.entering {
    animation: none !important;
    opacity: 1;
    r: var(--dot-r-target);
  }
}
```

Added to the existing `prefers-reduced-motion` block in `castle.css` to extend the
coverage. Also added: `.rt-ring-dot`, `.rt-ring-needle`, `.rt-ring-glow`, `.rt-ring-track`.

### 3.7 Live SSE streaming mode

When debate text arrives via SSE (server-sent events), dots update in **real time**
as each analyst's sentiment is parsed:

```
SSE event → parse sentiment → update dot position → recalc tilt → move needle
   ↑                                                                    ↑
   └─── all in one animation frame (requestAnimationFrame batching) ───┘
```

**Batching rule:** If multiple sentiment updates arrive within a single animation frame
(~16ms), batch them and apply all position changes simultaneously. This prevents jitter
from rapid-fire SSE events.

**Interpolation:** When SSE delivers gradual position updates (e.g., an analyst's
sentiment drifts from +1 to +2 over several smaller increments), use the CSS transition
to handle smooth interpolation — no JS interpolation needed. Each `setAttribute('cx',...)`
call triggers the 600ms transition.

---

## Deliverable 4: Mobile / Tablet Layout

### 4.1 Breakpoints

| Viewport          | Width range | Ring behavior |
|-------------------|-------------|---------------|
| Desktop (default) | ≥ 900px     | Full 800×160 SVG, arc at 220° sweep |
| Tablet            | 600–899px   | SVG scales to 100% width, arc tightens to ~180° |
| Mobile            | < 600px     | SVG collapses to horizontal bar (graceful degradation) |

### 4.2 Tablet layout (600–899px)

```
┌──────────────────────────────────────────────────────────┐
│ 🏰 The Council Convenes        [Idle] [Replay] [Play]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓               │
│         ▓▓▓▓                  ▓▓▓▓                       │
│       ▓▓▓▓      ┌─────┐       ▓▓▓▓   STAGE ~400px       │
│      ▓▓▓▓       │Flint│        ▓▓▓▓                      │
│     ▓▓▓▓        └──┬──┘         ▓▓▓▓                     │
│     ▓▓▓▓  Vera  ┌──┴──┐          ▓▓▓▓                    │
│     ▓▓▓▓ ┌────┐ │TABLE│          ▓▓▓▓                    │
│     ▓▓▓▓ └──┬─┘ └──┬──┘          ▓▓▓▓                    │
│      ▓▓▓▓    │     │            ▓▓▓▓                     │
│       ▓▓▓▓   │     │           ▓▓▓▓                      │
│        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                         │
│                                                          │
│  ╔══════════════════════════════════════════════════╗    │
│  ║    CONSENSUS RING — SVG scales to 100% width     ║    │
│  ║  ◄─ bear ────●──◆──●──── bull ──►              ║    │
│  ╚══════════════════════════════════════════════════╝    │
│                                                          │
│  ● ● ● ○ ○ ○ ○ ○ ○ ○  (progress pips)                   │
└──────────────────────────────────────────────────────────┘
```

CSS:
```css
@media (max-width: 899px) and (min-width: 600px) {
  .rt-consensus-ring {
    width: 100%;
    max-width: 600px;
    margin: -20px auto 10px;
  }
  .rt-consensus-ring svg {
    width: 100%;
    height: auto;
  }
  /* Tighten arc: 180° instead of 220° for narrower SVG */
  /* Reduce dot radius by 15% to prevent overlap */
  .rt-ring-dot { transform: scale(0.85); transform-origin: center; }
  .rt-ring-label { font-size: 9px; }
}
```

### 4.3 Mobile layout (< 600px) — Graceful degradation

On mobile, the full consensus ring is replaced with a **compact horizontal consensus bar**
that preserves the key information (tilt + dot positions) in a form factor that fits:

```
┌────────────────────────────────────────────┐
│ 🏰 The Council Convenes                    │
│           [Idle] [Replay] [Play]           │
├────────────────────────────────────────────┤
│                                            │
│        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              │
│      ▓▓▓▓              ▓▓▓▓               │
│     ▓▓▓▓   ┌─────┐      ▓▓▓▓  STAGE~280px│
│    ▓▓▓▓    │Flint│       ▓▓▓▓             │
│    ▓▓▓▓    └──┬──┘        ▓▓▓▓            │
│    ▓▓▓▓ Vera ┌┴─┐           ▓▓▓▓          │
│    ▓▓▓▓ ┌──┐ │T │           ▓▓▓▓          │
│     ▓▓▓▓└┬─┘ └┬─┘          ▓▓▓▓           │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              │
│                                            │
│  Bear ● ● ● ◆ ● ● ● Bull                  │
│       ■■■■■■■■■■■■■■■■■■■■■  consensus bar│
│                                            │
│  ● ● ● ○ ○ ○ ○ ○ ○ ○  (pips)              │
└────────────────────────────────────────────┘
```

The mobile consensus bar is a compact 2-line element:
- **Line 1:** Inline dots (colored circles at their relative sentiment positions) +
  the tilt needle (◆). These are `<span>` elements with inline-block, not SVG.
- **Line 2:** A mini gradient bar (like the current `.rt-tilt` but at ~16px height)
  showing the overall tilt.

```css
@media (max-width: 599px) {
  .rt-consensus-ring svg {
    display: none;
  }
  .rt-consensus-ring .rt-ring-mobile {
    display: flex;  /* hidden on desktop */
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin: 0 16px 10px;
  }
  .rt-ring-mobile-dots {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    height: 24px;
  }
  .rt-ring-mobile-dot {
    width: var(--dot-r, 8px);
    height: var(--dot-r, 8px);
    border-radius: 50%;
    transition: margin-left 0.4s ease;
    /* color set via JS inline style based on sentiment */
  }
  .rt-ring-mobile-bar {
    width: 100%;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(90deg,
      var(--castle-crimson-bright),
      var(--castle-crimson),
      var(--castle-stone-light),
      var(--castle-gold-soft),
      var(--castle-gold-bright));
    position: relative;
    border: 1px solid var(--castle-stone-light);
  }
  .rt-ring-mobile-needle {
    position: absolute;
    top: -4px; bottom: -4px;
    width: 3px;
    background: var(--castle-gold-bright);
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(242,199,97,0.6);
    transition: left 0.6s ease;
  }
}
```

### 4.4 Touch target sizing (mobile)

All ring dots on mobile become tappable elements for tooltip info:

```css
@media (max-width: 599px) {
  .rt-ring-mobile-dot {
    min-width: 24px;      /* 24×24 touch target minimum */
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .rt-ring-mobile-dot::after {
    content: attr(data-analyst);
    /* Hidden tooltip shown on tap */
  }
}
```

The mobile dots act as 24×24px touch targets (center circle is the colored dot, padded
to 24px for accessibility). On tap, show the analyst's name and current stance as a
small tooltip.

---

## Implementation Notes

### JS hooks required

Extend `setTilt()` in `castle-council.js`:

```js
// New: per-analyst sentiment tracking
const analystSentiments = {};
SEATS.forEach(s => analystSentiments[s.id] = 0);

function updateConsensusRing() {
  const svg = document.querySelector('.rt-consensus-ring svg');
  if (!svg) return;

  // Update each analyst dot
  SEATS.forEach(seat => {
    const s = analystSentiments[seat.id]; // -3..+3
    const dot = svg.querySelector(`.rt-ring-dot[data-analyst="${seat.id}"]`);
    if (!dot) return;

    // Compute angle on 220° arc (160° to 380° / 20°)
    const angle = 160 + ((s + 3) / 6) * 220;
    const rad = (angle * Math.PI) / 180;
    const cx = 400 + 145 * Math.cos(rad); // arc center at (400, 130), radius 145
    const cy = 130 + 145 * Math.sin(rad);

    dot.setAttribute('cx', cx.toFixed(1));
    dot.setAttribute('cy', cy.toFixed(1));
    dot.setAttribute('r', (5 + Math.abs(s) * 2).toFixed(1));
    dot.setAttribute('fill', s > 0 ? 'var(--castle-gold-bright)' :
                            s < 0 ? 'var(--castle-crimson-bright)' :
                                    'var(--castle-stone-light)');
    dot.style.opacity = (0.5 + Math.abs(s) * 0.17).toFixed(2);
  });

  // Update tilt needle
  const tilt = Object.values(analystSentiments).reduce((a,b)=>a+b, 0);
  const clampedTilt = Math.max(-12, Math.min(12, tilt));
  const tiltAngle = 160 + ((clampedTilt + 12) / 24) * 220;
  const rad = (tiltAngle * Math.PI) / 180;
  const nx = 400 + 145 * Math.cos(rad);
  const ny = 130 + 145 * Math.sin(rad);

  const needle = svg.querySelector('.rt-ring-needle');
  if (needle) {
    needle.setAttribute('transform',
      `translate(${nx.toFixed(1)}, ${ny.toFixed(1)}) rotate(${tiltAngle + 90})`);
  }

  // Update glow arc fill
  const glowPath = svg.querySelector('.rt-ring-glow');
  if (glowPath) {
    const totalLength = glowPath.getTotalLength();
    const fillPct = (clampedTilt + 12) / 24; // 0 (bear) to 1 (bull)
    glowPath.style.strokeDasharray = totalLength;
    glowPath.style.strokeDashoffset = totalLength * (1 - fillPct);
  }
}

// Hook into setTilt: update per-analyst sentiment when a line fires
// In the playFrom loop, after setTilt():
//   analystSentiments[line.id] = line.sentiment || 0;
//   updateConsensusRing();
```

### SVG geometry constants

- ViewBox: `0 0 800 160`
- Arc center: `(400, 130)` — positioned so arc rises above viewport top slightly
- Arc radius: `145px`
- Arc sweep: `220°` (from 160° to 380° = 20°, measured from center-right)
- Arc path: `M ${400+145*cos(160°)} ${130+145*sin(160°)} A 145,145 0 0,1 ${400+145*cos(20°)} ${130+145*sin(20°)}`

### CSS class reference

| Class | Element | Purpose |
|-------|---------|---------|
| `.rt-consensus-ring` | div wrapper | Container for SVG + mobile fallback |
| `.rt-ring-track` | SVG `<path>` | Base arc — dark, visible at all times |
| `.rt-ring-glow` | SVG `<path>` | Glow fill arc — stroke-dashoffset animated |
| `.rt-ring-needle` | SVG `<polygon>` | Diamond pointer at cumulative tilt |
| `.rt-ring-dot` | SVG `<circle>` | Per-analyst position marker |
| `.rt-ring-dot.entering` | SVG `<circle>` | Entrance animation trigger |
| `.rt-ring-dot.highlight` | SVG `<circle>` | Pulse animation when analyst's dot was just updated |
| `.rt-ring-label` | SVG `<text>` | "Bearish" / "Bullish" labels |
| `.rt-consensus-ring.verdict-mode` | div wrapper | Verdict-mode ring accent |
| `.rt-ring-mobile` | div | Mobile fallback container (hidden on desktop) |
| `.rt-ring-mobile-dots` | div | Mobile dot row |
| `.rt-ring-mobile-dot` | span | Mobile per-analyst dot |
| `.rt-ring-mobile-bar` | div | Mobile gradient bar |
| `.rt-ring-mobile-needle` | div | Mobile tilt needle |

### Preserving the existing tilt bar

Per constraint: "Must work WITH existing layout, not replace tilt bar entirely."
The consensus ring **replaces** `.rt-tilt` in the DOM, but the old CSS classes (`.rt-tilt`,
`.rt-tilt-labels`, `.rt-tilt-needle`) are preserved as fallbacks. The JS can feature-detect:

```js
const useConsensusRing = !!document.querySelector('.rt-consensus-ring');
if (!useConsensusRing) {
  // Fall back to legacy setTilt() behavior
  setTilt(tilt + (line.sentiment || 0));
}
```

This way, if the consensus ring SVG hasn't loaded, the old tilt bar behavior remains intact.

### Data already available

The SCRIPT array in `castle-council.js` already has `sentiment` on every line.
For SSE streaming, the backend delivers sentiment values per analyst — the same
`analystSentiments` object can be seeded from SSE data instead of the static SCRIPT.
The ring is data-source agnostic.
