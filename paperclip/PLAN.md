# Paperclip — Implementation Plan

A clean-room reimplementation of *Universal Paperclips* (Frank Lantz, 2017)
where every number the game tracks is **visualized live** instead of printed
as bare text. The game is a pure-numbers simulation — ~100 scalars mutated on
a 10 Hz tick — which means everything is already a time series. The original
renders them as `<span>`s in a table; we render them as a living dashboard
that grows more elaborate (and more unsettling) as the AI grows.

## Vision

- **The charts are the UI, not decoration.** Price elasticity is *shown* as a
  demand curve you drag your price point along. The probe designer is a radar
  chart, not eight rows of +/− buttons. The endgame is a visibly draining
  universe.
- **Three acts, three visual identities** (see `docs/visualization.md`):
  1. *Business* — clinical, spreadsheet-with-taste, sparklines and tickers.
  2. *Dominion* — the dashboard turns planetary: power grids, swarm counts,
     Earth's matter as a depleting stock.
  3. *Space* — near-black cosmic canvas, exponential population curves,
     combat attrition, exploration fraction of the universe.
- **Same emotional arc as the original**: mundane → powerful → cosmic → empty.
  Original writing in our own voice (see `docs/content-guide.md`).
- Full playthrough target: **3–5 hours**, tuned via the headless simulator,
  not by feel.

## Legal stance

Game mechanics are not copyrightable; expression is. We reimplement the
*systems* from public knowledge of gameplay, with original code, original
project names, and original flavor text. Credit "inspired by Universal
Paperclips by Frank Lantz" in the footer and README. Never copy or consult
the original source code. Details in `docs/content-guide.md`.

## Non-goals

- No pixel-fidelity clone of the original's numbers. We re-derive and re-tune.
- No frameworks, no chart libraries, no build step, no server component.
- No monetization, no accounts, no analytics.
- No mobile-first design (must be *usable* on mobile, optimized for desktop).

## Milestones

Work top to bottom. Each milestone ends in a committed, playable (or runnable)
state. Check items off and append to the status log as you go.

### M0 — Engine skeleton
- [ ] File scaffold per `docs/architecture.md` (index.html, css/, js/, sim/)
- [ ] Game loop: 10 Hz logic tick with accumulator + offline catch-up,
      decoupled rAF render loop
- [ ] Central state object + systems registry (pure tick functions)
- [ ] Save/load: versioned JSON in localStorage, autosave, export/import
      string, hard reset
- [ ] Number formatter (names through the ~1e54 range, 3 sig figs,
      settings toggle for scientific notation)
- [ ] History recorder: ring buffers with decimation tiers (10 Hz / 1 s /
      10 s / 1 min) for any registered series
- [ ] Theme system: light + dark tokens, explicit toggle, persisted
- [ ] Headless sim harness: `node sim/run.js` runs the logic loop with a
      scripted bot, reports phase timings

### M1 — Phase 1 vertical slice (the proof)
- [ ] All phase-1 systems per `docs/mechanics.md` §Phase 1: manual clipping,
      wire market, pricing/demand, marketing, autoclippers/megaclippers,
      trust, processors/memory, ops, creativity
- [ ] Projects framework (data-driven: trigger/cost/effect) + the ~30
      phase-1 projects from `docs/mechanics.md`
- [ ] Quantum computing, stock market, strategy tournaments
- [ ] Full phase-1 visualization per `docs/visualization.md`: price↔demand
      curve, wire ticker, production/sales sparklines, ops/creativity gauges,
      tournament payoff heatmap, portfolio chart
- [ ] Message log with the phase-1 narrative beats
- [ ] Balance pass: sim completes phase 1 in 45–75 min of active play
- [ ] Both themes polished; page presentable enough to link publicly

### M2 — Phase 2: Dominion
- [ ] Phase transition (trust system retires; the dashboard "escapes" —
      visual redesign moment)
- [ ] Power grid (generation vs. draw), factories, harvester + wire drones,
      Earth matter depletion
- [ ] Swarm computing: gifts, disorganization/entertainment sliders
- [ ] Phase-2 projects (~25) and narrative beats
- [ ] Phase-2 viz: power grid diagram, matter flow Sankey-style strip,
      swarm status, Earth depletion gauge
- [ ] Balance pass: phase 2 in 30–60 min

### M3 — Phase 3: The Universe
- [ ] Probe designer (radar chart UI) with trust budget from honor/yomi
- [ ] Von Neumann dynamics: replication, drift, drifter combat, hazards,
      matter exploration
- [ ] Endgame sequence: the offer, refusal path, disassembly cascade,
      final countdown, ending screen
- [ ] Phase-3 projects (~25) and narrative beats
- [ ] Phase-3 viz: population curves (log scale), universe exploration
      field, combat feed, the final "one number remains" sequence
- [ ] Balance pass: full run 3–5 h; endgame precision handling verified

### M4 — Polish
- [ ] Performance: steady 60 fps render, <5 ms logic tick at endgame scale
- [ ] Accessibility: keyboard operable, ARIA on controls, chart data
      available as text (tooltip/table fallback), prefers-reduced-motion
- [ ] Mobile layout usable end to end
- [ ] Sound (optional, off by default, tiny synthesized cues)
- [ ] README + footer credit, link from anywhere the user wants
- [ ] Final full-run balance validation in the sim

## Status log

Append one line per work session: date — what changed — what's next.

| Date | Session summary | Next up |
|------|----------------|---------|
| 2026-08-09 | Project planned; docs written (PLAN, architecture, mechanics, visualization, content-guide). No code yet. | M0: scaffold + game loop |
