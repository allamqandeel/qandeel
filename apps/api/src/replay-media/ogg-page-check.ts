/**
 * S8B-07 CP1-B (contract §10) — the strict container check every call segment passes before it is decoded: one
 * complete, valid Ogg stream (capture pattern, version 0, every page's CRC, one serial, consecutive page sequence, BOS
 * first, EOS last, nothing after it, no dangling continuation) carrying a mono OpusHead and OpusTags. A failure is
 * DECODE_FAILED: a corrupt page is never skipped and never replaced by silence.
 *
 * Unlike the call writer's own reader, it does NOT require the granule positions to start at 0 or the pre-skip to be 0:
 * the worker never trusts a container's timestamps (every segment is placed by its database clock, and its decoded length
 * is checked against that clock), so a segment whose container starts at a non-zero timestamp is decoded correctly
 * (V-10, the measured hazard), and an altered length still fails the length check.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let r = i << 24;
    for (let j = 0; j < 8; j += 1) r = (r & 0x80000000) !== 0 ? (r << 1) ^ 0x04c11db7 : r << 1;
    table[i] = r >>> 0;
  }
  return table;
})();

/**
 * The Ogg CRC-32 (polynomial 0x04c11db7, initial 0, no reflection, no final XOR), the call writer's own function
 * restated here so the Replay pool's graph never loads the call codec (ogg-page-check.spec.ts proves them equal).
 */
export function oggPageCrc32(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]!) >>> 0;
  return crc >>> 0;
}

export function checkOggOpusPages(file: Buffer): boolean {
  let offset = 0;
  let sequence = 0;
  let serial: number | null = null;
  let ended = false;
  let partial = 0;
  const packets: Buffer[] = [];
  let current: Buffer[] = [];
  while (offset < file.length) {
    if (ended) return false;
    if (file.length - offset < 27 || file.toString('ascii', offset, offset + 4) !== 'OggS') return false;
    if (file.readUInt8(offset + 4) !== 0) return false;
    const flags = file.readUInt8(offset + 5);
    const pageSerial = file.readUInt32LE(offset + 14);
    const pageSequence = file.readUInt32LE(offset + 18);
    const crc = file.readUInt32LE(offset + 22);
    const count = file.readUInt8(offset + 26);
    if (offset + 27 + count > file.length) return false;
    const table = file.subarray(offset + 27, offset + 27 + count);
    const size = 27 + count + table.reduce((a, b) => a + b, 0);
    if (offset + size > file.length) return false;
    const page = Buffer.from(file.subarray(offset, offset + size));
    page.writeUInt32LE(0, 22);
    if (oggPageCrc32(page) !== crc) return false;
    if (serial === null) {
      if ((flags & 0x02) === 0) return false;
      serial = pageSerial;
    } else if (pageSerial !== serial || (flags & 0x02) !== 0) return false;
    if (pageSequence !== sequence) return false;
    if ((flags & 0x01) !== 0 && partial === 0) return false;
    let at = offset + 27 + count;
    for (const value of table) {
      if (packets.length < 2) current.push(file.subarray(at, at + value));
      at += value;
      partial += 1;
      if (value < 255) {
        if (packets.length < 2) packets.push(Buffer.concat(current));
        current = [];
        partial = 0;
      }
    }
    if ((flags & 0x04) !== 0) ended = true;
    sequence += 1;
    offset += size;
  }
  if (!ended || partial > 0 || packets.length < 2) return false;
  const head = packets[0]!;
  if (head.length < 19 || head.toString('ascii', 0, 8) !== 'OpusHead' || head.readUInt8(8) !== 1 || head.readUInt8(9) !== 1) return false;
  return packets[1]!.toString('ascii', 0, 8) === 'OpusTags';
}
