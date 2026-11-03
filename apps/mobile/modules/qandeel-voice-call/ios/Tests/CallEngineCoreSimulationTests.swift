import XCTest
@testable import QandeelCallCore

/// S8B-06 CP2 (iOS) — the engine's decisions in a SIMULATED room: real libopus reply packets rendered by the engine, the
/// presented audio fed back as the residual echo the voice-processing unit would leave (a fixed attenuation after a
/// fixed output latency), plus synthetic speech, noise and silence. These prove the DECISIONS (echo guard, barge-in timing
/// and cut, first words, hold, cues, presented-position truth) on iOS's own code. They are NOT evidence that Apple's
/// physical echo canceller performs on a device: that is NOT DEVICE-VERIFIED (deferred by the Product Owner).
final class CallEngineCoreSimulationTests: XCTestCase {
  // ------------------------------------------------------------------ the simulated room

  final class Recorder: EngineSink {
    var uplinks: [(captureMs: Int64, bytes: Int)] = []
    var playouts: [(mark: ReplyLedger.Mark, frame: Int64, source: String)] = []
    var bargeIns: [[String: Any?]] = []
    var speechEvents: [(onset: Int64, detect: Int64)] = []
    var drained: [(Int64, Int64)] = []
    var states: [(String, String?)] = []
    var faults: [String] = []
    var heldEvents: [(Int64, String)] = []
    var resumedEvents: [Int64] = []
    var cues: [(event: String, id: String, forced: Bool, source: String?, step: Int)] = []
    var step = 0
    var onBargeIn: (() -> Void)?

    func uplink(captureMs: Int64, packet: [UInt8]) { uplinks.append((captureMs, packet.count)) }
    func playout(_ mark: ReplyLedger.Mark, presentedFrame: Int64, source: String) { playouts.append((mark, presentedFrame, source)) }
    func bargeIn(_ report: [String: Any?]) { bargeIns.append(report); onBargeIn?() }
    func speech(onsetCaptureMs: Int64, detectCaptureMs: Int64) { speechEvents.append((onsetCaptureMs, detectCaptureMs)) }
    func replyDrained(callTurnIndex: Int64, chunkSeq: Int64) { drained.append((callTurnIndex, chunkSeq)) }
    func state(_ state: String, reason: String?) { states.append((state, reason)) }
    func fault(_ code: String) { faults.append(code) }
    func route(change: String, devices: [String]) {}
    func held(captureMs: Int64, cause: String) { heldEvents.append((captureMs, cause)) }
    func resumed(captureMs: Int64) { resumedEvents.append(captureMs) }
    func cue(event: String, id: String, forced: Bool, source: String?) { cues.append((event, id, forced, source, step)) }
    var ticks: [Int64] = []
    func tick(nowMs: Int64) { ticks.append(nowMs) }
  }

  final class Room {
    let core: CallEngineCore
    let sink = Recorder()
    /// The residual echo after the canceller, relative to the presented output (0.1 = −20 dB: loud against the noise
    /// floor, so only the echo guard can keep it from being speech).
    var residual = 0.1
    /// Output latency between the rendered and the presented position (60 ms at 24 kHz).
    var latencyFrames: Int64 = 1440
    var person: ((Int) -> [Int16])?
    var noiseDb: Double?
    private(set) var nowNs: UInt64 = 1_000_000_000
    private(set) var stepIndex = 0
    private(set) var rendered: [Int16] = []
    private(set) var presentedFrame: Int64 = 0
    private(set) var chunkKinds: [CallEngineCore.Chunk.Kind] = []
    private var seed: UInt32 = 12345

    init(_ options: CallEngineCore.Options = .init()) throws {
      core = try CallEngineCore(options: options, sink: sink)
      core.presentedNow = { [unowned self] in (self.presentedFrame, "SIM") }
      // The render path fades what a cut generation left in the output (8 ms), as `VoiceProcessingAudioIO` does.
      sink.onBargeIn = { [unowned self] in
        let from = Int(self.presentedFrame) + 192
        if from < self.rendered.count { for i in from..<self.rendered.count { self.rendered[i] = 0 } }
      }
      core.begin()
    }

    /// One 20 ms period: render, present, capture.
    func step() {
      nowNs += CallEngineCore.frameNs
      sink.step = stepIndex
      let chunk = core.nextChunk(nowNs: nowNs)
      chunkKinds.append(chunk.kind)
      rendered.append(contentsOf: chunk.samples)
      presentedFrame = max(0, Int64(rendered.count) - latencyFrames)
      core.presented(presentedFrame, source: "SIM")
      core.tick(nowNs: nowNs)
      var frame = [Double](repeating: 0, count: 320)
      let end = Int(presentedFrame)
      if end >= 480 {
        for i in 0..<320 { frame[i] += residual * Double(rendered[end - 480 + i * 3 / 2]) }
      }
      if let voice = person?(stepIndex) { for i in 0..<320 { frame[i] += Double(voice[i]) } }
      if let db = noiseDb {
        let amplitude = 32768 * pow(10, db / 20) * 3.0.squareRoot()
        for i in 0..<320 { frame[i] += amplitude * nextUniform() }
      }
      core.captureFrame(frame.map { Int16(clamping: Int($0.rounded())) }, nowNs: nowNs)
      stepIndex += 1
    }

    func run(_ steps: Int) { for _ in 0..<steps { step() } }

    private func nextUniform() -> Double {
      seed = seed &* 1_664_525 &+ 1_013_904_223
      return Double(seed) / Double(UInt32.max) * 2 - 1
    }

    /// A reply of `packets` × 20 ms of synthetic voice, as real 24 kHz libopus packets, all enqueued at once.
    func enqueueReply(turn: Int64, packets: Int, gain: Double = 5000) {
      var error: Int32 = 0
      let enc = opusEncoder24k(&error)!
      defer { opusEncoderDestroy(enc) }
      for seq in 0..<packets {
        let packet = opusEncode(enc, OpusCodecsTests.synth(rate: 24_000, frame: seq, samples: 480, gain: gain))
        XCTAssertEqual(core.enqueueReply(callTurnIndex: turn, chunkSeq: Int64(seq), offsetMs: Int64(seq) * 20, packet: packet), "ACCEPT")
      }
    }
  }

  /// A person's sustained voiced sound at 16 kHz (steady, unlike the syllabic reply signal).
  static func vowel(step: Int, gain: Double = 8000) -> [Int16] {
    (0..<320).map { i in
      let t = Double(step * 320 + i) / 16_000
      var v = 0.0
      for h in 1...5 { v += sin(2 * Double.pi * 180 * Double(h) * t) / Double(h) }
      return Int16(clamping: Int((gain * v).rounded()))
    }
  }

  // ------------------------------------------------------------------ echo, noise, silence: no false cut

  func testQandeelsOwnEchoNeverCutsItsReply() throws {
    let room = try Room()
    room.enqueueReply(turn: 1, packets: 250)
    room.run(300)
    XCTAssertEqual(room.sink.bargeIns.count, 0, "the residual echo (−20 dB) never cuts QANDEEL")
    XCTAssertEqual(room.sink.speechEvents.count, 0)
    XCTAssertEqual(room.sink.playouts.last?.mark.chunkSeq, 249, "the whole reply was heard")
    XCTAssertEqual(room.sink.drained.count, 1)
    for p in room.sink.playouts { XCTAssertLessThanOrEqual(p.mark.playedMs * 24, p.frame, "heard ≤ presented") }
  }

  func testSteadyRoomNoiseDuringAReplyNeverCutsIt() throws {
    let room = try Room()
    room.residual = 0.05 // a canceller's typical −26 dB
    room.noiseDb = -45
    room.enqueueReply(turn: 1, packets: 250)
    room.run(260)
    XCTAssertEqual(room.sink.bargeIns.count, 0)
  }

  func testAShortLoudNoiseBurstUnder200msNeverCutsAReply() throws {
    let room = try Room()
    room.enqueueReply(turn: 1, packets: 200)
    room.run(50)
    // A door, a cough: 160 ms far above the echo, then nothing.
    room.person = { step in (50..<58).contains(step) ? Self.vowel(step: step, gain: 12000) : [Int16](repeating: 0, count: 320) }
    room.run(150)
    XCTAssertEqual(room.sink.bargeIns.count, 0, "an onset needs 200 ms of continuous speech")
  }

  func testSilenceStillSendsEveryFrameAndIsNeverSpeech() throws {
    let room = try Room()
    room.run(100)
    XCTAssertEqual(room.sink.uplinks.count, 100, "DTX off: every frame leaves")
    XCTAssertEqual(room.sink.uplinks.map { $0.captureMs }, (0..<100).map { Int64($0) * 20 })
    XCTAssertEqual(room.sink.speechEvents.count, 0)
    XCTAssertEqual(room.sink.bargeIns.count, 0)
  }

  // ------------------------------------------------------------------ the person: first words, double talk, barge-in

  func testThePersonsFirstWordsAreSentFromTheFirstFrame() throws {
    let room = try Room()
    room.person = { Self.vowel(step: $0) }
    room.run(30)
    XCTAssertEqual(room.sink.uplinks.first?.captureMs, 0, "the first frame is sent, not held for the detector")
    XCTAssertEqual(room.sink.uplinks.count, 30)
    XCTAssertEqual(room.sink.speechEvents.first?.onset, 0, "the onset is timed at the first frame of the run")
    XCTAssertEqual(room.sink.bargeIns.count, 0, "speech while QANDEEL is silent is not a barge-in")
  }

  func testDoubleTalkCutsTheReplyWithin200msAndRefusesTheRest() throws {
    let room = try Room()
    room.enqueueReply(turn: 3, packets: 300)
    room.run(100)
    let startedAt = room.stepIndex
    room.person = { step in step >= startedAt ? Self.vowel(step: step) : [Int16](repeating: 0, count: 320) }
    room.run(20)
    XCTAssertEqual(room.sink.bargeIns.count, 1)
    let report = room.sink.bargeIns[0]
    XCTAssertEqual(report["action"] as? String, "STOP")
    let onset = try XCTUnwrap(report["onsetCaptureMs"] as? Int64)
    let detect = try XCTUnwrap(report["detectCaptureMs"] as? Int64)
    XCTAssertEqual(onset, Int64(startedAt) * 20, "the onset is the person's first frame")
    XCTAssertEqual(detect - onset, 180, "detected on the 10th frame: 200 ms of speech")
    XCTAssertEqual(report["stopSource"] as? String, "SIM", "the cut is at the PRESENTED position")
    let finalPlayed = try XCTUnwrap(report["finalPlayedMs"] as? Int64)
    let presented = try XCTUnwrap(report["presentedFrame"] as? Int64)
    XCTAssertLessThanOrEqual(finalPlayed * 24, presented, "the final heard mark never runs ahead of what was presented")
    // From the cut on, not one more reply chunk is rendered, and every later packet of that reply is refused.
    let cutStep = room.sink.bargeIns.count == 1 ? startedAt + 9 : 0
    XCTAssertFalse(room.chunkKinds[(cutStep + 1)...].contains(.reply), "the reply stops at the next render")
    XCTAssertEqual(room.core.enqueueReply(callTurnIndex: 3, chunkSeq: 300, offsetMs: 6000, packet: [0x08]), "LATE_AFTER_CUT")
    XCTAssertEqual(room.core.cutGeneration, 1)
    // The person's speech is still sent: a barge-in never stops the uplink.
    XCTAssertEqual(room.sink.uplinks.count, 120)
  }

  func testTheNextReplyAfterABargeInPlaysNormally() throws {
    let room = try Room()
    room.enqueueReply(turn: 1, packets: 200)
    room.run(60)
    XCTAssertTrue(room.core.forceBargeIn(nowNs: room.nowNs))
    room.run(10)
    room.enqueueReply(turn: 2, packets: 50)
    room.run(80)
    XCTAssertEqual(room.sink.playouts.last?.mark.callTurnIndex, 2)
    XCTAssertEqual(room.sink.playouts.last?.mark.chunkSeq, 49)
  }

  func testReportOnlyModeNeverCuts() throws {
    var options = CallEngineCore.Options()
    options.bargeInStops = false
    let room = try Room(options)
    room.enqueueReply(turn: 1, packets: 200)
    room.run(50)
    room.person = { Self.vowel(step: $0) }
    room.run(30)
    XCTAssertEqual(room.sink.bargeIns.first?["action"] as? String, "REPORT_ONLY")
    XCTAssertEqual(room.core.cutGeneration, 0)
  }

  func testMuteSendsNothingAndAFreshEncoderFollows() throws {
    let room = try Room()
    room.person = { Self.vowel(step: $0) }
    room.run(10)
    room.core.setMuted(true)
    room.run(10)
    room.core.setMuted(false)
    room.run(10)
    XCTAssertEqual(room.sink.uplinks.count, 20)
    XCTAssertEqual(room.sink.uplinks[10].captureMs, 400, "the capture clock never stops for a mute")
  }

  // ------------------------------------------------------------------ hold

  func testAHoldReleasesBothDirectionsAndTheClockJumpsByTheHeldTime() throws {
    let room = try Room()
    room.person = { _ in [Int16](repeating: 0, count: 320) }
    room.enqueueReply(turn: 1, packets: 200)
    room.run(50)
    XCTAssertTrue(room.core.hold(cause: "CALLKIT_HOLD", nowNs: room.nowNs))
    XCTAssertEqual(room.sink.heldEvents.first?.0, 1000)
    let heardAtHold = room.sink.playouts.count
    XCTAssertEqual(room.core.enqueueReply(callTurnIndex: 1, chunkSeq: 500, offsetMs: 0, packet: [0x08]), "HELD")
    let sentBefore = room.sink.uplinks.count
    let ticksBefore = room.sink.ticks.count
    room.run(150) // 3 s held
    XCTAssertEqual(room.sink.uplinks.count, sentBefore, "nothing captured while held")
    XCTAssertGreaterThanOrEqual(room.sink.ticks.count - ticksBefore, 11, "the engine clock ticks on while held: the client's heartbeat keeps the link")
    XCTAssertTrue(room.chunkKinds.suffix(150).allSatisfy { $0 == .silence }, "the speaker is silent while held")
    XCTAssertEqual(room.sink.playouts.count, heardAtHold, "the reply then playing was struck at its presented position: nothing after it counts as heard")
    XCTAssertTrue(room.core.resume(nowNs: room.nowNs))
    XCTAssertEqual(room.sink.resumedEvents, [4000])
    room.run(1)
    XCTAssertEqual(room.sink.uplinks.last?.captureMs, 4000, "the first frame after the hole continues the clock")
    XCTAssertEqual(room.sink.bargeIns.count, 0, "a hold is not a barge-in")
  }

  // ------------------------------------------------------------------ the 60-minute warning cue

  func testAScheduledCueFallsDueOnTheEngineClockAndHeardComesFromThePresentedPosition() throws {
    let room = try Room()
    XCTAssertEqual(room.core.scheduleCue(id: "T5", kind: "T5", dueInMs: 1000, forceAfterMs: 30_000, nowNs: room.nowNs), "SCHEDULED")
    room.run(150)
    let events = room.sink.cues.map { $0.event }
    XCTAssertEqual(events, ["DUE", "STARTED", "HEARD"])
    let due = room.sink.cues[0], started = room.sink.cues[1], heard = room.sink.cues[2]
    XCTAssertEqual(due.source, "T5")
    XCTAssertEqual(due.step, 49, "due 1000 ms after the request")
    // The tone is 370 ms; HEARD only once its last frame was presented (60 ms of output latency later), never at render.
    XCTAssertGreaterThanOrEqual(heard.step - started.step, 18 + 3)
    XCTAssertEqual(heard.source, "SIM")
    XCTAssertEqual(room.sink.speechEvents.count, 0, "the cue's own echo is not the person speaking")
  }

  func testACueNeverPlaysOverQandeelAndWaitsForTheGap() throws {
    let room = try Room()
    room.enqueueReply(turn: 1, packets: 100)
    room.run(10)
    XCTAssertEqual(room.core.playCue(id: "T1", kind: "T1", forceAfterMs: 15_000, nowNs: room.nowNs), "QUEUED")
    room.run(200)
    let started = try XCTUnwrap(room.sink.cues.first { $0.event == "STARTED" })
    let lastReplyStep = try XCTUnwrap(room.chunkKinds.lastIndex(of: .reply))
    XCTAssertGreaterThan(started.step, lastReplyStep + 14, "after QANDEEL is no longer audible and 300 ms have passed")
    XCTAssertEqual(room.sink.bargeIns.count, 0)
  }

  func testACueIsAskedOnceAndAT5NeverFollowsAT1() throws {
    let room = try Room()
    XCTAssertEqual(room.core.playCue(id: "T1", kind: "T1", forceAfterMs: 0, nowNs: room.nowNs), "QUEUED")
    XCTAssertEqual(room.core.playCue(id: "T1", kind: "T1", forceAfterMs: 0, nowNs: room.nowNs), "REPEATED")
    XCTAssertEqual(room.core.scheduleCue(id: "T1", kind: "T1", dueInMs: 0, forceAfterMs: 0, nowNs: room.nowNs), "REPEATED", "a reconnect's schedule after CALL_ENDING")
    XCTAssertEqual(room.core.playCue(id: "T5", kind: "T5", forceAfterMs: 0, nowNs: room.nowNs), "SUPERSEDED")
    room.run(60)
    XCTAssertEqual(room.sink.cues.filter { $0.event == "HEARD" }.map { $0.id }, ["T1"])
  }

  func testAHoldMidCueRequeuesItAndItIsHeardOnceAfterTheResume() throws {
    let room = try Room()
    _ = room.core.playCue(id: "T5", kind: "T5", forceAfterMs: 0, nowNs: room.nowNs)
    room.run(5)
    XCTAssertTrue(room.core.hold(cause: "INTERRUPTION", nowNs: room.nowNs))
    room.run(20)
    XCTAssertTrue(room.core.resume(nowNs: room.nowNs))
    room.run(60)
    XCTAssertEqual(room.sink.cues.map { $0.event }, ["QUEUED", "STARTED", "REQUEUED", "STARTED", "HEARD"])
  }

  func testAnEndDropsEveryWaitingCueAndNothingFiresAfterIt() throws {
    let room = try Room()
    _ = room.core.scheduleCue(id: "T5", kind: "T5", dueInMs: 5000, forceAfterMs: 0, nowNs: room.nowNs)
    _ = room.core.scheduleCue(id: "T1", kind: "T1", dueInMs: 9000, forceAfterMs: 0, nowNs: room.nowNs)
    room.run(10)
    room.core.end("CALL_ENDED")
    XCTAssertEqual(room.sink.cues.map { $0.event }, ["DROPPED", "DROPPED"])
    XCTAssertEqual(room.sink.states.last?.0, "STOPPED")
    XCTAssertEqual(room.sink.states.last?.1, "CALL_ENDED")
    let sent = room.sink.uplinks.count
    room.run(500)
    XCTAssertEqual(room.sink.cues.count, 2)
    XCTAssertEqual(room.sink.uplinks.count, sent, "an ended engine sends nothing")
    XCTAssertEqual(room.core.enqueueReply(callTurnIndex: 9, chunkSeq: 0, offsetMs: 0, packet: [0x08]), "NOT_RUNNING")
  }
}
