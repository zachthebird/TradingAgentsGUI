# Live-tier UI spec — "PC-98 Trading Terminal" (v1)

Zach's verdict (2026-07-02): the Game Boy ADV UI **suffices for the free demo but NOT the actual version**. The live app must be rebuilt around a retro **PC-98 / 90s-VGA trading-terminal aesthetic** (reference: anime-advisor stock-game screenshot — advisor "AMY" at left presenting a dialog box, CRT scanlines, market charts behind, bottom menu bar Exchange/Profile/Facilities/Advisor).

## The three failures to fix (live runs, localhost:8000)
1. **No working-state feedback.** After summon there's only a tiny status pill; real runs have multi-minute silent stretches (heartbeats only). No phase indicator, no progress, no "which agent is thinking now", no ETA. The landing state is unclear/not obvious.
2. **Agent outputs are buried.** Full reports exist (`/reports` + Chronicles carousel) but are below the fold, disconnected from the run. Requirement: **every individual agent's full output + the final summary must be first-class, readable in-run.**
3. **Clunky/unfunctional chrome.** Two ticker inputs, stale verdict banner from prior runs, old React sections mixed under the overlay.

## Design direction (from the reference)
- **Advisor-presents pattern:** each pipeline phase = the agent's portrait (left third) presenting a dialog window with their ACTUAL output — scrollable full text, not 220-char snippets. Buttons like [Read full scroll] [Continue].
- **Persistent pipeline HUD:** bottom menu-bar/status row with the real stages — ANALYSTS → DEBATE → TRADER → RISK → VERDICT — lighting as SSE events arrive; active agent name + elapsed timer + heartbeat blinker so it's ALWAYS clear it's working.
- **Market chart backdrop:** the actual ticker's price chart rendered behind the dialog (CRT-styled), like the reference.
- **Final summary screen:** PM's verbatim ruling + per-agent report index (tabbed windows), exportable.
- **Palette:** VGA/PC-98 cyan-magenta-cream on dark, scanlines; richer than DMG green. Portraits: keep painterly cast initially (CRT-framed); optional later pass = anime-style regeneration via image_gen (style anchor = reference image).

## Scope boundaries
- This is the **live tier's** UI (localhost:8000 / future passcode deploy). The Game Boy demo stays as-is for the free public tier.
- Keep the SSE wiring + seat map fixed in commit dfaa5fa (bull→Balthazar, bear→Morwen, risk trio, verbatim verdicts). Build view-layer only; new file(s) alongside castle-council.js (e.g. terminal-live.js) with a toggle, don't destroy the ADV view.
- Verify by RENDERING (Chrome), with a synthetic-SSE injection pass AND one real run.
