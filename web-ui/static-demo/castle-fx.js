/* ============================================================
   CASTLE FX — castle-fx.js (ES module)
   "The handheld in the war room."

   A cinematic three.js layer behind the Round Table demo:
   - candlelit depth: rising embers, drifting dust, god rays
   - mood lighting that tracks the bull/bear momentum bar
   - particle bursts + shockwave on the council's verdict
   - CRT scanlines/phosphor glow on the device, title sequence,
     staggered chronicle-card reveals

   Strictly additive: castle-council.js, castle.css and the demo
   driver are untouched. Integration is via the same public seams
   the audio pack uses (window.__sseListeners) plus DOM observers.
   Degrades silently: no WebGL -> no canvas; reduced motion -> off.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';

(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NARROW = window.matchMedia('(max-width: 700px)').matches;

  /* ────────────────────────────────────────────────────────────
     Palette (mirrors castle.css tokens)
     ──────────────────────────────────────────────────────────── */
  var C = {
    night: 0x0e1320,
    emberWarm: 0xf2c761,
    emberDeep: 0xd9b35a,
    bull: 0x9bc46a,
    bear: 0xc4506a,
    neutral: 0xd9b35a,
    dust: 0x8a93a8,
    ray: 0xd9b35a,
    flashBuy: 0xf2c761,
    flashSell: 0xc43f54,
    flashHold: 0xffb74d
  };

  /* ────────────────────────────────────────────────────────────
     DOM chrome (works even without WebGL)
     ──────────────────────────────────────────────────────────── */
  function injectVignette() {
    if (document.getElementById('fx-vignette')) return;
    var v = document.createElement('div');
    v.id = 'fx-vignette';
    document.body.appendChild(v);
  }

  function injectCRT() {
    var device = document.querySelector('.adv-device');
    if (!device || device.querySelector('.fx-crt')) return false;
    var glow = document.createElement('div');
    glow.className = 'fx-glow';
    var crt = document.createElement('div');
    crt.className = 'fx-crt';
    device.appendChild(glow);
    device.appendChild(crt);
    return true;
  }

  function settleDevice() {
    var root = document.getElementById('debate-scene-root');
    if (root && !REDUCED) root.classList.add('fx-settle');
  }

  /* Title sequence — once per session, skippable, never on reduced motion */
  function runTitle(done) {
    if (REDUCED || sessionStorage.getItem('fx-title-shown')) { done(); return; }
    sessionStorage.setItem('fx-title-shown', '1');

    var t = document.createElement('div');
    t.id = 'fx-title';
    t.setAttribute('role', 'button');
    t.setAttribute('aria-label', 'Enter the Round Table');
    t.innerHTML =
      '<div class="fx-title-rule"></div>' +
      '<div class="fx-title-name">TRADERS OF THE<br>ROUND TABLE</div>' +
      '<div class="fx-title-sub">An AI council renders judgment</div>' +
      '<div class="fx-title-rule"></div>' +
      '<div class="fx-title-hint">PRESS ANY KEY</div>';
    document.body.appendChild(t);

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      t.classList.add('fx-title-leaving');
      window.removeEventListener('keydown', dismiss, true);
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
        done();
      }, 580);
    }
    t.addEventListener('click', dismiss);
    window.addEventListener('keydown', dismiss, true);
    setTimeout(dismiss, 2600);
  }

  /* Chronicle cards: stagger in the first time the carousel is seen */
  function wireCardReveals() {
    var track = document.getElementById('rt-report-track');
    if (!track || !('IntersectionObserver' in window)) return;
    var cards = Array.prototype.slice.call(track.querySelectorAll('.rt-report-card'));
    if (!cards.length) return;
    cards.forEach(function (c) { c.classList.add('fx-card-hidden'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var idx = cards.indexOf(entry.target);
        setTimeout(function () {
          entry.target.classList.remove('fx-card-hidden');
          entry.target.classList.add('fx-card-shown');
        }, Math.max(0, idx) * 90);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    cards.forEach(function (c) { io.observe(c); });
  }

  /* ────────────────────────────────────────────────────────────
     WebGL scene
     ──────────────────────────────────────────────────────────── */
  var fx = null; // populated by initWebGL

  function softSprite(size, inner, outer) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function rayTexture() {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 512;
    var g = cv.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(255,244,214,0.85)');
    grad.addColorStop(0.55, 'rgba(255,244,214,0.22)');
    grad.addColorStop(1, 'rgba(255,244,214,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 512);
    var hgrad = g.createLinearGradient(0, 0, 128, 0);
    hgrad.addColorStop(0, 'rgba(0,0,0,1)');
    hgrad.addColorStop(0.5, 'rgba(0,0,0,0)');
    hgrad.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = hgrad;
    g.fillRect(0, 0, 128, 512);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makePoints(count, opts) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      size: opts.size,
      map: opts.map,
      color: opts.color,
      transparent: true,
      opacity: opts.opacity,
      depthWrite: false,
      blending: opts.blending || THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return { points: pts, positions: pos, geo: geo, mat: mat };
  }

  function initWebGL() {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn('[fx] WebGL unavailable — ambient layer disabled');
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(C.night, 1);
    renderer.domElement.id = 'fx-canvas';
    document.body.insertBefore(renderer.domElement, document.body.firstChild);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(C.night, 70, 160);
    var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 2, 62);

    var spriteSoft = softSprite(64, 'rgba(255,236,190,1)', 'rgba(255,236,190,0)');
    var spriteDust = softSprite(32, 'rgba(190,200,225,0.9)', 'rgba(190,200,225,0)');

    /* hearth glow low behind the device */
    var glowMat = new THREE.SpriteMaterial({ map: spriteSoft, color: C.emberDeep, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending });
    var hearth = new THREE.Sprite(glowMat);
    hearth.scale.set(150, 95, 1);
    hearth.position.set(0, -16, -34);
    scene.add(hearth);

    /* god rays */
    var rayTex = rayTexture();
    var rays = [];
    [[-30, 0.22], [16, 0.16], [44, 0.10]].forEach(function (cfg) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 95),
        new THREE.MeshBasicMaterial({ map: rayTex, color: C.ray, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      m.position.set(cfg[0], 18, -36);
      m.rotation.z = THREE.MathUtils.degToRad(cfg[0] < 0 ? -14 : -8);
      m.userData.base = cfg[1];
      m.userData.phase = Math.random() * Math.PI * 2;
      scene.add(m);
      rays.push(m);
    });

    /* embers */
    var EMBERS = NARROW ? 70 : 140;
    var embers = makePoints(EMBERS, { size: 1.5, map: spriteSoft, color: C.emberWarm, opacity: 0.85 });
    var emberVel = new Float32Array(EMBERS * 3);
    for (var i = 0; i < EMBERS; i++) seedEmber(embers.positions, emberVel, i, true);
    scene.add(embers.points);

    /* dust */
    var DUST = NARROW ? 90 : 220;
    var dust = makePoints(DUST, { size: 0.55, map: spriteDust, color: C.dust, opacity: 0.4, blending: THREE.NormalBlending });
    var dustVel = new Float32Array(DUST * 3);
    for (var d = 0; d < DUST; d++) {
      dust.positions[d * 3] = THREE.MathUtils.randFloatSpread(150);
      dust.positions[d * 3 + 1] = THREE.MathUtils.randFloatSpread(90);
      dust.positions[d * 3 + 2] = THREE.MathUtils.randFloat(-50, 25);
      dustVel[d * 3] = THREE.MathUtils.randFloatSpread(0.45);
      dustVel[d * 3 + 1] = THREE.MathUtils.randFloatSpread(0.3);
      dustVel[d * 3 + 2] = 0;
    }
    scene.add(dust.points);

    /* verdict burst + shockwave + flash (pooled, idle until fired) */
    var SHARDS = 320;
    var burst = makePoints(SHARDS, { size: 1.7, map: spriteSoft, color: C.flashBuy, opacity: 0 });
    var burstVel = new Float32Array(SHARDS * 3);
    var burstLife = -1;
    scene.add(burst.points);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 80),
      new THREE.MeshBasicMaterial({ color: C.flashBuy, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    ring.position.set(0, 6, -8);
    var ringLife = -1;
    scene.add(ring);

    var flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteSoft, color: C.flashBuy, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.scale.set(90, 60, 1);
    flash.position.set(0, 6, -10);
    var flashLife = -1;
    scene.add(flash);

    /* speech puffs */
    var PUFF = 36;
    var puff = makePoints(PUFF, { size: 1.0, map: spriteSoft, color: C.emberDeep, opacity: 0 });
    var puffVel = new Float32Array(PUFF * 3);
    var puffLife = -1;
    scene.add(puff.points);

    /* mood */
    var mood = { value: 0.5, target: 0.5 }; // 0 bear … 1 bull
    var colBear = new THREE.Color(C.bear);
    var colBull = new THREE.Color(C.bull);
    var colNeutral = new THREE.Color(C.neutral);
    var tmp = new THREE.Color();

    function moodColor(out) {
      // piecewise lerp through neutral gold at 0.5
      if (mood.value < 0.5) out.copy(colBear).lerp(colNeutral, mood.value * 2);
      else out.copy(colNeutral).lerp(colBull, (mood.value - 0.5) * 2);
      return out;
    }

    /* pointer parallax */
    var px = 0, py = 0;
    if (!NARROW) {
      window.addEventListener('pointermove', function (e) {
        px = (e.clientX / window.innerWidth - 0.5) * 2;
        py = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function seedEmber(pos, vel, idx, anywhere) {
      pos[idx * 3] = THREE.MathUtils.randFloatSpread(130);
      pos[idx * 3 + 1] = anywhere ? THREE.MathUtils.randFloatSpread(80) : -44 - Math.random() * 6;
      pos[idx * 3 + 2] = THREE.MathUtils.randFloat(-45, 18);
      vel[idx * 3] = THREE.MathUtils.randFloatSpread(0.5);
      vel[idx * 3 + 1] = THREE.MathUtils.randFloat(1.4, 3.6);
      vel[idx * 3 + 2] = 0;
    }
    var clock = new THREE.Clock();
    var running = true;
    var elapsed = 0;

    /* One simulation+render tick. Driven by rAF in normal use; also
       exposed as castleFX.step(dt) so tests and headless tooling can
       advance the scene deterministically (rAF stalls in hidden tabs). */
    function step(dt) {
      dt = Math.min(dt, 0.05);
      elapsed += dt;
      var t = elapsed;

      /* mood easing + tinting */
      mood.value += (mood.target - mood.value) * Math.min(1, dt * 1.6);
      moodColor(tmp);
      embers.mat.color.copy(tmp).lerp(new THREE.Color(C.emberWarm), 0.45);
      hearth.material.color.copy(tmp);
      rays.forEach(function (r) { r.material.color.copy(tmp); });

      /* embers */
      for (var i = 0; i < EMBERS; i++) {
        embers.positions[i * 3] += (emberVel[i * 3] + Math.sin(t * 0.7 + i) * 0.35) * dt;
        embers.positions[i * 3 + 1] += emberVel[i * 3 + 1] * dt;
        if (embers.positions[i * 3 + 1] > 48) seedEmber(embers.positions, emberVel, i, false);
      }
      embers.geo.attributes.position.needsUpdate = true;

      /* dust */
      for (var d = 0; d < DUST; d++) {
        dust.positions[d * 3] += dustVel[d * 3] * dt;
        dust.positions[d * 3 + 1] += dustVel[d * 3 + 1] * dt;
        if (dust.positions[d * 3] > 78) dust.positions[d * 3] = -78;
        if (dust.positions[d * 3] < -78) dust.positions[d * 3] = 78;
        if (dust.positions[d * 3 + 1] > 48) dust.positions[d * 3 + 1] = -48;
        if (dust.positions[d * 3 + 1] < -48) dust.positions[d * 3 + 1] = 48;
      }
      dust.geo.attributes.position.needsUpdate = true;

      /* rays breathing */
      rays.forEach(function (r) {
        r.material.opacity = r.userData.base * (0.72 + 0.28 * Math.sin(t * 0.35 + r.userData.phase));
      });

      /* burst lifecycle */
      if (burstLife >= 0) {
        burstLife += dt;
        var k = burstLife / 1.7;
        if (k >= 1) { burstLife = -1; burst.mat.opacity = 0; }
        else {
          for (var b = 0; b < SHARDS; b++) {
            burst.positions[b * 3] += burstVel[b * 3] * dt;
            burst.positions[b * 3 + 1] += burstVel[b * 3 + 1] * dt;
            burst.positions[b * 3 + 2] += burstVel[b * 3 + 2] * dt;
            burstVel[b * 3 + 1] -= 22 * dt; // gravity
          }
          burst.geo.attributes.position.needsUpdate = true;
          burst.mat.opacity = 1 - k * k;
        }
      }
      if (ringLife >= 0) {
        ringLife += dt;
        var rk = ringLife / 0.9;
        if (rk >= 1) { ringLife = -1; ring.material.opacity = 0; }
        else {
          var s = 1 + rk * 46;
          ring.scale.set(s, s, 1);
          ring.material.opacity = 0.55 * (1 - rk);
        }
      }
      if (flashLife >= 0) {
        flashLife += dt;
        var fk = flashLife / 0.28;
        if (fk >= 1) { flashLife = -1; flash.material.opacity = 0; }
        else flash.material.opacity = 0.5 * (1 - fk);
      }
      if (puffLife >= 0) {
        puffLife += dt;
        var pk = puffLife / 0.9;
        if (pk >= 1) { puffLife = -1; puff.mat.opacity = 0; }
        else {
          for (var p = 0; p < PUFF; p++) {
            puff.positions[p * 3] += puffVel[p * 3] * dt;
            puff.positions[p * 3 + 1] += puffVel[p * 3 + 1] * dt;
          }
          puff.geo.attributes.position.needsUpdate = true;
          puff.mat.opacity = 0.7 * (1 - pk);
        }
      }

      /* parallax */
      camera.position.x += ((px * 5.5) - camera.position.x) * Math.min(1, dt * 2.2);
      camera.position.y += ((-py * 3.2 + 2) - camera.position.y) * Math.min(1, dt * 2.2);
      camera.lookAt(0, 3, 0);

      renderer.render(scene, camera);
    }

    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      step(clock.getDelta());
    }
    frame();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; }
      else if (!running) { running = true; clock.getDelta(); frame(); }
    });

    return {
      step: step,
      setMood: function (v) { mood.target = THREE.MathUtils.clamp(v, 0, 1); },
      puff: function () {
        if (puffLife >= 0 && puffLife < 0.45) return; // rate limit
        var side = Math.random() < 0.5 ? -1 : 1;
        for (var p = 0; p < PUFF; p++) {
          puff.positions[p * 3] = side * THREE.MathUtils.randFloat(24, 30);
          puff.positions[p * 3 + 1] = THREE.MathUtils.randFloat(2, 10);
          puff.positions[p * 3 + 2] = THREE.MathUtils.randFloat(-12, 0);
          puffVel[p * 3] = side * THREE.MathUtils.randFloat(-2.5, 5.5);
          puffVel[p * 3 + 1] = THREE.MathUtils.randFloat(1.5, 7);
        }
        puff.geo.attributes.position.needsUpdate = true;
        puffLife = 0;
      },
      verdict: function (signal) {
        var col = signal === 'SELL' ? C.flashSell : (signal === 'HOLD' ? C.flashHold : C.flashBuy);
        burst.mat.color.set(col);
        ring.material.color.set(col);
        flash.material.color.set(col);
        for (var b = 0; b < SHARDS; b++) {
          burst.positions[b * 3] = THREE.MathUtils.randFloatSpread(2);
          burst.positions[b * 3 + 1] = 6 + THREE.MathUtils.randFloatSpread(2);
          burst.positions[b * 3 + 2] = -8 + THREE.MathUtils.randFloatSpread(2);
          var theta = Math.random() * Math.PI * 2;
          var speed = THREE.MathUtils.randFloat(9, 30);
          var up = THREE.MathUtils.randFloat(0.25, 1);
          burstVel[b * 3] = Math.cos(theta) * speed;
          burstVel[b * 3 + 1] = Math.abs(Math.sin(theta)) * speed * up + 7;
          burstVel[b * 3 + 2] = THREE.MathUtils.randFloatSpread(7);
        }
        burst.geo.attributes.position.needsUpdate = true;
        burstLife = 0; ringLife = 0; flashLife = 0;
        // mood snaps with the ruling
        mood.target = signal === 'SELL' ? 0.08 : (signal === 'HOLD' ? 0.5 : 0.95);
      }
    };
  }

  /* ────────────────────────────────────────────────────────────
     Integration: momentum observer + SSE listener (audio-pack
     pattern) — resilient polling for council mount.
     ──────────────────────────────────────────────────────────── */
  function wireMomentum() {
    var fill = document.getElementById('adv-momentum-fill');
    if (!fill || !fx) return false;
    function read() {
      var w = parseFloat(fill.style.width);
      if (!isNaN(w)) fx.setMood(w / 100);
    }
    new MutationObserver(read).observe(fill, { attributes: true, attributeFilter: ['style'] });
    read();
    return true;
  }

  function wireSSE() {
    if (!window.__sseListeners) return false;
    var powerOnDone = false;
    window.__sseListeners.push(function (type, ev) {
      var data;
      try { data = ev.data ? JSON.parse(ev.data) : null; } catch (e) { return; }
      if (!data) return;
      var kind = data.type || type;
      var payload = data.data || {};

      if (kind === 'status' && /running/i.test(payload.status || '') && !powerOnDone) {
        powerOnDone = true;
        var arena = document.getElementById('adv-arena');
        if (arena && !REDUCED) {
          arena.classList.add('fx-poweron');
          setTimeout(function () { arena.classList.remove('fx-poweron'); }, 600);
        }
        return;
      }
      if (kind === 'decision' && fx) {
        var sig = (payload.signal || '').toUpperCase() ||
                  ((String(payload.final_decision || '').match(/\b(BUY|SELL|HOLD)\b/i) || [''])[0].toUpperCase());
        fx.verdict(sig || 'BUY');
        return;
      }
      if (/report|debate|message/i.test(kind) && fx) fx.puff();
    });
    return true;
  }

  /* ────────────────────────────────────────────────────────────
     Boot
     ──────────────────────────────────────────────────────────── */
  function boot() {
    injectVignette();
    if (!REDUCED) fx = initWebGL();
    /* Public handle: lets QA, future packs (e.g. audio cues), or the
       console drive the scene: castleFX.verdict('BUY'), .setMood(0..1),
       .puff(), .step(dt). Null when WebGL is off / reduced motion. */
    window.castleFX = fx;

    var tries = 0;
    (function poll() {
      var mounted = window.__sseHookInstalled && document.querySelector('.adv-device');
      if (mounted) {
        injectCRT();
        settleDevice();
        wireMomentum();
        wireSSE();
        wireCardReveals();
        return;
      }
      if (++tries < 150) setTimeout(poll, 120);
    })();

    runTitle(function () {
      var input = document.getElementById('adv-greeter-input');
      if (input) try { input.focus(); } catch (e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
