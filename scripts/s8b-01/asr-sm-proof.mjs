// S8B-01 CP2 — the final ASR engineering proof (the Product Owner's review of 2026-10-28, record §9.18 / §9.19).
// Operator-only; never imported by production code.
//
//   node scripts/s8b-01/asr-sm-proof.mjs --plan-check                the plan, the 12 sessions, the endpoints, the cut table
//   node scripts/s8b-01/asr-sm-proof.mjs --live --confirm <runId>    ONE approved run, under spend-guard.cjs (QANDEEL_S8B_CHECK=asr-sm-proof)
//
// Speechmatics Enhanced ar_en only, max_delay 0.7, Speechmatics' own end-of-utterance trigger off: QANDEEL's endpoint is
// a causal VAD on the audio as it is sent, which FINALIZES the text (ForceEndOfUtterance) after `finalizeSilenceMs` of
// silence, at a thinking pause too. COMMITTING the turn is a separate, longer silence, decided by the Orchestrator and
// computed here locally, so a fast final never cuts the user. 12 sessions on the Product Owner's existing recordings:
// 6 OVERLAP (two clean lines, each mixed locally with QANDEEL's voice three ways) and 6 LATENCY (lines with pauses, a
// self-correction, hesitation and numbers). A synthetic mix is not a proof of the phone's echo canceller.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecordingScript, poLines } from './asr-recording-sheet.mjs';
import { KEY_FILE, fileSha256, readAnyWav, sessionCeilingUsd, speechBounds } from './asr-sm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PLAN_FILE = join(HERE, 'asr-sm-proof-plan.json');
const APPROVAL_FILE = join(HERE, 'asr-sm-proof-approval.json');
const bytesSha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const nn = (n) => String(n).padStart(2, '0');

/**
 * QANDEEL's endpoint stand-in: a causal energy VAD on 20 ms frames (it reads only audio already sent). Speech arms it
 * after `minSpeechMs`; `silenceMs` of silence then gives an endpoint at that instant, and it re-arms on new speech.
 * Returns [{ atMs, speechEndMs }]: the decision instant and where the silence began.
 */
export function causalEndpoints(pcm, rate, { frameMs = 20, threshold = 300, minSpeechMs = 100, silenceMs }) {
  const w = Math.round((rate * frameMs) / 1000);
  const out = [];
  let speechRun = 0;
  let armed = false;
  let silentSince = null;
  for (let i = 0, k = 0; i + w <= pcm.length; i += w, k += 1) {
    let s = 0;
    for (let j = 0; j < w; j += 1) s += pcm[i + j] * pcm[i + j];
    const loud = Math.sqrt(s / w) >= threshold;
    const endMs = (k + 1) * frameMs;
    if (loud) {
      speechRun += frameMs;
      silentSince = null;
      if (speechRun >= minSpeechMs) armed = true;
    } else {
      speechRun = 0;
      silentSince ??= k * frameMs;
      if (armed && endMs - silentSince >= silenceMs) { out.push({ atMs: endMs, speechEndMs: silentSince }); armed = false; }
    }
  }
  return out;
}

/** Linear resampling (the QANDEEL file is 24 kHz; the recordings are 16 kHz). */
export function resample(pcm, from, to) {
  if (from === to) return Int16Array.from(pcm);
  const n = Math.floor((pcm.length * to) / from);
  const o = new Int16Array(n);
  for (let i = 0; i < n; i += 1) { const x = (i * from) / to; const k = Math.floor(x); const f = x - k; o[i] = Math.round((pcm[k] ?? 0) * (1 - f) + (pcm[k + 1] ?? 0) * f); }
  return o;
}

const rmsOver = (pcm, a, b) => { let s = 0; for (let i = a; i < b; i += 1) s += pcm[i] * pcm[i]; return Math.sqrt(s / Math.max(1, b - a)); };

/** RMS of the 20 ms frames at or above `threshold`: a voice's level while it speaks. */
export function activeRms(pcm, rate, threshold = 300) {
  const w = Math.round(rate / 50);
  let s = 0;
  let n = 0;
  for (let i = 0; i + w <= pcm.length; i += w) { const r = rmsOver(pcm, i, i + w); if (r >= threshold) { s += r * r * w; n += w; } }
  return n ? Math.sqrt(s / n) : 0;
}

/**
 * The speech with QANDEEL's voice added `levelDb` relative to the speech's own level (speech RMS between its measured
 * onset and offset; QANDEEL's active RMS), from the first sample, until `untilMs` (then a 10 ms fade; null = to the end).
 */
export function mixOverlap(speech, rate, qandeel, { levelDb, untilMs = null }) {
  const b = speechBounds(speech, rate);
  const target = rmsOver(speech, Math.round((b.onsetMs * rate) / 1000), Math.round((b.offsetMs * rate) / 1000)) * 10 ** (levelDb / 20);
  const gain = target / activeRms(qandeel, rate);
  const stop = untilMs === null ? speech.length : Math.min(speech.length, Math.round((untilMs * rate) / 1000));
  const fade = Math.round(rate / 100);
  const out = new Int16Array(speech.length);
  let clipped = 0;
  for (let i = 0; i < speech.length; i += 1) {
    const g = i < stop ? 1 : i < stop + fade ? 1 - (i - stop) / fade : 0;
    const v = speech[i] + (g > 0 ? (qandeel[i] ?? 0) * gain * g : 0);
    if (Math.abs(v) > 32767) clipped += 1;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
  }
  return { pcm: out, gain, clipped };
}

/** The 12 sessions: each one's audio, its endpoints (the forces) and its speech bounds, all built locally. */
export function proofSessions(plan, corpusDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'corpus')) {
  const lines = new Map(poLines(loadRecordingScript(HERE)).map((l) => [Number(l.n), l]));
  const wav = (n) => readAnyWav(readFileSync(join(corpusDir, 'PO', 'wav', `${nn(n)}.wav`)));
  const q24 = readAnyWav(readFileSync(join(REPO, plan.inputs.qandeelVoice.file)));
  const out = [];
  // The endpoints are computed on what is sent (the audio and its tail silence) and, for an overlap mix, on the clean
  // speech: on the phone the VAD runs after the echo canceller, so QANDEEL's own voice never arms it (§2, §4.4).
  const endpointsOf = (vadPcm, rate) => {
    const padded = new Int16Array(vadPcm.length + Math.round((rate * plan.audio.tailSilenceMs) / 1000));
    padded.set(vadPcm);
    return causalEndpoints(padded, rate, { ...plan.endpoint.vad, silenceMs: plan.endpoint.finalizeSilenceMs })
      .map((f) => ({ ...f, timestampS: Number((f.speechEndMs / 1000).toFixed(2)) }));
  };
  const add = (set, n, variant, pcm, rate, extra = {}) => {
    const { vadPcm = pcm, ...rest } = extra;
    const bounds = speechBounds(vadPcm, rate);
    out.push({ id: `${set}_${nn(n)}_${variant}`, set, n, variant, line: lines.get(n), pcm, rate, bounds, forces: endpointsOf(vadPcm, rate), ms: Math.round((pcm.length / rate) * 1000), ...rest });
  };
  for (const n of plan.sets.overlap.lines) {
    const { rate, pcm } = wav(n);
    const q = resample(q24.pcm, q24.rate, rate);
    const b = speechBounds(pcm, rate);
    for (const v of plan.sets.overlap.variants) {
      const m = mixOverlap(pcm, rate, q, { levelDb: v.levelDb, untilMs: v.untilOnsetPlusMs === undefined ? null : b.onsetMs + v.untilOnsetPlusMs });
      add('OVERLAP', n, v.id, m.pcm, rate, { vadPcm: pcm, clipped: m.clipped });
    }
  }
  for (const n of plan.sets.latency.lines) { const { rate, pcm } = wav(n); add('LATENCY', n, 'CLEAN', pcm, rate); }
  return out;
}

/** Which recordings a commit silence of `ms` would cut (an endpoint before the speech really ends), locally. */
export function cutTable(plan, corpusDir, thresholds) {
  const rows = {};
  for (const ms of thresholds) {
    rows[ms] = [];
    for (let n = 1; n <= 20; n += 1) {
      const { rate, pcm } = readAnyWav(readFileSync(join(corpusDir, 'PO', 'wav', `${nn(n)}.wav`)));
      const b = speechBounds(pcm, rate);
      const ends = causalEndpoints(pcm, rate, { ...plan.endpoint.vad, silenceMs: ms });
      if (ends.some((e) => e.speechEndMs < b.offsetMs - plan.endpoint.vad.frameMs)) rows[ms].push(nn(n));
    }
  }
  return rows;
}

const txt = (m) => (m.metadata?.transcript ?? '').trim();
const words = (s) => /[\p{L}\p{N}]/u.test(s);

/**
 * One session's proof measures, on the audio clock: each force's response (the forced EndOfUtterance after the force was
 * sent; Speechmatics' own trigger is off, so every EndOfUtterance answers a force); the forces at a pause inside the
 * sentence; text ready (the EndOfUtterance answering the first force at the real speech end, after that end); the last
 * word's final after the speech end; the first partial after the onset.
 */
export function proofMetrics(events, forcesSent, forcesPlanned, bounds, frameMs = 20) {
  const finals = events.filter((m) => m.message === 'AddTranscript' && txt(m));
  const eous = events.filter((m) => m.message === 'EndOfUtterance');
  const answer = (t) => eous.find((m) => m.t >= t) ?? null;
  const responses = forcesSent.map((f) => { const a = answer(f.t); return a ? a.t - f.t : null; });
  const endIdx = forcesPlanned.findIndex((f) => f.speechEndMs >= bounds.offsetMs - frameMs);
  const endAnswer = endIdx >= 0 && forcesSent[endIdx] ? answer(forcesSent[endIdx].t) : null;
  const lastWord = finals.filter((m) => words(txt(m))).at(-1);
  const partial = events.find((m) => m.message === 'AddPartialTranscript' && txt(m));
  return {
    transcript: finals.map(txt).join(' ').replace(/\s+/gu, ' ').trim(),
    forceResponsesMs: responses,
    midForces: forcesPlanned.filter((f) => f.speechEndMs < bounds.offsetMs - frameMs).length,
    forcedFlags: eous.filter((m) => m.forced === true).length, // Speechmatics puts `forced` on the message, not in metadata (§9.20)
    textReadyMs: endAnswer ? endAnswer.t - bounds.offsetMs : null,
    lastWordFinalMs: lastWord ? lastWord.t - bounds.offsetMs : null,
    firstPartialMs: partial ? partial.t - bounds.onsetMs : null,
  };
}

const pct = (xs, p) => { const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))] : null; };
const parse = (x) => (typeof x === 'string' ? (x ? JSON.parse(x) : null) : x);

/** The baseline's passed checks still pass (a true stays true, item by item). */
export function checksHeld(baseline = {}, now = {}) {
  return Object.entries(baseline).every(([k, v]) => (Array.isArray(v) ? v.every((b, i) => !b || now?.[k]?.[i] === true) : !v || now?.[k] === true));
}

/** The preregistered verdict (plan.acceptance); every item is reported, passed or not. */
export function proofVerdict(rows, plan) {
  const a = plan.acceptance;
  const r = rows.map((x) => ({ ...x, force_response_ms: parse(x.force_response_ms), checks: parse(x.checks), word_errors: x.word_errors === '' ? null : Number(x.word_errors ?? NaN) }));
  const base = (x) => plan.baseline[nn(x.n)];
  const gated = r.filter((x) => x.set === 'LATENCY' || a.overlapGatedVariants.includes(x.variant));
  const lat = r.filter((x) => x.set === 'LATENCY');
  const ov = r.filter((x) => x.set === 'OVERLAP' && a.overlapGatedVariants.includes(x.variant));
  const responses = lat.flatMap((x) => x.force_response_ms ?? []);
  const ready = lat.map((x) => (x.text_ready_ms === '' ? null : Number(x.text_ready_ms)));
  const accurate = (x) => x.status === 'OK' && x.word_errors <= base(x).wordErrors + a.maxExtraWordErrors;
  const items = [
    [`every gated session ran and returned a transcript (${gated.length} of ${plan.sessions - plan.sets.overlap.lines.length * a.reportedOnlyVariants.length})`,
      gated.length === plan.sessions - plan.sets.overlap.lines.length * a.reportedOnlyVariants.length && gated.every((x) => x.status === 'OK')],
    [`overlap (${a.overlapGatedVariants.join(', ')}): at most ${a.maxExtraWordErrors} word error more than the clean line in §9.17`, ov.length > 0 && ov.every(accurate)],
    [`latency lines: at most ${a.maxExtraWordErrors} word error more than §9.17, no word or number lost`, lat.length > 0 && lat.every(accurate)],
    ['latency lines: every check that passed in §9.17 still passes (numbers, the intended word, English)', lat.length > 0 && lat.every((x) => checksHeld(base(x).checks, x.checks))],
    [`ForceEndOfUtterance answered, p50 ≤ ${a.forceResponseP50MaxMs} ms`, responses.length > 0 && responses.every((x) => x !== null) && pct(responses, 50) <= a.forceResponseP50MaxMs],
    [`text ready after the speech end (E + A), p50 ≤ ${a.textReadyP50MaxMs} ms`, ready.every((x) => x !== null) && pct(ready, 50) <= a.textReadyP50MaxMs],
  ].map(([rule, passed]) => ({ rule, passed }));
  return {
    passed: items.every((i) => i.passed), items,
    measured: {
      forceResponseMs: { p50: pct(responses, 50), p95: pct(responses, 95), n: responses.length },
      textReadyMs: { p50: pct(ready, 50), p95: pct(ready, 95) },
      lastWordFinalMs: { p50: pct(lat.map((x) => Number(x.last_word_final_ms)), 50) },
      firstPartialMs: { p50: pct(r.map((x) => Number(x.first_partial_ms)), 50) },
      midSentenceForces: lat.reduce((s, x) => s + Number(x.mid_forces ?? 0), 0),
      reportedOnly: r.filter((x) => a.reportedOnlyVariants.includes(x.variant)).map((x) => ({ id: x.id, status: x.status, wordErrors: x.word_errors, refWords: x.ref_words })),
    },
  };
}

/** Every structural rule of the plan (empty = valid). */
export function checkProofPlan(plan, here = HERE, corpusDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'corpus')) {
  const p = [];
  const g = plan.guard ?? {};
  if (plan.provider !== 'SPEECHMATICS') p.push('Speechmatics only');
  if (!(g.costCapUsd > 0 && g.costCapUsd <= 0.1)) p.push('the cap is at most USD 0.10 (Product Owner)');
  if (JSON.stringify(Object.values(g.allowedHosts ?? {})) !== JSON.stringify(['eu.rt.speechmatics.com'])) p.push('the EU real-time host only');
  if (JSON.stringify(g.liveKeys) !== JSON.stringify(['SPEECHMATICS_API_KEY'])) p.push('the only credential is the Speechmatics API key');
  if (plan.endpointUrl !== 'wss://eu.rt.speechmatics.com/v2') p.push('the EU real-time endpoint');
  const arms = plan.arms ?? [];
  const c = arms[0]?.transcriptionConfig ?? {};
  if (arms.length !== 1 || c.model !== 'enhanced' || c.language !== 'ar_en') p.push('one arm only: Enhanced ar_en (Product Owner)');
  if (c.max_delay !== 0.7 || c.enable_partials !== true) p.push('max_delay 0.7 with partials (Product Owner)');
  if (c.conversation_config?.end_of_utterance_silence_trigger !== 0) p.push("Speechmatics' own end-of-utterance trigger is off: QANDEEL's endpoint alone");
  const e = plan.endpoint ?? {};
  if (e.authority !== 'QANDEEL_VAD_FORCE_END_OF_UTTERANCE' || !(e.finalizeSilenceMs > 0) || !(e.vad?.threshold > 0)) p.push('the VAD + ForceEndOfUtterance endpoint');
  if (plan.scope?.preliminarySingleSpeaker !== true || plan.scope?.deviceAecProofDeferred !== true) p.push('single speaker, and the device echo-canceller proof deferred to the device phase');
  const sets = plan.sets ?? {};
  if (sets.overlap?.lines?.length * sets.overlap?.variants?.length !== 6 || sets.latency?.lines?.length !== 6) p.push('12 sessions: 6 overlap, 6 latency (Product Owner)');
  if (sets.overlap?.lines?.includes(20) || sets.latency?.lines?.includes(20)) p.push('sample 20 is not repeated (Product Owner)');
  if (plan.sessions !== 12) p.push('sessions = 12');
  if (plan.inputs?.scriptSha256 !== fileSha256(join(here, 'corpus', 'asr-cp2-recording-script.json'))) p.push('the recording script hash');
  if (existsSync(join(corpusDir, 'PO', 'wav'))) {
    for (const [k, h] of Object.entries(plan.inputs?.recordings ?? {})) {
      const f = join(corpusDir, 'PO', 'wav', `${k}.wav`);
      if (!existsSync(f) || bytesSha256(f) !== h) p.push(`recording ${k} differs from the pinned WAV`);
    }
    const q = join(REPO, plan.inputs?.qandeelVoice?.file ?? '');
    if (!existsSync(q) || bytesSha256(q) !== plan.inputs.qandeelVoice.sha256) p.push("QANDEEL's voice file differs from the pinned one");
  }
  const used = [...(sets.overlap?.lines ?? []), ...(sets.latency?.lines ?? [])].map(nn);
  if (!used.every((k) => plan.inputs?.recordings?.[k])) p.push('every used recording is pinned');
  if (!used.every((k) => plan.baseline?.[k])) p.push('every used line has its §9.17 baseline');
  const worst = plan.sessions * sessionCeilingUsd(plan, arms[0] ?? { pricePerHourUsd: 0 }, plan.audio.maxLineSeconds * 1000);
  if (worst > g.costCapUsd) p.push(`every session at its ceiling (USD ${worst.toFixed(4)}) must fit the cap`);
  return p;
}

function launchLive(plan, args) {
  const refuse = (why) => { console.error(`S8B-01 asr-sm-proof: --live is refused: ${why}. Nothing was sent.`); return 3; };
  const approval = existsSync(APPROVAL_FILE) ? JSON.parse(readFileSync(APPROVAL_FILE, 'utf8')) : null;
  if (!approval || approval.status !== 'APPROVED') return refuse('there is no unconsumed Product Owner approval for the run');
  if (approval.planSha256 !== fileSha256(PLAN_FILE)) return refuse('the plan differs from the approved plan hash');
  if (approval.modelTrainingOff !== true) return refuse('the Product Owner has not confirmed that model training is off');
  if ((args[0] === '--confirm' ? args[1] : null) !== approval.runId) return refuse(`the run must be confirmed explicitly with --confirm ${approval.runId}`);
  const runDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'asr', approval.runId);
  if (existsSync(runDir)) return refuse(`${approval.runId} has already run (one run per approval)`);
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' });
  if (dirty.status !== 0 || dirty.stdout.trim()) return refuse('the tracked tree is not clean');
  if (!existsSync(KEY_FILE)) return refuse('no Speechmatics API key in the per-user key file');
  const key = readFileSync(KEY_FILE, 'utf8').trim();
  if (key.length < 16) return refuse('the per-user key file does not hold a key');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  mkdirSync(join(runDir, 'sessions'), { recursive: true });
  console.log(`S8B-01 asr-sm-proof run ${approval.runId} at ${head} (cap USD ${plan.guard.costCapUsd}; ${plan.sessions} sessions; no retry).`);
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'spend-guard.cjs'), join(HERE, 'asr-sm-proof-run.mjs'), runDir], {
    cwd: REPO, stdio: 'inherit',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_CHECK: 'asr-sm-proof', QANDEEL_S8B_MODE: 'live',
      QANDEEL_S8B_RUN_ID: approval.runId, QANDEEL_S8B_STATE_FILE: join(runDir, 'spend-state.json'), QANDEEL_S8B_HEAD: head, SPEECHMATICS_API_KEY: key },
  });
  console.log(`S8B-01 asr-sm-proof run directory: ${runDir}`);
  return child.status ?? 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf8'));
  const problems = checkProofPlan(plan);
  if (problems.length) { console.error(`S8B-01 asr-sm-proof plan check FAILED:\n- ${problems.join('\n- ')}`); process.exit(2); }
  const mode = process.argv[2];
  if (mode === '--plan-check') {
    const corpus = join(REPO, 'artifacts', 'evals', 's8b-01', 'corpus');
    const sessions = proofSessions(plan, corpus);
    const approval = JSON.parse(readFileSync(APPROVAL_FILE, 'utf8'));
    const worst = plan.sessions * sessionCeilingUsd(plan, plan.arms[0], plan.audio.maxLineSeconds * 1000);
    const expected = sessions.reduce((s, x) => s + ((x.ms + plan.audio.tailSilenceMs + 1000) / 3.6e6) * plan.arms[0].pricePerHourUsd, 0);
    console.log(JSON.stringify({ check: 'passed', sessions: sessions.length, capUsd: plan.guard.costCapUsd, worstCaseUsd: Number(worst.toFixed(4)), expectedUsd: Number(expected.toFixed(4)),
      plan: sessions.map((x) => ({ id: x.id, seconds: x.ms / 1000, speech: [x.bounds.onsetMs, x.bounds.offsetMs], forcesAtMs: x.forces.map((f) => f.atMs), clipped: x.clipped ?? 0 })),
      commitCutTable: cutTable(plan, corpus, plan.endpoint.commitSilenceCandidatesMs),
      keyFilePresent: existsSync(KEY_FILE), planSha256: fileSha256(PLAN_FILE), approval: approval.status }, null, 1));
    process.exit(0);
  }
  if (mode === '--live') process.exit(launchLive(plan, process.argv.slice(3)));
  console.error('usage: asr-sm-proof.mjs --plan-check | --live --confirm <runId>');
  process.exit(64);
}
