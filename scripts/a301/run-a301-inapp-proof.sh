#!/usr/bin/env bash
# A3-01 — the integrated in-app proof of Activity and in-app attention on the production route. VALIDATION ONLY.
#
# usage: bash scripts/a301/run-a301-inapp-proof.sh <apk> <out-dir>
#
# The Release APK's root is the A3-01 proof root: the PRODUCTION phase surface over the production integration runtime,
# given an in-memory identity, a scripted network and the ONE validation-only Activity producer. The matrix (Task
# Contract §21, §24):
#
#   ar-standard / en-standard   Arabic RTL / English LTR, standard phone
#   ar-rtl-device               Arabic on an RTL device (Android's system RTL layout direction)
#   ar-narrow / en-narrow       a 320-class narrow phone (320 dp wide)
#   ar-narrow-large             320 dp at 200 % system text — large text
#   ar-increased                Android high-text-contrast (the app's Increased Contrast)
#   ar-reduced                  launched under Reduce Motion (animator scales 0): the strip fades, never travels
#   en-light                    the Light appearance (General Settings → Appearance), then the same flow
#
# Every run is attempted even when an earlier one fails; the script exits non-zero if ANY failed.
set -u

APK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUT="$2"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
PKG="com.qandeel.mobile"
mkdir -p "$OUT"
cd "$OUT" || exit 1

adb install -r "$APK" || exit 1
status=0

set_motion() {
  for key in animator_duration_scale transition_animation_scale window_animation_scale; do
    adb shell settings put global "$key" "$1"
  done
}

finish() {
  local name="$1"
  adb shell uiautomator dump /sdcard/a301-ui.xml >/dev/null 2>&1 && adb pull /sdcard/a301-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$name.txt" 2>&1 || true
  adb shell am force-stop "$PKG"
}

run() {
  local name="$1" flow="$2"
  echo "::group::$name"
  adb logcat -c || true
  if maestro test --debug-output "$OUT/debug-$name" --test-output-dir "$OUT/shots-$name" -e PREFIX="$name" "$FLOWS/$flow"; then
    echo "PASS $name ($flow)" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name ($flow)" | tee -a "$OUT/results.txt"
    status=1
  fi
  finish "$name"
  echo "::endgroup::"
}

{
  echo "device: $(adb shell getprop ro.product.model) / Android $(adb shell getprop ro.build.version.release) / API $(adb shell getprop ro.build.version.sdk)"
  echo "density: $(adb shell wm density | tr -d '\r')  size: $(adb shell wm size | tr -d '\r')"
} | tee "$OUT/device.txt"

adb shell settings put system font_scale 1.0
adb shell settings put secure high_text_contrast_enabled 0
set_motion 1

adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-standard a3-01-activity.yaml
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-standard a3-01-activity.yaml

adb shell settings put global debug.force_rtl 1
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-rtl-device a3-01-activity.yaml
adb shell settings put global debug.force_rtl 0

adb shell wm size 640x1386
adb shell wm density 320
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-narrow a3-01-activity.yaml
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-narrow a3-01-activity.yaml
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
adb shell settings put system font_scale 2.0
run ar-narrow-large a3-01-activity.yaml
adb shell settings put system font_scale 1.0
adb shell wm size reset
adb shell wm density reset

adb shell settings put secure high_text_contrast_enabled 1
run ar-increased a3-01-activity.yaml
adb shell settings put secure high_text_contrast_enabled 0

set_motion 0
run ar-reduced a3-01-activity.yaml
set_motion 1

adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-light a3-01-light.yaml

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
cat "$OUT/results.txt"
exit $status
