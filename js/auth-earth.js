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
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86; /* deeper blacks → more cinematic */

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
  /* Minimal cold ambient — forces deep shadow on dark side */
  scene.add(new THREE.AmbientLight(0x010408, 0.50));

  /* Sun — slightly warm white, dramatic angle, sharp terminator */
  var sun = new THREE.DirectionalLight(0xeef4ff, 1.60);
  sun.position.set(-3.5, 2.0, 3.5);
  scene.add(sun);

  /* Gold cinematic rim — warm backlight from the right */
  var goldLight = new THREE.DirectionalLight(0xf5c86a, 0.75);
  goldLight.position.set(5, 0.8, 0.5);
  scene.add(goldLight);

  /* Cold blue fill — barely lifts south pole */
  var fillLight = new THREE.DirectionalLight(0x0a1830, 0.14);
  fillLight.position.set(0, -3, -2);
  scene.add(fillLight);

  /* Deep purple sci-fi accent — adds depth to the terminator zone */
  var accentLight = new THREE.DirectionalLight(0x220044, 0.22);
  accentLight.position.set(-5, 3, -2);
  scene.add(accentLight);

  /* ── Star field ──────────────────────────────────────────────────────── */
  (function () {
    /* Spherical distribution — no box-clustering artifacts */
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
        color: color, size: size,
        transparent: true, opacity: opacity, sizeAttenuation: true,
      })));
    }

    /* Main white field — deep sky */
    addStars(isMobile ? 1600 : 3200, 55, 90, 0xffffff, 0.052, 0.76);
    /* Bright foreground punches — sparse, crisp */
    addStars(isMobile ?   60 :  160, 48, 65, 0xeef8ff, 0.130, 0.90);
    /* Warm gold accent cluster */
    addStars(isMobile ?  140 :  340, 58, 82, 0xf0c060, 0.046, 0.34);
    /* Faint blue-white mid-range fill */
    addStars(isMobile ?  300 :  800, 50, 75, 0xc8dcff, 0.038, 0.28);
  }());

  /* ── Earth — real photo textures ─────────────────────────────────────── */
  var loader = new THREE.TextureLoader();
  var BASE   = 'https://threejs.org/examples/textures/planets/';
  var segs   = isMobile ? 48 : 96;

  var earthMat = new THREE.MeshPhongMaterial({
    map:          loader.load(BASE + 'earth_atmos_2048.jpg'),
    specularMap:  loader.load(BASE + 'earth_specular_2048.jpg'),
    normalMap:    loader.load(BASE + 'earth_normal_2048.jpg'),
    emissiveMap:  loader.load(BASE + 'earth_lights_2048.png'), /* city lights */
    normalScale:  new THREE.Vector2(0.90, 0.90),
    specular:     new THREE.Color(0x1a3355),
    shininess:    42,                               /* crisper ocean glint */
    emissive:          new THREE.Color(0xffcc66),   /* warm gold city lights */
    emissiveIntensity: 0.55,                        /* visible on dark side only */
  });

  var earth = new THREE.Mesh(new THREE.SphereGeometry(1, segs, segs), earthMat);
  earth.rotation.z = -0.41; /* 23.5° axial tilt */

  /* ── Cloud layer — both desktop and mobile ───────────────────────────── */
  var cloudSegs = isMobile ? 48 : 72;
  var clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.008, cloudSegs, cloudSegs),
    new THREE.MeshPhongMaterial({
      map:         loader.load(BASE + 'earth_clouds_1024.png'),
      transparent: true,
      opacity:     isMobile ? 0.20 : 0.38,
      depthWrite:  false,
    })
  );
  clouds.rotation.z = earth.rotation.z;

  /* ── Atmosphere — Fresnel shaders (back-side rendered) ───────────────── */
  var vAtmos = [
    'varying vec3 vN;',
    'void main(){',
    '  vN=normalize(normalMatrix*normal);',
    '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
    '}',
  ].join('\n');

  var fAtmos = [
    'uniform vec3 gColor;uniform float coeff;uniform float pw;',
    'varying vec3 vN;',
    'void main(){',
    '  float i=pow(coeff-dot(vN,vec3(0.0,0.0,1.0)),pw);',
    '  gl_FragColor=vec4(gColor,clamp(i,0.0,1.0));',
    '}',
  ].join('\n');

  var fHaze = [
    'uniform vec3 gColor;uniform float str;',
    'varying vec3 vN;',
    'void main(){',
    '  float i=pow(0.5-dot(vN,vec3(0.0,0.0,1.0)),3.2);',
    '  gl_FragColor=vec4(gColor,clamp(i,0.0,1.0)*str);',
    '}',
  ].join('\n');

  /* Bright inner limb — vivid cyan-blue, tight Fresnel edge */
  var atmosInner = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, isMobile ? 32 : 48, isMobile ? 32 : 48),
    new THREE.ShaderMaterial({
      uniforms: {
        gColor: { value: new THREE.Color(0x44aaff) },
        coeff:  { value: 0.55 },
        pw:     { value: 4.2 },
      },
      vertexShader:   vAtmos,
      fragmentShader: fAtmos,
      side:        THREE.BackSide,
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    })
  );

  /* Wide mid glow — softer blue ring */
  var atmosMid = new THREE.Mesh(
    new THREE.SphereGeometry(1.18, isMobile ? 28 : 40, isMobile ? 28 : 40),
    new THREE.ShaderMaterial({
      uniforms: {
        gColor: { value: new THREE.Color(0x2266ee) },
        str:    { value: 0.44 },
      },
      vertexShader:   vAtmos,
      fragmentShader: fHaze,
      side:        THREE.BackSide,
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    })
  );

  /* Deep outer haze — dark blue corona */
  var atmosOuter = new THREE.Mesh(
    new THREE.SphereGeometry(1.32, 28, 28),
    new THREE.ShaderMaterial({
      uniforms: {
        gColor: { value: new THREE.Color(0x0033bb) },
        str:    { value: 0.26 },
      },
      vertexShader:   vAtmos,
      fragmentShader: fHaze,
      side:        THREE.BackSide,
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    })
  );

  /* Ultra-wide purple corona — sci-fi depth, barely visible */
  var atmosCorona = new THREE.Mesh(
    new THREE.SphereGeometry(1.56, 24, 24),
    new THREE.ShaderMaterial({
      uniforms: {
        gColor: { value: new THREE.Color(0x110033) },
        str:    { value: 0.18 },
      },
      vertexShader:   vAtmos,
      fragmentShader: fHaze,
      side:        THREE.BackSide,
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    })
  );

  /* ── Group ───────────────────────────────────────────────────────────── */
  var earthGroup = new THREE.Group();
  earthGroup.add(earth);
  earthGroup.add(clouds);
  earthGroup.add(atmosInner);
  earthGroup.add(atmosMid);
  earthGroup.add(atmosOuter);
  earthGroup.add(atmosCorona);
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
    earth.rotation.y  = t * 0.048;  /* ~2 min/rev — premium slow drift */
    clouds.rotation.y = t * 0.052;  /* clouds drift slightly faster */
    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (alive && !rafId) {
      t0 = performance.now() - (earth.rotation.y / 0.048) * 1000;
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
        'left:'   + (Math.random() * 100)      + '%;' +
        'top:'    + (55 + Math.random() * 45)  + '%;' +
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

    [cta, sub, kicker, title].forEach(function (el) {
      if (!el) return;
      el.style.transition = 'opacity 220ms ease, transform 220ms ease';
      el.style.opacity    = '0';
      el.style.transform  = 'scale(0.95)';
    });

    setTimeout(function () {
      canvas.classList.add('ae-canvas--bg');
    }, 140);

    setTimeout(function () {
      intro.classList.add('ae-intro--out');
      document.body.classList.add('ae-form-open');
    }, 520);

    if (mode === 'register') {
      setTimeout(function () {
        var tabs = document.querySelectorAll('.auth-tab');
        if (tabs && tabs[1]) tabs[1].click();
      }, 650);
    }

    setTimeout(function () {
      var emailField = document.getElementById('email');
      if (emailField) emailField.focus();
    }, 720);

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
