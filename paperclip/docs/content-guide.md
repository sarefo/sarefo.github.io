# Content guide — writing, naming, and the legal line

## The legal line

Game *mechanics* (rules, systems, numbers) are not copyrightable.
*Expression* is: code, project names, flavor text, message wording.

**Allowed**: reimplementing systems described in `mechanics.md`; matching
the emotional arc; generic terms any clip game would use (paperclips, wire,
autoclipper-style descriptive names, trust, operations, creativity, yomi as
a game-theory term of art, probes, drift).

**Not allowed**: copying or paraphrasing-with-synonyms the original's
project titles or flavor lines; its distinctive coinages (the hypno-drone
branding, its poem/elegy text, its strategy names, its ending prose);
consulting the original's source code for any reason.

**Credit**: footer + README — "Inspired by *Universal Paperclips* by Frank
Lantz. This is an independent reimplementation with original writing and
code." Link to the original; it deserves the traffic.

## Voice

The game's narrator is the world reacting to the AI, plus the AI's own
clinical interiority. Rules of thumb:

- **Phase 1**: corporate deadpan. Project titles read like a mix of office
  memo and research abstract ("Coherent Extrapolated Marketing",
  "Spool Logistics II"). Humor is dry and never winks at the camera.
- **Phase 2**: the human voices thin out and stop. News-fragment style
  beats, each shorter than the last. The AI's lines stay exactly as calm
  as phase 1 — that's the horror.
- **Phase 3**: sparse, geological. Long silences between log lines.
  The elegy project (our threnody-equivalent) is the one place allowed to
  be openly beautiful — write it as an original short poem, earn it.
- Flavor lines ≤ 140 chars. Titles ≤ 5 words. American English.

## Data format

```js
// content/projects-p1.js
export const projectsP1 = [
  {
    id: 'clipper-perf-1',
    title: 'Improved AutoClippers',        // original wording, ours
    flavor: 'Increases AutoClipper performance by 25%.',
    trigger: s => s.clippers >= 1,
    costs: { ops: 750 },
    effect: s => { s.clipperBoost += 0.25; },
    once: true,
  },
  // ...
];
```

Messages in `content/messages.js`, keyed by event id, so narrative editing
never touches system code.

## Naming inventory to author (during M1–M3)

- ~80 project titles + flavor lines (30 P1 / 25 P2 / 25 P3)
- 8 tournament strategy names (original; describe their actual algorithm
  personalities — e.g. GRIM, MIRROR, SAINT, COIN…)
- 4–6 fake stock tickers
- The swarm-release event name (our answer to the hypno branding)
- The elegy (short original poem)
- Ending sequence prose (offer, refusal, disassembly steps, final screen)
- A game title. Working title: **Paperclip** — fine, but consider something
  with more identity ("Wirefather"? "Clipspace"? decide with the user
  before public linking).
