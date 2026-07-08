/* ==========================================================================
   PDA — site behavior
   Sections: 1) helpers  2) WebGL cylinder + true-3D carousel mount
   3) carousel mount setup  4) 2D plate reveal (fallback)  5) nav behavior
   6) init
   ========================================================================== */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.innerWidth < 900;
const useTrueMount = !prefersReducedMotion && !isSmallScreen;

/* ==========================================================================
   0. Hologram themes — swapped live from the footer switcher. Each one
   changes color, the hull's surface pattern, and how the ambient spin and
   dust feel, so they read as genuinely different moods rather than just a
   palette swap.
   ========================================================================== */

const HOLOGRAM_THEMES = [
  {
    id: 'cyan',
    name: 'Cyan',
    color: 0x2f8ce6,
    colorBright: 0xbfe6ff,
    accent: 0x7cc4ff,
    haloRgb: [140, 200, 255],
    pattern: 0, // hexagon lattice
    patternScale: [40, 24],
    style: 1, // faceted chrome — bold per-cell shading, lightly tinted
    spinSpeed: 1,
    particleSpeed: 1,
    bloomMultiplier: 1,
    pulseAmount: 0,
  },
  {
    id: 'amber',
    name: 'Amber',
    color: 0xcc6a2f,
    colorBright: 0xffd9a0,
    accent: 0xffa64d,
    haloRgb: [255, 180, 110],
    pattern: 1, // square grid — a blueprint/schematic feel
    patternScale: [30, 18],
    style: 0, // translucent hologram membrane
    spinSpeed: 1.6,
    particleSpeed: 1.4,
    bloomMultiplier: 1.15,
    pulseAmount: 0,
  },
  {
    id: 'violet',
    name: 'Violet',
    color: 0x8b3fe6,
    colorBright: 0xe6c2ff,
    accent: 0xc48bff,
    haloRgb: [200, 150, 255],
    pattern: 2, // diamond lattice — a faceted crystal feel
    patternScale: [34, 20],
    style: 0, // translucent hologram membrane
    spinSpeed: 0.55,
    particleSpeed: 0.65,
    bloomMultiplier: 1.08,
    pulseAmount: 0.14, // slow breathing glow, unique to this theme
  },
];

function getInitialTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem('pda-theme');
  } catch (e) {
    // localStorage unavailable (private browsing, etc.) — fall through to default
  }
  return HOLOGRAM_THEMES.find((t) => t.id === stored) || HOLOGRAM_THEMES[0];
}

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
   1. WebGL cylinder backdrop, with an optional true-3D carousel of plates
      mounted onto it (wide screens, full motion, WebGL available only)
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
      initPlateReveal();
      return;
    }
  }
  console.log('[PDA] three.js loaded — building the holographic cylinder scene.');

  const isSmall = isSmallScreen;
  const radialSegments = isSmall ? 40 : 72;

  const CYL_RADIUS = 1.7;
  const CYL_HEIGHT = 6.4;

  const startTime = performance.now();
  let currentTheme = getInitialTheme();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0d11, 13, 30);

  const camera = new THREE.PerspectiveCamera(
    46,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0.5, 7.4);
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
  const baseBloomStrength = isSmall ? 0.28 : 0.4;
  const bloomPass = new UnrealBloomPass(bloomRes, baseBloomStrength * currentTheme.bloomMultiplier, 0.4, 0.72);

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
    uColor: { value: new THREE.Color(currentTheme.color) },
    uColorBright: { value: new THREE.Color(currentTheme.colorBright) },
    // Up to 5 "clear zones" (About, 3 project cards, Contact) where the hex
    // pattern fades so a mounted panel reads clearly. Angles are in the
    // hull's own local space (see vAngle below), so a clearing stays
    // correctly lined up with its panel no matter how the group is
    // currently rotated — both rotate together, being in the same group.
    // Populated for real once (if) the carousel mount succeeds; amounts
    // start at 0, so with nothing mounted the hull just shows no clearing.
    uClearAngles: { value: [0, 0, 0, 0, 0] },
    uClearAmounts: { value: [0, 0, 0, 0, 0] },
    uClearWidth: { value: 0.45 },
    // which theme's surface pattern to draw (0 hex / 1 grid / 2 diamond)
    // and how densely it tiles — both swapped live by applyTheme()
    uPatternType: { value: currentTheme.pattern },
    uPatternScale: { value: new THREE.Vector2(...currentTheme.patternScale) },
    // how the pattern gets composited into a final color (0 translucent
    // hologram membrane / 1 bold faceted chrome) — see main() below
    uStyleType: { value: currentTheme.style },
    // a slow 0-1 breathing wave, only given visible weight by themes whose
    // uPulseAmount is nonzero (see HOLOGRAM_THEMES) — 0 for the rest, so
    // this is inert unless a theme specifically asks for it
    uPulse: { value: 0 },
    uPulseAmount: { value: currentTheme.pulseAmount },
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
      varying vec2 vDir;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        // local-space direction around the hull's own axis, interpolated as
        // a vector (not pre-computed as an angle) — atan() has a branch cut
        // at +/-PI, so any varying computed as atan() in the vertex shader
        // gets linearly interpolated straight across that cut on whichever
        // triangle happens to straddle it, producing garbage in between.
        // Interpolating the raw direction and taking atan() per-fragment
        // instead avoids that entirely, since (x,z) has no such cut.
        vDir = position.xz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uColorBright;
      uniform float uClearAngles[5];
      uniform float uClearAmounts[5];
      uniform float uClearWidth;
      uniform float uPatternType;
      uniform vec2 uPatternScale;
      uniform float uStyleType;
      uniform float uPulse;
      uniform float uPulseAmount;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vDir;

      // Robust 2D->1D hash (Dave Hoskins' "hash without sine" family) — the
      // classic fract(sin(dot(...))*big number) hash needs sin() of a
      // large radian argument, which requires reducing that angle mod 2*PI
      // internally; any tiny imprecision in the input gets hugely amplified
      // by that reduction, so cells rendered this way came out visibly
      // grainy/speckled instead of a clean solid shade. This version only
      // ever multiplies and fracts small, bounded numbers, so it stays
      // stable regardless of GPU float precision.
      float cellHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

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
        return vec2(edge, cellHash(id));
      }

      // square-cell equivalent of hexInfo above — same 0..0.5 edge range and
      // per-cell hash, just a plain grid instead of a honeycomb
      vec2 gridInfo(vec2 p) {
        vec2 id = floor(p);
        vec2 gv = fract(p) - 0.5;
        float edge = max(abs(gv.x), abs(gv.y));
        return vec2(edge, cellHash(id));
      }

      // picks the current theme's surface pattern — a uniform-driven branch
      // like this costs nothing extra, since every fragment in the draw
      // takes the same path (the condition never varies per-pixel)
      vec2 patternInfo(vec2 p) {
        if (uPatternType < 0.5) {
          return hexInfo(p);
        } else if (uPatternType < 1.5) {
          return gridInfo(p);
        } else {
          vec2 pr = vec2(p.x - p.y, p.x + p.y) * 0.7071068;
          return gridInfo(pr);
        }
      }

      float angleDiff(float a, float b) {
        float d = mod(a - b + 3.14159265, 6.28318531) - 3.14159265;
        return abs(d);
      }

      void main() {
        vec3 normal = normalize(vNormal);
        if (!gl_FrontFacing) normal = -normal;
        float fresnel = pow(1.0 - clamp(dot(normal, normalize(vViewDir)), 0.0, 1.0), 4.0);

        vec2 hex = patternInfo(vec2(vUv.x * uPatternScale.x, vUv.y * uPatternScale.y));
        float hexBorder = smoothstep(0.44, 0.5, hex.x);
        float panelShade = (hex.y - 0.5) * 0.1;

        // fade the hologram surface where a mounted panel currently sits,
        // so its content reads clearly instead of competing with the hex
        float vAngle = atan(vDir.x, vDir.y);
        float clear = 0.0;
        for (int i = 0; i < 5; i++) {
          float d = angleDiff(vAngle, uClearAngles[i]);
          clear = max(clear, smoothstep(uClearWidth, 0.0, d) * uClearAmounts[i]);
        }

        vec3 color;
        float alpha;

        if (uStyleType > 0.5) {
          // faceted chrome: flat, clean per-cell color driven only by that
          // cell's own hash — no fresnel gradient layered on top. Fresnel
          // varies smoothly across the curved surface, not aligned to the
          // hex cell edges at all, so mixing it in here read as a second
          // pattern superimposed on the first. This is the debug view's
          // vec3(hex.y) look, just mapped into the theme's own color range
          // instead of straight grayscale.
          color = mix(uColor, uColorBright, hex.y * 0.6);
          alpha = clamp(0.18 + hex.y * 0.35 + hexBorder * 0.08, 0.0, 1.0);
        } else {
          alpha = clamp(0.1 + panelShade + fresnel * 0.3 + hexBorder * 0.1, 0.0, 1.0);
          color = mix(uColor, uColorBright, clamp(fresnel * 0.9, 0.0, 1.0));
        }

        alpha *= 1.0 + (uPulse - 0.5) * uPulseAmount;
        alpha *= mix(1.0, 0.18, clear);
        alpha = clamp(alpha, 0.0, 1.0);
        color *= 1.0 + (uPulse - 0.5) * uPulseAmount * 0.6;

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  cylinderGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

  // bright cap rings, top and bottom — the crisp inner edge of each halo
  const capRings = [-1, 1].map((sign) => {
    const ringGeo = new THREE.TorusGeometry(CYL_RADIUS + 0.02, 0.035, 10, radialSegments);
    const ringMat = new THREE.MeshBasicMaterial({ color: currentTheme.accent, opacity: 1 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sign * (CYL_HEIGHT / 2);
    cylinderGroup.add(ring);
    return ring;
  });

  // -- top/bottom halo discs: flat, circuit-etched rings of light the hull
  // projects from/into — drawn once onto a canvas texture, since that detail
  // would be far too expensive as real geometry. Colors come from the
  // theme's [r,g,b] base tone, with two lightened variants derived from it
  // for the brighter bands/ticks, so a theme switch only needs one number.
  function lighten(rgb, t) {
    return rgb.map((v) => Math.round(v + (255 - v) * t));
  }

  function buildHaloTexture(baseRgb) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const maxR = size / 2;
    ctx.translate(maxR, maxR);

    const dim = baseRgb;
    const mid = lighten(baseRgb, 0.32);
    const hot = lighten(baseRgb, 0.65);
    const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

    // concentric circuit bands
    [
      [0.98, 2, rgba(dim, 0.35)],
      [0.9, 1, rgba(dim, 0.22)],
      [0.78, 5, rgba(mid, 0.55)],
      [0.7, 1, rgba(dim, 0.2)],
      [0.5, 10, rgba(hot, 0.85)],
      [0.34, 2, rgba(dim, 0.3)],
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
      ctx.strokeStyle = long ? rgba(hot, 0.8) : rgba(mid, 0.4);
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
      ctx.fillStyle = rgba(mid, 0.15 + Math.random() * 0.35);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }

    // soft bright core fading outward
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.55);
    glow.addColorStop(0, rgba(hot, 0.5));
    glow.addColorStop(0.6, rgba(dim, 0.12));
    glow.addColorStop(1, rgba(dim, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, maxR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  let haloTexture = buildHaloTexture(currentTheme.haloRgb);
  const haloOuterRadius = CYL_RADIUS * 2.7;
  const haloDiscs = [-1, 1].map((sign) => {
    const discGeo = new THREE.CircleGeometry(haloOuterRadius, 96);
    const discMat = new THREE.MeshBasicMaterial({
      map: haloTexture, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = sign * (CYL_HEIGHT / 2);
    cylinderGroup.add(disc);
    return disc;
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
    color: currentTheme.accent,
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // -- theme switching, driven by the swatches in the footer --
  function applyTheme(themeId) {
    const theme = HOLOGRAM_THEMES.find((t) => t.id === themeId);
    if (!theme) return;
    currentTheme = theme;

    hullUniforms.uColor.value.set(theme.color);
    hullUniforms.uColorBright.value.set(theme.colorBright);
    hullUniforms.uPatternType.value = theme.pattern;
    hullUniforms.uPatternScale.value.set(theme.patternScale[0], theme.patternScale[1]);
    hullUniforms.uStyleType.value = theme.style;
    hullUniforms.uPulseAmount.value = theme.pulseAmount;

    capRings.forEach((ring) => ring.material.color.set(theme.accent));
    particleMat.color.set(theme.accent);
    bloomPass.strength = baseBloomStrength * theme.bloomMultiplier;

    const oldHaloTexture = haloTexture;
    haloTexture = buildHaloTexture(theme.haloRgb);
    haloDiscs.forEach((disc) => {
      disc.material.map = haloTexture;
      disc.material.needsUpdate = true;
    });
    oldHaloTexture.dispose();

    document.querySelectorAll('.theme-swatch').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.theme === themeId));
    });
    try {
      localStorage.setItem('pda-theme', themeId);
    } catch (e) {
      // localStorage unavailable — theme just won't persist, harmless
    }

    renderNow();
  }

  document.querySelectorAll('.theme-swatch').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.theme === currentTheme.id));
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });

  /* ------------------------------------------------------------------
     True-3D carousel mount: adopts the real About/Vuil/Sens/Orbiteer/
     Contact plates as CSS3DObjects, glued to the cylinder group so they
     rotate with it. Only attempted on wide screens with full motion.
     ------------------------------------------------------------------ */

  let mounted = false;
  let cssRenderer = null;
  let mountedObjects = [];

  if (useTrueMount) {
    const result = await trySetupCarousel(THREE, cylinderGroup);
    if (result) {
      mounted = true;
      cssRenderer = result.cssRenderer;
      mountedObjects = result.mountedObjects;

      // Sync the hull's clear-zone angles to each panel's real mount
      // angle, whatever it ended up being — read back rather than
      // recomputed, so the two can never drift out of alignment.
      const angles = mountedObjects.map((m) => m.angle);
      while (angles.length < 5) angles.push(0);
      hullUniforms.uClearAngles.value = angles;

      document.body.classList.add('true-mount');
      console.log('[PDA] Carousel mount active —', mountedObjects.length, 'plates glued to the cylinder.');
    }
  }

  if (!mounted) {
    initPlateReveal();
    if (useTrueMount) {
      // Mount was attempted (useTrueMount was true) but failed — initNav
      // skipped the plain intersection-based nav highlighting up front on
      // the assumption mounting would succeed, so turn it on now as part
      // of the same fallback.
      initSectionNavHighlight();
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    if (mounted && cssRenderer) {
      cssRenderer.setSize(window.innerWidth, window.innerHeight);
    }
    renderNow();
  }
  window.addEventListener('resize', onResize);

  if (prefersReducedMotion) {
    cylinderGroup.rotation.y = 0.6;
    renderNow();
    console.log('[PDA] Reduced motion is on — cylinder is static.');
    return;
  }

  if (mounted) {
    runMountedLoop();
  } else {
    runAmbientLoop();
  }

  // -- fallback motion: ambient spin + loose scroll offset, cylinder not mounted --
  function runAmbientLoop() {
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
      ambientAngle += 0.0016 * currentTheme.spinSpeed;
      cylinderGroup.rotation.y = ambientAngle + scrollAngle;
      particles.rotation.y += 0.00035 * currentTheme.particleSpeed;
      const elapsed = (performance.now() - startTime) / 1000;
      hullUniforms.uPulse.value = 0.5 + 0.5 * Math.sin(elapsed * 1.2);
      renderNow();
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
      else if (!raf) { tick(); }
    });
    tick();
  }

  // -- mounted motion: rotation is a precise function of scroll position,
  // so each plate is exactly front-on right as its section is reached --
  function runMountedLoop() {
    function getStops() {
      const ids = ['about', 'projects', 'contact'];
      // Bringing an object mounted at angle θ to face the camera requires
      // rotating the group by -θ (verified against the position/rotation
      // math below) — so these targets are the negative of each object's
      // mount angle, not the angle itself.
      const angles = [0, -(2 * Math.PI) / 3, -(4 * Math.PI) / 3];
      const heroEl = document.getElementById('hero');
      const heroHeight = heroEl ? heroEl.offsetHeight : 0;
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      // A modest hold angle, just for a smooth handoff into the first
      // interpolation — actual hero visibility is forced separately below,
      // since with three stops 120° apart there's no single angle where
      // all three would be hidden by the cosine falloff alone.
      const stops = [{ y: Math.min(heroHeight, maxScrollY), angle: Math.PI / 6 }];
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) {
          const rawY = el.offsetTop + el.offsetHeight / 2;
          stops.push({ y: Math.min(rawY, maxScrollY), angle: angles[i] });
        }
      });
      return stops;
    }

    let stops = getStops();
    window.addEventListener('resize', () => { stops = getStops(); });

    // Clicking a nav link would otherwise land at the section's top (the
    // browser's default hash-jump target), which is generally NOT the
    // scroll position a stop above is defined at (the section's midpoint)
    // — so the rotation wouldn't actually have reached that plate yet.
    // Intercept these clicks and scroll to the exact stop position instead.
    document.querySelectorAll('.nav-links a[data-nav]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('data-nav');
        const el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        window.scrollTo({ top: el.offsetTop + el.offsetHeight / 2, behavior: 'smooth' });
      });
    });

    function updateActiveNav(sectionId) {
      document.querySelectorAll('.nav-links a[data-nav]').forEach((a) => {
        a.classList.toggle('active', sectionId != null && a.getAttribute('data-nav') === sectionId);
      });
    }

    function targetAngle() {
      const y = window.scrollY;
      if (y <= stops[0].y) return stops[0].angle;
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i], b = stops[i + 1];
        if (y >= a.y && y <= b.y) {
          const t = (y - a.y) / (b.y - a.y || 1);
          return a.angle + t * (b.angle - a.angle);
        }
      }
      return stops[stops.length - 1].angle;
    }

    let currentAngle = stops[0].angle;
    let raf = null;

    function updateMountedOpacity(groupAngle, forceHidden) {
      let bestSection = null;
      // Matches the pointer-events threshold below — nothing dim enough to
      // be non-interactive should be able to claim the nav highlight.
      let bestOpacity = 0.15;
      mountedObjects.forEach((m, i) => {
        let opacity;
        if (forceHidden) {
          opacity = 0;
        } else {
          let effective = (m.angle + groupAngle) % (Math.PI * 2);
          if (effective > Math.PI) effective -= Math.PI * 2;
          if (effective < -Math.PI) effective += Math.PI * 2;
          opacity = Math.max(0, Math.cos(effective));
        }
        m.el.style.opacity = String(opacity);
        m.el.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none';
        // drives the hull's matching clear zone — the hologram fades in
        // behind a panel exactly as it fades into view, and back again
        hullUniforms.uClearAmounts.value[i] = opacity;
        if (opacity > bestOpacity) {
          bestOpacity = opacity;
          bestSection = m.sectionId;
        }
      });
      updateActiveNav(bestSection);
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      const target = targetAngle();
      currentAngle += (target - currentAngle) * 0.12;
      cylinderGroup.rotation.y = currentAngle;
      particles.rotation.y += 0.00035 * currentTheme.particleSpeed;
      const elapsed = (performance.now() - startTime) / 1000;
      hullUniforms.uPulse.value = 0.5 + 0.5 * Math.sin(elapsed * 1.2);
      updateMountedOpacity(currentAngle, window.scrollY <= stops[0].y);
      renderNow();
      cssRenderer.render(scene, camera);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
      else if (!raf) { tick(); }
    });

    tick();
  }
}

/* ------------------------------------------------------------------
   Sets up the CSS3D carousel. Returns {cssRenderer, mountedObjects} on
   success, or null if anything about it fails, so the caller can fall
   back cleanly.
   ------------------------------------------------------------------ */

async function trySetupCarousel(THREE, cylinderGroup) {
  try {
    const { CSS3DRenderer, CSS3DObject } = await import('three/addons/renderers/CSS3DRenderer.js');

    const container = document.getElementById('css3d-container');
    if (!container) return null;

    const cssRenderer = new CSS3DRenderer({ element: container });
    cssRenderer.setSize(window.innerWidth, window.innerHeight);

    const PROJECTS_ANGLE = (2 * Math.PI) / 3;
    const CONTACT_ANGLE = (4 * Math.PI) / 3;
    const MOUNT_RADIUS = 2.2;
    const SCALE = 0.0042;
    const PANEL_WIDTH = 425;
    const CLUSTER_PANEL_WIDTH = 300;
    const CLUSTER_SPREAD = 0.6; // radians between adjacent project cards

    const targets = [
      { el: document.querySelector('#about .plate'), angle: 0, width: PANEL_WIDTH, sectionId: 'about' },
      { el: document.querySelector('#projects .project-plate:nth-child(1)'), angle: PROJECTS_ANGLE - CLUSTER_SPREAD, width: CLUSTER_PANEL_WIDTH, sectionId: 'projects' },
      { el: document.querySelector('#projects .project-plate:nth-child(2)'), angle: PROJECTS_ANGLE, width: CLUSTER_PANEL_WIDTH, sectionId: 'projects' },
      { el: document.querySelector('#projects .project-plate:nth-child(3)'), angle: PROJECTS_ANGLE + CLUSTER_SPREAD, width: CLUSTER_PANEL_WIDTH, sectionId: 'projects' },
      { el: document.querySelector('#contact .plate'), angle: CONTACT_ANGLE, width: PANEL_WIDTH, sectionId: 'contact' },
    ].filter((t) => t.el);

    if (!targets.length) return null;

    const mountedObjects = targets.map((t) => {
      const el = t.el;
      el.style.width = t.width + 'px';
      // CSS3DRenderer drives `transform` every frame — a CSS transition on
      // transform would fight it, so only opacity gets to transition here.
      el.style.transition = 'opacity 0.25s ease';
      el.style.opacity = '0';

      const obj = new CSS3DObject(el);
      obj.position.set(
        MOUNT_RADIUS * Math.sin(t.angle),
        0,
        MOUNT_RADIUS * Math.cos(t.angle)
      );
      obj.rotation.y = t.angle;
      obj.scale.set(SCALE, SCALE, SCALE);
      cylinderGroup.add(obj);

      return { el, angle: t.angle, sectionId: t.sectionId };
    });

    return { cssRenderer, mountedObjects };
  } catch (err) {
    console.error('[PDA] Carousel mount failed, falling back to the flat reveal —', err);
    return null;
  }
}

/* ==========================================================================
   2. Plate reveal on scroll (fallback for mobile / reduced motion / no WebGL)
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

  // When the true-mount carousel is active, "which section is showing" is
  // decided by rotation angle (see updateActiveNav in runMountedLoop), not
  // by how much of a section's (mostly emptied-out) DOM footprint happens
  // to intersect the viewport — the two can disagree, since content isn't
  // visually inside its section's box anymore once mounted. Only fall back
  // to the plain intersection-based highlighting when mounting either was
  // never attempted, or was attempted and failed (handled from
  // initCylinderBackdrop once that's known).
  if (!useTrueMount) {
    initSectionNavHighlight();
  }
}

/* ==========================================================================
   3b. Nav active-link highlighting from section visibility — used whenever
   the true-mount carousel isn't driving it instead (see initNav above)
   ========================================================================== */

function initSectionNavHighlight() {
  const sections = ['about', 'projects', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navAnchors = document.querySelectorAll('.nav-links a');

  if (!('IntersectionObserver' in window) || !sections.length) return;
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

/* ==========================================================================
   Init
   ========================================================================== */

initNav();

if (supportsWebGL()) {
  initCylinderBackdrop();
} else {
  document.body.classList.add('no-motion');
  console.warn('[PDA] WebGL is not available in this browser — showing the static gradient fallback.');
  initPlateReveal();
}
