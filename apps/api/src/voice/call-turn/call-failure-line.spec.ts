import { OpusPacketDecoder } from '../call/codec/opus-codec';
import { pcmToWav, wavToPcm } from '../listen/wav';
import { callFailureLine, failureLineFor } from './call-failure-line';

/** A synthetic tone (never a voice, never a provider): `ms` of a 440 Hz sine at 24 kHz. */
const tone = (ms: number): Buffer => {
  const samples = (24_000 * ms) / 1000;
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) pcm.writeInt16LE(Math.round(8_000 * Math.sin((2 * Math.PI * 440 * i) / 24_000)), i * 2);
  return pcm;
};

describe('S8B-05 CP4 the fixed failure line F-01 as the call plays it', () => {
  it('reads only a canonical 16-bit mono WAV at the rate asked; anything else is refused', () => {
    const pcm = tone(30);
    expect(wavToPcm(pcmToWav(pcm, 24_000), 24_000).equals(pcm)).toBe(true);
    expect(() => wavToPcm(pcmToWav(pcm, 16_000), 24_000)).toThrow('WAV_UNSUPPORTED');
    expect(() => wavToPcm(pcmToWav(pcm, 24_000).subarray(0, 50), 24_000)).toThrow('WAV_UNSUPPORTED');
    expect(() => wavToPcm(Buffer.alloc(100), 24_000)).toThrow('WAV_UNSUPPORTED');
  });

  it('is null while its files are not installed: nothing is played', () => {
    expect(callFailureLine({ state: 'NOT_INSTALLED' })).toBeNull();
    expect(failureLineFor(null, 'مرحبا')).toBeNull();
  });

  it('encodes each language once as 20 ms Opus 24 kHz packets (the last completed with silence), chosen by the words of the exchange', () => {
    const line = callFailureLine({ state: 'READY', audio: { ar: pcmToWav(tone(50), 24_000), en: pcmToWav(tone(20), 24_000) } })!;
    expect(line.ar).toHaveLength(3); // 50 ms: two whole frames and one completed with silence
    expect(line.en).toHaveLength(1);
    const decoder = new OpusPacketDecoder(24_000);
    try {
      for (const packet of line.ar) expect(decoder.decode(packet).length).toBe(960);
    } finally {
      decoder.close();
    }
    expect(failureLineFor(line, 'مرحبا يا قنديل')).toBe(line.ar);
    expect(failureLineFor(line, 'hello there')).toBe(line.en);
  });
});
