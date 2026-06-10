/* ============================================================
   TRADERS OF THE ROUND TABLE — Synthesized Audio & SFX
   MUTED BY DEFAULT. No external assets — all oscillator-based.
   Respects autoplay policy + prefers-reduced-motion.
   ============================================================ */
(function(){
'use strict';

// === Respect reduced motion preference ===
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion) return; // No audio for reduced-motion users

// === State ===
var audioCtx = null;
var masterGain = null;
var isMuted = true; // MUTED BY DEFAULT
var ambienceSource = null;
var ambienceGain = null;
var toggleBtn = null;

// Load persisted mute state
try {
  var stored = localStorage.getItem('castle-audio-muted');
  if (stored !== null) isMuted = (stored === 'true');
} catch(e) {}

// ============================================================
// AUDIO ENGINE
// ============================================================

function ensureAudioContext() {
  if (audioCtx) return true;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) {
    console.warn('[castle-audio] Web Audio API not available:', e);
    return false;
  }
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0; // Start silent, fade in on unmute
  masterGain.connect(audioCtx.destination);
  return true;
}

// --- Hall Ambience (low-pass filtered noise, continuous, subtle) ---
function startAmbience() {
  if (!audioCtx || ambienceSource) return;

  // Generate 3 seconds of white noise
  var bufferSize = audioCtx.sampleRate * 3;
  var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.08;
  }

  ambienceSource = audioCtx.createBufferSource();
  ambienceSource.buffer = buffer;
  ambienceSource.loop = true;

  // Heavy low-pass for "distant hall murmur" feel
  var lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 350;
  lowpass.Q.value = 0.7;

  // Second filter for more warmth
  var lowpass2 = audioCtx.createBiquadFilter();
  lowpass2.type = 'lowpass';
  lowpass2.frequency.value = 600;
  lowpass2.Q.value = 0.5;

  ambienceGain = audioCtx.createGain();
  ambienceGain.gain.value = 0.025; // Very subtle — just enough to fill silence

  ambienceSource.connect(lowpass);
  lowpass.connect(lowpass2);
  lowpass2.connect(ambienceGain);
  ambienceGain.connect(masterGain);
  ambienceSource.start();
}

function stopAmbience() {
  if (ambienceSource) {
    try { ambienceSource.stop(); } catch(e) {}
    ambienceSource.disconnect();
    ambienceSource = null;
  }
  if (ambienceGain) {
    ambienceGain.disconnect();
    ambienceGain = null;
  }
}

// --- Soft Speaker-Change Cue ---
// A gentle two-note chime: high sine descending slightly
function playSpeakerCue() {
  if (!audioCtx || isMuted) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1047, now);             // C6
  osc.frequency.linearRampToValueAtTime(784, now + 0.08); // G5
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.2);
}

// --- Elder Aldric Gavel/Chime ---
// Deep resonant gong: fundamental + harmonics with staggered decay
function playGavel() {
  if (!audioCtx || isMuted) return;
  var now = audioCtx.currentTime;

  var frequencies = [196, 261.6, 329.6, 392, 523.3]; // G3 + harmonics
  var gains =        [0.18,  0.10,  0.06,  0.04, 0.025];
  var decays =       [1.8,   1.5,   1.2,   1.0,  0.8];

  frequencies.forEach(function(freq, i) {
    var osc = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    // Slight detune for richness
    if (i > 0) osc.detune.value = (Math.random() - 0.5) * 6;

    var t = now + i * 0.025;
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(gains[i], t + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + decays[i]);

    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.start(t);
    osc.stop(t + decays[i] + 0.1);
  });
}

// --- Verdict Sting ---
function playVerdictSting(verdict) {
  if (!audioCtx || isMuted) return;
  var now = audioCtx.currentTime;
  var v = (verdict || '').toUpperCase();

  if (v === 'BUY') {
    // Triumphant ascending C-major arpeggio: C4→E4→G4→C5, triangle wave
    var notes = [261.6, 329.6, 392.0, 523.3];
    notes.forEach(function(freq, i) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      var t = now + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.04);
      gain.gain.setValueAtTime(0.16, t + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.9);
    });
    // Bright shimmer overlay
    setTimeout(function() {
      if (!audioCtx || isMuted) return;
      var shimmer = audioCtx.createOscillator();
      var sg = audioCtx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = 1047; // C6
      sg.gain.setValueAtTime(0.06, audioCtx.currentTime);
      sg.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      shimmer.connect(sg);
      sg.connect(masterGain);
      shimmer.start();
      shimmer.stop(audioCtx.currentTime + 0.7);
    }, 400);

  } else if (v === 'SELL') {
    // Ominous descending: C4→Ab3→F3→C3, sawtooth for edge
    var notes2 = [261.6, 207.7, 174.6, 130.8];
    notes2.forEach(function(freq, i) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      var t = now + i * 0.14;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 1.0);
    });

  } else {
    // HOLD: Resolute sustained chord (C-E-G) with slow vibrato
    var notes3 = [261.6, 329.6, 392.0];
    notes3.forEach(function(freq, i) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      var lfo = audioCtx.createOscillator();
      var lfoGain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      lfo.type = 'sine';
      lfo.frequency.value = 4.5 + i * 0.5;
      lfoGain.gain.value = 1.5;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      var t = now + i * 0.04;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1 - i * 0.02, t + 0.12);
      gain.gain.linearRampToValueAtTime(0.06, t + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.3);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 2.4);
      lfo.stop(t + 2.4);
    });
  }
}

// ============================================================
// MUTE TOGGLE
// ============================================================

function updateToggleUI() {
  if (!toggleBtn) return;
  toggleBtn.classList.toggle('muted', isMuted);
  toggleBtn.setAttribute('aria-pressed', String(!isMuted));
  toggleBtn.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
  toggleBtn.title = isMuted ? 'Unmute audio (currently muted)' : 'Mute audio';

  // Swap SVG display
  var onPaths = toggleBtn.querySelectorAll('.audio-on');
  var offPaths = toggleBtn.querySelectorAll('.audio-off');
  for (var i = 0; i < onPaths.length; i++) onPaths[i].style.display = isMuted ? 'none' : '';
  for (var j = 0; j < offPaths.length; j++) offPaths[j].style.display = isMuted ? '' : 'none';
}

function toggleMute() {
  if (!ensureAudioContext()) return;

  // First unmute: init audio context (autoplay policy met via user click)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  isMuted = !isMuted;
  try { localStorage.setItem('castle-audio-muted', String(isMuted)); } catch(e) {}

  if (masterGain) {
    var now = audioCtx.currentTime;
    if (isMuted) {
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.25);
    } else {
      // Start ambience if this is the first unmute
      if (!ambienceSource) startAmbience();
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(1, now + 0.25);
    }
  }

  updateToggleUI();
}

function injectToggle() {
  var controls = document.querySelector('.rt-controls');
  if (!controls) return;
  if (document.getElementById('rt-audio-toggle')) return;

  toggleBtn = document.createElement('button');
  toggleBtn.id = 'rt-audio-toggle';
  toggleBtn.className = 'rt-btn rt-audio-btn' + (isMuted ? ' muted' : '');
  toggleBtn.setAttribute('aria-pressed', String(!isMuted));
  toggleBtn.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
  toggleBtn.title = isMuted ? 'Unmute audio (currently muted)' : 'Mute audio';
  toggleBtn.type = 'button';
  toggleBtn.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon class="audio-on" points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" style="display:' + (isMuted ? 'none' : '') + '"/>' +
      '<path class="audio-on" d="M15.54 8.46a5 5 0 0 1 0 7.07" style="display:' + (isMuted ? 'none' : '') + '"/>' +
      '<path class="audio-on" d="M19.07 4.93a10 10 0 0 1 0 14.14" style="display:' + (isMuted ? 'none' : '') + '"/>' +
      '<line class="audio-off" x1="23" y1="1" x2="1" y2="23" stroke="currentColor" stroke-width="2" style="display:' + (isMuted ? '' : 'none') + '"/>' +
    '</svg>';

  toggleBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMute();
  });

  // Insert at start of controls row (before Replay button)
  var firstBtn = controls.querySelector('.rt-btn');
  if (firstBtn) {
    controls.insertBefore(toggleBtn, firstBtn);
  } else {
    controls.appendChild(toggleBtn);
  }
}

// ============================================================
// EVENT HOOKS
// ============================================================

// --- Verdict Beat (from cinematic reveal) ---
window.addEventListener('council-verdict-beat', function(ev) {
  if (!ev.detail || !ev.detail.verdict) return;
  playVerdictSting(ev.detail.verdict);
});

// --- SSE Speaker Changes ---
function hookSSE() {
  if (!window.__sseListeners) {
    setTimeout(hookSSE, 150);
    return;
  }

  var lastSpeaker = null;
  var lastSpeakerTime = 0;

  window.__sseListeners.push(function(type, ev) {
    var data;
    try { data = ev.data ? JSON.parse(ev.data) : null; } catch(e) { data = ev.data; }
    if (!data) return;

    var dataPayload = data.data || {};
    var agent = dataPayload.node || data.agent || data.analyst || data.author
             || (data.payload && data.payload.agent);
    var status = type || data.type;

    // Only fire on speech/update events
    if (!/speak|message|delta|chunk|update|report|debate/i.test(status)) return;
    if (!agent) return;

    var now = Date.now();
    // Debounce: only fire if different speaker OR 3+ seconds since last cue
    if (agent === lastSpeaker && now - lastSpeakerTime < 3000) return;
    lastSpeaker = agent;
    lastSpeakerTime = now;

    // Soft chime on any speaker change
    playSpeakerCue();

    // Distinctive gavel for Elder Aldric
    if (/judge|aldric/i.test(agent)) {
      setTimeout(function() { playGavel(); }, 180);
    }
  });
}

// ============================================================
// INIT & TEARDOWN
// ============================================================

function init() {
  if (reducedMotion) return;

  // Wait for scene to be built, then inject toggle and hook SSE
  function tryInject() {
    if (document.querySelector('.rt-controls')) {
      injectToggle();
      hookSSE();
      // If unmuted from localStorage, initialize audio context eagerly
      // (but don't start playing — autoplay policy requires user gesture)
      if (!isMuted) {
        ensureAudioContext();
        if (audioCtx && audioCtx.state === 'suspended') {
          // Will be resumed on first user gesture
        }
        if (!ambienceSource) startAmbience();
      }
    } else {
      setTimeout(tryInject, 100);
    }
  }
  tryInject();
}

// --- Teardown (called before SPA navigation) ---
window.__castleAudioTeardown = function() {
  stopAmbience();
  if (audioCtx) {
    try { audioCtx.close(); } catch(e) {}
    audioCtx = null;
  }
  masterGain = null;
  toggleBtn = null;
  console.log('[castle-audio] Teardown complete');
};

// Extend existing council teardown to include audio cleanup
var _origTeardown = window.__councilTeardown;
window.__councilTeardown = function() {
  if (window.__castleAudioTeardown) window.__castleAudioTeardown();
  if (_origTeardown) _origTeardown.apply(this, arguments);
};

// --- Start ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // If script loads after DOM ready but before scene built, poll
  setTimeout(init, 50);
}

})();
