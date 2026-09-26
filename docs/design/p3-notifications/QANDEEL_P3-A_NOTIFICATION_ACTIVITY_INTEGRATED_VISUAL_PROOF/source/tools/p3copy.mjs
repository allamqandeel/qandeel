// P3-A — writes data/COPY_TABLE.md from src/content.mjs: every user-facing string in both languages with its status
// (APPROVED / CANON / DIRECTION / PROOF / OPEN) and its source. Generated, so it cannot drift from the prototype.
//   node source/tools/p3copy.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COPY } from '../src/content.mjs';
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
const md = `# P3-A — Bilingual copy table (generated from \`source/src/content.mjs\`)

**Status:** \`P3-A PROOF COPY — NOT CANONICAL COPY\`. Statuses: **APPROVED** = the Product Owner's exact accepted name or
wording; **CANON** = frozen by an earlier record (source named); **DIRECTION** = the Product Owner's directional proof
copy, used as given, not automatically final; **PROOF** = written for this proof; **OPEN** = wording left as open craft.

Strings: ${rows.length}. Rows with an APPROVED side: ${count('APPROVED')} · CANON: ${count('CANON')} · DIRECTION: ${count('DIRECTION')} · OPEN: ${count('OPEN')}.

| key | Arabic | status | English | status | source |
|---|---|---|---|---|---|
${rows.map((r) => `| \`${r.path}\` | ${cell(r.ar.text)} | ${r.ar.status} | ${cell(r.en?.text)} | ${r.en?.status ?? '—'} | ${cell([r.ar.src, r.en?.src].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · '))} |`).join('\n')}

Activity sentences, strip sentences and Lock Screen words for the fixture events live in \`source/src/fixtures.mjs\`;
all of them are **PROOF** copy about synthetic events.
`;
writeFileSync(join(PKG, 'data', 'COPY_TABLE.md'), md);
console.log(`COPY_TABLE.md: ${rows.length} strings`);
