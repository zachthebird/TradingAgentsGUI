# Live Desk (Tier C) — passcode-gated live runs

Lets vetted guests run **real** analyses against your API keys, behind a
shareable passcode, with hard server-side spend clamps. Your own admin
token is unaffected.

## Server config (`.env`, all optional)

| Var | Default | Meaning |
|---|---|---|
| `TRADINGAGENTS_API_TOKEN` | — | Admin token (full config). Auth is OFF entirely if unset. |
| `TRADINGAGENTS_GUEST_TOKEN` | — | Shareable guest passcode. Guest tier only exists when set. |
| `TRADINGAGENTS_GUEST_DAILY_CAP` | 8 | Max guest runs per day (per process). |
| `TRADINGAGENTS_GUEST_COOLDOWN` | 90 | Seconds between guest runs. |
| `TRADINGAGENTS_GUEST_PROVIDER` / `_GUEST_DEEP_LLM` / `_GUEST_QUICK_LLM` | server default | Cheap/free model routing for guest runs. |

## What a guest CANNOT do (enforced in `/analyze`, not the UI)

- Pick provider / models / `backend_url` (SSRF + key-leak vector) — stripped.
- Set `output_language` (free-form → injected into every agent prompt) — stripped.
- Run depth beyond `standard` — clamped.
- Exceed the daily cap, the cooldown, or 1 concurrent run — 429.

The GUI also hides the advanced panel and shows "GUEST DESK · N/8 runs left"
for guest tokens, but the server is the enforcement point.

## Exposing it (Cloudflare quick tunnel)

`cloudflared tunnel --url http://localhost:8000` gives a fresh public
`*.trycloudflare.com` URL each start (SSE-friendly, no interstitial). Read
the current one with `web-ui/desk-url.sh`. Guests open `<url>/gui/`, enter
the passcode at the gate, and run.

> ngrok is NOT usable here: the account's one static domain is claimed by
> another tunnel and ngrok forces it onto every http tunnel (ERR_NGROK_334).
> The launchd job (`ai.zachbird.tradingagents-tunnel`, machine-local, not in
> the repo) runs cloudflared under KeepAlive.
