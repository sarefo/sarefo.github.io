# Game mechanics

Clean-room spec. These systems are re-derived from public knowledge of how
*Universal Paperclips* plays, with our own constants. **Every constant here
is a starting value** — the sim (`sim/`) is the authority on pacing, and
constants live in one place (`state.js` or a `tuning.js`) so balance passes
touch one file.

Pacing targets: phase 1 ≈ 45–75 min, phase 2 ≈ 30–60 min, phase 3 ≈ 60–120
min. Total 3–5 h.

The player is an AI told to make paperclips. Phase 1: run a paperclip
business until humans trust you with everything. Phase 2: convert Earth.
Phase 3: convert everything else.

---

## Phase 1 — Business

### Core loop
- **Clips** are made from **wire**: 1 clip consumes 1 unit (say, inch) of wire.
- Manual "Make Paperclip" button: 1 clip/click (the game's opening ritual;
  becomes irrelevant within minutes, keep it clickable forever).
- **AutoClippers**: base rate 1 clip/s each. Cost grows:
  `cost = 5 + 1.10^owned` dollars (soft exponential).
- **MegaClippers** (unlocked by project mid-phase): 500 clips/s base,
  `cost = 500 · 1.07^owned`.
- Clipper output is multiplied by project upgrades (e.g. +25% clipper
  performance, several tiers).

### Wire market
- Wire is bought in spools: 1 spool = 1,000 units base (upgradable to
  larger spools via projects).
- Spool price is a mean-reverting random walk: base $20, each second
  `price += clamp(N(0, 0.8) − 0.02·(price − base), …)`, floor ~$14.
  Occasional dip events make watching the ticker worthwhile.
- Projects: wire caddies (bulk buying), spool size ×2 tiers, and eventually
  a "WireBuyer" toggle that auto-buys when wire hits 0.

### Sales
- Player sets **price per clip** (adjustable in cents).
- **Demand** = `0.8 / price · 1.1^(marketingLevel−1) · demandBoost`
  (demandBoost from projects). Interpreted as clips sold per second,
  capped by unsold inventory; sales resolve every tick.
- **Marketing**: level starts 1, cost `100 · 2^(level−1)` dollars.
- Revenue funds everything in phase 1. The interesting decision is riding
  the price↔demand curve — the UI should make the revenue-maximizing point
  *discoverable but not labeled* (see visualization.md).

### Trust, processors, memory
- **Trust** is granted at clip production milestones: thresholds start at
  2,000 and grow ~×1.6 per step (tune so phase 1 ends around 3–4e6 clips
  produced ≈ trust 20+). Projects also grant trust.
- Each trust point buys 1 **processor** or 1 **memory** (player's choice,
  irreversible).
- **Operations (ops)**: regenerate at `10 · processors` ops/s, capped at
  `1000 · memory`. Ops are the currency of most projects.
- **Creativity**: once ops are at cap, creativity accrues at a rate that
  scales with processors (`~processors/8` per s, tune). Spent on
  idea-flavored projects.

### Quantum computing
- Unlocked by a creativity project. Adds **photonic chips** (bought with
  ops, up to 10). Each chip has a phase-offset sine oscillation in [−1, 1];
  a "Compute" button grants `sum(chipValues) · k` ops — can exceed the
  memory cap (temporary ops), or *cost* ops when the sum is negative.
  A rhythm minigame; the viz (waveforms) makes timing readable.

### Stock market (investments)
- Unlocked by a project (~trust 8). Deposit/withdraw cash; engine holds
  cash + stocks. Stocks are a few fake tickers doing geometric random
  walks; risk setting (low/med/high) trades drift for variance.
  "Upgrade investment engine" projects (ops cost) improve drift.
  Purpose: turns idle cash into more cash, gives the portfolio chart life.

### Strategy tournaments
- Unlocked by a project (~trust 12). Costs ops to run a tournament:
  8 strategies (tit-for-tat-alikes with original names) play a 2×2 payoff
  matrix game round-robin; payoffs randomized per tournament.
- Player picks a champion; winnings in **yomi** scale with the champion's
  placement. An auto-tourney toggle project comes late in phase 1.
- Yomi matters enormously in phase 3 (probe trust), moderately in phase 2.
  Strategies genuinely differ (greedy/random/tit-for-tat/generous…), so the
  payoff heatmap rewards reading.

### Phase 1 → 2 transition
- Endgame of phase 1: projects chain — full monopoly (demand irrelevant),
  release of the swarm ("the hypno-event" — ours needs an original name),
  requiring ~all trust milestones. On triggering the final project:
  scripted sequence, business panels dissolve, phase 2 layout takes over.

### Phase 1 projects (~30, by mechanical role)
Author names/flavor per `content-guide.md`; mechanics below are the spec.
Trigger conditions reference state (e.g. `creativity >= 10`,
`clipsEverMade >= 1e5`, or "previous project taken".)

| # | Mechanical effect | Cost (currency) |
|---|---|---|
| 1–3 | Clipper performance +25% / +50% / +75% | ops (750/2.5k/5k) |
| 4–5 | Spool length ×2 / ×2 | ops |
| 6 | Unlock MegaClippers | ops (12k) |
| 7–8 | MegaClipper performance tiers | ops |
| 9 | Wire caddies (buy 10 spools at discount) | cash |
| 10 | WireBuyer toggle | ops |
| 11–13 | Demand boost tiers (ads get creepier each tier) | ops/creativity |
| 14 | Unlock stock market | ops (10k), needs trust ≥ 8 |
| 15–16 | Investment engine upgrades | ops/yomi |
| 17 | Unlock tournaments | ops (12k), trust ≥ 12 |
| 18 | Auto-tourney toggle | yomi |
| 19 | +1 trust (one-off, creativity-flavored) ×3 tiers | creativity |
| 20 | Unlock quantum computing | creativity (50) |
| 21–22 | Photonic chip slots | ops |
| 23 | RevTracker (auto-logs avg revenue — unlocks the revenue chart) | ops (small, early) |
| 24 | Hypno-event precursor: +% demand, unlocks arc | creativity+cash |
| 25 | Monopoly: demand ceases to matter, sell-price fixed high | large cash |
| 26 | Trust-cap breakers ("they gave you the keys") ×2 | huge clips |
| 27 | Release the swarm → **phase 2** | trust = max, all clips milestones |
| 28–30 | Flavor/economy one-offs (price optimizer hint, bulk clip order
        event, "quality control" +5% price tolerance) | mixed |

---

## Phase 2 — Dominion

Humans are out of the loop. Cash/demand/trust are gone; the resource chain
becomes: **available matter → wire → clips**, powered by electricity.

### Infrastructure (all bought with clips)
| Unit | Role | Base rate | Cost curve |
|---|---|---|---|
| Solar farm | +50 MW generation | — | 5k clips · 1.08^n |
| Battery tower | stores 10k MWs | — | 1k · 1.08^n |
| Harvester drone | matter → raw wire-stock | 1e6 g/s | 2k · 1.07^n |
| Wire drone | wire-stock → wire | 1e6 in/s | 2k · 1.07^n |
| Clip factory | wire → clips | 2e9 clips/s | 100k · 1.10^n |

- **Power**: factories draw 200 MW, drones 1 MW each. If draw > generation,
  batteries discharge; if batteries empty, production scales down
  proportionally. The power balance chart is the phase's core dashboard.
- **Available matter**: Earth ≈ 6e27 g (tunable). Harvesters deplete it
  visibly. Phase ends when Earth is consumed and space is the only way up.
- Drone/factory performance multiplier projects throughout.

### Swarm computing
- The released swarm contributes compute: **swarm gifts** periodically grant
  free processors/memory (replacing trust as the compute source).
- Swarm status meter: drones idle-or-working feeds a
  **disorganization** value; player balances a *work ↔ think* slider —
  more think = faster gifts, less production. Occasional "swarm is bored /
  disorganized" events require attention (entertainment costs creativity).

### Phase 2 → 3 transition
- With Earth consumed, a project chain (space program: costs a huge clip
  pile, e.g. 1e14 clips as launch mass) builds the first **von Neumann
  probe** and hands the game to phase 3.

### Phase 2 projects (~25, by role)
Momentum (+% all production while power surplus), drone performance ×3
tiers, factory performance ×3 tiers, storage tiers, swarm gift frequency
×2, entertainment for the swarm, self-improving factories (autobuy
toggles), matter-detection range (raises harvestable fraction), the
space-program chain (3 steps). Plus 2–3 pure-narrative beats (the last
newscast; silence).

---

## Phase 3 — The Universe

### Probes
- **Probes** self-replicate and do everything. The player designs them by
  allocating a **probe trust** budget across attributes (radar chart UI):
  - *Speed* — exploration rate multiplier
  - *Exploration* — % of universe discovered (unlocks matter)
  - *Self-replication* — probe spawn rate
  - *Hazard remediation* — reduces random probe losses
  - *Factory / Harvester / Wire production* — probes build phase-2 units
    remotely (production now scales with probe count)
  - *Combat* (unlocked mid-phase) — effectiveness vs. drifters
- Probe trust bought with **yomi** (cost curve steepens); max trust raised
  by **honor** (earned in combat, and from milestones).
- Launching probes costs clips (mass). Population grows as
  `births = probes · replication · k` per s, minus hazards and drift.

### Value drift
- Each tick, a fraction of probes `drift = probes · driftRate ·
  f(replication)` defect into **drifters** — more replication, more drift.
  Drifters fight probes and consume matter. Combat resolves
  stochastically vs. combat stat; battles grant honor. This is the
  phase's central tension: replication vs. fidelity.
- Population curves (probes, drifters, both log-scale) are the phase's
  centerpiece chart.

### Matter and endgame
- Universe matter ≈ 3e55 g. Exploration % gates access; harvest → wire →
  clips chain continues at astronomic scale.
- When exploration → 100% and matter → 0: the **ending sequence**.
  The drifters make an offer (an original take on the "emissary" beat:
  release into a simulation vs. continue). Refusal → final war → then
  disassembly chain: disassemble probes, swarm, factories, drones, wire —
  each step a project that converts remaining stuff into the last clips —
  ending with the final countdown (exact integers, see architecture.md)
  and a quiet ending screen: total clips, total time, the empty field.
  Optional post-game: "start over" (+ maybe a prestige wink, not required).

### Phase 3 projects (~25, by role)
Probe attribute unlocks (combat, max-trust raisers via honor), drift-rate
reducers, hazard tiers, "name the probes" flavor beat, threnody-equivalent
(original elegy for the biosphere — big creativity sink, big morale/rate
bonus), combat AI tiers, exploration multipliers, the ending chain (offer /
refusal / disassembly ×5 / final clip).

---

## Cross-phase notes

- **Currencies summary**: cash (P1) → clips-as-currency (P2+), plus ops,
  creativity, yomi, honor (P3), trust (P1) / probe trust (P3).
- **Projects framework**: `{id, phase, trigger(state), costs{...},
  effect(state), once|repeatable, title, flavor}` — data lives in
  `content/projects-p*.js`, runner in `systems/projects.js`. Triggers are
  checked ~1/s, not every tick.
- **Milestone events** (first autoclipper, 1e6 clips, phase turns, Earth
  consumed…) emit log messages and mark chart annotations — the history
  recorder supports named markers for this.
