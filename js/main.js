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

  const CYL_RADIUS = 1.7;
  const CYL_HEIGHT = 6.4;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0d11, 12, 30);

  const camera = new THREE.PerspectiveCamera(
    46,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0.9, 0.6, 7.2);
  camera.lookAt(0, 0.1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.cursor = 'default';
  container.appendChild(renderer.domElement);

  function renderNow() {
    renderer.render(scene, camera);
  }

  // -- the hull --
  const cylinderGroup = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(CYL_RADIUS, CYL_RADIUS, CYL_HEIGHT, radialSegments, 1, true);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1c2128,
    metalness: 0.55,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  cylinderGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

  // faint machined panel lines
  const seamGeo = new THREE.CylinderGeometry(CYL_RADIUS + 0.006, CYL_RADIUS + 0.006, CYL_HEIGHT, radialSegments / 2, 1, true);
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x4a5563, wireframe: true, transparent: true, opacity: 0.22 });
  cylinderGroup.add(new THREE.Mesh(seamGeo, seamMat));

  // a dense field of thin glowing rings running the length of the hull
  const thinRingCount = isSmall ? 9 : 16;
  for (let i = 0; i <= thinRingCount; i++) {
    const y = -CYL_HEIGHT / 2 + (i / thinRingCount) * CYL_HEIGHT;
    const ringGeo = new THREE.TorusGeometry(CYL_RADIUS + 0.01, 0.006, 6, radialSegments);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3d9eff, transparent: true, opacity: 0.22 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    cylinderGroup.add(ring);
  }

  // brighter divider rings at the section boundaries (roughly 1/3 and 2/3 up)
  [1 / 3, 2 / 3].forEach((t) => {
    const y = -CYL_HEIGHT / 2 + t * CYL_HEIGHT;
    const ringGeo = new THREE.TorusGeometry(CYL_RADIUS + 0.015, 0.02, 8, radialSegments);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    cylinderGroup.add(ring);
  });

  // bright cap rings, top and bottom edges
  [-1, 1].forEach((sign) => {
    const ringGeo = new THREE.TorusGeometry(CYL_RADIUS + 0.02, 0.035, 10, radialSegments);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7cc4ff, opacity: 1 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sign * (CYL_HEIGHT / 2);
    cylinderGroup.add(ring);
  });

  // vertical light strips around the circumference
  const stripCount = isSmall ? 5 : 8;
  for (let i = 0; i < stripCount; i++) {
    const angle = (i / stripCount) * Math.PI * 2;
    const stripGeo = new THREE.BoxGeometry(0.035, CYL_HEIGHT * 0.86, 0.035);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x4fadff, transparent: true, opacity: 0.45 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(Math.cos(angle) * (CYL_RADIUS + 0.02), 0, Math.sin(angle) * (CYL_RADIUS + 0.02));
    cylinderGroup.add(strip);
  }

  // glowing base platform
  const baseY = -CYL_HEIGHT / 2 - 0.35;
  const baseDiscGeo = new THREE.CylinderGeometry(2.5, 2.65, 0.08, radialSegments, 1, false);
  const baseDiscMat = new THREE.MeshStandardMaterial({ color: 0x14181e, metalness: 0.5, roughness: 0.5 });
  const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
  baseDisc.position.y = baseY;
  cylinderGroup.add(baseDisc);

  [[2.0, 0.008, 0.4], [2.35, 0.022, 0.9], [2.7, 0.008, 0.35]].forEach(([r, tube, opacity]) => {
    const ringGeo = new THREE.TorusGeometry(r, tube, 8, radialSegments);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = baseY + 0.045;
    cylinderGroup.add(ring);
  });

  // -- click-to-navigate hit bands: invisible until hovered --
  const bandHeight = CYL_HEIGHT / 3;
  const bandDefs = [
    { section: 'about', yCenter: CYL_HEIGHT / 2 - bandHeight / 2 },
    { section: 'projects', yCenter: 0 },
    { section: 'contact', yCenter: -CYL_HEIGHT / 2 + bandHeight / 2 },
  ];
  const hitBands = [];
  bandDefs.forEach((def) => {
    const geo = new THREE.CylinderGeometry(CYL_RADIUS * 1.15, CYL_RADIUS * 1.15, bandHeight * 0.94, radialSegments, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = def.yCenter;
    mesh.userData.section = def.section;
    cylinderGroup.add(mesh);
    hitBands.push(mesh);
  });

  scene.add(cylinderGroup);

  // -- ambient dust, independent of the cylinder's own rotation --
  const particleCount = isSmall ? 90 : 220;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 2.5 + Math.random() * 2.8;
    const angle = Math.random() * Math.PI * 2;
    const y = -CYL_HEIGHT / 2 - 0.5 + Math.random() * (CYL_HEIGHT + 2.2);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x7cc4ff,
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // -- lighting: no HDRI, tuned so a dark hull still reads with dimension --
  scene.add(new THREE.AmbientLight(0x3a4250, 0.55));

  const key = new THREE.DirectionalLight(0xaec7ff, 1.3);
  key.position.set(4, 5, 6);
  scene.add(key);

  const rim = new THREE.PointLight(0x4fadff, 3.2, 26, 2);
  rim.position.set(-4, 1.5, -3);
  scene.add(rim);

  const fill = new THREE.PointLight(0x7cc4ff, 0.7, 26, 2);
  fill.position.set(-2, -2, 4);
  scene.add(fill);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderNow();
  }
  window.addEventListener('resize', onResize);

  // -- click-to-navigate: raycast against the invisible bands --
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let hoveredBand = null;

  function updatePointerNDC(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function getIntersectedBand() {
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(hitBands);
    return hits.length ? hits[0].object : null;
  }

  renderer.domElement.addEventListener('pointermove', (e) => {
    updatePointerNDC(e.clientX, e.clientY);
    const band = getIntersectedBand();
    if (band !== hoveredBand) {
      if (hoveredBand) hoveredBand.material.opacity = 0;
      hoveredBand = band;
      if (hoveredBand) {
        hoveredBand.material.opacity = 0.12;
        renderer.domElement.style.cursor = 'pointer';
      } else {
        renderer.domElement.style.cursor = 'default';
      }
      if (prefersReducedMotion) renderNow();
    }
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    if (hoveredBand) hoveredBand.material.opacity = 0;
    hoveredBand = null;
    renderer.domElement.style.cursor = 'default';
    if (prefersReducedMotion) renderNow();
  });

  renderer.domElement.addEventListener('click', (e) => {
    updatePointerNDC(e.clientX, e.clientY);
    const band = getIntersectedBand();
    if (band) {
      const target = document.getElementById(band.userData.section);
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  });

  if (prefersReducedMotion) {
    cylinderGroup.rotation.y = 0.6;
    renderNow();
    console.log('[PDA] Reduced motion is on — cylinder is static, but still clickable.');
    return;
  }

  // -- scroll-linked rotation, always active, never fades out --
  let scrollAngle = 0;
  function readScroll() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const overall = total > 0 ? window.scrollY / total : 0;
    scrollAngle = overall * Math.PI * 5;
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  let ambientAngle = 0;
  let raf = null;

  function tick() {
    raf = requestAnimationFrame(tick);
    ambientAngle += 0.0016;
    cylinderGroup.rotation.y = ambientAngle + scrollAngle;
    particles.rotation.y += 0.00035;
    renderNow();
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
