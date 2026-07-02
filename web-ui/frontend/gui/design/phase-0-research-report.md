# Phase 0: LongCat-Video-Avatar-1.5 Feasibility Research Report

**Date:** 2026-06-02
**Researcher:** web-dev-researcher
**Status:** Complete
**Task:** t_b92fa88d

---

## Table of Contents
1. [Hosting Comparison](#1-hosting-comparison)
2. [TTS Selection](#2-tts-selection)
3. [Portrait Compatibility Assessment](#3-portrait-compatibility-assessment)
4. [Pipeline Design](#4-pipeline-design)
5. [Cost & Latency Estimates](#5-cost--latency-estimates)
6. [Go/No-Go Recommendation](#6-gono-go-recommendation)

---

## 1. Hosting Comparison

### Platform Summary Table

| Criterion | RunPod (Serverless) | Modal | Replicate | HF Inference Endpoints |
|---|---|---|---|---|
| **LongCat-Avatar deployed?** | No — must self-deploy via Docker | No — must build Modal app | **Partially** — `lucataco/longcat-video` is base T2V model only, NOT the Avatar 1.5 audio-driven variant | No — custom container required |
| **A100 80GB pricing** | ~$2.17/hr | $2.50/hr ($0.000694/sec) | N/A (per-prediction pricing, varies) | $2.50/hr (1× A100) |
| **H100 pricing** | ~$4.47/hr | $3.95/hr ($0.001097/sec) | N/A | Not listed public |
| **Cold-start latency** | ~500ms–2s (FlashBoot) | 30–120s (model download on cold container) | ~5–15s (container warm) | 2–5 min (provisioning + model load) |
| **Per-clip cost (est.)** | ~$1.50–3.00 | ~$2.00–4.00 | ~$2.50–5.00 | ~$2.50–5.00 |
| **Integration** | Docker container + HTTP endpoint | Python decorators, `@app.function()` | REST API (Cog model) | REST API (custom handler) |
| **Min GPU for model** | 2× A100 (80GB) or 1× H100 (multi-GPU supported) | Same | Same (if deployed with Cog) | Same |
| **Best for** | Lowest cost, fastest cold start | Best DX, Python-native | Easiest if model already deployed | Managed infra, HF ecosystem |

### Detailed Analysis

#### RunPod — ★ RECOMMENDED for Phase 1 PoC

RunPod offers the cheapest A100/H100 pricing and the fastest cold starts via FlashBoot technology (as low as 500ms). For LongCat-Video-Avatar-1.5, you'd deploy a custom Docker container with the model baked in. RunPod's serverless GPU pods auto-scale to zero — you only pay during active inference.

- **Pros:** Cheapest A100 ($1.19–2.17/hr depending on spot/dedicated), fastest cold start, flexible Docker deployment, per-second billing
- **Cons:** Must build and maintain Docker image yourself, no managed model registry, less polished DX than Modal
- **Setup effort:** Medium (Docker build + model download + endpoint config)
- **GPU requirement:** A100 80GB (minimum). H100 recommended for faster inference. Model uses INT8 quantization to reduce VRAM requirements. Multi-GPU (2× A100) is the recommended setup from the model card.

#### Modal

Modal has the best developer experience — write Python functions with decorators, and Modal handles containerization, scaling, and GPU scheduling. The pricing is competitive but slightly higher than RunPod.

- **Pros:** Python-native DX, `modal serve` for quick iteration, built-in secrets management, excellent cold-start handling for cached images
- **Cons:** Higher per-second cost than RunPod, model download time on first cold start (~30–120s for 13.6B param model), steeper learning curve for GPU memory tuning
- **Setup effort:** Medium (Modal app + Dockerfile + volume for model weights)

#### Replicate

Replicate has the base `lucataco/longcat-video` model deployed — but this is the **text-to-video foundation model**, NOT the audio-driven Avatar 1.5 variant. The Avatar model requires audio input, Whisper encoder, and the specific avatar pipeline which is not available on the deployed model. You'd need to build and deploy a Cog model yourself.

- **Pros:** Managed API, no infra to maintain, great for prototyping
- **Cons:** Avatar 1.5 NOT available (only base T2V model), Cog deployment is extra work, per-prediction pricing less predictable than per-second, cold starts for large models
- **Setup effort:** High (Cog model build + Replicate deploy)

#### Hugging Face Inference Endpoints

HF Endpoints allow custom model deployment but require a full container build. Pricing is competitive at $2.50/hr for 1× A100, but cold starts are slow (2–5 min for model provisioning) and you still pay for idle time.

- **Pros:** HF ecosystem integration, managed infrastructure, straightforward model download from HF Hub
- **Cons:** Slow cold starts, pay for idle time (not true serverless), need custom handler code
- **Setup effort:** High (custom Docker + endpoint config + handler)

### Hosting Recommendation

**RunPod Serverless** for Phase 1 PoC. Cheapest A100 pricing, fastest cold starts, and Docker-based deployment makes it the most cost-effective for infrequent, bursty inference (one video at a time). If developer experience is more important than $1–2/clip savings, **Modal** is the close second choice.

---

## 2. TTS Selection

### Comparison Table

| Engine | Quality | Voice Variety | 8 Distinct Voices? | Latency (200 chars) | Cost | Deployment |
|---|---|---|---|---|---|---|
| **Edge TTS** ★ | Good (neural) | 300+ voices, 50+ English | **Yes** — many distinct English voices | ~1–3s | **FREE** | Local (macOS, Linux, Windows) |
| **ElevenLabs** | Excellent | Custom voice cloning | **Yes** — 8 cloned voices | ~2–4s (API) | $0.05–0.10/1K chars (Flash), $0.24/1K chars (Pro) | Cloud API |
| **OpenAI TTS** | Very good | 6 built-in voices | **No** — only 6 voices, limited distinctiveness | ~2–4s (API) | $0.015/1K chars (standard), $0.030/1K chars (HD) | Cloud API |
| **Coqui TTS** | Good | 100+ community models | **Maybe** — depends on available models | ~5–15s (local, Mac M-series) | FREE | Local (runs on Mac M1/M2 with setup) |
| **Bark (Suno)** | Decent | Voice prompts (not cloning) | **Partial** — voice presets, less controllable | ~30–60s (local) | FREE | Local (slow on Mac) |

### Detailed Analysis

#### Edge TTS — ★ RECOMMENDED for Phase 1 PoC

`edge-tts` is a Python library that uses Microsoft Edge's free neural TTS service. It has 300+ voices across languages with ~50+ English variants (male, female, regional accents). Quality is neural-grade — close to commercial TTS — and the API is dead simple.

- **For the Round Table:** With 50+ English voices, 8 distinct personas is achievable. You'd assign different voice presets per character (e.g., `en-US-ChristopherNeural` for Aldric, `en-GB-RyanNeural` for another, etc.)
- **Cost:** $0.00 — completely free, no rate limits documented for reasonable use
- **Risk:** Microsoft could change the endpoint or throttle; it's using an unofficial API. For a PoC, this is negligible. For production, have ElevenLabs as fallback.
- **CLI:** `edge-tts --voice en-US-ChristopherNeural --text "The council has reached a verdict." --write-media output.mp3`

#### ElevenLabs — ★ RECOMMENDED for Production

Best quality in the industry. Voice cloning lets you create 8 truly distinct personas. Instant Voice Cloning available on all paid plans. Pro plan at $0.24/1K chars with the scale plan at $0.18/1K chars.

- **Pros:** Best quality, voice cloning gives genuinely distinct voices, consistent output
- **Cons:** Paid (though cheap at scale), API dependency, cloning requires 1-min audio samples per persona
- **Cost per debate:** ~$0.50–2.00 (assuming 2,000–10,000 total characters across all lines)

#### OpenAI TTS

Good quality but only 6 built-in voices — not enough for 8 distinct council members. The new `gpt-4o-mini-tts` model is more expressive but still has limited voice variety.

- **Verdict:** Not suitable — can't get 8 distinct voices without voice cloning (not supported)

#### Coqui TTS

Open-source, runs locally. Can work on Mac M-series with some setup (Conda, Python 3.9–3.10). Has many community voice models. XTTS model supports voice cloning with 6 seconds of reference audio.

- **Pros:** Free, local, voice cloning, no API dependency
- **Cons:** Setup friction on Mac (Conda required, Python version constraints), slower inference than APIs, quality varies between models

#### Bark (Suno)

Transformer-based text-to-audio. Good for creative/non-speech audio but SLOW — 30–60 seconds per sentence on consumer hardware.

- **Verdict:** Not practical for batch TTS. Too slow.

### TTS Recommendation

**Phase 1 PoC: Edge TTS** — free, 300+ voices, 8 distinct English voices available, runs anywhere, no API keys needed. The quality is surprisingly good for a free service.

**Production: ElevenLabs** — voice cloning for truly distinct personas, highest quality, predictable per-character pricing. The cost per debate (~$0.50–2.00) is negligible for the UX improvement.

---

## 3. Portrait Compatibility Assessment

### The Round Table Art Style

The project uses `castle-portraits.svg`, a single SVG sprite sheet with 8 stylized character symbols:

| ID | Persona | Skin Tone | Background | Defining Features |
|---|---|---|---|---|
| `portrait-market` | Market Analyst | Warm (skin gradient) | Court blue | Chart symbols, gold monocle |
| `portrait-social` | Social/Media | Pale | Violet | Starfield, silver medallion |
| `portrait-news` | News Reader | Warm | Emerald | Newspaper, scroll |
| `portrait-fundamentals` | Fundamentals | Warm | Sand | Glasses, ledger lines |
| `portrait-debater` | Debater | Dark | Crimson | Hooded cloak, intense stare |
| `portrait-risk` | Risk Manager | Warm | Steel | Helmet, shield, stern expression |
| `portrait-trader` | Trader | Warm | Ash | Mask/bandana, sharp eyes |
| `portrait-judge` | Judge/Elder Aldric | Warm | Gold | Crown/coronet, ermine collar |

**Style characteristics:** Flat vector geometry, radial/linear gradients, geometric facial features (ellipse eyes, path eyebrows, circle pupils), no texture maps, no realistic shading. These are graphic-novel/comic-book style illustrations, NOT photorealistic.

### LongCat-Video-Avatar-1.5 Stylized Support: THE EVIDENCE

**Finding: LongCat explicitly and repeatedly claims support for stylized/non-photorealistic inputs.** This is not speculative — it's documented across multiple official sources:

1. **Hugging Face Model Card** (official, verbatim):
   > "🌟 **Stylized Domain Generalization**: Robustly generalizes to anime, animals, and complex real-world conditions such as multi-person interactions and object handling."

2. **arXiv Technical Report** (section 1, Introduction):
   > "Through rigorous data curation and RLHF Training, the model readily generalizes to stylized domains such as anime and animals..."

3. **Project Page** (`meigen-ai.github.io`) — dedicated "Animation" section:
   > "Animation examples with expressive motion, stylized characters, and stable audio-driven performance."

4. **Evaluation Benchmark:** Includes "2 visual styles (Realistic/Animated)" — meaning they explicitly test on animated/non-photorealistic inputs.

5. **Medium Article** (community summary):
   > "The model can generate: ... Stylized animated characters, Animal and anime avatars"

6. **Commercial comparison on project page:** Shows "3D Animation" comparison against HeyGen, Kling Avatar 2.0, and OmniHuman-1.5 — all competitors, tested on 3D animated content specifically.

### What This Means for Our Portraits

The model has been **trained and evaluated on animated/stylized inputs**. Our SVG comic-book portraits fall squarely into the "stylized/animated" category that LongCat claims to support. The evidence is strong enough that a Midjourney/DALL-E photorealistic intermediary step is **almost certainly not needed**.

### Caveats & Risks

1. **Rasterization required:** The portraits are SVG vectors. LongCat expects raster images (PNG/JPEG). The SVG must be rasterized at appropriate resolution (at least 480×480 for 480p, 720×720 for 720p) before feeding to the model.

2. **SVG simplicity:** Our portraits are very simple — flat colors, basic shapes, no texture. If the model was trained on more detailed anime/3D animated characters, the output may be less expressive than expected. The model needs enough visual information to track facial regions.

3. **No community examples of SVG-to-video:** While the model supports stylized/anime, I found no community examples using flat vector art SVG as input. Most "anime" examples appear to be cel-shaded 3D or 2D anime with more detail than our portraits.

4. **The model's output will be a video of an animated character:** Our portraits are static SVG. LongCat will add motion — lip sync, head movement, expressions. The output will be a video, not an SVG animation. This means the "comic-book look" may shift slightly as the diffusion model interprets the flat art style.

5. **Reference image indexing matters:** The model card mentions `--ref_img_index` parameter (default 10) — setting this between 0–24 ensures better consistency; 30 helps avoid repeated actions. For our stylized portraits, this may need tuning.

### Verdict

**The stylized SVG portraits CAN be used as-is with LongCat-Video-Avatar-1.5.** The model explicitly supports animated/stylized domains, and our comic-book art style fits that category. No Midjourney/DALL-E photorealistic intermediary step is needed. 

**Confidence: MEDIUM-HIGH (75%)** — The documentation is explicit, but I couldn't find real-world examples using flat SVG vector art specifically. The main risk is that our portraits are simpler than the anime/stylized examples in the model's training data, potentially resulting in less expressive output.

**Required pre-processing:** Rasterize SVG to PNG at 720×720 (for 720p output) before feeding to LongCat.

---

## 4. Pipeline Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEBATE → VIDEO PIPELINE                                │
│                                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────┐           │
│  │  DEBATE   │    │   TTS    │    │   LONGCAT    │    │  STORAGE  │           │
│  │  ENGINE   │───▶│  (Edge   │───▶│  AVATAR 1.5  │───▶│  (Vercel  │           │
│  │ (existing)│    │   TTS)   │    │  (RunPod GPU)│    │   Blob)   │           │
│  └──────────┘    └──────────┘    └──────────────┘    └─────┬─────┘           │
│       │               │                  │                   │                │
│       │          Local Mac         Cloud GPU             CDN edge            │
│       │          (free)           (~$2.17/hr)           (Vercel)             │
│       │               │                  │                   │                │
│       ▼               ▼                  ▼                   ▼                │
│  Character      WAV audio         MP4 video            Public URL             │
│  text lines     per persona       avatar clip          cached forever         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER PLAYBACK                                      │
│                                                                               │
│   Debate UI (SSE)  ──▶  Verdict card appears  ──▶  "Watch Verdict" button    │
│                                                          │                   │
│                                                          ▼                   │
│                                              <video> element (HTML5)          │
│                                              autoplay in modal overlay        │
│                                              src = Vercel Blob CDN URL        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stage-by-Stage Breakdown

#### Stage 0: Trigger

**When does rendering happen?** Two strategies:

1. **On-demand (recommended for PoC):** After the debate SSE stream completes and the final verdict is rendered as text, the frontend sends a POST to a lightweight API endpoint (or directly to the render service) with the verdict text + persona ID. The video renders offline and a webhook/poll updates the UI when ready.

2. **Pre-rendered (stretch goal):** Pre-render common verdict phrases ("The council votes to BUY", "The council votes to SELL", "The council is divided") for the Judge persona. These play instantly with zero latency. Only custom/nuanced verdicts trigger on-demand rendering.

**PoC implementation:** Strategy 1 (on-demand). Render one clip per debate for the Judge persona delivering the final verdict. This minimizes cloud GPU cost while validating the pipeline.

#### Stage 1: TTS (Local Mac)

```bash
# Per persona line, generate WAV audio
edge-tts \
  --voice en-US-ChristopherNeural \
  --text "After careful deliberation, the Round Table council votes to BUY." \
  --write-media verdict_judge.wav
```

- **Where:** Zach's Mac (local), or a lightweight serverless function
- **Output:** 16kHz/24kHz WAV audio file (2–10 seconds depending on text length)
- **Latency:** 1–3 seconds per line
- **Cost:** $0.00

For 8 distinct voices, pre-configure a voice mapping:
```
portrait-market      → en-US-EricNeural (male, confident)
portrait-social      → en-US-AriaNeural (female, expressive)
portrait-news        → en-GB-RyanNeural (male, measured)
portrait-fundamentals → en-US-GuyNeural (male, analytical)
portrait-debater     → en-US-DavisNeural (male, intense)
portrait-risk        → en-US-SteffanNeural (male, cautious)
portrait-trader      → en-US-JasonNeural (male, sharp)
portrait-judge       → en-US-ChristopherNeural (male, authoritative)
```

#### Stage 2: LongCat Avatar Render (Cloud GPU — RunPod)

**Inputs:**
- Reference image: Rasterized PNG of the persona's SVG portrait (720×720)
- Audio: WAV file from Stage 1
- Prompt: Description of the character/scene (e.g., "A wise elder judge in a dark fantasy council chamber, delivering a solemn verdict, animated graphic novel style")

**Environment:**
- Docker container with LongCat-Video cloned + model weights downloaded
- CUDA 12.4, torch 2.6.0, flash-attn 2.7.4, Python 3.10
- INT8 quantization for reduced VRAM

**RunPod Serverless configuration:**
- GPU: A100 80GB (1× or 2× depending on INT8 memory requirements)
- Container image: Custom Docker with model weights pre-baked (~30GB)
- FlashBoot enabled for sub-second cold starts
- Scale to zero when idle

**Inference command (approximate):**
```bash
python run_demo_avatar_multi_audio_to_video.py \
  --image portrait_judge.png \
  --audio verdict_judge.wav \
  --output verdict_video.mp4 \
  --resolution 720p \
  --num_inference_steps 8 \
  --ref_img_index 10
```

**Output:** MP4 video, 720p @ 24fps, duration matching audio length

#### Stage 3: Storage & CDN

- **Store:** Vercel Blob (already in the Vercel ecosystem since the frontend is likely Next.js on Vercel)
- **Alternative:** S3 + CloudFront, or upload directly to the frontend's `/public/videos/`
- **Cache strategy:** Video filenames include a content hash (SHA256 of text + persona). Same text → same video → served from cache, no re-render.
- **Retention:** Keep all rendered clips indefinitely (storage is cheap — ~$0.02/GB/month on Vercel Blob)

#### Stage 4: Browser Playback

The debate UI already renders verdict text via SSE. The enhancement:

```html
<!-- After verdict text appears in the debate feed -->
<div class="verdict-card">
  <p>The council has reached a verdict...</p>
  <button class="cinematic-btn" onclick="playVerdict()">
    ▶ Watch Cinematic Verdict
  </button>
</div>

<!-- Modal overlay -->
<dialog id="verdict-modal">
  <video 
    src="https://blob.vercel/cinematic/verdict_a1b2c3.mp4"
    autoplay
    playsinline
    controls
  ></video>
  <button onclick="closeVerdict()">Close</button>
</dialog>
```

**UX flow:**
1. Debate completes → verdict text renders in debate feed (existing behavior)
2. "Watch Cinematic Verdict" button appears below verdict card (new)
3. User clicks → modal overlay with `<video>` element opens
4. Video autoplays (muted autoplay or with user-gesture-triggered unmuted autoplay)
5. User can dismiss modal, video stops

**Fallback:** If video isn't ready yet (still rendering on RunPod), show a loading spinner with "Rendering your verdict..." and poll until the Vercel Blob URL returns 200.

### Complete Pipeline Flow (Sequence)

```
[Debate Completes]
       │
       ▼
[Frontend extracts Verdict text + Judge persona]
       │
       ├──▶ [POST /api/render-verdict]  (Next.js API route or standalone service)
       │         │
       │         ▼
       │    [TTS: edge-tts generates WAV]  (1-3s, local Mac or serverless)
       │         │
       │         ▼
       │    [Rasterize SVG portrait → PNG]  (instant, sharp/libvips)
       │         │
       │         ▼
       │    [LongCat: RunPod GPU renders MP4]  (est. 2-5 min for 5-10s clip)
       │         │
       │         ▼
       │    [Upload MP4 to Vercel Blob]  (5-10s)
       │         │
       │         ▼
       │    [Webhook → Frontend: video ready]  (or poll every 5s)
       │
       ▼
[Frontend shows "Watch Verdict" button]
       │
       ▼
[User clicks → modal video plays from CDN]
```

---

## 5. Cost & Latency Estimates

### Per-Clip Cost Breakdown

**Assumptions:**
- Clip: 5–10 seconds of video (typical verdict length)
- Resolution: 720p @ 24fps (120–240 frames)
- GPU: A100 80GB (1×) on RunPod Serverless
- 8-step DMD2 distilled inference (model default)
- INT8 quantization

#### TTS Cost

| Engine | Per 200-char line | Per debate (20 lines) | Per verdict (500 chars) |
|---|---|---|---|
| **Edge TTS** | $0.00 | $0.00 | $0.00 |
| ElevenLabs (Flash) | $0.01 | $0.20 | $0.025 |
| ElevenLabs (Pro) | $0.048 | $0.96 | $0.12 |
| OpenAI TTS (standard) | $0.003 | $0.06 | $0.0075 |

**PoC: $0.00/clip** (Edge TTS)

#### LongCat GPU Cost (RunPod A100 80GB, $2.17/hr)

Inference time estimate for 5-second clip (120 frames):

| Scenario | Estimated Time | Cost |
|---|---|---|
| Optimistic (warm GPU, INT8, 8-step) | 2 min | $0.07 |
| Realistic (warm GPU, INT8, 8-step) | 4 min | $0.14 |
| Conservative (cold GPU, model load) | 8 min | $0.29 |

**My estimate: ~$0.15 per 5-second clip** (realistic scenario, warm GPU)

For a 10-second clip (240 frames):
- Realistic: 6–8 min → ~$0.25–0.35

#### Storage Cost
- Vercel Blob: $0.30/GB stored, $0.01/GB delivered (first 1TB free)
- One 5-second 720p MP4: ~2–5MB
- **Negligible** at PoC scale (< $0.01/month)

#### Total Per-Clip (Phase 1 PoC)

| Component | Cost |
|---|---|
| TTS (Edge TTS) | $0.00 |
| LongCat GPU (RunPod A100) | ~$0.15 |
| Storage (Vercel Blob) | ~$0.00 |
| **Total per 5s clip** | **~$0.15** |
| **Total per 10s clip** | **~$0.30** |

### Latency (End-to-End)

| Stage | Time |
|---|---|
| TTS (Edge TTS, 500 chars) | 1–3s |
| SVG rasterization | < 1s |
| LongCat render (A100, 120 frames) | 3–5 min |
| Upload to Vercel Blob | 5–10s |
| CDN propagation | < 1s |
| **Total (user wait)** | **~4–6 minutes** |

### Phase Scaling

| Phase | Clips | Cost | Notes |
|---|---|---|---|
| **Phase 1 PoC** (1 Judge verdict per debate) | 1 clip/use | ~$0.15/use | ~$5–15/month at 30–100 debates/month |
| **Phase 2** (all 8 personas, occasional clips) | 1–8 clips/use | ~$0.30–2.40/use | ~$15–50/month |
| **Phase 3** (every line, every debate) | 20–50 clips/use | ~$3.00–15.00/use | ~$100–500/month — consider caching + pre-rendering |

### Cost Viability

- **Phase 1 PoC:** Viable. $0.15/clip, $5–15/month at realistic usage. Edge TTS keeps TTS cost at $0.
- **Phase 2:** Viable but needs caching. Same verdict text = same video = cached. Cost dominated by unique verdicts.
- **Phase 3:** Needs pre-rendering strategy. Rendering EVERY line for EVERY debate would be expensive. But that's not the use case — the cinematic video enhancement is for key moments (verdicts, dramatic reveals), not every speech bubble.

---

## 6. Go/No-Go Recommendation

### Go/No-Go Decision: **GO** (Medium-High Confidence, 75%)

LongCat-Video-Avatar-1.5 is a strong fit for the Round Table project. The model explicitly supports stylized/animated character inputs — our comic-book SVG portraits fall squarely into the "animated" style that LongCat's evaluation benchmark tests. The costs are manageable: ~$0.15 per 5-second clip on RunPod A100, with Edge TTS providing free, high-quality TTS for all 8 council members. The pipeline is straightforward — TTS on local Mac, LongCat on RunPod GPU, storage on Vercel Blob — and integrates cleanly with the existing SSE-based debate UI. No Midjourney/DALL-E photorealism step is needed, keeping the pipeline simple and the art style intact.

The primary risks are (1) the model is new (released ~2 weeks ago) with limited community deployment experience, (2) our flat SVG portraits are simpler than typical anime/stylized inputs and may produce less expressive results than desired, and (3) the 4–6 minute render latency means the UX must handle the waiting period gracefully (spinner, polling, or "we'll notify you" pattern). None of these are blockers for a PoC — the first clip costs ~$0.15 and an afternoon of setup. 

**Recommendation:** Proceed with Phase 1 PoC — render a single Elder Aldric (Judge) verdict clip. Validate that stylized SVG input produces acceptable output. If the first clip looks good, the cost and pipeline scale naturally to all 8 personas.

### Confidence Level: MEDIUM-HIGH (75%)

The documentation is explicit and consistent about stylized support, and the cost model is clear. The 25% uncertainty comes from the lack of real-world SVG-to-video examples and the model's newness (2 weeks old, limited community battle-testing).

### Next Steps (if GO)

1. **Immediate:** Rasterize `portrait-judge` SVG to 720×720 PNG
2. **Immediate:** Generate a test verdict WAV with Edge TTS using `en-US-ChristopherNeural`
3. **Short-term:** Set up RunPod Docker container with LongCat-Video-Avatar-1.5 model weights
4. **Short-term:** Render first test clip — validate quality with stylized input
5. **Short-term:** If quality acceptable, spawn frontend task for cinematic verdict UI slot
6. **Medium-term:** Extend to all 8 council members after validating with Judge persona

---

## Appendix: Sources Referenced

- LongCat-Video-Avatar-1.5 Model Card: https://huggingface.co/meituan-longcat/LongCat-Video-Avatar-1.5
- Technical Report (arXiv): https://arxiv.org/abs/2605.26486
- Project Page: https://meigen-ai.github.io/LongCat-Video-Avatar-1.5-Page/
- GitHub Repository: https://github.com/meituan-longcat/LongCat-Video
- RunPod Pricing: https://www.runpod.io/pricing
- Modal Pricing: https://modal.com/pricing
- HF Inference Endpoints Pricing: https://huggingface.co/docs/inference-endpoints/en/pricing
- Replicate LongCat-Video: https://replicate.com/lucataco/longcat-video
- Edge TTS PyPI: https://pypi.org/project/edge-tts/
- ElevenLabs Pricing: https://elevenlabs.io/pricing
- OpenAI TTS Pricing: https://costgoat.com/pricing/openai-tts
- Medium Review: https://medium.com/data-science-in-your-pocket/longcat-video-avatar-1-5-open-source-ai-avatar-generation-is-getting-scarily-good-0a5a3f9bcb91
- Castle Portraits: `castle-portraits.svg` (in-project)
