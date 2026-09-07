/**
 * T-10.0 — the fixture world is wire-legal and strictly no-hindsight: every disclosure it produces
 * passes the REAL T-03C wire validator, derives through the REAL T-04 scene derivation, and
 * contains nothing the record does not know at `TC`.
 */
import { deriveMapSceneFromDisclosure } from '../../map';
import { decodeHistoricalDisclosure, type HistoricalSemanticDepth } from '../../projection';
import { labDisclosureEntry } from '../truth/lab-projection';
import { createLabStore } from '../truth/lab-store';
import { LAB_FINAL_LIVE_HEAD, LAB_INITIAL_LIVE_HEAD, LAB_WORLD, disclosureAt, liveFocusAt, newlyKnownAt } from '../truth/lab-world';

const DEPTHS: readonly HistoricalSemanticDepth[] = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'];

describe('lab world truth', () => {
  test('every (TC, depth) disclosure passes the real wire validator and derives a scene', () => {
    for (let liveHead = 1; liveHead <= LAB_FINAL_LIVE_HEAD; liveHead += 1) {
      for (let tc = 1; tc <= liveHead; tc += 1) {
        for (const depth of DEPTHS) {
          const value = disclosureAt(LAB_WORLD, tc, depth, liveHead);
          const decoded = decodeHistoricalDisclosure(value);
          expect({ liveHead, tc, depth, ok: decoded.ok, detail: decoded.ok ? '' : decoded.detail }).toEqual({ liveHead, tc, depth, ok: true, detail: '' });
          const scene = deriveMapSceneFromDisclosure(value, { sessionId: LAB_WORLD.sessionId, tc: tc as never, depth });
          expect(scene.status).toBe('SCENE');
        }
      }
    }
  });

  test('strict K(TC): nothing established, bound or started after TC is disclosed, whatever the Live Head', () => {
    const value = disclosureAt(LAB_WORLD, 4, 'ANALYTICAL_OBJECT', LAB_FINAL_LIVE_HEAD);
    expect(value.world.threads.map((thread) => thread.id).sort()).toEqual(['thread-east', 'thread-north', 'thread-west']);
    expect(value.thread.status === 'DISCLOSED' ? value.thread.value.threadReadingAppearances.map((appearance) => appearance.bindingId).sort() : null).toEqual(['binding-e1', 'binding-n1', 'binding-n2', 'binding-w1']);
    expect(value.session.status === 'DISCLOSED' ? value.session.value.emergingFocuses : null).toEqual([]);
    expect(value.analyticalObject.status === 'DISCLOSED' ? value.analyticalObject.value.readings.map((reading) => reading.id).sort() : null).toEqual(['reading-east-1', 'reading-north-1', 'reading-north-2', 'reading-west-1']);
    expect(value.sealed).toBe(true);
    // The Live Focus at TC is the one that stood at TC, not the current one.
    expect(value.world.liveFocus).toEqual({ value: { kind: 'THREAD', threadId: 'thread-north' }, atSp: 1 });
  });

  test('the promotion is disclosed only once its establishing Moment is known', () => {
    const before = disclosureAt(LAB_WORLD, 9, 'SESSION', 12);
    const after = disclosureAt(LAB_WORLD, 10, 'SESSION', 12);
    expect(before.session.status === 'DISCLOSED' ? before.session.value.emergingFocuses[0]?.promotedThreadId : undefined).toBeNull();
    expect(after.session.status === 'DISCLOSED' ? after.session.value.emergingFocuses[0]?.promotedThreadId : undefined).toBe('thread-promoted');
    expect(before.world.threads.some((thread) => thread.id === 'thread-promoted')).toBe(false);
    expect(after.world.threads.some((thread) => thread.id === 'thread-promoted')).toBe(true);
  });

  test('a Home never moves for any TC', () => {
    for (const thread of LAB_WORLD.threads) {
      for (let tc = thread.establishedSp; tc <= LAB_FINAL_LIVE_HEAD; tc += 1) {
        const disclosed = disclosureAt(LAB_WORLD, tc, 'WORLD', LAB_FINAL_LIVE_HEAD).world.threads.find((candidate) => candidate.id === thread.id);
        expect(disclosed?.home).toEqual({ x: thread.x, y: thread.y });
      }
    }
  });

  test('the provider refuses a position beyond the mirrored Live Head instead of inventing a world', () => {
    const store = createLabStore(LAB_WORLD, LAB_INITIAL_LIVE_HEAD);
    const state = store.getState();
    expect(labDisclosureEntry(LAB_WORLD, state, { sessionId: LAB_WORLD.sessionId, tc: (LAB_INITIAL_LIVE_HEAD + 1) as never, depth: 'WORLD' })).toEqual({
      status: 'UNAVAILABLE',
      code: 'SESSION_POSITION_NOT_ADDRESSABLE',
    });
    expect(labDisclosureEntry(LAB_WORLD, state, { sessionId: LAB_WORLD.sessionId, tc: LAB_INITIAL_LIVE_HEAD as never, depth: 'WORLD' }).status).toBe('FETCHED');
  });

  test('the store starts following live with the Live Focus of the initial head, and live advances deliver the scripted transitions', () => {
    const store = createLabStore(LAB_WORLD, LAB_INITIAL_LIVE_HEAD);
    expect(store.getState().live.LF.value).toEqual(liveFocusAt(LAB_WORLD, LAB_INITIAL_LIVE_HEAD)?.value);
    expect(newlyKnownAt(LAB_WORLD, 10)).toEqual({ threadIds: ['thread-promoted'], bindingIds: [] });
    expect(newlyKnownAt(LAB_WORLD, 9)).toEqual({ threadIds: [], bindingIds: ['binding-n3'] });
  });
});
