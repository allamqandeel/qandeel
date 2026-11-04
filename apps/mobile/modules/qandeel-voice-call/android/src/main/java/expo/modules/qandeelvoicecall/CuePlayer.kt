package expo.modules.qandeelvoicecall

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * S8B-06 CP2 — the 60-minute warning cue inside the call's own audio (contract D-05-06, A1 §5, acceptance #36).
 *
 * The cue is written into the SAME voice-communication track as QANDEEL's replies, so it is heard with the screen locked
 * or the app in the background, and the platform's echo canceller treats it as the call's own output. It is pure (no
 * Android, no clock): the playback thread asks it, once per 20 ms output slot in which no reply packet is due, whether a
 * slice of the cue goes there.
 *
 *   - **First suitable silence.** A cue starts only when QANDEEL is not audible (no reply audio queued, booked or written
 *     in the last [QANDEEL_GAP_MS]) AND the person has been silent for [USER_SILENCE_MS]. It never cuts QANDEEL and never
 *     talks over the person.
 *   - **A bound.** If no such silence came within the request's `forceAfterMs`, the cue starts at the next moment QANDEEL
 *     is not audible even if the person is talking (it still never overlaps QANDEEL): the warning must arrive before the
 *     end, "at the latest a little before the time" (A1 §5).
 *   - **Once.** A cue, once started, plays to its end: a reply that arrives meanwhile waits for it (the tone is under a
 *     second; CP3's spoken clips replace the PCM, not this mechanism). A request for an id already requested is refused;
 *     a newer request replaces a pending one that has not started (T-1 supersedes a T-5 still waiting).
 *   - **Heard.** Whether it was heard is not decided here: the engine reports HEARD only when the platform's PRESENTED
 *     position has passed the cue's last frame (the same rule as PLAYOUT).
 */
class CuePlayer {
  class Request(val id: String, val pcm: ShortArray, val requestedAtMs: Long, val forceAtMs: Long)

  data class Slice(val id: String, val samples: Int, val first: Boolean, val last: Boolean, val forced: Boolean)

  private var pending: Request? = null
  private var playing: Request? = null
  private var offset = 0
  private var forced = false
  private val seen = HashSet<String>()

  val pendingId: String? get() = pending?.id
  val playingId: String? get() = playing?.id

  /** Queues a cue. False when this id was already requested once (never played twice). */
  fun request(id: String, pcm: ShortArray, nowMs: Long, forceAfterMs: Long): Boolean {
    if (!seen.add(id)) return false
    pending = Request(id, pcm, nowMs, nowMs + maxOf(0L, forceAfterMs))
    return true
  }

  /** Drops a cue that has not started (the call is ending, or held). Returns the dropped id. */
  fun dropPending(): String? {
    val id = pending?.id
    pending = null
    return id
  }

  /**
   * Stops a cue mid-play (hold or stop). Returns its id; it is not reported HEARD. With [requeue] (a hold) it waits again,
   * from its beginning, for the next suitable silence after the resume, unless a newer cue is already waiting.
   */
  fun abortPlaying(requeue: Boolean = false): String? {
    val cue = playing ?: return null
    playing = null
    offset = 0
    if (requeue && pending == null) pending = cue
    return cue.id
  }

  /**
   * One 20 ms output slot with no reply packet due. Copies the next slice of the cue into [out] and describes it, or
   * returns null (the slot stays silence).
   *
   * @param qandeelAudible reply audio is queued, booked or was written within the echo window
   * @param msSinceQandeel since the last reply audio was written (Long.MAX_VALUE if never)
   * @param msSinceUserSpeech since the last frame the detector judged speech (Long.MAX_VALUE if never)
   */
  fun nextSlice(nowMs: Long, qandeelAudible: Boolean, msSinceQandeel: Long, msSinceUserSpeech: Long, out: ShortArray): Slice? {
    var first = false
    if (playing == null) {
      val next = pending ?: return null
      if (qandeelAudible || msSinceQandeel < QANDEEL_GAP_MS) return null
      val silent = msSinceUserSpeech >= USER_SILENCE_MS
      if (!silent && nowMs < next.forceAtMs) return null
      playing = next
      pending = null
      offset = 0
      forced = !silent
      first = true
    }
    val cue = playing!!
    val n = minOf(out.size, cue.pcm.size - offset)
    System.arraycopy(cue.pcm, offset, out, 0, n)
    for (i in n until out.size) out[i] = 0
    offset += n
    val last = offset >= cue.pcm.size
    val slice = Slice(cue.id, out.size, first, last, forced)
    if (last) {
      playing = null
      offset = 0
    }
    return slice
  }

  companion object {
    const val USER_SILENCE_MS = 700L
    const val QANDEEL_GAP_MS = 300L

    /**
     * The contract's provider-free fallback (D-05-02): a short tone made here, at 24 kHz. `T5` is two notes, `T1` three,
     * 660 Hz, 140 ms each with 90 ms between, at −20 dBFS, with 10 ms raised-cosine edges (no click). No file, no provider.
     */
    fun tone(kind: String, rate: Int = DownlinkOpusDecoder.RATE): ShortArray {
      val notes = if (kind == "T1") 3 else 2
      val note = rate * 140 / 1000
      val gap = rate * 90 / 1000
      val edge = rate * 10 / 1000
      val amplitude = 32767.0 * Math.pow(10.0, -20.0 / 20.0)
      val out = ShortArray(notes * note + (notes - 1) * gap)
      for (k in 0 until notes) {
        val start = k * (note + gap)
        for (i in 0 until note) {
          val env = when {
            i < edge -> 0.5 - 0.5 * cos(PI * i / edge)
            i >= note - edge -> 0.5 - 0.5 * cos(PI * (note - 1 - i) / edge)
            else -> 1.0
          }
          out[start + i] = (amplitude * env * sin(2 * PI * 660.0 * i / rate)).roundToInt().toShort()
        }
      }
      return out
    }
  }
}
