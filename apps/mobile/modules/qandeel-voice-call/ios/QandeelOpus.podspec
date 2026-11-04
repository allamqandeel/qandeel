# S8B-06 CP2 (iOS) — libopus 1.5.2 (xiph.org, BSD-3-Clause), vendored as source (see opus/VENDORED.md): the float build,
# encoder and decoder, no DNN / DRED / OSCE, no SIMD, no assembly. Its Swift module is `COpus`; the shim gives Swift the
# encoder settings the variadic `opus_*_ctl` cannot be called with from Swift.
Pod::Spec.new do |s|
  s.name           = 'QandeelOpus'
  s.version        = '1.5.2'
  s.summary        = 'libopus 1.5.2 for the QANDEEL native call (vendored source).'
  s.description    = 'The Opus codec reference implementation, built from the vendored source, with a small settings shim.'
  s.license        = { :type => 'BSD-3-Clause', :file => 'opus/COPYING' }
  s.author         = 'Xiph.Org Foundation and contributors (see opus/AUTHORS)'
  s.homepage       = 'https://opus-codec.org'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.module_name    = 'COpus'

  s.source_files = 'opus/include/*.h', 'opus/src/*.{c,h}', 'opus/celt/*.{c,h}', 'opus/silk/*.{c,h}', 'opus/silk/float/*.{c,h}', 'opus/silk/fixed/*.h'
  s.public_header_files = 'opus/include/*.h'
  s.preserve_paths = 'opus/COPYING', 'opus/AUTHORS', 'opus/VENDORED.md', 'opus/sources.txt'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) OPUS_BUILD=1 VAR_ARRAYS=1 HAVE_LRINTF=1 HAVE_LRINT=1',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_TARGET_SRCROOT}/opus/include" "${PODS_TARGET_SRCROOT}/opus/celt" "${PODS_TARGET_SRCROOT}/opus/silk" "${PODS_TARGET_SRCROOT}/opus/silk/float" "${PODS_TARGET_SRCROOT}/opus/src" "${PODS_TARGET_SRCROOT}/opus"',
    'GCC_WARN_INHIBIT_ALL_WARNINGS' => 'YES'
  }
end
