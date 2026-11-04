#if os(iOS)
import AVFoundation
import XCTest
@testable import QandeelCallCore

/// S8B-06 CP2 (iOS) — the real AVAudioSession and the real engine on the iOS SIMULATOR (`xcodebuild test`), never a fake:
/// the call's session configuration Apple accepts, the simulator's audio-session-only call path end to end, and the
/// negative paths (no microphone permission → a coded refusal with nothing left open). CallKit itself does not run on the
/// simulator and the simulator has no microphone: CallKit, the voice-processing echo canceller and a real capture are NOT
/// DEVICE-VERIFIED (deferred by the Product Owner).
final class IOSSimulatorIntegrationTests: XCTestCase {
  final class NullSink: EngineSink {
    var states: [(String, String?)] = []
    func uplink(captureMs: Int64, packet: [UInt8]) {}
    func playout(_ mark: ReplyLedger.Mark, presentedFrame: Int64, source: String) {}
    func bargeIn(_ report: [String: Any?]) {}
    func speech(onsetCaptureMs: Int64, detectCaptureMs: Int64) {}
    func replyDrained(callTurnIndex: Int64, chunkSeq: Int64) {}
    func state(_ state: String, reason: String?) { states.append((state, reason)) }
    func fault(_ code: String) {}
    func route(change: String, devices: [String]) {}
    func held(captureMs: Int64, cause: String) {}
    func resumed(captureMs: Int64) {}
    func cue(event: String, id: String, forced: Bool, source: String?) {}
    func tick(nowMs: Int64) {}
  }

  override func tearDown() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  func testTheCallsAudioSessionIsTheVoiceChatPlayAndRecordSession() throws {
    try CallAudioSession.configure(speaker: false)
    let session = AVAudioSession.sharedInstance()
    XCTAssertEqual(session.category, .playAndRecord)
    XCTAssertEqual(session.mode, .voiceChat, "the system's voice-processing path (echo cancellation)")
    XCTAssertTrue(session.categoryOptions.contains(.allowBluetooth))
    XCTAssertTrue(CallAudioSession.availableEndpoints().contains("SPEAKER"))
    XCTAssertNotEqual(CallAudioSession.endpoint(), "", "an endpoint type, never a device name")
  }

  func testTheSimulatorCallPathStartsAndEndsThroughTheRealSession() throws {
    let backend = AudioSessionOnlyBackend()
    let coordinator = CallCoordinator(backend: backend, microphoneGranted: { true }, schedule: { ms, block in
      DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(ms), execute: block)
    })
    backend.bind(coordinator)
    var events: [String] = []
    coordinator.listener = { events.append(($0["type"] as? String) ?? "?") }
    let started = expectation(description: "started")
    coordinator.startCall(.init(callId: UUID().uuidString, displayName: "QANDEEL", speaker: false)) { result in
      if case .success(let value) = result { XCTAssertEqual(value["backend"] as? String, "AUDIO_SESSION_ONLY_SIMULATOR") }
      else { XCTFail("the simulator call did not start: \(result)") }
      started.fulfill()
    }
    wait(for: [started], timeout: 5)
    XCTAssertEqual(coordinator.current?.machine.state, .ACTIVE)
    let ended = expectation(description: "released")
    coordinator.endCall(.APP)
    DispatchQueue.main.async { ended.fulfill() }
    wait(for: [ended], timeout: 5)
    XCTAssertEqual(events, ["ACTIVE", "ENDED"])
    XCTAssertEqual(coordinator.current?.machine.state, .ENDED, "the session's end is the call's release")
    XCTAssertEqual(coordinator.capability()["inCall"] as? Bool, false)
  }

  func testWithoutTheMicrophonePermissionTheEngineRefusesAndLeavesNothingOpen() throws {
    if CallAudioSession.microphoneGranted { throw XCTSkip("this simulator granted the microphone; the denial path needs it ungranted") }
    let sink = NullSink()
    let engine = try IOSCallEngine(options: .init(), sink: sink, ownsSession: true, speaker: false)
    XCTAssertThrowsError(try engine.start()) { error in
      XCTAssertEqual((error as? IOSCallEngine.EngineError)?.code, "PERMISSION_DENIED")
    }
    XCTAssertFalse(engine.core.isRunning, "no 'still listening' state after a refusal")
    XCTAssertTrue(sink.states.isEmpty, "the engine never reported RUNNING")
  }

  func testACallWithoutTheMicrophonePermissionIsRefusedBeforeTheSystemIsAsked() {
    let backend = AudioSessionOnlyBackend()
    let coordinator = CallCoordinator(backend: backend, microphoneGranted: { false }, schedule: { _, _ in })
    backend.bind(coordinator)
    var code: String?
    coordinator.startCall(.init(callId: UUID().uuidString, displayName: "QANDEEL", speaker: false)) { result in
      if case .failure(let e) = result { code = e.code }
    }
    XCTAssertEqual(code, "MIC_PERMISSION_DENIED")
    XCTAssertNil(coordinator.current)
  }
}
#endif
