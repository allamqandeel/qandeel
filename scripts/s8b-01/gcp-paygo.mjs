// S8B-01 CP2 — the Google Cloud PayGo check (the Product Owner's order, 2026-10-28). Operator-only; never a CI step and
// never imported by production code. It is not a CP2 re-run: cp2-approval.json is CONSUMED and stays so.
//
//   node scripts/s8b-01/gcp-paygo.mjs --plan-check            the plan's structural rules and the approval's state; sends nothing
//   node scripts/s8b-01/gcp-paygo.mjs --live --confirm <runId>  the ONE approved check: two streamed requests (one per model)
//                                                             through spend-guard.cjs (QANDEEL_S8B_CHECK=gcp-paygo)
//
// The credential is an OAuth access token from Application Default Credentials (`gcloud auth application-default
// print-access-token`). The launcher holds it in memory and passes it only to the guarded child; it is never printed,
// logged or written. No API key, no service-account key, no new project or billing account.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Normalized } from './bench-launch.mjs';
import { worstAudioSeconds } from './cp2-providers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/** Every structural rule of the check's plan; returns the violations (empty = valid). */
export function checkGcpPlan(plan) {
  const problems = [];
  const g = plan.guard;
  if (!(g.costCapUsd > 0 && g.costCapUsd <= 0.25)) problems.push('the cap must be at most the proposed USD 0.25');
  if (Math.abs(Object.values(g.budgetUsd).reduce((a, b) => a + b, 0) - g.costCapUsd) > 1e-9) problems.push('the budget split differs from the cap');
  if (g.noAutomaticRetry !== true) problems.push('automatic retry must be off');
  if (JSON.stringify(Object.values(g.allowedHosts)) !== JSON.stringify(['aiplatform.googleapis.com'])) problems.push('the only host is aiplatform.googleapis.com');
  if (JSON.stringify(g.liveKeys) !== JSON.stringify(['GOOGLE_CLOUD_ACCESS_TOKEN'])) problems.push('the only credential is the ADC access token');
  if (g.maxCalls !== 2 || plan.models.length !== 2) problems.push('exactly two calls, one per model');
  if (plan.location !== 'global') problems.push('the 3.8 TTS models are served in the global location only');
  return problems;
}

/** The streamGenerateContent URL for one model. */
export const gcpEndpoint = (plan, modelId) => plan.api.endpoint.replace('{project}', plan.project).replace('{model}', modelId);

/** The documented request: the text verbatim, audio out, a prebuilt voice; nothing the 3.8 TTS models reject. */
export function gcpRequestBody(text, voice) {
  return JSON.stringify({
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice } } },
  });
}

/** Cost from Gemini usage at one price card (input as text tokens, candidates as audio tokens). */
export function gcpUsd(prices, usage) {
  const input = Number(usage?.promptTokenCount ?? 0);
  const output = Number(usage?.candidatesTokenCount ?? 0);
  return (input * prices.inputText + output * prices.outputAudio) / 1e6;
}

/** The worst case of one call, at the list price: every request byte as a text token, and the bounded audio. */
export function gcpWorstUsd(model, body, text, tokensPerSecond = 25) {
  return (Buffer.byteLength(body) * model.listUsdPerMillion.inputText
    + Math.ceil(worstAudioSeconds(text) * tokensPerSecond) * model.listUsdPerMillion.outputAudio) / 1e6;
}

/**
 * Parses a block of Server-Sent Events text: returns the complete events' JSON payloads and the unparsed remainder.
 * Each event is `data: {...}` followed by a blank line.
 */
export function parseSse(buffer) {
  const events = [];
  const blocks = buffer.split(/\r?\n\r?\n/u);
  const rest = blocks.pop();
  for (const block of blocks) {
    const data = block.split(/\r?\n/u).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
    if (data) events.push(JSON.parse(data));
  }
  return { events, rest };
}

/** The audio parts of one streamed response chunk: [{ pcm: Buffer, sampleRate }]. */
export function audioParts(event) {
  const parts = event?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => p.inlineData?.data).map((p) => ({
    pcm: Buffer.from(p.inlineData.data, 'base64'),
    sampleRate: Number(/rate=(\d+)/u.exec(p.inlineData.mimeType ?? '')?.[1] ?? 24000),
  }));
}

function launchLive(plan, args) {
  const refuse = (why) => { console.error(`S8B-01 gcp-paygo: --live is refused: ${why}. Nothing was sent.`); return 3; };
  const file = join(HERE, 'gcp-paygo-approval.json');
  const approval = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (!approval || approval.status !== 'APPROVED') return refuse('there is no unconsumed Product Owner approval for the paid check');
  if (approval.planSha256 !== sha256Normalized(join(HERE, 'gcp-paygo-plan.json'))) return refuse('the plan differs from the approved plan hash');
  if ((args[0] === '--confirm' ? args[1] : null) !== approval.runId) return refuse(`the check must be confirmed explicitly with --confirm ${approval.runId}`);
  const runDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'gcp-paygo', approval.runId);
  if (existsSync(runDir)) return refuse(`${approval.runId} has already run (one run per approval)`);
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' });
  if (dirty.status !== 0 || dirty.stdout.trim()) return refuse('the tracked tree is not clean');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  // ADC: the token is read into memory only (stdout captured, stderr discarded).
  const t = spawnSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', ['auth', 'application-default', 'print-access-token'],
    { encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'] });
  const token = t.status === 0 ? (t.stdout ?? '').trim() : '';
  if (token.length < 20) return refuse('no Application Default Credentials access token (gcloud missing, or not logged in)');
  mkdirSync(runDir, { recursive: true });
  console.log(`S8B-01 gcp-paygo check ${approval.runId} at ${head} (cap USD ${plan.guard.costCapUsd}; two calls; no retry).`);
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'spend-guard.cjs'), join(HERE, 'gcp-paygo-run.mjs'), runDir], {
    cwd: REPO, stdio: 'inherit',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_CHECK: 'gcp-paygo', QANDEEL_S8B_MODE: 'live',
      QANDEEL_S8B_RUN_ID: approval.runId, QANDEEL_S8B_STATE_FILE: join(runDir, 'spend-state.json'), QANDEEL_S8B_HEAD: head,
      GOOGLE_CLOUD_ACCESS_TOKEN: token },
  });
  console.log(`S8B-01 gcp-paygo run directory: ${runDir}`);
  return child.status ?? 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const plan = JSON.parse(readFileSync(join(HERE, 'gcp-paygo-plan.json'), 'utf8'));
  const problems = checkGcpPlan(plan);
  if (problems.length) { console.error(`S8B-01 gcp-paygo plan check FAILED:\n- ${problems.join('\n- ')}`); process.exit(2); }
  const mode = process.argv[2];
  if (mode === '--plan-check') {
    const approval = JSON.parse(readFileSync(join(HERE, 'gcp-paygo-approval.json'), 'utf8'));
    const body = gcpRequestBody(plan.text, plan.voice);
    const worst = plan.models.map((m) => `${m.id} ≤ USD ${gcpWorstUsd(m, body, plan.text, plan.audioTokensPerSecond).toFixed(5)}`);
    console.log(`S8B-01 gcp-paygo plan check passed (cap USD ${plan.guard.costCapUsd}; worst case ${worst.join(', ')}; plan ${sha256Normalized(join(HERE, 'gcp-paygo-plan.json'))}; approval ${approval.status}).`);
    process.exit(0);
  }
  if (mode === '--live') process.exit(launchLive(plan, process.argv.slice(3)));
  console.error('usage: gcp-paygo.mjs --plan-check | --live --confirm <runId>');
  process.exit(64);
}
