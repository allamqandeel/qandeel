import XCTest
@testable import QandeelCallCore

/// S8B-06 CP2 (iOS) — the pure rules, case for case against the Android tests (`ReplyLedgerTest.kt`,
/// `SpeechOnsetDetectorTest.kt`, `CuePlayerTest.kt`, `CueScheduleTest.kt`, `CallLifecycleMachineTest.kt`): the two platforms
/// decide the same way, so an Android finding cannot silently differ on iOS.
final class ReplyLedgerTests: XCTestCase {
  private let frames: Int64 = 480

  @discardableResult
  private func play(_ ledger: ReplyLedger, _ turn: Int64, _ chunks: Int, startFrame: Int64 = 0) -> Int64 {
    var frame = startFrame
    for c in 0..<chunks {
      XCTAssertEqual(ledger.admit(turn, Int64(c)), .ACCEPT)
      XCTAssertTrue(ledger.booked(turn, Int64(c), Int64(c) * 20, startFrame: frame, frames: frames))
      frame += frames
    }
    return frame
  }

  func testAPacketCountsAsHeardOnlyWhenItsLastFrameWasPresented() {
    let ledger = ReplyLedger()
    play(ledger, 1, 10)
    XCTAssertNil(ledger.advance(0))
    XCTAssertNil(ledger.advance(479), "half a packet is not a packet")
    XCTAssertEqual(ledger.advance(480), ReplyLedger.Mark(callTurnIndex: 1, chunkSeq: 0, playedMs: 20))
    XCTAssertNil(ledger.advance(500))
    XCTAssertEqual(ledger.advance(4 * 480 + 10), ReplyLedger.Mark(callTurnIndex: 1, chunkSeq: 3, playedMs: 80))
  }

  func testTheMarkNeverRunsAheadOfThePresentedPosition() {
    let ledger = ReplyLedger()
    play(ledger, 4, 50)
    var presented: Int64 = 0
    var last: Int64 = 0
    while presented < 50 * 480 {
      presented += 137
      if let m = ledger.advance(presented) {
        XCTAssertGreaterThan(m.playedMs, last)
        XCTAssertLessThanOrEqual(m.playedMs * 24, presented, "never ahead")
        last = m.playedMs
      }
    }
    XCTAssertEqual(last, 1000)
  }

  func testACutStrikesWhatWasNotHeardAndRefusesTheRestOfThatReply() {
    let ledger = ReplyLedger()
    play(ledger, 2, 20)
    _ = ledger.advance(5 * 480)
    XCTAssertEqual(ledger.cut(2, 7 * 480 + 100), ReplyLedger.Mark(callTurnIndex: 2, chunkSeq: 6, playedMs: 140))
    XCTAssertFalse(ledger.hasUnheard())
    XCTAssertNil(ledger.advance(20 * 480))
    XCTAssertEqual(ledger.admit(2, 20), .LATE_AFTER_CUT)
    XCTAssertEqual(ledger.admit(1, 0), .LATE_AFTER_CUT)
    XCTAssertFalse(ledger.stillPlayable(2))
    XCTAssertFalse(ledger.booked(2, 21, 420, startFrame: 30_000, frames: frames))
    XCTAssertEqual(ledger.refusedLate, 2)
  }

  func testACutWithNothingNewHeardKeepsTheLastMark() {
    let ledger = ReplyLedger()
    play(ledger, 3, 5)
    _ = ledger.advance(2 * 480)
    XCTAssertNil(ledger.cut(3, 2 * 480 + 5))
    XCTAssertEqual(ledger.lastMark, ReplyLedger.Mark(callTurnIndex: 3, chunkSeq: 1, playedMs: 40))
  }

  func testRepeatsReorderedAndStalePacketsAreRefused() {
    let ledger = ReplyLedger()
    XCTAssertEqual(ledger.admit(5, 0), .ACCEPT)
    XCTAssertEqual(ledger.admit(5, 1), .ACCEPT)
    XCTAssertEqual(ledger.admit(5, 1), .REPEATED_OR_REORDERED)
    XCTAssertEqual(ledger.admit(5, 3), .ACCEPT)
    XCTAssertEqual(ledger.admit(5, 2), .REPEATED_OR_REORDERED)
    XCTAssertEqual(ledger.admit(6, 0), .ACCEPT)
    XCTAssertEqual(ledger.admit(5, 4), .STALE_REPLY)
    XCTAssertEqual(ledger.admitted, 4)
    XCTAssertEqual(ledger.refusedRepeated, 2)
    XCTAssertEqual(ledger.refusedStale, 1)
  }

  func testTheNextReplyAfterACutPlaysAndReportsNormally() {
    let ledger = ReplyLedger()
    let end = play(ledger, 7, 10)
    _ = ledger.cut(7, 3 * 480)
    play(ledger, 8, 4, startFrame: end + 2000)
    XCTAssertEqual(ledger.advance(end + 2000 + 4 * 480), ReplyLedger.Mark(callTurnIndex: 8, chunkSeq: 3, playedMs: 80))
  }
}

final class SpeechOnsetDetectorTests: XCTestCase {
  @discardableResult
  private func quiet(_ d: SpeechOnsetDetector, _ frames: Int, startMs: Int64 = 0, db: Double = -65) -> Int64 {
    var ms = startMs
    for _ in 0..<frames { _ = d.push(frameDb: db, refDb: nil, captureMs: ms); ms += 20 }
    return ms
  }

  func testNineFramesOfSpeechAreNotAnOnsetButTenAre() {
    let d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    for _ in 0..<9 { XCTAssertEqual(d.push(frameDb: -30, refDb: nil, captureMs: ms).kind, .none); ms += 20 }
    let tenth = d.push(frameDb: -30, refDb: nil, captureMs: ms)
    XCTAssertEqual(tenth.kind, .onset)
    XCTAssertEqual(tenth.onsetCaptureMs, 1000, "the onset is the first frame of the run")
  }

  func testOneQuietFrameResetsTheRunSoThe200msAreContinuous() {
    let d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    for _ in 0..<8 { _ = d.push(frameDb: -30, refDb: nil, captureMs: ms); ms += 20 }
    _ = d.push(frameDb: -66, refDb: nil, captureMs: ms); ms += 20
    for _ in 0..<9 { XCTAssertEqual(d.push(frameDb: -30, refDb: nil, captureMs: ms).kind, .none); ms += 20 }
    XCTAssertEqual(d.push(frameDb: -30, refDb: nil, captureMs: ms).kind, .onset)
  }

  func testOneOnsetPerRun() {
    let d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    var onsets = 0
    for _ in 0..<100 { if d.push(frameDb: -30, refDb: nil, captureMs: ms).kind == .onset { onsets += 1 }; ms += 20 }
    XCTAssertEqual(onsets, 1)
  }

  func testResidualEchoFarBelowTheReferenceNeverTriggers() {
    let d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    var onsets = 0
    for _ in 0..<500 { if d.push(frameDb: -38, refDb: -12, captureMs: ms).kind == .onset { onsets += 1 }; ms += 20 }
    XCTAssertEqual(onsets, 0)
  }

  func testAPersonTalkingOverQandeelIsDetected() {
    let d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    for _ in 0..<50 { _ = d.push(frameDb: -38, refDb: -12, captureMs: ms); ms += 20 }
    var onset: SpeechOnsetDetector.Decision?
    var at: Int64 = 0
    for _ in 0..<12 {
      let decision = d.push(frameDb: -22, refDb: -12, captureMs: ms)
      if decision.kind == .onset && onset == nil { onset = decision; at = ms }
      ms += 20
    }
    XCTAssertNotNil(onset)
    XCTAssertEqual(onset!.onsetCaptureMs + 180, at, "detected on the 10th frame")
  }

  func testHissBelowTheAbsoluteLevelIsNeverSpeech() {
    let d = SpeechOnsetDetector()
    var ms = quiet(d, 50, db: -90)
    var onsets = 0
    for _ in 0..<200 { if d.push(frameDb: -55, refDb: nil, captureMs: ms).kind == .onset { onsets += 1 }; ms += 20 }
    XCTAssertEqual(onsets, 0)
  }

  func testTheFloorRisesSlowlyAndFallsAtOnce() {
    let d = SpeechOnsetDetector()
    quiet(d, 10, db: -60)
    XCTAssertEqual(d.floorDb, -69.8, accuracy: 1e-9)
    _ = d.push(frameDb: -80, refDb: nil, captureMs: 1000)
    XCTAssertEqual(d.floorDb, -80, accuracy: 1e-9)
    _ = d.push(frameDb: -60, refDb: nil, captureMs: 1020)
    XCTAssertEqual(d.floorDb, -79.98, accuracy: 1e-9)
  }

  func testLevelOfFullScaleSquareIsZeroDb() {
    let pcm = (0..<320).map { $0 % 2 == 0 ? Int16(32767) : Int16(-32767) }
    XCTAssertEqual(SpeechOnsetDetector.levelDb(pcm), 0, accuracy: 0.01)
    XCTAssertEqual(SpeechOnsetDetector.levelDb([Int16](repeating: 0, count: 320)), -120)
  }

  func testTheDefaultsAreAndroidsDefaults() {
    XCTAssertEqual(VadConfig(), VadConfig(onsetFrames: 10, floorMarginDb: 10, absoluteMinDb: -50, echoGuardDb: -18, floorRisePerFrameDb: 0.02, floorInitialDb: -70))
  }
}

final class CuePlayerTests: XCTestCase {
  private var slot = [Int16](repeating: 0, count: 480)
  private let silent = Int64.max

  private func drain(_ p: CuePlayer, now: Int64 = 0) -> [CuePlayer.Slice] {
    var out: [CuePlayer.Slice] = []
    var t = now
    while let s = p.nextSlice(nowMs: t, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: silent, out: &slot) {
      out.append(s)
      t += 20
      if s.last { break }
    }
    return out
  }

  func testTheToneIsTheContractsShapeAndLevel() {
    let t5 = CuePlayer.tone("T5")
    let t1 = CuePlayer.tone("T1")
    XCTAssertEqual(t5.count, 2 * 3360 + 2160)
    XCTAssertEqual(t1.count, 3 * 3360 + 2 * 2160)
    XCTAssertEqual(t5[0], 0)
    for i in 3360..<(3360 + 2160) { XCTAssertEqual(t5[i], 0) }
    let peak = Double(t5.map { abs(Int($0)) }.max()!)
    let dbfs = 20 * log10(peak / 32767)
    XCTAssertTrue((-20.2 ... -19.8).contains(dbfs), "peak ≈ −20 dBFS (\(dbfs))")
    var sum = 0.0
    for i in 600..<2760 { sum += Double(t5[i]) * Double(t5[i]) }
    XCTAssertLessThan(abs((sum / 2160).squareRoot() - peak / 2.0.squareRoot()), peak * 0.02)
  }

  func testACueWaitsForTheFirstSuitableSilence() {
    let p = CuePlayer()
    XCTAssertTrue(p.request("T5", pcm: CuePlayer.tone("T5"), nowMs: 0, forceAfterMs: 60_000))
    XCTAssertNil(p.nextSlice(nowMs: 0, qandeelAudible: true, msSinceQandeel: 0, msSinceUserSpeech: silent, out: &slot))
    XCTAssertNil(p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: CuePlayer.qandeelGapMs - 1, msSinceUserSpeech: silent, out: &slot))
    XCTAssertNil(p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: 0, out: &slot))
    XCTAssertNil(p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: CuePlayer.userSilenceMs - 1, out: &slot))
    let first = p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: CuePlayer.qandeelGapMs, msSinceUserSpeech: CuePlayer.userSilenceMs, out: &slot)
    XCTAssertEqual(first?.first, true)
    XCTAssertEqual(first?.forced, false)
  }

  func testTheBoundForcesOverThePersonButNeverOverQandeel() {
    let p = CuePlayer()
    _ = p.request("T1", pcm: CuePlayer.tone("T1"), nowMs: 1_000, forceAfterMs: 5_000)
    XCTAssertNil(p.nextSlice(nowMs: 5_999, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: 0, out: &slot))
    XCTAssertNil(p.nextSlice(nowMs: 6_000, qandeelAudible: true, msSinceQandeel: 0, msSinceUserSpeech: 0, out: &slot))
    let s = p.nextSlice(nowMs: 6_000, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: 0, out: &slot)
    XCTAssertEqual(s?.first, true)
    XCTAssertEqual(s?.forced, true)
  }

  func testAStartedCuePlaysToItsEndAndIsNeverPlayedTwice() {
    let p = CuePlayer()
    let pcm = CuePlayer.tone("T5")
    _ = p.request("T5", pcm: pcm, nowMs: 0, forceAfterMs: 0)
    let slices = drain(p)
    XCTAssertEqual(slices.count, (pcm.count + 479) / 480)
    XCTAssertTrue(slices.first!.first && slices.last!.last)
    XCTAssertEqual(slices.filter(\.first).count, 1)
    XCTAssertFalse(p.request("T5", pcm: pcm, nowMs: 0, forceAfterMs: 0))
    XCTAssertNil(p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: silent, out: &slot))
  }

  func testANewerCueReplacesOnePendingAndAHoldRequeuesTheOnePlaying() {
    let p = CuePlayer()
    _ = p.request("T5", pcm: CuePlayer.tone("T5"), nowMs: 0, forceAfterMs: 60_000)
    _ = p.request("T1", pcm: CuePlayer.tone("T1"), nowMs: 0, forceAfterMs: 60_000)
    XCTAssertEqual(p.pendingId, "T1")
    XCTAssertEqual(p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: silent, out: &slot)?.id, "T1")
    XCTAssertEqual(p.abortPlaying(requeue: true), "T1")
    XCTAssertEqual(p.pendingId, "T1")
    let again = drain(p)
    XCTAssertTrue(again.first!.first)
    XCTAssertEqual(again.last!.id, "T1")
    XCTAssertNil(p.playingId)
  }

  func testAnEndDropsEverything() {
    let p = CuePlayer()
    _ = p.request("T5", pcm: CuePlayer.tone("T5"), nowMs: 0, forceAfterMs: 0)
    _ = p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: silent, out: &slot)
    XCTAssertEqual(p.abortPlaying(), "T5")
    XCTAssertNil(p.pendingId)
    _ = p.request("T1", pcm: CuePlayer.tone("T1"), nowMs: 0, forceAfterMs: 0)
    XCTAssertEqual(p.dropPending(), "T1")
    XCTAssertNil(p.nextSlice(nowMs: 0, qandeelAudible: false, msSinceQandeel: silent, msSinceUserSpeech: silent, out: &slot))
  }
}

final class CueScheduleTests: XCTestCase {
  func testAScheduledCueFiresOnceAtItsTimeAndAMovedTimeWins() {
    let s = CueSchedule()
    XCTAssertEqual(s.schedule("T5", kind: "T5", dueAtMs: 10_000, forceAfterMs: 30_000), "SCHEDULED")
    XCTAssertEqual(s.schedule("T5", kind: "T5", dueAtMs: 12_000, forceAfterMs: 30_000), "SCHEDULED")
    XCTAssertEqual(s.due(nowMs: 11_999).map(\.id), [])
    let due = s.due(nowMs: 12_000)
    XCTAssertEqual(due.map(\.id), ["T5"])
    XCTAssertEqual(due[0].forceAfterMs, 30_000)
    XCTAssertEqual(s.due(nowMs: 99_999).map(\.id), [])
  }

  func testAnIdAskedForOnceIsRepeatedForever() {
    let s = CueSchedule()
    XCTAssertNil(s.admit("T5", kind: "T5"))
    s.asked("T5", kind: "T5")
    XCTAssertEqual(s.admit("T5", kind: "T5"), "REPEATED")
    XCTAssertEqual(s.schedule("T5", kind: "T5", dueAtMs: 0, forceAfterMs: 0), "REPEATED")
    XCTAssertEqual(s.waiting, 0)
  }

  func testAT5NeverPlaysAfterAT1() {
    let s = CueSchedule()
    _ = s.schedule("T5", kind: "T5", dueAtMs: 10_000, forceAfterMs: 0)
    XCTAssertNil(s.admit("T1", kind: "T1"))
    s.asked("T1", kind: "T1")
    XCTAssertEqual(s.schedule("T5", kind: "T5", dueAtMs: 10_000, forceAfterMs: 0), "SUPERSEDED")
    XCTAssertEqual(s.admit("T5", kind: "T5"), "SUPERSEDED")
  }

  func testDueCuesComeInTimeOrderAndAPlayedOneLeavesTheSchedule() {
    let s = CueSchedule()
    _ = s.schedule("T1", kind: "T1", dueAtMs: 2_000, forceAfterMs: 0)
    _ = s.schedule("T5", kind: "T5", dueAtMs: 1_000, forceAfterMs: 0)
    XCTAssertEqual(s.due(nowMs: 5_000).map(\.id), ["T5", "T1"])
    _ = s.schedule("T5", kind: "T5", dueAtMs: 9_000, forceAfterMs: 0)
    XCTAssertNil(s.admit("T5", kind: "T5"))
    XCTAssertEqual(s.waiting, 0)
  }

  func testAnEndForgetsWhatWaits() {
    let s = CueSchedule()
    _ = s.schedule("T5", kind: "T5", dueAtMs: 1_000, forceAfterMs: 0)
    _ = s.schedule("T1", kind: "T1", dueAtMs: 2_000, forceAfterMs: 0)
    XCTAssertEqual(s.clear(), ["T5", "T1"])
    XCTAssertEqual(s.due(nowMs: Int64.max).map(\.id), [])
  }
}

final class CallLifecycleMachineTests: XCTestCase {
  typealias M = CallLifecycleMachine
  private static let sources: [M.EndSource] = [.APP, .NOTIFICATION, .SYSTEM, .MICROPHONE, .ENGINE, .SESSION, .APP_GONE, .START_FAILED]

  private func active() -> M {
    let m = M()
    XCTAssertTrue(m.start())
    XCTAssertEqual(m.activated(), [.START_AUDIO, .REPORT_ACTIVE])
    return m
  }

  func testAMachineRunsOneCallAndIsNeverRestarted() {
    let m = active()
    XCTAssertFalse(m.start())
    _ = m.end(.APP)
    m.released()
    XCTAssertFalse(m.start())
    XCTAssertEqual(m.state, .ENDED)
  }

  func testEveryEndSourceClosesTheSameLatchOnce() {
    for source in Self.sources {
      let m = active()
      let actions = m.end(source, detail: "D")
      XCTAssertEqual(m.endSource, source)
      XCTAssertEqual(m.endDetail, "D")
      XCTAssertEqual(actions.first, .STOP_AUDIO)
      XCTAssertEqual(actions.last, .REPORT_ENDED)
      XCTAssertEqual(actions.contains(.END_CALLKIT), source != .SYSTEM, "CallKit is ended by every source but CallKit (\(source))")
      for later in Self.sources { XCTAssertEqual(m.end(later), []) }
      XCTAssertEqual(m.ignoredLate, Self.sources.count)
      XCTAssertEqual(m.endSource, source, "first end wins")
      XCTAssertFalse(m.isLive)
    }
  }

  func testAnEndDuringStartAndALateActivationOnlyEndsCallKit() {
    let m = M()
    XCTAssertTrue(m.start())
    XCTAssertEqual(m.end(.APP), [.STOP_AUDIO, .END_CALLKIT, .REPORT_ENDED])
    XCTAssertEqual(m.activated(), [.END_CALLKIT], "the activation delivered late undoes itself; no audio starts")
    XCTAssertEqual(m.ignoredLate, 1)
  }

  func testALateActivationAfterCallKitsOwnEndDoesNothing() {
    let m = M()
    XCTAssertTrue(m.start())
    _ = m.end(.SYSTEM)
    XCTAssertEqual(m.activated(), [])
  }

  func testAStartFailureBeforeAnyCallReportsOnce() {
    let m = M()
    XCTAssertEqual(m.end(.START_FAILED, detail: "CALLKIT_TIMEOUT"), [.REPORT_ENDED])
    XCTAssertEqual(m.state, .ENDED)
    XCTAssertFalse(m.start())
  }

  func testHoldIsARealAudioStopAndResumesOnlyFromHeld() {
    let m = active()
    XCTAssertEqual(m.systemActive(), [])
    XCTAssertEqual(m.systemInactive(), [.HOLD_AUDIO, .REPORT_HELD])
    XCTAssertEqual(m.state, .HELD)
    XCTAssertEqual(m.systemInactive(), [])
    XCTAssertEqual(m.systemActive(), [.RESUME_AUDIO, .REPORT_RESUMED])
    XCTAssertEqual(m.state, .ACTIVE)
  }

  func testAnEndWhileHeldStopsEverythingAndALateResumeChangesNothing() {
    let m = active()
    _ = m.systemInactive()
    XCTAssertEqual(m.end(.SYSTEM, detail: "CALLKIT_END"), [.STOP_AUDIO, .REPORT_ENDED])
    XCTAssertEqual(m.systemActive(), [])
    XCTAssertEqual(m.systemInactive(), [])
    XCTAssertEqual(m.activated(), [])
    XCTAssertEqual(m.ignoredLate, 3)
    m.released()
    XCTAssertEqual(m.state, .ENDED)
  }
}
