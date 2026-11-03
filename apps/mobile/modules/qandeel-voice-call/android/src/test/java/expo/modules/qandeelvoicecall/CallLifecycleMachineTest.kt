package expo.modules.qandeelvoicecall

import expo.modules.qandeelvoicecall.CallLifecycleMachine.Action
import expo.modules.qandeelvoicecall.CallLifecycleMachine.EndSource
import expo.modules.qandeelvoicecall.CallLifecycleMachine.State
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** S8B-06 CP2 — one call, one end latch, no restart, no late callback that reopens anything (acceptance A-01…A-05). */
class CallLifecycleMachineTest {
  private fun active(): CallLifecycleMachine = CallLifecycleMachine().also {
    assertTrue(it.start())
    assertEquals(listOf(Action.START_SERVICE, Action.REPORT_ACTIVE), it.activated())
  }

  @Test
  fun aMachineRunsOneCallAndIsNeverRestarted() {
    val m = active()
    assertFalse("a second start on the same machine", m.start())
    m.end(EndSource.APP)
    m.released()
    assertFalse("an ended machine never restarts", m.start())
    assertEquals(State.ENDED, m.state)
  }

  @Test
  fun everyEndSourceClosesTheSameLatchOnce() {
    for (source in EndSource.values()) {
      val m = active()
      val actions = m.end(source, "D")
      assertEquals(source, m.endSource)
      assertEquals("D", m.endDetail)
      assertEquals(Action.STOP_AUDIO, actions.first())
      assertEquals(Action.REPORT_ENDED, actions.last())
      assertTrue("service stopped ($source)", Action.STOP_SERVICE in actions)
      // Telecom is disconnected by every source except Telecom itself.
      assertEquals(source != EndSource.SYSTEM, Action.DISCONNECT_TELECOM in actions)
      for (later in EndSource.values()) assertEquals(emptyList<Action>(), m.end(later))
      assertEquals(EndSource.values().size, m.ignoredLate)
      assertEquals("first end wins", source, m.endSource)
      assertFalse(m.isLive)
    }
  }

  @Test
  fun anEndDuringStartStopsWithoutAServiceAndALateActivationOnlyDisconnects() {
    val m = CallLifecycleMachine()
    assertTrue(m.start())
    val actions = m.end(EndSource.APP)
    assertEquals(listOf(Action.STOP_AUDIO, Action.DISCONNECT_TELECOM, Action.REPORT_ENDED), actions)
    assertEquals("the activation Telecom delivers late undoes itself", listOf(Action.DISCONNECT_TELECOM), m.activated())
    assertEquals(1, m.ignoredLate)
    assertEquals(State.ENDING, m.state)
  }

  @Test
  fun aStartFailureBeforeAnyCallReportsOnce() {
    val m = CallLifecycleMachine()
    assertEquals(listOf(Action.REPORT_ENDED), m.end(EndSource.START_FAILED, "TELECOM_TIMEOUT"))
    assertEquals(State.ENDED, m.state)
    assertFalse(m.start())
  }

  @Test
  fun holdIsARealAudioStopAndResumesOnlyFromHeld() {
    val m = active()
    assertEquals(emptyList<Action>(), m.systemActive())
    assertEquals(listOf(Action.HOLD_AUDIO, Action.REPORT_HELD), m.systemInactive())
    assertEquals(State.HELD, m.state)
    assertEquals("a second inactive is a no-op", emptyList<Action>(), m.systemInactive())
    assertEquals(listOf(Action.RESUME_AUDIO, Action.REPORT_RESUMED), m.systemActive())
    assertEquals(State.ACTIVE, m.state)
  }

  @Test
  fun anEndWhileHeldStopsEverythingAndALateResumeChangesNothing() {
    val m = active()
    m.systemInactive()
    val actions = m.end(EndSource.SYSTEM, "TELECOM_2")
    assertEquals(listOf(Action.STOP_AUDIO, Action.STOP_SERVICE, Action.REPORT_ENDED), actions)
    assertEquals(emptyList<Action>(), m.systemActive())
    assertEquals(emptyList<Action>(), m.systemInactive())
    assertEquals(emptyList<Action>(), m.activated())
    assertEquals(3, m.ignoredLate)
    m.released()
    assertEquals(State.ENDED, m.state)
  }
}
