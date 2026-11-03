import XCTest
@testable import QandeelCallCore

/// S8B-06 CP2 (iOS) — the call's platform lifecycle with CallKit's and AVAudioSession's events INJECTED (a fake backend
/// standing in for `CallKitBackend`): one call, the start resolves only at `didActivate`, every end source closes one
/// latch, holds are real audio stops, late callbacks change nothing, and a call never outlives its audio or the reverse.
/// CallKit itself on a device is NOT DEVICE-VERIFIED here (deferred by the Product Owner).
final class CallCoordinatorTests: XCTestCase {
  final class FakeBackend: CallBackend {
    let kind = "FAKE_CALLKIT"
    var starts: [UUID] = []
    var ends: [UUID] = []
    var unholds: [UUID] = []
    var routes: [String] = []
    var routeResult = true
    func requestStart(uuid: UUID, displayName: String, speaker: Bool) { starts.append(uuid) }
    func requestEnd(uuid: UUID) { ends.append(uuid) }
    func requestUnhold(uuid: UUID) { unholds.append(uuid) }
    func setRoute(_ route: String) -> Bool { routes.append(route); return routeResult }
  }

  final class FakeAudio: CallAudioPort {
    var log: [String] = []
    var resumeResult = true
    func holdAudio(cause: String) { log.append("hold:\(cause)") }
    func resumeAudio() -> Bool { log.append("resume"); return resumeResult }
    func stopAudio(reason: String) { log.append("stop:\(reason)") }
  }

  private var backend: FakeBackend!
  private var coordinator: CallCoordinator!
  private var granted = true
  private var timers: [() -> Void] = []
  private var events: [[String: Any?]] = []
  private var results: [Result<[String: Any], CallCoordinator.CallStartError>] = []

  override func setUp() {
    backend = FakeBackend()
    granted = true
    timers = []
    events = []
    results = []
    coordinator = CallCoordinator(backend: backend, microphoneGranted: { [unowned self] in self.granted }, schedule: { [unowned self] _, block in self.timers.append(block) })
    coordinator.listener = { [unowned self] in self.events.append($0) }
  }

  private let callId = "6F9619FF-8B86-D011-B42D-00C04FC964FF"
  private var uuid: UUID { UUID(uuidString: callId)! }

  private func start() {
    coordinator.startCall(.init(callId: callId, displayName: "QANDEEL", speaker: false)) { [unowned self] in self.results.append($0) }
  }

  private func activeCall() -> FakeAudio {
    start()
    coordinator.backendActivated(uuid)
    let audio = FakeAudio()
    XCTAssertTrue(coordinator.attach(audio))
    return audio
  }

  private var types: [String] { events.compactMap { $0["type"] as? String } }
  private func ended() -> [String: Any?]? { events.last { ($0["type"] as? String) == "ENDED" } }

  // ------------------------------------------------------------------ start

  func testTheStartResolvesOnlyAtDidActivateAndTheEngineAttachesOnlyThen() {
    start()
    XCTAssertEqual(backend.starts, [uuid], "CXStartCallAction for the call's own id")
    XCTAssertTrue(results.isEmpty, "nothing resolves before the system hands over the audio session")
    XCTAssertFalse(coordinator.attach(FakeAudio()), "no microphone before didActivate")
    coordinator.backendActivated(uuid)
    guard case .success(let value)? = results.first else { return XCTFail("not resolved") }
    XCTAssertEqual(value["state"] as? String, "ACTIVE")
    XCTAssertEqual(types, ["ACTIVE"])
    XCTAssertTrue(coordinator.attach(FakeAudio()))
  }

  func testAMicrophoneDenialRefusesBeforeCallKitIsAsked() {
    granted = false
    start()
    XCTAssertEqual(results.first.flatMap { if case .failure(let e) = $0 { return e.code } else { return nil } }, "MIC_PERMISSION_DENIED")
    XCTAssertTrue(backend.starts.isEmpty)
  }

  func testOneCallOnly() {
    _ = activeCall()
    start()
    XCTAssertEqual(results.last.flatMap { if case .failure(let e) = $0 { return e.code } else { return nil } }, "ALREADY_IN_CALL")
    XCTAssertEqual(backend.starts.count, 1)
  }

  func testACallKitRefusalIsAnExplicitStartFailure() {
    start()
    coordinator.backendFailed(uuid, code: "CALLKIT_UNAVAILABLE_1")
    XCTAssertEqual(results.first.flatMap { if case .failure(let e) = $0 { return e.code } else { return nil } }, "CALLKIT_UNAVAILABLE_1")
    XCTAssertEqual(ended()?["source"] as? String, "START_FAILED")
    XCTAssertEqual(backend.ends, [uuid], "the half-started call is ended in CallKit too")
    coordinator.backendActivated(uuid)
    XCTAssertEqual(results.count, 1, "a late activation resolves nothing")
  }

  func testNoActivationWithinTheTimeoutFailsTheStart() {
    start()
    XCTAssertEqual(timers.count, 1)
    timers[0]()
    XCTAssertEqual(results.first.flatMap { if case .failure(let e) = $0 { return e.code } else { return nil } }, "CALLKIT_TIMEOUT")
    XCTAssertEqual(ended()?["detail"] as? String, "CALLKIT_TIMEOUT")
  }

  func testTheTimeoutAfterAnActivationChangesNothing() {
    _ = activeCall()
    timers[0]()
    XCTAssertNil(ended())
  }

  func testAnEndDuringStartRejectsTheStartAndALateActivationOnlyEndsCallKitAgain() {
    start()
    coordinator.endCall(.APP, detail: "ENDED_DURING_START")
    XCTAssertEqual(results.first.flatMap { if case .failure(let e) = $0 { return e.code } else { return nil } }, "ENDED_DURING_START")
    coordinator.backendActivated(uuid)
    XCTAssertEqual(backend.ends, [uuid, uuid], "the late activation undoes itself")
    XCTAssertFalse(coordinator.attach(FakeAudio()), "and no audio ever starts")
  }

  // ------------------------------------------------------------------ every end, one latch

  func testThePersonsEndStopsTheAudioAndEndsCallKitOnce() {
    let audio = activeCall()
    XCTAssertTrue(coordinator.endCall(.APP, detail: "PERSON"))
    XCTAssertEqual(audio.log, ["stop:CALL_ENDED"])
    XCTAssertEqual(backend.ends, [uuid])
    XCTAssertEqual(ended()?["source"] as? String, "APP")
    // CallKit confirms our own end: that is the release, not a second end.
    coordinator.backendEnded(uuid, detail: "CALLKIT_END")
    coordinator.backendDeactivated(uuid)
    XCTAssertEqual(types.filter { $0 == "ENDED" }.count, 1)
    XCTAssertEqual(backend.ends.count, 1)
    XCTAssertEqual(coordinator.current?.machine.state, .ENDED)
  }

  func testCallKitsOwnEndIsSystemAndIsNotEndedAgain() {
    let audio = activeCall()
    coordinator.backendEnded(uuid, detail: "CALLKIT_END")
    XCTAssertEqual(audio.log, ["stop:CALL_ENDED"])
    XCTAssertEqual(ended()?["source"] as? String, "SYSTEM")
    XCTAssertTrue(backend.ends.isEmpty)
  }

  func testAMediaServicesResetEndsTheCallAsSession() {
    let audio = activeCall()
    coordinator.backendLost(nil, detail: "MEDIA_SERVICES_RESET")
    XCTAssertEqual(audio.log, ["stop:CALL_ENDED"])
    XCTAssertEqual(ended()?["source"] as? String, "SESSION")
  }

  func testTheEnginesOwnStopEndsTheCallAndAClientStopDoesNot() {
    let audio = activeCall()
    coordinator.engineStopped(audio, reason: "STOPPED_BY_CLIENT")
    XCTAssertNil(ended())
    coordinator.engineStopped(audio, reason: "CAPTURE_LOST")
    XCTAssertEqual(ended()?["source"] as? String, "MICROPHONE", "a lost microphone never leaves a call that looks alive")
    XCTAssertEqual(backend.ends, [uuid])
  }

  func testAnEngineFailureEndsTheCallAsEngine() {
    let audio = activeCall()
    coordinator.engineStopped(audio, reason: "ENGINE_START_FAILED")
    XCTAssertEqual(ended()?["source"] as? String, "ENGINE")
  }

  func testTheAppGoingAwayEndsTheCall() {
    let audio = activeCall()
    coordinator.endCall(.APP_GONE)
    XCTAssertEqual(audio.log, ["stop:CALL_ENDED"])
    XCTAssertEqual(ended()?["source"] as? String, "APP_GONE")
  }

  func testLateCallbacksAfterTheEndChangeNothingButACounter() {
    let audio = activeCall()
    coordinator.endCall(.APP)
    let before = events.count
    coordinator.backendHeld(uuid, true, cause: "CALLKIT_HOLD")
    coordinator.backendHeld(uuid, false, cause: "CALLKIT_HOLD")
    coordinator.backendActivated(uuid)
    coordinator.endCall(.SESSION)
    XCTAssertEqual(audio.log, ["stop:CALL_ENDED"], "nothing restarts the audio of an ended call")
    XCTAssertEqual(events.count, before)
    XCTAssertGreaterThanOrEqual(coordinator.current?.machine.ignoredLate ?? 0, 4)
  }

  func testCallbacksForAnotherCallAreIgnored() {
    let audio = activeCall()
    coordinator.backendEnded(UUID(), detail: "OTHER")
    coordinator.backendHeld(UUID(), true, cause: "OTHER")
    XCTAssertTrue(audio.log.isEmpty)
    XCTAssertNil(ended())
  }

  // ------------------------------------------------------------------ hold, interruption, routes

  func testAHoldIsARealAudioStopAndTheResumeComesFromTheSystem() {
    let audio = activeCall()
    coordinator.backendHeld(uuid, true, cause: "CALLKIT_HOLD")
    XCTAssertEqual(audio.log, ["hold:CALLKIT_HOLD"])
    XCTAssertEqual(types.last, "HELD")
    XCTAssertTrue(coordinator.resumeCall())
    XCTAssertEqual(backend.unholds, [uuid], "the app asks CallKit; it does not resume the audio by itself")
    XCTAssertEqual(audio.log, ["hold:CALLKIT_HOLD"])
    coordinator.backendHeld(uuid, false, cause: "SESSION_REACTIVATED")
    XCTAssertEqual(audio.log, ["hold:CALLKIT_HOLD", "resume"])
    XCTAssertEqual(types.last, "RESUMED")
  }

  func testTheSessionTakenWhileActiveIsAHoldAndAfterTheEndItIsTheRelease() {
    let audio = activeCall()
    coordinator.backendDeactivated(uuid)
    XCTAssertEqual(audio.log, ["hold:SESSION_DEACTIVATED"])
    coordinator.endCall(.APP)
    coordinator.backendDeactivated(uuid)
    XCTAssertEqual(coordinator.current?.machine.state, .ENDED)
  }

  func testAMicrophoneThatCannotResumeEndsTheCall() {
    let audio = activeCall()
    audio.resumeResult = false
    coordinator.backendHeld(uuid, true, cause: "INTERRUPTION")
    coordinator.backendHeld(uuid, false, cause: "INTERRUPTION_ENDED")
    XCTAssertEqual(ended()?["source"] as? String, "MICROPHONE")
    XCTAssertEqual(ended()?["detail"] as? String, "MIC_RESUME_FAILED")
    XCTAssertEqual(audio.log.last, "stop:CALL_ENDED")
    XCTAssertFalse(types.contains("RESUMED"), "a call whose microphone did not come back is never reported resumed")
  }

  func testAnEndWhileHeldStopsTheAudioOnce() {
    let audio = activeCall()
    coordinator.backendHeld(uuid, true, cause: "CALLKIT_HOLD")
    coordinator.backendEnded(uuid, detail: "CALLKIT_END")
    XCTAssertEqual(audio.log, ["hold:CALLKIT_HOLD", "stop:CALL_ENDED"])
    coordinator.backendHeld(uuid, false, cause: "LATE")
    XCTAssertEqual(audio.log.count, 2)
  }

  func testTheSystemMuteIsReportedForTheClientToApply() {
    _ = activeCall()
    coordinator.backendMuted(uuid, true)
    let mute = events.last { ($0["type"] as? String) == "SYSTEM_MUTE" }
    XCTAssertEqual(mute?["muted"] as? Bool, true)
  }

  func testRoutesAreRequestedAndReportedAsTypesNeverNames() {
    _ = activeCall()
    XCTAssertTrue(coordinator.requestRoute("SPEAKER"))
    XCTAssertEqual(backend.routes, ["SPEAKER"])
    coordinator.backendRoute(nil, endpoint: "BLUETOOTH", available: ["EARPIECE", "SPEAKER", "BLUETOOTH"])
    let endpoint = events.last { ($0["type"] as? String) == "ENDPOINT" }
    XCTAssertEqual((endpoint?["endpoint"] as? [String: Any])?["type"] as? String, "BLUETOOTH")
    for event in events { XCTAssertNil(event["name"] ?? nil, "no device name ever crosses") }
    backend.routeResult = false
    XCTAssertFalse(coordinator.requestRoute("WIRED_HEADSET"))
    coordinator.endCall(.APP)
    XCTAssertFalse(coordinator.requestRoute("SPEAKER"), "no route request outside a live call")
  }

  func testEventsCarryTheCallIdAndNoContent() {
    _ = activeCall()
    coordinator.endCall(.APP)
    for event in events {
      XCTAssertEqual(event["callId"] as? String, callId)
      XCTAssertEqual(Set(event.keys).subtracting(["type", "callId", "state", "ignoredLate", "source", "detail", "endpoints", "endpoint", "muted", "result"]), [])
    }
  }
}
