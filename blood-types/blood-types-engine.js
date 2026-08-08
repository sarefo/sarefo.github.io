// Pure ABO/Rh inheritance logic for the Family Blood Type Explorer.
//
// "Pure" means: every function here only looks at the arguments it's given
// and returns a new result -- it never reads or writes a global variable,
// touches the DOM, or depends on what happened in a previous call. That's
// what makes this file testable: call a function twice with the same
// inputs and you always get the same output, so a test can just check
// "did I get the expected output" with no setup/teardown dance.
//
// This file is loaded by BOTH index.html (the real app) and tests.html
// (the test suite) via a plain <script src=...> tag.
// That matters: the tests exercise this exact file, not a copy of it, so a
// passing test suite really does mean the shipped app behaves this way.

const ABO_ALL = ['AA', 'AB', 'AO', 'BB', 'BO', 'OO'];
const RH_ALL = ['DD', 'Dd', 'dd'];
const ABO_PHENO = { AA: 'A', AO: 'A', BB: 'B', BO: 'B', AB: 'AB', OO: 'O' };
const RH_PHENO = { DD: '+', Dd: '+', dd: '-' };
const ABO_FROM_PHENO = { A: ['AA', 'AO'], B: ['BB', 'BO'], AB: ['AB'], O: ['OO'] };
const RH_FROM_PHENO = { '+': ['DD', 'Dd'], '-': ['dd'] };
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const ABO_ALLELES = ['A', 'B', 'O'];
const RH_ALLELES = ['D', 'd'];

// The two loci behind a blood type. ABO sits on chromosome 9 and Rh (the
// RHD gene) on chromosome 1 -- genuinely separate chromosome pairs, which
// is why the two halves of a blood type are inherited independently.
//
// `key` matches the keys used by parseBloodType() and computeDomains(), so
// one loop can walk both loci without special-casing either.
const LOCI = [
  { key: 'abo', chromosome: 9, gene: 'ABO', alleles: ABO_ALLELES,
    all: ABO_ALL, fromPheno: ABO_FROM_PHENO },
  { key: 'rh', chromosome: 1, gene: 'Rh', alleles: RH_ALLELES,
    all: RH_ALL, fromPheno: RH_FROM_PHENO },
];

// Combines two genotypes (each a 2-letter allele string, e.g. "AO") into
// the set of genotypes a child could inherit from them -- a Punnett square.
function punnett(g1, g2) {
  const out = new Set();
  for (const a of g1) for (const b of g2) out.add([a, b].sort().join(''));
  return [...out];
}

function parseBloodType(bt) {
  const m = bt.match(/^(AB|A|B|O)([+-])$/);
  if (!m) throw new Error(`Not a valid blood type: "${bt}"`);
  return { abo: m[1], rh: m[2] };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// Shrinks `domain` (a map of person id -> Set of possible genotypes) until
// no more shrinking is possible, given the family structure:
//   familyGroups = [{ parents: [id1, id2], children: [id3, id4, ...] }, ...]
//
// This runs to a fixpoint (repeats until nothing changes) rather than a
// single pass, because a family tree usually has more than one linked
// group -- e.g. grandparents -> father is one group, father+mother ->
// children is another -- and a fact discovered in one group (like "father
// must carry an O allele") can go on to rule things out in the other
// group (like "so grandmother can't be AB"). One pass would miss that.
//
// Mutates `domain` in place and also returns it, for convenience.
function propagate(domain, familyGroups) {
  let changed = true, iter = 0;
  while (changed && iter < 25) {
    changed = false;
    iter++;
    for (const fam of familyGroups) {
      const [p1, p2] = fam.parents;
      const kids = fam.children;
      if (kids.length === 0) continue;
      const newP1 = new Set(), newP2 = new Set();
      const newKid = {};
      kids.forEach(k => newKid[k] = new Set());
      for (const a of domain[p1]) {
        for (const b of domain[p2]) {
          const offspring = punnett(a, b);
          let ok = true;
          const matchPerKid = {};
          for (const k of kids) {
            const inter = offspring.filter(g => domain[k].has(g));
            if (inter.length === 0) { ok = false; break; }
            matchPerKid[k] = inter;
          }
          if (!ok) continue;
          newP1.add(a);
          newP2.add(b);
          for (const k of kids) matchPerKid[k].forEach(g => newKid[k].add(g));
        }
      }
      if (!setsEqual(domain[p1], newP1)) { domain[p1] = newP1; changed = true; }
      if (!setsEqual(domain[p2], newP2)) { domain[p2] = newP2; changed = true; }
      for (const k of kids) {
        if (!setsEqual(domain[k], newKid[k])) { domain[k] = newKid[k]; changed = true; }
      }
    }
  }
  return domain;
}

// Given a state map (person id -> known blood type string, or null if
// unknown), the list of person ids involved, and the family structure,
// returns { abo, rh }: each a map of person id -> Set of possible
// genotypes for that locus.
function computeDomains(state, personIds, familyGroups) {
  const abo = {}, rh = {};
  personIds.forEach(id => {
    const bt = state[id];
    if (bt) {
      const { abo: a, rh: r } = parseBloodType(bt);
      abo[id] = new Set(ABO_FROM_PHENO[a]);
      rh[id] = new Set(RH_FROM_PHENO[r]);
    } else {
      abo[id] = new Set(ABO_ALL);
      rh[id] = new Set(RH_ALL);
    }
  });
  propagate(abo, familyGroups);
  propagate(rh, familyGroups);
  return { abo, rh };
}

// Given the { abo, rh } domains from computeDomains, returns the set of
// still-possible full blood types (e.g. "A+") for one person, plus whether
// that person's domain came out empty -- a sign the data fed in was
// genetically contradictory (e.g. an AB child with two O parents).
function possibleTypesFor(id, domains) {
  const aboSet = domains.abo[id], rhSet = domains.rh[id];
  const abos = [...new Set([...aboSet].map(g => ABO_PHENO[g]))];
  const rhs = [...new Set([...rhSet].map(g => RH_PHENO[g]))];
  const contradiction = aboSet.size === 0 || rhSet.size === 0;
  const types = [];
  for (const a of abos) for (const r of rhs) types.push(a + r);
  return { types, contradiction };
}

// =====================================================================
// Explaining a result.
//
// The functions above answer "what is still possible?". The ones below
// answer "why?" -- which is a different question, and worth solving
// differently. Rather than writing out a table of genetic special cases
// (which would drift out of sync with the engine the moment either
// changed), the explanation is derived FROM the engine, by ablation:
//
//   take away one known blood type, re-solve, and see if the person's
//   options get wider.
//
// If they do, that entry was doing real work and belongs in the
// explanation. If they don't, it wasn't -- even if it "feels" relevant.
// This automatically produces a minimal set of causes, and it can never
// claim something the engine doesn't actually believe.
// =====================================================================

// How is `other` related to `person`, according to the family structure?
// Only the shapes the tree can actually produce are named; anything more
// distant falls through to the generic 'relative'.
function relationBetween(personId, otherId, familyGroups) {
  for (const fam of familyGroups) {
    const asParent = fam.parents.includes(personId);
    const asChild = fam.children.includes(personId);
    if (asParent && fam.parents.includes(otherId)) return 'coparent';
    if (asParent && fam.children.includes(otherId)) return 'child';
    if (asChild && fam.parents.includes(otherId)) return 'parent';
    if (asChild && fam.children.includes(otherId)) return 'sibling';
  }
  return 'relative';
}

// What a person of this blood type can hand DOWN to a child.
// Returns two plain-language clauses, one per locus, so the caller can
// phrase them however its sentences need.
function inheritanceNote(bt) {
  const { abo, rh } = parseBloodType(bt);
  const aboNote =
    abo === 'O'  ? 'can only ever pass on an O allele' :
    abo === 'AB' ? 'passes on an A or a B, never an O' :
                   `passes on ${abo === 'A' ? 'an A' : 'a B'}, or possibly an O`;
  const rhNote =
    rh === '-' ? 'and always passes a d (Rh−) allele'
               : 'and passes a D, or possibly a d';
  return { abo: aboNote, rh: rhNote };
}

// =====================================================================
// Drawing the chromosomes.
//
// The solver above thinks in whole genotypes: a person's ABO domain is a
// SET like {AA, AO} ("type A, but we can't tell which"). A picture has to
// think in slots instead -- two chromosomes side by side, each showing
// what that one chromosome could carry. The functions here convert one
// into the other, so the icons on screen are a view of the solver's own
// state rather than a second, hand-written account of the genetics that
// could drift away from it.
// =====================================================================

// Rank used to order alleles consistently wherever they're listed, so the
// dominant/informative one comes first: "A or O", never "O or A".
const ALLELE_ORDER = { A: 0, B: 1, O: 2, D: 0, d: 1 };

function subsetsOf(items) {
  const out = [];
  for (let mask = 1; mask < (1 << items.length); mask++) {
    out.push(items.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

// Every genotype you get by taking one allele from slot 1 and one from
// slot 2. Same allele-sorting convention as punnett(), so the strings line
// up with the ones the solver uses.
function slotProduct(s1, s2) {
  const out = new Set();
  for (const a of s1) for (const b of s2) out.add([a, b].sort().join(''));
  return out;
}

// Fewer options first (so the certain slot is drawn on the left), then by
// allele rank.
function slotOrder(a, b) {
  if (a.length !== b.length) return a.length - b.length;
  return ALLELE_ORDER[a[0]] - ALLELE_ORDER[b[0]];
}

// Same inputs always give the same answer, and both the cards and the
// explanation panel ask for the same handful of domains over and over, so
// the search is worth caching. Returned objects are shared -- treat them
// as read-only.
const slotCache = new Map();

// Reads a SET of possible genotypes back as two chromosome slots -- the
// form you can actually draw.
//
// It's a search rather than a formula: try every pair of allele subsets
// and keep the pair whose Punnett-style product is EXACTLY the given set.
// Exactness is the whole point. {AA, AO} decomposes to A + (A or O), which
// is honest. {AB, OO} has no decomposition at all -- "one of A/O and one
// of B/O" would also admit AO and BO, which the solver has ruled out -- so
// rather than draw a lie, slots comes back null and the caller falls back
// to naming the genotypes.
//
// Returns { slots, genotypes }: slots is [[allele...], [allele...]] or
// null; genotypes is always the sorted input, for that fallback.
function decomposeSlots(genotypes, alleles) {
  const list = [...genotypes].sort();
  const cacheKey = alleles.join('') + '|' + list.join(',');
  if (slotCache.has(cacheKey)) return slotCache.get(cacheKey);

  const target = new Set(list);
  let best = null;
  if (target.size > 0) {
    for (const s1 of subsetsOf(alleles)) {
      for (const s2 of subsetsOf(alleles)) {
        if (!setsEqual(slotProduct(s1, s2), target)) continue;
        // Least total ambiguity wins: A + (A or O) beats any looser pair
        // that happens to multiply out to the same set.
        const score = s1.length + s2.length;
        if (!best || score < best.score) {
          best = { score, slots: [s1, s2].sort(slotOrder) };
        }
      }
    }
  }

  const result = { slots: best ? best.slots : null, genotypes: list };
  slotCache.set(cacheKey, result);
  return result;
}

function isSubsetOf(a, b) {
  return a.every(x => b.includes(x));
}

// The chromosome picture for one person: one entry per locus, each with
// two allele slots.
//
//   domains    -- the { abo, rh } maps from computeDomains()
//   bloodType  -- that person's own entered type, or null
//
// Every slot carries how sure we are of it, and -- the interesting part --
// whether that certainty came from the family rather than from the
// person's own blood type. Type A alone means AA or AO; an A parent of an
// O child must be AO. `inferred` marks exactly those deductions, so the
// drawing can point at what the family tree bought you.
function genotypeChartFor(id, domains, bloodType) {
  return LOCI.map(locus => {
    const current = domains[locus.key][id] || new Set();
    const ownGenotypes = bloodType
      ? locus.fromPheno[parseBloodType(bloodType)[locus.key]]
      : locus.all;
    const here = decomposeSlots(current, locus.alleles);
    const own = decomposeSlots(ownGenotypes, locus.alleles);

    const slots = (here.slots || []).map((alleles, i) => {
      const ownSlot = own.slots ? own.slots[i] : locus.alleles;
      return {
        alleles,
        certain: alleles.length === 1,
        // Nothing at all is pinned down: as wide as this locus can be.
        open: alleles.length === locus.alleles.length,
        inferred: alleles.length < ownSlot.length && isSubsetOf(alleles, ownSlot),
      };
    });

    return {
      chromosome: locus.chromosome,
      gene: locus.gene,
      locus: locus.key,
      slots,
      // False only in the rare no-decomposition case above; the caller
      // then shows `genotypes` instead of per-slot alleles.
      exact: here.slots !== null,
      genotypes: here.genotypes,
      contradiction: current.size === 0,
    };
  });
}

// The same picture for a blood type on its own, with no family around it
// -- used by the explanation panel, which is talking about what one
// entered type means in isolation. Because the domains handed in are built
// from the phenotype alone, no slot ever comes back `inferred`.
function allelePairsFor(bt) {
  const pheno = parseBloodType(bt);
  const domains = {};
  LOCI.forEach(l => {
    domains[l.key] = { _: new Set(l.fromPheno[pheno[l.key]]) };
  });
  return genotypeChartFor('_', domains, bt);
}

// What a person of this blood type must have received from their parents
// -- the mirror image of inheritanceNote(), used when the constraint
// travels upward from a child to a parent.
function requirementNote(bt) {
  const { abo, rh } = parseBloodType(bt);
  const aboNote =
    abo === 'O'  ? 'needs an O allele from each parent' :
    abo === 'AB' ? 'needs an A from one parent and a B from the other' :
                   `needs ${abo === 'A' ? 'an A' : 'a B'} from one parent, and `
                     + `${abo === 'A' ? 'an A or an O' : 'a B or an O'} from the other`;
  const rhNote =
    rh === '-' ? 'and a d (Rh−) allele from each parent'
               : 'and a D allele from at least one parent';
  return { abo: aboNote, rh: rhNote };
}

// Why does this person have the options they have? Returns
//   { possible, ruledOut, contradiction, causes }
// where each cause is { id, bloodType, relation, withoutIt } -- the known
// entry responsible, and what this person's options would be if it went
// away.
function explainFor(id, state, personIds, familyGroups) {
  const base = possibleTypesFor(id, computeDomains(state, personIds, familyGroups));
  const causes = [];

  for (const other of personIds) {
    if (other === id || !state[other]) continue;
    const without = { ...state, [other]: null };
    const alt = possibleTypesFor(id, computeDomains(without, personIds, familyGroups));
    const doesWork = alt.types.length > base.types.length
      || (base.contradiction && !alt.contradiction);
    if (doesWork) {
      causes.push({
        id: other,
        bloodType: state[other],
        relation: relationBetween(id, other, familyGroups),
        withoutIt: alt.types,
      });
    }
  }

  const ruledOut = BLOOD_TYPES.filter(t => !base.types.includes(t));

  // Ablation one-at-a-time has a blind spot: when two entries INDEPENDENTLY
  // force the same conclusion (two O+ children, or two O+ parents of an AB+
  // child), removing either one alone changes nothing, so neither looks
  // responsible -- and we'd report a narrowing, or a flat contradiction,
  // with no explanation for it. When that happens, ask each entry the
  // opposite question instead: "on its own, with the rest of the family
  // blanked out, would you still bite?"
  const needsFallback = causes.length === 0
    && (base.contradiction || (!state[id] && ruledOut.length > 0));

  if (needsFallback) {
    for (const other of personIds) {
      if (other === id || !state[other]) continue;
      const only = {};
      personIds.forEach(p => { only[p] = null; });
      only[other] = state[other];
      if (state[id]) only[id] = state[id];   // keep the person's own entry:
                                             // it's half of any conflict
      const alt = possibleTypesFor(id, computeDomains(only, personIds, familyGroups));
      const bites = alt.contradiction
        || (!state[id] && alt.types.length < BLOOD_TYPES.length);
      if (bites) {
        causes.push({
          id: other,
          bloodType: state[other],
          relation: relationBetween(id, other, familyGroups),
          withoutIt: null,
        });
      }
    }
  }

  return { possible: base.types, ruledOut, contradiction: base.contradiction, causes };
}

// The same ablation run in reverse: for a person whose type IS known,
// which of their still-unknown relatives does that entry actually narrow?
// Returns [{ id, possible, wouldBe, contradiction }, ...].
function influenceOf(id, state, personIds, familyGroups) {
  if (!state[id]) return [];
  const withIt = computeDomains(state, personIds, familyGroups);
  const without = { ...state, [id]: null };
  const withoutIt = computeDomains(without, personIds, familyGroups);

  const out = [];
  for (const other of personIds) {
    if (other === id || state[other]) continue;
    const a = possibleTypesFor(other, withIt);
    const b = possibleTypesFor(other, withoutIt);
    if (a.types.length < b.types.length || (a.contradiction && !b.contradiction)) {
      out.push({
        id: other,
        possible: a.types,
        wouldBe: b.types,
        contradiction: a.contradiction,
      });
    }
  }
  return out;
}
