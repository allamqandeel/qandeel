#if os(iOS)
import AVFoundation
import CallKit

/// S8B-06 CP2 (iOS) — the call's audio session, configured the one way a QANDEEL call uses it: `playAndRecord` in
/// `voiceChat` mode (the system's voice-processing path: echo cancellation, the receiver by default), Bluetooth HFP
/// allowed. Under CallKit it is only CONFIGURED here — CallKit activates and deactivates it (`didActivate` /
/// `didDeactivate`); only the simulator's audio-session-only path and the engine's own proof mode activate it themselves.
enum CallAudioSession {
  static func configure(speaker: Bool) throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
    try session.setPreferredIOBufferDuration(0.01)
    if speaker { try? session.overrideOutputAudioPort(.speaker) }
  }

  static var microphoneGranted: Bool {
    if #available(iOS 17.0, *) { return AVAudioApplication.shared.recordPermission == .granted }
    return AVAudioSession.sharedInstance().recordPermission == .granted
  }

  /// The route request (Telecom's endpoints on Android; on iOS the session's override and preferred input).
  static func setRoute(_ route: String) -> Bool {
    let session = AVAudioSession.sharedInstance()
    do {
      switch route {
      case "SPEAKER":
        try session.overrideOutputAudioPort(.speaker)
      case "EARPIECE":
        try session.overrideOutputAudioPort(.none)
        if let mic = session.availableInputs?.first(where: { $0.portType == .builtInMic }) { try session.setPreferredInput(mic) }
      case "BLUETOOTH":
        guard let bt = session.availableInputs?.first(where: { $0.portType == .bluetoothHFP }) else { return false }
        try session.overrideOutputAudioPort(.none)
        try session.setPreferredInput(bt)
      case "WIRED_HEADSET":
        guard let wired = session.availableInputs?.first(where: { $0.portType == .headsetMic }) else { return false }
        try session.overrideOutputAudioPort(.none)
        try session.setPreferredInput(wired)
      default:
        return false
      }
      return true
    } catch {
      return false
    }
  }

  /// The current output as an endpoint type (never a device's name: a Bluetooth name is often a person's).
  static func endpoint() -> String {
    guard let port = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType else { return "UNKNOWN" }
    return endpointType(port)
  }

  static func availableEndpoints() -> [String] {
    var out = ["EARPIECE", "SPEAKER"]
    for input in AVAudioSession.sharedInstance().availableInputs ?? [] {
      if input.portType == .bluetoothHFP { out.append("BLUETOOTH") }
      if input.portType == .headsetMic { out.append("WIRED_HEADSET") }
    }
    var seen = Set<String>()
    return out.filter { seen.insert($0).inserted }
  }

  static func endpointType(_ port: AVAudioSession.Port) -> String {
    switch port {
    case .builtInReceiver: return "EARPIECE"
    case .builtInSpeaker: return "SPEAKER"
    case .headphones, .headsetMic: return "WIRED_HEADSET"
    case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE: return "BLUETOOTH"
    default: return "UNKNOWN"
    }
  }
}

/// Watches the audio session for what CallKit does not report: route changes (a headset unplugged, Bluetooth), the
/// interruptions of a call that is not CallKit's (Siri, an alarm; on the simulator, everything), and a media-services
/// reset (the engine is gone).
final class CallAudioSessionObserver {
  private var observers: [NSObjectProtocol] = []

  init(coordinator: CallCoordinator, uuid: @escaping () -> UUID?, interruptionsAreHolds: Bool) {
    let center = NotificationCenter.default
    let session = AVAudioSession.sharedInstance()
    observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: nil) { _ in
      coordinator.backendRoute(uuid(), endpoint: CallAudioSession.endpoint(), available: CallAudioSession.availableEndpoints())
    })
    observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: nil) { _ in
      coordinator.backendLost(uuid(), detail: "MEDIA_SERVICES_RESET")
    })
    if interruptionsAreHolds {
      observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: nil) { note in
        guard let id = uuid(), let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
          coordinator.backendHeld(id, true, cause: "INTERRUPTION")
        case .ended:
          let options = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map { AVAudioSession.InterruptionOptions(rawValue: $0) } ?? []
          if options.contains(.shouldResume) { coordinator.backendHeld(id, false, cause: "INTERRUPTION_ENDED") }
        @unknown default:
          break
        }
      })
    }
  }

  deinit {
    for o in observers { NotificationCenter.default.removeObserver(o) }
  }
}

/// S8B-06 CP2 (iOS) — CallKit, outgoing calls only (`CXStartCallAction`): no PushKit, no incoming call, no `voip` mode.
/// `includesCallsInRecents = false` (a QANDEEL call never appears in the Phone app's Recents); no video, one call, a
/// generic handle carrying the display name only (never the call id). The audio session is configured at the start
/// action and the audio starts only at `didActivate`.
final class CallKitBackend: NSObject, CallBackend, CXProviderDelegate {
  let kind = "CALLKIT"
  private let provider: CXProvider
  private let controller = CXCallController()
  private weak var coordinator: CallCoordinator?
  private var speaker = false
  private var displayName = ""

  init(displayName: String) {
    let configuration = CXProviderConfiguration()
    configuration.includesCallsInRecents = false
    configuration.supportsVideo = false
    configuration.maximumCallGroups = 1
    configuration.maximumCallsPerCallGroup = 1
    configuration.supportedHandleTypes = [.generic]
    provider = CXProvider(configuration: configuration)
    self.displayName = displayName
    super.init()
    provider.setDelegate(self, queue: nil)
  }

  func bind(_ coordinator: CallCoordinator) { self.coordinator = coordinator }

  func requestStart(uuid: UUID, displayName: String, speaker: Bool) {
    self.speaker = speaker
    self.displayName = displayName
    let action = CXStartCallAction(call: uuid, handle: CXHandle(type: .generic, value: displayName))
    action.isVideo = false
    controller.request(CXTransaction(action: action)) { [weak self] error in
      guard let error else { return }
      // A refused CXStartCallAction (no CallKit here, a call already in progress, the system said no): explicit, never a
      // silent fallback to another path.
      let code = "CALLKIT_UNAVAILABLE_\((error as NSError).code)"
      self?.coordinator?.backendFailed(uuid, code: code)
    }
  }

  func requestEnd(uuid: UUID) {
    controller.request(CXTransaction(action: CXEndCallAction(call: uuid))) { [weak self] error in
      // The system already ended it, or never had it: the latch is closed either way; the release follows.
      if error != nil { self?.coordinator?.backendEnded(uuid, detail: "END_REQUEST_ERROR") }
    }
  }

  func requestUnhold(uuid: UUID) {
    controller.request(CXTransaction(action: CXSetHeldCallAction(call: uuid, onHold: false))) { _ in }
  }

  func setRoute(_ route: String) -> Bool { CallAudioSession.setRoute(route) }

  // ------------------------------------------------------------------ CXProviderDelegate

  func providerDidReset(_ provider: CXProvider) {
    coordinator?.backendLost(nil, detail: "PROVIDER_RESET")
  }

  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    do {
      try CallAudioSession.configure(speaker: speaker)
    } catch {
      action.fail()
      coordinator?.backendFailed(action.callUUID, code: "AUDIO_SESSION_CONFIG_FAILED")
      return
    }
    provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: nil)
    let update = CXCallUpdate()
    update.localizedCallerName = displayName
    update.supportsHolding = true
    update.supportsGrouping = false
    update.supportsUngrouping = false
    update.supportsDTMF = false
    update.hasVideo = false
    provider.reportCall(with: action.callUUID, updated: update)
    action.fulfill()
    provider.reportOutgoingCall(with: action.callUUID, connectedAt: nil)
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    coordinator?.backendEnded(action.callUUID, detail: "CALLKIT_END")
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
    coordinator?.backendHeld(action.callUUID, action.isOnHold, cause: "CALLKIT_HOLD")
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    coordinator?.backendMuted(action.callUUID, action.isMuted)
    action.fulfill()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    guard let call = coordinator?.current else { return }
    let state = call.machine.state
    if state == .HELD { coordinator?.backendHeld(call.uuid, false, cause: "SESSION_REACTIVATED") }
    else { coordinator?.backendActivated(call.uuid) }
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    guard let call = coordinator?.current else { return }
    coordinator?.backendDeactivated(call.uuid)
  }
}

/// The SIMULATOR's path only (`targetEnvironment(simulator)`): CallKit cannot run there, so the audio session is configured
/// and activated directly and the same coordinator events are reported. It is never used on a device.
final class AudioSessionOnlyBackend: CallBackend {
  let kind = "AUDIO_SESSION_ONLY_SIMULATOR"
  private weak var coordinator: CallCoordinator?

  func bind(_ coordinator: CallCoordinator) { self.coordinator = coordinator }

  func requestStart(uuid: UUID, displayName: String, speaker: Bool) {
    do {
      try CallAudioSession.configure(speaker: speaker)
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      coordinator?.backendFailed(uuid, code: "AUDIO_SESSION_ACTIVATE_FAILED")
      return
    }
    DispatchQueue.main.async { [weak self] in self?.coordinator?.backendActivated(uuid) }
  }

  func requestEnd(uuid: UUID) {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    DispatchQueue.main.async { [weak self] in self?.coordinator?.backendEnded(uuid, detail: "SESSION_ENDED") }
  }

  func requestUnhold(uuid: UUID) {
    try? AVAudioSession.sharedInstance().setActive(true)
    DispatchQueue.main.async { [weak self] in self?.coordinator?.backendHeld(uuid, false, cause: "RESUME_REQUESTED") }
  }

  func setRoute(_ route: String) -> Bool { CallAudioSession.setRoute(route) }
}
#endif
