package expo.modules.qandeelvoicecall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** S8B-06 CP1 — the late-packet gate and the heard position (A3.2: recorded heard ≤ actually heard). */
class ReplyLedgerTest {
  private val frames = 480L

  private fun play(ledger: ReplyLedger, turn: Long, chunks: Int, startFrame: Long = 0): Long {
    var frame = startFrame
    for (c in 0 until chunks) {
      assertEquals(ReplyLedger.Admit.ACCEPT, ledger.admit(turn, c.toLong()))
      assertTrue(ledger.booked(turn, c.toLong(), c * 20L, frame, frames))
      frame += frames
    }
    return frame
  }

  @Test
  fun aPacketCountsAsHeardOnlyWhenItsLastFrameWasPresented() {
    val ledger = ReplyLedger()
    play(ledger, 1, 10)
    assertNull("nothing presented", ledger.advance(0))
    assertNull("half a packet is not a packet", ledger.advance(479))
    assertEquals(ReplyLedger.Mark(1, 0, 20), ledger.advance(480))
    assertNull("no movement, no mark", ledger.advance(500))
    assertEquals(ReplyLedger.Mark(1, 3, 80), ledger.advance(4 * 480 + 10))
  }

  @Test
  fun theMarkNeverRunsAheadOfThePresentedPosition() {
    val ledger = ReplyLedger()
    play(ledger, 4, 50)
    var presented = 0L
    var last = 0L
    while (presented < 50 * 480) {
      presented += 137
      ledger.advance(presented)?.let {
        assertTrue("rising", it.playedMs > last)
        assertTrue("never ahead", it.playedMs * 24 <= presented)
        last = it.playedMs
      }
    }
    assertEquals(1000L, last)
  }

  @Test
  fun aCutStrikesWhatWasNotHeardAndRefusesTheRestOfThatReply() {
    val ledger = ReplyLedger()
    play(ledger, 2, 20)
    ledger.advance(5 * 480)
    val final = ledger.cut(2, 7 * 480 + 100)
    assertEquals(ReplyLedger.Mark(2, 6, 140), final)
    assertFalse(ledger.hasUnheard())
    assertNull("the struck packets are presented later at zero volume and never reported", ledger.advance(20 * 480))
    assertEquals(ReplyLedger.Admit.LATE_AFTER_CUT, ledger.admit(2, 20))
    assertEquals(ReplyLedger.Admit.LATE_AFTER_CUT, ledger.admit(1, 0))
    assertFalse(ledger.stillPlayable(2))
    assertFalse("booking a cut reply is refused", ledger.booked(2, 21, 420, 30_000, frames))
    assertEquals(2L, ledger.refusedLate)
  }

  @Test
  fun aCutWithNothingNewHeardKeepsTheLastMark() {
    val ledger = ReplyLedger()
    play(ledger, 3, 5)
    ledger.advance(2 * 480)
    assertNull(ledger.cut(3, 2 * 480 + 5))
    assertEquals(ReplyLedger.Mark(3, 1, 40), ledger.lastMark)
  }

  @Test
  fun repeatsReorderedAndStalePacketsAreRefused() {
    val ledger = ReplyLedger()
    assertEquals(ReplyLedger.Admit.ACCEPT, ledger.admit(5, 0))
    assertEquals(ReplyLedger.Admit.ACCEPT, ledger.admit(5, 1))
    assertEquals(ReplyLedger.Admit.REPEATED_OR_REORDERED, ledger.admit(5, 1))
    assertEquals(ReplyLedger.Admit.ACCEPT, ledger.admit(5, 3))
    assertEquals("a reordered late packet is not played after its successor", ReplyLedger.Admit.REPEATED_OR_REORDERED, ledger.admit(5, 2))
    assertEquals(ReplyLedger.Admit.ACCEPT, ledger.admit(6, 0))
    assertEquals(ReplyLedger.Admit.STALE_REPLY, ledger.admit(5, 4))
    assertEquals(4L, ledger.admitted)
    assertEquals(2L, ledger.refusedRepeated)
    assertEquals(1L, ledger.refusedStale)
  }

  @Test
  fun aCutFinalNeverPairsAnOlderRepliesHeardMarkWithTheReplyCut() {
    // S8B-06 CP3 F-F (device run 5): reply 37 still plays from the queue when reply 38's first packets are admitted (the
    // server closed 37 at the next commit; nothing cut it on the phone), so 38 is the current reply. A barge-in now cuts
    // 38 while what was heard is 37's: 37's chunk 209 must not become 38's final mark (the server never sent 38's chunk
    // 209 and refuses it: PROTOCOL_VIOLATION, 4002).
    val ledger = ReplyLedger()
    val end37 = play(ledger, 37, 300)
    play(ledger, 38, 5, startFrame = end37)
    assertNull("nothing of 38 was heard", ledger.cutFinal(38, 210 * frames))
    assertFalse("neither reply plays on after the cut", ledger.hasUnheard())
    assertEquals(ReplyLedger.Admit.LATE_AFTER_CUT, ledger.admit(38, 5))
  }

  @Test
  fun aCutFinalOfTheReplyHeardIsItsOwnHeardMark() {
    val ledger = ReplyLedger()
    play(ledger, 5, 20)
    assertEquals(ReplyLedger.Mark(5, 9, 200), ledger.cutFinal(5, 10 * frames))
    ledger.advance(0)
    assertEquals("nothing new heard: the last mark of the same reply", ReplyLedger.Mark(5, 9, 200), ledger.cutFinal(5, 10 * frames))
  }

  @Test
  fun theNextReplyAfterACutPlaysAndReportsNormally() {
    val ledger = ReplyLedger()
    val end = play(ledger, 7, 10)
    ledger.cut(7, 3 * 480)
    play(ledger, 8, 4, startFrame = end + 2000)
    assertEquals(ReplyLedger.Mark(8, 3, 80), ledger.advance(end + 2000 + 4 * 480))
  }
}
