import Foundation

/// S8B-06 CP2 (iOS) — the 60-minute warning cue inside the call's own audio (contract D-05-06, A1 §5, acceptance #36). The
/// same rules as the Android engine's `CuePlayer.kt`: the cue is rendered in the SAME voice-processing output as QANDEEL's
/// replies (heard with the screen locked; the canceller treats it as the call's own output); it starts only at the first
/// suitable silence (QANDEEL not audible, `qandeelGapMs` since its last audio, the person silent `userSilenceMs`), or —
/// past the request's bound — the next moment QANDEEL is not audible even if the person talks; once started it plays to its
/// end; a newer request replaces a pending one; HEARD is the engine's, from the presented position. Pure.
final class CuePlayer {
  struct Request {
    let id: String
    let pcm: [Int16]
    let requestedAtMs: Int64
    let forceAtMs: Int64
  }

  struct Slice: Equatable {
    let id: String
    let samples: Int
    let first: Bool
    let last: Bool
    let forced: Bool
  }

  static let userSilenceMs: Int64 = 700
  static let qandeelGapMs: Int64 = 300

  private var pending: Request?
  private var playing: Request?
  private var offset = 0
  private var forced = false
  private var seen = Set<String>()

  var pendingId: String? { pending?.id }
  var playingId: String? { playing?.id }

  /// Queues a cue. False when this id was already requested once.
  func request(_ id: String, pcm: [Int16], nowMs: Int64, forceAfterMs: Int64) -> Bool {
    if !seen.insert(id).inserted { return false }
    pending = Request(id: id, pcm: pcm, requestedAtMs: nowMs, forceAtMs: nowMs + max(0, forceAfterMs))
    return true
  }

  func dropPending() -> String? {
    let id = pending?.id
    pending = nil
    return id
  }

  /// Stops a cue mid-play; with `requeue` (a hold) it waits again from its beginning, unless a newer one waits.
  func abortPlaying(requeue: Bool = false) -> String? {
    guard let cue = playing else { return nil }
    playing = nil
    offset = 0
    if requeue && pending == nil { pending = cue }
    return cue.id
  }

  /// One 20 ms output slot with no reply packet due: copies the next slice into `out`, or returns nil (silence).
  func nextSlice(nowMs: Int64, qandeelAudible: Bool, msSinceQandeel: Int64, msSinceUserSpeech: Int64, out: inout [Int16]) -> Slice? {
    var first = false
    if playing == nil {
      guard let next = pending else { return nil }
      if qandeelAudible || msSinceQandeel < CuePlayer.qandeelGapMs { return nil }
      let silent = msSinceUserSpeech >= CuePlayer.userSilenceMs
      if !silent && nowMs < next.forceAtMs { return nil }
      playing = next
      pending = nil
      offset = 0
      forced = !silent
      first = true
    }
    let cue = playing!
    let n = min(out.count, cue.pcm.count - offset)
    for i in 0..<n { out[i] = cue.pcm[offset + i] }
    if n < out.count { for i in n..<out.count { out[i] = 0 } }
    offset += n
    let last = offset >= cue.pcm.count
    let slice = Slice(id: cue.id, samples: out.count, first: first, last: last, forced: forced)
    if last {
      playing = nil
      offset = 0
    }
    return slice
  }

  /// The contract's provider-free fallback (D-05-02): `T5` two notes, `T1` three, 660 Hz, 140 ms each with 90 ms between,
  /// at −20 dBFS, with 10 ms raised-cosine edges. No file, no provider.
  static func tone(_ kind: String, rate: Int = Int(DownlinkOpusDecoder.rate)) -> [Int16] {
    let notes = kind == "T1" ? 3 : 2
    let note = rate * 140 / 1000
    let gap = rate * 90 / 1000
    let edge = rate * 10 / 1000
    let amplitude = 32767.0 * pow(10.0, -20.0 / 20.0)
    var out = [Int16](repeating: 0, count: notes * note + (notes - 1) * gap)
    for k in 0..<notes {
      let start = k * (note + gap)
      for i in 0..<note {
        let env: Double
        if i < edge { env = 0.5 - 0.5 * cos(Double.pi * Double(i) / Double(edge)) }
        else if i >= note - edge { env = 0.5 - 0.5 * cos(Double.pi * Double(note - 1 - i) / Double(edge)) }
        else { env = 1.0 }
        out[start + i] = Int16((amplitude * env * sin(2 * Double.pi * 660.0 * Double(i) / Double(rate))).rounded())
      }
    }
    return out
  }
}

/// The rules that decide WHETHER and WHEN a cue is asked of the player — `CueSchedule.kt`, case for case: once per id, a T-5
/// never after a T-1, a schedule moves while it has not fired, an end forgets what waits. Pure.
final class CueSchedule {
  struct Entry: Equatable {
    let id: String
    let kind: String
    let dueAtMs: Int64
    let forceAfterMs: Int64
  }

  private var scheduled: [String: Entry] = [:]
  private var asked = Set<String>()
  private var highestRank = 0

  func schedule(_ id: String, kind: String, dueAtMs: Int64, forceAfterMs: Int64) -> String {
    if asked.contains(id) { return "REPEATED" }
    if rank(kind) < highestRank { return "SUPERSEDED" }
    scheduled[id] = Entry(id: id, kind: kind, dueAtMs: dueAtMs, forceAfterMs: forceAfterMs)
    return "SCHEDULED"
  }

  /// nil when `id` may be asked of the player now; otherwise REPEATED or SUPERSEDED. Forgets its schedule.
  func admit(_ id: String, kind: String) -> String? {
    if asked.contains(id) { return "REPEATED" }
    if rank(kind) < highestRank { return "SUPERSEDED" }
    scheduled[id] = nil
    return nil
  }

  func asked(_ id: String, kind: String) {
    asked.insert(id)
    highestRank = max(highestRank, rank(kind))
  }

  func due(nowMs: Int64) -> [Entry] {
    if scheduled.isEmpty { return [] }
    let due = scheduled.values.filter { nowMs >= $0.dueAtMs }.sorted { $0.dueAtMs < $1.dueAtMs }
    for e in due { scheduled[e.id] = nil }
    return due
  }

  func clear() -> [String] {
    let ids = scheduled.values.sorted { $0.dueAtMs < $1.dueAtMs }.map(\.id)
    scheduled.removeAll()
    return ids
  }

  var waiting: Int { scheduled.count }

  private func rank(_ kind: String) -> Int { kind == "T1" ? 2 : 1 }
}
