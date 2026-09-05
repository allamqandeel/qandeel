import type { HistoricalDisclosure } from '@qandeel/runtime';
import { HistoricalDisclosureCache } from '../historical-projection-cache';
import { decodeHistoricalDisclosure } from '../historical-projection-wire';
import { disclosure } from './historical-projection-wire.test';

const decoded = (overrides: Record<string, unknown> = {}): HistoricalDisclosure => {
  const result = decodeHistoricalDisclosure(disclosure(overrides));
  if (!result.ok) throw new Error(result.detail);
  return result.value;
};
const SESSION = 'session-1';
const withheld = { status: 'DEPTH_WITHHELD' };
const openHead = (overrides: Record<string, unknown> = {}) => decoded({ tc: 3, sealed: false, depth: 'WORLD', thread: withheld, session: withheld, analyticalObject: withheld, sourceProvenance: withheld, ...overrides });

describe('the Class-B disclosure holder', () => {
  it('NOT_FETCHED is the absence of a fetch, never the absence of history; a held disclosure keeps UNKNOWN and WITHHELD inside it', () => {
    const cache = new HistoricalDisclosureCache();
    expect(cache.lookup(SESSION, 2, 'SOURCE_PROVENANCE')).toEqual({ status: 'NOT_FETCHED' });
    const value = decoded();
    cache.hold(value);
    expect(cache.lookup(SESSION, 2, 'SOURCE_PROVENANCE')).toEqual({ status: 'FETCHED', value, sealed: true });
    expect(cache.lookup(SESSION, 2, 'WORLD')).toEqual({ status: 'NOT_FETCHED' });
    expect(cache.lookup(SESSION, 1, 'SOURCE_PROVENANCE')).toEqual({ status: 'NOT_FETCHED' });
    expect(cache.observedLiveHead(SESSION)).toBe(3);
  });

  it('a typed refusal is held as UNAVAILABLE with its code - not NOT_FETCHED, not unknown', () => {
    const cache = new HistoricalDisclosureCache();
    cache.holdUnavailable('legacy-session', 1, 'WORLD', 'HISTORICAL_COVERAGE_UNAVAILABLE');
    expect(cache.lookup('legacy-session', 1, 'WORLD')).toEqual({ status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' });
    cache.observeRevision('legacy-session', { liveHead: 9, worldVersion: 9, pendingExpiries: 0 });
    expect(cache.lookup('legacy-session', 1, 'WORLD')).toEqual({ status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' });
  });

  it('a sealed disclosure is stable forever; the open head is dropped when a newer revision of the Session is observed', () => {
    const cache = new HistoricalDisclosureCache();
    const sealed = decoded();
    const head = openHead();
    cache.hold(sealed);
    cache.hold(head);
    expect(cache.lookup(SESSION, 3, 'WORLD')).toMatchObject({ status: 'FETCHED', sealed: false });
    cache.observeRevision(SESSION, { liveHead: 3, worldVersion: 12, pendingExpiries: 1 });
    expect(cache.lookup(SESSION, 3, 'WORLD')).toMatchObject({ status: 'FETCHED' });
    cache.observeRevision(SESSION, { liveHead: 3, worldVersion: 13, pendingExpiries: 1 });
    expect(cache.lookup(SESSION, 3, 'WORLD')).toEqual({ status: 'NOT_FETCHED' });
    expect(cache.lookup(SESSION, 2, 'SOURCE_PROVENANCE')).toEqual({ status: 'FETCHED', value: sealed, sealed: true });
    cache.observeRevision(SESSION, { liveHead: 4, worldVersion: 13, pendingExpiries: 0 });
    expect(cache.lookup(SESSION, 2, 'SOURCE_PROVENANCE')).toMatchObject({ status: 'FETCHED' });
    expect(cache.observedLiveHead(SESSION)).toBe(4);
  });

  it('an older revision never rewinds what was observed, and a Live-Head-dependent refusal clears when the Session advances', () => {
    const cache = new HistoricalDisclosureCache();
    cache.hold(openHead());
    cache.observeRevision(SESSION, { liveHead: 2, worldVersion: 11, pendingExpiries: 1 });
    expect(cache.lookup(SESSION, 3, 'WORLD')).toMatchObject({ status: 'FETCHED' });
    cache.holdUnavailable('fresh-session', 1, 'WORLD', 'LIVE_HEAD_NOT_ESTABLISHED');
    cache.observeRevision('fresh-session', { liveHead: 1, worldVersion: 1, pendingExpiries: 0 });
    expect(cache.lookup('fresh-session', 1, 'WORLD')).toEqual({ status: 'NOT_FETCHED' });
  });

  it('forgetting a Session clears exactly that Session', () => {
    const cache = new HistoricalDisclosureCache();
    cache.hold(decoded());
    cache.holdUnavailable('other', 1, 'WORLD', 'SESSION_NOT_VISIBLE');
    cache.forgetSession(SESSION);
    expect(cache.lookup(SESSION, 2, 'SOURCE_PROVENANCE')).toEqual({ status: 'NOT_FETCHED' });
    expect(cache.observedLiveHead(SESSION)).toBeNull();
    expect(cache.lookup('other', 1, 'WORLD')).toMatchObject({ status: 'UNAVAILABLE' });
  });
});
