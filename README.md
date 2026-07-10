# PDA — Portfolio

Static portfolio site for PDA with a holographic hexagon backdrop in a cyan & steel theme. No build step — plain HTML, CSS, and vanilla JS.

## Pages

- `index.html` — About Me, Current Projects, Contact (floating holo info cards)
- `techdocs.html` — technical documentation (Orbiteer and The Watchtower deep-dives)
- `policies.html` — Orbiteer privacy policy

## Deploying to GitHub Pages

1. Create a new GitHub repository (e.g. `pda-site`), or use `<username>.github.io` for a user site.
2. Push the contents of this folder to the repository root:

   ```
   git init
   git add .
   git commit -m "Portfolio site"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```

3. In the repository: **Settings → Pages → Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, and save.
4. The site goes live at `https://<username>.github.io/<repo>/` after a minute or two.

All asset paths are relative, so it works both at a domain root and in a repository subpath. The `.nojekyll` file tells GitHub Pages to serve the files as-is.
