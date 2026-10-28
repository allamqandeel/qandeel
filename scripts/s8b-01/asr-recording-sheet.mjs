// S8B-01 CP2 — the ASR recording session: the lines each consenting speaker records, their file names, and a printable
// Arabic session sheet. Pure and local: no network, no provider, no audio. The lines come from asr-cp2-recording-script.json
// and the Egyptian / MSA prompts it reuses from asr-reading-prompts.json (hash-pinned, unchanged).
//   node scripts/s8b-01/asr-recording-sheet.mjs <speakerCode> [--set core] [outDir]   → <outDir>/recording-sheet-<speakerCode>[-core].html
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ORDER = ['QUIET', 'SPEAKER', 'NOISE', 'OVERLAP'];

export function loadRecordingScript(here = HERE) {
  const script = JSON.parse(readFileSync(join(here, 'corpus', 'asr-cp2-recording-script.json'), 'utf8'));
  const prompts = JSON.parse(readFileSync(join(here, 'corpus', 'asr-reading-prompts.json'), 'utf8'));
  return { script, prompts };
}

// "indices 0, 3, 6" → [0, 3, 6]; "all 15" / "all 6" → every index.
const pick = (rule, n) => (/^all\b/u.test(rule) ? [...Array(n).keys()] : [...rule.matchAll(/\d+/gu)].map((m) => Number(m[0])));

/**
 * Every line of one session, in recording order: Egyptian first, then MSA; within a dialect, by condition. With
 * `set`, only that set's lines (script.sets[set].lines, "<id>|<condition>"), in the same order.
 */
export function sessionLines({ script, prompts }, { set = null } = {}) {
  const lines = [];
  for (const dialect of ['EGYPTIAN', 'MSA']) {
    const reuse = script.reuse[dialect];
    const { read, spontaneous } = prompts.dialects[dialect];
    const tag = dialect === 'EGYPTIAN' ? 'EG' : 'MSA';
    const [readRule, noiseRule] = reuse.read.split(';').map((s) => s.trim());
    const readConds = readRule.split(',')[0].split('+').map((s) => s.trim());
    for (const [i, text] of read.entries()) {
      for (const c of readConds) lines.push({ id: `${tag}-R${String(i + 1).padStart(2, '0')}`, dialect, category: 'READ', condition: c, text });
    }
    for (const i of pick(noiseRule.replace(/^NOISE:\s*/u, ''), read.length)) lines.push({ id: `${tag}-R${String(i + 1).padStart(2, '0')}`, dialect, category: 'READ', condition: 'NOISE', text: read[i] });
    for (const item of script.items.filter((x) => x.dialect === dialect)) {
      for (const c of item.conditions) lines.push({ id: item.id, dialect, category: item.category, condition: c, text: item.text, speakerNote: item.speakerNote });
    }
    for (const i of pick(reuse.spontaneous.replace(/^SPEAKER,\s*/u, ''), spontaneous.length)) {
      lines.push({ id: `${tag}-S${String(i + 1).padStart(2, '0')}`, dialect, category: 'SPONTANEOUS', condition: 'SPEAKER', text: spontaneous[i] });
    }
  }
  const rank = (l) => (l.dialect === 'EGYPTIAN' ? 0 : 10) + ORDER.indexOf(l.condition);
  if (set) {
    const wanted = script.sets?.[set]?.lines;
    if (!wanted) throw new Error(`S8B_01_ASR: no set ${set}`);
    const found = wanted.map((key) => lines.find((l) => `${l.id}|${l.condition}` === key));
    if (found.some((l) => !l)) throw new Error(`S8B_01_ASR: set ${set} names a line the script does not have`);
    return found.map((l, k) => ({ ...l, k })).sort((a, b) => rank(a) - rank(b) || a.k - b.k).map(({ k, ...l }) => l);
  }
  return lines.map((l, k) => ({ ...l, k })).sort((a, b) => rank(a) - rank(b) || a.k - b.k).map(({ k, ...l }) => l);
}

/** The file a speaker saves for a line: anonymous code, line id, condition. */
export const fileName = (speaker, line) => `${speaker}_${line.id}_${line.condition}`;

/** The reference a read line is scored against: its text with the script's fillers and the hesitation dots removed. */
export function referenceOf(script, line) {
  if (line.category === 'SPONTANEOUS') return null;
  let t = line.text;
  for (const f of script.fillers) t = t.split(f).join(' ');
  return t.replace(/\.\.\./gu, ' ').replace(/\s+/gu, ' ').trim();
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function sheetHtml(speaker, data, { set = null } = {}) {
  const { script } = data;
  const lines = sessionLines(data, { set });
  const cond = Object.fromEntries(script.conditions.map((c) => [c.id, c.instruction]));
  const groups = [];
  for (const l of lines) {
    const key = `${l.dialect}|${l.condition}`;
    if (groups.at(-1)?.key !== key) groups.push({ key, dialect: l.dialect, condition: l.condition, lines: [] });
    groups.at(-1).lines.push(l);
  }
  const body = groups.map((g) => `<h2>${g.dialect === 'EGYPTIAN' ? 'العامية المصرية' : 'الفصحى'} — ${esc(g.condition)}</h2><p class="c">${esc(cond[g.condition])}</p>
<table><thead><tr><th>#</th><th>اسم الملف</th><th>اقرأ / أجب</th></tr></thead><tbody>
${g.lines.map((l, i) => `<tr><td>${i + 1}</td><td dir="ltr" class="f">${esc(fileName(speaker, l))}</td><td>${l.category === 'SPONTANEOUS' ? '<b>سؤال حر:</b> ' : ''}${esc(l.text)}${l.speakerNote ? `<div class="n">${esc(l.speakerNote)}</div>` : ''}</td></tr>`).join('\n')}
</tbody></table>`).join('\n');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recording sheet ${esc(speaker)}</title>
<style>:root{--bg:#fff;--fg:#1d1b18;--mute:#6b645a;--line:#ddd6ca}@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#eee8dd;--mute:#a59d90;--line:#3b362f}}
body{background:var(--bg);color:var(--fg);font:16px/1.7 system-ui,sans-serif;margin:16px}h1{font-size:20px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;width:100%}
td,th{border-bottom:1px solid var(--line);padding:6px;text-align:start;vertical-align:top}.f{font:12px ui-monospace,monospace;white-space:nowrap;color:var(--mute)}.n,.c{color:var(--mute);font-size:14px}
@media print{h2{break-before:auto}tr{break-inside:avoid}}</style></head><body>
<h1>ورقة التسجيل — ${esc(speaker)} (${lines.length} ملفًا)</h1>
<h2>الموافقة</h2><ol>${script.consent.text.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
<p class="c">سجّل كل سطر في ملف منفصل باسمه المكتوب، بصيغة WAV لو تطبيق التسجيل يسمح (أي تردد: 16 أو 44.1 أو 48 كيلوهرتز)؛ لو مش بيسمح ابعت الملفات زي ما هي.اتكلم بطريقتك الطبيعية؛ لو غلطت في كلمة كمّل عادي ولا تعيد إلا لو الجملة كلها باظت. في الأسئلة الحرة اتكلم من 10 إلى 20 ثانية، من غير أي معلومة شخصية حقيقية.</p>
${body}
</body></html>`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const speaker = process.argv[2];
  if (!/^S\d{1,2}$/u.test(speaker ?? '')) { console.error('usage: asr-recording-sheet.mjs <S1|S2|…> [outDir]'); process.exit(64); }
  const args = process.argv.slice(3);
  const set = args[0] === '--set' ? args[1] : null;
  const out = (set ? args[2] : args[0]) ?? join(HERE, '..', '..', 'artifacts', 'evals', 's8b-01', 'corpus');
  mkdirSync(out, { recursive: true });
  const data = loadRecordingScript();
  writeFileSync(join(out, `recording-sheet-${speaker}${set ? `-${set}` : ''}.html`), sheetHtml(speaker, data, { set }));
  const lines = sessionLines(data, { set });
  const by = {};
  for (const l of lines) by[`${l.dialect}|${l.condition}`] = (by[`${l.dialect}|${l.condition}`] ?? 0) + 1;
  console.log(JSON.stringify({ speaker, lines: lines.length, by }, null, 1));
}
