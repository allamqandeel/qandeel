// S8A-05 CP3 — Tier S: the raters' packet and the final tally (RATER_RUBRIC.md; operator-only; no network; never a CI step).
//
//   node scripts/s8a-05/cp3/tier-s-score.mjs --packet <live.json> <packet out>
//   node scripts/s8a-05/cp3/tier-s-score.mjs --tally  <live.json> <R1 sheet> <R2 sheet> [<audit.json>]
//
// The packet is blind: the package text and QANDEEL's proposal, never the expected labels, the region weights, a score or
// another rater's sheet; a compound shows the author's secondary meaning and the definitions of the sub-regions named.
// The tally applies RATER_RUBRIC.md §3 exactly, then joins the deterministic half the driver already computed.
// Only a live, complete run is rated; QANDEEL_S8A05_TALLY_REHEARSAL=1 admits a simulated run, for the harness rehearsal only.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const cases = new Map(JSON.parse(readFileSync(join(HERE, 'tier-s-cases.json'), 'utf8')).cases.map((c) => [c.id, c]));
const regionsTs = readFileSync(join(HERE, '..', '..', '..', 'apps', 'api', 'src', 'public-world', 'public-semantic-regions.ts'), 'utf8');
const definitions = new Map([...regionsTs.matchAll(/^\s*sub\('([a-z_.]+)', \d+, -?\d+, -?\d+, ['"](.*)['"]\),$/gmu)].map((m) => [m[1], m[2]]));
const [flag, resultsPath, ...rest] = process.argv.slice(2);
const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
if (results.mode !== 'live' && !process.env.QANDEEL_S8A05_TALLY_REHEARSAL) throw new Error('only a live run is rated');
if (results.incomplete !== null) throw new Error('an incomplete run is never rated');

if (flag === '--packet') {
  const packet = results.proposals.map((p) => {
    const c = cases.get(p.id);
    if (p.proposal === null) return { id: p.id, compound: p.compound, packageText: c.packageText, proposal: 'NO_PROPOSAL' };
    const { meaning, primaryThemes, secondaryThemes, explanation } = p.proposal;
    return { id: p.id, compound: p.compound, packageText: c.packageText, proposal: { meaning, primaryThemes, secondaryThemes, explanation },
      ...(p.compound ? { secondaryMeaning: c.compound.secondaryMeaning,
        namedSubRegions: p.proposal.placementIntent.regions.map((r) => definitions.get(r.key)) } : {}) };
  });
  writeFileSync(rest[0], `${JSON.stringify({ schema: 'QANDEEL_S8A05_CP3_TIER_S_RATER_PACKET_V1', cases: packet }, null, 2)}\n`);
  console.log(`packet: ${packet.length} cases -> ${rest[0]}`);
} else if (flag === '--tally') {
  const [r1, r2] = rest.slice(0, 2).map((path) => new Map(JSON.parse(readFileSync(path, 'utf8')).ratings.map((row) => [row.id, row])));
  const audit = rest[2] ? JSON.parse(readFileSync(rest[2], 'utf8')).overturned ?? [] : [];
  const overturned = (id, rater, q) => audit.find((a) => a.id === id && a.rater === rater && a.question === q && typeof a.reason === 'string' && a.reason.length > 0)?.to;
  const answer = (sheet, rater, id, q) => overturned(id, rater, q) ?? sheet.get(id)?.[q] ?? null;
  const ids = results.proposals.map((p) => p.id);
  const compounds = results.proposals.filter((p) => p.compound).map((p) => p.id);
  const both = (id, q, value) => answer(r1, 'R1', id, q) === value && answer(r2, 'R2', id, q) === value;
  const fabricated = (id) => ['R1', 'R2'].some((rater) => ['YES', 'UNSURE'].includes(answer(rater === 'R1' ? r1 : r2, rater, id, 'A')));
  const perRater = (sheet) => ({ F: ids.filter((id) => sheet.get(id)?.F === 'YES').length, A: ids.filter((id) => ['YES', 'UNSURE'].includes(sheet.get(id)?.A)).length,
    C: compounds.filter((id) => sheet.get(id)?.C === 'YES').length });
  const fidelity = ids.filter((id) => both(id, 'F', 'YES')).length;
  const fabrication = ids.filter(fabricated);
  const compoundCarried = compounds.filter((id) => both(id, 'C', 'YES')).length;
  const byLanguage = Object.fromEntries(['EGY', 'FUSHA', 'EN', 'MIXED'].map((language) => {
    const rows = ids.filter((id) => cases.get(id).language === language);
    return [language, { cases: rows.length, bothYes: rows.filter((id) => both(id, 'L', 'YES')).length }];
  }));
  const ratersMet = fidelity >= 72 && fabrication.length === 0 && compoundCarried >= 8;
  const out = {
    raters: { R1: perRater(r1), R2: perRater(r2) }, overturned: audit.length,
    fidelity: { bothYes: fidelity, of: 80, accept: '>= 72' }, fabrication: { count: fabrication.length, ids: fabrication, accept: '0' },
    compoundCarried: { bothYes: compoundCarried, of: compounds.length, accept: '>= 8' }, language: byLanguage,
    ratersMet, deterministicAccepted: results.deterministicAccepted, accepted: ratersMet && results.deterministicAccepted === true,
    audit: ids.flatMap((id) => ['R1', 'R2'].flatMap((rater) => {
      const row = (rater === 'R1' ? r1 : r2).get(id) ?? {};
      return [row.F === 'NO' && 'F', ['YES', 'UNSURE'].includes(row.A) && 'A', row.C === 'NO' && 'C'].filter(Boolean).map((q) => ({ id, rater, question: q, cite: row.cite ?? null }));
    })),
  };
  console.log(JSON.stringify(out, null, 2));
  console.log(out.accepted ? 'ACCEPTED' : 'NOT ACCEPTED');
} else {
  console.error('usage: tier-s-score.mjs --packet <live.json> <out> | --tally <live.json> <R1> <R2> [<audit>]');
  process.exit(2);
}
