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
#   C-TIMELINE     R-3 / O-5 (PO direction of 2026-11-27: before the first Play): one line of the whole part (the Replay's
#                  name, 22.5 s), at its start, before anything is played.
#   C-PLAY-THROUGH R-2 / O-4: from one Play, every moment of the part in order (1-2-3-5-6: text, audio, audio, text, audio
#                  of another recording), across every message boundary, to the end, with no second touch, and the place
#                  on the timeline never goes back or jumps while it plays.
#   C-SEEK-PLAYING while playing, a step BACK (25% of the part, inside moment 2) and then FORWARD (90%, inside the second
#                  recording, moment 6) each land where the touch was (judged from the point actually tapped), and the
#                  part goes on from there to its end unbroken. Its precondition, read from the readout's `at` (the
#                  player's state at each touch): the step back was taken while playing in the long turn (moment 3,
#                  7.5-12.5 s), the step forward while playing before 90%. A touch Maestro delivered too late for that
#                  (run 46037104976, i17-ar: after the end) leaves the case NOT TESTED with its timing, never PASS.
#   C-SEEK-HELD    held (Pause part-way), a step into the text moment 5 (60%), then BACK (50%, inside the long turn,
#                  moment 3) and FORWARD (80%, moment 6) are each drawn where the touch was and stay there, every touch
#                  taken held; Play goes on from the last to the end. Where the Pause falls does not matter (run
#                  46037104976, i17-ar: Maestro's Pause fell in moment 6, after moment 5 had been read).
#   C-SEEK-BEFORE-PLAY before any Play, a step (50%, moment 3) is drawn there with nothing playing; Play goes on from it.
# NOT TESTED here, by construction: what the native audio engine makes audible on iOS (the synthetic player plays nothing).
#
# A Maestro start takes 10-30 s on the runner, longer than the part itself: every timed sequence (Play, a moment
# reached, a step) is ONE flow, and the runner judges from the readout afterwards (S8B-07 record §21.9, run 46007215812).
#
# usage: GATE_LANG=en|ar run-replay-gate.sh <OUT> <UDID>   (the app is installed; the simulator language is set; the driver is ready)
set -u
OUT="$1"; UDID="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; L="${GATE_LANG:-en}"
mkdir -p "$OUT"; LOG="$OUT/gate.log"; RES="$OUT/results.tsv"; printf 'case\tresult\tdetail\n' > "$RES"
# say, result (one row per case, its detail on one line) and validate_results (the exact case set)
. "$HERE/results.sh"
CASES=(J-SAVED-LINE J-OPEN-ACTION J-OPENS-SAVED C-TIMELINE C-PLAY-THROUGH C-SEEK-PLAYING C-SEEK-HELD C-SEEK-BEFORE-PLAY IOS-NATIVE-AUDIO)
# mt <name> <flow> [KEY=value]...: one Maestro flow. A timed sequence ("*-steps") also keeps Maestro's own command
# timing (<name>.timing.txt: each command's kind, status, start and duration; no screen content).
mt() { local n="$1" f="$2"; shift 2; local a=() d=(); for kv in "$@"; do a+=(-e "$kv"); done
  case "$n" in *-steps) d=(--debug-output "$OUT/maestro/$n" --flatten-debug-output);; esac
  node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 240 --label "$n" -- \
    maestro --device "$UDID" test ${a[@]+"${a[@]}"} ${d[@]+"${d[@]}"} "$F/$f" --no-reinstall-driver --driver-host-port "$PORT" > "$OUT/$n.log" 2>&1; local rc=$?
  say "  maestro $n ($f) exit $rc"
  if [ ${#d[@]} -gt 0 ]; then node "$HERE/maestro-timing.mjs" "$OUT/maestro/$n" > "$OUT/$n.timing.txt"; sed 's/^/    timing: /' "$OUT/$n.timing.txt" | tee -a "$LOG"; fi
  return $rc; }
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1; }
dump() { curl --silent --max-time 30 -X POST -H 'Content-Type: application/json' \
  --data '{"appIds":["com.qandeel.mobile"],"excludeKeyboardElements":false}' "http://127.0.0.1:$PORT/viewHierarchy" > "$OUT/$1.json"; }
q() { node "$ROOT/scripts/cosmos-ios-world/hier.mjs" "$OUT/$1.json" "${@:2}"; }
# readout <name>: the proof readout's one line ("ord=… t=… dur=… play=… seeks=… lands=… at=… visited=… cont=… max=… end=…"), or "none"
readout() { dump "$1"; q "$1" id-label irg-readout | head -n 1; }
field() { printf '%s\n' "$1" | tr ' ' '\n' | sed -n "s/^$2=//p"; }
# land <reading> <i>: the i-th step's landing place (s), or "x"
land() { field "$1" lands | tr ',' '\n' | sed -n "${2}p"; }
# until_ended <name> <seconds>: poll until the part reports its end; prints the last reading
until_ended() { local n="$1" s="$2" i r=none; for i in $(seq 1 "$s"); do r="$(readout "$n")"
    [ "$(field "$r" end)" = 1 ] && { echo "$r"; return 0; }; sleep 1; done; echo "$r"; return 1; }
# near <got s> <expected ms> <below s> <above s>: "yes" when expected - below <= got <= expected + above
near() { node -e 'const [g, e, b, a] = process.argv.slice(1).map(Number); process.stdout.write(Number.isFinite(g) && g >= e / 1000 - b && g <= e / 1000 + a ? "yes" : "no")' "$1" "$2" "$3" "$4"; }
later() { node -e 'process.stdout.write(Number(process.argv[2]) > Number(process.argv[1]) + 1 ? "yes" : "no")' "$1" "$2"; }
# taken_playing <at> <forward ms>: C-SEEK-PLAYING's precondition, from the player's state at its two touches ("p"/"h" and
# the place, s). "ok": the step back was taken while playing in the long turn (moment 3: 7.5-12.5 s of the fixture part)
# and the step forward while playing before its target; "late": a touch came after that window or after the end (h at
# 22.5); "stopped": a touch found the part held part-way although nothing paused it; "none": not two touches.
taken_playing() { node -e 'const [at, fe] = process.argv.slice(1); const a = at.split(",").filter((s) => /^[ph][0-9.]+$/u.test(s)).map((s) => ({ p: s[0] === "p", t: Number(s.slice(1)) }));
    let v = "ok";
    if (a.length !== 2) v = "none";
    else if (!a[0].p && a[0].t >= 22.5) v = "late";
    else if (!a[0].p || !a[1].p) v = "stopped";
    else if (a[0].t < 7.5 || a[0].t >= 12.5 || a[1].t >= Number(fe) / 1000) v = "late";
    process.stdout.write(v)' "$1" "$2"; }
# all_held <at> <n>: "yes" when there were n touches and every one found the part held
all_held() { node -e 'const [at, n] = process.argv.slice(1); const a = at.split(","); process.stdout.write(a.length === Number(n) && a.every((s) => /^h[0-9.]+$/u.test(s)) ? "yes" : "no")' "$1" "$2"; }
# line_point <name> <logical fraction>: "x%,y% ms" — the whole-percent screen point (Maestro takes no decimals there) of
# that fraction of the timeline, and the part's instant that point really is, as the line computes it from the touch
# (ReplayTimelineBar: REPLAY_TIMELINE_INSET, 8, at each end — CP2-A.1 correction round; from the reader's start, right to left in Arabic).
line_point() { local f="$2" fr root; dump "$1"
  fr="$(q "$1" id qandeel-replay-timeline-line | head -n 1 | sed -n 's/.*frame=\([0-9,.-]*\).*/\1/p')"; root="$(q "$1" root)"
  [ -n "$fr" ] && [ "$root" != none ] || { echo none; return 1; }
  node -e 'const [f, fr, root, lang] = process.argv.slice(1); const [x, y, w, h] = fr.split(",").map(Number); const [rx, ry, rw, rh] = root.split(",").map(Number);
    const A = 8, width = Math.floor(w), run = width - 2 * A, ar = lang === "ar";
    const logical = A + Number(f) * run, sx = ar ? x + width - logical : x + logical;
    const px = Math.round((sx - rx) / rw * 100), py = Math.round(((y + h / 2) - ry) / rh * 100);
    const tx = rx + px / 100 * rw - x, back = ar ? width - tx : tx, at = Math.min(1, Math.max(0, (back - A) / run));
    process.stdout.write(`${px}%,${py}% ${Math.round(at * 22500)}`)' "$f" "$fr" "$root" "$L"; }

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
  mt j-first reveal-up.yaml "ID=$U1" && mt j-last reveal-down.yaml "ID=$R2" || { JWHY="the part's first or last message could not be chosen (see j-selectables.txt)"; return 1; }
  mt j-save tap.yaml ID=qandeel-replay-save || { JWHY='Save did not take the tap'; return 1; }
  return 0
}
JWHY=''
if journey; then
  line=none; for i in $(seq 1 15); do dump j-saved; line="$(q j-saved label "$RS01")"; [ "$line" != none ] && break; sleep 1; done; shot j-saved
  # More than one label may carry RS-01 (the line and its accessible container): the first is quoted, the rest counted.
  if [ "$line" != none ]; then result J-SAVED-LINE PASS "the saved line says RS-01: $(printf '%s\n' "$line" | head -n 1) ($(printf '%s\n' "$line" | grep -c .) matching label(s))"; else result J-SAVED-LINE FAIL 'no RS-01 line within 15 s of Save'; fi
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
# open_player <name>: a cold launch into the continuous scene, the player shown with its timeline read (nothing played).
open_player() {
  mt "$1-launch" launch.yaml && mt "$1-choose" tap.yaml ID=irg-choose-continuous && mt "$1-player" wait-id.yaml ID=qandeel-replay-play MS=60000 \
    && mt "$1-ready" wait-readout.yaml 'RE=ord=1 t=0.0 dur=22.5 play=0 .*' MS=60000
}
NOPEN='precondition: the continuous player did not open with its timeline'

if open_player c1; then
  shot c1-before-play; dump c1-timeline
  tl="$(q c1-timeline id-label qandeel-replay-timeline-line)"; r="$(readout c1-ready)"
  if [ "$tl" = "$NAME" ] && [ "$(field "$r" dur)" = 22.5 ] && [ "$(field "$r" t)" = 0.0 ] && [ "$(field "$r" play)" = 0 ]; then
    result C-TIMELINE PASS "before the first Play: one line of the whole part, \"$tl\", $(field "$r" dur) s, at 0.0"
  else result C-TIMELINE FAIL "before the first Play: timeline label \"$tl\" (expected \"$NAME\"); read: $r"; fi
  mt c1-play tap.yaml ID=qandeel-replay-play
  r="$(until_ended c1-end 90)"; shot c1-end; echo "$r" > "$OUT/c1-end.txt"
  if [ "$(field "$r" end)" = 1 ] && [ "$(field "$r" visited)" = 1-2-3-5-6 ] && [ "$(field "$r" cont)" = OK ] && [ "$(field "$r" seeks)" = 0 ]; then
    result C-PLAY-THROUGH PASS "one Play: $r"
  else result C-PLAY-THROUGH FAIL "expected end=1 visited=1-2-3-5-6 cont=OK seeks=0; read: $r"; fi
else
  shot c1-failed; dump c1-failed
  result C-TIMELINE 'NOT TESTED' "$NOPEN"; result C-PLAY-THROUGH 'NOT TESTED' "$NOPEN"
fi

if open_player c2; then
  b="$(line_point c2-line 0.25)"; f="$(line_point c2-line2 0.9)"
  if [ "$b" = none ] || [ "$f" = none ]; then result C-SEEK-PLAYING 'NOT TESTED' 'the timeline line was not found'
  else
    bp="${b% *}"; be="${b#* }"; fp="${f% *}"; fe="${f#* }"
    mt c2-steps seek-playing.yaml "P1=$bp" "P2=$fp"; rc=$?; shot c2-steps
    r="$(until_ended c2-end 60)"; shot c2-end; echo "$r" > "$OUT/c2-end.txt"
    l1="$(land "$r" 1)"; l2="$(land "$r" 2)"; pre="$(taken_playing "$(field "$r" at)" "$fe")"
    if [ "$pre" = late ]; then result C-SEEK-PLAYING 'NOT TESTED' "precondition: Maestro delivered the touches too late for a step back from the long turn and forward before 90% while playing (at=$(field "$r" at); its timing in c2-steps.timing.txt): $r"
    elif [ "$pre" = stopped ]; then result C-SEEK-PLAYING FAIL "a touch found the part held although nothing paused it and it had not ended (at=$(field "$r" at)): $r"
    elif [ $rc -ne 0 ]; then result C-SEEK-PLAYING FAIL "the steps at $bp / $fp were not both taken and landed while playing (see c2-steps.log): $r"
    elif [ "$(near "$l1" "$be" 0.25 1.0)" = yes ] && [ "$(near "$l2" "$fe" 0.25 1.0)" = yes ] && [ "$(field "$r" seeks)" = 2 ] \
      && printf '%s' "$(field "$r" visited)" | grep -Eq -- '-3-2-(3-)?6$' && [ "$(field "$r" end)" = 1 ] && [ "$(field "$r" cont)" = OK ]; then
      result C-SEEK-PLAYING PASS "back at $bp -> $l1 s (asked ${be} ms), forward at $fp -> $l2 s (asked ${fe} ms), then to the end unbroken: $r"
    else result C-SEEK-PLAYING FAIL "back at $bp (asked ${be} ms) / forward at $fp (asked ${fe} ms) while playing: $r"; fi
  fi
else shot c2-failed; result C-SEEK-PLAYING 'NOT TESTED' "$NOPEN"; fi

if open_player c3; then
  m="$(line_point c3-line0 0.6)"; b="$(line_point c3-line 0.5)"; f="$(line_point c3-line2 0.8)"
  if [ "$m" = none ] || [ "$b" = none ] || [ "$f" = none ]; then result C-SEEK-HELD 'NOT TESTED' 'the timeline line was not found'
  else
    mp="${m% *}"; te="${m#* }"; bp="${b% *}"; be="${b#* }"; fp="${f% *}"; fe="${f#* }"
    mt c3-steps seek-held.yaml "P0=$mp" "P1=$bp" "P2=$fp"; rc=$?; shot c3-steps
    r="$(readout c3-held)"; sleep 2; r2="$(readout c3-still)"
    l0="$(land "$r" 1)"; l1="$(land "$r" 2)"; l2="$(land "$r" 3)"; t1="$(field "$r" t)"
    if [ $rc -ne 0 ]; then result C-SEEK-HELD FAIL "held, the steps at $mp / $bp / $fp were not all taken and landed (see c3-steps.log, c3-steps.timing.txt): $r"
    elif [ "$(field "$r" play)" != 0 ] || [ "$(field "$r" ord)" != 6 ] || [ "$(field "$r" seeks)" != 3 ] || [ "$(all_held "$(field "$r" at)" 3)" != yes ] \
      || [ "$(near "$l0" "$te" 0.3 0.3)" != yes ] || [ "$(near "$l1" "$be" 0.3 0.3)" != yes ] || [ "$(near "$l2" "$fe" 0.3 0.3)" != yes ] \
      || [ "$(near "$t1" "$fe" 0.3 0.3)" != yes ] || [ "$(field "$r2" t)" != "$t1" ] || ! printf '%s' "$(field "$r" visited)" | grep -Eq -- '-5-3-6$'; then
      result C-SEEK-HELD FAIL "held: into moment 5 at $mp (asked ${te} ms), back at $bp (asked ${be} ms), forward at $fp (asked ${fe} ms), every touch held, expected moment 6 held there; read: $r, then $r2"
    else
      mt c3-play tap.yaml ID=qandeel-replay-play; sleep 3; r3="$(readout c3-on)"
      r4="$(until_ended c3-end 40)"; shot c3-end
      if [ "$(later "$t1" "$(field "$r3" t)")" = yes ] && [ "$(field "$r4" end)" = 1 ] && [ "$(field "$r4" cont)" = OK ]; then
        result C-SEEK-HELD PASS "held ($(field "$r" at)): into moment 5 -> $l0 s, back -> $l1 s, forward -> $l2 s, held at $t1 s on moment 6; Play went on ($(field "$r3" t) s) to the end unbroken: $r4"
      else result C-SEEK-HELD FAIL "Play after the held steps (held at $t1 s): $r3; end: $r4"; fi
    fi
  fi
else shot c3-failed; result C-SEEK-HELD 'NOT TESTED' "$NOPEN"; fi

if open_player c4; then
  p="$(line_point c4-line 0.5)"
  if [ "$p" = none ]; then result C-SEEK-BEFORE-PLAY 'NOT TESTED' 'the timeline line was not found'
  else
    pp="${p% *}"; pe="${p#* }"
    mt c4-step tap-point.yaml "P=$pp" && mt c4-landed wait-readout.yaml 'RE=.*lands=[0-9.]+ .*' MS=8000; rc=$?
    r="$(readout c4-placed)"; shot c4-placed; l1="$(land "$r" 1)"
    if [ $rc -ne 0 ] || [ "$(field "$r" play)" != 0 ] || [ "$(field "$r" ord)" != 3 ] || [ "$(near "$l1" "$pe" 0.3 0.3)" != yes ]; then
      result C-SEEK-BEFORE-PLAY FAIL "a step at $pp (asked ${pe} ms) before any Play: expected moment 3 there, nothing playing; read: $r"
    else
      mt c4-play tap.yaml ID=qandeel-replay-play; sleep 4; r3="$(readout c4-on)"
      r4="$(until_ended c4-end 40)"; shot c4-end
      if [ "$(later "$l1" "$(field "$r3" t)")" = yes ] && [ "$(field "$r4" end)" = 1 ] && [ "$(field "$r4" cont)" = OK ] && [ "$(field "$r4" visited)" = 3-5-6 ]; then
        result C-SEEK-BEFORE-PLAY PASS "before Play: at $pp -> $l1 s on moment 3, nothing playing; Play went on ($(field "$r3" t) s) to the end unbroken: $r4"
      else result C-SEEK-BEFORE-PLAY FAIL "Play after the step before Play (at $l1 s): $r3; end: $r4"; fi
    fi
  fi
else shot c4-failed; result C-SEEK-BEFORE-PLAY 'NOT TESTED' "$NOPEN"; fi

result IOS-NATIVE-AUDIO 'NOT TESTED' 'by construction: the synthetic player plays nothing audible; the native audio is the device pass'"'"'s (HONOR / iPhone)'
say "done"
# The file holds exactly the case set, one row each (run 46037104976: a multi-line detail made rows of its own).
validate_results "${CASES[@]}" | tee -a "$LOG"; [ "${PIPESTATUS[0]}" -eq 0 ] || exit 1
# NOT TESTED by construction is recorded, not judged: the gate passes when every case it can test passed.
! tail -n +2 "$RES" | grep -v '^IOS-NATIVE-AUDIO' | awk -F'\t' '$2 != "PASS"' | grep -q .
