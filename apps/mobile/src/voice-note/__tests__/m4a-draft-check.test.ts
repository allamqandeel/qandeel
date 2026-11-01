/**
 * S8B-03 (CP2, C-23) — a draft is offered only when it is a FINISHED M4A: `ftyp` first, exactly one `moov` and one
 * `mdat`, and top-level boxes that tile the file. A recorder killed mid-recording leaves frames without an index.
 */
import { checkDraftFile } from '../m4a-draft-check';

function box(type: string, payload: number, size = payload + 8): Uint8Array {
  const bytes = new Uint8Array(payload + 8);
  new DataView(bytes.buffer).setUint32(0, size);
  for (let i = 0; i < 4; i += 1) bytes[4 + i] = type.charCodeAt(i);
  return bytes;
}
function largeBox(type: string, payload: number): Uint8Array {
  const bytes = new Uint8Array(payload + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 1);
  for (let i = 0; i < 4; i += 1) bytes[4 + i] = type.charCodeAt(i);
  view.setUint32(8, 0);
  view.setUint32(12, payload + 16);
  return bytes;
}
function file(...boxes: Uint8Array[]): Uint8Array {
  const total = boxes.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const b of boxes) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}
const check = (bytes: Uint8Array, size = bytes.length) => checkDraftFile((offset, length) => bytes.subarray(offset, offset + length), size);

describe('checkDraftFile', () => {
  it('accepts the Android layout (ftyp, mdat, moov) and the iOS layout (ftyp, free, moov, mdat)', () => {
    expect(check(file(box('ftyp', 16), box('mdat', 4000), box('moov', 600)))).toBe('COMPLETE');
    expect(check(file(box('ftyp', 20), box('free', 8), box('moov', 600), box('mdat', 4000)))).toBe('COMPLETE');
  });

  it('accepts a 64-bit mdat size', () => {
    expect(check(file(box('ftyp', 16), largeBox('mdat', 4000), box('moov', 600)))).toBe('COMPLETE');
  });

  it('refuses a recording cut off before its index was written (no moov)', () => {
    expect(check(file(box('ftyp', 16), box('mdat', 4000)))).toBe('INCOMPLETE');
    // A recorder that reserved an open-ended mdat (size 0, "to the end") and died: still no index.
    expect(check(file(box('ftyp', 16), box('mdat', 4000, 0)))).toBe('INCOMPLETE');
  });

  it('refuses a file whose boxes overrun it or leave a tail', () => {
    const whole = file(box('ftyp', 16), box('mdat', 4000), box('moov', 600));
    expect(check(whole.subarray(0, whole.length - 10))).toBe('INCOMPLETE');
    expect(check(whole, whole.length + 4)).toBe('INCOMPLETE');
  });

  it('refuses a file that does not begin with ftyp, or holds two indexes or two media boxes', () => {
    expect(check(file(box('mdat', 4000), box('ftyp', 16), box('moov', 600)))).toBe('INCOMPLETE');
    expect(check(file(box('ftyp', 16), box('mdat', 4000), box('moov', 600), box('moov', 600)))).toBe('INCOMPLETE');
    expect(check(file(box('ftyp', 16), box('mdat', 400), box('mdat', 400), box('moov', 600)))).toBe('INCOMPLETE');
  });

  it('refuses tiny, empty, malformed and over-long box chains', () => {
    expect(check(new Uint8Array(0))).toBe('INCOMPLETE');
    expect(check(new Uint8Array(12))).toBe('INCOMPLETE');
    expect(check(file(box('ftyp', 16), box('mdat', 10, 4), box('moov', 600)))).toBe('INCOMPLETE');
    const many = Array.from({ length: 20 }, () => box('free', 0));
    expect(check(file(box('ftyp', 16), ...many, box('mdat', 10), box('moov', 10)))).toBe('INCOMPLETE');
  });
});
