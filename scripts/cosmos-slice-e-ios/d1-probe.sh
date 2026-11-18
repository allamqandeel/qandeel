#!/bin/bash
# COSMOS-INT-01 Slice E, D-1 — DIAGNOSTIC ONLY (branch cosmos/slice-e-d1-diag; never merged).
# Where does a touch on the Personal COSMOS stage stop on iOS? The instrumented proof build publishes a counter board
# (accessibility label "DIAG …" on `qandeel-diag-trace`) that every layer of the touch path writes to:
#   depth.*        React Native's touch handler delivered the touch to the Analysis depth (UIKit hit test landed in it)
#   E.ui.worldView / E.ui.canvas / E.ui.mapA11y / sheet.frame   ... and to these views (their onTouchStart)
#   E.g.tap.* / E.g.pan.*        RNGH gesture callbacks on the canvas detector (down/begin/start/end/finalize)
#   E.js.emitTap / E.js.onTap / E.js.tap.<RESULT> / E.js.step.*  JS: CosmosCanvas → CosmosWorldView
#   E.own.tap.none / E.own.tap.inspect / E.own.step   the Personal owner's answer, and why
#   E.snap         the Personal snapshot (status / rung / hits on the rung / glass)
# (E = PERSONAL[1], H = SHARED[1], U = PUBLIC[1].) After each injected touch the board is read twice (Maestro's
# hierarchy and idb's describe-all) next to a screenshot. Nothing is retried.
# usage: d1-probe.sh <OUT> <UDID>
set -u
OUT="$1"; UDID="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; FIX='.*(Fixture Map World|عالم الخريطة الاختباري).*'; mkdir -p "$OUT"; LOG="$OUT/probe.log"
say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
mt() { local n="$1" f="$2"; shift 2; local a=(); for kv in "$@"; do a+=(-e "$kv"); done
  maestro --device "$UDID" test ${a[@]+"${a[@]}"} "$F/$f" --no-reinstall-driver --driver-host-port "$PORT" > "$OUT/$n.log" 2>&1; local rc=$?
  say "  maestro $n ($f) exit $rc"; return $rc; }
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1; }
tree() { curl --silent --max-time 30 -X POST -H 'Content-Type: application/json' \
  --data '{"appIds":["com.qandeel.mobile"],"excludeKeyboardElements":false}' "http://127.0.0.1:$PORT/viewHierarchy" > "$OUT/$1.json"; }
seen() { grep -q "\"$1" "$OUT/$2.json" 2>/dev/null && echo YES || echo no; }
board() { local b; b="$(grep -o 'DIAG [^"]*' "$OUT/$1.json" 2>/dev/null | head -1)"
  [ -z "$b" ] && b="$(grep -o 'DIAG [^"]*' "$OUT/$1.idb.json" 2>/dev/null | head -1)"; echo "${b:-BOARD NOT FOUND}"; }
ev() { sleep 3; shot "$1"; tree "$1"; command -v idb >/dev/null && idb ui describe-all --udid "$UDID" > "$OUT/$1.idb.json" 2>>"$LOG"
  say "  after $1: peek=$(seen qandeel-personal-peek "$1") sheet-handle=$(seen cosmos-detail-sheet-handle "$1")"
  board "$1" | tee "$OUT/$1.board.txt" | sed 's/^/    /' | tee -a "$LOG"; }
wpt="$(curl --silent --max-time 60 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo" | grep -o '"widthPoints":[0-9]*' | cut -d: -f2)"
say "device widthPoints=$wpt; idb $(command -v idb || echo MISSING)"
node_at() { (cd "$ROOT" && node "$HERE/nodes.mjs" --any "$OUT/$1.png" "$wpt"); }
idbtap() { command -v idb >/dev/null || { say "  idb NOT AVAILABLE (tap at $1 NOT RUN)"; return; }; idb ui tap --udid "$UDID" "${1%,*}" "${1#*,}" >> "$LOG" 2>&1; say "  idb tap $1 exit $?"; }
point() { command -v idb >/dev/null || return; idb ui describe-point --udid "$UDID" "${2%,*}" "${2#*,}" > "$OUT/$1.point.json" 2>>"$LOG"
  say "  AX element at $2: $(grep -o '"\(type\|AXUniqueId\|AXLabel\|AXFrame\)":[^,]*' "$OUT/$1.point.json" | grep -v DIAG | tr '\n' ' ')"; }

say "== Personal (Analysis depth)"
mt p-launch launch.yaml NAME=d1-launch; mt p-door timed-id.yaml NAME=d1-door TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail
sleep 6; ev p0
pt="$(node_at p0)"; say "  largest node core in p0: $pt (points)"
if [ "$pt" != none ]; then
  point p1 "$pt"
  say "-- p1: one idb (HID) tap on the node core"; idbtap "$pt"; ev p1
  say "-- p2: one Maestro (XCTest) tap on the node core"; mt p2 tap-point.yaml "P=$pt"; ev p2
fi
say "-- p3: one idb tap on empty space (201,180)"; point p3 "201,180"; idbtap "201,180"; ev p3
say "-- p4: a Maestro double tap on empty space (50%,21%)"; mt p4 dtap-point.yaml "P=50%,21%"; ev p4
say "-- p5: a Maestro pan (70%,50% -> 30%,50%)"; mt p5 swipe-pan-50.yaml; ev p5

say "== Shared control (Fixture Map World)"
mt s-launch launch.yaml NAME=d1-s-launch; mt s-seed link.yaml URL=qandeel://s401-proof/shared-field/seed
mt s-worlds timed-text.yaml NAME=d1-shared TAP=qandeel-switcher-shared_world "WAIT=$FIX"; mt s-world timed-tap-text.yaml NAME=d1-field "TAP=$FIX" WAIT=qandeel-shared-band
sleep 6; ev s0
pt="$(node_at s0)"; say "  largest node core in s0: $pt (points)"
[ "$pt" != none ] && { say "-- s1: one idb tap on the node core"; idbtap "$pt"; ev s1; }
say "-- s2: a Maestro double tap on empty space (50%,21%)"; mt s2 dtap-point.yaml "P=50%,21%"; ev s2
say "done"
