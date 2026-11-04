package expo.modules.qandeelvoicecall

/**
 * S8B-06 CP1 — the phone's truth about QANDEEL's reply audio: what may still be played, and what was really heard.
 *
 * Two jobs, both under the engine's lock (this class is not thread-safe on its own and is pure: no Android, no clock):
 *
 * 1. **The admission gate** (contract §5.2 step 2, A3.2 P3). A REPLY_AUDIO packet (already checked by the client for the
 *    connection epoch) is admitted only when its reply was not cut by a barge-in (`callTurnIndex` above every cut one), is
 *    not older than the reply now playing, and its `chunkSeq` is above the last admitted one of that reply. A late packet
 *    of a cut reply, a stale reply's packet, a repeat or a reordered-late packet is refused and counted, never played.
 *
 * 2. **Playout truth** (contract §7, A3.2: "recorded heard ≤ actually heard"). Every admitted packet the playback thread
 *    writes to the track is booked with the track frames it occupies. A packet counts as heard only once the platform's
 *    PRESENTED frame position (an `AudioTrack` timestamp, never the queued or written position) has passed its last frame.
 *    The PLAYOUT mark is then `chunkSeq` of the last fully heard packet and `playedMs` = that packet's `offsetMs + 20`: a
 *    whole 20 ms packet boundary, rising, never ahead of the ear. At a barge-in the frames written after the fade began are
 *    presented at zero volume, so every packet ending after the heard boundary is struck from the book: it will never be
 *    reported, even when the track later presents it.
 */
class ReplyLedger {
  enum class Admit { ACCEPT, LATE_AFTER_CUT, STALE_REPLY, REPEATED_OR_REORDERED }

  data class Booked(val callTurnIndex: Long, val chunkSeq: Long, val offsetMs: Long, val startFrame: Long, val endFrame: Long)

  data class Mark(val callTurnIndex: Long, val chunkSeq: Long, val playedMs: Long)

  var currentTurn = -1L
    private set
  var cutThrough = -1L
    private set
  private var lastAdmittedChunk = -1L
  private val book = ArrayDeque<Booked>()
  /** The last mark reported (the heard position of the newest reply), or null before anything was heard. */
  var lastMark: Mark? = null
    private set

  var admitted = 0L
    private set
  var refusedLate = 0L
    private set
  var refusedStale = 0L
    private set
  var refusedRepeated = 0L
    private set

  fun admit(callTurnIndex: Long, chunkSeq: Long): Admit {
    if (callTurnIndex <= cutThrough) {
      refusedLate += 1
      return Admit.LATE_AFTER_CUT
    }
    if (callTurnIndex < currentTurn) {
      refusedStale += 1
      return Admit.STALE_REPLY
    }
    if (callTurnIndex > currentTurn) {
      currentTurn = callTurnIndex
      lastAdmittedChunk = -1
    }
    if (chunkSeq <= lastAdmittedChunk) {
      refusedRepeated += 1
      return Admit.REPEATED_OR_REORDERED
    }
    lastAdmittedChunk = chunkSeq
    admitted += 1
    return Admit.ACCEPT
  }

  /** True when a packet already admitted (and queued for writing) may still go to the track. */
  fun stillPlayable(callTurnIndex: Long): Boolean = callTurnIndex > cutThrough

  /** Books a packet the track accepted at frames [startFrame, startFrame + frames). Refused for a reply already cut. */
  fun booked(callTurnIndex: Long, chunkSeq: Long, offsetMs: Long, startFrame: Long, frames: Long): Boolean {
    if (callTurnIndex <= cutThrough) return false
    book.addLast(Booked(callTurnIndex, chunkSeq, offsetMs, startFrame, startFrame + frames))
    return true
  }

  /**
   * The newest packet whose every frame the platform has presented, if it moves the mark forward. Packets wholly presented
   * are dropped from the book as they are passed.
   */
  fun advance(presentedFrame: Long): Mark? {
    var heard: Booked? = null
    while (book.isNotEmpty() && book.first().endFrame <= presentedFrame) heard = book.removeFirst()
    val packet = heard ?: return null
    return markFor(packet)
  }

  /**
   * The barge-in cut of reply [callTurnIndex] at the heard boundary [presentedFrame]: packets fully presented by then are
   * heard (the final mark, if it moves); every later packet of that reply is struck and nothing of it is admitted again.
   */
  fun cut(callTurnIndex: Long, presentedFrame: Long): Mark? {
    val final = advance(presentedFrame)
    cutThrough = maxOf(cutThrough, callTurnIndex)
    book.removeAll { it.callTurnIndex <= cutThrough }
    return final
  }

  /**
   * S8B-06 CP3 (F-F): the barge-in cut of reply [callTurnIndex] and its final heard mark, the mark the phone sends before
   * BARGE_IN: only a mark OF that reply. The reply cut is the newest admitted one, and an older reply's queued audio may
   * still be what was heard (the server closed it at the next commit; nothing cut it here): its mark is not the cut
   * reply's, and nothing of the cut reply was heard.
   */
  fun cutFinal(callTurnIndex: Long, presentedFrame: Long): Mark? =
    (cut(callTurnIndex, presentedFrame) ?: lastMark)?.takeIf { it.callTurnIndex == callTurnIndex }

  /** True while booked audio of the reply now playing has not all been presented. */
  fun hasUnheard(): Boolean = book.isNotEmpty()

  fun lastBookedEndFrame(): Long = if (book.isEmpty()) -1 else book.last().endFrame

  private fun markFor(packet: Booked): Mark? {
    val mark = Mark(packet.callTurnIndex, packet.chunkSeq, packet.offsetMs + PACKET_MS)
    val previous = lastMark
    if (previous != null && previous.callTurnIndex == mark.callTurnIndex && previous.playedMs >= mark.playedMs) return null
    if (previous != null && previous.callTurnIndex > mark.callTurnIndex) return null
    lastMark = mark
    return mark
  }

  companion object {
    const val PACKET_MS = 20L
  }
}
