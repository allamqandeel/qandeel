#!/bin/bash
# COSMOS-INT-01 Slice E — the UNMODIFIED iOS baseline audit (PO authorisation 2026-11-17). VALIDATION ONLY.
#
# Drives one booted simulator through the three Worlds, in English then Arabic (the simulator's own system language),
# and records EVERYTHING it sees: per step its exit status and duration, a simulator screenshot, the XCTest driver's view
# hierarchy, and a screen recording per scene. It never stops on a failed step and never retries one: a failed step is
# evidence (classified later as application, automation, infrastructure or access), not a reason to change anything.
# The app binary is installed by the caller and never modified here.
#
# usage: run-ios-audit.sh <MODE proof|product> <OUT dir> <UDID> <DEVICE label> <PASSES e.g. "core landscape enlarged">
#   proof   — the S401 proof-entry build of the integrated head (the HONOR proofs' route): the three Worlds over the
#             labelled SYNTHETIC proof network, reached with the proof network's own links.
#   product — the CI Product binary (unconfigured: no API origin); it can only show what it shows at launch.

MODE="$1"; OUT="$2"; UDID="$3"; DEVICE="$4"; PASSES="${5:-core}"
HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"
mkdir -p "$OUT"
STEPS="$OUT/steps.tsv"; TIM="$OUT/timings.tsv"; LOG="$OUT/runner.log"
printf 'pass\tlang\tscene\tstep\texit\tms\n' > "$STEPS"; printf 'pass\tlang\tname\tms\n' > "$TIM"
CUR="$OUT"; LANGX=-; SCENE=-; PASS=-; REC=

say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
now() { perl -MTime::HiRes=time -e 'printf "%d\n", time*1000'; }
# --quiet (the probes' mode) forwards NOTHING from the child's stdout; a flow step sets BQ= so its output reaches its log.
B() { node "$ROOT/scripts/validation/bounded-run.mjs" --seconds "$1" --fail-fast maestro-xctest-device-info-500 --label "$2" ${BQ---quiet} --out "$OUT/watchdog" -- "${@:3}"; }

# m <step> <flow> [KEY=VALUE ...] — one Maestro flow on the proven driver; its exit status, duration and TIMING lines.
m() {
  local name="$1" flow="$2"; shift 2
  local kv
  mkdir -p "$CUR/logs"
  local cmd=(maestro --device "$UDID" test)
  for kv in "$@"; do cmd+=(-e "$kv"); done
  # The flow's own output and Maestro's debug output (maestro.log carries the scripts' console.log TIMING lines).
  cmd+=("$F/$flow" --no-reinstall-driver --driver-host-port "$PORT" --debug-output "$CUR/logs/$name.d")
  local t0 t1 rc
  t0=$(now)
  BQ= B 240 "$PASS-$LANGX-$name" "${cmd[@]}" > "$CUR/logs/$name.log" 2>&1; rc=$?
  t1=$(now)
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$PASS" "$LANGX" "$SCENE" "$name" "$rc" "$((t1 - t0))" >> "$STEPS"
  cat "$CUR/logs/$name.log" $(find "$CUR/logs/$name.d" -name 'maestro.log' 2>/dev/null) | grep -o 'TIMING [^ ]* [0-9]*' | sort -u | while read -r _ n ms; do printf '%s\t%s\t%s\t%s\n' "$PASS" "$LANGX" "$n" "$ms" >> "$TIM"; done
  trim_debug "$CUR/logs/$name.d" "$rc"
  [ "$rc" = 0 ] && say "  ok   $name ($((t1 - t0)) ms)" || say "  FAIL $name exit $rc ($((t1 - t0)) ms)"
  return $rc
}
# Maestro's debug output is kept SMALL (run 44085259648 uploaded 3.8 GB and lost it all): the command timeline
# (commands-*.json) always, the last 400 lines of each maestro.log, and Maestro's own screenshots only for a failed step.
trim_debug() {
  local d="$1" rc="$2" f
  [ -d "$d" ] || return 0
  find "$d" -name 'maestro.log' | while read -r f; do tail -n 400 "$f" > "$f.tail" && rm -f "$f"; done
  find "$d" -type f -print0 | while IFS= read -r -d '' f; do
    case "$f" in */commands*.json|*.tail|*/manifest.json) ;; *.png) [ "$rc" = 0 ] && rm -f "$f" ;; *) rm -f "$f" ;; esac
  done
}
shot() { xcrun simctl io "$UDID" screenshot "$CUR/$1.png" >/dev/null 2>&1 || say "  (screenshot $1 failed)"; }
hier() {
  curl --silent --show-error --max-time 60 -X POST -H 'Content-Type: application/json' \
    --data '{"appIds":["com.qandeel.mobile"],"excludeKeyboardElements":false}' \
    "http://127.0.0.1:$PORT/viewHierarchy" > "$CUR/$1.json" 2>>"$LOG"
  if ! grep -q '"' "$CUR/$1.json" 2>/dev/null; then
    B 120 "hier-$1" maestro --device "$UDID" hierarchy --no-reinstall-driver > "$CUR/$1.json" 2>>"$LOG" || say "  (hierarchy $1 failed)"
  fi
}
# S <step> <flow> [KEY=VALUE ...] — a step with its evidence: the flow, then a settle, a screenshot and the hierarchy.
S() { local name="$1"; m "$@"; local rc=$?; sleep "${SETTLE:-2}"; shot "$name"; hier "$name"; return $rc; }
has() { grep -q "\"$1" "$CUR/$2.json" 2>/dev/null; }   # an id (prefix) present in a step's hierarchy
rec_start() { RECF="$CUR/$1.mp4"; xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$RECF" >/dev/null 2>&1 & REC=$!; sleep 1; }
# A recording of the ever-moving COSMOS canvas at the simulator's native size is ~1 GB per scene; each is transcoded to
# 960x540 with macOS's own avconvert (the original is kept only if that fails and it is under 300 MB).
rec_stop() {
  [ -n "$REC" ] || return 0
  kill -INT "$REC" 2>/dev/null; wait "$REC" 2>/dev/null; REC=
  local v="$RECF" small="${RECF%.mp4}-960.mp4"
  if avconvert --preset Preset960x540 --source "$v" --output "$small" --replace >/dev/null 2>&1 && [ -s "$small" ]; then
    say "  recording $(basename "$small"): $(du -h "$small" | cut -f1) (original $(du -h "$v" | cut -f1) removed)"; rm -f "$v"
  elif [ "$(du -m "$v" | cut -f1)" -lt 300 ]; then say "  recording kept at native size ($(du -h "$v" | cut -f1))"
  else say "  recording dropped: $(du -h "$v" | cut -f1) and avconvert failed"; rm -f "$v"; fi
}

driver_answers() {
  curl --fail --silent --max-time 10 "http://127.0.0.1:$PORT/status" >/dev/null || return 1
  local info; info="$(curl --fail --silent --max-time 110 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo")" || return 1
  case "$info" in *'"widthPoints"'*) echo "$info" > "$OUT/device-info.json"; return 0 ;; *) return 1 ;; esac
}
ready() {
  if B 480 "readiness-$1" maestro --device "$UDID" hierarchy --no-reinstall-driver --compact > /dev/null 2>&1 && driver_answers; then say "driver ready ($1)"; return 0; fi
  say "INFRASTRUCTURE: the driver did not prove ready ($1); one clean recovery"
  bash "$ROOT/scripts/validation/ios-driver-diagnostics.sh" "$UDID" > "$OUT/driver-diagnostics-$1.txt" 2>&1 || true
  pkill -f "test-without-building.*$UDID" || true
  xcrun simctl terminate "$UDID" dev.mobile.maestro-driver-iosUITests.xctrunner || true
  xcrun simctl uninstall "$UDID" dev.mobile.maestro-driver-iosUITests.xctrunner || true
  xcrun simctl shutdown "$UDID"; xcrun simctl boot "$UDID"; B 300 "reboot-$1" xcrun simctl bootstatus "$UDID" -b > /dev/null
  B 480 "readiness2-$1" maestro --device "$UDID" hierarchy --no-reinstall-driver --compact > /dev/null 2>&1 && driver_answers && { say "driver ready after recovery ($1)"; return 0; }
  say "INFRASTRUCTURE: driver still not ready ($1)"; return 1
}

# The simulator's OWN system language and region (the app follows the device locale; there is no in-app switch).
set_lang() {
  local tag="$1" locale="$2" P="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Preferences/.GlobalPreferences.plist"
  pkill -f "test-without-building.*$UDID" || true
  xcrun simctl shutdown "$UDID" 2>/dev/null
  plutil -replace AppleLanguages -json "[\"$tag\"]" "$P" && plutil -replace AppleLocale -string "$locale" "$P" || say "  (could not write the language to $P)"
  xcrun simctl boot "$UDID"; B 300 "boot-$tag" xcrun simctl bootstatus "$UDID" -b > /dev/null
  plutil -p "$P" | grep -A2 -E 'AppleLanguages|AppleLocale' >> "$LOG"
  ready "$tag"
}
text_size() { xcrun simctl ui "$UDID" content_size "$1" && say "content size: $1"; }

# Focus an object on the COSMOS stage: the accessible register first (the reader's accessible route), else a tap on the
# largest node core the screenshot shows (the reader's touch route). Records which route worked.
focus_object() {
  local name="$1" expect="$2"
  S "$name-register" tap.yaml "ID=qandeel-cosmos-register:.*" IDX=0
  if has "$expect" "$name-register"; then say "  focus: by the register"; return 0; fi
  local p; p="$(cd "$ROOT" && node "$HERE/nodes.mjs" --any "$CUR/$name-register.png")"
  say "  focus: register gave no $expect; node core at $p"
  [ "$p" = none ] && return 1
  S "$name-tap" tap-point.yaml "P=$p"
  has "$expect" "$name-tap" && { say "  focus: by a tap"; return 0; }
  S "$name-tap2" tap-point.yaml "P=$p"
  has "$expect" "$name-tap2" && { say "  focus: by a second tap (FAR discloses, then focuses)"; return 0; }
  return 1
}

FIX='.*(Fixture Map World|عالم الخريطة الاختباري).*'

personal() {
  SCENE=personal; say "== $PASS $LANGX personal"
  rec_start personal
  S p01-launch launch.yaml NAME=personal-cold-launch
  S p02-to-analysis timed-id.yaml NAME=personal-door TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail
  sleep 3; shot p02b-analysis-settled
  focus_object p03-inspect qandeel-personal-peek
  S p04-close swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  focus_object p05-reopen qandeel-personal-peek
  S p06-close swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  S p07-double-tap dtap-point.yaml "P=50%,48%"
  S p08-pan swipe.yaml "S=72%,48%" "E=28%,48%" D=700
  S p09-overview tap.yaml ID=qandeel-cosmos-overview IDX=0
  S p10-stage-back tap.yaml ID=qandeel-cosmos-back IDX=0
  S p11-moment tap.yaml "ID=qandeel-cosmos-timeline-rail:moment:.*" IDX=1
  S p12-follow-live tap.yaml ID=qandeel-cosmos-timeline-rail:live IDX=0
  S p13-ios-edge-swipe swipe.yaml "S=1%,50%" "E=75%,50%" D=350
  S p14-to-conversation timed-id.yaml NAME=personal-to-conversation TAP=qandeel-depth-to-conversation WAIT=qandeel-conversation-thread
  rec_stop
}

shared() {
  SCENE=shared; say "== $PASS $LANGX shared"
  S s00-launch launch.yaml NAME=shared-launch
  S s00-seed link.yaml URL=qandeel://s401-proof/shared-field/seed
  rec_start shared
  S s01-worlds timed-text.yaml NAME=shared-first-entry TAP=qandeel-switcher-shared_world "WAIT=$FIX"
  S s02-field timed-tap-text.yaml NAME=shared-open-world "TAP=$FIX" WAIT=qandeel-shared-band
  sleep 3; shot s02b-field-settled
  focus_object s03-focus qandeel-shared-panel-meaning
  S s04-expand swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=UP D=500
  S s05-scroll swipe.yaml "S=50%,82%" "E=50%,42%" D=600
  S s06-conversation scroll-tap.yaml ID=qandeel-shared-panel-conversation
  S s07-back-from-conversation tap.yaml ID=qandeel-shared-back IDX=0
  S s08-collapse swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  S s09-close swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  S s10-double-tap dtap-point.yaml "P=50%,50%"
  S s11-pan swipe.yaml "S=70%,50%" "E=30%,50%" D=700
  S s12-back tap.yaml ID=qandeel-shared-back IDX=0
  S s13-back-again tap.yaml ID=qandeel-shared-back IDX=0
  rec_stop
  # The empty field: a World with no places yet (the proof network's conversation seed).
  S s20-launch launch.yaml NAME=shared-empty-launch
  S s20-seed link.yaml URL=qandeel://s401-proof/conversation/seed
  S s21-worlds tap.yaml ID=qandeel-switcher-shared_world IDX=0
  S s22-world tap.yaml "ID=qandeel-shared-world-.*" IDX=0
  SETTLE=4 S s23-empty-field wait-id.yaml "ID=qandeel-shared-field-empty" T=30000
}

public() {
  SCENE=public; say "== $PASS $LANGX public"
  # Before the proof network seeds the field: the field's own state.
  S u00-launch launch.yaml NAME=public-unseeded-launch
  S u00-enter tap.yaml ID=qandeel-switcher-public_world IDX=0
  SETTLE=6 S u00-allow link.yaml URL=qandeel://s401-proof/public/allow
  # Seeded.
  S u01-launch launch.yaml NAME=public-launch
  S u01-seed link.yaml URL=qandeel://s401-proof/public/seed
  S u01-enter tap.yaml ID=qandeel-switcher-public_world IDX=0
  S u01-allow link.yaml URL=qandeel://s401-proof/public/allow
  SETTLE=4 S u01-field wait-id.yaml ID=qandeel-public-search T=30000
  rec_start public
  S u02-sections tap.yaml ID=qandeel-public-section-control IDX=0
  S u03-sections-expanded swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=UP D=500
  S u04-sections-scrolled swipe.yaml "S=50%,85%" "E=50%,35%" D=600
  S u05-section-chosen tap.yaml "ID=qandeel-public-section-[^c].*" IDX=3
  S u05b-close swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  S u05c-close swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  S u06-search type.yaml ID=qandeel-public-search "TEXT=ال"
  S u07-results-expanded swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=UP D=500
  S u08-results-scrolled swipe.yaml "S=50%,85%" "E=50%,35%" D=600
  S u09-result-selected tap.yaml "ID=qandeel-public-search-result-.*" IDX=0
  S u10-zero-results type.yaml ID=qandeel-public-search TEXT=zzzq
  S u10b-clear clear.yaml ID=qandeel-public-search
  focus_object u11-focus qandeel-public-panel
  S u12-expanded swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=UP D=500
  S u13-content-scrolled swipe.yaml "S=50%,85%" "E=50%,40%" D=600
  S u14-discussion scroll-tap.yaml ID=qandeel-public-panel-discussion
  S u15-discussion-scrolled swipe.yaml "S=50%,80%" "E=50%,45%" D=600
  S u16-discussion-back tap.yaml ID=qandeel-public-discussion-back IDX=0
  S u17-collapse swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  S u18-close swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=DOWN D=400
  S u19-double-tap dtap-point.yaml "P=50%,55%"
  S u20-pan swipe.yaml "S=70%,55%" "E=30%,55%" D=700
  rec_stop
}

# Personal -> Shared -> Public -> Personal, three cycles, then the reverse twice: time to the visible destination, then
# time to the destination's first interaction; evidence on every arrival (state kept or lost).
cross() {
  SCENE=cross; say "== $PASS $LANGX cross-world"
  S x00-launch launch.yaml NAME=cross-cold-launch
  S x00-seed1 link.yaml URL=qandeel://s401-proof/shared-field/seed
  S x00-seed2 link.yaml URL=qandeel://s401-proof/public/seed
  rec_start cross
  local i dest
  for i in 1 2 3 4 5; do
    if [ "$i" -le 3 ]; then dest="shared public personal"; else dest="public shared personal"; fi
    for w in $dest; do
      case "$w" in
        shared)
          S "x$i-shared" timed-id.yaml "NAME=to-shared-$i" TAP=qandeel-switcher-shared_world "WAIT=(qandeel-shared-worlds|qandeel-shared-band|qandeel-shared-title)"
          if has qandeel-shared-band "x$i-shared"; then say "  shared kept its open World"; else
            S "x$i-shared-act" timed-tap-text.yaml "NAME=shared-interact-$i" "TAP=$FIX" WAIT=qandeel-shared-band; fi ;;
        public)
          if [ "$i" = 1 ]; then
            m "x$i-public-tap" tap.yaml ID=qandeel-switcher-public_world IDX=0
            m "x$i-public-allow" link.yaml URL=qandeel://s401-proof/public/allow
            S "x$i-public" wait-id.yaml ID=qandeel-public-search T=30000
          else
            S "x$i-public" timed-id.yaml "NAME=to-public-$i" TAP=qandeel-switcher-public_world WAIT=qandeel-public-search
          fi
          S "x$i-public-act" timed-id.yaml "NAME=public-section-act-$i" TAP=qandeel-public-section-control "WAIT=qandeel-public-section-[^c].*"
          m "x$i-public-act-undo" tap.yaml ID=qandeel-public-section-control IDX=0 ;;
        personal)
          S "x$i-personal" timed-id.yaml "NAME=to-personal-$i" TAP=qandeel-switcher-my_world "WAIT=(qandeel-conversation-thread|qandeel-cosmos-timeline-rail)"
          if has qandeel-conversation-thread "x$i-personal"; then
            S "x$i-personal-act" timed-id.yaml "NAME=personal-door-$i" TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail; fi ;;
      esac
    done
  done
  rec_stop
}

landscape() {
  SCENE=landscape; say "== $PASS $LANGX landscape"
  S l01-launch launch.yaml NAME=landscape-launch
  S l02-conv-land orient.yaml O=LANDSCAPE_LEFT
  S l03-analysis-land timed-id.yaml NAME=landscape-door TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail
  S l04-portrait orient.yaml O=PORTRAIT
  S l05-seed link.yaml URL=qandeel://s401-proof/shared-field/seed
  S l06-shared tap.yaml ID=qandeel-switcher-shared_world IDX=0
  S l07-world tap-text.yaml "TEXT=$FIX" IDX=0
  S l08-shared-land orient.yaml O=LANDSCAPE_LEFT
  S l09-portrait orient.yaml O=PORTRAIT
}

enlarged() {
  SCENE=enlarged; say "== $PASS $LANGX enlarged text"
  personal_short() {
    S e01-launch launch.yaml NAME=enlarged-launch
    S e02-analysis timed-id.yaml NAME=enlarged-door TAP=qandeel-depth-to-analysis WAIT=qandeel-cosmos-timeline-rail
    focus_object e03-peek qandeel-personal-peek
  }
  personal_short
  S e04-seed link.yaml URL=qandeel://s401-proof/shared-field/seed
  S e05-shared tap.yaml ID=qandeel-switcher-shared_world IDX=0
  S e06-world tap-text.yaml "TEXT=$FIX" IDX=0
  focus_object e07-shared-peek qandeel-shared-panel-meaning
  S e08-shared-expanded swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=UP D=500
  S e09-public-seed link.yaml URL=qandeel://s401-proof/public/seed
  S e10-public tap.yaml ID=qandeel-switcher-public_world IDX=0
  S e11-allow link.yaml URL=qandeel://s401-proof/public/allow
  focus_object e12-public-peek qandeel-public-panel
  S e13-public-expanded swipe-id.yaml ID=cosmos-detail-sheet-handle DIR=UP D=500
  S e14-discussion scroll-tap.yaml ID=qandeel-public-panel-discussion
}

product() {
  SCENE=product; say "== $PASS $LANGX product binary"
  SETTLE=6 S b01-launch launch-product.yaml NAME=product-launch
  sleep 10; shot b02-after-10s; hier b02-after-10s
  S b03-landscape orient.yaml O=LANDSCAPE_LEFT
  S b04-portrait orient.yaml O=PORTRAIT
}

say "audit: mode=$MODE device=$DEVICE udid=$UDID passes=[$PASSES]"
xcrun simctl list devices "$UDID" >> "$LOG" 2>&1
for LANGPAIR in ${LANGS:-en-US:en_US ar-EG:ar_EG}; do
  tag="${LANGPAIR%%:*}"; loc="${LANGPAIR##*:}"; LANGX="${tag%%-*}"
  set_lang "$tag" "$loc" || { say "INFRASTRUCTURE: no driver for $tag; this language is NOT TESTED"; continue; }
  for PASS in $PASSES; do
    CUR="$OUT/$PASS-$LANGX"; mkdir -p "$CUR"
    case "$PASS" in
      core) personal; shared; public; cross ;;
      landscape) landscape ;;
      enlarged) text_size accessibility-extra-large; enlarged; text_size large ;;
      product) product; text_size accessibility-extra-large; PASS=product-enlarged; CUR="$OUT/$PASS-$LANGX"; mkdir -p "$CUR"; product; text_size large; PASS=product ;;
    esac
  done
done
say "done"
