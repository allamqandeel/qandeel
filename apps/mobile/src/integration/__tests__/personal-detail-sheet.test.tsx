/**
 * COSMOS-INT-01 Slice D CP3 — the Personal World Detail Sheet (Product Owner, 2026-11-17; Contract v1.7 §19.16).
 *
 * The real `LivingAnalysisMap` over the real bootstrapped runtime (and, for the hardware Back, the real production
 * composition): an inspection opens CP1's ONE Detail Sheet in PEEK — PEEK only — holding only what already existed (the
 * family word, T-08's statement and lineage, T-04's context choice in its ONE home, T-04's "Go to this place"); the PEEK
 * covers the rail, which stays mounted beneath it; dismissal writes nothing and reads nothing; a tap on the inspected
 * object shows it again; the Analysis's ONE Back handler asks it first.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { analysisCopy } from '../../analysis-language';
import {
  COSMOS_CONTEXT_TEST_ID_PREFIX, COSMOS_SHEET_HANDLE_TEST_ID, COSMOS_SHEET_SCROLL_TEST_ID, COSMOS_SHEET_STAGE_TEST_ID, COSMOS_SHEET_TEST_ID,
  COSMOS_STEP_TEST_ID_SUFFIX, COSMOS_TIMELINE_RAIL_TEST_ID, COSMOS_WORLD_VIEW_TEST_ID, CosmosWorldView, SHEET_HANDLE_HEIGHT, SHEET_PEEK_MAX, viewOf, type SheetPhase,
} from '../../cosmos/product';
import { project, type NasijCamera } from '../../cosmos/core/camera';
import { CosmosCanvas } from '../../cosmos/skia/CosmosCanvas';
import { MAP_ACCESSIBILITY_TEST_ID, inspectObject, mapInspectionContext, mapProjectionRequest, zoomSemanticStep, type MapInspectionContext } from '../../map';
import { disclosureFixture, inspectionFromQuery, type ReadingFixture } from '../../map/__fixtures__/disclosure';
import { chromeProjection, contextPathSentence, inspectionSentence, orientationModel } from '../../orientation-chrome';
import { unknownAtTc, withInspection } from '../../orientation-chrome/__fixtures__/chrome';
import type { HistoricalSemanticDepth } from '../../projection';
import { RESPONSIVE_MAP_FRAME_TEST_ID, RESPONSIVE_SURFACE_TEST_ID } from '../../responsive';
import { resize } from '../../responsive/__fixtures__/composition';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import {
  LivingAnalysisMap, PERSONAL_PEEK_CHOICE_TEST_ID, PERSONAL_PEEK_FAMILY_TEST_ID, PERSONAL_PEEK_GO_TEST_ID, PERSONAL_PEEK_LINEAGE_TEST_ID,
  PERSONAL_PEEK_STATEMENT_TEST_ID, PERSONAL_PEEK_TEST_ID, PERSONAL_RAIL_HOLDER_TEST_ID,
} from '../composition/LivingAnalysisMap';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { productLocale } from '../locale/product-locale';
import { understandingCopy } from '../../understanding';
import { heldContextEntry, inspectionRequestOf } from '../projection/projection-coordinator';
import { harness, settle, SESSION_A, type IntegrationHarness } from '../__fixtures__/integration';

jest.setTimeout(30000);

const LIVE_HEAD = 6;
const STEP = 1_000_000;
/** A Thread and a Reading with ONE locus each (Go to this place), a Reading in TWO contexts (the choice), a Focus with none. */
const THREADS = [{ id: 'thread-a', x: '0', y: '0' }, { id: 'thread-b', x: String(STEP / 2), y: '0' }];
const APPEARANCES = [
  { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
  { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 4 },
  { bindingId: 'binding-3', threadId: 'thread-a', readingId: 'reading-2', boundSp: 3 },
];
const READINGS = [{ id: 'reading-1' }, { id: 'reading-2' }];
const FOCUSES = [{ id: 'focus-1', startedSp: 3 }];
/**
 * COSMOS-FINAL-01 F-1 (re-anchored from the CP3 stand-in): the runtime now SENDS the inspection the reader holds
 * (`V = Disclose(K, depth, inspection)`), and this fixture answers each request from its own query, exactly as the
 * server's `resolveInspection` would (`fixtureInspectionResolution`). A plain request is answered with no resolution.
 * `inspected`: 'ANSWER' answers the inspected read; 'HOLD' never answers it (the read still on its way); an id in
 * `unknown` is answered UNKNOWN_AT_TC (an identity K(TC) does not hold), the one branch that may never name it.
 */
interface Answering { readonly inspected?: 'ANSWER' | 'HOLD'; readonly unknown?: readonly string[] }
const projection = (withhold: readonly HistoricalSemanticDepth[] = [], answering: Answering = {}, readings: readonly ReadingFixture[] = READINGS): Responder => (request) => {
  const params = new URL(request.url).searchParams;
  const depth = (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth;
  if (withhold.includes(depth)) return new Promise(() => undefined);
  const inspection = inspectionFromQuery((name) => params.get(name));
  if (inspection !== undefined && answering.inspected === 'HOLD') return new Promise(() => undefined);
  const disclosure = disclosureFixture({
    depth, sessionId: SESSION_A, tc: Number(params.get('tc') ?? LIVE_HEAD), liveHead: LIVE_HEAD,
    threads: THREADS, appearances: APPEARANCES, readings, focuses: FOCUSES, inspection,
  });
  return { status: 200, body: inspection !== undefined && (answering.unknown ?? []).includes(inspection.id) ? withInspection(disclosure, unknownAtTc()) : disclosure };
};
/** The reads that carried an inspection of this identity (F-1: the runtime asked the server about it). */
const inspectedReads = (h: IntegrationHarness, family: string, id: string) =>
  h.http.calls.filter((call) => call.url.includes('/historical-projection') && call.url.includes(`inspectFamily=${family}&inspectId=${encodeURIComponent(id)}`));
/** Inspect, and let the runtime's own inspected read (F-1) land: the resolution held is the server-like answer to it. */
async function inspectResolved(h: IntegrationHarness, family: 'THREAD' | 'READING' | 'EMERGING_FOCUS', id: string, binding?: string) {
  await inspect(h, family, id, binding);
  await act(async () => { await settle(); });
  expect(inspectedReads(h, family, id).length).toBeGreaterThan(0);
}

const hidden = { includeHiddenElements: true } as const;
const harnesses: IntegrationHarness[] = [];

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = false;
  for (const h of harnesses.splice(0)) h.dispose();
});

interface Mounted {
  readonly h: IntegrationHarness;
  readonly view: RenderResult;
  readonly register: jest.Mock;
  readonly language: 'en' | 'ar';
}

async function mount(language: 'en' | 'ar' = 'en', withhold: readonly HistoricalSemanticDepth[] = [], answering: Answering = { inspected: 'HOLD' }, readings: readonly ReadingFixture[] = READINGS): Promise<Mounted> {
  const h = await harness({ liveHead: LIVE_HEAD, projection: projection(withhold, answering, readings) });
  harnesses.push(h);
  const register = jest.fn();
  const view = await render(
    <LivingAnalysisMap runtime={h.ready()} locale={productLocale(language, language === 'ar' ? 'RTL' : 'LTR')} insets={{ top: 44, bottom: 34, left: 0, right: 0 }}
      fontScale={1} envelope={{ width: 390, height: 844 }} registerSheetBack={register} />,
  );
  await act(async () => { await settle(); });
  await resize(view, 390, 844, { insetTop: 44, insetBottom: 34 });
  await act(async () => { await settle(); });
  return { h, view, register, language };
}

const flush = () => act(async () => { await settle(); });
const sheet = (view: RenderResult) => view.getByTestId(COSMOS_SHEET_TEST_ID, hidden);
function phaseOf(view: RenderResult): SheetPhase {
  const props = sheet(view).props as { pointerEvents?: string; accessibilityViewIsModal?: boolean };
  return props.pointerEvents === 'none' ? 'CLOSED' : props.accessibilityViewIsModal === true ? 'EXPANDED' : 'PEEK';
}
const handle = (view: RenderResult) => view.getByTestId(COSMOS_SHEET_HANDLE_TEST_ID, hidden);
const actionNames = (view: RenderResult) => ((handle(view).props.accessibilityActions ?? []) as { name: string }[]).map((a) => a.name);
async function sheetAction(view: RenderResult, actionName: string) {
  await act(async () => { fireEvent(handle(view), 'accessibilityAction', { nativeEvent: { actionName } }); });
  await flush();
}
const words = (node: { props: { children?: unknown } }) => (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;
const holderStyle = (view: RenderResult) => StyleSheet.flatten(view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID, hidden).props.style) ?? {};

function context(h: IntegrationHarness): MapInspectionContext {
  const runtime = h.ready();
  const request = mapProjectionRequest(runtime.store.getState());
  if (request === null) throw new Error('no viewpoint');
  const derived = mapInspectionContext(runtime.bundle.projection.lookup(request.sessionId, request.tc, request.depth), request);
  if (!derived.ok) throw new Error('no inspection context');
  return derived.context;
}
/** The canonical inspection act, exactly as a tap on a mark dispatches it (the owner's `inspect` → T-04's `inspectObject`). */
async function inspect(h: IntegrationHarness, family: 'THREAD' | 'READING' | 'EMERGING_FOCUS', id: string, bindingId?: string) {
  await act(async () => {
    const outcome = inspectObject(h.ready().store, context(h), { family, id, ...(bindingId === undefined ? {} : { appearance: { kind: 'THREAD_READING' as const, bindingId } }) });
    expect(outcome.outcome).toBe('APPLIED');
    await settle();
  });
}
async function stepIn(h: IntegrationHarness) {
  await act(async () => { expect(zoomSemanticStep(h.ready().store, 'IN').outcome).toBe('APPLIED'); await settle(); });
}
/** T-08's own model over the held projection: the words the PEEK must show are exactly its words. */
function model(h: IntegrationHarness) {
  const runtime = h.ready();
  const state = runtime.store.getState();
  const request = mapProjectionRequest(state)!;
  // The composition's own rule (F-1): the inspected V once held for the inspection held now, otherwise the plain V.
  return orientationModel(runtime.store, chromeProjection(heldContextEntry(runtime.bundle.projection, request, inspectionRequestOf(state.inspection)), request));
}
const reads = (h: IntegrationHarness) => h.http.calls.length;
/** The canvas's accessible container: a host node INSIDE `CosmosCanvas`, so its identity is the canvas's mount. */
const STEP_NODE = `${COSMOS_WORLD_VIEW_TEST_ID}${COSMOS_STEP_TEST_ID_SUFFIX}`;
const canvasNode = (view: RenderResult) => view.getByTestId(STEP_NODE, hidden);
/** The props a composite component was rendered with, found from one of its host descendants (the renderer is host-only). */
function propsOf(view: RenderResult, type: unknown): Record<string, any> {
  type Fiber = { elementType?: unknown; type?: unknown; memoizedProps: Record<string, any>; return: Fiber | null };
  let fiber = canvasNode(view).unstable_fiber as Fiber | null;
  while (fiber !== null && fiber.elementType !== type && fiber.type !== type) fiber = fiber.return;
  if (fiber === null) throw new Error('component not found above the canvas');
  return fiber.memoizedProps;
}
/** Whether `node` lies inside `ancestor`. */
function inside(node: { parent: unknown } | null, ancestor: unknown): boolean {
  for (let at = node?.parent as { parent: unknown } | null; at !== null && at !== undefined; at = at.parent as { parent: unknown } | null) if (at === ancestor) return true;
  return false;
}
/** A real stage tap at a mark's point, through the canvas's own tap callback (as the gesture's `onEnd` hands it). */
async function tapMark(view: RenderResult, id: string) {
  const canvas = { props: propsOf(view, CosmosCanvas) };
  const glass = propsOf(view, CosmosWorldView).glass;
  const camera = canvas.props.initialCamera as NasijCamera;
  const hit = canvas.props.stage.layers[canvas.props.rung].hits.find((each: { id: string }) => each.id === id);
  if (hit === undefined) throw new Error(`no mark ${id} at this rung`);
  const at = project(camera, viewOf(glass), hit.x, hit.y);
  await act(async () => { canvas.props.onTap(at.x, at.y, camera); });
  await flush();
}

describe('CP3 (1) — inspection opens the PEEK; nothing else does', () => {
  it('at rest the sheet is CLOSED, hidden, untouchable and empty; the rail is shown and takes touches', async () => {
    const { view } = await mount();
    expect(phaseOf(view)).toBe('CLOSED');
    expect(sheet(view).props.importantForAccessibility).toBe('no-hide-descendants');
    expect(view.queryByTestId(PERSONAL_PEEK_TEST_ID, hidden)).toBeNull();
    expect(view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID).props.pointerEvents).toBe('box-none');
    expect(holderStyle(view).opacity).toBeUndefined();
    expect(view.getByTestId(COSMOS_TIMELINE_RAIL_TEST_ID)).toBeTruthy();
  });

  it('a tap on a mark inspects it (the existing act) and opens the PEEK — PEEK only: no EXPANDED is ever offered', async () => {
    const { h, view } = await mount();
    await tapMark(view, 'THREAD:thread-a');
    expect(h.ready().store.getState().inspection).not.toBeNull();
    expect(phaseOf(view)).toBe('PEEK');
    expect(actionNames(view)).toEqual(['close']);
    await sheetAction(view, 'expand');
    expect(phaseOf(view)).toBe('PEEK');
    // Even a content measured far taller than the PEEK is never EXPANDED in the Personal World (G-7).
    await act(async () => { fireEvent(view.getByTestId(COSMOS_SHEET_SCROLL_TEST_ID, hidden), 'contentSizeChange', 390, 2400); });
    expect(actionNames(view)).toEqual(['close']);
  });
});

describe('CP3 (2) — the PEEK holds only the existing words and acts', () => {
  it.each(['en', 'ar'] as const)('%s, while the inspected read has not answered (F-1): a Thread — the stage\'s family word, T-08\'s own sentence, Go to this place', async (language) => {
    const { h, view } = await mount(language);
    await inspect(h, 'THREAD', 'thread-a');
    const copy = analysisCopy(language);
    const render_ = model(h).inspection.render;
    // F-1: the inspected read was sent and has not answered, so no resolution is held and T-08 says so — its own
    // technical sentence (a gap in what the client holds, never a claim about the target).
    expect(inspectedReads(h, 'THREAD', 'thread-a')).toHaveLength(1);
    expect(render_.kind).toBe('INSPECTION_NOT_RESOLVED');
    expect(words(view.getByTestId(PERSONAL_PEEK_FAMILY_TEST_ID))).toBe(copy.family.THREAD);
    expect(words(view.getByTestId(PERSONAL_PEEK_STATEMENT_TEST_ID))).toBe(inspectionSentence(language, render_));
    expect(view.queryByTestId(PERSONAL_PEEK_LINEAGE_TEST_ID)).toBeNull();
    expect(view.getByTestId(PERSONAL_PEEK_GO_TEST_ID).props.accessibilityLabel).toBe(copy.goToPlace);
    // Nothing else is drawn in it: no Conversation, no Replay, no new label or link.
    expect(view.queryByTestId('qandeel-depth-to-conversation', hidden)).toBeNull();
    expect(view.queryByTestId('qandeel-replay-analysis-entry', hidden)).toBeNull();
    const peekTexts = view.getByTestId(PERSONAL_PEEK_TEST_ID).queryAll((node) => node.type === 'Text').map((node) => words(node));
    // RE-ANCHORED by COSMOS E-2 corrections, Slice A (PO decisions D-3 / D-4, 2026-11-20): the PEEK also names the Thread
    // (here unnamed: the fixture discloses no wording) and offers Open where it began; Name this topic appears only when the
    // composition can rename (no `onAlias` here).
    expect(peekTexts).toEqual([copy.family.THREAD, copy.topicUnnamed, inspectionSentence(language, render_), copy.goToPlace, copy.openSource]);
  });

  it.each(['en', 'ar'] as const)('%s, with a held resolution: a Thread — T-08\'s RENDERABLE statement, no lineage, Go to this place', async (language) => {
    const { h, view } = await mount(language, [], { inspected: 'ANSWER' });
    await inspectResolved(h, 'THREAD', 'thread-a');
    const copy = analysisCopy(language);
    const render_ = model(h).inspection.render;
    expect(render_.kind).toBe('RENDERABLE');
    const peekTexts = view.getByTestId(PERSONAL_PEEK_TEST_ID).queryAll((node) => node.type === 'Text').map((node) => words(node));
    // RE-ANCHORED by COSMOS E-2 corrections, Slice A (D-3 / D-4, 2026-11-20): see the previous case.
    expect(peekTexts).toEqual([copy.family.THREAD, copy.topicUnnamed, inspectionSentence(language, render_), copy.goToPlace, copy.openSource]);
  });

  it.each(['en', 'ar'] as const)('%s, with a held resolution: a Reading in two contexts — its lineage, and T-04\'s context choice in the PEEK (its ONE home), never in the rail', async (language) => {
    const { h, view } = await mount(language, [], { inspected: 'ANSWER' });
    for (let n = 0; n < 3; n += 1) await stepIn(h);
    await inspectResolved(h, 'READING', 'reading-1', 'binding-1');
    const m = model(h);
    expect(m.inspection.render.kind).toBe('RENDERABLE');
    expect(m.context.choiceAvailable).toBe(true);
    expect(words(view.getByTestId(PERSONAL_PEEK_FAMILY_TEST_ID))).toBe(analysisCopy(language).family.READING);
    expect(words(view.getByTestId(PERSONAL_PEEK_STATEMENT_TEST_ID))).toBe(inspectionSentence(language, m.inspection.render));
    const path = contextPathSentence(language, m.context.lineage);
    expect(path).not.toBeNull();
    expect(words(view.getByTestId(PERSONAL_PEEK_LINEAGE_TEST_ID))).toBe(path);
    const choice = view.getByTestId(PERSONAL_PEEK_CHOICE_TEST_ID);
    const chips = view.queryAllByTestId(new RegExp(`^${COSMOS_CONTEXT_TEST_ID_PREFIX}`, 'u'), hidden);
    expect(chips).toHaveLength(m.context.appearances.length);
    expect(chips.length).toBe(2);
    // Every chip lives in the PEEK; the rail (inert beneath it) holds none.
    for (const chip of chips) expect(inside(chip, choice)).toBe(true);
    const rail = view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID, hidden);
    expect(rail.queryAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(COSMOS_CONTEXT_TEST_ID_PREFIX))).toHaveLength(0);
    // Two loci: Go to this place would have to elect a context, so it is not offered (T-04's own rule).
    expect(view.queryByTestId(PERSONAL_PEEK_GO_TEST_ID)).toBeNull();
  });

  it('choosing the other context is T-04\'s switch: the inspection names it, and the PEEK stays open over the same object', async () => {
    const { h, view } = await mount('en', [], { inspected: 'ANSWER' });
    for (let n = 0; n < 3; n += 1) await stepIn(h);
    await inspectResolved(h, 'READING', 'reading-1', 'binding-1');
    const other = model(h).context.appearances.find((option) => !option.current)!;
    await act(async () => { fireEvent.press(view.getByTestId(`${COSMOS_CONTEXT_TEST_ID_PREFIX}${other.ordinal}`)); });
    await flush();
    const inspection = h.ready().store.getState().inspection!;
    expect(inspection.canonicalIdentity.value).toMatchObject({ family: 'READING', id: 'reading-1' });
    expect(JSON.stringify(inspection)).toContain(other.bindingId);
    expect(phaseOf(view)).toBe('PEEK');
  });

  it('Go to this place is the same direct jump the accessible Map runs, with the same landing', async () => {
    const viaPeek = await mount();
    for (let n = 0; n < 3; n += 1) await stepIn(viaPeek.h);
    await inspect(viaPeek.h, 'READING', 'reading-2');
    const before = viaPeek.h.ready().store.getState().history.length;
    await act(async () => { fireEvent.press(viaPeek.view.getByTestId(PERSONAL_PEEK_GO_TEST_ID)); });
    await flush();
    const landed = viaPeek.h.ready().store.getState();
    expect(landed.history.length).toBe(before + 1);
    expect(landed.history[landed.history.length - 1].act).toBe('DIRECT_JUMP');
    expect(phaseOf(viaPeek.view)).toBe('PEEK');

    const viaMap = await mount();
    for (let n = 0; n < 3; n += 1) await stepIn(viaMap.h);
    await inspect(viaMap.h, 'READING', 'reading-2');
    const node = viaMap.view.getAllByTestId(new RegExp(`^${MAP_ACCESSIBILITY_TEST_ID}:`, 'u'), hidden)
      .find((each) => ((each.props.accessibilityActions ?? []) as { name: string }[]).some((a) => a.name === 'direct-jump') && /reading-2/u.test(String(each.props.testID)));
    expect(node).toBeDefined();
    await act(async () => { node!.props.onAccessibilityAction({ nativeEvent: { actionName: 'direct-jump' } }); });
    await flush();
    expect(viaMap.h.ready().store.getState().camera).toEqual(landed.camera);
    expect(viaMap.h.ready().store.getState().inspection).toEqual(landed.inspection);
  });

  it('an object with no locus is not offered Go to this place; its family word is still the stage\'s', async () => {
    const { h, view } = await mount();
    await stepIn(h);
    await stepIn(h);
    await inspect(h, 'EMERGING_FOCUS', 'focus-1');
    expect(words(view.getByTestId(PERSONAL_PEEK_FAMILY_TEST_ID))).toBe(analysisCopy('en').family.EMERGING_FOCUS);
    expect(view.queryByTestId(PERSONAL_PEEK_GO_TEST_ID)).toBeNull();
  });

  it('an identity this moment does not know is never named, whatever the stage holds', async () => {
    const { h, view } = await mount('en', [], { inspected: 'ANSWER', unknown: ['thread-a'] });
    await inspectResolved(h, 'THREAD', 'thread-a');
    expect(model(h).inspection.render.kind).toBe('IDENTITY_UNKNOWN_AT_TC');
    expect(view.queryByTestId(PERSONAL_PEEK_FAMILY_TEST_ID)).toBeNull();
    expect(words(view.getByTestId(PERSONAL_PEEK_STATEMENT_TEST_ID))).toBe(inspectionSentence('en', model(h).inspection.render));
  });

  it('a technical state the scene cannot answer names no family: the PEEK says T-08\'s sentence; closed, the rail says it as before (P-5)', async () => {
    const { h, view } = await mount('en', ['THREAD']);
    await inspect(h, 'THREAD', 'thread-a');
    await act(async () => { expect(zoomSemanticStep(h.ready().store, 'IN').outcome).toBe('APPLIED'); await settle(); });
    const render_ = model(h).inspection.render;
    expect(render_.kind).toBe('PROJECTION_NOT_FETCHED');
    expect(view.queryByTestId(PERSONAL_PEEK_FAMILY_TEST_ID)).toBeNull();
    expect(words(view.getByTestId(PERSONAL_PEEK_STATEMENT_TEST_ID))).toBe(inspectionSentence('en', render_));
    await sheetAction(view, 'close');
    expect(words(view.getByTestId('qandeel-cosmos-acts:note'))).toBe(inspectionSentence('en', render_));
  });
});

// COSMOS E-2 (SD-3 item 6, §31.10; migration 0200, PG-02 / INTEL-TM-01): the Reading statement, exactly as served.
describe('COSMOS E-2 — the Reading PEEK shows its statement only when QANDEEL may rely on it', () => {
  const READING_PEEK = `${PERSONAL_PEEK_TEST_ID}:reading`;
  const allTexts = (view: RenderResult) => (view.root?.queryAll((node) => node.type === 'Text') ?? []).map((node) => words(node)).join(' | ');

  it.each(['en', 'ar'] as const)('%s: relied on (NONE), at the analytical depth — the statement under the family word and the T-08 sentence', async (language) => {
    const { h, view } = await mount(language, [], { inspected: 'ANSWER' });
    for (let n = 0; n < 3; n += 1) await stepIn(h);
    await inspectResolved(h, 'READING', 'reading-1', 'binding-1');
    expect(model(h).inspection.render.kind).toBe('RENDERABLE');
    expect(words(view.getByTestId(PERSONAL_PEEK_FAMILY_TEST_ID))).toBe(analysisCopy(language).family.READING);
    expect(words(view.getByTestId(READING_PEEK))).toBe('statement of reading-1');
  });

  it.each([['en', 'REVIEW_PENDING'], ['ar', 'REVIEW_PENDING'], ['en', 'NO_REMAINING_SUPPORT'], ['ar', 'NO_REMAINING_SUPPORT']] as const)(
    '%s, %s: withheld — the approved INTEL-TM-01 line in its place, and no statement anywhere', async (language, kind) => {
      const { h, view } = await mount(language, [], { inspected: 'ANSWER' }, [{ id: 'reading-1', evidenceChange: kind }, { id: 'reading-2' }]);
      for (let n = 0; n < 3; n += 1) await stepIn(h);
      await inspectResolved(h, 'READING', 'reading-1', 'binding-1');
      expect(words(view.getByTestId(READING_PEEK))).toBe(understandingCopy(language).evidenceChange[kind]);
      expect(allTexts(view)).not.toContain('statement of reading-1');
    });

  it('above the analytical depth nothing of the Reading is shown (the rung is withheld, never inferred)', async () => {
    const { h, view } = await mount('en', [], { inspected: 'ANSWER' });
    await stepIn(h);
    await inspectResolved(h, 'READING', 'reading-2', 'binding-3');
    expect(context(h).disclosure.analyticalObject.status).toBe('DEPTH_WITHHELD');
    expect(view.queryByTestId(READING_PEEK)).toBeNull();
    expect(allTexts(view)).not.toContain('statement of reading-2');
  });

  it('the PEEK of a Thread never carries a Reading line', async () => {
    const { h, view } = await mount('en', [], { inspected: 'ANSWER' });
    for (let n = 0; n < 3; n += 1) await stepIn(h);
    await inspectResolved(h, 'THREAD', 'thread-a');
    expect(view.queryByTestId(READING_PEEK)).toBeNull();
  });
});

describe('CP3 (3, 4) — the PEEK covers the rail; dismissal is presentation only', () => {
  it('open, the rail is covered: still mounted, hidden, inert; the PEEK reaches at least the rail\'s top', async () => {
    const { h, view } = await mount();
    await act(async () => { fireEvent(view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 354, height: 100 } } }); });
    const rail = view.getByTestId(COSMOS_TIMELINE_RAIL_TEST_ID);
    await inspect(h, 'THREAD', 'thread-a');
    expect(view.getByTestId(COSMOS_TIMELINE_RAIL_TEST_ID, hidden)).toBe(rail);
    const holder = view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID, hidden);
    expect(holder.props.pointerEvents).toBe('none');
    expect(holder.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(holderStyle(view).opacity).toBe(0);
    // The PEEK's content reaches the rail's top: handle + content ≥ inset + 12 + the rail's height.
    const inset = (propsOf(view, CosmosWorldView).glass as { insetBottom: number }).insetBottom;
    const peekStyle = StyleSheet.flatten(view.getByTestId(PERSONAL_PEEK_TEST_ID).props.style);
    expect(SHEET_HANDLE_HEIGHT + (peekStyle.minHeight as number)).toBeGreaterThanOrEqual(inset + 12 + 100);
    expect(SHEET_HANDLE_HEIGHT + (peekStyle.minHeight as number)).toBeLessThanOrEqual(SHEET_PEEK_MAX + inset);
  });

  it('closing writes nothing and reads nothing: the store, its history, the inspection and the camera are the SAME; the rail is revealed unchanged', async () => {
    const { h, view } = await mount();
    const canvas = canvasNode(view);
    const rail = view.getByTestId(COSMOS_TIMELINE_RAIL_TEST_ID);
    await inspect(h, 'THREAD', 'thread-a');
    const state = h.ready().store.getState();
    const calls = reads(h);
    await sheetAction(view, 'close');
    expect(phaseOf(view)).toBe('CLOSED');
    expect(h.ready().store.getState()).toBe(state);
    expect(reads(h)).toBe(calls);
    expect(view.getByTestId(COSMOS_TIMELINE_RAIL_TEST_ID)).toBe(rail);
    expect(view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID).props.pointerEvents).toBe('box-none');
    expect(holderStyle(view).opacity).toBeUndefined();
    // No canvas remount, and the stage was never made inert (PEEK only).
    expect(canvasNode(view)).toBe(canvas);
    expect(view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID).props.pointerEvents).toBe('auto');
  });

  // COSMOS-FINAL-01 F-1 (re-anchored, the PO's F-1 requirement): an inspection now asks the server about itself, ONCE
  // (the inspected V of the current viewpoint). The PEEK's presentation still reads nothing: closing it and reopening
  // it over the same inspection issues no read at all.
  it('an inspection asks the server about itself once; the PEEK\'s presentation reads nothing', async () => {
    const { h, view } = await mount('en', [], { inspected: 'ANSWER' });
    const calls = reads(h);
    await inspectResolved(h, 'THREAD', 'thread-a');
    expect(phaseOf(view)).toBe('PEEK');
    expect(reads(h)).toBe(calls + 1);
    expect(inspectedReads(h, 'THREAD', 'thread-a')).toHaveLength(1);
    await sheetAction(view, 'close');
    await tapMark(view, 'THREAD:thread-a');
    await act(async () => { await settle(); });
    expect(phaseOf(view)).toBe('PEEK');
    expect(reads(h)).toBe(calls + 1);
  });
});

describe('CP3 (5) — a tap on the inspected object shows the PEEK again', () => {
  it('the same object, tapped on the stage: the PEEK reopens; the inspection is the one it was', async () => {
    const { h, view } = await mount();
    const canvas = canvasNode(view);
    await tapMark(view, 'THREAD:thread-a');
    await sheetAction(view, 'close');
    expect(phaseOf(view)).toBe('CLOSED');
    const inspection = h.ready().store.getState().inspection;
    await tapMark(view, 'THREAD:thread-a');
    expect(phaseOf(view)).toBe('PEEK');
    expect(h.ready().store.getState().inspection).toEqual(inspection);
    expect(canvasNode(view)).toBe(canvas);
  });

  it('another object, tapped: the PEEK opens about it', async () => {
    const { h, view } = await mount();
    await tapMark(view, 'THREAD:thread-a');
    await sheetAction(view, 'close');
    await tapMark(view, 'THREAD:thread-b');
    expect(phaseOf(view)).toBe('PEEK');
    expect(h.ready().store.getState().inspection!.canonicalIdentity.value).toMatchObject({ family: 'THREAD', id: 'thread-b' });
  });
});

describe('CP3 (7) — the sheet\'s step of the ONE Back handler', () => {
  it('the composition hands over its step and registers no listener; the step dismisses an open PEEK once, writing nothing', async () => {
    const listen = jest.spyOn(BackHandler, 'addEventListener');
    const { h, view, register } = await mount();
    expect(listen).not.toHaveBeenCalled();
    const back = register.mock.calls[register.mock.calls.length - 1][0] as () => boolean;
    expect(typeof back).toBe('function');
    await inspect(h, 'THREAD', 'thread-a');
    const step = register.mock.calls[register.mock.calls.length - 1][0] as () => boolean;
    const state = h.ready().store.getState();
    let spent = false;
    await act(async () => { spent = step(); });
    await flush();
    expect(spent).toBe(true);
    expect(phaseOf(view)).toBe('CLOSED');
    expect(h.ready().store.getState()).toBe(state);
    await act(async () => { spent = step(); });
    expect(spent).toBe(false);
  });

  it('it withdraws its step when it leaves', async () => {
    const { view, register } = await mount();
    await view.unmount();
    expect(register).toHaveBeenLastCalledWith(null);
  });
});

describe('CP3 (7) — the production composition: Back is the sheet\'s first, then the return; Conversation and Replay stay in the band', () => {
  const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };

  function backKey() {
    type Listener = Parameters<typeof BackHandler.addEventListener>[1];
    const listeners: Listener[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler);
      return { remove: () => { const i = listeners.indexOf(handler); if (i >= 0) listeners.splice(i, 1); } };
    });
    return {
      count: () => listeners.length,
      press: async () => {
        let handled = false;
        await act(async () => { for (const l of [...listeners].reverse()) { if (l({} as never) === true) { handled = true; break; } } await settle(); });
        return handled;
      },
    };
  }
  async function layOut(view: RenderResult) {
    for (const surface of view.queryAllByTestId(RESPONSIVE_SURFACE_TEST_ID, hidden)) {
      await act(async () => { fireEvent(surface, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } }); });
    }
    for (const frame of view.queryAllByTestId(RESPONSIVE_MAP_FRAME_TEST_ID, hidden)) {
      await act(async () => { fireEvent(frame, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 760 } } }); });
    }
    await flush();
  }

  it('Analysis: Back dismisses the PEEK (still the Analysis); the next Back returns to the Conversation, as before', async () => {
    const key = backKey();
    const h = await harness({ liveHead: LIVE_HEAD, projection: projection() });
    harnesses.push(h);
    const view = await render(<SafeAreaProvider initialMetrics={METRICS}><RuntimePhaseSurface runtime={h.runtime} /></SafeAreaProvider>);
    await flush();
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-depth-to-analysis')); });
    await flush();
    await layOut(view);
    const listeners = key.count();
    await inspect(h, 'THREAD', 'thread-a');
    expect(phaseOf(view)).toBe('PEEK');
    expect(key.count()).toBe(listeners);
    // The band keeps the way back to the Conversation (and the Replay entry slot, where present) — never in the PEEK.
    const band = view.getByTestId('qandeel-analysis-return-bar');
    expect(band.queryAll((node) => node.props.testID === 'qandeel-depth-to-conversation').length).toBeGreaterThan(0);
    const peek = view.getByTestId(PERSONAL_PEEK_TEST_ID);
    expect(peek.queryAll((node) => /^qandeel-(depth-to-conversation|replay-)/u.test(String(node.props.testID ?? '')))).toHaveLength(0);

    const state = h.ready().store.getState();
    expect(await key.press()).toBe(true);
    expect(phaseOf(view)).toBe('CLOSED');
    expect(h.ready().store.getState()).toBe(state);
    expect(view.queryByTestId('qandeel-analysis-return-bar')).not.toBeNull();

    expect(await key.press()).toBe(true);
    await layOut(view);
    expect(view.queryByTestId('qandeel-depth-to-analysis', hidden)).not.toBeNull();
    // The inspection outlives the dismissal and the crossing (D-12; no canonical act cleared it).
    expect(h.ready().store.getState().inspection).toEqual(state.inspection);
  });
});

describe('CP3 (8) — Reduce Motion', () => {
  it('the PEEK still opens and closes, instantly', async () => {
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
    const { h, view } = await mount('ar');
    await inspect(h, 'THREAD', 'thread-a');
    expect(phaseOf(view)).toBe('PEEK');
    expect(words(view.getByTestId(PERSONAL_PEEK_FAMILY_TEST_ID))).toBe(analysisCopy('ar').family.THREAD);
    await sheetAction(view, 'close');
    expect(phaseOf(view)).toBe('CLOSED');
  });
});
