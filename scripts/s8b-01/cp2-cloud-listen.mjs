// S8B-01 CP2 — the offline summary and listening pages of the Google Cloud run (no network; reads the run directory only).
//
//   node scripts/s8b-01/cp2-cloud-listen.mjs <runDir>
//
// Writes beside the run's samples.csv: summary.json (speed, cost, errors per model, voice, category and arm, and the
// style-length effect), listening.html (every text with its four renditions side by side — Flash · Achird, Flash · Sulafat,
// Flash-Lite · Achird, Flash-Lite · Sulafat — grouped for listening: start here, emotions, Egyptian, names, homographs and
// diacritics, numbers, the other dialects and replies; it plays from the run's audio/ folder) and listening-pack.html (the
// start-here section, self-contained). Objective measures only: quality is the Product Owner's listening.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { percentile } from './latency-model.mjs';

export const COMBOS = [
  ['gemini-3.8-flash-tts', 'Achird'], ['gemini-3.8-flash-tts', 'Sulafat'],
  ['gemini-3.8-flash-lite-tts', 'Achird'], ['gemini-3.8-flash-lite-tts', 'Sulafat'],
];
const NUM = ['first_audio_ms', 'end_ms', 'audio_s', 'rtf', 'max_gap_ms', 'stall_ms_200', 's_per_char', 'list_usd', 'promo_usd', 'http'];

/** Parses the run's samples.csv (the last column is a JSON string). */
export function parseCloudSamples(csv) {
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  const keys = header.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    const row = Object.fromEntries(keys.slice(0, -1).map((k, i) => [k, cells[i]]));
    row.error = JSON.parse(cells.slice(keys.length - 1).join(',') || '""');
    for (const k of NUM) row[k] = row[k] === '' || row[k] === undefined ? null : Number(row[k]);
    return row;
  });
}

const pct = (xs) => { const v = xs.filter((x) => x !== null && Number.isFinite(x)); return { n: v.length, p50: percentile(v, 50), p95: percentile(v, 95) }; };

/** The figures of one group of calls. Cost per audio minute = USD / audio seconds × 60, over the successful calls. */
export function summarizeCloud(rows) {
  const ok = rows.filter((r) => r.status === 'OK' || r.status === 'CANCELLED_AT_BOUND');
  const audio = ok.reduce((a, r) => a + r.audio_s, 0);
  const list = ok.reduce((a, r) => a + r.list_usd, 0);
  const promo = ok.reduce((a, r) => a + r.promo_usd, 0);
  return {
    calls: rows.length, ok: ok.length, errors: rows.length - ok.length, http429: rows.filter((r) => r.http === 429).length,
    cancelledAtBound: rows.filter((r) => r.status === 'CANCELLED_AT_BOUND').length,
    firstAudioMs: pct(ok.map((r) => r.first_audio_ms)), endMs: pct(ok.map((r) => r.end_ms)), rtf: pct(ok.map((r) => r.rtf)),
    maxGapMs: pct(ok.map((r) => r.max_gap_ms)), stalls200: ok.filter((r) => r.stall_ms_200 > 0).length,
    audioSeconds: Number(audio.toFixed(1)), listUsd: Number(list.toFixed(5)), promoUsd: Number(promo.toFixed(5)),
    listUsdPerAudioMinute: audio > 0 ? Number((list / audio * 60).toFixed(5)) : null, promoUsdPerAudioMinute: audio > 0 ? Number((promo / audio * 60).toFixed(5)) : null,
  };
}

/** The rows of each (item, arm), keyed by "model|voice": the side-by-side grid of the listening page. */
export function grid(rows) {
  const out = new Map();
  for (const r of rows) {
    const key = `${r.item}|${r.arm}`;
    if (!out.has(key)) out.set(key, { item: r.item, arm: r.arm, category: r.category, dialect: r.dialect, emotion: r.emotion, cells: {} });
    out.get(key).cells[`${r.model}|${r.voice}`] = r;
  }
  return out;
}

/** The style effect on length: an EMOTION / PERSONA rendition's audio seconds over its no-style rendition (same model, voice, item). */
export function styleRatios(rows) {
  const ok = rows.filter((r) => r.status === 'OK' && r.group === 'EXPRESSION');
  const out = {};
  for (const r of ok.filter((x) => x.arm !== 'NO_STYLE')) {
    // A reply's no-style reference is its SET BASELINE (cp2-worklist.mjs buildWork).
    const base = rows.find((x) => (x.status === 'OK') && (x.arm === 'NO_STYLE' || (x.arm === 'BASELINE' && x.category === 'REPLY')) && x.item === r.item && x.model === r.model && x.voice === r.voice);
    if (base) (out[`${r.model}|${r.arm}`] ??= []).push(r.audio_s / base.audio_s);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { n: v.length, p50: Number(percentile(v, 50).toFixed(3)), min: Number(Math.min(...v).toFixed(3)), max: Number(Math.max(...v).toFixed(3)) }]));
}

// The listening sections, in order; an entry is [item, arm].
const SET_ARMS = (ids) => ids.flatMap((id) => [[id, 'BASELINE'], [id, 'RENDERED']]);
const range = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${String(a + i).padStart(2, '0')}`);
export const SECTIONS = [
  ['Start here — one of each', [['X01', 'EMOTION'], ['X05', 'EMOTION'], ['X07', 'EMOTION'], ['X07', 'NO_STYLE'], ['R01', 'BASELINE'], ['R01', 'PERSONA'], ['E02', 'BASELINE'], ['C01', 'BASELINE'],
    ['H27', 'RENDERED'], ['N03', 'RENDERED'], ['N06', 'BASELINE'], ['D02', 'BASELINE'], ['D02', 'RENDERED']]],
  // Flagged by the run's own measures (record §9.9): an audio length far from its row's other three, a date read at very
  // different lengths, and the emotion styles that shortened or lengthened the speech the most.
  ['Flagged by the measures — listen for a dropped word, a misread date, and whether a style registered', [['H04', 'BASELINE'], ['H04', 'RENDERED'], ['D03', 'BASELINE'], ['D03', 'RENDERED'],
    ['X01', 'NO_STYLE'], ['X01', 'EMOTION'], ['X04', 'NO_STYLE'], ['X04', 'EMOTION'], ['X06', 'NO_STYLE'], ['X06', 'EMOTION'], ['X07', 'EMOTION']]],
  ['Emotions — each text without a style, with QANDEEL\'s persona style, and with its emotion style', range('X', 1, 10).flatMap((id) => [[id, 'NO_STYLE'], [id, 'PERSONA'], [id, 'EMOTION']])],
  ['Egyptian colloquial', [...range('E', 1, 5).map((id) => [id, 'BASELINE']), ['R01', 'BASELINE'], ['R01', 'PERSONA'], ['R02', 'BASELINE'], ['R02', 'PERSONA'],
    ['C01', 'BASELINE'], ['C02', 'BASELINE'], ...SET_ARMS(['H26', 'H27', 'H28', 'H29', 'H30']), ['N05', 'BASELINE'], ...SET_ARMS(['D02', 'D05'])]],
  ['Names', [...SET_ARMS(['N01', 'N02', 'N03']), ['N04', 'BASELINE'], ['N05', 'BASELINE'], ['N06', 'BASELINE'], ...SET_ARMS(['N07', 'N08'])]],
  ['Homographs and selective diacritics (MSA)', SET_ARMS(range('H', 1, 25))],
  ['Numbers, dates and units', SET_ARMS(range('D', 1, 8))],
  ['Other dialects, code switch and replies', [...['G01', 'G02', 'G03', 'L01', 'L02', 'L03', 'M01', 'M02', 'C03', 'C04'].map((id) => [id, 'BASELINE']),
    ...['R03', 'R04', 'R05', 'R06'].flatMap((id) => [[id, 'BASELINE'], [id, 'PERSONA']])]],
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function listeningPage(runDir, rows, texts, styles, { sections = SECTIONS, embed = false, title = 'S8B-01 CP2 — Gemini TTS on Google Cloud' } = {}) {
  const g = grid(rows);
  const cell = (r) => {
    if (!r) return '<td class="miss">not run</td>';
    if (r.status === 'ERROR') return `<td class="miss">error${r.http ? ` (HTTP ${r.http})` : ''}</td>`;
    const src = embed ? `data:audio/wav;base64,${readFileSync(join(runDir, 'audio', `${r.sample}.wav`)).toString('base64')}` : `audio/${r.sample}.wav`;
    return `<td><audio controls preload="none" src="${src}"></audio><div class="m">${r.sample} · first audio ${r.first_audio_ms} ms · ${r.audio_s.toFixed(1)} s</div></td>`;
  };
  const body = sections.map(([heading, entries]) => {
    const trs = entries.map(([item, arm]) => {
      const e = g.get(`${item}|${arm}`);
      const style = styles[`${item}|${arm}`];
      return `<tr><th scope="row"><b>${item}</b> ${arm}${style ? `<div class="m">style: ${esc(style)}</div>` : ''}</th><td class="t" dir="rtl" lang="ar">${esc(texts[`${item}|${arm}`])}</td>`
        + COMBOS.map(([m, v]) => cell(e?.cells[`${m}|${v}`])).join('') + '</tr>';
    }).join('\n');
    return `<h2>${esc(heading)}</h2><div class="wrap"><table><thead><tr><th>Item</th><th>Text sent</th>${COMBOS.map(([m, v]) => `<th>${m.includes('lite') ? 'Flash-Lite' : 'Flash'} · ${v}</th>`).join('')}</tr></thead><tbody>\n${trs}\n</tbody></table></div>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>:root{--bg:#fbfaf7;--fg:#1d1b18;--mute:#6b645a;--line:#ddd6ca;--miss:#a33}@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#eee8dd;--mute:#a59d90;--line:#3b362f;--miss:#e88}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:16px}h1{font-size:20px}h2{font-size:16px;margin-top:28px}table{border-collapse:collapse;width:100%}
td,th{border-bottom:1px solid var(--line);padding:6px;text-align:start;vertical-align:top}th[scope=row]{white-space:nowrap}.t{font-size:16px;min-width:220px}.m{color:var(--mute);font-size:12px}
.miss{color:var(--miss)}audio{height:32px;width:220px}.wrap{overflow-x:auto}</style></head><body>
<h1>${esc(title)}</h1>
<p>Synthetic text only. Each row is one text; the four columns are the same text on Flash and Flash-Lite with the voices Achird and Sulafat. The text column is exactly what was sent; a style travelled only in speechMetadata. Ratings are the Product Owner's.</p>
${body}
</body></html>`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const runDir = process.argv[2];
  if (!runDir || !existsSync(join(runDir, 'samples.csv'))) { console.error('usage: cp2-cloud-listen.mjs <runDir>'); process.exit(64); }
  const here = fileURLToPath(new URL('.', import.meta.url));
  const { cloudCalls } = await import('./cp2-cloud.mjs');
  const plan = JSON.parse(readFileSync(join(here, 'cp2-cloud-plan.json'), 'utf8'));
  const calls = cloudCalls(plan, here);
  const texts = Object.fromEntries(calls.map((c) => [`${c.item}|${c.arm}`, c.text]));
  const styles = Object.fromEntries(calls.filter((c) => c.style).map((c) => [`${c.item}|${c.arm}`, c.style]));
  const rows = parseCloudSamples(readFileSync(join(runDir, 'samples.csv'), 'utf8'));
  const report = JSON.parse(readFileSync(join(runDir, 'report.json'), 'utf8'));
  const by = (key) => { const m = {}; for (const r of rows) (m[key(r)] ??= []).push(r); return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, summarizeCloud(v)])); };
  const errors = {};
  for (const r of rows.filter((x) => x.status === 'ERROR')) errors[`${r.model}|HTTP ${r.http}`] = (errors[`${r.model}|HTTP ${r.http}`] ?? 0) + 1;
  const summary = { runId: report.runId, head: report.head, startedAt: report.startedAt, finishedAt: report.finishedAt, planned: report.planned, done: rows.length,
    notReached: report.notReached, stoppedRun: report.stoppedRun, models: report.models, spend: report.spend, errors,
    byModel: by((r) => r.model), byModelVoice: by((r) => `${r.model}|${r.voice}`), byModelCategory: by((r) => `${r.model}|${r.category}`),
    byModelArm: by((r) => `${r.model}|${r.arm}`), styleLengthRatio: styleRatios(rows) };
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(runDir, 'listening.html'), listeningPage(runDir, rows, texts, styles));
  writeFileSync(join(runDir, 'listening-pack.html'), listeningPage(runDir, rows, texts, styles, { sections: SECTIONS.slice(0, 2), embed: true, title: 'S8B-01 CP2 — start here (Google Cloud)' }));
  console.log(JSON.stringify({ done: rows.length, planned: report.planned, stoppedRun: report.stoppedRun, models: report.models, spend: report.spend?.settledUsd }, null, 1));
}
