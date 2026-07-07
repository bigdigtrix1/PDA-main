# PDA — site

A single-page, dark-themed site for PDA: fixed nav, a detailed WebGL
holographic cylinder that stays on screen for the entire scroll, and content
plates — About Me, Current Projects (Vuil, Sens, Orbiteer), Contact — that
are genuinely glued to the cylinder and rotate with it as you scroll, on
screens with the room and motion budget for it. Two plain, separate pages
hold longer-form content: `policies.html` (the Orbiteer privacy policy) and
`gameinfo.html` (a technical deep-dive on Orbiteer) — see "Adding another
long-form page" below for how to add a third.

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

- [x] ~~Contact details~~ — real email and GitHub are in.
- [ ] **About Me** (`index.html`, `#about`) — first-draft bio, written from
      what's in this conversation. Read it over and make it sound like you;
      the italic note under it is a reminder to remove once you're happy
      with it (currently emptied out — add your own line back in, or leave
      it blank if the bio doesn't need a caveat anymore).
- [ ] **Policies** (`policies.html`) — one placeholder left:
      `[DATE YOU PUBLISH THIS]`, highlighted in blue near the top. The
      contact email is already filled in.
- [ ] **Game Info** (`gameinfo.html`) — the "Last updated" date is a real
      date already (7/7-2026); double check it's still accurate whenever
      you update this page.
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
  - `PANEL_WIDTH` (340) / `CLUSTER_PANEL_WIDTH` (240, in px) — authored
    widths for the solo plates (About/Contact) vs. the three project cards,
    before the 3D scale is applied.
  - `CLUSTER_SPREAD` (0.6 radians) — the angle between adjacent project
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

## Adding another long-form page

`policies.html` and `gameinfo.html` both use the same reusable set of
classes (`css/style.css`, under "Long-form document pages") — plain,
readable typography with no cylinder/3D involved, for whenever there's more
to say than fits on a plate. To add a third:

1. Copy `gameinfo.html` (or `policies.html`) as your starting point.
2. Keep the `<head>` and nav/footer as they are; just add your new page to
   the nav list in **every** HTML file (`index.html`, `policies.html`,
   `gameinfo.html`, and the new page itself, marked `class="active"` there).
3. Inside `<main class="doc-main">`, structure content as:
   - `doc-title` / `doc-updated` / `doc-intro` once, near the top
   - one `<section class="doc-section">` per topic, each with a
     `doc-h2` (and an optional `doc-h3` for a sub-heading within it)
   - body copy in `doc-body` (paragraphs), `doc-list` (bullets),
     `doc-kv-list` (label/value rows — specs, versions), or `doc-pre`
     (file trees, anything whitespace-sensitive) — whichever fits
4. That's it — no new CSS needed unless the content needs a shape none of
   the above cover, in which case add it next to the others under "Long-form
   document pages" rather than inventing a page-specific class.

