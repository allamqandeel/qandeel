import { opaqueRef, sessionPosition } from '../../state/classes';
import { createCanonicalStore } from '../../state/store';
import { effectiveTC } from '../../state/selectors';
import { runPresentationCommand } from '../accessibility/commands';
import { disclosedTrack, hitTest, itemLayout, targetKey, TIMELINE_STEP } from '../model/disclosedTrack';
import { createPresentationController } from '../window/controller';
import { fixture } from '../testing/fixtures';

describe('T-05 frozen presentation contract', () => {
  test('TL05-01 constant step at 10 / 10k / 100k, narrow and wide', () => {
    for (const size of [10, 10_000, 100_000]) {
      const track = fixture(size);
      for (const width of [240, 960]) {
        const controller = createPresentationController(track, width);
        expect(controller.getSnapshot().maximum).toBe(Math.max(0, size * TIMELINE_STEP - width));
        expect(itemLayout(track.targets, size - 1)).toEqual({ index: size - 1, length: 48, offset: (size - 1) * 48 });
      }
    }
  });
  test('TL05-02 SP alone; unrelated metadata stripped, out-of-order/gapped input rejected', () => {
    const targets = [1, 2].map(sp => ({ sessionPosition: sessionPosition(sp), timestamp: -sp, RTO: 100 - sp, KF: sp * 20, VF: -sp, VT: 0, map: { x: -sp } }));
    const track = disclosedTrack('session', targets);
    expect(track.targets).toEqual([{ sessionPosition: 1 }, { sessionPosition: 2 }]);
    expect(() => disclosedTrack('session', [...targets].reverse())).toThrow();
    expect(() => disclosedTrack('session', [{ sessionPosition: sessionPosition(1) }, { sessionPosition: sessionPosition(3) }])).toThrow();
    targets[0].sessionPosition = sessionPosition(999);
    expect(track.targets[0].sessionPosition).toBe(1);
  });
  test('TL05-03/04/05/13/15 all Class D movement leaves canonical state and RH object-identical, selects nothing', () => {
    const store = createCanonicalStore({
      session: { id: 'current-session' }, live: { LH: sessionPosition(100_000), LF: { value: { kind: 'NONE' }, atSp: null } },
      temporal: { kind: 'PINNED', at: sessionPosition(10_000) }, inspection: null,
      camera: { anchor: opaqueRef('WORLD_ANCHOR', 'origin'), scale: opaqueRef('SCALE_INTENT', 'scale'), depth: 'WORLD' },
    });
    const canonical = store.getState();
    const dispatch = jest.spyOn(store, 'dispatch');
    const controller = createPresentationController(fixture(10_000), 480);
    controller.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: 960 });
    controller.move({ type: 'PRESENTATION_POSITION_MOVE', position: 0.8 });
    const beforeRefine = controller.getSnapshot();
    controller.move({ type: 'PRESENTATION_POSITION_REFINE' });
    expect(controller.getSnapshot()).toEqual({ ...beforeRefine, fraction: beforeRefine.fraction / 2 });
    controller.move({ type: 'PRESENTATION_POSITION_WIDEN' });
    expect(controller.getSnapshot()).toEqual(beforeRefine);
    expect(store.getState()).toBe(canonical);
    expect(store.getState().history).toBe(canonical.history);
    expect(effectiveTC(store.getState())).toBe(10_000);
    expect(dispatch).not.toHaveBeenCalled();
    expect(Object.keys(controller.getSnapshot()).sort()).toEqual(['fraction', 'maximum', 'offset', 'position', 'track', 'viewport']);
    expect(createPresentationController(fixture(10_000), 480).getSnapshot().offset).toBe(0);
  });
  test('TL05-06 disclosed-only extent, last item and hit testing, even when LH is larger elsewhere', () => {
    const track = fixture(20);
    const c = createPresentationController(track, 240);
    c.move({ type: 'PRESENTATION_POSITION_MOVE', position: 1 });
    expect(c.getSnapshot().maximum).toBe(20 * 48 - 240);
    expect(hitTest(track, c.getSnapshot().offset, 240, 239)?.sessionPosition).toBe(20);
    expect(hitTest(track, c.getSnapshot().offset, 240, 240)).toBeNull();
    expect(hitTest(track, 20 * 48, 240, 0)).toBeNull();
  });
  test('TL05-07 later growth preserves prior geometry/offset; shrink and viewport clamp locally; sessions reset', () => {
    const c = createPresentationController(fixture(20), 240);
    runPresentationCommand(c, 'last');
    const offset = c.getSnapshot().offset;
    c.replaceDisclosed(fixture(40));
    expect(c.getSnapshot().offset).toBe(offset);
    expect(itemLayout(null, 19).offset).toBe(19 * 48);
    c.replaceDisclosed(fixture(2));
    expect(c.getSnapshot().offset).toBe(0);
    c.setViewport(48);
    runPresentationCommand(c, 'last');
    expect(c.getSnapshot().offset).toBe(48);
    c.replaceDisclosed(fixture(40, 'another-session'));
    expect(c.getSnapshot().offset).toBe(0);
  });
  test('TL05-08/14 100k SP identities, no aggregates or fictitious Live coordinate', () => {
    const track = fixture(100_000);
    expect(track.targets).toHaveLength(100_000);
    expect(new Set(track.targets.map(targetKey)).size).toBe(100_000);
    expect(track.targets.at(-1)).toEqual({ sessionPosition: 100_000 });
    expect(track.targets[100_000]).toBeUndefined();
  });
  test.each([0, 1, 3])('zero/one/fitting disclosed extent: %i', size => {
    const c = createPresentationController(fixture(size), 480);
    runPresentationCommand(c, 'last');
    expect(c.getSnapshot().maximum).toBe(0);
    expect(c.getSnapshot().position).toBe(0);
  });
  test('invalid input cannot poison window state; refine/widen stay bounded', () => {
    const c = createPresentationController(fixture(100), 240);
    const before = c.getSnapshot();
    expect(() => c.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: NaN })).toThrow();
    expect(() => c.setViewport(Infinity)).toThrow();
    for (const command of ['101', '-10', 'NaN', '1e2', 'commit', 'live']) expect(runPresentationCommand(c, command)).toBe(false);
    expect(c.getSnapshot()).toBe(before);
    for (let n = 0; n < 50; n++) c.move({ type: 'PRESENTATION_POSITION_REFINE' });
    expect(c.getSnapshot().fraction).toBe(1 / 1024);
    for (let n = 0; n < 50; n++) c.move({ type: 'PRESENTATION_POSITION_WIDEN' });
    expect(c.getSnapshot().fraction).toBe(1);
  });
});
