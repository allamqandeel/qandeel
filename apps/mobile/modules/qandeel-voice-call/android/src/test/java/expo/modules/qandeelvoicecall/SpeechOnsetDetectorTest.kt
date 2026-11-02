package expo.modules.qandeelvoicecall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** S8B-06 CP1 — the 200 ms continuous onset after AEC, the echo guard, the floor. */
class SpeechOnsetDetectorTest {
  private fun quiet(detector: SpeechOnsetDetector, frames: Int, startMs: Long = 0, db: Double = -65.0): Long {
    var ms = startMs
    repeat(frames) {
      detector.push(db, null, ms)
      ms += 20
    }
    return ms
  }

  @Test
  fun nineFramesOfSpeechAreNotAnOnsetButTenAre() {
    val d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    repeat(9) {
      assertEquals(SpeechOnsetDetector.Kind.NONE, d.push(-30.0, null, ms).kind)
      ms += 20
    }
    val tenth = d.push(-30.0, null, ms)
    assertEquals(SpeechOnsetDetector.Kind.ONSET, tenth.kind)
    assertEquals("the onset is the first frame of the run", 1000L, tenth.onsetCaptureMs)
  }

  @Test
  fun oneQuietFrameResetsTheRunSoThe200msAreContinuous() {
    val d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    repeat(8) { d.push(-30.0, null, ms); ms += 20 }
    d.push(-66.0, null, ms); ms += 20
    repeat(9) { assertEquals(SpeechOnsetDetector.Kind.NONE, d.push(-30.0, null, ms).kind); ms += 20 }
    assertEquals(SpeechOnsetDetector.Kind.ONSET, d.push(-30.0, null, ms).kind)
  }

  @Test
  fun oneOnsetPerRun() {
    val d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    var onsets = 0
    repeat(100) { if (d.push(-30.0, null, ms).kind == SpeechOnsetDetector.Kind.ONSET) onsets += 1; ms += 20 }
    assertEquals(1, onsets)
  }

  @Test
  fun residualEchoFarBelowTheReferenceNeverTriggers() {
    val d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    var onsets = 0
    // QANDEEL at -12 dBFS; the canceller leaves -38 dBFS: loud against the floor, 26 dB under the reference.
    repeat(500) { if (d.push(-38.0, -12.0, ms).kind == SpeechOnsetDetector.Kind.ONSET) onsets += 1; ms += 20 }
    assertEquals(0, onsets)
  }

  @Test
  fun aPersonTalkingOverQandeelIsDetected() {
    val d = SpeechOnsetDetector()
    var ms = quiet(d, 50)
    repeat(50) { d.push(-38.0, -12.0, ms); ms += 20 }
    var onset: SpeechOnsetDetector.Decision? = null
    var at = 0L
    repeat(12) {
      val decision = d.push(-22.0, -12.0, ms)
      if (decision.kind == SpeechOnsetDetector.Kind.ONSET && onset == null) { onset = decision; at = ms }
      ms += 20
    }
    assertTrue(onset != null)
    assertEquals("detected on the 10th frame", onset!!.onsetCaptureMs + 180, at)
  }

  @Test
  fun hissBelowTheAbsoluteLevelIsNeverSpeech() {
    val d = SpeechOnsetDetector()
    var ms = quiet(d, 50, db = -90.0)
    var onsets = 0
    repeat(200) { if (d.push(-55.0, null, ms).kind == SpeechOnsetDetector.Kind.ONSET) onsets += 1; ms += 20 }
    assertEquals(0, onsets)
  }

  @Test
  fun theFloorRisesSlowlyAndFallsAtOnce() {
    val d = SpeechOnsetDetector()
    quiet(d, 10, db = -60.0)
    assertEquals(-69.8, d.floorDb, 1e-9)
    d.push(-80.0, null, 1000)
    assertEquals(-80.0, d.floorDb, 1e-9)
    d.push(-60.0, null, 1020)
    assertEquals("rises by 0.02 dB a frame", -79.98, d.floorDb, 1e-9)
  }

  @Test
  fun levelOfFullScaleSquareIsZeroDb() {
    val pcm = ShortArray(320) { if (it % 2 == 0) 32767 else -32767 }
    assertEquals(0.0, SpeechOnsetDetector.levelDb(pcm, pcm.size), 0.01)
    assertEquals(-120.0, SpeechOnsetDetector.levelDb(ShortArray(320), 320), 0.0)
  }
}
