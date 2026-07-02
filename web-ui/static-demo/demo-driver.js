/* Traders of the Round Table — Standalone Battle Demo Driver
   ───────────────────────────────────────────────────────────
   Replays a canned event sequence with the exact same envelope the
   TradingAgents backend streams over SSE:

     { "type": "status"|"report"|"debate"|"decision"|"message"|"complete",
       "data": { "node": ..., ... }, "timestamp": ... }

   castle-council.js (ADV / Pokemon-Battle Edition) is loaded AFTER this
   file and wraps window.EventSource + window.fetch with its live wiring.
   We install a no-network FakeEventSource and an /analyze fetch stub
   first, so the council's own hooks see a "live" backend:

     fetch('./api/analyze')  -> council hook: deliberation + VS intro
     new EventSource(...)    -> council hook: wraps addEventListener so
                                every dispatched MessageEvent fans out to
                                window.__sseListeners (council + audio).

   castle-council.js itself is byte-identical to the committed app. */
(function(){
'use strict';

// ════════════════════════════════════════════════════════════
// 1. NETWORK SHIMS — must run before castle-council.js loads
// ════════════════════════════════════════════════════════════

var realFetch = window.fetch.bind(window);

class FakeEventSource extends EventTarget {
  constructor(url){
    super();
    this.url = String(url || '');
    this.readyState = FakeEventSource.OPEN;
    this.withCredentials = false;
    this.onmessage = null;
    this.onerror = null;
    this.onopen = null;
  }
  close(){ this.readyState = FakeEventSource.CLOSED; }
}
FakeEventSource.CONNECTING = 0;
FakeEventSource.OPEN = 1;
FakeEventSource.CLOSED = 2;

window.EventSource = FakeEventSource;

window.fetch = function(input, init){
  var url = (typeof input === 'string') ? input : ((input && input.url) || '');
  if (/\/analyze/.test(url)){
    return new Promise(function(resolve){
      setTimeout(function(){
        resolve(new Response(
          JSON.stringify({ job_id: 'demo-' + Math.random().toString(36).slice(2, 8), status: 'queued' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }, 250);
    });
  }
  return realFetch(input, init);
};

// ════════════════════════════════════════════════════════════
// 2. THE CANNED SCRIPT — one debate, ends in a BUY verdict
//    {T} is replaced with the active ticker at run time.
//    "speech" steps wait text.length * 22ms (the council's
//    typewriter pace) before the next beat fires.
// ════════════════════════════════════════════════════════════

var DEMO_DATE = '2026-06-10';

function buildSteps(){
  return [
    // ── backend lifecycle statuses (exact live messages) ──
    { pause: 900,  type:'status', data:{ message:'Starting analysis for {T} on ' + DEMO_DATE, status:'initializing' } },
    { pause: 1200, type:'status', data:{ message:'Building graph...', status:'building' } },
    { pause: 1700, type:'status', data:{ message:'Graph ready. Resolving pending entries...', status:'preparing' } },

    // ── research phase: the four analysts testify (solo views) ──
    { pause: 1100, speech:true, type:'message', data:{ node:'Market Analyst',
      content:'Consulting the tape — fetching price scrolls and volume runes for {T}…' } },

    { pause: 1500, speech:true, type:'report', data:{ node:'Market Analyst', section:'market_report',
      report:'The tape shows {T} marching above its 50-day banner, but the RSI wanes near 68 and volume thins on each new high. Momentum cools at the castle gates — a pullback toward the $135 rampart would not surprise me.' } },

    { pause: 1500, speech:true, type:'report', data:{ node:'Sentiment Analyst', section:'sentiment_report',
      report:'The town square hums with {T} chatter — mentions doubled this fortnight. Retail crowds cheer the rally, yet the wisest whisper of crowded trades. Seventy-two of one hundred voices lean to the bull side.' } },

    { pause: 1500, speech:true, type:'report', data:{ node:'News Analyst', section:'news_report',
      report:'Hear ye! Record data-center contracts are signed, and three great houses raise their price targets. Export winds blow colder from the East, yet growth tidings outnumber the storms — the upside drum beats louder.' } },

    { pause: 1500, speech:true, type:'report', data:{ node:'Fundamentals Analyst', section:'fundamentals_report',
      report:'The ledgers gleam: revenue swells 62% year over year, margins hold near 75%, and the war chest brims with gold. Earnings growth of this caliber can carry a princely multiple higher. The foundation is granite.' } },

    // ── signals end of deliberation: council transitions from
    //     COUNCIL CONVENES → live-in-session state ──
    { pause: 600,  type:'status', data:{ message:'Graph running — streaming nodes now.', status:'running' } },

    // ── the debate: Balthazar (Bull) vs Morwen (Bear), Aldric presiding ──
    { pause: 800, speech:true, type:'message', data:{ node:'aldric',
      content:'The testimony is closed. Balthazar and Morwen — approach the circle. Let the debate begin.' } },

    { pause: 1400, speech:true, type:'debate', data:{ node:'balthazar', debate_type:'investment', judge_decision:'',
      current_response:'Every kingdom races to raise AI citadels, and demand for the engines of {T} outpaces supply through next harvest. The growth story is not finished — I say we ride the bull while the forge burns hot.' } },

    { pause: 700, speech:true, type:'message', data:{ node:'aldric',
      content:'Morwen of the Risk Watch, your rebuttal.' } },

    { pause: 1400, speech:true, type:'debate', data:{ node:'morwen', debate_type:'investment', judge_decision:'',
      current_response:'Bold words for a stock priced beyond perfection. One soft guidance scroll and the downside yawns wide — a correction sleeps lightly at these heights. Export decrees and rival forges sharpen the bear case.' } },

    { pause: 700, speech:true, type:'message', data:{ node:'aldric',
      content:'Balthazar, answer the charge.' } },

    { pause: 1400, speech:true, type:'debate', data:{ node:'balthazar', debate_type:'investment', judge_decision:'',
      current_response:'Yet every dip this year was bought by noon, my lady. The hyperscaler lords have pledged their gold for two more years out. I call upside: buy the fear, harvest the growth — the long road still climbs higher.' } },

    { pause: 700, speech:true, type:'message', data:{ node:'aldric',
      content:'A final word from the Risk Watch, then I shall rule.' } },

    { pause: 1400, speech:true, type:'debate', data:{ node:'morwen', debate_type:'investment', judge_decision:'',
      current_response:'Then feast, but guard the gates. Size the position with care, set the stop beneath the $128 moat, and sell a measure into strength. Even the mightiest bull must respect the drawbridge — ruin spares no one.' } },

    // ── the trader turns conviction into a campaign ──
    { pause: 800, speech:true, type:'message', data:{ node:'aldric',
      content:'Enough. Kael — turn conviction into a campaign.' } },

    { pause: 1500, speech:true, type:'report', data:{ node:'Trader', section:'trader_plan',
      report:'The council leans bull, so here is the campaign: enter half a position at market, add on any retreat to $135, keep the stop below $128. First profits come off at $160. We buy strength — never without a shield.' } },

    // ── the ruling ──
    { pause: 1600, speech:true, type:'debate', data:{ node:'research manager', debate_type:'investment', current_response:'',
      judge_decision:'The council has heard the testimony. The forge burns hot, the ledgers are sound, and fear is the only discount on offer. The bull case carries the day, with the shield of Kael raised. The ruling of this council: BUY.' } },

    { pause: 1400, type:'decision', data:{ node:'Risk Judge', signal:'BUY',
      final_decision:'BUY — enter half now, add at $135, stop $128, first target $160.' },
      run: applyVerdictChrome },

    // result.decision deliberately carries no BUY/SELL/HOLD token: the
    // council already rendered the banner from the decision event, and a
    // second match here would overwrite the judge's rationale snippet.
    { pause: 0, type:'complete', data:{ message:'Analysis complete',
      result:{ ticker:'{T}', date: DEMO_DATE, decision:'Final ruling recorded in the chronicle.', signal:'BUY' } } }
  ];
}

// ════════════════════════════════════════════════════════════
// 3. REPLAY ENGINE
// ════════════════════════════════════════════════════════════

var state = { timer: null, es: null, ticker: 'NVDA', running: false, phase: 'awaiting' };  // 'awaiting' | 'trial' | 'verdict'

function speechText(step){
  var d = step.data || {};
  return d.report || d.content || d.current_response || d.judge_decision || d.final_decision || '';
}

function withTicker(value, ticker){
  if (typeof value === 'string') return value.replace(/\{T\}/g, ticker);
  if (value && typeof value === 'object'){
    var out = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach(function(k){ out[k] = withTicker(value[k], ticker); });
    return out;
  }
  return value;
}

function stop(){
  if (state.timer){ clearTimeout(state.timer); state.timer = null; }
  if (state.es){ try { state.es.close(); } catch(e){} state.es = null; }
  state.running = false;
}

function emit(es, step, ticker){
  var envelope = {
    type: step.type,
    data: withTicker(step.data, ticker),
    timestamp: Date.now() / 1000
  };
  es.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(envelope) }));
  if (typeof step.run === 'function'){
    try { step.run(); } catch(e){ console.warn('[demo] step effect failed', e); }
  }
}

function schedule(es, steps, ticker){
  var i = 0;
  state.running = true;
  function next(){
    if (es !== state.es) return;             // a newer run replaced this one
    if (i >= steps.length){ state.running = false; state.timer = null; return; }
    var step = steps[i++];
    emit(es, step, ticker);
    var delay = step.pause;
    if (step.speech) delay += withTicker(speechText(step), ticker).length * 22;
    state.timer = setTimeout(next, delay);
  }
  state.timer = setTimeout(next, 400);
}

function run(ticker){
  stop();
  state.ticker = (ticker || 'NVDA').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 10) || 'NVDA';
  resetVerdictChrome();

  // Transition to trial phase (handles greeter teardown + trial chrome reveal)
  setPhase('trial');

  // Goes through the council's fetch hook: starts the deliberation
  // overlay, sets the ticker chip, and queues the VS intro.
  window.fetch('./api/analyze?token=demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: state.ticker,
      date: DEMO_DATE,
      analysts: ['market', 'social', 'news', 'fundamentals'],
      research_depth: 1
    })
  }).then(function(r){ return r.json(); }).then(function(job){
    // Goes through the council's EventSource hook: our addEventListener
    // registration below is wrapped so every dispatched MessageEvent
    // fans out to window.__sseListeners.
    var es = new window.EventSource('./api/stream/' + job.job_id + '?token=demo');
    es.addEventListener('message', function(){ /* fan-out happens in the council wrapper */ });
    state.es = es;
    schedule(es, buildSteps(), state.ticker);
  });
}

// ════════════════════════════════════════════════════════════
// 4. STATE MACHINE — three-phase intro flow
// ════════════════════════════════════════════════════════════

/* fadeIn / fadeOut helpers.
   show: set display to '', then rAF to opacity 1 to trigger CSS transition.
   hide: set opacity to 0, then on transitionend set display to 'none'.
   For elements without a CSS transition, instant toggle. */
function fadeOut(el, then){
  if (!el) return;
  el.style.opacity = '0';
  // If the element has no transition, call then immediately
  var hasTransition = window.getComputedStyle(el).transitionDuration !== '0s';
  if (!hasTransition){
    el.style.display = 'none';
    if (then) then();
    return;
  }
  var done = false;
  function onEnd(){
    if (done) return;
    done = true;
    el.removeEventListener('transitionend', onEnd);
    el.style.display = 'none';
    if (then) then();
  }
  el.addEventListener('transitionend', onEnd);
  // Safety timeout in case transitionend doesn't fire
  setTimeout(function(){
    if (!done){ onEnd(); }
  }, 500);
}

function fadeIn(el, display){
  if (!el) return;
  el.style.display = display || '';
  // Force layout so the browser registers the display change before opacity
  el.offsetHeight;
  el.style.opacity = '1';
}

function setPhase(phase){
  var prev = state.phase;
  state.phase = phase;

  if (phase === 'awaiting'){
    // Non-dialogue status updates can be immediate
    var cursor = document.getElementById('adv-dialogue-cursor');
    var advance = document.getElementById('adv-dialogue-advance');
    if (cursor) cursor.style.display = 'none';
    if (advance) advance.style.display = 'none';
    // Status strip
    var tickerEl = document.getElementById('adv-ticker');
    var turnEl = document.getElementById('adv-turn-counter');
    if (tickerEl) tickerEl.textContent = '\u2014';
    if (turnEl) turnEl.textContent = 'AWAITING CHALLENGE';
    // Live text
    var liveText = document.getElementById('adv-live-text');
    if (liveText) liveText.textContent = 'Awaiting challenge...';
    // Clear input + focus
    var input = document.getElementById('adv-greeter-input');
    if (input){ input.value = ''; input.focus(); }
    // Safety: clear any stuck loading state from prior transition
    clearLoadingState();

    // Defer dialogue text to avoid pending council typewriter callbacks
    // overwriting our greeter text. rAF fires after the next frame, giving
    // the typewriter engine (which also uses rAF) time to flush.
    requestAnimationFrame(function(){
      // Safety follow-up: double-check after another frame in case the
      // typewriter queued multiple rAF callbacks.
      requestAnimationFrame(function(){
        var speaker = document.getElementById('adv-dialogue-speaker');
        var text = document.getElementById('adv-dialogue-text');
        if (speaker) speaker.textContent = 'ELDER ALDRIC';
        if (text) text.textContent = 'Hark, traveler. Which stock shall stand trial before the council this day?';
      });
    });

    // B → A or C → A: hide trial + verdict chrome, show greeter + solo
    hideTrialChrome(function(){
      showGreeterChrome();
    });
  }
  else if (phase === 'trial'){
    // A → B (or C → B): hide greeter, show trial chrome,
    // HIDE verdict chrome (it should only appear after verdict).
    // adv-solo-screen and adv-battle-screen are council-managed —
    // we NEVER set inline opacity or display on them.
    var greeter = document.getElementById('adv-greeter');
    if (greeter) fadeOut(greeter);
    // Hide verdict chrome (may be visible from C→B replay)
    VERDICT_ELEMENTS.forEach(function(id){
      var el = document.getElementById(id);
      if (el){ el.style.display = 'none'; el.style.opacity = '0'; }
    });
    // Reveal trial elements
    showTrialChrome();
    // Defensive: clear any lingering inline opacity on council-managed
    // screens so the cast is visible when the council toggles display.
    ['adv-solo-screen','adv-battle-screen','adv-vs-overlay','adv-verdict-banner'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.opacity = '';
    });
  }
  else if (phase === 'verdict'){
    // B → C: reveal post-verdict chrome
    var cursor = document.getElementById('adv-dialogue-cursor');
    var advance = document.getElementById('adv-dialogue-advance');
    if (cursor) cursor.style.display = 'none';
    if (advance) advance.style.display = 'none';
    revealVerdictChrome();
  }
}

/* Elements that should be hidden in State A and shown in State B/C.
   NOTE: adv-battle-screen, adv-solo-screen, adv-vs-overlay, and
   adv-verdict-banner are managed by castle-council.js — we do NOT
   include them here. The council toggles them during VS intro/verdict. */
var TRIAL_ELEMENTS = [
  'adv-deliberation-grid',
  'adv-momentum-bar',
  'adv-sentiment-readout',
  'adv-move-flourish',
  'adv-toggle-reports'
];

/* Elements that should be hidden in States A+B and shown in State C */
var VERDICT_ELEMENTS = [
  'rt-verdict-card',
  'rt-challenge-card',
  'rt-report-carousel'
];

function hideTrialChrome(done){
  // Hide trial elements + verdict elements + control btns.
  // adv-verdict-banner is council-managed — we never touch it.
  var allToHide = TRIAL_ELEMENTS.concat(VERDICT_ELEMENTS).concat([
    'demo-replay-btn', 'demo-new-trial-btn'
  ]);
  var remaining = allToHide.length;
  if (remaining === 0){ if (done) done(); return; }
  allToHide.forEach(function(id){
    var el = document.getElementById(id);
    if (el){
      fadeOut(el, function(){
        remaining--;
        if (remaining <= 0 && done) done();
      });
    } else {
      remaining--;
      if (remaining <= 0 && done) done();
    }
  });
  // Reset council-managed to neutral state so they're ready when the
  // council toggles them. We clear inline opacity (which our fades may
  // have left) but never write display — the council owns that.
  ['adv-solo-screen','adv-battle-screen','adv-vs-overlay','adv-verdict-banner'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.opacity = '';
  });
}

function showTrialChrome(){
  TRIAL_ELEMENTS.forEach(function(id){
    var el = document.getElementById(id);
    if (el) fadeIn(el);
  });
  // Show control buttons
  ['demo-replay-btn', 'demo-new-trial-btn'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) fadeIn(el, 'inline-block');
  });
}

function showGreeterChrome(){
  var greeter = document.getElementById('adv-greeter');
  if (greeter) fadeIn(greeter);
  // adv-solo-screen is council-managed — we never touch its display/opacity.
}

function revealVerdictChrome(){
  // Staggered reveal: verdict card → challenge card → carousel
  var stagger = [0, 150, 300];
  VERDICT_ELEMENTS.forEach(function(id, i){
    var el = document.getElementById(id);
    if (el){
      setTimeout(function(){
        fadeIn(el);
      }, stagger[i]);
    }
  });
}

// ════════════════════════════════════════════════════════════
// 5. GREETER ELEMENTS — injected once at boot
// ════════════════════════════════════════════════════════════

function injectGreeterElements(){
  // Idempotent guard
  if (document.getElementById('adv-greeter')) return;

  var dialogueBox = document.getElementById('adv-dialogue-box');

  // --- Greeter input area (after dialogue box) ---
  if (dialogueBox){
    var greeter = document.createElement('div');
    greeter.id = 'adv-greeter';
    greeter.style.opacity = '1'; // visible on first load
    greeter.innerHTML =
      '<div class="adv-greeter-row">' +
        '<input type="text" id="adv-greeter-input" class="adv-greeter-input"' +
        '  placeholder="Enter a ticker symbol..." maxlength="10"' +
        '  autocomplete="off" autocapitalize="characters"' +
        '  aria-label="Enter a stock ticker symbol">' +
        '<button type="button" id="adv-greeter-btn" class="adv-greeter-btn">' +
        '  Summon the Council' +
        '</button>' +
      '</div>' +
      '<button type="button" id="adv-greeter-sample" class="adv-greeter-sample"' +
      '  aria-label="Watch a sample trial for NVDA stock">' +
      '  or witness a sample trial (NVDA)' +
      '</button>' +
      '<div id="adv-greeter-error" class="adv-greeter-error"' +
      '  aria-live="polite" style="display:none;"></div>';

    dialogueBox.insertAdjacentElement('afterend', greeter);

    // Wire events
    var input = document.getElementById('adv-greeter-input');
    var btn = document.getElementById('adv-greeter-btn');
    var sample = document.getElementById('adv-greeter-sample');

    function submitTicker(){
      var val = (input.value || '').trim().toUpperCase();
      if (!val){
        showGreeterError('The council requires a ticker symbol.');
        return;
      }
      if (!/^[A-Z]{1,5}(\.[A-Z]{1,3})?$/.test(val)){
        showGreeterError('A ticker holds only letters and the occasional dot, traveler.');
        return;
      }
      clearGreeterError();
      setLoadingState(true);
      run(val);
    }

    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){
        e.preventDefault();
        submitTicker();
      } else if (e.key === 'Escape'){
        input.value = '';
      }
    });

    // Clear error on any input
    input.addEventListener('input', function(){
      if (document.getElementById('adv-greeter-error').style.display !== 'none'){
        clearGreeterError();
      }
      // Restore button state if it was stuck in loading (edge case)
      if (btn.disabled && state.phase === 'awaiting'){
        clearLoadingState();
      }
    });

    btn.addEventListener('click', function(){
      if (!btn.disabled) submitTicker();
    });

    sample.addEventListener('click', function(){
      clearGreeterError();
      setLoadingState(true);
      run('NVDA');
    });
  }

  // --- New Trial button (in controls row) ---
  var controls = document.querySelector('.adv-controls');
  if (controls && !document.getElementById('demo-new-trial-btn')){
    var newTrialBtn = document.createElement('button');
    newTrialBtn.id = 'demo-new-trial-btn';
    newTrialBtn.className = 'adv-btn';
    newTrialBtn.type = 'button';
    newTrialBtn.textContent = 'New Trial';
    newTrialBtn.style.opacity = '0';
    newTrialBtn.style.display = 'none';
    newTrialBtn.addEventListener('click', function(){
      stop();
      setPhase('awaiting');
    });
    var toggleReports = document.getElementById('adv-toggle-reports');
    if (toggleReports){
      controls.insertBefore(newTrialBtn, toggleReports);
    } else {
      controls.appendChild(newTrialBtn);
    }
  }
}

// ════════════════════════════════════════════════════════════
// 6. VALIDATION ERROR HANDLING
// ════════════════════════════════════════════════════════════

var _greeterErrorTimer = null;

function showGreeterError(msg){
  var errorEl = document.getElementById('adv-greeter-error');
  var input = document.getElementById('adv-greeter-input');
  if (!errorEl || !input) return;

  // Clear any existing timer
  if (_greeterErrorTimer){ clearTimeout(_greeterErrorTimer); _greeterErrorTimer = null; }

  errorEl.textContent = msg;
  errorEl.style.display = '';
  errorEl.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', 'adv-greeter-error');

  // Shake the input
  input.classList.add('adv-shake');
  input.addEventListener('animationend', function onAnimEnd(){
    input.removeEventListener('animationend', onAnimEnd);
    input.classList.remove('adv-shake');
  });

  // Auto-clear after 2.5s
  _greeterErrorTimer = setTimeout(function(){
    clearGreeterError();
  }, 2500);
}

function clearGreeterError(){
  var errorEl = document.getElementById('adv-greeter-error');
  var input = document.getElementById('adv-greeter-input');
  if (_greeterErrorTimer){ clearTimeout(_greeterErrorTimer); _greeterErrorTimer = null; }
  if (errorEl){
    errorEl.style.display = 'none';
    errorEl.textContent = '';
    errorEl.removeAttribute('role');
  }
  if (input){
    input.removeAttribute('aria-describedby');
    input.classList.remove('adv-shake');
  }
}

// ════════════════════════════════════════════════════════════
// 7. LOADER STATE (A → B transition)
// ════════════════════════════════════════════════════════════

function setLoadingState(loading){
  var btn = document.getElementById('adv-greeter-btn');
  var input = document.getElementById('adv-greeter-input');
  var sample = document.getElementById('adv-greeter-sample');
  if (loading){
    if (btn){ btn.disabled = true; btn.textContent = 'Summoning...'; }
    if (input) input.disabled = true;
    if (sample) sample.style.pointerEvents = 'none';
  } else {
    clearLoadingState();
  }
}

function clearLoadingState(){
  var btn = document.getElementById('adv-greeter-btn');
  var input = document.getElementById('adv-greeter-input');
  var sample = document.getElementById('adv-greeter-sample');
  if (btn){ btn.disabled = false; btn.textContent = 'Summon the Council'; }
  if (input) input.disabled = false;
  if (sample) sample.style.pointerEvents = '';
}

// ════════════════════════════════════════════════════════════
// 8. PAGE CHROME — verdict card text, replay button, challenge form
// ════════════════════════════════════════════════════════════

function resetVerdictChrome(){
  var vv = document.querySelector('#rt-verdict-card .rt-verdict-value');
  if (vv) vv.textContent = '\u2014';
  var vt = document.getElementById('rt-verdict-ticker');
  if (vt) vt.textContent = '\u2014';
}

function applyVerdictChrome(){
  var vv = document.querySelector('#rt-verdict-card .rt-verdict-value');
  if (vv) vv.textContent = 'BUY';
  var vt = document.getElementById('rt-verdict-ticker');
  if (vt) vt.textContent = state.ticker;
  var tc = document.getElementById('adv-turn-counter');
  if (tc) tc.textContent = 'VERDICT REACHED \u2696\uFE0F';
  // The council snips its rationale from whatever the typewriter has shown
  // so far; if the tab was backgrounded (throttled timers) that can be the
  // generic fallback. Pin the judge's closing words deterministically.
  var rEl = document.getElementById('adv-verdict-rationale');
  if (rEl) rEl.textContent = 'The forge burns hot, the ledgers are sound, and fear is the only discount on offer. \u2014 Elder Aldric';

  // Transition to verdict phase
  setPhase('verdict');
}

function wireChrome(){
  // castle-audio.js looks for .rt-controls to mount its mute toggle.
  var controls = document.querySelector('.adv-controls');
  if (controls && !controls.classList.contains('rt-controls')){
    controls.classList.add('rt-controls');
  }

  // Replay button alongside the council's own controls.
  if (controls && !document.getElementById('demo-replay-btn')){
    var btn = document.createElement('button');
    btn.id = 'demo-replay-btn';
    btn.className = 'adv-btn';
    btn.type = 'button';
    btn.textContent = 'Replay';
    btn.style.opacity = '0';
    btn.style.display = 'none';
    btn.addEventListener('click', function(){ run(state.ticker); });
    var toggleReports = document.getElementById('adv-toggle-reports');
    if (toggleReports){
      controls.insertBefore(btn, toggleReports);
    } else {
      controls.appendChild(btn);
    }
  }

  // The council's "Challenge another stock" card fills the hidden
  // #root form and clicks .btn-summon — wire that to a fresh replay.
  var summon = document.querySelector('#root .btn-summon');
  var input = document.querySelector('#root .form-input');
  if (summon && !summon.__demoWired){
    summon.__demoWired = true;
    summon.addEventListener('click', function(){
      var t = (input && input.value || '').trim();
      if (t) run(t);
    });
  }

  resetVerdictChrome();
}

// ════════════════════════════════════════════════════════════
// 9. INITIAL VISIBILITY — hide trial chrome on first paint
//    Must run BEFORE the council mounts so elements are hidden
//    by the time they appear in the DOM.
// ════════════════════════════════════════════════════════════

(function initVisibility(){
  // These IDs are created by the council at mount time. We use a
  // MutationObserver to catch them as they appear and hide them
  // before the first paint.
  var HIDE_ON_START = [
    'adv-deliberation-grid',
    'adv-momentum-bar',
    'adv-sentiment-readout',
    'adv-move-flourish',
    'adv-toggle-reports',
    'rt-verdict-card',
    'rt-challenge-card',
    'rt-report-carousel'
  ];

  var hidden = {};
  HIDE_ON_START.forEach(function(id){ hidden[id] = false; });

  var observer = new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      mutation.addedNodes.forEach(function(node){
        if (node.nodeType !== 1) return; // not an element
        // Check the node itself
        checkNode(node);
        // Check descendants
        if (node.querySelectorAll){
          HIDE_ON_START.forEach(function(id){
            if (!hidden[id]){
              var el = node.querySelector('#' + id);
              if (el){ hideNow(el, id); }
            }
          });
        }
      });
    });
  });

  function checkNode(el){
    if (!el || !el.id) return;
    if (HIDE_ON_START.indexOf(el.id) !== -1 && !hidden[el.id]){
      hideNow(el, el.id);
    }
  }

  function hideNow(el, id){
    el.style.display = 'none';
    el.style.opacity = '0';
    hidden[id] = true;
  }

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Also hide them on DOMContentLoaded in case they were already in the DOM
  function hideExisting(){
    HIDE_ON_START.forEach(function(id){
      if (!hidden[id]){
        var el = document.getElementById(id);
        if (el){ hideNow(el, id); }
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hideExisting);
  } else {
    hideExisting();
  }

  // Store for cleanup
  window.__demoInitObserver = observer;
  window.__demoInitHidden = hidden;
})();

// ════════════════════════════════════════════════════════════
// 10. BOOT — wait for the council to mount, then show greeter
// ════════════════════════════════════════════════════════════

function boot(){
  var waited = 0;
  (function poll(){
    if (window.__sseHookInstalled && document.getElementById('adv-arena')){
      wireChrome();
      injectGreeterElements();
      setPhase('awaiting');
      // Focus the input
      var input = document.getElementById('adv-greeter-input');
      if (input) input.focus();
      return;
    }
    waited += 120;
    if (waited < 15000) setTimeout(poll, 120);
    else console.warn('[demo] council scene never mounted — demo not started');
  })();
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();

/* ── Demo disclaimer badge ──────────────────────────────────────────
   Every ticker replays the same scripted debate; make that visibly
   honest so the verdict can't be mistaken for live analysis. */
(function(){
'use strict';
function addBadge(){
  if (document.getElementById('demo-disclaimer-badge')) return;
  var b = document.createElement('div');
  b.id = 'demo-disclaimer-badge';
  b.textContent = 'SCRIPTED DEMO — canned debate, any ticker. Not financial advice.';
  b.style.cssText = [
    'position:fixed', 'bottom:10px', 'left:10px', 'z-index:99999',
    'background:rgba(15,28,16,0.92)', 'color:#c4cfa1',
    'font:600 10px/1.5 "Courier New",monospace', 'letter-spacing:0.05em',
    'padding:4px 10px', 'border:1px solid #4a5a40', 'border-radius:4px',
    'pointer-events:none', 'text-transform:uppercase'
  ].join(';');
  document.body.appendChild(b);
}
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', addBadge);
} else {
  addBadge();
}
})();
