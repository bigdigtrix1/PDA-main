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

  const specifiers = {
    three: 'three',
    composer: 'three/addons/postprocessing/EffectComposer.js',
    renderPass: 'three/addons/postprocessing/RenderPass.js',
    bloomPass: 'three/addons/postprocessing/UnrealBloomPass.js',
    shaderPass: 'three/addons/postprocessing/ShaderPass.js',
    outputPass: 'three/addons/postprocessing/OutputPass.js',
  };
  const fallbackBase = 'https://cdn.jsdelivr.net/npm/three@0.185.1';
  const fallbackSpecifiers = {
    three: `${fallbackBase}/build/three.module.js`,
    composer: `${fallbackBase}/examples/jsm/postprocessing/EffectComposer.js`,
    renderPass: `${fallbackBase}/examples/jsm/postprocessing/RenderPass.js`,
    bloomPass: `${fallbackBase}/examples/jsm/postprocessing/UnrealBloomPass.js`,
    shaderPass: `${fallbackBase}/examples/jsm/postprocessing/ShaderPass.js`,
    outputPass: `${fallbackBase}/examples/jsm/postprocessing/OutputPass.js`,
  };

  let THREE, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass;
  try {
    [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }] = await Promise.all([
      import(specifiers.three),
      import(specifiers.composer),
      import(specifiers.renderPass),
      import(specifiers.bloomPass),
      import(specifiers.shaderPass),
      import(specifiers.outputPass),
    ]);
  } catch (err) {
    console.error('[PDA] three.js (or its postprocessing addons) failed to load from the primary CDN, retrying with a fallback…', err);
    try {
      [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }] = await Promise.all([
        import(fallbackSpecifiers.three),
        import(fallbackSpecifiers.composer),
        import(fallbackSpecifiers.renderPass),
        import(fallbackSpecifiers.bloomPass),
        import(fallbackSpecifiers.shaderPass),
        import(fallbackSpecifiers.outputPass),
      ]);
    } catch (err2) {
      console.error('[PDA] three.js failed to load entirely — showing the static gradient fallback instead.', err2);
      document.body.classList.add('no-webgl');
      return;
    }
  }
  console.log('[PDA] three.js loaded — building the holographic cylinder scene.');

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // -- bloom post-processing --
  // Selective bloom, three.js's own documented pattern: render the whole
  // scene once into `bloomComposer` (bright pixels only survive the
  // threshold + blur), capture that as a texture, then render the scene
  // again "for real" and additively mix the bloom texture on top. The final
  // mix shader explicitly carries over the base pass's alpha channel, so the
  // canvas stays transparent wherever the base render was — bloom never
  // opacifies the page background behind the cylinder.
  const renderScene = new RenderPass(scene, camera);

  const bloomRes = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const bloomPass = new UnrealBloomPass(bloomRes, isSmall ? 0.28 : 0.4, 0.4, 0.72);

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(baseTexture, vUv);
          vec4 bloom = texture2D(bloomTexture, vUv);
          gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);
        }
      `,
    }),
    'baseTexture'
  );
  mixPass.needsSwap = true;

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderScene);
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());

  function renderNow() {
    bloomComposer.render();
    finalComposer.render();
  }

  // -- the hull: a translucent, hex-etched holographic membrane --
  const cylinderGroup = new THREE.Group();

  const hullUniforms = {
    uColor: { value: new THREE.Color(0x2f8ce6) },
    uColorBright: { value: new THREE.Color(0xbfe6ff) },
  };
  const bodyGeo = new THREE.CylinderGeometry(CYL_RADIUS, CYL_RADIUS, CYL_HEIGHT, radialSegments, 1, true);
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: hullUniforms,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uColorBright;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      // hex-cell edge distance (0 at cell center, 0.5 at the shared border)
      // plus a per-cell hash, so the whole surface tiles edge-to-edge with
      // no gaps — every pixel belongs to exactly one hexagon
      vec2 hexInfo(vec2 p) {
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(p, r) - h;
        vec2 ia = p - a;
        vec2 b = mod(p - h, r) - h;
        vec2 ib = p - b - h;
        bool useA = dot(a, a) < dot(b, b);
        vec2 gv = useA ? a : b;
        vec2 id = useA ? ia : ib;
        float edge = max(abs(gv.x) * 0.8660254 + abs(gv.y) * 0.5, abs(gv.y));
        float cellRand = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
        return vec2(edge, cellRand);
      }

      void main() {
        vec3 normal = normalize(vNormal);
        if (!gl_FrontFacing) normal = -normal;
        float fresnel = pow(1.0 - clamp(dot(normal, normalize(vViewDir)), 0.0, 1.0), 4.0);

        vec2 hex = hexInfo(vec2(vUv.x * 40.0, vUv.y * 24.0));
        float hexBorder = smoothstep(0.44, 0.5, hex.x);
        float panelShade = (hex.y - 0.5) * 0.1;

        float alpha = clamp(0.1 + panelShade + fresnel * 0.3 + hexBorder * 0.1, 0.0, 1.0);

        vec3 color = mix(uColor, uColorBright, clamp(fresnel * 0.9, 0.0, 1.0));
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  cylinderGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

  // bright cap rings, top and bottom — the crisp inner edge of each halo
  [-1, 1].forEach((sign) => {
    const ringGeo = new THREE.TorusGeometry(CYL_RADIUS + 0.02, 0.035, 10, radialSegments);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7cc4ff, opacity: 1 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sign * (CYL_HEIGHT / 2);
    cylinderGroup.add(ring);
  });

  // -- top/bottom halo discs: flat, circuit-etched rings of light the hull
  // projects from/into — drawn once onto a canvas texture, since that detail
  // would be far too expensive as real geometry
  function buildHaloTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const maxR = size / 2;
    ctx.translate(maxR, maxR);

    // concentric circuit bands
    [
      [0.98, 2, 'rgba(140,200,255,0.35)'],
      [0.9, 1, 'rgba(140,200,255,0.22)'],
      [0.78, 5, 'rgba(190,225,255,0.55)'],
      [0.7, 1, 'rgba(140,200,255,0.2)'],
      [0.5, 10, 'rgba(210,240,255,0.85)'],
      [0.34, 2, 'rgba(140,200,255,0.3)'],
    ].forEach(([f, w, color]) => {
      ctx.beginPath();
      ctx.arc(0, 0, maxR * f, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    });

    // radial dial ticks
    const tickCount = 96;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const long = i % 8 === 0;
      const inner = maxR * (long ? 0.55 : 0.62);
      const outer = maxR * (long ? 0.68 : 0.665);
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(inner, 0);
      ctx.lineTo(outer, 0);
      ctx.strokeStyle = long ? 'rgba(220,245,255,0.8)' : 'rgba(150,205,255,0.4)';
      ctx.lineWidth = long ? 2.5 : 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // scattered circuit-block detail in the outer band
    for (let i = 0; i < 140; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = maxR * (0.8 + Math.random() * 0.17);
      const w = 4 + Math.random() * 18;
      const h = 2 + Math.random() * 4;
      ctx.save();
      ctx.translate(Math.cos(angle) * r, Math.sin(angle) * r);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = `rgba(170,220,255,${0.15 + Math.random() * 0.35})`;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }

    // soft bright core fading outward
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.55);
    glow.addColorStop(0, 'rgba(200,235,255,0.5)');
    glow.addColorStop(0.6, 'rgba(120,190,255,0.12)');
    glow.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, maxR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const haloTexture = buildHaloTexture();
  const haloOuterRadius = CYL_RADIUS * 2.7;
  [-1, 1].forEach((sign) => {
    const discGeo = new THREE.CircleGeometry(haloOuterRadius, 96);
    const discMat = new THREE.MeshBasicMaterial({
      map: haloTexture, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = sign * (CYL_HEIGHT / 2);
    cylinderGroup.add(disc);
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

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    renderNow();
  }
  window.addEventListener('resize', onResize);

  if (prefersReducedMotion) {
    cylinderGroup.rotation.y = 0.6;
    renderNow();
    console.log('[PDA] Reduced motion is on — cylinder is static.');
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
    plates.forEach((p) => {
      p.classList.add('in-view');
      p.classList.add('in-front');
    });
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          // Wait until the plate is already visible and partway through its
          // move before switching it in front of the cylinder — otherwise
          // the "behind" moment happens while it's still invisible.
          setTimeout(() => entry.target.classList.add('in-front'), 420);
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
