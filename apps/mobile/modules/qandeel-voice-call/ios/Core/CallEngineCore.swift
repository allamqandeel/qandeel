import Foundation

/// What the engine reports. The Expo module turns each into a JS event; the tests record them.
protocol EngineSink: AnyObject {
  func uplink(captureMs: Int64, packet: [UInt8])
  func playout(_ mark: ReplyLedger.Mark, presentedFrame: Int64, source: String)
  func bargeIn(_ report: [String: Any?])
  func speech(onsetCaptureMs: Int64, detectCaptureMs: Int64)
  func replyDrained(callTurnIndex: Int64, chunkSeq: Int64)
  func state(_ state: String, reason: String?)
  func fault(_ code: String)
  func route(change: String, devices: [String])
  func held(captureMs: Int64, cause: String)
  func resumed(captureMs: Int64)
  func cue(event: String, id: String, forced: Bool, source: String?)
  /// The engine's own clock, every `tickMs` while it runs — held included: paces the client's timers (as on Android).
  func tick(nowMs: Int64)
}

/// S8B-06 CP2 (iOS) — every DECISION of QANDEEL's native call audio, with no AVFoundation: the same engine as Android's
/// `CallAudioEngine.kt` (CP1 + CP2) minus its platform I/O, which on iOS is `VoiceProcessingAudioIO` (AVAudioEngine with
/// the voice-processing I/O unit). Driven by three callers, each on its own thread, under one lock:
///
///   capture   `captureFrame` — every 20 ms frame (320 samples, 16 kHz) of the signal AFTER the platform's echo canceller,
///             in order. Each frame gets the next capture-clock instant (0, 20, 40 … from the first frame, never reset by
///             mute), is Opus-encoded for the uplink FIRST unless muted (the person's first words are never waited for or
///             dropped), and is then judged by the speech-onset detector against the echo reference.
///   render    `nextChunk` — the output's next audio (24 kHz): a reply packet admitted by the ledger, a slice of a warning
///             cue, or 20 ms of silence; booked with the output frames it occupies. Each chunk carries the cut generation it
///             was made in, so the render path silences (8 ms ramp) what a later barge-in cut, and nothing else.
///   presented `presented` — the PRESENTED output frame (render timestamps + output latency), never the rendered one:
///             the heard PLAYOUT marks, the drained reply, and a cue's HEARD come from it only.
///
/// Barge-in: 200 ms of continuous speech while QANDEEL is audible cuts the reply at once — the cut generation rises (the
/// render path fades), the ledger strikes the reply at the presented position, its queued packets are dropped and every
/// later packet of it is refused. Hold: the microphone is released and the speaker silent; the reply then playing is struck
/// at its presented position (no BARGE_IN: the person did not interrupt); the capture clock jumps by the held time on
/// resume (the client brackets it with MUTE / UNMUTE). Nothing is logged or stored; no audio leaves except uplink packets.
final class CallEngineCore {
  struct Options {
    var bargeInStops = true
    var vad = VadConfig()
  }

  struct Chunk {
    let samples: [Int16]
    let generation: Int
    let kind: Kind
    enum Kind { case reply, cue, silence }
  }

  static let rampMs: Int64 = 8
  static let maxPendingPackets = 1500
  static let echoWindowNs: UInt64 = 400_000_000
  static let frameNs: UInt64 = 20_000_000
  static let tickMs: UInt64 = 250

  private struct Pending { let callTurnIndex: Int64; let chunkSeq: Int64; let offsetMs: Int64; let packet: [UInt8] }
  private struct Written { let atNs: UInt64; let levelDb: Double }
  private struct CueBooking { let id: String; let endFrame: Int64; let forced: Bool }

  private let lock = NSLock()
  private let options: Options
  private weak var sink: EngineSink?
  private let encoder: UplinkOpusEncoder
  private let decoder: DownlinkOpusDecoder
  private let detector: SpeechOnsetDetector
  private let ledger = ReplyLedger()
  private let cuePlayer = CuePlayer()
  private let cueSchedule = CueSchedule()

  /// The presented output position now, from the platform (set by the I/O adapter, or by a test).
  var presentedNow: () -> (frame: Int64, source: String) = { (0, "NONE") }

  // Under `lock`.
  private(set) var running = false
  private(set) var held = false
  private var muted = false
  private var wasMuted = false
  private var frameIndex: Int64 = 0
  private var heldAtNs: UInt64 = 0
  private var pending: [Pending] = []
  private var recentWrites: [Written] = []
  private var recentCueWrites: [Written] = []
  private var framesWritten: Int64 = 0
  private(set) var cutGeneration = 0
  private var cueBooking: CueBooking?
  private var drainTurn: Int64 = -1
  private var drainChunk: Int64 = -1
  private var lastSpeechNs: UInt64?
  private var lastReplyWriteNs: UInt64?
  private var lastTickNs: UInt64 = 0
  private var pcm = [Int16](repeating: 0, count: DownlinkOpusDecoder.maxFrameSamples)
  private var cueBuffer = [Int16](repeating: 0, count: DownlinkOpusDecoder.frameSamples)

  // Counters (content-free).
  private(set) var uplinkPackets: Int64 = 0
  private(set) var uplinkBytes: Int64 = 0
  private(set) var decodeErrors: Int64 = 0
  private(set) var bargeIns: Int64 = 0
  private(set) var reportOnlyCandidates: Int64 = 0
  private(set) var quietOnsets: Int64 = 0
  private(set) var playoutMarks: Int64 = 0
  private(set) var silenceChunks: Int64 = 0
  private(set) var framesCaptured: Int64 = 0
  private(set) var framesDroppedHeld: Int64 = 0

  init(options: Options, sink: EngineSink) throws {
    self.options = options
    self.sink = sink
    encoder = try UplinkOpusEncoder()
    decoder = try DownlinkOpusDecoder()
    detector = SpeechOnsetDetector(options.vad)
  }

  func begin() {
    lock.lock()
    running = true
    lock.unlock()
    sink?.state("RUNNING", reason: nil)
  }

  /// Stops: every waiting cue is dropped and reported; idempotent.
  func end(_ reason: String) {
    lock.lock()
    guard running else { lock.unlock(); return }
    running = false
    var dropped: [String] = []
    if let id = cuePlayer.abortPlaying() { dropped.append(id) }
    if let id = cuePlayer.dropPending() { dropped.append(id) }
    dropped.append(contentsOf: cueSchedule.clear())
    pending.removeAll()
    lock.unlock()
    for id in dropped { sink?.cue(event: "DROPPED", id: id, forced: false, source: nil) }
    sink?.state("STOPPED", reason: reason)
  }

  var isRunning: Bool { lock.lock(); defer { lock.unlock() }; return running }
  /// Read by the real-time render path without the lock (a word-sized value; a stale read costs one render cycle).
  var renderGeneration: Int { cutGeneration }
  var renderHeld: Bool { held }
  var isHeld: Bool { lock.lock(); defer { lock.unlock() }; return held }

  func setMuted(_ value: Bool) {
    lock.lock(); muted = value; lock.unlock()
  }

  // ------------------------------------------------------------------ capture

  /// One 20 ms frame of the post-AEC capture. Ignored while held (the microphone is released; a frame cut by the hold is
  /// never sent).
  func captureFrame(_ frame: [Int16], nowNs: UInt64) {
    precondition(frame.count == UplinkOpusEncoder.frameSamples, "frame")
    lock.lock()
    if !running || held {
      if held { framesDroppedHeld += 1 }
      lock.unlock()
      return
    }
    let captureMs = frameIndex * ReplyLedger.packetMs
    let isMuted = muted
    let resetEncoder = wasMuted && !isMuted
    wasMuted = isMuted
    lock.unlock()

    // The uplink first: it never waits for the detector and never stops for a barge-in.
    if !isMuted {
      if resetEncoder { encoder.reset() }
      do {
        let packet = try frame.withUnsafeBufferPointer { try encoder.encode($0.baseAddress!) }
        lock.lock(); uplinkPackets += 1; uplinkBytes += Int64(packet.count); lock.unlock()
        sink?.uplink(captureMs: captureMs, packet: packet)
      } catch {
        sink?.fault("ENCODE_FAILED")
      }
    }

    let level = SpeechOnsetDetector.levelDb(frame)
    lock.lock()
    let audible = audibleLocked(nowNs)
    let cueRef = maxLevel(&recentCueWrites, nowNs)
    let replyRef = audible ? maxLevel(&recentWrites, nowNs) : nil
    let ref: Double? = [cueRef, replyRef].compactMap { $0 }.max()
    let decision = detector.push(frameDb: level, refDb: ref, captureMs: captureMs)
    if decision.speechFrame { lastSpeechNs = nowNs }
    frameIndex += 1
    framesCaptured += 1
    lock.unlock()

    if decision.kind == .onset {
      if audible { _ = bargeIn(onsetCaptureMs: decision.onsetCaptureMs, detectCaptureMs: captureMs, detectedAtNs: nowNs, forced: false) }
      else {
        lock.lock(); quietOnsets += 1; lock.unlock()
        sink?.speech(onsetCaptureMs: decision.onsetCaptureMs, detectCaptureMs: captureMs)
      }
    }
  }

  /// The next capture instant (the first frame not yet produced).
  var nextCaptureMs: Int64 { lock.lock(); defer { lock.unlock() }; return frameIndex * ReplyLedger.packetMs }

  // ------------------------------------------------------------------ replies

  func enqueueReply(callTurnIndex: Int64, chunkSeq: Int64, offsetMs: Int64, packet: [UInt8]) -> String {
    lock.lock(); defer { lock.unlock() }
    if !running { return "NOT_RUNNING" }
    if held { return "HELD" }
    if pending.count >= CallEngineCore.maxPendingPackets { return "OVERFLOW" }
    let admit = ledger.admit(callTurnIndex, chunkSeq)
    if admit == .ACCEPT { pending.append(Pending(callTurnIndex: callTurnIndex, chunkSeq: chunkSeq, offsetMs: offsetMs, packet: packet)) }
    return admit.rawValue
  }

  /// The output's next audio. Called by the render path whenever it needs more; never blocks on the network.
  func nextChunk(nowNs: UInt64) -> Chunk {
    var events: [() -> Void] = []
    defer { for e in events { e() } }
    lock.lock()
    defer { lock.unlock() }
    fireDueCuesLocked(nowNs, &events)
    if !running || held {
      silenceChunks += 1
      return silenceLocked()
    }
    // A cue that started plays to its end; a reply arriving meanwhile waits for it.
    while cuePlayer.playingId == nil, !pending.isEmpty {
      let next = pending.removeFirst()
      guard ledger.stillPlayable(next.callTurnIndex) else { continue }
      let samples: Int
      do {
        samples = try pcm.withUnsafeMutableBufferPointer { try decoder.decode(next.packet, into: $0.baseAddress!) }
      } catch {
        decodeErrors += 1
        continue
      }
      if samples <= 0 { continue }
      let chunk = Array(pcm[0..<samples])
      let start = framesWritten
      framesWritten += Int64(samples)
      if ledger.booked(next.callTurnIndex, next.chunkSeq, next.offsetMs, startFrame: start, frames: Int64(samples)) {
        lastReplyWriteNs = nowNs
        recentWrites.append(Written(atNs: nowNs, levelDb: SpeechOnsetDetector.levelDb(chunk)))
        if recentWrites.count > 64 { recentWrites.removeFirst(recentWrites.count - 64) }
        drainTurn = next.callTurnIndex
        drainChunk = next.chunkSeq
      }
      return Chunk(samples: chunk, generation: cutGeneration, kind: .reply)
    }
    let audible = ledger.hasUnheard() || !pending.isEmpty || audibleLocked(nowNs)
    if let slice = cuePlayer.nextSlice(
      nowMs: Int64(nowNs / 1_000_000), qandeelAudible: audible, msSinceQandeel: sinceMs(nowNs, lastReplyWriteNs),
      msSinceUserSpeech: sinceMs(nowNs, lastSpeechNs), out: &cueBuffer
    ) {
      if slice.first { events.append { [weak self] in self?.sink?.cue(event: "STARTED", id: slice.id, forced: slice.forced, source: nil) } }
      framesWritten += Int64(slice.samples)
      recentCueWrites.append(Written(atNs: nowNs, levelDb: SpeechOnsetDetector.levelDb(cueBuffer, count: slice.samples)))
      if recentCueWrites.count > 64 { recentCueWrites.removeFirst(recentCueWrites.count - 64) }
      if slice.last { cueBooking = CueBooking(id: slice.id, endFrame: framesWritten, forced: slice.forced) }
      return Chunk(samples: Array(cueBuffer[0..<slice.samples]), generation: cutGeneration, kind: .cue)
    }
    silenceChunks += 1
    return silenceLocked()
  }

  private func silenceLocked() -> Chunk {
    framesWritten += Int64(DownlinkOpusDecoder.frameSamples)
    return Chunk(samples: [Int16](repeating: 0, count: DownlinkOpusDecoder.frameSamples), generation: cutGeneration, kind: .silence)
  }

  /// The platform presented every output frame below `frame`: heard marks, the drained reply, a cue's HEARD.
  func presented(_ frame: Int64, source: String) {
    var mark: ReplyLedger.Mark?
    var drained: (Int64, Int64)?
    var heardCue: CueBooking?
    lock.lock()
    mark = ledger.advance(frame)
    if let cue = cueBooking, frame >= cue.endFrame {
      heardCue = cue
      cueBooking = nil
    }
    if drainTurn >= 0 && !ledger.hasUnheard() && !pending.contains(where: { $0.callTurnIndex == drainTurn }) {
      drained = (drainTurn, drainChunk)
      drainTurn = -1
    }
    if mark != nil { playoutMarks += 1 }
    lock.unlock()
    if let m = mark { sink?.playout(m, presentedFrame: frame, source: source) }
    if let d = drained { sink?.replyDrained(callTurnIndex: d.0, chunkSeq: d.1) }
    if let c = heardCue { sink?.cue(event: "HEARD", id: c.id, forced: c.forced, source: source) }
  }

  /// The engine's clock tick (a timer that keeps running with the screen locked): scheduled cues fall due here even while
  /// nothing renders.
  func tick(nowNs: UInt64) {
    var events: [() -> Void] = []
    lock.lock()
    fireDueCuesLocked(nowNs, &events)
    if running && nowNs >= lastTickNs + CallEngineCore.tickMs * 1_000_000 {
      lastTickNs = nowNs
      events.append { [weak self] in self?.sink?.tick(nowMs: Int64(nowNs / 1_000_000)) }
    }
    lock.unlock()
    for e in events { e() }
  }

  // ------------------------------------------------------------------ barge-in

  @discardableResult
  func forceBargeIn(nowNs: UInt64) -> Bool {
    let at = nextCaptureMs
    return bargeIn(onsetCaptureMs: at, detectCaptureMs: at, detectedAtNs: nowNs, forced: true)
  }

  private func bargeIn(onsetCaptureMs: Int64, detectCaptureMs: Int64, detectedAtNs: UInt64, forced: Bool) -> Bool {
    let presentedNow = self.presentedNow()
    let report: [String: Any?]
    lock.lock()
    guard running else { lock.unlock(); return false }
    let turn = ledger.currentTurn
    if !options.bargeInStops && !forced {
      reportOnlyCandidates += 1
      report = [
        "action": "REPORT_ONLY", "callTurnIndex": turn, "onsetCaptureMs": onsetCaptureMs, "detectCaptureMs": detectCaptureMs,
        "detectedAtNs": Double(detectedAtNs), "forced": false,
      ]
    } else {
      cutGeneration += 1
      let final = ledger.cut(turn, presentedNow.frame) ?? (ledger.lastMark?.callTurnIndex == turn ? ledger.lastMark : nil)
      pending.removeAll { $0.callTurnIndex <= turn }
      // The cut reply is no longer audible: it stops being the echo reference, so it cannot be cut twice.
      recentWrites.removeAll()
      lastReplyWriteNs = nil
      bargeIns += 1
      report = [
        "action": "STOP", "callTurnIndex": turn, "onsetCaptureMs": onsetCaptureMs, "detectCaptureMs": detectCaptureMs,
        "detectedAtNs": Double(detectedAtNs), "presentedFrame": presentedNow.frame, "rampMs": CallEngineCore.rampMs,
        "stopSource": presentedNow.source, "finalChunkSeq": final?.chunkSeq, "finalPlayedMs": final?.playedMs, "forced": forced,
      ]
    }
    lock.unlock()
    sink?.bargeIn(report)
    return true
  }

  // ------------------------------------------------------------------ hold

  /// Another call has the audio: nothing is captured or rendered until `resume`. False when not running or already held.
  @discardableResult
  func hold(cause: String, nowNs: UInt64) -> Bool {
    let presentedNow = self.presentedNow()
    lock.lock()
    guard running, !held else { lock.unlock(); return false }
    held = true
    heldAtNs = nowNs
    let heldAt = frameIndex * ReplyLedger.packetMs
    cutGeneration += 1
    let final = ledger.cut(ledger.currentTurn, presentedNow.frame)
    pending.removeAll()
    recentWrites.removeAll()
    recentCueWrites.removeAll()
    let requeued = cuePlayer.abortPlaying(requeue: true)
    cueBooking = nil
    lock.unlock()
    if let f = final { sink?.playout(f, presentedFrame: presentedNow.frame, source: "HOLD") }
    if let id = requeued { sink?.cue(event: "REQUEUED", id: id, forced: false, source: nil) }
    sink?.held(captureMs: heldAt, cause: cause)
    return true
  }

  /// The audio is the call's again. The capture clock continues after the held time (whole 20 ms frames, at least one);
  /// `resumed` is reported BEFORE the first frame after the hole is accepted, so UNMUTE precedes it.
  @discardableResult
  func resume(nowNs: UInt64) -> Bool {
    lock.lock()
    guard running, held else { lock.unlock(); return false }
    let elapsed = nowNs > heldAtNs ? nowNs - heldAtNs : 0
    let heldFrames = max(Int64(1), Int64((elapsed + CallEngineCore.frameNs - 1) / CallEngineCore.frameNs))
    frameIndex += heldFrames
    let continueAt = frameIndex * ReplyLedger.packetMs
    wasMuted = true // a fresh encoder state after the hole, as after a mute
    lock.unlock()
    sink?.resumed(captureMs: continueAt)
    lock.lock(); held = false; lock.unlock()
    return true
  }

  // ------------------------------------------------------------------ cues

  /// Queues a warning cue now. QUEUED, REPEATED, SUPERSEDED or NOT_RUNNING.
  func playCue(id: String, kind: String, forceAfterMs: Int64, nowNs: UInt64, pcm: [Int16]? = nil) -> String {
    var events: [() -> Void] = []
    lock.lock()
    guard running else { lock.unlock(); return "NOT_RUNNING" }
    let (result, superseded) = requestCueLocked(id: id, kind: kind, forceAfterMs: forceAfterMs, nowNs: nowNs, pcm: pcm)
    lock.unlock()
    if let s = superseded { events.append { [weak self] in self?.sink?.cue(event: "SUPERSEDED", id: s, forced: false, source: nil) } }
    if result == "QUEUED" { events.append { [weak self] in self?.sink?.cue(event: "QUEUED", id: id, forced: false, source: nil) } }
    for e in events { e() }
    return result
  }

  /// The local trigger: queued `dueInMs` from now on this engine's clock. SCHEDULED, REPEATED, SUPERSEDED or NOT_RUNNING.
  func scheduleCue(id: String, kind: String, dueInMs: Int64, forceAfterMs: Int64, nowNs: UInt64) -> String {
    lock.lock(); defer { lock.unlock() }
    guard running else { return "NOT_RUNNING" }
    return cueSchedule.schedule(id, kind: kind, dueAtMs: Int64(nowNs / 1_000_000) + max(0, dueInMs), forceAfterMs: forceAfterMs)
  }

  private func requestCueLocked(id: String, kind: String, forceAfterMs: Int64, nowNs: UInt64, pcm: [Int16]?) -> (String, String?) {
    if let refused = cueSchedule.admit(id, kind: kind) { return (refused, nil) }
    let before = cuePlayer.pendingId
    if !cuePlayer.request(id, pcm: pcm ?? CuePlayer.tone(kind), nowMs: Int64(nowNs / 1_000_000), forceAfterMs: forceAfterMs) { return ("REPEATED", nil) }
    cueSchedule.asked(id, kind: kind)
    return ("QUEUED", before == id ? nil : before)
  }

  private func fireDueCuesLocked(_ nowNs: UInt64, _ events: inout [() -> Void]) {
    guard running else { return }
    for cue in cueSchedule.due(nowMs: Int64(nowNs / 1_000_000)) {
      let (result, superseded) = requestCueLocked(id: cue.id, kind: cue.kind, forceAfterMs: cue.forceAfterMs, nowNs: nowNs, pcm: nil)
      if let s = superseded { events.append { [weak self] in self?.sink?.cue(event: "SUPERSEDED", id: s, forced: false, source: nil) } }
      let event = result == "QUEUED" ? "DUE" : result
      events.append { [weak self] in self?.sink?.cue(event: event, id: cue.id, forced: false, source: cue.kind) }
    }
  }

  // ------------------------------------------------------------------ helpers

  /// QANDEEL is audible: booked reply audio not yet all presented, or reply audio rendered within the echo window.
  private func audibleLocked(_ nowNs: UInt64) -> Bool {
    if ledger.hasUnheard() { return true }
    guard let last = recentWrites.last else { return false }
    return nowNs >= last.atNs && nowNs - last.atNs <= CallEngineCore.echoWindowNs
  }

  private func maxLevel(_ writes: inout [Written], _ nowNs: UInt64) -> Double? {
    writes.removeAll { nowNs > $0.atNs && nowNs - $0.atNs > CallEngineCore.echoWindowNs }
    return writes.map(\.levelDb).max()
  }

  private func sinceMs(_ nowNs: UInt64, _ thenNs: UInt64?) -> Int64 {
    guard let then = thenNs else { return Int64.max }
    return nowNs >= then ? Int64((nowNs - then) / 1_000_000) : 0
  }

  func describe() -> [String: Any?] {
    lock.lock(); defer { lock.unlock() }
    return [
      "platform": "ios", "running": running, "held": held, "muted": muted,
      "opus": "libopus-1.5.2 uplink 16k/20ms/\(UplinkOpusEncoder.bitrate)bps FEC=on loss=10 DTX=off c\(UplinkOpusEncoder.complexity); downlink 24k",
      "uplinkPackets": uplinkPackets, "uplinkBytes": uplinkBytes, "decodeErrors": decodeErrors, "bargeIns": bargeIns,
      "reportOnlyCandidates": reportOnlyCandidates, "quietOnsets": quietOnsets, "playoutMarks": playoutMarks,
      "silenceChunks": silenceChunks, "framesCaptured": framesCaptured, "framesDroppedHeld": framesDroppedHeld,
      "admitted": ledger.admitted, "refusedLate": ledger.refusedLate, "refusedStale": ledger.refusedStale,
      "refusedRepeated": ledger.refusedRepeated, "cutGeneration": cutGeneration, "cuePending": cuePlayer.pendingId,
      "cuePlaying": cuePlayer.playingId, "floorDb": detector.floorDb,
    ]
  }
}
