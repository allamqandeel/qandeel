/**
 * T-06 — TN06-09, TN06-10, TN06-13, TN06-14, TN06-15, TN06-16.
 *
 * The composite act is one transaction or it is nothing at all, its landing comes from the
 * projection of the position it commits to, and a target with zero or several loci is never
 * resolved by guessing.
 */
import { sessionPosition } from '../../state';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { entitledLoci } from '../../map';
import { chooseLocus, commitMoment, commitMomentAndLocate, legitimateLoci, resolveLocateAtTarget } from '../targeting';
import { contextAt, temporalTestStore } from '../__fixtures__/temporal';

const HOME = { id: 'thread-1', x: '10', y: '10' } as const;
const OTHER_HOME = { id: 'thread-2', x: '90', y: '90' } as const;

/** A world as it was known at Session Position 3: one Thread, one Reading in one context. */
const atThree = () =>
  disclosureFixture({
    depth: 'SESSION',
    tc: 3,
    liveHead: 6,
    threads: [HOME],
    appearances: [{ bindingId: 'binding-a', threadId: 'thread-1', readingId: 'reading-1', boundSp: 2 }],
    focuses: [{ id: 'focus-1', startedSp: 3 }],
  });

/** The same world later: a second Thread exists, and the Reading now appears in two contexts. */
const atSix = () =>
  disclosureFixture({
    depth: 'SESSION',
    tc: 6,
    liveHead: 6,
    threads: [HOME, OTHER_HOME],
    appearances: [
      { bindingId: 'binding-a', threadId: 'thread-1', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-b', threadId: 'thread-2', readingId: 'reading-1', boundSp: 5 },
    ],
    focuses: [{ id: 'focus-1', startedSp: 3 }],
  });

describe('TN06-13 — composite temporal + locate', () => {
  it('executes as ONE authorized composite transaction: one temporal move, one landing, one entry', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();

    const outcome = commitMomentAndLocate(store, {
      moment: sessionPosition(3),
      context: contextAt(atThree()),
      target: { family: 'THREAD', id: 'thread-1' },
    });

    expect(outcome.outcome).toBe('APPLIED');
    const after = store.getState();
    expect(after.temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(after.camera.anchor).not.toEqual(before.camera.anchor);
    expect(after.camera.destination).toBeDefined();
    // Exactly one checkpoint — never a temporal commit followed by a separate pan.
    expect(after.history).toHaveLength(1);
    expect(after.history[0].act).toBe('COMMIT_MOMENT_AND_LOCATE');
    // The checkpoint captures the PRE-act viewpoint, so the transaction really was atomic.
    expect(after.history[0].captured.tc).toBe(6);
    expect(after.history[0].captured.tmProvenance).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('never writes the semantic depth: a composite locate is not a semantic-zoom move', () => {
    const store = temporalTestStore({ liveHead: 6, depth: 'SESSION' });
    commitMomentAndLocate(store, { moment: sessionPosition(3), context: contextAt(atThree()), target: { family: 'THREAD', id: 'thread-1' } });
    expect(store.getState().camera.depth).toBe('SESSION');
  });

  it('fails closed on a target beyond the Live Head, before anything is resolved', () => {
    const store = temporalTestStore({ liveHead: 2 });
    const before = store.getState();
    expect(
      commitMomentAndLocate(store, { moment: sessionPosition(3) as never, context: contextAt(atThree()), target: { family: 'THREAD', id: 'thread-1' } }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'BEYOND_LIVE_HEAD' });
    expect(store.getState()).toBe(before);
  });

  it('fails closed when the store holds no temporal authority at all', () => {
    const store = temporalTestStore({ liveHead: 6, temporalAuthority: false });
    const before = store.getState();
    expect(
      commitMomentAndLocate(store, { moment: sessionPosition(3), context: contextAt(atThree()), target: { family: 'THREAD', id: 'thread-1' } }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'UNAUTHORIZED_TEMPORAL_ACTION' });
    expect(store.getState()).toBe(before);
  });
});

describe('TN06-09 — no hindsight', () => {
  it('cannot land on a Thread that does not exist at the target position', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();

    // `thread-2` is real at Session Position 6 and simply is not part of what was known at 3.
    expect(legitimateLoci(contextAt(atSix()), { family: 'THREAD', id: 'thread-2' })).toHaveLength(1);
    expect(
      commitMomentAndLocate(store, { moment: sessionPosition(3), context: contextAt(atThree()), target: { family: 'THREAD', id: 'thread-2' } }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'NOT_ENTITLED' });
    expect(store.getState()).toBe(before);
  });

  it('cannot reuse a later contextual appearance for an earlier target', () => {
    const later = contextAt(atSix());
    const earlier = contextAt(atThree());
    const laterLoci = entitledLoci(later.scene, 'READING', 'reading-1');
    expect(laterLoci).toHaveLength(2);

    // A genuinely minted locus handle — from the wrong projection. The brand passes; membership does not.
    const fromTheFuture = laterLoci.find((locus) => locus.locus.kind === 'CONTEXTUAL_APPEARANCE' && locus.locus.bindingId === 'binding-b');
    expect(fromTheFuture).toBeDefined();
    expect(resolveLocateAtTarget(earlier, { family: 'READING', id: 'reading-1' }, fromTheFuture)).toMatchObject({
      outcome: 'REJECTED',
      code: 'INVALID_INPUT',
    });
  });

  it('keeps a withheld rung withheld rather than reporting the identity as unknown', () => {
    const worldOnly = contextAt(disclosureFixture({ depth: 'WORLD', tc: 3, liveHead: 6, threads: [HOME] }));
    expect(resolveLocateAtTarget(worldOnly, { family: 'EMERGING_FOCUS', id: 'focus-1' })).toMatchObject({
      outcome: 'REJECTED',
      code: 'NOT_ENTITLED',
      detail: expect.stringContaining('DEPTH_WITHHELD'),
    });
  });
});

describe('TN06-10 — stale projection firewall', () => {
  it('refuses a landing resolved at a position other than the one being committed to', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();
    expect(
      commitMomentAndLocate(store, { moment: sessionPosition(3), context: contextAt(atSix()), target: { family: 'THREAD', id: 'thread-1' } }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(before);
  });

  it('refuses a landing disclosed at a depth the camera no longer discloses', () => {
    const store = temporalTestStore({ liveHead: 6, depth: 'WORLD' });
    const before = store.getState();
    expect(
      commitMomentAndLocate(store, { moment: sessionPosition(3), context: contextAt(atThree()), target: { family: 'THREAD', id: 'thread-1' } }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(before);
  });

  it('refuses a landing disclosed for another Session', () => {
    const store = temporalTestStore({ sessionId: 'session-2', liveHead: 6 });
    const before = store.getState();
    expect(
      commitMomentAndLocate(store, { moment: sessionPosition(3), context: contextAt(atThree()), target: { family: 'THREAD', id: 'thread-1' } }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(before);
  });

  it('refuses a locus choice held over from a projection the store has already left', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atSix());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');

    // The committed position moves. The context the chooser was built from is now history.
    expect(commitMoment(store, 3).outcome).toBe('APPLIED');
    const before = store.getState();

    expect(chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: loci[0] })).toMatchObject({
      outcome: 'REJECTED',
      code: 'STALE_PROJECTION',
    });
    expect(store.getState()).toBe(before);
  });
});

describe('TN06-14 — zero locus', () => {
  it('invents no spatial destination for a legitimately ungeographic identity', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atThree());
    expect(legitimateLoci(context, { family: 'EMERGING_FOCUS', id: 'focus-1' })).toEqual([]);

    const before = store.getState();
    expect(
      commitMomentAndLocate(store, { moment: sessionPosition(3), context, target: { family: 'EMERGING_FOCUS', id: 'focus-1' } }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'NOT_LOCATABLE' });

    // Not even the temporal half happened: a composite act is one transaction or none.
    expect(store.getState()).toBe(before);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('TN06-15 — multiple loci', () => {
  it('elects nothing, writes nothing and records nothing until a choice exists', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();

    const outcome = commitMomentAndLocate(store, {
      moment: sessionPosition(6),
      context: contextAt(atSix()),
      target: { family: 'READING', id: 'reading-1' },
    });

    expect(outcome.outcome).toBe('LOCUS_SELECTION_REQUIRED');
    if (outcome.outcome !== 'LOCUS_SELECTION_REQUIRED') throw new Error('unreachable');
    expect(outcome.moment).toBe(6);
    expect(outcome.loci).toHaveLength(2);
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('proceeds as ONE composite transaction once the choice is made', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atSix());
    const pending = commitMomentAndLocate(store, { moment: sessionPosition(6), context, target: { family: 'READING', id: 'reading-1' } });
    if (pending.outcome !== 'LOCUS_SELECTION_REQUIRED') throw new Error('unreachable');

    const outcome = commitMomentAndLocate(store, {
      moment: sessionPosition(6),
      context,
      target: { family: 'READING', id: 'reading-1' },
      locus: pending.loci[1],
    });

    expect(outcome.outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    // Still exactly one entry: the choice did not turn the act into two transactions.
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0].act).toBe('COMMIT_MOMENT_AND_LOCATE');
  });
});

describe('TN06-16 — CHOOSE_LOCUS', () => {
  it('lands on an entitled locus without touching the temporal mode', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atSix());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');

    const outcome = chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: loci[0] });
    expect(outcome.outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().camera.destination).toBeDefined();
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0].act).toBe('CHOOSE_LOCUS');
  });

  it('is a true no-op when the same locus is chosen again, and records nothing for it', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atSix());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');

    expect(chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: loci[0] }).outcome).toBe('APPLIED');
    expect(chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: loci[0] }).outcome).toBe('NO_OP');
    expect(store.getState().history).toHaveLength(1);

    expect(chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: loci[1] }).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);
  });

  it('refuses a locus that was not derived from a disclosed scene, however well-formed it looks', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atSix());
    const genuine = entitledLoci(context.scene, 'READING', 'reading-1')[0];
    const forged = { ...genuine };
    const before = store.getState();

    expect(chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: forged })).toMatchObject({
      outcome: 'REJECTED',
      code: 'INVALID_INPUT',
    });
    expect(store.getState()).toBe(before);
  });

  it('refuses a genuine locus that belongs to a different identity', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atSix());
    const threadLocus = entitledLoci(context.scene, 'THREAD', 'thread-2')[0];
    const before = store.getState();

    expect(chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: threadLocus })).toMatchObject({
      outcome: 'REJECTED',
      code: 'INVALID_INPUT',
    });
    expect(store.getState()).toBe(before);
  });

  it('refuses a choice that names no locus at all', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const context = contextAt(atSix());
    const before = store.getState();
    expect(
      chooseLocus(store, { context, target: { family: 'READING', id: 'reading-1' }, locus: undefined as never }),
    ).toMatchObject({ outcome: 'REJECTED', code: 'INVALID_INPUT' });
    expect(store.getState()).toBe(before);
  });
});
