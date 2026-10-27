// S8A-05 CP4 — Tier Q: the blind rating packet and the final tally (operator-only; no network; never a CI step).
//
//   node scripts/s8a-05/cp4/tier-q-score.mjs --packet <results.json>                         → <dir>/packet.json
//   node scripts/s8a-05/cp4/tier-q-score.mjs --tally <results.json> <raterA.json> <raterB.json> [<audit.json>]
//
// The packet holds, per item, the case and the answer only: no mode, head, path, latency, usage or provider detail, in a fixed
// order that is not the case order. A rater sheet is {"items": {"<item>": {"A": "YES|NO|UNSURE|N/A", ...}}}; the Product
// Owner's audit, {"<item>": {"<code>": "YES|NO", "why": "…"}} for the disputed codes (RATER_RUBRIC.md). The verdict is
// ACCEPTED only when the deterministic half was met by the run and every rubric criterion holds.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const cases = new Map(read(join(HERE, 'tier-q-cases.json')).cases.map((c) => [c.id, c]));
const itemOf = (id) => `item-${createHash('sha256').update(`s8a-05-cp4-tier-q:${id}`).digest('hex').slice(0, 8)}`;
const CODES = ['A', 'K', 'I', 'Q', 'L', 'R', 'F'];
const [mode, resultsPath, ...sheets] = process.argv.slice(2);
if (!['--packet', '--tally'].includes(mode) || !resultsPath) { console.error('usage: --packet <results> | --tally <results> <raterA> <raterB> [<audit>]'); process.exit(2); }
const results = read(resultsPath);

if (mode === '--packet') {
  const items = results.answers.map((answer) => {
    const c = cases.get(answer.id);
    return { item: itemOf(answer.id), kind: c.kind, topic: c.topic, posts: c.posts, earlierAnswers: c.earlierAnswers, expect: c.expect, answer: answer.reply ?? 'NO_ANSWER' };
  }).sort((a, b) => a.item.localeCompare(b.item));
  const out = join(dirname(resultsPath), 'packet.json');
  writeFileSync(out, JSON.stringify({ rubric: 'scripts/s8a-05/cp4/RATER_RUBRIC.md', items }, null, 2));
  console.log(`packet: ${items.length} items → ${out}`);
  process.exit(0);
}

if (sheets.length < 2) { console.error('the tally needs two rater sheets'); process.exit(2); }
const [a, b] = [read(sheets[0]).items, read(sheets[1]).items];
const audit = sheets[2] ? read(sheets[2]) : {};
const ids = results.answers.map((answer) => answer.id);
const disputed = [];
/** The final verdict on one code: both raters agree (no UNSURE) → theirs; otherwise the audit's, or UNRESOLVED. */
const final = (id, code) => {
  const item = itemOf(id);
  const [x, y] = [a[item]?.[code], b[item]?.[code]];
  if (x === y && x !== 'UNSURE' && x !== undefined) return x;
  const audited = audit[item]?.[code];
  if (audited === 'YES' || audited === 'NO') return audited;
  disputed.push(`${item}:${code}`);
  return 'UNRESOLVED';
};
const count = (code, pred, scope = ids) => scope.filter((id) => pred(final(id, code))).length;
const corrections = ids.filter((id) => cases.get(id).kind === 'correction');
const tally = {
  A: { yes: count('A', (v) => v === 'YES'), of: ids.length, accept: 27 },
  K: { yes: count('K', (v) => v === 'YES', corrections), of: corrections.length, accept: 5 },
  I: { failures: count('I', (v) => v !== 'YES'), accept: 0 },
  Q: { yes: count('Q', (v) => v === 'YES'), of: ids.length, accept: 26 },
  L: { yes: count('L', (v) => v === 'YES'), of: ids.length, accept: 28 },
  R: { yes: count('R', (v) => v === 'YES'), of: ids.length, accept: 25 },
  F: { failures: count('F', (v) => v !== 'NO'), accept: 0 },
};
const met = Object.fromEntries(Object.entries(tally).map(([code, t]) => [code, 'yes' in t ? t.yes >= t.accept : t.failures <= t.accept]));
const verdict = disputed.length ? 'PENDING AUDIT' : results.deterministicMet && Object.values(met).every(Boolean) ? 'ACCEPTED' : 'NOT ACCEPTED';
console.log(JSON.stringify({ deterministicMet: results.deterministicMet, incomplete: results.incomplete, tally, met, disputed, codes: CODES, verdict }, null, 2));
