/// S8B-06 CP2 (iOS) — the phone's truth about QANDEEL's reply audio: what may still be played, and what was really heard.
/// The same rules as the Android engine's `ReplyLedger.kt` (CP1), case for case (the tests mirror `ReplyLedgerTest.kt`):
///
/// 1. **The admission gate** (contract §5.2 step 2, A3.2 P3): a REPLY_AUDIO packet is admitted only when its reply was not
///    cut by a barge-in, is not older than the reply now playing, and its `chunkSeq` is above the last admitted one of that
///    reply. A late packet of a cut reply, a stale reply's packet, a repeat or a reordered-late packet is refused and counted.
/// 2. **Playout truth** (contract §7, A3.2: "recorded heard ≤ actually heard"): every admitted packet the engine renders is
///    booked with the output frames it occupies, and counts as heard only once the PRESENTED frame position (the render
///    timestamps plus the session's output latency, never the queued or rendered position) has passed its last frame.
///
/// Pure: no AVFoundation, no clock, not thread-safe on its own (the engine holds its lock).
final class ReplyLedger {
  enum Admit: String { case ACCEPT, LATE_AFTER_CUT, STALE_REPLY, REPEATED_OR_REORDERED }

  struct Booked: Equatable {
    let callTurnIndex: Int64
    let chunkSeq: Int64
    let offsetMs: Int64
    let startFrame: Int64
    let endFrame: Int64
  }

  struct Mark: Equatable {
    let callTurnIndex: Int64
    let chunkSeq: Int64
    let playedMs: Int64
  }

  static let packetMs: Int64 = 20

  private(set) var currentTurn: Int64 = -1
  private(set) var cutThrough: Int64 = -1
  private var lastAdmittedChunk: Int64 = -1
  private var book: [Booked] = []
  private(set) var lastMark: Mark?
  private(set) var admitted: Int64 = 0
  private(set) var refusedLate: Int64 = 0
  private(set) var refusedStale: Int64 = 0
  private(set) var refusedRepeated: Int64 = 0

  func admit(_ callTurnIndex: Int64, _ chunkSeq: Int64) -> Admit {
    if callTurnIndex <= cutThrough {
      refusedLate += 1
      return .LATE_AFTER_CUT
    }
    if callTurnIndex < currentTurn {
      refusedStale += 1
      return .STALE_REPLY
    }
    if callTurnIndex > currentTurn {
      currentTurn = callTurnIndex
      lastAdmittedChunk = -1
    }
    if chunkSeq <= lastAdmittedChunk {
      refusedRepeated += 1
      return .REPEATED_OR_REORDERED
    }
    lastAdmittedChunk = chunkSeq
    admitted += 1
    return .ACCEPT
  }

  /// True when a packet already admitted (and queued) may still be rendered.
  func stillPlayable(_ callTurnIndex: Int64) -> Bool { callTurnIndex > cutThrough }

  /// Books a packet rendered at frames [startFrame, startFrame + frames). Refused for a reply already cut.
  @discardableResult
  func booked(_ callTurnIndex: Int64, _ chunkSeq: Int64, _ offsetMs: Int64, startFrame: Int64, frames: Int64) -> Bool {
    if callTurnIndex <= cutThrough { return false }
    book.append(Booked(callTurnIndex: callTurnIndex, chunkSeq: chunkSeq, offsetMs: offsetMs, startFrame: startFrame, endFrame: startFrame + frames))
    return true
  }

  /// The newest packet whose every frame was presented, if it moves the mark forward.
  func advance(_ presentedFrame: Int64) -> Mark? {
    var heard: Booked?
    var passed = 0
    while passed < book.count && book[passed].endFrame <= presentedFrame {
      heard = book[passed]
      passed += 1
    }
    if passed > 0 { book.removeFirst(passed) }
    guard let packet = heard else { return nil }
    return markFor(packet)
  }

  /// The barge-in cut of reply [callTurnIndex] at the heard boundary [presentedFrame].
  func cut(_ callTurnIndex: Int64, _ presentedFrame: Int64) -> Mark? {
    let final = advance(presentedFrame)
    cutThrough = max(cutThrough, callTurnIndex)
    let through = cutThrough
    book.removeAll { $0.callTurnIndex <= through }
    return final
  }

  func hasUnheard() -> Bool { !book.isEmpty }

  func lastBookedEndFrame() -> Int64 { book.last?.endFrame ?? -1 }

  private func markFor(_ packet: Booked) -> Mark? {
    let mark = Mark(callTurnIndex: packet.callTurnIndex, chunkSeq: packet.chunkSeq, playedMs: packet.offsetMs + ReplyLedger.packetMs)
    if let previous = lastMark {
      if previous.callTurnIndex == mark.callTurnIndex && previous.playedMs >= mark.playedMs { return nil }
      if previous.callTurnIndex > mark.callTurnIndex { return nil }
    }
    lastMark = mark
    return mark
  }
}
