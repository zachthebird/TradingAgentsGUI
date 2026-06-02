# Comic Cast — Prompt Settings & Style Anchors

## Model & Backend
- **Model:** `gpt-image-2-medium`
- **Provider:** `openai-codex` (Codex Responses API image generation)
- **Resolution:** 1024x1024
- **Quality:** medium
- **Format:** PNG, 8-bit RGB, white background

## Style Definition (derived from Flint sample + parent task spec)

A graphic-novel painterly illustration style with:

- **Linework:** Bold confident ink outlines with consistent weight. Clean, readable silhouettes.
- **Shading:** Cross-hatching and ben-day dot halftone shading for volume and texture.
- **Lighting:** Soft cel shading with dramatic cinematic side-lighting — one side brighter, deep shadows on the opposite.
- **Color:** Rich, saturated-but-grounded colors in a medieval palette (deep jewel tones: burgundy, forest green, royal blue, dark purple, iron grey, russet red).
- **Faces:** Semi-realistic cartoon proportions — graphic-novel faces, NOT chibi, NOT photoreal. Expressive features with clear personality.
- **Background:** Clean white (no scenery, no gradient).
- **Composition:** Full bust portrait, centered, 1024x1024 square frame.
- **Rendering:** Painterly brush texture visible in robes and hair.

## Expression Frames

Each character gets 3 frames:
1. **idle** — Neutral, watchful, observing the council. The character's default resting pose.
2. **speaking** — Mid-sentence, mouth open, gesturing with hands, animated. Delivering their analysis.
3. **reacting** — Emotional response to council events: shock, outrage, vindication, alarm, smugness.

## Character Prompts

### Flint (Market Analyst / "the Bull") — PRE-EXISTING (style anchor)
Generated in previous task (t_a4b9073b). Frames: flint-1-idle.png, flint-2-speaking.png, flint-3-reacting.png.
Style anchor for all subsequent characters.

---

### Vera — Sentiment Analyst (Crystal / Seer)
**Palette:** Deep purple, midnight-blue, silver celestial trim
**Emblem:** Glowing crystal orb
**Character:** Female, mystic seer, silver-streaked dark hair, piercing knowing eyes

**idle prompt:**
```
A graphic-novel painterly illustration of Vera, a female medieval council seer. She is a mystic sentiment analyst with piercing knowing eyes and silver-streaked dark hair pulled back. She wears deep purple and midnight-blue robes with silver celestial trim, holding a glowing crystal orb in one hand. Her expression is calm and watchful — idle, observing, reading the emotional currents of the council chamber.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions — not chibi, not photoreal. Clean white background. Full bust portrait, centered composition, 1024x1024. Painterly rendering with visible brush texture.
```

**speaking prompt:**
```
A graphic-novel painterly illustration of Vera, a female medieval council seer. She is a mystic sentiment analyst with piercing knowing eyes and silver-streaked dark hair. Deep purple and midnight-blue robes with silver celestial trim. She is mid-sentence, SPEAKING passionately — one hand gesturing outward, the other still holding a glowing crystal orb. Her mouth is open, eyebrows raised, leaning forward slightly into the council table. Dramatic expression conveying that she is reading the emotional truth of the market.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions — not chibi, not photoreal. Clean white background. Full bust portrait, centered composition, 1024x1024. Painterly rendering with visible brush texture. Character design must match the same Vera: purple robes, silver celestial trim, silver-streaked dark hair, crystal orb.
```

**reacting prompt:**
```
A graphic-novel painterly illustration of Vera, a female medieval council seer. She is a mystic sentiment analyst with piercing knowing eyes and silver-streaked dark hair. Deep purple and midnight-blue robes with silver celestial trim. She is REACTING with shock and concern — eyes wide, hand raised to her mouth, crystal orb glowing intensely in her other hand as if it just revealed alarming sentiment data. Her posture is pulled back slightly, expression is startled and urgent.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions — not chibi, not photoreal. Clean white background. Full bust portrait, centered composition, 1024x1024. Painterly rendering with visible brush texture. Character design must match the same Vera: purple robes, silver celestial trim, silver-streaked dark hair, crystal orb.
```

---

### Reed — News Analyst (Scroll / Herald)
**Palette:** Russet-red, gold herald's trim, chainmail
**Emblem:** Parchment scroll, scroll case
**Character:** Male, quick-witted messenger, short reddish-auburn hair, sharp alert eyes

**idle prompt:**
```
A graphic-novel painterly illustration of Reed, a male medieval council herald. He is the News analyst — a quick-witted messenger with sharp alert eyes and short reddish-auburn hair. He wears a russet-red tabard over chainmail with gold herald's trim, a scroll case slung over his shoulder, one hand holding an unfurled parchment scroll covered in market headlines. His expression is keen and watchful — IDLE, scanning the room, ready to report.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions — not chibi, not photoreal. Clean white background. Full bust portrait, centered composition, 1024x1024. Painterly rendering with visible brush texture.
```

**speaking prompt:**
```
A graphic-novel painterly illustration of Reed, a male medieval council herald. He is the News analyst — quick-witted messenger with sharp alert eyes and short reddish-auburn hair. Russet-red tabard with gold herald's trim, scroll case on shoulder. He is SPEAKING urgently — mouth open, one arm raised high holding a parchment scroll aloft, the other hand pointing outward as he delivers breaking market news. His expression is intense and animated, leaning forward with urgency.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting. Semi-realistic cartoon face with graphic-novel proportions. Clean white background. Full bust portrait, centered composition, 1024x1024. Match same character: russet-red tabard, gold trim, reddish-auburn hair, scroll.
```

**reacting prompt:**
```
A graphic-novel painterly illustration of Reed, a male medieval council herald. He is the News analyst — quick-witted messenger with sharp alert eyes and short reddish-auburn hair. Russet-red tabard with gold herald's trim, scroll case on shoulder. He is REACTING with disbelief — eyes wide, mouth agape, both hands gripping the edges of an unfurled scroll as if he just read shocking market news. His posture is frozen, stunned by what the scroll reveals.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting. Semi-realistic cartoon face with graphic-novel proportions. Clean white background. Full bust portrait, centered composition, 1024x1024. Match same character: russet-red tabard, gold trim, reddish-auburn hair, scroll.
```

---

### Sage — Fundamentals Analyst (Ledger / Chart)
**Palette:** Deep forest-green, gold embroidered numbers/charts
**Emblem:** Leather-bound ledger, quill pen
**Character:** Male, elderly scholar, bald with white beard, wire-rimmed spectacles

**idle prompt:**
```
A graphic-novel painterly illustration of Sage, an elderly male medieval council scholar. He is the Fundamentals analyst — a wise, meticulous keeper of ledgers and charts. Bald with a white beard, wire-rimmed spectacles, wearing deep forest-green academic robes with gold embroidered numbers and charts. He holds a heavy leather-bound ledger book open in one hand, a quill pen tucked behind his ear. His expression is calm and studious — IDLE, poring over his ledger, calculating quietly.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions — not chibi, not photoreal. Clean white background. Full bust portrait, centered composition, 1024x1024. Painterly rendering with visible brush texture.
```

**speaking prompt:**
```
A graphic-novel painterly illustration of Sage, an elderly male medieval council scholar. Bald with white beard, wire-rimmed spectacles, deep forest-green academic robes with gold embroidered numbers. He is SPEAKING — looking up from his ledger, one hand raised with index finger pointing upward as if making a precise fundamental point, the other hand holding the ledger open. His mouth is open mid-lecture, expression is scholarly and firm.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with cinematic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: bald, white beard, spectacles, forest-green robes, ledger.
```

**reacting prompt:**
```
A graphic-novel painterly illustration of Sage, an elderly male medieval council scholar. Bald with white beard, wire-rimmed spectacles, deep forest-green academic robes with gold embroidered numbers. He is REACTING with alarm — eyebrows shot up above his spectacles, mouth open in protest, clutching his ledger tightly to his chest as if someone just questioned his fundamental analysis. His posture is defensive, expression is offended and incredulous.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with cinematic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: bald, white beard, spectacles, forest-green robes, ledger.
```

---

### Balthazar — Investment Bull Debater (Scales)
**Palette:** Burgundy, gold merchant robes, brass scales
**Emblem:** Brass balance scales
**Character:** Male, broad-shouldered, aggressive, thick neck, strong jaw, cropped brown hair

**idle prompt:**
```
A graphic-novel painterly illustration of Balthazar, a male medieval council debater. He is the Investment Bull — a bullish, broad-shouldered, aggressive debater with a thick neck, strong jaw, cropped brown hair and a confident smirk. He wears burgundy and gold merchant robes with brass scales embroidered on the chest. He holds a set of brass balance scales in one hand, the other hand resting on his hip. His expression is confident and smug — IDLE, surveying the council with bullish certainty.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions. Clean white background. Full bust portrait, centered composition, 1024x1024. Painterly rendering with visible brush texture.
```

**speaking prompt:**
```
A graphic-novel painterly illustration of Balthazar, a male medieval council debater. He is the Investment Bull — broad-shouldered, aggressive, thick neck, strong jaw, cropped brown hair. Burgundy and gold merchant robes with brass scale emblem. He is SPEAKING passionately — mouth open in a bullish roar, one fist pounding the table, the other hand thrusting his brass scales forward as he argues for investment. His expression is fierce and commanding, veins visible on his neck.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: broad-shouldered, cropped brown hair, burgundy/gold robes, brass scales.
```

**reacting prompt:**
```
A graphic-novel painterly illustration of Balthazar, a male medieval council debater. He is the Investment Bull — broad-shouldered, aggressive, thick neck, strong jaw, cropped brown hair. Burgundy and gold merchant robes. He is REACTING with outrage — eyes bulging, mouth open in a furious objection, both fists clenched on the table, brass scales tipping wildly to one side. He looks like he was just contradicted by the Bear debater and is about to explode. His expression is red-faced fury.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: broad-shouldered, cropped brown hair, burgundy/gold robes, brass scales.
```

---

### Morwen — Risk Bear Debater (Shield)
**Palette:** Dark grey, iron-blue armored robes
**Emblem:** Battered iron shield, risk ledgers
**Character:** Female, sharp cynical pessimist, angular features, narrow suspicious eyes, steel-grey hair in severe bun

**idle prompt:**
```
A graphic-novel painterly illustration of Morwen, a female medieval council debater. She is the Risk Bear — a sharp, cynical pessimist with angular features, narrow suspicious eyes, and steel-grey hair pulled into a severe bun. She wears dark grey and iron-blue armored robes with a shield emblem on the shoulder. She holds a battered iron shield in one hand, the other hand resting on a heavy tome of risk ledgers. Her expression is cold and skeptical — IDLE, arms crossed, unimpressed by the bullish arguments around her.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions. Clean white background. Full bust portrait, centered composition, 1024x1024.
```

**speaking prompt:**
```
A graphic-novel painterly illustration of Morwen, a female medieval council debater. She is the Risk Bear — sharp cynical pessimist, angular features, narrow suspicious eyes, steel-grey hair in severe bun. Dark grey and iron-blue armored robes with shield emblem. She is SPEAKING with cold precision — mouth open in a cutting rebuttal, one hand raised palm-down as if dismissing the bull's argument, the other holding her iron shield forward like a barrier. Her expression is icy and contemptuous.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: angular features, steel-grey bun, dark grey/iron-blue robes, iron shield.
```

**reacting prompt:**
```
A graphic-novel painterly illustration of Morwen, a female medieval council debater. She is the Risk Bear — sharp cynical pessimist, angular features, narrow suspicious eyes, steel-grey hair in severe bun. Dark grey and iron-blue armored robes with shield emblem. She is REACTING with dark satisfaction — a thin, knowing smirk crossing her angular face, one eyebrow arched, arms folded, iron shield planted beside her. She looks vindicated, as if the market just proved her bearish warnings correct. Her expression is smug and grimly triumphant.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character.
```

---

### Kael — Trader (Runner)
**Palette:** Leather brown, blue linen, runner's sash
**Emblem:** Dispatch tube, satchel
**Character:** Male, young, lean energetic courier, windswept dark hair, quick darting eyes

**idle prompt:**
```
A graphic-novel painterly illustration of Kael, a young male medieval council runner. He is the Trader — a lean, energetic courier with quick darting eyes, windswept dark hair, and a restless posture. He wears practical leather and blue linen trader's gear with a runner's sash, a satchel of trade dispatches slung across his chest. He holds a rolled dispatch tube in one hand. His expression is alert and ready — IDLE, bouncing slightly on his heels, ready to sprint orders to the exchange floor.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions. Clean white background. Full bust portrait, centered composition, 1024x1024.
```

**speaking prompt:**
```
A graphic-novel painterly illustration of Kael, a young male medieval council runner. He is the Trader — lean energetic courier, windswept dark hair, quick darting eyes. Leather and blue linen trader's gear with runner's sash, satchel across chest, dispatch tube in hand. He is SPEAKING breathlessly — mouth open mid-report, one hand gripping his dispatch tube high while the other gestures rapidly, as if he just sprinted back with urgent trade data. His expression is excited and winded, sweat on his brow.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: windswept dark hair, leather/blue linen, runner's sash, dispatch tube.
```

**reacting prompt:**
```
A graphic-novel painterly illustration of Kael, a young male medieval council runner. He is the Trader — lean energetic courier, windswept dark hair, quick darting eyes. Leather and blue linen trader's gear with runner's sash, satchel across chest. He is REACTING with panic — eyes wide with alarm, mouth open in an urgent shout, both hands clutching multiple dispatch tubes as if contradictory orders just arrived simultaneously. His posture is frantic, looking back over his shoulder as if more runners are coming.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character.
```

---

### Elder Aldric — Judge (Crown)
**Palette:** Royal blue, gold judicial robes, ornate crown
**Emblem:** Ceremonial gavel, law tome
**Character:** Male, venerable elder, long silver beard, weathered noble face, deep-set wise eyes

**idle prompt:**
```
A graphic-novel painterly illustration of Elder Aldric, an elderly male medieval council judge. He is the Judge — a venerable, wise authority with a long silver beard, weathered noble face, deep-set eyes that have seen decades of markets. He wears flowing royal blue and gold judicial robes with an ornate crown resting on his head. He holds a ceremonial gavel in one hand, the other hand resting on a massive law tome. His expression is serene and grave — IDLE, presiding over the council with quiet authority and patience.

Style: bold confident ink linework with consistent weight, cross-hatching and ben-day dot halftone shading for volume, soft cel shading with dramatic cinematic side-lighting, rich saturated colors grounded in a medieval palette. Semi-realistic cartoon face with graphic-novel proportions. Clean white background. Full bust portrait, centered composition, 1024x1024.
```

**speaking prompt (generated via xAI/grok-imagine-image fallback, 2026-06-02):**
```
A graphic-novel painterly illustration of Elder Aldric, an elderly male medieval council judge. He is the Judge — venerable authority, long silver beard, weathered noble face, deep-set wise eyes. Royal blue and gold judicial robes, ornate crown, ceremonial gavel, massive law tome. He is SPEAKING — rising from his seat, gavel raised high, mouth open delivering the verdict with booming authority. His expression is commanding and final, the crown catching the light, robes sweeping dramatically.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: silver beard, royal blue/gold robes, crown, gavel.
```

**reacting prompt (generated via xAI/grok-imagine-image fallback, 2026-06-02):**
```
A graphic-novel painterly illustration of Elder Aldric, an elderly male medieval council judge. He is the Judge — venerable authority, long silver beard, weathered noble face, deep-set wise eyes. Royal blue and gold judicial robes, ornate crown, ceremonial gavel. He is REACTING with grave concern — brow furrowed deeply, one hand stroking his beard, the other gripping his gavel tightly. His expression shows the weight of a difficult judgment, troubled by the conflicting arguments before him.

Style: bold confident ink linework, cross-hatching and ben-day dot halftone shading, soft cel shading with dramatic side-lighting. Semi-realistic cartoon face, graphic-novel proportions. Clean white background. Full bust portrait, 1024x1024. Match same character: silver beard, royal blue/gold robes, crown, gavel.
```

---

## File Naming Convention
```
design/comic-cast/<name>-{idle,speaking,reacting}.png
```
Lowercase names. Flint frames keep their legacy names: flint-1-idle.png, flint-2-speaking.png, flint-3-reacting.png.

## Progress Status
| Character | idle | speaking | reacting |
|-----------|------|----------|----------|
| Flint | ✓ | ✓ | ✓ |
| Vera | ✓ | ✓ | ✓ |
| Reed | ✓ | ✓ | ✓ |
| Sage | ✓ | ✓ | ✓ |
| Balthazar | ✓ | ✓ | ✓ |
| Morwen | ✓ | ✓ | ✓ |
| Kael | ✓ | ✓ | ✓ |
| Aldric | ✓ | ✓ | ✓ |

**24/24 frames complete.** Aldric speaking + reacting generated via xAI/grok-imagine-image fallback (openai-codex OAuth was non-functional; xAI was the only working backend). Style note: xAI renders smoother/digital vs. gpt-image-2-medium's etched cross-hatching; Aldric's book reads "Codex of Verdicts" (vs "LEX CIVITAS" in the idle frame). Provider: xai, model: grok-imagine-image, resolution: 1024x1024, background: clean white.
