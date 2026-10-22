// Static contract for ACE-SP-01 — Shared / Public QANDEEL Personality Core (the ACE-SP-01 controlled amendment;
// Product Copy Gate CG-1 … CG-6, approved by the Product Owner on 2026-10-12).
//
// Pins, each a single cited fact:
//   * ONE personality: the world-neutral core is derived from the approved core by reference, in the one Behavioral
//     Runtime file, with the approved CG-1 wording and the CG-2 / CG-3 one-phrase substitutions; no paragraph exists twice;
//   * one pure append-only helper; the Worlds keep Text v1 + their frame as the literal prefix and `locale: 'und'`; no
//     World source names the core, the suspension line or the Personal preference authority, or imports the other World;
//   * BLOCK still returns before the assembler and the ONE provider call in both generators;
//   * authority before code: the standalone amendment exists with its banner, is registered in the Canonical Authority
//     Index (and the Project Map, when present), and CW2-03 / 04 / 08 still hash to their provenance rows (unchanged);
//   * the task's own record, its backlog dispositions and its CI registration (BG-08 / BG-09).
//
// File reads only. No database, no network, no `.env`, no provider key.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (relative) => readFile(new URL(relative, root), 'utf8');
const readBytes = (relative) => readFile(new URL(relative, root));

const CW2 = 'docs/canonical-authority/connected-worlds-v2';
const AMENDMENT = `${CW2}/architecture/QANDEEL_ACE-SP-01_SHARED_PUBLIC_PERSONALITY_CORE_CONTROLLED_AMENDMENT_v1.0.md`;
const RECORD = 'docs/e2e/QANDEEL_ACE_SP_01_SHARED_PUBLIC_PERSONALITY_CORE_IMPLEMENTATION_RECORD_v1.md';

const policy = await read('apps/api/src/conversation/behavioral-response-policy.service.ts');
const shared = await read('apps/api/src/shared-world/shared-conversation-model-input.ts');
const publicInput = await read('apps/api/src/public-world/public-qandeel-model-input.ts');
const sharedGenerator = await read('apps/api/src/shared-world/shared-conversation-reply.generator.ts');
const publicGenerator = await read('apps/api/src/public-world/public-qandeel-reply.service.ts');
const amendment = await read(AMENDMENT);
const index = await read('docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md');
const provenance = await read(`${CW2}/CW2_SOURCE_PROVENANCE.sha256`);
const record = await read(RECORD);
const backlog = await read('docs/qandeel-canonical-backlog-v1.md');
const packageJson = JSON.parse(await read('package.json'));
const apiCi = await read('.github/workflows/api-ci.yml');

// The Product Owner's approved texts (CG-1, CG-4), verbatim.
const CG_1 = 'Match the language or dialect of the message you are answering when reliably supported, respecting safety and explicit current requests. Never infer identity from language or dialect.';
const CG_4 = 'This turn carries safety guidance: do not use humour or playfulness in this reply.';

const count = (text, needle) => text.split(needle).length - 1;

test('ONE personality: the world-neutral core is derived from the approved core by reference (CG-1 … CG-3, CG-5)', () => {
  assert.ok(policy.includes(`const WORLD_NEUTRAL_LANGUAGE_PARAGRAPH = '${CG_1}';`), 'CG-1 is the approved wording');
  assert.ok(policy.includes("export const QANDEEL_PERSONALITY_CORE_V1_WORLD_NEUTRAL = QANDEEL_PERSONALITY_CORE_V1.split('\\n').map((paragraph, index) => {"),
    'derived from the approved constant, not a second copy');
  assert.ok(policy.includes('  if (index === 2) return WORLD_NEUTRAL_LANGUAGE_PARAGRAPH;'));
  assert.ok(policy.includes("  if (index === 5) return paragraph.replace('at the user\\'s expense', 'at anyone\\'s expense');"), 'CG-2');
  assert.ok(policy.includes("  if (index === 6) return paragraph.replace('humiliating the user', 'humiliating anyone');"), 'CG-3');
  assert.ok(policy.includes('  return paragraph;\n}).join(\'\\n\');'), 'every other paragraph is the approved bytes (CG-5)');
  // RE-ANCHORED by S8A-02 (2026-10-21; Product Owner D2, the narrow controlled amendment of ACE-SP-01): core v1 and its
  // world-neutral derivation stay as the record; core v2 is derived by the SAME mapping and is what the Worlds render. The
  // "no second copy" rule is checked per core: each opening exists once inside its own core and nowhere else.
  const coreBlock = (name) => policy.slice(policy.indexOf(`export const ${name} = [`), policy.indexOf('].join(', policy.indexOf(`export const ${name} = [`)));
  const v1 = coreBlock('QANDEEL_PERSONALITY_CORE_V1');
  const v2 = coreBlock('QANDEEL_PERSONALITY_CORE_V2');
  // RE-ANCHORED by S8A-02 Round 2 (2026-10-21; the Round 2 Copy Gate): core v3 is a third core block, derived the same way.
  const v3 = coreBlock('QANDEEL_PERSONALITY_CORE_V3');
  const outside = policy.replace(v1, '').replace(v2, '').replace(v3, '');
  for (const opening of ['Speak naturally as QANDEEL', 'Be concise by default', 'Listen first.', 'Show care through accurate attention',
    'Light humour may arise naturally', 'When genuine evidence supports', 'Keep suggestions proportionate']) {
    assert.equal(count(v1, opening), 1, `exactly one literal of the v1 paragraph opening "${opening}" exists in core v1`);
    assert.equal(count(outside, opening), 0, `no copy of "${opening}" outside the cores`);
  }
  const S8A_02_WN_3 = 'Match the language or dialect of the message you are answering when reliably supported, respecting safety and explicit current requests. Keep one dialect consistent within a reply instead of mixing forms from different dialects. Never infer identity from language or dialect.';
  assert.ok(policy.includes(`const WORLD_NEUTRAL_LANGUAGE_PARAGRAPH_V2 = '${S8A_02_WN_3}';`), 'the approved world-neutral paragraph 3 of core v2 (D2)');
  assert.ok(policy.includes("export const QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL = QANDEEL_PERSONALITY_CORE_V2.split('\\n').map((paragraph, index) => {"),
    'core v2 world-neutral is derived from core v2, not a second copy');
  assert.ok(policy.includes('  if (index === 2) return WORLD_NEUTRAL_LANGUAGE_PARAGRAPH_V2;'));
  assert.ok(policy.includes("  if (index === 5) return replaceExactlyOnce(paragraph, 'at the user\\'s expense', 'at anyone\\'s expense');"), 'CG-2 on v2');
  assert.ok(policy.includes("  if (index === 6) return replaceExactlyOnce(paragraph, 'humiliating the user', 'humiliating anyone');"), 'CG-3 on v2');
  for (const opening of ['Speak as QANDEEL: one consistent personality', 'Answer directly when the request is clear', 'Understand what the person means',
    'Show care through accurate attention, not canned empathy', 'Humour is a natural part of you', 'When genuine evidence supports disagreement, say so',
    'Keep suggestions proportionate to the evidence and preserve user agency. Never claim to be human']) {
    assert.equal(count(v2, opening), 1, `exactly one literal of the v2 paragraph opening "${opening}" exists in core v2`);
  }
  // S8A-02 Round 2: the approved world-neutral paragraph 3 of core v3, verbatim, and the same mapping applied to core v3.
  const S8A_02_R2_WN_3 = "Answer each message in its writer\\'s language or dialect when reliably supported, subject to safety and that writer\\'s own explicit language request within its stated scope. A request made for one reply applies only to that reply; a request explicitly covering subsequent replies may apply only to the same writer within this conversation. Never apply one person\\'s request to anyone else, make it a rule for the group, or save it as a standing preference. Keep one dialect consistent within a reply instead of mixing forms from different dialects. When the language marks grammatical gender, follow the gender a person\\'s own words in this conversation clearly show, only for how you word your reply and never as a fact about them; when their words have not shown it, use natural wording that does not assume one, and never guess it from a name, a topic or a stereotype. Never infer identity from language or dialect.";
  assert.ok(policy.includes(`const WORLD_NEUTRAL_LANGUAGE_PARAGRAPH_V3 = '${S8A_02_R2_WN_3}';`), 'the approved world-neutral paragraph 3 of core v3');
  assert.ok(policy.includes("export const QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL = QANDEEL_PERSONALITY_CORE_V3.split('\\n').map((paragraph, index) => {"),
    'core v3 world-neutral is derived from core v3, not a second copy');
  assert.ok(policy.includes('  if (index === 2) return WORLD_NEUTRAL_LANGUAGE_PARAGRAPH_V3;'));
  // RE-ANCHORED by S8A-02 Round 3 (2026-10-21; Product Owner Round 3 decisions): the same mapping applied to core v3.1 too.
  assert.equal(count(policy, "  if (index === 5) return replaceExactlyOnce(paragraph, 'at the user\\'s expense', 'at anyone\\'s expense');"), 3, 'CG-2 on v2, v3 and v3.1');
  assert.equal(count(policy, "  if (index === 6) return replaceExactlyOnce(paragraph, 'humiliating the user', 'humiliating anyone');"), 3, 'CG-3 on v2, v3 and v3.1');
  // S8A-02 Round 3: core v3.1 is derived from core v3 (two exact replacements, no second literal core), and its world-neutral
  // form from core v3.1 by the same mapping, with world-neutral paragraph 3.1 sharing the one gender clause.
  assert.ok(policy.includes("export const QANDEEL_PERSONALITY_CORE_V3_1 = QANDEEL_PERSONALITY_CORE_V3.split('\\n').map((paragraph, index) => {"), 'core v3.1 is derived from core v3');
  assert.ok(policy.includes("export const QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL = QANDEEL_PERSONALITY_CORE_V3_1.split('\\n').map((paragraph, index) => {"),
    'core v3.1 world-neutral is derived from core v3.1, not a second copy');
  assert.ok(policy.includes('  if (index === 2) return WORLD_NEUTRAL_LANGUAGE_PARAGRAPH_V3_1;'));
  assert.equal(count(policy, ' + PERSONALITY_GENDER_CLAUSE_V3_1 + '), 1, 'world-neutral paragraph 3.1 reuses the one gender clause');
  assert.ok(policy.includes('  if (index === 2) return replaceExactlyOnce(paragraph, ') && policy.includes(', PERSONALITY_GENDER_CLAUSE_V3_1);'), 'paragraph 3 of core v3.1 reuses it too');
  for (const opening of ['Speak as QANDEEL: one consistent personality', 'Answer directly when the request is clear', 'Reply in the person',
    'Understand what the person means from their own words', 'Be warmly present', 'You have a quick, light sense of humour',
    'When genuine evidence supports disagreement, say so', 'Keep suggestions proportionate to the evidence and preserve user agency. Never claim to be human']) {
    assert.equal(count(v3, opening), 1, `exactly one literal of the v3 paragraph opening "${opening}" exists in core v3`);
  }
});

test('one pure, append-only helper adds the approved Safety humour suspension on GUIDED turns only (CG-4)', () => {
  assert.match(policy, /import \{\n  compileInteractionPreferenceBlock, SAFETY_HUMOUR_SUSPENSION_LINE, type InteractionPreferenceGuidanceInput,\n\} from '\.\.\/interaction-preferences\/interaction-preference-guidance';/u,
    'the approved line is reused from its one source through the existing import');
  // RE-ANCHORED by S8A-02 CP3 correction (2026-10-22; Product Owner Final Integrated Correction): the compiler
  // is renamed compileInteractionPreferenceBlock (it returns the preference block alone); the import is otherwise unchanged.
  const start = policy.indexOf('export function withWorldNeutralPersonality(worldPrefix: string, safetyGuided: boolean): string {');
  assert.ok(start >= 0, 'the helper exists with its exact signature');
  const body = policy.slice(start, policy.indexOf('\n}\n', start) + 2);
  // RE-ANCHORED by LANG-01 Work Package C (LA-17, D4): the world-neutral D4 line follows the world-neutral core.
  // RE-ANCHORED by S8A-02 (2026-10-21; D2): the helper renders the world-neutral core v2.
  // RE-ANCHORED by S8A-02 Round 2 (2026-10-21; the Round 2 Copy Gate): the helper renders the world-neutral core v3.
  // RE-ANCHORED by S8A-02 Round 3 (2026-10-21; Product Owner Round 3 decisions): the helper renders the world-neutral core v3.1.
  assert.ok(body.includes('  const guidance = `${worldPrefix}\\n\\n${QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL}\\n\\n${ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL}`;'), 'the World prefix stays first');
  assert.ok(body.includes('  return safetyGuided ? `${guidance}\\n\\n${SAFETY_HUMOUR_SUSPENSION_LINE}` : guidance;'), 'the line only when guided');
  assert.doesNotMatch(body, /await |this\.|preference|Preference|process\.env|fetch\(/u, 'pure: it reads nothing');
  assert.equal(count(policy, CG_4), 0, 'the suspension line is never copied: its only literal stays in the IP-IMP-01 module');
});

test('Shared and Public keep Text v1 + their frame as the literal prefix, locale und, and import nothing Personal or cross-World', () => {
  for (const [name, source, frame, otherWorld] of [
    ['Shared', shared, 'SHARED_CONVERSATION_FRAME', 'public-world'],
    ['Public', publicInput, 'PUBLIC_QANDEEL_FRAME', 'shared-world'],
  ]) {
    assert.ok(source.includes(`behavioralGuidance: withWorldNeutralPersonality(\`\${TEXT_V1_BEHAVIORAL_GUIDANCE}\\n\${${frame}}\`, Boolean(safetyGuidance)),`),
      `${name}: the one composition, Text v1 + its frame first`);
    assert.match(source, /locale: 'und',/u, `${name}: the frozen locale`);
    assert.doesNotMatch(source, /QANDEEL_PERSONALITY_CORE|SAFETY_HUMOUR_SUSPENSION_LINE|TEXT_V2_BEHAVIORAL_GUIDANCE|BehavioralResponsePolicyService|interaction-preference|InteractionPreference|resolveConversationLocale|buildTextGuidance\(/u,
      `${name}: no Personal guidance, preference or locale authority, and the composition lives only in the policy file`);
    assert.doesNotMatch(source, new RegExp(`from '\\.\\./${otherWorld}/`, 'u'), `${name}: never imports the other World`);
  }
});

test('BLOCK still returns before the assembler and the ONE provider call in both generators', () => {
  for (const [name, source, assemble] of [
    ['Shared', sharedGenerator, 'assembleSharedConversationRequest('],
    ['Public', publicGenerator, 'assemblePublicQandeelRequest('],
  ]) {
    const block = source.indexOf("if (gate.disposition === 'BLOCK')");
    const assembled = source.indexOf(`const request = ${assemble}`);
    const call = source.indexOf('this.router.generate(request)');
    assert.ok(block > 0 && block < assembled && assembled < call, `${name}: BLOCK → assembler → router, in that order`);
    assert.equal(count(source, 'this.router.generate('), 1, `${name}: exactly one provider call`);
  }
});

test('authority before code: the standalone amendment, registered; CW2-03 / 04 / 08 unchanged', async () => {
  assert.ok(amendment.startsWith('# QANDEEL — Connected Worlds v2\n## ACE-SP-01 — Shared / Public QANDEEL Personality Core — Controlled Amendment v1.0\n'));
  assert.match(amendment, /^\*\*Status:\*\* `CANONICAL CONTROLLED AMENDMENT — EFFECTIVE \/ FROZEN ON MERGE`/mu);
  assert.ok(amendment.trimEnd().endsWith('> **ACE-SP-01 — SHARED / PUBLIC PERSONALITY CORE CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE**'));
  // Markdown wraps long quotations across lines; a wrap renders as one space, so compare whitespace-normalized text.
  const flat = amendment.replace(/\s+/gu, ' ');
  for (const text of [CG_1, CG_4]) assert.ok(flat.includes(text), 'the amendment records the approved copy verbatim');
  const row = index.split('\n').find((line) => line.includes('QANDEEL_ACE-SP-01_SHARED_PUBLIC_PERSONALITY_CORE_CONTROLLED_AMENDMENT_v1.0.md'));
  assert.ok(row, 'the Canonical Authority Index has a row for the amendment');
  assert.match(row, /`LATER CONTROLLED AMENDMENT — BINDS ONLY IN ITS NAMED SCOPE`/u);
  assert.match(index, /^- the ACE-SP-01 Shared \/ Public QANDEEL Personality Core controlled amendment, in its named scope;$/mu);
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    const map = await read('QANDEEL_PROJECT_MAP.md');
    assert.ok(map.includes('QANDEEL_ACE-SP-01_SHARED_PUBLIC_PERSONALITY_CORE_CONTROLLED_AMENDMENT_v1.0.md'), 'Project Map rule 2 names it');
  }
  for (const file of [
    'architecture/QANDEEL_CW2-03_SHARED_WORLD_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md',
    'architecture/QANDEEL_CW2-04_PUBLIC_WORLD_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md',
    'architecture/QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md',
  ]) {
    const pinned = provenance.split('\n').find((line) => line.endsWith(`  ${file}`))?.slice(0, 64);
    assert.match(pinned ?? '', /^[0-9a-f]{64}$/u, `${file} has a provenance row`);
    const actual = createHash('sha256').update(await readBytes(`${CW2}/${file}`)).digest('hex');
    assert.equal(actual, pinned, `${file} is byte-identical to its frozen provenance`);
  }
});

test('BG-08 / BG-09: the record states its lifecycle and the backlog carries the dispositions', () => {
  assert.match(record, /^# QANDEEL — ACE-SP-01 — Shared \/ Public QANDEEL Personality Core — Implementation Record v1$/mu);
  // RE-ANCHORED by GOV-REC-01 (2026-10-12, validation only; tightened by its review R1): PR #333 merged as 84dd486c. The
  // ONE current banner states exactly that merged lifecycle, with its PR and merge commit, and no pre-merge state. The
  // pre-merge banner is kept beside it, labelled historical (BG-09).
  const statusBanners = record.match(/^\*\*Status:\*\* [^\n]*(?:\n(?!\n)[^\n]*)*/gmu) ?? [];
  assert.equal(statusBanners.length, 1, 'one current Status banner');
  assert.match(statusBanners[0], /^\*\*Status:\*\* `ACE-SP-01` — \*\*CLOSED \/ MERGED through PR #333 as `84dd486c905cd3512bb206e48a2d7a63aa1c2d9b` \(2026-10-12\);/u);
  assert.doesNotMatch(statusBanners[0], /IMPLEMENTATION COMPLETE|READY FOR|NOT MERGED|\bACTIVE\b|DEFERRED/u, 'the current banner carries no pre-merge state');
  assert.match(record, /^\*\*Status at the closing change \(historical, kept verbatim\):\*\* `ACE-SP-01` — \*\*IMPLEMENTATION COMPLETE \/ READY FOR INDEPENDENT REVIEW AND THE PRODUCT OWNER'S MERGE DECISION\.\*\*$/mu,
    'the pre-merge banner is kept as history');
  assert.match(record, /^## 12\. Post-merge Governance Reconciliation \(GOV-REC-01, 2026-10-12\)$/mu, 'the post-merge facts are a dated section');
  assert.doesNotMatch(record, /^\*\*Phase:\*\*/mu, 'ACE-SP-01 is a task, not a Connected Worlds phase');
  assert.match(record, /## 1\. Kickoff census \(BG-05\)[\s\S]*?`QAN-BL-ACE-01`/u);
  assert.match(backlog, /^\| `QAN-BL-ACE-01` \| [^\n]*\| `CLOSED — TOMBSTONE` \|$/mu);
  const tombstones = backlog.slice(backlog.indexOf('## 6. Tombstones'), backlog.indexOf('## 7. Counts at this baseline'));
  assert.match(tombstones, /### `QAN-BL-ACE-01` — [^\n]*\n\n- \*\*Closing task:\*\* `ACE-SP-01 — /u, 'the tombstone names its closing task');
  const ace02 = backlog.slice(backlog.indexOf('### `QAN-BL-ACE-02` — '), backlog.indexOf('### `QAN-BL-GOV-01` — '));
  assert.match(ace02, /\*\*Scope extension \(ACE-SP-01; Product Owner decision D-4, 2026-10-12\):\*\*/u, 'D-4: the Stage 8A set is extended');
  assert.match(ace02, /- \*\*Status:\*\* `VALIDATION — OPEN`/u);
  // RE-ANCHORED by GOV-REC-01 (2026-10-12, validation only; tightened by its review R1): the owner task delivered
  // QAN-BL-GOV-01 and tombstones it in PR #334. The item stays ONE item, `CLOSED — TOMBSTONE` in the §4 index and in §6.
  // The tombstone names GOV-REC-01 and holds only from the merge of PR #334. The §5 block is kept as its historical schema.
  assert.equal((backlog.match(/^\| `QAN-BL-GOV-01` \|/gmu) ?? []).length, 1, 'pre-existing drift is one item');
  assert.match(backlog, /^\| `QAN-BL-GOV-01` \| [^\n]*\| `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` \| `MEDIUM` \| `CLOSED — TOMBSTONE` \|$/mu,
    'the drift item is tombstoned by its owner task');
  const gov01Start = tombstones.indexOf('### `QAN-BL-GOV-01` — ');
  assert.ok(gov01Start >= 0, 'QAN-BL-GOV-01 has a §6 tombstone');
  const gov01End = tombstones.indexOf('\n### ', gov01Start + 1);
  const gov01 = tombstones.slice(gov01Start, gov01End < 0 ? undefined : gov01End).replace(/\s+/gu, ' ');
  assert.match(gov01, /^### `QAN-BL-GOV-01` — [^\n]*? - \*\*Closing task:\*\* `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` \(name APPROVED by the Product Owner, 2026-10-12\)\./u,
    'the tombstone names GOV-REC-01');
  assert.match(gov01, /The tombstone holds from the merge of PR #334\. Until then this item is not closed\./u, 'the closure takes effect only on the merge of PR #334');
  assert.match(gov01, / - \*\*Status:\*\* `CLOSED — TOMBSTONE`/u);
  assert.doesNotMatch(gov01, /`DEFERRED — OWNED`/u, 'the tombstone states no open status');
  const gov01Item = backlog.slice(backlog.indexOf('### `QAN-BL-GOV-01` — '), backlog.indexOf('## 6. Tombstones')).replace(/\n> /gu, '\n').replace(/\s+/gu, ' ');
  assert.match(gov01Item, /^### `QAN-BL-GOV-01` — [^*]*\*\*Historical pre-closure schema\.\*\* .*? the current state is the `CLOSED — TOMBSTONE` record in §6 below \(GOV-REC-01\)\./u,
    'the §5 block is kept, labelled as the historical pre-closure schema');
  assert.match(backlog, /\*\*ACE-SP-01 closing change \(2026-10-12;/u);
});

test('this contract is registered as a root script and runs once in API CI, before the forward-safety gate', () => {
  assert.equal(packageJson.scripts['test:ace-sp-01-shared-public-personality-core-contract'],
    'node --test tests/ace-sp-01-shared-public-personality-core-contract.test.mjs');
  const step = 'run: npm run test:ace-sp-01-shared-public-personality-core-contract}';
  assert.equal(apiCi.split(step).length - 1, 1, 'exactly one api-ci step runs this contract');
  assert.ok(apiCi.indexOf(step) < apiCi.indexOf('run: npm run test:forward-safety-contract}'), 'before the forward-safety gate');
});
