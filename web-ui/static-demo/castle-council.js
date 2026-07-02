/* Traders of the Round Table — ADV / Pokemon-Battle Edition */
(function(){
'use strict';

function ready(fn){
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

function getAssetURL(name){
  const s = document.currentScript || Array.from(document.scripts).find(x => /castle-council\.js/.test(x.src));
  if (!s) return name;
  return s.src.replace(/castle-council\.js.*/, name);
}

function rebrandTextNodes(root){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const replacements = [
    [/\bThe Bazaar\b/g, 'The Round Table'],
    [/\bBazaar\b/g, 'Round Table'],
    [/\bMarket Square\b/g, 'The Keep'],
    [/\bArchives\b/g, 'Chronicles'],
    [/\bTHE CHAMBER CONVENES\b/g, 'THE COUNCIL CONVENES'],
    [/\bThe chamber rules\b/g, 'The council rules'],
  ];
  const nodes = []; let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(node => {
    let t = node.nodeValue, changed = false;
    replacements.forEach(([re, to]) => { if (re.test(t)) { t = t.replace(re, to); changed = true; } });
    if (changed) node.nodeValue = t;
  });
}

// ===== DATA MAPS =====

const SEATS = [
  { id:'judge',        angle: 270, name:'Elder Aldric',   role:'High Judge' },
  { id:'market',       angle: 315, name:'Flint',          role:'Market Analyst' },
  { id:'social',       angle: 0,   name:'Vera',           role:'Sentiment Seer' },
  { id:'news',         angle: 45,  name:'Reed',           role:'News Herald' },
  { id:'fundamentals', angle: 90,  name:'Sage',           role:'Fundamentals' },
  { id:'debater',      angle: 135, name:'Balthazar',      role:'Adversary' },
  { id:'risk',         angle: 180, name:'Morwen',         role:'Risk Warden' },
  { id:'trader',       angle: 225, name:'Kael',           role:'Swift Trader' },
];

const AGENT_TO_SEAT = {
  // Character-name aliases
  'market':'market','flint':'market','Flint':'market',
  'social':'social','vera':'social','Vera':'social',
  'news':'news','reed':'news','Reed':'news',
  'fundamentals':'fundamentals','sage':'fundamentals','Sage':'fundamentals',
  // Balthazar is the BULL champion; Morwen is the BEAR champion.
  // (Previous mapping had bull_researcher→Sage and bear_researcher→Balthazar,
  // which put the bear's arguments in the bull's mouth on live runs.)
  'debater':'debater','bull':'debater','balthazar':'debater',
  'risk':'risk','bear':'risk','morwen':'risk',
  'trader':'trader','kael':'trader',
  'judge':'judge','aldric':'judge',

  // LangGraph node names (underscore variant — legacy)
  'market_analyst':'market',
  'social_analyst':'social','sentiment_analyst':'social',
  'news_analyst':'news',
  'fundamentals_analyst':'fundamentals',
  'bull_researcher':'debater',
  'bear_researcher':'risk',
  'research_manager':'judge',
  'risk_manager':'judge',
  'researcher_judge':'judge','risk_judge':'judge',
  // Risk-team compression: pro-risk voice → Balthazar, cautious → Morwen,
  // pragmatic middle → Kael (the trader whose plan is being stress-tested).
  'aggressive_analyst':'debater','risky_analyst':'debater',
  'neutral_analyst':'trader',
  'conservative_analyst':'risk','safe_analyst':'risk',
  'portfolio_manager':'judge',

  // LangGraph node names (space-separated — exact match from backend)
  'market analyst':'market',
  'sentiment analyst':'social','social analyst':'social',
  'news analyst':'news',
  'fundamentals analyst':'fundamentals',
  'bull researcher':'debater',
  'bear researcher':'risk',
  'research manager':'judge',
  'aggressive analyst':'debater','risky analyst':'debater',
  'neutral analyst':'trader',
  'conservative analyst':'risk','safe analyst':'risk',
  'portfolio manager':'judge',
};

const META = SEATS.reduce((a,s)=>{a[s.id]=s;return a;},{});

// ===== EXPRESSION STATE SYSTEM =====
const STATE_FRAMES = {
  market:       { idle:'design/comic-cast/flint-1-idle.png', thinking:'design/comic-cast/flint-1-idle.png', speaking:'design/comic-cast/flint-2-speaking.png', reacting:'design/comic-cast/flint-3-reacting.png', done:'design/comic-cast/flint-3-reacting.png' },
  social:       { idle:'design/comic-cast/vera-idle.png', thinking:'design/comic-cast/vera-idle.png', speaking:'design/comic-cast/vera-speaking.png', reacting:'design/comic-cast/vera-reacting.png', done:'design/comic-cast/vera-reacting.png' },
  news:         { idle:'design/comic-cast/reed-idle.png', thinking:'design/comic-cast/reed-idle.png', speaking:'design/comic-cast/reed-speaking.png', reacting:'design/comic-cast/reed-reacting.png', done:'design/comic-cast/reed-reacting.png' },
  fundamentals: { idle:'design/comic-cast/sage-idle.png', thinking:'design/comic-cast/sage-idle.png', speaking:'design/comic-cast/sage-speaking.png', reacting:'design/comic-cast/sage-reacting.png', done:'design/comic-cast/sage-reacting.png' },
  debater:      { idle:'design/comic-cast/balthazar-idle.png', thinking:'design/comic-cast/balthazar-idle.png', speaking:'design/comic-cast/balthazar-speaking.png', reacting:'design/comic-cast/balthazar-reacting.png', done:'design/comic-cast/balthazar-reacting.png' },
  risk:         { idle:'design/comic-cast/morwen-idle.png', thinking:'design/comic-cast/morwen-idle.png', speaking:'design/comic-cast/morwen-speaking.png', reacting:'design/comic-cast/morwen-reacting.png', done:'design/comic-cast/morwen-reacting.png' },
  trader:       { idle:'design/comic-cast/kael-idle.png', thinking:'design/comic-cast/kael-idle.png', speaking:'design/comic-cast/kael-speaking.png', reacting:'design/comic-cast/kael-reacting.png', done:'design/comic-cast/kael-reacting.png' },
  judge:        { idle:'design/comic-cast/aldric-idle.png', thinking:'design/comic-cast/aldric-idle.png', speaking:'design/comic-cast/aldric-speaking.png', reacting:'design/comic-cast/aldric-reacting.png', done:'design/comic-cast/aldric-reacting.png' },
};

const BUBBLE_TYPES = {
  standard: '#bubble-standard',
  emphatic: '#bubble-emphatic',
  bull:     '#bubble-bull',
  bear:     '#bubble-bear',
};

const BUBBLE_MAP = { debater:'bull', risk:'bear', judge:'emphatic' };

const SHORT_ROLE = {
  market: 'Market', social: 'Sentiment', news: 'News',
  fundamentals: 'Fundamentals', debater: 'Bull', risk: 'Bear',
  trader: 'Trader', judge: 'High Judge',
};

// ===== GLOBAL STATE =====
let seatEls = {}, stage, playing=false, currentIdx=0;
let activeBubble=null, activeReactions=[];
let blinkTimers = [];
let hasEntered = false;
let deliberationActive = false;
let deliberationOverlay = null;

// ADV view state
let advView = 'solo';                     // 'solo' | 'battle' | 'verdict'
let advCurrentSpeaker = null;             // seatId of current speaker
let advBattleBull = 'debater';            // seatId mapped to bull
let advBattleBear = 'risk';               // seatId mapped to bear
let advBullConviction = 0;                // 0-100
let advBearConviction = 0;                // 0-100
let advMomentumPct = 50;                  // 0-100, 50=neutral
let advTypewriterTimer = null;
let advDialogueFull = '';
let advDialogueIdx = 0;
let advTicker = '\u2014';                 // current ticker symbol
let advTurnCounter = 0;                   // total turns/bubbles delivered
let advVerdictRendered = false;

// Deliberation: track analyst completion for grid
let advAnalystCompleted = {};             // seatId -> true once they've spoken
let advAnalystBlockIndexes = {};          // seatId -> position index (1-4) for ANALYST REPORTS section

// Demo ticker + quote cache for share export
window.__shareDemoTicker = 'DEMO';
window.__shareQuoteCache = [];

const liveBubbles = {};

function prefersReducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ===== SVG DEF INJECTION =====
function injectPortraits(cb){
  if (document.getElementById('debate-portrait-defs')) return cb();
  fetch(getAssetURL('castle-sprites.svg')).then(r=>r.text()).then(svg=>{
    const wrap = document.createElement('div');
    wrap.id = 'debate-portrait-defs';
    wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    wrap.innerHTML = svg;
    document.body.appendChild(wrap);
    cb();
  }).catch(e=>{ console.warn('[council] sprite defs failed', e); cb(); });
}

// ===== BUILD ADV SCENE =====
function buildScene(){
  ['debate-scene-root','rt-verdict-card','rt-challenge-card','rt-report-carousel'].forEach(id=>{
    const el = document.getElementById(id); if (el) el.remove();
  });

  const root = document.createElement('div');
  root.id = 'debate-scene-root';

  // ── Build the ADV device layout ──
  root.innerHTML = ''
    + '<div class="adv-device">'
    // Status Strip
    +   '<div class="adv-status-strip">'
    +     '<span class="adv-status-ticker" id="adv-ticker">\u2014</span>'
    +     '<span class="adv-status-title">THE ROUND TABLE</span>'
    +     '<span class="adv-status-turn" id="adv-turn-counter">AWAITING COUNCIL</span>'
    +   '</div>'
    // VS Intro Overlay (hidden initially)
    +   '<div class="adv-vs-overlay" id="adv-vs-overlay" style="display:none;">'
    +     '<div class="adv-vs-overlay-bg"></div>'
    +     '<div class="adv-vs-slots">'
    +       '<div class="adv-vs-slot-left" id="adv-vs-slot-left"></div>'
    +       '<div class="adv-vs-divider">V S</div>'
    +       '<div class="adv-vs-slot-right" id="adv-vs-slot-right"></div>'
    +     '</div>'
    +     '<div class="adv-vs-label" id="adv-vs-label"></div>'
    +   '</div>'
    // Battle Arena
    +   '<div class="adv-battle-arena" id="adv-arena">'
    // SoloScreen (single analyst — default visible)
    +     '<div class="adv-solo-screen" id="adv-solo-screen">'
    +       '<div class="adv-solo-portrait" id="adv-solo-portrait">'
    +         '<div class="adv-portrait-frame">'
    +           '<img id="adv-solo-img" src="'+getAssetURL('design/comic-cast/aldric-idle.png')+'" alt="Council awaits" width="250" height="250" decoding="sync" loading="eager">'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    // BattleScreen (bull vs bear — hidden initially)
    +     '<div class="adv-battle-screen" id="adv-battle-screen" style="display:none;">'
    // Bear's stat box (upper-left)
    +       '<div class="adv-battle-stats-bear" id="adv-stats-bear">'
    +         '<div class="adv-battle-stats-name"><span>MORWEN</span><span class="adv-battle-stats-allegiance">🐻 BEAR</span></div>'
    +         '<div class="adv-battle-stats-divider"></div>'
    +         '<div class="adv-battle-stats-gauge-label">CONVICTION</div>'
    +         '<div class="adv-battle-stats-gauge"><div class="adv-battle-stats-gauge-fill" id="adv-gauge-bear" style="width:0%;"></div></div>'
    +         '<div class="adv-battle-stats-pct" id="adv-pct-bear">0%</div>'
    +       '</div>'
    // Bear's portrait (upper-right)
    +       '<div class="adv-battle-portrait-bear adv-battle-idle" id="adv-portrait-bear">'
    +         '<div class="adv-portrait-frame">'
    +           '<img id="adv-img-bear" src="'+getAssetURL('design/comic-cast/morwen-idle.png')+'" alt="Morwen, the Risk Bear Debater" width="220" height="220" decoding="sync" loading="eager">'
    +         '</div>'
    +         '<div class="adv-battle-platform"></div>'
    +       '</div>'
    // Bull's portrait (lower-left)
    +       '<div class="adv-battle-portrait-bull adv-battle-idle" id="adv-portrait-bull">'
    +         '<div class="adv-portrait-frame">'
    +           '<img id="adv-img-bull" src="'+getAssetURL('design/comic-cast/balthazar-idle.png')+'" alt="Balthazar, the Investment Bull Debater" width="220" height="220" decoding="sync" loading="eager">'
    +         '</div>'
    +         '<div class="adv-battle-platform"></div>'
    +       '</div>'
    // Bull's stat box (lower-right)
    +       '<div class="adv-battle-stats-bull" id="adv-stats-bull">'
    +         '<div class="adv-battle-stats-name"><span>BALTHAZAR</span><span class="adv-battle-stats-allegiance">🐂 BULL</span></div>'
    +         '<div class="adv-battle-stats-divider"></div>'
    +         '<div class="adv-battle-stats-gauge-label">CONVICTION</div>'
    +         '<div class="adv-battle-stats-gauge"><div class="adv-battle-stats-gauge-fill" id="adv-gauge-bull" style="width:0%;"></div></div>'
    +         '<div class="adv-battle-stats-pct" id="adv-pct-bull">0%</div>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    // Momentum Bar
    +   '<div class="adv-sentiment-bar" id="adv-momentum-bar">'
    +     '<span class="adv-sentiment-label">🐻 BEAR</span>'
    +     '<div class="adv-sentiment-track"><div class="adv-sentiment-fill" id="adv-momentum-fill" style="width:50%;"></div></div>'
    +     '<span class="adv-sentiment-label">BULL 🐂</span>'
    +   '</div>'
    +   '<div class="adv-sentiment-readout" id="adv-sentiment-readout">SENTIMENT · 50% NEUTRAL</div>'
    // Move Flourish
    +   '<div class="adv-move-flourish" id="adv-move-flourish"></div>'
    // Dialogue Box
    +   '<div class="adv-dialogue-box" id="adv-dialogue-box">'
    +     '<div class="adv-dialogue-speaker" id="adv-dialogue-speaker">COUNCIL</div>'
    +     '<div class="adv-dialogue-divider"></div>'
    +     '<div class="adv-dialogue-body" id="adv-dialogue-body">'
    +       '<span id="adv-dialogue-text">The council awaits a challenge...</span>'
    +       '<span class="adv-dialogue-cursor" id="adv-dialogue-cursor">█</span>'
    +     '</div>'
    +     '<div class="adv-dialogue-advance" id="adv-dialogue-advance">▼</div>'
    +   '</div>'
    // Deliberation Grid (4 analyst report slots)
    +   '<div class="adv-deliberation-grid" id="adv-deliberation-grid">'
    +     '<div class="adv-deliberation-slot" data-slot="1" title="Flint — Market Analyst">'
    +       '<div class="adv-delib-icon"></div>'
    +       '<div class="adv-delib-analyst">FLINT</div>'
    +       '<div class="adv-delib-label">AWAITING</div>'
    +     '</div>'
    +     '<div class="adv-deliberation-slot" data-slot="2" title="Vera — Sentiment Seer">'
    +       '<div class="adv-delib-icon"></div>'
    +       '<div class="adv-delib-analyst">VERA</div>'
    +       '<div class="adv-delib-label">AWAITING</div>'
    +     '</div>'
    +     '<div class="adv-deliberation-slot" data-slot="3" title="Reed — News Herald">'
    +       '<div class="adv-delib-icon"></div>'
    +       '<div class="adv-delib-analyst">REED</div>'
    +       '<div class="adv-delib-label">AWAITING</div>'
    +     '</div>'
    +     '<div class="adv-deliberation-slot" data-slot="4" title="Sage — Fundamentals Scholar">'
    +       '<div class="adv-delib-icon"></div>'
    +       '<div class="adv-delib-analyst">SAGE</div>'
    +       '<div class="adv-delib-label">AWAITING</div>'
    +     '</div>'
    +   '</div>'
    // Verdict Banner (hidden initially)
    +   '<div class="adv-verdict-banner" id="adv-verdict-banner" style="display:none;">'
    +     '<div class="adv-verdict-headline">THE COUNCIL HAS RULED — <span class="adv-verdict-ruling" id="adv-verdict-ruling">HOLD</span></div>'
    +     '<div class="adv-verdict-details" id="adv-verdict-details">'
    +       '<span id="adv-verdict-split">Bull 0% · Bear 0%</span>'
    +       '<span class="adv-verdict-sep">·</span>'
    +       '<span id="adv-verdict-rationale">Awaiting council verdict</span>'
    +     '</div>'
    +     '<div class="adv-sentiment-bar">'
    +       '<span class="adv-sentiment-label">🐻 BEAR</span>'
    +       '<div class="adv-sentiment-track"><div class="adv-sentiment-fill" id="adv-verdict-fill" style="width:50%;"></div></div>'
    +       '<span class="adv-sentiment-label">BULL 🐂</span>'
    +     '</div>'
    +     '<div class="adv-verdict-prompt">PRESS ▲ TO READ THE CHRONICLE</div>'
    +   '</div>'
    // Controls
    +   '<div class="adv-controls">'
    +     '<span class="adv-live-indicator" id="adv-live-indicator">'
    +       '<span class="adv-live-dot" id="adv-live-dot"></span>'
    +       '<span id="adv-live-text">Idle</span>'
    +     '</span>'
    +     '<button class="adv-btn" id="adv-toggle-reports">Hide Chronicles</button>'
    +   '</div>'
    + '</div>';

  const reactRoot = document.getElementById('root') || document.body.firstChild;
  if (reactRoot && reactRoot.parentNode) reactRoot.parentNode.insertBefore(root, reactRoot);
  else document.body.appendChild(root);

  // Set up the deliberation grid mapping
  // Analyst reports (non-debate, non-judge): market, social, news, fundamentals
  const reportIds = ['market','social','news','fundamentals'];
  reportIds.forEach(function(id, i){
    advAnalystBlockIndexes[id] = i + 1;
    advAnalystCompleted[id] = false;
  });

  stage = document.getElementById('adv-arena');
}

// ===== ADV VIEW FUNCTIONS =====

function getPortraitURL(seatId, state){
  const frames = STATE_FRAMES[seatId];
  if (!frames) return '';
  if (state === 'agree' || state === 'disagree' || state === 'surprised') state = 'reacting';
  return getAssetURL(frames[state] || frames.idle);
}

function setSoloSpeaker(seatId, isThinking){
  advView = 'solo';
  advCurrentSpeaker = seatId;

  // Show solo screen, hide battle screen
  const solo = document.getElementById('adv-solo-screen');
  const battle = document.getElementById('adv-battle-screen');
  if (solo) solo.style.display = '';
  if (battle) battle.style.display = 'none';

  // Update portrait
  const img = document.getElementById('adv-solo-img');
  if (img && seatId){
    const src = isThinking ? getPortraitURL(seatId, 'thinking') : getPortraitURL(seatId, 'speaking');
    img.setAttribute('src', src);
    img.setAttribute('alt', (META[seatId] ? META[seatId].name : 'Analyst') + ' speaks');
  }

  // Update dialogue speaker label
  const speakerEl = document.getElementById('adv-dialogue-speaker');
  if (speakerEl && seatId && META[seatId]){
    speakerEl.textContent = META[seatId].name.toUpperCase();
  }

  // Reset typewriter
  resetTypewriter();
}

function setBattleView(activeSpeakerId){
  if (advView !== 'battle'){
    advView = 'battle';
    // Show battle screen, hide solo
    const solo = document.getElementById('adv-solo-screen');
    const battle = document.getElementById('adv-battle-screen');
    if (solo) solo.style.display = 'none';
    if (battle) battle.style.display = '';

    // Initialize portraits with idle
    const bullImg = document.getElementById('adv-img-bull');
    const bearImg = document.getElementById('adv-img-bear');
    if (bullImg) bullImg.setAttribute('src', getPortraitURL(advBattleBull, 'idle'));
    if (bearImg) bearImg.setAttribute('src', getPortraitURL(advBattleBear, 'idle'));
  }

  const isBull = (activeSpeakerId === advBattleBull);
  const bullPortrait = document.getElementById('adv-portrait-bull');
  const bearPortrait = document.getElementById('adv-portrait-bear');
  const bullImg = document.getElementById('adv-img-bull');
  const bearImg = document.getElementById('adv-img-bear');

  // Swap active / idle classes
  if (isBull){
    if (bullPortrait) { bullPortrait.classList.remove('adv-battle-idle'); bullPortrait.classList.add('adv-battle-active'); }
    if (bearPortrait) { bearPortrait.classList.remove('adv-battle-active'); bearPortrait.classList.add('adv-battle-idle'); }
    if (bullImg) bullImg.setAttribute('src', getPortraitURL(advBattleBull, 'speaking'));
    if (bearImg) bearImg.setAttribute('src', getPortraitURL(advBattleBear, 'idle'));
  } else {
    if (bearPortrait) { bearPortrait.classList.remove('adv-battle-idle'); bearPortrait.classList.add('adv-battle-active'); }
    if (bullPortrait) { bullPortrait.classList.remove('adv-battle-active'); bullPortrait.classList.add('adv-battle-idle'); }
    if (bearImg) bearImg.setAttribute('src', getPortraitURL(advBattleBear, 'speaking'));
    if (bullImg) bullImg.setAttribute('src', getPortraitURL(advBattleBull, 'idle'));
  }

  // Update dialogue speaker
  const speakerEl = document.getElementById('adv-dialogue-speaker');
  if (speakerEl && META[activeSpeakerId]){
    const allegiance = isBull ? ' (Bull)' : ' (Bear)';
    speakerEl.textContent = META[activeSpeakerId].name.toUpperCase() + allegiance;
  }

  // Reset typewriter
  resetTypewriter();
}

function showSoloAnalyst(seatId, isThinking){
  // Solo analyst report — show single-speaker ADV view
  setSoloSpeaker(seatId, isThinking);
}

// ===== TYPEWRITER ENGINE =====

function resetTypewriter(){
  if (advTypewriterTimer) { clearTimeout(advTypewriterTimer); advTypewriterTimer = null; }
  advDialogueFull = '';
  advDialogueIdx = 0;
  const body = document.getElementById('adv-dialogue-text');
  const cursor = document.getElementById('adv-dialogue-cursor');
  const advance = document.getElementById('adv-dialogue-advance');
  if (body) body.textContent = '';
  if (cursor) cursor.style.display = 'inline';
  if (advance) advance.classList.remove('adv-visible');
}

function feedTypewriter(text){
  // Append text to the typewriter queue
  if (!advDialogueFull){
    advDialogueFull = text;
  } else {
    // Append to existing — seamless continuation
    advDialogueFull += text;
  }
  if (!advTypewriterTimer){
    advTypewriterTimer = setTimeout(typeChar, 30);
  }
}

function typeChar(){
  const body = document.getElementById('adv-dialogue-text');
  if (!body) return;
  if (advDialogueIdx < advDialogueFull.length){
    body.textContent = advDialogueFull.substring(0, advDialogueIdx + 1);
    advDialogueIdx++;
    // Scroll dialogue body to bottom as text arrives
    const db = document.getElementById('adv-dialogue-body');
    if (db) db.scrollTop = db.scrollHeight;
    advTypewriterTimer = setTimeout(typeChar, 22); // ~45 chars/sec — Game Boy pace
  } else {
    finishTypewriter();
  }
}

function finishTypewriter(){
  advTypewriterTimer = null;
  const cursor = document.getElementById('adv-dialogue-cursor');
  const advance = document.getElementById('adv-dialogue-advance');
  if (cursor) cursor.style.display = 'none';
  if (advance) advance.classList.add('adv-visible');
}

function skipTypewriter(){
  if (advTypewriterTimer) { clearTimeout(advTypewriterTimer); advTypewriterTimer = null; }
  const body = document.getElementById('adv-dialogue-text');
  if (body && advDialogueFull){
    body.textContent = advDialogueFull;
    advDialogueIdx = advDialogueFull.length;
  }
  finishTypewriter();
}

// ===== CONVICTION / MOMENTUM BARS =====

function updateConvictionBar(seatId, pct){
  pct = Math.max(0, Math.min(100, pct));
  if (seatId === advBattleBull){
    advBullConviction = pct;
    const gauge = document.getElementById('adv-gauge-bull');
    const pctEl = document.getElementById('adv-pct-bull');
    if (gauge) gauge.style.width = pct + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  } else if (seatId === advBattleBear){
    advBearConviction = pct;
    const gauge = document.getElementById('adv-gauge-bear');
    const pctEl = document.getElementById('adv-pct-bear');
    if (gauge) gauge.style.width = pct + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  }
}

function updateMomentumBar(pct){
  pct = Math.max(5, Math.min(95, pct));
  advMomentumPct = pct;
  const fill = document.getElementById('adv-momentum-fill');
  if (fill) fill.style.width = pct + '%';
  // Update numeric readout
  const readout = document.getElementById('adv-sentiment-readout');
  if (readout){
    const net = Math.round(pct - 50);
    let label;
    if (net > 15) label = 'BULLISH';
    else if (net > 5) label = 'LEAN BULL';
    else if (net < -15) label = 'BEARISH';
    else if (net < -5) label = 'LEAN BEAR';
    else label = 'NEUTRAL';
    readout.textContent = 'SENTIMENT · ' + Math.round(pct) + '% ' + label + '  (Bull ' + Math.round(advBullConviction) + '% | Bear ' + Math.round(advBearConviction) + '%)';
  }
}

function boostBullConviction(amount){
  updateConvictionBar(advBattleBull, advBullConviction + amount);
  // Slight momentum shift
  updateMomentumBar(advMomentumPct + amount * 0.5);
}

function boostBearConviction(amount){
  updateConvictionBar(advBattleBear, advBearConviction + amount);
  updateMomentumBar(advMomentumPct - amount * 0.5);
}

// ===== MOVE FLOURISH =====

function showMoveFlourish(speakerId, moveName){
  const flourish = document.getElementById('adv-move-flourish');
  if (!flourish) return;
  const name = META[speakerId] ? META[speakerId].name.toUpperCase() : speakerId.toUpperCase();
  flourish.textContent = '⚡ ' + name + ' uses ' + (moveName || 'ANALYSIS') + '!';
  flourish.classList.add('adv-move-show');
  setTimeout(function(){ flourish.classList.remove('adv-move-show'); }, 1800);
}

// ===== VERDICT BANNER =====

function showVerdictBanner(verdict, verbatimRuling){
  advView = 'verdict';
  advVerdictRendered = true;

  const banner = document.getElementById('adv-verdict-banner');
  const ruling = document.getElementById('adv-verdict-ruling');
  const fill = document.getElementById('adv-verdict-fill');
  const splitEl = document.getElementById('adv-verdict-split');
  const rationaleEl = document.getElementById('adv-verdict-rationale');

  if (banner) banner.style.display = '';
  if (ruling) ruling.textContent = verdict.toUpperCase();

  // Show the Portfolio Manager's actual ruling verbatim (first lines),
  // not just the mapped seal — the real nuance is the point.
  if (verbatimRuling && rationaleEl){
    const clean = String(verbatimRuling).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (clean) rationaleEl.textContent = clean.slice(0, 240) + (clean.length > 240 ? '…' : '');
  }

  // Set verdict fill based on final momentum
  const v = verdict.toUpperCase();
  let pct = advMomentumPct;
  if (v === 'BUY') pct = 85;
  else if (v === 'SELL') pct = 15;
  // HOLD stays at current momentum
  if (fill) fill.style.width = pct + '%';

  // Populate conviction split
  if (splitEl){
    splitEl.textContent = 'Council: Bull ' + Math.round(advBullConviction) + '% · Bear ' + Math.round(advBearConviction) + '%';
  }
  // Populate rationale from dialogue box text (last analyst testimony) —
  // unless the Portfolio Manager's verbatim ruling was provided above.
  if (rationaleEl && !verbatimRuling){
    var rationale = 'The council has weighed the evidence and rendered judgment.';
    var dialogueBody = document.getElementById('adv-dialogue-text');
    if (dialogueBody && dialogueBody.textContent && dialogueBody.textContent.length > 20){
      var snippet = dialogueBody.textContent.slice(-120).trim();
      rationale = snippet + (dialogueBody.textContent.length > 120 ? '…' : '');
    }
    rationaleEl.textContent = rationale;
  }

  // Update dialogue box
  const speakerEl = document.getElementById('adv-dialogue-speaker');
  const body = document.getElementById('adv-dialogue-text');
  const cursor = document.getElementById('adv-dialogue-cursor');
  const advance = document.getElementById('adv-dialogue-advance');
  if (advTypewriterTimer) { clearTimeout(advTypewriterTimer); advTypewriterTimer = null; }
  if (speakerEl) speakerEl.textContent = 'HIGH JUDGE ALDRIC';
  if (body) body.textContent = 'By decree of the council: ' + verdict.toUpperCase() + '. The ruling is final.';
  if (cursor) cursor.style.display = 'none';
  if (advance) advance.classList.add('adv-visible');
}

// ===== DELIBERATION GRID =====

function markAnalystComplete(seatId){
  if (advAnalystCompleted[seatId]) return;
  advAnalystCompleted[seatId] = true;

  const slotIndex = advAnalystBlockIndexes[seatId];
  if (!slotIndex) return;

  const slot = document.querySelector('.adv-deliberation-slot[data-slot="' + slotIndex + '"]');
  if (!slot) return;

  const icon = slot.querySelector('.adv-delib-icon');
  const label = slot.querySelector('.adv-delib-label');
  const meta = META[seatId];

  // Show analyst initial
  if (icon && meta){
    icon.textContent = meta.name.charAt(0).toUpperCase();
    icon.classList.add('complete');
  }
  if (label && meta){
    label.textContent = meta.name.toUpperCase();
    label.classList.add('complete');
  }
}

// ===== LIVE BUBBLE (legacy compatibility for showLiveBubble) =====

function showLiveBubble(seatId, text){
  let disp = (typeof text === 'string' && text.length > 220) ? text.slice(0,217)+'...' : text;
  if (typeof text !== 'string') disp = String(text || '');

  // Track turn count
  advTurnCounter++;
  updateTurnCounter();

  // Determine which view to use
  const isBattleAgent = (seatId === advBattleBull || seatId === advBattleBear);
  const isSoloAnalyst = ['market','social','news','fundamentals','trader'].indexOf(seatId) >= 0;
  const isJudge = (seatId === 'judge');

  if (isBattleAgent){
    // Battle view — bull vs bear. The VS intro runs here, on the FIRST
    // real debate event, so the battle framing tracks the actual pipeline
    // phase instead of firing on a timer after the analyze POST.
    const speakNow = function(){
      feedTypewriter(disp);
      if (seatId === advBattleBull) boostBullConviction(8);
      else boostBearConviction(8);
      const moveName = seatId === advBattleBull ? 'GROWTH THESIS' : 'RISK EXPOSURE';
      showMoveFlourish(seatId, moveName);
    };
    if (advView !== 'battle'){
      runVSIntro(function(){ setBattleView(seatId); speakNow(); });
    } else {
      setBattleView(seatId);
      speakNow();
    }

  } else if (isSoloAnalyst){
    // Solo analyst report — single-speaker ADV view
    showSoloAnalyst(seatId, false);
    feedTypewriter(disp);
    markAnalystComplete(seatId);

    // Slight conviction nudge based on analyst type
    if (seatId === 'fundamentals') boostBullConviction(4);
    else if (seatId === 'market') boostBearConviction(2);
    else if (seatId === 'news') boostBullConviction(3);

  } else if (isJudge){
    // Judge speaking — this may be verdict precursor
    // Show solo for judge
    showSoloAnalyst(seatId, false);
    feedTypewriter(disp);
  }
}

function updateTurnCounter(){
  const el = document.getElementById('adv-turn-counter');
  if (!el) return;
  // Count completed analysts for progress
  var completed = Object.values(advAnalystCompleted).filter(Boolean).length;
  var total = 4;
  if (completed > 0){
    el.textContent = 'TESTIMONY ' + completed + '/' + total + ' 🕯';
  } else {
    el.textContent = 'TESTIMONY ' + advTurnCounter + ' 🕯';
  }
}

// ===== VS INTRO (battle transition) =====

function runVSIntro(cb){
  const overlay = document.getElementById('adv-vs-overlay');
  if (!overlay) { if (cb) cb(); return; }

  // Set portraits in VS slots
  const slotLeft = document.getElementById('adv-vs-slot-left');
  const slotRight = document.getElementById('adv-vs-slot-right');
  if (slotLeft){
    slotLeft.innerHTML = '<img src="'+getPortraitURL(advBattleBull,'idle')+'" alt="Bull" width="120" height="120" decoding="sync">';
  }
  if (slotRight){
    slotRight.innerHTML = '<img src="'+getPortraitURL(advBattleBear,'idle')+'" alt="Bear" width="120" height="120" decoding="sync">';
  }

  overlay.style.display = '';

  if (prefersReducedMotion()){
    overlay.style.display = 'none';
    if (cb) cb();
    return;
  }

  // Phase 1: Fade in
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 200ms ease-in';
  requestAnimationFrame(function(){
    overlay.style.opacity = '1';
  });

  // Phase 2: Slide portraits
  setTimeout(function(){
    if (slotLeft) { slotLeft.style.animation = 'vs-slide-left 400ms ease-out forwards'; slotLeft.style.opacity = '1'; }
    if (slotRight) { slotRight.style.animation = 'vs-slide-right 400ms ease-out forwards'; slotRight.style.opacity = '1'; }
  }, 300);

  // Phase 3: VS strike
  const vsDivider = overlay.querySelector('.adv-vs-divider');
  setTimeout(function(){
    if (vsDivider) vsDivider.style.animation = 'vs-strike 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    overlay.style.background = 'var(--dmg-lightest)';
    setTimeout(function(){ overlay.style.background = 'var(--dmg-dark)'; }, 80);
  }, 800);

  // Phase 4: Label typewriter
  setTimeout(function(){
    const vsLabel = document.getElementById('adv-vs-label');
    if (vsLabel) typewriteInline(vsLabel, 'RESEARCH PHASE • ANALYSTS DEPLOYED', 40);
  }, 1200);

  // Phase 5-7: Wipe → reveal battle → callback
  setTimeout(function(){
    overlay.style.animation = 'vs-wipe 700ms ease-in forwards';
    setTimeout(function(){
      overlay.style.display = 'none';
      if (cb) cb();
    }, 700);
  }, 2500);
}

function typewriteInline(el, text, msPerChar){
  let i = 0;
  el.textContent = '';
  function tick(){
    if (i < text.length){
      el.textContent += text.charAt(i);
      i++;
      setTimeout(tick, msPerChar);
    }
  }
  tick();
}

// ===== FRAME SWAP ENGINE (legacy — used by setSeatState) =====

function setSeatState(seatId, state){
  // For ADV mode, this is a no-op — we use the new portrait system
  // Kept for backward compatibility with any external callers
}

function setAllSeatsState(state){
  // No-op in ADV mode
}

function resetSeats(){
  // Reset ADV view state
  advView = 'solo';
  advCurrentSpeaker = null;
  advBullConviction = 0;
  advBearConviction = 0;
  advMomentumPct = 50;
  advTurnCounter = 0;
  advVerdictRendered = false;
  resetTypewriter();

  // Reset UI
  const solo = document.getElementById('adv-solo-screen');
  const battle = document.getElementById('adv-battle-screen');
  const verdictBanner = document.getElementById('adv-verdict-banner');
  if (solo) solo.style.display = '';
  if (battle) battle.style.display = 'none';
  if (verdictBanner) verdictBanner.style.display = 'none';

  const soloImg = document.getElementById('adv-solo-img');
  if (soloImg) soloImg.setAttribute('src', getPortraitURL('judge', 'idle'));

  const bullImg = document.getElementById('adv-img-bull');
  const bearImg = document.getElementById('adv-img-bear');
  if (bullImg) bullImg.setAttribute('src', getPortraitURL(advBattleBull, 'idle'));
  if (bearImg) bearImg.setAttribute('src', getPortraitURL(advBattleBear, 'idle'));

  const bullPortrait = document.getElementById('adv-portrait-bull');
  const bearPortrait = document.getElementById('adv-portrait-bear');
  if (bullPortrait) { bullPortrait.classList.remove('adv-battle-active'); bullPortrait.classList.add('adv-battle-idle'); }
  if (bearPortrait) { bearPortrait.classList.remove('adv-battle-active'); bearPortrait.classList.add('adv-battle-idle'); }

  updateConvictionBar(advBattleBull, 0);
  updateConvictionBar(advBattleBear, 0);
  updateMomentumBar(50);

  const gaugeBull = document.getElementById('adv-gauge-bull');
  const gaugeBear = document.getElementById('adv-gauge-bear');
  const pctBull = document.getElementById('adv-pct-bull');
  const pctBear = document.getElementById('adv-pct-bear');
  if (gaugeBull) gaugeBull.style.width = '0%';
  if (gaugeBear) gaugeBear.style.width = '0%';
  if (pctBull) pctBull.textContent = '0%';
  if (pctBear) pctBear.textContent = '0%';

  const momentum = document.getElementById('adv-momentum-fill');
  if (momentum) momentum.style.width = '50%';
  const readout = document.getElementById('adv-sentiment-readout');
  if (readout) readout.textContent = 'SENTIMENT · 50% NEUTRAL';

  const speakerEl = document.getElementById('adv-dialogue-speaker');
  const body = document.getElementById('adv-dialogue-text');
  if (speakerEl) speakerEl.textContent = 'COUNCIL';
  if (body) body.textContent = 'The council awaits a challenge...';

  const turnCounter = document.getElementById('adv-turn-counter');
  if (turnCounter) turnCounter.textContent = 'AWAITING COUNCIL';

  // Reset deliberation grid
  ['market','social','news','fundamentals'].forEach(function(id){
    advAnalystCompleted[id] = false;
    const slotIndex = advAnalystBlockIndexes[id];
    if (!slotIndex) return;
    const slot = document.querySelector('.adv-deliberation-slot[data-slot="' + slotIndex + '"]');
    if (slot){
      const icon = slot.querySelector('.adv-delib-icon');
      const label = slot.querySelector('.adv-delib-label');
      if (icon) { icon.textContent = ''; icon.classList.remove('complete'); }
      if (label) { label.textContent = 'AWAITING'; label.classList.remove('complete'); }
    }
  });

  // Clear live indicator
  const dot = document.getElementById('adv-live-dot');
  const txt = document.getElementById('adv-live-text');
  if (dot) { dot.style.background = ''; dot.style.boxShadow = ''; dot.classList.remove('deliberating'); }
  if (txt) txt.textContent = 'Idle';

  // Clear share cache
  if (window.__shareQuoteCache) window.__shareQuoteCache.length = 0;
}

// ===== BUBBLE HELPERS (legacy — called by SSE listener) =====

function placeBubble(bubble, seatId){
  // No-op in ADV mode — we use the dialogue box instead
}

function clearBubble(){
  // No-op in ADV mode
}

function clearReactions(){ activeReactions.forEach(r=>r.remove()); activeReactions=[]; }

// ===== DELIBERATION =====

function startDeliberation(){
  if (deliberationActive) return;
  deliberationActive = true;

  resetSeats();

  // Live indicator
  const dot = document.getElementById('adv-live-dot');
  const txt = document.getElementById('adv-live-text');
  if (dot) { dot.style.background = '#c43f54'; dot.style.boxShadow = '0 0 8px #c43f54'; dot.classList.add('deliberating'); }
  if (txt) txt.textContent = 'The heralds sound the call…';

  // Set ticker from page context if available
  const tickerEl = document.getElementById('adv-ticker');
  if (tickerEl) tickerEl.textContent = '\u2014';

  // Update dialogue
  const speakerEl = document.getElementById('adv-dialogue-speaker');
  const body = document.getElementById('adv-dialogue-text');
  if (speakerEl) speakerEl.textContent = 'COUNCIL';
  if (body) body.textContent = 'The council convenes. The scribes prepare the ledgers…';

  // Update turn counter with themed progress
  const turnEl = document.getElementById('adv-turn-counter');
  if (turnEl) turnEl.textContent = 'COUNCIL CONVENES 🕯';
}

function endDeliberation(){
  if (!deliberationActive) return;
  deliberationActive = false;

  const dot = document.getElementById('adv-live-dot');
  const txt = document.getElementById('adv-live-text');
  if (dot) { dot.style.background = 'var(--castle-gold)'; dot.style.boxShadow = '0 0 8px var(--castle-gold)'; dot.classList.remove('deliberating'); }
  if (txt) txt.textContent = 'Live — Council in session';

  const turnCounter = document.getElementById('adv-turn-counter');
  if (turnCounter) {
    var completed = Object.values(advAnalystCompleted).filter(Boolean).length;
    turnCounter.textContent = 'VERDICT REACHED ⚖️';
  }
}

// ===== LIVE SSE WIRING =====

function installLiveWiring(){
  if (window.__sseHookInstalled) return;
  window.__sseHookInstalled = true;
  window.__sseListeners = [];
  if (!window.__originalEventSource) window.__originalEventSource = window.EventSource;
  if (!window.__originalFetch) window.__originalFetch = window.fetch;
  window.__activeSSE = [];

  const RealES = window.EventSource;
  window.EventSource = function HookedES(url, opts){
    const es = new RealES(url, opts);
    window.__activeSSE.push(es);
    const safe = (url||'').toString().replace(/token=[a-zA-Z0-9_\-]+/g,'TOK');
    console.log('[live] EventSource:', safe);

    es.addEventListener('error', function(ev){
      const dot = document.getElementById('adv-live-dot');
      const txt = document.getElementById('adv-live-text');
      if (dot) { dot.style.background = '#e57373'; dot.style.boxShadow = '0 0 8px #e57373'; dot.classList.remove('deliberating'); }
      if (txt) txt.textContent = 'Connection lost — retrying...';
      console.warn('[live] SSE connection error — will retry');
    });

    const origAdd = es.addEventListener.bind(es);
    es.addEventListener = function(type, fn, opts2){
      const wrapped = function(ev){
        try { window.__sseListeners.forEach(l=>{ try{ l(type, ev); }catch(e){} }); } catch(e){}
        return fn.apply(this, arguments);
      };
      return origAdd(type, wrapped, opts2);
    };
    return es;
  };
  Object.keys(RealES).forEach(k=>{ try{ window.EventSource[k]=RealES[k]; }catch(e){} });
  window.EventSource.prototype = RealES.prototype;

  window.__sseListeners.push((type, ev)=>{
    let data;
    try { data = ev.data ? JSON.parse(ev.data) : null; } catch(e){ data = ev.data; }
    if (!data) return;
    const dataPayload = data.data || {};
    const eventType = data.type || type;

    // ── Global events ──
    if (eventType === 'heartbeat') return;

    if (eventType === 'status'){
      const rawStatus = dataPayload.message || dataPayload.status || '';
      // Theme-ify technical status messages
      const themedMessages = {
        'building graph': 'The scribes prepare the ledgers…',
        'graph': 'The council chamber stirs…',
        'running': 'The council is in session',
        'streaming': 'Testimony is being heard…',
        'connecting': 'The council convenes…',
        'processing': 'The scribes prepare the ledgers…',
        'initializing': 'The council chamber stirs…',
        'preparing': 'The heralds sound the call…',
        'loading': 'The archives are being searched…',
        'fetching': 'Gathering market intelligence…',
        'computing': 'The scholars weigh the evidence…',
        'analyzing': 'The analysts study the charts…',
      };
      let statusText = rawStatus;
      for (const [tech, themed] of Object.entries(themedMessages)){
        if (rawStatus.toLowerCase().includes(tech)){
          statusText = themed;
          break;
        }
      }
      const txt = document.getElementById('adv-live-text');
      if (/running/i.test(dataPayload.status||'')){
        if (deliberationActive) endDeliberation();
        if (txt) txt.textContent = 'Live — Council in session';
      } else if (statusText){
        if (txt) txt.textContent = statusText;
      }
      return;
    }

    if (eventType === 'complete'){
      if (deliberationActive) endDeliberation();
      const dot = document.getElementById('adv-live-dot');
      const txt = document.getElementById('adv-live-text');
      if (dot){ dot.style.background='var(--castle-gold)'; dot.style.boxShadow='0 0 8px var(--castle-gold)'; dot.classList.remove('deliberating'); }
      if (txt) txt.textContent = 'Verdict delivered';

      const result = dataPayload.result || {};
      const verdict = result.decision || result.final_trade_decision || result.recommendation || '';
      // The Portfolio Manager's real rulings are richer than BUY/SELL/HOLD
      // (e.g. "Underweight", "Reduce", "Accumulate") — classify into a seal
      // category but keep the verbatim ruling for display.
      const vtext = String(verdict);
      let v = null;
      const exact = vtext.match(/\b(BUY|SELL|HOLD)\b/i);
      if (exact) v = exact[0].toUpperCase();
      else if (/\b(accumulate|overweight|add|long|bullish|increase)\b/i.test(vtext)) v = 'BUY';
      else if (/\b(underweight|reduce|trim|exit|short|bearish|decrease|liquidate)\b/i.test(vtext)) v = 'SELL';
      else if (/\b(neutral|wait|maintain|stay|pause)\b/i.test(vtext)) v = 'HOLD';
      if (v){
        showVerdictBanner(v, vtext);
      }
      return;
    }

    if (eventType === 'error'){
      const txt = document.getElementById('adv-live-text');
      const dot = document.getElementById('adv-live-dot');
      const msg = dataPayload.message || 'Unknown error';
      if (txt) txt.textContent = 'Error: ' + msg;
      if (dot){ dot.style.background='#c43f54'; dot.style.boxShadow='0 0 8px #c43f54'; dot.classList.remove('deliberating'); }
      return;
    }

    // ── Per-agent events ──
    const agent = dataPayload.node || data.agent || data.analyst || data.author || (data.payload && data.payload.agent);
    const status = eventType;
    const text = dataPayload.report || dataPayload.content || dataPayload.current_response
              || dataPayload.bull_reason || dataPayload.bear_reason
              || dataPayload.judge_decision || dataPayload.final_decision
              || dataPayload.investment_plan || dataPayload.message
              || data.text || data.content || (data.payload && data.payload.text);
    const seatId = AGENT_TO_SEAT[agent] || AGENT_TO_SEAT[(agent||'').toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,'')];
    if (!seatId) return;

    if (/think|start|begin|working|preparing|building|initializing/i.test(status)){
      if (deliberationActive) endDeliberation();
      // Agent is thinking — show idle with thinking state
      if (['market','social','news','fundamentals','trader'].indexOf(seatId) >= 0){
        showSoloAnalyst(seatId, true);
      }
    } else if (/speak|message|delta|chunk|update|report|debate/i.test(status)){
      // Agent is speaking
      if (deliberationActive) endDeliberation();
      const isBattle = (seatId === advBattleBull || seatId === advBattleBear);
      const isSolo = ['market','social','news','fundamentals','trader'].indexOf(seatId) >= 0;
      const isJudge = (seatId === 'judge');

      if (isBattle && text){
        showLiveBubble(seatId, text);
      } else if (isSolo && text){
        showLiveBubble(seatId, text);
      } else if (isJudge && text){
        // Judge speaking — could be verdict precursor
        showSoloAnalyst(seatId, false);
        feedTypewriter(text);
      }

      // Sentiment heuristics for conviction bars
      if (typeof text === 'string'){
        const bullWords = /\b(bull|long|buy|upside|rally|growth|higher|outperform)\b/i;
        const bearWords = /\b(bear|short|sell|downside|drop|lower|decline|underperform|pullback|correction)\b/i;
        let bullHits = (text.match(bullWords) || []).length;
        let bearHits = (text.match(bearWords) || []).length;
        if (bullHits > bearHits) boostBullConviction(bullHits * 2);
        else if (bearHits > bullHits) boostBearConviction(bearHits * 2);
        // If both zero, give a tiny nudge based on who's speaking
        if (bullHits === 0 && bearHits === 0){
          if (seatId === 'debater') boostBullConviction(2);
          else if (seatId === 'risk') boostBearConviction(2);
          else if (seatId === 'fundamentals' || seatId === 'news') boostBullConviction(1.5);
          else if (seatId === 'market') boostBearConviction(1);
        }
      }

      // Cache quote for share export
      if (window.__shareQuoteCache && text && !window.__shareQuoteCache.includes(text)){
        window.__shareQuoteCache.push(text);
      }
      if (window.__shareDemoTicker && seatId === 'debater'){
        // Try to extract ticker from page context
        const tickerEl = document.getElementById('adv-ticker');
        if (tickerEl && tickerEl.textContent !== '\u2014'){
          window.__shareDemoTicker = tickerEl.textContent.trim();
        }
      }

    } else if (/done|complete|finish|end|decision|final_decision/i.test(status)){
      // Agent finished their turn
      if (['market','social','news','fundamentals'].indexOf(seatId) >= 0){
        markAnalystComplete(seatId);
      }
      // Check for verdict in text
      if (seatId === 'judge' && typeof text === 'string'){
        const vm = text.match(/\b(BUY|SELL|HOLD)\b/i);
        if (vm){ showVerdictBanner(vm[0].toUpperCase()); }
      }
    }
  });

  // Fetch hook — detect /analyze calls
  const _fetch = window.fetch;
  window.fetch = function(){
    const url = (arguments[0]||'').toString();
    if (/\/analyze/.test(url)){
      window.__lastAnalyzeAt = Date.now();
      startDeliberation();

      // Try to extract ticker from the body/payload
      try {
        const body = arguments[1] && arguments[1].body;
        if (typeof body === 'string'){
          const parsed = JSON.parse(body);
          const ticker = parsed.ticker || parsed.symbol || '';
          if (ticker){
            const tickerEl = document.getElementById('adv-ticker');
            if (tickerEl) tickerEl.textContent = ticker.toUpperCase();
            window.__shareDemoTicker = ticker.toUpperCase();
          }
        }
      } catch(e){}

      // NOTE: no VS intro here — the battle framing is event-driven now
      // (it runs when the first real bull/bear debate event arrives, which
      // matches the actual pipeline phase; analysts report first).
    }
    return _fetch.apply(this, arguments);
  };
}

// ===== TEARDOWN =====

window.__councilTeardown = function(){
  blinkTimers.forEach(clearTimeout);
  blinkTimers = [];
  window.__sseListeners = [];

  if (window.__activeSSE) {
    window.__activeSSE.forEach(function(es){ try { es.close(); } catch(e) {} });
    window.__activeSSE = [];
  }
  if (window.__originalEventSource) window.EventSource = window.__originalEventSource;
  if (window.__originalFetch) window.fetch = window.__originalFetch;

  Object.keys(liveBubbles).forEach(function(k){ delete liveBubbles[k]; });
  if (activeBubble) { activeBubble = null; }
  activeReactions.forEach(function(r){ try { r.remove(); } catch(e) {} });
  activeReactions = [];

  if (deliberationActive) endDeliberation();
  window.__sseHookInstalled = false;

  // Clear typewriter
  if (advTypewriterTimer) { clearTimeout(advTypewriterTimer); advTypewriterTimer = null; }

  console.log('[live] Council teardown complete');
};

// ===== CONTROLS =====

function wireControls(){
  // Toggle chronicles/reports
  const toggleBtn = document.getElementById('adv-toggle-reports');
  if (toggleBtn){
    toggleBtn.addEventListener('click', function(e){
      const carousel = document.getElementById('rt-report-carousel');
      const root = document.getElementById('root');
      if (e.target.textContent.startsWith('Hide')){
        if (carousel) carousel.style.display = 'none';
        if (root) root.style.display = 'none';
        e.target.textContent = 'Show Chronicles';
      } else {
        if (carousel) carousel.style.display = '';
        if (root) root.style.display = '';
        e.target.textContent = 'Hide Chronicles';
      }
    });
  }

  // Dialogue box click — skip typewriter
  const dialogueBox = document.getElementById('adv-dialogue-box');
  if (dialogueBox){
    dialogueBox.addEventListener('click', function(){
      if (advTypewriterTimer) skipTypewriter();
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e){
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter'){
      e.preventDefault();
      if (advTypewriterTimer) skipTypewriter();
    } else if (e.key === 'Escape'){
      const m = document.querySelector('.rt-modal-backdrop.visible');
      if (m) { m.classList.remove('visible'); setTimeout(function(){ m.remove(); }, 300); }
    }
  });
}

// ===== ANALYST DETECTION (from report titles) =====

function analystFromTitle(title){
  const t = (title||'').toLowerCase();
  if (t.includes('flint') || t.includes('market')) return { id:'market', name:'Flint', role:'Market Analyst' };
  if (t.includes('vera') || t.includes('sentiment') || t.includes('social')) return { id:'social', name:'Vera', role:'Sentiment Seer' };
  if (t.includes('reed') || t.includes('news')) return { id:'news', name:'Reed', role:'News Herald' };
  if (t.includes('sage') || t.includes('fundamentals')) return { id:'fundamentals', name:'Sage', role:'Fundamentals Scholar' };
  if (t.includes('balthazar') || t.includes('debater')) return { id:'debater', name:'Balthazar', role:'Adversary' };
  if (t.includes('morwen') || t.includes('risk')) return { id:'risk', name:'Morwen', role:'Risk Warden' };
  if (t.includes('kael') || t.includes('trader')) return { id:'trader', name:'Kael', role:'Swift Trader' };
  if (t.includes('aldric') || t.includes('judge')) return { id:'judge', name:'Elder Aldric', role:'High Judge' };
  return { id:'market', name:'Analyst', role:'Council' };
}

function buildCopyText(verdict){
  const tickerEl = document.getElementById('adv-ticker');
  const ticker = (tickerEl && tickerEl.textContent !== '\u2014') ? tickerEl.textContent.trim() : '';
  const tickerPart = ticker ? ' \u2014 ' + ticker + ' Verdict' : '';

  const analystNames = SEATS
    .filter(function(s){ return s.id !== 'judge'; })
    .map(function(s){ return s.name + ' (' + (SHORT_ROLE[s.id] || s.role) + ')'; });
  const judgeSeat = SEATS.find(function(s){ return s.id === 'judge'; });

  return '\uD83D\uDEE1\uFE0F Traders of the Round Table' + tickerPart + '\n\n'
    + 'The council has spoken: ' + verdict + '\n\n'
    + 'Analysts convened: ' + analystNames.join(', ') + '\n'
    + 'Presiding: ' + (judgeSeat ? judgeSeat.name + ', ' + judgeSeat.role : 'Elder Aldric, High Judge') + '\n\n'
    + '\u2696\uFE0F Not financial advice. The council only advises.';
}

// ===== CHALLENGE ANOTHER TICKER =====

function submitChallengeTicker(ticker){
  if (!ticker || !ticker.trim()) return;
  const t = ticker.trim().toUpperCase();

  function setReactInput(el, val){
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function tryFillAndSubmit(){
    // No offsetParent/visibility gate: the ADV overlay hides the React app,
    // but React still handles synthetic events on hidden nodes.
    const reactInput = document.querySelector('#root .form-input[placeholder="AAPL"]');
    const reactSubmit = document.querySelector('#root .btn-summon');
    if (reactInput && reactSubmit){
      setReactInput(reactInput, t);
      reactSubmit.click();
      return true;
    }
    return false;
  }

  // Fallback: POST /analyze ourselves and open the SSE stream. Both go
  // through the hooked window.fetch / window.EventSource installed by
  // installLiveWiring(), so the council chrome reacts exactly as if the
  // React app had started the run.
  function directAnalyze(){
    const token = localStorage.getItem('bazaar_token') || '';
    // Local date, not toISOString() (UTC) — late evening local can be
    // "tomorrow" in UTC and the backend rejects future dates.
    const d = new Date();
    const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    window.fetch('/analyze?token=' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: t, date: today })
    }).then(function(r){ return r.json(); }).then(function(resp){
      if (!resp || !resp.job_id) throw new Error((resp && (resp.detail || resp.error)) || 'no job_id');
      const es = new EventSource('/stream/' + resp.job_id + '?token=' + encodeURIComponent(token));
      es.addEventListener('message', function(ev){
        try { if (JSON.parse(ev.data).type === 'complete') es.close(); } catch(e){}
      });
    }).catch(function(err){
      console.warn('[challenge] direct analyze failed:', err);
      const txt = document.getElementById('adv-live-text');
      if (txt) txt.textContent = 'Could not start analysis — ' + ((err && err.message) || 'error');
    });
  }

  // The old React-form proxy is unreliable (its selectors target the
  // original Bazaar UI, and the current quickstart form doesn't POST),
  // so always start the run directly.
  directAnalyze();
}

function buildChallengeInput(){
  const existing = document.getElementById('rt-challenge-card');
  if (existing) existing.remove();

  const card = document.createElement('div');
  card.id = 'rt-challenge-card';
  card.className = 'rt-challenge-card';
  card.innerHTML = ''
    + '<div class="rt-challenge-flourish"><svg width="28" height="16" viewBox="0 0 28 16"><path d="M0 8 Q14 0 28 8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M14 16 L14 2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></div>'
    + '<div class="rt-challenge-label">Challenge another stock</div>'
    + '<div class="rt-challenge-row">'
    +   '<input type="text" class="rt-challenge-input" placeholder="Enter ticker symbol..." maxlength="10" autocomplete="off" autocapitalize="characters">'
    +   '<button class="rt-challenge-btn">Analyze</button>'
    + '</div>';

  const verdictCard = document.getElementById('rt-verdict-card');
  if (verdictCard){
    verdictCard.insertAdjacentElement('afterend', card);
  }

  const input = card.querySelector('.rt-challenge-input');
  const btn = card.querySelector('.rt-challenge-btn');
  function doSubmit(){
    const val = input.value.trim().toUpperCase();
    if (!val) return;
    submitChallengeTicker(val);
  }
  btn.addEventListener('click', doSubmit);
  input.addEventListener('keydown', function(e){
    if (e.key === 'Enter'){ e.preventDefault(); doSubmit(); }
  });

  setTimeout(function(){ input.focus(); }, 700);
}

function buildVerdictAndCarousel(){
  const sections = Array.from(document.querySelectorAll('#root .detail-section'));
  const reports = sections.map(sec=>{
    const t = sec.querySelector('h4,h3,h2');
    const b = sec.querySelector('.detail-content') || sec;
    return { title:(t&&t.textContent.trim())||'', html:b.innerHTML };
  }).filter(r=>r.title && r.html.length>50);

  let verdict = 'HOLD';
  const verdictEl = Array.from(document.querySelectorAll('#root *')).find(el=>{
    if (el.children.length>30) return false;
    const t=(el.textContent||'').trim();
    return /^HOLD$|^BUY$|^SELL$/i.test(t);
  });
  if (verdictEl) verdict = verdictEl.textContent.trim().toUpperCase();

  const vc = document.createElement('div');
  vc.id = 'rt-verdict-card'; vc.className = 'rt-verdict-card';
  vc.innerHTML = ''
    + '<svg class="rt-crest-large" viewBox="0 0 100 100"><use href="#castle-crest"/></svg>'
    + '<div class="rt-verdict-label">By Decree of the Round Table</div>'
    + '<div class="rt-verdict-value">'+verdict+'</div>'
    + '<div class="rt-verdict-meta"><span id="rt-verdict-ticker">&mdash;</span><span class="sep">&middot;</span><span>Unanimous Council</span></div>';
  document.getElementById('debate-scene-root').insertAdjacentElement('afterend', vc);

  buildChallengeInput();

  const challengeCard = document.getElementById('rt-challenge-card');
  const insertAfter = challengeCard || vc;

  const car = document.createElement('div');
  car.id = 'rt-report-carousel'; car.className = 'rt-report-carousel';
  car.innerHTML = ''
    + '<div class="rt-carousel-controls">'
    +   '<div class="rt-carousel-title">Council Chronicles &middot; Analyst Reports</div>'
    +   '<div style="display:flex;gap:8px;"><button class="rt-arrow" id="rt-prev">&lsaquo;</button><button class="rt-arrow" id="rt-next">&rsaquo;</button></div>'
    + '</div>'
    + '<div class="rt-report-track" id="rt-report-track"></div>';
  insertAfter.insertAdjacentElement('afterend', car);

  const track = document.getElementById('rt-report-track');
  reports.forEach(src=>{
    const a = analystFromTitle(src.title);
    const card = document.createElement('div');
    card.className = 'rt-report-card';
    card.innerHTML = ''
      + '<div class="rt-report-head">'
      +   '<div class="rt-mini-portrait"><svg viewBox="0 0 100 100"><use href="#portrait-'+a.id+'"/></svg></div>'
      +   '<div><h3>'+a.name+'</h3><div class="rt-report-role">'+a.role+' &middot; '+src.title+'</div></div>'
      + '</div>'
      + '<div class="rt-report-body">'+src.html+'</div>';
    card.title = a.name + ' — ' + a.role + ' (' + (a.id === 'debater' ? 'Bull' : a.id === 'risk' ? 'Bear' : 'Analyst') + ')';
    const btn = document.createElement('button');
    btn.className = 'rt-read-full';
    btn.innerHTML = 'Read Full Scroll';
    btn.addEventListener('click', ()=>openModal(card));
    card.appendChild(btn);
    track.appendChild(card);
  });
  document.getElementById('rt-prev').addEventListener('click', ()=>{ const c=track.querySelector('.rt-report-card'); if(c) track.scrollBy({left:-(c.clientWidth+16),behavior:'smooth'}); });
  document.getElementById('rt-next').addEventListener('click', ()=>{ const c=track.querySelector('.rt-report-card'); if(c) track.scrollBy({left:(c.clientWidth+16),behavior:'smooth'}); });
}

function openModal(card){
  const portrait = card.querySelector('.rt-mini-portrait').innerHTML;
  const name = card.querySelector('h3').textContent;
  const role = card.querySelector('.rt-report-role').textContent;
  const body = card.querySelector('.rt-report-body').innerHTML;
  const back = document.createElement('div');
  back.className='rt-modal-backdrop';
  back.innerHTML = '<div class="rt-modal"><div class="rt-modal-head"><div class="rt-modal-portrait">'+portrait+'</div><div class="rt-modal-title-block"><div class="rt-modal-title">'+name+'</div><div class="rt-modal-sub">'+role+'</div></div><button class="rt-modal-close">&times;</button></div><div class="rt-modal-body">'+body+'</div></div>';
  document.body.appendChild(back);
  requestAnimationFrame(()=>back.classList.add('visible'));
  function close(){ back.classList.remove('visible'); setTimeout(()=>back.remove(),300); document.removeEventListener('keydown',onKey); }
  function onKey(e){ if(e.key==='Escape') close(); }
  back.addEventListener('click', e=>{ if (e.target===back) close(); });
  back.querySelector('.rt-modal-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

// ===== MOUNT =====

function mount(){
  document.title = 'Traders of the Round Table';
  rebrandTextNodes(document.body);
  if (window.__brandObserver) window.__brandObserver.disconnect();
  window.__brandObserver = new MutationObserver(()=>rebrandTextNodes(document.body));
  window.__brandObserver.observe(document.body, { childList:true, subtree:true, characterData:true });

  injectPortraits(()=>{
    buildScene();
    wireControls();
    buildVerdictAndCarousel();
    installLiveWiring();
  });
}

ready(mount);

})();
