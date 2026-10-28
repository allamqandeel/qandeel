// S8B-01 CP2 — the Speechmatics real-time ASR test (the Product Owner's Speechmatics order, 2026-10-28). Operator-only;
// never imported by production code.
//
//   node scripts/s8b-01/asr-sm.mjs --prepare                    local and free: each phone recording corpus/PO/NN.<any> to a
//                                                               16 kHz mono WAV (convert-audio.ps1, Windows Media Foundation)
//   node scripts/s8b-01/asr-sm.mjs --plan-check                 the plan, and every recording's duration and speech, for review
//   node scripts/s8b-01/asr-sm.mjs --live --confirm <runId>     ONE approved run, under spend-guard.cjs (QANDEEL_S8B_CHECK=asr-sm)
//
// The Product Owner's recording simplification (2026-10-28): the Product Owner's own 20 recordings (set `po20` of
// corpus/asr-cp2-recording-script.json), streamed at real-time pace to the Speechmatics real-time WebSocket in the EU region,
// Enhanced ar_en only, one session per recording; no retry. A preliminary single-speaker test, not a population estimate. The API key is read from the
// per-user key file into memory and passed only to the guarded child; it is never printed, logged or written.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorRates, normalizeArabic } from './arabic-text-metrics.mjs';
import { loadRecordingScript, poLines, referenceOf } from './asr-recording-sheet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
export const KEY_FILE = join(homedir(), '.qandeel', 'speechmatics-api-key.txt');
const RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000];
const sha256 = (text) => createHash('sha256').update(text.replace(/\r\n/gu, '\n')).digest('hex');
export const fileSha256 = (p) => sha256(readFileSync(p, 'utf8'));
const bytesSha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

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
  if (!(g.costCapUsd > 0 && g.costCapUsd <= 0.25)) p.push('the cap is at most USD 0.25 (20 recordings)');
  if (JSON.stringify(Object.values(g.allowedHosts ?? {})) !== JSON.stringify(['eu.rt.speechmatics.com'])) p.push('the EU real-time host only');
  if (JSON.stringify(g.liveKeys) !== JSON.stringify(['SPEECHMATICS_API_KEY'])) p.push('the only credential is the Speechmatics API key');
  if (plan.endpoint !== 'wss://eu.rt.speechmatics.com/v2') p.push('the EU real-time endpoint');
  const arms = plan.arms ?? [];
  const c = arms[0]?.transcriptionConfig ?? {};
  if (arms.length !== 1 || c.model !== 'enhanced' || c.language !== 'ar_en') p.push('one arm only: Enhanced ar_en (Product Owner)');
  if (c.enable_partials !== true || !(c.conversation_config?.end_of_utterance_silence_trigger > 0)) p.push('partials and the server end of utterance');
  for (const a of arms) if (!(a.pricePerHourUsd > 0)) p.push(`${a.id}: a price`);
  if (plan.privacy?.modelTrainingMustBeOff !== true || plan.privacy?.realtimeOnly !== true) p.push('model training off and real-time only');
  if (plan.scope?.preliminarySingleSpeaker !== true) p.push('the results are recorded as a preliminary single-speaker test');
  const data = loadRecordingScript(here);
  if (plan.set?.scriptSha256 !== fileSha256(join(here, 'corpus', 'asr-cp2-recording-script.json'))) p.push('the recording script hash');
  if (plan.set?.promptsSha256 !== fileSha256(join(here, 'corpus', 'asr-reading-prompts.json'))) p.push('the reused prompts hash');
  if (plan.set?.name !== 'po20') p.push('the set is po20');
  const lines = poLines(data);
  if (lines.length !== 20 || lines.length !== plan.set?.linesPerSpeaker) p.push('the set size (20)');
  if (JSON.stringify(plan.set?.speakers) !== JSON.stringify(['PO'])) p.push('one speaker, the Product Owner');
  if (plan.set?.sessions !== lines.length * arms.length) p.push('sessions = recordings × arms');
  if (!data.script.consent?.text?.length) p.push('the consent text');
  const worst = lines.length * arms.reduce((s, a) => s + sessionCeilingUsd(plan, a, plan.audio.maxLineSeconds * 1000), 0);
  if (worst > g.costCapUsd) p.push(`every session at its ceiling (USD ${worst.toFixed(4)}) must fit the cap`);
  return p;
}

const nn = (n) => String(n).padStart(2, '0');
const SKIP = new Set(['.txt', '.json', '.md', '.ini', '.db']);

/** The phone recording(s) for line n in the speaker folder: any extension, named 01 … 20 (or 1 … 20). */
export function sourcesOf(dir, n) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => {
    const ext = extname(f).toLowerCase();
    return ext && !SKIP.has(ext) && statSync(join(dir, f)).isFile() && [nn(n), String(Number(n))].includes(f.slice(0, -ext.length).trim());
  }).map((f) => join(dir, f));
}

/** A WAV the harness can stream as it is: readable, at a sample rate it sends. */
function streamableWav(file) {
  try { const { rate } = readAnyWav(readFileSync(file)); return RATES.includes(rate); } catch { return false; }
}

/** The local converter: Windows Media Foundation through convert-audio.ps1 (nothing installed, nothing sent). */
export function convertWithWindows(source, target) {
  if (process.platform !== 'win32') return { ok: false, why: 'the local converter needs Windows Media Foundation' };
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(HERE, 'convert-audio.ps1'), '-Source', source, '-Target', target],
    { encoding: 'utf8', timeout: 120000 });
  return r.status === 0 && existsSync(target) ? { ok: true } : { ok: false, why: (r.stderr || r.stdout || 'conversion failed').trim().split(/\r?\n/u)[0] };
}

/**
 * --prepare: every phone recording to a streamable WAV in <speaker>/wav/NN.wav (a streamable WAV is used as it is), and
 * <speaker>/wav/prepared.json binding each source's SHA-256 to its WAV's, so a re-recorded file is never streamed stale.
 */
export function prepareRecordings(plan, corpusDir, { convert = convertWithWindows } = {}) {
  const [speaker] = plan.set.speakers;
  const dir = join(corpusDir, speaker);
  const wavDir = join(dir, 'wav');
  mkdirSync(wavDir, { recursive: true });
  const prepared = {};
  const report = [];
  for (const line of poLines(loadRecordingScript(HERE))) {
    const src = sourcesOf(dir, line.n);
    if (src.length !== 1) { report.push({ n: nn(line.n), status: src.length ? 'AMBIGUOUS' : 'MISSING' }); continue; }
    const asIs = extname(src[0]).toLowerCase() === '.wav' && streamableWav(src[0]);
    const wav = asIs ? src[0] : join(wavDir, `${nn(line.n)}.wav`);
    const r = asIs ? { ok: true } : convert(src[0], wav);
    if (!r.ok || !streamableWav(wav)) { report.push({ n: nn(line.n), status: 'NOT CONVERTED', why: r.why ?? 'the converted file is not a streamable WAV' }); continue; }
    prepared[nn(line.n)] = { source: src[0].slice(dir.length + 1), sourceSha256: bytesSha256(src[0]), wav: wav.slice(dir.length + 1), wavSha256: bytesSha256(wav) };
    report.push({ n: nn(line.n), status: asIs ? 'WAV AS IS' : 'CONVERTED', source: extname(src[0]).toLowerCase() });
  }
  writeFileSync(join(wavDir, 'prepared.json'), JSON.stringify(prepared, null, 1));
  return report;
}

/** The recordings the plan needs, and what is present: prepared, current and valid (duration, sample rate, speech). */
export function recordingManifest(plan, corpusDir) {
  const [speaker] = plan.set.speakers;
  const dir = join(corpusDir, speaker);
  const preparedFile = join(dir, 'wav', 'prepared.json');
  const prepared = existsSync(preparedFile) ? JSON.parse(readFileSync(preparedFile, 'utf8')) : {};
  const out = { present: [], missing: [], unprepared: [], invalid: [] };
  for (const line of poLines(loadRecordingScript(HERE))) {
    const k = nn(line.n);
    const src = sourcesOf(dir, line.n);
    if (!src.length) { out.missing.push(k); continue; }
    const e = prepared[k];
    const file = e ? join(dir, e.wav) : null;
    if (src.length !== 1 || !e || e.source !== src[0].slice(dir.length + 1) || e.sourceSha256 !== bytesSha256(src[0]) || !existsSync(file) || e.wavSha256 !== bytesSha256(file)) {
      out.unprepared.push(k);
      continue;
    }
    try {
      const { rate, pcm } = readAnyWav(readFileSync(file));
      const ms = Math.round((pcm.length / rate) * 1000);
      const bounds = speechBounds(pcm, rate);
      if (!RATES.includes(rate) || ms > plan.audio.maxLineSeconds * 1000 || !bounds) out.invalid.push({ n: k, ms, rate, speech: Boolean(bounds) });
      else out.present.push({ speaker, line, file, source: e.source, ms, rate, bounds });
    } catch { out.invalid.push({ n: k }); }
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
  if (manifest.missing.length || manifest.unprepared.length || manifest.invalid.length) return refuse(`recordings missing (${manifest.missing.length}), not prepared (${manifest.unprepared.length}) or invalid (${manifest.invalid.length})`);
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
  const corpus = join(REPO, 'artifacts', 'evals', 's8b-01', 'corpus');
  if (mode === '--prepare') {
    console.log(JSON.stringify(prepareRecordings(plan, corpus), null, 1));
    process.exit(0);
  }
  if (mode === '--plan-check') {
    // Durations and speech presence only: no transcript, nothing sent.
    const m = recordingManifest(plan, corpus);
    const approval = JSON.parse(readFileSync(join(HERE, 'asr-sm-approval.json'), 'utf8'));
    const worst = plan.set.linesPerSpeaker * plan.arms.reduce((s, a) => s + sessionCeilingUsd(plan, a, plan.audio.maxLineSeconds * 1000), 0);
    const expected = m.present.reduce((s, r) => s + plan.arms.reduce((t, a) => t + ((r.ms + plan.audio.tailSilenceMs + 1000) / 3.6e6) * a.pricePerHourUsd, 0), 0);
    console.log(JSON.stringify({ check: 'passed', sessions: plan.set.sessions, arms: plan.arms.map((a) => a.id), capUsd: plan.guard.costCapUsd,
      worstCaseUsd: Number(worst.toFixed(4)), expectedUsd: Number(expected.toFixed(4)),
      recordings: { needed: plan.set.linesPerSpeaker, present: m.present.length, missing: m.missing, unprepared: m.unprepared, invalid: m.invalid },
      review: m.present.map((r) => ({ n: nn(r.line.n), condition: r.line.condition, source: r.source, seconds: Number((r.ms / 1000).toFixed(2)), rate: r.rate,
        speechS: [Number((r.bounds.onsetMs / 1000).toFixed(2)), Number((r.bounds.offsetMs / 1000).toFixed(2))] })),
      keyFilePresent: existsSync(KEY_FILE), planSha256: fileSha256(join(HERE, 'asr-sm-plan.json')), approval: approval.status }, null, 1));
    process.exit(0);
  }
  if (mode === '--live') process.exit(launchLive(plan, process.argv.slice(3)));
  console.error('usage: asr-sm.mjs --prepare | --plan-check | --live --confirm <runId>');
  process.exit(64);
}
