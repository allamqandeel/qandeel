/**
 * I-08B3.1-E1 — CROSS-ARTEFACT CONSISTENCY.
 *
 * A CORRECTION IS NOT DONE UNTIL EVERY GENERATED SURFACE AGREES. I-08B3.1-D2R shipped a
 * corrected contract while its own token emitter still wrote the removed claims into a
 * SHIPPING token file, and two of its checks were vacuous because they named parts that
 * no longer existed. This guard is E1's answer, and it earned its place before it was
 * written: two surfaces — a token description and a board caption — were still carrying a
 * claim E1 had already withdrawn when this file was created.
 *
 * It reads the SHIPPED ARTEFACTS BACK FROM DISK. It does not read the source that wrote
 * them, and it does not read rule text.
 *
 * Two kinds of assertion:
 *   FORBIDDEN — a string that must appear nowhere, because it states something withdrawn.
 *   COUNTED   — a figure a document states, checked against the JSON that produced it.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

/** Everything E1 SHIPS as prose or as tokens. `vendor/` is excluded: it is other packages'
 *  text, byte-identical on purpose, and E1 must not rewrite it. */
function shipped() {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const rel = relative(PKG, p).replace(/\\/g, '/');
      // vendor/ is other packages' text and must stay byte-identical.
      // data/E1_CONSISTENCY.json is THIS GUARD'S OWN REPORT: a report about withdrawn
      // claims has to be able to name them, and scanning it would make the guard flag
      // itself the moment it found anything. Excluded by path, not by a heuristic.
      if (rel.startsWith('vendor/') || rel.startsWith('.build') || rel.startsWith('fonts/')
        || rel === 'data/E1_CONSISTENCY.json') continue;
      if (e.isDirectory()) walk(p);
      else if (/\.(md|json)$/.test(e.name)) out.push({ rel, text: readFileSync(p, 'utf8') });
    }
  };
  walk(PKG);
  return out;
}

/**
 * Each row: a string that must appear NOWHERE, and why it was withdrawn. The `probeText`
 * is a sentence that MUST be caught, fed to the same matcher on every run — so the guard
 * is proved in both directions rather than only by what it accepts.
 *
 * MATCHING IS CASE-INSENSITIVE, and that is not a convenience. Every needle here is a
 * CLAIM, and a claim does not stop being the same claim because a document states it in
 * a sentence rather than in a heading. A row may supply its own `re` where the claim has
 * more than one wording.
 */
const rx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

const FORBIDDEN = [
  /* ---------------------------------------------- I-08B3.1-E1R — the three revisions */
  {
    needle: 'A DISABLED CONTROL IS NOT FOCUSABLE',
    re: /a disabled control (is not|can never be) focusable|disabled controls are not focusable/i,
    label: 'REV-01 — disabled focusability frozen as a universal',
    why: 'WITHDRAWN. DISABLED describes AVAILABILITY. Focusability is decided by the control pattern and by whether the control must remain discoverable, and E1R ships two patterns. W3C APG: screen reader users are far less likely to discover disabled elements that are not focusable. Check R26 asserts the shipped patterns; this catches the prose half.',
    probeText: 'a disabled control is not focusable, is not in the tab ring, and states the reason it is unavailable',
    allow: ['docs/E1R_REVISION_RECORD.md'],
  },
  {
    needle: 'no channel is used by two states',
    re: /no channel is used (by two states|twice)|the one-channel rule/i,
    label: 'REV-02 — the exclusivity rule about visual channels',
    why: 'WITHDRAWN AS FALSE, not as unhelpful. SELECTED writes the ink and DISABLED writes the ink. The expressions were right and the explanation was not. Replaced by the composition / ownership model, which declares the INK channel shared and resolves it by precedence rule P1. Check R28 derives the writers from the shipped matrix and rejects any model that claims exclusivity the matrix contradicts.',
    probeText: 'THE ONE-CHANNEL RULE: each state owns a different visual channel and no channel is used twice',
    allow: ['docs/E1R_REVISION_RECORD.md'],
  },
  {
    needle: 'FOUR STATUS ROLES AND ONE STATUS COLOUR',
    re: /(has|have) four status roles and one status colour|four status ROLES and ONE status COLOUR/i,
    label: 'REV-03 — the number of status hues frozen as a cap',
    why: 'WITHDRAWN. What is defensible is that a hue is EARNED and that QANDEEL uses no generic traffic-light palette. The COUNT was an absolute about every status role QANDEEL will ever have, frozen on the evidence of one of them. Check R29 reads the shipped product-contract list.',
    probeText: 'QANDEEL HAS FOUR STATUS ROLES AND ONE STATUS COLOUR. Error is the only role that must interrupt.',
    allow: ['docs/E1R_REVISION_RECORD.md'],
  },
  {
    needle: 'BRASS-BEARING OBJECT … HAS A DISABLED STATE',
    re: /no brass-bearing object( in qandeel)? has a disabled state/i,
    label: 'the universal navigation and entitlement law E1 made',
    why: 'WITHDRAWN as a Product law E1 had no authority to make; there is no canonical navigation or capability architecture that proves persistent destinations can never be unavailable, and the navigation morphology itself is an open reconciliation between two tracks. NARROWED to what actually is frozen: LIVING BRASS IS STATE-INVARIANT in value and in appearance, so E1R supplies no unavailable expression for a Brass-bearing object and does not claim the Product can never need one.',
    probeText: 'NO BRASS-BEARING OBJECT IN QANDEEL HAS A DISABLED STATE. An identity object that must become unavailable is absent or empty-stated.',
    allow: ['docs/E1R_REVISION_RECORD.md', 'docs/E1_DISABLED_COLLISION_RESOLUTION.md'],
  },
  {
    needle: 'a persistent navigation destination is never unavailable',
    re: /a (persistent )?(navigation )?destination that exists is reachable|persistent navigation destination is never unavailable/i,
    label: 'the reasoning that produced the universal law, restated as fact',
    why: 'WITHDRAWN with the law it supported. It may be true; nothing in the canonical record establishes it, and E1R is not the package that gets to decide it.',
    probeText: 'A persistent navigation destination is never unavailable: a destination that exists is reachable.',
    allow: ['docs/E1R_REVISION_RECORD.md', 'docs/E1_DISABLED_COLLISION_RESOLUTION.md'],
  },
  /* ---------------------------------------------------- inherited from I-08B3.1-E1 -- */
  {
    needle: 'never be mistaken for a meaning event by measurement',
    label: 'the press wash proved by composited chroma',
    why: 'WITHDRAWN. The chroma-ceiling claim about the press wash could not fail: at these alphas over a near-black ground almost any wash composites to a nearly achromatic value. R11 checks the CHAIN.',
    probeText: 'the pressed ground can never be mistaken for a meaning event by measurement, not merely by rule',
  },
  {
    needle: 'sits close enough to the rest-state ink',
    label: 'the C2/C3 restatement of the disabled collision, asserted rather than quoted',
    why: 'WITHDRAWN as a statement of the collision E1 had to solve. It does not survive measurement — check R15. E1 may DISCUSS the claim, so this needle is scoped to the assertive form and the discussion quotes it with attribution.',
    probeText: 'the disabled ink sits close enough to the rest-state ink to be argued with',
    allow: ['docs/E1_DISABLED_COLLISION_RESOLUTION.md', 'docs/E1_VALIDATION_RESULTS.md', 'data/E1_VALIDATION.json', 'data/E1_DERIVATION.json'],
  },
  {
    needle: 'RESERVED AND DELIBERATELY EMPTY',
    label: 'the state and status groups still described as empty',
    why: 'C3 was right to say it; a surface E1 SHIPS that still says it has not picked up E1. Check R08 asserts the resolved group description, and this catches the prose half.',
    probeText: 'qandeel.state is RESERVED AND DELIBERATELY EMPTY',
    allow: ['docs/E1_TOKEN_ARCHITECTURE.md', 'docs/E1_VALIDATION_RESULTS.md', 'data/E1_VALIDATION.json'],
  },
  {
    needle: 'E1 adds two colours',
    label: 'E1 described as adding two colours',
    why: 'WRONG SHAPE. E1 adds ONE colour plus one extension of the frozen reading ramp, and the distinction is the whole of why the second value is not a status colour.',
    probeText: 'E1 adds two colours to QANDEEL',
  },
  {
    needle: 'tritanopia floor',
    label: 'tritanopia used as a derived floor',
    why: 'WITHDRAWN. Tritan is excluded from every derived floor because the single-plane model is not validated for it.',
    probeText: 'the tritanopia floor is 0.05129',
  },
];

function run() {
  const files = shipped();
  const checks = [], probes = [];

  for (const f of FORBIDDEN) {
    const re = f.re ?? rx(f.needle);
    const hits = files.filter((x) => re.test(x.text) && !(f.allow ?? []).includes(x.rel)).map((x) => x.rel);
    checks.push({ label: f.label, needle: f.needle, pass: hits.length === 0, hits, why: f.why, allowed: f.allow ?? [] });
    probes.push({ needle: f.needle, fired: re.test(f.probeText),
      detail: 'a sentence stating the claim is caught: "' + f.probeText.slice(0, 78) + '"' });
  }

  // ---- COUNTED. Every figure below is read from the JSON that produced it. -----------
  const rd = (p) => JSON.parse(readFileSync(join(PKG, p), 'utf8'));
  const V = rd('data/E1_VALIDATION.json');
  const D = rd('data/E1_DERIVATION.json');
  const S = rd('data/E1_SKILLS.json');
  const VEN = rd('data/E1_VENDOR.json');
  const F = existsSync(join(PKG, 'data/E1_FOCUS.json')) ? rd('data/E1_FOCUS.json') : { obligations: [] };
  const B = existsSync(join(PKG, 'data/E1_BOARDS.json')) ? rd('data/E1_BOARDS.json') : { boards: [] };

  const COUNTED = [
    ['checks', `${V.summary.passed} / ${V.summary.checks}`, ['docs/E1_FREEZE_CANDIDATE.md']],
    ['probes fired', `${V.summary.fired} / ${V.summary.probes}`, ['docs/E1_FREEZE_CANDIDATE.md']],
    ['behavioural obligations', `${F.obligations.filter((o) => o.pass).length} / ${F.obligations.length}`, ['docs/E1_FREEZE_CANDIDATE.md']],
    ['dichromacy property tests', `${D.selfCheck.length}`, ['docs/E1_FREEZE_CANDIDATE.md', 'docs/E1_COLOUR_DERIVATION.md']],
    ['boards', `${B.boards.length}`, ['docs/E1_FREEZE_CANDIDATE.md']],
    ['vendored artefacts', `${VEN.entries.length}`, ['docs/E1_FREEZE_CANDIDATE.md']],
    ['skills inventoried', `${S.inventoried}`, ['docs/E1_FREEZE_CANDIDATE.md']],
    ['the error hex', D.ERROR.hex, ['docs/E1_FREEZE_CANDIDATE.md', 'docs/E1_COLOUR_DERIVATION.md', 'docs/E1_DESIGN_RATIONALE.md', 'README.md']],
    ['the unavailable hex', D.DISABLED.hex, ['docs/E1_FREEZE_CANDIDATE.md', 'docs/E1_COLOUR_DERIVATION.md', 'docs/E1_DESIGN_RATIONALE.md', 'README.md']],
  ];
  const counted = COUNTED.map(([what, value, where]) => {
    const missing = where.filter((w) => {
      const f = files.find((x) => x.rel === w);
      return !f || !f.text.includes(value);
    });
    return { what, value, where, pass: missing.length === 0, missing };
  });

  return { generatedBy: 'tools/e1-consistency.mjs', filesScanned: files.length, forbidden: checks, probes, counted };
}

export { run };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = run();
  (await import('node:fs')).writeFileSync(join(PKG, 'data/E1_CONSISTENCY.json'), JSON.stringify(r, null, 2) + '\n');
  console.log(r.filesScanned + ' shipped .md and .json files scanned (vendor/ excluded — it is other packages’ text)\n');
  for (const c of r.forbidden) {
    console.log((c.pass ? 'CLEAN ' : 'STALE ') + '"' + c.needle + '"' + (c.hits.length ? '  ->  ' + c.hits.join(', ') : ''));
    if (!c.pass) console.log('        ' + c.why);
  }
  console.log('');
  for (const p of r.probes) console.log((p.fired ? 'FIRED ' : 'SILENT') + ' probe for "' + p.needle + '"');
  console.log('');
  for (const c of r.counted) console.log((c.pass ? 'AGREES' : 'DIVERGES') + '  ' + c.what.padEnd(26) + c.value.padEnd(14) + (c.pass ? 'in ' + c.where.length + ' document(s)' : 'MISSING FROM ' + c.missing.join(', ')));
  const bad = r.forbidden.filter((c) => !c.pass).length + r.counted.filter((c) => !c.pass).length + r.probes.filter((p) => !p.fired).length;
  console.log('\n' + r.forbidden.filter((c) => c.pass).length + '/' + r.forbidden.length + ' clean, ' +
    r.counted.filter((c) => c.pass).length + '/' + r.counted.length + ' figures agree, ' +
    r.probes.filter((p) => p.fired).length + '/' + r.probes.length + ' probes fired');
  if (bad) process.exit(1);
}
