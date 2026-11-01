# S8B-03 (CP2, OD-6) — the local iOS module that marks the Voice Note draft files as excluded from device backup.
Pod::Spec.new do |s|
  s.name           = 'QandeelBackupExclusion'
  s.version        = '1.0.0'
  s.summary        = 'Marks QANDEEL Voice Note drafts as excluded from device backup.'
  s.description    = 'Sets and reads NSURLIsExcludedFromBackupKey on the Voice Note draft folders and files.'
  s.license        = 'UNLICENSED'
  s.author         = 'QANDEEL'
  s.homepage       = 'https://qandeel.invalid'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
