package expo.modules.qandeelvoicecall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * S8B-07 RB-2 / M-2 (CP3) — the capture-clock marker: the first frame captured at least 100 ms after the mark, never an
 * earlier one; no echo before a segment's timestamps are stable; a hold answers NOCLOCK at once; a resume re-establishes
 * the reference from the new segment only (never by continuing the pre-hold frame index); every mark answered once.
 */
class CaptureClockMarkerTest {
  private val ms = 1_000_000L

  /** A simulated microphone: frame k of a segment is captured at [t0] + 20 ms·k and read [latencyNs] later. */
  private class Mic(var t0: Long, var captureMs0: Long, val latencyNs: Long = 30_000_000L) {
    var k = 0L
    fun captureMs() = captureMs0 + 20 * k
    fun timeNs() = t0 + 20_000_000L * k
    fun readNs() = timeNs() + 20_000_000L + latencyNs
  }

  private fun feed(m: CaptureClockMarker, mic: Mic, frames: Int, stamp: (Mic) -> Long = { it.timeNs() }): List<CaptureClockMarker.Echo> {
    val out = ArrayList<CaptureClockMarker.Echo>()
    repeat(frames) {
      out += m.frame(mic.captureMs(), stamp(mic), mic.readNs())
      mic.k += 1
    }
    return out
  }

  @Test
  fun steadyStateAnswersTheFirstFrameCapturedAtLeastTheMarginAfterTheMark() {
    val m = CaptureClockMarker()
    val mic = Mic(t0 = 1_000 * ms, captureMs0 = 0)
    m.segmentStart()
    feed(m, mic, 20)
    assertTrue(m.isStable())
    val receipt = mic.readNs() + 3 * ms // the mark arrives just after frame 20 was read
    assertTrue(m.mark(1, receipt))
    val echoes = feed(m, mic, 20)
    assertEquals(1, echoes.size)
    val echo = echoes[0]
    assertEquals(1L, echo.token)
    val frame = (echo.captureMs!! - 0) / 20
    val captured = 1_000 * ms + 20 * ms * frame
    assertTrue("never earlier than receipt + 100 ms", captured >= receipt + CaptureClockMarker.MARGIN_NS)
    assertTrue("the FIRST such frame", captured - 20 * ms < receipt + CaptureClockMarker.MARGIN_NS)
    assertEquals(0L, echo.captureMs!! % 20)
  }

  @Test
  fun noEchoUntilTheStartUpTimestampsAreStable() {
    val m = CaptureClockMarker()
    val mic = Mic(t0 = 5_000 * ms, captureMs0 = 0)
    m.segmentStart()
    // The start-up HAL: no timestamp, then timestamps that jump by 30 ms each frame.
    assertTrue(m.mark(7, mic.timeNs()))
    assertEquals(emptyList<CaptureClockMarker.Echo>(), feed(m, mic, 5) { -1L })
    assertEquals(emptyList<CaptureClockMarker.Echo>(), feed(m, mic, 8) { it.timeNs() - 30 * ms * (it.k % 2) })
    assertFalse(m.isStable())
    // The last jumping frame (k = 12) starts a consistent run: nine frames later it is ten long.
    val echoes = feed(m, mic, 8)
    assertEquals("nine consistent frames are not yet stable", emptyList<CaptureClockMarker.Echo>(), echoes)
    val after = feed(m, mic, 1)
    assertEquals(1, after.size)
    assertTrue(m.isStable())
    assertEquals("the first stable frame, later than the true first frame — never earlier", 21 * 20L, after[0].captureMs)
  }

  @Test
  fun aMissingTimestampRestartsStabilityAndAPendingMarkWaitsOrExpires() {
    val m = CaptureClockMarker()
    val mic = Mic(t0 = 0, captureMs0 = 1000)
    m.segmentStart()
    feed(m, mic, 15)
    val receipt = mic.readNs()
    assertTrue(m.mark(1, receipt))
    // Timestamps vanish across the target: nothing is answered from a frame without one.
    assertEquals(emptyList<CaptureClockMarker.Echo>(), feed(m, mic, 10) { -1L })
    assertFalse(m.isStable())
    val echoes = feed(m, mic, 10)
    assertEquals(1, echoes.size)
    val frame = (echoes[0].captureMs!! - 1000) / 20
    assertEquals("answered at the 10th stable frame after the gap", 34L, frame)
    assertTrue(20 * ms * frame >= receipt + CaptureClockMarker.MARGIN_NS)
    // A gap longer than the pending limit: NOCLOCK, once.
    assertTrue(m.mark(2, mic.readNs()))
    val gone = feed(m, mic, 120) { -1L }
    assertEquals(listOf(CaptureClockMarker.Echo(2, null)), gone)
    assertEquals(0, m.pendingCount())
  }

  @Test
  fun implausibleTimestampsNeverCertify() {
    val m = CaptureClockMarker()
    val mic = Mic(t0 = 10_000 * ms, captureMs0 = 0)
    m.segmentStart()
    assertTrue(m.mark(1, mic.timeNs()))
    // A position space that reset (the frame "captured" after it was read), and one far too old: never stable.
    assertEquals(emptyList<CaptureClockMarker.Echo>(), feed(m, mic, 40) { it.readNs() + 50 * ms })
    assertEquals(emptyList<CaptureClockMarker.Echo>(), feed(m, mic, 40) { it.readNs() - 900 * ms })
    assertFalse(m.isStable())
  }

  @Test
  fun aHoldAnswersEveryPendingMarkNoclockAndRefusesNewOnes() {
    val m = CaptureClockMarker()
    val mic = Mic(t0 = 0, captureMs0 = 0)
    m.segmentStart()
    feed(m, mic, 20)
    assertTrue(m.mark(1, mic.readNs()))
    assertTrue(m.mark(2, mic.readNs()))
    assertEquals(listOf(CaptureClockMarker.Echo(1, null), CaptureClockMarker.Echo(2, null)), m.invalidate())
    assertFalse("held: the caller answers NOCLOCK", m.mark(3, mic.readNs()))
    assertEquals("a frame read across the hold certifies nothing", emptyList<CaptureClockMarker.Echo>(), feed(m, mic, 30))
    assertEquals(emptyList<CaptureClockMarker.Echo>(), m.invalidate())
  }

  @Test
  fun aResumeReEstablishesTheReferenceFromTheNewSegmentOnly() {
    val m = CaptureClockMarker()
    val mic = Mic(t0 = 0, captureMs0 = 0)
    m.segmentStart()
    feed(m, mic, 50)
    m.invalidate()
    // Held 3.21 s: the capture clock continues after the held time (rounded up), the new segment's frames are captured
    // from the resume instant. The pre-hold index would have said captureMs 1000 at 1000 ms — a false position.
    val resumeAt = mic.timeNs() + 3_210 * ms
    val continueAt = mic.captureMs() + 3_220
    mic.t0 = resumeAt; mic.captureMs0 = continueAt; mic.k = 0
    m.segmentStart()
    assertFalse("not stable at the first frame of the new segment", m.isStable())
    assertTrue(m.mark(9, resumeAt))
    val echoes = feed(m, mic, 30)
    assertEquals(1, echoes.size)
    val frame = (echoes[0].captureMs!! - continueAt) / 20
    assertTrue("in the new segment's clock, not the pre-hold index", echoes[0].captureMs!! >= continueAt)
    assertTrue("never earlier than the margin", resumeAt + 20 * ms * frame >= resumeAt + CaptureClockMarker.MARGIN_NS)
    assertTrue("only once stable in the new segment", frame >= CaptureClockMarker.STABLE_FRAMES - 1)
  }

  @Test
  fun aFrameThatLooksLikeThePreHoldClockDoesNotCarryStabilityOver() {
    val m = CaptureClockMarker()
    val mic = Mic(t0 = 0, captureMs0 = 0)
    m.segmentStart()
    feed(m, mic, 30)
    assertTrue(m.isStable())
    m.invalidate()
    m.segmentStart()
    // The very next frame continues the old clock perfectly (index and time): still a new segment, not yet stable.
    feed(m, mic, 1)
    assertFalse(m.isStable())
  }

  @Test
  fun repeatedHoldResumeDuplicateAndDelayedMarksAreEachAnsweredOnceAndNeverEarly() {
    val rnd = Random(20261124)
    val m = CaptureClockMarker()
    var t = 0L
    var captureMs = 0L
    val asked = HashMap<Long, Long>() // token → target
    val answered = HashMap<Long, Long?>()
    val time = HashMap<Long, Long>() // captureMs → the instant its frame was captured
    var token = 0L
    var held = false
    m.segmentStart()
    repeat(20_000) {
      when {
        !held && rnd.nextInt(800) == 0 -> {
          held = true
          for (e in m.invalidate()) {
            assertFalse(answered.containsKey(e.token))
            answered[e.token] = e.captureMs
          }
        }
        held && rnd.nextInt(50) == 0 -> {
          held = false
          val heldNs = (rnd.nextLong(1, 400)) * 10 * ms
          t += heldNs
          captureMs += ((heldNs + 20 * ms - 1) / (20 * ms)) * 20
          m.segmentStart()
        }
      }
      if (rnd.nextInt(40) == 0) {
        // A mark (sometimes two at once: a duplicate delivery), received now.
        repeat(if (rnd.nextInt(5) == 0) 2 else 1) {
          token += 1
          val receipt = t + rnd.nextLong(0, 20) * ms
          if (m.mark(token, receipt)) asked[token] = receipt + CaptureClockMarker.MARGIN_NS else answered[token] = null
        }
      }
      if (!held) {
        val stamp = when (rnd.nextInt(100)) {
          0 -> -1L
          1 -> t + 40 * ms // a glitch: implausible
          else -> t + rnd.nextLong(-1, 2) * ms
        }
        time[captureMs] = t
        for (e in m.frame(captureMs, stamp, t + 20 * ms + 25 * ms)) {
          assertFalse("token ${e.token} answered twice", answered.containsKey(e.token))
          answered[e.token] = e.captureMs
        }
        captureMs += 20
      }
      t += 20 * ms
    }
    for (e in m.invalidate()) answered[e.token] = e.captureMs
    assertEquals("every mark answered exactly once", token, answered.size.toLong())
    var certified = 0
    for ((tok, echo) in answered) {
      if (echo == null) continue
      certified += 1
      // The stamp may be off by 1 ms either way; the jitter tolerance is 5 ms — the margin absorbs both.
      assertTrue("token $tok echo $echo is never captured before its mark", time.getValue(echo) + 1 * ms >= asked.getValue(tok))
    }
    assertTrue("most marks are certified", certified > token / 2)
  }

  @Test
  fun aBoundedNumberOfMarksWait() {
    val m = CaptureClockMarker()
    m.segmentStart()
    repeat(CaptureClockMarker.MAX_PENDING) { assertTrue(m.mark(it.toLong(), 0)) }
    assertFalse(m.mark(99, 0))
    assertFalse("not started", CaptureClockMarker().mark(1, 0))
  }

  @Test
  fun pickTakesTheEarlierPlausibleReadingOfTheTimestamp() {
    // Device proof 2026-11-24: the HONOR's capture position restarts with the microphone after a hold, so the samples read
    // since the recording started place every post-resume frame in the future (implausible) and certify nothing.
    val m = CaptureClockMarker()
    val read = 10_000 * ms
    val truth = read - 50 * ms
    assertEquals("a restarting position: the segment reading", truth, m.pick(truth, truth + 5_000 * ms, read))
    assertEquals("a continuing position: the recording reading", truth, m.pick(truth - 5_000 * ms, truth, read))
    assertEquals("both plausible: the earlier one (an early instant only ever answers later)", truth - 200 * ms, m.pick(truth - 200 * ms, truth, read))
    assertEquals("neither plausible", -1L, m.pick(read + 100 * ms, read + 200 * ms, read))
    assertEquals("one reading (the first segment)", truth, m.pick(truth, truth, read))
  }

  @Test
  fun afterAResumeOnARestartingPositionTheSegmentReadingCertifiesAgain() {
    val m = CaptureClockMarker()
    m.segmentStart()
    val mic = Mic(t0 = 1_000 * ms, captureMs0 = 0)
    feed(m, mic, 50) // 1 s read before the hold
    val preHoldSamples = 50 * 320L
    m.invalidate()
    // held 2 s; the platform position restarts at 0 with the microphone, the capture clock continues after the held time
    val mic2 = Mic(t0 = mic.timeNs() + 2_000 * ms, captureMs0 = mic.captureMs() + 2_000)
    m.segmentStart()
    val recordingReading = { x: Mic -> x.timeNs() + preHoldSamples * 1_000_000_000L / 16_000 }
    assertTrue(m.mark(7, mic2.t0))
    val echoes = feed(m, mic2, 20) { x -> m.pick(x.timeNs(), recordingReading(x), x.readNs()) }
    assertEquals(1, echoes.size)
    val e = echoes.single()
    assertEquals(7L, e.token)
    // stable at the segment's 10th consistent frame (k = 9, captured 180 ms in, past the mark + 100 ms): never earlier
    assertEquals(mic2.captureMs0 + 9 * 20, e.captureMs)
  }
}
