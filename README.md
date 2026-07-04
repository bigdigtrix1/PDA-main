# PDA — site

A single-page site for PDA: fixed nav, a full-3D WebGL steel cylinder backdrop
that rotates as you scroll, and content plates for About Me, Current Projects
(Vuil, Sens, Orbiteer), and Contact.

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

## If the cylinder doesn't show up

Most likely cause: your OS has "reduce motion" turned on (Settings →
Accessibility on Windows/macOS/most phones). The site now still renders a
static cylinder in that case instead of hiding it — if you were seeing a
plain page before, this update should fix it.

If it's still not showing, open your browser's DevTools (F12) → Console tab
and reload. Every failure path now logs a `[PDA]`-prefixed message there,
which will say exactly what happened (three.js failed to load, WebGL isn't
supported, etc.) — send me that message and I can pin it down.

## Notes on how it's built

- The cylinder is rendered with Three.js (loaded via CDN through an import
  map in `index.html`, pinned to `three@0.185.1` — no install needed).
- Rotation = a slow constant ambient spin + an offset driven by scroll
  position, so it's always gently alive and also responds to scrolling.
- If a visitor has WebGL disabled or "reduce motion" turned on at the OS
  level, the 3D layer is skipped entirely and a static gradient is shown
  instead — no broken canvas, no motion forced on people who've asked for less.
- Content plates (About, Vuil, Sens, Orbiteer, Contact) fade/tilt into place
  via `IntersectionObserver` as they scroll into view, echoing the cylinder's
  3D language without needing the text itself to live inside the 3D scene —
  keeps it crisp, accessible, and indexable.
- Colors, fonts, and spacing are all CSS custom properties at the top of
  `css/style.css` under `:root` if you want to tune the palette.
