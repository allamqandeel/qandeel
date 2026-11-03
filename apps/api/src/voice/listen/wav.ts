/** S8B-04 (CP1) — signed 16-bit little-endian mono PCM in a canonical 44-byte RIFF/WAVE header. */
export const WAV_HEADER_BYTES = 44;

export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000 || pcm.length % 2 !== 0) throw new Error('WAV_INVALID_PCM');
  const header = Buffer.alloc(WAV_HEADER_BYTES);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm], WAV_HEADER_BYTES + pcm.length);
}

/**
 * S8B-05 CP4 — the PCM of a canonical 44-byte RIFF/WAVE file of signed 16-bit little-endian mono at `sampleRate` (the
 * fixed failure line F-01). Anything else is refused: the file is pinned by its digest, so a different shape is an error.
 */
export function wavToPcm(wav: Buffer, sampleRate: number): Buffer {
  const valid = wav.length > WAV_HEADER_BYTES && wav.toString('ascii', 0, 4) === 'RIFF' && wav.toString('ascii', 8, 12) === 'WAVE'
    && wav.toString('ascii', 12, 16) === 'fmt ' && wav.readUInt32LE(16) === 16 && wav.readUInt16LE(20) === 1 && wav.readUInt16LE(22) === 1
    && wav.readUInt32LE(24) === sampleRate && wav.readUInt16LE(34) === 16 && wav.toString('ascii', 36, 40) === 'data'
    && wav.readUInt32LE(40) === wav.length - WAV_HEADER_BYTES && (wav.length - WAV_HEADER_BYTES) % 2 === 0;
  if (!valid) throw new Error('WAV_UNSUPPORTED');
  return wav.subarray(WAV_HEADER_BYTES);
}
