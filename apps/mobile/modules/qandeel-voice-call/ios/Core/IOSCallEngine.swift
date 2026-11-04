#if os(iOS)
import AVFoundation

/// S8B-06 CP2 (iOS) — one engine: the decisions (`CallEngineCore`) on the platform I/O (`VoiceProcessingAudioIO`).
///
/// `PLATFORM_CALL` (the production call): CallKit owns the audio session; the engine starts only inside the ACTIVE call
/// (after `didActivate`) and never activates, configures or deactivates the session. `SELF` (the proof mode, as Android
/// CP1's): the engine configures and activates the session itself, and deactivates it at the end.
final class IOSCallEngine: CallAudioPort {
  let core: CallEngineCore
  private let io: VoiceProcessingAudioIO
  private let ownsSession: Bool
  private let speaker: Bool
  /// The engine core holds its sink weakly; the engine keeps it alive for the engine's whole life.
  private let sink: EngineSink
  /// Called once when the engine stopped, with the reason (the module tells the coordinator).
  var onStopped: ((String) -> Void)?
  private var stopped = false
  private let lock = NSLock()

  init(options: CallEngineCore.Options, sink: EngineSink, ownsSession: Bool, speaker: Bool) throws {
    core = try CallEngineCore(options: options, sink: sink)
    io = VoiceProcessingAudioIO(core: core)
    self.ownsSession = ownsSession
    self.speaker = speaker
    self.sink = sink
    io.onFault = { [weak self] code in
      sink.fault(code)
      self?.stop("CAPTURE_LOST")
    }
  }

  /// Starts both directions; throws a coded error and leaves nothing open when anything fails.
  func start() throws -> [String: Any?] {
    if !CallAudioSession.microphoneGranted { throw EngineError("PERMISSION_DENIED") }
    if ownsSession {
      do {
        try CallAudioSession.configure(speaker: speaker)
        try AVAudioSession.sharedInstance().setActive(true)
      } catch {
        throw EngineError("ENGINE_SESSION_FAILED")
      }
    }
    do {
      try io.start()
    } catch VoiceProcessingAudioIO.IOError.start(let code) {
      cleanUpAfterFailedStart()
      throw EngineError(code)
    } catch {
      cleanUpAfterFailedStart()
      throw EngineError("ENGINE_START_FAILED")
    }
    core.begin()
    var described = core.describe()
    described["audioOwner"] = ownsSession ? "SELF" : "PLATFORM_CALL"
    described["sampleRate"] = AVAudioSession.sharedInstance().sampleRate
    described["ioBufferMs"] = AVAudioSession.sharedInstance().ioBufferDuration * 1000
    described["outputLatencyMs"] = AVAudioSession.sharedInstance().outputLatency * 1000
    described["inputLatencyMs"] = AVAudioSession.sharedInstance().inputLatency * 1000
    return described
  }

  private func cleanUpAfterFailedStart() {
    io.stop()
    if ownsSession { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
  }

  /// Stops and releases everything; idempotent; never throws.
  func stop(_ reason: String) {
    lock.lock()
    if stopped { lock.unlock(); return }
    stopped = true
    lock.unlock()
    io.stop()
    core.end(reason)
    if ownsSession { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    onStopped?(reason)
  }

  // ------------------------------------------------------------------ CallAudioPort (the coordinator's actions)

  func holdAudio(cause: String) {
    core.hold(cause: cause, nowNs: VoiceProcessingAudioIO.nowNs())
    io.pause()
  }

  func resumeAudio() -> Bool {
    do { try io.resume() } catch { return false }
    return core.resume(nowNs: VoiceProcessingAudioIO.nowNs())
  }

  func stopAudio(reason: String) { stop(reason) }

  struct EngineError: Error { let code: String; init(_ code: String) { self.code = code } }
}
#endif
