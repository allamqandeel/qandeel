/**
 * S8B-03 (CP1, contract §4.6.2) — prove a voice note's AUDIO duration before any paid call.
 *
 * `mvhd` is a presentation duration the client writes as it likes. The duration any standard demuxer decodes is that of
 * the frames indexed in the track's sample table, so the accepted duration is (AAC frames × frame duration) from `stts`;
 * every other container value is used for consistency only. Nothing is decoded: structure and indexing are checked, and
 * every step fails closed. No library, no ffprobe, no binary in the server image.
 *
 * Reads: at most 16 top-level box headers of 16 bytes, and ONE read of `moov` (≤ 1 MiB). `mdat` is never read.
 * Work: linear in the number of table entries. Memory: about the size of `moov`.
 *
 * What it proves: the audio the file indexes lasts at most 10 minutes (+1 s), the container is consistent and not
 * truncated, and it holds exactly one mono AAC-LC track. What it does not prove: that the frames are valid audio (the
 * provider rejects corrupt frames), nor that the provider's demuxer follows the standard index (unindexed bytes are
 * bounded to 4 KiB, and AAC in MP4 carries no sync headers to decode them without it).
 */
export type M4aRejection =
  | 'AUDIO_DURATION_OVER_LIMIT'
  | 'AUDIO_CONTAINER_UNSUPPORTED'
  | 'AUDIO_CONTAINER_INCONSISTENT'
  | 'AUDIO_CONTAINER_TRUNCATED'
  | 'AUDIO_CONTAINER_LIMIT';

export type M4aDurationProof =
  | { readonly kind: 'PROVEN'; readonly durationMs: number; readonly sampleRate: number; readonly frames: number }
  | { readonly kind: 'REJECTED'; readonly rejection: M4aRejection };

/** Reads exactly `length` bytes at `offset` (fewer only at the end of the object). */
export type M4aRangeReader = (offset: number, length: number) => Promise<Buffer>;

export const M4A_LIMITS = Object.freeze({
  maxDurationMs: 601_000,
  maxTopLevelBoxes: 16,
  maxMoovBytes: 1024 * 1024,
  maxDepth: 8,
  maxMoovBoxes: 512,
  maxTableEntries: 65_536,
  maxFrameBytes: 768,
  maxUnindexedBytes: 4096,
  maxEditMediaTimeSamples: 4096,
  frameSamples: 1024,
});

const ALLOWED_BRANDS = new Set(['M4A ', 'mp42', 'mp41', 'isom', 'iso2']);
const FILLER = new Set(['free', 'skip', 'wide']);
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts']);
const SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

class Rejected extends Error {
  constructor(readonly rejection: M4aRejection) {
    super(rejection);
  }
}
const reject = (rejection: M4aRejection): never => {
  throw new Rejected(rejection);
};

interface Box {
  readonly type: string;
  readonly start: number; // offset of the header inside its buffer
  readonly payload: number; // offset of the payload
  readonly end: number; // exclusive
  readonly children: Box[];
}

export async function proveM4aAudioDuration(read: M4aRangeReader, byteSize: number): Promise<M4aDurationProof> {
  try {
    return { kind: 'PROVEN', ...(await prove(read, byteSize)) };
  } catch (error) {
    if (error instanceof Rejected) return { kind: 'REJECTED', rejection: error.rejection };
    // A buffer read past its end means the declared structure is not in the bytes.
    if (error instanceof RangeError) return { kind: 'REJECTED', rejection: 'AUDIO_CONTAINER_TRUNCATED' };
    throw error;
  }
}

async function prove(read: M4aRangeReader, byteSize: number) {
  if (!Number.isSafeInteger(byteSize) || byteSize < 16) reject('AUDIO_CONTAINER_TRUNCATED');

  // 1. The top-level boxes cover the file exactly.
  let offset = 0;
  let count = 0;
  let moov: { start: number; size: number } | null = null;
  let mdat: { payload: number; end: number } | null = null;
  while (offset < byteSize) {
    if (++count > M4A_LIMITS.maxTopLevelBoxes) reject('AUDIO_CONTAINER_LIMIT');
    if (byteSize - offset < 8) reject('AUDIO_CONTAINER_TRUNCATED');
    const header = await read(offset, Math.min(16, byteSize - offset));
    if (header.length < Math.min(16, byteSize - offset)) reject('AUDIO_CONTAINER_TRUNCATED');
    const size32 = header.readUInt32BE(0);
    const type = header.toString('latin1', 4, 8);
    let headerSize = 8;
    let size: number;
    if (size32 === 1) {
      if (header.length < 16) reject('AUDIO_CONTAINER_TRUNCATED');
      const large = header.readBigUInt64BE(8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) reject('AUDIO_CONTAINER_TRUNCATED');
      headerSize = 16;
      size = Number(large);
    } else if (size32 === 0) {
      size = byteSize - offset; // "to the end": the last box, and only mdat
      if (type !== 'mdat') reject('AUDIO_CONTAINER_TRUNCATED');
    } else {
      size = size32;
    }
    if (size < headerSize || offset + size > byteSize) reject('AUDIO_CONTAINER_TRUNCATED');
    if (count === 1) {
      if (type !== 'ftyp' || headerSize !== 8 || size < 16) reject('AUDIO_CONTAINER_UNSUPPORTED');
      if (!ALLOWED_BRANDS.has(header.toString('latin1', 8, 12))) reject('AUDIO_CONTAINER_UNSUPPORTED');
    } else if (type === 'moov') {
      if (moov) reject('AUDIO_CONTAINER_UNSUPPORTED');
      moov = { start: offset, size };
    } else if (type === 'mdat') {
      if (mdat) reject('AUDIO_CONTAINER_UNSUPPORTED');
      mdat = { payload: offset + headerSize, end: offset + size };
    } else if (!FILLER.has(type)) {
      reject('AUDIO_CONTAINER_UNSUPPORTED'); // ftyp again, moof, mfra, sidx, styp, or anything unknown
    }
    offset += size;
  }
  if (!moov || !mdat) reject('AUDIO_CONTAINER_UNSUPPORTED');

  // 2. moov, read whole, bounded.
  if (moov!.size > M4A_LIMITS.maxMoovBytes) reject('AUDIO_CONTAINER_LIMIT');
  const buffer = await read(moov!.start, moov!.size);
  if (buffer.length !== moov!.size) reject('AUDIO_CONTAINER_TRUNCATED');
  const counter = { boxes: 0 };
  const root = parseBox(buffer, 0, buffer.length, 1, counter);
  if (root.type !== 'moov' || root.end !== buffer.length) reject('AUDIO_CONTAINER_TRUNCATED');
  if (find(root, 'mvex')) reject('AUDIO_CONTAINER_UNSUPPORTED');

  // 3. One sound track, one mono AAC-LC entry.
  const traks = root.children.filter((b) => b.type === 'trak');
  if (traks.length !== 1) reject('AUDIO_CONTAINER_UNSUPPORTED');
  const trak = traks[0];
  const mvhd = timed(buffer, only(root, 'mvhd'), 'mvhd');
  const tkhd = timed(buffer, only(trak, 'tkhd'), 'tkhd');
  const mdia = only(trak, 'mdia');
  const mdhd = timed(buffer, only(mdia, 'mdhd'), 'mdhd');
  const hdlr = only(mdia, 'hdlr');
  if (buffer.toString('latin1', hdlr.payload + 8, hdlr.payload + 12) !== 'soun') reject('AUDIO_CONTAINER_UNSUPPORTED');
  const stbl = only(only(mdia, 'minf'), 'stbl');
  const sampleRate = audioSampleRate(buffer, only(stbl, 'stsd'));
  if (mdhd.timescale !== sampleRate) reject('AUDIO_CONTAINER_INCONSISTENT');

  // 4. The sample table.
  const stts = only(stbl, 'stts');
  const sttsCount = entries(buffer, stts, 8);
  if (sttsCount === 0) reject('AUDIO_CONTAINER_INCONSISTENT');
  let frames = 0n;
  let ticks = 0n;
  for (let i = 0; i < sttsCount; i += 1) {
    const at = stts.payload + 8 + i * 8;
    const sampleCount = buffer.readUInt32BE(at);
    const delta = buffer.readUInt32BE(at + 4);
    const last = i === sttsCount - 1;
    if (last ? delta < 1 || delta > M4A_LIMITS.frameSamples : delta !== M4A_LIMITS.frameSamples) reject('AUDIO_CONTAINER_INCONSISTENT');
    frames += BigInt(sampleCount);
    ticks += BigInt(sampleCount) * BigInt(delta);
  }
  if (frames === 0n) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (frames > BigInt(M4A_LIMITS.maxTableEntries)) reject('AUDIO_CONTAINER_LIMIT'); // ten minutes at 48 kHz is about 28,125 frames
  const frameCount = Number(frames);
  const durationMs = Number((ticks * 1000n + BigInt(sampleRate) - 1n) / BigInt(sampleRate));

  const sizes = sampleSizes(buffer, only(stbl, 'stsz'), frameCount);
  const chunks = chunkRanges(buffer, stbl, sizes);
  const indexed = sizes.reduce((sum, size) => sum + size, 0);
  let previousEnd = mdat!.payload;
  for (const chunk of chunks) {
    if (chunk.start < previousEnd || chunk.end > mdat!.end) reject('AUDIO_CONTAINER_TRUNCATED');
    previousEnd = chunk.end;
  }
  const payload = mdat!.end - mdat!.payload;
  if (indexed > payload) reject('AUDIO_CONTAINER_TRUNCATED');
  if (payload - indexed > M4A_LIMITS.maxUnindexedBytes) reject('AUDIO_CONTAINER_INCONSISTENT');

  // 5. Consistency with the container's declared durations.
  const seconds = Number(ticks) / sampleRate;
  if (Math.abs(Number(mdhd.duration) - Number(ticks)) / sampleRate > 0.1) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (mvhd.timescale === 0) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (Math.abs(Number(mvhd.duration) / mvhd.timescale - seconds) > 1) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (Math.abs(Number(tkhd.duration) / mvhd.timescale - seconds) > 1) reject('AUDIO_CONTAINER_INCONSISTENT');
  const edts = trak.children.filter((b) => b.type === 'edts');
  if (edts.length > 1) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (edts.length === 1) editList(buffer, only(edts[0], 'elst'), mvhd.timescale, seconds);

  // 6. The limit.
  if (durationMs <= 0) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (durationMs > M4A_LIMITS.maxDurationMs) reject('AUDIO_DURATION_OVER_LIMIT');
  return { durationMs, sampleRate, frames: frameCount };
}

function parseBox(buffer: Buffer, start: number, limit: number, depth: number, counter: { boxes: number }): Box {
  if (depth > M4A_LIMITS.maxDepth || ++counter.boxes > M4A_LIMITS.maxMoovBoxes) reject('AUDIO_CONTAINER_LIMIT');
  if (limit - start < 8) reject('AUDIO_CONTAINER_TRUNCATED');
  const size32 = buffer.readUInt32BE(start);
  const type = buffer.toString('latin1', start + 4, start + 8);
  let headerSize = 8;
  let size = size32;
  if (size32 === 1) {
    if (limit - start < 16) reject('AUDIO_CONTAINER_TRUNCATED');
    const large = buffer.readBigUInt64BE(start + 8);
    if (large > BigInt(limit - start)) reject('AUDIO_CONTAINER_TRUNCATED');
    headerSize = 16;
    size = Number(large);
  }
  if (size32 === 0 || size < headerSize || start + size > limit) reject('AUDIO_CONTAINER_TRUNCATED');
  const box: Box = { type, start, payload: start + headerSize, end: start + size, children: [] };
  if (CONTAINERS.has(type)) {
    let at = box.payload;
    while (at < box.end) {
      const child = parseBox(buffer, at, box.end, depth + 1, counter);
      box.children.push(child);
      at = child.end;
    }
  }
  return box;
}

function find(box: Box, type: string): boolean {
  return box.children.some((child) => child.type === type || find(child, type));
}

/** Exactly one child of `type` (a missing or repeated required box is an unsupported structure). */
function only(parent: Box, type: string): Box {
  const matches = parent.children.filter((b) => b.type === type);
  if (matches.length !== 1) reject('AUDIO_CONTAINER_UNSUPPORTED');
  return matches[0];
}

/** mvhd / tkhd / mdhd: the version-dependent timescale and duration (tkhd has no timescale of its own). */
function timed(buffer: Buffer, box: Box, kind: 'mvhd' | 'tkhd' | 'mdhd') {
  const version = buffer.readUInt8(box.payload);
  if (version > 1) reject('AUDIO_CONTAINER_UNSUPPORTED');
  const p = box.payload + 4;
  const wide = version === 1;
  const stamps = wide ? 16 : 8;
  if (kind === 'tkhd') {
    const at = p + stamps + 8; // track_ID + reserved
    const duration = wide ? buffer.readBigUInt64BE(at) : BigInt(buffer.readUInt32BE(at));
    if (!wide && duration === 0xffffffffn) reject('AUDIO_CONTAINER_INCONSISTENT');
    return { timescale: 0, duration };
  }
  const timescale = buffer.readUInt32BE(p + stamps);
  const duration = wide ? buffer.readBigUInt64BE(p + stamps + 4) : BigInt(buffer.readUInt32BE(p + stamps + 4));
  if (!wide && duration === 0xffffffffn) reject('AUDIO_CONTAINER_INCONSISTENT');
  return { timescale, duration };
}

/** A full box's entry count, bounded, with its entries inside the box. */
function entries(buffer: Buffer, box: Box, entrySize: number, countAt = 4): number {
  const count = buffer.readUInt32BE(box.payload + countAt);
  if (count > M4A_LIMITS.maxTableEntries) reject('AUDIO_CONTAINER_LIMIT');
  if (box.payload + countAt + 4 + count * entrySize > box.end) reject('AUDIO_CONTAINER_TRUNCATED');
  return count;
}

/** stsd: one `mp4a` entry whose esds AudioSpecificConfig is AAC-LC (object type 2), mono, at 8–48 kHz. */
function audioSampleRate(buffer: Buffer, stsd: Box): number {
  if (buffer.readUInt32BE(stsd.payload + 4) !== 1) reject('AUDIO_CONTAINER_UNSUPPORTED');
  const entry = parseBox(buffer, stsd.payload + 8, stsd.end, 1, { boxes: 0 });
  if (entry.type !== 'mp4a') reject('AUDIO_CONTAINER_UNSUPPORTED');
  if (buffer.readUInt16BE(entry.payload + 8) !== 0) reject('AUDIO_CONTAINER_UNSUPPORTED'); // sound entry version 0 only
  let at = entry.payload + 28;
  let esds: Box | null = null;
  const counter = { boxes: 0 };
  while (at < entry.end) {
    const child = parseBox(buffer, at, entry.end, 1, counter);
    if (child.type === 'esds') {
      if (esds) reject('AUDIO_CONTAINER_UNSUPPORTED');
      esds = child;
    }
    at = child.end;
  }
  if (!esds) reject('AUDIO_CONTAINER_UNSUPPORTED');
  const config = audioSpecificConfig(buffer, esds!.payload + 4, esds!.end);
  if (config.objectType !== 2 || config.channels !== 1) reject('AUDIO_CONTAINER_UNSUPPORTED');
  if (config.sampleRate < 8000 || config.sampleRate > 48000) reject('AUDIO_CONTAINER_UNSUPPORTED');
  return config.sampleRate;
}

function descriptor(buffer: Buffer, at: number, end: number, tag: number) {
  if (at >= end || buffer.readUInt8(at) !== tag) reject('AUDIO_CONTAINER_UNSUPPORTED');
  let length = 0;
  let p = at + 1;
  for (let i = 0; i < 4; i += 1) {
    const byte = buffer.readUInt8(p++);
    length = (length << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
    if (i === 3) reject('AUDIO_CONTAINER_UNSUPPORTED');
  }
  if (p + length > end) reject('AUDIO_CONTAINER_TRUNCATED');
  return { body: p, end: p + length };
}

function audioSpecificConfig(buffer: Buffer, start: number, end: number) {
  const es = descriptor(buffer, start, end, 0x03);
  let p = es.body + 2; // ES_ID
  const flags = buffer.readUInt8(p++);
  if (flags & 0x80) p += 2; // dependsOn_ES_ID
  if (flags & 0x40) p += 1 + buffer.readUInt8(p); // URL
  if (flags & 0x20) p += 2; // OCR_ES_Id
  const decoder = descriptor(buffer, p, es.end, 0x04);
  if (buffer.readUInt8(decoder.body) !== 0x40) reject('AUDIO_CONTAINER_UNSUPPORTED'); // MPEG-4 Audio
  const info = descriptor(buffer, decoder.body + 13, decoder.end, 0x05);
  if (info.end - info.body < 2) reject('AUDIO_CONTAINER_UNSUPPORTED');
  const bits = buffer.readUInt16BE(info.body);
  const objectType = bits >> 11;
  const frequencyIndex = (bits >> 7) & 0x0f;
  if (frequencyIndex >= SAMPLE_RATES.length) reject('AUDIO_CONTAINER_UNSUPPORTED'); // explicit or reserved frequencies
  return { objectType, sampleRate: SAMPLE_RATES[frequencyIndex], channels: (bits >> 3) & 0x0f };
}

function sampleSizes(buffer: Buffer, stsz: Box, frames: number): number[] {
  const constant = buffer.readUInt32BE(stsz.payload + 4);
  const count = buffer.readUInt32BE(stsz.payload + 8);
  if (count !== frames) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (count > M4A_LIMITS.maxTableEntries) reject('AUDIO_CONTAINER_LIMIT');
  const sizes: number[] = new Array<number>(count);
  if (constant !== 0) {
    sizes.fill(constant);
  } else {
    if (stsz.payload + 12 + count * 4 > stsz.end) reject('AUDIO_CONTAINER_TRUNCATED');
    for (let i = 0; i < count; i += 1) sizes[i] = buffer.readUInt32BE(stsz.payload + 12 + i * 4);
  }
  if (sizes.some((size) => size < 1 || size > M4A_LIMITS.maxFrameBytes)) reject('AUDIO_CONTAINER_UNSUPPORTED');
  return sizes;
}

/** stsc + stco / co64: each chunk's byte range, in chunk order. */
function chunkRanges(buffer: Buffer, stbl: Box, sizes: readonly number[]) {
  const stsc = only(stbl, 'stsc');
  const offsets = stbl.children.filter((b) => b.type === 'stco' || b.type === 'co64');
  if (offsets.length !== 1) reject('AUDIO_CONTAINER_UNSUPPORTED');
  const wide = offsets[0].type === 'co64';
  const chunkCount = entries(buffer, offsets[0], wide ? 8 : 4);
  const runs = entries(buffer, stsc, 12);
  if (runs === 0 || chunkCount === 0) reject('AUDIO_CONTAINER_INCONSISTENT');
  const result: { start: number; end: number }[] = [];
  let sample = 0;
  for (let r = 0; r < runs; r += 1) {
    const at = stsc.payload + 8 + r * 12;
    const firstChunk = buffer.readUInt32BE(at);
    const perChunk = buffer.readUInt32BE(at + 4);
    const description = buffer.readUInt32BE(at + 8);
    const nextFirst = r + 1 < runs ? buffer.readUInt32BE(at + 12) : chunkCount + 1;
    if ((r === 0 && firstChunk !== 1) || nextFirst <= firstChunk || nextFirst > chunkCount + 1 || description !== 1 || perChunk === 0) {
      reject('AUDIO_CONTAINER_INCONSISTENT');
    }
    for (let chunk = firstChunk; chunk < nextFirst; chunk += 1) {
      const p = offsets[0].payload + 8 + (chunk - 1) * (wide ? 8 : 4);
      const big = wide ? buffer.readBigUInt64BE(p) : BigInt(buffer.readUInt32BE(p));
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) reject('AUDIO_CONTAINER_TRUNCATED');
      const start = Number(big);
      if (sample + perChunk > sizes.length) reject('AUDIO_CONTAINER_INCONSISTENT');
      let length = 0;
      for (let i = 0; i < perChunk; i += 1) length += sizes[sample + i];
      sample += perChunk;
      result.push({ start, end: start + length });
    }
  }
  if (sample !== sizes.length) reject('AUDIO_CONTAINER_INCONSISTENT');
  return result;
}

/** elst: one entry at rate 1, media_time within [0, 4096] samples, lasting within a second of the indexed audio. */
function editList(buffer: Buffer, elst: Box, movieTimescale: number, seconds: number): void {
  const version = buffer.readUInt8(elst.payload);
  if (version > 1) reject('AUDIO_CONTAINER_INCONSISTENT');
  const wide = version === 1;
  const count = entries(buffer, elst, wide ? 20 : 12);
  if (count !== 1) reject('AUDIO_CONTAINER_INCONSISTENT');
  const at = elst.payload + 8;
  const segment = wide ? Number(buffer.readBigUInt64BE(at)) : buffer.readUInt32BE(at);
  const mediaTime = wide ? Number(buffer.readBigInt64BE(at + 8)) : buffer.readInt32BE(at + 4);
  const rateAt = at + (wide ? 16 : 8);
  const rate = buffer.readInt16BE(rateAt);
  const fraction = buffer.readInt16BE(rateAt + 2);
  if (rate !== 1 || fraction !== 0) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (mediaTime < 0 || mediaTime > M4A_LIMITS.maxEditMediaTimeSamples) reject('AUDIO_CONTAINER_INCONSISTENT');
  if (Math.abs(segment / movieTimescale - seconds) > 1) reject('AUDIO_CONTAINER_INCONSISTENT');
}
