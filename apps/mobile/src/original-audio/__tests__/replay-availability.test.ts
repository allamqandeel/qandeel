import { decodeReplayAvailability, momentAvailability } from '../replay-availability';

// RB-2 / S3 CP5 — the phone's typed reading of the availability answer: exact, bound to the version and the map the
// player holds, refused whole otherwise. The server side (0202 and the Replay Media Service translation) is proven by
// database/verify-migration-0202.mjs and apps/api/src/replay-media/transient-playback.service.spec.ts.
const REPLAY = '7d1f0c62-3b0e-4b44-9a43-3c8a5d1d2e01';
const VERSION = '0b6e5c2a-4f6d-4a9e-8a51-1d0c7c9d3e02';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const MAP = `sha256:${'b'.repeat(64)}`;
const expected = { replayId: REPLAY, versionId: VERSION, runs: [{ durationMs: 3000 }, { durationMs: 9500 }] };
const answer = (over: Record<string, unknown> = {}) => ({
  replayId: REPLAY, versionId: VERSION, revision: 2, sourceWindowBindingDigest: DIGEST, mapDigest: MAP,
  ledgerWatermark: { sp: 9, seq: 3 },
  moments: [
    { ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 1, fileMs: 1200 } },
    { ordinal: 2, state: 'RECORDED', placement: { kind: 'AFTER_END' } },
    { ordinal: 3, state: 'BROKEN', placement: null },
  ],
  ...over,
});

describe('decodeReplayAvailability', () => {
  it('reads a well-formed answer bound to the held version and map', () => {
    const decoded = decodeReplayAvailability(answer(), expected);
    expect(decoded?.binding).toEqual({
      replayId: REPLAY, versionId: VERSION, revision: 2, sourceWindowBindingDigest: DIGEST, mapDigest: MAP, ledgerWatermark: { sp: 9, seq: 3 },
    });
    expect(momentAvailability(decoded, 1)).toEqual({ kind: 'IN_RECORDING', runIndex: 1, fileMs: 1200 });
    expect(momentAvailability(decoded, 2)).toEqual({ kind: 'AFTER_END' });
    expect(momentAvailability(decoded, 3)).toEqual({ kind: 'UNRECORDED', state: 'BROKEN' });
    expect(momentAvailability(decoded, 4)).toEqual({ kind: 'UNRECORDED', state: 'UNESTABLISHED' });
    expect(momentAvailability(null, 1)).toEqual({ kind: 'UNRECORDED', state: 'UNESTABLISHED' });
  });

  it('reads a V1 answer: every moment ORDINAL_ONLY, no map, no watermark', () => {
    const decoded = decodeReplayAvailability(answer({
      sourceWindowBindingDigest: null, mapDigest: null, ledgerWatermark: null,
      moments: [{ ordinal: 1, state: 'ORDINAL_ONLY', placement: null }],
    }), { ...expected, runs: [] });
    expect(momentAvailability(decoded, 1)).toEqual({ kind: 'UNRECORDED', state: 'ORDINAL_ONLY' });
  });

  it('refuses whole: another Replay or version, a stale shape, a placement outside the held map, an unknown state', () => {
    const refusals: Array<[string, unknown, typeof expected]> = [
      ['another version', answer({ versionId: '0b6e5c2a-4f6d-4a9e-8a51-1d0c7c9d3e03' }), expected],
      ['another Replay', answer({ replayId: '7d1f0c62-3b0e-4b44-9a43-3c8a5d1d2e09' }), expected],
      ['an extra key', { ...answer(), recordingId: 'x' }, expected],
      ['a missing key', (({ mapDigest: _m, ...rest }) => rest)(answer()), expected],
      ['revision 0', answer({ revision: 0 }), expected],
      ['a malformed digest', answer({ mapDigest: 'sha256:xyz' }), expected],
      ['a run the map lacks', answer({ moments: [{ ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 2, fileMs: 0 } }] }), expected],
      ['past the run end', answer({ moments: [{ ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 3001 } }] }), expected],
      ['a negative position', answer({ moments: [{ ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: -20 } }] }), expected],
      ['RECORDED without a placement', answer({ moments: [{ ordinal: 1, state: 'RECORDED', placement: null }] }), expected],
      ['a placement on a non-RECORDED moment', answer({ moments: [{ ordinal: 1, state: 'UNESTABLISHED', placement: { kind: 'AFTER_END' } }] }), expected],
      ['PENDING (retired with the sweeper)', answer({ moments: [{ ordinal: 1, state: 'PENDING', placement: null }] }), expected],
      ['a repeated ordinal', answer({ moments: [{ ordinal: 1, state: 'BROKEN', placement: null }, { ordinal: 1, state: 'BROKEN', placement: null }] }), expected],
      ['no moments', answer({ moments: [] }), expected],
      ['RECORDED with no map digest', answer({ mapDigest: null }), expected],
      ['RECORDED with no watermark', answer({ ledgerWatermark: null }), expected],
      ['a watermark at SP 0', answer({ ledgerWatermark: { sp: 0, seq: 0 } }), expected],
      ['not an object', 'availability', expected],
    ];
    for (const [name, body, held] of refusals) expect([name, decodeReplayAvailability(body, held)]).toEqual([name, null]);
  });
});
