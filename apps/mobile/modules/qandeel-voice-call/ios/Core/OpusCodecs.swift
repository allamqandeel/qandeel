import COpus

/// S8B-06 CP2 (iOS) — the phone's Opus, both directions, with the frozen v1 frame format (D-C1), on the reference libopus
/// 1.5.2 (vendored C, `ios/opus`, BSD; the tarball's sha256 is in `ios/opus/VENDORED.md`):
///
///   uplink   PCM s16 mono 16 kHz → Opus VOIP, one 20 ms packet per frame, 24 kbps, in-band FEC on with a 10 % expected loss
///            (without which libopus writes no redundancy), DTX off, complexity 5 — the Android engine's settings and the
///            server codec's own (`apps/api/src/voice/call/codec/opus-codec.ts`);
///   downlink Opus mono 24 kHz → PCM s16 at 24 kHz.
///
/// Why not Apple's `AVAudioConverter` Opus: it exposes no in-band FEC setting, and the frozen uplink requires FEC on. The
/// codec probe test (`OpusCodecsTests`) reads every setting back from the encoder. Android's lesson carried over: CP1's
/// Concentus decoded HYBRID packets to silence below 48 kHz; libopus has no such defect, and the same real libopus hybrid
/// packets (`s806-libopus-downlink-hybrid.txt`) are decoded at 24 kHz and checked to carry the signal.
final class UplinkOpusEncoder {
  static let rate: Int32 = 16_000
  static let frameSamples = 320
  static let bitrate: Int32 = 24_000
  static let complexity: Int32 = 5
  static let maxPacket = 1275

  enum CodecError: Error { case create(Int32), configure(Int32), encode(Int32) }

  private let encoder: OpaquePointer
  private var out = [UInt8](repeating: 0, count: UplinkOpusEncoder.maxPacket)

  init() throws {
    var error: Int32 = 0
    guard let enc = opus_encoder_create(UplinkOpusEncoder.rate, 1, OPUS_APPLICATION_VOIP, &error), error == OPUS_OK else {
      throw CodecError.create(error)
    }
    let configured = qandeel_opus_encoder_configure(enc, UplinkOpusEncoder.bitrate, UplinkOpusEncoder.complexity, 1, 10, 0)
    if configured != OPUS_OK {
      opus_encoder_destroy(enc)
      throw CodecError.configure(configured)
    }
    encoder = enc
  }

  deinit { opus_encoder_destroy(encoder) }

  /// One 20 ms frame (`frameSamples` samples) → one Opus packet.
  func encode(_ pcm: UnsafePointer<Int16>) throws -> [UInt8] {
    let n = out.withUnsafeMutableBufferPointer { buffer in
      opus_encode(encoder, pcm, Int32(UplinkOpusEncoder.frameSamples), buffer.baseAddress!, Int32(UplinkOpusEncoder.maxPacket))
    }
    if n < 0 { throw CodecError.encode(n) }
    return Array(out[0..<Int(n)])
  }

  func reset() { _ = qandeel_opus_encoder_reset(encoder) }

  /// What the encoder holds (the probe test): bitrate, complexity, FEC, loss %, DTX.
  func settings() -> (bitrate: Int32, complexity: Int32, fec: Int32, loss: Int32, dtx: Int32)? {
    var b: Int32 = 0, c: Int32 = 0, f: Int32 = 0, l: Int32 = 0, d: Int32 = 0
    guard qandeel_opus_encoder_get(encoder, &b, &c, &f, &l, &d) == OPUS_OK else { return nil }
    return (b, c, f, l, d)
  }
}

final class DownlinkOpusDecoder {
  static let rate: Int32 = 24_000
  static let frameSamples = 480
  /// 120 ms at 24 kHz, the longest packet Opus allows.
  static let maxFrameSamples = 2880

  enum CodecError: Error { case create(Int32), decode(Int32) }

  private let decoder: OpaquePointer

  init() throws {
    var error: Int32 = 0
    guard let dec = opus_decoder_create(DownlinkOpusDecoder.rate, 1, &error), error == OPUS_OK else { throw CodecError.create(error) }
    decoder = dec
  }

  deinit { opus_decoder_destroy(decoder) }

  /// One packet → its PCM at 24 kHz into `into` (at least `maxFrameSamples`); returns the sample count.
  func decode(_ packet: [UInt8], into: UnsafeMutablePointer<Int16>) throws -> Int {
    let n = packet.withUnsafeBufferPointer { bytes in
      opus_decode(decoder, bytes.baseAddress, Int32(bytes.count), into, Int32(DownlinkOpusDecoder.maxFrameSamples), 0)
    }
    if n < 0 { throw CodecError.decode(n) }
    return Int(n)
  }

  func reset() { _ = qandeel_opus_decoder_reset(decoder) }
}
