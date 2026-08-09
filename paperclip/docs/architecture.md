# Architecture

Vanilla ES modules, no build step, no dependencies. Everything below is a
spec for code that doesn't exist yet — adjust freely if reality disagrees,
but update this doc when you do.

## File layout

```
paperclip/
├── index.html            # single page, all three phases live here
├── css/
│   ├── tokens.css        # theme tokens (light + dark), spacing, type scale
│   └── main.css          # layout + components
├── js/
│   ├── main.js           # boot: load save, start loops, wire UI
│   ├── engine/
│   │   ├── loop.js       # logic tick (10 Hz, accumulator) + rAF render loop
│   │   ├── state.js      # initial state factory, phase constants
│   │   ├── save.js       # versioned localStorage save/load/migrate/export
│   │   ├── num.js        # formatter + endgame precision helpers
│   │   └── history.js    # ring buffers with decimation tiers
│   ├── systems/          # one file per game system, pure tick functions
│   │   ├── production.js # clip making: manual, clippers, factories, probes
│   │   ├── market.js     # wire price, demand, sales, marketing
│   │   ├── compute.js    # processors, memory, ops, creativity, quantum
│   │   ├── projects.js   # project framework (trigger/cost/effect runner)
│   │   ├── invest.js     # stock market engine
│   │   ├── tournament.js # strategy tournaments, yomi
│   │   ├── swarm.js      # phase 2: drones, power, gifts, disorganization
│   │   └── space.js      # phase 3: probes, drift, combat, exploration
│   ├── content/
│   │   ├── projects-p1.js  # project data, phase 1 (see content-guide)
│   │   ├── projects-p2.js
│   │   ├── projects-p3.js
│   │   └── messages.js     # narrative log lines keyed by event
│   ├── ui/
│   │   ├── dom.js        # bound-value spans, buttons, dirty-flag updates
│   │   ├── layout.js     # phase-dependent panel visibility/reflow
│   │   ├── log.js        # message log component
│   │   └── theme.js      # toggle + persistence + data-theme attribute
│   └── charts/
│       ├── chart.js      # base: canvas mgmt, DPR scaling, theme colors, axes
│       │                 # NOTE: implementer should load the `dataviz` skill
│       ├── sparkline.js  # ring-buffer line/area, the workhorse
│       ├── curve.js      # interactive price↔demand curve
│       ├── gauge.js      # bounded quantities (ops/memory, battery, matter)
│       ├── radar.js      # probe designer (phase 3)
│       ├── heatmap.js    # tournament payoff matrix
│       └── field.js      # phase 3 universe exploration canvas
└── sim/
    ├── run.js            # node harness: headless game at high speed
    └── bot.js            # scripted player strategy for balance runs
```

## Game loop

Two decoupled loops:

- **Logic**: fixed 10 Hz (`TICK_MS = 100`), driven by `setInterval` at ~50 ms
  with an accumulator — never trust interval timing. Each tick calls every
  active system in a fixed order: `production → market → compute → swarm →
  space → tournament → invest → projects(unlock check)`. Systems are
  `tick(state, dt)` functions mutating the single state object; keep them
  free of DOM access so the sim can run them in node.
- **Offline catch-up**: on load, compute elapsed time and run a *summarized*
  catch-up (analytic approximation, capped at a few hours) — do NOT loop
  millions of ticks. It's fine for offline gains to be conservative.
- **Render**: `requestAnimationFrame`. Reads state + history, never writes.
  DOM text updates via dirty-flags (only touch nodes whose value changed);
  charts redraw at most 10 Hz for fast series, 1 Hz for slow panels
  (skip entirely when `document.hidden`).

## State

One plain serializable object (`state`), created by `initialState()` in
`state.js`. No classes, no getters — it must survive
`JSON.parse(JSON.stringify(state))` unchanged. Derived values (e.g. clips/sec
display rate) are computed by systems into a non-saved `state.derived`
namespace each tick.

`state.phase` ∈ {1, 2, 3} gates which systems tick and which panels exist.
Phase transitions are one-way and are the two big scripted moments — treat
them as events, not just a flag flip.

## Numbers

Plain float64 everywhere. Rationale: precision loss above 2^53 only affects
counting exactness, and at that scale per-tick increments are ≫ 1 so the
error is imperceptible. Two places need care:

1. **Formatter** (`num.js`): 3 significant figures, short-scale names
   (million … septendecillion covers ~1e54), settings toggle for scientific
   notation. One function used *everywhere* — never `toLocaleString` ad hoc.
2. **Endgame countdown**: when remaining universe matter gets small, switch
   to tracking `remaining` (a small number, exact) rather than
   `total − produced` (catastrophic cancellation). The final clips must
   count down 10, 9, … 1 exactly.

## History recorder

`history.js` maintains ring buffers for any registered series:
`history.register('clipRate', () => state.derived.clipRate)`.
Four tiers per series — raw 10 Hz (600 samples ≈ 1 min), 1 s (600 ≈ 10 min),
10 s (720 ≈ 2 h), 1 min (600 ≈ 10 h) — each tier decimated from the one
below (mean, or last-value for prices). Fixed Float64Array buffers,
zero allocation per tick. History is **not saved**; charts restart on load
(acceptable — note it in the UI the first minute after load if it looks odd).

## Saves

- `localStorage` key `paperclip.save`, JSON: `{version, savedAt, state}`.
- Autosave every 30 s and on `visibilitychange`/`pagehide`.
- `save.js` owns migrations: an array of `(oldState) => newState` steppers
  keyed by version. Bump the version whenever state shape changes.
- Export/import as base64 JSON string via a settings dialog. Hard reset with
  confirm (it's a 3–5 h game — make reset hard to fat-finger).

## Simulator (`sim/`)

The balance tool. `node sim/run.js [--until phase2] [--speed 1000]` runs the
same system modules headless with `bot.js` making decisions (buy when
affordable, take projects by priority list, adjust price toward
revenue-max). Outputs a timeline of milestone timestamps ("phase 2 at
52 min") and can dump series as CSV for inspection. Every balance change
must cite sim timings in the commit message. This works only if systems
stay DOM-free — guard that boundary.

## Performance budget

- Logic tick < 5 ms at endgame scale (it's ~arithmetic on 100 scalars; if
  it's slow, something is wrong — likely allocation in the tick path).
- Render: 60 fps; each chart draws into its own canvas, redraws only when
  its data tier advanced or theme/size changed. Handle DPR for crisp lines.
- No allocations in the tick path (reuse buffers; no `.map()` chains).
