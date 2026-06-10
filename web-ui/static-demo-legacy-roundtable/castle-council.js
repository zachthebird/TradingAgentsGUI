/* Traders of the Round Table - drop-in castle UI */
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

const SCRIPT = [
  { id:'market',       text:"Bearish divergence on the MACD histogram. Price made higher highs into $305, but momentum is fading.", sentiment:-2, reactions:[{to:'fundamentals', type:'thinking'},{to:'risk', type:'agree'}] },
  { id:'social',       text:"Sentiment held strong through the week, but volume of mentions is cooling. Crowds are getting cautious.", sentiment:-1, reactions:[{to:'trader', type:'agree'},{to:'debater', type:'thinking'}] },
  { id:'news',         text:"Services revenue narrative is intact. No catalysts to derail the long thesis in the next two weeks.", sentiment:+2, reactions:[{to:'fundamentals', type:'agree'},{to:'market', type:'disagree'}] },
  { id:'fundamentals', text:"Margins are healthy and FCF is expanding. The fundamentals support a higher multiple from here.", sentiment:+3, reactions:[{to:'news', type:'agree'},{to:'debater', type:'disagree'}] },
  { id:'debater',      text:"With respect - fundamentals are a 12-month story. Technicals say the next move is a pullback.", sentiment:-2, reactions:[{to:'market', type:'agree'},{to:'fundamentals', type:'disagree'}], rebuttal:true, target:'fundamentals' },
  { id:'fundamentals', text:"A pullback would only improve the entry. The base case still ends materially higher.", sentiment:+1, reactions:[{to:'debater', type:'disagree'}], rebuttal:true, target:'debater' },
  { id:'debater',      text:"Then we agree we wait. A tactical hold, not a fresh buy.", sentiment:0, reactions:[{to:'fundamentals', type:'thinking'},{to:'judge', type:'agree'}], rebuttal:true, target:'fundamentals' },
  { id:'risk',         text:"Position sizing matters more than direction here. Volatility is creeping up; reduce exposure.", sentiment:-1, reactions:[{to:'trader', type:'agree'}] },
  { id:'trader',       text:"I can defend the current position. I would not add until we see $295 hold.", sentiment:0, reactions:[{to:'risk', type:'agree'},{to:'debater', type:'agree'}] },
  { id:'judge',        text:"Trend is up. Conviction is down. The council rules: HOLD.", sentiment:0, verdict:true },
];

// Demo ticker + quote cache for share export (consumed by castle-share.js)
window.__shareDemoTicker = 'DEMO';
window.__shareQuoteCache = [];

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
  'debater':'debater','bear':'debater','balthazar':'debater',
  'risk':'risk','morwen':'risk',
  'trader':'trader','kael':'trader',
  'judge':'judge','aldric':'judge',

  // LangGraph node names (underscore variant — legacy)
  'market_analyst':'market',
  'social_analyst':'social','sentiment_analyst':'social',
  'news_analyst':'news',
  'fundamentals_analyst':'fundamentals',
  'bull':'fundamentals','bull_researcher':'fundamentals',
  'bear_researcher':'debater',
  'research_manager':'judge',
  'risk_manager':'risk',
  'researcher_judge':'judge','risk_judge':'judge',
  'aggressive_analyst':'debater',
  'neutral_analyst':'risk',
  'conservative_analyst':'trader',
  'portfolio_manager':'judge',

  // LangGraph node names (space-separated — exact match from backend)
  'market analyst':'market',
  'sentiment analyst':'social',
  'news analyst':'news',
  'fundamentals analyst':'fundamentals',
  'bull researcher':'fundamentals',
  'bear researcher':'debater',
  'research manager':'judge',
  'aggressive analyst':'debater',
  'neutral analyst':'risk',
  'conservative analyst':'trader',
  'portfolio manager':'judge',
};

const META = SEATS.reduce((a,s)=>{a[s.id]=s;return a;},{});

// ===== EXPRESSION STATE SYSTEM =====
const STATE_SYMBOLS = {
  market:       { idle:'#portrait-market-idle', thinking:'#portrait-market-thinking', speaking:'#portrait-market-speaking', agree:'#portrait-market-agree', disagree:'#portrait-market-disagree', surprised:'#portrait-market-surprised' },
  social:       { idle:'#portrait-social-idle', thinking:'#portrait-social-thinking', speaking:'#portrait-social-speaking', agree:'#portrait-social-agree', disagree:'#portrait-social-disagree', surprised:'#portrait-social-surprised' },
  news:         { idle:'#portrait-news-idle', thinking:'#portrait-news-thinking', speaking:'#portrait-news-speaking', agree:'#portrait-news-agree', disagree:'#portrait-news-disagree', surprised:'#portrait-news-surprised' },
  fundamentals: { idle:'#portrait-fundamentals-idle', thinking:'#portrait-fundamentals-thinking', speaking:'#portrait-fundamentals-speaking', agree:'#portrait-fundamentals-agree', disagree:'#portrait-fundamentals-disagree', surprised:'#portrait-fundamentals-surprised' },
  debater:      { idle:'#portrait-debater-idle', thinking:'#portrait-debater-thinking', speaking:'#portrait-debater-speaking', agree:'#portrait-debater-agree', disagree:'#portrait-debater-disagree', surprised:'#portrait-debater-surprised' },
  risk:         { idle:'#portrait-risk-idle', thinking:'#portrait-risk-thinking', speaking:'#portrait-risk-speaking', agree:'#portrait-risk-agree', disagree:'#portrait-risk-disagree', surprised:'#portrait-risk-surprised' },
  trader:       { idle:'#portrait-trader-idle', thinking:'#portrait-trader-thinking', speaking:'#portrait-trader-speaking', agree:'#portrait-trader-agree', disagree:'#portrait-trader-disagree', surprised:'#portrait-trader-surprised' },
  judge:        { idle:'#portrait-judge-idle', thinking:'#portrait-judge-thinking', speaking:'#portrait-judge-speaking', agree:'#portrait-judge-agree', disagree:'#portrait-judge-disagree', surprised:'#portrait-judge-surprised' },
};

const BUBBLE_TYPES = {
  standard: '#bubble-standard',
  emphatic: '#bubble-emphatic',
  bull:     '#bubble-bull',
  bear:     '#bubble-bear',
};

// Debater/risk are the bull/bear pair
const BUBBLE_MAP = { debater:'bull', risk:'bear', judge:'emphatic' };

let seatEls = {}, stage, speed=1, playing=false, stopFlag=false, currentIdx=0, tilt=0;
let activeBubble=null, activeReactions=[];
const liveBubbles = {};
const liveTypewriters = {};
let blinkTimers = [];
let hasEntered = false;
let deliberationActive = false;
let deliberationOverlay = null;

// ===== CONSENSUS RING STATE =====
const analystSentiments = {};
SEATS.forEach(s => analystSentiments[s.id] = 0);
let ringFramePending = false;
let ringPendingUpdates = [];
const ARC_CENTER_X = 400, ARC_CENTER_Y = 130, ARC_RADIUS = 145;
const ARC_START_ANGLE = 160, ARC_SWEEP = 220;

function injectPortraits(cb){
  if (document.getElementById('debate-portrait-defs')) return cb();
  fetch(getAssetURL('castle-sprites.svg')).then(r=>r.text()).then(svg=>{
    const wrap = document.createElement('div');
    wrap.id = 'debate-portrait-defs';
    wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    // The SVG file already has an outer <svg>; we want symbol defs inside.
    wrap.innerHTML = svg;
    document.body.appendChild(wrap);
    cb();
  }).catch(e=>{ console.warn('[council] portraits failed', e); cb(); });
}

function buildScene(){
  ['debate-scene-root','rt-verdict-card','rt-challenge-card','rt-report-carousel'].forEach(id=>{
    const el = document.getElementById(id); if (el) el.remove();
  });

  const root = document.createElement('div');
  root.id = 'debate-scene-root';
  root.innerHTML = ''
    + '<div class="rt-chrome">'
    +   '<div class="rt-header">'
    +     '<div class="rt-title">'
    +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6"/></svg>'
    +       '<span>The Council Convenes</span>'
    +     '</div>'
    +     '<div class="rt-controls">'
    +       '<span id="rt-live-indicator" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:linear-gradient(180deg,#2a3043,#1a1f2e);border:1px solid var(--castle-stone-light);color:var(--text-dim);border-radius:6px;font-family:inherit;font-size:10px;letter-spacing:.14em;text-transform:uppercase;">'
    +         '<span id="rt-live-dot" style="width:8px;height:8px;border-radius:50%;background:#666;"></span>'
    +         '<span id="rt-live-text">Idle</span>'
    +       '</span>'
    +       '<button class="rt-btn" id="rt-replay">Replay</button>'
    +       '<button class="rt-btn" id="rt-speed">1x</button>'
    +       '<button class="rt-btn primary" id="rt-play">Play</button>'
    +       '<button class="rt-btn" id="rt-toggle-reports">Hide Chronicles</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="rt-stage" id="rt-stage">'
    +     '<div class="rt-banner left"></div>'
    +     '<div class="rt-banner right"></div>'
    +     '<div class="rt-table"></div>'
    +     '<svg class="rt-crest"><use href="#castle-crest"/></svg>'
    +     '<div class="rt-verdict-banner" id="rt-verdict-banner"></div>'
    +     '<div class="rt-scales" id="rt-scales">'
    +       '<div class="rt-scales-beam"></div>'
    +       '<div class="rt-scales-pivot"></div>'
    +       '<div class="rt-scales-pan rt-scales-pan-left"><span class="rt-scales-pan-label">BEAR</span></div>'
    +       '<div class="rt-scales-pan rt-scales-pan-right"><span class="rt-scales-pan-label">BULL</span></div>'
    +     '</div>'
    +     '<div class="rt-torch-flare" id="rt-torch-flare"></div>'
    +     '<div class="rt-ember-field" id="rt-ember-field"></div>'
    +     '<div class="rt-verdict-beat" id="rt-verdict-beat"></div>'
    +     '<div class="rt-seal" id="rt-seal"><div class="rt-seal-inner"></div></div>'
    +     '<div class="rt-status" id="rt-status">The council awaits...</div>'
    +   '</div>'
    +   '<div class="rt-tug-meter" id="rt-tug-meter">'
    +     '<div class="rt-tug-pole rt-tug-bear">'
    +       '<div class="rt-tug-pole-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M3 18 L7 6 L11 18 M5 14h10" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="0.5" fill="currentColor"/></svg></div>'
    +       '<div class="rt-tug-pole-name">MORWEN</div>'
    +       '<div class="rt-tug-pole-label">BEAR</div>'
    +       '<div class="rt-tug-pole-strength" id="rt-bear-strength">0</div>'
    +     '</div>'
    +     '<div class="rt-tug-track" id="rt-tug-track">'
    +       '<div class="rt-tug-center-mark"></div>'
    +       '<div class="rt-tug-tick rt-tug-tick-b3"></div>'
    +       '<div class="rt-tug-tick rt-tug-tick-b2"></div>'
    +       '<div class="rt-tug-tick rt-tug-tick-b1"></div>'
    +       '<div class="rt-tug-tick rt-tug-tick-n"></div>'
    +       '<div class="rt-tug-tick rt-tug-tick-u1"></div>'
    +       '<div class="rt-tug-tick rt-tug-tick-u2"></div>'
    +       '<div class="rt-tug-tick rt-tug-tick-u3"></div>'
    +       '<div class="rt-tug-rope-left" id="rt-tug-rope-left"></div>'
    +       '<div class="rt-tug-rope-right" id="rt-tug-rope-right"></div>'
    +       '<div class="rt-tug-indicator" id="rt-tug-indicator"></div>'
    +       '<div class="rt-tug-pull-left" id="rt-tug-pull-left"></div>'
    +       '<div class="rt-tug-pull-right" id="rt-tug-pull-right"></div>'
    +     '</div>'
    +     '<div class="rt-tug-pole rt-tug-bull">'
    +       '<div class="rt-tug-pole-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 L12 20 M12 3 L8 7 M12 3 L16 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="12" cy="6" rx="1.2" ry="0.8" fill="currentColor" opacity="0.4"/></svg></div>'
    +       '<div class="rt-tug-pole-name">BALTHAZAR</div>'
    +       '<div class="rt-tug-pole-label">BULL</div>'
    +       '<div class="rt-tug-pole-strength" id="rt-bull-strength">0</div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="rt-consensus-ring" id="rt-consensus-ring">'
    +     '<svg viewBox="0 0 800 160" class="rt-ring-svg" aria-label="Council consensus ring">'
    +       '<defs>'
    +         '<linearGradient id="tilt-gradient" x1="0%" y1="0%" x2="100%" y2="0%">'
    +           '<stop offset="0%" stop-color="var(--castle-crimson-bright)"/>'
    +           '<stop offset="15%" stop-color="var(--castle-crimson)"/>'
    +           '<stop offset="35%" stop-color="var(--castle-crimson)" stop-opacity="0.6"/>'
    +           '<stop offset="50%" stop-color="var(--castle-stone-light)"/>'
    +           '<stop offset="65%" stop-color="var(--castle-gold-soft)" stop-opacity="0.6"/>'
    +           '<stop offset="85%" stop-color="var(--castle-gold-soft)"/>'
    +           '<stop offset="100%" stop-color="var(--castle-gold-bright)"/>'
    +         '</linearGradient>'
    +         '<filter id="dot-glow-bull"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    +         '<filter id="dot-glow-bear"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    +       '</defs>'
    +       '<path class="rt-ring-track" d="M 263.7 179.6 A 145 145 0 0 1 536.3 179.6" fill="none" stroke="var(--castle-stone-dark)" stroke-width="14" stroke-linecap="round"/>'
    +       '<path class="rt-ring-glow" id="rt-ring-glow" d="M 263.7 179.6 A 145 145 0 0 1 536.3 179.6" fill="none" stroke="url(#tilt-gradient)" stroke-width="8" stroke-linecap="round"/>'
    +       '<polygon class="rt-ring-needle" id="rt-ring-needle" points="0,-10 8,0 0,10 -8,0" fill="var(--castle-gold-bright)" stroke="var(--castle-gold-bright)" stroke-width="1"/>'
    +       '<circle class="rt-ring-dot" data-analyst="market" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<circle class="rt-ring-dot" data-analyst="social" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<circle class="rt-ring-dot" data-analyst="news" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<circle class="rt-ring-dot" data-analyst="fundamentals" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<circle class="rt-ring-dot" data-analyst="debater" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<circle class="rt-ring-dot" data-analyst="risk" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<circle class="rt-ring-dot" data-analyst="trader" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<circle class="rt-ring-dot" data-analyst="judge" cx="400" cy="130" r="5" fill="var(--castle-stone-light)" opacity="0.5"/>'
    +       '<text class="rt-ring-label" x="42" y="135">Bearish</text>'
    +       '<text class="rt-ring-label" x="758" y="135" text-anchor="end">Bullish</text>'
    +     '</svg>'
    +     '<div class="rt-ring-mobile">'
    +       '<div class="rt-ring-mobile-dots" id="rt-ring-mobile-dots">'
    +         '<span class="rt-ring-mobile-dot" data-analyst="market" style="--dot-color:var(--castle-stone-light)"></span>'
    +         '<span class="rt-ring-mobile-dot" data-analyst="social" style="--dot-color:var(--castle-stone-light)"></span>'
    +         '<span class="rt-ring-mobile-dot" data-analyst="news" style="--dot-color:var(--castle-stone-light)"></span>'
    +         '<span class="rt-ring-mobile-dot" data-analyst="fundamentals" style="--dot-color:var(--castle-stone-light)"></span>'
    +         '<span class="rt-ring-mobile-dot" data-analyst="debater" style="--dot-color:var(--castle-stone-light)"></span>'
    +         '<span class="rt-ring-mobile-dot" data-analyst="risk" style="--dot-color:var(--castle-stone-light)"></span>'
    +         '<span class="rt-ring-mobile-dot" data-analyst="trader" style="--dot-color:var(--castle-stone-light)"></span>'
    +       '</div>'
    +       '<div class="rt-ring-mobile-bar">'
    +         '<div class="rt-ring-mobile-needle" id="rt-ring-mobile-needle"></div>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="rt-progress" id="rt-progress"></div>'
    + '</div>';

  const reactRoot = document.getElementById('root') || document.body.firstChild;
  if (reactRoot && reactRoot.parentNode) reactRoot.parentNode.insertBefore(root, reactRoot);
  else document.body.appendChild(root);

  stage = document.getElementById('rt-stage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const cx = sw/2, cy = sh/2, radius = Math.min(sw,sh)*0.40;
  seatEls = {};
  SEATS.forEach(seat=>{
    const r = seat.angle * Math.PI / 180;
    const x = cx + radius * Math.cos(r);
    const y = cy + radius * Math.sin(r);
    const el = document.createElement('div');
    el.className = 'rt-seat';
    el.dataset.id = seat.id;
    el.dataset.angle = seat.angle;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = '<div class="rt-portrait"><svg viewBox="0 0 100 100"><use href="#portrait-'+seat.id+'"/></svg></div>'
      + '<div class="rt-name">'+seat.name+'</div>'
      + '<div class="rt-role">'+seat.role+'</div>';
    stage.appendChild(el);
    seatEls[seat.id] = el;
  });
  for (let i=0; i<SEATS.length; i++){
    const a1 = SEATS[i].angle, a2 = SEATS[(i+1)%SEATS.length].angle;
    let mid = (i === SEATS.length-1) ? ((a1+a2+360)/2)%360 : (a1+a2)/2;
    const r = (mid*Math.PI/180);
    const rr = radius * 1.18;
    const x = cx + rr*Math.cos(r), y = cy + rr*Math.sin(r);
    const c = document.createElement('div');
    c.className = 'rt-candle';
    c.dataset.candle = String(i);
    c.style.left = x+'px'; c.style.top = y+'px';
    c.style.animationDelay = (i*0.2)+'s';
    stage.appendChild(c);
  }
  const prog = document.getElementById('rt-progress');
  SCRIPT.forEach(()=>{ const p=document.createElement('div'); p.className='rt-pip'; prog.appendChild(p); });
}

function setStatus(t){ const e=document.getElementById('rt-status'); if(e) e.textContent=t; }

// ===== SENTIMENT TUG-OF-WAR METER =====
let bullScore = 0, bearScore = 0, tugAnimFrame = null, tugSettled = false;
function clampTug(v){ return Math.max(5, Math.min(95, v)); }
function tugPercent(){
  const total = bullScore + bearScore;
  if (total === 0) return 50;
  // Weighted: start at 50, pull toward bull or bear side
  const raw = 50 + ((bullScore - bearScore) / Math.max(total, 0.5)) * 45;
  return clampTug(raw);
}

function setTugPosition(pct, instant){
  tugSettled = false;
  const indicator = document.getElementById('rt-tug-indicator');
  const ropeL = document.getElementById('rt-tug-rope-left');
  const ropeR = document.getElementById('rt-tug-rope-right');
  const pullL = document.getElementById('rt-tug-pull-left');
  const pullR = document.getElementById('rt-tug-pull-right');
  const track = document.getElementById('rt-tug-track');
  if (!indicator || !track) return;
  
  // Update indicator position
  if (instant){
    indicator.style.transition = 'none';
    indicator.style.left = pct + '%';
    // Force reflow
    indicator.offsetHeight;
    indicator.style.transition = '';
  } else {
    indicator.style.left = pct + '%';
  }
  
  // Animate ropes — left rope pulls from bear pole to indicator, right from bull pole
  if (ropeL) ropeL.style.width = pct + '%';
  if (ropeR) ropeR.style.width = (100 - pct) + '%';
  
  // Pull effect arrows — show which side is winning
  const diff = bullScore - bearScore;
  if (pullL) pullL.style.opacity = diff < 0 ? Math.min(1, Math.abs(diff) / 3) : '0';
  if (pullR) pullR.style.opacity = diff > 0 ? Math.min(1, Math.abs(diff) / 3) : '0';
  
  // Update strength counters
  const bearEl = document.getElementById('rt-bear-strength');
  const bullEl = document.getElementById('rt-bull-strength');
  if (bearEl) bearEl.textContent = Math.round(bearScore);
  if (bullEl) bullEl.textContent = Math.round(bullScore);
  
  // Track class for CSS-driven effects
  if (track){
    track.classList.remove('bull-leaning','bear-leaning','deadlocked');
    if (Math.abs(diff) < 1) track.classList.add('deadlocked');
    else if (diff > 0) track.classList.add('bull-leaning');
    else track.classList.add('bear-leaning');
  }
}

function addBullPull(amount, instant){
  bullScore += Math.abs(amount);
  setTugPosition(tugPercent(), instant);
}

function addBearPull(amount, instant){
  bearScore += Math.abs(amount);
  setTugPosition(tugPercent(), instant);
}

function settleVerdict(verdict){
  tugSettled = true;
  const indicator = document.getElementById('rt-tug-indicator');
  const track = document.getElementById('rt-tug-track');
  
  // Detach indicator briefly for dramatic settle
  if (indicator) indicator.classList.add('settling');
  
  let targetPct;
  switch((verdict||'').toUpperCase()){
    case 'BUY':  targetPct = 90; bullScore += 5; break;
    case 'SELL': targetPct = 10; bearScore += 5; break;
    default:     targetPct = tugPercent(); break; // HOLD stays where it is
  }
  
  // Brief pause then slam
  setTimeout(() => {
    setTugPosition(targetPct);
    if (indicator) indicator.classList.add('settled');
    if (track) track.classList.add('verdict-reached');
    // Update strength numbers
    const bearEl = document.getElementById('rt-bear-strength');
    const bullEl = document.getElementById('rt-bull-strength');
    if (bearEl) bearEl.textContent = Math.round(bearScore);
    if (bullEl) bullEl.textContent = Math.round(bullScore);
  }, 200);
}

function resetTug(){
  bullScore = 0; bearScore = 0; tugSettled = false;
  const indicator = document.getElementById('rt-tug-indicator');
  const track = document.getElementById('rt-tug-track');
  if (indicator){ indicator.classList.remove('settling','settled'); indicator.style.left = '50%'; }
  if (track) track.classList.remove('bull-leaning','bear-leaning','deadlocked','verdict-reached');
  const bearEl = document.getElementById('rt-bear-strength');
  const bullEl = document.getElementById('rt-bull-strength');
  if (bearEl) bearEl.textContent = '0';
  if (bullEl) bullEl.textContent = '0';
  const ropeL = document.getElementById('rt-tug-rope-left');
  const ropeR = document.getElementById('rt-tug-rope-right');
  if (ropeL) ropeL.style.width = '50%';
  if (ropeR) ropeR.style.width = '50%';
  const pullL = document.getElementById('rt-tug-pull-left');
  const pullR = document.getElementById('rt-tug-pull-right');
  if (pullL) pullL.style.opacity = '0';
  if (pullR) pullR.style.opacity = '0';
}

// ===== CONSENSUS RING =====
function ringAngle(sentiment){
  // sentiment -3..+3 → arc angle 160°..380° (220° sweep)
  return ARC_START_ANGLE + ((sentiment + 3) / 6) * ARC_SWEEP;
}

function ringCoords(sentiment){
  const angle = ringAngle(sentiment);
  const rad = angle * Math.PI / 180;
  return {
    x: ARC_CENTER_X + ARC_RADIUS * Math.cos(rad),
    y: ARC_CENTER_Y + ARC_RADIUS * Math.sin(rad),
    angle: angle
  };
}

function updateConsensusRing(instant){
  const container = document.getElementById('rt-consensus-ring');
  if (!container) return;

  const svg = container.querySelector('.rt-ring-svg');
  if (!svg) return;

  const reducedMotion = prefersReducedMotion();
  const transStyle = (instant || reducedMotion) ? 'none' : '';

  // Update each analyst dot
  SEATS.forEach(function(seat){
    const s = analystSentiments[seat.id];
    const dot = svg.querySelector('.rt-ring-dot[data-analyst="' + seat.id + '"]');
    if (!dot) return;

    const pos = ringCoords(s);
    const r = 5 + Math.abs(s) * 2;
    const opacity = (0.5 + Math.abs(s) * 0.17).toFixed(2);
    const fill = s > 0 ? 'var(--castle-gold-bright)' :
                 s < 0 ? 'var(--castle-crimson-bright)' :
                         'var(--castle-stone-light)';
    const filter = s > 0 ? 'url(#dot-glow-bull)' :
                   s < 0 ? 'url(#dot-glow-bear)' : 'none';

    if (instant || reducedMotion){
      dot.style.transition = 'none';
    }
    dot.setAttribute('cx', pos.x.toFixed(1));
    dot.setAttribute('cy', pos.y.toFixed(1));
    dot.setAttribute('r', r.toFixed(1));
    dot.setAttribute('fill', fill);
    dot.setAttribute('filter', filter);
    dot.style.opacity = opacity;

    if (instant || reducedMotion){
      dot.offsetHeight;
      dot.style.transition = '';
    }
  });

  // Update tilt needle — cumulative council tilt
  const tiltSum = Object.values(analystSentiments).reduce(function(a,b){ return a + b; }, 0);
  // Scale: sum can be -24..+24 (8 analysts × ±3), map to -12..+12 for the arc
  const activeAnalysts = Object.values(analystSentiments).filter(function(v){ return v !== 0; }).length || 1;
  const clampedTilt = Math.max(-3, Math.min(3, tiltSum / Math.max(activeAnalysts, 1)));
  const needlePos = ringCoords(clampedTilt);

  const needle = svg.querySelector('.rt-ring-needle');
  if (needle){
    if (instant || reducedMotion) needle.style.transition = 'none';
    needle.setAttribute('transform',
      'translate(' + needlePos.x.toFixed(1) + ', ' + needlePos.y.toFixed(1) + ') rotate(' + (needlePos.angle + 90) + ')');
    if (instant || reducedMotion){
      needle.offsetHeight;
      needle.style.transition = '';
    }
  }

  // Update glow arc fill via stroke-dashoffset
  const glowPath = svg.querySelector('.rt-ring-glow');
  if (glowPath){
    const totalLength = glowPath.getTotalLength();
    if (totalLength > 0){
      // Map tilt from -3..+3 to 0..1 (bear → bull)
      const fillPct = (clampedTilt + 3) / 6;
      if (instant || reducedMotion) glowPath.style.transition = 'none';
      glowPath.style.strokeDasharray = totalLength;
      glowPath.style.strokeDashoffset = totalLength * (1 - fillPct);
      if (instant || reducedMotion){
        glowPath.offsetHeight;
        glowPath.style.transition = '';
      }
    }
  }

  // Update mobile fallback
  updateMobileRing(clampedTilt);
}

function updateMobileRing(clampedTilt){
  const mobileDots = document.getElementById('rt-ring-mobile-dots');
  const mobileNeedle = document.getElementById('rt-ring-mobile-needle');
  if (!mobileDots) return;

  SEATS.forEach(function(seat){
    const dot = mobileDots.querySelector('.rt-ring-mobile-dot[data-analyst="' + seat.id + '"]');
    if (!dot) return;
    const s = analystSentiments[seat.id];
    const color = s > 0 ? 'var(--castle-gold-bright)' :
                  s < 0 ? 'var(--castle-crimson-bright)' :
                          'var(--castle-stone-light)';
    dot.style.setProperty('--dot-color', color);
    dot.style.backgroundColor = color;
    const size = Math.max(6, 5 + Math.abs(s) * 2);
    dot.style.width = size + 'px';
    dot.style.height = size + 'px';
  });

  if (mobileNeedle){
    const pct = ((clampedTilt + 3) / 6) * 100;
    mobileNeedle.style.left = pct + '%';
  }
}

function resetConsensusRing(){
  SEATS.forEach(function(s){ analystSentiments[s.id] = 0; });
  updateConsensusRing(true);
  const container = document.getElementById('rt-consensus-ring');
  if (container) container.classList.remove('verdict-mode');
}

function initConsensusRingEntrance(){
  const container = document.getElementById('rt-consensus-ring');
  if (!container) return;
  const svg = container.querySelector('.rt-ring-svg');
  if (!svg) return;

  // Stagger dots entrance clockwise from market
  const entranceOrder = ['market','social','news','fundamentals','debater','risk','trader','judge'];
  entranceOrder.forEach(function(id, idx){
    const dot = svg.querySelector('.rt-ring-dot[data-analyst="' + id + '"]');
    if (!dot) return;
    // Dots start at arc center, then enter with pop animation
    dot.setAttribute('cx', '400');
    dot.setAttribute('cy', '130');
    dot.setAttribute('r', '0');
    dot.setAttribute('fill', 'var(--castle-stone-light)');
    dot.style.opacity = '0';
    dot.classList.remove('entering', 'entered');

    setTimeout(function(){
      // Pop into view at arc center with small radius
      dot.setAttribute('r', '4');
      dot.style.opacity = '0.4';
      dot.classList.add('entering');
      setTimeout(function(){
        dot.classList.remove('entering');
        dot.classList.add('entered');
      }, 450);
    }, idx * 150);
  });

  // Needle starts at arc center — bottom of arc (270°)
  const needle = svg.querySelector('.rt-ring-needle');
  if (needle){
    needle.setAttribute('transform', 'translate(400, 275) rotate(360)');
  }

  // Glow starts at zero fill
  const glowPath = svg.querySelector('.rt-ring-glow');
  if (glowPath){
    const tl = glowPath.getTotalLength();
    if (tl > 0){
      glowPath.style.strokeDasharray = tl;
      glowPath.style.strokeDashoffset = tl;
    }
  }
}

function setConsensusVerdictMode(){
  const container = document.getElementById('rt-consensus-ring');
  if (container) container.classList.add('verdict-mode');
}

function prefersReducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function clearReactions(){ activeReactions.forEach(r=>r.remove()); activeReactions=[]; }
function clearBubble(){ 
  if(activeBubble){ 
    activeBubble.classList.remove('visible'); 
    // Clear typewriter interval if active
    if (activeBubble._twInterval) { clearInterval(activeBubble._twInterval); activeBubble._twInterval = null; }
    const b=activeBubble; setTimeout(()=>b.remove(),300); activeBubble=null; 
  } 
}
function resetSeats(){ Object.values(seatEls).forEach(el=>el.classList.remove('speaking','thinking','done','dimmed')); }

function setCandleState(state){
  if (!stage) return;
  stage.classList.remove('candles-calm','candles-heated','candles-verdict','candles-victory');
  if (state) stage.classList.add(state);
}

// ===== FRAME-SWAP ENGINE =====
function setSeatState(seatId, state){
  const el = seatEls[seatId];
  if (!el) return;
  const symbols = STATE_SYMBOLS[seatId];
  if (!symbols || !symbols[state]) return;
  const useEl = el.querySelector('.rt-portrait svg use');
  if (!useEl) return;
  const targetHref = symbols[state];
  if (useEl.getAttribute('href') === targetHref) return;
  useEl.classList.add('switching');
  setTimeout(() => {
    useEl.setAttribute('href', targetHref);
    requestAnimationFrame(() => {
      useEl.classList.remove('switching');
    });
  }, 180);
}

function setAllSeatsState(state){
  Object.keys(seatEls).forEach(id => setSeatState(id, state));
}

// ===== IDLE BLINK =====
function startIdleBlinking(){
  blinkTimers.forEach(clearTimeout);
  blinkTimers = [];
  Object.values(seatEls).forEach(el => {
    const blink = () => {
      if (el.classList.contains('speaking') || el.classList.contains('thinking') || stopFlag) return;
      el.classList.add('blinking');
      const t1 = setTimeout(() => el.classList.remove('blinking'), 300);
      const t2 = setTimeout(blink, 3000 + Math.random() * 4000);
      blinkTimers.push(t1, t2);
    };
    const init = setTimeout(blink, Math.random() * 3000);
    blinkTimers.push(init);
  });
}

// ===== ENTRANCE ANIMATION =====
function animateEntrance(){
  if (hasEntered) return;
  hasEntered = true;
  const entranceOrder = ['judge','market','social','news','fundamentals','debater','risk','trader'];
  entranceOrder.forEach((id, idx) => {
    const el = seatEls[id];
    if (!el) return;
    setTimeout(() => {
      el.classList.add('entering');
      // Set initial state to idle expression
      setSeatState(id, 'idle');
      setTimeout(() => el.classList.remove('entering'), 700);
    }, idx === 0 ? 0 : 200 + idx * 200);
  });
  // Stage fade-in handled by CSS
  setTimeout(() => {
    if (stage) stage.classList.add('entered');
    startIdleBlinking();
  }, entranceOrder.length * 200 + 200);
}

function placeBubble(bubble, seatId){
  const seatEl = seatEls[seatId];
  if (!seatEl) return;
  const angle = parseFloat(seatEl.dataset.angle);
  bubble.style.opacity='0';
  bubble.style.left='0px'; bubble.style.top='0px';
  requestAnimationFrame(()=>{
    const sb = seatEl.getBoundingClientRect();
    const stb = stage.getBoundingClientRect();
    const bb = bubble.getBoundingClientRect();
    const bw=bb.width, bh=bb.height;
    const sx = sb.left - stb.left + sb.width/2;
    const sy = sb.top - stb.top + sb.height/2;
    let x=sx, y=sy;
    if (angle===270){ x=sx-bw/2; y=sy-sb.height/2-bh-8; }
    else if (angle===315){ x=sx-bw-8; y=sy-bh-4; }
    else if (angle===0){ x=sx+sb.width/2+4; y=sy-bh/2; }
    else if (angle===45){ x=sx+8; y=sy+4; }
    else if (angle===90){ x=sx-bw/2; y=sy+sb.height/2+8; }
    else if (angle===135){ x=sx-bw-8; y=sy+4; }
    else if (angle===180){ x=sx-bw-sb.width/2-4; y=sy-bh/2; }
    else if (angle===225){ x=sx-bw+8; y=sy-bh-4; }
    x=Math.max(8,Math.min(stb.width-bw-8,x));
    y=Math.max(8,Math.min(stb.height-bh-8,y));
    bubble.style.left=x+'px'; bubble.style.top=y+'px';
    bubble.style.opacity=''; bubble.classList.add('visible');
  });
}

function showBubble(line){
  clearBubble();
  const meta = META[line.id];
  const bubbleType = BUBBLE_MAP[line.id] || 'standard';
  const b = document.createElement('div');
  b.className = 'rt-bubble' + (bubbleType !== 'standard' ? ' '+bubbleType : '') + (line.rebuttal?' rebuttal':'');

  // Use bubble SVG backdrop for typed bubbles
  const bubbleSvgRef = BUBBLE_TYPES[bubbleType] || BUBBLE_TYPES.standard;
  const nameHTML = '<div class="rt-bubble-name"><span class="dot"></span>'+meta.name+' &mdash; '+meta.role+'</div>';

  b.innerHTML = nameHTML + '<div class="rt-bubble-body">'+line.text+'</div>';
  stage.appendChild(b);
  activeBubble = b;
  placeBubble(b, line.id);

  // Typewriter effect for non-verdict lines
  if (!line.verdict){
    const bodyEl = b.querySelector('.rt-bubble-body');
    const fullText = line.text;
    bodyEl.textContent = '';
    let i = 0;
    b._twInterval = setInterval(() => {
      bodyEl.textContent += fullText[i++];
      if (i >= fullText.length) { clearInterval(b._twInterval); b._twInterval = null; }
    }, 22);
  }

  if (line.rebuttal){
    setTimeout(()=>b.classList.add('shake'),200);
    setTimeout(()=>b.classList.remove('shake'),700);
  }
  
  // Cache quote text for share export (castle-share.js reads window.__shareQuoteCache)
  if (window.__shareQuoteCache && !window.__shareQuoteCache.includes(line.text)) {
    window.__shareQuoteCache.push(line.text);
  }
}

function showReactions(reactions){
  clearReactions();
  if (!reactions) return;
  reactions.forEach((r,i)=>{
    const seatEl = seatEls[r.to]; if (!seatEl) return;
    const sb = seatEl.getBoundingClientRect();
    const stb = stage.getBoundingClientRect();
    const sx = sb.left - stb.left + sb.width/2;
    const sy = sb.top - stb.top;
    const el = document.createElement('div');
    el.className = 'rt-reaction ' + r.type;
    const label = { agree:'Aye', disagree:'Nay', thinking:'Pondering' }[r.type] || r.type;
    el.innerHTML = '<span class="chip"><svg viewBox="0 0 100 100"><use href="#portrait-'+r.to+'"/></svg></span><span>'+label+'</span>';
    el.style.left = sx+'px'; el.style.top = sy+'px';
    stage.appendChild(el);
    activeReactions.push(el);
    setTimeout(()=>el.classList.add('visible'), 80 + i*120);
  });
}

function setActiveSeat(id){ Object.entries(seatEls).forEach(([k,el])=>{ el.classList.remove('speaking','thinking'); if(k===id) el.classList.add('speaking'); }); }
function markDone(id){ if(seatEls[id]) seatEls[id].classList.add('done'); }
function updateProgress(i){ document.querySelectorAll('#rt-progress .rt-pip').forEach((p,idx)=>{ p.classList.remove('active'); if(idx<i) p.classList.add('done'); if(idx===i) p.classList.add('active'); }); }
async function wait(ms){ const step=50; let e=0; while(e<ms/speed){ if(stopFlag) throw new Error('stop'); await new Promise(r=>setTimeout(r,step)); e+=step; } }

// ===== CINEMATIC VERDICT REVEAL =====
function fireEmbers() {
  const field = document.getElementById('rt-ember-field');
  if (!field) return;
  // Clear existing embers
  field.innerHTML = '';
  // Spawn 30-45 ember particles from candle positions
  const count = prefersReducedMotion() ? 0 : 35 + Math.floor(Math.random() * 15);
  const candles = stage.querySelectorAll('.rt-candle');
  for (let i = 0; i < count; i++) {
    const ember = document.createElement('div');
    ember.className = 'rt-ember';
    // Position near candle positions around the table
    const candleIdx = i % candles.length;
    const candle = candles[candleIdx];
    const cr = candle.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const cx = cr.left - sr.left + cr.width / 2;
    const cy = cr.top - sr.top + cr.height / 2;
    ember.style.left = (cx + (Math.random() - 0.5) * 40) + 'px';
    ember.style.top = (cy + (Math.random() - 0.5) * 20) + 'px';
    ember.style.setProperty('--ember-drift-x', ((Math.random() - 0.5) * 60) + 'px');
    ember.style.setProperty('--ember-duration', (2 + Math.random() * 3) + 's');
    ember.style.setProperty('--ember-delay', (Math.random() * 1.2) + 's');
    // Vary ember color: mostly candle gold, some crimson
    if (Math.random() < 0.2) {
      ember.style.background = 'var(--castle-crimson-bright)';
      ember.style.boxShadow = '0 0 6px rgba(196,63,84,0.6), 0 0 12px rgba(196,63,84,0.3)';
    }
    field.appendChild(ember);
    // Trigger animation after a microtask
    requestAnimationFrame(function() {
      ember.classList.add('active');
      // Remove after animation
      var dur = parseFloat(ember.style.getPropertyValue('--ember-duration')) || 3;
      var del = parseFloat(ember.style.getPropertyValue('--ember-delay')) || 1;
      setTimeout(function() { if (ember.parentNode) ember.remove(); }, (dur + del) * 1000 + 200);
    });
  }
}

function triggerCinematicVerdict(verdict) {
  const v = (verdict || 'HOLD').toUpperCase();
  var reducedMotion = prefersReducedMotion();

  // 1. Torch flare
  var flare = document.getElementById('rt-torch-flare');
  if (flare) { flare.classList.remove('fire'); void flare.offsetWidth; flare.classList.add('fire'); }

  // 2. Ember particles
  fireEmbers();

  // 3. Scales tipping
  var scales = document.getElementById('rt-scales');
  if (scales) {
    scales.classList.remove('active', 'buy', 'sell', 'hold');
    void scales.offsetWidth;
    scales.classList.add('active');
    scales.classList.add(v === 'BUY' ? 'buy' : v === 'SELL' ? 'sell' : 'hold');
  }

  // 4. Wax seal stamp (slightly after scales start tipping)
  setTimeout(function() {
    var seal = document.getElementById('rt-seal');
    var sealInner = seal ? seal.querySelector('.rt-seal-inner') : null;
    if (seal) {
      seal.classList.remove('active', 'buy', 'sell', 'hold');
      void seal.offsetWidth;
      seal.classList.add(v === 'BUY' ? 'buy' : v === 'SELL' ? 'sell' : 'hold');
      if (sealInner) sealInner.textContent = v;
      seal.classList.add('active');
    }
  }, reducedMotion ? 0 : 400);

  // 5. Verdict beat — audio sync hook
  setTimeout(function() {
    var beat = document.getElementById('rt-verdict-beat');
    if (beat) { beat.classList.remove('fire'); void beat.offsetWidth; beat.classList.add('fire'); }
    // Dispatch custom event for audio card to hook a sting
    try {
      window.dispatchEvent(new CustomEvent('council-verdict-beat', { detail: { verdict: v, timestamp: Date.now() } }));
    } catch (e) {}
  }, reducedMotion ? 100 : 700);

  // 6. Update verdict banner with BUY/SELL/HOLD styling
  var banner = document.getElementById('rt-verdict-banner');
  if (banner) {
    banner.classList.remove('buy', 'sell', 'hold');
    banner.classList.add(v === 'BUY' ? 'buy' : v === 'SELL' ? 'sell' : 'hold');
  }

  // 7. Cleanup ember field after animations finish
  setTimeout(function() {
    var field = document.getElementById('rt-ember-field');
    if (field) field.innerHTML = '';
  }, 5000);
}

async function freezeFrame(verdict){
  const v = (verdict || 'HOLD').toUpperCase();
  if (stage) { stage.classList.add('verdict-mode'); setCandleState('candles-verdict'); }
  Object.entries(seatEls).forEach(([k,el])=>{ if(k!=='judge') el.classList.add('dimmed'); });
  if (seatEls.judge){ 
    seatEls.judge.classList.remove('done','dimmed'); 
    seatEls.judge.classList.add('speaking'); 
    setSeatState('judge', 'speaking');
    // Verdict finale class for dramatic glow
    setTimeout(() => seatEls.judge.classList.add('verdict-finale'), 600);
  }
  const banner = document.getElementById('rt-verdict-banner');
  if (banner){
    banner.setAttribute('data-verdict', v);
    banner.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1408" stroke-width="1.8"><path d="M12 2 L 19 6 L 19 11 Q 19 19 12 22 Q 5 19 5 11 L 5 6 Z"/><path d="M9 12 L 12 9 L 15 12 M 12 9 L 12 15"/></svg><span>'+v+'</span>';
    banner.classList.remove('show', 'buy', 'sell', 'hold');
    void banner.offsetWidth;
    banner.classList.add('show', v === 'BUY' ? 'buy' : v === 'SELL' ? 'sell' : 'hold');
  }
  // Trigger cinematic verdict reveal
  triggerCinematicVerdict(v);
  // Settle the tug-of-war meter
  settleVerdict(v);
  // Verdict mode on consensus ring
  setConsensusVerdictMode();
}

async function playFrom(idx){
  playing=true; stopFlag=false;
  const pb = document.getElementById('rt-play'); if (pb) pb.textContent='Pause';
  if (idx===0){
    resetSeats(); clearBubble(); clearReactions(); resetTug(); resetConsensusRing();
    // Clear share export caches so old demo quotes don't persist
    if (window.__shareQuoteCache) window.__shareQuoteCache.length = 0;
    const vb = document.getElementById('rt-verdict-banner'); if (vb) { vb.classList.remove('show', 'buy', 'sell', 'hold'); }
    const sc = document.getElementById('rt-scales'); if (sc) sc.classList.remove('active', 'buy', 'sell', 'hold');
    const sl = document.getElementById('rt-seal'); if (sl) sl.classList.remove('active', 'buy', 'sell', 'hold');
    const fl = document.getElementById('rt-torch-flare'); if (fl) fl.classList.remove('fire');
    const em = document.getElementById('rt-ember-field'); if (em) em.innerHTML = '';
    if (stage) { stage.classList.remove('verdict-mode'); setCandleState('candles-calm'); }
    updateProgress(-1);
    setAllSeatsState('idle');
    // Re-trigger entrance animation
    hasEntered = false;
    animateEntrance();
    // Trigger consensus ring entrance
    setTimeout(function(){ initConsensusRingEntrance(); }, 600);
  }
  try {
    for (let i=idx; i<SCRIPT.length; i++){
      if (stopFlag) break;
      currentIdx=i;
      const line = SCRIPT[i];
      updateProgress(i);

      // Phase: THINKING
      setSeatState(line.id, 'thinking');
      const prevSpeaker = document.querySelector('.rt-seat.speaking');
      setStatus(line.rebuttal?'Rebuttal in progress...':(line.verdict?'The council renders its verdict...':META[line.id].name+' ponders...'));
      await wait(line.verdict?600:800);

      // Phase: SPEAKING
      clearBubble();
      Object.values(seatEls).forEach(el=>el.classList.remove('speaking','thinking'));
      seatEls[line.id].classList.add('speaking');
      setSeatState(line.id, 'speaking');
      // Dynamic candle lighting based on phase
      if (line.verdict) setCandleState('candles-verdict');
      else if (line.rebuttal || line.id==='debater' || line.id==='risk') setCandleState('candles-heated');
      else setCandleState('candles-calm');
      setStatus(line.rebuttal?'Rebuttal in progress...':(line.verdict?'The council renders its verdict...':META[line.id].name+' speaks'));
      showBubble(line);
      showReactions(line.reactions);
      scrollCarouselToAnalyst(META[line.id].name);

      // Cross-reactions: set reacting seats to appropriate expression
      if (line.reactions){
        line.reactions.forEach(r => {
          setSeatState(r.to, r.type);
          setTimeout(() => { if (!seatEls[r.to].classList.contains('speaking')) setSeatState(r.to, 'idle'); }, 2500);
        });
      }

      // Update tug-of-war meter based on sentiment and speaker
      if (line.sentiment > 0) addBullPull(line.sentiment);
      else if (line.sentiment < 0) addBearPull(Math.abs(line.sentiment));

      // Update consensus ring per-analyst stance
      analystSentiments[line.id] = line.sentiment || 0;
      updateConsensusRing(false);

      // Sparring oscillation: when rebuttals fly, the knot shakes
      const indicator = document.getElementById('rt-tug-indicator');
      if (line.rebuttal && indicator) {
        indicator.classList.add('settling');
        setTimeout(() => { if (!tugSettled) indicator.classList.remove('settling'); }, 2000);
      }
      await wait(line.verdict?3800:2800);

      // Phase: DONE
      if (!line.verdict){
        setSeatState(line.id, 'idle');
        seatEls[line.id].classList.add('done');
      }
      clearReactions();
    }
    if (!stopFlag){
      clearBubble();
      await freezeFrame();
      setStatus('Verdict rendered. Long may the council reign.');
      setCandleState('candles-victory');
      setTimeout(() => { if (stage) setCandleState('candles-calm'); }, 2000);
      updateProgress(SCRIPT.length);
    }
  } catch(e){}
  clearCarouselHighlight();
  playing=false;
  const pb2 = document.getElementById('rt-play'); if (pb2) pb2.textContent='Play';
}

function wireControls(){
  document.getElementById('rt-play').addEventListener('click', ()=>{
    if (playing) stopFlag=true;
    else {
      if (currentIdx >= SCRIPT.length-1) currentIdx=0;
      playFrom(currentIdx===0?0:currentIdx+1);
    }
  });
  document.getElementById('rt-replay').addEventListener('click', ()=>{
    stopFlag=true;
    setTimeout(()=>{ currentIdx=0; playFrom(0); }, 200);
  });
  document.getElementById('rt-speed').addEventListener('click', (e)=>{
    const speeds=[1,1.5,2,0.75];
    const idx = speeds.indexOf(speed);
    speed = speeds[(idx+1)%speeds.length];
    e.target.textContent = speed+'x';
  });
  document.getElementById('rt-toggle-reports').addEventListener('click', (e)=>{
    const c = document.getElementById('rt-report-carousel');
    const r = document.getElementById('root');
    if (e.target.textContent.startsWith('Hide')){
      if (c) c.style.display='none';
      if (r) r.style.display='none';
      e.target.textContent='Show Chronicles';
    } else {
      if (c) c.style.display='';
      if (r) r.style.display='';
      e.target.textContent='Hide Chronicles';
    }
  });
  document.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (e.key === ' ') {
      e.preventDefault(); document.getElementById('rt-play').click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (playing) { stopFlag = true; setTimeout(() => { currentIdx = Math.max(0, currentIdx - 1); playFrom(currentIdx); }, 200); }
      else { currentIdx = Math.max(0, currentIdx - 1); playFrom(currentIdx); }
    } else if (e.key === 'ArrowRight' && !playing) {
      e.preventDefault(); currentIdx = Math.min(SCRIPT.length - 1, currentIdx + 1); playFrom(currentIdx);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault(); document.getElementById('rt-replay').click();
    } else if (/^[1-4]$/.test(e.key)) {
      e.preventDefault(); speed = [1, 1.5, 2, 0.75][e.key - 1];
      const sb = document.getElementById('rt-speed'); if (sb) sb.textContent = speed + 'x';
    } else if (e.key === 'Escape') {
      const m = document.querySelector('.rt-modal-backdrop.visible');
      if (m) { m.classList.remove('visible'); setTimeout(() => m.remove(), 300); }
    }
  });
}

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

const SHORT_ROLE = {
  market: 'Market', social: 'Sentiment', news: 'News',
  fundamentals: 'Fundamentals', debater: 'Bull', risk: 'Bear',
  trader: 'Trader', judge: 'High Judge',
};

function buildCopyText(verdict){
  const tickerEl = document.getElementById('rt-verdict-ticker');
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

  // Helper: programmatically set a React-controlled input value
  function setReactInput(el, val){
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function tryFillAndSubmit(){
    const reactInput = document.querySelector('#root .form-input[placeholder="AAPL"]');
    const reactSubmit = document.querySelector('#root .btn-summon');
    if (reactInput && reactSubmit && reactInput.offsetParent !== null){
      setReactInput(reactInput, t);
      reactSubmit.click();
      return true;
    }
    return false;
  }

  // Primary: try to find + submit the visible React form
  if (tryFillAndSubmit()) return;

  // Secondary: navigate to input screen, then fill + submit
  const navButtons = document.querySelectorAll('#root .topbar-nav button');
  let marketBtn = null;
  navButtons.forEach(btn => {
    if (/Market Square/i.test(btn.textContent)) marketBtn = btn;
  });
  if (marketBtn){
    marketBtn.click();
    // Poll for the form to appear
    let attempts = 0;
    const poll = setInterval(() => {
      if (tryFillAndSubmit() || ++attempts > 20){
        clearInterval(poll);
      }
    }, 150);
  }
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

  // Insert after verdict card, before carousel
  const verdictCard = document.getElementById('rt-verdict-card');
  if (verdictCard){
    verdictCard.insertAdjacentElement('afterend', card);
  }

  // Wire events
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

  // Auto-focus after render
  setTimeout(function(){ input.focus(); }, 700);
}

function buildVerdictAndCarousel(){
  const sections = Array.from(document.querySelectorAll('#root .detail-section'));
  const reports = sections.map(sec=>{
    const t = sec.querySelector('h4,h3,h2');
    const b = sec.querySelector('.detail-content') || sec;
    return { title:(t&&t.textContent.trim())||'', html:b.innerHTML };
  }).filter(r=>r.title && r.html.length>50);

  // Find verdict value (HOLD/BUY/SELL)
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

  // Build the challenge-another-ticker input after the verdict card
  buildChallengeInput();

  // Insert carousel after the challenge card (not the verdict card, since challenge was already inserted after verdict)
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

// ===== DELIBERATION / CANDLE-LIGHTING CEREMONY =====

function startDeliberation(){
  if (deliberationActive) return;
  deliberationActive = true;

  // Status text
  const statusEl = document.getElementById('rt-status');
  if (statusEl) {
    statusEl.textContent = 'The council deliberates...';
    statusEl.classList.add('deliberating');
  }

  // Pulsing live dot
  const dot = document.getElementById('rt-live-dot');
  if (dot) {
    dot.style.background = '#c43f54';
    dot.style.boxShadow = '0 0 8px #c43f54';
    dot.classList.add('deliberating');
  }

  // Live indicator border
  const ind = document.getElementById('rt-live-indicator');
  if (ind) {
    ind.style.borderColor = 'var(--castle-crimson-bright)';
    ind.style.color = '#f5b8c2';
  }

  // Live text
  const txt = document.getElementById('rt-live-text');
  if (txt) txt.textContent = 'Deliberating';

  // Dim all seats
  Object.values(seatEls).forEach(el => {
    el.classList.remove('done', 'speaking', 'thinking');
    el.classList.add('dimmed-pending');
  });

  // Clear bubbles
  clearBubble();
  clearReactions();

  // Show overlay
  showDeliberationOverlay();

  // Candle ceremony
  const candles = stage.querySelectorAll('.rt-candle');
  candles.forEach(function(c){ c.classList.remove('lit'); c.classList.add('dimmed-candle'); });

  if (prefersReducedMotion()) {
    // Skip ceremony — light all candles immediately
    candles.forEach(function(c){ c.classList.remove('dimmed-candle'); c.classList.add('lit'); });
  } else {
    lightCandles(candles);
  }
}

function showDeliberationOverlay(){
  if (deliberationOverlay) return;
  deliberationOverlay = document.createElement('div');
  deliberationOverlay.className = 'rt-summoning-overlay';
  deliberationOverlay.innerHTML = 'Summoning the council...<span class="subtitle">The round table awakens</span>';
  stage.appendChild(deliberationOverlay);
}

function lightCandles(candles){
  candles.forEach(function(candle, i){
    setTimeout(function(){
      if (!deliberationActive) return;
      candle.classList.remove('dimmed-candle');
      candle.classList.add('igniting');
      setTimeout(function(){
        if (!deliberationActive) return;
        candle.classList.remove('igniting');
        candle.classList.add('lit');
      }, 400);
    }, i * 200);
  });
}

function endDeliberation(){
  if (!deliberationActive) return;
  deliberationActive = false;

  // Remove seat dimming
  Object.values(seatEls).forEach(function(el){ el.classList.remove('dimmed-pending'); });

  // Kill overlay with fade
  if (deliberationOverlay) {
    deliberationOverlay.classList.add('fade-out');
    var ov = deliberationOverlay;
    setTimeout(function(){ ov.remove(); }, 600);
    deliberationOverlay = null;
  }

  // Update status
  var statusEl = document.getElementById('rt-status');
  if (statusEl) {
    statusEl.classList.remove('deliberating');
    statusEl.textContent = 'Live \u2014 Council in session';
  }

  // Restore dot
  var dot = document.getElementById('rt-live-dot');
  if (dot) dot.classList.remove('deliberating');

  // Live indicator
  var ind = document.getElementById('rt-live-indicator');
  if (ind) {
    ind.style.borderColor = 'var(--castle-crimson-bright)';
    ind.style.color = '#f5b8c2';
  }

  // Live text
  var txt = document.getElementById('rt-live-text');
  if (txt) txt.textContent = 'Live \u2014 Council in session';

  // Candles return to normal
  var candles = stage.querySelectorAll('.rt-candle');
  candles.forEach(function(c){
    c.classList.remove('dimmed-candle', 'igniting');
    c.classList.add('lit');
  });
}

function installLiveWiring(){
  if (window.__sseHookInstalled) return;
  window.__sseHookInstalled = true;
  window.__sseListeners = [];
  // Save originals for teardown/restore
  if (!window.__originalEventSource) window.__originalEventSource = window.EventSource;
  if (!window.__originalFetch) window.__originalFetch = window.fetch;
  window.__activeSSE = [];
  const RealES = window.EventSource;
  window.EventSource = function HookedES(url, opts){
    const es = new RealES(url, opts);
    window.__activeSSE.push(es);
    const safe = (url||'').toString().replace(/token=[a-zA-Z0-9_\-]+/g,'TOK');
    console.log('[live] EventSource:', safe);
    // SSE error handling — show visible error state on disconnect
    es.addEventListener('error', function(ev){
      const dot = document.getElementById('rt-live-dot');
      const txt = document.getElementById('rt-live-text');
      const ind = document.getElementById('rt-live-indicator');
      if (dot) { dot.style.background = '#e57373'; dot.style.boxShadow = '0 0 8px #e57373'; dot.classList.remove('deliberating'); }
      if (txt) txt.textContent = 'Connection lost \u2014 retrying...';
      if (ind) { ind.style.borderColor = '#e57373'; ind.style.color = '#e57373'; }
      console.warn('[live] SSE connection error \u2014 will retry');
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
    // Unwrap SSE envelope: backend sends {type, data:{node, ...}, timestamp}
    const dataPayload = data.data || {};
    const eventType = data.type || type;

    // ── Global events: no node, update indicators ──
    if (eventType === 'heartbeat') return;

    if (eventType === 'status') {
      // Global job-status updates: initializing → building → preparing → running
      const statusText = dataPayload.message || dataPayload.status || '';
      const statusEl = document.getElementById('rt-status');
      const txt = document.getElementById('rt-live-text');
      if (/running/i.test(dataPayload.status||'')) {
        if (deliberationActive) endDeliberation();
        if (statusEl) { statusEl.classList.remove('deliberating'); statusEl.textContent = 'Live \u2014 Council in session'; }
        if (txt) txt.textContent = 'Live \u2014 Council in session';
      } else if (statusText) {
        if (statusEl) { statusEl.classList.add('deliberating'); statusEl.textContent = statusText; }
        if (txt) txt.textContent = statusText;
      }
      return;
    }

    if (eventType === 'complete') {
      if (deliberationActive) endDeliberation();
      const dot = document.getElementById('rt-live-dot');
      const txt = document.getElementById('rt-live-text');
      const ind = document.getElementById('rt-live-indicator');
      const statusEl = document.getElementById('rt-status');
      if (dot){ dot.style.background='var(--castle-gold)'; dot.style.boxShadow='0 0 8px var(--castle-gold)'; dot.classList.remove('deliberating'); }
      if (txt) txt.textContent = 'Verdict delivered';
      if (ind){ ind.style.borderColor='var(--castle-gold)'; ind.style.color='var(--castle-gold)'; }
      if (statusEl){ statusEl.classList.remove('deliberating'); statusEl.textContent = 'Verdict delivered'; }
      Object.values(seatEls).forEach(el=>{ el.classList.remove('speaking','thinking','dimmed-pending'); el.classList.add('done'); });
      // Extract verdict from result payload
      const result = dataPayload.result || {};
      const verdict = result.decision || result.final_trade_decision || result.recommendation || '';
      const vm = String(verdict).match(/\b(BUY|SELL|HOLD)\b/i);
      if (vm) {
        const v = vm[0].toUpperCase();
        settleVerdict(v);
        setCandleState('candles-victory');
        // Trigger cinematic verdict reveal
        if (stage) stage.classList.add('verdict-mode');
        triggerCinematicVerdict(v);
        // Update verdict banner for live SSE
        const vb = document.getElementById('rt-verdict-banner');
        if (vb) {
          vb.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1408" stroke-width="1.8"><path d="M12 2 L 19 6 L 19 11 Q 19 19 12 22 Q 5 19 5 11 L 5 6 Z"/><path d="M9 12 L 12 9 L 15 12 M 12 9 L 12 15"/></svg><span>'+v+'</span>';
          vb.classList.remove('show', 'buy', 'sell', 'hold');
          void vb.offsetWidth;
          vb.classList.add('show', v === 'BUY' ? 'buy' : v === 'SELL' ? 'sell' : 'hold');
        }
        setTimeout(function() { if (stage) setCandleState('candles-calm'); }, 2000);
      }
      return;
    }

    if (eventType === 'error') {
      const txt = document.getElementById('rt-live-text');
      const statusEl = document.getElementById('rt-status');
      const dot = document.getElementById('rt-live-dot');
      const msg = dataPayload.message || 'Unknown error';
      if (txt) txt.textContent = 'Error: ' + msg;
      if (statusEl) statusEl.textContent = 'Error: ' + msg;
      if (dot){ dot.style.background='#c43f54'; dot.style.boxShadow='0 0 8px #c43f54'; dot.classList.remove('deliberating'); }
      return;
    }

    // ── Per-agent events: require node for seat mapping ──
    const agent = dataPayload.node || data.agent || data.analyst || data.author || (data.payload && data.payload.agent);
    const status = eventType;
    const text = dataPayload.report || dataPayload.content || dataPayload.current_response
              || dataPayload.bull_reason || dataPayload.bear_reason
              || dataPayload.judge_decision || dataPayload.final_decision
              || dataPayload.investment_plan || dataPayload.message
              || data.text || data.content || (data.payload && data.payload.text);
    const seatId = AGENT_TO_SEAT[agent] || AGENT_TO_SEAT[(agent||'').toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,'')];
    if (!seatId) return;
    const seatEl = seatEls[seatId]; if (!seatEl) return;
    if (/think|start|begin|working|preparing|building|initializing/i.test(status)){
      if (deliberationActive) endDeliberation();
      Object.values(seatEls).forEach(el=>el.classList.remove('speaking'));
      seatEl.classList.remove('done'); seatEl.classList.add('thinking');
      setSeatState(seatId, 'thinking');
    } else if (/speak|message|delta|chunk|update|report|debate/i.test(status)){
      Object.values(seatEls).forEach(el=>el.classList.remove('speaking','thinking'));
      seatEl.classList.add('speaking');
      setSeatState(seatId, 'speaking');
      // Dynamic candle lighting for live debate phases
      if (/judge|aldric/i.test(agent||'')) setCandleState('candles-verdict');
      else if (/debater|bear|balthazar|risk|morwen/i.test(agent||'')) setCandleState('candles-heated');
      else setCandleState('candles-calm');
      if (text) showLiveBubble(seatId, text);
      // Drive tug-of-war: Balthazar/debater/fundamentals/news = bull, Morwen/risk/market = bear
      if (/debater|bull|balthazar/i.test(agent||'')) addBullPull(1);
      else if (/risk|bear|morwen/i.test(agent||'')) addBearPull(1);
      else if (/fundamentals|sage|bull_researcher/i.test(agent||'')) addBullPull(0.7);
      else if (/market|flint/i.test(agent||'')) addBearPull(0.5);
      // Text sentiment heuristics
      if (typeof text === 'string'){
        const bullWords = /\b(bull|long|buy|upside|rally|growth|higher|outperform)\b/i;
        const bearWords = /\b(bear|short|sell|downside|drop|lower|decline|underperform|pullback|correction)\b/i;
        if (bullWords.test(text)) addBullPull(0.5);
        if (bearWords.test(text)) addBearPull(0.5);
        // Update consensus ring per-analyst stance from live text
        if (bullWords.test(text) && !bearWords.test(text)){
          analystSentiments[seatId] = Math.min(3, (analystSentiments[seatId] || 0) + 0.5);
        } else if (bearWords.test(text) && !bullWords.test(text)){
          analystSentiments[seatId] = Math.max(-3, (analystSentiments[seatId] || 0) - 0.5);
        }
        updateConsensusRing(false);
      }
    } else if (/done|complete|finish|end|decision|final_decision/i.test(status)){
      seatEl.classList.remove('speaking','thinking');
      seatEl.classList.add('done');
      setSeatState(seatId, 'idle');
      // Stronger pull on completion
      if (/debater|bull|balthazar/i.test(agent||'')) addBullPull(1.5);
      else if (/risk|bear|morwen/i.test(agent||'')) addBearPull(1.5);
      // Check for verdict keywords
      if (/judge|aldric/i.test(agent||'') && typeof text === 'string'){
        const vm = text.match(/\b(BUY|SELL|HOLD)\b/i);
        if (vm) { settleVerdict(vm[0].toUpperCase()); setCandleState('candles-victory'); setTimeout(() => { if (stage) setCandleState('candles-calm'); }, 2000); }
      } else {
        setCandleState('candles-calm');
      }
    }
    });

  const _fetch = window.fetch;
  window.fetch = function(){
    const url = (arguments[0]||'').toString();
    if (/\/analyze/.test(url)){
      startDeliberation();
      resetTug();
      resetConsensusRing();
    }
    return _fetch.apply(this, arguments);
  };
}

// ===== TEARDOWN =====
// Call this before SPA navigation to clean up SSE hooks, timers, and bubbles.
window.__councilTeardown = function(){
  // Clear blink timers
  blinkTimers.forEach(clearTimeout);
  blinkTimers = [];

  // Clear SSE listeners
  window.__sseListeners = [];

  // Close active SSE connections
  if (window.__activeSSE) {
    window.__activeSSE.forEach(function(es){
      try { es.close(); } catch(e) {}
    });
    window.__activeSSE = [];
  }

  // Restore original EventSource and fetch
  if (window.__originalEventSource) {
    window.EventSource = window.__originalEventSource;
  }
  if (window.__originalFetch) {
    window.fetch = window.__originalFetch;
  }

  // Clear active live bubbles and typewriter intervals
  Object.values(liveBubbles).forEach(function(b){
    if (b._twInterval) { clearInterval(b._twInterval); }
    try { b.classList.remove('visible'); b.remove(); } catch(e) {}
  });
  Object.keys(liveBubbles).forEach(function(k){ delete liveBubbles[k]; });

  // Clear active bubble and reactions
  if (activeBubble) {
    if (activeBubble._twInterval) { clearInterval(activeBubble._twInterval); activeBubble._twInterval = null; }
    try { activeBubble.classList.remove('visible'); activeBubble.remove(); } catch(e) {}
    activeBubble = null;
  }
  activeReactions.forEach(function(r){ try { r.remove(); } catch(e) {} });
  activeReactions = [];

  // Clear deliberation overlay
  if (deliberationActive) endDeliberation();

  // Reset installation flag so LiveWiring can be re-installed after navigation
  window.__sseHookInstalled = false;

  console.log('[live] Council teardown complete');
};

function showLiveBubble(seatId, text){
  let disp = (typeof text === 'string' && text.length > 220) ? text.slice(0,217)+'...' : text;
  if (liveBubbles[seatId]){ 
    if (liveBubbles[seatId]._twInterval) { clearInterval(liveBubbles[seatId]._twInterval); }
    liveBubbles[seatId].remove(); delete liveBubbles[seatId]; 
  }
  const meta = META[seatId]; if (!meta) return;
  const bubbleType = BUBBLE_MAP[seatId] || 'standard';
  const b = document.createElement('div');
  b.className = 'rt-bubble' + (bubbleType !== 'standard' ? ' '+bubbleType : '');
  b.innerHTML = '<div class="rt-bubble-name"><span class="dot"></span>'+meta.name+' &mdash; '+meta.role+'</div><div class="rt-bubble-body">'+disp+'</div>';
  stage.appendChild(b);
  liveBubbles[seatId] = b;
  placeBubble(b, seatId);
  setTimeout(()=>{ 
    if (liveBubbles[seatId]===b){ 
      if (b._twInterval) { clearInterval(b._twInterval); }
      b.classList.remove('visible'); 
      setTimeout(()=>b.remove(),300); 
      delete liveBubbles[seatId]; 
    } 
  }, 8000);
}

function scrollCarouselToAnalyst(analystName){
  const track = document.getElementById('rt-report-track');
  if (!track) return;
  // Don't scroll if carousel is hidden
  const carousel = document.getElementById('rt-report-carousel');
  if (carousel && (carousel.style.display === 'none')) return;
  // Find the matching card
  const cards = track.querySelectorAll('.rt-report-card');
  let matched = null;
  cards.forEach(card => {
    if (matched) return;
    const h3 = card.querySelector('h3');
    if (h3 && h3.textContent.trim().toLowerCase() === (analystName||'').toLowerCase()) {
      matched = card;
    }
  });
  if (!matched) return;
  // Clear previous highlight
  clearCarouselHighlight();
  // Highlight this card
  matched.classList.add('highlighted');
  // Scroll into view
  matched.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function clearCarouselHighlight(){
  const track = document.getElementById('rt-report-track');
  if (!track) return;
  track.querySelectorAll('.rt-report-card.highlighted').forEach(c => c.classList.remove('highlighted'));
}

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
    setTimeout(function(){ initConsensusRingEntrance(); }, 1100);
  });
}

ready(mount);

})();
