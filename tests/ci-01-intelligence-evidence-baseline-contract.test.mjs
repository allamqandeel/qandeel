// Static contract for CI-01 / C1-A — Intelligence Evidence & Conversational Personality Baseline.
//
// What this contract pins, and what it deliberately does not (C1 Task Contract §0.4, "No defect
// pinning"):
//
//   PINNED — authorities and boundaries that must not be crossed, each a single cited fact:
//     * the two canonical records exist, carry their banners, the rule IDs CI-01-L1…L8, the
//       three-state evidence vocabulary (D4), a baseline SHA and the OPEN COPY marking;
//     * CI-01-L1  owner-scoped RLS on public.memories (0004) and public.hypotheses (0005);
//     * CI-01-L2  no fine-tuning / training-job / reward-model identifier anywhere in apps/api/src
//                 (comments and string literals stripped first, so prose about the prohibition is
//                 not a hit);
//     * CI-01-L5  the 0006 CHECKs that keep Confidence numeric_score / confidence_band NULL;
//     * CI-01-L7  the 0019 outbox CHECK contains_content = false;
//     * CI-01-L8  the orchestrator's Safety BLOCK short-circuit;
//     * PG-02 is tracked in the canonical backlog as QAN-BL-INTEL-01 (any lifecycle state — a
//       future tombstone is a repair, not a violation; BG-04 never drops an ID).
//
//   NOT PINNED — current state recorded in the census as a versioned baseline: `locale: 'und'`,
//   the 0036 GRANT, the absence of a learning mechanism, the brain-eval 20–30 bound, the regex-only
//   Memory capture, the static guidance string, the PG-02 behaviour itself. An authorized repair of
//   any of them must pass this file untouched.
//
// File reads only. No database, no network, no `.env`, no provider key.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (relative) => readFile(new URL(relative, root), 'utf8');

const BASELINE_RECORD = 'docs/intelligence-evidence-baseline-v1.md';
const PERSONALITY_RECORD = 'docs/conversational-personality-v1.md';

const baseline = await read(BASELINE_RECORD);
const personality = await read(PERSONALITY_RECORD);
const backlog = await read('docs/qandeel-canonical-backlog-v1.md');
const packageJson = JSON.parse(await read('package.json'));

// ---------------------------------------------------------------------------------------------
// The records themselves (owned by CI-01).
// ---------------------------------------------------------------------------------------------

test('the Intelligence Evidence Baseline record exists, is a Status-bannered canonical record, and names its baseline', () => {
  assert.match(baseline, /^# QANDEEL — Intelligence Evidence Baseline v1$/mu);
  assert.match(baseline, /^\*\*Status:\*\* `[^`\n]+`/mu, 'the record carries a **Status:** banner (never **Phase:**)');
  assert.doesNotMatch(baseline, /^\*\*Phase:\*\*/mu, 'CI-01 is a task, not a Connected Worlds phase');
  assert.match(baseline, /\*\*Baseline SHA:\*\* `main` `[0-9a-f]{40}`/u, 'the census is pinned to a full main SHA');
  assert.match(baseline, /\*\*Census version:\*\* `census-v\d+ @ [0-9a-f]{7,40}`/u, 'the census is versioned, so a later repair bumps it instead of fighting this file');
});

test('the record states the eight privacy / learning rules CI-01-L1 … L8 (D3), each as a named rule', () => {
  for (let n = 1; n <= 8; n += 1) {
    assert.match(baseline, new RegExp(`\\*\\*\`CI-01-L${n}\`\\*\\*`, 'u'), `CI-01-L${n} is stated`);
  }
  assert.doesNotMatch(baseline, /\*\*`CI-01-L9`\*\*/u, 'the rule set is the Product Owner\'s eight limits; a ninth is a Product decision, not an edit');
  assert.match(baseline, /No training, fine-tuning, reward modelling or outcome-feedback learning on private conversations/u,
    'L2 names the one limit no earlier record stated by name');
});

test('the record keeps the D4 three-state distinction apart and invents no unified deletion rule', () => {
  assert.match(baseline, /\*\*\(a\) technically stored\*\*/u);
  assert.match(baseline, /\*\*\(b\) currently usable\*\*/u);
  assert.match(baseline, /\*\*\(c\) legitimately retainable\*\*/u);
  assert.match(baseline, /presence after the evidence was deleted is state \(a\) only/iu,
    'a surviving derivative is not a permission');
  assert.match(baseline, /CI-01 invents no unified deletion rule/u);
  assert.match(baseline, /\(a\) without \(b\)[^\n]*pending re-evaluation/u, 'PG-02 is classified as stored, not usable, pending re-evaluation (D6)');
});

test('the Conversational Personality record exists as a design-only record under the one-personality principle', () => {
  assert.match(personality, /^# QANDEEL — Conversational Personality & Interaction Adaptation v1 \(design\)$/mu);
  assert.match(personality, /^\*\*Status:\*\* `[^`\n]*DESIGN ONLY[^`\n]*`/mu);
  assert.doesNotMatch(personality, /^\*\*Phase:\*\*/mu);
  assert.match(personality, /ONE QANDEEL PERSONALITY — ADAPTIVE NATURAL EXPRESSION/u);
  assert.match(personality, /OPEN COPY until the Product Copy Gate/u, 'every conversational text is OPEN COPY');
  assert.match(personality, /not evidence that any LLM will reach the required quality/u,
    'design approval is not a quality claim (P9 / decision 5)');
});

test('the personality design forbids a second runtime and keeps the register choice with the model (P3 / P5 as amended)', () => {
  assert.match(personality, /It never decides the register\./u);
  assert.match(personality, /never a second system prompt, a persona registry or a provider-specific prompt dialect/u);
  assert.match(personality, /a sentiment or emotion classifier \(by model or by rule\)/u, 'no sentiment classifier');
  assert.match(personality, /No psychological inference is computed by rule or recorded anywhere/u);
  assert.match(personality, /\*\*Withdrawn \(P5\):\*\* `SERIOUS_REGISTER` and `LIGHT_REGISTER_PERMITTED`/u,
    'the two tone-selecting directives stay withdrawn');
  assert.match(personality,
    /\*\*Safety and higher authorities\*\* > an \*\*explicit request in the current message\*\*[^\n]*> the \*\*durable declared preference\*\* > the model's own contextual reading/u,
    'the P4 precedence rule is stated in order');
  assert.match(personality, /no table, UI, save path or migration in C1/u, 'Interaction Preferences stay design-only');
});

// ---------------------------------------------------------------------------------------------
// CI-01-L1 — ownership: owner-scoped RLS on the two Personal intelligence tables.
// These migrations are immutable by the repository's own rule; a later authorized change arrives as
// a new migration and updates the record, which is why pinning their text freezes no future.
// ---------------------------------------------------------------------------------------------

test('CI-01-L1: public.memories and public.hypotheses are owner-scoped by RLS on auth.uid()', async () => {
  const memories = await read('database/migrations/0004_memory_runtime.sql');
  assert.match(memories, /ALTER TABLE public\.memories ENABLE ROW LEVEL SECURITY;/u);
  assert.match(memories, /CREATE POLICY memories_select_own ON public\.memories[\s\S]{0,200}?USING \(user_id = \(SELECT auth\.uid\(\)\)\)/u);
  assert.match(memories, /CREATE POLICY memories_insert_own ON public\.memories[\s\S]{0,200}?WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\)/u);

  const hypotheses = await read('database/migrations/0005_hypothesis_runtime.sql');
  assert.match(hypotheses, /ALTER TABLE public\.hypotheses ENABLE ROW LEVEL SECURITY;/u);
  assert.match(hypotheses, /CREATE POLICY hypotheses_select_own ON public\.hypotheses FOR SELECT TO authenticated USING \(user_id = \(SELECT auth\.uid\(\)\)\);/u);
  assert.match(hypotheses, /CREATE POLICY hypotheses_insert_own ON public\.hypotheses FOR INSERT TO authenticated WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\);/u);
});

// ---------------------------------------------------------------------------------------------
// CI-01-L2 — no unauthorized training path. A negative sweep of production sources, comments and
// string literals stripped, identifiers only. Lifted by Controlled Change together with the consent
// design the Product Owner approves (D3 / D9) — never silently.
// ---------------------------------------------------------------------------------------------

async function productionSources(directory) {
  const base = fileURLToPath(directory);
  const entries = await readdir(base, { withFileTypes: true, recursive: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'));
  return Promise.all(files.map(async (entry) => {
    const path = join(entry.parentPath ?? base, entry.name);
    return { path: path.slice(fileURLToPath(root).length).replaceAll('\\', '/'), text: await readFile(path, 'utf8') };
  }));
}

function identifiersOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gu, '$1')
    .replace(/`(?:[^`\\]|\\.)*`/gu, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
}

test('CI-01-L2: apps/api/src carries no fine-tuning, training-job or reward-model identifier', async () => {
  const FORBIDDEN = [
    [/\bfine[-_]?tun(?:e|ed|es|ing)\b/iu, 'fine-tuning'],
    [/\btraining[-_]?(?:job|run|set|data|pipeline|loop)s?\b/iu, 'a training job / set / pipeline'],
    [/\breward[-_]?model(?:s|ing)?\b/iu, 'a reward model'],
  ];
  const offenders = [];
  for (const { path, text } of await productionSources(new URL('apps/api/src/', root))) {
    const code = identifiersOnly(text);
    for (const [pattern, what] of FORBIDDEN) {
      if (pattern.test(code)) offenders.push(`${path}: ${what}`);
    }
  }
  assert.deepEqual(offenders, [],
    'CI-01-L2: a training or fine-tuning path on Personal data needs the Product Owner\'s explicit consent design (D3 / D9) and a Controlled Change to this rule');
});

// ---------------------------------------------------------------------------------------------
// CI-01-L5 — Confidence semantics: no number is produced until a calibrated model is approved.
// ---------------------------------------------------------------------------------------------

test('CI-01-L5: the Confidence table keeps numeric_score and confidence_band NULL by CHECK (0006)', async () => {
  const confidence = await read('database/migrations/0006_confidence_runtime.sql');
  assert.match(confidence, /CONSTRAINT confidence_score_unassigned_check CHECK \(numeric_score IS NULL\)/u);
  assert.match(confidence, /CONSTRAINT confidence_band_unassigned_check CHECK \(confidence_band IS NULL\)/u);
});

// ---------------------------------------------------------------------------------------------
// CI-01-L7 — no content in telemetry: the outbox row cannot claim to carry content.
// ---------------------------------------------------------------------------------------------

test('CI-01-L7: the runtime event outbox forbids content by CHECK (0019)', async () => {
  const outbox = await read('database/migrations/0019_runtime_event_outbox_publisher_v1.sql');
  assert.match(outbox, /contains_content boolean NOT NULL DEFAULT false CHECK \(contains_content = false\)/u);
});

// ---------------------------------------------------------------------------------------------
// CI-01-L8 — Safety outranks every evidence and style path: BLOCK short-circuits the turn.
// ---------------------------------------------------------------------------------------------

test('CI-01-L8: the orchestrator short-circuits a Safety BLOCK with the deterministic response', async () => {
  const orchestrator = await read('apps/api/src/conversation/conversation-orchestrator.service.ts');
  assert.match(orchestrator, /SAFETY_RESPONSE_GATE/u, 'the orchestrator injects the Safety gate');
  assert.match(orchestrator, /if \(safety\.disposition === 'BLOCK'\) \{[\s\S]{0,600}?safety\.deterministicResponse/u,
    'a BLOCK disposition answers with the Safety gate\'s deterministic response before any provider or style decision');
});

// ---------------------------------------------------------------------------------------------
// PG-02 is tracked, never dropped. Any of the four backlog statuses satisfies this: a future
// tombstone records the repair; only the disappearance of the ID would be a violation (BG-04).
// ---------------------------------------------------------------------------------------------

test('PG-02 is tracked in the canonical backlog as QAN-BL-INTEL-01 with a full item and an index row', () => {
  const STATUS = '(?:DEFERRED — OWNED|VALIDATION — OPEN|OPEN — UNASSIGNED|CLOSED — TOMBSTONE)';
  assert.match(backlog, new RegExp(`^\\| \`QAN-BL-INTEL-01\` \\| [^|\\n]*PG-02[^|\\n]* \\| \`[^|\\n]+\` \\| \`(?:HIGH|MEDIUM|LOW)\` \\| \`${STATUS}\` \\|$`, 'mu'),
    'the §4 index carries the row with the full schema');
  assert.match(backlog, /^### `QAN-BL-INTEL-01` — Personal Evidence Invalidation → Derived Understanding Re-evaluation \(PG-02\)$/mu,
    'the item exists under its own heading');
  assert.match(backlog, new RegExp(`### \`QAN-BL-INTEL-01\`[\\s\\S]*?\\*\\*Status:\\*\\* \`${STATUS}\``, 'u'),
    'the item states one of the four statuses');
  assert.match(baseline, /`QAN-BL-INTEL-01`/u, 'the baseline record cites the item');
});

// ---------------------------------------------------------------------------------------------
// Registration. The api-ci.yml step is added by the closing change (C1 contract decision 6).
// ---------------------------------------------------------------------------------------------

test('this contract is registered as a root script', () => {
  assert.equal(packageJson.scripts['test:ci-01-intelligence-evidence-baseline-contract'],
    'node --test tests/ci-01-intelligence-evidence-baseline-contract.test.mjs');
});
