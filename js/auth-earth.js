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
  renderer.toneMapping    = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  /* ── Scene ───────────────────────────────────────────────────────────── */
  var scene = new THREE.Scene();

  /* ── Camera ──────────────────────────────────────────────────────────── */
  var camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);

  function updateCamera() {
    var asp = window.innerWidth / window.innerHeight;
    camera.aspect = asp;
    /* pull back on portrait/square so the full globe is visible */
    camera.position.z = asp < 0.75 ? 3.6 : asp < 1 ? 3.1 : 2.75;
    camera.updateProjectionMatrix();
  }
  updateCamera();

  /* ── Lighting ────────────────────────────────────────────────────────── */
  /* Cold deep-space ambient — keeps the dark side visible but dim */
  scene.add(new THREE.AmbientLight(0x060d1e, 1.0));

  /* Primary sun — slightly blue-white, from upper-left front */
  var sun = new THREE.DirectionalLight(0xaaccff, 1.25);
  sun.position.set(-4, 1.5, 3);
  scene.add(sun);

  /* Warm gold rim from the right — cinematic back-light */
  var goldLight = new THREE.DirectionalLight(0xf0c060, 0.48);
  goldLight.position.set(5, 0.5, 0.5);
  scene.add(goldLight);

  /* Deep fill from below — lifts the southern hemisphere slightly */
  var fillLight = new THREE.DirectionalLight(0x1a3860, 0.30);
  fillLight.position.set(0, -3, -2);
  scene.add(fillLight);

  /* ── Star field ──────────────────────────────────────────────────────── */
  (function () {
    /* White stars */
    var geo = new THREE.BufferGeometry();
    var N = isMobile ? 1200 : 2200;
    var pos = new Float32Array(N * 3);
    for (var i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 100;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.065,
      transparent: true, opacity: 0.72, sizeAttenuation: true,
    })));

    /* Faint gold cluster — warm accent against the void */
    var geo2 = new THREE.BufferGeometry();
    var N2 = isMobile ? 120 : 280;
    var pos2 = new Float32Array(N2 * 3);
    for (var j = 0; j < N2 * 3; j++) pos2[j] = (Math.random() - 0.5) * 80;
    geo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
    scene.add(new THREE.Points(geo2, new THREE.PointsMaterial({
      color: 0xf0c060, size: 0.055,
      transparent: true, opacity: 0.32, sizeAttenuation: true,
    })));
  }());

  /* ── Earth — real photo textures ─────────────────────────────────────── */
  var loader = new THREE.TextureLoader();
  var BASE   = 'https://threejs.org/examples/textures/planets/';
  var segs   = isMobile ? 48 : 96;

  var earthMat = new THREE.MeshPhongMaterial({
    map:         loader.load(BASE + 'earth_atmos_2048.jpg'),
    specularMap: loader.load(BASE + 'earth_specular_2048.jpg'),
    normalMap:   loader.load(BASE + 'earth_normal_2048.jpg'),
    normalScale: new THREE.Vector2(0.80, 0.80),
    specular:    new THREE.Color(0x1a3355),
    shininess:   22,
    /* night-side emissive keeps city areas from going pure black */
    emissive:         new THREE.Color(0x030d1a),
    emissiveIntensity: 0.50,
  });

  var earth = new THREE.Mesh(new THREE.SphereGeometry(1, segs, segs), earthMat);
  earth.rotation.z = -0.41; /* 23.5° axial tilt */
  scene.add(earth);

  /* ── Cloud layer (desktop only) ──────────────────────────────────────── */
  var clouds = null;
  if (!isMobile) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.008, 72, 72),
      new THREE.MeshPhongMaterial({
        map:         loader.load(BASE + 'earth_clouds_1024.png'),
        transparent: true,
        opacity:     0.28,
        depthWrite:  false,
      })
    );
    clouds.rotation.z = earth.rotation.z;
    scene.add(clouds);
  }

  /* ── Atmosphere — Fresnel shader (back-side rendered) ────────────────── */
  var vAtmos = [
    'varying vec3 vN;',
    'void main(){',
    '  vN=normalize(normalMatrix*normal);',
    '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
    '}',
  ].join('\n');

  /* Inner blue-cyan glow */
  var fAtmos = [
    'uniform vec3 gColor;uniform float coeff;uniform float pw;',
    'varying vec3 vN;',
    'void main(){',
    '  float i=pow(coeff-dot(vN,vec3(0.0,0.0,1.0)),pw);',
    '  gl_FragColor=vec4(gColor,clamp(i,0.0,1.0));',
    '}',
  ].join('\n');

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.12, isMobile ? 32 : 48, isMobile ? 32 : 48),
    new THREE.ShaderMaterial({
      uniforms: {
        gColor: { value: new THREE.Color(0x1a55cc) },
        coeff:  { value: 0.46 },
        pw:     { value: 5.2 },
      },
      vertexShader:   vAtmos,
      fragmentShader: fAtmos,
      side:        THREE.BackSide,
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    })
  ));

  /* Outer haze — wider, softer, deeper blue */
  var fHaze = [
    'uniform vec3 gColor;',
    'varying vec3 vN;',
    'void main(){',
    '  float i=pow(0.5-dot(vN,vec3(0.0,0.0,1.0)),3.6);',
    '  gl_FragColor=vec4(gColor,clamp(i,0.0,1.0)*0.18);',
    '}',
  ].join('\n');

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.26, 32, 32),
    new THREE.ShaderMaterial({
      uniforms: { gColor: { value: new THREE.Color(0x002288) } },
      vertexShader:   vAtmos,
      fragmentShader: fHaze,
      side:        THREE.BackSide,
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    })
  ));

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
    rafId    = requestAnimationFrame(loop);
    var t    = (now - t0) * 0.001;
    earth.rotation.y = t * 0.072;
    if (clouds) clouds.rotation.y = t * 0.078; /* clouds drift slightly faster */
    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(loop);

  /* Pause when tab hidden — saves CPU / battery */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (alive && !rafId) {
      /* rebase t0 so earth snaps back to where it was */
      t0 = performance.now() - (earth.rotation.y / 0.072) * 1000;
      rafId = requestAnimationFrame(loop);
    }
  });

  /* ── Gold dust particles (CSS-driven) ────────────────────────────────── */
  (function () {
    var container = document.getElementById('aeParticles');
    if (!container) return;
    for (var i = 0; i < 26; i++) {
      var el   = document.createElement('div');
      el.className = 'ae-particle';
      var size = 1.2 + Math.random() * 2.4;
      el.style.cssText =
        'width:'  + size + 'px;' +
        'height:' + size + 'px;' +
        'left:'   + (Math.random() * 100)        + '%;' +
        'top:'    + (55  + Math.random() * 45)   + '%;' +
        'animation-duration:' + (9  + Math.random() * 16) + 's;' +
        'animation-delay:'    + (Math.random() * 14)       + 's;';
      container.appendChild(el);
    }
  }());

  /* ── Intro reveal sequence ───────────────────────────────────────────── */
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

  /* ── Transition: intro → auth form ──────────────────────────────────── */
  function openForm(mode) {
    if (!intro) return;

    /* 1. Fade text out quickly */
    [cta, sub, kicker, title].forEach(function (el) {
      if (!el) return;
      el.style.transition = 'opacity 220ms ease, transform 220ms ease';
      el.style.opacity    = '0';
      el.style.transform  = 'scale(0.95)';
    });

    /* 2. Blur + dim the Earth */
    setTimeout(function () {
      canvas.classList.add('ae-canvas--bg');
    }, 140);

    /* 3. Fade the overlay out */
    setTimeout(function () {
      intro.classList.add('ae-intro--out');
      document.body.classList.add('ae-form-open');
    }, 520);

    /* 4. Switch to Register tab if needed */
    if (mode === 'register') {
      setTimeout(function () {
        var tabs = document.querySelectorAll('.auth-tab');
        if (tabs && tabs[1]) tabs[1].click();
      }, 650);
    }

    /* 5. Focus email for accessibility */
    setTimeout(function () {
      var emailField = document.getElementById('email');
      if (emailField) emailField.focus();
    }, 720);

    /* 6. Remove overlay from DOM + stop render loop */
    setTimeout(function () {
      if (intro) intro.style.display = 'none';
      alive = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }, 1300);
  }

  var aeLoginBtn = document.getElementById('aeLoginBtn');
  var aeRegBtn   = document.getElementById('aeRegisterBtn');
  if (aeLoginBtn) aeLoginBtn.addEventListener('click', function () { openForm('login');    });
  if (aeRegBtn)   aeRegBtn.addEventListener('click',   function () { openForm('register'); });

}());
