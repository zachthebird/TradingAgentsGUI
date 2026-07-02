# Round Table Council — Animation Specification

Complete animation behaviors, CSS keyframes, and motion design system.
Builds on existing `castle.css` and `castle-council.js`. All variables reference the castle palette.

## 1. IDLE LIFE (Continuous Subtle Animation)

### 1.1 Breathing Cycle
Applied to all `.rt-seat` elements when not in a transient state.

```css
@keyframes idle-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50%      { transform: translate(-50%, -50%) scale(1.015); }
}

.rt-seat:not(.speaking):not(.thinking):not(.done):not(.dimmed) {
  animation: idle-breathe 4s ease-in-out infinite;
}
```

### 1.2 Blink (Random Intervals)
Applied to the portrait container via a class toggle managed by JavaScript.

```css
@keyframes blink-frame {
  0%, 90%, 100% { opacity: 1; }
  95%           { opacity: 0; }
}
.rt-seat:not(.speaking) .rt-portrait {
  /* JS randomly toggles .blinking class at 3-7s intervals */
}
.rt-seat.blinking .rt-portrait svg {
  animation: blink-frame 0.3s ease-in-out;
}
```

**JS approach:**
```js
function startIdleBlinking() {
  Object.values(seatEls).forEach(el => {
    const blink = () => {
      if (el.classList.contains('speaking') || el.classList.contains('thinking')) return;
      el.classList.add('blinking');
      setTimeout(() => el.classList.remove('blinking'), 300);
      setTimeout(blink, 3000 + Math.random() * 4000);
    };
    setTimeout(blink, Math.random() * 3000);
  });
}
```

### 1.3 Candle Flicker
Already implemented via `.rt-candle::after` `flicker` keyframes in `castle.css` lines 265-270.

### 1.4 Portrait Pulse (Thinking State)
Already implemented via `.rt-seat.thinking .rt-portrait` `thinkPulse` keyframes in `castle.css` lines 221-224.

---

## 2. ENTRANCE (First Load Only)

### 2.1 Judge Entrance
Elder Aldric's throne appears first with dramatic scale+glow.

```css
@keyframes judge-entrance {
  0%   { transform: translate(-50%, -30%) scale(0.3); opacity: 0; }
  60%  { transform: translate(-50%, -52%) scale(1.08); opacity: 1; }
  80%  { transform: translate(-50%, -48%) scale(0.97); }
  100% { transform: translate(-50%, -50%) scale(1); }
}

.rt-seat[data-id="judge"].entering {
  animation: judge-entrance 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```

### 2.2 Council Member Entrance (Staggered)
Circle seats (analysts) pop in clockwise.

```css
@keyframes seat-pop-in {
  0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  70%  { transform: translate(-50%, -50%) scale(1.12); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); }
}

.rt-seat.entering {
  animation: seat-pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* Staggered delays applied inline by JS */
/* JS: seatEl.style.animationDelay = `${idx * 0.2}s`; */
```

### 2.3 Debater Pair Entrance
Balthazar (135°) and Morwen (180°) enter simultaneously, slightly slower, with a brief facing-assertion pose.

```css
@keyframes debater-pop-in {
  0%   { transform: translate(-50%, -50%) scale(0) rotate(-15deg); opacity: 0; }
  60%  { transform: translate(-50%, -50%) scale(1.1) rotate(0deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); }
}

.rt-seat[data-id="debater"].entering,
.rt-seat[data-id="risk"].entering {
  animation: debater-pop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```

---

## 3. SPEAKING GESTURES

### 3.1 Active Speaker Emphasis
Already implemented via `.rt-seat.speaking .rt-portrait` in `castle.css` lines 208-215:
- Scale 1.12×
- Gold border (`#f2c761`)
- Gold glow shadow ring + spread

### 3.2 Speaking Bob (Subtle Vertical Nod)
Add to the existing `.speaking` state:

```css
@keyframes speaking-bob {
  0%, 100% { transform: translate(-50%, -50%); }
  50%      { transform: translate(-50%, -52%); }
}

.rt-seat.speaking {
  animation: speaking-bob 1.2s ease-in-out infinite;
}
```

### 3.3 Hand Gesture (Arm Emphasis) — CSS-Only
During speaking, a small gesture line can radiate from the portrait:

```css
.rt-seat.speaking .rt-portrait::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 3px;
  background: var(--castle-gold-bright);
  opacity: 0.5;
  border-radius: 2px;
  /* Position depends on seat angle — use a data-attribute selector or JS */
  transform-origin: center left;
  animation: gesture-wave 0.6s ease-in-out infinite alternate;
}

@keyframes gesture-wave {
  0%   { transform: rotate(-10deg) scaleX(0.6); opacity: 0.2; }
  100% { transform: rotate(10deg) scaleX(1); opacity: 0.6; }
}
```

### 3.4 Rebuttal Emphasis
Already implemented: `.rt-bubble.rebuttal` gets `.shake` animation on rebuttal lines (castle.css lines 293-298).

---

## 4. VERDICT REVEAL (Dramatic Climax)

### 4.1 Stage Dimming
```css
@keyframes stage-dim {
  0%   { filter: brightness(1); }
  100% { filter: brightness(0.5); }
}

.rt-stage.verdict-mode {
  animation: stage-dim 1s ease-in-out forwards;
}
```

### 4.2 Verdict Banner Float
Already implemented in `castle.css` lines 420-424 as `verdictBannerFloat`.

### 4.3 Judge Speaking Finale
When Elder Aldric delivers the verdict:

```css
@keyframes judge-finale-glow {
  0%, 100% { 
    box-shadow: 0 0 0 3px rgba(242,199,97,0.25), 0 0 24px rgba(242,199,97,0.5);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(242,199,97,0.5), 0 0 60px rgba(242,199,97,0.8), 0 0 120px rgba(242,199,97,0.3);
  }
}

.rt-seat[data-id="judge"].speaking.verdict-finale .rt-portrait {
  animation: judge-finale-glow 2s ease-in-out infinite;
}
```

### 4.4 Crest Glow
```css
@keyframes crest-pulse {
  0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
  50%      { opacity: 0.9; transform: translate(-50%, -50%) scale(1.15); }
}

.rt-crest.verdict-active {
  animation: crest-pulse 1.5s ease-in-out infinite;
}
```

### 4.5 Candle Flare-Up
During verdict delivery, candles flare brighter:

```css
@keyframes candle-verdict {
  0%, 100% { transform: translateX(-50%) scale(1, 1); opacity: 0.95; }
  50%      { transform: translateX(-50%) scale(1.3, 1.8); opacity: 1; }
}

.rt-stage.verdict-mode .rt-candle::after {
  animation: candle-verdict 1s ease-in-out infinite alternate;
}
```

---

## 5. BUBBLE ANIMATION

### 5.1 Pop-In (Default)
Already implemented in `castle.css` lines 284-287:
- `opacity: 0; transform: scale(0.85)` on `.rt-bubble`
- `opacity: 1; transform: scale(1)` on `.rt-bubble.visible`
- Transition: `0.25s cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot spring)

### 5.2 Emphatic Bubble Entrance (Dramatic)
```css
@keyframes emphatic-pop {
  0%   { opacity: 0; transform: scale(0.5) rotate(-3deg); }
  50%  { opacity: 1; transform: scale(1.1) rotate(1deg); }
  70%  { transform: scale(0.95) rotate(0deg); }
  100% { transform: scale(1); }
}

.rt-bubble.emphatic.visible {
  animation: emphatic-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```

### 5.3 Bull Bubble Entrance (Upward surge)
```css
@keyframes bull-surge {
  0%   { opacity: 0; transform: scale(0.7) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.rt-bubble.bull.visible {
  animation: bull-surge 0.3s ease-out forwards;
}
```

### 5.4 Bear Bubble Entrance (Weighty descent)
```css
@keyframes bear-drop {
  0%   { opacity: 0; transform: scale(0.7) translateY(-10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.rt-bubble.bear.visible {
  animation: bear-drop 0.35s ease-out forwards;
}
```

### 5.5 Bubble Typewriter Text (Optional JS-Only)
If desired, text can appear character-by-character:
```js
function typewriteText(element, fullText, speed = 30) {
  let i = 0;
  element.textContent = '';
  const interval = setInterval(() => {
    element.textContent += fullText[i++];
    if (i >= fullText.length) clearInterval(interval);
  }, speed);
  return interval; // store to cancel on bubble dismiss
}
```

---

## 6. STATE TRANSITIONS

### 6.1 Portrait Swap Transition
When switching between expression portraits:

```css
.rt-portrait svg use {
  transition: opacity 0.2s ease-in-out;
}

.rt-portrait svg use.switching {
  opacity: 0;
}
```

**JS approach:**
```js
function setSeatState(seatId, state) {
  const el = seatEls[seatId];
  if (!el) return;
  const useEl = el.querySelector('.rt-portrait svg use');
  if (!useEl) return;
  useEl.classList.add('switching');
  setTimeout(() => {
    useEl.setAttribute('href', `#portrait-${seatId}-${state}`);
    useEl.classList.remove('switching');
  }, 200);
}
```

### 6.2 State→State Transition Timing
| From | To | Overlap | Notes |
|------|----|---------|-------|
| `idle` | `thinking` | 300ms fade | Eyes narrow, head tilts subtly |
| `thinking` | `speaking` | 200ms swap | Quick transition; bubble enters simultaneously |
| `speaking` | `idle` | 300ms | Bubble fades first, then portrait relaxes |
| `speaking` | `done` | 400ms | `.speaking` removed → `.done` added with saturation drop |
| any | `surprised` | 150ms snap | Fast cut — surprise should feel instant |
| `idle` | `agree` | 250ms | Soft crossfade to smiling expression |
| `idle` | `disagree` | 200ms | Quick shift to furrowed brow |

---

## 7. `prefers-reduced-motion` FALLBACK

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all non-essential animations */
  .rt-seat,
  .rt-seat .rt-portrait,
  .rt-seat.speaking .rt-portrait,
  .rt-seat.thinking .rt-portrait,
  .rt-bubble,
  .rt-bubble.visible,
  .rt-bubble.emphatic,
  .rt-bubble.bull,
  .rt-bubble.bear,
  .rt-bubble.rebuttal.shake,
  .rt-candle::after,
  .rt-verdict-banner.show,
  .rt-stage.verdict-mode,
  .rt-crest,
  .rt-tilt-needle {
    animation: none !important;
    transition: none !important;
  }

  /* Preserve functional states (still need visual differentiation) */
  .rt-seat.speaking .rt-portrait {
    transform: scale(1.08);
    border-color: var(--castle-gold-bright);
    box-shadow: 0 0 0 2px rgba(242,199,97,0.25), 0 0 12px rgba(242,199,97,0.3);
  }

  .rt-seat.thinking .rt-portrait {
    border-color: var(--castle-gold-soft);
    box-shadow: 0 0 0 2px rgba(217,179,90,0.2);
  }

  /* Dialogue still appears — just no entrance motion */
  .rt-bubble.visible {
    opacity: 1;
    transform: scale(1);
  }

  /* Verdict banner still shows — no float */
  .rt-verdict-banner.show {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  /* Candles still lit — no flicker */
  .rt-candle::after {
    opacity: 0.95;
  }

  /* Tilt needle updates position but doesn't animate the transition */
  .rt-tilt-needle {
    transition: none;
  }

  /* Entrance: characters appear instantly */
  .rt-seat.entering {
    animation: none;
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
```

---

## 8. CSS KEYFRAME INDEX (for quick reference)

| Keyframe | File | Purpose |
|----------|------|---------|
| `idle-breathe` | New | Subtle 4s float for seated characters |
| `blink-frame` | New | 300ms opacity blip for eye blink |
| `judge-entrance` | New | Dramatic throne scale-in |
| `seat-pop-in` | New | Spring-loaded seat appearance |
| `debater-pop-in` | New | Angled entrance for sparring pair |
| `speaking-bob` | New | Vertical nod during speech |
| `gesture-wave` | New | Arm/hand emphasis line |
| `judge-finale-glow` | New | Pulsing gold aura on verdict |
| `crest-pulse` | New | Crest heartbeat during verdict |
| `candle-verdict` | New | Candle flare-up during verdict |
| `emphatic-pop` | New | Dramatic bubble entrance |
| `bull-surge` | New | Upward bullish bubble entrance |
| `bear-drop` | New | Weighty bearish bubble entrance |
| `thinkPulse` | castle.css:221 | Existing thinking pulse |
| `flicker` | castle.css:265 | Existing candle flicker |
| `verdictBannerFloat` | castle.css:420 | Existing verdict banner float |
| `shake` | castle.css:294 | Existing rebuttal shake |

---

## 9. IMPLEMENTATION CHECKLIST

- [ ] Add `characters.svg` `<use>` injection (extends `injectPortraits`)
- [ ] Add `speech-bubbles.svg` `<use>` injection
- [ ] Implement `setSeatState(seatId, state)` in castle-council.js
- [ ] Wire state transitions into `playFrom()` script loop
- [ ] Wire live SSE hook to use expression states (thinking→speaking→done)
- [ ] Add new CSS keyframes to castle.css
- [ ] Add `.rt-bubble.bull`, `.rt-bubble.bear`, `.rt-bubble.emphatic` styles
- [ ] Implement `startIdleBlinking()` on scene build
- [ ] Test `prefers-reduced-motion` fallback
- [ ] Verify portrait swapping doesn't flicker on fast state changes
- [ ] Verify seat angles in storyboard match existing SEATS array (270°-225°)
