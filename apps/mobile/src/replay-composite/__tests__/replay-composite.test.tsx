/**
 * S7-03 — the Historical Replay composite, over the REAL-PATH wire (PostgreSQL 0169 → ReplayService → the production
 * client → the governed adapter → the production LivingAnalysisSurface and T-04 MapSurface).
 *
 * The twelve acceptance criteria, each by name: exact text; the same ordinal and TC; no future knowledge; no live state;
 * the same Living Analysis components; available and withheld rungs; gaps and partial history; withholding when not
 * viewable; Arabic, RTL, accessibility and Reduced Motion; no identity or Session context; a Replay engine independent
 * of the graphics; and (statically, in the root contract) the frozen authority and privacy files unchanged.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { LivingAnalysisSurface } from '../../living-analysis';
import { LivingAnalysisSurface as LivingAnalysisSurfaceActual } from '../../living-analysis/LivingAnalysisSurface';
import { MAP_ACCESSIBILITY_TEST_ID, MAP_SURFACE_TEST_ID, MapSurface } from '../../map';
import { MapSurface as MapSurfaceActual } from '../../map/renderer/MapSurface';
import { RESPONSIVE_SURFACE_TEST_ID } from '../../responsive';
import { resize } from '../../responsive/__fixtures__/composition';
import type { ReplayHistoryMoment, ReplayHistoryVersion, ReplayMomentAnalysis } from '../../runtime-entry';
import { createReplayCompositeController, type ReplayHistoryReader } from '../composite-controller';
import { REPLAY_COMPOSITE_COPY_GATE, REPLAY_COMPOSITE_COPY_ROWS, replayCompositeCopy } from '../copy';
import { REPLAY_RENDER_CONTRACT_V1, discloseReplayMoment, replayViewpointKey } from '../projection-adapter';
import { REPLAY_COMPOSITE_TEST_ID, ReplayMomentComposite, ReplayPreviewLimit } from '../ReplayMomentComposite';
import { DERIVED_GAP, REPLAY_WIRE, replayScene, replayWireClient, type ReplayProofSceneName, type ReplayWireScene } from '../__fixtures__/replay-wire';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
// Criterion 5: the REAL components, observed — each spy calls the actual implementation and only records that it ran.
jest.mock('../../map/renderer/MapSurface', () => {
  const actual = jest.requireActual('../../map/renderer/MapSurface');
  return { ...actual, MapSurface: jest.fn(actual.MapSurface) };
});
jest.mock('../../living-analysis/LivingAnalysisSurface', () => {
  const actual = jest.requireActual('../../living-analysis/LivingAnalysisSurface');
  return { ...actual, LivingAnalysisSurface: jest.fn(actual.LivingAnalysisSurface) };
});

const INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const SIZE = { width: 400, height: 800 };
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const flush = () => act(async () => { for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve)); });

const appearance = () => createAppearanceAuthority({
  store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
  system: { current: () => 'DARK', subscribe: () => () => undefined },
  native: { apply: () => undefined },
});

/** The scene as the production client decodes it (through the runtime entry's public barrel only). */
async function decoded(scene: ReplayWireScene): Promise<{ version: ReplayHistoryVersion; moments: readonly ReplayHistoryMoment[] }> {
  const client = replayWireClient(scene);
  const version = await client.version(scene.replayId, scene.versionId);
  const moments = await client.moments(scene.replayId, scene.versionId);
  if (version.kind !== 'FOUND' || moments.kind !== 'FOUND') throw new Error('the fixture scene must decode');
  return { version: version.version, moments: moments.moments };
}

/** Counts every read the composite makes, so "it read nothing" is a measured fact. */
function counting(reader: ReplayHistoryReader) {
  const reads: string[] = [];
  const wrapped: ReplayHistoryReader = {
    version: (...args) => { reads.push('version'); return reader.version(...args); },
    moments: (...args) => { reads.push('moments'); return reader.moments(...args); },
    momentAnalysis: (replayId, versionId, ordinal, depth) => { reads.push(`analysis ${ordinal} ${depth}`); return reader.momentAnalysis(replayId, versionId, ordinal, depth); },
  };
  return { reader: wrapped, reads };
}

async function mount(name: ReplayProofSceneName | ReplayWireScene, ordinal: number, language: 'ar' | 'en' = 'ar', options?: Parameters<typeof replayWireClient>[1]) {
  const scene = typeof name === 'string' ? replayScene(name) : name;
  const { reader, reads } = counting(replayWireClient(scene, options));
  const controller = createReplayCompositeController(reader, scene.replayId, scene.versionId);
  const element = (n: number, lang = language) => (
    <AppearanceProvider authority={appearance()}><ReplayMomentComposite controller={controller} ordinal={n} language={lang} insets={INSETS} /></AppearanceProvider>
  );
  const view = await render(element(ordinal));
  await flush();
  await resize(view, SIZE.width, SIZE.height, { mapHeight: 520 });
  await flush();
  const show = async (n: number, lang = language) => {
    await view.rerender(element(n, lang));
    await flush();
    await resize(view, SIZE.width, SIZE.height, { mapHeight: 520 });
    await flush();
  };
  return { view, controller, reads, show, scene };
}

const text = (view: RenderResult, testID: string) => {
  const node = view.getByTestId(testID);
  const flat = (children: unknown): string => (Array.isArray(children) ? children.map(flat).join('') : typeof children === 'string' ? children : '');
  return flat(node.props.children ?? view.getByTestId(testID).children);
};
/** Every string a reader can see or hear in a rendered tree. */
function readerFacing(root: unknown, out: string[] = []): string[] {
  if (typeof root === 'string') { out.push(root); return out; }
  if (root === null || typeof root !== 'object') return out;
  if (Array.isArray(root)) { for (const child of root) readerFacing(child, out); return out; }
  const node = root as { props?: Record<string, unknown>; children?: unknown };
  const props = node.props ?? {};
  for (const key of ['accessibilityLabel', 'accessibilityHint', 'accessibilityValue']) if (typeof props[key] === 'string') out.push(props[key] as string);
  if (Array.isArray(props.accessibilityActions)) for (const action of props.accessibilityActions as { label?: string }[]) if (typeof action.label === 'string') out.push(action.label);
  readerFacing(node.children, out);
  return out;
}
const mapNodes = (view: RenderResult) => view.queryAllByTestId(new RegExp(`^${MAP_ACCESSIBILITY_TEST_ID}:`, 'u')).map((node) => String(node.props.testID).split(':')[1]);
const zoom = async (view: RenderResult, direction: 'zoom-in' | 'zoom-out') => {
  await act(async () => { fireEvent(view.getByTestId(MAP_ACCESSIBILITY_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: direction } }); });
  await flush();
  await resize(view, SIZE.width, SIZE.height, { mapHeight: 520 });
  await flush();
};

let MAIN: { version: ReplayHistoryVersion; moments: readonly ReplayHistoryMoment[] };
let ANALYSIS_4: Extract<ReplayMomentAnalysis, { outcome: 'AVAILABLE' }>;
beforeAll(async () => {
  MAIN = await decoded(REPLAY_WIRE.scenes.main);
  const answer = await replayWireClient(REPLAY_WIRE.scenes.main).momentAnalysis(REPLAY_WIRE.scenes.main.replayId, REPLAY_WIRE.scenes.main.versionId, 4, 'SOURCE_PROVENANCE');
  if (answer.kind !== 'ANSWERED' || answer.analysis.outcome !== 'AVAILABLE') throw new Error('expected an analysis');
  ANALYSIS_4 = answer.analysis;
});
const threadsAt = (tc: number) => (REPLAY_WIRE.scenes.main.analysis[String(tc)].WORLD as { world: { threads: { id: string }[] } }).world.threads.map((thread) => thread.id).sort();

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
  delete (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__;
});

describe('S7-03 — the composite on the real Living Analysis components', () => {
  it('(1, 2, 5) shows the exact committed text with its source and role, at the same ordinal and TC, on LivingAnalysisSurface and MapSurface', async () => {
    const { view } = await mount('main', 1);
    expect(view.getByTestId(REPLAY_COMPOSITE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID)).toBeTruthy();
    // The barrels hand the composite the very functions the owners export, and those are what rendered.
    expect(LivingAnalysisSurface).toBe(LivingAnalysisSurfaceActual);
    expect(MapSurface).toBe(MapSurfaceActual);
    expect(jest.mocked(LivingAnalysisSurface).mock.calls.at(-1)?.[0]).toMatchObject({ timeline: null });
    const mapProps = jest.mocked(MapSurface).mock.calls.at(-1)?.[0];
    expect(mapProps?.context.scene.tc).toBe(1);
    expect(mapProps?.context.scene.sessionId).toBe(`replay:${REPLAY_WIRE.scenes.main.replayId}:${REPLAY_WIRE.scenes.main.versionId}`);
    expect(mapProps?.store.getState().temporal).toEqual({ kind: 'PINNED', at: 1 });
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    expect(text(view, 'qandeel-replay-text')).toBe(MAIN.moments[0].text);
    expect(text(view, 'qandeel-replay-speaker')).toBe('أنت');
    expect(view.getByTestId('qandeel-replay-source').props.accessibilityLabel).toBe(`كلامك: ${MAIN.moments[0].text}`);
    expect(text(view, 'qandeel-replay-position')).toBe('جزء من المحادثة · في إعادة العرض: 1 من 6.');
    expect(text(view, 'qandeel-replay-temporal')).toBe('أنت عند اللحظة 1.');
    expect(text(view, 'qandeel-replay-spatial')).toBe('المعروض الآن: العالم كله.');
    expect(mapNodes(view)).toEqual(threadsAt(1).map((id) => `THREAD`));
    expect(mapNodes(view)).toHaveLength(threadsAt(1).length);
  });

  it('(1) an assistant moment is QANDEEL\'s, with its own accessible name', async () => {
    const { view } = await mount('main', 4);
    expect(text(view, 'qandeel-replay-speaker')).toBe('قنديل');
    expect(text(view, 'qandeel-replay-text')).toBe(MAIN.moments[3].text);
    expect(view.getByTestId('qandeel-replay-source').props.accessibilityLabel).toBe(`قنديل: ${MAIN.moments[3].text}`);
  });

  it('(3) the transition 2 → 3 → 2 carries no future knowledge: a Thread established at 3 is absent at 2, before and after', async () => {
    expect(threadsAt(2)).toHaveLength(1);
    expect(threadsAt(3)).toHaveLength(2);
    const { view, show } = await mount('main', 2);
    expect(mapNodes(view)).toHaveLength(1);
    expect(text(view, 'qandeel-replay-temporal')).toBe('أنت عند اللحظة 2.');
    await show(3);
    expect(text(view, 'qandeel-replay-text')).toBe(MAIN.moments[2].text);
    expect(text(view, 'qandeel-replay-temporal')).toBe('أنت عند اللحظة 3.');
    expect(mapNodes(view)).toHaveLength(2);
    await show(2);
    expect(text(view, 'qandeel-replay-text')).toBe(MAIN.moments[1].text);
    expect(mapNodes(view)).toHaveLength(1);
  });

  it('(6) a pinch through the rungs reads the next rung for the SAME moment; withheld rungs stay undrawn', async () => {
    const { view, reads } = await mount('main', 4);
    expect(mapNodes(view).every((key) => key.startsWith('THREAD'))).toBe(true);
    await zoom(view, 'zoom-in');
    expect(text(view, 'qandeel-replay-spatial')).toBe('المعروض الآن: الخيوط.');
    await zoom(view, 'zoom-in');
    await zoom(view, 'zoom-in');
    expect(reads).toEqual(expect.arrayContaining(['analysis 4 WORLD', 'analysis 4 THREAD', 'analysis 4 SESSION', 'analysis 4 ANALYTICAL_OBJECT']));
    expect(reads.filter((read) => read.startsWith('analysis') && !read.startsWith('analysis 4 '))).toEqual([]);
    const families = mapNodes(view).map((key) => key.split(':')[0]);
    // At ANALYTICAL_OBJECT the moment's two Readings and two Emerging Focuses are disclosed, beside its two Threads.
    expect(families.filter((family) => family === 'READING')).toHaveLength(2);
    expect(families.filter((family) => family === 'EMERGING_FOCUS')).toHaveLength(2);
    expect(families.filter((family) => family === 'THREAD')).toHaveLength(2);
  });

  it('(2, 7) a part of the conversation keeps its own ordinals and the conversation\'s TCs', async () => {
    const { view } = await mount('part', 1);
    expect(text(view, 'qandeel-replay-position')).toBe('جزء من المحادثة · في إعادة العرض: 1 من 3.');
    expect(text(view, 'qandeel-replay-temporal')).toBe('أنت عند اللحظة 4.');
    expect(mapNodes(view)).toHaveLength(threadsAt(4).length);
  });

  it('(7) DERIVED SPECIMEN — a discontinuity is perceptible where it is, and nothing omitted is shown', async () => {
    const { view } = await mount('derivedGap', DERIVED_GAP.beforeOrdinal);
    expect(view.getByTestId('qandeel-replay-gap').props.accessibilityLabel).toBe('لم تُعرض هنا رسالتان من المحادثة.');
    expect(view.getByText('لم تُعرض هنا رسالتان من المحادثة.')).toBeTruthy();
    expect(text(view, 'qandeel-replay-text')).toBe(MAIN.moments[3].text);
    await cleanup();
    const before = await mount('derivedGap', 3);
    expect(before.view.queryByTestId('qandeel-replay-gap')).toBeNull();
  });

  it('(8) NOT_VIEWABLE: its reason and both layers, no text, no Map, and no analysis read at all', async () => {
    const { view, reads } = await mount('notViewable', 1);
    expect(text(view, 'qandeel-replay-not-viewable-reason')).toBe('الرسائل الأصلية غير متاحة الآن.');
    expect(text(view, 'qandeel-replay-source-layer')).toBe('الرسائل الأصلية: غير متاحة الآن.');
    expect(text(view, 'qandeel-replay-analytical-layer')).toBe('التحليل المحفوظ: محفوظ كما كان.');
    expect(text(view, 'qandeel-replay-no-analysis-without-text')).toBe('لا يُعرض التحليل من دون الرسائل التي يخصّها.');
    expect(view.queryByTestId('qandeel-replay-text')).toBeNull();
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
    expect(reads.filter((read) => read.startsWith('analysis'))).toEqual([]);
  });

  it('(8) ANALYSIS_NOT_CURRENTLY_AVAILABLE for one moment: said so, with no Map — while the moment before it is drawn', async () => {
    const { view, show } = await mount('analysisMoved', 1);
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).not.toBeNull();
    await show(2);
    expect(text(view, 'qandeel-replay-text')).toBe(MAIN.moments[1].text);
    expect(view.getByTestId('qandeel-replay-analysis-not-currently-available')).toBeTruthy();
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
  });

  it('a failed analysis read is a failure with a retry — never an empty Map that implies no analysis existed', async () => {
    let failing = true;
    const { view } = await mount('main', 3, 'ar', { failAnalysis: () => failing });
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
    expect(view.getByTestId('qandeel-replay-analysis-failed')).toBeTruthy();
    expect(view.getByText('تعذّر عرض التحليل الآن. هذا لا يعني أنه غير موجود.')).toBeTruthy();
    failing = false;
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-replay-analysis-failed-retry')); });
    await flush();
    await resize(view, SIZE.width, SIZE.height, { mapHeight: 520 });
    await flush();
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).not.toBeNull();
    expect(mapNodes(view)).toHaveLength(threadsAt(3).length);
  });

  it('(9) English, Arabic RTL, the accessible Map and Reduced Motion all carry the same truth', async () => {
    const ar = await mount('main', 3, 'ar');
    const arNodes = mapNodes(ar.view);
    expect(ar.view.getByTestId('qandeel-replay-temporal').props.style.writingDirection).toBe('rtl');
    // Android ignores writingDirection, so the reader's side is set physically (found on the S7-03 emulator screenshots).
    for (const id of ['qandeel-replay-position', 'qandeel-replay-speaker', 'qandeel-replay-text', 'qandeel-replay-temporal', 'qandeel-replay-spatial']) {
      expect(ar.view.getByTestId(id).props.style.textAlign).toBe('right');
    }
    await cleanup();
    const en = await mount('main', 3, 'en');
    expect(text(en.view, 'qandeel-replay-speaker')).toBe('You');
    expect(text(en.view, 'qandeel-replay-temporal')).toBe('Reading at moment 3.');
    expect(en.view.getByTestId('qandeel-replay-temporal').props.style.writingDirection).toBe('ltr');
    expect(en.view.getByTestId('qandeel-replay-temporal').props.style.textAlign).toBe('left');
    expect(en.view.getByTestId('qandeel-replay-text').props.style.textAlign).toBe('right'); // the Arabic message keeps its own start
    expect(mapNodes(en.view)).toEqual(arNodes);
    await cleanup();
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
    const reduced = await mount('main', 3, 'ar');
    expect(mapNodes(reduced.view)).toEqual(arNodes);
    expect(text(reduced.view, 'qandeel-replay-text')).toBe(MAIN.moments[2].text);
    for (const node of reduced.view.queryAllByTestId(new RegExp(`^${MAP_ACCESSIBILITY_TEST_ID}:`, 'u'))) expect(typeof node.props.accessibilityLabel).toBe('string');
  });

  it('(10) no identity or Session context reaches the screen: no id, no viewpoint key, no Reading scope', async () => {
    for (const [name, ordinal] of [['main', 4], ['part', 2], ['notViewable', 1], ['analysisMoved', 2]] as const) {
      const { view } = await mount(name, ordinal);
      if (view.queryByTestId(MAP_ACCESSIBILITY_TEST_ID) !== null) await zoom(view, 'zoom-in');
      // Everything a reader can see or hear: every text, and every accessible name and action label. (T-04's own test
      // ids carry canonical ids by its existing design; a test id is neither shown nor announced.)
      const said = readerFacing(view.toJSON());
      expect(said.length).toBeGreaterThan(0);
      for (const words of said) {
        expect(words).not.toMatch(UUID);
        expect(words).not.toContain('CONVERSATION_SESSION');
        expect(words).not.toContain('replay:');
      }
      await cleanup();
    }
  });
});

describe('S7-03 — the preview limits, as the real path answered them', () => {
  it('MOMENT_NOT_SEALED says the APPROVED S7-02 sentence; ANALYSIS_UNAVAILABLE says why no Replay exists — and neither draws a world', async () => {
    expect(REPLAY_WIRE.preview).toEqual({ openHead: { outcome: 'MOMENT_NOT_SEALED' }, legacy: { outcome: 'ANALYSIS_UNAVAILABLE' } });
    for (const outcome of ['MOMENT_NOT_SEALED', 'ANALYSIS_UNAVAILABLE'] as const) {
      const view = await render(<AppearanceProvider authority={appearance()}><ReplayPreviewLimit outcome={outcome} language="ar" insets={INSETS} /></AppearanceProvider>);
      await resize(view, SIZE.width, SIZE.height, { mapHeight: 520 });
      expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
      expect(view.getByText(outcome === 'MOMENT_NOT_SEALED'
        ? 'إعادة العرض التي تشمل آخر رسالة لا يمكن عرضها إلا بعد أن تستمر المحادثة.'
        : 'لا يتوفر تحليل محفوظ لهذه المحادثة، فلا يمكن إعادة عرضها.')).toBeTruthy();
      await cleanup();
    }
  });
});

describe('S7-03 — the governed adapter', () => {
  // Ordinal 4 at SOURCE_PROVENANCE, read once through the production client (beforeAll); a fresh copy per use.
  const analysis4 = () => JSON.parse(JSON.stringify(ANALYSIS_4)) as typeof ANALYSIS_4;

  it('(4, 11) carries the moment\'s own families, under the Replay viewpoint key, with no live or Session context', () => {
    const result = discloseReplayMoment(MAIN.version, MAIN.moments[3], analysis4());
    if (result.status !== 'DISCLOSED') throw new Error(result.reason);
    const disclosure = result.entry.value;
    expect(disclosure.sessionId).toBe(replayViewpointKey(MAIN.version));
    expect(disclosure.tc).toBe(4);
    expect(disclosure.liveHead).toBe(MAIN.version.lastTc);
    expect(disclosure.world).toEqual(analysis4().world);
    expect(disclosure.thread).toEqual(analysis4().thread);
    expect(disclosure.sourceProvenance).toEqual(analysis4().sourceProvenance);
    expect(disclosure.session.status === 'DISCLOSED' && disclosure.session.value.moments).toEqual([]);
    expect(disclosure.inspection).toBeNull();
    // The Replay-wire Reading `scope` names the conversation Session (finding F-2): it crosses only as data, and no
    // component of the composite reads or shows it (criterion 10 above).
  });

  it('refuses another moment\'s analysis, a moment without text, knowledge after the moment, and an unknown contract or medium', () => {
    expect(discloseReplayMoment(MAIN.version, MAIN.moments[2], analysis4())).toEqual({ status: 'REFUSED', reason: 'NOT_THIS_MOMENT' });
    expect(discloseReplayMoment(MAIN.version, { ...MAIN.moments[3], text: null }, analysis4())).toEqual({ status: 'REFUSED', reason: 'NO_MOMENT_TEXT' });
    const later = analysis4();
    const hindsight = { ...later, world: { ...later.world, liveFocus: { ...later.world.liveFocus, atSp: 5 } } };
    expect(discloseReplayMoment(MAIN.version, MAIN.moments[3], hindsight)).toEqual({ status: 'REFUSED', reason: 'BEYOND_THE_MOMENT' });
    const unknownContract = { ...MAIN.version, renderContract: { ...MAIN.version.renderContract, policies: { ...MAIN.version.renderContract.policies, motion: 'CINEMATIC' } } };
    expect(discloseReplayMoment(unknownContract, MAIN.moments[3], analysis4())).toEqual({ status: 'REFUSED', reason: 'RENDER_CONTRACT_NOT_HONOURED' });
    expect(discloseReplayMoment(MAIN.version, { ...MAIN.moments[3], originalMedium: 'ORIGINAL_AUDIO' }, analysis4())).toEqual({ status: 'REFUSED', reason: 'MEDIUM_NOT_RENDERABLE' });
    const notViewable = { ...MAIN.version, viewing: { ...MAIN.version.viewing, state: 'NOT_VIEWABLE' as const } };
    expect(discloseReplayMoment(notViewable, MAIN.moments[3], analysis4())).toEqual({ status: 'REFUSED', reason: 'NOT_VIEWABLE' });
  });

  it('the composite refuses a version whose render contract it cannot honour, and reads no analysis for it', async () => {
    const main = REPLAY_WIRE.scenes.main;
    const contract = main.version.renderContract as { policies: Record<string, string> };
    const scene = { ...main, version: { ...main.version, renderContract: { ...contract, policies: { ...contract.policies, editorialAnnotation: 'ANNOTATED' } } } };
    const { view, reads } = await mount(scene, 1);
    expect(view.getByTestId('qandeel-replay-not-available')).toBeTruthy();
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
    expect(reads.filter((read) => read.startsWith('analysis'))).toEqual([]);
  });

  it('the one contract it honours is exactly the version\'s own', () => {
    expect(MAIN.version.renderContract.schema).toBe(REPLAY_RENDER_CONTRACT_V1.schema);
    expect(MAIN.version.renderContract.policies).toEqual(REPLAY_RENDER_CONTRACT_V1.policies);
  });
});

describe('S7-03 — the Product Copy Gate', () => {
  it('is OPEN, with every new row PROPOSED in both languages, and no row naming a server word', () => {
    expect(REPLAY_COMPOSITE_COPY_GATE.status).toMatch(/OPEN/u);
    for (const row of Object.values(REPLAY_COMPOSITE_COPY_ROWS)) {
      expect(row.status).toBe('PROPOSED');
      expect(row.enStatus).toBe('PROPOSED');
      expect(`${row.ar} ${row.en}`).not.toMatch(/[A-Z]{3,}_[A-Z]/u);
    }
    expect(REPLAY_COMPOSITE_COPY_GATE.proposed).toHaveLength(Object.keys(REPLAY_COMPOSITE_COPY_ROWS).length + 2);
    expect(replayCompositeCopy('ar').gap('رسالتان')).toBe('لم تُعرض هنا رسالتان من المحادثة.');
    expect(replayCompositeCopy('en').gap('1 message')).toBe('1 message of the conversation is not shown here.');
  });
});
