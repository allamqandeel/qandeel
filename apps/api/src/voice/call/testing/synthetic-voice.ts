import { OpusPacketEncoder, UPLINK_OPUS } from '../codec/opus-codec';

/**
 * S8B-05 CP1 — test and synthetic-proof material only: a synthetic voiced signal (harmonics with a moving pitch and a
 * syllable envelope), never a person's voice, and its real libopus packets. Nothing here is reachable from a route.
 */
export function synthPcm(rate: number, frames: number, seed = 1): Buffer[] {
  const samples = (rate * 20) / 1000;
  const out: Buffer[] = [];
  for (let f = 0; f < frames; f += 1) {
    const pcm = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i += 1) {
      const t = (f * samples + i) / rate;
      const pitch = 120 + 30 * Math.sin(2 * Math.PI * 0.7 * t + seed);
      const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t);
      let v = 0;
      for (let h = 1; h <= 6; h += 1) v += Math.sin(2 * Math.PI * pitch * h * t) / h;
      pcm.writeInt16LE(Math.round(5000 * envelope * v), i * 2);
    }
    out.push(pcm);
  }
  return out;
}

/** Real uplink packets (mono, 20 ms, 16 kHz, about 24 kbps) of the synthetic signal. */
export function syntheticUplinkPackets(frames: number, seed = 1): Buffer[] {
  const encoder = new OpusPacketEncoder(UPLINK_OPUS.rate, UPLINK_OPUS.bitrate);
  try {
    return synthPcm(UPLINK_OPUS.rate, frames, seed).map((pcm) => encoder.encode(pcm));
  } finally {
    encoder.close();
  }
}
