// P3-A — writes data/COPY_TABLE.md from src/content.mjs: every user-facing string in both languages with its status
// (APPROVED / CANON / DIRECTION / PROOF / OPEN) and its source. Generated, so it cannot drift from the prototype.
//   node source/tools/p3copy.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COPY } from '../src/content.mjs';
import * as FX from '../src/fixtures.mjs';
import { PKG } from './lib/session.mjs';

const rows = [];
const walk = (ar, en, path) => {
  if (ar && typeof ar === 'object' && 'text' in ar && 'status' in ar) { rows.push({ path, ar, en }); return; }
  if (Array.isArray(ar)) { ar.forEach((x, i) => walk(x, en?.[i], `${path}[${i}]`)); return; }
  if (ar && typeof ar === 'object') for (const k of Object.keys(ar)) if (!['dir', 'lang', 'key'].includes(k)) walk(ar[k], en?.[k], path ? `${path}.${k}` : k);
};
walk(COPY.ar, COPY.en, '');
const cell = (s) => (s ? String(s).replace(/\|/g, '\\|') : '—');
const count = (st) => rows.filter((r) => r.ar.status === st || r.en?.status === st).length;
// Synthetic fixture text (event sentences, L2 / L3 words, call-safe short lines): never Product copy, never final.
const fx = [];
for (const [k, e] of Object.entries(FX.EV)) for (const f of ['text', 'short', 'bounded', 'preview']) if (e[f]) fx.push({ path: `EV.${k}.${f}`, ar: e[f].ar, en: e[f].en });
for (const e of FX.FEED) { fx.push({ path: `FEED.${e.id}.text`, ar: e.text.ar, en: e.text.en }); if (e.second) fx.push({ path: `FEED.${e.id}.second`, ar: e.second.ar, en: e.second.en }); if (e.action) fx.push({ path: `FEED.${e.id}.action`, ar: e.action.ar, en: e.action.en }); }
const md = `# P3-A — Bilingual copy table (generated from \`source/src/content.mjs\` and \`source/src/fixtures.mjs\`)

**Status:** \`P3-A PROOF COPY — NOT CANONICAL COPY\` (refinement: a bounded cleanup of the important Product UI only).
Statuses: **APPROVED** = the Product Owner's exact accepted name or wording (for example the Lock Screen levels
«خاصة جدًا» / «إظهار النوع» / «إظهار السياق» / «إظهار المعاينة», accepted in the P3-A refinement §6); **CANON** = frozen by
an earlier record (source named); **DIRECTION** = the Product Owner's directional proof copy, used as given, not
automatically final; **PROOF** = written for this proof, reviewable, not final; **OPEN** = wording left as open craft;
**FIXTURE** = synthetic event text (second table), never Product copy.

Interface strings: ${rows.length}. Rows with an APPROVED side: ${count('APPROVED')} · CANON: ${count('CANON')} · DIRECTION: ${count('DIRECTION')} · OPEN: ${count('OPEN')}. Fixture strings: ${fx.length}.

| key | Arabic | status | English | status | source |
|---|---|---|---|---|---|
${rows.map((r) => `| \`${r.path}\` | ${cell(r.ar.text)} | ${r.ar.status} | ${cell(r.en?.text)} | ${r.en?.status ?? '—'} | ${cell([r.ar.src, r.en?.src].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · '))} |`).join('\n')}

## Synthetic fixture text — status FIXTURE

These sentences describe invented events (\`source/src/fixtures.mjs\`). They exist to exercise the surfaces; none of them
is proposed as Product copy, and none was polished in the refinement.

| key | Arabic | English | status |
|---|---|---|---|
${fx.map((r) => `| \`${r.path}\` | ${cell(r.ar)} | ${cell(r.en)} | FIXTURE |`).join('\n')}
`;
writeFileSync(join(PKG, 'data', 'COPY_TABLE.md'), md);
console.log(`COPY_TABLE.md: ${rows.length} interface strings + ${fx.length} fixture strings`);
