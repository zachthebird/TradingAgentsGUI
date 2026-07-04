/* ═══════════════════════════════════════════════════════════════════
   PC-98 COUNCIL TERMINAL — live-tier view layer  (terminal-live.js)

   Loaded INSTEAD of the castle pack when tradingagents_ui_mode === 'terminal'
   (see the mode loader in index.html). Owns its own fetch + EventSource
   directly — no monkey-patching, no window.__sseListeners. The React
   app keeps running underneath (its token gate at z9999 still works;
   we share localStorage.tradingagents_token).

   Fixes the three live-tier failures (design/LIVE-UI-SPEC-PC98.md):
     1. Always-on working state: pipeline HUD, active node, elapsed,
        heartbeat LED, wire ticker.
     2. Full agent outputs first-class: every report/debate/verdict SSE
        event becomes a readable dialog page (full markdown), indexed.
     3. Clean chrome: one input, no stale verdict, React hidden below.

   Node→seat semantics mirror castle-council.js AGENT_TO_SEAT (dfaa5fa):
   bull→Balthazar, bear→Morwen, risk trio agg→Balthazar/con→Morwen/
   neu→Kael, managers/PM→Aldric. Verbatim rulings preserved.

   QA hooks: window.__terminalInject(evt) feeds a synthetic SSE event
   through the real router; window.__terminalState() snapshots state.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── cast + pipeline maps ─────────────────────────────────────── */
  // Anime PC-98 cast (design/pc98-cast/, sliced from the finance-role
  // panel of pc98-asset-sheet-finance.png — sheet roles in comments).
  // Seat SEMANTICS mirror the dfaa5fa map — only the skin changed.
  // Painterly castle cast (design/comic-cast/) still serves the ADV view.
  var CAST = {
    market:       { name: 'Amy',     role: 'Market Analyst',       img: 'amy.png',     quote: 'The tape never lies. People do.' },
    social:       { name: 'Natsumi', role: 'Sentiment Analyst',    img: 'natsumi.png', quote: 'Sentiment is a rumor with volume.' },
    news:         { name: 'Satomi',  role: 'News Analyst',         img: 'satomi.png',  quote: 'Breaking: the headline is already priced in.' },
    fundamentals: { name: 'Misaki',  role: 'Fundamentals Analyst', img: 'misaki.png',  quote: 'Show me the filings, not the story.' },
    bull:         { name: 'Reika',   role: 'Bull Researcher',      img: 'reika.png',   quote: 'Underweighting conviction is career risk.' },
    bear:         { name: 'Aoi',     role: 'Bear Researcher',      img: 'aoi.png',     quote: 'Someone has to price the downside.' },
    trader:       { name: 'Chika',   role: 'Trader',               img: 'chika.png',   quote: 'My models saw it four ticks ago.' },
    judge:        { name: 'Sabrina', role: 'Portfolio Manager',    img: 'sabrina.png', quote: 'Bring me arguments, not opinions. I sign the ruling.' },
  };
  var CAST_DIR = 'design/pc98-cast/';

  // The rest of the firm (pc98-asset-sheet-finance.png roster) — attract
  // mode + role cameos. Not seat-mapped; purely presentational.
  var EXTRAS = {
    yuki:     { name: 'Yuki',       role: 'Venture Capitalist',  img: 'yuki.png',        quote: 'I fund the future before it reports earnings.' },
    luna:     { name: 'Luna',       role: 'Private Banker',      img: 'luna.png',        quote: 'Discretion compounds faster than interest.' },
    karen:    { name: 'Karen',      role: 'Compliance Officer',  img: 'karen.png',       quote: 'Every trade clears my desk first.' },
    goro:     { name: 'Goro',       role: 'Investment Banker',   img: 'goro.png',        quote: 'The deal is done. You just have not signed yet.' },
    tanaka:   { name: 'Mr. Tanaka', role: 'CFO',                 img: 'tanaka.png',      quote: 'Cash is a fact. Everything else is opinion.' },
    beatrice: { name: 'Beatrice',   role: 'Tax Strategist',      img: 'beatrice.png',    quote: 'The best return is the one you keep.' },
    hojo:     { name: 'Hojo',       role: 'Auditor',             img: 'hojo.png',        quote: 'The ledger remembers what everyone forgets.' },
    ren:      { name: 'Ren',        role: 'M&A Lawyer',          img: 'ren.png',         quote: 'Read clause twelve again. Slowly.' },
    maria:    { name: 'Maria',      role: 'IR Analyst',          img: 'maria.png',       quote: 'The market hears what you whisper.' },
    takashi:  { name: 'Takashi',    role: 'Credit Analyst',      img: 'takashi.png',     quote: 'Debt always tells the truth eventually.' },
    elena:    { name: 'Elena',      role: 'Private Equity Dir.', img: 'elena.png',       quote: 'Undervalued is just unloved, with paperwork.' },
    shinji:   { name: 'Shinji',     role: 'Junior Analyst',      img: 'shinji.png',      quote: 'Pulling the data now! Two minutes!' },
    mascot:   { name: 'CALC-98',    role: 'Terminal Mascot',     img: 'mascot-calc.png', quote: 'Please do not unplug me during a run.' },
  };
  // Attract-mode rotation order: the eight seats, then the wider firm.
  var ROSTER = Object.keys(CAST).map(function (k) { return CAST[k]; })
    .concat(['yuki', 'luna', 'karen', 'goro', 'tanaka', 'beatrice', 'hojo', 'ren', 'maria', 'takashi', 'elena', 'shinji']
      .map(function (k) { return EXTRAS[k]; }));

  // LangGraph node name (lowercased, spaces→_) → seat. Mirrors the
  // dfaa5fa-corrected AGENT_TO_SEAT in castle-council.js.
  var NODE_SEAT = {
    market_analyst: 'market', tools_market: 'market',
    social_analyst: 'social', sentiment_analyst: 'social', tools_social: 'social',
    news_analyst: 'news', tools_news: 'news',
    fundamentals_analyst: 'fundamentals', tools_fundamentals: 'fundamentals',
    bull_researcher: 'bull',
    bear_researcher: 'bear',
    research_manager: 'judge', risk_manager: 'judge', portfolio_manager: 'judge',
    researcher_judge: 'judge', risk_judge: 'judge',
    trader: 'trader',
    aggressive_analyst: 'bull', risky_analyst: 'bull',
    conservative_analyst: 'bear', safe_analyst: 'bear',
    neutral_analyst: 'trader',
  };

  var STAGES = [
    { id: 'analysts', label: 'ANALYSTS', match: /market|sentiment|social|news|fundamentals|tools_|msg_clear/ },
    { id: 'debate',   label: 'DEBATE',   match: /bull_researcher|bear_researcher|research_manager/ },
    { id: 'trader',   label: 'TRADER',   match: /^trader/ },
    { id: 'risk',     label: 'RISK',     match: /aggressive|risky|conservative|safe|neutral|risk_manager|risk_judge/ },
    { id: 'verdict',  label: 'VERDICT',  match: /portfolio_manager/ },
  ];

  var SECTION_TITLES = {
    market_report:      'Market Recon',
    sentiment_report:   'Sentiment Sweep',
    news_report:        'News Wire',
    fundamentals_report:'Fundamentals Audit',
    trader_plan:        "Trader's Plan",
  };

  var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── state ────────────────────────────────────────────────────── */
  var S = {
    mode: 'idle',            // idle | running | done | error
    ticker: '', date: '', jobId: '',
    startedAt: 0, lastFrameAt: 0, lastDataAt: 0,
    es: null,
    pages: [], pageIdx: -1, seenPageKeys: {}, gotSections: {},
    auto: true,
    stages: {},              // id -> pending|active|done|error
    activeNode: '', wireText: 'STANDING BY',
    log: [],
    verdict: null,           // {signal, text}
    usage: null,             // {cost_usd, llm_calls, total_tokens, ...}
    prices: null,
    typing: null,            // typewriter handle
  };
  STAGES.forEach(function (st) { S.stages[st.id] = 'pending'; });

  var D = {};                // DOM refs
  var timers = { clock: null, heartbeatOff: null, advance: null, attract: null, rx: null, intro: null, brief: null };

  /* ── attract mode: the firm's roster cycles while the terminal idles ── */
  var attractIdx = 0;
  function startAttract() {
    stopAttract();
    timers.attract = setInterval(function () {
      if (S.mode !== 'idle') { stopAttract(); return; }
      if (S.typing) return; // never clobber an active speaker
      var who = ROSTER[attractIdx % ROSTER.length];
      attractIdx++;
      showCharacter(who, 'idle');
      setWire('ROSTER ▸ ' + who.name.toUpperCase() + ' — ' + who.role.toUpperCase() + ': “' + who.quote + '”');
    }, 8000);
  }
  function stopAttract() {
    if (timers.attract) { clearInterval(timers.attract); timers.attract = null; }
  }

  /* ── tiny helpers ─────────────────────────────────────────────── */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function token() { try { return localStorage.getItem('tradingagents_token') || ''; } catch (e) { return ''; } }
  function withToken(url) {
    var t = token();
    if (!t) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(t);
  }
  function localToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtElapsed(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }
  function nowHMS() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function normNode(name) {
    return String(name || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
  }
  function seatFor(node) { return NODE_SEAT[normNode(node)] || null; }
  function stageFor(node) {
    var n = normNode(node);
    if (!n) return null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].match.test(n)) return STAGES[i].id;
    return null;
  }

  /* ── minimal markdown → safe HTML ─────────────────────────────── */
  function mdInline(t) {
    return t
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  }
  function mdToHtml(src) {
    var lines = esc(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, inList = null, inTable = false;
    function closeList() { if (inList) { out.push('</' + inList + '>'); inList = null; } }
    function closeTable() { if (inTable) { out.push('</tbody></table>'); inTable = false; } }
    while (i < lines.length) {
      var ln = lines[i];
      var h = ln.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeList(); closeTable(); out.push('<h' + h[1].length + '>' + mdInline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(ln)) { closeList(); closeTable(); out.push('<hr>'); i++; continue; }
      // GFM table: header row + separator row. Single character class
      // keeps the separator test linear — adjacent overlapping
      // quantifiers (\s* + [\s...]+) backtrack quadratically on
      // crafted/degenerate LLM output.
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^[\s:|-]+$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
        closeList(); closeTable();
        var cells = ln.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
        out.push('<table><thead><tr>' + cells.map(function (c) { return '<th>' + mdInline(c.trim()) + '</th>'; }).join('') + '</tr></thead><tbody>');
        inTable = true; i += 2; continue;
      }
      if (inTable && /^\s*\|.*\|\s*$/.test(ln)) {
        var tds = ln.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
        out.push('<tr>' + tds.map(function (c) { return '<td>' + mdInline(c.trim()) + '</td>'; }).join('') + '</tr>');
        i++; continue;
      }
      closeTable();
      var ul = ln.match(/^\s*[-*+]\s+(.*)$/);
      var ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        var want = ul ? 'ul' : 'ol';
        if (inList !== want) { closeList(); out.push('<' + want + '>'); inList = want; }
        out.push('<li>' + mdInline((ul || ol)[1]) + '</li>'); i++; continue;
      }
      var bq = ln.match(/^\s*&gt;\s?(.*)$/);
      if (bq) { closeList(); out.push('<blockquote>' + mdInline(bq[1]) + '</blockquote>'); i++; continue; }
      if (/^\s*$/.test(ln)) { closeList(); i++; continue; }
      closeList();
      out.push('<p>' + mdInline(ln) + '</p>'); i++;
    }
    closeList(); closeTable();
    return out.join('\n');
  }

  /* ── DOM construction ─────────────────────────────────────────── */
  function buildUI() {
    var root = el('div');
    root.id = 't98-root';

    // top bar
    var top = el('div', 't98-topbar');
    D.title = el('div', 't98-title', 'TRADING AGENTS <b>//</b> COUNCIL TERMINAL');
    D.tick = el('div', 't98-tick', '');
    D.tickPrice = el('div', 't98-tick-price', '');
    var spacer = el('div', 't98-spacer');
    D.link = el('div', 't98-link');
    D.led = el('span', 't98-led');
    D.linkText = el('span', '', 'IDLE');
    D.link.appendChild(D.led); D.link.appendChild(D.linkText);
    D.clock = el('div', 't98-clock', nowHMS());
    top.appendChild(D.title); top.appendChild(D.tick); top.appendChild(D.tickPrice); top.appendChild(spacer);
    top.appendChild(D.link); top.appendChild(D.clock);

    // stage: chart canvas + advisor + dialog
    var stage = el('div', 't98-stage');
    D.chart = el('canvas'); D.chart.id = 't98-chart';
    stage.appendChild(D.chart);

    D.advisor = el('div', 't98-advisor');
    var bezel = el('div', 't98-portrait-bezel');
    D.portrait = el('img');
    D.portrait.alt = 'advisor portrait';
    bezel.appendChild(D.portrait);
    D.nameplate = el('div', 't98-nameplate', 'COUNCIL');
    D.advisor.appendChild(bezel); D.advisor.appendChild(D.nameplate);
    stage.appendChild(D.advisor);

    D.dialog = el('div', 't98-dialog');
    D.dialogTitle = el('div', 't98-dialog-title', 'COUNCIL TERMINAL');
    D.dialogSub = el('div', 't98-dialog-sub', '');
    D.dialogBody = el('div', 't98-dialog-body');
    D.dialogBtns = el('div', 't98-dialog-btns');
    D.pagePos = el('span', 't98-page-pos', '');
    D.dialog.appendChild(D.dialogTitle);
    D.dialog.appendChild(D.dialogSub);
    D.dialog.appendChild(D.dialogBody);
    D.dialog.appendChild(D.dialogBtns);
    // ADV-parity affordance: click the text area to skip the typewriter
    D.dialogBody.addEventListener('click', function () {
      if (S.typing) S.typing.skip();
    });
    // Reading detection: a recent USER scroll defers auto-advance
    // (typing auto-scroll doesn't count).
    D.dialogBody.addEventListener('scroll', function () {
      if (!S.typing) S.lastScrollAt = Date.now();
    });
    stage.appendChild(D.dialog);

    // wire ticker (+ upstream attribution, right-aligned)
    var wire = el('div', 't98-wire');
    wire.appendChild(el('span', 't98-wire-tag', 'WIRE▸'));
    D.wireText = el('span', 't98-wire-text', 'STANDING BY');
    wire.appendChild(D.wireText);
    wire.appendChild(el('span', 't98-credit', 'BUILT ON TRADINGAGENTS · © TAURIC RESEARCH · APACHE-2.0'));

    // HUD
    var hud = el('div', 't98-hud');
    var stagesBox = el('div', 't98-stages');
    D.stageSegs = {};
    STAGES.forEach(function (st) {
      var seg = el('div', 't98-stage-seg');
      seg.appendChild(el('span', 't98-seg-lamp'));
      seg.appendChild(document.createTextNode(st.label));
      D.stageSegs[st.id] = seg;
      stagesBox.appendChild(seg);
    });
    D.hudNow = el('div', 't98-hud-now', 'AWAITING ORDERS');
    D.hudMeta = el('div', 't98-hud-meta');
    D.elapsed = el('span', '', 'T+00:00');
    D.lastData = el('span', '', '');
    D.cost = el('span', 't98-cost', '');
    D.hudMeta.appendChild(D.elapsed); D.hudMeta.appendChild(D.lastData); D.hudMeta.appendChild(D.cost);

    var menu = el('div', 't98-menu');
    D.menu = {};
    [['summon', 'SUMMON'], ['index', 'INDEX'], ['log', 'LOG'], ['archive', 'ARCHIVE'], ['export', 'EXPORT'], ['adv', 'ADV UI']].forEach(function (m) {
      var b = el('button', 't98-menu-btn', m[1]);
      b.addEventListener('click', function () { onMenu(m[0]); });
      D.menu[m[0]] = b;
      menu.appendChild(b);
    });

    hud.appendChild(stagesBox); hud.appendChild(D.hudNow); hud.appendChild(D.hudMeta); hud.appendChild(menu);

    root.appendChild(top); root.appendChild(stage); root.appendChild(wire); root.appendChild(hud);

    var reactRoot = document.getElementById('root');
    if (reactRoot && reactRoot.parentNode) reactRoot.parentNode.insertBefore(root, reactRoot);
    else document.body.appendChild(root);
    D.root = root;
    document.body.classList.add('t98-mode');
    document.title = 'Trading Agents — Council Terminal';

    setPortrait('judge', 'idle');
    window.addEventListener('resize', drawChart);
    timers.clock = setInterval(tickClock, 1000);
    document.addEventListener('keydown', onKey);
  }

  function applyPortrait(entry, frame) {
    var src = CAST_DIR + entry.img;
    if (D.portrait.getAttribute('src') !== src) {
      D.portrait.src = src;
      // CRT re-tune flicker on every face change
      if (!REDUCED_MOTION) {
        D.advisor.classList.remove('t98-swap');
        void D.advisor.offsetWidth; // restart the animation
        D.advisor.classList.add('t98-swap');
      }
    }
    D.nameplate.textContent = entry.name;
    D.advisor.classList.toggle('t98-speaking', frame === 'speaking');
    D.advisor.classList.toggle('t98-thinking', frame === 'idle' && S.mode === 'running');
  }
  function setPortrait(seat, frame) {
    applyPortrait(CAST[seat] || CAST.judge, frame);
  }
  function showCharacter(entry, frame) {
    applyPortrait(entry, frame || 'idle');
  }

  /* ── typewriter (adaptive; whole pages, click/space to finish) ── */
  function typeInto(node, html, raw, done) {
    stopTyping();
    if (REDUCED_MOTION) {
      node.innerHTML = html;
      if (done) done();
      return;
    }
    // Type the RAW source progressively (line breaks preserved via
    // pre-wrap), then swap in the rich HTML at the end.
    var text = raw;
    if (!text) {
      var tmp = el('div', '', html);
      text = tmp.textContent || '';
    }
    text = String(text);
    var total = text.length;
    if (!total) { node.innerHTML = html; if (done) done(); return; }
    // Finish ANY page within ~25s (chars/ms scales up for huge reports;
    // 14ms/char ceiling for short ones). Progress is WALL-CLOCK based:
    // background tabs throttle setTimeout to ~1/s, so a per-tick counter
    // would crawl — this catches up in a single tick instead. Text is
    // APPENDED via appendData (not re-sliced) so huge pages stay linear.
    var cps = Math.max(1 / 14, total / 25000); // chars per ms
    var t0 = Date.now();
    var i = 0;
    var cancelled = false;
    var baseSub = D.dialogSub.textContent;
    var lastRx = 0;
    var pre = el('div');
    pre.style.whiteSpace = 'pre-wrap';
    var tn = document.createTextNode('');
    pre.appendChild(tn);
    node.innerHTML = '';
    node.appendChild(pre);
    var cur = el('span', 't98-cursor');
    node.appendChild(cur);
    function step() {
      if (cancelled) return;
      var target = Math.min(total, Math.floor((Date.now() - t0) * cps) + 1);
      if (target > i) {
        tn.appendData(text.slice(i, target));
        i = target;
        node.scrollTop = node.scrollHeight;
      }
      if (Date.now() - lastRx > 400) {
        lastRx = Date.now();
        D.dialogSub.textContent = baseSub + ' · RX ' + Math.floor((i / total) * 100) + '%';
      }
      if (i >= total) return finish();
      S.typing.t = setTimeout(step, 16);
    }
    function finish() {
      if (cancelled) return;
      cancelled = true;
      S.typing = null;
      D.dialogSub.textContent = baseSub;
      node.innerHTML = html;
      node.scrollTop = 0;
      if (done) done();
    }
    S.typing = {
      t: setTimeout(step, 20),
      skip: function () { clearTimeout(S.typing.t); finish(); },
      cancel: function () { cancelled = true; clearTimeout(S.typing && S.typing.t); S.typing = null; },
    };
  }
  function stopTyping() { if (S.typing) S.typing.cancel(); }

  /* ── dialog pages ─────────────────────────────────────────────── */
  function pushPage(p) {
    // p: {key, kind, title, sub, seat, html, raw, ts}
    if (p.key && S.seenPageKeys[p.key]) return;
    if (p.key) S.seenPageKeys[p.key] = 1;
    p.ts = nowHMS();
    p.unread = true;
    S.pages.push(p);
    if (S.pageIdx === -1) {
      showPage(S.pages.length - 1);
    } else {
      // Never yank the page the user is reading — advance via the
      // scheduled path, which respects recent scrolling.
      renderDialogButtons();
      scheduleAdvance();
    }
  }

  function scheduleAdvance() {
    if (timers.advance) return;
    timers.advance = setTimeout(function () {
      timers.advance = null;
      if (!S.auto || S.typing || S.pageIdx >= S.pages.length - 1) return;
      if (Date.now() - (S.lastScrollAt || 0) < 6000) { scheduleAdvance(); return; }
      showPage(S.pageIdx + 1);
    }, REDUCED_MOTION ? 500 : 1800);
  }

  function showPage(idx) {
    if (idx < 0 || idx >= S.pages.length) return;
    S.pageIdx = idx;
    var p = S.pages[idx];
    p.unread = false;
    D.dialogTitle.textContent = p.title;
    D.dialogSub.textContent = p.sub || '';
    var who = p.character || (p.seat ? CAST[p.seat] : null);
    if (who) applyPortrait(who, 'speaking');
    typeInto(D.dialogBody, p.html, p.raw, function () {
      if (who) applyPortrait(who, 'idle');
      renderDialogButtons(); // drop the stale SKIP button
      maybeAutoAdvance();
    });
    renderDialogButtons();
  }

  function maybeAutoAdvance() {
    if (S.auto) scheduleAdvance();
  }

  function renderDialogButtons() {
    D.dialogBtns.innerHTML = '';
    D.pagePos.textContent = S.pages.length ? ('PAGE ' + (S.pageIdx + 1) + '/' + S.pages.length) : '';
    D.dialogBtns.appendChild(D.pagePos);
    var unread = S.pages.filter(function (p) { return p.unread; }).length;
    if (unread) D.pagePos.textContent += '  ·  +' + unread + ' NEW';
    function btn(label, cls, fn, disabled) {
      var b = el('button', 't98-btn' + (cls ? ' ' + cls : ''), label);
      if (disabled) b.disabled = true;
      b.addEventListener('click', fn);
      D.dialogBtns.appendChild(b);
      return b;
    }
    if (S.typing) btn('SKIP ▸▸', '', function () { if (S.typing) S.typing.skip(); });
    btn('◂ PREV', '', function () { S.auto = false; renderDialogButtons(); showPage(S.pageIdx - 1); }, S.pageIdx <= 0);
    btn('NEXT ▸', '', function () { S.auto = false; renderDialogButtons(); showPage(S.pageIdx + 1); }, S.pageIdx >= S.pages.length - 1);
    btn('AUTO ' + (S.auto ? '✓' : '✗'), S.auto ? 't98-on' : '', function () {
      S.auto = !S.auto;
      renderDialogButtons();
      if (S.auto) maybeAutoAdvance();
    });
    if (S.mode === 'done' || S.mode === 'error') btn('NEW RUN', 't98-primary', resetToIdle);
  }

  /* ── idle summon form ─────────────────────────────────────────── */
  var serverDefaults = null;
  function fetchServerDefaults(cb) {
    if (serverDefaults) { cb(serverDefaults); return; }
    fetch(withToken('/config/defaults'))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { serverDefaults = j; cb(j); })
      .catch(function () { cb(null); });
  }

  function showIdleForm() {
    stopTyping();
    S.pageIdx = -1;
    D.dialogTitle.textContent = 'SUMMON THE COUNCIL';
    D.dialogSub.textContent = 'LIVE ANALYSIS — FULL PIPELINE';
    setPortrait('judge', 'idle');

    var form = el('div', 't98-form');
    form.innerHTML =
      '<p style="font-family:var(--t98-font-mono);margin:2px 0 6px">Name a ticker and the eight-seat council convenes: four analysts report, bull and bear debate, the trader plans, risk deliberates, and the Portfolio Manager rules. A full run takes several minutes — <strong>the wire below stays live the whole time.</strong></p>' +
      '<div class="t98-form-row"><label>Ticker</label><input class="t98-input t98-ticker" id="t98-f-ticker" maxlength="10" placeholder="NVDA" autocomplete="off" spellcheck="false"></div>' +
      '<div class="t98-form-row"><label>Trade date</label><input class="t98-input" type="date" id="t98-f-date" max="' + localToday() + '" value="' + localToday() + '"></div>' +
      '<div class="t98-form-row"><label>Depth</label><select class="t98-select" id="t98-f-depth">' +
        '<option value="standard" selected>STANDARD — 1 DEBATE ROUND</option>' +
        '<option value="deep">DEEP — 2 DEBATE ROUNDS</option>' +
        '<option value="exhaustive">EXHAUSTIVE — 5 ROUNDS (CLI DEEP, SLOW+COSTLY)</option>' +
        '<option value="quick">QUICK — NO DEBATE ROUNDS</option></select></div>' +
      '<div class="t98-form-row"><label>Analysts</label>' +
        ['market', 'social', 'news', 'fundamentals'].map(function (a) {
          return '<label class="t98-check"><input type="checkbox" data-analyst="' + a + '" checked>' + a + '</label>';
        }).join('') + '</div>' +
      '<div class="t98-form-row"><label>Advanced</label>' +
        '<button type="button" class="t98-btn" id="t98-f-advtoggle">▸ COUNCIL CONFIG</button></div>' +
      '<div id="t98-f-adv" class="t98-adv-panel" style="display:none">' +
        '<div class="t98-form-row"><label>Provider</label><select class="t98-select" id="t98-f-provider">' +
          '<option value="" selected>SERVER DEFAULT</option>' +
          ['deepseek', 'openai', 'anthropic', 'google', 'xai', 'qwen', 'glm', 'minimax', 'openrouter', 'azure', 'ollama']
            .map(function (p) { return '<option value="' + p + '">' + p.toUpperCase() + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="t98-form-row"><label>Deep model</label><input class="t98-input t98-wide" id="t98-f-deepllm" autocomplete="off" spellcheck="false"></div>' +
        '<div class="t98-form-row"><label>Quick model</label><input class="t98-input t98-wide" id="t98-f-quickllm" autocomplete="off" spellcheck="false"></div>' +
        '<div class="t98-form-row"><label>Language</label><input class="t98-input t98-wide" id="t98-f-lang" autocomplete="off" spellcheck="false"></div>' +
        '<div class="t98-form-row"><label>Backend URL</label><input class="t98-input t98-wide" id="t98-f-backendurl" placeholder="(auto)" autocomplete="off" spellcheck="false"></div>' +
        '<div class="t98-adv-note">BLANK FIELDS USE SERVER DEFAULTS. API KEYS COME FROM THE SERVER .ENV — THE FORM NEVER CARRIES THEM.</div>' +
      '</div>' +
      '<div class="t98-form-err" id="t98-f-err"></div>';
    D.dialogBody.innerHTML = '';
    D.dialogBody.appendChild(form);

    D.dialogBtns.innerHTML = '';
    var go = el('button', 't98-btn t98-primary t98-form-go', '▶ BEGIN ANALYSIS');
    go.addEventListener('click', submitForm);
    D.dialogBtns.appendChild(go);

    var t = document.getElementById('t98-f-ticker');
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitForm(); });
    document.getElementById('t98-f-advtoggle').addEventListener('click', function () {
      var panel = document.getElementById('t98-f-adv');
      var open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      this.textContent = (open ? '▸' : '▾') + ' COUNCIL CONFIG';
    });
    // Placeholders show the server's effective defaults (mirrors the
    // CLI wizard's provider/model questions). Guests get a slimmer desk:
    // no advanced overrides, depth capped, remaining runs shown.
    fetchServerDefaults(function (d) {
      if (!d) return;
      if (d.tier === 'guest') {
        var advBtn = document.getElementById('t98-f-advtoggle');
        if (advBtn && advBtn.parentNode) advBtn.parentNode.style.display = 'none';
        var advPanel = document.getElementById('t98-f-adv');
        if (advPanel) advPanel.style.display = 'none';
        var depth = document.getElementById('t98-f-depth');
        if (depth) {
          Array.prototype.slice.call(depth.options).forEach(function (o) {
            if (o.value !== 'standard' && o.value !== 'quick') o.remove();
          });
        }
        var errEl = document.getElementById('t98-f-err');
        if (errEl && d.limits) {
          errEl.textContent = 'GUEST DESK · ' + d.limits.daily_remaining + '/' + d.limits.daily_cap +
            ' RUNS LEFT TODAY · DEPTH CAPPED AT STANDARD';
          errEl.style.color = 'var(--t98-ink-soft)';
        }
        if (!S.guestChip) {
          S.guestChip = true;
          D.title.innerHTML += ' <b>//</b> GUEST DESK';
        }
        return;
      }
      var map = { 't98-f-deepllm': d.deep_think_llm, 't98-f-quickllm': d.quick_think_llm, 't98-f-lang': d.output_language };
      Object.keys(map).forEach(function (id) {
        var elx = document.getElementById(id);
        if (elx && map[id]) elx.placeholder = map[id];
      });
      var prov = document.getElementById('t98-f-provider');
      if (prov && d.llm_provider) prov.options[0].textContent = 'SERVER DEFAULT (' + String(d.llm_provider).toUpperCase() + ')';
    });
    // No stored token → the React gate (z9999) is about to mount and take
    // focus for the passphrase field; stealing it would send keystrokes
    // to a hidden input.
    if (token()) setTimeout(function () { t.focus(); }, 60);
  }

  function submitForm() {
    var tin = document.getElementById('t98-f-ticker');
    var ticker = (tin.value || '').trim().toUpperCase();
    var date = document.getElementById('t98-f-date').value || localToday();
    var depth = document.getElementById('t98-f-depth').value;
    var analysts = Array.prototype.slice.call(document.querySelectorAll('#t98-root [data-analyst]'))
      .filter(function (c) { return c.checked; })
      .map(function (c) { return c.getAttribute('data-analyst'); });
    var err = document.getElementById('t98-f-err');
    if (!/^[A-Z]{1,10}$/.test(ticker)) { err.textContent = 'TICKER MUST BE 1-10 LETTERS (A-Z).'; tin.focus(); return; }
    if (!analysts.length) { err.textContent = 'PICK AT LEAST ONE ANALYST.'; return; }
    if (date > localToday()) { err.textContent = 'DATE CANNOT BE IN THE FUTURE.'; return; }
    err.textContent = '';
    // Advanced overrides — only non-empty values ride along (mirrors
    // the CLI wizard's provider/model/language questions).
    var adv = {};
    function grab(id, key) {
      var n = document.getElementById(id);
      var v = n ? String(n.value || '').trim() : '';
      if (v) adv[key] = v;
    }
    grab('t98-f-provider', 'llm_provider');
    grab('t98-f-deepllm', 'deep_think_llm');
    grab('t98-f-quickllm', 'quick_think_llm');
    grab('t98-f-lang', 'output_language');
    grab('t98-f-backendurl', 'backend_url');
    startRun(ticker, date, analysts, depth, adv);
  }

  /* ── run lifecycle ────────────────────────────────────────────── */
  function startRun(ticker, date, analysts, depth, adv) {
    adv = adv || {};
    closeWindows();
    stopAttract();
    clearTimeout(timers.advance); timers.advance = null;
    S.mode = 'running';
    S.ticker = ticker; S.date = date;
    S.pages = []; S.pageIdx = -1; S.seenPageKeys = {}; S.gotSections = {};
    S.log = []; S.verdict = null; S.usage = null; S.auto = true;
    if (D.cost) D.cost.textContent = '';
    S.startedAt = Date.now(); S.lastDataAt = 0; S.lastFrameAt = 0;
    STAGES.forEach(function (st) { setStage(st.id, 'pending'); });
    S.activeNode = '';
    D.tick.textContent = ticker + ' · ' + date;
    setLink('warn', 'CONNECTING');
    setNow('SUMMONING THE COUNCIL…');
    setWire('POST /analyze — ' + ticker + ' ' + date);
    D.menu.summon.disabled = true;
    D.menu.archive.disabled = true;
    var advLines = Object.keys(adv).map(function (k) { return '- **' + k + ':** ' + adv[k]; });
    pushPage({
      kind: 'system', title: 'COUNCIL SUMMONED', sub: ticker + ' · ' + date + ' · ' + depth.toUpperCase(),
      seat: 'judge',
      html: mdToHtml('The council convenes for **' + ticker + '** (' + date + ').\n\nAnalysts on the floor: ' + analysts.join(', ') + '.\n' +
        (advLines.length ? '\nCouncil config overrides:\n' + advLines.join('\n') + '\n' : '') +
        '\nFirst testimony arrives in a minute or two — watch the wire and the pipeline lamps below. Every full report lands here as its own page, and the INDEX collects them all.'),
    });
    fetchPrices(ticker, date);

    var body = { ticker: ticker, date: date, analysts: analysts, research_depth: depth };
    Object.keys(adv).forEach(function (k) { body[k] = adv[k]; });
    fetch(withToken('/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
    }).then(function (r) {
      if (!r.ok) {
        var msg = r.body && r.body.detail
          ? (Array.isArray(r.body.detail) ? r.body.detail.join('; ') : String(r.body.detail))
          : ('HTTP ' + r.status);
        if (r.status === 403) {
          // The React gate only shows when NO token is stored — clear the
          // stale one so a reload actually re-prompts for the access code.
          try { localStorage.removeItem('tradingagents_token'); } catch (e2) {}
          msg = 'ACCESS DENIED — token rejected. Reload the page to enter a new access code.';
        }
        throw new Error(msg);
      }
      S.jobId = r.body.job_id;
      logEvt('sys', 'job accepted: ' + S.jobId);
      setWire('JOB ' + S.jobId + ' ACCEPTED — OPENING STREAM');
      openStream(S.jobId);
    }).catch(function (e) {
      failRun('Could not start analysis: ' + e.message);
    });
  }

  function openStream(jobId) {
    if (S.es) { try { S.es.close(); } catch (e) {} }
    var es = new EventSource(withToken('/stream/' + jobId));
    S.es = es;
    es.onopen = function () { setLink('on', '● LIVE'); };
    es.onmessage = function (ev) {
      var data;
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      routeEvent(data);
    };
    es.onerror = function () {
      if (S.mode !== 'running') return;
      if (es.readyState === 2 /* CLOSED */) {
        // Non-200 on (re)connect fails an EventSource PERMANENTLY — no
        // retries (e.g. backend restart wiped the in-memory job → 404).
        // Don't wedge in 'RECONNECTING…' forever: recover what the
        // archive has and hand control back.
        setLink('err', 'LINK DEAD');
        failRun('Stream closed permanently (backend restarted or job expired). Recovering whatever the archive holds.');
        backfillFromArchive(S.ticker, S.date);
        return;
      }
      setLink('err', 'RECONNECTING…');
      setWire('LINK LOST — RETRYING');
    };
  }

  function failRun(msg) {
    S.mode = 'error';
    setLink('err', 'ERROR');
    setNow('RUN FAILED');
    setWire(msg);
    var act = stageOfActivity();
    if (act) setStage(act, 'error');
    logEvt('error', msg);
    // Compliance handles auth rejections; the mascot delivers the rest.
    var authFault = /access denied|token|403/i.test(msg);
    pushPage({
      kind: 'error',
      title: authFault ? 'COMPLIANCE HOLD' : 'TRANSMISSION FAULT',
      sub: authFault ? 'KAREN · COMPLIANCE OFFICER' : 'CALC-98 REGRETS TO REPORT',
      character: authFault ? EXTRAS.karen : EXTRAS.mascot,
      html: '<p><strong>' + esc(msg) + '</strong></p><p>The council session could not proceed. Check the LOG window for the event trail, then start a NEW RUN.</p>',
      raw: msg,
    });
    D.menu.summon.disabled = false;
    D.menu.archive.disabled = false;
    if (S.es) { try { S.es.close(); } catch (e) {} S.es = null; }
    renderDialogButtons();
  }

  function finishRun() {
    S.mode = 'done';
    setLink('on', 'COMPLETE');
    setNow('SESSION COMPLETE — ' + (S.verdict ? S.verdict.signal : 'SEE RULING'));
    // A successful complete means the whole pipeline ran, even if a
    // dropped stream kept us from seeing some stages go active.
    STAGES.forEach(function (st) { setStage(st.id, 'done'); });
    D.menu.summon.disabled = false;
    D.menu.archive.disabled = false;
    if (S.es) { try { S.es.close(); } catch (e) {} S.es = null; }
    renderDialogButtons();
  }

  function resetToIdle() {
    stopTyping();
    closeWindows();
    clearTimeout(timers.advance); timers.advance = null;
    S.mode = 'idle'; S.jobId = '';
    S.pages = []; S.pageIdx = -1; S.seenPageKeys = {}; S.gotSections = {}; S.verdict = null;
    S.ticker = ''; S.date = ''; S.prices = null; S.startedAt = 0; S.lastDataAt = 0;
    STAGES.forEach(function (st) { setStage(st.id, 'pending'); });
    setLink('', 'IDLE');
    setNow('AWAITING ORDERS');
    setWire('STANDING BY');
    D.tick.textContent = '';
    if (D.tickPrice) D.tickPrice.textContent = '';
    D.elapsed.textContent = 'T+00:00';
    D.lastData.textContent = '';
    drawChart();
    showIdleForm();
    startAttract();
  }

  /* ── SSE event router ─────────────────────────────────────────── */
  function routeEvent(evt) {
    S.lastFrameAt = Date.now();
    blinkLed();
    var type = evt.type || 'message';
    var d = evt.data || {};
    if (type !== 'heartbeat') {
      S.lastDataAt = Date.now();
      logEvt(type, summarize(type, d));
    }
    switch (type) {
      case 'heartbeat': return;
      case 'status':    return onStatus(d);
      case 'report':    return onReport(d);
      case 'debate':    return onDebate(d);
      case 'decision':  return onDecision(d);
      case 'message':   return onMessage(d);
      case 'chunk':     return onChunk(d);
      case 'usage':     return onUsage(d);
      case 'complete':  return onComplete(d);
      case 'error':     return failRun(d.message || 'backend error');
      default:          return onMessage(d);
    }
  }

  function summarize(type, d) {
    if (type === 'report') return (d.node || '?') + ' filed ' + (d.section || 'report');
    if (type === 'debate') return (d.node || '?') + ' — ' + (d.debate_type || 'debate');
    if (type === 'status') return d.message || d.status || 'status';
    if (type === 'decision') return 'signal: ' + (d.signal || '?');
    if (type === 'complete') return 'run complete';
    if (type === 'message') return (d.node || '?') + ': ' + String(d.content || '').slice(0, 80);
    if (type === 'chunk') return (d.node || '?') + ' working [' + (d.keys || []).join(',') + ']';
    return JSON.stringify(d).slice(0, 100);
  }

  function onStatus(d) {
    var msg = d.message || d.status || '';
    setWire(String(msg).toUpperCase());
    if (/running/i.test(d.status || '')) {
      setNow('COUNCIL IN SESSION — ANALYSTS DEPLOYED');
      setStage('analysts', 'active');
    } else {
      setNow(String(msg).toUpperCase());
    }
  }

  function markActivity(node) {
    if (!node) return;
    S.activeNode = node;
    var stg = stageFor(node);
    if (stg) {
      var reached = false;
      STAGES.forEach(function (st) {
        if (st.id === stg) { reached = true; setStage(st.id, S.stages[st.id] === 'done' ? 'done' : 'active'); }
        else if (!reached && S.stages[st.id] === 'active') setStage(st.id, 'done');
      });
    }
    // Tool-call / housekeeping phases: Shinji the Junior Analyst runs
    // the errands — makes "fetching" visibly distinct from "thinking".
    var n = normNode(node);
    if (/^(tools_|msg_clear)/.test(n)) {
      if (!S.typing) showCharacter(EXTRAS.shinji, 'idle');
      setNow(/^tools_/.test(n)
        ? 'NOW: SHINJI PULLS ' + n.replace('tools_', '').toUpperCase() + ' DATA…'
        : 'NOW: SHINJI CLEARS THE DESK…');
      return;
    }
    var seat = seatFor(node);
    if (seat && !S.typing) setPortrait(seat, 'idle');
    var c = seat ? CAST[seat] : null;
    setNow('NOW: ' + String(node).toUpperCase() + (c ? ' (' + c.name.toUpperCase() + ')' : ''));
  }

  function onMessage(d) {
    markActivity(d.node);
    var snip = String(d.content || '').replace(/\s+/g, ' ').trim();
    if (snip) setWire((d.node ? String(d.node).toUpperCase() + '▸ ' : '') + snip.slice(0, 160));
  }

  function onChunk(d) { markActivity(d.node); }

  function onReport(d) {
    markActivity(d.node);
    var section = d.section || 'report';
    var seat = seatFor(d.node) || 'judge';
    var title = SECTION_TITLES[section] || section;
    if (section === 'trader_plan' && normNode(d.node) === 'research_manager') title = 'Council Directive';
    var body = String(d.report || '').trim();
    if (!body) return;
    // Track receipt under the ARCHIVE key so a post-complete backfill
    // (after a dropped stream) only restores what we actually missed.
    var archKey = section;
    if (section === 'trader_plan') {
      // Archive JSON keys (trading_graph._log_state): the manager's plan is
      // 'investment_plan', the trader's is 'trader_investment_decision'.
      archKey = normNode(d.node) === 'research_manager' ? 'investment_plan' : 'trader_investment_decision';
    }
    S.gotSections[archKey] = true;
    pushPage({
      key: 'report:' + section + ':' + normNode(d.node) + ':' + body.length,
      kind: 'report', seat: seat,
      title: title,
      sub: (d.node || '').toUpperCase() + ' · FULL REPORT',
      html: mdToHtml(body),
      raw: body,
      exportTitle: title, exportBody: body, node: d.node, section: section,
    });
  }

  function onDebate(d) {
    markActivity(d.node);
    var seat = seatFor(d.node) || 'judge';
    var body = String(d.current_response || d.judge_decision || d.bull_reason || d.bear_reason || '').trim();
    if (!body) return;
    var node = String(d.node || 'Debate');
    var isManagerRuling = /manager/i.test(node) && !d.current_response && !!d.judge_decision;
    var label = (d.debate_type === 'risk' ? 'Risk Chamber' : 'Research Debate');
    // Title = the ACTUAL node speaking (a risk-chamber turn is not the seat's
    // canonical role — Aggressive Analyst shares Balthazar's portrait only).
    var title = node + (isManagerRuling ? ' — Ruling' : '');
    pushPage({
      key: 'debate:' + normNode(node) + ':' + body.slice(0, 60) + ':' + body.length,
      kind: 'debate', seat: seat,
      title: title,
      sub: label.toUpperCase() + ' · ' + (CAST[seat] ? CAST[seat].name.toUpperCase() + ' AT THE PODIUM' : ''),
      html: mdToHtml(body),
      raw: body,
      exportTitle: label + ' — ' + node, exportBody: body, node: node,
    });
  }

  function classifySignal(text) {
    var t = String(text || '');
    var m = t.match(/\b(BUY|SELL|HOLD)\b/i);
    if (m) return m[1].toUpperCase();
    if (/\b(accumulate|overweight|add|long|bullish|increase)\b/i.test(t)) return 'BUY';
    if (/\b(underweight|reduce|trim|exit|short|bearish|decrease|liquidate)\b/i.test(t)) return 'SELL';
    if (/\b(neutral|wait|maintain|stay|pause)\b/i.test(t)) return 'HOLD';
    return '';
  }

  function verdictPage(signal, fullText) {
    var sig = (signal || '').toUpperCase();
    var cls = sig === 'BUY' ? 't98-buy' : sig === 'SELL' ? 't98-sell' : 't98-hold';
    var seal = sig ? '<div style="text-align:center"><span class="t98-seal ' + cls + '">' + esc(sig) + '</span></div>' : '';
    var costLine = S.usage ? '<div class="t98-cost-line">RUN COST ' + esc(fmtCost(S.usage)) + '</div>' : '';
    pushPage({
      key: 'verdict', kind: 'verdict', seat: 'judge',
      title: 'THE RULING', sub: 'PORTFOLIO MANAGER · VERBATIM',
      html: seal + costLine + mdToHtml(fullText || '(no ruling text)'),
      raw: (sig ? '[' + sig + ']\n\n' : '') + (fullText || ''),
      exportTitle: 'Final Ruling (' + (sig || 'see text') + ')', exportBody: fullText || '',
    });
  }

  function onDecision(d) {
    markActivity(d.node || 'portfolio manager');
    setStage('verdict', 'active');
    var full = String(d.final_decision || '').trim();
    var sig = (d.signal || classifySignal(full) || '').toUpperCase();
    S.verdict = { signal: sig || '—', text: full };
    verdictPage(sig, full);
    setWire('VERDICT: ' + (sig || 'SEE RULING'));
  }

  function fmtCost(u) {
    if (!u) return '';
    var cost = (typeof u.cost_usd === 'number') ? u.cost_usd : 0;
    var dollars = cost < 0.01 ? '<$0.01' : '$' + cost.toFixed(2);
    var toks = (u.total_tokens || 0);
    var tokStr = toks >= 1000 ? (toks / 1000).toFixed(0) + 'K' : String(toks);
    return dollars + ' · ' + (u.llm_calls || 0) + ' LLM calls · ' + tokStr + ' tokens' +
      (u.cached_tokens ? ' (' + Math.round(u.cached_tokens / Math.max(1, u.prompt_tokens) * 100) + '% cached)' : '');
  }

  function onUsage(d) {
    if (!d) return;
    S.usage = d;
    // Live cost readout in the HUD meta row.
    if (D.cost) D.cost.textContent = 'COST ' + ((d.cost_usd || 0) < 0.01 ? '<$0.01' : '$' + Number(d.cost_usd).toFixed(2));
    logEvt('sys', 'run cost ' + fmtCost(d));
  }

  function onComplete(d) {
    var res = (d && d.result) || {};
    if (!S.usage && res.usage) onUsage(res.usage);
    if (!S.verdict) {
      var full = String(res.decision || '').trim();
      var sig = (res.signal || classifySignal(full) || '').toUpperCase();
      S.verdict = { signal: sig || '—', text: full };
      if (full) verdictPage(sig, full);
    }
    finishRun();
    // The SSE queue is exactly-once: if the stream dropped mid-run
    // (sleep, network), everything already drained is gone and a
    // reconnect only yields this synthesized terminal frame. The full
    // report JSON exists on disk by now — recover what we missed.
    backfillFromArchive(res.ticker || S.ticker, res.date || S.date);
  }

  var ARCHIVE_SECTIONS = [
    ['market_report', 'Market Recon', 'market'],
    ['sentiment_report', 'Sentiment Sweep', 'social'],
    ['news_report', 'News Wire', 'news'],
    ['fundamentals_report', 'Fundamentals Audit', 'fundamentals'],
    ['investment_plan', 'Council Directive', 'judge'],
    ['trader_investment_decision', "Trader's Plan", 'trader'],
  ];

  function backfillFromArchive(ticker, date) {
    if (!ticker || !date) return;
    if (!S.prices || !S.prices.series) { S.ticker = S.ticker || ticker; fetchPrices(ticker, date); }
    var missing = ARCHIVE_SECTIONS.filter(function (s) { return !S.gotSections[s[0]]; });
    var needVerdict = !S.verdict || !String(S.verdict.text || '').trim();
    if (!missing.length && !needVerdict) return;
    fetch(withToken('/reports/' + encodeURIComponent(ticker) + '/' + encodeURIComponent(date)))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        var added = 0;
        missing.forEach(function (s) {
          var v = j[s[0]];
          if (!v || !String(v).trim()) return;
          // Content dedupe: the same text may already be on screen under a
          // different page key (e.g. a ruling that arrived as a debate frame).
          var text = String(v).trim();
          var dupe = S.pages.some(function (p) { return p.exportBody && p.exportBody.trim() === text; });
          if (dupe) { S.gotSections[s[0]] = true; return; }
          S.gotSections[s[0]] = true;
          pushPage({
            key: 'backfill:' + s[0],
            kind: 'report', seat: s[2], title: s[1],
            sub: (ticker + ' · ' + date + ' · RECOVERED FROM ARCHIVE'),
            html: mdToHtml(String(v)),
            raw: String(v),
            exportTitle: s[1], exportBody: String(v),
          });
          added++;
        });
        var fd = j.final_trade_decision;
        if (needVerdict && fd && String(fd).trim()) {
          var sig = classifySignal(String(fd));
          S.verdict = { signal: sig || '—', text: String(fd) };
          verdictPage(sig, String(fd));
          added++;
        }
        if (added) {
          setWire('ARCHIVE SYNC — RECOVERED ' + added + ' MISSED PAGE' + (added > 1 ? 'S' : ''));
          logEvt('sys', 'backfilled ' + added + ' pages from /reports/' + ticker + '/' + date);
          renderDialogButtons();
        }
      })
      .catch(function () { /* archive not there yet — nothing to recover */ });
  }

  /* ── HUD helpers ──────────────────────────────────────────────── */
  function setStage(id, state) {
    S.stages[id] = state;
    var seg = D.stageSegs[id];
    if (!seg) return;
    seg.classList.remove('t98-active', 't98-done', 't98-error');
    if (state === 'active') seg.classList.add('t98-active');
    if (state === 'done') seg.classList.add('t98-done');
    if (state === 'error') seg.classList.add('t98-error');
  }
  function stageOfActivity() {
    for (var i = 0; i < STAGES.length; i++) if (S.stages[STAGES[i].id] === 'active') return STAGES[i].id;
    return null;
  }
  function setNow(text) { D.hudNow.textContent = text; }
  function setWire(text) { S.wireText = text; D.wireText.textContent = text; }
  function setLink(cls, text) {
    D.led.className = 't98-led' + (cls ? ' ' + cls : '');
    D.linkText.textContent = text;
  }
  function blinkLed() {
    if (S.mode !== 'running') return;
    D.led.classList.add('on');
    clearTimeout(timers.heartbeatOff);
    timers.heartbeatOff = setTimeout(function () {
      if (S.mode === 'running') D.led.classList.remove('on');
    }, 260);
  }
  function tickClock() {
    D.clock.textContent = nowHMS();
    if (S.mode === 'running' && S.startedAt) {
      D.elapsed.textContent = 'T+' + fmtElapsed(Date.now() - S.startedAt);
      if (S.lastDataAt) {
        var ago = Math.floor((Date.now() - S.lastDataAt) / 1000);
        D.lastData.textContent = 'DATA ' + (ago < 3 ? 'NOW' : fmtElapsed(ago * 1000) + ' AGO');
      }
      // active seat keeps "breathing" while we wait
      D.advisor.classList.toggle('t98-thinking', !S.typing);
    }
  }
  function logEvt(type, text) {
    S.log.push({ ts: nowHMS(), type: type, text: text });
    if (S.log.length > 400) S.log.shift();
    var lw = document.getElementById('t98-log-body');
    if (lw) {
      lw.appendChild(logLine(S.log[S.log.length - 1]));
      while (lw.children.length > 400) lw.removeChild(lw.firstChild);
      lw.scrollTop = lw.scrollHeight;
    }
  }
  function logLine(e) {
    var row = el('div', 't98-log-line' + (e.type === 'error' ? ' t98-log-err' : ''));
    row.appendChild(el('span', 't98-log-ts', esc(e.ts)));
    row.appendChild(el('span', 't98-log-type', esc(e.type)));
    row.appendChild(el('span', 't98-log-text', esc(e.text)));
    return row;
  }

  /* ── floating windows ─────────────────────────────────────────── */
  function closeWindows() {
    Array.prototype.slice.call(document.querySelectorAll('.t98-window')).forEach(function (w) { w.remove(); });
  }
  function openWindow(title, id) {
    closeWindows();
    var w = el('div', 't98-window');
    w.style.right = '24px';
    w.style.top = '58px';
    var tt = el('div', 't98-window-title');
    tt.appendChild(el('span', '', esc(title)));
    var x = el('button', 't98-window-close', '✕ ESC');
    x.addEventListener('click', closeWindows);
    tt.appendChild(x);
    var body = el('div', 't98-window-body');
    if (id) body.id = id;
    w.appendChild(tt); w.appendChild(body);
    D.root.appendChild(w);
    return body;
  }

  function onMenu(which) {
    if (which === 'summon') {
      if (S.mode === 'running') return;
      closeWindows();
      resetToIdle();
    } else if (which === 'index') {
      var b = openWindow('REPORT INDEX — ' + (S.ticker || 'SESSION'), '');
      if (!S.pages.length) b.appendChild(el('div', '', 'NO PAGES YET — REPORTS LAND HERE AS THEY ARRIVE.'));
      S.pages.forEach(function (p, i) {
        var it = el('button', 't98-index-item');
        var whoName = p.character ? p.character.name : (p.seat && CAST[p.seat] ? CAST[p.seat].name : 'SYS');
        it.appendChild(el('span', 't98-idx-seat', esc(whoName)));
        it.appendChild(el('span', '', esc(p.title) + ' <span style="opacity:.6">' + esc(p.ts || '') + '</span>'));
        if (p.unread) it.appendChild(el('span', 't98-idx-new', '● NEW'));
        it.addEventListener('click', function () {
          closeWindows(); S.auto = false; showPage(i); renderDialogButtons();
        });
        b.appendChild(it);
      });
    } else if (which === 'log') {
      var lb = openWindow('EVENT LOG — RAW WIRE', 't98-log-body');
      if (!S.log.length) lb.appendChild(el('div', '', 'NO EVENTS YET.'));
      S.log.forEach(function (e) { lb.appendChild(logLine(e)); });
      lb.scrollTop = lb.scrollHeight;
    } else if (which === 'archive') {
      openArchive();
    } else if (which === 'export') {
      exportSession();
    } else if (which === 'adv') {
      try { localStorage.setItem('tradingagents_ui_mode', 'adv'); } catch (e) {}
      location.reload();
    }
  }

  /* ── archive (past runs via /reports) ─────────────────────────── */
  function openArchive() {
    var b = openWindow('ARCHIVE — PAST COUNCIL SESSIONS', '');
    b.appendChild(el('div', '', 'FETCHING LEDGER…'));
    if (!S.typing && S.mode !== 'running') {
      showCharacter(EXTRAS.hojo, 'idle');
      setWire('HOJO OPENS THE RECORDS — “' + EXTRAS.hojo.quote + '”');
    }
    fetch(withToken('/reports')).then(function (r) {
      if (!r.ok) throw new Error(r.status === 403 ? 'ACCESS DENIED (403) — token rejected' : 'HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      b.innerHTML = '';
      var reps = (j && j.reports) || [];
      if (!reps.length) { b.appendChild(el('div', '', 'NO ARCHIVED SESSIONS ON THIS MACHINE.')); return; }
      reps.slice(0, 60).forEach(function (r) {
        var it = el('button', 't98-index-item');
        it.appendChild(el('span', 't98-idx-seat', esc(r.ticker)));
        it.appendChild(el('span', '', esc(r.date)));
        it.addEventListener('click', function () { loadArchived(r.ticker, r.date); });
        b.appendChild(it);
      });
    }).catch(function (e) {
      b.innerHTML = '';
      b.appendChild(el('div', '', 'ARCHIVE UNAVAILABLE: ' + esc(e.message)));
    });
  }

  function loadArchived(ticker, date) {
    if (S.mode === 'running') { setWire('RUN IN PROGRESS — ARCHIVE LOCKED UNTIL THE COUNCIL ADJOURNS'); return; }
    closeWindows();
    stopAttract();
    fetch(withToken('/reports/' + encodeURIComponent(ticker) + '/' + encodeURIComponent(date)))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        stopTyping();
        S.mode = 'done';
        S.ticker = ticker; S.date = date;
        S.pages = []; S.pageIdx = -1; S.seenPageKeys = {}; S.gotSections = {}; S.auto = false;
        S.verdict = null;
        D.tick.textContent = ticker + ' · ' + date + ' · ARCHIVE';
        setLink('', 'ARCHIVE');
        setNow('READING ARCHIVED SESSION ' + ticker + ' ' + date);
        setWire('ARCHIVE LOADED — USE INDEX / PREV / NEXT');
        STAGES.forEach(function (st) { setStage(st.id, 'done'); });
        ARCHIVE_SECTIONS.forEach(function (s) {
          var v = j[s[0]];
          if (v && String(v).trim()) {
            pushPage({
              kind: 'report', seat: s[2], title: s[1],
              sub: ticker + ' · ' + date + ' · ARCHIVE',
              html: mdToHtml(String(v)),
              raw: String(v),
              exportTitle: s[1], exportBody: String(v),
            });
          }
        });
        var fd = j.final_trade_decision;
        if (fd && String(fd).trim()) {
          var sig = classifySignal(String(fd));
          S.verdict = { signal: sig || '—', text: String(fd) };
          verdictPage(sig, String(fd));
        }
        if (S.pages.length) { S.auto = false; showPage(0); }
        else setWire('ARCHIVE ENTRY EMPTY');
        fetchPrices(ticker, date);
        renderDialogButtons();
      })
      .catch(function (e) {
        setWire('ARCHIVE READ FAILED: ' + e.message);
      });
  }

  /* ── export ───────────────────────────────────────────────────── */
  function exportSession() {
    if (!S.pages.length) { setWire('NOTHING TO EXPORT YET'); return; }
    var md = ['# Trading Agents — Council Session', '', '- **Ticker:** ' + (S.ticker || '?'), '- **Date:** ' + (S.date || '?')];
    if (S.verdict) md.push('- **Signal:** ' + S.verdict.signal);
    md.push('', '---', '');
    S.pages.forEach(function (p) {
      if (!p.exportBody) return;
      md.push('## ' + (p.exportTitle || p.title), '', p.exportBody, '', '---', '');
    });
    var blob = new Blob([md.join('\n')], { type: 'text/markdown' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (S.ticker || 'session') + '-' + (S.date || 'export') + '-council.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    setWire('EXPORTED ' + a.download);
  }

  /* ── price chart backdrop ─────────────────────────────────────── */
  function fetchPrices(ticker, date) {
    S.prices = null;
    if (D.tickPrice) D.tickPrice.textContent = '';
    drawChart();
    fetch(withToken('/reports/prices/' + encodeURIComponent(ticker) + '?date=' + encodeURIComponent(date) + '&days=150'))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (j && j.series && j.series.length > 1 && j.ticker === S.ticker) {
          S.prices = j;
          drawChart();
        }
      })
      .catch(function () {
        // Stale-ticker guard (mirrors the success path): a slow failing
        // request must not clobber a newer run's chart.
        if (S.ticker === ticker) { S.prices = { error: true, ticker: ticker }; drawChart(); }
      });
  }

  function drawChart() {
    var cv = D.chart;
    if (!cv) return;
    var host = cv.parentNode;
    if (!host) return;
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    // grid
    g.strokeStyle = 'rgba(13, 51, 69, 0.75)';
    g.lineWidth = 1;
    g.setLineDash([2, 5]);
    var gx;
    for (gx = 40; gx < w; gx += 90) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, h); g.stroke(); }
    for (gx = 30; gx < h; gx += 60) { g.beginPath(); g.moveTo(0, gx); g.lineTo(w, gx); g.stroke(); }
    g.setLineDash([]);

    var P = S.prices;
    g.font = '14px VT323, monospace';
    if (!P || !P.series) {
      g.fillStyle = 'rgba(27, 106, 118, 0.9)';
      g.fillText(P && P.error ? '─ NO PRICE FEED ─' : (S.mode === 'idle' ? '─ AWAITING TICKER ─' : '─ FETCHING FEED ─'), 46, h - 24);
      return;
    }
    var ser = P.series;
    var pad = { l: 40, r: 70, t: 40, b: 70 };
    var min = Infinity, max = -Infinity, vmax = 0, i;
    for (i = 0; i < ser.length; i++) {
      if (ser[i].l < min) min = ser[i].l;
      if (ser[i].h > max) max = ser[i].h;
      if (ser[i].v > vmax) vmax = ser[i].v;
    }
    if (!isFinite(min) || max <= min) return;
    var span = max - min;
    min -= span * 0.06; max += span * 0.06;
    function X(idx) { return pad.l + (idx / (ser.length - 1)) * (w - pad.l - pad.r); }
    function Y(price) { return pad.t + (1 - (price - min) / (max - min)) * (h - pad.t - pad.b); }

    // volume bars
    var bw = Math.max(1.5, (w - pad.l - pad.r) / ser.length - 2);
    if (vmax > 0) {
      g.fillStyle = 'rgba(27, 106, 118, 0.35)';
      for (i = 0; i < ser.length; i++) {
        var vh = (ser[i].v / vmax) * 44;
        g.fillRect(X(i) - bw / 2, h - pad.b + 52 - vh, bw, vh);
      }
    }

    // candlesticks (style-sheet palette: green up / red down) with a
    // faint magenta close-line behind them for the phosphor trace
    g.strokeStyle = 'rgba(224, 96, 200, 0.30)';
    g.lineWidth = 1;
    g.beginPath();
    for (i = 0; i < ser.length; i++) { i ? g.lineTo(X(i), Y(ser[i].c)) : g.moveTo(X(i), Y(ser[i].c)); }
    g.stroke();
    for (i = 0; i < ser.length; i++) {
      var s = ser[i], up = s.c >= s.o;
      var col = up ? '#4ade80' : '#f4506c';
      g.strokeStyle = col;
      g.fillStyle = up ? 'rgba(74, 222, 128, 0.55)' : 'rgba(244, 80, 108, 0.65)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(X(i), Y(s.h)); g.lineTo(X(i), Y(s.l)); g.stroke();
      var top = Y(Math.max(s.o, s.c));
      var bh = Math.max(1, Y(Math.min(s.o, s.c)) - top);
      g.fillRect(X(i) - bw / 2, top, bw, bh);
      g.strokeRect(X(i) - bw / 2, top, bw, bh);
    }

    // last-price tag + range labels (+ topbar readout, style-sheet style)
    var last = ser[ser.length - 1], first = ser[0];
    var chg = ((last.c - first.c) / first.c) * 100;
    var dayChg = ser.length > 1 ? ((last.c - ser[ser.length - 2].c) / ser[ser.length - 2].c) * 100 : 0;
    if (D.tickPrice) {
      D.tickPrice.innerHTML = esc(P.ticker) + ' ' + last.c.toFixed(2) +
        ' <span style="color:' + (dayChg >= 0 ? 'var(--t98-green)' : 'var(--t98-red)') + '">' +
        (dayChg >= 0 ? '▲+' : '▼') + dayChg.toFixed(2) + '%</span>';
    }
    g.fillStyle = '#8ff5ef';
    g.fillText(last.c.toFixed(2), w - pad.r + 6, Y(last.c) + 4);
    g.fillStyle = chg >= 0 ? '#4ade80' : '#f4506c';
    g.fillText((chg >= 0 ? '▲ +' : '▼ ') + chg.toFixed(1) + '%', w - pad.r + 6, Y(last.c) + 20);
    g.fillStyle = 'rgba(67, 217, 217, 0.8)';
    g.fillText(P.ticker + ' · ' + first.date + ' → ' + last.date, pad.l + 4, 24);
    g.fillStyle = 'rgba(27, 106, 118, 0.9)';
    g.fillText(max.toFixed(0), 6, pad.t + 8);
    g.fillText(min.toFixed(0), 6, h - pad.b);

    // scanline sweep marker at latest candle
    g.strokeStyle = 'rgba(143, 245, 239, 0.35)';
    g.setLineDash([3, 4]);
    g.beginPath(); g.moveTo(X(ser.length - 1), pad.t); g.lineTo(X(ser.length - 1), h - pad.b + 52); g.stroke();
    g.setLineDash([]);
  }

  /* ── keyboard ─────────────────────────────────────────────────── */
  function onKey(e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var k = e.code || e.key; // e.code is layout/alias-proof (Space vs ' ')
    if (k === 'Escape') { closeWindows(); return; }
    if (k === 'Space' || k === 'Enter' || e.key === ' ') {
      if (S.typing) { e.preventDefault(); S.typing.skip(); return; }
      if (S.pageIdx < S.pages.length - 1) { e.preventDefault(); S.auto = false; showPage(S.pageIdx + 1); }
      return;
    }
    if ((k === 'ArrowLeft' || e.key === 'Left') && S.pageIdx > 0) { S.auto = false; showPage(S.pageIdx - 1); }
    if ((k === 'ArrowRight' || e.key === 'Right') && S.pageIdx < S.pages.length - 1) { S.auto = false; showPage(S.pageIdx + 1); }
  }

  /* ── QA hooks ─────────────────────────────────────────────────── */
  window.__terminalInject = function (evt) { routeEvent(evt); };
  window.__terminalState = function () {
    return {
      mode: S.mode, ticker: S.ticker, jobId: S.jobId,
      pages: S.pages.map(function (p) { return { title: p.title, kind: p.kind, seat: p.seat, unread: !!p.unread }; }),
      pageIdx: S.pageIdx, stages: JSON.parse(JSON.stringify(S.stages)),
      activeNode: S.activeNode, verdict: S.verdict, logCount: S.log.length,
      hasPrices: !!(S.prices && S.prices.series),
    };
  };

  /* ── intro / title screen (PC-98 box art boot) ────────────────── */
  function showIntro() {
    if (document.getElementById('t98-intro')) return;
    var ov = el('div');
    ov.id = 't98-intro';
    ov.innerHTML =
      '<div class="t98-intro-bios" id="t98-intro-bios"></div>' +
      '<img class="t98-intro-art" src="design/pc98-boxart.jpg" alt="Trading Agents — an AI Hedge Fund Simulator">' +
      '<div class="t98-intro-press" id="t98-intro-press">PRESS ANY KEY</div>' +
      '<div class="t98-intro-foot">FNC-9801 · COUNCIL TERMINAL · BUILT ON TRADINGAGENTS © TAURIC RESEARCH</div>';
    D.root.appendChild(ov);

    // BIOS POST lines, then the blinking prompt
    var bios = ['TRADINGAGENTS SYSTEMS 98 BIOS v1.0', 'MAIN MEMORY CHECK .... 640K OK', 'COUNCIL SEATS ........ 8 OK', 'LOADING TITLE ........'];
    var bel = document.getElementById('t98-intro-bios');
    bios.forEach(function (line, i) {
      setTimeout(function () { if (bel) bel.textContent += line + '\n'; }, REDUCED_MOTION ? 0 : 160 * i);
    });
    setTimeout(function () {
      var p = document.getElementById('t98-intro-press');
      if (p) p.classList.add('t98-on');
    }, REDUCED_MOTION ? 0 : 1500);

    function onAnyKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // keep shortcuts alive
      e.preventDefault();
      e.stopPropagation();
      dismissIntro();
    }
    document.addEventListener('keydown', onAnyKey, true);
    ov.addEventListener('click', dismissIntro);
    S.introCleanup = function () { document.removeEventListener('keydown', onAnyKey, true); };
    // Never trap a walk-away viewer (or the demo driver) on the title.
    timers.intro = setTimeout(dismissIntro, 12000);
  }

  function dismissIntro() {
    var ov = document.getElementById('t98-intro');
    if (!ov) return;
    clearTimeout(timers.intro);
    if (S.introCleanup) { S.introCleanup(); S.introCleanup = null; }
    // Mount the briefing BEFORE the title's power-off animation removes the
    // overlay: the replay driver holds while either screen is present, so
    // there must never be a frame with neither on the DOM.
    showBriefing();
    if (REDUCED_MOTION) {
      ov.remove();
      return;
    }
    ov.classList.add('t98-intro-off'); // CRT power-off collapse
    setTimeout(function () { ov.remove(); }, 500);
  }
  window.__terminalDismissIntro = dismissIntro;

  /* ── briefing / operation manual (between title and terminal) ──── */
  function showBriefing() {
    if (S.briefShown) return;
    S.briefShown = true;
    var ov = el('div');
    ov.id = 't98-brief';
    ov.innerHTML =
      '<div class="t98-brief-win">' +
        '<div class="t98-brief-title">OPERATION MANUAL — COUNCIL TERMINAL</div>' +
        '<div class="t98-brief-body">' +
          '<div class="t98-brief-h">&#9632; THE COUNCIL</div>' +
          '<div class="t98-brief-p">EIGHT AI AGENTS — FOUR ANALYSTS, BULL &amp; BEAR RESEARCHERS, A RISK DESK, AND A HIGH JUDGE — DEBATE ONE STOCK AND RULE: BUY / SELL / HOLD.</div>' +
          '<div class="t98-brief-h">&#9632; THIS SESSION</div>' +
          '<div class="t98-brief-p">A GENUINE RECORDED RUN (AAPL), REPLAYED THROUGH THE LIVE TERMINAL. NO BACKEND &middot; NO API KEYS &middot; NOT FINANCIAL ADVICE. SELF-HOSTED, THE SAME TERMINAL RUNS LIVE.</div>' +
          '<div class="t98-brief-h">&#9632; CONTROLS</div>' +
          '<div class="t98-brief-p t98-brief-keys">' +
            'SPACE / ENTER .... SKIP TYPING &middot; NEXT PAGE<br>' +
            '&#9664; &#9654; ................. FLIP PAGES &nbsp;&nbsp; ESC .... CLOSE WINDOWS<br>' +
            'MENU: REPLAY RESTARTS THE SESSION</div>' +
        '</div>' +
        '<div class="t98-brief-press">&#9654; PRESS ANY KEY TO CONVENE THE COUNCIL</div>' +
      '</div>';
    D.root.appendChild(ov);

    function onAnyKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      dismissBriefing();
    }
    document.addEventListener('keydown', onAnyKey, true);
    ov.addEventListener('click', dismissBriefing);
    S.briefCleanup = function () { document.removeEventListener('keydown', onAnyKey, true); };
    // Same walk-away rule as the title: never hold the demo hostage.
    timers.brief = setTimeout(dismissBriefing, 14000);
  }

  function dismissBriefing() {
    var ov = document.getElementById('t98-brief');
    if (!ov) return;
    clearTimeout(timers.brief);
    if (S.briefCleanup) { S.briefCleanup(); S.briefCleanup = null; }
    if (REDUCED_MOTION) {
      ov.remove();
      return;
    }
    ov.classList.add('t98-intro-off'); // reuse the CRT power-off collapse
    setTimeout(function () { ov.remove(); }, 500);
  }
  window.__terminalDismissBriefing = dismissBriefing;

  /* ── boot ─────────────────────────────────────────────────────── */
  function boot() {
    buildUI();
    resetToIdle();
    showIntro();
    // Preload the cast so the first testimony doesn't flash.
    Object.keys(CAST).forEach(function (k) {
      var im = new Image();
      im.src = CAST_DIR + CAST[k].img;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
