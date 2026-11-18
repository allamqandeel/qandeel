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
#   (The double tap and the Back after it are native XCUITest cases, run after this gate from the same build:
#   scripts/cosmos-ios-world/xcuitest. Maestro's XCTest driver takes one touch per request, so it cannot deliver a
#   genuine double tap inside DOUBLE_TAP_MS, nor a two-finger pinch; runs 44263732597 and 44272338098 showed it.)
#   P-PAN       Personal: a pan from open stage, left of and above the depth rail (20%,30% -> 60%,30%), moves the world
#               (the camera leaves the centre, so Back appears).
#   P-PAN-RAIL  Personal: a pan that starts where the depth rail stands (75%,57%) moves the world too.
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
# backOn <name>: whether the stage's Back is available (it is laid out only away from the home position)
backOn() { q "$1" id qandeel-cosmos-back | grep -q 'enabled=true'; }
wpt="$(curl --silent --max-time 60 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo" | grep -o '"widthPoints":[0-9]*' | cut -d: -f2)"
node_at() { (cd "$ROOT" && node "$HERE/nodes.mjs" --any "$OUT/$1.png" "$wpt"); }
say "device widthPoints=${wpt:-UNKNOWN}"

# ── Personal ───────────────────────────────────────────────────────────────────────────────────────────────────────
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
  for c in P-TAP-RAIL P-TAP P-PAN P-PAN-RAIL; do result "$c" 'NOT TESTED' 'the Personal Analysis did not open'; done
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
  pancase P-PAN p-pan swipe-pan-open.yaml
  pancase P-PAN-RAIL p-panr swipe-pan-rail.yaml
fi

# ── Shared and Public controls ─────────────────────────────────────────────────────────────────────────────────────
# stage_pt <name>: the largest node core on <name>.png inside the stage only, from below the stage's control row (its Overview, laid out at
# every depth) down to the World switcher, so that a bright control glyph is never taken for a node; or "none"
stage_pt() {
  local b s y0 y1; b="$(q "$1" id qandeel-cosmos-overview | head -1 | sed 's/.*frame=//')"; s="$(q "$1" id qandeel-global-switcher | head -1 | sed 's/.*frame=//')"
  case "$b,$s" in *none*|*'?'*) echo none; return;; esac
  y0=$(( $(echo "$b" | cut -d, -f2) + $(echo "$b" | cut -d, -f4) )); y1="$(echo "$s" | cut -d, -f2)"
  (cd "$ROOT" && node "$HERE/nodes.mjs" --in "0,$y0,$wpt,$((y1 - y0))" "$OUT/$1.png" "$wpt")
}
# nodetap <case> <name> <step id> <what> <query…>: a node tap discloses until the object can open (FAR -> MID -> NEAR),
# so up to three taps, each on the node core found on the frame just before it, until <query> answers. Each tap must
# do its own part: open the object, or disclose a deeper depth. A tap that does neither fails the case at once.
nodetap() {
  local c="$1" n="$2" sid="$3" what="$4" i pt a path was now; shift 4; was="$(q "$n-0" id-label "$sid")"; path="$was"
  for i in 1 2 3; do
    shot "$n-$i-0"; dump "$n-$i-0"; pt="$(stage_pt "$n-$i-0")"
    if [ "$pt" = none ]; then result "$c" 'NOT TESTED' "no node core inside the stage before tap $i (steps: $path)"; return; fi
    mt "$n-$i" tap-point.yaml "P=$pt"; a="$(poll "$n-$i" 5 "$@")"; shot "$n-$i"; now="$(q "$n-$i" id-label "$sid")"
    path="$path -> tap $i at $pt -> $now"
    if [ "$a" != none ]; then result "$c" PASS "$what opened after $i node tap(s) ($path)"; return; fi
    if [ "$now" = "$was" ] || [ "$now" = none ]; then result "$c" FAIL "tap $i neither opened $what nor disclosed a deeper depth ($path)"; return; fi
    was="$now"
  done
  result "$c" FAIL "no $what after three node taps ($path)"
}
shared_enter() { mt "$1-launch" launch.yaml "NAME=gate-$1-launch" && mt "$1-seed" link.yaml URL=qandeel://s401-proof/shared-field/seed \
  && mt "$1-worlds" timed-text.yaml "NAME=gate-$1-shared" TAP=qandeel-switcher-shared_world "WAIT=$FIX" \
  && mt "$1-world" timed-tap-text.yaml "NAME=gate-$1-field" "TAP=$FIX" WAIT=qandeel-shared-band; }
if shared_enter s; then
  sleep 5; shot s-0; dump s-0
  w0="$(q s-0 id-label qandeel-shared-field-world:semantic-step)"
  # A single tap on empty FAR space steps IN (the Shared owner's tap at rung 0); it is not a double tap (diag run 44248838235).
  mt s-far tap-point.yaml "P=50%,24%"; sleep 2; dump s-far; shot s-far; w1="$(q s-far id-label qandeel-shared-field-world:semantic-step)"
  # The intended transition and its final state: the depth leaves FAR, and the stage's Back is there to return.
  if [ "$w0" != none ] && [ "$w1" != none ] && [ "$w1" != "$w0" ] && backOn s-far; then result S-FAR-TAP PASS "'$w0' -> '$w1'; Back available"
  else result S-FAR-TAP FAIL "'$w0' -> '$w1'$(backOn s-far || echo '; Back not available')"; fi
else result S-FAR-TAP 'NOT TESTED' 'the Shared Fixture Map World did not open'; fi
# S-TAP on a fresh entry: the FAR tap above may leave the stage over an empty region
if shared_enter st; then sleep 5; dump st-0; nodetap S-TAP st qandeel-shared-field-world:semantic-step 'the detail sheet' id cosmos-detail-sheet-handle
else result S-TAP 'NOT TESTED' 'the Shared Fixture Map World did not open again'; fi

if mt u-launch launch.yaml NAME=gate-u-launch && mt u-seed link.yaml URL=qandeel://s401-proof/public/seed \
  && mt u-enter tap.yaml ID=qandeel-switcher-public_world IDX=0 && mt u-allow link.yaml URL=qandeel://s401-proof/public/allow \
  && mt u-field wait-id.yaml ID=qandeel-public-search T=30000; then
  sleep 5; dump u-0; nodetap U-TAP u qandeel-public-field-world:semantic-step 'the Public panel' id-prefix qandeel-public-panel
else result U-TAP 'NOT TESTED' 'the Public field did not open'; fi

say "done"; cat "$RES" | tee -a "$LOG"
! grep -qv -e $'\tPASS\t' -e '^case' "$RES"
