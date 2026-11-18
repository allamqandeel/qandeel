#!/bin/bash
# COSMOS-INT-01 Slice E — the iOS World gate: real COSMOS stages on the iOS simulator, driven by touch, with assertions.
# It is not the boot smoke (Mobile CI's `verify-ios`, which proves only that the unconfigured Product binary launches).
# This gate drives the S401 proof build: the production composition over the labelled synthetic proof network.
#
# Each case is PASS, FAIL or NOT TESTED in <OUT>/results.tsv, with its screenshot and hierarchy dump. A case whose
# precondition failed is NOT TESTED, never PASS. Nothing is retried. The run exits non-zero unless every case passed.
#
# Cases (BG-10: permanent iOS regression coverage for D-1, the Personal stage that took no tap on iOS):
#   P-TAP-RAIL  Personal: one tap on a node core inside the depth rail's frame opens the PEEK. That is the region where
#               the stretched rail beads used to stand over the stage and take the touch (diag run 44255421709).
#   P-TAP       Personal: one tap on the largest node core opens the PEEK (`qandeel-personal-peek`).
#   P-DTAP      Personal: a double tap on empty space steps IN (the depth rail's lit point moves; the stage's Back appears).
#               The two touches go straight to the XCTest driver, and their measured gap is recorded. Two touches 320 ms
#               or more apart are not a double tap (DOUBLE_TAP_MS), so the case is then NOT TESTED, never PASS or FAIL.
#   P-BACK      Personal: the stage's Back after that step returns to the first depth.
#   P-PAN       Personal: a pan on open stage moves the world (the camera leaves the centre, so Back appears).
#   P-PAN-RAIL  Personal: a pan that starts where the depth rail stands moves the world too.
#   S-FAR-TAP / S-TAP / U-TAP   Shared and Public controls: a single Shared tap on empty FAR space discloses Far -> Mid;
#               a node tap opens the Shared sheet or the Public panel.
# Node cores are found on the frame just before each tap (nodes.mjs), as a reader looks before tapping.
#
# usage: run-world-gate.sh <OUT> <UDID>   (the app is installed; the simulator language is set; the driver is ready)
set -u
OUT="$1"; UDID="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; FIX='.*(Fixture Map World|عالم الخريطة الاختباري).*'
mkdir -p "$OUT"; LOG="$OUT/gate.log"; RES="$OUT/results.tsv"; printf 'case\tresult\tdetail\n' > "$RES"
say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
result() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$RES"; say "RESULT $1 $2 — $3"; }
mt() { local n="$1" f="$2"; shift 2; local a=(); for kv in "$@"; do a+=(-e "$kv"); done
  node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 150 --label "$n" --quiet -- \
    maestro --device "$UDID" test ${a[@]+"${a[@]}"} "$F/$f" --no-reinstall-driver --driver-host-port "$PORT" > "$OUT/$n.log" 2>&1; local rc=$?
  say "  maestro $n ($f) exit $rc"; return $rc; }
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1; }
dump() { curl --silent --max-time 30 -X POST -H 'Content-Type: application/json' \
  --data '{"appIds":["com.qandeel.mobile"],"excludeKeyboardElements":false}' "http://127.0.0.1:$PORT/viewHierarchy" > "$OUT/$1.json"; }
q() { node "$HERE/hier.mjs" "$OUT/$1.json" "${@:2}"; }
# poll <name> <seconds> <query…>: dump until the query answers something other than "none" (prints the answer, or "none")
poll() { local n="$1" s="$2" i a; shift 2; for i in $(seq 1 "$s"); do dump "$n"; a="$(q "$n" "$@")"; [ "$a" != none ] && { echo "$a"; return 0; }; sleep 1; done; echo none; return 1; }
# backOn <name>: whether the stage's Back is available (it is laid out at every depth, enabled only away from home)
backOn() { q "$1" id qandeel-cosmos-back | grep -q 'enabled=true'; }
depthWord() { q "$1" selected-label; }
wpt="$(curl --silent --max-time 60 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo" | grep -o '"widthPoints":[0-9]*' | cut -d: -f2)"
node_at() { (cd "$ROOT" && node "$HERE/nodes.mjs" --any "$OUT/$1.png" "$wpt"); }
say "device widthPoints=${wpt:-UNKNOWN}"

# ── Personal ───────────────────────────────────────────────────────────────────────────────────────────────────────
hpt="$(curl --silent --max-time 60 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo" | grep -o '"heightPoints":[0-9]*' | cut -d: -f2)"
ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time*1000'; }
# touch_at <x> <y>: one touch straight to the XCTest driver (Maestro's own /touch route); prints the HTTP status
touch_at() { curl --silent --max-time 20 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data "{\"x\":$1,\"y\":$2,\"duration\":0.05}" "http://127.0.0.1:$PORT/touch"; }
enter() { mt "$1-launch" launch.yaml "NAME=gate-$1-launch" && mt "$1-door" timed-id.yaml "NAME=gate-$1-door" TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail; }
# tapcase <case> <name> <point>: one tap, then the PEEK within 6 s; the PEEK is closed by its handle afterwards
tapcase() {
  mt "$2" tap-point.yaml "P=$3"; local a; a="$(poll "$2" 6 id qandeel-personal-peek)"; shot "$2"
  if [ "$a" != none ]; then result "$1" PASS "tap at $3 opened the PEEK"; mt "$2-close" tap.yaml ID=cosmos-detail-sheet-handle IDX=0; sleep 2
  else result "$1" FAIL "tap at $3: no qandeel-personal-peek within 6 s"; fi
}
# pancase <case> <name> <flow>: from a fresh home stage, one pan, then Back available
pancase() {
  enter "$2" || { result "$1" 'NOT TESTED' 'the Personal Analysis did not open'; return; }
  sleep 4; dump "$2-0"
  if backOn "$2-0"; then result "$1" 'NOT TESTED' 'the stage was not at home before the pan'; return; fi
  mt "$2" "$3"; sleep 2; dump "$2"; shot "$2"
  if backOn "$2"; then result "$1" PASS "the pan ($3) moved the camera off the centre (Back available)"; else result "$1" FAIL "after the pan ($3), Back is not available"; fi
}
if ! enter p; then
  for c in P-TAP-RAIL P-TAP P-DTAP P-BACK P-PAN P-PAN-RAIL; do result "$c" 'NOT TESTED' 'the Personal Analysis did not open'; done
else
  sleep 5; shot p-0; dump p-0
  rail="$(q p-0 id qandeel-cosmos-rail | head -1 | sed 's/.*frame=//')"; [ "$rail" = none ] && rail=
  say "  depth rail frame: ${rail:-none}"
  # P-TAP-RAIL first, on the untouched stage: the regression's own region
  if [ -z "$rail" ]; then result P-TAP-RAIL 'NOT TESTED' 'the depth rail was not found'
  else
    pt="$(cd "$ROOT" && node "$HERE/nodes.mjs" --in "$rail" "$OUT/p-0.png" "$wpt")"
    if [ "$pt" = none ]; then result P-TAP-RAIL 'NOT TESTED' "no node core inside the depth rail's frame ($rail)"; else tapcase P-TAP-RAIL p-tap-rail "$pt"; fi
  fi
  shot p-1; pt="$(node_at p-1)"
  if [ "$pt" = none ]; then result P-TAP 'NOT TESTED' 'no node core visible on the Personal stage'; else tapcase P-TAP p-tap "$pt"; fi
  # P-DTAP: on a fresh home stage (first depth, centred, Back not available), two touches on empty space above the centre
  if ! enter p-d; then result P-DTAP 'NOT TESTED' 'the Personal Analysis did not open again'; before=
  else sleep 4; dump p-d0; before="$(depthWord p-d0)"; fi
  if [ -z "$before" ]; then :
  elif backOn p-d0; then result P-DTAP 'NOT TESTED' 'the stage was not at home before the double tap'
  elif [ -z "$hpt" ]; then result P-DTAP 'NOT TESTED' 'the driver reported no screen height'
  else
    x=$((wpt / 2)); y=$((hpt * 24 / 100)); t0="$(ms)"; c1="$(touch_at $x $y)"; t1="$(ms)"; c2="$(touch_at $x $y)"; t2="$(ms)"
    gap=$((t2 - t1)); say "  double tap at $x,$y: HTTP $c1 / $c2; first touch $((t1 - t0)) ms, second $gap ms after the first returned"
    sleep 2; dump p-dtap; shot p-dtap; after="$(depthWord p-dtap)"
    if [ "$c1" != 200 ] || [ "$c2" != 200 ]; then result P-DTAP 'NOT TESTED' "the driver did not take the touches (HTTP $c1 / $c2)"
    elif [ "$after" != "$before" ] && backOn p-dtap; then result P-DTAP PASS "depth '$before' -> '$after' (second touch ~$gap ms after the first); Back available"
    elif [ "$gap" -ge 320 ]; then result P-DTAP 'NOT TESTED' "the injected touches were ~$gap ms apart, not a double tap (window 320 ms)"
    else result P-DTAP FAIL "depth '$before' -> '$after' after touches ~$gap ms apart"; fi
  fi
  # P-BACK: only after a step that happened
  if grep -q "^P-DTAP	PASS" "$RES"; then
    mt p-back tap.yaml ID=qandeel-cosmos-back IDX=0; sleep 2; dump p-back; shot p-back; now="$(depthWord p-back)"
    if [ "$now" = "$before" ]; then result P-BACK PASS "Back returned to '$now'"; else result P-BACK FAIL "Back left the depth at '$now' (expected '$before')"; fi
  else result P-BACK 'NOT TESTED' 'P-DTAP did not step'; fi
  pancase P-PAN p-pan swipe-pan-50.yaml
  pancase P-PAN-RAIL p-panr swipe-pan-rail.yaml
fi

# ── Shared control ─────────────────────────────────────────────────────────────────────────────────────────────────
if mt s-launch launch.yaml NAME=gate-s-launch && mt s-seed link.yaml URL=qandeel://s401-proof/shared-field/seed \
  && mt s-worlds timed-text.yaml NAME=gate-shared TAP=qandeel-switcher-shared_world "WAIT=$FIX" \
  && mt s-world timed-tap-text.yaml NAME=gate-field "TAP=$FIX" WAIT=qandeel-shared-band; then
  sleep 5; shot s-0; dump s-0
  w0="$(q s-0 id-label qandeel-shared-field-world:semantic-step)"
  # A single tap on empty FAR space steps IN (the Shared owner's tap at rung 0); it is not a double tap (diag run 44248838235).
  mt s-far tap-point.yaml "P=50%,24%"; sleep 2; dump s-far; shot s-far; w1="$(q s-far id-label qandeel-shared-field-world:semantic-step)"
  if [ "$w0" != none ] && [ "$w1" != "$w0" ]; then result S-FAR-TAP PASS "'$w0' -> '$w1'"; else result S-FAR-TAP FAIL "'$w0' -> '$w1'"; fi
  pt="$(node_at s-far)"
  if [ "$pt" = none ]; then result S-TAP 'NOT TESTED' 'no node core visible on the Shared stage'
  else
    mt s-tap tap-point.yaml "P=$pt"; a="$(poll s-tap 6 id cosmos-detail-sheet-handle)"; shot s-tap
    if [ "$a" != none ]; then result S-TAP PASS "tap at $pt opened the sheet"; else result S-TAP FAIL "tap at $pt: no detail sheet within 6 s"; fi
  fi
else
  result S-FAR-TAP 'NOT TESTED' 'the Shared Fixture Map World did not open'; result S-TAP 'NOT TESTED' 'the Shared Fixture Map World did not open'
fi

# ── Public control ─────────────────────────────────────────────────────────────────────────────────────────────────
if mt u-launch launch.yaml NAME=gate-u-launch && mt u-seed link.yaml URL=qandeel://s401-proof/public/seed \
  && mt u-enter tap.yaml ID=qandeel-switcher-public_world IDX=0 && mt u-allow link.yaml URL=qandeel://s401-proof/public/allow \
  && mt u-field wait-id.yaml ID=qandeel-public-search T=30000; then
  sleep 5; shot u-0; dump u-0; pt="$(node_at u-0)"
  if [ "$pt" = none ]; then result U-TAP 'NOT TESTED' 'no node core visible on the Public field'
  else
    mt u-tap tap-point.yaml "P=$pt"; a="$(poll u-tap 6 id-prefix qandeel-public-panel)"; shot u-tap
    if [ "$a" != none ]; then result U-TAP PASS "tap at $pt opened the Public panel"; else result U-TAP FAIL "tap at $pt: no Public panel within 6 s"; fi
  fi
else result U-TAP 'NOT TESTED' 'the Public field did not open'; fi

say "done"; cat "$RES" | tee -a "$LOG"
! grep -qv -e $'\tPASS\t' -e '^case' "$RES"
