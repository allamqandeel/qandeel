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
