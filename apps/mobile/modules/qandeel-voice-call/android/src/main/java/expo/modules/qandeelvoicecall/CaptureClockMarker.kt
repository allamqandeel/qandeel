package expo.modules.qandeelvoicecall

/**
 * S8B-07 RB-2 / M-2 (CP3) — resolves a CLOCK_MARK (`docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v2.md`) against the call's
 * capture clock: the echo is the capture position of the FIRST frame whose first sample was captured at least [marginNs]
 * after the mark arrived, or NOCLOCK (null) when no stable capture timestamp proves one. Pure: no Android, no I/O, no log;
 * the engine feeds it, and a mark can only ever be answered later than the truth, never earlier.
 *
 *   timing      a frame's capture instant comes from `AudioRecord.getTimestamp(TIMEBASE_MONOTONIC)` mapped through the
 *               samples actually READ in this recording (the timestamp's own position space), never through the capture
 *               clock's frame index: after a hold that index jumps by the held time, the read position does not.
 *   segment     every (re)start of the microphone is a new segment ([segmentStart]); the reference of the previous one is
 *               never carried over. [invalidate] (a hold, a stop) answers every pending mark NOCLOCK at once.
 *   stability   no echo until [stableFrames] consecutive frames each had a plausible timestamp (the frame was captured
 *               before it was read, and not absurdly long before) and consecutive instants 20 ms apart within [jitterNs].
 *               A missing or implausible timestamp restarts the count (the start-up HAL, a route change); a pending mark
 *               then waits for the next stable frame (only later, never earlier) or expires NOCLOCK.
 *   never blocks  every call is a few comparisons under the marker's own monitor; capture and playback never wait on JS.
 */
class CaptureClockMarker(
  private val marginNs: Long = MARGIN_NS,
  private val stableFrames: Int = STABLE_FRAMES,
  private val jitterNs: Long = JITTER_NS,
  private val maxReadLatencyNs: Long = MAX_READ_LATENCY_NS,
  private val pendingLimitNs: Long = PENDING_LIMIT_NS,
  private val maxPending: Int = MAX_PENDING,
) {
  /** One answer: [token] as given to [mark], and the capture position in ms (a multiple of 20), or null (NOCLOCK). */
  data class Echo(val token: Long, val captureMs: Long?)

  private class Pending(val token: Long, val targetNs: Long)

  private val pending = ArrayDeque<Pending>()
  private var live = false
  private var consistent = 0
  private var lastCaptureMs = Long.MIN_VALUE
  private var lastTimeNs = Long.MIN_VALUE

  /** The microphone (re)started: a new segment, whose reference must be established from its own timestamps. */
  @Synchronized
  fun segmentStart() {
    live = true
    reset()
  }

  /** A hold or a stop: no frame of this segment certifies anything any more; every pending mark is NOCLOCK. */
  @Synchronized
  fun invalidate(): List<Echo> {
    live = false
    reset()
    return drain()
  }

  /**
   * A CLOCK_MARK arrived at [receiptNs] (`System.nanoTime`). Returns false when it cannot be taken (held, not started,
   * too many pending): the caller answers NOCLOCK at once. Otherwise exactly one [Echo] for [token] follows, from [frame]
   * or [invalidate].
   */
  @Synchronized
  fun mark(token: Long, receiptNs: Long): Boolean {
    if (!live || pending.size >= maxPending) return false
    pending.addLast(Pending(token, receiptNs + marginNs))
    return true
  }

  /**
   * One whole frame was read at [readNs]: [captureMs] on the capture clock, [captureTimeNs] the monotonic instant of its
   * first sample from this segment's timestamp, or -1 when the platform gave none. Returns the marks it answers.
   */
  @Synchronized
  fun frame(captureMs: Long, captureTimeNs: Long, readNs: Long): List<Echo> {
    if (!live) return emptyList()
    val plausible = captureTimeNs >= 0 && captureTimeNs + FRAME_NS <= readNs + jitterNs && readNs - captureTimeNs <= maxReadLatencyNs
    if (!plausible) {
      reset()
    } else {
      val follows = captureMs == lastCaptureMs + FRAME_MS && kotlin.math.abs(captureTimeNs - lastTimeNs - FRAME_NS) <= jitterNs
      consistent = if (follows) consistent + 1 else 1
      lastCaptureMs = captureMs
      lastTimeNs = captureTimeNs
    }
    if (pending.isEmpty()) return emptyList()
    val out = ArrayList<Echo>(1)
    val stable = plausible && consistent >= stableFrames
    val it = pending.iterator()
    while (it.hasNext()) {
      val p = it.next()
      if (stable && captureTimeNs >= p.targetNs) {
        out.add(Echo(p.token, captureMs))
        it.remove()
      } else if (readNs - p.targetNs > pendingLimitNs) {
        out.add(Echo(p.token, null))
        it.remove()
      }
    }
    return out
  }

  @Synchronized
  fun isStable(): Boolean = live && consistent >= stableFrames

  @Synchronized
  fun pendingCount(): Int = pending.size

  private fun reset() {
    consistent = 0
    lastCaptureMs = Long.MIN_VALUE
    lastTimeNs = Long.MIN_VALUE
  }

  private fun drain(): List<Echo> {
    val out = pending.map { Echo(it.token, null) }
    pending.clear()
    return out
  }

  companion object {
    /** The HONOR proof (2026-11-24): 0 ms is unsafe, 100 ms gave 0 early marks. Frozen by the Product Owner. */
    const val MARGIN_NS = 100_000_000L
    /** 200 ms of consecutive consistent timestamps before the first certified echo of a segment. */
    const val STABLE_FRAMES = 10
    const val JITTER_NS = 5_000_000L
    const val MAX_READ_LATENCY_NS = 500_000_000L
    const val PENDING_LIMIT_NS = 2_000_000_000L
    const val MAX_PENDING = 8
    private const val FRAME_MS = 20L
    private const val FRAME_NS = 20_000_000L
  }
}
