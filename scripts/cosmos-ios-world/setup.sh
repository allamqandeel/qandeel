#!/bin/bash
# COSMOS-INT-01 Slice E — iOS World gate: set the simulator's OWN system language and region (the app follows the device
# locale; there is no in-app switch), then prove Maestro's XCTest driver answers, with ONE clean recovery. A driver that
# never answers is INFRASTRUCTURE and fails this step: the gate's cases are then NOT TESTED, never PASS.
# usage: LANGTAG=en-US LANGLOC=en_US setup.sh <UDID> <OUT>
set -u
UDID="$1"; OUT="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; mkdir -p "$OUT"; LOG="$OUT/setup.log"
say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
B() { node "$ROOT/scripts/validation/bounded-run.mjs" --seconds "$1" --fail-fast maestro-xctest-device-info-500 --label "$2" --quiet --out "$OUT/watchdog" -- "${@:3}"; }
driver_answers() {
  curl --fail --silent --max-time 10 "http://127.0.0.1:$PORT/status" >/dev/null || return 1
  local info; info="$(curl --fail --silent --max-time 110 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo")" || return 1
  case "$info" in *'"widthPoints"'*) echo "$info" > "$OUT/device-info.json"; return 0 ;; *) return 1 ;; esac
}
ready() {
  if B 480 readiness maestro --device "$UDID" hierarchy --no-reinstall-driver --compact > /dev/null 2>&1 && driver_answers; then say "driver ready"; return 0; fi
  say "INFRASTRUCTURE: the driver did not prove ready; one clean recovery"
  bash "$ROOT/scripts/validation/ios-driver-diagnostics.sh" "$UDID" > "$OUT/driver-diagnostics.txt" 2>&1 || true
  pkill -f "test-without-building.*$UDID" || true
  xcrun simctl terminate "$UDID" dev.mobile.maestro-driver-iosUITests.xctrunner || true
  xcrun simctl uninstall "$UDID" dev.mobile.maestro-driver-iosUITests.xctrunner || true
  xcrun simctl shutdown "$UDID"; xcrun simctl boot "$UDID"; B 300 reboot xcrun simctl bootstatus "$UDID" -b > /dev/null
  B 480 readiness2 maestro --device "$UDID" hierarchy --no-reinstall-driver --compact > /dev/null 2>&1 && driver_answers && { say "driver ready after recovery"; return 0; }
  say "INFRASTRUCTURE: driver still not ready"; return 1
}
P="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Preferences/.GlobalPreferences.plist"
xcrun simctl shutdown "$UDID" 2>/dev/null
plutil -replace AppleLanguages -json "[\"$LANGTAG\"]" "$P" && plutil -replace AppleLocale -string "$LANGLOC" "$P" || { say "could not write the language to $P"; exit 1; }
xcrun simctl boot "$UDID"; B 300 boot xcrun simctl bootstatus "$UDID" -b > /dev/null
plutil -p "$P" | grep -A2 -E 'AppleLanguages|AppleLocale' | tee -a "$LOG"
ready
