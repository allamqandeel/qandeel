/**
 * S7-03 — the read-only Replay history client: the three S7-01 reads, decoded strictly, over the REAL-PATH wire
 * (`replay-composite/__fixtures__/replay-wire.json`: PostgreSQL 0169 wrappers → the real ReplayService), and the planted
 * defects that make an answer unusable whole.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import {
  REPLAY_HISTORY_DEPTHS,
  ReplayHistoryApiClient,
  decodeReplayMomentAnalysis,
  decodeReplayMoments,
  decodeReplayVersion,
} from '../replay-history-api';

const WIRE = require('../../replay-composite/__fixtures__/replay-wire.json') as {
  scenes: Record<string, { replayId: string; versionId: string; version: unknown; moments: { moments: { ordinal: number; tc: number }[] } & Record<string, unknown>; analysis: Record<string, Record<string, unknown>> }>;
};
const MAIN = WIRE.scenes.main;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('S7-03 — decoding the real-path Replay wire', () => {
  it('decodes every captured scene, every moment and every depth', () => {
    for (const scene of Object.values(WIRE.scenes)) {
      expect(decodeReplayVersion(scene.version, scene.replayId, scene.versionId).kind).toBe('FOUND');
      expect(decodeReplayMoments(scene.moments).kind).toBe('FOUND');
      for (const [ordinal, byDepth] of Object.entries(scene.analysis)) {
        for (const depth of REPLAY_HISTORY_DEPTHS) {
          const decoded = decodeReplayMomentAnalysis(byDepth[depth], Number(ordinal), depth);
          expect(decoded.kind).toBe('ANSWERED');
        }
      }
    }
  });

  it('keeps the exact committed text, role, medium and coordinates of every moment', () => {
    const decoded = decodeReplayMoments(MAIN.moments);
    if (decoded.kind !== 'FOUND') throw new Error('expected moments');
    expect(decoded.moments).toEqual(MAIN.moments.moments);
  });

  it('carries the frozen depth law: disclosed at or below the depth, withheld above it', () => {
    REPLAY_HISTORY_DEPTHS.forEach((depth, level) => {
      const decoded = decodeReplayMomentAnalysis(MAIN.analysis['3'][depth], 3, depth);
      if (decoded.kind !== 'ANSWERED' || decoded.analysis.outcome !== 'AVAILABLE') throw new Error('expected an analysis');
      const rungs = [decoded.analysis.thread, decoded.analysis.session, decoded.analysis.analyticalObject, decoded.analysis.sourceProvenance];
      rungs.forEach((rung, index) => expect(rung.status).toBe(index + 1 <= level ? 'DISCLOSED' : 'DEPTH_WITHHELD'));
    });
  });

  it('reads the bounded states as the real path answered them', () => {
    const notViewable = WIRE.scenes.notViewable;
    const version = decodeReplayVersion(notViewable.version, notViewable.replayId, notViewable.versionId);
    expect(version.kind === 'FOUND' && version.version.viewing).toEqual({
      state: 'NOT_VIEWABLE', notViewableClass: 'SOURCE_NOT_CURRENTLY_AVAILABLE', sourceLayer: 'NOT_DEREFERENCEABLE', analyticalLayer: 'SEALED_HISTORICAL_EVIDENCE',
    });
    const moments = decodeReplayMoments(notViewable.moments);
    expect(moments.kind === 'FOUND' && moments.moments.every((moment) => moment.text === null)).toBe(true);
    expect(decodeReplayMomentAnalysis(WIRE.scenes.analysisMoved.analysis['2'].WORLD, 2, 'WORLD'))
      .toEqual({ kind: 'ANSWERED', analysis: { outcome: 'ANALYSIS_NOT_CURRENTLY_AVAILABLE', ordinal: 2, tc: 2 } });
  });

  describe('planted defects are refused whole', () => {
    const analysis = (mutate: (body: Record<string, any>) => void, depth: HistoricalSemanticDepth = 'SOURCE_PROVENANCE', ordinal = 4) => {
      const body = clone(MAIN.analysis[String(ordinal)][depth]) as Record<string, any>;
      mutate(body);
      return decodeReplayMomentAnalysis(body, ordinal, depth).kind;
    };
    it('knowledge from after the moment (a Thread established later)', () => {
      expect(analysis((body) => { body.world.threads[0].establishedSp = 5; })).toBe('UNAVAILABLE');
    });
    it('a Live Focus effective after the moment', () => {
      expect(analysis((body) => { body.world.liveFocus.atSp = 9; })).toBe('UNAVAILABLE');
    });
    it('an analysis of another moment, or at another depth', () => {
      expect(decodeReplayMomentAnalysis(MAIN.analysis['4'].WORLD, 3, 'WORLD').kind).toBe('UNAVAILABLE');
      expect(decodeReplayMomentAnalysis(MAIN.analysis['4'].WORLD, 4, 'THREAD').kind).toBe('UNAVAILABLE');
    });
    it('a withheld rung that arrives disclosed, and a disclosed one that arrives withheld', () => {
      expect(analysis((body) => { body.thread = { status: 'DISCLOSED', value: { threadReadingAppearances: [] } }; }, 'WORLD')).toBe('UNAVAILABLE');
      expect(analysis((body) => { body.session = { status: 'DEPTH_WITHHELD' }; })).toBe('UNAVAILABLE');
    });
    it('an extra field, a K(TC) header, a Session Moment, a Turn id or a Material expiry', () => {
      expect(analysis((body) => { body.sessionId = 'x'; })).toBe('UNAVAILABLE');
      expect(analysis((body) => { body.session.value.moments = []; })).toBe('UNAVAILABLE');
      expect(analysis((body) => { body.world.threads[0].label = 'invented'; })).toBe('UNAVAILABLE');
    });
    it('S7-05 F-2: a Reading scope that names a Session, or is anything but its class', () => {
      expect(analysis(() => undefined)).toBe('ANSWERED');
      const scopes = (body: Record<string, any>) => body.analyticalObject.value.readings as Record<string, unknown>[];
      expect(analysis((body) => { expect(scopes(body).length).toBeGreaterThan(0); })).toBe('ANSWERED');
      for (const scope of [`CONVERSATION_SESSION:${MAIN.replayId}`, 'CONVERSATION_SESSION:', 'conversation_session', 'USER', '']) {
        expect(analysis((body) => { scopes(body)[0].scope = scope; })).toBe('UNAVAILABLE');
      }
      expect(analysis((body) => { delete scopes(body)[0].scope; })).toBe('UNAVAILABLE');
    });
    it('a moment list out of chronology, a gap before the first moment, or text for only some moments', () => {
      const moments = (mutate: (body: Record<string, any>) => void) => {
        const body = clone(MAIN.moments) as Record<string, any>;
        mutate(body);
        return decodeReplayMoments(body).kind;
      };
      expect(moments((body) => { body.moments[1].tc = 1; })).toBe('UNAVAILABLE');
      expect(moments((body) => { body.moments[0].omittedBefore = 1; })).toBe('UNAVAILABLE');
      expect(moments((body) => { body.moments[2].text = null; })).toBe('UNAVAILABLE');
      expect(moments((body) => { body.moments[2].text = ''; })).toBe('UNAVAILABLE');
    });
    it('a version of another Replay, or a viewable version with a reason', () => {
      expect(decodeReplayVersion(MAIN.version, WIRE.scenes.part.replayId === MAIN.replayId ? '00000000-0000-4000-8000-000000000000' : WIRE.scenes.part.replayId, MAIN.versionId).kind).toBe('UNAVAILABLE');
      const version = clone(MAIN.version) as Record<string, any>;
      version.viewing.notViewableClass = 'VERSION_SUPERSEDED';
      expect(decodeReplayVersion(version, MAIN.replayId, MAIN.versionId).kind).toBe('UNAVAILABLE');
    });
    it('the one-key UNAVAILABLE body is NOT_FOUND, never a decoding failure', () => {
      expect(decodeReplayVersion({ outcome: 'UNAVAILABLE' }, MAIN.replayId, MAIN.versionId)).toEqual({ kind: 'NOT_FOUND' });
      expect(decodeReplayMoments({ outcome: 'UNAVAILABLE' })).toEqual({ kind: 'NOT_FOUND' });
      expect(decodeReplayMomentAnalysis({ outcome: 'UNAVAILABLE' }, 1, 'WORLD')).toEqual({ kind: 'NOT_FOUND' });
    });
  });
});

describe('S7-03 — the client: three GETs and nothing else', () => {
  const calls: { url: string; init: unknown }[] = [];
  const fetch = jest.fn(async (url: string, init?: unknown) => {
    calls.push({ url, init });
    const path = url.replace('https://api.test', '');
    const route = /^\/replay\/([^/]+)\/versions\/([^/?]+)(\/moments(?:\/(\d+)\/analysis\?depth=([A-Z_]+))?)?$/u.exec(path);
    if (route === null) return { ok: false, status: 404, json: async () => ({}) };
    const body = route[3] === undefined ? MAIN.version : route[4] === undefined ? MAIN.moments : MAIN.analysis[route[4]][route[5]];
    return { ok: true, status: 200, json: async () => body };
  });
  const client = new ReplayHistoryApiClient({ baseUrl: 'https://api.test', fetch: fetch as never });

  it('reads the version, the moments and one moment analysis by GET, with no identity in the request', async () => {
    expect((await client.version(MAIN.replayId, MAIN.versionId)).kind).toBe('FOUND');
    expect((await client.moments(MAIN.replayId, MAIN.versionId)).kind).toBe('FOUND');
    expect((await client.momentAnalysis(MAIN.replayId, MAIN.versionId, 3, 'THREAD')).kind).toBe('ANSWERED');
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.test/replay/${MAIN.replayId}/versions/${MAIN.versionId}`,
      `https://api.test/replay/${MAIN.replayId}/versions/${MAIN.versionId}/moments`,
      `https://api.test/replay/${MAIN.replayId}/versions/${MAIN.versionId}/moments/3/analysis?depth=THREAD`,
    ]);
    for (const call of calls) expect(call.init).toEqual({ method: 'GET', headers: { Accept: 'application/json' } });
  });

  it('a failed exchange is UNAVAILABLE and never an empty history', async () => {
    const failing = new ReplayHistoryApiClient({ baseUrl: 'https://api.test', fetch: (async () => { throw new Error('offline'); }) as never });
    expect(await failing.momentAnalysis(MAIN.replayId, MAIN.versionId, 1, 'WORLD')).toEqual({ kind: 'UNAVAILABLE' });
    const refusing = new ReplayHistoryApiClient({ baseUrl: 'https://api.test', fetch: (async () => ({ ok: false, status: 503, json: async () => ({}) })) as never });
    expect(await refusing.moments(MAIN.replayId, MAIN.versionId)).toEqual({ kind: 'UNAVAILABLE' });
    expect(await client.momentAnalysis(MAIN.replayId, MAIN.versionId, 0, 'WORLD')).toEqual({ kind: 'UNAVAILABLE' });
  });
});
