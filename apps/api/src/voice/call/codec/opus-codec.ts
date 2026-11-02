import OpusScript from 'opusscript';

/**
 * S8B-05 CP1 — the ONE Opus codec of the live call, for both directions (D-C1): uplink mono 16 kHz 20 ms (decoded to the
 * recognizer's PCM s16le 16 kHz), downlink mono 24 kHz 20 ms (encoded from synthesized PCM in CP2). libopus itself, compiled
 * to WebAssembly (opusscript, MIT, no native build, no network); nothing here reads a file, the environment or the clock.
 *
 * Every codec instance owns WebAssembly memory: `close()` frees it, and a closed codec refuses work.
 */

export type OpusRate = 16_000 | 24_000;

/** RFC 6716 §3.1: the duration of one Opus frame in tenths of a millisecond, by the TOC's configuration number. */
function frameTenthsMs(config: number): number {
  if (config < 12) return [100, 200, 400, 600][config % 4]!; // SILK NB / MB / WB
  if (config < 16) return [100, 200][config % 2]!; // Hybrid SWB / FB
  return [25, 50, 100, 200][config % 4]!; // CELT NB / WB / SWB / FB
}

export interface OpusPacketShape {
  readonly channels: 1 | 2;
  readonly frames: number;
  /** The packet's total duration in tenths of a millisecond. */
  readonly durationTenthsMs: number;
}

/** Reads a packet's TOC (and frame count for code 3). Null: not a well-formed Opus packet header. */
export function opusPacketShape(packet: Buffer): OpusPacketShape | null {
  if (packet.length < 1) return null;
  const toc = packet[0]!;
  const config = toc >> 3;
  const channels = (toc & 0x04) !== 0 ? 2 : 1;
  const code = toc & 0x03;
  let frames: number;
  if (code === 0) frames = 1;
  else if (code === 1 || code === 2) frames = 2;
  else {
    if (packet.length < 2) return null;
    frames = packet[1]! & 0x3f;
    if (frames === 0) return null;
  }
  const durationTenthsMs = frames * frameTenthsMs(config);
  if (durationTenthsMs > 1200) return null; // RFC 6716 §3.2.5: at most 120 ms per packet
  return { channels, frames, durationTenthsMs };
}

/** The uplink rule (D-C1): one mono packet of exactly 20 ms. */
export function isUplinkPacket(packet: Buffer): boolean {
  const shape = opusPacketShape(packet);
  return shape !== null && shape.channels === 1 && shape.durationTenthsMs === 200;
}

/** Samples of a 48 kHz clock (the Ogg Opus granule clock, RFC 7845) one packet spans. */
export function opusPacketSamples48k(packet: Buffer): number {
  const shape = opusPacketShape(packet);
  if (!shape) throw new RangeError('OPUS_PACKET_INVALID');
  return (shape.durationTenthsMs * 48) / 10;
}

abstract class OpusCodec {
  protected codec: OpusScript | null;

  protected constructor(readonly rate: OpusRate) {
    this.codec = new OpusScript(rate, 1, OpusScript.Application.VOIP);
  }

  protected live(): OpusScript {
    if (!this.codec) throw new Error('OPUS_CODEC_CLOSED');
    return this.codec;
  }

  close(): void {
    this.codec?.delete();
    this.codec = null;
  }
}

/** Opus → PCM s16le mono at the decoder's rate. A packet libopus rejects throws (the caller treats it as a violation). */
export class OpusPacketDecoder extends OpusCodec {
  constructor(rate: OpusRate) {
    super(rate);
  }

  decode(packet: Buffer): Buffer {
    return this.live().decode(packet);
  }
}

/** PCM s16le mono → Opus, 20 ms per call, FEC on, DTX off, a fixed target bitrate (24 kbps up, 32 kbps down). */
export class OpusPacketEncoder extends OpusCodec {
  static readonly CTL_SET_INBAND_FEC = 4012;
  static readonly CTL_SET_PACKET_LOSS_PERC = 4014;
  static readonly CTL_SET_DTX = 4016;

  readonly frameSamples: number;

  constructor(rate: OpusRate, bitrate: number) {
    super(rate);
    const codec = this.live();
    codec.setBitrate(bitrate);
    codec.encoderCTL(OpusPacketEncoder.CTL_SET_INBAND_FEC, 1);
    codec.encoderCTL(OpusPacketEncoder.CTL_SET_PACKET_LOSS_PERC, 10);
    codec.encoderCTL(OpusPacketEncoder.CTL_SET_DTX, 0);
    this.frameSamples = (rate * 20) / 1000;
  }

  /** One 20 ms frame of PCM s16le mono (exactly frameSamples samples). */
  encode(pcm: Buffer): Buffer {
    if (pcm.length !== this.frameSamples * 2) throw new RangeError('OPUS_FRAME_SIZE');
    return this.live().encode(pcm, this.frameSamples);
  }
}

/** D-C1 uplink: 16 kHz, ~24 kbps. */
export const UPLINK_OPUS = Object.freeze({ rate: 16_000 as const, bitrate: 24_000 });
/** D-C1 downlink: 24 kHz, ~32 kbps (CP2 encodes the reply with it). */
export const DOWNLINK_OPUS = Object.freeze({ rate: 24_000 as const, bitrate: 32_000 });
