// S8B-01 CP2 — the full Gemini TTS evaluation on Google Cloud (the Product Owner's order, 2026-10-28). Operator-only;
// never a CI step and never imported by production code.
//
//   node scripts/s8b-01/cp2-cloud.mjs --plan-check            the plan's rules, the corpus hashes, the automated review of
//                                                           the work list (refused while it finds a defect), the call count
//                                                           and the worst / expected cost; sends nothing
//   node scripts/s8b-01/cp2-cloud.mjs --live --confirm <runId>  the ONE approved run, through spend-guard.cjs
//                                                           (QANDEEL_S8B_CHECK=cp2-cloud)
//
// The credential is the ADC access token, held in memory and passed only to the guarded child; never printed, logged
// or written.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Normalized } from './bench-launch.mjs';
import { worstAudioSeconds } from './cp2-providers.mjs';
import { buildWork, countBy, interleave, loadCorpora, reviewWork } from './cp2-worklist.mjs';
import { audioParts, gcpRequestBody, gcpWorstUsd, parseSse } from './gcp-paygo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/** The run's calls, in order, after the review; throws on a defect so nothing defective is ever sent. */
export function cloudCalls(plan, here = HERE) {
  const corpora = loadCorpora(here);
  const work = buildWork(corpora);
  const defects = reviewWork(work, corpora.setItems);
  if (defects.length) throw new Error(`S8B_01_CLOUD: the work list has defects:\n- ${defects.join('\n- ')}`);
  return interleave(work, plan.models.map((m) => m.id), plan.voices);
}

/** Every structural rule of the plan; returns the violations (empty = valid). */
export function checkCloudPlan(plan, here = HERE) {
  const problems = [];
  const g = plan.guard;
  if (!(g.costCapUsd > 0 && g.costCapUsd <= 2)) problems.push('the cap must be at most the proposed USD 2');
  if (Math.abs(Object.values(g.budgetUsd).reduce((a, b) => a + b, 0) - g.costCapUsd) > 1e-9) problems.push('the budget split differs from the cap');
  if (g.noAutomaticRetry !== true) problems.push('automatic retry must be off');
  if (JSON.stringify(Object.values(g.allowedHosts)) !== JSON.stringify(['aiplatform.googleapis.com'])) problems.push('the only host is aiplatform.googleapis.com');
  if (JSON.stringify(g.liveKeys) !== JSON.stringify(['GOOGLE_CLOUD_ACCESS_TOKEN'])) problems.push('the only credential is the ADC access token');
  if (JSON.stringify(plan.models.map((m) => m.id)) !== JSON.stringify(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'])) problems.push('the two Product Owner models only');
  if (JSON.stringify(plan.voices) !== JSON.stringify(['Achird', 'Sulafat'])) problems.push('the voices Achird and Sulafat');
  if (plan.location !== 'global') problems.push('the 3.8 TTS models are served in global only');
  for (const [file, expected] of Object.entries(plan.corpusSha256)) if (sha256Normalized(join(here, file)) !== expected) problems.push(`corpus hash mismatch: ${file}`);
  try {
    const calls = cloudCalls(plan, here);
    if (calls.length !== plan.workList.calls || calls.length / 4 !== plan.workList.entries) problems.push(`the work list has ${calls.length} calls, the plan says ${plan.workList.calls}`);
    const arms = countBy(calls.filter((c) => c.model === plan.models[0].id && c.voice === plan.voices[0]), (c) => c.arm);
    const sorted = (o) => JSON.stringify(Object.entries(o).sort());
    if (sorted(arms) !== sorted(plan.workList.byArm)) problems.push(`the arms differ from the plan: ${JSON.stringify(arms)}`);
  } catch (e) {
    problems.push(e.message);
  }
  return problems;
}

/**
 * The cost of the run. Worst case: each call at its own bound (the stream is cancelled there), at the list price — the
 * sum the guard could ever admit before the cap stops it. Expected: the CP2 r1 audio rate (0.103 audio seconds per
 * character, both models' median) at 25 tokens / s, and about half a token per input character.
 */
export function cloudCost(plan, calls) {
  const out = { worstListUsd: 0, expectedListUsd: 0, expectedPromotionalUsd: 0 };
  for (const c of calls) {
    const model = plan.models.find((m) => m.id === c.model);
    out.worstListUsd += gcpWorstUsd(model, gcpRequestBody(c.text, c.voice, c.style), c.text, plan.audioTokensPerSecond);
    const audio = [...c.text].length * 0.103 * plan.audioTokensPerSecond;
    const input = ([...c.text].length + (c.style?.length ?? 0)) * 0.5;
    out.expectedListUsd += (input * model.listUsdPerMillion.inputText + audio * model.listUsdPerMillion.outputAudio) / 1e6;
    out.expectedPromotionalUsd += (input * model.promotionalUsdPerMillion.inputText + audio * model.promotionalUsdPerMillion.outputAudio) / 1e6;
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Number(v.toFixed(4))]));
}

/**
 * One streamed synthesis: POST, then the SSE audio parts as they arrive. Measures time to headers and to the first audio
 * byte, the end, the audio seconds, the arrivals (for playback stalls) and the largest gap; cancels at the audio bound;
 * never retries. The caller reserves before and settles after.
 */
export async function gcpStream({ url, body, token, project, boundSeconds }) {
  const out = { status: null, error: null, headersMs: null, firstAudioMs: null, endMs: null, audioSeconds: 0, chunks: 0, maxGapMs: 0,
    arrivals: [], usage: null, cancelledAtBound: false, pcm: [], sampleRate: 24000 };
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': project } });
    out.status = res.status;
    out.headersMs = Math.round(performance.now() - t0);
    if (!res.ok) {
      out.error = `HTTP ${res.status}: ${(await res.text()).replace(/\s+/gu, ' ').slice(0, 400)}`;
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let last = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const parsed = parseSse(buffer + decoder.decode(value, { stream: true }));
        buffer = parsed.rest;
        for (const ev of parsed.events) {
          if (ev.usageMetadata) out.usage = ev.usageMetadata;
          if (ev.error) out.error = `stream error: ${JSON.stringify(ev.error).slice(0, 400)}`;
          for (const a of audioParts(ev)) {
            const now = performance.now() - t0;
            out.firstAudioMs ??= Math.round(now);
            if (last !== null) out.maxGapMs = Math.max(out.maxGapMs, Math.round(now - last));
            last = now;
            out.sampleRate = a.sampleRate;
            out.pcm.push(a.pcm);
            const ms = (a.pcm.length / 2 / a.sampleRate) * 1000;
            out.arrivals.push([now, ms]);
            out.audioSeconds += ms / 1000;
            out.chunks += 1;
          }
        }
        if (out.audioSeconds > boundSeconds) { out.cancelledAtBound = true; await reader.cancel(); break; }
      }
    }
  } catch (e) {
    out.error = `${e.code ?? e.name}: ${e.message}`.slice(0, 400);
  }
  out.endMs = Math.round(performance.now() - t0);
  return out;
}

function launchLive(plan, args) {
  const refuse = (why) => { console.error(`S8B-01 cp2-cloud: --live is refused: ${why}. Nothing was sent.`); return 3; };
  const file = join(HERE, 'cp2-cloud-approval.json');
  const approval = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (!approval || approval.status !== 'APPROVED') return refuse('there is no unconsumed Product Owner approval for the run');
  if (approval.planSha256 !== sha256Normalized(join(HERE, 'cp2-cloud-plan.json'))) return refuse('the plan differs from the approved plan hash');
  if ((args[0] === '--confirm' ? args[1] : null) !== approval.runId) return refuse(`the run must be confirmed explicitly with --confirm ${approval.runId}`);
  const runDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'cloud', approval.runId);
  if (existsSync(runDir)) return refuse(`${approval.runId} has already run (one run per approval)`);
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' });
  if (dirty.status !== 0 || dirty.stdout.trim()) return refuse('the tracked tree is not clean');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  const t = spawnSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', ['auth', 'application-default', 'print-access-token'],
    { encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'] });
  const token = t.status === 0 ? (t.stdout ?? '').trim() : '';
  if (token.length < 20) return refuse('no Application Default Credentials access token (gcloud missing, or not logged in)');
  mkdirSync(join(runDir, 'audio'), { recursive: true });
  console.log(`S8B-01 cp2-cloud run ${approval.runId} at ${head} (cap USD ${plan.guard.costCapUsd}; ${plan.workList.calls} calls; no retry).`);
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'spend-guard.cjs'), join(HERE, 'cp2-cloud-run.mjs'), runDir], {
    cwd: REPO, stdio: 'inherit',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_CHECK: 'cp2-cloud', QANDEEL_S8B_MODE: 'live',
      QANDEEL_S8B_RUN_ID: approval.runId, QANDEEL_S8B_STATE_FILE: join(runDir, 'spend-state.json'), QANDEEL_S8B_HEAD: head,
      GOOGLE_CLOUD_ACCESS_TOKEN: token },
  });
  console.log(`S8B-01 cp2-cloud run directory: ${runDir}`);
  return child.status ?? 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const plan = JSON.parse(readFileSync(join(HERE, 'cp2-cloud-plan.json'), 'utf8'));
  const problems = checkCloudPlan(plan);
  if (problems.length) { console.error(`S8B-01 cp2-cloud plan check FAILED:\n- ${problems.join('\n- ')}`); process.exit(2); }
  const mode = process.argv[2];
  if (mode === '--plan-check') {
    const calls = cloudCalls(plan);
    const approval = JSON.parse(readFileSync(join(HERE, 'cp2-cloud-approval.json'), 'utf8'));
    console.log(JSON.stringify({ check: 'passed', defects: 0, calls: calls.length, byModelVoice: countBy(calls, (c) => `${c.model}|${c.voice}`),
      byCategory: countBy(calls, (c) => c.category), cost: cloudCost(plan, calls), capUsd: plan.guard.costCapUsd,
      maxBoundSeconds: Math.max(...calls.map((c) => worstAudioSeconds(c.text))), planSha256: sha256Normalized(join(HERE, 'cp2-cloud-plan.json')),
      approval: approval.status }, null, 1));
    process.exit(0);
  }
  if (mode === '--live') process.exit(launchLive(plan, process.argv.slice(3)));
  console.error('usage: cp2-cloud.mjs --plan-check | --live --confirm <runId>');
  process.exit(64);
}
