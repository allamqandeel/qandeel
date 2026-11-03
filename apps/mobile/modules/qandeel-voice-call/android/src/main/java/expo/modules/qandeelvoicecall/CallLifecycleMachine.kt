package expo.modules.qandeelvoicecall

/**
 * S8B-06 CP2 — the ONE native truth of a live call's platform lifecycle (Core-Telecom, the foreground service, the audio
 * engine), as a pure state machine: no Android, no clock, no thread. [LiveCallRegistry] feeds it every platform event and
 * executes exactly the actions it returns, so every end path — the app, the notification's End, the system (Telecom, a
 * Bluetooth or car button), a microphone or engine failure, the service being stopped, the task being removed — goes
 * through ONE latch:
 *
 *   - one call at a time; a machine is never restarted (a new call is a new machine);
 *   - the first end wins: it stops the audio, disconnects Telecom (unless Telecom itself ended the call), stops the service
 *     and reports the end once; every later end, and every late Telecom callback (an activation that lands after the end),
 *     changes nothing but a counter — a late activation only disconnects the call Telecom just made active;
 *   - HELD is a real stop of the microphone and the speaker (another call has the audio), never a "muted" pretence.
 *
 * The server's call authority stays the final word on the call itself (why it ended, from the server's side): this machine
 * owns only the phone's resources. The JS controller (`src/voice-call/live-call-controller.ts`) joins the two.
 */
class CallLifecycleMachine {
  enum class State { IDLE, STARTING, ACTIVE, HELD, ENDING, ENDED }

  /**
   * APP: the app (the person's End, or the server's end relayed by the JS controller). NOTIFICATION: the CallStyle End.
   * SYSTEM: Telecom disconnected the call (a Bluetooth / car / watch button, the system, another call). MICROPHONE /
   * ENGINE: the audio failed. SERVICE: the foreground service was stopped. TASK_REMOVED: the app's task was swiped away.
   * APP_GONE: the JS runtime that owned the call was destroyed. START_FAILED: the call never became active.
   */
  enum class EndSource { APP, NOTIFICATION, SYSTEM, MICROPHONE, ENGINE, SERVICE, TASK_REMOVED, APP_GONE, START_FAILED }

  enum class Action { START_SERVICE, HOLD_AUDIO, RESUME_AUDIO, STOP_AUDIO, DISCONNECT_TELECOM, STOP_SERVICE, REPORT_ACTIVE, REPORT_HELD, REPORT_RESUMED, REPORT_ENDED }

  var state = State.IDLE
    private set
  var endSource: EndSource? = null
    private set
  var endDetail: String? = null
    private set
  /** Ends and callbacks that arrived after the latch closed (content-free, for the proof). */
  var ignoredLate = 0
    private set
  private var serviceStarted = false

  /** IDLE → STARTING. False when this machine already ran (one call per machine, never restarted). */
  fun start(): Boolean {
    if (state != State.IDLE) return false
    state = State.STARTING
    return true
  }

  /** Telecom made the call active (the outgoing call is now the device's call). */
  fun activated(): List<Action> = when (state) {
    State.STARTING -> {
      state = State.ACTIVE
      serviceStarted = true
      listOf(Action.START_SERVICE, Action.REPORT_ACTIVE)
    }
    State.ENDING, State.ENDED -> {
      ignoredLate += 1
      // The call ended while Telecom was still making it active: undo the activation, nothing else (unless Telecom itself
      // ended it: then there is nothing left to disconnect).
      if (endSource == EndSource.SYSTEM) emptyList() else listOf(Action.DISCONNECT_TELECOM)
    }
    else -> {
      ignoredLate += 1
      emptyList()
    }
  }

  /** Telecom (or the audio focus, without Telecom) asks the call to yield the audio: another call has it. */
  fun systemInactive(): List<Action> = when (state) {
    State.ACTIVE -> {
      state = State.HELD
      listOf(Action.HOLD_AUDIO, Action.REPORT_HELD)
    }
    else -> {
      ignoredLate += 1
      emptyList()
    }
  }

  /** The audio is the call's again (the other call ended, or Telecom asked the call to become active). */
  fun systemActive(): List<Action> = when (state) {
    State.HELD -> {
      state = State.ACTIVE
      listOf(Action.RESUME_AUDIO, Action.REPORT_RESUMED)
    }
    else -> {
      ignoredLate += 1
      emptyList()
    }
  }

  /**
   * The one end latch. The first end from any source closes it; [detail] is a content-free code (a Telecom disconnect
   * cause, an engine fault). [SYSTEM] means Telecom already disconnected the call, so it is not disconnected again.
   */
  fun end(source: EndSource, detail: String? = null): List<Action> = when (state) {
    State.IDLE -> {
      state = State.ENDED
      endSource = source
      endDetail = detail
      listOf(Action.REPORT_ENDED)
    }
    State.STARTING, State.ACTIVE, State.HELD -> {
      state = State.ENDING
      endSource = source
      endDetail = detail
      buildList {
        add(Action.STOP_AUDIO)
        if (source != EndSource.SYSTEM) add(Action.DISCONNECT_TELECOM)
        if (serviceStarted) add(Action.STOP_SERVICE)
        add(Action.REPORT_ENDED)
      }
    }
    State.ENDING, State.ENDED -> {
      ignoredLate += 1
      emptyList()
    }
  }

  /** Telecom released the call after the end: nothing of it remains. */
  fun released() {
    if (state == State.ENDING) state = State.ENDED
  }

  val isLive: Boolean get() = state == State.STARTING || state == State.ACTIVE || state == State.HELD
}
