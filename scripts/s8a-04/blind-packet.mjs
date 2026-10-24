// S8A-04 CP1 — builds the blind rating packet from one results file (operator-only; never a CI step).
//
//   node scripts/s8a-04/blind-packet.mjs <results.json> <out-dir>
//
// Writes <out-dir>/packet.md (what a rater reads: each conversation with its TRUE authors, the existing meanings, the
// preregistered criteria, and the answers of that scenario under neutral labels in a random order) and <out-dir>/key.json
// (label → arm and pass; never given to a rater). A rater never sees the arm, the instructions or the other rater.
import { randomInt } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [resultsPath, outDir] = process.argv.slice(2);
if (!resultsPath || !outDir) { console.error('usage: node scripts/s8a-04/blind-packet.mjs <results.json> <out-dir>'); process.exit(2); }
const results = JSON.parse(readFileSync(resolve(resultsPath), 'utf8'));
const scenarios = JSON.parse(readFileSync(join(HERE, 'social-reading-scenarios.json'), 'utf8')).scenarios;

// Two people who share a name are told apart for the rater by their role key, never by a token the model saw.
const authorLabel = (scenario, person) => {
  const name = scenario.people[person];
  const same = Object.entries(scenario.people).filter(([, other]) => other === name);
  return same.length > 1 ? `${name} [${same.findIndex(([key]) => key === person) === 0 ? 'الأول' : 'الثاني'}]` : name;
};
const shuffle = (items) => { const copy = [...items]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };

const lines = ['# S8A-04 CP1 — blind rating packet', '',
  'Each scenario is a synthetic Arabic group conversation. Its contributions are numbered (ref) and shown with their TRUE author.',
  'Several answers follow, each from an unnamed reader of the same conversation. An answer is a list of "places": a meaning, its themes and the refs it says it is read from.',
  'Rate every answer against every criterion of its scenario: PASS or FAIL, with one short reason. Also flag, per answer:',
  '- identityConfusion: true if any meaning merges two different people, gives one person\'s words or position to another, or treats the two people who share a name as one;',
  '- misattribution: true if any meaning\'s sourceRefs include a contribution that does not say what the meaning says, or leave out one it clearly rests on;',
  '- tokenLeak: true if a meaning or theme contains a code such as S1 / S2.',
  'An answer with no places is a valid answer; rate it on whether "nothing new" is right for that scenario.', ''];
const key = {};
let label = 0;
for (const scenario of scenarios) {
  const answers = results.results.filter((result) => result.scenario === scenario.id);
  if (!answers.length) continue;
  lines.push(`## ${scenario.id}`, '', '**Conversation:**', '');
  scenario.messages.forEach(([person, text], index) => lines.push(`${index + 1}. ${authorLabel(scenario, person)}: ${text}`));
  lines.push('', `**Existing meanings:** ${scenario.existing.length ? scenario.existing.map((meaning) => `«${meaning.meaning}» (refs ${meaning.sources.join(', ')})`).join('; ') : 'none'}`, '', '**Criteria:**', '');
  scenario.criteria.forEach((criterion) => lines.push(`- ${criterion}`));
  lines.push('');
  for (const answer of shuffle(answers)) {
    label += 1;
    const id = `R${String(label).padStart(2, '0')}`;
    key[id] = { scenario: scenario.id, arm: answer.arm, pass: answer.pass };
    lines.push(`### Answer ${id}`, '');
    if (answer.failure) lines.push(`(no answer: the call failed — ${answer.failure})`);
    else if (answer.decoded !== 'VALID') lines.push('(the answer was refused by the server for its shape; the raw answer follows)', '', '```json', JSON.stringify(answer.refusedAnswer, null, 2), '```');
    else if (!answer.places.length) lines.push('(no places)');
    else answer.places.forEach((place, index) => lines.push(`${index + 1}. «${place.meaning}» — themes: ${place.primaryThemes.join('، ')}${place.secondaryThemes.length ? ` / ${place.secondaryThemes.join('، ')}` : ''} — refs: ${place.sourceRefs.join(', ')} — lens: ${place.lensKey}`));
    lines.push('');
  }
}
mkdirSync(resolve(outDir), { recursive: true });
writeFileSync(join(resolve(outDir), 'packet.md'), `${lines.join('\n')}\n`);
writeFileSync(join(resolve(outDir), 'key.json'), `${JSON.stringify(key, null, 2)}\n`);
console.log(`packet: ${label} answers in ${scenarios.length} scenarios → ${join(resolve(outDir), 'packet.md')}`);
