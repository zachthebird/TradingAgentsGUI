# Phase 1 Visual Tweaks — UX Design Spec

Referenced baseline: `design/adv-mock/index.html` (592 lines CSS, 300 lines DOM/JS)
All DMG palette, typography, and portrait-frame conventions inherited from `DESIGN-SPEC.md` and `DESIGN-SPEC-BATTLE.md`.

---

## 1. FACE-CLEAR HP/CONVICTION BOX POSITIONING (Zach's top priority)

### 1.1 Problem

The current diagonal Pokemon layout places each agent's stat box in the OPPOSITE corner of the arena from their portrait:

- Morwen (Bear) portrait: upper-right — stat box: upper-left
- Balthazar (Bull) portrait: lower-left — stat box: lower-right

This creates two problems:
1. The stat box is visually disconnected from its portrait — the viewer must scan across the full width of the arena to map character → stats.
2. The portrait frames (286px each at 250px image + 36px chrome) overlap each other by ~28px horizontally in the center of the 584px arena interior (Bear frame at x:278–564, Bull frame at x:20–306 → overlap zone x:278–306). The portraits crowd each other in the middle, making neither face fully legible.

### 1.2 Solution: Adjacent-Offset Stat Boxes

Move each stat box to sit ADJACENT to its portrait, on the same side of the arena, offset so it never covers the character's face. This is the quintessential Pokemon layout — the HP box and sprite share the same screen quadrant.

**Morwen / BEAR — Stat box sits ABOVE her portrait (upper-right quadrant)**

```
┌─────────────── ARENA (584px wide, 350px tall) ───────────────┐
│                                                                │
│                    ┌────────────────┐                          │
│                    │ MORWEN  🐻 BEAR│  ← stat box (z-index: 4)│
│                    │ CONVICTION ██░ │     right-aligned,       │
│                    │          82%   │     directly above       │
│                    └────────────────┘     portrait             │
│              ┌──────────────────────┐                          │
│              │                      │                          │
│              │   MORWEN PORTRAIT    │  ← portrait (z-index: 3) │
│              │   250×250 painterly  │     upper-right          │
│              │                      │                          │
│              └──────────────────────┘                          │
│              ═══ platform ═══════════                          │
│                                                                │
│                                                                │
│  ═══ platform ═══════════════                                 │
│  ┌──────────────────────┐                                     │
│  │                      │                                     │
│  │  BALTHAZAR PORTRAIT  │  ← portrait (z-index: 3)            │
│  │  250×250 painterly   │     lower-left                      │
│  │                      │                                     │
│  └──────────────────────┘                                     │
│  ┌────────────────┐                                            │
│  │ BALTHAZAR 🐂 BULL│  ← stat box (z-index: 4)                │
│  │ CONVICTION ███░ │     left-aligned,                        │
│  │          78%    │     directly below portrait               │
│  └────────────────┘                                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 Exact CSS Changes

**Bear stat box (currently `.adv-battle-stats-bear`):**
- **REMOVE:** `top: 14px; left: 16px;`
- **ADD:**
  ```css
  top: 10px;
  right: 20px;
  ```
- Bear stat box now shares the EXACT same anchor point as Bear's portrait (`top: 10px; right: 20px`), sitting ABOVE it via a higher z-index.
- The stat box (width: 195px) sits comfortably within the portrait frame's horizontal footprint (~286px), right-aligned to match.

**Bull stat box (currently `.adv-battle-stats-bull`):**
- **REMOVE:** `bottom: 50px; right: 16px;`
- **ADD:**
  ```css
  bottom: 40px;
  left: 20px;
  ```
- Bull stat box now shares the EXACT same anchor as Bull's portrait (`bottom: 40px; left: 20px`), sitting BELOW it (the stat box renders in DOM order after the portrait, so it paints on top of the same z-index level, but raise it to z-index: 4 for safety).

**Stat box z-index change (both):**
```css
z-index: 4;
```
Previously `z-index: 3`. Now that stat boxes sit in the same quadrant as their portraits, they need to paint ABOVE the portrait frame so the conviction gauge overlays the bottom pixel-band of the portrait frame, feathering into it — like a Gen 1 Pokemon HP box that anchors to the sprite's edge.

### 1.4 Face Visibility Guarantee

With the stat box at 195px wide × ~75px tall and the portrait at 286px wide × 286px tall, aligning them to the same `top/right` or `bottom/left` anchor means:

- Bear stat box: occupies `top:10px` to `~85px`, sitting ABOVE the portrait which starts at `top:10px` but renders BELOW in the DOM. The portrait's face area (center 60% of the 250×250 image) starts ~75px into the image, safely below the stat box zone.
- Bull stat box: shares `bottom:40px` anchor. The portrait's face area occupies the center of the image. The stat box (at the bottom) covers at most the lower 30% of the frame, well below the face.

**If pixel overlap occurs on the face:** Reduce stat box width to 170px on mobile and push the anchor offset by +10px (`top: 20px; right: 30px` for Bear; `bottom: 50px; left: 30px` for Bull) to create a 10px breathing gap between stat box edge and portrait frame edge.

### 1.5 Mobile Responsive (< 640px)

Follow the same adjacent-offset pattern with scaled values:

Bear stat box:
```css
top: 8px;
right: 8px;
width: 140px;
```

Bull stat box:
```css
bottom: 28px;
left: 8px;
width: 140px;
```

The smaller 180×180 portrait images keep face visibility with the narrower 140px stat boxes.

---

## 2. VS SPLASH → BATTLE-INTRO TRANSITION

### 2.1 Problem

The current VS splash is a static Section 2 below the battle view — it scrolls into view after the battle, which makes it feel like an afterthought. In Pokemon, the VS sequence is the FIRST thing you see before the battle begins.

### 2.2 Solution: Full-Screen Intro Overlay → Battle Reveal

**Animation sequence (total: ~4.2 seconds):**

| Phase | Time | What Happens |
|-------|------|-------------|
| **1. Black screen** | 0ms–300ms | DMG-darkest (#0F380F) fills the viewport. Fade in from black (200ms ease-in). |
| **2. VS portraits appear** | 300ms–800ms | Balthazar (Bull) slides in from LEFT. Morwen (Bear) slides in from RIGHT. Both use `transform: translateX` from ±100% → 0, 400ms ease-out. |
| **3. VS divider strike** | 800ms–1200ms | The "V S" block scales up from 0 → 1.2 → 1.0 with a dramatic spring (`cubic-bezier(0.34, 1.56, 0.64, 1)`), 300ms. A brief screen flash (white-green) on impact. |
| **4. Hold** | 1200ms–2500ms | Characters stare down for 1.3s. Idle bob animation on both portraits. "RESEARCH PHASE • ANALYSTS DEPLOYED" text types in character-by-character (40ms/char). |
| **5. Transition swipe** | 2500ms–3200ms | A DMG-green horizontal wipe sweeps top-to-bottom (like a Pokemon battle transition). The VS splash fades to black behind it. 700ms. |
| **6. Battle reveal** | 3200ms–4200ms | The battle arena fades in from black (400ms fade). Status strip appears first (instant), then arena background fades in, then portraits + stat boxes snap into place (300ms stagger). |
| **7. First turn** | 4200ms+ | The existing `setupTurn()` logic kicks off — move flourish appears, typewriter begins. |

### 2.3 DOM Structure Changes

The VS splash moves from its current Section 2 position and becomes a full-viewport overlay that covers the entire device bezel:

```html
<!-- NEW: VS Intro Overlay (replaces Section 2 in the scroll flow) -->
<div class="adv-vs-overlay" id="vsOverlay">
  <div class="adv-vs-overlay-bg"></div>  <!-- #0F380F background -->
  <div class="adv-vs-slots">
    <div class="adv-vs-slot adv-vs-slot-left">  <!-- Balthazar / Bull -->
      <img src="../comic-cast/balthazar-idle.png" ...>
    </div>
    <div class="adv-vs-divider">V S</div>
    <div class="adv-vs-slot adv-vs-slot-right">  <!-- Morwen / Bear -->
      <img src="../comic-cast/morwen-idle.png" ...>
    </div>
  </div>
  <div class="adv-vs-label" id="vsLabel"></div>  <!-- typewriter target -->
</div>
```

The `.adv-vs-overlay`:
- `position: absolute; inset: 0; z-index: 100;` — covers the entire `.adv-mock-device`
- `background: var(--dmg-dark);` — DMG dark green until the black phase
- `display: flex; flex-direction: column; align-items: center; justify-content: center;`

### 2.4 CSS Keyframes Required

```css
/* Phase 2: Left portrait slides in */
@keyframes vs-slide-left {
  0%   { transform: translateX(-120%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

/* Phase 2: Right portrait slides in */
@keyframes vs-slide-right {
  0%   { transform: translateX(120%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

/* Phase 3: VS block impact strike */
@keyframes vs-strike {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.3); opacity: 1; }
  80%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* Phase 5: Top-to-bottom wipe transition */
@keyframes vs-wipe {
  0%   { clip-path: inset(0 0 100% 0); }
  100% { clip-path: inset(0 0 0 0); }
}

/* Phase 6: Battle arena fade-in */
@keyframes vs-reveal-battle {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
```

### 2.5 JavaScript Orchestration

The VS overlay JavaScript should be a self-contained function that runs on page load, then calls the existing battle turn engine. Pseudo-flow:

```js
function runVSIntro() {
  const overlay = document.getElementById('vsOverlay');
  const leftSlot = overlay.querySelector('.adv-vs-slot-left');
  const rightSlot = overlay.querySelector('.adv-vs-slot-right');
  const vsBlock = overlay.querySelector('.adv-vs-divider');
  const label = document.getElementById('vsLabel');

  // Phase 1: Start black, fade bg in
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 200ms ease-in';
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  // Phase 2: Slide portraits in (300ms delay from start)
  setTimeout(() => {
    leftSlot.style.animation = 'vs-slide-left 400ms ease-out forwards';
    rightSlot.style.animation = 'vs-slide-right 400ms ease-out forwards';
  }, 300);

  // Phase 3: VS strike (800ms from start)
  setTimeout(() => {
    vsBlock.style.animation = 'vs-strike 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    // Screen flash — briefly set overlay bg to #9BBC0F then back
    overlay.style.background = 'var(--dmg-lightest)';
    setTimeout(() => { overlay.style.background = 'var(--dmg-dark)'; }, 80);
  }, 800);

  // Phase 4: Typewriter label (1200ms from start)
  setTimeout(() => {
    typewriteText(label, 'RESEARCH PHASE • ANALYSTS DEPLOYED', 40);
  }, 1200);

  // Phase 5-6: Wipe transition → reveal battle (2500ms from start)
  setTimeout(() => {
    overlay.style.animation = 'vs-wipe 700ms ease-in forwards';
    // After wipe completes, hide overlay, reveal battle
    setTimeout(() => {
      overlay.style.display = 'none';
      document.querySelector('.adv-battle-view').style.animation = 'vs-reveal-battle 400ms ease-out forwards';
      // Phase 7: Start first turn
      setupFirstTurn();
    }, 700);
  }, 2500);
}
```

### 2.6 Reduced Motion Fallback

```css
@media (prefers-reduced-motion: reduce) {
  .adv-vs-slot-left,
  .adv-vs-slot-right,
  .adv-vs-divider,
  .adv-vs-overlay {
    animation: none !important;
    transition: opacity 150ms ease-in !important;
  }
  /* Show static VS for 1.5s, then cut to battle */
}
```

---

## 3. BULL/BEAR ↔ CHARACTER MAPPING

### 3.1 Verified Mapping

From DOM inspection, CSS class naming, DESIGN-SPEC.md asset map, and the VS splash ordering — the mapping is **consistent and correct** across all layout contexts:

| Character | Allegiance | Battle Position | VS Splash Position |
|-----------|-----------|----------------|-------------------|
| **Balthazar** | **BULL**  | Lower-left (player spot) | Left slot |
| **Morwen** | **BEAR**  | Upper-right (opponent spot) | Right slot |

**Evidence:**

**Battle view DOM** (index.html lines 539–586):
- `.adv-battle-stats-bear` → name: "MORWEN", allegiance: "🐻 BEAR"
- `.adv-battle-portrait-bear` → img alt: "Morwen, the Risk Bear Debater"
- `.adv-battle-stats-bull` → name: "BALTHAZAR", allegiance: "🐂 BULL"
- `.adv-battle-portrait-bull` → img alt: "Balthazar, the Investment Bull Debater"

**VS splash DOM** (index.html lines 620–637):
- Left `.adv-vs-slot` → img alt: "Balthazar — Investment Bull Debater"
- Right `.adv-vs-slot` → img alt: "Morwen — Risk Bear Debater"

**DESIGN-SPEC.md asset map** (§4.2, line 700):
- "Left champion (Bull): balthazar-idle.png"
- "Right champion (Bear): morwen-idle.png"

**DESIGN-SPEC-BATTLE.md quadrant table** (§B.2.1):
- "Upper-right: Bear's portrait (Morwen)"
- "Lower-left: Bull's portrait (Balthazar)"

### 3.2 Recommendation

**NO changes needed.** The mapping is correct everywhere. The frontend implementer should ensure:

1. The CSS class suffixes `.adv-battle-*-bear` and `.adv-battle-*-bull` map to the correct character names (Morwen / Balthazar).
2. Any JS that references `allegiance === 'Bull'` or `allegiance === 'Bear'` drives the correct portrait (e.g., `isBullTurn()` in the battle engine at line 723–725 correctly checks `TURNS[currentTurn].allegiance === 'Bull'`).
3. The VS splash left/right ordering: Balthazar (Bull) is ALWAYS the LEFT champion, Morwen (Bear) is ALWAYS the RIGHT champion. This aligns with the battle view's lower-left/upper-right diagonal.

---

## 4. DMG PALETTE PUNCH-UP

### 4.1 Canonical Palette (Verified Authentic)

The current 4-tone palette used in the mock is the **canonical SameBoy/Gambatte emulator palette** — the most widely recognized authentic DMG green values. These are correct and do not need changing:

| Token | Hex | LRV (approx) | Gamut |
|-------|-----|-------------|-------|
| `--dmg-darkest` | `#0F380F` | 1.8% | Near-black olive green |
| `--dmg-dark`    | `#306230` | 8.2% | Dark moss green |
| `--dmg-mid`     | `#8BAC0F` | 32.1% | Yellow-green (the "DMG green" everyone remembers) |
| `--dmg-lightest`| `#9BBC0F` | 42.5% | Pale chartreuse (the screen background tint) |

### 4.2 Final Palette Selection: BGB (Approved)

After review, the **BGB emulator variant** was approved — a warmer, more screen-authentic palette that better evokes the actual DMG LCD's phosphor-green cast and contrasts better against full-color painterly portraits while still reading as undeniably Game Boy:

| Token | Final Hex | Replaces (#) | Character |
|-------|-----------|-------------|-----------|
| `--dmg-darkest` | **`#081820`** | `#0F380F` | Deep phosphor black — slight blue-shift |
| `--dmg-dark`    | **`#346856`** | `#306230` | Warmer moss green (+4R, +38G) |
| `--dmg-mid`     | **`#88C070`** | `#8BAC0F` | Grass green — less yellow, more natural DMG midtone |
| `--dmg-lightest`| **`#E0F8D0`** | `#9BBC0F` | Pale cream-green — screen backlight cast, much brighter |

**Implementation:** Update all 4 CSS custom property values in `:root` to the BGB hex values above. All element-to-tone mappings in §4.3 remain unchanged.

### 4.3 Element-to-Tone Mapping

Regardless of which palette variant is chosen, the mapping is:

| Tone | Token | Applies To |
|------|-------|-----------|
| **Darkest** | `--dmg-darkest` | All text (dialogue body, speaker name, stat box text, status strip text, labels). All borders and outlines (portrait frame borders, dialogue box border, stat box border, arena borders, device bezel). Platform shelves. Sentiment/momentum gauge empty track. |
| **Dark** | `--dmg-dark` | Dialogue box background. Battle arena background. Stat box background. Status strip background. VS overlay background. Gauge fill (inverted from darkest). |
| **Mid** | `--dmg-mid` | Conviction gauge fill. Sentiment/momentum gauge fill. Divider lines (dialogue divider, stat box divider). Allegiance labels (the "(Bull)" / "(Bear)" suffix). Verdict ruling text ("HOLD"). Move flourish background border. |
| **Lightest** | `--dmg-lightest` | Text on dark backgrounds (status strip text, dialogue text, stat box text). Portrait frame inner matte background. Cursor blink color. Active speaker glow. Screen background behind all sections. |

### 4.4 Chrome-Only Rule (Reaffirmed)

Portraits remain full-color painterly PNGs rendered with `image-rendering: auto`. **Never apply any DMG palette color, tint, duotone, or blend-mode to the `<img>` elements or their containing `.adv-battle-frame` backgrounds.** The DMG palette is for UI chrome ONLY: borders, boxes, bars, text, backgrounds behind text.

The ONLY exception: if a portrait fails to load, the `.adv-battle-frame`'s `background: var(--dmg-lightest)` provides a DMG-appropriate fallback matte.

---

## 5. BATTLE-VIEW SIZING / LAYOUT BALANCE

### 5.1 Current Layout Analysis

**Problem 1 — Portrait overlap:** The two 286px portrait frames (Bear upper-right, Bull lower-left) overlap by ~28px horizontally in the center of the 584px arena interior. On a max-width 640px device, the portrait frames crowd each other.

**Problem 2 — Arena height mismatch:** The arena is 350px tall, but two diagonally-placed 286px portrait frames occupy `y:10–296` (Bear) and `y:24–310` (Bull) — a 272px vertical overlap band. The portraits fill ~85% of the arena height, leaving only ~40px of visible dark backdrop around them. This makes the arena feel cramped rather than spacious.

**Problem 3 — Stat box width edge case:** At 195px wide, stat boxes extend far from the portrait anchor. With the new adjacent positioning (spec item 1), the 195px stat box extends 195px from the shared anchor point, but the portrait frame is only 286px wide — the stat box spans 68% of the portrait width, which works but could use proportional tuning.

**Problem 4 — Layout renders as side-by-side:** Browser analysis (vision model) reported the layout appears side-by-side rather than the intended diagonal. This may be due to cumulative layout shift from font loading or the `position: absolute` anchors not resolving as expected in all browsers.

### 5.2 Recommended Adjustments

#### 5.2.1 Portrait Sizing

Reduce portrait image display size from 250×250 to **220×220** on desktop. This:
- Shrinks frame footprint from 286px → 256px
- Eliminates the 28px horizontal overlap (256+256=512px in a 584px arena → 72px gap)
- Leaves more visible dark arena backdrop, strengthening the Pokemon aesthetic
- Maintains face legibility — the images are 1024×1024 source, so 220px render is still sharp

```css
.adv-battle-frame img {
  width: 220px;
  height: 220px;
}
```

Corresponding frame shrink: border 12px × 2 + padding 6px × 2 + 220px = 256px total footprint.

#### 5.2.2 Arena Height

Increase arena height from 350px → **380px** to accommodate the repositioned stat boxes (now above/below portraits) and give the diagonal layout breathing room:

```css
.adv-battle-arena {
  height: 380px;  /* was 350px */
}
```

#### 5.2.3 Stat Box Proportional Sizing

At 220px portrait image, the stat box should sit cleanly within the portrait's horizontal footprint. Set stat box width to **180px** (was 195px) to create a 38px margin on each side of the portrait frame (256px − 180px = 76px → 38px per side):

```css
.adv-battle-stats-bear,
.adv-battle-stats-bull {
  width: 180px;  /* was 195px */
}
```

#### 5.2.4 Guarantee Diagonal Rendering

Add explicit `min-width` to `.adv-battle-arena` to prevent layout collapse that causes side-by-side rendering:

```css
.adv-battle-arena {
  min-width: 480px;  /* prevents the arena from going narrower than diagonal needs */
}
```

#### 5.2.5 Full Updated Positioning Table

| Element | Property | Old Value | New Value |
|---------|----------|-----------|-----------|
| Arena | height | 350px | **380px** |
| Arena | min-width | (none) | **480px** |
| Portrait img | width/height | 250px | **220px** |
| Bear portrait | top/right | 10px / 20px | 10px / 20px (unchanged) |
| Bull portrait | bottom/left | 40px / 20px | **50px / 20px** (+10px bottom to compensate for arena height increase) |
| Stat box (both) | width | 195px | **180px** |
| Bear stat box | position | top:14px, left:16px | **top:10px, right:20px** |
| Bull stat box | position | bottom:50px, right:16px | **bottom:50px, left:20px** |
| Stat box (both) | z-index | 3 | **4** |
| Platform (both) | width | 270px | **240px** (proportional to 256px frame + 8px overhang) |

#### 5.2.6 Mobile Adjustments (< 640px)

```css
@media (max-width: 640px) {
  .adv-battle-arena {
    height: 320px;          /* scaled down */
    min-width: 320px;
  }
  .adv-battle-frame img {
    width: 160px;
    height: 160px;
  }
  .adv-battle-portrait-bear {
    top: 8px;
    right: 8px;
  }
  .adv-battle-portrait-bull {
    bottom: 38px;
    left: 8px;
  }
  .adv-battle-stats-bear,
  .adv-battle-stats-bull {
    width: 130px;
    font-size: 7px;
  }
  .adv-battle-stats-bear {
    top: 8px;
    right: 8px;
  }
  .adv-battle-stats-bull {
    bottom: 38px;
    left: 8px;
  }
  .adv-battle-platform {
    width: 180px;
    height: 8px;
  }
}
```

---

## Summary of ALL CSS Property Changes

```
Arena:
  height: 350px → 380px
  min-width: (none) → 480px

Portrait images:
  width/height: 250px → 220px

Stat boxes (shared):
  width: 195px → 180px
  z-index: 3 → 4

Bear stat box:
  top/left: 14px/16px → top/right: 10px/20px

Bull stat box:
  bottom/right: 50px/16px → bottom/left: 50px/20px

Bull portrait:
  bottom: 40px → 50px

Platforms (shared):
  width: 270px → 240px

DMG palette (final, BGB approved):
  darkest:  #0F380F → #081820
  dark:     #306230 → #346856
  mid:      #8BAC0F → #88C070
  lightest: #9BBC0F → #E0F8D0

New CSS keyframes needed:
  vs-slide-left, vs-slide-right, vs-strike, vs-wipe, vs-reveal-battle

New DOM element:
  .adv-vs-overlay (full-viewport intro overlay, replaces static Section 2)
```

---

_All measurements verified against the current `design/adv-mock/index.html` (lines 69–143 for portrait/stat box positioning, lines 15–25 for CSS variables). See also `DESIGN-SPEC-BATTLE.md` §B.4/B.6 for original positioning specs._
