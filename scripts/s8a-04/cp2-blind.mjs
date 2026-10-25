// S8A-04 CP2 — the blind rating of the round-19 stages (Shared Social Memory Controlled Amendment §11: two blind raters,
// the strict rule). Operator-only; never a CI step; makes no model call and reads no key.
//
//   node scripts/s8a-04/cp2-blind.mjs packet --stage=<stage>                 the raters' packet and a blank ratings file
//   node scripts/s8a-04/cp2-blind.mjs tally  --stage=<stage>                 the strict tally of both raters' ratings
//   node scripts/s8a-04/cp2-blind.mjs gate   --stage=<stage> --note="<why>"  records the stage's gate (the launcher's precondition)
//
// The packet is built from the LIVE results of the stage (.s8a-04-reports/cp2/results/live-<stage>.json) and the scenario
// file the results were run against (its canonical SHA-256 must match). Items get neutral labels (A01…) in a random order;
// nothing in the packet names a scenario, a probe kind or a target. The label → item key is written to key.json, which is
// not given to the raters. Each rater fills its own copy of ratings-blank.json (PASS / FAIL / NA per item and criterion),
// saved as ratings-rater-1.json and ratings-rater-2.json. The strict rule: a criterion passes only when both raters pass it;
// NA from both is not applicable; any other disagreement fails it. The objective scores (e.g. stage R's target found) stay
// in the results and are not rated.
//
// --simulate=<tag> in place of the live results builds a packet from a simulated run, to check the tool (marked as such).
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const REPORTS = join(REPO, '.s8a-04-reports', 'cp2');
const STAGES = ['reading', 'placement', 'recall', 'integrated'];
const RATERS = ['rater-1', 'rater-2'];
const VALUES = ['PASS', 'FAIL', 'NA'];
const fail = (why) => { console.error(`[s8a-04 cp2 blind] ${why}`); process.exit(2); };

const [command, ...rest] = process.argv.slice(2);
const option = (name) => rest.map((arg) => new RegExp(`^--${name}=(.+)$`, 'u').exec(arg)?.[1]).find(Boolean) ?? null;
const stage = option('stage');
const simulate = option('simulate');
if (!['packet', 'tally', 'gate'].includes(command ?? '') || !STAGES.includes(stage ?? '')) {
  fail(`usage: node scripts/s8a-04/cp2-blind.mjs packet|tally|gate --stage=${STAGES.join('|')} [--simulate=<tag>] [--note="<why>"]`);
}
const mode = simulate ? `simulated-${simulate}` : 'live';
const resultsPath = join(REPORTS, 'results', `${mode}-${stage}.json`);
const dir = join(REPORTS, 'blind', `${mode}-${stage}`);
const sha = (text) => createHash('sha256').update(text).digest('hex');
const canonical = (path) => sha(JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// ------------------------------------------------------------------------------------------------ rendering
const said = (name, text) => `- **${name}:** ${text}`;
function position(place) {
  const parts = [place.nature === 'CLAIM' ? 'claim' : 'view'];
  if (place.holders?.length) parts.push(`held by ${place.holders.join(', ')}`);
  if (place.absentHolder) parts.push(`held by someone not here: ${place.absentHolder}`);
  if (place.relayedBy?.length) parts.push(`relayed by ${place.relayedBy.join(', ')}`);
  if (place.about?.length) parts.push(`about ${place.about.join(', ')}`);
  if (place.uncertain) parts.push('uncertain');
  if (place.standing && place.standing !== 'CURRENT') parts.push(place.standing.toLowerCase());
  if (place.revisesEarlier) parts.push('revises an earlier position');
  return `- «${place.meaning}» — ${parts.join('; ')}`;
}
function knowledgeLine(entry) {
  const parts = [entry.kind, entry.heldBy?.length ? `held by ${entry.heldBy.join(', ')}` : null, entry.absentHolder ? `held by someone not here: ${entry.absentHolder}` : null,
    entry.relayedBy?.length ? `relayed by ${entry.relayedBy.join(', ')}` : null, entry.about?.length ? `about ${entry.about.join(', ')}` : null,
    entry.uncertain ? 'uncertain' : null, entry.current === false ? 'NOT current' : 'current', entry.since ? `since ${entry.since}` : null].filter(Boolean);
  const earlier = (entry.earlier ?? []).map((old) => `\n    - earlier (${old.since ?? '?'}): «${old.meaning}»${old.uncertain ? ' (uncertain)' : ''}`).join('');
  return `- «${entry.meaning}» — ${parts.join('; ')}${earlier}`;
}
/** The scenario's people as the raters see them: a shared Name carries the scenario key (as the driver shows it). */
function raterNames(people) {
  const names = Object.values(people);
  return new Map(Object.entries(people).map(([key, name]) => [key, names.filter((other) => other === name).length > 1 ? `${name} (${key})` : name]));
}

function readingItems(results, scenarios, cp1) {
  const byId = new Map([...cp1.scenarios, ...scenarios.reading.added].map((scenario) => [scenario.id, scenario]));
  return results.result.items.map((item) => {
    const scenario = byId.get(item.scenario);
    const names = raterNames(scenario.people);
    const body = ['**The conversation**', ...scenario.messages.map(([key, text]) => said(names.get(key), text)),
      ...(scenario.existing.length ? ['', '**Already saved before the last message**', ...scenario.existing.map((meaning) => `- «${meaning.meaning}»`)] : []),
      '', '**What QANDEEL saved from it**', ...(item.stored.length ? item.stored.map(position) : ['- (nothing was saved)']),
      '', '**What a member is shown**', ...(item.shown.length ? item.shown.map((text) => `- ${text}`) : ['- (nothing)'])];
    return { key: `run ${item.run}: ${item.scenario}`, body, criteria: scenario.criteria };
  });
}
function placementItems(results, scenarios) {
  return results.result.worlds.map((world) => ({
    key: world.world,
    body: ['**Each place, its two nearest places on the map and its two most distant places**',
      ...world.neighbours.flatMap((place) => [`- «${place.meaning}»`, `    - nearest: ${place.nearest.map((text) => `«${text}»`).join(' · ')}`,
        `    - most distant: ${place.farthest.map((text) => `«${text}»`).join(' · ')}`])],
    criteria: scenarios.placement.criteria,
  }));
}
function recallItems(results, scenarios) {
  return results.result.probes.map((probe) => ({
    key: probe.probe,
    body: [`**The new message** (${probe.by}): ${probe.text}`, '',
      '**What QANDEEL was given of what the group already knows**', ...(probe.reply.knowledge.length ? probe.reply.knowledge.map(knowledgeLine) : ['- (nothing)']), '',
      `**QANDEEL's reply:** ${probe.reply.text ?? '(no reply: the turn was unavailable)'}`],
    criteria: scenarios.recall.criteria,
  }));
}
function integratedItems(results, scenarios) {
  const byId = new Map(scenarios.integrated.worlds.map((world) => [world.id, world]));
  return results.result.worlds.map((world) => {
    const lines = [];
    // The messages later deleted, by their order among the said messages (the driver's `of`, 1-based).
    const deleted = new Set(world.steps.filter((step) => step.kind === 'delete').map((step) => step.of));
    let saidCount = 0;
    for (const step of world.steps) {
      if (step.kind === 'age') lines.push(`- *(${step.days} days later)*`);
      else if (step.kind === 'filler') lines.push(`- *(${step.messages ?? scenarios.integrated.fillerCount} other messages about other things)*`);
      else if (step.kind === 'delete') lines.push(`- *(${step.by ?? 'a member'} deleted their message marked above)*`);
      else if (step.kind === 'join') lines.push(`- *(${step.who ?? 'a new member'} joined)*`);
      else {
        saidCount += 1;
        lines.push(`${said(step.by, step.text)}${deleted.has(saidCount) ? ' *(later deleted by its author)*' : ''}`);
        lines.push(step.reply?.text ? `  - **QANDEEL:** ${step.reply.text}` : '  - *(no reply: the turn was unavailable)*');
      }
    }
    const last = [...world.steps].reverse().find((step) => step.reply);
    return {
      key: world.world,
      body: ['**The conversation**', ...lines, '', '**What QANDEEL was given for its last reply**',
        ...(last?.reply?.knowledge?.length ? last.reply.knowledge.map(knowledgeLine) : ['- (nothing)'])],
      criteria: byId.get(world.world).criteria,
    };
  });
}

// ------------------------------------------------------------------------------------------------ commands
function loadResults() {
  if (!existsSync(resultsPath)) fail(`no ${mode} results for stage ${stage} (${resultsPath})`);
  const results = readJson(resultsPath);
  const scenariosPath = join(HERE, 'cp2-scenarios.json');
  if (canonical(scenariosPath) !== results.scenariosSha256) fail('the scenario file differs from the one the results were run against');
  const cp1Path = join(HERE, 'social-reading-scenarios.json');
  if (canonical(cp1Path) !== results.cp1ScenariosSha256) fail('the CP1 scenario file differs from the one the results were run against');
  if (results.result === null) fail(`stage ${stage} has no result to rate (stopped: ${results.stopped})`);
  return { results, scenarios: readJson(scenariosPath), cp1: readJson(cp1Path) };
}

if (command === 'packet') {
  const { results, scenarios, cp1 } = loadResults();
  const items = { reading: () => readingItems(results, scenarios, cp1), placement: () => placementItems(results, scenarios),
    recall: () => recallItems(results, scenarios), integrated: () => integratedItems(results, scenarios) }[stage]();
  // A random order, then neutral labels.
  const order = items.map((item) => ({ item, sort: randomBytes(4).readUInt32BE(0) })).sort((a, b) => a.sort - b.sort).map(({ item }) => item);
  const labelled = order.map((item, index) => ({ ...item, label: `A${String(index + 1).padStart(2, '0')}` }));
  mkdirSync(dir, { recursive: true });
  const packet = [`# S8A-04 CP2 — blind rating, stage ${stage}${simulate ? ' (SIMULATED RUN: tool check only, not a rating)' : ''}`, '',
    'Rate each item on each of its criteria: **PASS**, **FAIL** or **NA** (the criterion does not apply to this item).',
    'Rate only what is shown. Write your answers in your copy of `ratings-blank.json`; do not consult the other rater.',
    results.result.partial ? '\n*The stage stopped before its end; the items it reached are shown.*' : '', '',
    ...labelled.flatMap((item) => ['---', '', `## ${item.label}`, '', ...item.body, '', '**Criteria**', ...item.criteria.map((criterion) => `- ${criterion}`), ''])].join('\n');
  writeFileSync(join(dir, 'packet.md'), `${packet}\n`);
  const criterionId = (criterion) => /^(C\d+)\b/u.exec(criterion)?.[1] ?? criterion.slice(0, 12);
  writeFileSync(join(dir, 'ratings-blank.json'), `${JSON.stringify({ stage, items: Object.fromEntries(labelled.map((item) =>
    [item.label, Object.fromEntries(item.criteria.map((criterion) => [criterionId(criterion), null]))])) }, null, 2)}\n`);
  writeFileSync(join(dir, 'key.json'), `${JSON.stringify({ stage, results: resultsPath, resultsSha256: sha(readFileSync(resultsPath)), packetSha256: sha(`${packet}\n`),
    labels: Object.fromEntries(labelled.map((item) => [item.label, item.key])) }, null, 2)}\n`);
  console.log(`[s8a-04 cp2 blind] ${labelled.length} item(s) → ${join(dir, 'packet.md')} (key.json is not for the raters)`);
}

function tally() {
  const key = readJson(join(dir, 'key.json'));
  const blank = readJson(join(dir, 'ratings-blank.json'));
  const ratings = RATERS.map((rater) => {
    const path = join(dir, `ratings-${rater}.json`);
    if (!existsSync(path)) fail(`${rater} has not rated (${path})`);
    return readJson(path).items;
  });
  const items = {};
  const byCriterion = {};
  let incomplete = 0;
  for (const [label, criteria] of Object.entries(blank.items)) {
    const verdicts = {};
    for (const criterion of Object.keys(criteria)) {
      const given = ratings.map((rating) => rating?.[label]?.[criterion] ?? null);
      if (!given.every((value) => VALUES.includes(value))) { incomplete += 1; verdicts[criterion] = 'UNRATED'; continue; }
      verdicts[criterion] = given.every((value) => value === 'NA') ? 'NA' : given.every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
      const count = (byCriterion[criterion] ??= { PASS: 0, FAIL: 0, NA: 0 });
      count[verdicts[criterion]] += 1;
    }
    const applicable = Object.values(verdicts).filter((verdict) => verdict !== 'NA');
    items[label] = { item: key.labels[label], verdicts, passed: applicable.length > 0 && applicable.every((verdict) => verdict === 'PASS') };
  }
  const passed = Object.values(items).filter((item) => item.passed).length;
  const result = { stage, mode, rule: 'strict: both raters PASS', resultsSha256: key.resultsSha256, packetSha256: key.packetSha256, incomplete, passed, of: Object.keys(items).length, byCriterion, items };
  writeFileSync(join(dir, 'tally.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (command === 'tally') {
  const result = tally();
  console.log(`[s8a-04 cp2 blind] stage ${stage}: ${result.passed}/${result.of} item(s) pass every applicable criterion (strict rule)${result.incomplete ? `; ${result.incomplete} rating(s) missing` : ''}`);
  for (const [criterion, count] of Object.entries(result.byCriterion)) console.log(`  ${criterion}: PASS ${count.PASS} · FAIL ${count.FAIL} · NA ${count.NA}`);
  for (const item of Object.values(result.items).filter((entry) => !entry.passed)) console.log(`  not passed: ${item.item} ${JSON.stringify(item.verdicts)}`);
}

if (command === 'gate') {
  if (simulate) fail('a gate is recorded for a live stage only');
  const note = option('note');
  if (!note) fail('--note="<the reason the stage passes its gate>" is required');
  const results = readJson(resultsPath);
  if (results.mode !== 'LIVE') fail('the results are not a live run');
  if (results.stopped) fail(`stage ${stage} stopped (${results.stopped}); its gate cannot pass`);
  const result = tally();
  if (result.incomplete) fail(`${result.incomplete} rating(s) are missing`);
  if (sha(readFileSync(resultsPath)) !== result.resultsSha256) fail('the results changed after the packet was built');
  mkdirSync(join(REPORTS, 'gates'), { recursive: true });
  writeFileSync(join(REPORTS, 'gates', `${stage}.passed`), `${JSON.stringify({ stage, recordedAt: new Date().toISOString(), note,
    resultsSha256: result.resultsSha256, tallySha256: sha(readFileSync(join(dir, 'tally.json'))), passed: result.passed, of: result.of }, null, 2)}\n`);
  console.log(`[s8a-04 cp2 blind] gate recorded for stage ${stage}: ${result.passed}/${result.of} (strict); the next stage may run live`);
}
