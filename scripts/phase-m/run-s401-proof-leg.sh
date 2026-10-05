#!/usr/bin/env bash
# Stage 4 (S4-01) — ONE Shared World proof leg on ONE freshly booted Android emulator. VALIDATION ONLY.
#
# usage: bash scripts/phase-m/run-s401-proof-leg.sh <apk> <leg-id> <out-dir>
#
# The same shape as the Stage-3 runners (VAL-01; scripts/a3/run-proof-leg.sh): exactly the leg it is given, one clean
# install, a bounded readiness walk, every Maestro invocation under the platform-neutral watchdog, and only this leg's
# evidence. The APK is the one the Build Producer built ONCE and the consumer provenance-checked; nothing here builds.
#
#   ar-journey-a   Arabic RTL — invitation → accept → birth → immediate entry            s4-01-journey-a.yaml
#   ar-journey-b   Arabic RTL — decline, non-enumerating invite, Shared ID copy/regenerate s4-01-journey-b.yaml
#   ar-journey-c   Arabic RTL — My World ↔ Shared World, pre-authority shell, fail-safe   s4-01-journey-c.yaml
#   en-journey-c   English LTR — the same Journey C                                       s4-01-journey-c.yaml
#   ar-s402-journey-a  Arabic RTL — S4-02: history, send, the deterministic QANDEEL reply  s4-02-journey-a.yaml
#   en-s402-journey-b  English LTR — S4-02: attribution, own deletion, refresh, revocation s4-02-journey-b.yaml
#   ar-s403-journey-a  Arabic RTL — S4-03: Manage World, a unanimous change, leave, own former words  s4-03-journey-a.yaml
#   en-s403-journey-b  English LTR — S4-03: hidden history, the exact preview / grant, World end, read-only  s4-03-journey-b.yaml
#
# Exit status: 0 only if the leg passed. Its one result line is written to <out-dir>/result.txt.
set -u

if [ "$#" -ne 3 ]; then echo "usage: run-s401-proof-leg.sh <apk> <leg-id> <out-dir> (exactly ONE leg)"; exit 2; fi
APK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
LEG="$2"
OUT="$3"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
PKG="com.qandeel.mobile"

case "$LEG" in
  ar-journey-a|ar-journey-b|ar-journey-c|en-journey-c|ar-s402-journey-a|en-s402-journey-b|ar-s403-journey-a|en-s403-journey-b) ;;
  *) echo "run-s401-proof-leg: unknown leg '$LEG' — refusing"; exit 2 ;;
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

# The words the flows assert, per language, copied byte-for-byte from apps/mobile/src/shared-world/copy.ts (APPROVED
# invitation meaning with the proof's SYNTHETIC inviter Name; the gate-APPROVED confirmation and malformed-ID sentences).
AR_INVITATION="هدير الاختبار يدعوك لإنشاء عالم مشترك بينكما ومع قنديل."
AR_SENT="إذا كان هذا المعرّف صحيحًا، ستصل الدعوة إلى صاحبه."
AR_INVALID="تأكد من المعرّف المشترك وحاول مرة أخرى."
# S4-02: the proof world's SYNTHETIC lines (apps/mobile/src/integration/__validation__/s401-proof-world.ts), byte-for-byte.
AR_REPLY="رد اختباري ثابت من قنديل"
EN_PEER_NAME="Fixture Hadir"
PEER_LATER="Fixture peer words after refresh"
# S4-03: the reader's own notices the flows assert, byte-for-byte from apps/mobile/src/shared-world/lifecycle-copy.ts.
AR_LEFT="غادرت العالم."
EN_GRANTED="Shared."

case "$LEG" in
  ar-journey-a) maestro_flow s4-01-journey-a.yaml leg -e INVITATION="$AR_INVITATION" || fail "s4-01-journey-a.yaml" ;;
  ar-journey-b) maestro_flow s4-01-journey-b.yaml leg -e SENT="$AR_SENT" -e INVALID="$AR_INVALID" || fail "s4-01-journey-b.yaml" ;;
  ar-journey-c) maestro_flow s4-01-journey-c.yaml leg || fail "s4-01-journey-c.yaml" ;;
  en-journey-c) maestro_flow s4-01-journey-c.yaml leg || fail "s4-01-journey-c.yaml" ;;
  ar-s402-journey-a) maestro_flow s4-02-journey-a.yaml leg -e REPLY="$AR_REPLY" || fail "s4-02-journey-a.yaml" ;;
  en-s402-journey-b) maestro_flow s4-02-journey-b.yaml leg -e PEER_NAME="$EN_PEER_NAME" -e PEER_LATER="$PEER_LATER" || fail "s4-02-journey-b.yaml" ;;
  ar-s403-journey-a) maestro_flow s4-03-journey-a.yaml leg -e LEFT="$AR_LEFT" || fail "s4-03-journey-a.yaml" ;;
  en-s403-journey-b) maestro_flow s4-03-journey-b.yaml leg -e GRANTED="$EN_GRANTED" || fail "s4-03-journey-b.yaml" ;;
esac

capture
echo "PASS $LEG" | tee "$OUT/result.txt"
exit 0
