# Paperclip — working instructions for Claude instances

This directory contains **Paperclip**, a clean-room reimplementation of the
incremental game *Universal Paperclips* with the numbers beautifully
visualized. It ships as a static page at `sarefo.github.io/paperclip/`,
like `/blood-types/`.

This project CLAUDE.md **overrides** the repo-root CLAUDE.md's
"homepage only" rule for work inside this directory.

## Start here

1. Read `PLAN.md` — vision, milestones, and the **status log** (which tells
   you what is done and what is next).
2. Read the doc for whatever you're touching:
   - `docs/architecture.md` — code layout, game loop, state, saves, numbers
   - `docs/mechanics.md` — game systems and formulas, all three phases
   - `docs/visualization.md` — chart inventory, layout, theming
   - `docs/content-guide.md` — writing voice, project naming, legal rules
3. Do the next unchecked task in the current milestone. Update the status
   log in `PLAN.md` when you finish a work session.

## Hard rules

- **Clean-room only.** Never copy code, project names, or flavor text from
  the original game. See `docs/content-guide.md` for what is and isn't fair
  game. Do not fetch or read the original's source code.
- **No dependencies.** Vanilla JS (ES modules), hand-rolled canvas charts.
  No build step — the page must run by opening `index.html` over any static
  server (it's a GitHub Pages repo).
- **Both themes + explicit toggle.** Light and dark, `data-theme` attribute,
  `prefers-color-scheme` default. Never dark-only.
- **Before building any chart or UI**, load the `dataviz` skill (for charts)
  and `frontend-design` skill (for aesthetic direction) if available in your
  session. The visual quality *is* the product here.
- LF line endings, American English, match existing code style.

## Verifying work

Serve the repo root (`py -m http.server` from the repo root, or any static
server) and open `/paperclip/`. The balance simulator (`sim/`, once built)
runs headless via `node sim/run.js` and is the tool for pacing questions —
don't tune constants by playing manually.
