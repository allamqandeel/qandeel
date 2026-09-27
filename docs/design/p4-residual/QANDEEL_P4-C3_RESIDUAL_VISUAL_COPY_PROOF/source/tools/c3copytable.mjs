// P4-C3 — generates data/COPY_DECISION_TABLE.md from the copy registry (src/content.mjs), and appends P3-A's synthetic
// event sentences as FIXTURE_ONLY rows, read from P3-A's own COPY_TABLE.md (never retyped). Also exports the parse of
// P3-A's interface keys so the checks can prove every one of them is dispositioned (C-COPY-P3).
//   node source/tools/c3copytable.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PKG, REPO } from './lib/session.mjs';
import { ROWS, STATUSES, P3_SAME, THREAD } from '../src/content.mjs';

export const P3_TABLE = 'docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/data/COPY_TABLE.md';
export function p3Table() {
  const md = readFileSync(join(REPO, ...P3_TABLE.split('/')), 'utf8');
  const [ui, fx] = md.split('## Synthetic fixture text');
  const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
  const keyOf = (c) => c.replace(/`/g, '');
  const interfaceRows = ui.split('\n').filter((l) => /^\| `/.test(l)).map(cells).map((c) => ({ key: keyOf(c[0]), ar: c[1], arStatus: c[2], en: c[3], enStatus: c[4], source: c[5] }));
  const fixtureRows = fx.split('\n').filter((l) => /^\| `/.test(l)).map(cells).map((c) => ({ key: keyOf(c[0]), ar: c[1], en: c[2], status: c[3] }));
  return { interfaceRows, fixtureRows };
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
if (process.argv[1] && process.argv[1].endsWith('c3copytable.mjs')) {
  const { fixtureRows } = p3Table();
  const convFixtures = ['ar', 'en'].map((l) => THREAD[l].filter((x) => x.text).length);
  const fx = fixtureRows.map((r) => ({ k: 'p3fx.' + r.key, fam: 'P3 residual — synthetic events', surf: 'P3-A fixture event', src: `P3 §17; P3-A COPY_TABLE fixture \`${r.key}\``, st: 'FIXTURE_ONLY', ar: r.ar, en: r.en, frozen: '—', prop: '—', why: 'Synthetic event text; never Product copy (P3 §17).', po: 'NO' }));
  const all = [...ROWS, ...fx];
  const count = Object.fromEntries(STATUSES.map((s) => [s, all.filter((r) => r.st === s).length]));
  const fams = [...new Set(all.map((r) => r.fam))];
  let md = `# P4-C3 — Copy Decision Table\n\n` +
    `**Generated** from \`source/src/content.mjs\` by \`source/tools/c3copytable.mjs\`; P3-A's synthetic event sentences are read from \`${P3_TABLE}\`. Do not edit by hand.\n\n` +
    `**Status: \`P4-C3 COPY PROOF — PROPOSED FOR PRODUCT OWNER REVIEW — NOTHING HERE IS FROZEN BY THIS TABLE\`.** A \`PROPOSED_FOR_PO_REVIEW\` row binds nothing until a later P4 closure freezes it. \`CANON\` rows are copied from the named authority.\n\n` +
    `| Status | Rows | Meaning |\n|---|---|---|\n` +
    `| \`CANON\` | ${count.CANON} | already frozen elsewhere; copied exactly |\n| \`PROPOSED_FOR_PO_REVIEW\` | ${count.PROPOSED_FOR_PO_REVIEW} | authored or adopted by P4-C3 for review |\n` +
    `| \`RUNTIME_GATED\` | ${count.RUNTIME_GATED} | Voice / call words — cannot close here (\`QAN-BL-VOICE-01\`; VI-01 V01–V07); rendered as PROOF ONLY / NOT COPY FREEZE |\n` +
    `| \`AUDIT_OWNED\` | ${count.AUDIT_OWNED} | handed to the End-to-End audit by P4-C2 §5 |\n| \`FIXTURE_ONLY\` | ${count.FIXTURE_ONLY} | evidence text, never Product copy (plus the conversation fixture: ${convFixtures[0]} Arabic and ${convFixtures[1]} English written turns, in \`content.mjs\` \`THREAD\`) |\n| **total** | **${all.length}** | |\n\n` +
    `Register: T1 chrome is neutral contemporary Arabic, gender-neutral (VI-01 §3.1, §3.6). English never ships "context" or "live" as a product noun (VI-01 §4 / §7.2), except where P3 already APPROVED it ("Show context"). QANDEEL is cased QANDEEL (P4-C2 §5). Numerals are Western in both languages (T-12 §9).\n\n`;
  for (const f of fams) {
    const rs = all.filter((r) => r.fam === f);
    md += `## ${f}\n\n| Semantic Key | Surface / Moment | Source authority | Current status | Arabic | English | What is already frozen | What is newly proposed | Reasoning | Needs Product Owner approval? |\n|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const r of rs) md += `| \`${cell(r.k)}\` | ${cell(r.surf)} | ${cell(r.src)} | \`${r.st}\` | ${r.ar === '—' ? '—' : '<bdi dir="rtl">' + cell(r.ar) + '</bdi>'} | ${cell(r.en)} | ${cell(r.frozen)} | ${cell(r.prop)} | ${cell(r.why).replace(/«[^»]*»/g, (m) => `<bdi dir="rtl">${m}</bdi>`)} | ${r.po} |\n`;
    md += '\n';
  }
  md += `## P3-A interface keys covered by an earlier row\n\nThese P3-A keys are the same Product string as a row above, so they are dispositioned there:\n\n` +
    Object.entries(P3_SAME).map(([k, v]) => `- \`${k}\` → \`${v}\``).join('\n') + '\n';
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data', 'COPY_DECISION_TABLE.md'), md);
  writeFileSync(join(PKG, 'data', 'COPY_REGISTRY.json'), JSON.stringify({ note: 'Machine-readable copy registry (src/content.mjs + P3-A fixtures). The Markdown table is generated from the same rows.', count, total: all.length, rows: all }, null, 1) + '\n');
  console.log('COPY_DECISION_TABLE.md', JSON.stringify(count), all.length);
}
