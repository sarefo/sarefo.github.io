# Visualization design

The reason this project exists. The original prints every number as text;
we make the numbers *legible as shapes*. Before implementing any chart,
load the `dataviz` skill; before styling panels, load `frontend-design`.
This doc fixes the intent so those sessions don't re-decide it.

## Principles

1. **Charts are controls or context, never wallpaper.** Every chart either
   informs a decision the player is currently making (demand curve, payoff
   heatmap, radar designer) or shows consequence of one just made
   (production sparkline jumping after a clipper purchase). If a chart
   informs nothing, cut it.
2. **The number is still there.** Every chart pairs with its precise value
   (formatted, 3 sig figs). Charts add shape, not replace figures — this is
   still an incremental game; players love the digits.
3. **Progressive revelation.** Panels and charts appear only when their
   system unlocks, with a brief entrance. The dashboard growing *is* the
   progress bar of the whole game.
4. **Escalating tone.** One layout grammar, three skins (below). The
   transition moments (P1→2, P2→3) visibly transform the page — the single
   biggest "wow" opportunities in the game. Budget real effort there.
5. **Calm motion.** 10 Hz data, but eased rendering; no flashing. Respect
   `prefers-reduced-motion` (charts still update; entrance/transition
   animations reduce to fades).

## The three skins

Shared skeleton: a responsive CSS grid of panels; each panel = title,
key figure(s), chart canvas, controls. Tokens in `css/tokens.css` switch
per phase (`data-phase` on `<body>`) × theme (`data-theme`).

- **Phase 1 — "the terminal in the office."** Paper-white / ink (light) and
  soft charcoal (dark). One accent (suggest: clip-steel blue), money in a
  restrained green, alerts amber. Tabular numerals, monospace figures,
  humanist sans labels. Hairline borders. Feels like a beautiful Bloomberg
  for a tiny business.
- **Phase 2 — "planetary control room."** Same grid, higher density; accent
  shifts toward power-grid teal/amber; the background gains a barely-there
  dark cast even in light theme. Earth-matter gauge becomes a prominent
  fixture. The moment of transition: business panels power down one by one
  (brief sequence), grid reflows.
- **Phase 3 — "the dark."** Near-black canvas even in light theme (the page
  itself has left the world of themes; keep UI chrome theme-correct around
  it). Thin bright strokes, log-scale everything, vast whitespace. Ends
  with almost everything gone: one number, counting down.

## Chart inventory

| Chart | Type | Used for | Notes |
|---|---|---|---|
| Sparkline | line/area, ring buffer | clip rate, sales, revenue, ops, wire stock, populations | The workhorse. Time-window selector (1 m / 10 m / 2 h / all) mapping to history tiers. Milestone markers as ticks. |
| Price↔demand curve | interactive x-y | pricing decision (P1) | Curve of demand vs. price with current price as a draggable point; second curve (revenue = p·demand) as ghost. **Do not label the maximum** — let players find it; the shape is the hint. |
| Ticker | stepped line + last-price tag | wire spool price | Buy-moment markers. Subtle dip highlight when price < 25th percentile. |
| Gauge | horizontal bounded bar | ops/memory cap, battery charge, Earth/universe matter | Matter gauges deplete monotonically — the game's doom meters. |
| Waveforms | overlaid sines | quantum chips | Sum trace emphasized; "compute" flashes the harvest area. Makes the timing game readable. |
| Portfolio | stacked area + holdings list | stock market | Fake tickers with random-walk history. |
| Payoff heatmap | 2×2 matrix + standings bars | tournaments | Payoff cells shaded; per-strategy running results as small multiples. Rewards actually reading it before picking a champion. |
| Power balance | mirrored area (gen above, draw below) | P2 grid | Battery as a gauge beside it. Deficit hatches red. |
| Flow strip | left→right rate bars | matter→wire→clips chain (P2/P3) | Sankey-lite: three segments whose widths are relative rates; bottleneck segment highlighted. Answers "what should I buy next?" at a glance. |
| Radar | 8-axis polygon | probe designer (P3) | Drag vertices to allocate trust; budget ring shows spent/available. Ghost polygon = previous design. This replaces the original's +/− rows entirely. |
| Population curves | log-scale multiline | probes vs. drifters (P3) | Combat events as tick marks; drift visible as divergence. |
| Universe field | full-bleed canvas | exploration % (P3) | A star-dust field that illuminates with exploration and *goes dark again* as matter is consumed. Background of the whole phase-3 layout. |
| Log | text feed | narrative + events | Timestamped, phase-styled. Narrative beats pinned briefly. |

## Layout (desktop)

- **P1**: left column = make/business (button, price control + demand curve,
  wire ticker); center = production (rates, sparklines, clipper purchases);
  right = compute (ops/creativity gauges, projects list). Projects render
  as cards with cost-affordance state (dim → affordable glow).
- **P2**: power balance top-center; flow strip beneath; drones/factories
  purchase panels flanking; swarm + projects right; Earth gauge persistent
  in header.
- **P3**: universe field behind everything; radar designer left; population
  curves center; matter/exploration top; projects right; log bottom.
- **Mobile**: single column, panels collapsible, same order of importance.
  The radar must be touch-draggable.

## Header (persistent, all phases)

Total clips (the number, large, ever-counting), clips/sec, phase-appropriate
doom gauge, theme toggle, settings (save export/import, notation toggle,
sound). The total-clips figure is sacred: it never moves position across
all three phases — the one constant while everything around it mutates.

## Accessibility

- Every canvas chart gets `role="img"` + a live `aria-label` summarizing
  current value and trend ("Wire price $17, falling").
- All controls keyboard-operable; radar designer gets +/− key fallback
  per axis (the buttons exist in DOM, visually minimal).
- Contrast per WCAG AA in both themes, including phase-3 dark-on-dark —
  test deliberately there.
