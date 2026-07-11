#!/bin/bash
# desk-sse-probe.sh — prove the desk actually STREAMS through a given base URL.
# This is the check the cloudflared quick tunnel failed on 2026-07-10 (HTTP 200,
# correct content-type, but 0 bytes of SSE until the run ended — a frozen desk).
# Run it against EVERY new transport (host, tunnel, proxy) before pointing
# /live at it. A green /health is NOT enough; only flowing bytes count.
#
# Usage: desk-sse-probe.sh <BASE_URL> [ADMIN_OR_GUEST_TOKEN]
#   e.g. desk-sse-probe.sh https://tradingagents-desk.onrender.com
# With no token it relies on the open guest tier (TRADINGAGENTS_GUEST_OPEN=1).
# Cost: one market-only quick guest run (free Nemotron) or admin run (~$0.015).
set -u
BASE="${1:?usage: desk-sse-probe.sh <BASE_URL> [TOKEN]}"
TOKEN="${2:-}"
AUTH=(); [ -n "$TOKEN" ] && AUTH=(-H "Authorization: Bearer $TOKEN")
FAIL=0
pass(){ printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail(){ printf "  \033[31m✗ FAIL\033[0m %s\n" "$1"; FAIL=1; }

echo "── desk SSE probe @ $BASE ──"

# 1. health (also wakes a slept free instance; allow a cold-start retry)
HC=$(curl -s -o /dev/null -w '%{http_code}' --max-time 90 "$BASE/health")
if [ "$HC" != "200" ]; then
  echo "  (health=$HC — cold start? retrying once after 30s)"; sleep 30
  HC=$(curl -s -o /dev/null -w '%{http_code}' --max-time 90 "$BASE/health")
fi
[ "$HC" = "200" ] && pass "/health 200" || { fail "/health=$HC"; exit 1; }

# 2. GUI shell loads
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -L "$BASE/gui/")" = "200" ] && pass "/gui/ 200" || fail "/gui/ not 200"

# 3. start a cheap run (market-only, quick) dated last weekday
DATE=$(python3 -c "from datetime import date,timedelta;d=date.today()-timedelta(1)
while d.weekday()>4: d-=timedelta(1)
print(d)")
JOB=$(curl -s --max-time 60 -X POST "$BASE/analyze" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"ticker\":\"KO\",\"date\":\"$DATE\",\"analysts\":[\"market\"],\"research_depth\":\"quick\"}" \
  | python3 -c "import sys,json
d=json.load(sys.stdin); print(d.get('job_id') or 'ERR:'+str(d)[:120])")
case "$JOB" in ERR:*|"") fail "could not start probe run: $JOB"; exit 1;; esac
pass "run started ($JOB)"

# 4. THE test: do SSE bytes FLOW in near-real-time? Backend emits heartbeats
#    every 0.25s, so any working transport shows events within seconds.
EV=$(curl -sN --max-time 20 "$BASE/stream/$JOB" ${TOKEN:+"-H"} ${TOKEN:+"Authorization: Bearer $TOKEN"} 2>/dev/null | grep -c '^data:')
if [ "$EV" -ge 5 ]; then
  pass "SSE STREAMS: $EV events in 20s — transport passes"
else
  fail "SSE BUFFERED/DEAD: only $EV events in 20s (expect dozens of heartbeats) — DO NOT point /live here"
fi

echo
[ "$FAIL" = 0 ] && echo -e "\033[32m✓ PROBE PASS — transport streams; safe for /live\033[0m" || echo -e "\033[31m✗ PROBE FAIL\033[0m"
exit $FAIL
