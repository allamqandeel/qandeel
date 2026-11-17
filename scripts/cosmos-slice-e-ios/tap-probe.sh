#!/bin/bash
# COSMOS-INT-01 Slice E iOS baseline (VALIDATION ONLY): separate "a tap on a COSMOS node does nothing on iOS" into the
# application or the automation. The same node is tapped by two independent injection routes:
#   A. Maestro's XCTest tap (what the audit uses), and
#   B. idb's HID touch (SimulatorKit HID events, the closest a simulator gets to a finger),
# each once and twice, in Personal (Analysis) and Shared (Fixture Map World). After every tap: a screenshot, the
# accessibility tree (Maestro's driver) and whether a PEEK / detail sheet appeared. Nothing is retried; the app binary
# is the checksummed proof build and is never modified.
# usage: tap-probe.sh <OUT> <UDID>
set -u
OUT="$1"; UDID="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; FIX='.*(Fixture Map World|عالم الخريطة الاختباري).*'; mkdir -p "$OUT"; LOG="$OUT/probe.log"
say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
mt() { local n="$1" f="$2"; shift 2; local a=(); for kv in "$@"; do a+=(-e "$kv"); done
  maestro --device "$UDID" test "${a[@]}" "$F/$f" --no-reinstall-driver --driver-host-port "$PORT" > "$OUT/$n.log" 2>&1; local rc=$?
  say "  maestro $n ($f) exit $rc"; return $rc; }
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1; }
tree() { curl --silent --max-time 30 -X POST -H 'Content-Type: application/json' \
  --data '{"appIds":["com.qandeel.mobile"],"excludeKeyboardElements":false}' "http://127.0.0.1:$PORT/viewHierarchy" > "$OUT/$1.json"; }
seen() { grep -q "\"$1" "$OUT/$2.json" 2>/dev/null && echo YES || echo no; }
ev() { sleep 3; shot "$1"; tree "$1"; say "  after $1: peek=$(seen qandeel-personal-peek "$1") shared-panel=$(seen qandeel-shared-panel-meaning "$1") sheet-handle=$(seen cosmos-detail-sheet-handle "$1")"; }
wpt="$(curl --silent --max-time 60 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo" | grep -o '"widthPoints":[0-9]*' | cut -d: -f2)"
say "device widthPoints=$wpt"
node_at() { (cd "$ROOT" && node "$HERE/nodes.mjs" --any "$OUT/$1.png" "$wpt"); }
idbtap() { command -v idb >/dev/null || { say "  idb NOT AVAILABLE (tap $1 NOT RUN)"; return; }; idb ui tap --udid "$UDID" "${1%,*}" "${1#*,}" >> "$LOG" 2>&1; say "  idb tap $1 exit $?"; }

probe() { # <world> <prefix>
  local w="$1" p="$2" pt
  ev "$p-0-rest"; pt="$(node_at "$p-0-rest")"; say "$w: node core at $pt (points)"
  [ "$pt" = none ] && { say "$w: no node core found; probe NOT RUN"; return; }
  mt "$p-A1" tap-point.yaml "P=$pt"; ev "$p-A1"
  mt "$p-A2" tap-point.yaml "P=$pt"; ev "$p-A2"
}
probe_idb() {
  local w="$1" p="$2" pt
  ev "$p-0-rest"; pt="$(node_at "$p-0-rest")"; say "$w: node core at $pt (points)"
  [ "$pt" = none ] && { say "$w: no node core found; probe NOT RUN"; return; }
  idbtap "$pt"; ev "$p-B1"
  idbtap "$pt"; ev "$p-B2"
}

say "== Personal, Maestro (XCTest) taps"
mt p-launch launch.yaml NAME=probe-launch; mt p-door timed-id.yaml NAME=probe-door TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail
sleep 5; probe personal pA
say "== Personal, idb (HID) taps, fresh launch"
mt p-launch2 launch.yaml NAME=probe-launch2; mt p-door2 timed-id.yaml NAME=probe-door2 TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail
sleep 5; probe_idb personal pB
say "== Shared, Maestro (XCTest) taps"
mt s-launch launch.yaml NAME=probe-s-launch; mt s-seed link.yaml URL=qandeel://s401-proof/shared-field/seed
mt s-worlds timed-text.yaml NAME=probe-shared TAP=qandeel-switcher-shared_world "WAIT=$FIX"; mt s-world timed-tap-text.yaml NAME=probe-field "TAP=$FIX" WAIT=qandeel-shared-band
sleep 5; probe shared sA
say "== Shared, idb (HID) taps, fresh launch"
mt s-launch2 launch.yaml NAME=probe-s-launch2; mt s-seed2 link.yaml URL=qandeel://s401-proof/shared-field/seed
mt s-worlds2 timed-text.yaml NAME=probe-shared2 TAP=qandeel-switcher-shared_world "WAIT=$FIX"; mt s-world2 timed-tap-text.yaml NAME=probe-field2 "TAP=$FIX" WAIT=qandeel-shared-band
sleep 5; probe_idb shared sB
say "== idb's own view of the tapped area (accessibility at the point)"
command -v idb >/dev/null && idb ui describe-all --udid "$UDID" > "$OUT/idb-describe-all.json" 2>>"$LOG"
say "done"
