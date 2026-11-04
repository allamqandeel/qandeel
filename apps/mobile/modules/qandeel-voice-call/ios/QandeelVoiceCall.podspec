# S8B-06 CP2 (iOS) — QANDEEL's native call: the engine (AVAudioEngine voice processing, libopus, the shared decisions of
# `CallEngineCore`), the call (CallKit, outgoing only) and their Expo module. `Core/` is also a SwiftPM package
# (`Package.swift`) so its decisions are tested on the host and on the iOS simulator without the app.
Pod::Spec.new do |s|
  s.name           = 'QandeelVoiceCall'
  s.version        = '1.0.0'
  s.summary        = 'The QANDEEL native call engine and CallKit lifecycle.'
  s.description    = 'Voice-processing capture and playback, Opus, local barge-in, playout marks, warning cues and the CallKit call.'
  s.license        = 'UNLICENSED'
  s.author         = 'QANDEEL'
  s.homepage       = 'https://qandeel.invalid'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'QandeelOpus'
  s.frameworks = 'AVFoundation', 'CallKit'

  s.source_files = 'Core/**/*.swift', 'Expo/**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
