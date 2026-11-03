import COpus

/// Reference libopus endpoints for the probe tests (a 16 kHz decoder for the uplink, a 24 kHz 32 kbps encoder standing in
/// for the server's downlink), straight on the vendored C library.
func opusDecoder16k(_ error: inout Int32) -> OpaquePointer? {
  opus_decoder_create(16_000, 1, &error)
}

func opusDecode(_ decoder: OpaquePointer, _ packet: [UInt8]) -> Int32 {
  var out = [Int16](repeating: 0, count: 320 * 6)
  return packet.withUnsafeBufferPointer { bytes in
    out.withUnsafeMutableBufferPointer { opus_decode(decoder, bytes.baseAddress, Int32(bytes.count), $0.baseAddress, Int32(320 * 6), 0) }
  }
}

func opusDecoderDestroy(_ decoder: OpaquePointer) { opus_decoder_destroy(decoder) }

func opusEncoder24k(_ error: inout Int32) -> OpaquePointer? {
  guard let enc = opus_encoder_create(24_000, 1, OPUS_APPLICATION_VOIP, &error) else { return nil }
  _ = qandeel_opus_encoder_configure(enc, 32_000, 5, 0, 0, 0)
  return enc
}

func opusEncode(_ encoder: OpaquePointer, _ pcm: [Int16]) -> [UInt8] {
  var out = [UInt8](repeating: 0, count: 1275)
  let n = pcm.withUnsafeBufferPointer { input in
    out.withUnsafeMutableBufferPointer { opus_encode(encoder, input.baseAddress, Int32(pcm.count), $0.baseAddress, 1275) }
  }
  return n > 0 ? Array(out[0..<Int(n)]) : []
}

func opusEncoderDestroy(_ encoder: OpaquePointer) { opus_encoder_destroy(encoder) }
