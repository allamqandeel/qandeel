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
import { hsla } from '../../../map/visual';
import { WORLD_VISUAL } from '../../../map/visual/world-visual.generated';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import { PUBLIC_FIELD_WORLD_TEST_ID } from '../PublicFieldWorld';
import {
  createPublicAuthoringController, type PublicAuthoringTransport, type PublicSemanticTransport, type PublicSpatialTransport,
} from '../../../public-authoring/public-authoring-controller';
import { PublicPlacePreparation } from '../../../public-authoring/PublicPlacePreparation';
import { CANONICAL_VISUAL } from '../../../conversation/visual/canonical-visual.generated';
import type { PublicAuthoringAnswer, PublicFieldEntry, PublicFieldPanel } from '../../../runtime-entry';
import { PublicWorldApiClient, createManualForegroundSignal, type ForegroundSignal } from '../../../runtime-entry';
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

/**
 * An honest server whose visibility can change between reads: it serves, inside a rectangle, exactly the Experiences
 * that are publicly visible NOW; its search and panel answer from the same truth.
 */
function liveServer(initial: PublicFieldEntry[]) {
  let visible = [...initial];
  const inside = (r: { minX: bigint; minY: bigint; maxX: bigint; maxY: bigint }, e: PublicFieldEntry) =>
    e.address.x >= r.minX && e.address.x <= r.maxX && e.address.y >= r.minY && e.address.y <= r.maxY;
  const t = {
    field: jest.fn(async (r: { minX: bigint; minY: bigint; maxX: bigint; maxY: bigint }) => yes(visible.filter((e) => inside(r, e)))),
    search: jest.fn(async () => yes(visible.filter((e) => e.id === E3.id || e.id === E2.id))),
    experience: jest.fn(async (experienceId: string): Promise<PublicAuthoringAnswer<PublicFieldPanel>> => {
      const e = visible.find((x) => x.id === experienceId);
      return e ? yes(served(e, visible.filter((x) => x.id !== e.id && x.region === e.region))) : yes({ kind: 'ABSENT' });
    }),
  };
  return { t, stop: (gone: PublicFieldEntry) => { visible = visible.filter((e) => e.id !== gone.id); }, fail: () => { t.field.mockImplementation(async () => NO as never); } };
}
const ids = (entries: ReadonlyArray<PublicFieldEntry>) => entries.map((e) => e.id);

describe('S5-03B R1 — no cache is a source of display: every transition that could show the World asks again', () => {
  const start = async (entries = [E1, E2, E3]) => {
    const server = liveServer(entries);
    const c = createPublicFieldController({ transport: server.t as unknown as PublicFieldTransport, isCurrent: () => true });
    c.setSize(SIZE.width, SIZE.height);
    c.enter();
    await flush();
    expect(ids(c.getState().entries)).toEqual([E1.id, E2.id, E3.id]);
    return { c, server };
  };

  it('the whole World is read again — never re-framed from what is held — and a withdrawn Experience is gone', async () => {
    const { c, server } = await start();
    c.focus(E1.id);
    await flush();
    server.stop(E2);
    const reads = server.t.field.mock.calls.length;
    c.wholeWorld();
    // In flight: nothing held is on display.
    expect(c.getState()).toMatchObject({ status: 'LOADING', entries: [], focus: null });
    await flush();
    expect(server.t.field.mock.calls.length).toBe(reads + 1);
    expect(server.t.field).toHaveBeenLastCalledWith({ minX: -(2n ** 62n), minY: -(2n ** 62n), maxX: 2n ** 62n - 1n, maxY: 2n ** 62n - 1n });
    expect(c.getState().status).toBe('READY');
    expect(ids(c.getState().entries)).toEqual([E1.id, E3.id]);
    expect(c.getState().camera).toEqual(fittedCamera([E1.address, E3.address], SIZE));
  });

  it('FAR navigation asks again and cannot bring a no-longer-served Experience back from an earlier read', async () => {
    const { c, server } = await start();
    expect(c.getState().camera?.depth).toBe('FAR');
    server.stop(E3);
    const reads = server.t.field.mock.calls.length;
    c.pan(SIZE.width / 3, 0);
    await flush();
    expect(server.t.field.mock.calls.length).toBe(reads + 1);
    expect(ids(c.getState().entries)).not.toContain(E3.id);
    // Back to where E3 was drawn, and out to the whole World: it never returns, because nothing kept it.
    c.pan(-SIZE.width / 3, 0);
    await flush();
    c.wholeWorld();
    await flush();
    expect(ids(c.getState().entries)).not.toContain(E3.id);
    c.farther();
    c.tapField(SIZE.width / 2, SIZE.height / 2);
    await flush();
    expect(ids(c.getState().entries)).not.toContain(E3.id);
  });

  it('a fresh read removes the Experience from the search results, the focused panel and the nearby context at once', async () => {
    const { c, server } = await start();
    c.openSearch();
    c.search('hope');
    await flush();
    expect(ids(c.getState().search.results)).toEqual([E2.id, E3.id]);
    c.focus(E1.id);
    await flush();
    const panel = c.getState().focus!.panel;
    expect(panel.status === 'SERVED' && ids(panel.experience.nearby)).toEqual([E2.id]);
    server.stop(E2);
    c.farther();
    await flush();
    const after = c.getState();
    expect(ids(after.entries)).not.toContain(E2.id);
    expect(ids(after.search.results)).toEqual([E3.id]);
    // Focus was released by the step out; focus again and the panel's nearby context is the server's, now.
    c.focus(E1.id);
    await flush();
    const again = c.getState().focus!.panel;
    expect(again.status === 'SERVED' && ids(again.experience.nearby)).toEqual([]);
  });

  it('the focused Experience itself, withdrawn while its panel is open, becomes ABSENT on the next read', async () => {
    const { c, server } = await start();
    c.focus(E1.id);
    await flush();
    server.stop(E1);
    c.revalidate();
    await flush();
    expect(c.getState().focus).toMatchObject({ id: E1.id, panel: { status: 'ABSENT' } });
    expect(ids(c.getState().entries)).not.toContain(E1.id);
  });

  it('a revalidation re-reads the glass, the open search and the focused panel', async () => {
    const { c, server } = await start();
    c.openSearch();
    c.search('hope');
    await flush();
    server.stop(E3);
    const [fields, searches] = [server.t.field.mock.calls.length, server.t.search.mock.calls.length];
    c.revalidate();
    await flush();
    expect(server.t.field.mock.calls.length).toBe(fields + 1);
    expect(server.t.search.mock.calls.length).toBe(searches + 1);
    expect(ids(c.getState().entries)).not.toContain(E3.id);
    expect(ids(c.getState().search.results)).toEqual([E2.id]);
  });

  it('a read that cannot be made fails closed: nothing held stays on display', async () => {
    const { c, server } = await start();
    c.openSearch();
    c.search('hope');
    await flush();
    server.fail();
    c.pan(40, 0);
    await flush();
    expect(c.getState()).toMatchObject({ status: 'UNAVAILABLE', entries: [], focus: null, search: { open: false, results: [] } });
  });
});

describe('S5-03B R2 — every navigation asks again for everything on display: the glass, the open search, the focused panel', () => {
  const start = async () => {
    const server = liveServer([E1, E2, E3]);
    const c = createPublicFieldController({ transport: server.t as unknown as PublicFieldTransport, isCurrent: () => true });
    c.setSize(SIZE.width, SIZE.height);
    c.enter();
    await flush();
    c.openSearch();
    c.search('hope');
    await flush();
    expect(ids(c.getState().search.results)).toEqual([E2.id, E3.id]);
    return { c, server };
  };

  it('the whole World shows no held search result while it reads, and re-runs the open search', async () => {
    const { c, server } = await start();
    server.stop(E3);
    const searches = server.t.search.mock.calls.length;
    c.wholeWorld();
    expect(c.getState().search.results).toEqual([]);
    expect(c.getState().entries).toEqual([]);
    await flush();
    expect(server.t.search.mock.calls.length).toBe(searches + 1);
    expect(c.getState().search).toMatchObject({ open: true, status: 'RESULTS' });
    expect(ids(c.getState().search.results)).toEqual([E2.id]);
    expect(ids(c.getState().entries)).not.toContain(E3.id);
  });

  it.each([
    ['a pan', (c: ReturnType<typeof createPublicFieldController>) => c.pan(SIZE.width / 3, 0)],
    ['a semantic zoom', (c: ReturnType<typeof createPublicFieldController>) => c.closer()],
  ])('%s re-runs the open search: a no-longer-served result disappears', async (_name, navigate) => {
    const { c, server } = await start();
    server.stop(E3);
    const searches = server.t.search.mock.calls.length;
    navigate(c);
    // Nothing held is shown while the search is asked again.
    expect(ids(c.getState().search.results)).not.toContain(E3.id);
    await flush();
    expect(server.t.search.mock.calls.length).toBe(searches + 1);
    expect(ids(c.getState().search.results)).toEqual([E2.id]);
    expect(ids(c.getState().entries)).not.toContain(E3.id);
  });

  it('a focused panel whose Experience is withdrawn becomes ABSENT on the next navigation, and is not redrawn', async () => {
    const { c, server } = await start();
    c.closeSearch();
    c.focus(E1.id);
    await flush();
    expect(c.getState().focus).toMatchObject({ id: E1.id, panel: { status: 'SERVED' } });
    server.stop(E1);
    const panels = server.t.experience.mock.calls.length;
    c.pan(12, 0);
    await flush();
    expect(server.t.experience.mock.calls.length).toBe(panels + 1);
    expect(c.getState().focus).toMatchObject({ id: E1.id, panel: { status: 'ABSENT' } });
    expect(ids(c.getState().entries)).not.toContain(E1.id);
  });

  it('on the surface: a withdrawn search result is neither drawn nor focusable after the whole World', async () => {
    const server = liveServer([E1, E2, E3]);
    const { view, field } = await mountArea('en', [], undefined, server.t as unknown as ReturnType<typeof fieldTransport>);
    await act(async () => { field.openSearch(); field.search('hope'); });
    await flush();
    expect(view.getByTestId(`qandeel-public-search-result-${E3.id}`)).toBeTruthy();
    expect(view.getByTestId(`qandeel-public-mark-${E3.id}`)).toBeTruthy();
    server.stop(E3);
    await act(async () => { field.wholeWorld(); });
    // In flight: the held result is not on display.
    expect(view.queryByTestId(`qandeel-public-search-result-${E3.id}`)).toBeNull();
    expect(view.queryByTestId(`qandeel-public-mark-${E3.id}`)).toBeNull();
    await flush();
    expect(view.getByTestId(`qandeel-public-search-result-${E2.id}`)).toBeTruthy();
    expect(view.queryByTestId(`qandeel-public-search-result-${E3.id}`)).toBeNull();
    expect(view.queryByTestId(`qandeel-public-mark-${E3.id}`)).toBeNull();
    expect(bodyOf(view, field, E3).body).toBeUndefined();
    await act(async () => { field.focus(E3.id); });
    await flush();
    expect(field.getState().focus).toBeNull();
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

/** Every Skia stand-in element of one kind in the rendered tree, with its props (the Map's own world-visual technique). */
function skia(view: { toJSON: () => unknown }, kind: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const record = node as { props?: Record<string, unknown>; children?: unknown[] };
    if (record.props?.skiaElement === kind) found.push(record.props);
    for (const child of record.children ?? []) walk(child);
  };
  walk(view.toJSON());
  return found;
}
const close = (a: unknown, b: number) => typeof a === 'number' && Math.abs(a - b) < 1e-6;
/** The painted body of the place an Experience is drawn at, if any (a filled circle on its projected point). */
function bodyOf(view: { toJSON: () => unknown }, field: { getState: () => { camera: ReturnType<typeof fittedCamera> | null } }, e: PublicFieldEntry) {
  const at = projectToField(field.getState().camera!, SIZE, e.address)!;
  const circles = skia(view, 'Circle').filter((c) => close(c.cx, at.x) && close(c.cy, at.y));
  return { body: circles.find((c) => typeof c.color === 'string' && c.style !== 'stroke'), marker: circles.find((c) => c.style === 'stroke') };
}
const MASS_COLOURS = WORLD_VISUAL.worldAtmosphere.stops.map(([, s, l, a]) => hsla(WORLD_VISUAL.worldHue, s, l, a));

async function mountArea(language: 'ar' | 'en', entries: PublicFieldEntry[], foreground?: ForegroundSignal, transport?: ReturnType<typeof fieldTransport>) {
  const t = transport ?? fieldTransport(entries);
  const field = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true, foreground });
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

  it('is painted in the frozen Living Analysis World: ground, atmosphere, tone and veil, with the field\'s mass from served places only', async () => {
    const { view } = await mountArea('en', [E1, E2, E3]);
    const world = view.getByTestId(PUBLIC_FIELD_WORLD_TEST_ID, { includeHiddenElements: true });
    expect(world.props.pointerEvents).toBe('none');
    // The Stage-2 owner's own strata, imported unchanged — never a second world style: the tone curve, the ground's
    // gradient and floor, the recorded atmosphere strata, and the veil's grain.
    expect(skia(view, 'RuntimeShader')).toHaveLength(1);
    expect(skia(view, 'LinearGradient')).toHaveLength(1);
    expect(skia(view, 'Picture').length).toBeGreaterThan(0);
    expect(skia(view, 'FractalNoise')).toHaveLength(1);
    // FAR: one world-colour mass per served place, identical for every place (no category, no weight).
    const mass = skia(view, 'RadialGradient').filter((g) => JSON.stringify(g.colors) === JSON.stringify(MASS_COLOURS));
    expect(mass).toHaveLength(3);
    expect(new Set(mass.map((m) => m.r)).size).toBe(1);
    // FAR is presence, not objects: no body is painted, and no line of any kind exists in the Public world.
    expect(skia(view, 'Circle').filter((c) => typeof c.color === 'string')).toHaveLength(0);
    expect([...skia(view, 'Path'), ...skia(view, 'Line')]).toHaveLength(0);
  });

  it('FAR is mass (no label, no target); MID makes each Experience legible; NEAR opens the compact panel', async () => {
    const { view, field } = await mountArea('en', [E1, E2, E3]);
    expect(bodyOf(view, field, E1).body).toBeUndefined();
    expect(view.queryByText('meaning 1')).toBeNull();
    expect(view.queryByTestId(`qandeel-public-mark-${E1.id}`)).toBeNull();
    const far = field.getState().camera!;
    const p = projectToField(far, SIZE, E1.address)!;
    await act(async () => { field.tapField(p.x, p.y); });
    await flush();
    expect(view.getByTestId(`qandeel-public-mark-${E1.id}`).props.accessibilityLabel).toBe('meaning 1');
    // MID: a place each, at the major tier, in the canonical mark material.
    expect(bodyOf(view, field, E1).body).toMatchObject({ r: 6 });
    expect(bodyOf(view, field, E1).marker).toBeUndefined();
    await fireEvent.press(view.getByTestId(`qandeel-public-mark-${E1.id}`));
    await flush();
    // NEAR: the focused place is selected; its semantic neighbourhood stays quietly present.
    expect(bodyOf(view, field, E1).body).toMatchObject({ r: 6, color: WORLD_VISUAL.palettes.standard.selectedInk });
    expect(bodyOf(view, field, E1).marker).toBeDefined();
    expect(bodyOf(view, field, E2)).toMatchObject({ body: { r: 3.2 }, marker: undefined });
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

  it('a return to the foreground reads again: an Experience withdrawn meanwhile is gone from the glass', async () => {
    // The runtime entry's ONE foreground signal (T-12P §2.7), driven by hand.
    const foreground = createManualForegroundSignal('ACTIVE');
    const { view, field, t } = await mountArea('en', [E1, E2, E3], foreground);
    const p = projectToField(field.getState().camera!, SIZE, E1.address)!;
    await act(async () => { field.tapField(p.x, p.y); });
    await flush();
    // Before: both places are on the glass at MID.
    expect(bodyOf(view, field, E2).body).toBeDefined();
    await flush();
    t.field.mockImplementation(async () => yes([E1, E3]));
    t.search.mockImplementation(async () => yes([E3]));
    await act(async () => { foreground.set('INACTIVE'); });
    expect(field.getState().entries.map((e) => e.id)).toEqual([E1.id, E2.id, E3.id]);
    await act(async () => { foreground.set('ACTIVE'); });
    await flush();
    expect(field.getState().entries.map((e) => e.id)).toEqual([E1.id, E3.id]);
    expect(view.queryByTestId(`qandeel-public-mark-${E2.id}`)).toBeNull();
    expect(bodyOf(view, field, E2).body).toBeUndefined();
    expect(bodyOf(view, field, E1).body).toBeDefined();
    // A retired controller no longer listens.
    field.retire();
    t.field.mockClear();
    await act(async () => { foreground.set('INACTIVE'); foreground.set('ACTIVE'); });
    expect(t.field).not.toHaveBeenCalled();
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
    // R1: the two rows whose text the Product Owner revised — still PROPOSED until the Owner closes the gate.
    expect(PUBLIC_FIELD_COPY_GATE.revisedByProductOwner).toEqual(['searchLabel', 'placeReady']);
    expect(publicFieldCopy('ar').searchLabel).toBe('ابحث عن تجربة أو شعور أو معنى');
    expect(publicFieldCopy('ar').placeReady).toBe('تم تحديد مكانها.');
    expect(publicFieldCopy('en').searchLabel).toBe('Search for an experience, feeling, or meaning');
    expect(publicFieldCopy('en').placeReady).toBe('Its place has been set.');
    expect(publicFieldCopy('ar').back).toBe('رجوع');
    expect(publicFieldCopy('en').analysisItem).toBe('QANDEEL analysis');
  });
});
