#!/bin/bash
# DIAG-SE-DOOR — the diagnostic branch `diag/se-door` ONLY (PO, 2026-11-21). Not a gate; it gives no verdict.
#
# Up to 10 cycles of the World gate's own Personal entry (run-world-gate.sh `enter`), each on a fresh install because the
# failing p-door (run 44908792454) was the first launch after install: launch.yaml (unchanged), sleep 8 (unchanged), ONE
# door tap with timed-id.yaml (unchanged: no retry, the same 60 s wait for the rail). It stops at the first failed door.
#
# Each cycle keeps, in <OUT>/cN: the simulator video; the app's system log (the QDIAG markers of the instrumented build,
# subsystem com.facebook.react.log) and the Maestro XCTest driver's log; Maestro's debug output; Documents/qdiag.log from
# the app's container; hierarchy dumps and screenshots right after the door step and 1 s and 5 s later. The recorders
# start before the launch and stop after the last dump, so nothing is added between the launch and the tap.
#
# usage: diag-door.sh <OUT> <UDID> <APP>
set -u
OUT="$1"; UDID="$2"; APP="$3"; HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; CYCLES="${DIAG_CYCLES:-10}"; BUNDLE=com.qandeel.mobile
mkdir -p "$OUT"; LOG="$OUT/diag.log"; printf 'cycle\tlaunch\tdoor\n' > "$OUT/cycles.tsv"
say() { echo "[$(date -u +%H:%M:%S) $(stamp)] $*" | tee -a "$LOG"; }
stamp() { python3 -c 'import time; print("%.3f" % time.time())'; }
# mt <dir> <name> <flow> <k=v…>: the gate's own Maestro call (bounded to 150 s); its debug output is moved into <dir>
mt() { local d="$1" n="$2" f="$3"; shift 3; local a=(); for kv in "$@"; do a+=(-e "$kv"); done
  echo "start $(stamp)" > "$d/$n.time"
  node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 150 --label "$n" -- \
    maestro --device "$UDID" test ${a[@]+"${a[@]}"} "$F/$f" --no-reinstall-driver --driver-host-port "$PORT" > "$d/$n.log" 2>&1; local rc=$?
  echo "end $(stamp) rc=$rc" >> "$d/$n.time"
  mkdir -p "$d/maestro-$n"; mv "$HOME"/.maestro/tests/* "$d/maestro-$n/" 2>/dev/null || true
  say "  cycle $(basename "$d") maestro $n ($f) exit $rc"; return $rc; }
dump() { echo "$(stamp)" > "$1.time"; curl --silent --max-time 30 -X POST -H 'Content-Type: application/json' \
  --data "{\"appIds\":[\"$BUNDLE\"],\"excludeKeyboardElements\":false}" "http://127.0.0.1:$PORT/viewHierarchy" > "$1.json"; }
shot() { xcrun simctl io "$UDID" screenshot "$1.png" >/dev/null 2>&1; }
mkdir -p "$HOME/.maestro/tests"; rm -rf "$HOME"/.maestro/tests/*

for i in $(seq 1 "$CYCLES"); do
  C="$OUT/c$i"; mkdir -p "$C"; say "cycle $i: fresh install"
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl uninstall "$UDID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl spawn "$UDID" log stream --level debug --style ndjson \
    --predicate 'subsystem == "com.facebook.react.log" OR eventMessage CONTAINS "QDIAG"' > "$C/app-log.ndjson" 2>"$C/app-log.err" & LOGP=$!
  xcrun simctl spawn "$UDID" log stream --level debug --style ndjson \
    --predicate 'process CONTAINS "maestro-driver"' > "$C/driver-log.ndjson" 2>"$C/driver-log.err" & DRVP=$!
  xcrun simctl io "$UDID" recordVideo --codec h264 --force "$C/video.mp4" > "$C/video.log" 2>&1 & VIDP=$!
  # The recorders' own start-up, before the cycle's launch (never between the launch and the tap).
  sleep 3
  if mt "$C" launch launch.yaml "NAME=diag-$i-launch"; then
    sleep 8
    mt "$C" door timed-id.yaml "NAME=diag-$i-door" TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail; door=$?
    launch=0
  else launch=1; door=NA; fi
  dump "$C/h0"; shot "$C/h0"; sleep 1; dump "$C/h1"; sleep 4; dump "$C/h5"; shot "$C/h5"
  kill -INT "$VIDP" 2>/dev/null; wait "$VIDP" 2>/dev/null; kill "$LOGP" "$DRVP" 2>/dev/null; wait "$LOGP" "$DRVP" 2>/dev/null
  data="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2>/dev/null)"
  [ -n "$data" ] && cp "$data/Documents/qdiag.log" "$C/qdiag.log" 2>/dev/null
  printf '%s\t%s\t%s\n' "$i" "$launch" "$door" >> "$OUT/cycles.tsv"
  say "cycle $i: launch=$launch door=$door; markers: $(grep -c QDIAG "$C/qdiag.log" 2>/dev/null || echo 0)"
  grep -E 'root\.|door\.|app\.|cross\.|depth\.|fade\.' "$C/qdiag.log" 2>/dev/null | tail -n 40 | sed 's/^/    /' | tee -a "$LOG"
  if [ "$door" != NA ] && [ "$door" -ne 0 ]; then say "the door failed at cycle $i: the campaign stops here"; break; fi
done
say "done"; cat "$OUT/cycles.tsv"
