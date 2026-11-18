#!/bin/bash
# COSMOS-INT-01 Slice E iOS baseline (VALIDATION ONLY), probe 2. Probe 1 (run 44193183438): on the same proof build a tap
# aimed at a node opens the Shared detail sheet through Maestro AND idb, but no Personal tap (either route) does anything,
# while a Personal pan works. Here, Personal only, against a Shared control:
#   1. what iOS reports at the tapped point (idb describe-point): is something laid over the canvas there?
#   2. idb taps on the four largest node cores, each re-aimed from the frame just before it;
#   3. a Maestro double tap on empty space (the canvas steps IN on a double tap that hits nothing), Personal and Shared.
# usage: tap-probe-2.sh <OUT> <UDID>
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
rung() { grep -o '"AXLabel":"[^"]*\(meaning map\|map\)[^"]*"' "$OUT/$1.idb.json" 2>/dev/null | head -1; }
ev() { sleep 3; shot "$1"; tree "$1"; idb ui describe-all --udid "$UDID" > "$OUT/$1.idb.json" 2>>"$LOG"
  say "  after $1: peek=$(seen qandeel-personal-peek "$1") shared-panel=$(seen qandeel-shared-panel-meaning "$1") sheet-handle=$(seen cosmos-detail-sheet-handle "$1") step-label=$(rung "$1")"; }
wpt="$(curl --silent --max-time 60 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo" | grep -o '"widthPoints":[0-9]*' | cut -d: -f2)"
say "device widthPoints=$wpt; idb $(command -v idb || echo MISSING)"
cores() { (cd "$ROOT" && node "$HERE/nodes.mjs" "$OUT/$1.png" "$wpt"); }
node_at() { (cd "$ROOT" && node "$HERE/nodes.mjs" --any "$OUT/$1.png" "$wpt"); }
point() { idb ui describe-point --udid "$UDID" "${2%,*}" "${2#*,}" > "$OUT/$1.point.json" 2>>"$LOG"
  say "  iOS element at $2: $(grep -o '"\(type\|AXUniqueId\|AXLabel\|AXFrame\)":[^,]*' "$OUT/$1.point.json" | tr '\n' ' ')"; }

say "== Personal"
mt p-launch launch.yaml NAME=probe2-launch; mt p-door timed-id.yaml NAME=probe2-door TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail
sleep 5; ev p0; say "  cores (hue@x,y,pixels): $(cores p0)"
prev=p0
for i in 1 2 3 4; do
  # the i-th largest core of the frame just before this tap
  pt="$(cores "$prev" | tr ' ' '\n' | grep '@' | sort -t, -k3 -nr | sed -n "${i}p" | sed 's/^[0-9]*@//' | cut -d, -f1,2)"
  [ -z "$pt" ] && { say "  no core $i"; break; }
  point "p$i" "$pt"
  idb ui tap --udid "$UDID" "${pt%,*}" "${pt#*,}" >> "$LOG" 2>&1; say "  idb tap core $i at $pt exit $?"
  ev "p$i"; prev="p$i"
done
say "  Personal double tap on empty space (top of the stage)"
point p-empty "201,180"
mt p-dtap dtap-point.yaml "P=50%,21%"; ev p-dtap
say "== Shared control"
mt s-launch launch.yaml NAME=probe2-s-launch; mt s-seed link.yaml URL=qandeel://s401-proof/shared-field/seed
mt s-worlds timed-text.yaml NAME=probe2-shared TAP=qandeel-switcher-shared_world "WAIT=$FIX"; mt s-world timed-tap-text.yaml NAME=probe2-field "TAP=$FIX" WAIT=qandeel-shared-band
sleep 5; ev s0; pt="$(node_at s0)"; point s1 "$pt"
point s-empty "201,180"
mt s-dtap dtap-point.yaml "P=50%,21%"; ev s-dtap
say "done"
