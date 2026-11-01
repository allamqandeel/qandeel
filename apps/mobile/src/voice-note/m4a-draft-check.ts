/**
 * S8B-03 (CP2) — is a local draft a FINISHED M4A? A recorder writes the index (`moov`) only when it is stopped, so a file
 * left by a process that died mid-recording has its frames but no index, and no player or server can use it. This reads
 * the top-level box headers only (never the audio): `ftyp` first, one `moov`, one `mdat`, and boxes that tile the file
 * exactly. Anything else is not restorable (C-23). The server's own duration proof (CP1 §4.6.2) still decides acceptance.
 */
export type DraftFileCheck = 'COMPLETE' | 'INCOMPLETE';

/** Reads up to `length` bytes at `offset`. */
export type ByteRangeReader = (offset: number, length: number) => Uint8Array;

const MAX_TOP_LEVEL_BOXES = 16;
const FILLER = new Set(['free', 'skip', 'wide']);

const fourcc = (bytes: Uint8Array, at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
const u32 = (bytes: Uint8Array, at: number) => ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];

export function checkDraftFile(read: ByteRangeReader, fileSize: number): DraftFileCheck {
  if (!Number.isSafeInteger(fileSize) || fileSize < 16) return 'INCOMPLETE';
  let offset = 0;
  const seen: string[] = [];
  while (offset < fileSize) {
    if (seen.length >= MAX_TOP_LEVEL_BOXES) return 'INCOMPLETE';
    const header = read(offset, 16);
    if (header.length < 8) return 'INCOMPLETE';
    let size = u32(header, 0);
    const type = fourcc(header, 4);
    if (size === 1) {
      if (header.length < 16) return 'INCOMPLETE';
      const high = u32(header, 8);
      size = high * 0x100000000 + u32(header, 12);
    } else if (size === 0) {
      size = fileSize - offset; // "to the end of the file": only a final mdat may say so, and it has no index after it
    }
    if (size < 8 || offset + size > fileSize) return 'INCOMPLETE';
    seen.push(type);
    offset += size;
  }
  const meaningful = seen.filter((type) => !FILLER.has(type));
  if (meaningful[0] !== 'ftyp') return 'INCOMPLETE';
  if (meaningful.filter((type) => type === 'moov').length !== 1 || meaningful.filter((type) => type === 'mdat').length !== 1) return 'INCOMPLETE';
  return offset === fileSize ? 'COMPLETE' : 'INCOMPLETE';
}
