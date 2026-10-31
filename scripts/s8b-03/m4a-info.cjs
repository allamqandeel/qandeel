// S8B-03 CP2 — VALIDATION ONLY. Prints what an M4A's container declares: the movie and media durations (mvhd, mdhd, in
// ms), the codec box with its channel count and sample rate, the esds object / audio object type (2 = AAC-LC) and the
// top-level boxes. It reads the container only, never the audio.   usage: node scripts/s8b-03/m4a-info.cjs <file.m4a>
const fs = require('fs');
const b = fs.readFileSync(process.argv[2]);
const out = {};
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
    if (type === 'mp4a') { out.codec = 'mp4a'; out.channels = b.readUInt16BE(body + 16); out.sampleRate = b.readUInt32BE(body + 24) >>> 16; walk(body + 28, at + size, depth + 1); }
    else if (type === 'esds') { const i = b.indexOf(Buffer.from([0x05]), body + 4); if (i > 0) { const oti = b[b.indexOf(Buffer.from([0x04]), body + 4) + 2]; out.objectType = oti; out.audioObjectType = b[i + 2] >> 3; } }
    else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) walk(body, at + size, depth + 1);
    else if (type === 'stsd') walk(body + 8, at + size, depth + 1);
    if (depth === 0) (out.top ??= []).push(type);
    at += size;
  }
}
walk(0, b.length, 0);
out.bytes = b.length;
console.log(JSON.stringify(out));
