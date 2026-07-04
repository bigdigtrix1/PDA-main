# PDA — site

A single-page, dark-themed site for PDA: fixed nav, a detailed WebGL steel
cylinder that stays on screen for the entire scroll and doubles as
navigation (click its top/middle/bottom third to jump to About, Projects,
or Contact), with content plates that emerge from behind it as you scroll.

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

- [ ] **Orbiteer** (`index.html`, `#projects`) — currently a placeholder
      plate that just says "Details coming soon." Swap in the real
      description once you're ready to share it.
- [ ] **Contact details** (`index.html`, `#contact`) — `you@example.com` and
      `github.com/yourusername` are placeholders. Replace both, and delete
      the "placeholder contact details" note once real ones are in.
- [ ] **About Me** (`index.html`, `#about`) — first-draft bio, written from
      what's in this conversation. Read it over and make it sound like you;
      the italic note under it is a reminder to remove once you're happy
      with it.
- Optional: `assets/favicon.svg` is a simple placeholder mark — swap for a
  real logo if you have one.

## The cylinder as navigation

Move your mouse over the cylinder and it's split into three invisible
bands (top, middle, bottom) that light up faintly on hover and, on click,
scroll you to About / Projects / Contact respectively — same destinations
as the nav bar, just a second, more tactile way to get there. This is a
mouse/touch bonus on top of the real nav, not a replacement for it — it's
marked `aria-hidden` so screen readers correctly ignore it and rely on the
fully-accessible nav bar instead.

## If the cylinder doesn't show up

Open your browser's DevTools (F12) → Console tab and reload. Every failure
path logs a `[PDA]`-prefixed message there — three.js failing to load,
WebGL not being supported, etc. — send me that message and I can pin it
down. If you have "reduce motion" on at the OS level, the cylinder will
still appear and still be clickable, it just won't spin — that's intentional.

## Notes on how it's built

- The cylinder is rendered with Three.js (loaded via CDN through an import
  map in `index.html`, pinned to `three@0.185.1` — no install needed).
- It's built from a dark hull, ~18 thin glowing rings plus brighter rings
  marking the About/Projects and Projects/Contact boundaries, bright cap
  rings top and bottom, 8 vertical light strips, a glowing base platform,
  and a couple hundred drifting ambient particles.
- Rotation = a slow constant ambient spin + an offset driven by scroll
  position, so it's always gently alive and also responds to scrolling.
  It stays visible for the whole page, not just the hero.
- Click-to-navigate uses `THREE.Raycaster` against three invisible cylinder
  bands — no extra libraries.
- If a visitor has WebGL disabled, the 3D layer is skipped and a static
  dark gradient is shown instead.
- Content plates (About, Vuil, Sens, Orbiteer, Contact) start small, dim,
  and behind the cylinder (lower `z-index`), then scale up, brighten, and
  pass in front of it via `IntersectionObserver` as they scroll into view —
  the project cards specifically slide in from the middle (where the
  cylinder is) out to their grid position. Text itself stays regular DOM,
  not embedded in the 3D scene, so it's crisp, accessible, and indexable.
- Colors, fonts, spacing, and the z-index scale are all CSS custom
  properties at the top of `css/style.css` under `:root` if you want to
  tune anything.

