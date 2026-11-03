package expo.modules.qandeelvoicecall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** S8B-06 CP2 — the warning's local trigger and its dedup: once per id, T-5 never after T-1, an end forgets (acceptance #36). */
class CueScheduleTest {
  @Test
  fun aScheduledCueFiresOnceAtItsTimeAndAMovedTimeWins() {
    val s = CueSchedule()
    assertEquals("SCHEDULED", s.schedule("T5", "T5", 10_000, 30_000))
    assertEquals("a resume reschedules it", "SCHEDULED", s.schedule("T5", "T5", 12_000, 30_000))
    assertEquals(emptyList<String>(), s.due(11_999).map { it.id })
    val due = s.due(12_000)
    assertEquals(listOf("T5"), due.map { it.id })
    assertEquals(30_000L, due[0].forceAfterMs)
    assertEquals("forgotten once handed back", emptyList<String>(), s.due(99_999).map { it.id })
  }

  @Test
  fun anIdAskedForOnceIsRepeatedForever() {
    val s = CueSchedule()
    assertNull(s.admit("T5", "T5"))
    s.asked("T5", "T5")
    assertEquals("REPEATED", s.admit("T5", "T5"))
    assertEquals("a schedule after the server's CALL_ENDING played it", "REPEATED", s.schedule("T5", "T5", 0, 0))
    assertEquals(0, s.waiting)
  }

  @Test
  fun aT5NeverPlaysAfterAT1() {
    val s = CueSchedule()
    s.schedule("T5", "T5", 10_000, 0)
    assertNull(s.admit("T1", "T1"))
    s.asked("T1", "T1")
    assertEquals("SUPERSEDED", s.schedule("T5", "T5", 10_000, 0))
    assertEquals("SUPERSEDED", s.admit("T5", "T5"))
  }

  @Test
  fun dueCuesComeInTimeOrderAndAPlayedOneLeavesTheSchedule() {
    val s = CueSchedule()
    s.schedule("T1", "T1", 2_000, 0)
    s.schedule("T5", "T5", 1_000, 0)
    assertEquals(listOf("T5", "T1"), s.due(5_000).map { it.id })
    s.schedule("T5", "T5", 9_000, 0)
    assertNull("playing it now forgets its schedule", s.admit("T5", "T5"))
    assertEquals(0, s.waiting)
  }

  @Test
  fun anEndForgetsWhatWaits() {
    val s = CueSchedule()
    s.schedule("T5", "T5", 1_000, 0)
    s.schedule("T1", "T1", 2_000, 0)
    assertEquals(listOf("T5", "T1"), s.clear())
    assertEquals(emptyList<String>(), s.due(Long.MAX_VALUE).map { it.id })
  }
}
