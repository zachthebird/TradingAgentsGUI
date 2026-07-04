/* ═══════════════════════════════════════════════════════════════════
   PC-98 terminal — RECORDED-SESSION replay driver (public demo).

   Loaded BEFORE terminal-live.js. Stubs fetch + EventSource so the
   unmodified live terminal runs a real recorded council session
   (session-data.js — a genuine AAPL run, replayed) with no backend
   and no API keys. The replay auto-starts by filling and submitting
   the terminal's own summon form, so every state transition is the
   authentic live path.

   Menu rewires: SUMMON → REPLAY (restarts); ADV UI hidden — the old Game
   Boy edition is retired from the public demo.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var SES = window.__REPLAY_SESSION;
  if (!SES) return;

  /* ── network stubs (must exist before terminal-live boots) ────── */
  var realFetch = window.fetch.bind(window);
  function jsonResp(obj, status) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/analyze') >= 0) return jsonResp({ job_id: 'replay01' });
    if (u.indexOf('/reports/prices/') >= 0) return jsonResp(SES.prices);
    if (u.indexOf('/reports/' + SES.ticker + '/') >= 0) return jsonResp(SES.archive);
    if (/\/reports(\?|$)/.test(u)) return jsonResp({ reports: [{ ticker: SES.ticker, date: SES.date, path: 'recorded' }] });
    return realFetch(url, opts);
  };

  var driverES = null;
  function FakeES() {
    driverES = this;
    this.readyState = 1;
    var self = this;
    setTimeout(function () { if (self.onopen) self.onopen({}); }, 60);
  }
  FakeES.prototype.close = function () { this.readyState = 2; };
  window.EventSource = FakeES;

  /* ── replay engine ─────────────────────────────────────────────── */
  var timer = null, hb = null, idx = 0;

  function emit(evt) {
    if (driverES && driverES.readyState === 1 && driverES.onmessage) {
      driverES.onmessage({ data: JSON.stringify(evt) });
    }
  }
  function gapFor(evt) {
    if (evt.type === 'status') return 1400;
    if (evt.type === 'chunk') return 2600;  // let the data-pull cameo breathe
    if (evt.type === 'complete') return 1200;
    return 5200;                            // substantive pages
  }
  function pump() {
    if (idx >= SES.events.length) { stopHb(); return; }
    var evt = SES.events[idx++];
    emit(evt);
    timer = setTimeout(pump, gapFor(evt));
  }
  function startHb() {
    stopHb();
    hb = setInterval(function () { emit({ type: 'heartbeat' }); }, 1600);
  }
  function stopHb() { if (hb) { clearInterval(hb); hb = null; } }

  function startReplay() {
    clearTimeout(timer); stopHb(); idx = 0;
    var t = document.getElementById('t98-f-ticker');
    var go = Array.prototype.filter.call(document.querySelectorAll('.t98-btn'), function (b) {
      return b.textContent.indexOf('BEGIN ANALYSIS') >= 0;
    })[0];
    if (!t || !go) return;
    t.value = SES.ticker;
    var d = document.getElementById('t98-f-date');
    if (d) d.value = SES.date; // the recorded (past) date always validates
    go.click();                // authentic path: submitForm → startRun → stubs
    startHb();
    timer = setTimeout(pump, 900);
  }

  /* ── chrome: badge + menu rewires ──────────────────────────────── */
  function addBadge() {
    var b = document.createElement('div');
    b.textContent = '● ' + (SES.recordedNote || 'RECORDED SESSION') + ' · NOT FINANCIAL ADVICE';
    b.style.cssText = 'position:fixed;top:44px;right:14px;z-index:600;background:rgba(4,16,24,.85);' +
      'color:#ffb84d;border:1px solid #8c2340;font-family:monospace;font-size:11px;' +
      'letter-spacing:1px;padding:3px 10px;pointer-events:none';
    document.body.appendChild(b);
  }
  function rewireMenus() {
    Array.prototype.forEach.call(document.querySelectorAll('.t98-menu-btn'), function (b) {
      if (b.textContent === 'SUMMON') b.textContent = 'REPLAY';
      // ADV UI (the old Game Boy edition) is retired from the public demo —
      // this terminal is the showcase. Hide the button rather than relabel it.
      if (b.textContent === 'ADV UI') b.style.display = 'none';
    });
    // Capture phase beats the terminal's own handlers.
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.t98-menu-btn') : null;
      if (!b) return;
      if (b.textContent === 'REPLAY') { e.stopPropagation(); e.preventDefault(); location.reload(); }
    }, true);
  }

  function whenIntroGone(cb) {
    // Hold the replay while the box-art title screen is up (dismissed by
    // any key/click; the terminal auto-dismisses it after ~12s anyway).
    var t = setInterval(function () {
      if (!document.getElementById('t98-intro') &&
          !document.getElementById('t98-brief')) { clearInterval(t); cb(); }
    }, 250);
  }

  function boot() {
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (document.getElementById('t98-f-ticker')) {
        clearInterval(poll);
        rewireMenus();
        addBadge();
        whenIntroGone(function () { setTimeout(startReplay, 900); });
      } else if (tries > 100) {
        clearInterval(poll);
      }
    }, 100);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
