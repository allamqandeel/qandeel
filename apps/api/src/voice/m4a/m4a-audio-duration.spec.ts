import { buildM4aFixture, countingReader, type M4aFixtureOptions } from '../testing/m4a-fixture.writer';
import { M4A_LIMITS, proveM4aAudioDuration } from './m4a-audio-duration';

/** S8B-03 (CP1, A7) — the audio-duration proof on synthetic fixtures, with reads and bytes measured. */
async function prove(options: M4aFixtureOptions) {
  const bytes = buildM4aFixture(options);
  const reader = countingReader(bytes);
  const proof = await proveM4aAudioDuration(reader.read, bytes.length);
  return { proof, stats: reader.stats, size: bytes.length };
}

describe('proveM4aAudioDuration', () => {
  it.each([
    ['1 s', { durationMs: 1000 }, 1000],
    ['600 s', { durationMs: 600_000 }, 600_000],
    ['601 s (a recording stopped at 10:00)', { durationMs: 601_000 }, 601_000],
    ['stts with several entries and a partial last frame', { durationMs: 5000, sttsEntries: 3, lastDelta: 500 }, 5003],
    ['a single edit at rate 1', { durationMs: 2000, editList: { mediaTime: 1024 } }, 2000],
    ['mdat before moov', { durationMs: 1000, mdatFirst: true }, 1000],
    ['co64 offsets and a size table', { durationMs: 3000, co64: true, sizeTable: true }, 3000],
    ['8 kHz', { durationMs: 4000, sampleRate: 8000 }, 4000],
    ['exactly 4 KiB unindexed', { durationMs: 1000, unindexedBytes: 4096 }, 1000],
    ['a large free filler', { durationMs: 1000, freeBytes: 2 * 1024 * 1024 }, 1000],
  ])('accepts %s', async (_name, options, durationMs) => {
    const { proof } = await prove(options);
    expect(proof).toMatchObject({ kind: 'PROVEN', durationMs });
  });

  it.each([
    ['602 s', { durationMs: 602_000 }, 'AUDIO_DURATION_OVER_LIMIT'],
    ['mvhd short, the indexed audio longer', { durationMs: 300_000, mvhdDurationMs: 9_000 }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['mvhd short on an over-limit file', { durationMs: 700_000, mvhdDurationMs: 9_000, tkhdDurationMs: 9_000 }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['tkhd in conflict', { durationMs: 30_000, tkhdDurationMs: 5000 }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['mdhd in conflict', { durationMs: 30_000, mdhdTicks: 1000 }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['mdhd timescale other than the sample rate', { durationMs: 1000, mdhdTimescale: 44100 }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['an edit at a rate other than 1', { editList: { rate: 2 } }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['two edits', { editList: { entries: 2 } }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['an edit beyond 4096 samples', { editList: { mediaTime: 5000 } }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['an edit lasting longer', { durationMs: 2000, editList: { segmentMs: 9000 } }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['more than 4 KiB unindexed in mdat', { unindexedBytes: 4097 }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['a frame delta other than 1024', { durationMs: 2000, firstDelta: 2048 }, 'AUDIO_CONTAINER_INCONSISTENT'],
    ['fragmented (mvex)', { mvex: true }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['fragmented (moof)', { topLevel: 'moof' }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['a segment index', { topLevel: 'sidx' }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['an unknown top-level box', { topLevel: 'abcd' }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['two tracks', { tracks: 2 }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['stereo', { channels: 2 }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['SBR (object type 5)', { objectType: 5 }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['PS (object type 29)', { objectType: 29 }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['AAC Main (object type 1)', { objectType: 1 }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['96 kHz', { sampleRate: 96000 }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['a frame over 768 bytes', { oversizedFrame: true }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['ftyp missing', { omitFtyp: true }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['a brand not allowed', { brand: 'qt  ' }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['a chunk outside mdat', { firstChunkOffsetDelta: -20 }, 'AUDIO_CONTAINER_TRUNCATED'],
    ['overlapping chunks', { durationMs: 3000, overlappingChunks: true }, 'AUDIO_CONTAINER_TRUNCATED'],
    ['truncated (a box past the end)', { truncateBy: 10 }, 'AUDIO_CONTAINER_TRUNCATED'],
    ['moov over 1 MiB', { moovPaddingBytes: 1024 * 1024 }, 'AUDIO_CONTAINER_LIMIT'],
    ['more than 512 boxes', { moovBoxes: 520 }, 'AUDIO_CONTAINER_LIMIT'],
    ['nesting deeper than 8', { nestingDepth: 9 }, 'AUDIO_CONTAINER_LIMIT'],
    ['more than 16 top-level boxes', { extraTopLevelBoxes: 15 }, 'AUDIO_CONTAINER_LIMIT'],
  ])('rejects %s', async (_name, options, rejection) => {
    expect((await prove(options as M4aFixtureOptions)).proof).toEqual({ kind: 'REJECTED', rejection });
  });

  it('never reads mdat: at most 16 headers of 16 bytes plus one moov read', async () => {
    const { proof, stats, size } = await prove({ durationMs: 600_000, freeBytes: 4 * 1024 * 1024 });
    expect(proof.kind).toBe('PROVEN');
    expect(stats.reads).toBeLessThanOrEqual(M4A_LIMITS.maxTopLevelBoxes + 1);
    expect(stats.maxRead).toBeLessThanOrEqual(M4A_LIMITS.maxMoovBytes);
    expect(stats.bytes).toBeLessThan(16 * 16 + 512 * 1024);
    expect(stats.bytes).toBeLessThan(size / 10);
  });

  it('a byte size the boxes do not cover is truncated, and a tiny object is refused', async () => {
    const bytes = buildM4aFixture({ durationMs: 1000 });
    const { read } = countingReader(bytes);
    expect(await proveM4aAudioDuration(read, bytes.length + 100)).toEqual({ kind: 'REJECTED', rejection: 'AUDIO_CONTAINER_TRUNCATED' });
    expect(await proveM4aAudioDuration(read, 8)).toEqual({ kind: 'REJECTED', rejection: 'AUDIO_CONTAINER_TRUNCATED' });
  });

  it('a reader that returns fewer bytes than asked is truncated, never a crash', async () => {
    const bytes = buildM4aFixture({ durationMs: 1000 });
    const short = async (offset: number, length: number) => bytes.subarray(offset, offset + Math.max(0, length - 4));
    expect(await proveM4aAudioDuration(short, bytes.length)).toEqual({ kind: 'REJECTED', rejection: 'AUDIO_CONTAINER_TRUNCATED' });
  });
});
