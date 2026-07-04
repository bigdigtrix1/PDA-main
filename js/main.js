/* ==========================================================================
   PDA — site behavior
   Sections: 1) helpers  2) WebGL cylinder backdrop  3) plate reveal
   4) nav behavior
   ========================================================================== */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

/* ==========================================================================
   1. WebGL cylinder backdrop
   ========================================================================== */

async function initCylinderBackdrop() {
  const container = document.getElementById('bg-canvas-container');
  if (!container) return;

  let THREE;
  try {
    THREE = await import('three');
  } catch (err) {
    console.error('[PDA] three.js failed to load from primary CDN, retrying with a fallback…', err);
    try {
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js');
    } catch (err2) {
      console.error('[PDA] three.js failed to load entirely — showing the static gradient fallback instead.', err2);
      document.body.classList.add('no-webgl');
      return;
    }
  }
  console.log('[PDA] three.js loaded — building the cylinder scene.');

  const isSmall = window.innerWidth < 700;
  const radialSegments = isSmall ? 40 : 72;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd6dde3, 14, 28);

  const camera = new THREE.PerspectiveCamera(
    46,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0.9, 0.6, 7.2);
  camera.lookAt(0, 0.2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // -- cylinder group (the signature element) --
  const cylinderGroup = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(1.7, 1.7, 6.2, radialSegments, 1, true);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xaeb6bf,
    metalness: 0.92,
    roughness: 0.32,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  cylinderGroup.add(body);

  // faint machined panel lines running the length of the cylinder
  const seamGeo = new THREE.CylinderGeometry(1.706, 1.706, 6.2, radialSegments / 2, 1, true);
  const seamMat = new THREE.MeshBasicMaterial({
    color: 0xc7cdd4,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });
  cylinderGroup.add(new THREE.Mesh(seamGeo, seamMat));

  // glowing blue accent rings — the one bold color move on the object itself
  const ringHeights = [-2.6, -0.6, 1.4, 3.2];
  ringHeights.forEach((y) => {
    const ringGeo = new THREE.TorusGeometry(1.72, 0.02, 8, radialSegments);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    cylinderGroup.add(ring);
  });

  cylinderGroup.position.y = -0.4;
  scene.add(cylinderGroup);

  // -- lighting: no HDRI, boosted so brushed steel reads clearly on a light backdrop --
  scene.add(new THREE.AmbientLight(0xe7ebee, 0.45));

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(4, 5, 6);
  scene.add(key);

  const rim = new THREE.PointLight(0x4fadff, 2.6, 24, 2);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  const fill = new THREE.PointLight(0xffffff, 0.6, 24, 2);
  fill.position.set(-2, -2, 4);
  scene.add(fill);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', onResize);

  if (prefersReducedMotion) {
    // Static: show the cylinder at a fixed, pleasant angle, render once, animate nothing.
    cylinderGroup.rotation.y = 0.6;
    renderer.render(scene, camera);
    console.log('[PDA] Reduced motion is on — showing a static cylinder, no spin.');
    return;
  }

  // -- scroll-linked motion --
  let scrollAngle = 0;
  let heroProgress = 0;
  const heroEl = document.getElementById('hero');

  function readScroll() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const overall = total > 0 ? window.scrollY / total : 0;
    scrollAngle = overall * Math.PI * 5;

    const heroHeight = heroEl ? heroEl.offsetHeight : window.innerHeight;
    heroProgress = Math.min(window.scrollY / heroHeight, 1);

    container.style.opacity = String(1 - heroProgress * 0.5);
    const scale = 1 - heroProgress * 0.12;
    renderer.domElement.style.transform = `scale(${scale})`;
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  // -- render loop, paused when tab hidden --
  let ambientAngle = 0;
  let raf = null;

  function tick() {
    raf = requestAnimationFrame(tick);
    ambientAngle += 0.0016;
    cylinderGroup.rotation.y = ambientAngle + scrollAngle;
    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else if (!raf) {
      tick();
    }
  });

  tick();
}

/* ==========================================================================
   2. Plate reveal on scroll
   ========================================================================== */

function initPlateReveal() {
  const plates = document.querySelectorAll('.plate');
  if (!('IntersectionObserver' in window)) {
    plates.forEach((p) => p.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
  );
  plates.forEach((p) => observer.observe(p));
}

/* ==========================================================================
   3. Nav — mobile toggle, active link, close-on-click
   ========================================================================== */

function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const sections = ['about', 'projects', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navAnchors = document.querySelectorAll('.nav-links a');

  if ('IntersectionObserver' in window && sections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navAnchors.forEach((a) => a.classList.remove('active'));
            const match = document.querySelector(`.nav-links a[data-nav="${entry.target.id}"]`);
            if (match) match.classList.add('active');
          }
        });
      },
      { threshold: 0.4 }
    );
    sections.forEach((s) => navObserver.observe(s));
  }
}

/* ==========================================================================
   Init
   ========================================================================== */

initPlateReveal();
initNav();

if (supportsWebGL()) {
  initCylinderBackdrop();
} else {
  document.body.classList.add('no-motion');
  console.warn('[PDA] WebGL is not available in this browser — showing the static gradient fallback.');
}
