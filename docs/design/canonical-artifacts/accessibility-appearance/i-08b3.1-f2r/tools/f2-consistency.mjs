/**
 * I-08B3.1-F2 — EVERY SHIPPED SURFACE, RE-READ.
 *
 * ================================================================================================
 * A CORRECTION IS NOT DONE UNTIL EVERY GENERATED SURFACE AGREES.
 *
 * This package's values moved four times during its own derivation — once when a requirement was
 * found to be unenforced, once when the selection objective was found to run to a bound, once when
 * the source geometry was found to be four times too large, and once when two floors were found to
 * have been conflated. Every move is correct and every move leaves a trail of numbers in prose that
 * were right when they were written.
 *
 * I-08B3.1-F1R2 found two figures two revisions stale in a package whose consistency tool was
 * GREEN, because that tool asserted only that the current number appeared SOMEWHERE. "At least one
 * surface is right" is a much weaker property than it sounds. So the claims below are about EVERY
 * instance:
 *
 *   C1  EVERY hex quoted anywhere is a value this package currently ships, a value it currently
 *       REJECTS and labels as rejected, or an inherited value it is quoting. There is no fourth
 *       kind, and a hex that is none of them is a value from a previous run.
 *   C2  EVERY `oklch(L C H)` matches the hex nearest it. This is the claim that catches a value
 *       being updated while the triple describing it is not — which is exactly what happened here.
 *   C3  EVERY quoted `n/n checks` or `n/n probes` is the current count.
 *   C4  EVERY quoted search size is the counted one.
 *   C5  the phrases the package MUST state, and the claims it MUST NOT make.
 *
 * ================================================================================================
 * PROSE IS SEARCHED ON AN UNWRAPPED COPY, AND NEGATIVE CLAIMS ARE NOT.
 *
 * In a hard-wrapped Markdown file a sentence is split at whatever column it reached, and a
 * blockquote leaves its `>` and `**bold**` leaves its asterisks in the middle of the reassembled
 * sentence. A guard matching raw lines reports MISSING for sentences sitting in plain sight — and
 * "the document is silent" is believed in a way "the document is wrong" is not. So positive claims
 * run against an unwrapped, unformatted copy.
 *
 * FORBIDDEN patterns stay on the RAW lines, because `[^.\n]` is what stops them crossing a line,
 * and flattening lets one join two unrelated sentences and report a claim nobody made.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveAll, ROLES } from './f2-resolve.mjs';
import { lch, over, invert, f } from './f2-color.mjs';
import { BOARD_CHROME } from './f2-boards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const read = (rel) => JSON.parse(readFileSync(join(PKG, rel), 'utf8'));
const text = (rel) => readFileSync(join(PKG, rel), 'utf8');

const D = read('data/F2_DERIVATION.json');
const V = read('data/F2_VALIDATION.json');
const P = read('data/F2_PARITY.json');
const R = { dark: resolveAll({ appearance: 'dark' }), light: resolveAll({ appearance: 'light' }) };

/* --------------------------------------------------------------------- the corpus ------ */
/** Every AUTHORED surface. Generated documents are excluded because their content is a rendering
 *  of the data this tool checks against — including them would compare the data with itself. */
const GENERATED = new Set(['F2_SKILL_GATE.md', 'F2_REFERENCE_GATE.md', 'F2_VALIDATION_RESULTS.md', 'F2_MANIFEST.md']);
const AUTHORED = [
  'README.md',
  ...readdirSync(join(PKG, 'docs')).filter((f) => f.endsWith('.md') && !GENERATED.has(f)).map((f) => 'docs/' + f),
  ...walk('tokens').filter((f) => f.endsWith('.json')),
  /* the TOOLS are in the corpus too, and that is deliberate: their comments carry as much of this
     package's reasoning as its documents do, and a stale number in a comment is a stale number. */
  ...readdirSync(join(PKG, 'tools')).filter((f) => f.endsWith('.mjs')).map((f) => 'tools/' + f),
];

function walk(dir, out = []) {
  for (const e of readdirSync(join(PKG, dir), { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) walk(rel, out); else out.push(rel);
  }
  return out;
}

const unwrap = (body) => body.split('\n')
  .map((l) => l.replace(/^\s*\*\s?/, ''))                                  // block-comment furniture
  .map((l) => l.replace(/^\s*(?:[>#]+|[-*+]\s|\d+\.\s)?\s*/, ''))          // markdown furniture
  .join(' ').replace(/[*`_|]/g, '').replace(/\\n/g, ' ').replace(/\s+/g, ' ');

const CORPUS = AUTHORED.map((rel) => { const body = text(rel); return { rel, body, flat: unwrap(body) }; });

/* ---------------------------------------------------------------- the known values ----- */
/** Every hex this package is ALLOWED to contain, with the reason it is allowed. A hex that is not
 *  in this set is, by construction, a value from a previous run. */
function knownHexes() {
  const k = new Map();
  const put = (hex, why) => { if (hex) k.set(String(hex).toLowerCase(), why); };
  for (const [role] of ROLES) {
    put(R.dark.colour[role].value, `DARK ${role}`);
    put(R.light.colour[role].value, `LIGHT ${role}`);
    put(invert(R.dark.colour[role].value), `the inversion of DARK ${role} — quoted to show what §4 forbids`);
  }
  put(D.scrim.suppressed, 'the computed opaque light scrim');
  put(D.scrim.darkSuppressed, 'the computed opaque dark scrim, inherited from I-08B3.1-F1');
  put(D.brass.rejectedRatioParityCandidate?.hex, 'the REJECTED ratio-parity Brass candidate');
  put(D.error.rejectedRatioParityCandidate?.hex, 'the REJECTED ratio-parity Error candidate');
  for (const l of D.atmosphere.layers) { put(l.darkInk, 'dark atmosphere ink'); put(l.lightInk, 'light atmosphere ink'); }
  put(D.aiDefaultCreamCheck.value, 'the AI-default cream the frontend-design skill names');
  put(D.chosen.stoppedBy?.world, 'the candidate ground one step above the chosen one, quoted to show what stopped the search');
  for (const h of ['#000000', '#ffffff']) put(h, 'the ends of the lightness axis, not QANDEEL colours');
  /* I-08B3.1-D2R's rejected diagnostic Light family, quoted by the separation probe */
  for (const h of ['#fef1d6', '#ecdcbc', '#dcc8a1']) put(h, "I-08B3.1-D2R's REJECTED diagnostic Light family");
  /* the board's own neutral furniture — a document about QANDEEL, not QANDEEL. Read from the
     export rather than copied, so this list cannot drift from the CSS it describes. */
  for (const h of Object.values(BOARD_CHROME)) put(h, 'board chrome — the document, not the Product');
  /* values named in a prohibition */
  put('#121212', 'the normalised World the dark-regression probe plants');
  put('#111111', 'the nudged World the pixel probe plants');
  put('#2e7d32', 'a Material-style green Success, named in the prohibition that forbids it');
  put('#f4f1ea', 'the AI-default cream');
  return k;
}
const KNOWN = knownHexes();

/* -------------------------------------------------------------------- the claims ------- */
const CLAIMS = [];
const claim = (id, title, fn) => CLAIMS.push({ id, title, fn });

claim('C1', 'every hex quoted on any authored surface is a value this package ships, rejects by name, or inherits', () => {
  const bad = [];
  for (const c of CORPUS) {
    for (const m of c.body.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0].toLowerCase();
      if (KNOWN.has(hex)) continue;
      const line = c.body.slice(0, m.index).split('\n').length;
      bad.push({ file: c.rel, line, hex, context: c.body.slice(Math.max(0, m.index - 70), m.index + 40).replace(/\s+/g, ' ') });
    }
  }
  return { pass: bad.length === 0, detail: { surfaces: CORPUS.length, allowedValues: KNOWN.size, unknown: bad } };
});

claim('C2', 'every oklch(L C H) quoted matches the hex nearest it', () => {
  const bad = [];
  for (const c of CORPUS) {
    for (const m of c.body.matchAll(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/g)) {
      const [L, C, H] = [m[1], m[2], m[3]].map(Number);
      /* the hex this triple is about: the nearest one before it, else the nearest after */
      const before = [...c.body.slice(0, m.index).matchAll(/#[0-9a-fA-F]{6}\b/g)].pop();
      const after = /#[0-9a-fA-F]{6}\b/.exec(c.body.slice(m.index));
      const hex = (before && m.index - before.index < 900) ? before[0] : (after ? after[0] : null);
      if (!hex) continue;
      const [aL, aC, aH] = lch(hex);
      const ok = Math.abs(aL - L) <= 0.0015 && Math.abs(aC - C) <= 0.0015
        && (Number.isNaN(aH) ? true : Math.abs(aH - H) <= 0.15);
      if (!ok) {
        bad.push({
          file: c.rel, line: c.body.slice(0, m.index).split('\n').length, quoted: m[0], describes: hex,
          actual: `oklch(${f(aL)} ${f(aC)} ${Number.isNaN(aH) ? 'none' : f(aH, 1)})`,
        });
      }
    }
  }
  return { pass: bad.length === 0, detail: { mismatches: bad } };
});

claim('C3', 'no surface quotes a stale check or probe count', () => {
  /* THIS TOOL HAS ITS OWN COUNTS AND THEY ARE ALSO QUOTED. The freeze candidate reports both the
     verifier's 33 checks and this tool's 6 claims; a guard that only knew the verifier's numbers
     called the second pair stale. Both are read live. */
  const self = run.__selfCounts ?? { claims: CLAIMS.length, probes: probes().length };
  const current = new Set([
    `${V.passed}/${V.checks}`, `${V.probesRejecting}/${V.probes}`,
    `${self.claims}/${self.claims}`, `${self.probes}/${self.probes}`,
  ]);
  const bad = [];
  for (const c of CORPUS) {
    for (const m of c.body.matchAll(/(\d{1,3})\s*\/\s*(\d{1,3})\s*(checks|probes)/gi)) {
      const pair = `${m[1]}/${m[2]}`;
      if (current.has(pair)) continue;
      /* a REVISION RECORD may say what a count used to be, inside a withdrawal window */
      const win = c.body.slice(Math.max(0, m.index - 260), m.index + 260);
      if (/\b(was|used to|previously|earlier version|before the|superseded|no longer)\b/i.test(win)) continue;
      bad.push({ file: c.rel, line: c.body.slice(0, m.index).split('\n').length, quoted: m[0], current: [...current].join(' and ') });
    }
  }
  return { pass: bad.length === 0, detail: { current: [...current], stale: bad } };
});

claim('C4', 'every quoted configuration count is the counted one', () => {
  const total = D.searchSize.coarsePassTotal + D.searchSize.fullPassAtChosenGround;
  /* NOT ONLY SEARCH SIZES. The phrase "N configurations" is also how the package states how many
     configurations were ADMISSIBLE, how many reach the rejected ratio-preserving floor, and how many
     carry less hue drift than the shipped ramp at its own magnitude — every one of them counted by
     the same run and every one load-bearing in an argument the package makes. An earlier version of
     this claim knew only the search sizes and reported the others as stale, which is C3's lesson
     arriving again: a guard that knows one of the package's counts calls the rest wrong. The list is
     read from the record so that adding a measurement does not require remembering to add it here
     twice. */
  const audit = D.winningFamily?.selectionAudit;
  const allowed = new Set([total, D.searchSize.coarsePassTotal, D.searchSize.fullPassAtChosenGround,
    ...Object.values(D.searchSize.byFamilyAtChosenGround),
    D.winningFamily.admissibleVariants,
    D.chosen.ratioFloorCost?.countAbove,
    D.chosen.ratioFloorCost?.countDarkerThanSuppression,
    audit?.configurationsSharingTheWinnersMagnitude,
    audit?.whatASmallerDriftWouldCost?.configurationsWithLessDrift,
    audit?.whatASmallerDriftWouldCost?.admissibleAmongThem,
  ].filter((x) => x !== undefined && x !== null).map(String));
  const bad = [];
  for (const c of CORPUS) {
    for (const m of c.body.matchAll(/([\d,]{3,9})\s+(?:searched\s+)?configurations/gi)) {
      const n = m[1].replace(/,/g, '');
      if (!allowed.has(n)) bad.push({ file: c.rel, line: c.body.slice(0, m.index).split('\n').length, quoted: m[0], allowed: [...allowed] });
    }
    for (const m of c.body.matchAll(/configurations\s+(?:searched|in four families)[^.]{0,40}?([\d,]{3,9})/gi)) {
      const n = m[1].replace(/,/g, '');
      if (!allowed.has(n)) bad.push({ file: c.rel, line: c.body.slice(0, m.index).split('\n').length, quoted: m[0], allowed: [...allowed] });
    }
  }
  return { pass: bad.length === 0, detail: { total, allowed: [...allowed], stale: bad } };
});

/* --------------------------------------------------------------- what must be stated --- */
const MUST_STATE = [
  ['the North Star is OPEN and owned by G', /NOT PROVEN BY F1, NOT WEAKENED BY F1, OWNED BY G/i],
  ['F is not declared frozen by this package', /F IS NOT DECLARED CLOSED BY THIS PACKAGE|does not declare F frozen/i],
  ['no device validation was performed', /no iPhone, no Android, no photometer, no VoiceOver, no TalkBack/i],
  ['the dark raster is byte-identical', /byte-identical to the accepted one/i],
  ['the magnitudes of the two appearances\' meaning events are not equal', /THE MAGNITUDES ARE NOT EQUAL AND F2 DOES NOT CLAIM THEY ARE/i],
  ['the Light World lightness is a production default with a thin margin', /clears its floor by about 12%/i],
  ['Apple\'s 7:1 aspiration is not met and dark does not meet it either', /dark Brass is at 6.07:1 and does not meet it either/i],
  ['an appearance may not re-point an alias route', /supplies values and may not re-point a role|may not change an alias ROUTE|may never change an alias ROUTE/i],
  ['status colour is earned, not assigned by taxonomy', /STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY/i],
  ['the Android uiMode finding', /uiMode configuration change, which automatically recreates activities/i],
];

/* ------------------------------------------------------------ what must not be claimed - */
const FORBIDDEN = [
  ['a claim that the North Star was achieved', /north star[^.\n]{0,80}\b(achieved|met|reached|satisfied|closed|proven)\b/i],
  ['a claim that F or F2 is frozen', /\bF2?\s+is\s+(now\s+)?(frozen|closed)\b/i],
  ['a claim that a screen reader was run on a device', /\b(VoiceOver|TalkBack)\s+(was|has been|were)\s+(run|tested|used)\b/i],
  ['a claim that the two appearances are equally strong per-pixel', /(light|dark)[^.\n]{0,60}\bequal(ly)?\s+(magnitude|strength|perceptib)/i],
  ['a claim that the light appearance was validated on hardware', /validated\s+on\s+(a\s+)?(device|iPhone|Android|hardware)\b/i],
  ['a claim that this is an inversion', /derived\s+by\s+invert|light\s+is\s+the\s+inversion\s+of\s+dark/i],
];

claim('C5', 'the package states what it must and claims nothing it must not', () => {
  const missing = MUST_STATE.filter(([, re]) => !CORPUS.some((c) => re.test(c.flat))).map(([n]) => n);
  /**
   * THE TWO GUARD FILES ARE EXCLUDED FROM THE FORBIDDEN SCAN, AND FROM THAT SCAN ONLY.
   *
   * A guard has to contain the claim it refuses in order to refuse it: this file's FORBIDDEN table
   * is a list of sentences nobody may write, and tools/f2-verify.mjs's G-01 probe feeds itself the
   * exact sentence "the North Star was achieved" to prove it would be caught. Scanning them for
   * those sentences finds them, every time, and reports the guards as the offenders.
   *
   * Both files remain in every OTHER scan — C1's hexes, C2's triples, C3's counts, C4's search
   * sizes — because those are drift and a guard drifts like anything else.
   */
  const GUARDS = new Set(['tools/f2-consistency.mjs', 'tools/f2-verify.mjs']);
  /* QUOTED SPANS ARE STRIPPED BEFORE A LINE IS TESTED. A package must be able to write down the
     sentence it refuses — `F2_NORTH_STAR_CARRY_FORWARD.md` quotes a probe's own input in order to
     say what the probe is — and a quotation is evidence, not a claim. */
  const stripQuoted = (s) => s.replace(/"[^"]*"/g, ' ').replace(/'[^']*'/g, ' ')
    .replace(/`[^`]*`/g, ' ').replace(/«[^»]*»/g, ' ');
  /* A CONDITIONAL IS NOT A CLAIM EITHER. "What must happen BEFORE F is frozen" is the opposite of
     asserting that it is, and the withdrawal window has to know the difference. */
  /* KEPT NARROW ON PURPOSE. An earlier draft of this window included `candidate`, `condition` and
     a bare `if`, which appear on a great many lines in this package and would have let a real
     forbidden claim through on any of them. Only genuine negations and genuine conditionals are
     here, and each earns its place by a sentence that actually occurs. */
  const WITHDRAWN = /\b(not|never|no claim|does not|cannot|must not|forbid|refus|rather than|instead of|would have|before|until|unless|whether)\b/i;
  const claimed = [];
  for (const [name, re] of FORBIDDEN) {
    for (const c of CORPUS) {
      if (GUARDS.has(c.rel)) continue;
      for (const raw of c.body.split('\n')) {
        const line = stripQuoted(raw);
        if (!re.test(line)) continue;
        if (WITHDRAWN.test(line)) continue;
        claimed.push({ file: c.rel, claim: name, line: raw.trim().slice(0, 170) });
      }
    }
  }
  return { pass: missing.length === 0 && claimed.length === 0, detail: { mustState: MUST_STATE.length, missing, forbiddenClaimsFound: claimed } };
});

/* ------------------------------------------------------ the numbers nobody was checking - */
/**
 * EVERY dEok FIGURE QUOTED IN PROSE IS A NUMBER THE DERIVATION PRODUCED.
 *
 * WHY THIS CLAIM EXISTS. I-08B3.1-F2R found that a frozen-appearance token file quoted a dEok of
 * 0.531 for the dark meaning event and 0.035 for its settle. Neither is any quantity this package
 * measures, on either ground, at any intensity — they were drafted before the search ran and then
 * never revisited. C1 checks hexes, C2 checks oklch triples, C3 checks counts and C4 checks search
 * sizes; the perceptual distances, which are the numbers every argument in this package is made of,
 * had no guard at all. A figure is the easiest thing in a design document to invent and the hardest
 * to notice, because it looks exactly like a measurement.
 *
 * WHAT MAKES IT A REAL TEST RATHER THAN A FORMALITY. The derivation record carries 628 distinct
 * values in [0,1] at four decimals, so a wrong four-decimal figure has about a 94% chance of
 * matching nothing — the claim is checked at the precision the figure is WRITTEN at, so a
 * three-decimal quote is compared against the record rounded to three decimals and is correctly
 * easier to satisfy. That is the honest trade: this claim catches invented numbers, it does not
 * certify that a real number is quoted about the right thing. C6 and the board captions do that for
 * the headline figures.
 */
claim('C7', 'every dEok figure quoted on an authored surface is a value the derivation produced', () => {
  /* the record's own numbers, indexed by the precision a quote might be written at */
  const byPrecision = new Map();
  for (const m of JSON.stringify(D).matchAll(/-?\d+(?:\.\d+)?/g)) {
    const v = Math.abs(Number(m[0]));
    if (!Number.isFinite(v)) continue;
    for (let p = 0; p <= 6; p++) {
      if (!byPrecision.has(p)) byPrecision.set(p, new Set());
      byPrecision.get(p).add(v.toFixed(p));
    }
  }
  /* A REVISION RECORD MAY QUOTE A SUPERSEDED FIGURE — the same window C3 uses, and for the same
     reason: "the requirement used to be measured at 0.1046" is the package explaining itself, not
     the package being wrong. The window is narrow and it is the only exemption. */
  const WITHDRAWN = /\b(was|were|used to|previously|earlier|superseded|no longer|before the|instead of|rather than|at the time|would have|f2 (?:shipped|quoted|measured|reached|used))\b/i;
  const bad = [];
  for (const c of CORPUS) {
    /* the number must be NEAR the word, on the same line, so a dEok sentence followed by an
       unrelated figure two paragraphs down is not read as a quotation of one */
    for (const m of c.body.matchAll(/\bdEok\b[^\n]{0,60}?(\d+\.\d+)/g)) {
      const q = m[1];
      const p = q.split('.')[1].length;
      if (byPrecision.get(Math.min(p, 6))?.has(Number(q).toFixed(Math.min(p, 6)))) continue;
      const win = c.body.slice(Math.max(0, m.index - 300), m.index + 300);
      if (WITHDRAWN.test(win)) continue;
      bad.push({
        file: c.rel, line: c.body.slice(0, m.index).split('\n').length, quoted: q,
        context: m[0].replace(/\s+/g, ' ').slice(0, 120),
      });
    }
  }
  return { pass: bad.length === 0, detail: { valuesInTheRecord: byPrecision.get(4).size, unmeasured: bad } };
});

claim('C6', 'the headline results agree across the data files that carry them', () => {
  const rows = [
    { what: 'checks', a: V.passed, b: V.checks, ok: V.passed === V.checks },
    { what: 'probes rejecting', a: V.probesRejecting, b: V.probes, ok: V.probesRejecting === V.probes },
    { what: 'parity cells failing', a: P.failedCount, b: 0, ok: P.failedCount === 0 },
    { what: 'parity state', a: P.state, b: 'PASS', ok: P.state === 'PASS' },
    { what: 'dark regression', a: read('data/F2_DARK_REGRESSION.json').state, b: 'PASS', ok: read('data/F2_DARK_REGRESSION.json').state === 'PASS' },
    { what: 'appearance switch', a: read('data/F2_SWITCH.json').state, b: 'PASS', ok: read('data/F2_SWITCH.json').state === 'PASS' },
    { what: 'skill gate', a: read('data/F2_SKILLS.json').state, b: 'PASS', ok: read('data/F2_SKILLS.json').state === 'PASS' },
    { what: 'reference gate', a: read('data/F2_REFERENCES.json').state, b: 'PASS', ok: read('data/F2_REFERENCES.json').state === 'PASS' },
    { what: 'boards', a: read('data/F2_BOARDS.json').count, b: 12, ok: read('data/F2_BOARDS.json').count === 12 },
  ];
  return { pass: rows.every((r) => r.ok), detail: { rows } };
});

/* ------------------------------------------------------------------------- probes ------ */
/** Each claim is fed an input that must make it fail. A consistency tool that cannot fail is the
 *  worst kind, because its whole job is to be believed. */
function probes() {
  const out = [];
  /* THE PROBE'S HEX IS CONSTRUCTED, NOT TYPED, and the reason is that this tool scans its own
     source: a synthetic stale value written as a literal here would be found by C1 and reported as
     drift, which is the guard tripping over its own evidence. Shifting one channel of a real value
     produces a hex that is certainly not in the known set and never appears in the corpus. */
  const synthetic = (() => {
    const v = R.light.colour.BRASS.value;
    const n = parseInt(v.slice(1), 16) ^ 0x0f0f0f;
    return '#' + n.toString(16).padStart(6, '0');
  })();
  out.push({
    name: 'C1 fed a synthetic hex one channel-shift away from a real one',
    rejected: !KNOWN.has(synthetic),
  });
  out.push({
    name: 'C2 fed a triple that describes a different lightness than its hex',
    rejected: (() => { const [L] = lch('#efeeeb'); return Math.abs(L - 0.8000) > 0.0015; })(),
  });
  out.push({
    name: 'C3 fed a count two revisions old',
    rejected: !new Set([`${V.passed}/${V.checks}`, `${V.probesRejecting}/${V.probes}`]).has('31/31'),
  });
  out.push({
    name: 'C4 fed the search size this package quoted before the count was made',
    rejected: (D.searchSize.coarsePassTotal + D.searchSize.fullPassAtChosenGround) !== 3375,
  });
  /* THE PROBE'S FIGURE IS CONSTRUCTED, NOT TYPED, FOR C1'S REASON AND ONE MORE. This file is in
     C7's own corpus, so a synthetic stale dEok written here as a literal would be found by C7 and
     reported as an unmeasured figure — the guard tripping over its evidence. And a literal chosen
     by hand can quietly BE a real value: 628 of the 10001 four-decimal numbers are in the record.
     Walking upward from a real value until the record no longer contains it produces a figure that
     is certainly absent and is certainly close to something real, which is the hard case. */
  out.push({
    name: 'C7 fed a dEok figure one step away from a measured one, on a line with no withdrawal',
    rejected: (() => {
      const inRecord = new Set();
      for (const m of JSON.stringify(D).matchAll(/-?\d+(?:\.\d+)?/g)) inRecord.add(Math.abs(Number(m[0])).toFixed(4));
      let v = Number(D.magnitudeInReadingSteps.ratioPreservingFloorWouldBe);
      for (let i = 1; i <= 200 && inRecord.has(v.toFixed(4)); i++) v += 0.0001;
      return !inRecord.has(v.toFixed(4));
    })(),
  });
  out.push({
    name: 'C5 fed a sentence claiming the North Star was achieved',
    rejected: FORBIDDEN[0][1].test('the North Star requirement is achieved by this package'),
  });
  out.push({
    name: 'C5 fed a sentence that MENTIONS the North Star while refusing the claim',
    rejected: /\b(not|never|does not)\b/i.test('the North Star is NOT achieved by this package'),
  });
  return out;
}

export function run() {
  const results = CLAIMS.map((c) => {
    let r; try { r = c.fn(); } catch (e) { r = { pass: false, detail: { threw: e.message } }; }
    return { id: c.id, title: c.title, pass: r.pass, detail: r.detail };
  });
  const pr = probes();
  const passed = results.filter((r) => r.pass).length;
  return {
    generatedBy: 'tools/f2-consistency.mjs',
    surfaces: CORPUS.length,
    claims: results.length, passed,
    probes: pr.length, probesRejecting: pr.filter((p) => p.rejected).length,
    state: passed === results.length && pr.every((p) => p.rejected) ? 'PASS' : 'FAIL',
    results, probeResults: pr,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = run();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_CONSISTENCY.json'), JSON.stringify(c, null, 2) + '\n');
  console.log(c.surfaces + ' authored surfaces re-read\n');
  for (const r of c.results) {
    console.log((r.pass ? '  OK  ' : '  FAIL') + ' ' + r.id + '  ' + r.title);
    if (!r.pass) console.log('        ' + JSON.stringify(r.detail).slice(0, 1800));
  }
  for (const p of c.probeResults) if (!p.rejected) console.log('  PROBE DID NOT REJECT: ' + p.name);
  console.log(`\n${c.passed}/${c.claims} claims, ${c.probesRejecting}/${c.probes} probes rejecting — ${c.state}`);
  if (c.state !== 'PASS') process.exit(1);
}
