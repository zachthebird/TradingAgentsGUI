/* Traders of the Round Table — Shareable Verdict Card (Image Export)
   Renders a comic-book styled verdict recap to canvas → downloadable PNG.
   100% client-side, zero external services. */

(function(){
'use strict';

// ── Design tokens matching castle.css ──
const C = {
  night:       '#0e1320',
  night2:      '#161b2c',
  stoneDark:   '#2a3043',
  stone:       '#3d4459',
  stoneLight:  '#5b6379',
  gold:        '#d9b35a',
  goldBright:  '#f2c761',
  goldSoft:    '#b89243',
  crimson:     '#8e2a3a',
  crimsonBrt:  '#c43f54',
  parchment:   '#efe2c4',
  parchmentW:  '#e8d6a8',
  parchmentD:  '#c9b485',
  ink:         '#1c1408',
  text:        '#ece6d4',
  textDim:     '#a8a89e',
  bullish:     '#4CAF50',
  bearish:     '#E57373',
  neutral:     '#FFB74D',
};

const SEATS = [
  { id:'judge',        name:'Elder Aldric',   role:'High Judge',        color:'#9B8BAA' },
  { id:'market',       name:'Flint',          role:'Market Analyst',    color:'#8B6B4A' },
  { id:'social',       name:'Vera',           role:'Sentiment Seer',    color:'#C44B4B' },
  { id:'news',         name:'Reed',           role:'News Herald',       color:'#4B7A9E' },
  { id:'fundamentals', name:'Sage',           role:'Fundamentals',      color:'#5C8A6F' },
  { id:'debater',      name:'Balthazar',      role:'Adversary',         color:'#D4A030' },
  { id:'risk',         name:'Morwen',         role:'Risk Warden',       color:'#7B8B9A' },
  { id:'trader',       name:'Kael',           role:'Swift Trader',      color:'#C07840' },
];

// ── Helpers ──
function getTicker(){
  // 1. Primary: verdict ticker element
  const el = document.getElementById('rt-verdict-ticker');
  if (el && el.textContent && el.textContent !== '\u2014') return el.textContent.trim().toUpperCase();
  
  // 2. Demo ticker cache (set by council script when demo runs)
  if (window.__shareDemoTicker) return window.__shareDemoTicker.toUpperCase();
  
  // 3. Fallback: ticker badge anywhere on page
  const badge = document.querySelector('.ticker-badge');
  if (badge) return badge.textContent.trim().toUpperCase();
  
  // 4. Challenge input (user may have typed a ticker)
  const challengeInput = document.querySelector('.rt-challenge-input');
  if (challengeInput && challengeInput.value.trim()) return challengeInput.value.trim().toUpperCase();
  
  return '';
}

function getVerdict(){
  const el = document.getElementById('rt-verdict-banner');
  if (el) {
    // Check data attribute first (set by freezeFrame for reliability)
    const dv = el.getAttribute('data-verdict');
    if (dv) return dv.toUpperCase();
    // Then check text content
    if (el.textContent) {
      const m = el.textContent.match(/\b(BUY|SELL|HOLD)\b/i);
      if (m) return m[0].toUpperCase();
    }
  }
  // Fallback: check verdict card
  const vc = document.getElementById('rt-verdict-card');
  if (vc) {
    const vv = vc.querySelector('.rt-verdict-value');
    if (vv) return vv.textContent.trim().toUpperCase();
  }
  return 'HOLD';
}

function getVerdictColor(verdict) {
  switch (verdict) {
    case 'BUY':  return C.bullish;
    case 'SELL': return C.bearish;
    default:     return C.neutral;
  }
}

function getKeyQuotes() {
  // Collect testimony from all bubbles — visible, recently visible, or still in DOM
  const quotes = [];
  
  // 1. Try visible bubbles first (best quality — still on screen)
  const visibleBubbles = document.querySelectorAll('#rt-stage .rt-bubble.visible .rt-bubble-body');
  visibleBubbles.forEach(b => {
    const t = b.textContent.trim();
    if (t && t.length > 15 && !quotes.includes(t)) quotes.push(t);
  });
  
  // 2. If none visible, check cached quotes from window (set by council script)
  if (quotes.length === 0 && window.__shareQuoteCache && window.__shareQuoteCache.length) {
    window.__shareQuoteCache.forEach(t => {
      if (t && t.length > 15 && !quotes.includes(t)) quotes.push(t);
    });
  }
  
  // 3. Fallback: check ANY bubble bodies still in the DOM (may have been hidden but not removed)
  if (quotes.length === 0) {
    const allBubbles = document.querySelectorAll('#rt-stage .rt-bubble .rt-bubble-body');
    allBubbles.forEach(b => {
      const t = b.textContent.trim();
      if (t && t.length > 15 && !quotes.includes(t)) quotes.push(t);
    });
  }
  
  // Take up to 3 most recent
  return quotes.slice(-3);
}

function getCouncilSentiments() {
  // Read per-analyst sentiments from the consensus ring SVG dots
  // Each dot's cx position on the arc maps to sentiment -3..+3
  const sentiments = {};
  SEATS.forEach(s => { sentiments[s.id] = 0; });

  const svg = document.querySelector('.rt-ring-svg');
  if (!svg) return sentiments;

  SEATS.forEach(seat => {
    const dot = svg.querySelector('.rt-ring-dot[data-analyst="' + seat.id + '"]');
    if (!dot) return;
    const cx = parseFloat(dot.getAttribute('cx'));
    const cy = parseFloat(dot.getAttribute('cy'));
    if (isNaN(cx) || isNaN(cy)) return;

    // Arc center: (400, 130), radius 145, angle sweep 220° from 160° to 380°
    // Map position back to angle, then to sentiment
    const dx = cx - 400;
    const dy = cy - 130;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Normalize to 160°..380° range
    if (angle < 160) angle += 360;
    // Map angle to sentiment: 160° → -3, 380° → +3
    const sentiment = ((angle - 160) / 220) * 6 - 3;
    sentiments[seat.id] = Math.round(sentiment * 2) / 2; // Round to 0.5
  });

  // Also read tug-of-war for bull/bear scores if available
  const bullEl = document.getElementById('rt-bull-strength');
  const bearEl = document.getElementById('rt-bear-strength');
  if (bullEl && bearEl) {
    const bull = parseFloat(bullEl.textContent) || 0;
    const bear = parseFloat(bearEl.textContent) || 0;
    // These provide overall polarity, use to calibrate
    if (bull > bear + 2) {
      sentiments.debater = Math.max(sentiments.debater || 0, 2);
      sentiments.fundamentals = Math.max(sentiments.fundamentals || 0, 1);
    }
    if (bear > bull + 2) {
      sentiments.risk = Math.min(sentiments.risk || 0, -2);
      sentiments.market = Math.min(sentiments.market || 0, -1);
    }
  }

  return sentiments;
}

// ── SVG portrait → Image ──
// Uses Promise.race with a hard timeout so no single portrait can hang the render.
const PORTRAIT_TIMEOUT_MS = 2500;

function svgPortraitToImage(seatId) {
  const tryRender = () => new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // Try to find the symbol element
    const symbolEl = document.querySelector('#portrait-' + seatId);
    if (!symbolEl || symbolEl.tagName.toLowerCase() !== 'symbol') {
      // Fallback: try to grab from an existing rendered <use> instance
      const useEl = document.querySelector('.rt-portrait svg use[href="#portrait-' + seatId + '"]');
      if (useEl) {
        const parentSvg = useEl.closest('svg');
        if (parentSvg) {
          try {
            const clone = parentSvg.cloneNode(true);
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            const svgStr = new XMLSerializer().serializeToString(clone);
            const blob = new Blob([svgStr], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); done(img); };
            img.onerror = () => { URL.revokeObjectURL(url); done(null); };
            img.src = url;
            return;
          } catch (e) {
            console.warn('[share] portrait fallback failed for', seatId, e);
          }
        }
        done(null);
        return;
      }
      done(null);
      return;
    }

    // Clone the symbol's inner content
    try {
      const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      wrapper.setAttribute('viewBox', '0 0 100 100');
      wrapper.setAttribute('width', '100');
      wrapper.setAttribute('height', '100');
      Array.from(symbolEl.childNodes).forEach(child => {
        wrapper.appendChild(child.cloneNode(true));
      });
      const svgString = new XMLSerializer().serializeToString(wrapper);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); done(img); };
      img.onerror = () => { URL.revokeObjectURL(url); done(null); };
      img.src = url;
    } catch (e) {
      console.warn('[share] portrait render failed for', seatId, e);
      done(null);
    }
  });

  // Race: either the portrait renders, or we bail after PORTRAIT_TIMEOUT_MS
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), PORTRAIT_TIMEOUT_MS);
  });

  return Promise.race([tryRender(), timeout]);
}

// ── Canvas Drawing Helpers ──
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawParchmentBG(ctx, w, h) {
  // Base dark gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.3, '#16213e');
  grad.addColorStop(0.6, '#0f3460');
  grad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle noise texture
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 600; i++) {
    const rx = Math.random() * w;
    const ry = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(rx, ry, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Radial vignette
  const vign = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
  vign.addColorStop(0, 'transparent');
  vign.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, w, h);
}

function drawOrnamentalBorder(ctx, w, h) {
  // Outer gold border
  ctx.strokeStyle = C.goldSoft;
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // Inner thin border
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.globalAlpha = 1;

  // Corner ornaments
  const cornerSize = 24;
  const corners = [
    [18, 18, 1, 1], [w - 18, 18, -1, 1],
    [18, h - 18, 1, -1], [w - 18, h - 18, -1, -1]
  ];
  ctx.strokeStyle = C.goldBright;
  ctx.lineWidth = 2;
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * cornerSize);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * cornerSize, cy);
    ctx.stroke();
  });
}

function drawShieldIcon(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.goldBright;
  ctx.fillStyle = C.goldSoft;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.45);
  ctx.lineTo(size * 0.5, -size * 0.25);
  ctx.lineTo(size * 0.5, size * 0.15);
  ctx.quadraticCurveTo(size * 0.5, size * 0.5, 0, size * 0.5);
  ctx.quadraticCurveTo(-size * 0.5, size * 0.5, -size * 0.5, size * 0.15);
  ctx.lineTo(-size * 0.5, -size * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Inner checkmark or cross
  ctx.strokeStyle = C.night;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-size * 0.18, 0);
  ctx.lineTo(-size * 0.05, size * 0.15);
  ctx.lineTo(size * 0.2, -size * 0.12);
  ctx.stroke();
  ctx.restore();
}

function drawComicHalftoneDots(ctx, x, y, w, h, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha || 0.06;
  ctx.fillStyle = color || C.gold;
  const dotSize = 3;
  const gap = 8;
  for (let dy = y; dy < y + h; dy += gap) {
    for (let dx = x; dx < x + w; dx += gap) {
      const offset = (Math.floor(dy / gap) % 2) * (gap / 2);
      ctx.beginPath();
      ctx.arc(dx + offset, dy, dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawActionLines(ctx, x, y, count, direction) {
  ctx.save();
  ctx.strokeStyle = C.textDim;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.3;
  const angle = direction === 'right' ? 0.3 : -0.3;
  for (let i = 0; i < count; i++) {
    const ly = y - 10 + i * 12;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + (direction === 'right' ? 25 : -25), ly - (direction === 'right' ? 6 : -6));
    ctx.stroke();
  }
  ctx.restore();
}

// ── Main Render (with hard timeout guard) ──
async function renderVerdictCard(ticker, verdict, quotes, sentiments) {
  // Safety: never hang longer than 12 seconds (4× the portrait timeout)
  const RENDER_TIMEOUT_MS = 12000;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Render timed out after ' + (RENDER_TIMEOUT_MS / 1000) + 's')), RENDER_TIMEOUT_MS);
  });

  const doRender = async () => {
  const W = 900;
  const H = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Background ──
  drawParchmentBG(ctx, W, H);
  drawComicHalftoneDots(ctx, 0, 0, W, H, C.gold, 0.04);

  // ── Border ──
  drawOrnamentalBorder(ctx, W, H);

  // ── Header: Shield + Title ──
  drawShieldIcon(ctx, W / 2, 62, 22);

  ctx.fillStyle = C.goldBright;
  ctx.font = 'bold 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('TRADERS OF THE ROUND TABLE', W / 2, 100);

  ctx.fillStyle = C.textDim;
  ctx.font = 'italic 12px Georgia, serif';
  ctx.fillText('The Council Has Spoken', W / 2, 122);

  // ── Ticker Banner ──
  if (ticker) {
    const bannerY = 148;
    const bannerW = 200;
    const bannerH = 46;
    const bannerX = W / 2 - bannerW / 2;

    // Banner background with gradient
    const bGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH);
    bGrad.addColorStop(0, 'rgba(217,179,90,0.15)');
    bGrad.addColorStop(1, 'rgba(217,179,90,0.05)');
    roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 10);
    ctx.fillStyle = bGrad;
    ctx.fill();
    ctx.strokeStyle = C.goldSoft;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = C.textDim;
    ctx.font = '10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('TICKER', W / 2, bannerY + 16);
    ctx.fillStyle = C.goldBright;
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText(ticker, W / 2, bannerY + 38);
  }

  // ── Council Member Row ──
  const portraitSize = 56;
  const portraitGap = 16;
  const totalPortraits = SEATS.length;
  const portraitRowWidth = totalPortraits * portraitSize + (totalPortraits - 1) * portraitGap;
  const portraitStartX = W / 2 - portraitRowWidth / 2;
  const portraitY = ticker ? 216 : 160;

  // Collect portrait images in parallel
  const portraitImages = {};
  const portraitPromises = SEATS.map(async (seat) => {
    const img = await svgPortraitToImage(seat.id);
    portraitImages[seat.id] = img;
  });
  await Promise.all(portraitPromises);

  // Draw each council member
  SEATS.forEach((seat, i) => {
    const cx = portraitStartX + i * (portraitSize + portraitGap) + portraitSize / 2;
    const cy = portraitY + portraitSize / 2;

    // Colored ring
    ctx.beginPath();
    ctx.arc(cx, cy, portraitSize / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = seat.color;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = seat.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Portrait image or fallback initial
    const img = portraitImages[seat.id];
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, portraitSize / 2, 0, Math.PI * 2);
    ctx.clip();

    if (img) {
      ctx.drawImage(img, cx - portraitSize / 2, cy - portraitSize / 2, portraitSize, portraitSize);
    } else {
      // Fallback initial
      ctx.fillStyle = C.stoneDark;
      ctx.fillRect(cx - portraitSize / 2, cy - portraitSize / 2, portraitSize, portraitSize);
      ctx.fillStyle = seat.color;
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seat.name[0], cx, cy);
    }
    ctx.restore();

    // Name label
    ctx.fillStyle = C.text;
    ctx.font = '9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(seat.name, cx, cy + portraitSize / 2 + 16);

    // Role label
    ctx.fillStyle = C.textDim;
    ctx.font = '7px Georgia, serif';
    ctx.fillText(seat.role, cx, cy + portraitSize / 2 + 28);
  });

  // ── Divider ──
  const dividerY = portraitY + portraitSize + 52;
  ctx.strokeStyle = C.gold;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, dividerY);
  ctx.lineTo(W - 60, dividerY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Candle icon at center of divider
  ctx.fillStyle = C.goldBright;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(W / 2, dividerY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Key Quotes ──
  const quoteStartY = dividerY + 28;
  let quoteY = quoteStartY;

  ctx.fillStyle = C.goldSoft;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE DEBATE', W / 2, quoteY);

  quoteY += 28;

  if (quotes.length > 0) {
    quotes.forEach((quote, qi) => {
      // Truncate long quotes
      let displayQuote = quote;
      if (displayQuote.length > 140) {
        displayQuote = displayQuote.substring(0, 137) + '...';
      }

      // Quote bubble
      const quoteFont = 'italic 13px Georgia, serif';
      ctx.font = quoteFont;
      const metrics = ctx.measureText(displayQuote);
      const textWidth = Math.min(metrics.width, W - 160);
      const lines = wrapText(ctx, displayQuote, textWidth, quoteFont);

      const bubblePadX = 24;
      const bubblePadY = 16;
      const lineHeight = 20;
      const bubbleW = textWidth + bubblePadX * 2;
      const bubbleH = lines.length * lineHeight + bubblePadY * 2;

      const bubbleX = W / 2 - bubbleW / 2;

      // Bubble bg
      const bGrad = ctx.createLinearGradient(bubbleX, quoteY, bubbleX, quoteY + bubbleH);
      bGrad.addColorStop(0, C.night2);
      bGrad.addColorStop(1, C.night);
      roundRect(ctx, bubbleX, quoteY, bubbleW, bubbleH, 10);
      ctx.fillStyle = bGrad;
      ctx.fill();
      ctx.strokeStyle = C.stoneLight;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner highlight
      ctx.strokeStyle = C.goldSoft;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      roundRect(ctx, bubbleX + 3, quoteY + 3, bubbleW - 6, bubbleH - 6, 8);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Quote marker
      ctx.fillStyle = C.gold;
      ctx.font = 'bold 22px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u201C', bubbleX + 12, quoteY + bubblePadY + lineHeight);

      // Quote text
      ctx.fillStyle = C.text;
      ctx.font = quoteFont;
      ctx.textAlign = 'left';
      lines.forEach((line, li) => {
        ctx.fillText(line, bubbleX + bubblePadX, quoteY + bubblePadY + (li + 1) * lineHeight);
      });

      // Quote attribution line
      if (qi < quotes.length) {
        const attrY = quoteY + bubbleH + 6;
        ctx.fillStyle = C.textDim;
        ctx.font = '10px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u2014 Council Testimony', W / 2, attrY);
        quoteY = attrY + 20;
      } else {
        quoteY = quoteY + bubbleH + 16;
      }
    });
  } else {
    ctx.fillStyle = C.textDim;
    ctx.font = 'italic 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('The council debated with vigor and wisdom.', W / 2, quoteY);
    quoteY += 28;
  }

  // ── Verdict Section ──
  const verdictSectionY = quoteY + 24;

  // Decorative burst lines around verdict
  drawComicHalftoneDots(ctx, W / 2 - 120, verdictSectionY - 10, 240, 100, C.gold, 0.05);

  // Verdict label
  ctx.fillStyle = C.goldSoft;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('BY DECREE OF THE ROUND TABLE', W / 2, verdictSectionY);

  // Verdict value with dramatic styling
  const verdictColor = getVerdictColor(verdict);
  const verdictSizeY = verdictSectionY + 50;

  // Glow behind verdict
  const vGlow = ctx.createRadialGradient(W / 2, verdictSizeY - 10, 5, W / 2, verdictSizeY - 10, 80);
  vGlow.addColorStop(0, verdictColor + '40');
  vGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = vGlow;
  roundRect(ctx, W / 2 - 100, verdictSizeY - 55, 200, 80, 12);
  ctx.fill();

  // Verdict badge
  const badgeW = 160;
  const badgeH = 62;
  const badgeX = W / 2 - badgeW / 2;
  roundRect(ctx, badgeX, verdictSizeY - 35, badgeW, badgeH, 12);

  const badgeGrad = ctx.createLinearGradient(badgeX, verdictSizeY - 35, badgeX, verdictSizeY + badgeH - 35);
  badgeGrad.addColorStop(0, verdictColor);
  badgeGrad.addColorStop(1, verdict === 'BUY' ? '#357a38' : verdict === 'SELL' ? '#c62828' : '#e65100');
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  // Inner highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  roundRect(ctx, badgeX + 3, verdictSizeY - 32, badgeW - 6, badgeH - 6, 10);
  ctx.stroke();

  // Verdict text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(verdict, W / 2, verdictSizeY - 4);
  ctx.textBaseline = 'alphabetic';

  // Action lines next to verdict
  drawActionLines(ctx, badgeX - 20, verdictSizeY - 12, 3, 'right');
  drawActionLines(ctx, badgeX + badgeW + 20, verdictSizeY - 12, 3, 'left');

  // Confidence / meta line
  const metaY = verdictSizeY + 45;
  ctx.fillStyle = C.textDim;
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';

  // Count bull vs bear sentiments
  let bullCount = 0, bearCount = 0;
  Object.values(sentiments).forEach(s => {
    if (s > 0) bullCount++;
    else if (s < 0) bearCount++;
  });
  const total = bullCount + bearCount || 1;
  const confidence = Math.round((Math.max(bullCount, bearCount) / SEATS.filter(s => s.id !== 'judge').length) * 100);

  ctx.fillText('Council Confidence: ' + confidence + '%  \u2022  ' + bullCount + ' Bull  \u2022  ' + bearCount + ' Bear', W / 2, metaY);

  // ── Footer ──
  const footerY = H - 70;
  ctx.strokeStyle = C.gold;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, footerY - 20);
  ctx.lineTo(W - 60, footerY - 20);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.textDim;
  ctx.font = '10px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('\u2696\uFE0F  Not financial advice. The council only advises.  \u2696\uFE0F', W / 2, footerY);

  ctx.fillStyle = C.goldSoft;
  ctx.font = 'bold 11px Georgia, serif';
  ctx.fillText('Traders of the Round Table', W / 2, footerY + 22);

  ctx.fillStyle = C.stoneLight;
  ctx.font = '9px Georgia, serif';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillText('Generated ' + dateStr + '  \u2022  traders-round-table.com', W / 2, footerY + 40);

  // Bottom corner flourish
  drawShieldIcon(ctx, W / 2, footerY + 70, 12);

  return canvas;
  }; // end doRender

  try {
    return await Promise.race([doRender(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function wrapText(ctx, text, maxWidth, font) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  ctx.font = font;
  words.forEach(word => {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [text];
}

// ── Download ──
function downloadCanvas(canvas, ticker) {
  const filename = 'round-table-verdict' + (ticker ? '-' + ticker.toLowerCase() : '') + '.png';
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ── Share button injector ──
function injectShareButton() {
  // Check if already injected
  if (document.getElementById('rt-share-verdict')) return;

  // Find the verdict card
  const verdictCard = document.getElementById('rt-verdict-card');
  if (!verdictCard) return;

  // Create share button (sibling to copy button)
  const shareBtn = document.createElement('button');
  shareBtn.id = 'rt-share-verdict';
  shareBtn.className = 'rt-copy-verdict';
  shareBtn.style.marginLeft = '12px';
  shareBtn.innerHTML = '' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<polyline points="21 15 16 10 5 21"/>' +
    '</svg>' +
    'Share / Download';

  shareBtn.addEventListener('click', async () => {
    const originalHTML = shareBtn.innerHTML;
    shareBtn.textContent = 'Rendering...';
    shareBtn.disabled = true;

    // Global safety timeout: if the entire render+download takes >20s, reset.
    const GLOBAL_TIMEOUT_MS = 20000;
    let globalTimeoutId;
    const globalTimeout = new Promise((_, reject) => {
      globalTimeoutId = setTimeout(() => reject(new Error('Global share timeout after ' + (GLOBAL_TIMEOUT_MS / 1000) + 's')), GLOBAL_TIMEOUT_MS);
    });

    const doExport = async () => {
      const ticker = getTicker();
      const verdict = getVerdict();
      const quotes = getKeyQuotes();
      const sentiments = getCouncilSentiments();

      const canvas = await renderVerdictCard(ticker, verdict, quotes, sentiments);
      downloadCanvas(canvas, ticker);

      // Flash success
      shareBtn.classList.add('copied');
      shareBtn.innerHTML = '' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="20 6 9 17 4 12"/>' +
        '</svg>' +
        'Downloaded!';
      setTimeout(() => {
        shareBtn.classList.remove('copied');
        shareBtn.innerHTML = originalHTML;
        shareBtn.disabled = false;
      }, 2000);
    };

    try {
      await Promise.race([doExport(), globalTimeout]);
    } catch (err) {
      console.error('[share] Render failed:', err);
      shareBtn.textContent = 'Error — try again';
      shareBtn.disabled = false;
    } finally {
      clearTimeout(globalTimeoutId);
    }
  });

  // Insert after the existing copy button (or at end of card)
  const copyBtn = verdictCard.querySelector('.rt-copy-verdict');
  if (copyBtn) {
    copyBtn.insertAdjacentElement('afterend', shareBtn);
  } else {
    verdictCard.appendChild(shareBtn);
  }
}

// ── Watch for verdict card appearance (it's built dynamically) ──
function watchForVerdictCard() {
  // Try immediately
  if (document.getElementById('rt-verdict-card')) {
    injectShareButton();
  }

  // Also watch via MutationObserver
  const observer = new MutationObserver(() => {
    if (document.getElementById('rt-verdict-card') && !document.getElementById('rt-share-verdict')) {
      injectShareButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also hook into the freezeFrame/verdict render flow
  // After a brief delay post-verdict, try injecting
  const origInject = injectShareButton;
  setTimeout(() => {
    if (!document.getElementById('rt-share-verdict')) {
      injectShareButton();
    }
  }, 3000);
}

// ── Also listen for live SSE verdict delivery ──
function installLiveShareHook() {
  // Listen for the council-verdict-beat custom event
  window.addEventListener('council-verdict-beat', () => {
    // Wait a beat for the verdict card to be built
    setTimeout(() => {
      if (!document.getElementById('rt-share-verdict')) {
        injectShareButton();
      }
    }, 1500);
  });

  // Listen for verdict-banner appearance
  const bannerObserver = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target;
        if (el.classList.contains('show') && !document.getElementById('rt-share-verdict')) {
          setTimeout(() => injectShareButton(), 800);
        }
      }
    });
  });

  // Observe verdict banner when it appears
  const bannerPoll = setInterval(() => {
    const banner = document.getElementById('rt-verdict-banner');
    if (banner) {
      bannerObserver.observe(banner, { attributes: true });
      clearInterval(bannerPoll);
    }
  }, 500);

  // Cleanup poll after 30s max
  setTimeout(() => clearInterval(bannerPoll), 30000);
}

// ── Mount ──
function ready(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

ready(() => {
  watchForVerdictCard();
  installLiveShareHook();
});

})();
