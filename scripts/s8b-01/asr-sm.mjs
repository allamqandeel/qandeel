// S8B-01 CP2 — the Speechmatics real-time ASR test (the Product Owner's Speechmatics order, 2026-10-28). Operator-only;
// never imported by production code.
//
//   node scripts/s8b-01/asr-sm.mjs --plan-check                 the plan, the recording set and the recordings present
//   node scripts/s8b-01/asr-sm.mjs --live --confirm <runId>     ONE approved run, under spend-guard.cjs (QANDEEL_S8B_CHECK=asr-sm)
//
// Consenting human recordings only (corpus/asr-cp2-recording-script.json, set `core`), streamed at real-time pace to the
// Speechmatics real-time WebSocket in the EU region, one session per line and arm; no retry. The API key is read from the
// per-user key file into memory and passed only to the guarded child; it is never printed, logged or written.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorRates, normalizeArabic } from './arabic-text-metrics.mjs';
import { fileName, loadRecordingScript, referenceOf, sessionLines } from './asr-recording-sheet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
export const KEY_FILE = join(homedir(), '.qandeel', 'speechmatics-api-key.txt');
const RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000];
const sha256 = (text) => createHash('sha256').update(text.replace(/\r\n/gu, '\n')).digest('hex');
export const fileSha256 = (p) => sha256(readFileSync(p, 'utf8'));

/** Mono PCM16 of a WAV: PCM 16 / 24 / 32-bit or IEEE float 32-bit, any channel count (averaged), WAVE_FORMAT_EXTENSIBLE too. */
export function readAnyWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('S8B_01_ASR: not a WAV file');
  let p = 12;
  let fmt = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      let tag = buf.readUInt16LE(p + 8);
      if (tag === 0xfffe) tag = buf.readUInt16LE(p + 8 + 24);
      fmt = { tag, channels: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    }
    if (id === 'data') {
      if (!fmt) throw new Error('S8B_01_ASR: no fmt chunk');
      const { tag, channels, rate, bits } = fmt;
      const bytes = bits / 8;
      const read = tag === 3 && bits === 32 ? (o) => buf.readFloatLE(o) * 32767
        : tag === 1 && bits === 16 ? (o) => buf.readInt16LE(o)
          : tag === 1 && bits === 24 ? (o) => buf.readIntLE(o, 3) / 256
            : tag === 1 && bits === 32 ? (o) => buf.readInt32LE(o) / 65536 : null;
      if (!read) throw new Error(`S8B_01_ASR: unsupported WAV format ${tag}/${bits}`);
      const frames = Math.floor(Math.min(size, buf.length - p - 8) / (bytes * channels));
      const pcm = new Int16Array(frames);
      for (let i = 0; i < frames; i += 1) {
        let s = 0;
        for (let c = 0; c < channels; c += 1) s += read(p + 8 + (i * channels + c) * bytes);
        pcm[i] = Math.max(-32768, Math.min(32767, Math.round(s / channels)));
      }
      return { rate, pcm };
    }
    p += 8 + size + (size % 2);
  }
  throw new Error('S8B_01_ASR: no data chunk');
}

/** Speech onset / offset (ms) by frame energy: 20 ms frames, a threshold over the clip's own noise floor. */
export function speechBounds(pcm, rate, { frameMs = 20, minRun = 3 } = {}) {
  const n = Math.round((rate * frameMs) / 1000);
  const rms = [];
  for (let i = 0; i + n <= pcm.length; i += n) {
    let s = 0;
    for (let k = 0; k < n; k += 1) s += pcm[i + k] * pcm[i + k];
    rms.push(Math.sqrt(s / n));
  }
  const floor = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.1)] ?? 0;
  const th = Math.max(floor * 4, 300);
  const loud = rms.map((r) => r >= th);
  let on = -1;
  for (let i = 0; i + minRun <= loud.length; i += 1) if (loud.slice(i, i + minRun).every(Boolean)) { on = i; break; }
  let off = -1;
  for (let i = loud.length - 1; i >= minRun - 1; i -= 1) if (loud.slice(i - minRun + 1, i + 1).every(Boolean)) { off = i + 1; break; }
  return on < 0 ? null : { onsetMs: on * frameMs, offsetMs: off * frameMs, thresholdRms: Math.round(th) };
}

/** The StartRecognition message of an arm, at the recording's own sample rate. */
export function startRecognition(arm, rate, vocab = []) {
  if (!RATES.includes(rate)) throw new Error(`S8B_01_ASR: sample rate ${rate} is not sent`);
  const config = structuredClone(arm.transcriptionConfig);
  if (arm.additionalVocab && vocab.length) config.additional_vocab = vocab.map((content) => ({ content }));
  return { message: 'StartRecognition', audio_format: { type: 'raw', encoding: 'pcm_s16le', sample_rate: rate }, transcription_config: config };
}

/** The most one session can cost: its whole wall time (audio, tail silence and the timeout margin) at the arm's hourly price. */
export function sessionCeilingUsd(plan, arm, audioMs) {
  return ((audioMs + plan.audio.tailSilenceMs + plan.audio.sessionTimeoutMarginMs) / 3.6e6) * arm.pricePerHourUsd;
}

/**
 * One real-time session. The audio (plus `tailSilenceMs` of silence) is sent in `chunkMs` binary frames at real-time
 * pace; then EndOfStream. Every server message is kept with `t`, the ms since the first audio frame was sent, which is
 * the audio clock of the recording. For an arm with `forceEndOfUtteranceAfterSilenceMs` (Melia 1 has no silence
 * trigger), the client sends ForceEndOfUtterance that long after the measured speech end, as QANDEEL's own VAD would.
 */
export async function smSession({ url, apiKey, pcm, rate, start, chunkMs = 20, tailSilenceMs = 2000, timeoutMs, forceAtMs = null }) {
  const out = { events: [], error: null, closeCode: null, seqSent: 0, recognitionStartedMs: null };
  const per = Math.round((rate * chunkMs) / 1000);
  const total = new Int16Array(pcm.length + Math.round((rate * tailSilenceMs) / 1000));
  total.set(pcm);
  const t0 = performance.now();
  let audio0 = null;
  const now = () => (audio0 === null ? -1 : Math.round(performance.now() - audio0));
  await new Promise((resolveSession) => {
    let finished = false;
    const finish = (why) => { if (finished) return; finished = true; if (why) out.error ??= why; clearTimeout(timer); try { ws.close(); } catch { /* closed */ } resolveSession(); };
    const timer = setTimeout(() => finish('session timeout'), timeoutMs);
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    ws.binaryType = 'arraybuffer';
    ws.onerror = (e) => finish(`websocket error${e?.message ? `: ${e.message}` : ''}`);
    ws.onclose = (e) => { out.closeCode = e.code; finish(e.code === 1000 ? null : `closed ${e.code}${e.reason ? ` ${e.reason}` : ''}`); };
    ws.onopen = () => ws.send(JSON.stringify(start));
    ws.onmessage = async (e) => {
      if (typeof e.data !== 'string') return;
      const m = JSON.parse(e.data);
      if (m.message === 'AudioAdded') return;
      out.events.push({ t: now(), ...m });
      if (m.message === 'Error') return finish(`${m.type}: ${m.reason ?? ''}`.trim());
      if (m.message === 'EndOfTranscript') return finish(null);
      if (m.message !== 'RecognitionStarted') return;
      out.recognitionStartedMs = Math.round(performance.now() - t0);
      audio0 = performance.now();
      let forced = forceAtMs === null;
      for (let i = 0, k = 0; i < total.length && !finished; i += per, k += 1) {
        const wait = audio0 + k * chunkMs - performance.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        const chunk = total.subarray(i, Math.min(i + per, total.length));
        ws.send(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        out.seqSent += 1;
        if (!forced && k * chunkMs >= forceAtMs) { ws.send(JSON.stringify({ message: 'ForceEndOfUtterance' })); forced = true; }
      }
      if (!finished) ws.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: out.seqSent }));
    };
  });
  out.wallMs = Math.round(performance.now() - t0);
  return out;
}

const text = (m) => (m.metadata?.transcript ?? '').trim();

/**
 * The session's measures, on the audio clock (ms from the recording's start):
 *   firstPartialMs — the first non-empty partial after speech onset;
 *   finalMs        — the last non-empty final after speech end (0 if it came before);
 *   eouMs (E)      — the first EndOfUtterance after speech end;
 *   finalAfterEouMs (A) — the last final after that EndOfUtterance, if any (0 when every final preceded it);
 *   lagMsP50       — a final's arrival after the end of the audio it covers.
 */
export function sessionMetrics(events, bounds) {
  const partials = events.filter((m) => m.message === 'AddPartialTranscript' && text(m));
  const finals = events.filter((m) => m.message === 'AddTranscript' && text(m));
  const eou = events.find((m) => m.message === 'EndOfUtterance' && m.t >= bounds.offsetMs);
  const lastFinal = finals.at(-1);
  const lags = finals.map((m) => m.t - Math.round((m.metadata?.end_time ?? 0) * 1000)).sort((a, b) => a - b);
  return {
    transcript: finals.map(text).join(' ').replace(/\s+/gu, ' ').trim(),
    partials: partials.length,
    finals: finals.length,
    firstPartialMs: partials.length ? partials[0].t - bounds.onsetMs : null,
    finalMs: lastFinal ? Math.max(0, lastFinal.t - bounds.offsetMs) : null,
    eouMs: eou ? eou.t - bounds.offsetMs : null,
    finalAfterEouMs: eou && lastFinal ? Math.max(0, lastFinal.t - eou.t) : null,
    lagMsP50: lags.length ? lags[Math.floor(lags.length / 2)] : null,
    quality: events.find((m) => m.message === 'Info' && m.type === 'recognition_quality')?.quality ?? null,
  };
}

/** English words count once whether written in Latin letters or in a listed Arabic spelling. */
export function canonicalEnglish(s, alternatives = {}) {
  let out = s.toLowerCase();
  for (const [word, spellings] of Object.entries(alternatives)) {
    for (const sp of [...spellings].sort((a, b) => b.length - a.length)) out = out.split(sp).join(` ${word.toLowerCase()} `);
  }
  return out.replace(/[-]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

/** A line's score: WER / CER against its reference, and the checks its item carries (keyterms, digits, intent, English words). */
export function scoreLine(line, item, hypothesis, script, normalization, ownTranscript = null) {
  const ref = line.category === 'SPONTANEOUS' ? ownTranscript : referenceOf(script, line);
  if (!ref) return { scored: false };
  const alt = item?.alternatives ?? {};
  const r = canonicalEnglish(ref, alt);
  const h = canonicalEnglish(hypothesis, alt);
  const rates = errorRates(r, h, normalization);
  const norm = (s) => normalizeArabic(canonicalEnglish(s, alt), normalization);
  const hn = norm(hypothesis);
  const hw = hn.split(' ');
  const checks = {};
  if (item?.keyterms) checks.keyterms = item.keyterms.map((k) => hn.includes(norm(k)));
  // A number counts as heard when its digits or its spoken words (`spoken`, normalized) appear in the transcript.
  if (item?.digits) checks.number = hn.replace(/\s+/gu, '').includes(item.digits) || (item.spoken ? hn.includes(norm(item.spoken)) : false);
  if (item?.intent) checks.intent = hw.includes(norm(item.intent));
  if (Object.keys(alt).length) checks.english = Object.keys(alt).map((w) => hw.includes(w.toLowerCase().split('-')[0]));
  return { scored: true, reference: ref, ...rates, wer: rates.referenceWords ? rates.wordErrors / rates.referenceWords : 0,
    cer: rates.referenceChars ? rates.charErrors / rates.referenceChars : 0, checks };
}

/** Every structural rule of the plan (empty = valid). */
export function checkAsrPlan(plan, here = HERE) {
  const p = [];
  const g = plan.guard ?? {};
  if (plan.provider !== 'SPEECHMATICS') p.push('Speechmatics only (Product Owner)');
  if (!(g.costCapUsd > 0 && g.costCapUsd <= 1)) p.push('the cap is at most USD 1');
  if (JSON.stringify(Object.values(g.allowedHosts ?? {})) !== JSON.stringify(['eu.rt.speechmatics.com'])) p.push('the EU real-time host only');
  if (JSON.stringify(g.liveKeys) !== JSON.stringify(['SPEECHMATICS_API_KEY'])) p.push('the only credential is the Speechmatics API key');
  if (plan.endpoint !== 'wss://eu.rt.speechmatics.com/v2') p.push('the EU real-time endpoint');
  const arms = plan.arms ?? [];
  if (arms.length !== 2 || arms[0].transcriptionConfig?.model !== 'enhanced' || arms[0].transcriptionConfig?.language !== 'ar_en') p.push('arm 1 is Enhanced ar_en, the production candidate');
  if (arms[1]?.transcriptionConfig?.model !== 'melia-1' || arms[1]?.transcriptionConfig?.language !== 'multi') p.push('arm 2 is Melia 1 (multi), the comparison');
  if (!arms.every((a) => a.transcriptionConfig?.enable_partials === true)) p.push('partials on every arm');
  if (arms[1] && arms[1].transcriptionConfig.conversation_config) p.push('Melia 1 rejects end_of_utterance_silence_trigger');
  if (!(arms[1]?.forceEndOfUtteranceAfterSilenceMs > 0)) p.push('Melia 1 needs the client-side ForceEndOfUtterance');
  for (const a of arms) if (!(a.pricePerHourUsd > 0)) p.push(`${a.id}: a price`);
  if (plan.privacy?.modelTrainingMustBeOff !== true || plan.privacy?.realtimeOnly !== true) p.push('model training off and real-time only');
  const { script } = loadRecordingScript(here);
  if (plan.set?.scriptSha256 !== fileSha256(join(here, 'corpus', 'asr-cp2-recording-script.json'))) p.push('the recording script hash');
  if (plan.set?.promptsSha256 !== fileSha256(join(here, 'corpus', 'asr-reading-prompts.json'))) p.push('the reused prompts hash');
  const lines = sessionLines(loadRecordingScript(here), { set: plan.set?.name });
  if (lines.length !== plan.set?.linesPerSpeaker) p.push('the set size');
  if (plan.set?.speakers?.length !== 2) p.push('two speakers, a man and a woman');
  if (plan.set?.sessions !== lines.length * plan.set.speakers.length * arms.length) p.push('sessions = lines × speakers × arms');
  if (!script.consent?.text?.length) p.push('the consent text');
  const worst = plan.set.speakers.length * lines.length * arms.reduce((s, a) => s + sessionCeilingUsd(plan, a, plan.audio.maxLineSeconds * 1000), 0);
  if (worst > g.costCapUsd) p.push(`every session at its ceiling (USD ${worst.toFixed(4)}) must fit the cap`);
  return p;
}

/** The recordings the plan needs, and what is present. */
export function recordingManifest(plan, corpusDir) {
  const data = loadRecordingScript(HERE);
  const lines = sessionLines(data, { set: plan.set.name });
  const out = { present: [], missing: [], invalid: [] };
  for (const speaker of plan.set.speakers) {
    for (const line of lines) {
      const f = join(corpusDir, speaker, `${fileName(speaker, line)}.wav`);
      if (!existsSync(f)) { out.missing.push(`${speaker}/${fileName(speaker, line)}.wav`); continue; }
      try {
        const { rate, pcm } = readAnyWav(readFileSync(f));
        const ms = (pcm.length / rate) * 1000;
        if (!RATES.includes(rate) || ms > plan.audio.maxLineSeconds * 1000 || !speechBounds(pcm, rate)) out.invalid.push(`${speaker}/${fileName(speaker, line)}.wav`);
        else out.present.push({ speaker, line, file: f, ms: Math.round(ms) });
      } catch { out.invalid.push(`${speaker}/${fileName(speaker, line)}.wav`); }
    }
  }
  return out;
}

function launchLive(plan, args) {
  const refuse = (why) => { console.error(`S8B-01 asr-sm: --live is refused: ${why}. Nothing was sent.`); return 3; };
  const file = join(HERE, 'asr-sm-approval.json');
  const approval = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (!approval || approval.status !== 'APPROVED') return refuse('there is no unconsumed Product Owner approval for the run');
  if (approval.planSha256 !== fileSha256(join(HERE, 'asr-sm-plan.json'))) return refuse('the plan differs from the approved plan hash');
  if (approval.modelTrainingOff !== true) return refuse('the Product Owner has not confirmed that the workspace\'s model training setting is off');
  if ((args[0] === '--confirm' ? args[1] : null) !== approval.runId) return refuse(`the run must be confirmed explicitly with --confirm ${approval.runId}`);
  const corpus = join(REPO, 'artifacts', 'evals', 's8b-01', 'corpus');
  const manifest = recordingManifest(plan, corpus);
  if (manifest.missing.length || manifest.invalid.length) return refuse(`recordings missing (${manifest.missing.length}) or invalid (${manifest.invalid.length})`);
  const runDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'asr', approval.runId);
  if (existsSync(runDir)) return refuse(`${approval.runId} has already run (one run per approval)`);
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' });
  if (dirty.status !== 0 || dirty.stdout.trim()) return refuse('the tracked tree is not clean');
  if (!existsSync(KEY_FILE)) return refuse('no Speechmatics API key in the per-user key file');
  const key = readFileSync(KEY_FILE, 'utf8').trim();
  if (key.length < 16) return refuse('the per-user key file does not hold a key');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  mkdirSync(join(runDir, 'sessions'), { recursive: true });
  console.log(`S8B-01 asr-sm run ${approval.runId} at ${head} (cap USD ${plan.guard.costCapUsd}; ${plan.set.sessions} sessions; no retry).`);
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'spend-guard.cjs'), join(HERE, 'asr-sm-run.mjs'), runDir, corpus], {
    cwd: REPO, stdio: 'inherit',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_CHECK: 'asr-sm', QANDEEL_S8B_MODE: 'live',
      QANDEEL_S8B_RUN_ID: approval.runId, QANDEEL_S8B_STATE_FILE: join(runDir, 'spend-state.json'), QANDEEL_S8B_HEAD: head, SPEECHMATICS_API_KEY: key },
  });
  console.log(`S8B-01 asr-sm run directory: ${runDir}`);
  return child.status ?? 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const plan = JSON.parse(readFileSync(join(HERE, 'asr-sm-plan.json'), 'utf8'));
  const problems = checkAsrPlan(plan);
  if (problems.length) { console.error(`S8B-01 asr-sm plan check FAILED:\n- ${problems.join('\n- ')}`); process.exit(2); }
  const mode = process.argv[2];
  if (mode === '--plan-check') {
    const m = recordingManifest(plan, join(REPO, 'artifacts', 'evals', 's8b-01', 'corpus'));
    const approval = JSON.parse(readFileSync(join(HERE, 'asr-sm-approval.json'), 'utf8'));
    const worst = plan.set.speakers.length * plan.set.linesPerSpeaker * plan.arms.reduce((s, a) => s + sessionCeilingUsd(plan, a, plan.audio.maxLineSeconds * 1000), 0);
    console.log(JSON.stringify({ check: 'passed', sessions: plan.set.sessions, arms: plan.arms.map((a) => a.id), capUsd: plan.guard.costCapUsd,
      worstCaseUsd: Number(worst.toFixed(4)), recordings: { needed: plan.set.speakers.length * plan.set.linesPerSpeaker, present: m.present.length, missing: m.missing.length, invalid: m.invalid.length },
      keyFilePresent: existsSync(KEY_FILE), planSha256: fileSha256(join(HERE, 'asr-sm-plan.json')), approval: approval.status }, null, 1));
    process.exit(0);
  }
  if (mode === '--live') process.exit(launchLive(plan, process.argv.slice(3)));
  console.error('usage: asr-sm.mjs --plan-check | --live --confirm <runId>');
  process.exit(64);
}
