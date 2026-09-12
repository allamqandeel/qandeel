/**
 * T-13 — Slice 2, through the REAL integration owner: the recovered viewpoint. `TM`, `IF_ref`, `MC`
 * and `RH` come back exactly, reconciled against FRESH server truth; the effective `TC` is derived and
 * never stored; nothing is clamped, retargeted or guessed; the process-local Exact Return origin is
 * intentionally reset; and the foreground cursors start from the fresh snapshot.
 */
import { initialCameraIntent, mapProjectionRequest } from '../../map';
import { backOneStep } from '../../return-navigation';
import { effectiveTC, sessionPosition, temporalOrientation, type RhEntry } from '../../state';
import { createEphemeralProductRecoveryStorage, namespaceKeyFor, type ProductRecoveryStorage } from '../../recovery';
import { checkpoint, inspectionRef, offsetCamera } from '../../recovery/__fixtures__/records';
import { harness, settle, snapshot, SESSION_A, SESSION_B, worldDisclosure, type IntegrationHarness } from '../__fixtures__/integration';

const USER_1 = { userId: 'user-1', accessToken: 'token-1' };

const storedFor = async (storage: ProductRecoveryStorage, userId: string) => {
  const text = await storage.getItem(namespaceKeyFor(userId));
  return text === null ? null : (JSON.parse(text) as { sessionId: string; sequence: number; viewpoint: Record<string, unknown> });
};

/** A record for `USER_1`, as a previous launch would have left it, with the viewpoint under test. */
async function storageWith(viewpoint: Record<string, unknown>, sessionId = SESSION_B) {
  const storage = createEphemeralProductRecoveryStorage();
  await storage.setItem(
    namespaceKeyFor(USER_1.userId),
    JSON.stringify({
      schemaVersion: 1,
      ownerUserId: USER_1.userId,
      sessionId,
      viewpoint: { temporal: { kind: 'FOLLOW_LIVE' }, inspection: null, camera: initialCameraIntent(), history: [], ...viewpoint },
      sequence: 3,
    }),
  );
  return storage;
}

/** The resume routes for one Session at one fresh Live Head, and NO create route. */
function serveResume(h: IntegrationHarness, sessionId: string, liveHead: number | null) {
  h.http.on('/temporal', () => ({ status: 200, body: snapshot({ sessionId, liveHead, liveFocusAtSp: liveHead }) }));
  h.http.on('/temporal/events', () => ({ status: 200, body: { sessionId, events: [] } }));
  h.http.on('/temporal/live-focus-events', () => ({ status: 200, body: { sessionId, events: [] } }));
  h.http.on('/historical-projection', (request) => {
    const tc = Number(new URL(request.url).searchParams.get('tc'));
    return { status: 200, body: worldDisclosure(sessionId, tc, liveHead ?? tc) };
  });
}

/** Relaunch: a runtime over the SAME storage, signed in explicitly, with the resume routes served. */
async function relaunch(storage: ProductRecoveryStorage, liveHead: number | null, sessionId = SESSION_B) {
  const h = await harness({ serve: false, recoveryStorage: storage, initialSession: null });
  serveResume(h, sessionId, liveHead);
  h.auth.signInWith({ ok: true, value: USER_1 });
  await h.runtime.auth.signInWithPassword('validation identity', 'validation credential');
  await settle();
  return h;
}

const recoveryFailure = (h: IntegrationHarness) => {
  const phase = h.phase();
  if (phase.kind !== 'RECOVERY_FAILED') throw new Error(`expected RECOVERY_FAILED, reached ${phase.kind}`);
  return phase.failure;
};

describe('T13-S2-01…S2-04 — temporal recovery', () => {
  it('S2-01 — server advanced while away: FOLLOW_LIVE is persisted as a MODE, and the effective TC is the fresh LH', async () => {
    // Before close: following Live at LH = 30. The record is written by the real writer.
    const before = await harness({ liveHead: 30 });
    await before.ready().recovery.writer.settled();
    const storage = before.recoveryStorage;
    expect(JSON.stringify(await storedFor(storage, USER_1.userId))).not.toContain('30');
    before.dispose();

    // While away the server advanced to 80. After recovery: FOLLOW_LIVE, fresh LH = 80, TC = 80.
    const after = await relaunch(storage, 80, SESSION_A);
    const state = after.ready().store.getState();
    expect(after.ready().recovery.origin).toBe('RESUMED');
    expect(state.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(state.live.LH).toBe(80);
    expect(effectiveTC(state)).toBe(80);
    expect(after.http.creates()).toHaveLength(0);
    after.dispose();
  });

  it('S2-02 — PINNED(t) keeps exactly t, mirrors the fresh LH, and fetches the disclosure at t — never at LH', async () => {
    const storage = await storageWith({ temporal: { kind: 'PINNED', at: 3 } });
    const h = await relaunch(storage, 80);
    const runtime = h.ready();
    const state = runtime.store.getState();
    expect(state.temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(state.live.LH).toBe(80);
    expect(effectiveTC(state)).toBe(3);
    expect(temporalOrientation(state)).toEqual({ mode: 'PINNED', at: 3, effectiveTC: 3, earlierThanLiveHead: true });
    // The reader stands at t: the projection request is for t, and the bootstrap fetched t, not LH.
    expect(mapProjectionRequest(state)?.tc).toBe(3);
    const projections = h.http.matching('/historical-projection');
    expect(projections.length).toBeGreaterThan(0);
    expect(projections.every((call) => new URL(call.url).searchParams.get('tc') === '3')).toBe(true);
    expect(runtime.bundle.projection.lookup(SESSION_B, 3, 'WORLD').status).toBe('FETCHED');
    expect(runtime.bundle.projection.lookup(SESSION_B, 80, 'WORLD').status).toBe('NOT_FETCHED');
    // And nothing moved the reader to the Live Head: the persisted record still says t.
    await runtime.recovery.writer.settled();
    expect((await storedFor(storage, USER_1.userId))?.viewpoint.temporal).toEqual({ kind: 'PINNED', at: 3 });
    h.dispose();
  });

  it('S2-03 — a pinned time beyond the fresh Live Head fails closed; it is never clamped', async () => {
    const storage = await storageWith({ temporal: { kind: 'PINNED', at: 9 } });
    const h = await relaunch(storage, 5);
    const failure = recoveryFailure(h);
    expect(failure.kind).toBe('SESSION_INVALID');
    if (failure.kind === 'SESSION_INVALID') expect(failure.failure).toEqual({ kind: 'VIEWPOINT_INCOHERENT', detail: expect.stringContaining('beyond the authoritative Live Head 5') });
    expect(h.http.creates()).toHaveLength(0);
    // The record was not "repaired" to 5.
    expect((await storedFor(storage, USER_1.userId))?.viewpoint.temporal).toEqual({ kind: 'PINNED', at: 9 });
    h.dispose();
  });

  it('S2-04 — a pinned time in a Session that has no Live Head is impossible, and fails closed', async () => {
    const storage = await storageWith({ temporal: { kind: 'PINNED', at: 1 } });
    const h = await relaunch(storage, null);
    const failure = recoveryFailure(h);
    expect(failure.kind).toBe('SESSION_INVALID');
    if (failure.kind === 'SESSION_INVALID') expect(failure.failure.kind).toBe('VIEWPOINT_INCOHERENT');
    h.dispose();
  });
});

describe('T13-S2-05…S2-07 — inspection and camera recovery', () => {
  it('S2-05 — IF_ref comes back exactly, and the projection under the recovered TC is NOT_FETCHED, not absent', async () => {
    const ref = inspectionRef('reading-7');
    const storage = await storageWith({ temporal: { kind: 'PINNED', at: 4 }, inspection: ref, camera: { ...initialCameraIntent(), depth: 'ANALYTICAL_OBJECT' } });
    const h = await relaunch(storage, 6);
    const runtime = h.ready();
    const state = runtime.store.getState();
    expect(state.inspection).toEqual(ref);
    // No projection at the inspection's rung was guessed or fabricated: it is a technical NOT_FETCHED
    // until the composition fetches it, never a semantic absence and never a rebound reference.
    expect(runtime.bundle.projection.lookup(SESSION_B, 4, 'ANALYTICAL_OBJECT').status).toBe('NOT_FETCHED');
    expect(mapProjectionRequest(state)).toEqual({ sessionId: SESSION_B, tc: 4, depth: 'ANALYTICAL_OBJECT' });
    h.dispose();
  });

  it('S2-06 — MC comes back exactly, at its depth, without a silent retarget', async () => {
    const camera = offsetCamera(1_000_000n, -250_000n);
    const storage = await storageWith({ camera });
    const h = await relaunch(storage, 6);
    const state = h.ready().store.getState();
    expect(state.camera).toEqual(camera);
    expect(state.camera).not.toEqual(initialCameraIntent());
    h.dispose();
  });

  it('S2-07 — an MC the Map cannot decode fails the record closed rather than being repaired', async () => {
    const camera = initialCameraIntent();
    const foreign = { ...camera, anchor: { kind: 'WORLD_ANCHOR', value: { scheme: 'SOMEBODY_ELSES_V9', x: '0', y: '0' } } };
    const storage = await storageWith({ camera: foreign });
    const h = await relaunch(storage, 6);
    expect(recoveryFailure(h)).toMatchObject({ kind: 'RECORD_INVALID', reason: 'INVALID_CAMERA' });
    expect(h.http.calls).toHaveLength(0);
    h.dispose();
  });
});

describe('T13-S2-08…S2-10 — reversible history', () => {
  it('S2-08 — RH survives restart, and BACK_ONE_STEP restores PINNED(capturedTC) from the restored entry', async () => {
    const captured = checkpoint(2, { camera: initialCameraIntent() });
    const storage = await storageWith({ camera: offsetCamera(), history: [captured] });
    const h = await relaunch(storage, 6);
    const runtime = h.ready();
    const state = runtime.store.getState();
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(captured);
    expect(state.temporal).toEqual({ kind: 'FOLLOW_LIVE' });

    const outcome = backOneStep(runtime.returnSurface);
    expect(outcome.outcome).toBe('APPLIED');
    const after = runtime.store.getState();
    // The frozen T-07 semantics hold over restored history: PINNED(capturedTC), the captured camera
    // back exactly, and exactly one entry consumed.
    expect(after.temporal).toEqual({ kind: 'PINNED', at: 2 });
    expect(after.camera).toEqual(initialCameraIntent());
    expect(after.history).toHaveLength(0);
    // And the durable snapshot advanced to the post-Back viewpoint.
    await runtime.recovery.writer.settled();
    const record = await storedFor(storage, USER_1.userId);
    expect(record?.viewpoint.temporal).toEqual({ kind: 'PINNED', at: 2 });
    expect(record?.viewpoint.history).toEqual([]);
    h.dispose();
  });

  it('S2-09 — a malformed checkpoint refuses the whole history and the whole record', async () => {
    const good = checkpoint(2);
    const bad = { ...good, captured: { ...good.captured, tc: 0 } } as unknown as RhEntry;
    const storage = await storageWith({ history: [good, bad] });
    const h = await relaunch(storage, 6);
    expect(recoveryFailure(h)).toMatchObject({ kind: 'RECORD_INVALID', reason: 'INVALID_HISTORY' });
    expect(h.http.calls).toHaveLength(0);
    h.dispose();
  });

  it('S2-10 — a checkpoint beyond the fresh Live Head fails closed; no entry is dropped to make the rest fit', async () => {
    const storage = await storageWith({ history: [checkpoint(2), checkpoint(9)] });
    const h = await relaunch(storage, 5);
    const failure = recoveryFailure(h);
    expect(failure.kind).toBe('SESSION_INVALID');
    if (failure.kind === 'SESSION_INVALID') expect(failure.failure).toEqual({ kind: 'VIEWPOINT_INCOHERENT', detail: expect.stringContaining('history[1]') });
    expect((await storedFor(storage, USER_1.userId))?.viewpoint.history).toHaveLength(2);
    h.dispose();
  });
});

describe('T13-S2-11…S2-13 — what restart intentionally resets', () => {
  it('S2-11 — the pre-restart Exact Return origin does not survive, while Back still does', async () => {
    const ref = inspectionRef('reading-7');
    const origin = checkpoint(2, { act: 'INSPECT_OBJECT', ifRef: null });
    const storage = await storageWith({
      temporal: { kind: 'PINNED', at: 4 },
      inspection: ref,
      camera: { ...initialCameraIntent(), depth: 'ANALYTICAL_OBJECT' },
      history: [origin],
    });
    const h = await relaunch(storage, 6);
    const runtime = h.ready();
    // The reader IS still inspecting and the journey's own checkpoint IS restored…
    expect(runtime.store.getState().inspection).toEqual(ref);
    expect(runtime.store.getState().history[0].act).toBe('INSPECT_OBJECT');
    // …and yet no origin is offered: the capability was process-local, and nothing synthesised one.
    expect(runtime.journey.origin()).toBeNull();
    // Back One Step still works from the restored history, unaliased.
    expect(backOneStep(runtime.returnSurface).outcome).toBe('APPLIED');
    expect(runtime.store.getState().inspection).toBeNull();
    expect(runtime.store.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });
    h.dispose();
  });

  it('S2-12 — foreground delivery cursors start from the fresh snapshot, never from storage', async () => {
    const storage = await storageWith({ temporal: { kind: 'PINNED', at: 3 } });
    const h = await relaunch(storage, 80);
    const runtime = h.ready();
    expect(runtime.bundle.cursors).toEqual({ committedAfterSp: 80, liveFocusAfterSp: 80 });
    expect(runtime.liveDriver.getStatus().cursors).toEqual({ committedAfterSp: 80, liveFocusAfterSp: 80 });
    // The record has no cursor to restore from at all.
    expect(JSON.stringify(await storedFor(storage, USER_1.userId))).not.toMatch(/cursor|AfterSp/u);
    h.dispose();
  });

  it('S2-13 — late work from a retired generation never reaches the durable record', async () => {
    const h = await harness({ liveHead: 4 });
    const runtime = h.ready();
    await runtime.recovery.writer.settled();
    const before = await storedFor(h.recoveryStorage, USER_1.userId);
    await h.runtime.auth.signOut();
    await settle();
    expect(h.phase().kind).toBe('SIGNED_OUT');
    // The old store object still exists in this test's hands; an act on it is late work from a
    // retired generation, and the retired writer records nothing of it.
    expect(runtime.store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(2) }).outcome).toBe('APPLIED');
    await runtime.recovery.writer.settled();
    expect(runtime.recovery.writer.status().attached).toBe(false);
    expect(await storedFor(h.recoveryStorage, USER_1.userId)).toEqual(before);
    h.dispose();
  });
});
