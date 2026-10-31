/**
 * S8B-03 (CP1, A7) — synthetic M4A (ISO BMFF, one AAC-LC track) fixtures for the duration prover. Test only: never bound
 * by any module. The frames are zero bytes - nothing here is audio, and no real recording is ever used.
 *
 * Layout: ftyp | moov | [free] | mdat (or ftyp | mdat | moov with `mdatFirst`). Every option bends exactly one property so
 * each rejection class can be produced on purpose.
 */
export interface M4aFixtureOptions {
  /** The indexed audio duration; frames = ceil(durationMs × rate / 1000 / 1024) unless `frames` is given. */
  readonly durationMs?: number;
  readonly frames?: number;
  readonly sampleRate?: number;
  readonly channels?: number;
  readonly objectType?: number;
  readonly frameBytes?: number;
  /** One stsz entry per frame instead of a constant size. */
  readonly sizeTable?: boolean;
  /** Splits the stts run into this many entries (all at delta 1024). */
  readonly sttsEntries?: number;
  /** The last frame's sample delta (a partial final frame), within [1, 1024]. */
  readonly lastDelta?: number;
  /** A delta other than 1024 on the first stts entry. */
  readonly firstDelta?: number;
  readonly mvhdDurationMs?: number;
  readonly tkhdDurationMs?: number;
  readonly mdhdTicks?: number;
  readonly mdhdTimescale?: number;
  readonly editList?: { readonly entries?: number; readonly rate?: number; readonly mediaTime?: number; readonly segmentMs?: number };
  readonly unindexedBytes?: number;
  readonly mvex?: boolean;
  readonly topLevel?: string;
  readonly tracks?: number;
  readonly brand?: string;
  readonly omitFtyp?: boolean;
  readonly oversizedFrame?: boolean;
  readonly firstChunkOffsetDelta?: number;
  readonly overlappingChunks?: boolean;
  readonly truncateBy?: number;
  readonly moovPaddingBytes?: number;
  readonly moovBoxes?: number;
  readonly nestingDepth?: number;
  readonly extraTopLevelBoxes?: number;
  /** A top-level `free` box of this many payload bytes (to reach a large byte size with valid audio). */
  readonly freeBytes?: number;
  readonly mdatFirst?: boolean;
  readonly co64?: boolean;
  readonly framesPerChunk?: number;
}

const u8 = (n: number) => Buffer.from([n & 0xff]);
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff); return b; };
const i16 = (n: number) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const i32 = (n: number) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
const u64 = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
const box = (type: string, ...parts: Buffer[]) => {
  const payload = Buffer.concat(parts);
  return Buffer.concat([u32(8 + payload.length), Buffer.from(type, 'latin1'), payload]);
};
const full = (type: string, version: number, ...parts: Buffer[]) => box(type, u8(version), Buffer.alloc(3), ...parts);
const descriptor = (tag: number, body: Buffer) => Buffer.concat([u8(tag), u8(0x80), u8(0x80), u8(0x80), u8(body.length), body]);
const RATE_INDEX: Record<number, number> = { 96000: 0, 88200: 1, 64000: 2, 48000: 3, 44100: 4, 32000: 5, 24000: 6, 22050: 7, 16000: 8, 12000: 9, 11025: 10, 8000: 11, 7350: 12 };

interface Layout {
  readonly frames: number;
  readonly sizes: number[];
  readonly ticks: number;
  readonly sampleRate: number;
  /** The final frame's delta when it is a partial frame, else undefined. */
  readonly lastDelta: number | undefined;
}

function layoutOf(o: M4aFixtureOptions): Layout {
  const sampleRate = o.sampleRate ?? 48000;
  // By default the indexed audio lasts exactly durationMs: whole frames, then one partial frame for the remainder.
  const exact = Math.round(((o.durationMs ?? 1000) * sampleRate) / 1000);
  const remainder = o.frames === undefined && o.lastDelta === undefined ? exact % 1024 : 0;
  const lastDelta = o.lastDelta ?? (remainder > 0 ? remainder : undefined);
  const frames = o.frames ?? Math.floor(exact / 1024) + (remainder > 0 ? 1 : 0) + (o.lastDelta !== undefined ? 1 : 0);
  const size = o.frameBytes ?? 6;
  const sizes = new Array<number>(frames).fill(size);
  if (o.oversizedFrame) sizes[0] = 769;
  const firstDelta = o.firstDelta ?? 1024;
  const ticks = (frames - 1) * 1024 + (lastDelta ?? 1024) + (firstDelta - 1024);
  return { frames, sizes, ticks, sampleRate, lastDelta };
}

function stts(o: M4aFixtureOptions, l: Layout): Buffer {
  const runs: [number, number][] = [];
  const full = l.lastDelta !== undefined ? l.frames - 1 : l.frames;
  const parts = Math.max(1, Math.min(o.sttsEntries ?? 1, full));
  let left = full;
  for (let i = 0; i < parts; i += 1) {
    const n = i === parts - 1 ? left : Math.floor(full / parts);
    runs.push([n, 1024]);
    left -= n;
  }
  if (o.firstDelta !== undefined) runs[0] = [runs[0][0], o.firstDelta];
  if (l.lastDelta !== undefined) runs.push([1, l.lastDelta]);
  return full_('stts', 0, u32(runs.length), ...runs.flatMap(([n, d]) => [u32(n), u32(d)]));
}
const full_ = full;

function trak(o: M4aFixtureOptions, l: Layout, chunkOffsets: number[]): Buffer {
  const movieTimescale = 1000;
  const seconds = l.ticks / l.sampleRate;
  const tkhdDuration = Math.round((o.tkhdDurationMs ?? seconds * 1000) * movieTimescale / 1000);
  const tkhd = full('tkhd', 0, u32(0), u32(0), u32(1), u32(0), u32(tkhdDuration), Buffer.alloc(60));
  const mdhd = full('mdhd', 0, u32(0), u32(0), u32(o.mdhdTimescale ?? l.sampleRate), u32(o.mdhdTicks ?? l.ticks), u16(0x55c4), u16(0));
  const hdlr = full('hdlr', 0, u32(0), Buffer.from('soun', 'latin1'), Buffer.alloc(12), Buffer.from('SoundHandler\0', 'latin1'));
  const aot = o.objectType ?? 2;
  const channels = o.channels ?? 1;
  const asc = u16((aot << 11) | ((RATE_INDEX[l.sampleRate] ?? 15) << 7) | (channels << 3));
  const decoder = descriptor(0x04, Buffer.concat([u8(0x40), u8(0x15), Buffer.alloc(3), u32(64000), u32(64000), descriptor(0x05, asc)]));
  const es = descriptor(0x03, Buffer.concat([u16(1), u8(0), decoder, descriptor(0x06, u8(2))]));
  const esds = full('esds', 0, es);
  const mp4a = box('mp4a', Buffer.alloc(6), u16(1), u16(0), u16(0), u32(0), u16(channels), u16(16), u16(0), u16(0), u32(l.sampleRate * 65536 > 0xffffffff ? 0 : l.sampleRate * 65536), esds);
  const stsd = full('stsd', 0, u32(1), mp4a);
  const sizeTable = o.sizeTable || o.oversizedFrame;
  const stsz = sizeTable
    ? full('stsz', 0, u32(0), u32(l.frames), ...l.sizes.map(u32))
    : full('stsz', 0, u32(l.sizes[0]), u32(l.frames));
  const perChunk = o.framesPerChunk ?? 32;
  const chunks = Math.ceil(l.frames / perChunk);
  const last = l.frames - (chunks - 1) * perChunk;
  const stsc = last === perChunk || chunks === 1
    ? full('stsc', 0, u32(1), u32(1), u32(chunks === 1 ? l.frames : perChunk), u32(1))
    : full('stsc', 0, u32(2), u32(1), u32(perChunk), u32(1), u32(chunks), u32(last), u32(1));
  const offsets = o.co64 ? full('co64', 0, u32(chunks), ...chunkOffsets.map(u64)) : full('stco', 0, u32(chunks), ...chunkOffsets.map(u32));
  const stbl = box('stbl', stsd, stts(o, l), stsc, stsz, offsets);
  const minf = box('minf', full('smhd', 0, u32(0)), box('dinf', full('dref', 0, u32(1), full('url ', 0))), stbl);
  const mdia = box('mdia', mdhd, hdlr, minf);
  const parts: Buffer[] = [tkhd];
  if (o.editList) {
    const e = o.editList;
    const segment = Math.round((e.segmentMs ?? seconds * 1000) * movieTimescale / 1000);
    const entry = Buffer.concat([u32(segment), i32(e.mediaTime ?? 0), i16(e.rate ?? 1), i16(0)]);
    const count = e.entries ?? 1;
    parts.push(box('edts', full('elst', 0, u32(count), ...new Array<Buffer>(count).fill(entry))));
  }
  parts.push(mdia);
  return box('trak', ...parts);
}

function moov(o: M4aFixtureOptions, l: Layout, chunkOffsets: number[]): Buffer {
  const seconds = l.ticks / l.sampleRate;
  const mvhd = full('mvhd', 0, u32(0), u32(0), u32(1000), u32(Math.round(o.mvhdDurationMs ?? seconds * 1000)), u32(0x00010000), u16(0x0100), Buffer.alloc(10), Buffer.alloc(36), Buffer.alloc(24), u32(2));
  const parts: Buffer[] = [mvhd];
  for (let t = 0; t < (o.tracks ?? 1); t += 1) parts.push(trak(o, l, chunkOffsets));
  if (o.mvex) parts.push(box('mvex', full('trex', 0, u32(1), u32(1), u32(0), u32(0), u32(0))));
  if (o.moovPaddingBytes) parts.push(box('free', Buffer.alloc(o.moovPaddingBytes)));
  for (let i = 0; i < (o.moovBoxes ?? 0); i += 1) parts.push(box('free'));
  if (o.nestingDepth) {
    let nested = box('free');
    for (let i = 0; i < o.nestingDepth; i += 1) nested = box('edts', nested);
    parts.push(nested);
  }
  return box('moov', ...parts);
}

function chunkOffsetsAt(o: M4aFixtureOptions, l: Layout, mdatPayload: number): number[] {
  const perChunk = o.framesPerChunk ?? 32;
  const offsets: number[] = [];
  let at = mdatPayload;
  for (let first = 0; first < l.frames; first += perChunk) {
    offsets.push(at);
    for (let i = first; i < Math.min(first + perChunk, l.frames); i += 1) at += l.sizes[i];
  }
  if (o.firstChunkOffsetDelta) offsets[0] += o.firstChunkOffsetDelta;
  if (o.overlappingChunks && offsets.length > 1) offsets[1] -= 1;
  return offsets;
}

/** The fixture's head (everything but the `free` filler and the mdat payload) and the byte counts that follow it. */
export function buildM4aFixture(options: M4aFixtureOptions = {}): Buffer {
  const parts = m4aFixtureParts(options);
  const free = parts.freeBytes ? Buffer.concat([u32(8 + parts.freeBytes), Buffer.from('free', 'latin1'), Buffer.alloc(parts.freeBytes)]) : Buffer.alloc(0);
  return Buffer.concat([parts.head, free, parts.mdat]).subarray(0, parts.byteSize);
}

export interface M4aFixtureParts {
  readonly head: Buffer;
  /** Payload bytes of a top-level `free` box placed after `head` (its 8-byte header included in `byteSize`). */
  readonly freeBytes: number;
  readonly mdat: Buffer;
  readonly byteSize: number;
}

export function m4aFixtureParts(o: M4aFixtureOptions = {}): M4aFixtureParts {
  const l = layoutOf(o);
  const ftyp = o.omitFtyp ? Buffer.alloc(0) : box('ftyp', Buffer.from(o.brand ?? 'M4A ', 'latin1'), u32(0), Buffer.from('M4A isommp42', 'latin1'));
  const extra = Buffer.concat(new Array<Buffer>(o.extraTopLevelBoxes ?? 0).fill(box('free')));
  const top = o.topLevel ? box(o.topLevel, Buffer.alloc(8)) : Buffer.alloc(0);
  const audioBytes = l.sizes.reduce((s, n) => s + n, 0) + (o.unindexedBytes ?? 0);
  const freeTotal = o.freeBytes ? 8 + o.freeBytes : 0;
  const mdatHeader = 8;
  const probe = moov(o, l, chunkOffsetsAt(o, l, 0));
  const mdatPayload = o.mdatFirst
    ? ftyp.length + extra.length + top.length + mdatHeader
    : ftyp.length + extra.length + top.length + probe.length + freeTotal + mdatHeader;
  const movie = moov(o, l, chunkOffsetsAt(o, l, mdatPayload));
  const mdat = Buffer.concat([u32(mdatHeader + audioBytes), Buffer.from('mdat', 'latin1'), Buffer.alloc(audioBytes)]);
  if (o.mdatFirst) {
    const head = Buffer.concat([ftyp, extra, top, mdat, movie]);
    return { head, freeBytes: 0, mdat: Buffer.alloc(0), byteSize: head.length - (o.truncateBy ?? 0) };
  }
  const head = Buffer.concat([ftyp, extra, top, movie]);
  return { head, freeBytes: o.freeBytes ?? 0, mdat, byteSize: head.length + freeTotal + mdat.length - (o.truncateBy ?? 0) };
}

/** The fixture as a stream of chunks, without ever holding the filler: for the large-note memory proof (A19). */
export async function* streamM4aFixture(options: M4aFixtureOptions, chunkBytes = 64 * 1024): AsyncGenerator<Buffer> {
  const parts = m4aFixtureParts(options);
  yield parts.head;
  if (parts.freeBytes) {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + parts.freeBytes);
    header.write('free', 4, 'latin1');
    yield header;
    const zero = Buffer.alloc(chunkBytes);
    for (let left = parts.freeBytes; left > 0; left -= chunkBytes) yield left >= chunkBytes ? zero : zero.subarray(0, left);
  }
  yield parts.mdat;
}

/** A range reader over a fixture buffer that counts what it reads (A7: reads and bytes are measured). */
export function countingReader(bytes: Buffer) {
  const stats = { reads: 0, bytes: 0, maxRead: 0 };
  const read = async (offset: number, length: number) => {
    stats.reads += 1;
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + length));
    stats.bytes += slice.length;
    stats.maxRead = Math.max(stats.maxRead, slice.length);
    return Buffer.from(slice);
  };
  return { read, stats };
}
