// S8B-01 — operator launcher for the voice benchmark (Product Owner S8B-00 D-3). Never a CI step.
//
//   node scripts/s8b-01/bench-launch.mjs --plan-check    verifies the preregistered plan: corpus hashes, the USD 10 cap and
//                                                       its split, the lock; sends nothing
//   node scripts/s8b-01/bench-launch.mjs --simulate      the zero-cost rehearsal: the whole scoring path against simulated
//                                                       providers, under the guard (loopback only); writes
//                                                       artifacts/evals/s8b-01/simulated/report.json (gitignored)
//   node scripts/s8b-01/bench-launch.mjs --live          refused while bench-plan.json guard.authorized is false (CP1)
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/** SHA-256 of a text file with line endings normalized (Windows checkouts are CRLF, CI is LF). */
export function sha256Normalized(file) {
  return createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/gu, '\n')).digest('hex');
}

/** Every structural rule of the preregistered plan; returns the list of violations (empty = valid). */
export function checkPlan(plan, here = HERE) {
  const problems = [];
  for (const [file, expected] of Object.entries(plan.corpusSha256)) {
    const actual = sha256Normalized(join(here, file));
    if (actual !== expected) problems.push(`corpus hash mismatch: ${file}`);
  }
  const split = Object.values(plan.guard.budgetUsd).reduce((sum, usd) => sum + usd, 0);
  if (Math.abs(split - plan.guard.costCapUsd) > 1e-9) problems.push(`budget split ${split} != cap ${plan.guard.costCapUsd}`);
  if (plan.guard.costCapUsd > 10) problems.push('cost cap exceeds the Product Owner\'s USD 10 (D-3)');
  if (plan.guard.noAutomaticRetry !== true) problems.push('automatic retry must be off');
  const { p50Ms, p95Ms } = plan.latency.target;
  if (!(p50Ms === 1500 && p95Ms === 2500)) problems.push('latency target differs from D-6');
  if (plan.latency.stages.map((s) => s.symbol).join('') !== 'EAPTGRSN') problems.push('latency stages differ from the contract (§11)');
  return problems;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const plan = JSON.parse(readFileSync(join(HERE, 'bench-plan.json'), 'utf8'));
  const mode = process.argv[2];
  const problems = checkPlan(plan);
  if (problems.length) {
    console.error(`S8B-01 plan check FAILED:\n- ${problems.join('\n- ')}`);
    process.exit(2);
  }
  if (mode === '--plan-check') {
    console.log(`S8B-01 plan check passed (cap USD ${plan.guard.costCapUsd}; lock ${plan.guard.authorized ? 'LIFTED' : 'ON'}).`);
    process.exit(0);
  }
  if (mode === '--live' && plan.guard.authorized !== true) {
    console.error('S8B-01: --live is refused: the benchmark is not authorized (CP1 lock). Nothing was sent.');
    process.exit(3);
  }
  if (mode !== '--simulate' && mode !== '--live') {
    console.error('usage: bench-launch.mjs --plan-check | --simulate | --live');
    process.exit(64);
  }
  const out = join(REPO, 'artifacts', 'evals', 's8b-01', mode === '--simulate' ? 'simulated' : 'live', 'report.json');
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'spend-guard.cjs'), join(HERE, 'bench-run.mjs'), out], {
    cwd: REPO, stdio: 'inherit', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_MODE: mode.slice(2) },
  });
  if (child.status === 0) console.log(`S8B-01 report: ${out}`);
  process.exit(child.status ?? 1);
}
