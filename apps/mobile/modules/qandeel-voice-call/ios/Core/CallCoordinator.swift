import Foundation

/// The platform side of an iOS call: CallKit on a device (`CallKitBackend`), or — on the simulator only, where CallKit
/// cannot run — the audio session alone (`AudioSessionOnlyBackend`). It reports back through the coordinator's `backend*`
/// entry points; a test drives those directly (the injected CallKit / AVAudioSession events).
protocol CallBackend: AnyObject {
  /// "CALLKIT" or "AUDIO_SESSION_ONLY_SIMULATOR".
  var kind: String { get }
  /// Asks the system for the outgoing call; the backend later reports activated, or failed.
  func requestStart(uuid: UUID, displayName: String, speaker: Bool)
  /// Asks the system to end the call (the app's end). The backend reports ended(SYSTEM=false) when it completes.
  func requestEnd(uuid: UUID)
  /// Asks the system to take the call off hold.
  func requestUnhold(uuid: UUID)
  func setRoute(_ route: String) -> Bool
}

/// The engine as the coordinator drives it.
protocol CallAudioPort: AnyObject {
  func holdAudio(cause: String)
  func resumeAudio() -> Bool
  func stopAudio(reason: String)
}

/// S8B-06 CP2 (iOS) — the one call's platform lifecycle on iOS, the counterpart of Android's `LiveCallRegistry.kt`: every
/// platform event goes through the ONE `CallLifecycleMachine`, and only the actions it returns are executed.
///
///   - **One call.** A second start while a call is live is refused (ALREADY_IN_CALL) before the system is asked anything.
///   - **Start.** The microphone permission is checked first (MIC_PERMISSION_DENIED); then the backend asks CallKit for the
///     outgoing call (`CXStartCallAction`); the start resolves only at `didActivate` (the system handed the call its audio
///     session), and the engine may attach only then. No activation within `startTimeoutMs` → START_FAILED
///     (CALLKIT_TIMEOUT). A failure to start CallKit is CALLKIT_UNAVAILABLE / the request's code — never a silent
///     fallback to another path on a device.
///   - **Every end, one latch:** the app (APP), CallKit's own end (SYSTEM: the system call UI, a Bluetooth or car button,
///     another call), a microphone or engine failure, the audio session lost for good (SESSION), the JS runtime gone.
///   - **Hold.** CallKit's hold, or an audio-session interruption, is a real hold of the microphone and the speaker; the
///     end of the interruption (with `shouldResume`) or CallKit's unhold resumes; `resumeCall` asks CallKit to unhold.
///   - Late callbacks after the end change nothing but a counter.
///
/// Pure Foundation: the CallKit and AVAudioSession adapters live in their own files; the tests inject a fake backend.
final class CallCoordinator {
  struct StartOptions {
    let callId: String
    let displayName: String
    let speaker: Bool
  }

  final class Call {
    let uuid: UUID
    let options: StartOptions
    let machine = CallLifecycleMachine()
    var audio: CallAudioPort?
    var completion: ((Result<[String: Any], CallStartError>) -> Void)?
    var endRequestedByApp = false
    init(uuid: UUID, options: StartOptions) {
      self.uuid = uuid
      self.options = options
    }
  }

  struct CallStartError: Error, Equatable { let code: String }

  typealias Scheduler = (_ afterMs: Int, _ block: @escaping () -> Void) -> Void

  static let startTimeoutMs = 8000

  private let lock = NSRecursiveLock()
  private let backend: CallBackend
  private let microphoneGranted: () -> Bool
  private let schedule: Scheduler
  private(set) var current: Call?
  var listener: (([String: Any?]) -> Void)?

  init(backend: CallBackend, microphoneGranted: @escaping () -> Bool, schedule: @escaping Scheduler) {
    self.backend = backend
    self.microphoneGranted = microphoneGranted
    self.schedule = schedule
  }

  func capability() -> [String: Any?] {
    lock.lock(); defer { lock.unlock() }
    return [
      "supported": true, "reason": nil, "backend": backend.kind, "microphoneGranted": microphoneGranted(),
      "inCall": current?.machine.isLive == true,
    ]
  }

  /// Starts the one call; `completion` once, with the activation or the failure code.
  func startCall(_ options: StartOptions, completion: @escaping (Result<[String: Any], CallStartError>) -> Void) {
    lock.lock()
    if !microphoneGranted() {
      lock.unlock()
      return completion(.failure(CallStartError(code: "MIC_PERMISSION_DENIED")))
    }
    if current?.machine.isLive == true {
      lock.unlock()
      return completion(.failure(CallStartError(code: "ALREADY_IN_CALL")))
    }
    let call = Call(uuid: UUID(uuidString: options.callId) ?? UUID(), options: options)
    _ = call.machine.start()
    call.completion = completion
    current = call
    lock.unlock()
    backend.requestStart(uuid: call.uuid, displayName: options.displayName, speaker: options.speaker)
    schedule(CallCoordinator.startTimeoutMs) { [weak self, weak call] in
      guard let self, let call else { return }
      self.lock.lock()
      let waiting = call.machine.state == .STARTING
      self.lock.unlock()
      if waiting { self.end(call, .START_FAILED, "CALLKIT_TIMEOUT") }
    }
  }

  /// The app's end (the person's, or the server's relayed). Idempotent.
  @discardableResult
  func endCall(_ source: CallLifecycleMachine.EndSource = .APP, detail: String? = nil) -> Bool {
    guard let call = current else { return false }
    end(call, source, detail)
    return true
  }

  func resumeCall() -> Bool {
    guard let call = current else { return false }
    lock.lock(); let held = call.machine.state == .HELD; lock.unlock()
    if held { backend.requestUnhold(uuid: call.uuid) }
    return held
  }

  func requestRoute(_ route: String) -> Bool {
    guard current?.machine.isLive == true else { return false }
    let ok = backend.setRoute(route)
    report(current!, "ENDPOINT_REQUEST", ["endpoint": ["type": route], "result": ok ? "SUCCESS" : "ERROR"])
    return ok
  }

  /// The call's engine may attach only while the call is ACTIVE (the session is the call's).
  func attach(_ audio: CallAudioPort) -> Bool {
    lock.lock(); defer { lock.unlock() }
    guard let call = current, call.machine.state == .ACTIVE else { return false }
    call.audio = audio
    return true
  }

  func isAttached(_ audio: CallAudioPort) -> Bool {
    lock.lock(); defer { lock.unlock() }
    return current?.audio === audio && current?.machine.isLive == true
  }

  /// The engine stopped by itself: a microphone failure ends the call as MICROPHONE, anything unexpected as ENGINE.
  func engineStopped(_ audio: CallAudioPort, reason: String?) {
    guard let call = current, call.audio === audio else { return }
    switch reason {
    case "CALL_ENDED", "STOPPED_BY_CLIENT", "MODULE_DESTROYED": return
    case "CAPTURE_LOST", "MIC_RESUME_FAILED", "PERMISSION_DENIED": end(call, .MICROPHONE, reason)
    default: end(call, .ENGINE, reason)
    }
  }

  // ------------------------------------------------------------------ backend events (CallKit / the audio session)

  /// `didActivate`: the system handed the call its audio session.
  func backendActivated(_ uuid: UUID) {
    guard let call = match(uuid) else { return }
    execute(call, locked { call.machine.activated() })
  }

  /// The system could not start the call (a CallKit request error).
  func backendFailed(_ uuid: UUID, code: String) {
    guard let call = match(uuid) else { return }
    end(call, .START_FAILED, code)
  }

  /// CallKit ended the call (its end action). Our own request is APP; anything else is SYSTEM.
  func backendEnded(_ uuid: UUID, detail: String?) {
    guard let call = match(uuid) else { return }
    lock.lock(); let ours = call.endRequestedByApp; lock.unlock()
    if ours {
      lock.lock(); call.machine.released(); lock.unlock()
      return
    }
    end(call, .SYSTEM, detail ?? "CALLKIT_END")
  }

  /// CallKit hold / unhold, or an audio-session interruption began / ended.
  func backendHeld(_ uuid: UUID, _ held: Bool, cause: String) {
    guard let call = match(uuid) else { return }
    let actions = locked { held ? call.machine.systemInactive() : call.machine.systemActive() }
    execute(call, actions, cause: cause)
  }

  /// `didDeactivate`: after the end it is the release; while ACTIVE the session was taken (a hold).
  func backendDeactivated(_ uuid: UUID) {
    guard let call = match(uuid) else { return }
    lock.lock()
    let state = call.machine.state
    if state == .ENDING { call.machine.released() }
    lock.unlock()
    if state == .ACTIVE { backendHeld(uuid, true, cause: "SESSION_DEACTIVATED") }
  }

  func backendMuted(_ uuid: UUID, _ muted: Bool) {
    guard let call = match(uuid) else { return }
    report(call, "SYSTEM_MUTE", ["muted": muted])
  }

  func backendRoute(_ uuid: UUID?, endpoint: String, available: [String]) {
    guard let call = current, uuid == nil || call.uuid == uuid else { return }
    report(call, "ENDPOINTS", ["endpoints": available.map { ["type": $0] }])
    report(call, "ENDPOINT", ["endpoint": ["type": endpoint]])
  }

  /// The media services were reset, or the session was lost with no way back: the call cannot honestly continue.
  func backendLost(_ uuid: UUID?, detail: String) {
    guard let call = current, uuid == nil || call.uuid == uuid else { return }
    end(call, .SESSION, detail)
  }

  // ------------------------------------------------------------------ the latch

  private func end(_ call: Call, _ source: CallLifecycleMachine.EndSource, _ detail: String?) {
    let actions: [CallLifecycleMachine.Action] = locked {
      let a = call.machine.end(source, detail: detail)
      if a.contains(.END_CALLKIT) { call.endRequestedByApp = true }
      return a
    }
    execute(call, actions)
  }

  private func execute(_ call: Call, _ actions: [CallLifecycleMachine.Action], cause: String = "SYSTEM") {
    for action in actions {
      switch action {
      case .START_AUDIO:
        let completion = locked { () -> ((Result<[String: Any], CallStartError>) -> Void)? in
          let c = call.completion
          call.completion = nil
          return c
        }
        completion?(.success(["state": "ACTIVE", "backend": backend.kind]))
      case .HOLD_AUDIO:
        call.audio?.holdAudio(cause: cause)
      case .RESUME_AUDIO:
        // A microphone that cannot come back ends the call; nothing after it (no RESUMED) is reported.
        if call.audio?.resumeAudio() == false { end(call, .MICROPHONE, "MIC_RESUME_FAILED"); return }
      case .STOP_AUDIO:
        call.audio?.stopAudio(reason: "CALL_ENDED")
      case .END_CALLKIT:
        backend.requestEnd(uuid: call.uuid)
      case .REPORT_ACTIVE:
        report(call, "ACTIVE", [:])
      case .REPORT_HELD:
        report(call, "HELD", [:])
      case .REPORT_RESUMED:
        report(call, "RESUMED", [:])
      case .REPORT_ENDED:
        let completion = locked { () -> ((Result<[String: Any], CallStartError>) -> Void)? in
          let c = call.completion
          call.completion = nil
          return c
        }
        let source = call.machine.endSource
        completion?(.failure(CallStartError(code: source == .START_FAILED ? (call.machine.endDetail ?? "CALL_START_FAILED") : "ENDED_DURING_START")))
        report(call, "ENDED", ["source": source?.rawValue, "detail": call.machine.endDetail])
      }
    }
  }

  private func report(_ call: Call, _ type: String, _ extra: [String: Any?]) {
    var event: [String: Any?] = ["type": type, "callId": call.options.callId, "state": call.machine.state.rawValue, "ignoredLate": call.machine.ignoredLate]
    for (k, v) in extra { event[k] = v }
    listener?(event)
  }

  private func match(_ uuid: UUID) -> Call? {
    lock.lock(); defer { lock.unlock() }
    guard let call = current, call.uuid == uuid else { return nil }
    return call
  }

  private func locked<T>(_ body: () -> T) -> T {
    lock.lock(); defer { lock.unlock() }
    return body()
  }
}
