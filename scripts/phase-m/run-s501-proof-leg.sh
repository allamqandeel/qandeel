#!/usr/bin/env bash
# Stage 5 (S5-01) — ONE Public World proof leg on ONE freshly booted Android emulator. VALIDATION ONLY.
#
# usage: bash scripts/phase-m/run-s501-proof-leg.sh <apk> <leg-id> <out-dir>
#
# The S4 runner's shape exactly (VAL-01; scripts/phase-m/run-s401-proof-leg.sh): one clean install, the same bounded
# readiness walk, every Maestro invocation under the platform-neutral watchdog, and only this leg's evidence. The APK is
# the S4 proof binary (recipe s4-shared-world-proof: S401ProofRoot, which S5-01 extends with the Public World hook),
# built ONCE by the Build Producer and provenance-checked by the consumer; nothing here builds. S5-01 adds this ONE
# bounded leg rather than re-running the S4 matrix (S5-01 Task Contract §9).
#
#   ar-s501-journey-a  Arabic RTL — three destinations; the Public entry verdict (pre-authority shell, then the root);
#                      Shared and back; qandeel://public through the same controller; the Public display choice in
#                      General Settings → Account & Identity                                     s5-01-journey-a.yaml
#   ar-s502-journey-b  Arabic RTL — S5-02 Public authoring: the workspace inside the Public root, a Draft from the reader's
#                      own existing words (no text field), the review with the current public display, the reader's own
#                      approval, READY FOR REVIEW (not public), back to the still-empty field   s5-02-journey-b.yaml
#
# Exit status: 0 only if the leg passed. Its one result line is written to <out-dir>/result.txt.
set -u

if [ "$#" -ne 3 ]; then echo "usage: run-s501-proof-leg.sh <apk> <leg-id> <out-dir> (exactly ONE leg)"; exit 2; fi
APK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
LEG="$2"
OUT="$3"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
PKG="com.qandeel.mobile"

case "$LEG" in
  ar-s501-journey-a|ar-s502-journey-b) ;;
  *) echo "run-s501-proof-leg: unknown leg '$LEG' — refusing"; exit 2 ;;
esac

mkdir -p "$OUT"
cd "$OUT" || exit 1
capture() {
  adb shell uiautomator dump /sdcard/leg-ui.xml >/dev/null 2>&1 && adb pull /sdcard/leg-ui.xml "$OUT/$LEG-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$LEG.txt" 2>&1 || true
}
fail() { echo "FAIL $LEG — $1" | tee "$OUT/result.txt"; capture; exit 1; }
BOUND="node $REPO/scripts/validation/bounded-run.mjs"
FLOW_SECONDS="${MAESTRO_FLOW_SECONDS:-600}"
maestro_flow() { # <flow> <step-name> [-e KEY=VALUE ...]
  local flow="$1" step="$2"
  shift 2
  $BOUND --seconds "$FLOW_SECONDS" --label "flow-$LEG-$step" --out "$OUT" -- \
    maestro test --debug-output "$OUT/debug-$LEG-$step" --test-output-dir "$OUT/shots-$LEG" -e PREFIX="$LEG" "$@" "$FLOWS/$flow"
}

# --- Cold-start readiness gate (validation infrastructure; nothing below is evidence) -------------------------------
adb wait-for-device
ready_deadline=$((SECONDS + 600))
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] \
  && [ "$(adb shell getprop dev.bootcomplete 2>/dev/null | tr -d '\r')" = "1" ] \
  && adb shell pm path android >/dev/null 2>&1; do
  [ "$SECONDS" -ge "$ready_deadline" ] && { echo "READINESS: the device never reported a completed boot" | tee "$OUT/readiness.txt"; exit 1; }
  sleep 5
done
echo "READINESS: device boot completed and package manager answering" | tee "$OUT/readiness.txt"
adb uninstall "$PKG" >/dev/null 2>&1 || true
adb install "$APK" || exit 1
adb shell pm path "$PKG" >/dev/null 2>&1 || { echo "READINESS: $PKG is not installed" | tee -a "$OUT/readiness.txt"; exit 1; }
{
  echo "leg: $LEG"
  echo "device: $(adb shell getprop ro.product.model | tr -d '\r') / Android $(adb shell getprop ro.build.version.release | tr -d '\r') / API $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "density: $(adb shell wm density | tr -d '\r')  size: $(adb shell wm size | tr -d '\r')"
  echo "apk sha256: $(sha256sum "$APK" | cut -d' ' -f1)"
} | tee "$OUT/device.txt"

$BOUND --seconds 300 --label driver-readiness --out "$OUT" --quiet -- maestro hierarchy --compact \
  || { echo "READINESS: INFRASTRUCTURE — the Maestro driver did not answer; the leg was not run" | tee -a "$OUT/readiness.txt"; exit 1; }

locale() { adb shell cmd locale set-app-locales "$PKG" --locales "$1"; }
if [ "${LEG#en-}" != "$LEG" ]; then locale en-US; else locale ar-EG; fi

ready=0
for attempt in 1 2 3; do
  adb shell cmd statusbar collapse >/dev/null 2>&1 || true
  adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true
  if $BOUND --seconds 300 --label "readiness-$attempt" --out "$OUT" -- maestro test --debug-output "$OUT/debug-readiness-$attempt" "$FLOWS/s4-01-readiness.yaml"; then
    echo "READINESS: app cold paths walked (attempt $attempt)" | tee -a "$OUT/readiness.txt"
    ready=1
    break
  fi
  echo "READINESS: attempt $attempt did not complete; the device is not ready yet" | tee -a "$OUT/readiness.txt"
  adb shell am force-stop "$PKG"
done
adb shell am force-stop "$PKG"
[ "$ready" = "1" ] || { echo "READINESS: not ready after 3 attempts; the leg was not run" | tee -a "$OUT/readiness.txt"; exit 1; }
# ------------------------------------------------------------------------------------------------------------------

adb shell settings put system font_scale 1.0
adb logcat -c || true

# The flow asserts no Product sentence: every check is by test id, selected state and the reader's own synthetic values.
case "$LEG" in
  ar-s501-journey-a) maestro_flow s5-01-journey-a.yaml leg || fail "s5-01-journey-a.yaml" ;;
  ar-s502-journey-b) maestro_flow s5-02-journey-b.yaml leg || fail "s5-02-journey-b.yaml" ;;
esac

capture
echo "PASS $LEG" | tee "$OUT/result.txt"
exit 0
