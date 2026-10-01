#!/usr/bin/env bash
# VPORT-01 — the production visual proof of the final Living Analysis World. VALIDATION ONLY.
#
# usage: bash scripts/vport01/run-vport01-visual-proof.sh <apk> <out-dir>
#
# The Release APK's root is the VPORT-01 proof root: the PRODUCTION phase surface over the production
# integration runtime, given an in-memory identity and a scripted network. Every capture is the shipped
# Skia world on the device. The matrix:
#
#   ar-standard      Arabic, standard contrast: FAR, MID, NEAR, NEAR + selected, the ungeographic register
#   en-standard      the same in English
#   ar-increased     Arabic under the platform's increased contrast (Android high-text-contrast)
#   ar-reduced       Arabic under Reduce Motion (animator scales 0): the settled parity captures
#   ar-narrow        Arabic on a narrow phone (360 dp wide)
#   ar-landscape     Arabic, landscape (T-11 recomposes; the world is the same world)
#   travel-standard  one recording of FAR → MID → NEAR → MID → FAR with frame statistics
#   travel-reduced   the same under Reduce Motion (the cut-and-resolve)
#
# After each run the device's final UI hierarchy and logcat are kept. Every run is attempted
# even when an earlier one fails; the script exits non-zero if ANY failed.
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

run() {
  local name="$1" flow="$2"
  echo "::group::$name"
  adb logcat -c || true
  if maestro test --debug-output "$OUT/debug-$name" --test-output-dir "$OUT/shots-$name" -e PREFIX="$name" "$FLOWS/$flow"; then
    echo "PASS $name" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name" | tee -a "$OUT/results.txt"
    status=1
  fi
  adb shell uiautomator dump /sdcard/vport01-ui.xml >/dev/null 2>&1 && adb pull /sdcard/vport01-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$name.txt" 2>&1 || true
  # The device's own frame statistics for everything this run rendered, read BEFORE the process stops.
  adb shell dumpsys gfxinfo "$PKG" > "$OUT/$name-gfxinfo.txt" 2>&1 || true
  adb shell am force-stop "$PKG"
  echo "::endgroup::"
}

# No device accessibility census. The accessible Map's object nodes are zero-size, screen-reader-only views,
# and `uiautomator dump` omits zero-size nodes, so a census through it reads 0 whatever the tree holds (the
# first run measured exactly that on every leg). Accessibility parity — one accessible node per entitled
# identity, no internal id in a label — is proved by the Map's Jest suites against the same scene; the final
# hierarchy of every run is still dumped above as evidence.

{
  echo "device: $(adb shell getprop ro.product.model) / Android $(adb shell getprop ro.build.version.release) / API $(adb shell getprop ro.build.version.sdk)"
  echo "density: $(adb shell wm density | tr -d '\r')  size: $(adb shell wm size | tr -d '\r')"
} | tee "$OUT/device.txt"

adb shell settings put system font_scale 1.0
adb shell settings put secure high_text_contrast_enabled 0
set_motion 1

# Arabic and English, standard contrast.
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-standard vport-01-world.yaml
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-standard vport-01-world.yaml
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG

# The travel, with the device's own frame statistics for the whole recording.
run travel-standard vport-01-travel.yaml

# Increased contrast (Android: high-text-contrast, which the app reads as the platform contrast setting).
adb shell settings put secure high_text_contrast_enabled 1
run ar-increased vport-01-world.yaml
adb shell settings put secure high_text_contrast_enabled 0

# Reduce Motion: the animator scales at 0 are the Android Reduce Motion signal.
set_motion 0
run ar-reduced vport-01-world.yaml
run travel-reduced vport-01-travel.yaml
set_motion 1

# A narrow phone: 360 dp wide.
adb shell wm size 720x1520
adb shell wm density 320
run ar-narrow vport-01-world.yaml
adb shell wm size reset
adb shell wm density reset

# Landscape: the same world, recomposed by T-11.
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
run ar-landscape vport-01-world.yaml
adb shell settings put system user_rotation 0

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
cat "$OUT/results.txt"
exit $status
