import Foundation

/// S8B-06 CP2 (iOS) — the speech-onset detector for LOCAL barge-in only (contract v1.0 §5.1 / §5.2 step 1), the same
/// rules and defaults as the Android engine's `SpeechOnsetDetector.kt` (CP1): it judges every 20 ms frame of the signal
/// the platform delivers AFTER its echo canceller (iOS: the voice-processing I/O unit), and declares an onset after
/// `onsetFrames` consecutive speech frames (10 × 20 ms = the contract's 200 ms), timed at the FIRST frame of the run.
///
/// A frame is speech when it is above the tracked noise floor by `floorMarginDb`, above `absoluteMinDb`, and — while
/// QANDEEL is audible — within `echoGuardDb` of the loudest reply audio rendered in the recent echo window (a residual echo
/// the canceller left is far below the reference; a person talking into the phone is not). Ending the person's turn is the
/// server's VAD (contract §5.1). Pure: no AVFoundation, no clock.
struct VadConfig: Equatable {
  var onsetFrames: Int = 10
  var floorMarginDb: Double = 10.0
  var absoluteMinDb: Double = -50.0
  var echoGuardDb: Double = -18.0
  /// How fast the floor may rise, per 20 ms frame (0.02 dB = 1 dB per second).
  var floorRisePerFrameDb: Double = 0.02
  var floorInitialDb: Double = -70.0
}

final class SpeechOnsetDetector {
  enum Kind { case none, onset }

  struct Decision: Equatable {
    let kind: Kind
    let onsetCaptureMs: Int64
    let speechFrame: Bool
  }

  private let config: VadConfig
  private(set) var floorDb: Double
  private var run = 0
  private var runStartMs: Int64 = 0
  private var declared = false

  init(_ config: VadConfig = VadConfig()) {
    self.config = config
    floorDb = config.floorInitialDb
  }

  func push(frameDb: Double, refDb: Double?, captureMs: Int64) -> Decision {
    let aboveFloor = frameDb >= floorDb + config.floorMarginDb
    let aboveAbsolute = frameDb >= config.absoluteMinDb
    let aboveEcho = refDb.map { frameDb >= $0 + config.echoGuardDb } ?? true
    let speech = aboveFloor && aboveAbsolute && aboveEcho
    if frameDb < floorDb { floorDb = frameDb } else if !speech { floorDb = min(frameDb, floorDb + config.floorRisePerFrameDb) }
    if !speech {
      run = 0
      declared = false
      return Decision(kind: .none, onsetCaptureMs: -1, speechFrame: false)
    }
    if run == 0 { runStartMs = captureMs }
    run += 1
    if !declared && run >= config.onsetFrames {
      declared = true
      return Decision(kind: .onset, onsetCaptureMs: runStartMs, speechFrame: true)
    }
    return Decision(kind: .none, onsetCaptureMs: -1, speechFrame: true)
  }

  func reset() {
    floorDb = config.floorInitialDb
    run = 0
    declared = false
  }

  /// RMS of 16-bit PCM in dBFS; digital silence is -120.
  static func levelDb(_ pcm: UnsafeBufferPointer<Int16>) -> Double {
    if pcm.isEmpty { return -120 }
    var sum = 0.0
    for v in pcm { let d = Double(v); sum += d * d }
    let rms = (sum / Double(pcm.count)).squareRoot() / 32768.0
    return rms <= 1e-6 ? -120 : 20 * log10(rms)
  }

  static func levelDb(_ pcm: [Int16], count: Int? = nil) -> Double {
    let n = min(count ?? pcm.count, pcm.count)
    return pcm.withUnsafeBufferPointer { levelDb(UnsafeBufferPointer(rebasing: $0[0..<n])) }
  }
}
