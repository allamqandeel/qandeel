// S8B-03 CP2 — VALIDATION ONLY. Prints what an M4A's container declares: the movie and media durations (mvhd, mdhd, in
// ms), the codec box with its sample rate, the esds object type, and the AudioSpecificConfig's audio object type
// (2 = AAC-LC) and channel configuration (1 = mono), and the top-level boxes. It reads the container only, never the audio.
//   usage: node scripts/s8b-03/m4a-info.cjs <file.m4a>
// `channels` is the AudioSpecificConfig's channel configuration — the decoder's truth. `entryChannels` is the sample entry's
// informative channelcount, which iOS's recorder writes as 2 for a mono AAC stream (the iOS proof, 2026-10-31).
const fs = require('fs');
const b = fs.readFileSync(process.argv[2]);
const out = {};

// esds: an ES_Descriptor (0x03) holding a DecoderConfigDescriptor (0x04) holding the DecoderSpecificInfo (0x05), each
// with an expandable length (ISO/IEC 14496-1 §8.3.3), read in order rather than by searching for a tag byte.
function esds(start, end) {
  let at = start + 4; // version + flags
  const length = () => {
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const x = b[at++];
      n = (n << 7) | (x & 0x7f);
      if (!(x & 0x80)) break;
    }
    return n;
  };
  while (at < end) {
    const tag = b[at++];
    const n = length();
    const body = at;
    if (tag === 0x03) {
      const flags = b[at + 2];
      at += 3 + (flags & 0x80 ? 2 : 0) + (flags & 0x40 ? 1 + b[at + 3] : 0) + (flags & 0x20 ? 2 : 0);
      continue;
    }
    if (tag === 0x04) {
      out.objectType = b[at];
      at += 13;
      continue;
    }
    if (tag === 0x05) {
      out.audioObjectType = b[body] >> 3;
      out.samplingFrequencyIndex = ((b[body] & 7) << 1) | (b[body + 1] >> 7);
      out.channels = (b[body + 1] >> 3) & 0xf;
    }
    at = body + n;
  }
}

function walk(start, end, depth) {
  let at = start;
  while (at + 8 <= end) {
    let size = b.readUInt32BE(at); const type = b.toString('latin1', at + 4, at + 8); let hdr = 8;
    if (size === 1) { size = Number(b.readBigUInt64BE(at + 8)); hdr = 16; } else if (size === 0) size = end - at;
    const body = at + hdr;
    if (type === 'mvhd' || type === 'mdhd') {
      const v = b[body]; const ts = v === 1 ? b.readUInt32BE(body + 20) : b.readUInt32BE(body + 12);
      const dur = v === 1 ? Number(b.readBigUInt64BE(body + 24)) : b.readUInt32BE(body + 16);
      out[type] = Math.round((dur / ts) * 1000);
    }
    if (type === 'mp4a') { out.codec = 'mp4a'; out.entryChannels = b.readUInt16BE(body + 16); out.sampleRate = b.readUInt32BE(body + 24) >>> 16; walk(body + 28, at + size, depth + 1); }
    else if (type === 'esds') esds(body, at + size);
    else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) walk(body, at + size, depth + 1);
    else if (type === 'stsd') walk(body + 8, at + size, depth + 1);
    if (depth === 0) (out.top ??= []).push(type);
    at += size;
  }
}
walk(0, b.length, 0);
out.bytes = b.length;
console.log(JSON.stringify(out));
