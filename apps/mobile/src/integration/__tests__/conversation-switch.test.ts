/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — switching conversations inside ONE
 * authentication generation: New Chat and reopening run through the one bootstrap path, retire the outgoing session
 * runtime as a whole, move the T-13 locator only when the opened Session is READY, decline while work is pending, and
 * never create a second Session for an already-open one.
 */
import { createProductRecoveryStore } from '../../recovery';
import { effectiveTC } from '../../state';
import { harness, settle, SESSION_A, SESSION_B, snapshot, worldDisclosure, type IntegrationHarness } from '../__fixtures__/integration';

const sessionOf = (url: string): string => url.match(/\/conversation\/sessions\/([^/?]+)/u)?.[1] ?? SESSION_A;
const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id, user_id: 'user-1', status: 'ACTIVE', channel: 'TEXT', created_at: '2026-01-01T00:00:00.000Z', updated_at: 'n', last_activity_at: 'n', closed_at: null,
  client_request_id: null, title: null, title_at: null, opening: null, last_turn_at: null, turn_count: 0, ...extra,
});

/** Two Sessions the server knows: A (the launch one) and B (listed, openable, or minted for a New Chat). */
function serveTwoSessions(h: IntegrationHarness, options: { readonly refuseB?: boolean } = {}) {
  h.http.on('/conversation/sessions', (request) => {
    if (request.method === 'GET') return { status: 200, body: [row(SESSION_B, { opening: 'second words', turn_count: 2 }), row(SESSION_A, { title: 'First' })] };
    const body = JSON.parse(request.body ?? '{}') as { clientRequestId?: string };
    return { status: 201, body: row(body.clientRequestId === undefined ? SESSION_A : SESSION_B, { client_request_id: body.clientRequestId ?? null }) };
  });
  h.http.on('/temporal', (request) => {
    const id = sessionOf(request.url);
    if (options.refuseB === true && id === SESSION_B) return { status: 500, body: {} };
    return { status: 200, body: snapshot({ sessionId: id, liveHead: 1 }) };
  });
  h.http.on('/temporal/events', (request) => ({ status: 200, body: { sessionId: sessionOf(request.url), events: [] } }));
  h.http.on('/temporal/live-focus-events', (request) => ({ status: 200, body: { sessionId: sessionOf(request.url), events: [] } }));
  h.http.on('/historical-projection', (request) => ({ status: 200, body: worldDisclosure(sessionOf(request.url), 1, 1) }));
  h.http.on('/title', (request) => ({ status: 200, body: { session_id: sessionOf(request.url), title: (JSON.parse(request.body ?? '{}') as { title: string }).title.trim(), created_at: 'n' } }));
}

const locatorOf = async (h: IntegrationHarness): Promise<string> => JSON.stringify(await createProductRecoveryStore(h.recoveryStorage).load('user-1'));

describe('Slice B — New Chat', () => {
  it('creates ONE new Session with the request identity, replaces the whole session runtime, and moves the T-13 locator', async () => {
    const h = await harness();
    serveTwoSessions(h);
    const first = h.ready();
    await first.recovery.writer.settled();
    expect(await locatorOf(h)).toContain(SESSION_A);

    await expect(h.runtime.switchConversation({ kind: 'NEW', clientRequestId: 'request-1' })).resolves.toBe('SWITCHED');
    await settle();
    const second = h.ready();
    expect(second.bundle.sessionId).toBe(SESSION_B);
    expect(second.generation).not.toBe(first.generation);
    expect(second.store).not.toBe(first.store);
    expect(second.recovery.origin).toBe('NEW');
    // Exactly one more create, carrying the request identity and nothing else.
    const creates = h.http.creates();
    expect(creates).toHaveLength(2);
    expect(JSON.parse(creates[1].body ?? '{}')).toEqual({ clientRequestId: 'request-1' });
    // The outgoing generation is retired as a whole: nothing of it applies late.
    expect(first.recovery.writer.status().attached).toBe(false);
    expect(first.projection.inFlightCount()).toBe(0);
    expect(first.spatialCause.isArmed()).toBe(false);
    // The identity's ONE active locator is now the new Session, written above the old sequence.
    await second.recovery.writer.settled();
    expect(await locatorOf(h)).toContain(SESSION_B);
    expect(second.recovery.writer.status().lastSequence).toBeGreaterThan(first.recovery.writer.status().lastSequence);
    // The catalog of the new generation names the new Session as the open one, and the list is the server's.
    expect(second.catalog.getState().currentSessionId).toBe(SESSION_B);
    second.catalog.refresh();
    await settle();
    expect(second.catalog.getState().entries.map((entry) => entry.sessionId)).toEqual([SESSION_B, SESSION_A]);
    h.dispose();
  });

  it('a switch to the Session already open creates nothing and changes nothing', async () => {
    const h = await harness();
    serveTwoSessions(h);
    const first = h.ready();
    await expect(h.runtime.switchConversation({ kind: 'OPEN', sessionId: SESSION_A })).resolves.toBe('SWITCHED');
    await settle();
    expect(h.ready()).toBe(first);
    expect(h.http.creates()).toHaveLength(1);
    h.dispose();
  });
});

describe('Slice B — reopening a listed conversation', () => {
  it('opens through the existing-Session seam with no create, validated by the server snapshot', async () => {
    const h = await harness();
    serveTwoSessions(h);
    const first = h.ready();
    await expect(h.runtime.switchConversation({ kind: 'OPEN', sessionId: SESSION_B })).resolves.toBe('SWITCHED');
    await settle();
    const second = h.ready();
    expect(second.bundle.sessionId).toBe(SESSION_B);
    expect(second.recovery.origin).toBe('OPENED');
    expect(h.http.creates()).toHaveLength(1);
    expect(first.recovery.writer.status().attached).toBe(false);
    // Back again: the first conversation is still there, untouched by the second (no erase, no replace).
    await expect(h.runtime.switchConversation({ kind: 'OPEN', sessionId: SESSION_A })).resolves.toBe('SWITCHED');
    await settle();
    expect(h.ready().bundle.sessionId).toBe(SESSION_A);
    expect(h.http.creates()).toHaveLength(1);
    h.dispose();
  });

  // COSMOS E-2 Slice A (D-3): "Open where it began" opens the other conversation AT the Thread's establishing position.
  it('opened at a position (Slice A, Open where it began), the new runtime stands at that Session Position, not the live edge', async () => {
    const h = await harness();
    serveTwoSessions(h);
    h.http.on('/temporal', (request) => ({ status: 200, body: snapshot({ sessionId: sessionOf(request.url), liveHead: 3 }) }));
    h.http.on('/historical-projection', (request) => ({ status: 200, body: worldDisclosure(sessionOf(request.url), Number(new URL(request.url).searchParams.get('tc') ?? 3), 3) }));
    await expect(h.runtime.switchConversation({ kind: 'OPEN', sessionId: SESSION_B, sp: 2 })).resolves.toBe('SWITCHED');
    await settle();
    const opened = h.ready();
    expect(opened.bundle.sessionId).toBe(SESSION_B);
    expect(effectiveTC(opened.store.getState())).toBe(2);
    // Without a position the opened conversation stands at its live edge, as before.
    await expect(h.runtime.switchConversation({ kind: 'OPEN', sessionId: SESSION_A })).resolves.toBe('SWITCHED');
    await settle();
    expect(effectiveTC(h.ready().store.getState())).toBe(3);
    h.dispose();
  });

  it('a Session the server refuses leaves the ordinary BOOTSTRAP_FAILED phase and the locator where it was', async () => {
    const h = await harness();
    serveTwoSessions(h, { refuseB: true });
    const first = h.ready();
    await first.recovery.writer.settled();
    await expect(h.runtime.switchConversation({ kind: 'OPEN', sessionId: SESSION_B })).resolves.toBe('FAILED');
    await settle();
    expect(h.phase().kind).toBe('BOOTSTRAP_FAILED');
    // The recorded active conversation is still the first: the next launch recovers it.
    expect(await locatorOf(h)).toContain(SESSION_A);
    expect(await locatorOf(h)).not.toContain(SESSION_B);
    h.dispose();
  });
});

describe('Slice B — when a switch is declined', () => {
  it('is NOT_READY when nobody is signed in, and BUSY while a message is still being sent', async () => {
    const h = await harness();
    serveTwoSessions(h);
    const first = h.ready();
    // A send that never answers: the submission stays pending.
    h.http.on('/turns', () => new Promise(() => undefined));
    first.conversation.setDraft('hello');
    first.conversation.send();
    await settle();
    expect(first.conversation.getState().submission).not.toBeNull();
    await expect(h.runtime.switchConversation({ kind: 'OPEN', sessionId: SESSION_B })).resolves.toBe('BUSY');
    expect(h.ready()).toBe(first);
    h.auth.emit(null, 'SIGNED_OUT');
    await settle();
    await expect(h.runtime.switchConversation({ kind: 'NEW', clientRequestId: 'request-2' })).resolves.toBe('NOT_READY');
    expect(h.http.creates()).toHaveLength(1);
    h.dispose();
  });
});
