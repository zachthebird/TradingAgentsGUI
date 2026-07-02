# ADV Debate Screen Mock — Visual Design System

A Game Boy DMG-style visual system for a turn-by-turn ADV (adventure-game)
debate screen. **The portrait artwork stays full-color, painterly, untouched.**
The retro pixel aesthetic lives entirely in the UI chrome: fonts, borders,
dialogue box, status bar, gauge, and background framing.

---

## 1. DMG Palette — Canonical Hexadecimal Values

The Nintendo Game Boy DMG LCD renders 4 monochrome shades of green-grey.
These are the canonical hex codes — use them verbatim for all chrome elements.

| Token Name              | Hex       | Role                                        |
|-------------------------|-----------|---------------------------------------------|
| `--dmg-darkest`         | `#0F380F` | Text, borders, outlines, icons              |
| `--dmg-dark`            | `#306230` | Dialogue box background, gauge empty track  |
| `--dmg-mid`             | `#8BAC0F` | Status strip background, gauge fill         |
| `--dmg-lightest`        | `#9BBC0F` | Highlights, cursor blink, selected states   |
| `--dmg-off` (optional)  | `#9BBC0F` | Same as lightest — DMG has only 4 shades    |

**Hard rule:** These 4 colors appear ONLY on UI chrome (borders, boxes,
bars, text in pixel font, status strip). Never apply any DMG tint, overlay,
duotone, or blend-mode to the character portraits. The portraits are
full-color painterly PNGs displayed with `image-rendering: auto` (smooth).

### Subtle scanline / dither on chrome only

A faint screen-texture effect MAY be applied to the dialogue box background
and status strip. If implemented, use this pattern (NEVER on the portrait):

```css
/* Pseudo-scanline overlay — dialogue box and status strip only */
.dmg-chrome::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(15, 56, 15, 0.06) 2px,
    rgba(15, 56, 15, 0.06) 4px
  );
  pointer-events: none;
  z-index: 1;
}
```

Scanlines are optional — if they clash with legibility at mobile sizes,
omit them. The chunky pixel border alone reads as "Game Boy."

---

## 2. Typography

### Primary font: Press Start 2P

Loaded from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
```

Font-family stack:

```css
--font-pixel: 'Press Start 2P', 'Courier New', monospace;
```

Press Start 2P is a fixed-width pixel font at 8px baseline. It renders
legibly at sizes 8px–16px. Do NOT use it above 16px — it becomes awkward.
For larger display text (e.g., "VS" in the splash), double the font-size
and accept the chunky aesthetic, or use a DMG-compatible block display.

**Usage rules:**
- All UI chrome text (status strip, speaker tag, dialogue box body, labels,
  button prompts, turn counter): `--font-pixel`
- Portrait area has NO text overlay (character name lives in the dialogue box)
- Verdict banner headline: `--font-pixel`
- Ticker symbol: `--font-pixel`

### Fallback behavior

When Press Start 2P hasn't loaded, `Courier New` preserves the monospace
fixed-width rhythm so layout doesn't break. Add a `.fonts-loaded` class
via the CSS Font Loading API to avoid FOUT:

```js
document.fonts.ready.then(() => {
  document.documentElement.classList.add('fonts-loaded');
});
```

---

## 3. Layout Architecture — Single Page, Three Sections

The mock is a single vertically-scrolling page. Desktop is the primary
target. All three screen states are visible at once (no tabbing, no routing —
this is a static sample for sign-off).

```
┌──────────────────────────────────────────┐
│          DMG DEVICE BEZEL (outer)         │
│  ┌──────────────────────────────────────┐ │
│  │  SECTION 1: HERO SCREEN              │ │
│  │  (turn-by-turn ADV debate)           │ │
│  │  ~600px tall                         │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │  SECTION 2: VS SPLASH                │ │
│  │  ~180px tall                         │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │  SECTION 3: VERDICT BANNER           │ │
│  │  ~120px tall                         │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 3.0 Outer Bezel / Container

The page wraps all three sections in a DMG-device-style outer frame.

- **Max width:** 640px (matches the pixel-grid feel — 640 / 8 = 80 chars
  at 8px font)
- **Centered** on the page with `margin: 0 auto`
- **Outer border:** 16px solid `--dmg-darkest` (#0F380F)
- **Inner border (screen bezel):** 4px solid `--dmg-darkest`, separated by
  12px padding
- **Background behind all sections:** `--dmg-lightest` (#9BBC0F) — the
  classic "pea soup" Game Boy screen
- **Page background (outside the device):** Neutral dark (#1a1a2e or
  similar) — frames the Game Boy as an object on a desk

```css
.adv-mock-device {
  max-width: 640px;
  margin: 40px auto;
  background: var(--dmg-lightest);  /* #9BBC0F */
  border: 16px solid var(--dmg-darkest);  /* #0F380F */
  border-radius: 4px;
  padding: 12px;
  box-shadow:
    0 0 0 4px var(--dmg-darkest),
    0 8px 32px rgba(0, 0, 0, 0.5);
}
```

### 3.1 Section 1: Hero Screen (Turn-by-Turn ADV Debate)

The primary view. ONE speaker dominates the center, framed in DMG chrome.

```
┌──────────────────────────────────────────────────────┐
│  STATUS STRIP (40px)                                   │
│  ┌──────────┬─────────────────────┬──────────────────┐│
│  │ AAPL     │  THE ROUND TABLE    │  TURN 4 / 12  🕯 ││
│  └──────────┴─────────────────────┴──────────────────┘│
├──────────────────────────────────────────────────────┤
│                                                      │
│         ┌────────────────────────────┐               │
│         │                            │               │
│         │    FLINT PORTRAIT          │               │
│         │    (flint-2-speaking.png)  │               │
│         │    FULL COLOR, painterly   │               │
│         │                            │               │
│         │    400px × 400px image     │               │
│         │    (scaled to fit frame)   │               │
│         │                            │               │
│         └────────────────────────────┘               │
│          ▲ chunky DMG pixel border                    │
│                                                      │
├──────────────────────────────────────────────────────┤
│  SENTIMENT BAR (28px)                                 │
│  🐻 BEAR  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░  BULL 🐂              │
├──────────────────────────────────────────────────────┤
│  DIALOGUE BOX (144px)                                 │
│  ┌──────────────────────────────────────────────────┐ │
│  │ FLINT — Market Analyst                           │ │
│  │ ──────────────────────────────────────────────── │ │
│  │                                                  │ │
│  │ The MACD histogram shows a bearish               │ │
│  │ divergence on the daily timeframe.               │ │
│  │ Volume has been declining for three               │ │
│  │ consecutive sessions, suggesting                  │ │
│  │ distribution at these levels...                   │ │
│  │                                                  │ │
│  │                                          ▼       │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

#### 3.1.1 Status Strip

- **Height:** 40px
- **Background:** `--dmg-dark` (#306230)
- **Text color:** `--dmg-lightest` (#9BBC0F)
- **Font:** Press Start 2P, 10px
- **Layout:** CSS Grid, 3 columns: `1fr auto 1fr`
- **Padding:** 8px 12px
- **Top border:** 2px solid `--dmg-darkest`

| Column | Content | Alignment |
|--------|---------|-----------|
| Left   | Ticker symbol (e.g., "AAPL") in uppercase | Left |
| Center | "THE ROUND TABLE" title | Center |
| Right  | "TURN 4 / 12" + candle icon (🕯 or custom CSS pixel candle) | Right |

The candle/phase indicator is a small icon (8×12px range) next to the turn
counter. For the static mock, use the 🕯 emoji or a simple CSS-drawn flame
shape. In production this would show the debate phase (analysis / debate /
verdict).

#### 3.1.2 Portrait Frame

- **Outer frame:** 12px solid `--dmg-darkest` (#0F380F), then 2px solid
  `--dmg-mid` (#8BAC0F)
- **Inner matte:** 6px solid `--dmg-dark` (#306230) between the mid border
  and the portrait
- **Portrait display dimensions:** 400px × 400px (the PNG is 1024×1024,
  CSS scales it down)
- **Image rendering:** `image-rendering: auto` (smooth — preserves
  painterly look)
- **Background behind portrait:** `--dmg-lightest` (#9BBC0F) — only visible
  if the portrait has transparency. The task spec says the PNGs have white
  backgrounds, so this is a safety fallback.
- **Centered horizontally** in the section
- **Vertical spacing:** 20px above the frame, 16px below to the sentiment bar
- **Drop shadow on the frame:** `4px 4px 0 var(--dmg-darkest)` for the
  chunky pixel depth illusion

**DO NOT apply any CSS filter to the portrait image.** No `grayscale()`,
no `sepia()`, no `hue-rotate()`, no `mix-blend-mode`. The portrait stays
exactly as the artist painted it.

```css
.adv-portrait-frame {
  border: 12px solid var(--dmg-darkest);
  outline: 2px solid var(--dmg-mid);
  outline-offset: -14px; /* sits inside the dark border */
  padding: 6px;
  background: var(--dmg-lightest);
  box-shadow: 4px 4px 0 var(--dmg-darkest);
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  margin: 20px auto 16px;
}

.adv-portrait-frame img {
  width: 400px;
  height: 400px;
  image-rendering: auto;
  display: block;
}
```

#### 3.1.3 Sentiment Bar (HP-style gauge)

Sits between the portrait frame and the dialogue box.

- **Total height:** 28px (including labels)
- **Width:** Same as the dialogue box (below), centered
- **Layout:** CSS Grid, 3 columns: `auto 1fr auto`

```
🐻 BEAR  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  🐂 BULL
         │← fill →│← empty →│
               62% bullish
```

| Element | Detail |
|---------|--------|
| Left label | "BEAR" in `--font-pixel`, 8px, color `--dmg-darkest`, preceded by 🐻 |
| Right label | "BULL" in `--font-pixel`, 8px, color `--dmg-darkest`, followed by 🐂 |
| Gauge track | Full-width between labels, 14px tall, background `--dmg-dark` (#306230), 2px solid border `--dmg-darkest` |
| Gauge fill | Left-to-right gradient from `--dmg-dark` (#306230) to `--dmg-mid` (#8BAC0F), with tick marks every 10% using `repeating-linear-gradient` |
| Fill width | Controlled by CSS custom property `--sentiment-pct` (0% = full bear, 100% = full bull, 50% = neutral center) — for this mock set it to 62% |
| Inner glow | Subtle `inset 0 1px 0 rgba(155,188,15,0.3)` on the filled portion |

The fill direction is left-to-right: the left side (bearish) starts empty,
the right side (bullish) fills up. A 62% fill means the bar is filled 62%
of the way from left, biased toward BULL.

```css
.adv-sentiment-bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 520px;
  margin: 0 auto 16px;
  padding: 0 4px;
}

.adv-sentiment-label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--dmg-darkest);
  white-space: nowrap;
}

.adv-sentiment-track {
  height: 14px;
  background: var(--dmg-dark);
  border: 2px solid var(--dmg-darkest);
  position: relative;
  overflow: hidden;
}

.adv-sentiment-fill {
  height: 100%;
  width: var(--sentiment-pct, 50%);
  background: linear-gradient(
    90deg,
    var(--dmg-dark) 0%,
    var(--dmg-mid) 100%
  );
  position: relative;
  transition: width 0.4s steps(8);
}

/* HP-style tick marks every 10% */
.adv-sentiment-track::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent calc(10% - 1px),
    var(--dmg-darkest) calc(10% - 1px),
    var(--dmg-darkest) 10%
  );
  opacity: 0.15;
  pointer-events: none;
  z-index: 1;
}
```

#### 3.1.4 Dialogue Box

The largest single chrome element. This is the classic Game Boy text box.

- **Outer dimensions:** 520px wide × 144px tall (centered)
- **Background:** `--dmg-dark` (#306230)
- **Border:** 4px solid `--dmg-darkest` (#0F380F), with an inner gap of
  2px then 2px solid `--dmg-mid` (#8BAC0F)
- **Inner padding:** 14px 16px
- **Border radius:** None — sharp corners for pixel look
- **Box shadow:** `4px 4px 0 var(--dmg-darkest)` for the chunky raised
  effect
- **Corner accents (optional):** Small 4×4px squares in `--dmg-mid` at
  each corner, inset 4px, as a subtle detail

**Internal layout:**

```
┌──────────────────────────────────────────────────┐
│ FLINT — Market Analyst                           │  ← speaker tag (10px font)
│ ──────────────────────────────────────────────── │  ← divider line
│                                                  │
│ The MACD histogram shows a bearish               │  ← dialogue body (8px font)
│ divergence on the daily timeframe.               │
│ Volume has been declining for three               │
│ consecutive sessions, suggesting                  │
│ distribution at these levels...                   │
│                                                  │
│                                          ▼       │  ← advance indicator
└──────────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Speaker tag | `--font-pixel`, 10px, color `--dmg-lightest` (#9BBC0F), uppercase, padding-bottom 8px |
| Divider | 1px solid `--dmg-mid`, full width of text area |
| Dialogue body | `--font-pixel`, 8px, color `--dmg-lightest`, line-height 1.8, max 4 lines visible |
| Advance indicator | `--font-pixel`, 10px, color `--dmg-lightest`, bottom-right, blinking ▼ triangle |

**Typewriter text animation spec:**

The dialogue body reveals character-by-character with a typewriter effect.

| Property | Value |
|----------|-------|
| Typing speed | 50ms per character (roughly 20 chars/sec — readable but snappy) |
| Initial delay | 400ms after the speaker tag appears |
| Cursor | Blinking block cursor `█` in `--dmg-lightest`, appended to the current character position |
| Cursor blink | 530ms visible / 530ms hidden cycle |
| Line advance | After typing reaches the char limit for a line, advance to next line immediately |
| Completion | Once all text is typed, cursor disappears after 800ms, then the advance ▼ starts blinking |
| Advance blink | The ▼ triangle blinks at 700ms visible / 700ms hidden after text completes |

**JS implementation notes (for the frontend agent):**

```js
// Pseudocode — NOT to be copy-pasted
const DIALOGUE_TEXT = [
  "The MACD histogram shows a bearish",
  "divergence on the daily timeframe.",
  "Volume has been declining for three",
  "consecutive sessions, suggesting",
  "distribution at these levels...",
];

// Typewriter: iterate characters, appending to visible text
// After last character, wait 800ms, then show blinking ▼
```

For the **static HTML mock**, the frontend agent should implement the
typewriter as a working JS animation, not just static text — this is a
sample for sign-off and should demonstrate the real feel.

**Dialogue box CSS:**

```css
.adv-dialogue-box {
  width: 520px;
  height: 144px;
  background: var(--dmg-dark);
  border: 4px solid var(--dmg-darkest);
  box-shadow: 4px 4px 0 var(--dmg-darkest), inset 0 0 0 2px var(--dmg-mid);
  padding: 14px 16px;
  margin: 0 auto;
  position: relative;
  font-family: var(--font-pixel);
  color: var(--dmg-lightest);
  box-sizing: border-box;
}

.adv-dialogue-speaker {
  font-size: 10px;
  line-height: 1;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.adv-dialogue-divider {
  height: 1px;
  background: var(--dmg-mid);
  margin-bottom: 10px;
}

.adv-dialogue-body {
  font-size: 8px;
  line-height: 1.8;
  min-height: 72px; /* 4 lines × 8px × 1.8 */
}

.adv-dialogue-cursor {
  display: inline;
  animation: adv-cursor-blink 1.06s step-end infinite;
}

@keyframes adv-cursor-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

.adv-dialogue-advance {
  position: absolute;
  bottom: 12px;
  right: 16px;
  font-size: 10px;
  animation: adv-blink-slow 1.4s step-end infinite;
}

@keyframes adv-blink-slow {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
```

---

### 3.2 Section 2: VS Splash (Research-Debate Phase)

A compact sub-screen styled like a Pokemon battle intro. Shows two
champions facing off.

- **Height:** ~180px
- **Width:** Same as the device content area, full-width inside padding
- **Background:** `--dmg-dark` (#306230) with subtle scanline overlay
- **Border:** 4px solid `--dmg-darkest`, horizontal divider from the hero
  section above
- **Top margin:** 8px gap from the dialogue box above

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│     ┌──────────┐              ┌──────────┐           │
│     │          │     V S      │          │           │
│     │ BALTHAZAR│    ⚔️       │ MORWEN   │           │
│     │  (Bull)  │              │  (Bear)  │           │
│     │          │              │          │           │
│     └──────────┘              └──────────┘           │
│                                                      │
│     ── RESEARCH PHASE • ANALYSTS DEPLOYED ──         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.2.1 Character Slots

| Property | Value |
|----------|-------|
| Left slot | Balthazar — `balthazar-idle.png` |
| Right slot | Morwen — `morwen-idle.png` |
| Portrait size | 80px × 80px, `object-fit: cover` |
| Frame | 6px solid `--dmg-darkest`, 2px inner `--dmg-mid` — same system as hero but scaled down |
| Portrait rendering | `image-rendering: auto` (smooth, full-color) — NO DMG filter |

#### 3.2.2 VS Element

- **Content:** "V S" stacked vertically, or "VS" horizontally
- **Font:** Press Start 2P, 16px (chunky at this size — acceptable for the Pokemon aesthetic)
- **Color:** `--dmg-lightest` (#9BBC0F)
- **Background behind VS:** A diamond/cross shape in `--dmg-darkest`
- **Position:** Centered between the two portraits

#### 3.2.3 Bottom Label

- **Font:** Press Start 2P, 8px
- **Color:** `--dmg-mid` (#8BAC0F)
- **Content:** "RESEARCH PHASE • ANALYSTS DEPLOYED"
- **Centered** below the VS portraits

```css
.adv-vs-splash {
  background: var(--dmg-dark);
  border: 4px solid var(--dmg-darkest);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.adv-vs-slots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.adv-vs-slot {
  width: 80px;
  height: 80px;
  border: 6px solid var(--dmg-darkest);
  outline: 2px solid var(--dmg-mid);
  outline-offset: -8px;
  overflow: hidden;
}

.adv-vs-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: auto;
}

.adv-vs-divider {
  font-family: var(--font-pixel);
  font-size: 16px;
  color: var(--dmg-lightest);
  background: var(--dmg-darkest);
  padding: 6px 14px;
  letter-spacing: 2px;
}

.adv-vs-label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--dmg-mid);
  text-transform: uppercase;
}
```

---

### 3.3 Section 3: Verdict Banner

A compact banner showing the council's ruling.

- **Height:** ~120px
- **Width:** Full device width
- **Background:** `--dmg-dark` (#306230)
- **Border:** 4px solid `--dmg-darkest`
- **Top margin:** 8px gap from the VS splash

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   THE COUNCIL HAS RULED — HOLD                       │
│                                                      │
│   🐻 BEAR  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░  BULL 🐂            │
│                                                      │
│          PRESS ▲ TO READ THE CHRONICLE                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.3.1 Verdict Headline

- **Font:** Press Start 2P, 12px
- **Color:** `--dmg-lightest` (#9BBC0F)
- **Content:** "THE COUNCIL HAS RULED — HOLD"
- **Centered**
- **The word "HOLD"** should be in `--dmg-mid` (#8BAC0F) to create
  visual hierarchy

#### 3.3.2 Verdict Sentiment Bar

Same component as the hero screen sentiment bar (3.1.3), reused here.
For this mock, set `--sentiment-pct` to 55% (neutral-hold territory).

#### 3.3.3 Chronicle Prompt

- **Font:** Press Start 2P, 8px
- **Color:** `--dmg-mid` (#8BAC0F)
- **Content:** "PRESS ▲ TO READ THE CHRONICLE"
- **Animation:** Slow blink — 1.5s visible, 1.0s hidden
- **Centered** at the bottom

The ▲ triangle should be the same character used in the dialogue box
advance indicator, pointing up here (▲ vs ▼) to suggest different
interaction.

```css
.adv-verdict-banner {
  background: var(--dmg-dark);
  border: 4px solid var(--dmg-darkest);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.adv-verdict-headline {
  font-family: var(--font-pixel);
  font-size: 12px;
  color: var(--dmg-lightest);
  text-align: center;
  line-height: 1.5;
}

.adv-verdict-headline .adv-verdict-ruling {
  color: var(--dmg-mid);
}

.adv-verdict-prompt {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--dmg-mid);
  animation: adv-blink-slow 2.5s step-end infinite;
}

/* Reuse adv-blink-slow from dialogue box spec */
```

---

## 4. PNG Asset Map

All portrait PNGs live at `design/comic-cast/` relative to the project root
(`/Users/zachb/Desktop/TradingAgents/web-ui/frontend/the-bazaar/design/comic-cast/`).

The frontend agent should reference these as relative paths from wherever
the HTML lives:

```
design/comic-cast/<character>-<state>.png
```

or if the HTML is in the root:

```
./design/comic-cast/<character>-<state>.png
```

### 4.1 Hero Screen

| Slot | PNG | Notes |
|------|-----|-------|
| Speaker portrait | `flint-2-speaking.png` | The primary character for the sample. Flint is the Market Analyst / "the Bull." Speaking state — mouth open, gesturing. |

### 4.2 VS Splash

| Slot | PNG | Notes |
|------|-----|-------|
| Left champion (Bull) | `balthazar-idle.png` | Balthazar is the Investment Bull Debater. Idle state — confident smirk. |
| Right champion (Bear) | `morwen-idle.png` | Morwen is the Risk Bear Debater. Idle state — cold skepticism. |

### 4.3 Complete Character Roster (for future reference)

All 8 characters have 3 expression variants each. The frontend agent only
needs the 3 listed above (Flint speaking, Balthazar idle, Morwen idle) for
this sample, but the full roster is documented here for when the full
debate sequence is implemented.

| Character | Role | idle | speaking | reacting |
|-----------|------|------|----------|----------|
| Flint | Market Analyst (Bull) | `flint-1-idle.png` | `flint-2-speaking.png` | `flint-3-reacting.png` |
| Vera | Sentiment Analyst (Seer) | `vera-idle.png` | `vera-speaking.png` | `vera-reacting.png` |
| Reed | News Analyst (Herald) | `reed-idle.png` | `reed-speaking.png` | `reed-reacting.png` |
| Sage | Fundamentals Analyst (Scholar) | `sage-idle.png` | `sage-speaking.png` | `sage-reacting.png` |
| Balthazar | Investment Bull Debater | `balthazar-idle.png` | `balthazar-speaking.png` | `balthazar-reacting.png` |
| Morwen | Risk Bear Debater | `morwen-idle.png` | `morwen-speaking.png` | `morwen-reacting.png` |
| Kael | Trader (Runner) | `kael-idle.png` | `kael-speaking.png` | `kael-reacting.png` |
| Elder Aldric | Judge (Crown) | `aldric-idle.png` | `aldric-speaking.png` | `aldric-reacting.png` |

---

## 5. CSS Class Naming Convention

All ADV mock classes use the `adv-` prefix to avoid collision with the
existing `rt-` (Round Table) and `castle-` namespaces.

### 5.1 Namespace architecture

```
adv-mock-device        — outer bezel / device frame
  adv-hero             — section 1 container
    adv-status-strip   — top status bar
    adv-portrait-frame — the chunky frame around the speaker portrait
    adv-sentiment-bar  — the HP-style gauge (shared component)
    adv-dialogue-box   — the Game Boy text box
      adv-dialogue-speaker
      adv-dialogue-divider
      adv-dialogue-body
      adv-dialogue-cursor
      adv-dialogue-advance
  adv-vs-splash        — section 2 container
    adv-vs-slots
    adv-vs-slot
    adv-vs-divider
    adv-vs-label
  adv-verdict-banner   — section 3 container
    adv-verdict-headline
    adv-verdict-ruling
    adv-verdict-prompt
```

### 5.2 State classes

| Class | Purpose |
|-------|---------|
| `.adv-typing` | Applied to `.adv-dialogue-body` while typewriter is running |
| `.adv-typing-done` | Applied when typewriter completes; triggers advance indicator |
| `.adv-visible` | Generic visibility toggle (opacity 1 / 0 transitions) |

### 5.3 CSS custom properties

All DMG palette values defined on `:root` (or a `.adv-mock-device` scope):

```css
:root {
  --dmg-darkest:  #0F380F;
  --dmg-dark:     #306230;
  --dmg-mid:      #8BAC0F;
  --dmg-lightest: #9BBC0F;
  --font-pixel:   'Press Start 2P', 'Courier New', monospace;
  --sentiment-pct: 62%;  /* hero screen default */
}
```

---

## 6. Dimensions Summary Table

All dimensions in pixels. Desktop-first.

| Element | Width | Height | Notes |
|---------|-------|--------|-------|
| Device bezel | 640px max | auto (content-driven) | 16px outer border, centered on page |
| Status strip | 100% of content area | 40px | Full-width inside bezel padding |
| Portrait image | 400px | 400px | Scaled from 1024×1024 source |
| Portrait frame border | — | — | 12px outer + 2px mid + 6px matte = 20px padding from image edge |
| Sentiment bar track | 100% flex | 14px | Inside the 520px dialogue box width constraint |
| Sentiment bar total | 520px max | 28px | Including labels |
| Dialogue box | 520px | 144px | Centered, relative positioning for advance indicator |
| VS splash section | full content width | ~180px | Flexible height based on content |
| VS slot portrait | 80px | 80px | object-fit: cover |
| Verdict banner section | full content width | ~120px | Flexible height |

### Vertical spacing

```
Device top border               16px
  Screen padding                12px
    Status strip                40px
    Gap                         20px
    Portrait frame (~436px)     auto
    Gap                         16px
    Sentiment bar               28px
    Gap                         16px
    Dialogue box                144px
    Gap                         8px
    VS splash                   ~180px
    Gap                         8px
    Verdict banner              ~120px
  Screen padding                12px
Device bottom border            16px
─────────────────────────────────────
Total (approx.)                 ~636px + portrait frame
```

---

## 7. Responsive / Mobile Notes

Desktop is the primary target (this is a sample for sign-off). But the
mock should degrade gracefully:

### 7.1 Tablet (640px–900px viewport)

The device bezel already caps at 640px, so tablets see the same layout as
desktop. Centered, with generous margins.

### 7.2 Mobile (< 640px viewport)

- **Device bezel** shrinks to `width: 100%` with 8px outer border (not 16px)
- **Portrait** scales down: `max-width: 280px; max-height: 280px`
- **Dialogue box** goes full-width minus padding: `width: 100%`, `height:
  auto` (min-height 120px, no fixed height)
- **VS slot portraits** shrink to 64px × 64px
- **Status strip** font drops to 7px — tested for legibility; fallback to
  8px if 7px is unreadable
- **Font sizes** do NOT scale below 7px. At viewports under 360px, accept
  that Press Start 2P will wrap awkwardly and rely on the natural reading
  order.
- **Sentiment bar** full-width, labels may wrap to two lines if needed

```css
@media (max-width: 640px) {
  .adv-mock-device {
    max-width: 100%;
    margin: 16px 8px;
    border-width: 8px;
  }

  .adv-portrait-frame img {
    width: 280px;
    height: 280px;
  }

  .adv-dialogue-box {
    width: 100%;
    min-height: 120px;
    height: auto;
  }

  .adv-vs-slot {
    width: 64px;
    height: 64px;
  }

  .adv-vs-slot img {
    width: 64px;
    height: 64px;
  }
}
```

### 7.3 Loading strategy

- Press Start 2P is ~40KB. Load it with `<link rel="preload">` in the
  `<head>` to minimize FOUT.
- Character PNGs are 1024×1024 and may be 200–800KB each. For the mock,
  the frontend agent should add `loading="lazy"` on the VS splash portraits
  (below the fold) and eager-load only the hero portrait.
- Use `decoding="async"` on all portrait `<img>` tags to avoid blocking
  the main thread.

---

## 8. Animation & Interaction Behavior Summary

| Element | Behavior | Timing |
|---------|----------|--------|
| Typewriter text | Characters appear one at a time with a blinking block cursor | 50ms/char, 400ms initial delay |
| Cursor blink | Block cursor █ blinks in `--dmg-lightest` | 530ms on / 530ms off |
| Advance indicator ▼ | Blinking down-triangle after text completes | 700ms on / 700ms off, starts 800ms after text done |
| Chronicle prompt ▲ | Slow blink prompt in verdict banner | 1.5s on / 1.0s off |
| Sentiment bar fill | CSS transition on width change | 0.4s, steps(8) easing for pixel feel |

### CSS keyframes required

```css
@keyframes adv-cursor-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

@keyframes adv-blink-slow {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
```

---

## 9. Implementation Checklist for Frontend Agent

The frontend agent should read this spec and produce a single static HTML
file at `adv-mock.html` in the project root. This is a **sample for
sign-off**, not production code. Checklist:

- [ ] Load Press Start 2P from Google Fonts
- [ ] Define all 4 DMG CSS custom properties
- [ ] Build the outer device bezel with 16px border and screen padding
- [ ] Section 1: Status strip (ticker, title, turn counter)
- [ ] Section 1: Portrait frame with Flint speaking PNG, no DMG filter
- [ ] Section 1: Sentiment bar with BEAR/BULL labels, 62% fill
- [ ] Section 1: Dialogue box with speaker tag, divider, typewriter text, blinking advance ▼
- [ ] Section 2: VS splash with Balthazar (left) and Morwen (right), VS divider, research label
- [ ] Section 3: Verdict banner with headline, sentiment bar (55%), chronicle prompt ▲
- [ ] Mobile responsive: portrait and text scaling at < 640px
- [ ] Lazy-load below-fold portraits
- [ ] No DMG filter/overlay on any portrait image
- [ ] All classes use `adv-` prefix

---

## 10. Design Decisions & Rationale

1. **Full-color portraits + DMG chrome.** The art direction is locked —
   the contrast between painterly characters and retro pixel UI creates
   the intended aesthetic. DMG green-grey only touches the frame elements.

2. **640px device width.** 640 / 8 = 80 monospace characters at 8px —
   classic retro layout math. The device feels like a handheld console
   without being a literal Game Boy replica.

3. **Press Start 2P despite its quirks.** It's the most recognizable DMG
   pixel font. The awkward sizing (only looks good at 8–16px) is a known
   trade-off. The `Courier New` fallback ensures layout doesn't break
   during font load.

4. **Typewriter with block cursor.** The ADV genre convention (Phoenix
   Wright, etc.) uses typewriter text to build drama. A 50ms/char speed
   is fast enough to not frustrate but slow enough to feel like a game.

5. **VS splash as a Pokemon battle intro.** The task explicitly calls
   this out — two characters facing off with VS between them. It's a
   visual joke that works because the council IS a battle (bull vs bear).

6. **Sentiment bar as HP bar.** The RPG metaphor fits the Game Boy
   aesthetic. Fill left-to-right (bearish → bullish) with tick marks
   at every 10% for the HP-gauge feel.

7. **No scroll-jacking, no routing.** All three sections are visible at
   once on desktop. This is a flat page for sign-off, not a SPA.

8. **Steps(8) easing on the sentiment bar.** CSS `steps()` gives the
   gauge fill a "tick" feel instead of smooth interpolation — matching
   the pixel-grid aesthetic of the DMG.

---

*Spec version: 1.0 | Date: 2026-06-02 | Author: UX Designer (webteam-ux-designer)*
*Next: Frontend agent reads this spec and builds `adv-mock.html`*
