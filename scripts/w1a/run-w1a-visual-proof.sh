#!/usr/bin/env bash
# W1A-01 — run the visual-proof flow four times on the emulator: English, Arabic, Arabic at the
# largest system text size, and Arabic under Reduced Motion. VALIDATION ONLY.
#
# usage: bash scripts/w1a/run-w1a-visual-proof.sh <apk> <out-dir>
#
# Every run is attempted even when an earlier one fails, so one flaky run cannot hide the others'
# evidence; the script exits non-zero if ANY run failed. Each run records its screenshots, its screen
# recording, Maestro's debug output, a UI-hierarchy dump of the final screen and its logcat.
set -u

APK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUT="$2"
REPO="$(pwd)"
FLOW="$REPO/apps/mobile/.maestro/w1a-01-proof.yaml"
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

run() {
  local name="$1"; shift
  echo "::group::$name"
  adb logcat -c || true
  if maestro test --debug-output "$OUT/debug-$name" -e PREFIX="$name" "$@" "$FLOW"; then
    echo "PASS $name" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name" | tee -a "$OUT/results.txt"
    status=1
  fi
  adb shell uiautomator dump /sdcard/w1a-ui.xml >/dev/null 2>&1 && adb pull /sdcard/w1a-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$name.txt" 2>&1 || true
  adb shell am force-stop "$PKG"
  echo "::endgroup::"
}

{
  echo "device: $(adb shell getprop ro.product.model) / Android $(adb shell getprop ro.build.version.release) / API $(adb shell getprop ro.build.version.sdk)"
  echo "density: $(adb shell wm density | tr -d '\r')  size: $(adb shell wm size | tr -d '\r')"
} | tee "$OUT/device.txt"

# A — English, standard motion, default text size.
set_motion 1
adb shell settings put system font_scale 1.0
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-standard -e TYPED_ONE="I think I need a plan." -e TYPED_TWO="Maybe start with the report."

# B — Arabic, standard motion.
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-standard -e TYPED_ONE="Q3 report is late" -e TYPED_TWO="Start with the report"

# C — Arabic at the largest system text size this Android offers.
adb shell settings put system font_scale 2.0
run ar-large-text -e TYPED_ONE="Q3 report is late" -e TYPED_TWO="Start with the report"
adb shell settings put system font_scale 1.0

# D — Arabic under Reduced Motion ("Remove animations": every animation scale at zero).
set_motion 0
run ar-reduced-motion -e TYPED_ONE="Q3 report is late" -e TYPED_TWO="Start with the report"
set_motion 1

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
exit $status
