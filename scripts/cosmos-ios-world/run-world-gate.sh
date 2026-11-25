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
#               the stretched rail beads used to stand over the stage and take the touch (diag run 44255421709). It is
#               never the stage's first touch: `initstage` (below) touches a freshly entered stage first (PO, 2026-11-23).
#   P-TAP       Personal: one tap on the largest node core opens the PEEK (`qandeel-personal-peek`).
#   F1-RESOLVED COSMOS-FINAL-01 F-1: that PEEK states the server's answer about the inspected object, not T-08's
#               technical "this view does not cover what you are inspecting" (the inspection-aware read).
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
# Maestro's own step output is kept in <OUT>/<name>.log (R9: with --quiet it was discarded, so gate 44321160183's failed
# p-door left an empty log and could not show whether its tap or its wait failed).
mt() { local n="$1" f="$2"; shift 2; local a=(); for kv in "$@"; do a+=(-e "$kv"); done
  node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 150 --label "$n" -- \
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
# enter <name>: a cold launch into the Conversation, an 8 s settle, then ONE tap on the Analysis door and its rail within
# 60 s. The settle is the native XCUITest entry's (R5, `toConversation`), applied here in R9 after gate 44321160183's
# p-door, tapped as soon as the thread appeared, did not reach the Analysis. It lets the gate measure what it is for, the
# stage's gestures. It is NOT evidence that an early tap works: that cold-launch observation stays open as SE-FU-1,
# owned by D-3 (contract §21.14). The tap is never retried; a failed door is recorded (screenshot and hierarchy).
enter() {
  mt "$1-launch" launch.yaml "NAME=gate-$1-launch" || return 1
  sleep 8
  mt "$1-door" timed-id.yaml "NAME=gate-$1-door" TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail ||
    { shot "$1-door-failed"; dump "$1-door-failed"; door_evidence "$1"; return 1; }
}
# door_evidence <name>: AFTER a failed door only (PO, 2026-11-21; DIAG-SE-DOOR run 44928574802 did not reproduce the SE
# failure of gate 44908792454 in 10 cycles), what tells a lost tap from a driver failure: Maestro's debug folder for that
# step (its command records carry each command's own timestamps and durations), the simulator's log of the Maestro XCTest
# driver and of the app's JavaScript for the last 5 minutes, and the wall-clock time this was taken. Nothing is recorded
# while a case runs (no video, no log stream), so the tap sequence, its waits and its timing are those of every other run.
door_evidence() {
  local d="$OUT/$1-door-evidence" m; mkdir -p "$d"; date -u +%Y-%m-%dT%H:%M:%SZ > "$d/taken-at.txt"
  m="$(sed -n '/==== Debug output/{n;p;}' "$OUT/$1-door.log" | tr -d '[:space:]')"
  [ -n "$m" ] && [ -d "$m" ] || m="$(ls -td "$HOME"/.maestro/tests/*/ 2>/dev/null | head -n 1)"
  [ -n "$m" ] && cp -R "$m" "$d/maestro" 2>/dev/null; echo "maestro debug folder: ${m:-none}" >> "$d/taken-at.txt"
  node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 90 --label "$1-door-log" -- xcrun simctl spawn "$UDID" log show --last 5m     --style ndjson --predicate 'process CONTAINS "maestro-driver" OR subsystem == "com.facebook.react.log"' > "$d/simulator-log.ndjson" 2> "$d/simulator-log.err"
  say "  $1-door evidence kept in $(basename "$d") (maestro: ${m:+kept})"
}
# tapcase <case> <name> <point> [f1]: one tap, then the PEEK within 6 s; the PEEK is closed by its handle afterwards.
# With f1 (COSMOS-FINAL-01 F-1): the PEEK's statement is the server's answer about the inspected object, read within 6 s
# of the PEEK opening. T-08's technical sentences for "no answer held" / "cannot be described" (either language) FAIL it.
F1_TECHNICAL='^(This view does not cover what you are inspecting\.|What you are inspecting cannot be described here\.|لا يشمل هذا العرض معاينتك\.|لا يمكن وصف معاينتك هنا\.)$'
tapcase() {
  mt "$2" tap-point.yaml "P=$3"; local a; a="$(poll "$2" 6 id qandeel-personal-peek)"; shot "$2"
  if [ "$a" != none ]; then
    result "$1" PASS "tap at $3 opened the PEEK"
    if [ "${4:-}" = f1 ]; then
      local s="" i; for i in 1 2 3 4 5 6; do dump "$2-f1"; s="$(q "$2-f1" id-label qandeel-personal-peek:statement)"
        [ "$s" != none ] && ! printf '%s' "$s" | grep -Eq "$F1_TECHNICAL" && break; sleep 1; done; shot "$2-f1"
      if [ "$s" = none ]; then result F1-RESOLVED 'NOT TESTED' 'the PEEK statement was not found'
      elif printf '%s' "$s" | grep -Eq "$F1_TECHNICAL"; then result F1-RESOLVED FAIL "the PEEK still says the technical sentence: $s"
      else result F1-RESOLVED PASS "the PEEK states the resolved inspection: $s"; fi
    fi
    mt "$2-close" tap.yaml ID=cosmos-detail-sheet-handle IDX=0; sleep 2
  else result "$1" FAIL "tap at $3: no qandeel-personal-peek within 6 s"; [ "${4:-}" = f1 ] && result F1-RESOLVED 'NOT TESTED' 'the PEEK did not open'; fi
}
# initstage <name>: NOT A CASE, and it writes no row to results.tsv (PO directive, 2026-11-23). The first touch a freshly
# entered Personal stage receives is the deferred first-tap limitation (SE-FU-1 class, Future Improvements item 022, not
# reopened): run 45124305240 (i17-ar) lost exactly that touch in P-TAP-RAIL while the identical tap 14 s later passed as
# P-TAP. So no required tap case is that touch. One initialization tap on the largest node core; its outcome goes to
# init.tsv and the log only. Then the state is restored (a PEEK it opened closed by its handle, the camera returned home
# by Back) and the preconditions the next case needs are verified on a fresh frame: no PEEK, Back absent (the home
# position), the depth rail laid out. When they do not hold it returns non-zero and the caller's cases are NOT TESTED,
# so the job stays red; after it, a tap the stage does not take still FAILs its case.
initstage() {
  local n="$1" pt a; shot "$n-init-0"; pt="$(node_at "$n-init-0")"
  if [ "$pt" = none ]; then printf '%s\tno node core for the initialization tap\n' "$n" >> "$OUT/init.tsv"; say "  $n init: no node core"; INIT_WHY="no node core for the initialization tap"; return 1; fi
  mt "$n-init" tap-point.yaml "P=$pt"; a="$(poll "$n-init" 6 id qandeel-personal-peek)"
  printf '%s\tinitialization tap at %s: %s\n' "$n" "$pt" "$([ "$a" != none ] && echo 'the PEEK opened' || echo 'no PEEK within 6 s (not judged)')" >> "$OUT/init.tsv"
  say "  $n init: tap at $pt ($(tail -n 1 "$OUT/init.tsv" | cut -f2))"
  # restoration: a PEEK (also one that answered late) is closed, and a camera off its home position is brought back
  sleep 2; dump "$n-init-1"
  [ "$(q "$n-init-1" id qandeel-personal-peek)" != none ] && { mt "$n-init-close" tap.yaml ID=cosmos-detail-sheet-handle IDX=0; sleep 2; dump "$n-init-1"; }
  backOn "$n-init-1" && { mt "$n-init-home" tap.yaml ID=qandeel-cosmos-back IDX=0; sleep 3; }
  # the preconditions, on a fresh frame
  dump "$n-init-2"; shot "$n-init-2"
  local why=""
  [ "$(q "$n-init-2" id qandeel-personal-peek)" = none ] || why="a PEEK is still open"
  backOn "$n-init-2" && why="${why:+$why; }the stage is not at home (Back available)"
  [ "$(q "$n-init-2" id qandeel-cosmos-rail)" != none ] || why="${why:+$why; }the depth rail is not laid out"
  if [ -n "$why" ]; then printf '%s\tpreconditions NOT restored: %s\n' "$n" "$why" >> "$OUT/init.tsv"; say "  $n init: preconditions NOT restored: $why"; INIT_WHY="$why"; return 1; fi
  printf '%s\tpreconditions restored: no PEEK, home, rail laid out\n' "$n" >> "$OUT/init.tsv"; return 0
}
# pancase <case> <name> <flow>: from a fresh home stage, one pan, then Back available
pancase() {
  enter "$2" || { result "$1" 'NOT TESTED' 'the Personal Analysis did not open'; return; }
  sleep 4; dump "$2-0"
  if backOn "$2-0"; then result "$1" 'NOT TESTED' 'the stage was not at home before the pan'; return; fi
  mt "$2" "$3"; sleep 2; dump "$2"; shot "$2"
  if backOn "$2"; then result "$1" PASS "the pan ($3) moved the camera off the centre (Back available)"; else result "$1" FAIL "after the pan ($3), Back is not available"; fi
}
# WORLD_GATE_SCOPE=COSMOS_CASES (the impact plan's functional scope, world-gate-impact.mjs): the change is confined to a
# surface the Analysis mounts that has its own mandatory iOS Targeted Gate (the live call). Only the COSMOS cases it can
# affect run, with the same functions and the same assertions: the Analysis entered with it mounted, then P-TAP and
# F1-RESOLVED on the initialized stage. Both must PASS. The other cases are not run: no row, so none is reported passed.
if [ "${WORLD_GATE_SCOPE:-FULL}" = COSMOS_CASES ]; then
  say "scope COSMOS_CASES: P-TAP and F1-RESOLVED only; the other Worlds, the pans and the native gestures do not run"
  # Its own evidence names (pc-*), so its dumps never mix with the full run's p-* ones.
  if ! enter pc; then
    for c in P-TAP F1-RESOLVED; do result "$c" 'NOT TESTED' 'the Personal Analysis did not open'; done
  elif sleep 5; ! initstage pc; then
    for c in P-TAP F1-RESOLVED; do result "$c" 'NOT TESTED' "the stage's initialization: $INIT_WHY"; done
  else
    shot pc-1; pt="$(node_at pc-1)"
    if [ "$pt" = none ]; then result P-TAP 'NOT TESTED' 'no node core visible on the Personal stage'; result F1-RESOLVED 'NOT TESTED' 'no node core to inspect'; else tapcase P-TAP pc-tap "$pt" f1; fi
  fi
  say "done (scope COSMOS_CASES)"; cat "$RES" | tee -a "$LOG"
  ! grep -qv -e $'\tPASS\t' -e '^case' "$RES" && grep -q $'^P-TAP\tPASS' "$RES" && grep -q $'^F1-RESOLVED\tPASS' "$RES"
  exit $?
fi
if ! enter p; then
  for c in P-TAP-RAIL P-TAP F1-RESOLVED P-PAN P-PAN-RAIL; do result "$c" 'NOT TESTED' 'the Personal Analysis did not open'; done
elif sleep 5; ! initstage p; then
  for c in P-TAP-RAIL P-TAP F1-RESOLVED; do result "$c" 'NOT TESTED' "the stage's initialization: $INIT_WHY"; done
  pancase P-PAN p-pan swipe-pan-open.yaml
  pancase P-PAN-RAIL p-panr swipe-pan-rail.yaml
else
  shot p-0; dump p-0
  rail="$(q p-0 id qandeel-cosmos-rail | head -1 | sed 's/.*frame=//')"; [ "$rail" = none ] && rail=
  say "  depth rail frame: ${rail:-none}"
  # P-TAP-RAIL on the restored home stage, after the initialization touch: the regression's own region
  if [ -z "$rail" ]; then result P-TAP-RAIL 'NOT TESTED' 'the depth rail was not found'
  else
    pt="$(cd "$ROOT" && node "$HERE/nodes.mjs" --in "$rail" "$OUT/p-0.png" "$wpt")"
    if [ "$pt" = none ]; then result P-TAP-RAIL 'NOT TESTED' "no node core inside the depth rail's frame ($rail)"; else tapcase P-TAP-RAIL p-tap-rail "$pt"; fi
  fi
  shot p-1; pt="$(node_at p-1)"
  if [ "$pt" = none ]; then result P-TAP 'NOT TESTED' 'no node core visible on the Personal stage'; result F1-RESOLVED 'NOT TESTED' 'no node core to inspect'; else tapcase P-TAP p-tap "$pt" f1; fi
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
    if [ "$pt" = none ]; then nt_result "$c" 'NOT TESTED' "no node core inside the stage before tap $i (steps: $path)"; return; fi
    mt "$n-$i" tap-point.yaml "P=$pt"; a="$(poll "$n-$i" 5 "$@")"; shot "$n-$i"; now="$(q "$n-$i" id-label "$sid")"
    path="$path -> tap $i at $pt -> $now"
    if [ "$a" != none ]; then nt_result "$c" PASS "$what opened after $i node tap(s) ($path)"; return; fi
    if [ "$now" = "$was" ] || [ "$now" = none ]; then nt_result "$c" FAIL "tap $i neither opened $what nor disclosed a deeper depth ($path)"; return; fi
    was="$now"
  done
  nt_result "$c" FAIL "no $what after three node taps ($path)"
}
# nt_result: nodetap's verdict, recorded as its case's result unless NT_QUIET is set (a coverage case that only needs the
# sheet open records its own verdict); NT_LAST / NT_DETAIL keep it for the caller.
nt_result() { NT_LAST="$2"; NT_DETAIL="$3"; [ -n "${NT_QUIET:-}" ] || result "$@"; }
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

# ── COSMOS-FINAL-01 coverage (PO decision 2026-11-20; contract §21.1 "Coverage") ─────────────────────────────────────
# S-EXPANDED    the Shared sheet S-TAP opened: its handle (offering "Show full details" because the content overflows
#               the PEEK) expands it — the sheet's top rises at least 40 pt and the handle then offers collapse.
# S-SOURCES     in that sheet the place's sources are listed, at least one, each with its attribution ("who: line").
# S-CONV-ENTRY  the panel's Conversation act opens the World's conversation (qandeel-shared-thread), SD-2.
# S-EMPTY / U-EMPTY  a Shared World with no places (knowledge/seed: a named World and its conversation only), and the
#               Public World whose served field holds no Experience (public/seed-empty, validation only), show
#               their empty field.
# P-LAND / S-LAND / U-LAND  with a sheet open in portrait the device turns to landscape: the app follows (its window
#               turns wider than tall), the sheet's handle stays on screen (Shared: EXPANDED fits too), and back in
#               portrait the sheet's handle is still on screen.
SHEET_EXPAND='^(Show full details|عرض التفاصيل كاملة)$'
SHEET_COLLAPSE='^(Show fewer details|تصغير التفاصيل)$'
SUMMER='.*(Fixture summer trip|رحلة الصيف الاختبارية).*'
y_of() { q "$1" id "$2" | head -1 | sed 's/.*frame=//' | cut -d, -f2; }
if grep -q $'^S-TAP\tPASS' "$RES"; then
  dump sx-0; shot sx-0; h0="$(q sx-0 id-label cosmos-detail-sheet-handle)"; t0="$(y_of sx-0 cosmos-detail-sheet)"; sd=sx-0
  if ! printf '%s' "$h0" | grep -Eq "$SHEET_EXPAND"; then
    result S-EXPANDED 'NOT TESTED' "the opened sheet offers no expansion (handle: '$h0'): its content does not overflow the PEEK"
  else
    mt sx-expand tap.yaml ID=cosmos-detail-sheet-handle IDX=0; sleep 2; dump sx-1; shot sx-1
    h1="$(q sx-1 id-label cosmos-detail-sheet-handle)"; t1="$(y_of sx-1 cosmos-detail-sheet)"
    if printf '%s' "$h1" | grep -Eq "$SHEET_COLLAPSE" && [ -n "$t0" ] && [ -n "$t1" ] && [ "$t1" != none ] && [ $((t0 - t1)) -ge 40 ]; then
      result S-EXPANDED PASS "sheet top $t0 -> $t1 pt; handle '$h0' -> '$h1'"; sd=sx-1
    else result S-EXPANDED FAIL "sheet top $t0 -> $t1 pt; handle '$h0' -> '$h1'"; fi
  fi
  src="$(q "$sd" id-prefix qandeel-shared-source-)"
  if [ "$src" = none ]; then result S-SOURCES FAIL "no source row in the opened sheet ($sd)"
  else
    n="$(printf '%s\n' "$src" | wc -l | tr -d ' ')"; first="$(printf '%s\n' "$src" | head -1 | cut -d' ' -f1)"
    who="$(q "$sd" id-label "$first" | head -1 | cut -d: -f1)"
    if [ -n "$who" ] && [ "$who" != none ]; then result S-SOURCES PASS "$n source row(s); the first attributed to '$who'"
    else result S-SOURCES FAIL "$n source row(s); the first carries no attribution"; fi
  fi
  if [ "$(q "$sd" id qandeel-shared-panel-conversation)" = none ]; then result S-CONV-ENTRY FAIL "the panel shows no Conversation act ($sd)"
  else
    mt sx-conv scroll-to-id.yaml ID=qandeel-shared-panel-conversation; a="$(poll sx-conv 10 id qandeel-shared-thread)"; shot sx-conv
    if [ "$a" != none ]; then result S-CONV-ENTRY PASS "the panel's Conversation act opened the World's conversation"
    else result S-CONV-ENTRY FAIL "no qandeel-shared-thread within 10 s of the panel's Conversation act"; fi
  fi
else for c in S-EXPANDED S-SOURCES S-CONV-ENTRY; do result "$c" 'NOT TESTED' 'the Shared sheet did not open (S-TAP)'; done; fi

# landcase <case> <name> <expand?>: the sheet is open in portrait; turn to landscape and back.
landcase() {
  local c="$1" n="$2" r w h hin back ok=1 x="" xl xin
  if ! mt "$n-l" orient.yaml O=LANDSCAPE_LEFT; then result "$c" 'NOT TESTED' 'the simulator could not be turned (Maestro setOrientation)'; return; fi
  sleep 3; dump "$n-l"; shot "$n-l"; r="$(q "$n-l" root)"; w="$(echo "$r" | cut -d, -f3)"; h="$(echo "$r" | cut -d, -f4)"
  hin="$(q "$n-l" inside cosmos-detail-sheet-handle | head -1)"; [ "$hin" = inside ] || ok=0
  if [ "${3:-}" = expand ] && q "$n-l" id-label cosmos-detail-sheet-handle | grep -Eq "$SHEET_EXPAND"; then
    mt "$n-lx" tap.yaml ID=cosmos-detail-sheet-handle IDX=0; sleep 2; dump "$n-lx"; shot "$n-lx"
    xl="$(q "$n-lx" id-label cosmos-detail-sheet-handle | head -1)"; xin="$(q "$n-lx" inside cosmos-detail-sheet-handle | head -1)"
    x="expanded in landscape: handle '$xl' $xin; "
    { printf '%s' "$xl" | grep -Eq "$SHEET_COLLAPSE" && [ "$xin" = inside ]; } || ok=0
  fi
  mt "$n-p" orient.yaml O=PORTRAIT; sleep 3; dump "$n-p"; shot "$n-p"; back="$(q "$n-p" inside cosmos-detail-sheet-handle | head -1)"
  # Gate 44694686720: a return to portrait that did not take left every later case on a landscape screen. One more
  # attempt when the window is still wider than tall; the case's own verdict is unchanged by it.
  local pr; pr="$(q "$n-p" root)"
  if [ "$pr" != none ] && [ "$(echo "$pr" | cut -d, -f3)" -gt "$(echo "$pr" | cut -d, -f4)" ]; then say "  $n: still landscape ($pr); turning upright again"; mt "$n-p2" orient.yaml O=PORTRAIT; sleep 3; fi
  [ "$back" = inside ] || ok=0
  if [ "$r" = none ] || [ -z "$w" ] || [ -z "$h" ] || [ "$w" -le "$h" ]; then result "$c" FAIL "the app did not turn to landscape (window $r)"
  elif [ "$ok" = 1 ]; then result "$c" PASS "landscape window $r: handle inside; ${x}portrait again: handle inside"
  else result "$c" FAIL "landscape window $r: handle $hin; ${x}portrait again: handle $back"; fi
}
NT_QUIET=1
if shared_enter sl; then sleep 5; dump sl-0; nodetap S-LAND sl qandeel-shared-field-world:semantic-step 'the detail sheet' id cosmos-detail-sheet-handle
  if [ "$NT_LAST" = PASS ]; then landcase S-LAND sl expand; else result S-LAND 'NOT TESTED' "the Shared sheet did not open: $NT_DETAIL"; fi
else result S-LAND 'NOT TESTED' 'the Shared Fixture Map World did not open'; fi
unset NT_QUIET

if mt u-launch launch.yaml NAME=gate-u-launch && mt u-seed link.yaml URL=qandeel://s401-proof/public/seed \
  && mt u-enter tap.yaml ID=qandeel-switcher-public_world IDX=0 && mt u-allow link.yaml URL=qandeel://s401-proof/public/allow \
  && mt u-field wait-id.yaml ID=qandeel-public-search T=30000; then
  sleep 5; dump u-0; nodetap U-TAP u qandeel-public-field-world:semantic-step 'the Public panel' id-prefix qandeel-public-panel
  if grep -q $'^U-TAP\tPASS' "$RES"; then landcase U-LAND u; else result U-LAND 'NOT TESTED' 'the Public panel did not open (U-TAP)'; fi
else result U-TAP 'NOT TESTED' 'the Public field did not open'; result U-LAND 'NOT TESTED' 'the Public field did not open'; fi

if mt se-launch launch.yaml NAME=gate-se-launch && mt se-seed link.yaml URL=qandeel://s401-proof/knowledge/seed \
  && mt se-worlds timed-text.yaml NAME=gate-se-shared TAP=qandeel-switcher-shared_world "WAIT=$SUMMER" \
  && mt se-world timed-tap-text.yaml NAME=gate-se-field "TAP=$SUMMER" WAIT=qandeel-shared-band; then
  a="$(poll se 15 id qandeel-shared-field-empty)"; shot se
  if [ "$a" != none ]; then result S-EMPTY PASS "a Shared World with no places shows its empty field: '$(q se id-label qandeel-shared-field-empty | head -1)'"
  else result S-EMPTY FAIL "no qandeel-shared-field-empty within 15 s in a World with no places"; fi
else result S-EMPTY 'NOT TESTED' 'the World with no places did not open'; fi
if mt ue-launch launch.yaml NAME=gate-ue-launch && mt ue-seed link.yaml URL=qandeel://s401-proof/public/seed-empty \
  && mt ue-enter tap.yaml ID=qandeel-switcher-public_world IDX=0 && mt ue-allow link.yaml URL=qandeel://s401-proof/public/allow \
  && mt ue-field wait-id.yaml ID=qandeel-public-search T=30000; then
  a="$(poll ue 15 id qandeel-public-field-empty)"; shot ue
  if [ "$a" != none ]; then result U-EMPTY PASS "a served Public field with no Experience shows its empty field: '$(q ue id-label qandeel-public-field-empty | head -1)'"
  else result U-EMPTY FAIL "no qandeel-public-field-empty within 15 s of a served field with no Experience"; fi
else result U-EMPTY 'NOT TESTED' 'the Public World did not open'; fi
# P-LAND's PEEK is opened by a tap that is not the stage's first touch either (gate 45072277036, small-en: the first
# tap after the entry opened no PEEK), so the same non-gating initialization comes first.
if enter pl; then
  sleep 5
  if ! initstage pl; then result P-LAND 'NOT TESTED' "the stage's initialization: $INIT_WHY"
  else
    shot pl-0; dump pl-0; pt="$(node_at pl-0)"
    if [ "$pt" = none ]; then result P-LAND 'NOT TESTED' 'no node core visible on the Personal stage'
    else
      mt pl-tap tap-point.yaml "P=$pt"; a="$(poll pl-tap 6 id qandeel-personal-peek)"
      if [ "$a" = none ]; then result P-LAND 'NOT TESTED' "tap at $pt opened no PEEK"; else landcase P-LAND pl; fi
    fi
  fi
else result P-LAND 'NOT TESTED' 'the Personal Analysis did not open'; fi

say "done"; cat "$RES" | tee -a "$LOG"
! grep -qv -e $'\tPASS\t' -e '^case' "$RES"
