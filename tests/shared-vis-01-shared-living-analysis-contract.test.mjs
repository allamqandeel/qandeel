// SHARED-VIS-01 — Shared World Living Analysis Map Product Integration: the cross-layer static contract.
//
// It pins what a text census can honestly pin: ONE additive migration (0148) that composes the frozen I-04G QANDEEL core
// rather than a second material model; provider neutrality (both Shared ports refuse outside tests); the I-03 chain
// composed inside Connected Worlds; ONE renderer family (the Shared World consumes the common Living Analysis surface and
// the semantic-field policy, never a renderer of its own); no Personal state in the Shared field; the conversation kept
// free of semantic places; the Copy Gate; and the lifecycle / backlog truth. Live behaviour is proven by
// database/verify-migration-0148.mjs against real PostgreSQL, the API specs and the mobile Jest suites.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
/** Source with comments removed, so a sentence that EXPLAINS a ban never satisfies or violates it. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const sqlCode = (text) => text.replace(/--.*$/gmu, '');

const MIGRATION = 'database/migrations/0148_shared_semantic_field_living_analysis_v1.sql';
const RECORD = 'docs/e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md';
const FIELD = 'apps/mobile/src/shared-world/field';

test('1 — registered in the toolchain and both CI workflows; one forward migration after 0147', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:shared-semantic-field:integration'], 'node --env-file-if-exists=.env database/verify-migration-0148.mjs');
  assert.equal(manifest.scripts['test:shared-vis-01-shared-living-analysis-contract'], 'node --test tests/shared-vis-01-shared-living-analysis-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:shared-semantic-field:integration/u);
  assert.match(api, /run: npm run test:shared-vis-01-shared-living-analysis-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:shared-vis-01-shared-living-analysis-contract/u);
  assert.match(mobile, /'tests\/shared-vis-01-shared-living-analysis-contract\.test\.mjs'/u);
  const migrations = readdirSync(new URL('database/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(migrations.filter((f) => f.startsWith('0148_')).length, 1, 'exactly one 0148');
  assert.equal(migrations.indexOf('0148_shared_semantic_field_living_analysis_v1.sql'), migrations.indexOf('0147_public_discussion_qandeel_activity_integration_v1.sql') + 1);
});

test('2 — the place is the frozen I-04G vocabulary: QANDEEL_ANALYSIS through the frozen core, MATERIAL_DEPENDENCY on human text, erased with its meaning', () => {
  const sql = sqlCode(read(MIGRATION));
  assert.match(sql, /public\.commit_shared_world_qandeel_material_v1\(\s*v_command, p_world_id, v_material, v_item, 'QANDEEL_ANALYSIS'/u);
  assert.match(sql, /m\.material_kind = 'HUMAN_TEXT'/u, 'sources are the World\'s human text only');
  assert.match(sql, /FOREIGN KEY \(material_id\) REFERENCES public\.shared_world_text_material_bodies \(material_id\) ON DELETE CASCADE/u);
  // No second material, history, audience or provenance model; nothing frozen replaced.
  assert.doesNotMatch(sql, /CREATE TABLE public\.|CREATE OR REPLACE FUNCTION|ALTER TABLE public\.|DROP (TABLE|FUNCTION|CONSTRAINT)/u);
  assert.doesNotMatch(sql, /INSERT INTO public\.shared_world_(materials|history_items|material_dependencies|text_material_bodies)/u);
  assert.match(sql, /CREATE SCHEMA shared_semantic_private;/u);
  assert.doesNotMatch(sql, /CREATE FUNCTION shared_private\./u, 'the S4-01 … S4-04 shared_private surface gains nothing');
  assert.doesNotMatch(sql, /CREATE FUNCTION public\.commit_/u, 'no `commit_%` name joins the T-03D census');
  // The member reads serve a place only when the reader may see every source, through the frozen resolver.
  assert.match(sql, /public\.resolve_shared_world_material_v1\(p_world_id, p_user\)/u);
  assert.match(sql, /coordinate_scheme = 'QANDEEL_SHARED_FIELD_V1'/u);
});

test('3 — provider-neutral and fail-closed: both Shared ports refuse outside tests; the I-03 chain stays inside Connected Worlds', () => {
  // RE-ANCHORED by S8A-04 CP1 (2026-10-24; Product Owner D1 / D4, Shared Social Understanding Controlled Amendment): Stage 8A
  // binds the interpreter to DeepSeek Flash. Both PORTS still name no provider; the interpreter's one composition
  // (`shared-semantic-interpreter-provider.ts`) binds the test fake only in tests and otherwise the accounted DeepSeek
  // adapter behind the SYNTHETIC_ONLY gate. The placer is NOT bound (D4): it still refuses outside tests, so the pass still
  // returns NO_PROVIDER before any lease, read or spend, and no place is produced until CP2.
  for (const port of ['apps/api/src/shared-world/shared-semantic-interpreter.ts', 'apps/api/src/shared-world/shared-spatial-placer.ts']) {
    assert.doesNotMatch(code(port), /ModelRouter|model-router|fetch\(|https?:\/\//u, `${port} reaches no provider`);
  }
  const placer = code('apps/api/src/shared-world/shared-spatial-placer.ts');
  assert.match(placer, /environment\.NODE_ENV === 'test'/u, 'the placer binds its fake only in tests');
  assert.match(placer, /return new Unconfigured\w+\(\);\s*\}\s*$/u, 'the placer refuses everywhere else');
  const composition = code('apps/api/src/shared-world/shared-semantic-interpreter-provider.ts');
  assert.match(composition, /if \(environment\.NODE_ENV === 'test'\) return new FakeSharedSemanticInterpreter\(\);/u);
  assert.match(composition, /accountedDeepSeekChatCompletionsClient\(\s*createDeepSeekClient\(config\), 'SHARED_SEMANTIC_READING', productionAiProviderCallAccounting\(\)\)/u);
  assert.match(code('apps/api/src/shared-world/shared-semantic-interpreter-provider.config.ts'), /requireDeepSeekQualification\(environment, /u);
  assert.match(code('apps/api/src/shared-world/shared-world.module.ts'), /\{ provide: SHARED_SEMANTIC_INTERPRETER, useFactory: \(\) => createConfiguredSharedSemanticInterpreter\(\) \}/u);
  const pass = code('apps/api/src/connected-worlds/material-commit/shared-semantic-place.service.ts');
  assert.match(pass, /materialKind: 'QANDEEL_ANALYSIS'/u);
  assert.match(pass, /reason: 'NO_PROVIDER'/u, 'nothing is leased, read or spent while no provider is bound');
  assert.match(pass, /this\.placer instanceof UnconfiguredSharedSpatialPlacer/u, 'an unbound placer still stops the pass before any lease');
  assert.ok(!existsSync(new URL('apps/api/src/shared-world/shared-semantic-place.service.ts', root)), 'the pass composes I-03 inside Connected Worlds only');
});

test('4 — the conversation stays the conversation: a semantic place is never a message', () => {
  const service = code('apps/api/src/shared-world/shared-world-conversation.service.ts');
  assert.match(service, /row\.material_kind !== 'QANDEEL_ANALYSIS'/u);
  assert.match(service, /\.filter\(isConversation\)\.map\(viewOf\)/u);
  assert.match(service, /rows\.filter\(isConversation\)/u, 'the reply never reads a place as conversation');
  assert.match(code('apps/api/src/shared-world/shared-world-lifecycle.repository.ts'), /'list_own_closed_shared_world_material_v2'/u);
});

test('5 — ONE renderer family: the Shared World consumes the common surface and the semantic-field policy, nothing of its own', () => {
  const surface = code(`${FIELD}/SharedLivingAnalysis.tsx`);
  assert.match(surface, /<LivingAnalysisSurface\b/u);
  assert.match(surface, /timeline=\{null\}/u, 'no Shared Timeline (D5)');
  const view = code(`${FIELD}/SharedFieldView.tsx`);
  assert.match(view, /import \{ WorldCanvas, WorldViewSurface, useWorldView \} from '\.\.\/\.\.\/map\/renderer';/u);
  assert.match(view, /PublicExperienceMark/u, 'the semantic field\'s neutral mark, reused');
  assert.match(code(`${FIELD}/shared-field-camera.ts`), /from '\.\.\/\.\.\/public-world\/field\/public-field-camera'/u, 'the semantic-field camera, reused');
  assert.match(code(`${FIELD}/shared-field-projection.ts`), /placePublicField\(/u, 'the semantic-field disclosure policy, reused');
  for (const name of readdirSync(new URL(`${FIELD}/`, root)).filter((f) => /\.(ts|tsx)$/u.test(f))) {
    const source = code(`${FIELD}/${name}`);
    assert.doesNotMatch(source, /@shopify\/react-native-skia['"]|<Canvas\b/u, `${name} paints nothing of its own`);
    assert.doesNotMatch(source, /from '[^']*\/(store|projection|temporal|timeline|integration)['/]/u, `${name} reads nothing of the Personal world`);
    assert.doesNotMatch(source, /\bmembers\b|QANDEEL_FIGURE|memberMark/u, `${name} draws no member or QANDEEL object (D6)`);
  }
});

test('5b — the Product Owner\'s visual correction lands ONCE, in the common stack: a content-sized band and two-line MID meanings', () => {
  const plan = code('apps/mobile/src/responsive/plan.ts');
  assert.match(plan, /readonly chromeContentPoints\?: number \| null;/u);
  assert.match(plan, /const bandPoints = content === null \? cap : Math\.min\(cap, Math\.max\(content, surface\.insetBottom\)\);/u, 'capped at the room every world has');
  const surface = code('apps/mobile/src/living-analysis/LivingAnalysisSurface.tsx');
  assert.match(surface, /chromeContentPoints=\{chromeOnly \? chromeContent : null\}/u, 'only a world with no temporal track is measured');
  // The label layout is Public's, consumed by Shared: one rule, both worlds, never a Shared copy of it.
  assert.match(code('apps/mobile/src/public-world/field/PublicFieldView.tsx'), /const LABEL_MAX_LINES = 2 as const;/u);
  for (const view of ['apps/mobile/src/public-world/field/PublicFieldView.tsx', `${FIELD}/SharedFieldView.tsx`]) {
    assert.match(code(view), /numberOfLines=\{label\.lines\}/u, `${view} draws the lines the layout reserved`);
    assert.match(code(view), /\.\.\.\(label\.lines === 2 \? \{ width: label\.width \} : \{ maxWidth: label\.width \}\)/u, `${view} gives two lines a definite width`);
  }
  assert.doesNotMatch(code(`${FIELD}/SharedFieldView.tsx`), /function layoutFieldLabels|LABEL_MAX_WIDTH/u);
  // D2 — the band follows the chrome at once; what made a resize mid-travel unsafe was fixed where it lived (the
  // Product Owner's controlled amendment to the frozen WorldCanvas: the plane is reset on UNMOUNT only, never because
  // the binding's identity changed with the frame), proven by map/__tests__/world-resize-race.test.tsx. No gate, no
  // deferral and no second motion path anywhere.
  const canvas = code('apps/mobile/src/map/renderer/WorldCanvas.tsx');
  assert.match(canvas, /useLayoutEffect\(\(\) => \(\) => latestMotion\.current\.reset\(\), \[\]\);/u, 'the plane is reset when the world leaves, only');
  assert.doesNotMatch(canvas, /\(\) => motion\.reset\(\), \[motion\]/u, 'a resized frame no longer resets the plane');
  assert.ok(existsSync(new URL('apps/mobile/src/map/__tests__/world-resize-race.test.tsx', root)), 'the race is proven against both runtimes');
  for (const file of [
    'apps/mobile/src/living-analysis/LivingAnalysisSurface.tsx', `${FIELD}/SharedLivingAnalysis.tsx`, `${FIELD}/SharedFieldView.tsx`,
    'apps/mobile/src/public-world/field/PublicLivingAnalysis.tsx', 'apps/mobile/src/public-world/field/PublicFieldView.tsx',
  ]) assert.doesNotMatch(code(file), /chromeGate|ChromeResizeGate|reportWorldMotion/u, `${file} defers nothing`);
  assert.ok(!existsSync(new URL('apps/mobile/src/living-analysis/chrome-resize-gate.ts', root)), 'the interim gate is gone');
});

test('6 — the Copy Gate: reused words exactly; CLOSED — 6 / 6 APPROVED by the Product Owner', () => {
  const copy = read(`${FIELD}/field-copy.ts`);
  assert.match(copy, /status: 'SHARED-VIS-01 PRODUCT COPY GATE — CLOSED — 6 \/ 6 APPROVED[^']*'/u);
  const proposed = [...copy.matchAll(/\/\/ PROPOSED — SHARED-VIS-01 Product Copy Gate/gu)].length;
  const approved = [...copy.matchAll(/\/\/ APPROVED — SHARED-VIS-01 Product Copy Gate/gu)].length;
  assert.equal(proposed, 0, 'nothing is left PROPOSED');
  assert.equal(approved, 12, 'six rows, in Arabic and English, approved');
});

// RE-ANCHORED by GOV-REC-01 (2026-10-12, validation only; tightened by its review R1): PR #321 merged as 5973123 and
// GOV-REC-01 records the missing closure retroactively. Every current-state pin below accepts only that merged truth, with
// its PR and merge commit; the pre-merge banner and the Project Map's old current-task paragraph are kept, labelled
// historical. QAN-BL-CW-03 is `CLOSED — TOMBSTONE` from the merge of PR #334, and the physical-Android release gate
// (Issue #322) stays OPEN — the merge is not device proof.
test('7 — lifecycle and backlog truth: Stage 5 DONE / MERGED; SHARED-VIS-01 merged through PR #321 and tombstoned; Issue #322 open; Stage 6 not started', () => {
  const MERGE = '5973123153e26494d702a4a859a79631ede225cd';
  const record = read(RECORD);
  const statusBanners = record.match(/^\*\*Status:\*\* [^\n]*(?:\n(?!\n)[^\n]*)*/gmu) ?? [];
  assert.equal(statusBanners.length, 1, 'one current Status banner');
  assert.equal(statusBanners[0], `**Status:** \`CLOSED / MERGED — PR #321 merged as ${MERGE} (2026-10-09) — CLOSURE RECORDED RETROACTIVELY BY GOV-REC-01 (2026-10-12) — NOT DEPLOYED — ISSUE #322 OPEN / NOT PROVEN / RELEASE BLOCKER\``,
    'the current banner is the merged lifecycle, and Issue #322 stays open');
  assert.match(record, /^\*\*Status before the merge \(historical, kept verbatim\):\*\* `ACTIVE — IMPLEMENTED ON feat\/shared-vis-01-shared-living-analysis — NOT MERGED; NOT CLOSED`\.$/mu,
    'the pre-merge banner is kept as history');
  assert.match(record, /^## 15\. Post-merge Governance Reconciliation \(GOV-REC-01, 2026-10-12\)$/mu, 'the post-merge facts are a dated section');
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.equal((backlog.match(/^\| `QAN-BL-CW-03` \|/gmu) ?? []).length, 1, 'QAN-BL-CW-03 is one item');
  assert.match(backlog, /^\| `QAN-BL-CW-03` \| Shared World Living Analysis Map \/ Semantic Geography Product Integration \| `SHARED-VIS-01 — Shared World Living Analysis Map Product Integration` \| `HIGH` \| `CLOSED — TOMBSTONE` \|$/mu);
  const tombstones = backlog.slice(backlog.indexOf('## 6. Tombstones'), backlog.indexOf('## 7. Counts at this baseline'));
  const start = tombstones.indexOf('### `QAN-BL-CW-03` — ');
  assert.ok(start >= 0, 'QAN-BL-CW-03 has a §6 tombstone');
  const end = tombstones.indexOf('\n### ', start + 1);
  const cw03 = tombstones.slice(start, end < 0 ? undefined : end).replace(/\s+/gu, ' ').trimEnd();
  assert.match(cw03, /^### `QAN-BL-CW-03` — [^\n]*? - \*\*Closing task:\*\* `SHARED-VIS-01 — Shared World Living Analysis Map Product Integration`\. Its BG-08 half is recorded retroactively by `GOV-REC-01 — /u,
    'the tombstone names SHARED-VIS-01, recorded by GOV-REC-01');
  assert.match(cw03, new RegExp(`- \\*\\*PR / SHA:\\*\\* PR #321, merged as \`${MERGE}\` \\(2026-10-09\\)\\.`, 'u'), 'the tombstone carries the PR #321 merge commit');
  assert.match(cw03, /This retroactive disposition holds from the merge of the GOV-REC-01 pull request, PR #334\./u, 'the closure takes effect only on the merge of PR #334');
  assert.match(cw03, /Issue #322[^.]*stays \*\*OPEN \/ NOT PROVEN \/ RELEASE BLOCKER\*\*/u, 'Issue #322 stays open');
  assert.match(cw03, /- \*\*Status:\*\* `CLOSED — TOMBSTONE`$/u);
  const cw03Item = backlog.slice(backlog.indexOf('### `QAN-BL-CW-03` — '), backlog.indexOf('### ', backlog.indexOf('### `QAN-BL-CW-03` — ') + 1))
    .replace(/\n> /gu, '\n').replace(/\s+/gu, ' ');
  assert.match(cw03Item, /^### `QAN-BL-CW-03` — [^*]*\*\*Historical pre-closure schema\.\*\* .*? the current state is the `CLOSED — TOMBSTONE` record in §6 below \(SHARED-VIS-01, closed retroactively by GOV-REC-01\)\./u,
    'the §5 block is kept, labelled as the historical pre-closure schema');
  for (const id of ['QAN-BL-CW-05', 'QAN-BL-CW-06', 'QAN-BL-CW-07']) assert.match(backlog, new RegExp(`\\| \`${id}\` \\|`, 'u'), `${id} is admitted`);
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /Stage 5 \(Public World Product Integration\) is \*\*DONE \/ MERGED\*\*/u);
    assert.match(state, new RegExp(`^\\| SHARED-VIS-01 — Shared World Living Analysis Map Product Integration \\(migration \`0148\`\\) \\| \\*\\*\`CLOSED / MERGED\` through PR #321 as \`${MERGE}\` \\(2026-10-09\\); NOT DEPLOYED\\.\\*\\* [^\\n]*\\*\\*GitHub Issue #322 — [^\\n]*stays \`OPEN / NOT PROVEN / RELEASE BLOCKER\`\\*\\*`, 'mu'),
      'Current State §3.7 records SHARED-VIS-01 merged, and Issue #322 open');
    assert.match(state, /\*\*SHARED-VIS-01 is DONE \/ MERGED\*\* through PR #321 as `5973123153e26494d702a4a859a79631ede225cd`/u, 'Current State §7: Stage 4 records the merge');
    assert.match(state, /^\| `Stage 9 — Economy \+ Launch Closure` \(release-readiness gate\)[^\n]*\[Issue #322\][^\n]*`OPEN \/ NOT PROVEN \/ RELEASE BLOCKER`/mu, 'the release gate keeps Issue #322 open');
    // RE-ANCHORED by S6-01 (2026-10-13, validation only): the Product Owner's S6-01 Final Implementation Authorization
    // started Stage 6. Every line that calls Stage 6 ACTIVE must name S6-01 as the task that started it.
    for (const line of state.split('\n').filter((l) => /Stage 6[^\n]*\*\*ACTIVE/u.test(l))) {
      assert.match(line, /S6-01/u, 'Stage 6 is ACTIVE only through S6-01');
    }
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    const map = read('QANDEEL_PROJECT_MAP.md');
    assert.match(map, /^\| \*\*4 — Shared World Product Integration\*\* \|[^\n]*\*\*SHARED-VIS-01 is DONE \/ MERGED\*\* through PR #321 as `5973123153e26494d702a4a859a79631ede225cd`/mu, 'the map records the merge');
    assert.doesNotMatch(map, /> \*\*CURRENT IMPLEMENTATION TASK: SHARED-VIS-01/u, 'SHARED-VIS-01 is no longer the current task');
    assert.match(map, /^\*\(Historical, SHARED-VIS-01:\)\* \*\*SHARED-VIS-01 — Shared World Living Analysis Map Product Integration\*\*/mu, 'its old current-task paragraph is kept, labelled historical');
  }
});
