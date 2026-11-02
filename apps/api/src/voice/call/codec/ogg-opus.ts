import { opusPacketSamples48k } from './opus-codec';

/**
 * S8B-05 CP1 — Ogg Opus (RFC 3533 framing, RFC 7845 encapsulation) for the call recording's segments: each USER-track
 * segment is its own complete, standalone `audio/ogg` file holding the uplink packets EXACTLY as received (never
 * re-encoded, D-C1), so a segment plays and decodes on its own.
 *
 *   page 1   OpusHead (BOS, granule 0): version 1, one channel, pre-skip 0, input rate 16000, gain 0, mapping family 0
 *   page 2   OpusTags (granule 0): the vendor string, no user comment (nothing about the person is ever written here)
 *   page 3…  the audio packets, granule = 48 kHz samples up to the last packet completed on the page; the last page EOS
 *
 * Pre-skip is 0: a segment starts mid-stream, so no encoder warm-up belongs to it, and its decoded length equals the
 * clock range it is recorded under (honest packet counts and times). `readOggOpus` is the strict reader the tests and the
 * proofs check every written segment with (capture pattern, version, CRC, lacing, header packets, granules, EOS).
 */

const VENDOR = 'qandeel-live-call-v1';
const MAX_PACKETS_PER_PAGE = 50;
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let r = i << 24;
    for (let j = 0; j < 8; j += 1) r = (r & 0x80000000) !== 0 ? (r << 1) ^ 0x04c11db7 : r << 1;
    table[i] = r >>> 0;
  }
  return table;
})();

/** The Ogg CRC-32 (polynomial 0x04c11db7, initial 0, no reflection, no final XOR). */
export function oggCrc32(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]!) >>> 0;
  return crc >>> 0;
}

function lacing(length: number): number[] {
  const values: number[] = [];
  let left = length;
  while (left >= 255) {
    values.push(255);
    left -= 255;
  }
  values.push(left);
  return values;
}

function page(flags: number, granule: bigint, serial: number, sequence: number, packets: readonly Buffer[]): Buffer {
  const table = packets.flatMap((p) => lacing(p.length));
  if (table.length > 255) throw new RangeError('OGG_PAGE_TOO_MANY_SEGMENTS');
  const header = Buffer.alloc(27 + table.length);
  header.write('OggS', 0, 'ascii');
  header.writeUInt8(0, 4);
  header.writeUInt8(flags, 5);
  header.writeBigInt64LE(granule, 6);
  header.writeUInt32LE(serial >>> 0, 14);
  header.writeUInt32LE(sequence >>> 0, 18);
  header.writeUInt32LE(0, 22);
  header.writeUInt8(table.length, 26);
  table.forEach((v, i) => header.writeUInt8(v, 27 + i));
  const out = Buffer.concat([header, ...packets]);
  out.writeUInt32LE(oggCrc32(out), 22);
  return out;
}

function opusHead(inputRate: number): Buffer {
  const head = Buffer.alloc(19);
  head.write('OpusHead', 0, 'ascii');
  head.writeUInt8(1, 8); // version
  head.writeUInt8(1, 9); // channels
  head.writeUInt16LE(0, 10); // pre-skip
  head.writeUInt32LE(inputRate, 12);
  head.writeInt16LE(0, 16); // output gain
  head.writeUInt8(0, 18); // mapping family 0 (mono / stereo, no table)
  return head;
}

function opusTags(): Buffer {
  const vendor = Buffer.from(VENDOR, 'ascii');
  const tags = Buffer.alloc(8 + 4 + vendor.length + 4);
  tags.write('OpusTags', 0, 'ascii');
  tags.writeUInt32LE(vendor.length, 8);
  vendor.copy(tags, 12);
  tags.writeUInt32LE(0, 12 + vendor.length);
  return tags;
}

/**
 * One standalone Ogg Opus file from packets in order. `serial` names the logical stream (any 32-bit value; the writer
 * uses the segment index so two segments never share one). At least one packet; every packet a well-formed Opus packet.
 */
export function muxOggOpus(packets: readonly Buffer[], options: { readonly serial: number; readonly inputRate: number }): Buffer {
  if (packets.length === 0) throw new RangeError('OGG_OPUS_EMPTY');
  const pages: Buffer[] = [page(0x02, 0n, options.serial, 0, [opusHead(options.inputRate)]), page(0x00, 0n, options.serial, 1, [opusTags()])];
  let granule = 0n;
  let sequence = 2;
  for (let start = 0; start < packets.length;) {
    const onPage: Buffer[] = [];
    let segments = 0;
    while (start + onPage.length < packets.length && onPage.length < MAX_PACKETS_PER_PAGE) {
      const next = packets[start + onPage.length]!;
      const need = lacing(next.length).length;
      if (segments + need > 255) break;
      segments += need;
      onPage.push(next);
    }
    for (const p of onPage) granule += BigInt(opusPacketSamples48k(p));
    start += onPage.length;
    pages.push(page(start === packets.length ? 0x04 : 0x00, granule, options.serial, sequence, onPage));
    sequence += 1;
  }
  return Buffer.concat(pages);
}

export interface OggOpusFile {
  readonly channels: number;
  readonly preSkip: number;
  readonly inputRate: number;
  readonly vendor: string;
  readonly packets: readonly Buffer[];
  /** The granule of the last page (48 kHz samples, pre-skip included). */
  readonly finalGranule: bigint;
}

/** The strict reader: throws on anything that is not a single, complete, valid Ogg Opus stream. */
export function readOggOpus(file: Buffer): OggOpusFile {
  const packets: Buffer[] = [];
  let partial: Buffer[] = [];
  let offset = 0;
  let sequence = 0;
  let serial: number | null = null;
  let finalGranule = -1n;
  let ended = false;
  const pageEnds: number[] = [];
  const granules: bigint[] = [];
  while (offset < file.length) {
    if (ended) throw new Error('OGG_DATA_AFTER_EOS');
    if (file.length - offset < 27 || file.toString('ascii', offset, offset + 4) !== 'OggS') throw new Error('OGG_CAPTURE_PATTERN');
    if (file.readUInt8(offset + 4) !== 0) throw new Error('OGG_VERSION');
    const flags = file.readUInt8(offset + 5);
    const granule = file.readBigInt64LE(offset + 6);
    const pageSerial = file.readUInt32LE(offset + 14);
    const pageSequence = file.readUInt32LE(offset + 18);
    const crc = file.readUInt32LE(offset + 22);
    const count = file.readUInt8(offset + 26);
    const table = [...file.subarray(offset + 27, offset + 27 + count)];
    const size = 27 + count + table.reduce((a, b) => a + b, 0);
    if (offset + size > file.length) throw new Error('OGG_TRUNCATED');
    const bytes = Buffer.from(file.subarray(offset, offset + size));
    bytes.writeUInt32LE(0, 22);
    if (oggCrc32(bytes) !== crc) throw new Error('OGG_CRC');
    if (serial === null) {
      if ((flags & 0x02) === 0) throw new Error('OGG_NO_BOS');
      serial = pageSerial;
    } else if (pageSerial !== serial || (flags & 0x02) !== 0) throw new Error('OGG_STREAM');
    if (pageSequence !== sequence) throw new Error('OGG_SEQUENCE');
    if ((flags & 0x01) !== 0 && partial.length === 0) throw new Error('OGG_CONTINUATION');
    let at = offset + 27 + count;
    let completed = 0;
    for (const value of table) {
      partial.push(file.subarray(at, at + value));
      at += value;
      if (value < 255) {
        packets.push(Buffer.concat(partial));
        partial = [];
        completed += 1;
      }
    }
    pageEnds.push(packets.length);
    granules.push(granule);
    if (completed > 0) finalGranule = granule;
    if ((flags & 0x04) !== 0) ended = true;
    sequence += 1;
    offset += size;
  }
  if (!ended || partial.length > 0) throw new Error('OGG_NO_EOS');
  if (packets.length < 3) throw new Error('OGG_OPUS_TOO_SHORT');
  const head = packets[0]!;
  if (head.length < 19 || head.toString('ascii', 0, 8) !== 'OpusHead' || head.readUInt8(8) !== 1) throw new Error('OPUS_HEAD');
  if (pageEnds[0] !== 1) throw new Error('OPUS_HEAD_PAGE');
  const tags = packets[1]!;
  if (tags.toString('ascii', 0, 8) !== 'OpusTags') throw new Error('OPUS_TAGS');
  const vendorLength = tags.readUInt32LE(8);
  const vendor = tags.toString('utf8', 12, 12 + vendorLength);
  if (pageEnds[1] !== 2 || granules[0] !== 0n || granules[1] !== 0n) throw new Error('OPUS_TAGS_PAGE');
  const audio = packets.slice(2);
  // Each audio page's granule is the running sample count at its last completed packet (RFC 7845 §4).
  let running = 0n;
  for (let p = 2; p < pageEnds.length; p += 1) {
    for (let i = pageEnds[p - 1]!; i < pageEnds[p]!; i += 1) running += BigInt(opusPacketSamples48k(packets[i]!));
    if (pageEnds[p]! > pageEnds[p - 1]! && granules[p] !== running) throw new Error('OPUS_GRANULE');
  }
  return {
    channels: head.readUInt8(9), preSkip: head.readUInt16LE(10), inputRate: head.readUInt32LE(12), vendor, packets: audio, finalGranule,
  };
}
