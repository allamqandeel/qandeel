/**
 * T-07 — RN07-D: Preview precedence, for all six acts.
 *
 * T-06 froze it: a committed navigation act during a Preview cancels the Preview first, discards
 * `PTC`, records nothing for it, and operates from authoritative committed state. This suite proves
 * it for every one of the six — not only for Back and Live — and proves the ordering rather than
 * merely the end state: the preview is already gone when the act resolves, so no act can read it.
 */
import { sessionPosition } from '../../state';
import { panByTranslation } from '../../map';
import { createTemporalPreviewController } from '../../temporal-navigation';
import { backOneStep, exactReturn, goLiveAndLocate, returnLiveFocus, returnLiveHead, returnWorld } from '../return-actions';
import { latestReturnCheckpoint, type ReturnCheckpointTarget } from '../checkpoint-target';
import { contextAt, openPreview, providing, returnTestStore, world } from '../__fixtures__/return';

const SP = sessionPosition;

const LIVE_WORLD = () =>
  world({
    depth: 'SESSION',
    tc: 6,
    liveHead: 6,
    threads: [{ id: 'thread-live', x: '3000000', y: '0' }],
  });

describe('RN07-D — Preview precedence', () => {
  it('D32…D37 — every one of the six cancels an open Preview first, and none records it', () => {
    const cases: readonly (readonly [string, () => void])[] = [
      [
        'BACK_ONE_STEP',
        () => {
          const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
          const preview = createTemporalPreviewController();
          expect(panByTranslation(store, 150, 0).outcome).toBe('APPLIED');
          openPreview(store, preview, 2);
          expect(preview.getSnapshot().status).toBe('PREVIEWING');
          expect(backOneStep({ store, preview }).outcome).toBe('APPLIED');
          expect(preview.getSnapshot().status).toBe('IDLE');
          expect(store.getState().history).toHaveLength(0);
        },
      ],
      [
        'EXACT_RETURN',
        () => {
          const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
          const preview = createTemporalPreviewController();
          expect(panByTranslation(store, 150, 0).outcome).toBe('APPLIED');
          const target = latestReturnCheckpoint(store) as ReturnCheckpointTarget;
          openPreview(store, preview, 2);
          expect(exactReturn({ store, preview }, target).outcome).toBe('APPLIED');
          expect(preview.getSnapshot().status).toBe('IDLE');
          expect(store.getState().history).toHaveLength(0);
        },
      ],
      [
        'RETURN_LIVE_HEAD',
        () => {
          const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
          const preview = createTemporalPreviewController();
          openPreview(store, preview, 2);
          expect(returnLiveHead({ store, preview }).outcome).toBe('APPLIED');
          expect(preview.getSnapshot().status).toBe('IDLE');
          // Exactly one checkpoint: the pre-act historical viewpoint. Nothing for the preview.
          expect(store.getState().history).toHaveLength(1);
          expect(store.getState().history[0].act).toBe('RETURN_LIVE_HEAD');
          expect(store.getState().history[0].captured.tc).toBe(3);
        },
      ],
      [
        'RETURN_LIVE_FOCUS',
        () => {
          const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-live' } });
          const preview = createTemporalPreviewController();
          openPreview(store, preview, 2);
          const outcome = returnLiveFocus({ store, preview }, { context: contextAt(LIVE_WORLD()) });
          expect(outcome.outcome).toBe('APPLIED');
          expect(preview.getSnapshot().status).toBe('IDLE');
          expect(store.getState().history).toHaveLength(1);
          expect(store.getState().history[0].act).toBe('RETURN_LIVE_FOCUS');
        },
      ],
      [
        'RETURN_WORLD',
        () => {
          const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
          const preview = createTemporalPreviewController();
          expect(panByTranslation(store, 400, 0).outcome).toBe('APPLIED');
          openPreview(store, preview, 2);
          expect(returnWorld({ store, preview }).outcome).toBe('APPLIED');
          expect(preview.getSnapshot().status).toBe('IDLE');
          expect(store.getState().history).toHaveLength(2);
          expect(store.getState().history[1].act).toBe('RETURN_WORLD');
        },
      ],
      [
        'GO_LIVE_AND_LOCATE',
        () => {
          const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-live' } });
          const preview = createTemporalPreviewController();
          openPreview(store, preview, 2);
          const outcome = goLiveAndLocate({ store, preview }, { liveContext: providing(contextAt(LIVE_WORLD())) });
          expect(outcome.outcome).toBe('APPLIED');
          expect(preview.getSnapshot().status).toBe('IDLE');
          expect(store.getState().history).toHaveLength(1);
          expect(store.getState().history[0].act).toBe('GO_LIVE_AND_LOCATE');
        },
      ],
    ];

    expect(cases).toHaveLength(6);
    for (const [name, run] of cases) {
      expect(name.length).toBeGreaterThan(0);
      run();
    }
  });

  it('D38 — the act resolves from committed state, and the preview is already gone when it does', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(4) } });
    const preview = createTemporalPreviewController();
    openPreview(store, preview, 8);
    expect(preview.getSnapshot().status).toBe('PREVIEWING');

    // The store is observed at the instant the act resolves: `PTC` is 8, and the checkpoint the act
    // records must describe committed TC 4, never the previewed position.
    const seen: string[] = [];
    preview.subscribe(() => seen.push(`preview:${preview.getSnapshot().status}`));
    store.subscribe(() => seen.push('store:published'));

    expect(returnLiveHead({ store, preview }).outcome).toBe('APPLIED');
    // Cancellation is published before the canonical publish: the ordering is structural.
    expect(seen).toEqual(['preview:IDLE', 'store:published']);
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0].captured.tc).toBe(4);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('cancelling a preview writes no canonical field and records nothing on its own', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    const preview = createTemporalPreviewController();
    openPreview(store, preview, 2);
    const before = store.getState();
    preview.cancel();
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });
});
