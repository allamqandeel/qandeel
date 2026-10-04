#!/usr/bin/env bash
# VPORT-02 — the integrated Stage-2 device proof: the final VPORT-01 world with the VPORT-02 temporal / orientation /
# iconography layer. VALIDATION ONLY.
#
# usage: bash scripts/vport02/run-vport02-visual-proof.sh <apk> <out-dir>
#
# The Release APK's root is the VPORT-02 proof root: the PRODUCTION phase surface over the production integration
# runtime, given an in-memory identity and a scripted network. The matrix (Task Contract §11.6):
#
#   ar-standard / en-standard        Arabic RTL / English LTR, standard phone (the emulator's own 412 dp)
#   ar-narrow / en-narrow            a 320-class narrow phone (320 dp wide)
#   ar-landscape / en-landscape      landscape (T-11 recomposes; the support band sits across)
#   ar-increased                     Android high-text-contrast, which the app reads as increased contrast
#   ar-reduced                       launched under Reduce Motion (animator scales 0)
#   ar-narrow-large                  320 dp at 200 % system text — the narrowest phone at large text (G3 F-08)
#   motion-midsession                QAN-BL-A11Y-01: standard motion, then Reduce Motion turned ON while the app runs
#
# Every temporal run walks FOLLOW_LIVE → PINNED → preview → PINNED(LH) → Return Live (a real tap on the Live edge) →
# the world one step in → the Call Rail specimen in three states. After each run the final UI hierarchy and logcat are
# kept. Every run is attempted even when an earlier one fails; the script exits non-zero if ANY failed.
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
  adb shell uiautomator dump /sdcard/vport02-ui.xml >/dev/null 2>&1 && adb pull /sdcard/vport02-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$name.txt" 2>&1 || true
  adb shell dumpsys gfxinfo "$PKG" > "$OUT/$name-gfxinfo.txt" 2>&1 || true
  adb shell am force-stop "$PKG"
}

flow() {
  local name="$1" flow="$2"
  if maestro test --debug-output "$OUT/debug-$name" --test-output-dir "$OUT/shots-$name" -e PREFIX="$name" "$FLOWS/$flow"; then
    echo "PASS $name ($flow)" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name ($flow)" | tee -a "$OUT/results.txt"
    status=1
  fi
}

run() {
  local name="$1" flow="$2"
  echo "::group::$name"
  adb logcat -c || true
  flow "$name" "$flow"
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

# Arabic and English, a standard phone.
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-standard vport-02-temporal.yaml
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-standard vport-02-temporal.yaml

# A 320-class narrow phone: 320 dp wide.
adb shell wm size 640x1386
adb shell wm density 320
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-narrow vport-02-temporal.yaml
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-narrow vport-02-temporal.yaml
# The narrowest phone at large text (200 %).
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
adb shell settings put system font_scale 2.0
run ar-narrow-large vport-02-temporal.yaml
adb shell settings put system font_scale 1.0
adb shell wm size reset
adb shell wm density reset

# Landscape: the same world, the support band recomposed by T-11.
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-landscape vport-02-temporal.yaml
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-landscape vport-02-temporal.yaml
adb shell settings put system user_rotation 0
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG

# Increased contrast (Android: high-text-contrast, which the app reads as the platform contrast setting).
adb shell settings put secure high_text_contrast_enabled 1
run ar-increased vport-02-temporal.yaml
adb shell settings put secure high_text_contrast_enabled 0

# Launched under Reduce Motion: the animator scales at 0 are the Android Reduce Motion signal.
set_motion 0
run ar-reduced vport-02-temporal.yaml
set_motion 1

# QAN-BL-A11Y-01 on a device: Reduce Motion turned ON while the app keeps running — no relaunch between A and B.
adb shell settings put system user_rotation 0
sleep 2
echo "::group::motion-midsession"
adb logcat -c || true
flow motion-midsession vport-02-motion-a.yaml
set_motion 0
sleep 2
flow motion-midsession vport-02-motion-b.yaml
finish motion-midsession
set_motion 1
echo "::endgroup::"

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
cat "$OUT/results.txt"
exit $status
