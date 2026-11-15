/**
 * COSMOS-INT-01 Slice B — the Personal owner over the PRODUCTION integration runtime, headless. It lives with the layer's
 * own tests because it reaches the layer's harness (T-12 §28.5 keeps every outside file on the barrel). It attaches to the
 * runtime's own store and ONE projection cache, dispatches exactly the acts the old Map dispatched (`PAN`,
 * `ZOOM_SEMANTIC`, `INSPECT_OBJECT` through T-04's entitlement), reports every outcome to the composition's observer,
 * asks the composite spatial cause at each canonical camera change (D-5), never pre-empts the composition's read of the
 * viewpoint (QAN-BL-MOB-05), lists the objects disclosed with no place (G-6) and names a mark by its family word alone.
 */
import { analysisCopy } from '../../analysis-language';
import { harness, settle, SESSION_A } from '../__fixtures__/integration';
import { mapProjectionRequest } from '../../map';
import { viewportEnvelope } from '../../map/camera';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { HistoricalSemanticDepth } from '../../projection';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import { createPersonalCosmosOwner, inspectionRequestOf } from '../../cosmos/product';

const GLASS = viewportEnvelope(390, 844, { top: 104, bottom: 220 })!;
const LIVE_HEAD = 6;
const projection: Responder = (request) => {
  const params = new URL(request.url).searchParams;
  return {
    status: 200,
    body: disclosureFixture({
      depth: (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth,
      sessionId: SESSION_A,
      tc: Number(params.get('tc') ?? LIVE_HEAD),
      liveHead: LIVE_HEAD,
      threads: [{ id: 'thread-a', x: '0', y: '0' }, { id: 'thread-b', x: '500000', y: '0' }],
      appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
      readings: [{ id: 'reading-1' }, { id: 'reading-orphan' }],
      focuses: [{ id: 'focus-1', startedSp: 3 }],
    }),
  };
};

describe('the Personal owner over the production runtime', () => {
  it('attaches to the runtime, reads only the other rungs, and dispatches the Map\'s own acts with their outcomes and the spatial cause', async () => {
    const h = await harness({ liveHead: LIVE_HEAD, projection });
    const runtime = h.ready();
    const { store } = runtime;
    const ensure = jest.spyOn(runtime.projection, 'ensure');
    const outcomes: string[] = [];
    const causes: unknown[] = [];
    const owner = createPersonalCosmosOwner({ runtime, language: 'en', onOutcome: (outcome) => { outcomes.push(outcome.outcome); }, spatialCause: (destination) => { causes.push(destination); return null; } });
    owner.setGlass(GLASS);
    // QAN-BL-MOB-05: the viewpoint's own depth is the composition's read; the owner asked only for the other four rungs.
    expect(ensure.mock.calls.map(([request]) => request.depth).sort()).toEqual(['ANALYTICAL_OBJECT', 'SESSION', 'SOURCE_PROVENANCE', 'THREAD']);
    const read = async () => {
      const request = mapProjectionRequest(store.getState());
      if (request !== null) await runtime.projection.ensure(request);
      await settle();
    };
    await read();

    // WORLD: the two Threads, placed; the whole-world evidence; the family word is the only name.
    let s = owner.getSnapshot();
    expect(s).toMatchObject({ world: 'PERSONAL', status: 'READY', rung: 0, rungs: 5, entityCount: 2, focusId: null, inspectedId: null, unplaced: [], relations: [] });
    expect(s.held?.[0]).toBe(true);
    expect(s.worldIndex).toHaveLength(2);
    expect(s.list.layers[0].hits.map((hit) => hit.id).sort()).toEqual(['THREAD:thread-a', 'THREAD:thread-b']);
    expect(owner.labelOf('THREAD:thread-a')).toBe(analysisCopy('en').family.THREAD);
    expect(s.list.layers[0].labels).toHaveLength(0);

    // One semantic step IN: ZOOM_SEMANTIC on the store, its outcome reported, the spatial cause asked with the destination.
    const before = store.getState().camera;
    const askedBefore = ensure.mock.calls.length;
    expect(owner.step('IN', null, null)).toEqual({ applied: true, aboutFingers: false });
    // The new viewpoint: the owner asked for its OTHER four rungs at once, and not for its own depth (THREAD).
    expect(ensure.mock.calls.slice(askedBefore).map(([request]) => request.depth).sort()).toEqual(['ANALYTICAL_OBJECT', 'SESSION', 'SOURCE_PROVENANCE', 'WORLD']);
    expect(outcomes).toEqual(['APPLIED']);
    expect(causes).toHaveLength(1);
    expect(causes[0]).toBe(store.getState().camera);
    expect(store.getState().camera).not.toBe(before);
    await read();
    s = owner.getSnapshot();
    expect(s).toMatchObject({ status: 'READY', rung: 1 });
    expect(s.held?.[1]).toBe(true);

    // An inspection through T-04's own executor: IF_ref is written, no camera; the stage's focus follows it.
    expect(inspectionRequestOf('THREAD:thread-a')).toEqual({ family: 'THREAD', id: 'thread-a' });
    owner.focus('THREAD:thread-a');
    expect(outcomes).toEqual(['APPLIED', 'APPLIED']);
    expect(causes).toHaveLength(1);
    expect(owner.getSnapshot()).toMatchObject({ inspectedId: 'THREAD:thread-a', focusId: 'THREAD:thread-a' });

    // SESSION: the emerging focus is disclosed with NO place — listed as unplaced (G-6), inspectable, never placed.
    owner.step('IN', null, null);
    await read();
    s = owner.getSnapshot();
    expect(s.rung).toBe(2);
    const focus = s.unplaced.find((item) => item.family === 'EMERGING_FOCUS');
    expect(focus).toBeDefined();
    expect(focus?.id.endsWith('focus-1')).toBe(true);
    expect(s.list.layers[2].hits.map((hit) => hit.id)).not.toContain(focus?.id);
    expect(owner.labelOf(focus!.id)).toBe(analysisCopy('en').family.EMERGING_FOCUS);
    owner.focus(focus!.id);
    expect(outcomes[outcomes.length - 1]).toBe('APPLIED');
    expect(owner.getSnapshot().inspectedId).toBe(focus!.id);

    // Back is one rung OUT; a released drag is one PAN; both report and both move the canonical camera (one cause each).
    const causesBefore = causes.length;
    expect(owner.back()).toBe(true);
    await read();
    expect(owner.getSnapshot().rung).toBe(1);
    const camera = owner.getSnapshot().camera;
    expect(owner.pan({ cx: camera.cx + 12, cy: camera.cy, scale: camera.scale })).toBe(true);
    await read();
    expect(outcomes.filter((outcome) => outcome === 'APPLIED').length).toBeGreaterThanOrEqual(5);
    expect(causes.length).toBe(causesBefore + 2);
    expect(owner.getSnapshot().camera.cx).not.toBe(camera.cx);
    // A jitter is not a PAN.
    const at = owner.getSnapshot().camera;
    expect(owner.pan({ ...at, cx: at.cx + 0.0001 })).toBe(false);

    owner.dispose();
    h.dispose();
  });
});
