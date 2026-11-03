import XCTest
@testable import QandeelCallCore

/// S8B-06 CP2 (iOS) — the Opus support probe: the vendored libopus builds, the encoder HOLDS the frozen settings (read
/// back, not assumed), its packets are mono 20 ms with in-band FEC and no DTX, and the downlink decodes the server's real
/// libopus HYBRID and SILK packets at their level (Android CP1's Concentus defect, checked here so it cannot recur on iOS).
final class OpusCodecsTests: XCTestCase {
  /// The same synthetic voiced signal as the Android and server tests (harmonics, moving pitch, syllable envelope).
  static func synth(rate: Int, frame: Int, samples: Int, gain: Double = 5000) -> [Int16] {
    (0..<samples).map { i in
      let t = Double(frame * samples + i) / Double(rate)
      let pitch = 120 + 30 * sin(2 * Double.pi * 0.7 * t + 1)
      let envelope = 0.5 + 0.5 * sin(2 * Double.pi * 3 * t)
      var v = 0.0
      for h in 1...6 { v += sin(2 * Double.pi * pitch * Double(h) * t) / Double(h) }
      return Int16(clamping: Int((gain * envelope * v).rounded()))
    }
  }

  /// RFC 6716 §3.1: mono and exactly 20 ms.
  private func mono20ms(_ packet: [UInt8]) -> Bool {
    let toc = Int(packet[0])
    if toc & 0x04 != 0 { return false }
    let config = toc >> 3
    let code = toc & 0x03
    let frames = code == 0 ? 1 : (code == 3 ? Int(packet[1]) & 0x3f : 2)
    let tenths = config < 12 ? [100, 200, 400, 600][config % 4] : (config < 16 ? [100, 200][config % 2] : [25, 50, 100, 200][config % 4])
    return frames * tenths == 200
  }

  /// libopus `ec_dec_init` + `ec_dec_bit_logp`: enough to read the first SILK flags (VAD, then LBRR).
  private struct RangeDecoder {
    let buf: [UInt8]
    var offs: Int
    var rng: UInt64 = 128
    var value: UInt64 = 0
    var rem: Int = 0

    init(_ buf: [UInt8], _ offs: Int) {
      self.buf = buf
      self.offs = offs
      rem = readByte()
      value = rng - 1 - UInt64(rem >> 1)
      normalize()
    }

    mutating func readByte() -> Int {
      if offs < buf.count { let b = Int(buf[offs]); offs += 1; return b }
      return 0
    }

    mutating func normalize() {
      while rng <= (1 << 23) {
        rng = (rng << 8) & 0xffff_ffff
        var sym = rem
        rem = readByte()
        sym = ((sym << 8) | rem) >> 1
        value = ((value << 8) + UInt64(0xff & ~sym)) & ((1 << 31) - 1)
      }
    }

    mutating func bit(_ logp: Int) -> Bool {
      let s = rng >> UInt64(logp)
      let ret = value < s
      if !ret { value -= s }
      rng = ret ? s : rng - s
      normalize()
      return ret
    }
  }

  private func lbrr(_ packet: [UInt8]) -> Bool? {
    let config = Int(packet[0]) >> 3
    if config >= 16 || (packet[0] & 0x03) != 0 { return nil }
    var dec = RangeDecoder(packet, 1)
    _ = dec.bit(1)
    return dec.bit(1)
  }

  func testTheEncoderHoldsTheFrozenSettings() throws {
    let s = try XCTUnwrap(try UplinkOpusEncoder().settings())
    XCTAssertEqual(s.bitrate, 24_000)
    XCTAssertEqual(s.complexity, 5)
    XCTAssertEqual(s.fec, 1, "in-band FEC on")
    XCTAssertEqual(s.loss, 10, "the expected loss without which libopus writes no redundancy")
    XCTAssertEqual(s.dtx, 0, "DTX off")
  }

  func testUplinkPacketsAreMono20msWithFecAndDecodable() throws {
    let encoder = try UplinkOpusEncoder()
    var error: Int32 = 0
    let decoder = try XCTUnwrap(opusDecoder16k(&error))
    defer { opusDecoderDestroy(decoder) }
    var withFec = 0
    for f in 0..<150 {
      let pcm = Self.synth(rate: 16_000, frame: f, samples: 320)
      let packet = try pcm.withUnsafeBufferPointer { try encoder.encode($0.baseAddress!) }
      XCTAssertTrue(mono20ms(packet), "mono 20 ms")
      XCTAssertGreaterThan(packet.count, 3, "no DTX frame")
      XCTAssertEqual(opusDecode(decoder, packet), 320)
      if f > 0 && lbrr(packet) == true { withFec += 1 }
    }
    XCTAssertGreaterThanOrEqual(withFec, 120, "in-band FEC is present in most packets (\(withFec)/149)")
  }

  func testSilenceStillYieldsFullPacketsBecauseDtxIsOff() throws {
    let encoder = try UplinkOpusEncoder()
    let silence = [Int16](repeating: 0, count: 320)
    for _ in 0..<100 {
      let packet = try silence.withUnsafeBufferPointer { try encoder.encode($0.baseAddress!) }
      XCTAssertTrue(mono20ms(packet))
      XCTAssertGreaterThan(packet.count, 2, "a DTX encoder would send 1–2 byte packets here")
    }
  }

  func testDownlinkDecodesLibopusHybridAndSilkPacketsAtTheirLevel() throws {
    let url = try XCTUnwrap(Bundle.module.url(forResource: "s806-libopus-downlink-hybrid", withExtension: "txt", subdirectory: "Fixtures"))
    let lines = try String(contentsOf: url, encoding: .utf8).split(whereSeparator: \.isNewline).map(String.init).filter { !$0.hasPrefix("#") }
    let packets: [[UInt8]] = lines.filter { !$0.hasPrefix("levels ") }.map { hex in
      let chars = Array(hex)
      return stride(from: 0, to: chars.count, by: 2).map { UInt8(String(chars[$0..<($0 + 2)]), radix: 16)! }
    }
    let expected = try XCTUnwrap(lines.first { $0.hasPrefix("levels ") }).dropFirst("levels ".count).split(separator: ",").map { Double($0)! }
    XCTAssertEqual(packets.count, expected.count)
    XCTAssertGreaterThanOrEqual(packets.filter { (12...15).contains(Int($0[0]) >> 3) }.count, 30, "the fixture carries hybrid packets")
    let decoder = try DownlinkOpusDecoder()
    var pcm = [Int16](repeating: 0, count: DownlinkOpusDecoder.maxFrameSamples)
    var audibleHybrid = 0
    for (i, packet) in packets.enumerated() {
      let n = try pcm.withUnsafeMutableBufferPointer { try decoder.decode(packet, into: $0.baseAddress!) }
      XCTAssertEqual(n, DownlinkOpusDecoder.frameSamples, "20 ms at 24 kHz")
      var energy = 0.0
      for k in 0..<n { energy += Double(pcm[k]) * Double(pcm[k]) }
      let db = 10 * log10(energy / Double(n) / 32768 / 32768 + 1e-12)
      let config = Int(packet[0]) >> 3
      if expected[i] > -40 {
        XCTAssertLessThanOrEqual(abs(db - expected[i]), 3, "packet \(i) (config \(config)): \(db) dBFS against libopus \(expected[i])")
        if (12...15).contains(config) { audibleHybrid += 1 }
      } else {
        XCTAssertLessThan(db, -40, "packet \(i) is quiet in libopus and here")
      }
    }
    XCTAssertGreaterThanOrEqual(audibleHybrid, 8)
  }

  func testDownlinkRoundTripsA24kHzVoiceAtItsLevel() throws {
    let decoder = try DownlinkOpusDecoder()
    var error: Int32 = 0
    let enc = try XCTUnwrap(opusEncoder24k(&error))
    defer { opusEncoderDestroy(enc) }
    var pcm = [Int16](repeating: 0, count: DownlinkOpusDecoder.maxFrameSamples)
    var inEnergy = 0.0, outEnergy = 0.0
    for f in 0..<100 {
      let frame = Self.synth(rate: 24_000, frame: f, samples: 480)
      let packet = opusEncode(enc, frame)
      let n = try pcm.withUnsafeMutableBufferPointer { try decoder.decode(packet, into: $0.baseAddress!) }
      XCTAssertEqual(n, 480)
      if f >= 10 {
        for v in frame { inEnergy += Double(v) * Double(v) }
        for k in 0..<n { outEnergy += Double(pcm[k]) * Double(pcm[k]) }
      }
    }
    XCTAssertLessThanOrEqual(abs(10 * log10(outEnergy / inEnergy)), 3, "the decoded voice keeps its level")
  }
}
