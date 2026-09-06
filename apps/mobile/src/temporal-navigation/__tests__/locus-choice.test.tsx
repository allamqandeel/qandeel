/**
 * T-06 — R1-03 and R1-04.
 *
 * `CHOOSE_LOCUS` is the frozen act that resolves a genuine contextual ambiguity, and nothing wider;
 * and a Product state that says a choice is required comes with a route — pointer and non-pointer —
 * that actually makes it, through the same executor and the same runtime authority.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition } from '../../state';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { entitledLoci, zoomSemanticStep } from '../../map';
import { chooseLocus, commitMoment, commitMomentAndLocate, resolveLocusChoice } from '../targeting';
import {
  LOCUS_CHOICE_CANCEL_ACTION,
  LOCUS_CHOICE_CANCEL_TEST_ID,
  LOCUS_CHOICE_TEST_ID,
  LocusChoiceSurface,
  locusChoiceModel,
  pendingCompositeChoice,
  pendingSpatialChoice,
  resolvePendingLocusChoice,
} from '../locus-choice';
import { contextAt, temporalTestStore } from '../__fixtures__/temporal';

const THREAD_ONE = { id: 'thread-1', x: '10', y: '10' } as const;
const THREAD_TWO = { id: 'thread-2', x: '90', y: '90' } as const;

/** One Reading in TWO contexts: a genuine ambiguity. */
const ambiguous = () =>
  disclosureFixture({
    depth: 'SESSION',
    tc: 6,
    liveHead: 6,
    threads: [THREAD_ONE, THREAD_TWO],
    appearances: [
      { bindingId: 'binding-a', threadId: 'thread-1', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-b', threadId: 'thread-2', readingId: 'reading-1', boundSp: 5 },
    ],
    focuses: [{ id: 'focus-1', startedSp: 3 }],
  });

/** The same Reading in ONE context, plus an ungeographic Emerging Focus. */
const unambiguous = () =>
  disclosureFixture({
    depth: 'SESSION',
    tc: 6,
    liveHead: 6,
    threads: [THREAD_ONE],
    appearances: [{ bindingId: 'binding-a', threadId: 'thread-1', readingId: 'reading-1', boundSp: 2 }],
    focuses: [{ id: 'focus-1', startedSp: 3 }],
  });

const READING = { family: 'READING', id: 'reading-1' } as const;
const FOCUS = { family: 'EMERGING_FOCUS', id: 'focus-1' } as const;

describe('R1-03 — CHOOSE_LOCUS applies only to a genuine multiple-locus ambiguity', () => {
  it('rejects a target with zero legitimate loci, and invents no geography', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(unambiguous());
    const before = store.getState();
    const anyLocus = entitledLoci(context.scene, 'THREAD', 'thread-1')[0];

    expect(resolveLocusChoice(context, FOCUS, anyLocus)).toMatchObject({ outcome: 'REJECTED', code: 'NOT_LOCATABLE' });
    expect(chooseLocus(store, { context, target: FOCUS, locus: anyLocus })).toMatchObject({ outcome: 'REJECTED', code: 'NOT_LOCATABLE' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('rejects a target with exactly one legitimate locus, with zero state and RH change', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(unambiguous());
    const before = store.getState();
    const only = entitledLoci(context.scene, 'READING', 'reading-1');
    expect(only).toHaveLength(1);

    // The handle is genuine, minted from this very scene, and belongs to this very target. It is
    // still refused, because there is no choice to make: this act is not a generic spatial locate.
    expect(chooseLocus(store, { context, target: READING, locus: only[0] })).toMatchObject({
      outcome: 'REJECTED',
      code: 'NOT_A_LOCUS_CHOICE',
    });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().camera.destination).toBeUndefined();
  });

  it('rejects a multiple-locus target when no choice is named', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const before = store.getState();

    expect(resolveLocusChoice(context, READING, undefined)).toMatchObject({ outcome: 'LOCUS_SELECTION_REQUIRED' });
    expect(chooseLocus(store, { context, target: READING, locus: undefined as never })).toMatchObject({
      outcome: 'REJECTED',
      code: 'INVALID_INPUT',
    });
    expect(store.getState()).toBe(before);
  });

  it('applies spatially — and only spatially — when a legitimate member is chosen', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');
    expect(loci).toHaveLength(2);

    expect(chooseLocus(store, { context, target: READING, locus: loci[0] }).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().inspection).toBeNull();
    expect(store.getState().camera.depth).toBe('SESSION');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['CHOOSE_LOCUS']);
  });

  it('stays a true no-op when the already-current landing is chosen again', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');

    expect(chooseLocus(store, { context, target: READING, locus: loci[0] }).outcome).toBe('APPLIED');
    expect(chooseLocus(store, { context, target: READING, locus: loci[0] }).outcome).toBe('NO_OP');
    expect(store.getState().history).toHaveLength(1);
    expect(chooseLocus(store, { context, target: READING, locus: loci[1] }).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);
  });

  it('rejects a forged handle, a handle of another target, and a handle from a stale projection', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');
    const before = store.getState();

    expect(chooseLocus(store, { context, target: READING, locus: { ...loci[0] } })).toMatchObject({ outcome: 'REJECTED', code: 'INVALID_INPUT' });
    const threadLocus = entitledLoci(context.scene, 'THREAD', 'thread-2')[0];
    expect(chooseLocus(store, { context, target: READING, locus: threadLocus })).toMatchObject({ outcome: 'REJECTED', code: 'INVALID_INPUT' });
    expect(store.getState()).toBe(before);

    // A handle minted from a projection the store has since left.
    const moved = temporalTestStore({ liveHead: 6 });
    expect(commitMoment(moved, 3).outcome).toBe('APPLIED');
    const after = moved.getState();
    expect(chooseLocus(moved, { context, target: READING, locus: loci[0] })).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(moved.getState()).toBe(after);
  });

  it('leaves the composite unique-locus path free to proceed without a chooser', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const outcome = commitMomentAndLocate(store, {
      moment: sessionPosition(6),
      context: contextAt(unambiguous()),
      target: READING,
    });
    expect(outcome.outcome).toBe('APPLIED');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['COMMIT_MOMENT_AND_LOCATE']);
  });
});

describe('R1-04 — the pending contextual-locus choice model', () => {
  it('is built only from a genuine LOCUS_SELECTION_REQUIRED result', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const outcome = commitMomentAndLocate(store, { moment: sessionPosition(6), context, target: READING });

    const pending = pendingCompositeChoice(outcome, context, READING);
    expect(pending).not.toBeNull();
    expect(pending?.moment).toBe(6);
    expect(pending?.loci).toHaveLength(2);

    // A unique-locus composite applies rather than pending, so no chooser can be built from it.
    const applied = commitMomentAndLocate(temporalTestStore({ liveHead: 6 }), {
      moment: sessionPosition(6),
      context: contextAt(unambiguous()),
      target: READING,
    });
    expect(pendingCompositeChoice(applied, context, READING)).toBeNull();
    // And a zero- or one-locus spatial state produces no chooser either.
    expect(pendingSpatialChoice(context, FOCUS, [])).toBeNull();
    expect(pendingSpatialChoice(context, READING, entitledLoci(contextAt(unambiguous()).scene, 'READING', 'reading-1'))).toBeNull();
  });

  it('presents every legitimate choice, exactly once, with no ranking or preselection', () => {
    const context = contextAt(ambiguous());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');
    const pending = pendingSpatialChoice(context, READING, loci);
    if (pending === null) throw new Error('unreachable');

    const model = locusChoiceModel(pending);
    expect(model.options).toHaveLength(2);
    expect(model.options.map((option) => option.key).sort()).toEqual([...loci].map((locus) => locus.key).sort());
    expect(new Set(model.options.map((option) => option.key)).size).toBe(2);
    expect(model.orderingNote).toMatch(/not a ranking/u);
    for (const option of model.options) {
      expect(option.label).toContain('reading-1');
      for (const forbidden of ['recommended', 'primary', 'best', 'preferred', 'default', 'most']) {
        expect(option.label.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  it('refuses a submission that is not one of the offered choices', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');
    const pending = pendingSpatialChoice(context, READING, loci);
    if (pending === null) throw new Error('unreachable');
    const before = store.getState();

    expect(resolvePendingLocusChoice(store, pending, { ...loci[0] })).toMatchObject({ outcome: 'REJECTED', code: 'INVALID_INPUT' });
    expect(resolvePendingLocusChoice(store, pending, entitledLoci(context.scene, 'THREAD', 'thread-1')[0])).toMatchObject({
      outcome: 'REJECTED',
      code: 'INVALID_INPUT',
    });
    expect(store.getState()).toBe(before);
  });

  it('completes a composite choice as ONE composite transaction, and never earlier', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const outcome = commitMomentAndLocate(store, { moment: sessionPosition(6), context, target: READING });
    const pending = pendingCompositeChoice(outcome, context, READING);
    if (pending === null) throw new Error('unreachable');

    // The temporal half has NOT happened while the choice is pending.
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(0);

    const resolved = resolvePendingLocusChoice(store, pending, pending.loci[1]);
    expect(resolved.outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['COMMIT_MOMENT_AND_LOCATE']);
  });

  it('fails closed when the pending projection stops being the one the act would commit to', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');
    const pending = pendingSpatialChoice(context, READING, loci);
    if (pending === null) throw new Error('unreachable');

    expect(commitMoment(store, 3).outcome).toBe('APPLIED');
    const after = store.getState();

    expect(resolvePendingLocusChoice(store, pending, loci[0])).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(after);
  });
});

describe('R1-04 — the user-facing locus-choice route', () => {
  const pendingFixture = () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(ambiguous());
    const outcome = commitMomentAndLocate(store, { moment: sessionPosition(6), context, target: READING });
    const pending = pendingCompositeChoice(outcome, context, READING);
    if (pending === null) throw new Error('unreachable');
    return { store, pending };
  };

  it('exposes every legitimate choice to the pointer route and to assistive technology alike', async () => {
    const { store, pending } = pendingFixture();
    const view = await render(<LocusChoiceSurface store={store} pending={pending} />);

    const surface = view.getByTestId(LOCUS_CHOICE_TEST_ID);
    const actionNames = (surface.props.accessibilityActions as { name: string }[]).map((action) => action.name);
    for (const locus of pending.loci) {
      // The pointer route.
      expect(view.getByTestId(`${LOCUS_CHOICE_TEST_ID}:option:${locus.key}`)).toBeTruthy();
      // The non-pointer route, named by the locus rather than by an index.
      expect(actionNames).toContain(locus.key);
    }
    expect(actionNames).toContain(LOCUS_CHOICE_CANCEL_ACTION);
    // Nothing is preselected.
    for (const locus of pending.loci) {
      expect(view.getByTestId(`${LOCUS_CHOICE_TEST_ID}:option:${locus.key}`).props.accessibilityState).toEqual({ selected: false });
    }

    await act(async () => {
      view.unmount();
    });
  });

  it('performs the authorized composite act when a choice is pressed', async () => {
    const { store, pending } = pendingFixture();
    const outcomes: string[] = [];
    const view = await render(<LocusChoiceSurface store={store} pending={pending} onOutcome={(outcome) => outcomes.push(outcome.outcome)} />);

    await act(async () => {
      fireEvent.press(view.getByTestId(`${LOCUS_CHOICE_TEST_ID}:option:${pending.loci[0].key}`));
    });

    expect(outcomes).toEqual(['APPLIED']);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['COMMIT_MOMENT_AND_LOCATE']);

    await act(async () => {
      view.unmount();
    });
  });

  it('converges: the accessibility route reaches the same executor and the same authority', async () => {
    const { store, pending } = pendingFixture();
    const outcomes: string[] = [];
    const view = await render(<LocusChoiceSurface store={store} pending={pending} onOutcome={(outcome) => outcomes.push(outcome.outcome)} />);

    await act(async () => {
      fireEvent(view.getByTestId(LOCUS_CHOICE_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: pending.loci[1].key } });
    });

    expect(outcomes).toEqual(['APPLIED']);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(store.getState().history).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });
  });

  it('backs out without any canonical mutation or RH append, on either route', async () => {
    const { store, pending } = pendingFixture();
    let cancelled = 0;
    const before = store.getState();
    const view = await render(<LocusChoiceSurface store={store} pending={pending} onCancel={() => (cancelled += 1)} />);

    await act(async () => {
      fireEvent.press(view.getByTestId(LOCUS_CHOICE_CANCEL_TEST_ID));
    });
    await act(async () => {
      fireEvent(view.getByTestId(LOCUS_CHOICE_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: LOCUS_CHOICE_CANCEL_ACTION } });
    });

    expect(cancelled).toBe(2);
    expect(store.getState()).toBe(before);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(0);

    await act(async () => {
      view.unmount();
    });
  });

  it('cannot be driven with a choice it does not offer', async () => {
    const { store, pending } = pendingFixture();
    const outcomes: string[] = [];
    const before = store.getState();
    const view = await render(<LocusChoiceSurface store={store} pending={pending} onOutcome={(outcome) => outcomes.push(outcome.outcome)} />);

    await act(async () => {
      fireEvent(view.getByTestId(LOCUS_CHOICE_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'READING:reading-1@THREAD_READING:forged' } });
    });

    expect(outcomes).toEqual([]);
    expect(store.getState()).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('fails closed when the semantic depth moves before the reader chooses', async () => {
    const { store, pending } = pendingFixture();
    const outcomes: string[] = [];
    // A legitimate semantic-zoom step through T-04's own executor. The pending landing was resolved
    // at the SESSION rung, and the camera now discloses another one.
    expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    const after = store.getState();

    const view = await render(<LocusChoiceSurface store={store} pending={pending} onOutcome={(outcome) => outcomes.push(outcome.outcome)} />);
    await act(async () => {
      fireEvent.press(view.getByTestId(`${LOCUS_CHOICE_TEST_ID}:option:${pending.loci[0].key}`));
    });

    expect(outcomes).toEqual(['REJECTED']);
    expect(store.getState()).toBe(after);

    await act(async () => {
      view.unmount();
    });
  });

  it('fails closed when the Session is replaced before the reader chooses', async () => {
    const { pending } = pendingFixture();
    const replacement = temporalTestStore({ sessionId: 'session-2', liveHead: 6 });
    const outcomes: string[] = [];
    const before = replacement.getState();

    const view = await render(<LocusChoiceSurface store={replacement} pending={pending} onOutcome={(outcome) => outcomes.push(outcome.outcome)} />);
    await act(async () => {
      fireEvent.press(view.getByTestId(`${LOCUS_CHOICE_TEST_ID}:option:${pending.loci[0].key}`));
    });

    expect(outcomes).toEqual(['REJECTED']);
    expect(replacement.getState()).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('still applies when only the READER moved in time, because a composite act carries its own position', () => {
    // The composite act commits to Moment 6 and its landing came from the projection OF Moment 6.
    // The reader having stepped elsewhere in the meantime does not make that pairing stale — the act
    // was always going to move them — so this must not be treated as a staleness failure.
    const { store, pending } = pendingFixture();
    expect(commitMoment(store, 3).outcome).toBe('APPLIED');

    const resolved = resolvePendingLocusChoice(store, pending, pending.loci[0]);
    expect(resolved.outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['COMMIT_MOMENT', 'COMMIT_MOMENT_AND_LOCATE']);
  });
});
