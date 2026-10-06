/**
 * S5-03B — the Public semantic field: its own camera (FAR / MID / NEAR over exact world primitives), its viewer-local
 * controller (served Experiences only, focus + panel, search over the same field, local Back, nothing inherited), its
 * surface (field as hero, no relation line, no rank, an honest empty World), the strict client, the authoring place
 * stage and the S5-03B Product Copy Gate census.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import {
  createPublicAuthoringController, type PublicAuthoringTransport, type PublicSemanticTransport, type PublicSpatialTransport,
} from '../../../public-authoring/public-authoring-controller';
import { PublicPlacePreparation } from '../../../public-authoring/PublicPlacePreparation';
import { CANONICAL_VISUAL } from '../../../conversation/visual/canonical-visual.generated';
import type { PublicAuthoringAnswer, PublicFieldEntry, PublicFieldPanel } from '../../../runtime-entry';
import { PublicWorldApiClient } from '../../../runtime-entry';
import { PUBLIC_FIELD_COPY_GATE, publicFieldCopy } from '../field-copy';
import { createPublicWorldController } from '../../public-world-controller';
import { PublicWorldArea } from '../../PublicWorldArea';
import { fittedCamera, focusField, panField, projectToField, zoomField } from '../public-field-camera';
import { createPublicFieldController, type PublicFieldTransport } from '../public-field-controller';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const SIZE = { width: 400, height: 800 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const NO = { kind: 'NO_ANSWER' as const };
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const entry = (n: number, x: bigint, y: bigint, region = 'family.fear'): PublicFieldEntry =>
  ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region });
const E1 = entry(1, 1_000_000n, 2_000_000n);
const E2 = entry(2, 1_200_000n, 2_100_000n);
const E3 = entry(3, -40_000_000n, 9_000_000n, 'hope.waiting');
const served = (e: PublicFieldEntry, nearby: PublicFieldEntry[] = []): PublicFieldPanel => ({ kind: 'SERVED', experience: {
  entry: e, primaryThemes: ['fear'], secondaryThemes: ['work'], publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' },
  content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the public words' }, { ordinal: 2, kind: 'ANALYSIS', text: 'what QANDEEL read' }], nearby,
} });

function fieldTransport(entries: PublicFieldEntry[] = [E1, E2, E3], panel: (experienceId: string) => PublicFieldPanel = (x) => served([E1, E2, E3].find((e) => e.id === x)!, [E2])) {
  return {
    field: jest.fn(async () => yes(entries)),
    search: jest.fn(async (q: string) => yes(q === 'nothing' ? [] : [E3])),
    experience: jest.fn(async (experienceId: string) => yes(panel(experienceId))),
  };
}
const controllerOf = (t = fieldTransport()) => {
  const c = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true });
  return { c, t };
};

afterEach(cleanup);

describe('S5-03B — the Public camera: exact world primitives, Public disclosure only', () => {
  it('frames the World from the places alone, at FAR, and projects with the Map orientation (+y up)', () => {
    const camera = fittedCamera([E1.address, E2.address, E3.address], SIZE);
    expect(camera.depth).toBe('FAR');
    for (const e of [E1, E2, E3]) {
      const p = projectToField(camera, SIZE, e.address)!;
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(SIZE.width);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(SIZE.height);
    }
    expect(projectToField(camera, SIZE, E3.address)!.y).toBeLessThan(projectToField(camera, SIZE, E1.address)!.y);
  });

  it('steps FAR → MID → NEAR by the frozen ×8 reinforcement; NEAR is focus; OUT releases it; boundaries are no act', () => {
    const far = fittedCamera([E1.address, E3.address], SIZE);
    const mid = zoomField(far, 'IN');
    expect(mid.outcome).toBe('MOVED');
    if (mid.outcome !== 'MOVED') return;
    expect(mid.camera.depth).toBe('MID');
    expect(mid.camera.scale.numerator * far.scale.denominator * 8n).toBe(far.scale.numerator * mid.camera.scale.denominator);
    expect(zoomField(mid.camera, 'IN').outcome).toBe('AT_BOUNDARY');
    const near = zoomField(mid.camera, 'IN', E1.address);
    expect(near.outcome === 'MOVED' && near.camera.depth === 'NEAR' && near.camera.anchor === E1.address).toBe(true);
    expect(zoomField(far, 'OUT').outcome).toBe('AT_BOUNDARY');
    expect(focusField(far, E3.address)).toMatchObject({ depth: 'NEAR', anchor: E3.address });
  });

  it('pans against the content and refuses the canonical bound; a jitter is no movement', () => {
    const far = fittedCamera([E1.address], SIZE);
    const moved = panField(far, 100, 0);
    expect(moved.outcome === 'MOVED' && moved.camera.anchor.x < far.anchor.x).toBe(true);
    expect(panField(far, 0.00001, 0).outcome).toBe('NO_MOVEMENT');
    expect(panField(far, Number.NaN, 0).outcome).toBe('INVALID_INPUT');
  });
});

describe('S5-03B — the Public field controller', () => {
  it('enters from the whole World, frames it, and inherits nothing on a later entry', async () => {
    const { c, t } = controllerOf();
    c.setSize(SIZE.width, SIZE.height);
    c.enter();
    await flush();
    expect(t.field).toHaveBeenCalledWith({ minX: -(2n ** 62n), minY: -(2n ** 62n), maxX: 2n ** 62n - 1n, maxY: 2n ** 62n - 1n });
    expect(c.getState()).toMatchObject({ status: 'READY', focus: null });
    expect(c.getState().camera?.depth).toBe('FAR');
    c.focus(E1.id);
    c.openSearch();
    await flush();
    expect(c.getState().focus?.id).toBe(E1.id);
    c.enter();
    await flush();
    expect(c.getState()).toMatchObject({ focus: null, search: { open: false } });
    expect(c.getState().camera?.depth).toBe('FAR');
  });

  it('FAR → MID by a tap or a step; MID → NEAR focuses the place nearest the centre and opens its panel', async () => {
    const { c, t } = controllerOf();
    c.setSize(SIZE.width, SIZE.height);
    c.enter();
    await flush();
    const far = c.getState().camera!;
    const p = projectToField(far, SIZE, E1.address)!;
    c.tapField(p.x, p.y);
    expect(c.getState().camera?.depth).toBe('MID');
    c.closer();
    await flush();
    expect(c.getState().camera?.depth).toBe('NEAR');
    expect(c.getState().focus).toMatchObject({ id: E1.id, panel: { status: 'SERVED' } });
    expect(t.experience).toHaveBeenCalledWith(E1.id);
    c.farther();
    expect(c.getState()).toMatchObject({ focus: null });
    expect(c.getState().camera?.depth).toBe('MID');
  });

  it('a focused Experience the server no longer serves leaves the field at once — no tombstone', async () => {
    const { c } = controllerOf(fieldTransport([E1, E2, E3], () => ({ kind: 'ABSENT' })));
    c.setSize(SIZE.width, SIZE.height);
    c.enter();
    await flush();
    c.focus(E2.id);
    await flush();
    expect(c.getState().focus).toMatchObject({ id: E2.id, panel: { status: 'ABSENT' } });
    expect(c.getState().entries.map((e) => e.id)).not.toContain(E2.id);
  });

  it('search stays in the same field: results are places; picking one guides the camera there; Back is local', async () => {
    const { c, t } = controllerOf();
    c.setSize(SIZE.width, SIZE.height);
    c.enter();
    await flush();
    c.openSearch();
    c.search('  hope  ');
    await flush();
    expect(t.search).toHaveBeenCalledWith('hope');
    expect(c.getState().search).toMatchObject({ open: true, status: 'RESULTS' });
    c.focus(E3.id);
    await flush();
    expect(c.getState().camera?.anchor).toBe(E3.address);
    expect(c.back()).toBe(true);
    expect(c.getState().focus).toBeNull();
    expect(c.back()).toBe(true);
    expect(c.getState().search.open).toBe(false);
    expect(c.back()).toBe(false);
    c.search('nothing');
    await flush();
    expect(c.getState().search.status).toBe('NONE');
  });

  it('an unavailable field is one honest state; a retired controller publishes nothing', async () => {
    const t = { field: jest.fn(async () => NO), search: jest.fn(), experience: jest.fn() };
    const c = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true });
    c.enter();
    await flush();
    expect(c.getState().status).toBe('UNAVAILABLE');
    c.retire();
    c.openSearch();
    expect(c.getState().search.open).toBe(false);
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

async function mountArea(language: 'ar' | 'en', entries: PublicFieldEntry[]) {
  const t = fieldTransport(entries);
  const field = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true });
  const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, field });
  const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  for (let n = 0; n < 4; n += 1) await flush();
  await fireEvent(view.getByTestId('qandeel-public-field'), 'layout', { nativeEvent: { layout: SIZE } });
  await flush();
  return { view, field, t };
}

describe('S5-03B — the Public field surface', () => {
  it.each(['ar', 'en'] as const)('an empty World is shown as empty, with nothing standing in for it (%s)', async (language) => {
    const { view } = await mountArea(language, []);
    expect(view.getByTestId('qandeel-public-field-empty').props.children).toBe(publicFieldCopy(language).empty);
    expect(view.queryByTestId(/qandeel-public-mark/u, { includeHiddenElements: true })).toBeNull();
  });

  it('FAR is mass (no label, no target); MID makes each Experience legible; NEAR opens the compact panel', async () => {
    const { view, field } = await mountArea('en', [E1, E2, E3]);
    expect(view.getByTestId(`qandeel-public-mark-far-${E1.id}`, { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByText('meaning 1')).toBeNull();
    expect(view.queryByTestId(`qandeel-public-mark-${E1.id}`)).toBeNull();
    const far = field.getState().camera!;
    const p = projectToField(far, SIZE, E1.address)!;
    await act(async () => { field.tapField(p.x, p.y); });
    await flush();
    expect(view.getByTestId(`qandeel-public-mark-${E1.id}`).props.accessibilityLabel).toBe('meaning 1');
    await fireEvent.press(view.getByTestId(`qandeel-public-mark-${E1.id}`));
    await flush();
    const copy = publicFieldCopy('en');
    expect(view.getByTestId('qandeel-public-panel-meaning').props.children).toBe('meaning 1');
    expect(view.getByText('Shared by nightlamp27')).toBeTruthy();
    expect(view.getByText(copy.primaryHeading)).toBeTruthy();
    expect(view.getByText(copy.analysisItem)).toBeTruthy();
    expect(view.getByText(copy.nearHeading)).toBeTruthy();
    expect(view.getByTestId(`qandeel-public-nearby-${E2.id}`)).toBeTruthy();
    expect(view.queryByText(/view|rank|popular|trending/iu)).toBeNull();
    await fireEvent.press(view.getByTestId('qandeel-public-panel-back'));
    await flush();
    expect(view.queryByTestId('qandeel-public-panel')).toBeNull();
  });

  it('registers Back only while the panel or the search is open — never at the World\'s root', async () => {
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    const { view, field } = await mountArea('ar', [E1, E2, E3]);
    expect(spy).not.toHaveBeenCalled();
    await fireEvent(view.getByTestId('qandeel-public-search'), 'focus');
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(field.getState().search.open).toBe(true);
    spy.mockRestore();
  });

  it('search results are drawn in the same field and as a compact list — never a feed', async () => {
    const { view } = await mountArea('en', [E1, E2]);
    await fireEvent(view.getByTestId('qandeel-public-search'), 'focus');
    await fireEvent.changeText(view.getByTestId('qandeel-public-search'), 'hope');
    await fireEvent(view.getByTestId('qandeel-public-search'), 'submitEditing');
    await flush();
    expect(view.getByTestId(`qandeel-public-search-result-${E3.id}`)).toBeTruthy();
    await fireEvent.press(view.getByTestId(`qandeel-public-search-result-${E3.id}`));
    await flush();
    expect(view.getByTestId(`qandeel-public-mark-${E3.id}`).props.accessibilityState).toEqual({ selected: true });
    expect(view.getByTestId('qandeel-public-panel-meaning').props.children).toBe('meaning 3');
  });
});

describe('S5-03B — the strict client', () => {
  const client = (body: unknown, ok = true) => {
    const fetch = jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }));
    return { api: new PublicWorldApiClient({ baseUrl: 'https://api.test', fetch: fetch as never }), fetch };
  };
  const wire = { id: id(1), x: '-4611686018427387904', y: '4611686018427387903', meaning: 'm', region: 'r' };

  it('decodes places as exact integers — never through a float — and refuses anything else', async () => {
    const { api, fetch } = client({ experiences: [wire] });
    const answer = await api.field.field({ minX: -1n, minY: -2n, maxX: 3n, maxY: 4n });
    expect(answer.kind === 'ANSWER' && answer.value[0].address.x === -(2n ** 62n) && answer.value[0].address.y === 2n ** 62n - 1n).toBe(true);
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://api.test/public/field?minX=-1&minY=-2&maxX=3&maxY=4');
    for (const bad of [{ ...wire, x: 1 }, { ...wire, x: '1.5' }, { ...wire, x: '4611686018427387904' }, { ...wire, rank: 1 }, { ...wire, id: 'x' }]) {
      expect((await client({ experiences: [bad] }).api.field.field({ minX: 0n, minY: 0n, maxX: 1n, maxY: 1n })).kind).toBe('NO_ANSWER');
    }
    expect((await client({ experiences: Array.from({ length: 401 }, () => wire) }).api.field.field({ minX: 0n, minY: 0n, maxX: 1n, maxY: 1n })).kind).toBe('NO_ANSWER');
    expect(await client({ state: 'UNAVAILABLE' }).api.field.experience(id(1))).toEqual({ kind: 'ANSWER', value: { kind: 'ABSENT' } });
  });

  it('the place request sends exactly { commandId }: never a place, a region, a rank or a model', async () => {
    const { api, fetch } = client({ outcome: 'PLACED' });
    expect(await api.spatial.prepare(id(2), id(9))).toEqual({ kind: 'ANSWER', value: 'PLACED' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect([url, init.method, JSON.parse(init.body)]).toEqual(['https://api.test/public/authoring/drafts/' + id(2) + '/place', 'POST', { commandId: id(9) }]);
  });
});

describe('S5-03B — the authoring place stage', () => {
  it('appears only once the understanding is ready, says where it never is, and asks with one command', async () => {
    const review = { state: 'CURRENT', lifecycle: 'READY_FOR_REVIEW', manifestId: id(3), publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, itemCount: 1,
      requiredApprovals: 1, effectiveApprovals: 1, ownApproval: 'EFFECTIVE', readyAllowed: false, items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'w' }] };
    let place: 'NOT_PLACED' | 'PLACED' = 'NOT_PLACED';
    const authoring = { drafts: jest.fn(async () => yes([])), approvalRequests: jest.fn(async () => yes([])), review: jest.fn(async () => yes(review)) };
    const semantic = { semanticReview: jest.fn(async () => yes({ state: 'REVIEWED', interpretationId: id(4), revision: 1, origin: 'QANDEEL', meaning: 'm',
      primaryThemes: ['fear'], secondaryThemes: [], explanation: 'e', decision: 'ACCEPTED', ready: true })) };
    const spatial = { preparation: jest.fn(async () => yes(place)), prepare: jest.fn(async () => { place = 'PLACED'; return yes('PLACED' as const); }) };
    const controller = createPublicAuthoringController({ transport: authoring as unknown as PublicAuthoringTransport,
      semantic: semantic as unknown as PublicSemanticTransport, spatial: spatial as unknown as PublicSpatialTransport, isCurrent: () => true,
      newCommandId: () => id(77) });
    controller.open();
    await flush();
    controller.openDraft(id(2));
    await flush();
    expect(controller.getState().place).toBe('NOT_PLACED');
    controller.preparePlace();
    await flush();
    expect(spatial.prepare).toHaveBeenCalledWith(id(2), id(77));
    expect(controller.getState().place).toBe('PLACED');
  });
});

describe('S5-03B — the place section', () => {
  const palette = CANONICAL_VISUAL.palettes.DARK.standard;
  const draw = async (place: 'NOT_PLACED' | 'PLACED' | 'NOT_SEMANTICALLY_READY', language: 'ar' | 'en', onPrepare = jest.fn()) => {
    const view = await render(<PublicPlacePreparation place={place} palette={palette} language={language} busy={false} onPrepare={onPrepare} />);
    await flush();
    return view;
  };
  it.each(['ar', 'en'] as const)('asks QANDEEL, from meaning alone (%s)', async (language) => {
    const onPrepare = jest.fn();
    const view = await draw('NOT_PLACED', language, onPrepare);
    expect(view.getByText(publicFieldCopy(language).placeExplain)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-public-place-ask'));
    expect(onPrepare).toHaveBeenCalledTimes(1);
  });
  it.each(['ar', 'en'] as const)('says the place is ready — never where, never published (%s)', async (language) => {
    const view = await draw('PLACED', language);
    expect(view.getByTestId('qandeel-public-place-ready').props.children).toBe(publicFieldCopy(language).placeReady);
    expect(view.queryByTestId('qandeel-public-place-ask')).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toMatch(/Published|[0-9]{6,}/u);
  });
  it('is not drawn before the understanding is ready', async () => {
    const view = await draw('NOT_SEMANTICALLY_READY', 'en');
    expect(view.toJSON()).toBeNull();
  });
});

describe('S5-03B — isolation and the Product Copy Gate', () => {
  const dir = join(__dirname, '..');
  const code = (file: string) => readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
  const files = readdirSync(dir).filter((f) => /\.tsx?$/u.test(f));

  it('holds nothing of the Personal or Shared world, draws no relation line, ranks nothing, and carries no Arabic literal', () => {
    for (const file of files) {
      const text = code(file);
      expect(text).not.toMatch(/from '\.\.\/\.\.\/state'|CanonicalStore|SemanticDepth|Session|Thread|EMERGING_FOCUS|READING|temporal|shared-world\/(?!copy)|useMapPanGesture|useMapSemanticZoomGesture/u);
      expect(text).not.toMatch(/relation|edge|Line\b|<Path|Svg|viewCount|rank|popular|trending/iu);
      expect(text).not.toMatch(/withTiming|withSpring|Animated\./u);
      if (file !== 'field-copy.ts') expect(text).not.toMatch(/['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u);
      expect(text).not.toMatch(/publish_|'PUBLISHED'|s5-03a\.private|S5-03A_PRIVATE/u);
    }
  });

  it('one S5-03B gate, OPEN: every new row PROPOSED in both languages; frozen words reused byte-exact', () => {
    expect(PUBLIC_FIELD_COPY_GATE.status).toBe('S5-03B PRODUCT COPY GATE — OPEN — 16 rows PROPOSED');
    expect(PUBLIC_FIELD_COPY_GATE.proposed).toHaveLength(16);
    expect(PUBLIC_FIELD_COPY_GATE.approved).toEqual([]);
    const source = readFileSync(join(dir, 'field-copy.ts'), 'utf8');
    expect(source.match(/\/\/ PROPOSED — S5-03B Product Copy Gate/gu)).toHaveLength(32);
    for (const language of ['ar', 'en'] as const) {
      const copy = publicFieldCopy(language);
      for (const key of PUBLIC_FIELD_COPY_GATE.proposed) expect(copy[key].length).toBeGreaterThan(0);
      expect(JSON.stringify(copy)).not.toMatch(/coordinate|إحداثي|rank|popular|views|lens/iu);
    }
    expect(publicFieldCopy('ar').back).toBe('رجوع');
    expect(publicFieldCopy('en').analysisItem).toBe('QANDEEL analysis');
  });
});
