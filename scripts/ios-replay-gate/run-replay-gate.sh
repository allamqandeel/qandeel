#!/bin/bash
# S8B-07 CP2-A.1 — the iOS Replay gate: the Replay of CP2-A.1 on the iOS simulator, driven by real touch, with assertions
# (BG-10; PO iOS validation policy of 2026-11-18). It drives the CP2-A.1 proof build (S807Cp2a1ProofRoot.tsx): the
# production Conversation and Replay over the S7-04 proof world, and the shipped Replay player with its original-audio
# surface over the labelled SYNTHETIC Replay Media Service and streaming player.
#
# Each case is PASS, FAIL or NOT TESTED in <OUT>/results.tsv, with its screenshot and hierarchy dump. A case whose
# precondition failed is NOT TESTED, never PASS. Nothing is retried. The run exits non-zero unless every case passed.
#
# Cases:
#   J-SAVED-LINE   R-1 / O-3: after a part is chosen and saved, the saved line says RS-01 (the S7-02 `savedPart`, verbatim).
#   J-OPEN-ACTION  its one action is RS-02 «فتح إعادة العرض» / "Open Replay".
#   J-OPENS-SAVED  that action opens the Replay player at once.
#   C-PLAY-THROUGH R-2 / O-4: from one Play, every moment of the part in order (1-2-3-5-6: text, audio, audio, text, audio
#                  of another recording), across every message boundary, to the end, with no second touch, and the place
#                  on the timeline never goes back or jumps while it plays.
#   C-TIMELINE     R-3 / O-5: one line of the whole part (the Replay's name, 22.5 s) under the moment.
#   C-SEEK-PLAYING a step on that line while playing (75% of the part: the pause before the second recording) lands on the
#                  second recording's moment (6), and the part goes on from there to its end unbroken.
#   C-SEEK-HELD    a step while held (50% of the part: inside the long turn, moment 3, 11.25 s) places the line there and
#                  holds it; Play goes on from that place.
# NOT TESTED here, by construction: what the native audio engine makes audible on iOS (the synthetic player plays nothing).
#
# usage: GATE_LANG=en|ar run-replay-gate.sh <OUT> <UDID>   (the app is installed; the simulator language is set; the driver is ready)
set -u
OUT="$1"; UDID="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; L="${GATE_LANG:-en}"
mkdir -p "$OUT"; LOG="$OUT/gate.log"; RES="$OUT/results.tsv"; printf 'case\tresult\tdetail\n' > "$RES"
say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
result() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$RES"; say "RESULT $1 $2 — $3"; }
mt() { local n="$1" f="$2"; shift 2; local a=(); for kv in "$@"; do a+=(-e "$kv"); done
  node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 240 --label "$n" -- \
    maestro --device "$UDID" test ${a[@]+"${a[@]}"} "$F/$f" --no-reinstall-driver --driver-host-port "$PORT" > "$OUT/$n.log" 2>&1; local rc=$?
  say "  maestro $n ($f) exit $rc"; return $rc; }
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1; }
dump() { curl --silent --max-time 30 -X POST -H 'Content-Type: application/json' \
  --data '{"appIds":["com.qandeel.mobile"],"excludeKeyboardElements":false}' "http://127.0.0.1:$PORT/viewHierarchy" > "$OUT/$1.json"; }
q() { node "$ROOT/scripts/cosmos-ios-world/hier.mjs" "$OUT/$1.json" "${@:2}"; }
# readout <name>: the proof readout's one line ("ord=… t=… dur=… play=… seeks=… visited=… cont=… max=… end=…"), or "none"
readout() { dump "$1"; q "$1" id-label irg-readout | head -n 1; }
field() { printf '%s\n' "$1" | tr ' ' '\n' | sed -n "s/^$2=//p"; }
# until_readout <name> <seconds> <awk condition on $ord $t $dur $play $seeks $end>: poll until it holds; prints the last line
until_readout() { local n="$1" s="$2" cond="$3" i r; for i in $(seq 1 "$s"); do r="$(readout "$n")"
    if [ "$r" != none ] && printf '%s\n' "$r" | awk -v c="$cond" '{ for (i = 1; i <= NF; i++) { split($i, kv, "="); v[kv[1]] = kv[2] } }
      END { ord = v["ord"]; t = v["t"]; dur = v["dur"]; play = v["play"]; seeks = v["seeks"]; end = v["end"]; cont = v["cont"];
            if (c == "audio") exit !(ord + 0 >= 2 && dur != "-");
            if (c == "ended") exit !(end == "1");
            if (c == "held") exit !(play == "0");
            if (c == "seek6") exit !(seeks == "1" && ord == "6");
            if (c == "seek3") exit !(seeks == "1" && ord == "3" && play == "0");
            exit 1 }'; then echo "$r"; return 0; fi; sleep 1; done; echo "${r:-none}"; return 1; }
# line_point <name> <logical fraction>: the screen point ("x%,y%") of that fraction of the timeline line, read from the
# hierarchy. The line runs from the reader's start: right to left in Arabic.
line_point() { local f="$2" fr root; dump "$1"
  fr="$(q "$1" id qandeel-replay-audio-timeline-line | head -n 1 | sed -n 's/.*frame=\([0-9,.-]*\).*/\1/p')"; root="$(q "$1" root)"
  [ -n "$fr" ] && [ "$root" != none ] || { echo none; return 1; }
  node -e 'const [f, fr, root, lang] = process.argv.slice(1); const [x, y, w, h] = fr.split(",").map(Number); const [rx, ry, rw, rh] = root.split(",").map(Number);
    const v = lang === "ar" ? 1 - Number(f) : Number(f); const px = ((x + v * w) - rx) / rw * 100, py = ((y + h / 2) - ry) / rh * 100;
    process.stdout.write(`${px.toFixed(1)}%,${py.toFixed(1)}%`)' "$f" "$fr" "$root" "$L"; }

if [ "$L" = ar ]; then RS01='^حُفظ الجزء المختار لإعادة العرض\.'; RS02='فتح إعادة العرض'; NAME='إعادة عرض المحادثة'
else RS01='^The selected part was saved for a Replay\.'; RS02='Open Replay'; NAME='Conversation replay'; fi
say "language=$L"

# ── Journey (R-1 / O-3) ─────────────────────────────────────────────────────────────────────────────────────────────
U1='qandeel-selectable-00000000-0000-4000-8000-000000000001'; R2='qandeel-selectable-00000000-0000-4000-8000-000000000004'
journey() {
  mt j-launch launch.yaml || { JWHY='the proof build did not launch to its chooser'; return 1; }
  mt j-choose tap.yaml ID=irg-choose-journey && mt j-thread wait-id.yaml ID=qandeel-conversation-thread MS=180000 || { JWHY='the Conversation did not appear'; return 1; }
  sleep 8
  mt j-entry tap.yaml ID=qandeel-replay-entry && mt j-choose-part tap.yaml ID=qandeel-replay-choose-part || { JWHY='the Replay entry or "choose a part" did not take the tap'; return 1; }
  sleep 1; dump j-selectables; q j-selectables id-prefix qandeel-selectable- > "$OUT/j-selectables.txt"
  mt j-first reveal-tap.yaml "ID=$U1" DIR=UP && mt j-last reveal-tap.yaml "ID=$R2" DIR=DOWN || { JWHY="the part's first or last message could not be chosen (see j-selectables.txt)"; return 1; }
  mt j-save tap.yaml ID=qandeel-replay-save || { JWHY='Save did not take the tap'; return 1; }
  return 0
}
JWHY=''
if journey; then
  line=none; for i in $(seq 1 15); do dump j-saved; line="$(q j-saved label "$RS01")"; [ "$line" != none ] && break; sleep 1; done; shot j-saved
  if [ "$line" != none ]; then result J-SAVED-LINE PASS "the saved line says RS-01: $line"; else result J-SAVED-LINE FAIL 'no RS-01 line within 15 s of Save'; fi
  action="$(q j-saved id-label qandeel-replay-preview)"
  if [ "$action" = "$RS02" ]; then result J-OPEN-ACTION PASS "its action is RS-02: $action"
  elif [ "$action" = none ]; then result J-OPEN-ACTION FAIL 'the saved line has no action'
  else result J-OPEN-ACTION FAIL "its action says \"$action\", not RS-02"; fi
  if [ "$action" != none ]; then
    mt j-open tap.yaml ID=qandeel-replay-preview
    if mt j-player wait-id.yaml ID=qandeel-replay-player MS=15000; then shot j-player; result J-OPENS-SAVED PASS 'the action opened the Replay player'
    else shot j-player-failed; dump j-player-failed; result J-OPENS-SAVED FAIL 'no Replay player within 15 s of the action'; fi
  else result J-OPENS-SAVED 'NOT TESTED' 'there was no action to tap'; fi
else
  shot j-failed; dump j-failed
  for c in J-SAVED-LINE J-OPEN-ACTION J-OPENS-SAVED; do result "$c" 'NOT TESTED' "precondition: $JWHY"; done
fi

# ── Continuous (R-2 / O-4, R-3 / O-5) ──────────────────────────────────────────────────────────────────────────────
# open <name>: a cold launch into the continuous scene, the player shown, then Play and the first audio moment reached.
open_and_play() {
  mt "$1-launch" launch.yaml && mt "$1-choose" tap.yaml ID=irg-choose-continuous && mt "$1-player" wait-id.yaml ID=qandeel-replay-play MS=60000 || return 1
  sleep 3; mt "$1-play" tap.yaml ID=qandeel-replay-play || return 1
  until_readout "$1-audio" 30 audio > "$OUT/$1-audio.txt" || return 1
}

if open_and_play c1; then
  shot c1-audio; dump c1-timeline
  tl="$(q c1-timeline id-label qandeel-replay-audio-timeline-line)"; r="$(cat "$OUT/c1-audio.txt")"
  if [ "$tl" = "$NAME" ] && [ "$(field "$r" dur)" = 22.5 ]; then result C-TIMELINE PASS "one line of the whole part, \"$tl\", $(field "$r" dur) s"
  else result C-TIMELINE FAIL "timeline label \"$tl\" (expected \"$NAME\"), duration $(field "$r" dur) s (expected 22.5)"; fi
  r="$(until_readout c1-end 60 ended)"; shot c1-end; echo "$r" > "$OUT/c1-end.txt"
  if [ "$(field "$r" end)" = 1 ] && [ "$(field "$r" visited)" = 1-2-3-5-6 ] && [ "$(field "$r" cont)" = OK ] && [ "$(field "$r" seeks)" = 0 ]; then
    result C-PLAY-THROUGH PASS "one Play: $r"
  else result C-PLAY-THROUGH FAIL "expected end=1 visited=1-2-3-5-6 cont=OK seeks=0; read: $r"; fi
else
  shot c1-failed; dump c1-failed
  result C-TIMELINE 'NOT TESTED' 'precondition: the continuous player did not open, play or reach its first audio moment'
  result C-PLAY-THROUGH 'NOT TESTED' 'precondition: the continuous player did not open, play or reach its first audio moment'
fi

if open_and_play c2; then
  p="$(line_point c2-line 0.75)"
  if [ "$p" = none ]; then result C-SEEK-PLAYING 'NOT TESTED' 'the timeline line was not found'
  else
    mt c2-step tap-point.yaml "P=$p"; r="$(until_readout c2-seek 6 seek6)"; ok=$?; shot c2-seek; echo "$r" > "$OUT/c2-seek.txt"
    if [ $ok -ne 0 ]; then result C-SEEK-PLAYING FAIL "a step at 75% ($p) did not land on moment 6 within 6 s: $r"
    else r="$(until_readout c2-end 40 ended)"; shot c2-end
      if [ "$(field "$r" end)" = 1 ] && [ "$(field "$r" cont)" = OK ]; then result C-SEEK-PLAYING PASS "step at $p -> moment 6, then to the end unbroken: $r"
      else result C-SEEK-PLAYING FAIL "after the step the part did not end unbroken: $r"; fi
    fi
  fi
else shot c2-failed; result C-SEEK-PLAYING 'NOT TESTED' 'precondition: the continuous player did not open, play or reach its first audio moment'; fi

if open_and_play c3; then
  mt c3-pause tap.yaml ID=qandeel-replay-play; r="$(until_readout c3-held 10 held)"
  p="$(line_point c3-line 0.5)"
  if [ "$(field "$r" play)" != 0 ] || [ "$p" = none ]; then result C-SEEK-HELD 'NOT TESTED' "precondition: held ($r), line point ($p)"
  else
    mt c3-step tap-point.yaml "P=$p"; r="$(until_readout c3-seek 6 seek3)"; ok=$?; shot c3-seek; t1="$(field "$r" t)"
    sleep 2; r2="$(readout c3-still)"; t2="$(field "$r2" t)"
    within="$(node -e 'const t = Number(process.argv[1]); process.stdout.write(t >= 10.6 && t <= 11.9 ? "yes" : "no")' "$t1")"
    if [ $ok -ne 0 ] || [ "$within" != yes ] || [ "$t1" != "$t2" ]; then
      result C-SEEK-HELD FAIL "a step at 50% ($p) while held: expected moment 3 at 10.6..11.9 s, held; read: $r, then $r2"
    else
      mt c3-play tap.yaml ID=qandeel-replay-play; sleep 4; r3="$(readout c3-on)"
      on="$(node -e 'process.stdout.write(Number(process.argv[2]) > Number(process.argv[1]) + 1 ? "yes" : "no")' "$t1" "$(field "$r3" t)")"
      r4="$(until_readout c3-end 40 ended)"; shot c3-end
      if [ "$on" = yes ] && [ "$(field "$r4" end)" = 1 ] && [ "$(field "$r4" cont)" = OK ]; then
        result C-SEEK-HELD PASS "held at $t1 s on moment 3; Play went on ($(field "$r3" t) s) to the end unbroken: $r4"
      else result C-SEEK-HELD FAIL "Play after the held step: $r3; end: $r4"; fi
    fi
  fi
else shot c3-failed; result C-SEEK-HELD 'NOT TESTED' 'precondition: the continuous player did not open, play or reach its first audio moment'; fi

result IOS-NATIVE-AUDIO 'NOT TESTED' 'by construction: the synthetic player plays nothing audible; the native audio is the device pass'"'"'s (HONOR / iPhone)'
say "done"
# NOT TESTED by construction is recorded, not judged: the gate passes when every case it can test passed.
! tail -n +2 "$RES" | grep -v '^IOS-NATIVE-AUDIO' | awk -F'\t' '$2 != "PASS"' | grep -q .
