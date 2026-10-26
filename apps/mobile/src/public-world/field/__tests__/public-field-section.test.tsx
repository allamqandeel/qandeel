/**
 * S8A-05 CP1 R2 — the reader's view of ONE section of the Public field (WP1 §2.5): the reader's own choice from one small
 * control; the topics outside it recede (nothing leaves the field, nothing moves); a search runs inside it with «في: …»
 * and a way back to every section; the topics of that section nearest the centre are listed by distance alone; Back
 * closes the list first and releases the section last. Synthetic fixtures only.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import { viewportEnvelope } from '../../../map/camera';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import { resize } from '../../../responsive/__fixtures__/composition';
import { fillCompose, publicComposeCopy } from '../../../public-compose/copy';
import type { PublicAuthoringAnswer, PublicFieldEntry, PublicTopicSection } from '../../../runtime-entry';
import { PUBLIC_TOPIC_SECTIONS } from '../../../runtime-entry';
import { createPublicWorldController } from '../../public-world-controller';
import { PublicWorldArea } from '../../PublicWorldArea';
import { focusField, nearestOf, wholeWorldCamera, zoomField } from '../public-field-camera';
import { createPublicFieldController, type PublicFieldTransport } from '../public-field-controller';
import { placePublicField } from '../public-field-projection';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const SIZE = { width: 400, height: 800 };
const GLASS = viewportEnvelope(SIZE.width, SIZE.height)!;
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const topic = (n: number, x: bigint, y: bigint, section?: PublicTopicSection, title?: string): PublicFieldEntry =>
  ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region: 'family.fear', ...(title ? { title } : {}), ...(section ? { section } : {}) });
const P1 = topic(1, 10_000n, 0n, 'parenting', 'كيف أتعامل مع ابني المراهق');
const P2 = topic(2, 900_000n, 0n, 'parenting', 'أول يوم في المدرسة');
const P3 = topic(3, 40_000n, 0n, 'parenting', 'النوم بعد الولادة');
const P4 = topic(4, 20_000n, 0n, 'parenting', 'حين يكبر الأبناء');
const F1 = topic(5, 5_000n, 0n, 'family', 'بيت العائلة');
const OLD = topic(6, 30_000n, 0n);
const ALL = [P1, P2, P3, P4, F1, OLD];

function transport(entries: PublicFieldEntry[] = ALL) {
  return {
    field: jest.fn(async () => yes(entries)),
    search: jest.fn(async (_q: string, section?: PublicTopicSection) => yes(entries.filter((e) => section === undefined || e.section === section))),
    experience: jest.fn(async () => yes({ kind: 'ABSENT' as const })),
  };
}

afterEach(() => { cleanup(); });

describe('S8A-05 CP1 R2 — the section view in the projection', () => {
  it('outside the chosen section a topic recedes at every rung; inside, disclosure is unchanged; a result or the focus stays a place', () => {
    const presence = (camera: ReturnType<typeof wholeWorldCamera>, section: PublicTopicSection | null, results: PublicFieldEntry[] = [], focusId: string | null = null) =>
      placePublicField({ camera, envelope: GLASS, entries: [P1, F1, OLD], results, focusId, section }).nodes.map((n) => n.presence);
    const far = wholeWorldCamera();
    const mid = zoomField(far, 'IN');
    if (mid.outcome !== 'MOVED') throw new Error('FAR steps in');
    expect(presence(far, null)).toEqual(['FIELD', 'FIELD', 'FIELD']);
    expect(presence(far, 'parenting')).toEqual(['FIELD', 'RECEDED', 'RECEDED']);
    expect(presence(mid.camera, 'parenting')).toEqual(['PLACE', 'RECEDED', 'RECEDED']);
    expect(presence(focusField(P1.address), 'parenting', [], P1.id)).toEqual(['PLACE', 'RECEDED', 'RECEDED']);
    // Nothing leaves the field: every topic is still projected.
    expect(placePublicField({ camera: far, envelope: GLASS, entries: ALL, results: [], focusId: null, section: 'love' }).nodes).toHaveLength(ALL.length);
    // A search result the reader asked for is a place even outside the section.
    expect(presence(far, 'parenting', [F1])).toEqual(['FIELD', 'PLACE', 'RECEDED']);
  });

  it('nearest is by distance alone, ties by id', () => {
    expect(nearestOf(at(0n, 0n), [P2, P3, P1, P4], 3)).toEqual([P1.id, P4.id, P3.id]);
    expect(nearestOf(at(0n, 0n), [topic(9, 1n, 0n), topic(8, -1n, 0n)], 2)).toEqual([id(8), id(9)]);
  });
});

describe('S8A-05 CP1 R2 — the section view in the controller', () => {
  const enter = async (t = transport()) => {
    const c = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true });
    c.setEnvelope(GLASS);
    c.enter();
    await flush();
    return { c, t };
  };

  it('starts from every section; choosing closes the list; an open search asks again inside the new section', async () => {
    const { c, t } = await enter();
    expect(c.getState().section).toEqual({ key: null, choosing: false });
    c.openSearch();
    c.search('المدرسة');
    await flush();
    expect(t.search).toHaveBeenLastCalledWith('المدرسة');
    c.openSections();
    expect(c.getState().section.choosing).toBe(true);
    c.chooseSection('parenting');
    await flush();
    expect(c.getState().section).toEqual({ key: 'parenting', choosing: false });
    expect(t.search).toHaveBeenLastCalledWith('المدرسة', 'parenting');
    expect(c.getState().search.results.map((e) => e.id)).toEqual([P1.id, P2.id, P3.id, P4.id]);
    // The same section again asks nothing new.
    const calls = t.search.mock.calls.length;
    c.chooseSection('parenting');
    await flush();
    expect(t.search.mock.calls).toHaveLength(calls);
    c.chooseSection(null);
    await flush();
    expect(t.search).toHaveBeenLastCalledWith('المدرسة');
  });

  it('Back closes the list first, then the search, then releases the section; a later entry starts from every section', async () => {
    const { c } = await enter();
    c.openSections();
    c.chooseSection('family');
    c.openSearch();
    c.openSections();
    expect(c.back()).toBe(true);
    expect(c.getState().section).toEqual({ key: 'family', choosing: false });
    expect(c.back()).toBe(true);
    expect(c.getState().search.open).toBe(false);
    expect(c.getState().section.key).toBe('family');
    expect(c.back()).toBe(true);
    expect(c.getState().section.key).toBeNull();
    expect(c.back()).toBe(false);
    c.chooseSection('love');
    c.enter();
    await flush();
    expect(c.getState().section).toEqual({ key: null, choosing: false });
  });
});

const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

async function mountArea(language: 'ar' | 'en', t = transport()) {
  const field = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true });
  const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, field });
  const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  for (let n = 0; n < 4; n += 1) await flush();
  await resize(view, SIZE.width, SIZE.height, { mapHeight: SIZE.height });
  await flush();
  return { view, field, t };
}

describe.each(['ar', 'en'] as const)('S8A-05 CP1 R2 %s — the section view on the surface', (language) => {
  const words = publicComposeCopy(language);

  it('one control names the section shown and opens the list: every section, in the catalogue order, names only', async () => {
    const { view, field } = await mountArea(language);
    const control = view.getByTestId('qandeel-public-section-control');
    expect(control.props.accessibilityLabel).toBe(fillCompose(words.sectionShown, words.allSections));
    await fireEvent.press(control);
    const list = view.getByTestId('qandeel-public-sections');
    expect(list).toBeTruthy();
    expect(view.getByTestId('qandeel-public-section-all').props.accessibilityState.checked).toBe(true);
    for (const key of PUBLIC_TOPIC_SECTIONS) expect(view.getByTestId(`qandeel-public-section-${key}`).props.accessibilityLabel).toBe(words.section(key));
    await fireEvent.press(view.getByTestId('qandeel-public-section-parenting'));
    expect(view.queryByTestId('qandeel-public-sections')).toBeNull();
    expect(field.getState().section.key).toBe('parenting');
    expect(view.getByTestId('qandeel-public-section-control').props.accessibilityLabel).toBe(fillCompose(words.sectionShown, words.section('parenting')));
  });

  it('lists the three topics of the section nearest the centre, by title; pressing one focuses it', async () => {
    const { view, field } = await mountArea(language);
    await act(async () => { field.chooseSection('parenting'); });
    await flush();
    const near = view.getByTestId('qandeel-public-section-near');
    expect(near).toBeTruthy();
    expect(view.getByText(words.sectionNear)).toBeTruthy();
    expect([P1, P4, P3].map((e) => view.getByTestId(`qandeel-public-section-near-${e.id}`).props.accessibilityLabel)).toEqual([P1.title, P4.title, P3.title]);
    expect(view.queryByTestId(`qandeel-public-section-near-${P2.id}`)).toBeNull();
    expect(view.queryByTestId(`qandeel-public-section-near-${F1.id}`)).toBeNull();
    await fireEvent.press(view.getByTestId(`qandeel-public-section-near-${P1.id}`));
    await flush();
    expect(field.getState().focus?.id).toBe(P1.id);
  });

  it('says honestly when the section has no topic here', async () => {
    const { view, field } = await mountArea(language);
    await act(async () => { field.chooseSection('love'); });
    await flush();
    expect(view.getByText(words.sectionNoneHere)).toBeTruthy();
  });

  it('a search inside the section says where it searches, and one press searches every section again', async () => {
    const { view, field, t } = await mountArea(language);
    await act(async () => { field.chooseSection('family'); field.openSearch(); field.search('البيت'); });
    await flush();
    expect(t.search).toHaveBeenLastCalledWith('البيت', 'family');
    expect(view.getByText(fillCompose(words.inSection, words.section('family')))).toBeTruthy();
    // While the search is open the section control gives way to the search; the scope names the section instead.
    expect(view.queryByTestId('qandeel-public-section-control')).toBeNull();
    await fireEvent.press(view.getByTestId('qandeel-public-search-scope-clear'));
    await flush();
    expect(field.getState().section.key).toBeNull();
    expect(t.search).toHaveBeenLastCalledWith('البيت');
    expect(view.queryByTestId('qandeel-public-search-scope')).toBeNull();
  });
});
