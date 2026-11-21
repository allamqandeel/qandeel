/**
 * COSMOS E-2 corrections, Slice A — Personal topic identity (Product Owner decisions D-3 / D-4, 2026-11-20; Contract §31).
 *
 * The real `LivingAnalysisMap` over the real bootstrapped runtime: the Personal PEEK names the inspected Thread from the
 * served wire (`DisclosedThread.name`: the person's alias over the grounding wording, else "no name yet") beneath the family
 * word, with the source of the name said plainly; the person renames it through the composition's ONE alias seam (and the
 * ONE coordinator re-reads the disclosure afterwards, so the new name is the server's, not a local echo); "Open where it
 * began" commits the establishing Session Position in this conversation, or asks the ONE switching seam for the other
 * conversation. The sheet still writes nothing on its own; nothing here fabricates a name.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { analysisCopy } from '../../analysis-language';
import { inspectObject, mapInspectionContext, mapProjectionRequest, type MapInspectionContext } from '../../map';
import { disclosureFixture, inspectionFromQuery } from '../../map/__fixtures__/disclosure';
import type { HistoricalSemanticDepth } from '../../projection';
import { resize } from '../../responsive/__fixtures__/composition';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import { effectiveTC } from '../../state';
import { LivingAnalysisMap, PERSONAL_PEEK_FAMILY_TEST_ID, PERSONAL_PEEK_TEST_ID } from '../composition/LivingAnalysisMap';
import { productLocale } from '../locale/product-locale';
import { harness, settle, SESSION_A, SESSION_B, type IntegrationHarness } from '../__fixtures__/integration';

jest.setTimeout(30000);

const hidden = { includeHiddenElements: true } as const;
const LIVE_HEAD = 6;
const STEP = 1_000_000;
/** `thread-a` was established here at SP 2 and carries only its grounding wording; `thread-b` carries the person's own
 * alias and was established in ANOTHER conversation (SESSION_B, SP 3: not established in this Session, as the wire law
 * requires for a foreign origin); `thread-c` has no wording at all. */
const THREADS = [
  { id: 'thread-a', x: '0', y: '0', establishedSp: 2, name: 'مديري', nameSource: 'GROUNDING_WORDING' as const, origin: { sessionId: SESSION_A, sp: 2 } },
  { id: 'thread-b', x: String(STEP / 2), y: '0', establishedSp: null, name: 'My plan', nameSource: 'USER_ALIAS' as const, origin: { sessionId: SESSION_B, sp: 3 } },
  { id: 'thread-c', x: String(STEP), y: '0', establishedSp: 5, name: null },
];

/** What the fixture SERVER has learned from the alias seam (the re-read test below); empty for every other test. */
const learned = new Map<string, string>();
const served = () => THREADS.map((thread) => (learned.has(thread.id) ? { ...thread, name: learned.get(thread.id)!, nameSource: 'USER_ALIAS' as const } : thread));

const projection: Responder = (request) => {
  const params = new URL(request.url).searchParams;
  const depth = (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth;
  const inspection = inspectionFromQuery((name) => params.get(name));
  return {
    status: 200,
    body: disclosureFixture({ depth, sessionId: SESSION_A, tc: Number(params.get('tc') ?? LIVE_HEAD), liveHead: LIVE_HEAD, threads: served(), inspection }),
  };
};

const harnesses: IntegrationHarness[] = [];
afterEach(async () => {
  learned.clear();
  cleanup();
  for (const h of harnesses.splice(0)) h.dispose();
  await settle();
});

const INSETS = { top: 44, bottom: 34, left: 0, right: 0 };

interface Mounted {
  readonly h: IntegrationHarness;
  readonly view: RenderResult;
  readonly onAlias: jest.Mock<Promise<boolean>, [string, string]>;
  readonly onOpenSource: jest.Mock<Promise<'SWITCHED'>, [string, number]>;
}

async function mount(language: 'en' | 'ar' = 'en', withAlias = true): Promise<Mounted> {
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  harnesses.push(h);
  const onAlias = jest.fn<Promise<boolean>, [string, string]>(async () => true);
  const onOpenSource = jest.fn<Promise<'SWITCHED'>, [string, number]>(async () => 'SWITCHED');
  const view = await render(
    <LivingAnalysisMap runtime={h.ready()} locale={productLocale(language, language === 'ar' ? 'RTL' : 'LTR')} insets={INSETS}
        fontScale={1} envelope={{ width: 390, height: 844 }} registerSheetBack={jest.fn()} onAlias={withAlias ? onAlias : undefined} onOpenSource={onOpenSource} />,
  );
  await act(async () => { await settle(); });
  await resize(view, 390, 844, { insetTop: 44, insetBottom: 34 });
  await act(async () => { await settle(); });
  return { h, view, onAlias, onOpenSource };
}

const flush = () => act(async () => { await settle(); });
const words = (node: { props: { children?: unknown } }) => (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;

function context(h: IntegrationHarness): MapInspectionContext {
  const runtime = h.ready();
  const request = mapProjectionRequest(runtime.store.getState());
  if (request === null) throw new Error('no viewpoint');
  const derived = mapInspectionContext(runtime.bundle.projection.lookup(request.sessionId, request.tc, request.depth), request);
  if (!derived.ok) throw new Error('no inspection context');
  return derived.context;
}
async function inspectThread(h: IntegrationHarness, id: string) {
  await act(async () => {
    const outcome = inspectObject(h.ready().store, context(h), { family: 'THREAD', id });
    expect(outcome.outcome).toBe('APPLIED');
    await settle();
  });
  await flush();
}
const peekTexts = (view: RenderResult) => view.getByTestId(PERSONAL_PEEK_TEST_ID, hidden).queryAll((node) => node.type === 'Text').map((node) => words(node));
const projectionReads = (h: IntegrationHarness) => h.http.calls.filter((call) => call.url.includes('/historical-projection')).length;

describe('Slice A (D-3 / D-4) — the Personal PEEK names the Thread from the wire', () => {
  it.each(['en', 'ar'] as const)('%s: the grounding wording, said as the person\'s own words; the alias, said as their choice; no wording, said as no name yet', async (language) => {
    const copy = analysisCopy(language);
    const { h, view } = await mount(language);

    await inspectThread(h, 'thread-a');
    expect(words(view.getByTestId(PERSONAL_PEEK_FAMILY_TEST_ID, hidden))).toBe(copy.family.THREAD);
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name`, hidden))).toBe('مديري');
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-hint`, hidden))).toBe(copy.topicNameFromWords);

    await inspectThread(h, 'thread-b');
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name`, hidden))).toBe('My plan');
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-hint`, hidden))).toBe(copy.topicNameYours);

    await inspectThread(h, 'thread-c');
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name`, hidden))).toBe(copy.topicUnnamed);
    expect(view.queryByTestId(`${PERSONAL_PEEK_TEST_ID}:name-hint`, hidden)).toBeNull();
    // Nothing is invented: the PEEK holds the family word, the name line, T-08's statement and the two acts, no group name.
    expect(peekTexts(view)).toEqual([copy.family.THREAD, copy.topicUnnamed, expect.any(String), copy.goToPlace, copy.nameTopic, copy.openSource]);
  });

  it('the person renames the topic through the ONE alias seam, and the disclosure is re-read, never echoed locally', async () => {
    const copy = analysisCopy('en');
    const { h, view, onAlias } = await mount('en');
    await inspectThread(h, 'thread-a');
    const before = projectionReads(h);

    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)); });
    const field = view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden);
    // The grounding wording is Qandeel's reading of the person's words, not a name they chose: the field starts empty.
    expect(field.props.value).toBe('');
    expect(field.props.maxLength).toBe(60);
    await act(async () => { fireEvent.changeText(field, '  My manager  '); });
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden)); });
    await flush();

    expect(onAlias).toHaveBeenCalledTimes(1);
    expect(onAlias).toHaveBeenCalledWith('thread-a', '  My manager  ');
    // The editor closes, the coordinator asked the server again (the served wording is still what is shown: this fixture
    // never learns the alias, and the PEEK shows the wire, not the draft).
    expect(view.queryByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden)).toBeNull();
    expect(projectionReads(h)).toBeGreaterThan(before);
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name`, hidden))).toBe('مديري');
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-hint`, hidden))).toBe(copy.topicNameFromWords);

    // The person's own alias IS prefilled, so a rename starts from their words.
    await inspectThread(h, 'thread-b');
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)); });
    expect(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden).props.value).toBe('My plan');
  });

  it('HONOR acceptance (DEFECT-4): with the keyboard open, a tap on Save reaches Save — every scroller around the editor keeps handled taps', async () => {
    const { h, view } = await mount('en');
    await inspectThread(h, 'thread-a');
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)); });
    const scrollers: unknown[] = [];
    for (let node = view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden).parent; node !== null; node = node.parent) {
      if (node.props.onContentSizeChange !== undefined) scrollers.push(node.props.keyboardShouldPersistTaps);
    }
    expect(scrollers.length).toBeGreaterThan(0);
    expect(scrollers.every((value) => value === 'handled' || value === 'always')).toBe(true);
  });

  it('HONOR acceptance (DEFECT-4, R2): closing the editor closes the keyboard — after a kept Save and after Cancel, never after a refusal', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    try {
      const { h, view, onAlias } = await mount('en');
      onAlias.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      await inspectThread(h, 'thread-a');
      await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)); });
      await act(async () => { fireEvent.changeText(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden), 'Mama'); });
      await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden)); });
      await flush();
      expect(dismiss).not.toHaveBeenCalled(); // refused: the editor stays open, so does the keyboard
      await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden)); });
      await flush();
      expect(view.queryByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden)).toBeNull();
      expect(dismiss).toHaveBeenCalledTimes(1);
      await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)); });
      await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-cancel`, hidden)); });
      expect(dismiss).toHaveBeenCalledTimes(2);
    } finally {
      dismiss.mockRestore();
    }
  });

  it('HONOR acceptance: once the server holds the alias, the PEEK itself shows it (the inspected viewpoint is re-read too)', async () => {
    const copy = analysisCopy('en');
    const { h, view, onAlias } = await mount('en');
    onAlias.mockImplementation(async (threadId, alias) => { learned.set(threadId, alias.trim()); return true; });
    await inspectThread(h, 'thread-a');
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name`, hidden))).toBe('مديري');

    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)); });
    await act(async () => { fireEvent.changeText(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden), 'Mama health checks'); });
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden)); });
    await flush();

    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name`, hidden))).toBe('Mama health checks');
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-hint`, hidden))).toBe(copy.topicNameYours);
    // The inspected request (the one carrying the inspection) was asked again, not only the plain rungs.
    expect(h.http.calls.filter((call) => call.url.includes('/historical-projection') && call.url.includes('inspect')).length).toBeGreaterThan(1);
  });

  it('a refused alias keeps the editor open and marks it; a blank draft cannot be saved; Cancel restores the served name', async () => {
    const { h, view, onAlias } = await mount('en');
    onAlias.mockResolvedValueOnce(false);
    await inspectThread(h, 'thread-a');
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)); });
    await act(async () => { fireEvent.changeText(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden), 'x'); });
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden)); });
    await flush();
    expect(onAlias).toHaveBeenCalledTimes(1);
    expect(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden)).toBeTruthy();

    await act(async () => { fireEvent.changeText(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden), '   '); });
    expect(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden).props.accessibilityState?.disabled ?? view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden).props.disabled).toBe(true);
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-save`, hidden)); });
    expect(onAlias).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-cancel`, hidden)); });
    expect(view.queryByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden)).toBeNull();
    expect(words(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name`, hidden))).toBe('مديري');
  });

  it('without an alias seam there is no Name this topic, and the rest of the PEEK is unchanged', async () => {
    const { h, view } = await mount('en', false);
    await inspectThread(h, 'thread-a');
    expect(view.queryByTestId(`${PERSONAL_PEEK_TEST_ID}:name-edit`, hidden)).toBeNull();
    expect(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:source`, hidden)).toBeTruthy();
  });
});

describe('Slice A (D-3) — Open where it began', () => {
  it('in this conversation it commits the establishing Session Position through the kernel (no switch is asked)', async () => {
    const { h, view, onOpenSource } = await mount('en');
    await inspectThread(h, 'thread-a');
    expect(effectiveTC(h.ready().store.getState())).toBe(LIVE_HEAD);
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:source`, hidden)); });
    await flush();
    expect(effectiveTC(h.ready().store.getState())).toBe(2);
    expect(onOpenSource).not.toHaveBeenCalled();
  });

  it('in another conversation it asks the ONE switching seam for that Session at that position, and moves nothing here', async () => {
    const { h, view, onOpenSource } = await mount('en');
    await inspectThread(h, 'thread-b');
    await act(async () => { fireEvent.press(view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:source`, hidden)); });
    await flush();
    expect(onOpenSource).toHaveBeenCalledTimes(1);
    expect(onOpenSource).toHaveBeenCalledWith(SESSION_B, 3);
    expect(effectiveTC(h.ready().store.getState())).toBe(LIVE_HEAD);
    expect(h.ready().bundle.sessionId).toBe(SESSION_A);
  });
});
