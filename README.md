# PDA — site

A single-page, dark-themed site for PDA: fixed nav, a detailed WebGL
holographic cylinder that stays on screen for the entire scroll, and content
plates that start small and dim behind it, then grow, brighten, and pass in
front as you scroll — About Me, Current Projects (Vuil, Sens, Orbiteer),
Contact. A separate, plain Policies page holds the Orbiteer privacy policy.

Plain HTML/CSS/JS — no build step, no framework, no bundler.

## Deploy on GitHub Pages

1. Create a new repository (or use an existing one) and push these files to
   the root of the `main` branch:
   ```
   git init
   git add .
   git commit -m "PDA site"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source → Deploy from a branch → `main` / `/root`** → Save.
3. Wait a minute, then visit `https://<you>.github.io/<repo>/`.

No build step is needed — GitHub Pages serves the files as-is.

## Content still to fill in

- [ ] **Contact details** (`index.html`, `#contact`) — `you@example.com` and
      `github.com/yourusername` are placeholders. Replace both, and delete
      the "placeholder contact details" note once real ones are in.
- [ ] **About Me** (`index.html`, `#about`) — first-draft bio, written from
      what's in this conversation. Read it over and make it sound like you;
      the italic note under it is a reminder to remove once you're happy
      with it.
- [ ] **Policies** (`policies.html`) — the privacy policy text is real and
      complete, but it has two placeholders you supplied as brackets, now
      highlighted in blue on the page so they're easy to spot:
      `[DATE YOU PUBLISH THIS]` (appears once, at the top) and
      `[YOUR CONTACT EMAIL]` (appears three times). Find-and-replace both
      before this goes live — a privacy policy with a placeholder email
      isn't one regulators or app stores will accept.
- [x] ~~Orbiteer~~ — short blurb is in, matching Vuil and Sens.
- Optional: `assets/favicon.svg` is a simple placeholder mark — swap for a
  real logo if you have one.

## If the cylinder doesn't show up

Open your browser's DevTools (F12) → Console tab and reload. Every failure
path logs a `[PDA]`-prefixed message there — three.js failing to load,
WebGL not being supported, etc. — send me that message and I can pin it
down. If you have "reduce motion" on at the OS level, the cylinder will
still appear, it just won't spin — that's intentional.

## Notes on how it's built

- The cylinder is rendered with Three.js (loaded via CDN through an import
  map in `index.html`, pinned to `three@0.185.1` — no install needed). The
  same import map also maps `three/addons/` to Three's postprocessing
  examples, used for the bloom pass below — still no build step.
- The hull itself is a single custom shader (not a solid material): fresnel
  rim-glow, an animated scan-line sweep, an etched data-grid, and a subtle
  flicker are all computed per-pixel, so it reads as a projected, semi-
  transparent membrane rather than solid metal.
- Layered around that: ~24 thin glowing rings (each shimmering on its own
  phase offset) plus brighter divider rings at the About/Projects and
  Projects/Contact boundaries, bright cap rings top and bottom with
  instanced tick-mark gauges around each one, 10 flickering vertical data
  strips, a moving scan-sweep ring that travels the hull's height on a slow
  loop, two independently-tumbling "gyroscope" halo rings around the outside,
  a solid base platform (the one "real" object — the projector the hologram
  is emitted from) with a faint upward projection-beam cone, and a couple
  hundred drifting ambient particles.
- A selective bloom post-processing pass (`EffectComposer` +
  `UnrealBloomPass`) adds real glow on top of the bright elements. The final
  composite shader explicitly carries over the base render's alpha channel,
  so the canvas stays transparent wherever it always was — bloom adds glow,
  it doesn't opacify the page background or hide the plates behind it.
- Every several seconds the hull does a brief, subtle "signal instability"
  glitch — a quick flicker and positional jitter — then settles back down.
- Rotation = a slow constant ambient spin + an offset driven by scroll
  position, so it's always gently alive and also responds to scrolling.
  It stays visible for the whole page, not just the hero.
- If a visitor has WebGL disabled, the 3D layer is skipped and a static
  dark gradient is shown instead.
- Content plates (About, Vuil, Sens, Orbiteer, Contact) start small, dim,
  and behind the cylinder (lower `z-index`), then fade in quickly while
  still behind it, and only flip in front of it partway through their
  move — that stagger is what makes the "was behind, now in front" moment
  actually readable, rather than everything happening at once. The project
  cards specifically slide in from the middle (where the cylinder is) out
  to their grid position. Text itself stays regular DOM, not embedded in
  the 3D scene, so it's crisp, accessible, and indexable.
- Colors, fonts, spacing, and the z-index scale are all CSS custom
  properties at the top of `css/style.css` under `:root` if you want to
  tune anything.

