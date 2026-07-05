# PDA — site

A single-page, dark-themed site for PDA: fixed nav, a detailed WebGL
holographic cylinder that stays on screen for the entire scroll, and content
plates — About Me, Current Projects (Vuil, Sens, Orbiteer), Contact — that
are genuinely glued to the cylinder and rotate with it as you scroll, on
screens with the room and motion budget for it. A separate, plain Policies
page holds the Orbiteer privacy policy.

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
WebGL not being supported, the carousel mount failing, etc. — send me that
message and I can pin it down. If you have "reduce motion" on at the OS
level, or you're on a narrow screen, the cylinder will still appear, it
just won't spin and plates won't be mounted to it — that's intentional
(see "On wide screens..." below).

## Notes on how it's built

- The cylinder is rendered with Three.js (loaded via CDN through an import
  map in `index.html`, pinned to `three@0.185.1` — no install needed). The
  same import map also maps `three/addons/` to Three's postprocessing and
  renderer examples, used below — still no build step.
- The hull itself is a single custom shader (not a solid material): a
  fresnel rim-glow and a hex-cell pattern are computed per-pixel, so it
  reads as a projected, semi-transparent membrane rather than solid glass.
  The hex cells tile edge-to-edge with no gaps — each one gets a slightly
  different shade from a per-cell hash, and a smoothstep border between
  cells — plus bright cap rings top and bottom, each with a flat,
  circuit-etched "halo" disc (concentric bands, radial dial ticks, and
  scattered detail, all drawn once onto a canvas texture rather than real
  geometry), and a couple hundred drifting ambient particles.
- A selective bloom post-processing pass (`EffectComposer` +
  `UnrealBloomPass`) adds real glow on top of the bright elements. The final
  composite shader explicitly carries over the base render's alpha channel,
  so the canvas stays transparent wherever it always was — bloom adds glow,
  it doesn't opacify the page background or hide the plates behind it.
- **On wide screens (900px+) with full motion and WebGL**, the About, Vuil,
  Sens, Orbiteer, and Contact plates are lifted out of normal page flow and
  mounted directly onto the cylinder as real 3D objects (via Three.js's
  `CSS3DRenderer`) — genuinely glued to it, not faked with CSS. They're
  arranged like a carousel: About at one position, Vuil/Sens/Orbiteer
  clustered tightly at another (so they swing into view together), Contact
  at a third. Scrolling drives the cylinder's rotation directly, so each
  plate lands exactly face-on right as you reach its section, fading in and
  out based on how far it's currently rotated from facing you. The hull
  shader reads that same fade and locally clears the hex pattern behind
  whichever plate is currently showing, so its text never has to compete
  with the texture behind it.
- **Everywhere else** (phones/tablets under 900px, reduced motion on, or no
  WebGL), it falls back to the flat version: plates fade in from behind the
  cylinder via `IntersectionObserver`. This is deliberate — mounting real
  DOM content in 3D space is the kind of thing that's easy to get subtly
  wrong on small screens without live testing, so it only runs where there's
  the most room and least risk.
- **Tuning knobs**, near the top of `trySetupCarousel()` in `js/main.js`:
  - `SCALE` (0.0042) — how large the mounted panels appear. Still the most
    likely thing to need a nudge since I can't preview the actual render.
  - `MOUNT_RADIUS` (2.2) — how far from the cylinder's axis the panels sit.
  - `PANEL_WIDTH` (300) / `CLUSTER_PANEL_WIDTH` (210, in px) — authored
    widths for the solo plates (About/Contact) vs. the three project cards,
    before the 3D scale is applied.
  - `CLUSTER_SPREAD` (0.55 radians) — the angle between adjacent project
    cards. If Vuil/Sens/Orbiteer are still crowding each other, raise this;
    if they look too spread out to read as one group, lower it.
  - `uClearWidth` (0.45 radians), near the top of the hull's fragment shader
    in `initCylinderBackdrop()` — how wide a hex-clearing spreads around
    each mounted plate's angle.
- If a visitor has WebGL disabled, the whole 3D layer (mounted or not) is
  skipped and a static dark gradient shows instead.
- Text itself stays regular DOM, not embedded in the 3D scene (even when
  mounted — CSS3DObject positions real HTML in 3D space, it doesn't
  rasterize it), so it's crisp, accessible, and indexable.
- Colors, fonts, spacing, and the z-index scale are all CSS custom
  properties at the top of `css/style.css` under `:root` if you want to
  tune anything.

