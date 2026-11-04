import AVFoundation
import ExpoModulesCore

/// S8B-06 CP2 — the iOS JS surface of QANDEEL's native call, the same functions and events as the Android module
/// (`QandeelVoiceCallModule.kt`), so `src/voice-call` binds both with one port:
///
///   engine  `start` / `stop` / `setMuted` / `enqueueReply` / `forceBargeIn` / `describe` / `playCue` / `scheduleCue` —
///           `IOSCallEngine` (AVAudioEngine voice processing + libopus + the shared decisions of `CallEngineCore`).
///   call    `callCapability` / `startCall` / `endCall` / `resumeCall` / `requestRoute` / `updateCallNotification` —
///           `CallCoordinator` on CallKit (a device) or the audio session alone (the simulator only).
///
/// iOS has no ongoing-call notification to update: CallKit's own call UI and the status-bar indicator show the call, so
/// `updateCallNotification` answers false. Nothing is logged; no audio leaves except the uplink packets.
public class QandeelVoiceCallModule: Module {
  private var engine: IOSCallEngine?
  private lazy var coordinator: CallCoordinator = makeCoordinator()
  private var sessionObserver: CallAudioSessionObserver?

  private func makeCoordinator() -> CallCoordinator {
    #if targetEnvironment(simulator)
    let backend = AudioSessionOnlyBackend()
    #else
    let backend = CallKitBackend(displayName: "QANDEEL")
    #endif
    let coordinator = CallCoordinator(
      backend: backend,
      microphoneGranted: { CallAudioSession.microphoneGranted },
      schedule: { ms, block in DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(ms), execute: block) }
    )
    backend.bind(coordinator)
    coordinator.listener = { [weak self] event in self?.sendEvent("onCallLifecycle", Self.numbers(event)) }
    #if targetEnvironment(simulator)
    let interruptionsAreHolds = true
    #else
    let interruptionsAreHolds = false // under CallKit, holds arrive as CXSetHeldCallAction / didDeactivate
    #endif
    sessionObserver = CallAudioSessionObserver(coordinator: coordinator, uuid: { [weak coordinator] in coordinator?.current?.uuid }, interruptionsAreHolds: interruptionsAreHolds)
    return coordinator
  }

  private static func fail(_ code: String) -> Exception {
    Exception(name: "QandeelVoiceCall", description: code, code: code)
  }

  public func definition() -> ModuleDefinition {
    Name("QandeelVoiceCall")

    Events(
      "onUplink", "onPlayout", "onBargeIn", "onBargeInTrace", "onLevels", "onSpeech", "onReplyDrained",
      "onEngineState", "onFault", "onFocus", "onRoute", "onHold", "onResume", "onCue", "onCallLifecycle", "onTick"
    )

    AsyncFunction("start") { (options: [String: Any]) throws -> [String: Any?] in
      if let running = self.engine, running.core.isRunning { throw Self.fail("ALREADY_RUNNING") }
      let platformCall = (options["audioOwner"] as? String) == "PLATFORM_CALL"
      var core = CallEngineCore.Options()
      core.bargeInStops = (options["bargeIn"] as? String) != "REPORT_ONLY"
      if let vad = options["vad"] as? [String: Any] {
        if let v = vad["onsetFrames"] as? Double { core.vad.onsetFrames = Int(v) }
        if let v = vad["floorMarginDb"] as? Double { core.vad.floorMarginDb = v }
        if let v = vad["absoluteMinDb"] as? Double { core.vad.absoluteMinDb = v }
        if let v = vad["echoGuardDb"] as? Double { core.vad.echoGuardDb = v }
      }
      let created: IOSCallEngine
      do {
        created = try IOSCallEngine(options: core, sink: self.makeSink(), ownsSession: !platformCall, speaker: (options["route"] as? String) == "SPEAKER")
      } catch {
        throw Self.fail("ENGINE_CODEC_FAILED")
      }
      // The production call's audio exists only inside its CallKit call: never a microphone without a call.
      if platformCall && !self.coordinator.attach(created) { throw Self.fail("NO_ACTIVE_CALL") }
      created.onStopped = { [weak self, weak created] reason in
        guard let self, let created else { return }
        self.coordinator.engineStopped(created, reason: reason)
      }
      do {
        let described = try created.start()
        self.engine = created
        if platformCall && !self.coordinator.isAttached(created) {
          created.stop("CALL_ENDED")
          self.engine = nil
          throw Self.fail("CALL_ENDED")
        }
        return Self.numbers(described)
      } catch let error as IOSCallEngine.EngineError {
        self.coordinator.engineStopped(created, reason: error.code)
        throw Self.fail(error.code)
      }
    }

    AsyncFunction("stop") {
      self.engine?.stop("STOPPED_BY_CLIENT")
      self.engine = nil
    }

    Function("setMuted") { (muted: Bool) in
      self.engine?.core.setMuted(muted)
    }

    Function("enqueueReply") { (callTurnIndex: Double, chunkSeq: Double, offsetMs: Double, packet: Uint8Array) -> String in
      guard let running = self.engine else { return "NOT_RUNNING" }
      let bytes = Array(UnsafeBufferPointer(start: packet.rawPointer.assumingMemoryBound(to: UInt8.self), count: packet.byteLength))
      return running.core.enqueueReply(callTurnIndex: Int64(callTurnIndex), chunkSeq: Int64(chunkSeq), offsetMs: Int64(offsetMs), packet: bytes)
    }

    Function("forceBargeIn") { () -> Bool in
      self.engine?.core.forceBargeIn(nowNs: VoiceProcessingAudioIO.nowNs()) ?? false
    }

    Function("describe") { () -> [String: Any?]? in
      self.engine.map { Self.numbers($0.core.describe()) }
    }

    Function("playCue") { (id: String, kind: String, forceAfterMs: Double, _: String?) -> String in
      self.engine?.core.playCue(id: id, kind: kind, forceAfterMs: Int64(forceAfterMs), nowNs: VoiceProcessingAudioIO.nowNs()) ?? "NOT_RUNNING"
    }

    Function("scheduleCue") { (id: String, kind: String, dueInMs: Double, forceAfterMs: Double, _: String?) -> String in
      self.engine?.core.scheduleCue(id: id, kind: kind, dueInMs: Int64(dueInMs), forceAfterMs: Int64(forceAfterMs), nowNs: VoiceProcessingAudioIO.nowNs()) ?? "NOT_RUNNING"
    }

    // ------------------------------------------------------------------ the call (CP2)

    Function("callCapability") { () -> [String: Any?] in
      Self.numbers(self.coordinator.capability())
    }

    AsyncFunction("startCall") { (options: [String: Any], promise: Promise) in
      guard let callId = options["callId"] as? String, !callId.isEmpty,
            let displayName = options["displayName"] as? String, !displayName.isEmpty else {
        promise.reject("CALL_OPTIONS_INVALID", "CALL_OPTIONS_INVALID")
        return
      }
      let start = CallCoordinator.StartOptions(callId: callId, displayName: displayName, speaker: (options["route"] as? String) == "SPEAKER")
      self.coordinator.startCall(start) { result in
        switch result {
        case .success(let value): promise.resolve(value)
        case .failure(let error): promise.reject(error.code, error.code)
        }
      }
    }

    Function("endCall") { (detail: String?) -> Bool in
      self.coordinator.endCall(.APP, detail: detail)
    }

    Function("resumeCall") { () -> Bool in
      self.coordinator.resumeCall()
    }

    Function("requestRoute") { (route: String) -> Bool in
      self.coordinator.requestRoute(route)
    }

    Function("updateCallNotification") { (_: String) -> Bool in
      false
    }

    OnDestroy {
      self.engine?.stop("MODULE_DESTROYED")
      self.engine = nil
      self.coordinator.endCall(.APP_GONE, detail: nil)
      self.coordinator.listener = nil
    }
  }

  private func makeSink() -> EngineSink { ModuleSink(module: self) }

  /// JS numbers are doubles: every integer crosses as one.
  static func numbers(_ report: [String: Any?]) -> [String: Any?] {
    report.mapValues { convert($0) }
  }

  private static func convert(_ value: Any?) -> Any? {
    switch value {
    case let v as Int64: return Double(v)
    case let v as Int: return Double(v)
    case let v as Int32: return Double(v)
    case let v as [Any?]: return v.map { convert($0) }
    case let v as [[String: Any?]]: return v.map { numbers($0) }
    case let v as [String: Any?]: return numbers(v)
    default: return value
    }
  }

  private final class ModuleSink: EngineSink {
    private weak var module: QandeelVoiceCallModule?
    init(module: QandeelVoiceCallModule) { self.module = module }

    private func send(_ name: String, _ body: [String: Any?]) {
      module?.sendEvent(name, QandeelVoiceCallModule.numbers(body))
    }

    func uplink(captureMs: Int64, packet: [UInt8]) {
      send("onUplink", ["captureMs": captureMs, "packet": Data(packet).base64EncodedString()])
    }

    func playout(_ mark: ReplyLedger.Mark, presentedFrame: Int64, source: String) {
      send("onPlayout", ["callTurnIndex": mark.callTurnIndex, "chunkSeq": mark.chunkSeq, "playedMs": mark.playedMs, "presentedFrame": presentedFrame, "source": source])
    }

    func bargeIn(_ report: [String: Any?]) { send("onBargeIn", report) }
    func speech(onsetCaptureMs: Int64, detectCaptureMs: Int64) { send("onSpeech", ["onsetCaptureMs": onsetCaptureMs, "detectCaptureMs": detectCaptureMs]) }
    func replyDrained(callTurnIndex: Int64, chunkSeq: Int64) { send("onReplyDrained", ["callTurnIndex": callTurnIndex, "chunkSeq": chunkSeq]) }
    func state(_ state: String, reason: String?) { send("onEngineState", ["state": state, "reason": reason]) }
    func fault(_ code: String) { send("onFault", ["code": code]) }
    func route(change: String, devices: [String]) { send("onRoute", ["change": change, "devices": devices]) }
    func held(captureMs: Int64, cause: String) { send("onHold", ["captureMs": captureMs, "cause": cause]) }
    func resumed(captureMs: Int64) { send("onResume", ["captureMs": captureMs]) }
    func cue(event: String, id: String, forced: Bool, source: String?) { send("onCue", ["event": event, "id": id, "forced": forced, "source": source]) }
    func tick(nowMs: Int64) { send("onTick", ["nowMs": nowMs]) }
  }
}
