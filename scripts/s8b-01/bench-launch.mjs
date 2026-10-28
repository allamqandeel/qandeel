// S8B-01 — operator launcher for the voice benchmark (Product Owner S8B-00 D-3). Never a CI step.
//
//   node scripts/s8b-01/bench-launch.mjs --plan-check    verifies the preregistered plan: corpus hashes, the USD 10 cap and
//                                                       its split, the lock; sends nothing
//   node scripts/s8b-01/bench-launch.mjs --simulate      the zero-cost rehearsal: the whole scoring path against simulated
//                                                       providers, under the guard (loopback only); writes
//                                                       artifacts/evals/s8b-01/simulated/report.json (gitignored)
//   node scripts/s8b-01/bench-launch.mjs --live --confirm <runId>
//                                                       CP2: the ONE approved live run (cp2-approval.json). Refused unless
//                                                       the plan is authorized, the approval is APPROVED with this plan's
//                                                       hash and <runId>, the tracked tree is clean, the run has not run
//                                                       before, and both keys are available. Keys reach the child's
//                                                       environment only; they are never printed, logged or written.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
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

/** The CP2 live run. Every refusal happens before anything is sent. */
function launchLive(plan, args) {
  const refuse = (why) => { console.error(`S8B-01: --live is refused: ${why}. Nothing was sent.`); return 3; };
  if (plan.guard.authorized !== true) return refuse('the benchmark is not authorized (CP1 lock)');
  const approvalFile = join(HERE, 'cp2-approval.json');
  const approval = existsSync(approvalFile) ? JSON.parse(readFileSync(approvalFile, 'utf8')) : null;
  if (!approval || approval.status !== 'APPROVED') return refuse('there is no unconsumed Product Owner approval');
  if (approval.planSha256 !== sha256Normalized(join(HERE, 'bench-plan.json'))) return refuse('the plan differs from the approved plan hash');
  const confirm = args[0] === '--confirm' ? args[1] : null;
  if (confirm !== approval.runId) return refuse(`the run must be confirmed explicitly with --confirm ${approval.runId}`);
  const runDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'live', approval.runId);
  if (existsSync(runDir)) return refuse(`run ${approval.runId} has already run (one run per approval)`);
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' });
  if (dirty.status !== 0 || dirty.stdout.trim()) return refuse('the tracked tree is not clean (the code under test must be exactly a commit)');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  const deepseekFile = join(homedir(), '.qandeel', 'deepseek-api-key.txt');
  const deepseek = existsSync(deepseekFile) ? readFileSync(deepseekFile, 'ascii').trim() : '';
  // The Gemini key is a Windows user variable set by the Product Owner; read it into memory only.
  let gemini = process.env.GEMINI_API_KEY ?? '';
  if (!gemini && process.platform === 'win32') {
    gemini = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')"],
      { encoding: 'utf8', windowsHide: true }).stdout?.trim() ?? '';
  }
  if (deepseek.length < 20) return refuse('the DeepSeek key file is missing or too short');
  if (gemini.length < 20) return refuse('GEMINI_API_KEY is not available');
  mkdirSync(runDir, { recursive: true });
  console.log(`S8B-01 CP2 live run ${approval.runId} at ${head} (cap USD ${plan.guard.costCapUsd}; one run; no retry).`);
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'spend-guard.cjs'), join(HERE, 'cp2-run.mjs'), runDir], {
    cwd: REPO, stdio: 'inherit',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_MODE: 'live', QANDEEL_S8B_RUN_ID: approval.runId,
      QANDEEL_S8B_STATE_FILE: join(runDir, 'spend-state.json'), QANDEEL_S8B_HEAD: head, GEMINI_API_KEY: gemini, DEEPSEEK_API_KEY: deepseek },
  });
  console.log(`S8B-01 CP2 run directory: ${runDir}`);
  return child.status ?? 1;
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
  if (mode === '--live') process.exit(launchLive(plan, process.argv.slice(3)));
  if (mode !== '--simulate' && mode !== '--live') {
    console.error('usage: bench-launch.mjs --plan-check | --simulate | --live --confirm <runId>');
    process.exit(64);
  }
  const out = join(REPO, 'artifacts', 'evals', 's8b-01', mode === '--simulate' ? 'simulated' : 'live', 'report.json');
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'spend-guard.cjs'), join(HERE, 'bench-run.mjs'), out], {
    cwd: REPO, stdio: 'inherit', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_MODE: mode.slice(2) },
  });
  if (child.status === 0) console.log(`S8B-01 report: ${out}`);
  process.exit(child.status ?? 1);
}
