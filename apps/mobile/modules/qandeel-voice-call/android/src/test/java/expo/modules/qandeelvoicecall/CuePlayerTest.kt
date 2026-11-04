package expo.modules.qandeelvoicecall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.sqrt

/** S8B-06 CP2 — the 60-minute warning cue: first suitable silence, the bound, once, no overlap with QANDEEL (acceptance #36). */
class CuePlayerTest {
  private val slot = ShortArray(480)
  private val silent = Long.MAX_VALUE

  private fun drain(p: CuePlayer, now: Long = 0): List<CuePlayer.Slice> {
    val out = ArrayList<CuePlayer.Slice>()
    var t = now
    while (true) {
      val s = p.nextSlice(t, false, silent, silent, slot) ?: break
      out += s
      t += 20
      if (s.last) break
    }
    return out
  }

  @Test
  fun theToneIsTheContractsShapeAndLevel() {
    val t5 = CuePlayer.tone("T5")
    val t1 = CuePlayer.tone("T1")
    assertEquals("T5: 2 x 140 ms + 90 ms at 24 kHz", 2 * 3360 + 2160, t5.size)
    assertEquals("T1: 3 x 140 ms + 2 x 90 ms", 3 * 3360 + 2 * 2160, t1.size)
    assertEquals("raised-cosine edge starts at zero", 0, t5[0].toInt())
    for (i in 3360 until 3360 + 2160) assertEquals("the gap is silence", 0, t5[i].toInt())
    val peak = t5.maxOf { abs(it.toInt()) }
    val dbfs = 20 * log10(peak / 32767.0)
    assertTrue("peak ≈ −20 dBFS ($dbfs)", dbfs in -20.2..-19.8)
    // The middle of a note is a steady 660 Hz sine: RMS = peak / √2.
    var sum = 0.0
    for (i in 600 until 2760) sum += t5[i].toDouble() * t5[i]
    val rms = sqrt(sum / 2160)
    assertTrue(abs(rms - peak / sqrt(2.0)) < peak * 0.02)
  }

  @Test
  fun aCueWaitsForTheFirstSuitableSilence() {
    val p = CuePlayer()
    assertTrue(p.request("T5", CuePlayer.tone("T5"), 0, 60_000))
    assertNull("QANDEEL audible", p.nextSlice(0, true, 0, silent, slot))
    assertNull("QANDEEL just stopped", p.nextSlice(0, false, CuePlayer.QANDEEL_GAP_MS - 1, silent, slot))
    assertNull("the person is talking", p.nextSlice(0, false, silent, 0, slot))
    assertNull("the person paused too briefly", p.nextSlice(0, false, silent, CuePlayer.USER_SILENCE_MS - 1, slot))
    val first = p.nextSlice(0, false, CuePlayer.QANDEEL_GAP_MS, CuePlayer.USER_SILENCE_MS, slot)
    assertNotNull(first)
    assertTrue(first!!.first)
    assertFalse("a natural silence is not forced", first.forced)
  }

  @Test
  fun theBoundForcesOverThePersonButNeverOverQandeel() {
    val p = CuePlayer()
    p.request("T1", CuePlayer.tone("T1"), 1_000, 5_000)
    assertNull("before the bound, speech holds it", p.nextSlice(5_999, false, silent, 0, slot))
    assertNull("after the bound, QANDEEL still holds it", p.nextSlice(6_000, true, 0, 0, slot))
    val s = p.nextSlice(6_000, false, silent, 0, slot)!!
    assertTrue(s.first && s.forced)
  }

  @Test
  fun aStartedCuePlaysToItsEndAndIsNeverPlayedTwice() {
    val p = CuePlayer()
    val pcm = CuePlayer.tone("T5")
    p.request("T5", pcm, 0, 0)
    val slices = drain(p)
    assertEquals((pcm.size + 479) / 480, slices.size)
    assertTrue(slices.first().first && slices.last().last)
    assertEquals(1, slices.count { it.first })
    // Once started, QANDEEL becoming audible or the person speaking does not cut it: the player keeps giving slices.
    assertFalse("the same id again", p.request("T5", pcm, 0, 0))
    assertNull(p.nextSlice(0, false, silent, silent, slot))
  }

  @Test
  fun aNewerCueReplacesOnePendingAndAHoldRequeuesTheOnePlaying() {
    val p = CuePlayer()
    p.request("T5", CuePlayer.tone("T5"), 0, 60_000)
    p.request("T1", CuePlayer.tone("T1"), 0, 60_000)
    assertEquals("T1 supersedes a T-5 still waiting", "T1", p.pendingId)
    val s = p.nextSlice(0, false, silent, silent, slot)!!
    assertEquals("T1", s.id)
    assertEquals("a hold aborts the cue mid-play", "T1", p.abortPlaying(requeue = true))
    assertEquals("and it waits again", "T1", p.pendingId)
    val again = drain(p)
    assertTrue("from its beginning", again.first().first)
    assertEquals("T1", again.last().id)
    assertNull(p.playingId)
  }

  @Test
  fun anEndDropsEverything() {
    val p = CuePlayer()
    p.request("T5", CuePlayer.tone("T5"), 0, 0)
    p.nextSlice(0, false, silent, silent, slot)
    assertEquals("T5", p.abortPlaying())
    assertNull("no requeue on stop", p.pendingId)
    p.request("T1", CuePlayer.tone("T1"), 0, 0)
    assertEquals("T1", p.dropPending())
    assertNull(p.nextSlice(0, false, silent, silent, slot))
  }
}
