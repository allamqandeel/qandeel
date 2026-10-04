#!/usr/bin/env bash
# A3-02 — ONE iOS proof leg on ONE booted simulator. VALIDATION ONLY.
#
# usage: bash scripts/a3/run-ios-proof-leg.sh <app-dir> <leg-id> <out-dir> <simulator-udid>
#
# The .app is the one the iOS Build Producer built ONCE; the consumer job provenance-checked it before calling this.
# Nothing here builds. iOS mechanics differ from Android's (authorization alert, APNs payload, presentation), so ONE iOS
# leg covers them; the visual / responsive laws stay with the A3-01 Android legs (record §17).
#
#   ios-permission-delivery-entry   nothing at launch → education → the REAL iOS alert → Allow → registered GRANTED;
#                                   the server-rendered APNs payload (a302-platform-payloads.json, `simctl push`) is
#                                   not presented while the app is in front; in the background iOS presents it; the tap
#                                   reaches the revalidated Direct Entry
set -u
if [ "$#" -ne 4 ]; then echo "usage: run-ios-proof-leg.sh <app-dir> <leg-id> <out-dir> <udid> (exactly ONE leg)"; exit 2; fi
APP="$1"
LEG="$2"
OUT="$3"
UDID="$4"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
PAYLOADS="$REPO/apps/mobile/src/integration/__validation__/a302-platform-payloads.json"
BUNDLE="com.qandeel.mobile"
case "$LEG" in
  ios-permission-delivery-entry) ;;
  *) echo "run-ios-proof-leg: unknown leg '$LEG' — refusing"; exit 2 ;;
esac
mkdir -p "$OUT"
fail() { echo "FAIL $LEG — $1" | tee "$OUT/result.txt"; xcrun simctl io "$UDID" screenshot "$OUT/$LEG-failure.png" >/dev/null 2>&1 || true; exit 1; }
flow() { local file="$1" step="$2"; shift 2; maestro --device "$UDID" test --debug-output "$OUT/debug-$LEG-$step" --test-output-dir "$OUT/shots-$LEG" -e PREFIX="$LEG" "$@" "$FLOWS/$file"; }

# Readiness: a real condition — the simulator reports a completed boot — then a fresh install (never asked before).
xcrun simctl bootstatus "$UDID" -b || fail "the simulator did not finish booting"
xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl privacy "$UDID" reset all "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP" || fail "install"
{
  echo "leg: $LEG"
  echo "simulator: $UDID / $(xcrun simctl list devices | grep "$UDID" | head -n 1 | sed 's/^ *//')"
} | tee "$OUT/device.txt"

# The server-rendered APNs payload of the valid case (English: the simulator's language), written for simctl.
node -e "const p=require(process.argv[1]); require('fs').writeFileSync(process.argv[2], JSON.stringify(p.valid.en.apns))" "$PAYLOADS" "$OUT/valid.apns"
TEXT="$(node -e "process.stdout.write(require(process.argv[1]).valid.en.apns.aps.alert.body)" "$PAYLOADS")"

flow a3-02-ios-permission.yaml permission || fail "a3-02-ios-permission.yaml"
xcrun simctl push "$UDID" "$BUNDLE" "$OUT/valid.apns" || fail "simctl push (foreground)"
flow a3-02-ios-foreground.yaml foreground -e TEXT="$TEXT" || fail "a message was presented while the app was in front (D51)"
xcrun simctl push "$UDID" "$BUNDLE" "$OUT/valid.apns" || fail "simctl push (background)"
flow a3-02-ios-tap.yaml tap -e TEXT="$TEXT" -e TARGET=qandeel-settings || fail "the tap did not reach its revalidated destination"
echo "PASS $LEG" | tee "$OUT/result.txt"
exit 0
