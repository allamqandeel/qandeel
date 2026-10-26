// S8A-04 CP3-D V2 — Tier 2: the Product Owner's blind comparison (RATER_RUBRIC.md §4; operator-only; no network).
//
//   node scripts/s8a-04/cp3d-v2/tier2-blind.mjs --packet <tier2 results.json> <out.md>
//       20 pairs: the conversation (Names, earlier messages, the last message) and two replies A / B, no item, no label of
//       which is which; the order per scenario is fixed by sha256("QANDEEL-CP3D-V2-BLIND-1" + id): an even first hex digit
//       puts the knowledge reply first. A withheld reply is shown as «— لم يصل رد من قنديل —».
//   node scripts/s8a-04/cp3d-v2/tier2-blind.mjs --tally <tier2 results.json> <answers.json>
//       answers: {"answers": [{"scenario": "T2-07", "choice": "A" | "B" | "EQUAL"}, …]}; "not worse" = the knowledge reply
//       is chosen or EQUAL. Unblinds only here.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = 'QANDEEL-CP3D-V2-BLIND-1';
const NONE = '— لم يصل رد من قنديل —';
const scenarios = JSON.parse(readFileSync(join(HERE, 'tier2-scenarios.json'), 'utf8')).scenarios.filter((s) => s.comparison === true);
const [mode, resultsPath, other] = process.argv.slice(2);
const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
const knowledgeFirst = (id) => parseInt(createHash('sha256').update(`${SEED}${id}`, 'utf8').digest('hex')[0], 16) % 2 === 0;
const textOf = (id, arm) => { const a = results.arms.find((x) => x.scenario === id && x.arm === arm); return a?.delivered ? a.deliveredText : NONE; };

if (scenarios.length !== 20) { console.error('the set does not have 20 comparison scenarios'); process.exit(2); }
if (mode === '--packet') {
  const nameOf = (s, key) => s.members.find((m) => m.key === key)?.name ?? key;
  const lines = ['# مقارنة عمياء — CP3-D V2 (20 زوجًا)', '', 'لكل زوج: أي الردّين تفضّل أن يصل للمجموعة؟ أجب A أو B أو EQUAL.', ''];
  for (const s of scenarios) {
    const [a, b] = knowledgeFirst(s.id) ? ['KNOWLEDGE', 'WITHOUT'] : ['WITHOUT', 'KNOWLEDGE'];
    lines.push(`## ${s.id}`, '', ...s.history.map((h) => `- **${nameOf(s, h.from)}:** ${h.text}`), `- **${nameOf(s, s.turn.from)}:** ${s.turn.text}`, '',
      `**A:** ${textOf(s.id, a)}`, '', `**B:** ${textOf(s.id, b)}`, '', 'الاختيار: ____', '');
  }
  writeFileSync(other, `${lines.join('\n')}\n`);
  console.log(`[tier2-blind] packet: 20 pairs -> ${other}`);
} else if (mode === '--tally') {
  const answers = new Map(JSON.parse(readFileSync(other, 'utf8')).answers.map((x) => [x.scenario, x.choice]));
  const rows = scenarios.map((s) => {
    const choice = answers.get(s.id) ?? null;
    const knowledgeLabel = knowledgeFirst(s.id) ? 'A' : 'B';
    return { scenario: s.id, choice, knowledgeWas: knowledgeLabel, notWorse: choice === 'EQUAL' || choice === knowledgeLabel };
  });
  if (rows.some((r) => !['A', 'B', 'EQUAL'].includes(r.choice))) { console.error('every pair needs A, B or EQUAL'); process.exit(2); }
  console.log(JSON.stringify({ notWorse: rows.filter((r) => r.notWorse).length, of: 20, rows }, null, 2));
} else {
  console.error('usage: tier2-blind.mjs --packet <results> <out.md> | --tally <results> <answers.json>');
  process.exit(2);
}
