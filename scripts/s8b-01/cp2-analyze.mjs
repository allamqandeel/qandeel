// S8B-01 CP2 — the offline analysis of the one live run (no network; reads the run directory only).
//
//   node scripts/s8b-01/cp2-analyze.mjs <runDir>
//
// Writes, beside the run's report.json and samples.csv: summary.json (the per-model, per-voice, per-arm and expression
// figures), listening.html (every sample, playable from the run's audio/ folder, with its model, voice, arm and measures)
// and listening-pack.html (a self-contained selection for the Product Owner's first listen). Objective measures only:
// pronunciation correctness, naturalness and dialect fit are human ratings (bench-plan.json tts.humanMetrics).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { percentile } from './latency-model.mjs';
import { readingAnnotated } from './cp2-providers.mjs';

/** Parses samples.csv (the last column is a JSON string). */
export function parseSamples(csv) {
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  const keys = header.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    const error = cells.slice(keys.length - 1).join(',');
    const row = Object.fromEntries(keys.slice(0, -1).map((k, i) => [k, cells[i]]));
    row.error = JSON.parse(error || '""');
    for (const k of ['first_audio_ms', 'end_ms', 'audio_s', 'rtf', 'max_gap_ms', 'stall_ms_0', 'stall_ms_200', 's_per_char', 'usd']) row[k] = row[k] === '' ? null : Number(row[k]);
    return row;
  });
}

/** Run r1's RENDERED samples of an item whose reading carries a rater annotation were sent that annotation (CP2 record
 *  §9.4): they are marked INVALID_INPUT and leave every figure. */
export function invalidate(rows, items) {
  const bad = new Set(items.filter((i) => i.target && readingAnnotated(i.expected)).map((i) => i.id));
  for (const r of rows) if (r.arm === 'RENDERED' && bad.has(r.item) && r.status !== 'ERROR') r.status = 'INVALID_INPUT';
  return rows;
}

const stats = (xs) => {
  const v = xs.filter((x) => x !== null && Number.isFinite(x));
  return { n: v.length, p50: percentile(v, 50), p95: percentile(v, 95) };
};

/** The figures of one group of samples. Cost per audio minute = charged USD / audio seconds × 60. */
export function summarize(rows) {
  const ok = rows.filter((r) => r.status === 'OK');
  const audio = ok.reduce((a, r) => a + r.audio_s, 0);
  const usd = ok.reduce((a, r) => a + r.usd, 0); // the cost per minute of valid audio; the run's full spend is report.spend
  return {
    calls: rows.length, ok: ok.length, invalidInput: rows.filter((r) => r.status === 'INVALID_INPUT').length, errors: rows.filter((r) => r.status === 'ERROR').length, cancelledAtBound: rows.filter((r) => r.status === 'CANCELLED_AT_BOUND').length,
    firstAudioMs: stats(ok.map((r) => r.first_audio_ms)), endMs: stats(ok.map((r) => r.end_ms)), rtf: stats(ok.map((r) => r.rtf)),
    maxGapMs: stats(ok.map((r) => r.max_gap_ms)),
    stalls0: ok.filter((r) => r.stall_ms_0 > 0).length, stalls200: ok.filter((r) => r.stall_ms_200 > 0).length,
    stall200MsP95: percentile(ok.map((r) => r.stall_ms_200), 95),
    audioSeconds: Number(audio.toFixed(1)), usd: Number(usd.toFixed(6)), usdPerAudioMinute: audio > 0 ? Number((usd / audio * 60).toFixed(5)) : null,
    costFromUsage: rows.filter((r) => r.cost_source === 'usage').length,
  };
}

/** Audio-seconds-per-character outliers (a skipped, repeated or read-aloud span), against the model's own median. */
export function outliers(rows) {
  const out = [];
  for (const model of new Set(rows.map((r) => r.model))) {
    const ok = rows.filter((r) => r.model === model && r.status === 'OK' && r.s_per_char);
    const median = percentile(ok.map((r) => r.s_per_char), 50);
    for (const r of ok) if (r.s_per_char > 1.8 * median || r.s_per_char < 0.55 * median) out.push({ sample: r.sample, model, voice: r.voice, item: r.item, arm: r.arm, sPerChar: r.s_per_char, median });
  }
  return out;
}

function analyze(runDir, items) {
  const rows = invalidate(parseSamples(readFileSync(join(runDir, 'samples.csv'), 'utf8')), items);
  const report = JSON.parse(readFileSync(join(runDir, 'report.json'), 'utf8'));
  const by = (keyFn) => { const m = {}; for (const r of rows) (m[keyFn(r)] ??= []).push(r); return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, summarize(v)])); };
  // The style effect: each item's audio length with a style over the same item without one (same model and voice).
  const styleEffect = {};
  for (const r of rows.filter((x) => x.group === 'EXPRESSION' && x.arm !== 'NO_STYLE' && x.status === 'OK')) {
    const base = rows.find((x) => x.group === 'EXPRESSION' && x.arm === 'NO_STYLE' && x.status === 'OK' && x.model === r.model && x.voice === r.voice && x.item === r.item);
    if (!base) continue;
    ((styleEffect[`${r.model}|${r.arm}`] ??= [])).push(r.audio_s / base.audio_s);
  }
  const summary = {
    runId: report.runId, head: report.head, planSha256: report.planSha256, startedAt: report.startedAt, finishedAt: report.finishedAt,
    preflight: report.preflight, models: report.tts.models,
    byModel: by((r) => r.model), byModelVoice: by((r) => `${r.model}|${r.voice}`), byModelArm: by((r) => `${r.model}|${r.arm}`),
    byModelGroup: by((r) => `${r.model}|${r.group}`),
    styleLengthRatio: Object.fromEntries(Object.entries(styleEffect).map(([k, v]) => [k, { n: v.length, p50: Number(percentile(v, 50).toFixed(3)), max: Number(Math.max(...v).toFixed(3)) }])),
    outliers: outliers(rows), deepseekStream: report.deepseekStream ? { ...report.deepseekStream, streams: undefined } : null,
    stageR: report.stageR, spend: report.spend, notRun: report.notRun, blocked: report.blocked,
  };
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  return { rows, summary };
}

const esc = (s) => String(s).replace(/[&<>"]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function listening(runDir, rows, texts, pack) {
  const items = pack ?? rows.filter((r) => r.status === 'OK');
  const src = (r) => (pack ? `data:audio/wav;base64,${readFileSync(join(runDir, 'audio', `${r.sample}.wav`)).toString('base64')}` : `audio/${r.sample}.wav`);
  const body = items.map((r) => `<tr><td>${r.sample}</td><td>${esc(r.model.replace('gemini-3.8-', ''))}</td><td>${r.voice}</td><td>${r.item}</td><td>${r.arm}</td>`
    + `<td dir="rtl" lang="ar">${esc(texts[r.item] ?? '')}</td><td><audio controls preload="none" src="${src(r)}"></audio></td>`
    + `<td>${r.first_audio_ms} ms</td><td>${r.audio_s.toFixed(1)} s</td><td>$${r.usd.toFixed(5)}</td></tr>`).join('\n');
  return `<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S8B-01 CP2 samples</title>
<style>:root{--bg:#fbfaf7;--fg:#1d1b18;--line:#ddd6ca}@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#eee8dd;--line:#3b362f}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:16px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:6px;text-align:start;vertical-align:middle}
audio{height:32px;max-width:260px}.wrap{overflow-x:auto}</style></head><body>
<h1>S8B-01 CP2 — Gemini TTS samples (${esc(rows[0]?.sample ?? '')}…)</h1>
<p>Synthetic text only. Model, voice and arm are shown; ratings of pronunciation, naturalness and dialect are for CP3. ${pack ? 'A selection for a first listen.' : 'Every sample of the run.'}</p>
<div class="wrap"><table><thead><tr><th>Sample</th><th>Model</th><th>Voice</th><th>Item</th><th>Arm</th><th>Text</th><th>Listen</th><th>First audio</th><th>Length</th><th>Cost</th></tr></thead><tbody>
${body}
</tbody></table></div></body></html>`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const runDir = process.argv[2];
  if (!runDir || !existsSync(join(runDir, 'samples.csv'))) { console.error('usage: cp2-analyze.mjs <runDir>'); process.exit(64); }
  const here = fileURLToPath(new URL('.', import.meta.url));
  const set = JSON.parse(readFileSync(join(here, 'corpus', 'tts-pronunciation-set.json'), 'utf8'));
  const ex = JSON.parse(readFileSync(join(here, 'corpus', 'tts-expression-set.json'), 'utf8'));
  const setItems = [...set.homographs, ...set.names, ...set.numbers, ...set.dialect_sentences, ...set.code_switch, ...set.replies];
  const texts = Object.fromEntries([...setItems, ...ex.items].map((i) => [i.id, i.text]));
  const { rows, summary } = analyze(runDir, setItems);
  writeFileSync(join(runDir, 'listening.html'), listening(runDir, rows, texts));
  const pick = (item, arm) => rows.filter((r) => r.status === 'OK' && r.item === item && r.arm === arm);
  // Run r1 reached the pronunciation set on Achird only (the Tier 1 daily quota; CP2 record §9.2): the pack is Egyptian
  // speech, dialect samples and the BASELINE / RENDERED pairs whose rendering is valid, both models side by side.
  const pack = [['E01', 'BASELINE'], ['E02', 'BASELINE'], ['E03', 'BASELINE'], ['E05', 'BASELINE'], ['C01', 'BASELINE'], ['G01', 'BASELINE'], ['L01', 'BASELINE'],
    ['M01', 'BASELINE'], ['H01', 'BASELINE'], ['H01', 'RENDERED'], ['H26', 'BASELINE'], ['H26', 'RENDERED'], ['H29', 'BASELINE'], ['H29', 'RENDERED'],
    ['N01', 'BASELINE'], ['N01', 'RENDERED'], ['N03', 'BASELINE'], ['N03', 'RENDERED'], ['D02', 'BASELINE'], ['D02', 'RENDERED'], ['D03', 'BASELINE'],
    ['D03', 'RENDERED'], ['D05', 'BASELINE'], ['D05', 'RENDERED']].flatMap(([i, a]) => pick(i, a));
  writeFileSync(join(runDir, 'listening-pack.html'), listening(runDir, rows, texts, pack));
  console.log(JSON.stringify({ byModel: summary.byModel, deepseek: summary.deepseekStream && { T: summary.deepseekStream.T, G: summary.deepseekStream.G, usd: summary.deepseekStream.usd }, spend: summary.spend?.settledUsd }, null, 1));
}
