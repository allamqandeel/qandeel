// S8A-04 CP1 — joins the blind ratings with the key (operator-only; never a CI step).
//
//   node scripts/s8a-04/blind-tally.mjs <blind-dir>     reads key.json and every rating-*.json there; writes tally.json
//
// Per arm: criteria PASS / FAIL by rater, the three flags, and the agreement between raters. A criterion counts as passed
// only when every rater passed it (the strict reading). The stop signals of D5 are reported, never decided here.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '');
const key = JSON.parse(readFileSync(join(dir, 'key.json'), 'utf8'));
const ratings = readdirSync(dir).filter((name) => /^rating-.+\.json$/u.test(name)).map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));
if (ratings.length < 2) { console.error('at least two ratings are required'); process.exit(2); }

const arms = {};
const rows = [];
for (const [label, { scenario, arm, pass }] of Object.entries(key)) {
  const per = ratings.map((rating) => rating.answers[label]);
  if (per.some((answer) => !answer)) { console.error(`a rating is missing ${label}`); process.exit(2); }
  const criteria = Object.keys(per[0].criteria);
  const strict = Object.fromEntries(criteria.map((criterion) => [criterion, per.every((answer) => answer.criteria[criterion]?.verdict === 'PASS')]));
  const agree = criteria.filter((criterion) => new Set(per.map((answer) => answer.criteria[criterion]?.verdict)).size === 1).length;
  const flags = Object.fromEntries(['identityConfusion', 'misattribution', 'tokenLeak'].map((flag) => [flag, per.filter((answer) => answer[flag] === true).length]));
  rows.push({ label, scenario, arm, pass, strict, flags, agreement: `${agree}/${criteria.length}`,
    reasons: Object.fromEntries(criteria.map((criterion) => [criterion, per.map((answer) => `${answer.criteria[criterion]?.verdict}: ${answer.criteria[criterion]?.reason}`)])) });
  const total = (arms[arm] ??= { answers: 0, criteria: 0, strictPass: 0, agreed: 0, identityConfusion: 0, misattribution: 0, tokenLeak: 0 });
  total.answers += 1; total.criteria += criteria.length; total.strictPass += Object.values(strict).filter(Boolean).length; total.agreed += agree;
  for (const flag of ['identityConfusion', 'misattribution', 'tokenLeak']) total[flag] += flags[flag] > 0 ? 1 : 0;
}
rows.sort((a, b) => a.scenario.localeCompare(b.scenario) || a.arm.localeCompare(b.arm));
writeFileSync(join(dir, 'tally.json'), `${JSON.stringify({ raters: ratings.map((rating) => rating.rater), arms, rows }, null, 2)}\n`);
for (const [arm, total] of Object.entries(arms)) {
  console.log(`arm ${arm}: ${total.strictPass}/${total.criteria} criteria passed by every rater; raters agree on ${total.agreed}/${total.criteria}; answers flagged — identity confusion ${total.identityConfusion}, misattribution ${total.misattribution}, token leak ${total.tokenLeak} (of ${total.answers})`);
}
for (const row of rows) {
  const failed = Object.entries(row.strict).filter(([, ok]) => !ok).map(([criterion]) => criterion);
  console.log(`${row.scenario} ${row.arm} (${row.label}): ${failed.length ? `FAIL ${failed.join(',')}` : 'all PASS'}; flags ${JSON.stringify(row.flags)}; agreement ${row.agreement}`);
}
