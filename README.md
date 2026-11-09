# paul-david.dev — portfolio

Interactive 3D portfolio of **Paul-David Ephraïm Kinimo**, full-stack & AI systems developer.
Built as a pure static site (HTML + CSS + JS + Three.js via CDN) — ready for **GitHub Pages**.

## Preview locally

```bash
cd D:/Coding/portfolio
python -m http.server 8080
# open http://localhost:8080
```

## Deploy to GitHub Pages (user site → `https://davesoul.github.io/`)

```bash
cd D:/Coding/portfolio
git init
git add .
git commit -m "Portfolio: interactive 3D edition"
git branch -M main
git remote add origin https://github.com/Davesoul/Davesoul.github.io.git
git push -u origin main
```

Then create the repo **Davesoul.github.io** on GitHub first (if it doesn't exist),
push, and the site goes live at `https://davesoul.github.io/` within a minute.
No build step, no config — static files are served as-is.

Alternative: push to any repo (e.g. `portfolio`) and enable
**Settings → Pages → Deploy from branch → main → /(root)**.

## Structure

```
index.html          content + sections
styles.css          ember/void design system
main.js             reveal, typing, tilt, counters, live GitHub grid
hero.js             Three.js hero scene (particles, core, rings)
assets/             portrait, komaverse + flutter-showcase screenshots
```

## Notes

- The **GitHub section** fetches `api.github.com/users/Davesoul/repos` live and
  falls back to a cached list if the API is unreachable or rate-limited.
- The hero needs internet for the Three.js CDN + Google Fonts; everything else
  (including images) is local.
