# Deploying the live desk to Render (free tier)

Why this exists: the cloudflared quick tunnel **cannot stream SSE** (proven
2026-07-10 — HTTP 200 but 0 bytes flow until the run ends, so the public desk
looked frozen). A real host fixes the transport AND gives `/live` a stable URL,
retiring the ephemeral-tunnel + auto-heal-watcher machinery.

Why Render: the only mid-2026 option that is **contractually $0** — no card,
750 free instance-hours/mo (covers one 24/7 service), 100-minute request
ceiling (a 15-min SSE run fits), and it genuinely streams SSE. Verified
alternatives, for the record: Fly.io free tier is dead (card or $25 prepaid);
Hugging Face free Docker Spaces got PRO-gated ($9/mo) the week of 2026-07-08;
Cloud Run is $0 *in practice* but usage-billed against the card on the
`hermesgaccess` GCP project (runner-up if Render disappoints).

## One-time setup (Zach, ~5 min in the dashboard)

1. Push this branch (`deploy/render-free`) to GitHub, or merge to `main`.
2. https://dashboard.render.com → **New + → Blueprint** → connect
   `zachthebird/TradingAgentsGUI` → pick the branch. Render reads
   `render.yaml` and prompts for the two secrets:
   - `TRADINGAGENTS_API_TOKEN`: **fresh** value, `openssl rand -hex 32`.
     Never reuse the local desk's token. (Unset = auth gate DISABLED.)
   - `TRADINGAGENTS_GUEST_API_KEY`: the OpenRouter key (funds the free
     Nemotron guest runs; account is funded-tier → 1000 free req/day).
3. Deploy. First build ~5-10 min. URL: `https://tradingagents-desk.onrender.com`
   (or similar — Render may suffix it).

## Post-deploy validation (non-negotiable)

    web-ui/scripts/desk-sse-probe.sh https://<the-render-url>

This starts a cheap probe run and **proves SSE bytes flow in real time** —
the exact check the tunnel failed. If it reports BUFFERED, do NOT point
`/live` here.

## Pointing zachbird.com/live at it

The site repo (`~/Projects/zacharybird-deploy`, Maya's team) already has the
restore pre-built on branch `restore/live-redirect`. Change the redirect
`Location` from the `trycloudflare.com` URL to the Render URL, run
`~/.hermes/scripts/site-predeploy-smoke.sh` against the preview, then deploy.
Afterwards, retire for good:
- launchd `ai.zachbird.tradingagents-tunnel` (the quick tunnel)
- launchd `ai.zachbird.desk-live-redirect` (the auto-heal watcher, already paused)

The local desk (native app / localhost:8000) is unaffected and stays the
admin/paid-keys environment; the Render instance is guest-only.

## Free-tier tradeoffs (accepted, documented)

- **Cold start ~30-60s** after 15 min idle (browser sees a Render loading
  page, then the desk). Fine for a demo.
- **Idle timer counts INBOUND requests only** — an open SSE stream doesn't
  reset it. Mitigated in the frontend: during a live run the terminal pings
  `/health` every 4 min (terminal-live.js keepalive, cache-buster 20260710a).
- **The instance may restart at any time** (Render docs) — an in-flight run
  dies unrecoverably. Rare; guest sees the stall watchdog + can rerun.
- **Ephemeral disk** — the run archive (`/tmp/tradingagents-logs`) resets on
  restart. The archive of record stays on the Mac. Guest rate counters also
  reset (they already did on local restarts).
- **New Hobby plan (2026-04-23): 5 GB/mo outbound** — LLM traffic is a few
  MB/run; hundreds of runs fit. Watch it if traffic ever spikes.

## Env reference

Everything non-secret is pinned in `render.yaml` (Nemotron `:free` slugs for
both guest models, 900s job timeout, 180s/3-retry LLM calls, guest desk OPEN
with server-side clamps: depth ≤ standard, 8/day global, 3/day per-IP, 90s
cooldown, 1 concurrent). `PORT` is injected by Render; `HOST=0.0.0.0` is set
in the Dockerfile.
