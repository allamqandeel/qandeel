/**
 * T-13 — Slice 1, through the REAL integration owner: the fresh path, the resume path through the
 * existing `existingSessionId` seam, the readiness gate, every fail-closed refusal, and identity
 * isolation. The storage double stands in for a storage that survived a process death: the same
 * object is handed to a SECOND runtime, which is exactly what a relaunch sees.
 *
 * A launch that starts signed out is signed in through the EXPLICIT path (`signInWithPassword`),
 * because the auth authority correctly refuses to let an observed `SIGNED_IN` establish authentication
 * across a retired epoch — the R2-01 rule, which these tests must respect rather than work around.
 */
import { initialCameraIntent } from '../../map';
import { sessionPosition } from '../../state';
import { PRODUCT_RECOVERY_SCHEMA_VERSION, createEphemeralProductRecoveryStorage, namespaceKeyFor, type ProductRecoveryStorage } from '../../recovery';
import { gate } from '../../runtime-entry/__fixtures__/runtime-entry';
import { harness, settle, snapshot, SESSION_A, SESSION_B, worldDisclosure, type IntegrationHarness } from '../__fixtures__/integration';
import type { IntegrationPhase } from '../runtime/integration-runtime';

const USER_1 = { userId: 'user-1', accessToken: 'token-1' };
const USER_2 = { userId: 'user-2', accessToken: 'token-2' };

/** The raw record stored for one owner, parsed. */
const storedFor = async (storage: ProductRecoveryStorage, userId: string) => {
  const text = await storage.getItem(namespaceKeyFor(userId));
  return text === null ? null : (JSON.parse(text) as { sessionId: string; sequence: number; ownerUserId: string; viewpoint: Record<string, unknown> });
};

/** A storage already holding a legal record for `userId`, as a previous launch would have left it. */
async function storageWithRecord(userId: string, sessionId: string, viewpoint: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  const storage = createEphemeralProductRecoveryStorage();
  await storage.setItem(
    namespaceKeyFor(userId),
    JSON.stringify({
      schemaVersion: PRODUCT_RECOVERY_SCHEMA_VERSION,
      ownerUserId: userId,
      sessionId,
      viewpoint: { temporal: { kind: 'FOLLOW_LIVE' }, inspection: null, camera: initialCameraIntent(), history: [], ...viewpoint },
      sequence: 3,
      ...over,
    }),
  );
  return storage;
}

/** Register the routes a RESUME needs for one Session, and deliberately NO create route. */
function serveResume(h: IntegrationHarness, sessionId: string, liveHead: number) {
  h.http.on('/temporal', () => ({ status: 200, body: snapshot({ sessionId, liveHead, liveFocusAtSp: liveHead }) }));
  h.http.on('/temporal/events', () => ({ status: 200, body: { sessionId, events: [] } }));
  h.http.on('/temporal/live-focus-events', () => ({ status: 200, body: { sessionId, events: [] } }));
  h.http.on('/historical-projection', () => ({ status: 200, body: worldDisclosure(sessionId, liveHead, liveHead) }));
}

/** A create route that mints one Session per identity, so a second create is observable as a DIFFERENT id. */
function serveCreates(h: IntegrationHarness) {
  h.http.on('/conversation/sessions', (request) => ({
    status: 201,
    body: { id: request.authorization === `Bearer ${USER_1.accessToken}` ? SESSION_A : SESSION_B, status: 'ACTIVE' },
  }));
  h.http.on('/temporal', (request) => ({ status: 200, body: snapshot({ sessionId: request.url.includes(SESSION_A) ? SESSION_A : SESSION_B, liveHead: null }) }));
}

/** The explicit sign-in path, which is the only one that may establish authentication after a signed-out launch. */
async function signIn(h: IntegrationHarness, user: typeof USER_1) {
  h.auth.signInWith({ ok: true, value: user });
  await h.runtime.auth.signInWithPassword('validation identity', 'validation credential');
  await settle();
}

const phases = (h: IntegrationHarness) => {
  const seen: IntegrationPhase['kind'][] = [h.phase().kind];
  h.runtime.subscribe(() => seen.push(h.phase().kind));
  return seen;
};

describe('T13-S1-01…S1-04 — fresh and resumed paths', () => {
  it('S1-01 — no record: the existing clean bootstrap runs, ONE Session is created, and the locator is then written', async () => {
    const h = await harness();
    const runtime = h.ready();
    expect(h.http.creates()).toHaveLength(1);
    expect(runtime.recovery.origin).toBe('FRESH');
    await runtime.recovery.writer.settled();
    const record = await storedFor(h.recoveryStorage, USER_1.userId);
    expect(record?.sessionId).toBe(SESSION_A);
    expect(record?.ownerUserId).toBe(USER_1.userId);
    expect(record?.viewpoint.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    // Nothing server-authoritative and no credential was copied into durable Product recovery.
    expect(JSON.stringify(record)).not.toMatch(/"LH"|"LF"|liveHead|accessToken|token-1/u);
    h.dispose();
  });

  it('S1-02 — a valid record RESUMES its Session through the existing seam: zero creates, the snapshot validates it', async () => {
    const storage = await storageWithRecord(USER_1.userId, SESSION_B);
    const h = await harness({ serve: false, recoveryStorage: storage, initialSession: null });
    serveResume(h, SESSION_B, 5);
    await signIn(h, USER_1);
    const runtime = h.ready();
    expect(h.http.creates()).toHaveLength(0);
    expect(runtime.bundle.sessionId).toBe(SESSION_B);
    expect(runtime.recovery.origin).toBe('RESUMED');
    expect(h.http.matching(`/conversation/sessions/${SESSION_B}/temporal`).length).toBeGreaterThan(0);
    // Fresh server truth, not stored truth: the record carried no Live Head at all.
    expect(runtime.store.getState().live.LH).toBe(5);
    expect(runtime.store.getState().session.id).toBe(SESSION_B);
    h.dispose();
  });

  it('S1-03 — a resumed launch the server refuses creates no replacement Session and stays RECOVERY_FAILED', async () => {
    for (const status of [401, 403, 404]) {
      const storage = await storageWithRecord(USER_1.userId, SESSION_B);
      const h = await harness({ serve: false, recoveryStorage: storage, initialSession: null });
      h.http.on('/conversation/sessions', () => ({ status: 201, body: { id: SESSION_A, status: 'ACTIVE' } }));
      h.http.on('/temporal', () => ({ status, body: {} }));
      await signIn(h, USER_1);
      const phase = h.phase();
      expect(phase.kind).toBe('RECOVERY_FAILED');
      if (phase.kind === 'RECOVERY_FAILED') {
        expect(phase.failure.kind).toBe('SESSION_INVALID');
        if (phase.failure.kind === 'SESSION_INVALID') expect(phase.failure.failure.kind).toBe('SNAPSHOT');
      }
      expect(h.http.creates()).toHaveLength(0);
      // The record is left as it was: nothing "repaired" it and nothing replaced it.
      expect((await storedFor(storage, USER_1.userId))?.sessionId).toBe(SESSION_B);
      h.dispose();
    }
  });

  it('S1-04 — a snapshot naming a different Session than the record is refused, and no store is built', async () => {
    const storage = await storageWithRecord(USER_1.userId, SESSION_B);
    const h = await harness({ serve: false, recoveryStorage: storage, initialSession: null });
    h.http.on('/temporal', () => ({ status: 200, body: snapshot({ sessionId: SESSION_A, liveHead: 1 }) }));
    await signIn(h, USER_1);
    expect(h.phase().kind).toBe('RECOVERY_FAILED');
    expect(h.http.creates()).toHaveLength(0);
    h.dispose();
  });
});

describe('T13-S1-05…S1-09 — the readiness gate and fail-closed records', () => {
  it('S1-05 — READY is never published before the authoritative snapshot has answered', async () => {
    const storage = await storageWithRecord(USER_1.userId, SESSION_B);
    const h = await harness({ serve: false, recoveryStorage: storage, initialSession: null });
    const held = gate();
    serveResume(h, SESSION_B, 7);
    h.http.on('/temporal', async () => {
      await held.wait();
      return { status: 200, body: snapshot({ sessionId: SESSION_B, liveHead: 7, liveFocusAtSp: 7 }) };
    });
    const seen = phases(h);
    h.auth.signInWith({ ok: true, value: USER_1 });
    const signing = h.runtime.auth.signInWithPassword('validation identity', 'validation credential');
    await settle();
    // The record has been loaded and the Session is being validated; nothing is READY, and there is
    // no store anywhere to render a stale world from.
    expect(seen).toEqual(['SIGNED_OUT', 'RECOVERING', 'BOOTSTRAPPING']);
    expect(h.phase().kind).toBe('BOOTSTRAPPING');
    held.open();
    await signing;
    await settle();
    expect(seen[seen.length - 1]).toBe('READY');
    expect(seen.filter((kind) => kind === 'READY')).toHaveLength(1);
    expect(seen.indexOf('READY')).toBeGreaterThan(seen.indexOf('BOOTSTRAPPING'));
    h.dispose();
  });

  it('S1-06 — a corrupt record fails closed: RECOVERY_FAILED, no Session created, record untouched', async () => {
    const storage = createEphemeralProductRecoveryStorage();
    await storage.setItem(namespaceKeyFor(USER_1.userId), '{"schemaVersion":1,"ownerUserId":"user-1",');
    const h = await harness({ recoveryStorage: storage });
    const phase = h.phase();
    expect(phase.kind).toBe('RECOVERY_FAILED');
    if (phase.kind === 'RECOVERY_FAILED') expect(phase.failure).toMatchObject({ kind: 'RECORD_INVALID', reason: 'MALFORMED_PAYLOAD' });
    expect(h.http.calls).toHaveLength(0);
    expect(await storage.getItem(namespaceKeyFor(USER_1.userId))).toBe('{"schemaVersion":1,"ownerUserId":"user-1",');
    h.dispose();
  });

  it('S1-07 — an unknown future schema version fails closed as INCOMPATIBLE_SCHEMA', async () => {
    const storage = await storageWithRecord(USER_1.userId, SESSION_B, {}, { schemaVersion: PRODUCT_RECOVERY_SCHEMA_VERSION + 1 });
    const h = await harness({ recoveryStorage: storage });
    const phase = h.phase();
    expect(phase.kind).toBe('RECOVERY_FAILED');
    if (phase.kind === 'RECOVERY_FAILED') expect(phase.failure).toMatchObject({ kind: 'RECORD_INVALID', reason: 'INCOMPATIBLE_SCHEMA' });
    expect(h.http.calls).toHaveLength(0);
    h.dispose();
  });

  it('S1-08 — a partial record (a missing semantic field) is refused whole, never loaded field by field', async () => {
    const storage = createEphemeralProductRecoveryStorage();
    await storage.setItem(
      namespaceKeyFor(USER_1.userId),
      JSON.stringify({ schemaVersion: 1, ownerUserId: USER_1.userId, sessionId: SESSION_B, viewpoint: { temporal: { kind: 'FOLLOW_LIVE' }, inspection: null, history: [] }, sequence: 1 }),
    );
    const h = await harness({ recoveryStorage: storage });
    expect(h.phase().kind).toBe('RECOVERY_FAILED');
    expect(h.http.calls).toHaveLength(0);
    h.dispose();
  });

  it('S1-09 — a storage that cannot be read fails closed rather than minting a Session blindly', async () => {
    const storage: ProductRecoveryStorage = {
      getItem: async () => {
        throw new Error('database locked');
      },
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    const h = await harness({ recoveryStorage: storage });
    const phase = h.phase();
    expect(phase.kind).toBe('RECOVERY_FAILED');
    if (phase.kind === 'RECOVERY_FAILED') expect(phase.failure).toEqual({ kind: 'STORAGE_UNAVAILABLE', detail: 'database locked' });
    expect(h.http.creates()).toHaveLength(0);
    h.dispose();
  });
});

describe('T13-S1-10…S1-13 — identity', () => {
  it('S1-10 — a signed-out launch reads no Product recovery at all', async () => {
    const reads: string[] = [];
    const storage: ProductRecoveryStorage = {
      getItem: async (key) => {
        reads.push(key);
        return null;
      },
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    const h = await harness({ initialSession: null, recoveryStorage: storage });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    expect(reads).toEqual([]);
    expect(h.http.calls).toHaveLength(0);
    h.dispose();
  });

  it('S1-11 — A -> B replacement: only B’s namespace is read, A’s Session is never reused, and A’s record survives', async () => {
    const h = await harness({ serve: false, initialSession: null });
    serveCreates(h);
    await signIn(h, USER_1);
    const first = h.ready();
    expect(first.bundle.sessionId).toBe(SESSION_A);
    await first.recovery.writer.settled();

    // A DIFFERENT identity replaces A while A is live: T-12P retires the generation, this owner too.
    h.auth.emit(USER_2, 'SIGNED_IN');
    await settle();
    const second = h.ready();
    expect(second.bundle.sessionId).toBe(SESSION_B);
    expect(second.recovery.origin).toBe('FRESH');
    expect(h.http.creates()).toHaveLength(2);
    expect(h.http.creates()[1].authorization).toBe(`Bearer ${USER_2.accessToken}`);
    await second.recovery.writer.settled();

    // Two namespaces, two records, and neither names the other's Session.
    expect((await storedFor(h.recoveryStorage, USER_1.userId))?.sessionId).toBe(SESSION_A);
    expect((await storedFor(h.recoveryStorage, USER_2.userId))?.sessionId).toBe(SESSION_B);
    h.dispose();
  });

  it('S1-12 — A -> sign out -> B -> sign out -> A: A resumes A’s own record, and B never saw it', async () => {
    const h = await harness({ serve: false, initialSession: null });
    serveCreates(h);
    await signIn(h, USER_1);
    await h.ready().recovery.writer.settled();
    await h.runtime.auth.signOut();
    await settle();
    expect(h.phase().kind).toBe('SIGNED_OUT');
    // Signed out: the record stays stored and nothing reads it.
    expect((await storedFor(h.recoveryStorage, USER_1.userId))?.sessionId).toBe(SESSION_A);

    await signIn(h, USER_2);
    expect(h.ready().bundle.sessionId).toBe(SESSION_B);
    expect(h.ready().recovery.origin).toBe('FRESH');
    await h.runtime.auth.signOut();
    await settle();

    await signIn(h, USER_1);
    const again = h.ready();
    expect(again.bundle.sessionId).toBe(SESSION_A);
    expect(again.recovery.origin).toBe('RESUMED');
    // Two creates in total — one per identity — and never a third.
    expect(h.http.creates()).toHaveLength(2);
    h.dispose();
  });

  it('S1-13 — a record that names another owner under this owner’s key is refused, never resumed', async () => {
    const storage = await storageWithRecord(USER_1.userId, SESSION_B, {}, { ownerUserId: USER_2.userId });
    const h = await harness({ recoveryStorage: storage });
    const phase = h.phase();
    expect(phase.kind).toBe('RECOVERY_FAILED');
    if (phase.kind === 'RECOVERY_FAILED') expect(phase.failure).toMatchObject({ kind: 'RECORD_INVALID', reason: 'OWNER_MISMATCH' });
    expect(h.http.calls).toHaveLength(0);
    h.dispose();
  });
});

describe('T13-S1-14 — the durable snapshot advances after READY, and only on Product acts', () => {
  it('S1-14 — a pinned commit advances the record; a passive Live Head delivery does not', async () => {
    const h = await harness({ liveHead: 4 });
    const runtime = h.ready();
    await runtime.recovery.writer.settled();
    const before = await storedFor(h.recoveryStorage, USER_1.userId);
    expect(runtime.store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(6) }).outcome).toBe('APPLIED');
    await runtime.recovery.writer.settled();
    expect((await storedFor(h.recoveryStorage, USER_1.userId))?.sequence).toBe(before?.sequence);

    expect(runtime.store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(2) }).outcome).toBe('APPLIED');
    await runtime.recovery.writer.settled();
    const after = await storedFor(h.recoveryStorage, USER_1.userId);
    expect(after?.sequence).toBe((before?.sequence ?? 0) + 1);
    expect(after?.viewpoint.temporal).toEqual({ kind: 'PINNED', at: 2 });
    expect(JSON.stringify(after)).not.toContain('"LH"');
    h.dispose();
  });
});
