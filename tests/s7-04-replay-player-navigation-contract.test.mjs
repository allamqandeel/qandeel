// S7-04 - static contract for the Production Replay Player & Navigation (apps/mobile/src/replay-player, the lifecycle
// client apps/mobile/src/runtime-entry/replay-lifecycle-api.ts, the composition seam in DepthComposition and the
// real-path proof chain behind tests/fixtures/s7-04-replay-player). The Jest suites prove behaviour; this contract pins
// the shape those proofs rely on:
//
//   - the player plays through the EXISTING S7-03 composite (ReplayMomentComposite) inside the ONE Living Analysis
//     surface, with no map, canvas, Skia, animation, audio or video of its own, and no second analysis or graphics;
//   - the Product Owner's visual direction (2026-10-20, option (b)): the surface stays CHROME_ONLY — nothing in its
//     temporal slot, no Live Timeline — and the moment controls stand in the composite's measured moment band, held in
//     place while only the moment's reading scrolls under them (Product Owner review, 2026-10-20);
//   - the Product Owner's decision (2026-10-20, «Replay Temporal Spine»): the moments are navigated on P2's Temporal
//     Spine + Aperture C "Parting" (ReplaySpine.tsx), drawn by VPORT-02's own SpineLayer / Aperture / spinePresentation
//     and moved by T-06's own useTemporalMotion — no Live terminal or edge, no T-06 target layer or scrub, no store, no
//     motion of its own and no P2 discontinuity (an omission is said in the composite's own words); ReplaySpine is
//     the ONE player file hosting Animated views, carrying only T-06's styles; play /
//     pause are P2's own (sig.mjs), through the generated glyphs, never the Call Rail;
//   - only the existing preview, finalize and reopen commands, by POST, beside the S7-02 and S7-03 reads; the Replay
//     API module and migration 0169 are byte-identical to the branch base, and no migration follows 0169 — except the
//     ONE G-1 correction the Product Owner decided (2026-10-20): the list's summary decoder reads 0169's EXISTS answer
//     `false` beside a null version as "no version yet", and still refuses a contradiction;
//   - no fourth world and no route: the player is an overlay passage of the Personal world, the depth beneath stays
//     mounted and out of reach, and no router is imported; Activity, Direct Entry and public links close it first;
//   - no Replay state in the live store and nothing live in the player: no state store, no integration runtime, no
//     conversation transport, no projection cache, and no viewpoint store opened by the player itself;
//   - one controller per auth generation, built on that generation's transports and retired with it;
//   - F-2: the player shows, logs and sends no Reading scope (no `scope`, no console, no telemetry);
//   - the declared reading pace is a constant, and the copy claims no sound, video or original timing;
//   - the S7-04 Product Copy Gate is CLOSED (Product Owner, 2026-10-20): all 13 rows APPROVED, Arabic and English, each
//     word for word as decided, and the S7-02 / S7-03 approved rows are reused, not rewritten (their files are
//     byte-identical);
//   - the proof build is validation-only, and the record stops at the final merge review gate.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const readIfPresent = (path) => (existsSync(join(root, path)) ? read(path) : null);
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '').replace(/\{\/\*[\s\S]*?\*\/\}/gu, '');
const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? files(path) : [path];
});
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const PLAYER = 'apps/mobile/src/replay-player';
const CLIENT = 'apps/mobile/src/runtime-entry/replay-lifecycle-api.ts';
const DEPTH = 'apps/mobile/src/integration/composition/DepthComposition.tsx';
const RUNTIME = 'apps/mobile/src/integration/runtime/integration-runtime.ts';
const RECORD = 'docs/e2e/QANDEEL_S7_04_IMPLEMENTATION_RECORD_v1.md';
const COPY_GATE_CLOSED = 'S7-04 PRODUCT COPY GATE — CLOSED — 2026-10-20, Product Owner decision: all 13 rows APPROVED in Arabic and English word for word (the English of moments, finalized and commandUnconfirmed as reworded by the Product Owner); no S7-02 or S7-03 row is approved by it';
/** The Product Owner's decision of 2026-10-20, word for word: [key, Arabic, English]. */
const APPROVED_COPY = [
  ['play', 'تشغيل', 'Play'],
  ['pause', 'إيقاف مؤقت', 'Pause'],
  ['restart', 'التشغيل من البداية', 'Play from the start'],
  ['moments', 'لحظات إعادة العرض', 'Replay moments'],
  ['pacing', 'تُعرض الرسائل نصًّا بإيقاع مناسب للقراءة، لا بتوقيتها الأصلي.', 'Messages are shown as text at a reading pace, not at their original timing.'],
  ['preview', 'معاينة', 'Preview'],
  ['finalize', 'حفظ نسخة خاصة', 'Save a private copy'],
  ['finalized', 'نسخة خاصة محفوظة', 'Private copy saved'],
  ['finalizedNotice', 'حُفظت نسخة خاصة من إعادة العرض، ولا تُشارك مع أحد.', "A private copy of the Replay was saved. It isn't shared with anyone."],
  ['reopen', 'تعديل إعادة العرض', 'Edit the Replay'],
  ['reopenedNotice', 'أصبحت إعادة العرض مسودة يمكن تعديلها.', 'The Replay is a draft again and can be edited.'],
  ['analysisChanged', 'تغيّر التحليل منذ المعاينة، فلا يمكن حفظ هذه النسخة.', "The analysis changed since the preview, so this version can't be saved."],
  ['commandUnconfirmed', 'تعذّر التأكد من إتمام ذلك.', "We couldn't confirm whether the action was completed."],
];
const COPY_ROWS = APPROVED_COPY.map(([key]) => key);
/** G-1 (Product Owner decision, 2026-10-20): the one change in the Replay service. */
const G1_DECODE = [
  '  const finalized = versionId === null && row.current_version_finalized === false ? null : row.current_version_finalized;',
  "  if (versionId === null ? row.current_version_finalized !== false : !isUuid(versionId) || typeof finalized !== 'boolean') return unavailable();",
];

/** The Replay engine, the earlier gates' words and the graphics' authority, byte-identical to the branch base 0d8a7335. */
const FROZEN = [
  ['apps/api/src/replay/replay.controller.ts', 'f7fb49fdfbcc2d936b3c4a9dea89bfe24a0466acd861600959312d53452c4a0a'],
  ['apps/api/src/replay/replay.module.ts', '76d7012b0a76cfea0bad39d264e1d011a3b4c0089231538b31f50381a6e0e985'],
  ['apps/api/src/replay/replay.repository.ts', '5921784cd2e14323304ea5b5d37b5f5c201b1f6915950d467f527dcb3f6df874'],
  // S7-04 RE-ANCHOR (2026-10-20, Product Owner decision G-1): the conversation list's summary decoder reads 0169's
  // EXISTS answer `false` beside a null version as "no version yet" and leaves it as the wire's null; a contradiction
  // stays refused. Nothing else in the service changed; 0169 and the wire are unchanged.
  // S7-05 RE-ANCHOR (2026-10-20, Product Owner decision D1, F-2 Option B: a Reading's scope leaves as its class `CONVERSATION_SESSION` alone, its exact canonical form verified first, anything else refused whole).
  ['apps/api/src/replay/replay.service.ts', '2a3bdb2328f943d4de022ce60f1285dd26cce66717df0dd88b0c5fe0724afc83'],
  // S7-05 RE-ANCHOR (2026-10-20, Product Owner decision D1, F-2 Option B: the Replay Reading's scope is typed as its class alone).
  ['apps/api/src/replay/replay.types.ts', '165fc747f2274ca198f311227e94547feb663dcda8da9384dee18d088599b76c'],
  ['database/migrations/0169_replay_personal_secure_integration_erasure_v1.sql', '319435d8514b8d4621667d75dbd62efb645ed4beb38e769fcc479066eb52fa2d'],
  // S7-05 RE-ANCHOR (2026-10-20, Product Owner decision D2: the English of every S7-02 row and of the count APPROVED word for word; no Arabic changed).
  ['apps/mobile/src/replay-entry/copy.ts', 'e3afc223476941ce0e7d060947a3138da2a2eefee1d0ebfb31b7773f88d6aeaa'],
  // S7-05 RE-ANCHOR (2026-10-20, Product Owner decision D2: the English of all 14 S7-03 rows APPROVED word for word; no Arabic changed).
  ['apps/mobile/src/replay-composite/copy.ts', '927c24f51f7e1e2189e315235089b10ce7b670b6b87974df1638813d691f1d7b'],
  ['apps/mobile/src/replay-composite/viewpoint-store.ts', '56166095f5578bf4789b2552f6c3e21d54bd064573f99aeb423fedbfe1fb23bb'],
  ['apps/mobile/src/replay-composite/projection-adapter.ts', '3a3ea0257acd4b139acbf4a5f34416e4c11da35288985d6c07c790db848daf9f'],
  // S7-05 RE-ANCHOR (2026-10-20, Product Owner decision D1, F-2 Option B: a Reading's scope is decoded as exactly its class).
  ['apps/mobile/src/runtime-entry/replay-history-api.ts', 'afc05df83bb2de9266cb12775e89ac5963a908072185e35be010321f431cba91'],
  ['apps/mobile/src/projection/historical-projection-wire.ts', '7bc8f628268b503d6c5f8a80b204138cc3dfe7db9d1b07ec81eae14d0069f451'],
  ['apps/mobile/src/living-analysis/LivingAnalysisSurface.tsx', '08687f8e87ff34a9c37ea69260041fc55cc3138ea42c272697763586a72407ab'],
  ['apps/mobile/src/map/renderer/MapSurface.tsx', '5f5d75518909c7df18694ad0d8847d5a3dabe35d7ee7db64b87f92fdeb85cf82'],
  ['apps/mobile/src/state/store.ts', '3177b9b6a322dc506a5095018b4dd9b14dddacc21bcfd77297decd5dbe62fff3'],
  ['apps/mobile/src/integration/composition/LivingAnalysisMap.tsx', '667fb2c56c78781367a43cc42c1e349319f573ad66dde4f1edc56d97bc54ea64'],
];

const shipped = () => {
  const player = files(PLAYER).filter((path) => /\.(ts|tsx)$/u.test(path) && !/\/__(tests|fixtures)__\//u.test(path));
  return {
    player: Object.fromEntries(player.map((path) => [path.slice(PLAYER.length + 1), read(path)])),
    client: read(CLIENT),
    fixture: read(`${PLAYER}/__fixtures__/player-wire.ts`),
    depth: read(DEPTH),
    runtime: read(RUNTIME),
    entry: read('apps/mobile/src/runtime-entry/mobile-runtime-entry.ts'),
    returnBar: read('apps/mobile/src/conversation/AnalysisReturnBar.tsx'),
    mobile: files('apps/mobile/src').filter((path) => /\.(ts|tsx)$/u.test(path) && !/\/__(tests|fixtures|validation)__\//u.test(path)).map((path) => [path, read(path)]),
    frozen: FROZEN.map(([path]) => [path, read(path)]),
    migrations: readdirSync(join(root, 'database/migrations')).filter((name) => /^\d{4}_/u.test(name)),
    composite: read('apps/mobile/src/replay-composite/ReplayMomentComposite.tsx'),
    glyphs: read('apps/mobile/src/conversation/visual/canonical-visual.generated.ts'),
    sig: read('docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/source/src/sig.mjs'),
    proofRoot: read('apps/mobile/src/integration/__validation__/S704ProofRoot.tsx'),
    proofWorld: read('apps/mobile/src/integration/__validation__/s704-proof-world.ts'),
    selector: read('apps/mobile/scripts/select-s704-proof-entry.mjs'),
    mobilePkg: read('apps/mobile/package.json'),
    pkg: read('package.json'),
    workflow: read('.github/workflows/api-ci.yml'),
    record: readIfPresent(RECORD),
    state: readIfPresent('QANDEEL_CURRENT_STATE.md'),
    map: readIfPresent('QANDEEL_PROJECT_MAP.md'),
  };
};

const DETECTORS = {
  graphicsViolations(w) {
    const out = [];
    const view = tsCode(w.player['ReplayPlayer.tsx'] ?? '');
    if (!/import \{ LivingAnalysisSurface, type LivingAnalysisTopBand \} from '\.\.\/living-analysis';/u.test(view)) out.push('the player is the ONE LivingAnalysisSurface');
    if (!/import \{ ReplayMomentComposite, ReplayPreviewLimit, replayCompositeCopy, type ReplayCompositeController, type ReplayMomentControls \} from '\.\.\/replay-composite';/u.test(view)) out.push('a moment is the S7-03 composite');
    // Option (b): nothing in the surface's temporal slot, from the player or the composite; the controls are the band's.
    const composite = tsCode(w.composite);
    if (/LivingAnalysisTimeline/u.test(view) || /timeline=\{(?!null\})/u.test(view)) out.push('the player puts nothing in the temporal slot');
    if (/LivingAnalysisTimeline/u.test(composite) || /timeline=\{(?!null\})/u.test(composite)) out.push('the composite is CHROME_ONLY in every state');
    if (!/<ReplayMomentComposite [^>]*controls=\{controls\}/u.test(view)) out.push("the moment controls are handed to the composite's band");
    if (!composite.includes('{controls.instrument}') || !composite.includes('{controls.note}')) out.push('the composite stands the controls in the moment band');
    // P2's own play / pause, through the generated glyphs; never the Call Rail.
    if (!view.includes("<Glyph name={view.playing ? 'pause' : 'play'}")) out.push('play / pause are drawn by the canonical glyphs');
    if (/from '\.\.\/iconography'|CallRail|P2_CALL/u.test(view)) out.push("the Call Rail is the call's, not the transport's");
    // The Replay Temporal Spine: VPORT-02's drawings, T-06's motion, the version's moments, and nothing live.
    if (!/<ReplaySpine\b(?:(?!\/>)[\s\S])*onCommit=\{\(ordinal\) => controller\.seek\(ordinal\)\}/u.test(view)) out.push('a Spine commit is ONE ordinal, handed to the player');
    const spine = tsCode(w.player['ReplaySpine.tsx'] ?? '');
    if (!/import \{ Aperture, P2_SPINE, SpineLayer, spinePresentation \} from '\.\.\/iconography';/u.test(spine)) out.push("the Spine is VPORT-02's own drawing");
    if (!/import \{ presentationX, useTemporalMotion \} from '\.\.\/temporal-navigation';/u.test(spine)) out.push("the Spine moves by T-06's own motion");
    if (!/<SpineLayer spine=\{spine\}[^>]*layer="SPINE"/u.test(spine)) out.push("the hairline and notches are VPORT-02's SpineLayer");
    if (!spine.includes('motion.committedStyle') || !spine.includes('motion.cursorStyle')) out.push("the Spine's markers carry T-06's styles");
    if (!spine.includes('<Aperture kind="COMMITTED"') || !spine.includes('<Aperture kind="PREVIEW"')) out.push('the committed and preview partings are distinct');
    if (/LiveTerminal|LiveEdgeTarget|TemporalTargetLayer|useTemporalScrub|commitLiveEdge|returnLive|from '\.\.\/state'|from '\.\.\/timeline\/|CallRail/u.test(spine)) out.push('the Spine has no Live, no T-06 scrub or layer, no store');
    if (/withTiming|withSpring|withDecay|withRepeat|withSequence|LayoutAnimation|\bCanvas\b|@shopify\/react-native-skia/u.test(spine)) out.push('the Spine adds no motion or drawing of its own');
    // Product Owner review (2026-10-20): P2's discontinuity keeps its one meaning; an omission is said in words, by the
    // composite's own historical disclosure, and never drawn on the Spine.
    if (/discontinuity|omittedBefore/u.test(spine)) out.push('the Spine draws no omission and reuses no P2 discontinuity');
    if (!/testID="qandeel-replay-gap"/u.test(composite) || !composite.includes('words.gap(entry.count(moment.omittedBefore))')) out.push("an omission is said in the composite's own approved words");
    // The controls held in place: only the moment's reading scrolls under them, bounded by T-11's own cap, and only
    // when the player hands controls (an S7-03 consumer is composed exactly as before).
    if (!/<ScrollView ref=\{reader\} testID="qandeel-replay-moment-reading"/u.test(composite)) out.push('the reading scrolls on its own under the controls');
    if (!composite.includes('reader.current?.scrollTo({ y: 0, animated: false });')) out.push('a different moment is read from its start, with no motion');
    if (!/onLayout=\{controls === null \? undefined : onRect\}/u.test(composite) || !/controls === null \|\| rect === null \? null/u.test(composite)) out.push('nothing is measured without controls');
    if (!/import \{ presentationSurface, recompositionPlan \} from '\.\.\/responsive';/u.test(composite) || !/recompositionPlan\(surface, \{ support: 'CHROME_ONLY' \}\)\.support\.chromePoints/u.test(composite)) out.push("the reading is bounded by T-11's own band cap");
    for (const glyph of ['play', 'pause']) {
      const drawn = new RegExp(`^  ${glyph}: \\(\\) => '(.*)',$`, 'mu').exec(w.sig)?.[1] ?? '';
      const first = /d="([^"]+)"|x="([0-9.]+)" y="([0-9.]+)"/u.exec(drawn);
      const expected = first === null ? null : first[1] !== undefined ? `"d": "${first[1]}"` : `"x": ${first[2]},\n          "y": ${first[3]},`;
      if (expected === null || !w.glyphs.includes(expected)) out.push(`the ${glyph} glyph is P2's own`);
    }
    if (!/<ReplayMomentComposite /u.test(view)) out.push('the S7-03 composite is what is played');
    for (const [name, text] of Object.entries(w.player)) {
      const code = tsCode(text);
      // Only the Spine hosts Animated views, and only to carry T-06's own styles (checked above).
      if (/@shopify\/react-native-skia|LayoutAnimation|\bCanvas\b/u.test(code) || (name !== 'ReplaySpine.tsx' && /react-native-reanimated|\bAnimated\b/u.test(code))) out.push(`${name}: no drawing or motion of its own`);
      if (/expo-av|expo-audio|expo-video|react-native-video|react-native-sound|\bAudio\b|\bVideo\b|\bSound\b/u.test(code)) out.push(`${name}: no audio or video`);
      if (/from '\.\.\/map'|LivingAnalysisMap|MapSurface|WorldCanvas|world-chroma|world-visual|projection-adapter|mapHistorical/u.test(code)) out.push(`${name}: no graphics or analysis of its own`);
      if (/\bShare\b|Sharing|expo-sharing|expo-file-system|expo-media-library|exportReplay|exportFile|\/(?:share|export|publish|download|library)\b/u.test(code)) out.push(`${name}: no share, export, publish or library`);
    }
    return out;
  },

  apiViolations(w) {
    const out = [];
    const code = tsCode(w.client);
    if (!code.includes("act: 'preview' | 'finalize' | 'reopen', payload")) out.push('the lifecycle client sends the three existing commands and no other');
    if (/method: '(?!POST')/u.test(code)) out.push('the lifecycle client sends by POST only');
    if (/\/(drafts|revisions|capability|conversations|versions|moments|analysis|share|export|publish)\b/u.test(code)) out.push('the lifecycle client reads nothing and adds no route');
    for (const [act, body] of [['preview', '{ commandId, expectedDraftRevision }'], ['finalize', '{ commandId, expectedVersionId }'], ['reopen', '{ commandId, expectedVersionId }']]) {
      if (!code.includes(`this.command(replayId, '${act}', ${body},`)) out.push(`${act} sends exactly its captured body`);
    }
    if (/userId|ownerId|sessionId|accessToken|Authorization/u.test(code)) out.push('the lifecycle client sends no identity of its own');
    if (!/replayLifecycleFor\(bundle[^)]*\)[^\n]*\n?[^\n]*authorizedFetchFor\(bundle\.authGeneration\)/u.test(w.entry)) out.push('the lifecycle client is built on the generation-bound credential seam');
    for (const [path, text] of w.frozen) {
      const expected = FROZEN.find(([candidate]) => candidate === path)?.[1];
      if (sha(text) !== expected) out.push(`${path}: changed`);
    }
    const service = w.frozen.find(([path]) => path === 'apps/api/src/replay/replay.service.ts')?.[1] ?? '';
    for (const line of G1_DECODE) if (!service.includes(line)) out.push('G-1: a fresh draft is listed with no version, and a contradiction is still refused');
    // Re-anchored by S8A-01 (0170): S7-04 adds no migration, and nothing after 0169 is a Replay migration.
    const later = w.migrations.filter((name) => name.slice(0, 4) > '0169');
    if (!w.migrations.some((name) => name.startsWith('0169_'))) out.push('0169 is missing');
    for (const name of later) if (/replay/iu.test(name)) out.push(`a Replay migration follows 0169 (${name})`);
    return out;
  },

  navigationViolations(w) {
    const out = [];
    const depth = tsCode(w.depth);
    if (!depth.includes('const reachable = current && !settingsShown && !understandingShown;')) out.push('the depth beneath is kept, not rebuilt');
    if (!depth.includes('const personalOpen = personalReachable && !introductionsShown && !playerOpen;')) out.push('the depth beneath the passage is out of reach');
    if (!/\{onSignOut !== undefined && area === 'MY_WORLD' \? <ReplayPlayer controller=\{replayPlayer\} language=\{locale\.language\} insets=\{edges\} \/> : null\}/u.test(depth)) out.push('the player is a passage of the Personal world only');
    if (!/depth === 'ANALYSIS' \|\| playerOpen \? 'ANALYSIS'/u.test(depth)) out.push('the attention surface counts the passage as the Analysis');
    if (!/const openActivity = useCallback\(\(\) => \{\n\s+replayPlayer\.close\(\);/u.test(depth)) out.push('Activity closes the passage first');
    if ((depth.match(/replayPlayer\.close\(\);/gu) ?? []).length < 3) out.push('Direct Entry, Activity and public links each close the passage');
    for (const [name, text] of Object.entries(w.player)) {
      const code = tsCode(text);
      if (/expo-router|@react-navigation|useRouter|router\.push|Linking/u.test(code)) out.push(`${name}: no route and no link of its own`);
    }
    if (!/BackHandler\.addEventListener\('hardwareBackPress'/u.test(tsCode(w.player['ReplayPlayer.tsx'] ?? ''))) out.push('Android Back closes the passage');
    if (/replay/iu.test(tsCode(w.returnBar))) out.push('the Analysis return bar names no Replay');
    return out;
  },

  liveStateViolations(w) {
    const out = [];
    for (const [name, text] of Object.entries(w.player)) {
      const code = tsCode(text);
      if (/integration\/runtime|IntegrationRuntime|\.\.\/state'|useQandeelStore|createQandeelStore|createHistoricalProjectionCache|\.ingest\(|commitLiveEdge|conversation-session|ConversationSessionApiClient|setDraft|submitTurn/u.test(code)) {
        out.push(`${name}: nothing live enters, and no Replay state leaves`);
      }
      if (/createReplayViewpointStore|viewpoint-store/u.test(code)) out.push(`${name}: the viewpoint is the composite's own (T-13)`);
    }
    return out;
  },

  generationViolations(w) {
    const out = [];
    const runtime = tsCode(w.runtime);
    if (!/replayPlayer: createReplayPlayerController\(\{\n\s+sessionId: bundle\.sessionId, reads: entry\.replayFor\(bundle\), commands: entry\.replayLifecycleFor\(bundle\), history: entry\.replayHistoryFor\(bundle\), isCurrent,\n\s+\}\),/u.test(runtime)) {
      out.push('one player per generation, on that generation\'s transports');
    }
    if (!/session\.replayPlayer\.retire\(\);\n\s+session\.replayEntry\.retire\(\);/u.test(runtime)) out.push('the player is retired with its generation');
    return out;
  },

  privacyViolations(w) {
    const out = [];
    for (const [name, text] of Object.entries(w.player)) {
      const code = tsCode(text);
      if (/\bscope\b|CONVERSATION_SESSION/u.test(code)) out.push(`${name}: F-2 - no Reading scope is read, shown or sent`);
      if (/console\.|telemetry|analytics|@sentry|crashlytics/iu.test(code)) out.push(`${name}: F-2 - nothing is logged or reported`);
    }
    const controller = tsCode(w.player['player-controller.ts'] ?? '');
    if (!controller.includes('export const REPLAY_READING_PACE = Object.freeze({ baseMs: 2500, perCharacterMs: 45, minMs: 3500, maxMs: 12000 });')) out.push('the declared reading pace');
    return out;
  },

  copyViolations(w) {
    const out = [];
    const copy = w.player['copy.ts'] ?? '';
    if (!copy.includes(COPY_GATE_CLOSED)) out.push("the S7-04 Copy Gate is CLOSED by the Product Owner's decision of 2026-10-20");
    const code = tsCode(copy).replace("export type ReplayPlayerCopyStatus = 'APPROVED' | 'LOCKED' | 'PROPOSED';", '');
    if (/status: 'PROPOSED'|enStatus: 'PROPOSED'|status: 'LOCKED'|enStatus: 'LOCKED'/u.test(code)
        || !code.includes("({ ar, en, status: 'APPROVED', enStatus: 'APPROVED', source:")) out.push('every S7-04 row is APPROVED, Arabic and English');
    const rows = [...code.matchAll(/^\s{2}(\w+): approved\(/gmu)].map((match) => match[1]);
    if (JSON.stringify(rows) !== JSON.stringify(COPY_ROWS)) out.push(`the 13 approved rows (found ${rows.join(', ')})`);
    // The words shown (each row's Arabic and English), not the rows' provenance notes.
    const shown = [...code.matchAll(/^\s{2}(\w+): approved\('([^']*)', (?:'([^']*)'|"([^"]*)")/gmu)].map((match) => [match[1], match[2], match[3] ?? match[4]]);
    if (JSON.stringify(shown) !== JSON.stringify(APPROVED_COPY)) out.push('every row says exactly the approved words');
    if (shown.some(([, ar, en]) => /صوت|فيديو|sound|audio|video/iu.test(`${ar} ${en}`))) out.push('no row claims sound or video');
    if (!copy.includes("'تُعرض الرسائل نصًّا بإيقاع مناسب للقراءة، لا بتوقيتها الأصلي.'")) out.push('the pacing line says the timing is not the original');
    for (const [name, text] of Object.entries(w.player)) {
      if (name !== 'copy.ts' && /[؀-ۿ]/u.test(tsCode(text))) out.push(`${name}: Arabic is written only in copy.ts`);
    }
    return out;
  },

  proofViolations(w) {
    const out = [];
    if (JSON.parse(w.mobilePkg).main !== 'expo-router/entry') out.push('the Product entry stays the Product entry');
    if (!w.selector.includes("process.env.S704_VISUAL_PROOF !== '1'")) out.push('the proof selector refuses without S704_VISUAL_PROOF=1');
    if (!/require\('\.\/replay-player-wire\.json'\)/u.test(w.fixture)) out.push('the proof serves the one real-path wire');
    if (!/playerServer\(\{ base: S704_PROOF_CONFIG\.apiBaseUrl, composition: true \}\)/u.test(w.proofWorld)) out.push('the proof build answers the Replay routes from the captured wire');
    if (!/<RuntimePhaseSurface runtime=\{runtime\} \/>/u.test(w.proofRoot)) out.push('the proof renders the production composition');
    for (const [path, text] of w.mobile) {
      if (/__fixtures__\/player-wire|replay-player-wire|S704ProofRoot|s704-proof/u.test(text)) out.push(`${path}: no production module reaches the proof`);
    }
    return out;
  },

  wiringViolations(w) {
    const out = [];
    const pkg = JSON.parse(w.pkg).scripts;
    if (pkg['test:s7-04-replay-player-navigation-contract'] !== 'node --test tests/s7-04-replay-player-navigation-contract.test.mjs') out.push('this contract script');
    if (!w.workflow.includes('run: npm run test:s7-04-replay-player-navigation-contract}')) out.push('CI runs this contract');
    return out;
  },

  recordViolations(w) {
    const out = [];
    if (w.record === null) return out;
    if (!w.record.includes('STOP — S7-04 FINAL MERGE REVIEW GATE')) out.push('the record stops at the final merge review gate');
    if (!w.record.includes('PRODUCT COPY GATE CLOSED')) out.push('the record carries the closed Copy Gate');
    for (const evidence of ['AUTOMATED TEST', 'RENDER PROOF ON THE REAL COMPOSITION', 'EMULATOR SCREENSHOT', 'REAL DEVICE TEST']) {
      if (!w.record.includes(evidence)) out.push(`the record names the evidence class ${evidence}`);
    }
    for (const finding of ['G-1', 'F-2', 'S7-05']) if (!w.record.includes(finding)) out.push(`the record carries ${finding}`);
    if (!/PR #349/u.test(w.record)) out.push('the record proves S7-03 merged via PR #349');
    if (w.state !== null && !/S7-03[^\n]*MERGED[^\n]*#349|#349[^\n]*S7-03/u.test(w.state)) out.push('Current State proves S7-03 merged via PR #349');
    // S7-05 RE-ANCHOR (2026-10-20): S7-04 merged through PR #350; the current task is S7-05, and S7-04 stands beneath it
    // as the previous task, as written at its closing change.
    // S8A-01 RE-ANCHOR (2026-10-21): S7-05 merged through PR #351; the current task is S8A-01, and S7-05 stands beneath it
    // as the previous task, as written at its closing change.
    // S8A-02 RE-ANCHOR (2026-10-23): S8A-01 merged through PR #353; the current task is S8A-02, and S8A-01 stands beneath it.
    // S8A-03 RE-ANCHOR (2026-10-23): S8A-02 merged through PR #354; the current task is S8A-03, and S8A-02 stands beneath it.
    // S8A-04 RE-ANCHOR (2026-10-24): S8A-03 merged through PR #355; the current task is S8A-04, and S8A-03 stands beneath it.
    // S8A-05 RE-ANCHOR (2026-10-26): S8A-04 merged through PR #358; the current task is S8A-05, and S8A-04 stands beneath it.
    // S8B-01 RE-ANCHOR (2026-10-28): S8A-05 merged through PR #363; Stage 8B starts and the current task is S8B-01, and
    // S8A-05 stands beneath it.
    // S8B-02 RE-ANCHOR (2026-10-30): S8B-01 merged through PR #366; the current task is S8B-02, and S8B-01 stands beneath it.
    if (w.map !== null && !/^> \*\*CURRENT IMPLEMENTATION TASK: S8B-02 — Voice Foundation\*\*/mu.test(w.map)) out.push('the Project Map names S8B-02 as current');
    if (w.map !== null && !/^> \*\(Previous, S8B-01, as written at its closing change; merged through PR #366:\)\* \*\*CURRENT IMPLEMENTATION TASK: S8B-01 — Voice Runtime Contract & Provider Evidence\*\*/mu.test(w.map)) out.push('the Project Map keeps S8B-01 beneath S8B-02');
    if (w.map !== null && /^> \*\*CURRENT IMPLEMENTATION TASK: S8B-01/mu.test(w.map)) out.push('the merged S8B-01 is no longer the current task');
    if (w.map !== null && !/^> \*\(Previous, S8A-05, as written at its closing change; merged through PR #363:\)\* \*\*CURRENT IMPLEMENTATION TASK: S8A-05 — Public World: Write Your Topic\*\*/mu.test(w.map)) out.push('the Project Map keeps S8A-05 beneath S8B-01');
    if (w.map !== null && !/^> \*\(Previous, S8A-04, as written at its closing change; merged through PR #358:\)\* \*\*CURRENT IMPLEMENTATION TASK: S8A-04 — Shared Social Understanding & Trusted Identity\*\*/mu.test(w.map)) out.push('the Project Map keeps S8A-04 beneath S8A-05');
    if (w.map !== null && !/^> \*\(Previous, S8A-03, as written at its closing change; merged through PR #355:\)\* \*\*CURRENT IMPLEMENTATION TASK: S8A-03 — Personal Understanding Reality\*\*/mu.test(w.map)) out.push('the Project Map keeps S8A-03 beneath S8A-04');
    if (w.map !== null && !/^> \*\(Previous, S8A-02, as written at its closing change; merged through PR #354:\)\* \*\*CURRENT IMPLEMENTATION TASK: S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality\*\*/mu.test(w.map)) out.push('the Project Map keeps S8A-02 as the previous task');
    if (w.map !== null && !/^> \*\(Previous, S8A-01, as written at its closing change; merged through PR #353:\)\* \*\*CURRENT IMPLEMENTATION TASK: S8A-01 — DeepSeek Production Integration & First Real Conversation\*\*/mu.test(w.map)) out.push('the Project Map keeps S8A-01 as the previous task');
    if (w.map !== null && !/^> \*\(Previous, S7-05, as written at its closing change; merged through PR #351:\)\* \*\*CURRENT IMPLEMENTATION TASK: S7-05 — Replay Final Integration, Device Proof & Stage Closure\*\*/mu.test(w.map)) out.push('the Project Map keeps S7-05 as the previous task');
    if (w.map !== null && !/^> \*\(Previous, S7-04, as written at its closing change; merged through PR #350:\)\* \*\*CURRENT IMPLEMENTATION TASK: S7-04 — Production Replay Player & Navigation\*\*/mu.test(w.map)) out.push('the Project Map keeps S7-04 as the previous task');
    if (w.state !== null && !/S7-04[^\n]*MERGED[^\n]*#350/u.test(w.state)) out.push('Current State proves S7-04 merged via PR #350');
    return out;
  },
};

test('S7-04 ships the player on the S7-03 composite and the one Living Analysis surface, with no API change, no route, no live state, and its gates in place', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

const edit = (key, file, from, to) => () => {
  const w = shipped();
  if (file === '') {
    assert.ok(w[key].includes(from), `planted text not found in ${key}: ${from}`);
    return { ...w, [key]: w[key].replace(from, to) };
  }
  assert.ok(w[key][file].includes(from), `planted text not found in ${key}/${file}: ${from}`);
  return { ...w, [key]: { ...w[key], [file]: w[key][file].replace(from, to) } };
};
const editList = (key, path, from, to) => () => {
  const w = shipped();
  const entry = w[key].find(([candidate]) => candidate === path);
  assert.ok(entry && entry[1].includes(from), `planted text not found in ${path}`);
  return { ...w, [key]: w[key].map(([candidate, text]) => [candidate, candidate === path ? text.replace(from, to) : text]) };
};
const add = (key, path, text) => () => {
  const w = shipped();
  return Array.isArray(w[key]) ? { ...w, [key]: [...w[key], [path, text]] } : { ...w, [key]: { ...w[key], [path]: text } };
};

const PLANTED = [
  ['a Skia canvas in the player', 'graphicsViolations', add('player', 'Glow.tsx', "import { Canvas } from '@shopify/react-native-skia';")],
  ['an animation of its own', 'graphicsViolations', add('player', 'Fade.tsx', "import Animated from 'react-native-reanimated';")],
  ['an audio track', 'graphicsViolations', add('player', 'voice.ts', "import { Audio } from 'expo-av';")],
  ['a Replay map', 'graphicsViolations', add('player', 'ReplayMap.tsx', "import { MapSurface } from '../map';")],
  ['a share sheet', 'graphicsViolations', add('player', 'share.ts', "import { Share } from 'react-native';\nShare.share({ message: '' });")],
  ['the composite replaced', 'graphicsViolations', edit('player', 'ReplayPlayer.tsx', '<ReplayMomentComposite ', '<View ')],
  ['the transport back in the temporal slot', 'graphicsViolations', edit('player', 'ReplayPlayer.tsx', 'top={top} controls={controls} />', 'top={top} controls={controls} timeline={rail} />')],
  ['the composite given a Timeline', 'graphicsViolations', edit('composite', '', 'timeline={null}', 'timeline={controls}')],
  ['the Call Rail as the transport', 'graphicsViolations', edit('player', 'ReplayPlayer.tsx', "import { replayPlayerCopy } from './copy';", "import { replayPlayerCopy } from './copy';\nimport { CallRail } from '../iconography';")],
  ['a generic play glyph', 'graphicsViolations', edit('glyphs', '', '"d": "M8.4 6.6v10.8', '"d": "M8 5v14')],
  ['a generic pause glyph', 'graphicsViolations', edit('glyphs', '', '"x": 7,\n          "y": 6,', '"x": 6,\n          "y": 5,')],
  ['text labels again', 'graphicsViolations', edit('player', 'ReplayPlayer.tsx', "<Glyph name={view.playing ? 'pause' : 'play'}", "<Text>{label}</Text><Mark name={view.playing ? 'pause' : 'play'}")],
  ['a Live terminal on the Spine', 'graphicsViolations', edit('player', 'ReplaySpine.tsx', "import { Aperture, P2_SPINE, SpineLayer, spinePresentation } from '../iconography';", "import { Aperture, LiveTerminal, P2_SPINE, SpineLayer, spinePresentation } from '../iconography';")],
  ['a motion of the Spine’s own', 'graphicsViolations', edit('player', 'ReplaySpine.tsx', 'motion.committedStyle]', '{ opacity: withTiming(1) }]')],
  ['the Spine drawn by hand', 'graphicsViolations', edit('player', 'ReplaySpine.tsx', '<SpineLayer spine={spine} ink={ink.tertiary} targetInk={ink.primary} layer="SPINE"', '<Line layer="SPINE"')],
  ['the live store on the Spine', 'graphicsViolations', edit('player', 'ReplaySpine.tsx', "import { TIMELINE_STEP } from '../timeline';", "import { TIMELINE_STEP } from '../timeline';\nimport { useQandeelStore } from '../state';")],
  ['a Spine that commits a TC', 'graphicsViolations', edit('player', 'ReplayPlayer.tsx', 'onCommit={(ordinal) => controller.seek(ordinal)}', 'onCommit={(tc) => composite.commit(tc)}')],
  ['an animation outside the Spine', 'graphicsViolations', edit('player', 'ReplayPlayer.tsx', "import { ReplaySpine } from './ReplaySpine';", "import { ReplaySpine } from './ReplaySpine';\nimport Animated from 'react-native-reanimated';")],
  ['the three points reused for omissions', 'graphicsViolations', edit('player', 'ReplaySpine.tsx', 'const RECOGNISERS = 2;', 'const RECOGNISERS = 2;\nconst { discontinuity } = P2_SPINE;')],
  ['the omission no longer said in words', 'graphicsViolations', edit('composite', '', 'testID="qandeel-replay-gap"', 'testID="qandeel-replay-omitted"')],
  ['the controls scrolled away with the message', 'graphicsViolations', edit('composite', '', '<ScrollView ref={reader} testID="qandeel-replay-moment-reading"', '<View testID="qandeel-replay-moment-reading"')],
  ['the reading scrolled to a new moment with motion', 'graphicsViolations', edit('composite', '', 'scrollTo({ y: 0, animated: false })', 'scrollTo({ y: 0, animated: true })')],
  ['an S7-03 consumer measured too', 'graphicsViolations', edit('composite', '', 'onLayout={controls === null ? undefined : onRect}', 'onLayout={onRect}')],
  ['a band cap guessed', 'graphicsViolations', edit('composite', '', "recompositionPlan(surface, { support: 'CHROME_ONLY' }).support.chromePoints", 'surface.height / 2')],
  ['a fourth command', 'apiViolations', edit('client', '', "act: 'preview' | 'finalize' | 'reopen', payload", "act: 'preview' | 'finalize' | 'reopen' | 'share', payload")],
  ['a GET in the lifecycle client', 'apiViolations', edit('client', '', "method: 'POST',", "method: 'GET',")],
  ['an identity in a command body', 'apiViolations', edit('client', '', "this.command(replayId, 'preview', { commandId, expectedDraftRevision },", "this.command(replayId, 'preview', { commandId, expectedDraftRevision, sessionId: replayId },")],
  ['a changed Replay service', 'apiViolations', editList('frozen', 'apps/api/src/replay/replay.service.ts', 'export class ReplayService', 'export class ReplayService2')],
  ['G-1 hidden as a success', 'apiViolations', editList('frozen', 'apps/api/src/replay/replay.service.ts', 'versionId === null ? row.current_version_finalized !== false :', 'versionId === null ? false :')],
  ['G-1 left failing', 'apiViolations', editList('frozen', 'apps/api/src/replay/replay.service.ts', 'versionId === null ? row.current_version_finalized !== false :', 'versionId === null ? finalized !== null :')],
  ['an S7-02 approved row reworded', 'apiViolations', editList('frozen', 'apps/mobile/src/replay-entry/copy.ts', "ar: 'هذا غير متاح الآن.'", "ar: 'غير متاح.'")],
  ['a new migration', 'apiViolations', () => ({ ...shipped(), migrations: [...shipped().migrations, '0170_replay_player_v1.sql'] })],
  ['the depth beneath rebuilt', 'navigationViolations', edit('depth', '', 'const personalOpen = personalReachable && !introductionsShown && !playerOpen;', 'const personalOpen = personalReachable && !introductionsShown;')],
  ['the player in every world', 'navigationViolations', edit('depth', '', "{onSignOut !== undefined && area === 'MY_WORLD' ? <ReplayPlayer", "{onSignOut !== undefined ? <ReplayPlayer")],
  ['Activity opened beneath the passage', 'navigationViolations', edit('depth', '', 'const openActivity = useCallback(() => {\n    // S7-04: Activity is not entered from beneath the Replay passage; the passage closes first.\n    replayPlayer.close();', 'const openActivity = useCallback(() => {')],
  ['a route of its own', 'navigationViolations', add('player', 'route.ts', "import { useRouter } from 'expo-router';")],
  ['Back not handled', 'navigationViolations', edit('player', 'ReplayPlayer.tsx', "BackHandler.addEventListener('hardwareBackPress'", "BackHandler.addEventListener('blur'")],
  ['the live store in the player', 'liveStateViolations', add('player', 'live.ts', "import { useQandeelStore } from '../state';")],
  ['a viewpoint opened by the player', 'liveStateViolations', add('player', 'viewpoint.ts', "import { createReplayViewpointStore } from '../replay-composite/viewpoint-store';")],
  ['a draft written into the Conversation', 'liveStateViolations', add('player', 'quote.ts', 'export const quote = (c: { setDraft(t: string): void }) => c.setDraft("x");')],
  ['a player shared across generations', 'generationViolations', edit('runtime', '', 'commands: entry.replayLifecycleFor(bundle)', 'commands: sharedLifecycle')],
  ['a player never retired', 'generationViolations', edit('runtime', '', '    session.replayPlayer.retire();\n', '')],
  ['the Reading scope read', 'privacyViolations', add('player', 'scope.ts', 'export const s = (r: { scope: string }) => r.scope;')],
  ['a log line', 'privacyViolations', add('player', 'log.ts', 'console.log("moment");')],
  ['a different pace', 'privacyViolations', edit('player', 'player-controller.ts', 'baseMs: 2500', 'baseMs: 900')],
  ['a reopened S7-04 Copy Gate', 'copyViolations', edit('player', 'copy.ts', COPY_GATE_CLOSED, 'S7-04 PRODUCT COPY GATE — OPEN')],
  ['the English left unapproved', 'copyViolations', edit('player', 'copy.ts', "status: 'APPROVED', enStatus: 'APPROVED', source:", "status: 'APPROVED', enStatus: 'PROPOSED', source:")],
  ['an approved word changed', 'copyViolations', edit('player', 'copy.ts', "'Replay moments'", "'The moments'")],
  ['the Arabic of reopenedNotice reworded', 'copyViolations', edit('player', 'copy.ts', "'أصبحت إعادة العرض مسودة يمكن تعديلها.'", "'عادت إعادة العرض مسودة.'")],
  ['a sound claim', 'copyViolations', edit('player', 'copy.ts', "play: approved('تشغيل',", "play: approved('تشغيل الصوت',")],
  ['Arabic written in the view', 'copyViolations', add('player', 'Label.tsx', "export const label = 'تشغيل';")],
  ['the Product entry replaced', 'proofViolations', edit('mobilePkg', '', '"main": "expo-router/entry"', '"main": "src/integration/__validation__/s704-proof-entry.tsx"')],
  ['a production module reaching the proof', 'proofViolations', add('mobile', 'apps/mobile/src/replay-player/x.ts', "import { playerServer } from './__fixtures__/player-wire';")],
  ['an unguarded selector', 'proofViolations', edit('selector', '', "process.env.S704_VISUAL_PROOF !== '1'", 'false')],
  ['this contract left out of CI', 'wiringViolations', edit('workflow', '', 'run: npm run test:s7-04-replay-player-navigation-contract}', 'run: true}')],
  ['a missing review gate', 'recordViolations', () => ({ ...shipped(), record: (shipped().record ?? 'STOP — S7-04 FINAL MERGE REVIEW GATE').replace('STOP — S7-04 FINAL MERGE REVIEW GATE', 'merged') })],
];

for (const [name, detector, plant] of PLANTED) {
  test(`the ${detector} detector catches ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](plant()), [], name);
  });
}

test('this contract is registered at the root and runs once in API CI', () => {
  const w = shipped();
  assert.deepEqual(DETECTORS.wiringViolations(w), []);
  assert.equal(w.workflow.split('run: npm run test:s7-04-replay-player-navigation-contract}').length - 1, 1);
});
