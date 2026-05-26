(function () {
  'use strict';

  /* ── Guards ──────────────────────────────────────────────────────────── */
  if (!document.body.classList.contains('auth-page')) return;
  if (typeof THREE === 'undefined') {
    var _intro = document.getElementById('ae-intro');
    if (_intro) _intro.style.display = 'none';
    return;
  }

  var canvas = document.getElementById('ae-canvas');
  if (!canvas) return;

  /* Mark body so CSS form-entrance rules activate */
  document.body.classList.add('ae-earth-ready');

  /* ── Device caps ─────────────────────────────────────────────────────── */
  var isMobile = window.innerWidth < 768 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);

  /* ── Renderer ────────────────────────────────────────────────────────── */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isMobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    var _fi = document.getElementById('ae-intro');
    if (_fi) _fi.style.display = 'none';
    return;
  }

  var W = window.innerWidth, H = window.innerHeight;
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  /* ── Scene ───────────────────────────────────────────────────────────── */
  var scene = new THREE.Scene();

  /* ── Camera ──────────────────────────────────────────────────────────── */
  var camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);

  function updateCamera() {
    var asp = window.innerWidth / window.innerHeight;
    camera.aspect = asp;
    camera.position.z = asp < 0.75 ? 3.6 : asp < 1 ? 3.1 : 2.75;
    camera.updateProjectionMatrix();
  }
  updateCamera();

  /* ── Lighting ────────────────────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0x010206, 0.26));

  var sun = new THREE.DirectionalLight(0xffffff, 2.10);
  sun.position.set(-3.5, 2.0, 3.5);
  scene.add(sun);

  var goldLight = new THREE.DirectionalLight(0xf5c86a, 0.35);
  goldLight.position.set(5, 0.8, 0.5);
  scene.add(goldLight);

  var fillLight = new THREE.DirectionalLight(0x0a1830, 0.14);
  fillLight.position.set(0, -3, -2);
  scene.add(fillLight);

  var accentLight = new THREE.DirectionalLight(0x220044, 0.22);
  accentLight.position.set(-5, 3, -2);
  scene.add(accentLight);

  /* ── Star field ──────────────────────────────────────────────────────── */
  (function () {
    function mkStars(n, rMin, rMax) {
      var pos = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var r     = rMin + Math.random() * (rMax - rMin);
        var theta = Math.random() * Math.PI * 2;
        var phi   = Math.acos(2 * Math.random() - 1);
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
      }
      return pos;
    }
    function addStars(n, rMin, rMax, color, size, opacity) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(mkStars(n, rMin, rMax), 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({
        color: color, size: size, transparent: true, opacity: opacity, sizeAttenuation: true,
      })));
    }
    addStars(isMobile ? 1600 : 3200, 55, 90, 0xffffff, 0.052, 0.76);
    addStars(isMobile ?   60 :  160, 48, 65, 0xeef8ff, 0.130, 0.90);
    addStars(isMobile ?  140 :  340, 58, 82, 0xf0c060, 0.046, 0.34);
    addStars(isMobile ?  300 :  800, 50, 75, 0xc8dcff, 0.038, 0.28);
  }());

  /* ── Earth ───────────────────────────────────────────────────────────── */
  var loader = new THREE.TextureLoader();
  var BASE   = 'https://threejs.org/examples/textures/planets/';
  var segs   = isMobile ? 48 : 96;

  var _maxAniso = renderer.capabilities.getMaxAnisotropy
    ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;

  function loadTex(url, srgb) {
    var t = loader.load(url);
    t.anisotropy = _maxAniso;
    if (srgb && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  var earthMat = new THREE.MeshPhongMaterial({
    map:               loadTex(BASE + 'earth_day_4096.jpg',   true),
    specularMap:       loadTex(BASE + 'earth_specular_2048.jpg'),
    normalMap:         loadTex(BASE + 'earth_normal_2048.jpg'),
    emissiveMap:       loadTex(BASE + 'earth_night_4096.jpg', true),
    normalScale:       new THREE.Vector2(1.10, 1.10),
    specular:          new THREE.Color(0x3a5577),
    shininess:         70,
    emissive:          new THREE.Color(0xffffff),
    emissiveIntensity: 0.62,
  });

  var earth  = new THREE.Mesh(new THREE.SphereGeometry(1, segs, segs), earthMat);
  earth.rotation.z = -0.41;

  var clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.008, isMobile ? 48 : 72, isMobile ? 48 : 72),
    new THREE.MeshPhongMaterial({
      map: loader.load(BASE + 'earth_clouds_1024.png'),
      transparent: true, opacity: isMobile ? 0.24 : 0.44, depthWrite: false,
    })
  );
  clouds.rotation.z = earth.rotation.z;

  /* ── Atmosphere ──────────────────────────────────────────────────────── */
  var vAtmos = 'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  var fAtmos = 'uniform vec3 gColor;uniform float coeff;uniform float pw;varying vec3 vN;void main(){float i=pow(coeff-dot(vN,vec3(0.0,0.0,1.0)),pw);gl_FragColor=vec4(gColor,clamp(i,0.0,1.0));}';
  var fHaze  = 'uniform vec3 gColor;uniform float str;varying vec3 vN;void main(){float i=pow(0.5-dot(vN,vec3(0.0,0.0,1.0)),3.2);gl_FragColor=vec4(gColor,clamp(i,0.0,1.0)*str);}';

  function mkAtmos(r, uni, frag) {
    var segsA = isMobile ? 28 : 40;
    return new THREE.Mesh(
      new THREE.SphereGeometry(r, segsA, segsA),
      new THREE.ShaderMaterial({
        uniforms: uni, vertexShader: vAtmos, fragmentShader: frag,
        side: THREE.BackSide, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false,
      })
    );
  }

  var atmosInner    = mkAtmos(1.08, { gColor: { value: new THREE.Color(0x4db2ff) }, coeff: { value: 0.60 }, pw: { value: 3.6 } }, fAtmos);
  var atmosTwilight = mkAtmos(1.11, { gColor: { value: new THREE.Color(0xbc490b) }, str:   { value: 0.22 } }, fHaze);
  var atmosMid      = mkAtmos(1.18, { gColor: { value: new THREE.Color(0x2288ff) }, str:   { value: 0.52 } }, fHaze);
  var atmosOuter    = mkAtmos(1.32, { gColor: { value: new THREE.Color(0x003acc) }, str:   { value: 0.32 } }, fHaze);
  var atmosCorona   = mkAtmos(1.56, { gColor: { value: new THREE.Color(0x180044) }, str:   { value: 0.22 } }, fHaze);

  /* ── Group ───────────────────────────────────────────────────────────── */
  var earthGroup = new THREE.Group();
  earthGroup.add(earth, clouds, atmosInner, atmosTwilight, atmosMid, atmosOuter, atmosCorona);
  earthGroup.scale.setScalar(isMobile ? 0.58 : 0.75);
  scene.add(earthGroup);

  /* ── Resize ──────────────────────────────────────────────────────────── */
  window.addEventListener('resize', function () {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H);
    updateCamera();
  }, { passive: true });

  /* ── Render loop ─────────────────────────────────────────────────────── */
  var t0    = performance.now();
  var alive = true;
  var rafId = null;

  function loop(now) {
    if (!alive) return;
    rafId = requestAnimationFrame(loop);
    var t = (now - t0) * 0.001;
    earth.rotation.y  = t * 0.048;
    clouds.rotation.y = t * 0.052;
    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(rafId); rafId = null;
    } else if (alive && !rafId) {
      t0 = performance.now() - (earth.rotation.y / 0.048) * 1000;
      rafId = requestAnimationFrame(loop);
    }
  });

  /* ── Gold dust particles ─────────────────────────────────────────────── */
  (function () {
    var container = document.getElementById('aeParticles');
    if (!container) return;
    for (var i = 0; i < 26; i++) {
      var el = document.createElement('div');
      el.className = 'ae-particle';
      var sz = 1.2 + Math.random() * 2.4;
      el.style.cssText =
        'width:'  + sz + 'px;height:' + sz + 'px;' +
        'left:'   + (Math.random() * 100) + '%;' +
        'top:'    + (55 + Math.random() * 45) + '%;' +
        'animation-duration:' + (9  + Math.random() * 16) + 's;' +
        'animation-delay:'    + (Math.random() * 14) + 's;';
      container.appendChild(el);
    }
  }());

  /* ── Intro reveal ────────────────────────────────────────────────────── */
  var intro  = document.getElementById('ae-intro');
  var kicker = intro && intro.querySelector('.ae-kicker');
  var title  = intro && intro.querySelector('.ae-title');
  var sub    = intro && intro.querySelector('.ae-sub');
  var cta    = intro && intro.querySelector('.ae-cta');

  function reveal(el, delay) {
    if (!el) return;
    setTimeout(function () { el.classList.add('ae--visible'); }, delay);
  }
  reveal(kicker,  700);
  reveal(title,  1150);
  reveal(sub,    1900);
  reveal(cta,    2600);

  /* ─────────────────────────────────────────────────────────────────────
     openForm — show the auth card. No zoom here.
     _formOpen flag tells the auth-state listener the user is on the form.
  ───────────────────────────────────────────────────────────────────── */
  var _formOpen = false;

  function openForm(mode) {
    if (!intro) return;
    _formOpen = true;

    [cta, sub, kicker, title].forEach(function (el) {
      if (!el) return;
      el.style.transition = 'opacity 180ms ease, transform 200ms ease';
      el.style.opacity    = '0';
      el.style.transform  = 'scale(0.92)';
    });

    setTimeout(function () { canvas.classList.add('ae-canvas--bg'); }, 160);

    setTimeout(function () {
      intro.classList.add('ae-intro--out');
      document.body.classList.add('ae-form-open');
    }, 440);

    if (mode === 'register') {
      setTimeout(function () {
        var tabs = document.querySelectorAll('.auth-tab');
        if (tabs && tabs[1]) tabs[1].click();
      }, 580);
    }

    setTimeout(function () {
      var f = document.getElementById('email');
      if (f) f.focus();
    }, 640);

    /* Hide overlay node. alive stays true — render loop runs for post-auth zoom. */
    setTimeout(function () {
      if (intro) intro.style.display = 'none';
    }, 1240);
  }

  /* ─────────────────────────────────────────────────────────────────────
     playZoomTransition — runs ONLY after successful auth.

     Timeline (from call):
        0ms   form slides down + fades, canvas un-blurs
      180ms   intro fades back in — Earth fills screen
      380ms   atmosphere glow starts building (blue rim)
      500ms   zoom streak
      520ms   camera punch (easeInQuart, 980ms) — atmosphere dive
     1500ms   dark noir overlay fades in (360ms, no white flash)
     1900ms   onReady → app.js navigates
  ───────────────────────────────────────────────────────────────────── */
  var _zooming = false;

  function easeInQuart(t) { return t * t * t * t; }

  function playZoomTransition(onReady) {
    if (_zooming) { onReady(); return; }
    _zooming = true;

    /* 1. Form slides down and disappears */
    var form = document.querySelector('.auth-container');
    if (form) {
      form.style.transition    = 'transform 420ms cubic-bezier(0.4,0,1,1), opacity 300ms ease';
      form.style.transform     = 'translateY(110px)';
      form.style.opacity       = '0';
      form.style.pointerEvents = 'none';
    }

    /* 2. Un-blur Earth — canvas snaps back to full clarity */
    if (intro) { intro.style.display = 'flex'; intro.style.opacity = '0'; }
    canvas.style.transition = 'filter 380ms ease-out, opacity 380ms ease-out, transform 380ms ease-out';
    canvas.classList.remove('ae-canvas--bg');

    /* 3. Intro fades back in — Earth becomes full-screen subject */
    setTimeout(function () {
      if (intro) {
        intro.style.transition = 'opacity 280ms ease-out';
        intro.style.opacity    = '1';
        intro.classList.remove('ae-intro--out');
      }
    }, 180);

    /* 4. Atmospheric glow builds — blue limb brightens before dive */
    var _glowEl = null;
    setTimeout(function () {
      _glowEl = document.createElement('div');
      _glowEl.className = 'ae-atmos-glow';
      if (intro) intro.appendChild(_glowEl);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (_glowEl) _glowEl.classList.add('ae-atmos-glow--active');
        });
      });
    }, 380);

    /* 5. Speed-rush streak */
    setTimeout(function () {
      var streak = document.createElement('div');
      streak.className = 'ae-zoom-streak';
      if (intro) intro.appendChild(streak);
      setTimeout(function () {
        if (streak.parentNode) streak.parentNode.removeChild(streak);
      }, 960);
    }, 500);

    /* 6. Camera punch — fly through atmosphere into Earth */
    setTimeout(function () {
      var zStart  = performance.now();
      var zDur    = 980;
      var camZ0   = camera.position.z;
      var camZEnd = -0.65;        /* past Earth center — full atmosphere dive */
      var scl0    = earthGroup.scale.x;
      var sclEnd  = scl0 * 6.0;  /* Earth bursts completely past camera */

      function zoomTick(now) {
        var t = Math.min((now - zStart) / zDur, 1);
        var e = easeInQuart(t);
        camera.position.z = camZ0 + (camZEnd - camZ0) * e;
        earthGroup.scale.setScalar(scl0 + (sclEnd - scl0) * e);
        if (t < 1) {
          requestAnimationFrame(zoomTick);
        } else {
          /* Clean up glow, then fade to dark */
          if (_glowEl && _glowEl.parentNode) _glowEl.parentNode.removeChild(_glowEl);
          darkFadeThenResolve(onReady);
        }
      }
      requestAnimationFrame(zoomTick);
    }, 520);
  }

  /* ── Dark noir fade — replaces white flash, prevents blank-page flicker ── */
  function darkFadeThenResolve(onReady) {
    /* Pin html + body to black BEFORE navigation so browser paints dark */
    document.documentElement.style.background = '#000004';
    document.body.style.background            = '#000004';

    /* Deep-space overlay: subtle blue core → pure noir edges */
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000;pointer-events:none;' +
      'background:radial-gradient(ellipse 100% 100% at 50% 48%,' +
      'rgba(6,18,55,0.65) 0%,#000004 54%);' +
      'opacity:0;transition:opacity 360ms cubic-bezier(0.4,0,1,1);';
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.style.opacity = '1'; });
    });

    /* Navigate only after overlay is fully opaque — no white gap */
    setTimeout(onReady, 400);
  }

  /* ── Button wiring (intro CTAs) ──────────────────────────────────────── */
  var aeLoginBtn = document.getElementById('aeLoginBtn');
  var aeRegBtn   = document.getElementById('aeRegisterBtn');
  if (aeLoginBtn) aeLoginBtn.addEventListener('click', function () { openForm('login');    });
  if (aeRegBtn)   aeRegBtn.addEventListener('click',   function () { openForm('register'); });

  /* ─────────────────────────────────────────────────────────────────────
     window.playEarthZoomTransition — called by app.js on auth success:
       await window.playEarthZoomTransition?.();
       window.location.href = "./index.html";

     Returns a Promise that resolves when the white-flash fires, at which
     point app.js continues and sets window.location.href.
     If the form was never opened (_formOpen = false) it resolves instantly
     so other pages that import app.js are unaffected.
  ───────────────────────────────────────────────────────────────────── */
  window.playEarthZoomTransition = function () {
    return new Promise(function (resolve) {
      if (!_formOpen) { resolve(); return; }
      playZoomTransition(resolve);
    });
  };

}());
