/// S8B-06 CP2 (iOS) — the ONE native truth of a live call's platform lifecycle (CallKit, the audio session, the engine),
/// the same machine as the Android `CallLifecycleMachine.kt`, case for case: one call per machine, never restarted; the
/// first end from any source wins and the rest are counted; a late activation after an end only undoes itself; HELD is a
/// real stop of the microphone and the speaker. Pure: no CallKit, no AVFoundation, no clock, no thread.
///
/// iOS's activation is CallKit's `didActivate` (the system handed the call its audio session): audio starts only then.
final class CallLifecycleMachine {
  enum State: String { case IDLE, STARTING, ACTIVE, HELD, ENDING, ENDED }

  /// APP: the app (the person's End, or the server's relayed). SYSTEM: CallKit ended the call (the system call UI, a
  /// Bluetooth / car / watch button, another call). MICROPHONE / ENGINE: the audio failed. SESSION: the audio session was
  /// taken away for good (deactivated with no hold). APP_GONE: the JS runtime went away. START_FAILED: never became active.
  enum EndSource: String { case APP, NOTIFICATION, SYSTEM, MICROPHONE, ENGINE, SESSION, APP_GONE, START_FAILED }

  enum Action: Equatable { case START_AUDIO, HOLD_AUDIO, RESUME_AUDIO, STOP_AUDIO, END_CALLKIT, REPORT_ACTIVE, REPORT_HELD, REPORT_RESUMED, REPORT_ENDED }

  private(set) var state: State = .IDLE
  private(set) var endSource: EndSource?
  private(set) var endDetail: String?
  private(set) var ignoredLate = 0

  func start() -> Bool {
    guard state == .IDLE else { return false }
    state = .STARTING
    return true
  }

  /// CallKit activated the call's audio session (`didActivate`).
  func activated() -> [Action] {
    switch state {
    case .STARTING:
      state = .ACTIVE
      return [.START_AUDIO, .REPORT_ACTIVE]
    case .ENDING, .ENDED:
      ignoredLate += 1
      return endSource == .SYSTEM ? [] : [.END_CALLKIT]
    default:
      ignoredLate += 1
      return []
    }
  }

  /// Another call took the audio (CallKit hold, or an audio-session interruption began).
  func systemInactive() -> [Action] {
    guard state == .ACTIVE else { ignoredLate += 1; return [] }
    state = .HELD
    return [.HOLD_AUDIO, .REPORT_HELD]
  }

  /// The audio is the call's again (CallKit unhold, or the interruption ended).
  func systemActive() -> [Action] {
    guard state == .HELD else { ignoredLate += 1; return [] }
    state = .ACTIVE
    return [.RESUME_AUDIO, .REPORT_RESUMED]
  }

  /// The one end latch. SYSTEM means CallKit already ended the call, so it is not ended again.
  func end(_ source: EndSource, detail: String? = nil) -> [Action] {
    switch state {
    case .IDLE:
      state = .ENDED
      endSource = source
      endDetail = detail
      return [.REPORT_ENDED]
    case .STARTING, .ACTIVE, .HELD:
      state = .ENDING
      endSource = source
      endDetail = detail
      var actions: [Action] = [.STOP_AUDIO]
      if source != .SYSTEM { actions.append(.END_CALLKIT) }
      actions.append(.REPORT_ENDED)
      return actions
    case .ENDING, .ENDED:
      ignoredLate += 1
      return []
    }
  }

  /// CallKit released the call after the end (`didDeactivate`, or the end action completed).
  func released() {
    if state == .ENDING { state = .ENDED }
  }

  var isLive: Bool { state == .STARTING || state == .ACTIVE || state == .HELD }
}
