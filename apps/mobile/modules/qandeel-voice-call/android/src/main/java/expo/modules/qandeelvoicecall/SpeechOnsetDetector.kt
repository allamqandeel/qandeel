package expo.modules.qandeelvoicecall

import kotlin.math.min

/**
 * S8B-06 CP1 — the phone's speech-onset detector for LOCAL barge-in only (contract v1.0 §5.1 / §5.2 step 1).
 *
 * It runs on the capture thread, on every 20 ms frame of the signal the platform delivers AFTER its echo canceller
 * (`VOICE_COMMUNICATION` + `AcousticEchoCanceler`), so it judges the post-AEC signal — never a JS poll, never the raw mic.
 * An onset is declared when [VadConfig.onsetFrames] consecutive frames (10 × 20 ms = the contract's 200 ms) are speech;
 * one non-speech frame resets the run, so the 200 ms are continuous. The onset's capture instant is the FIRST frame of the
 * run (where the person started), and the detection instant is the frame that completes the run.
 *
 * A frame is speech when it is all of:
 *   1. above the tracked noise floor by [VadConfig.floorMarginDb] (the floor falls at once and rises slowly);
 *   2. above an absolute level [VadConfig.absoluteMinDb] (silence and hiss never count);
 *   3. while QANDEEL is audible, within [VadConfig.echoGuardDb] of the reference level (the loudest reply audio written in
 *      the recent echo window): a residual echo that the canceller left is far below the reference, a person talking into
 *      the phone is not. This is the "controlled tuning" the execution task allows, and it is a configuration, not a law.
 *
 * Ending the person's turn is NOT this detector's: the server's VAD owns that (contract §5.1). Pure: no Android, no clock.
 */
data class VadConfig(
  val onsetFrames: Int = 10,
  val floorMarginDb: Double = 10.0,
  val absoluteMinDb: Double = -50.0,
  val echoGuardDb: Double = -18.0,
  /** How fast the floor may rise, per 20 ms frame (0.02 dB = 1 dB per second). */
  val floorRisePerFrameDb: Double = 0.02,
  val floorInitialDb: Double = -70.0,
)

class SpeechOnsetDetector(private val config: VadConfig = VadConfig()) {
  enum class Kind { NONE, ONSET }

  data class Decision(val kind: Kind, val onsetCaptureMs: Long, val speechFrame: Boolean)

  var floorDb: Double = config.floorInitialDb
    private set
  private var run = 0
  private var runStartMs = 0L
  private var declared = false

  /**
   * @param frameDb the frame's RMS level in dBFS (post-AEC capture)
   * @param refDb the reference level in dBFS while QANDEEL is audible, or null when it is not
   * @param captureMs the frame's capture-clock instant (a multiple of 20)
   */
  fun push(frameDb: Double, refDb: Double?, captureMs: Long): Decision {
    val aboveFloor = frameDb >= floorDb + config.floorMarginDb
    val aboveAbsolute = frameDb >= config.absoluteMinDb
    val aboveEcho = refDb == null || frameDb >= refDb + config.echoGuardDb
    val speech = aboveFloor && aboveAbsolute && aboveEcho
    // The floor follows the quiet frames only: down at once, up slowly.
    floorDb = if (frameDb < floorDb) frameDb else if (!speech) min(frameDb, floorDb + config.floorRisePerFrameDb) else floorDb
    if (!speech) {
      run = 0
      declared = false
      return Decision(Kind.NONE, -1, false)
    }
    if (run == 0) runStartMs = captureMs
    run += 1
    if (!declared && run >= config.onsetFrames) {
      declared = true
      return Decision(Kind.ONSET, runStartMs, true)
    }
    return Decision(Kind.NONE, -1, true)
  }

  fun reset() {
    floorDb = config.floorInitialDb
    run = 0
    declared = false
  }

  companion object {
    /** RMS of 16-bit PCM in dBFS; digital silence is -120. */
    fun levelDb(pcm: ShortArray, count: Int): Double {
      if (count <= 0) return -120.0
      var sum = 0.0
      for (i in 0 until count) {
        val v = pcm[i].toDouble()
        sum += v * v
      }
      val rms = Math.sqrt(sum / count) / 32768.0
      return if (rms <= 1e-6) -120.0 else 20.0 * Math.log10(rms)
    }
  }
}
