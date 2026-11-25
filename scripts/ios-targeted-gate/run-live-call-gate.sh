#!/usr/bin/env bash
# INTEL-LIVE-01 CP1 — the iOS Targeted Gate for the live call (PO directive 2026-11-25 §3/§4). VALIDATION ONLY.
#
# usage: DATABASE_URL=<loopback throwaway database, migrations applied> \
#          bash scripts/ios-targeted-gate/run-live-call-gate.sh <app-dir> <out-dir> <simulator-udid>
#
# The .app is the S8B-06 CP3 proof build (select-s806cp3-proof-entry.mjs pointed `main` at the proof root for that build
# only): the PRODUCTION runtime, Conversation and call surfaces and the REAL native call engine, over the S8B-06 CP3 proof
# server (apps/api/scripts/s8b-06-cp3-device-proof-server.ts) — the REAL S8B-05 live call (gateway, engine, endpointer,
# reply pacing, call analysis worker) with the INTEL-LIVE-01 provisional attention lane ON (PROOF_ATTENTION=ON, a fake
# evaluator). The simulator reaches it on 127.0.0.1:8806, its own loopback. A GitHub macOS runner has no microphone: the
# server replaces what it hears of THIS proof's uplink with a synthetic voiced signal for the length `/proof/speak` asks
# (energy, never speech) so the endpointer can end a turn. Nothing paid, no provider, no account, no credential.
#
# Cases, each PASS / FAIL / NOT TESTED in <out-dir>/results.tsv. A case after a failure is NOT TESTED, never PASS; the
# script exits non-zero unless every case passed. Nothing retries, with ONE exception (PO, 2026-11-25, option 1): ITG-03 repeats its
# spoken turn exactly once, and only after the server itself recorded the call's connection lost before PLAYED_OUT (the frozen
# 3 s silence rule ended it, run 45586185915). The first attempt's evidence is kept; the repeat is made only once the call is
# ACTIVE again at a later epoch; a repeat that plays out is recorded PASS AFTER RECOVERY, never PASS; a second loss fails it.
#
#   ITG-01 launch     the proof build installs and launches; the Conversation's call entry is drawn
#   ITG-02 connect    a tap on the call entry opens a call the server holds ACTIVE (qandeel.live-call.v1 HELLO accepted);
#                     the call line's End is drawn
#   ITG-03 turn       one turn through the live-call backend: endpointer commit, reply, and the reply PLAYED_OUT, which
#                     only the iOS engine's own PLAYOUT confirmations can produce; the call line is still drawn after it.
#                     PASS AFTER RECOVERY: the one repeat above played out (the interruption stays an open finding)
#   ITG-04 end        a tap on End ends the call USER_ENDED; the call line goes and the Analysis stays (S8B-06 CP3 J3:
#                     the person's own End does not move them); back in the Conversation the call entry is drawn again
#   ITG-05 attention  the provisional attention lane evaluated and wrote both tracks (SET events) and settled both halves
#                     COMPLETE at the call's end; no write failed
#   ITG-06 stability  the app is still running and no crash report names it
#
# NOT proven here: the real microphone, echo cancellation, CallKit, Bluetooth, a physical iPhone (a separate future
# requirement), and the COSMOS World (the World gate's, when its own inputs change). Kept in <out-dir>: every screenshot,
# Maestro's debug output, the server's content-free evidence (counts and THIS proof's synthetic identifiers) and the host
# reads of the call and the attention lane. From ITG-03 on, <out-dir>/client holds lightweight client-side diagnostics, never a
# verdict: the app's unified log at default level (this proof's synthetic data only; read once when the run ends, never
# streamed), a once-a-second host load and app CPU line, and a host `top` and largest-resident snapshot at each connection
# loss and failure.
set -u
if [ "$#" -ne 3 ]; then echo "usage: run-live-call-gate.sh <app-dir> <out-dir> <udid>"; exit 2; fi
APP="$1"
OUT="$2"
UDID="$3"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
BUNDLE="com.qandeel.mobile"
SERVER="http://127.0.0.1:8806"
BOUND="node $REPO/scripts/validation/bounded-run.mjs"
mkdir -p "$OUT/shots" "$OUT/host"
RESULTS="$OUT/results.tsv"
SUMMARY="$OUT/summary.txt"
EVENTS="$OUT/host/server-events.jsonl"
printf 'case\tresult\tdetail\n' > "$RESULTS"
: > "$SUMMARY"
: > "$EVENTS"
CASES="ITG-01 ITG-02 ITG-03 ITG-04 ITG-05 ITG-06"
RECORDED=" "
note() { echo "$1" | tee -a "$SUMMARY"; }
record() {
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$RESULTS"
  RECORDED="$RECORDED$1 "
  note "$2 $1 — $3"
}
# Every case not yet recorded is NOT TESTED (it did not run).
untested() {
  for c in $CASES; do
    case "$RECORDED" in *" $c "*) ;; *) record "$c" "NOT TESTED" "$1" ;; esac
  done
}
fail() {
  record "$1" FAIL "$2"
  xcrun simctl io "$UDID" screenshot "$OUT/shots/failure-$1.png" >/dev/null 2>&1 || true
  client_snapshot "failure-$1"
  untested "not reached: $1 failed"
  exit 1
}
infrastructure() {
  note "INFRASTRUCTURE — $1"
  untested "INFRASTRUCTURE: $1"
  exit 1
}
flow() {
  local file="$1" label="$2"
  shift 2
  $BOUND --seconds 300 --label "flow-$label" --out "$OUT" -- maestro --device "$UDID" test --debug-output "$OUT/debug-$label" \
    --test-output-dir "$OUT/shots" -e PREFIX=itg "$@" "$FLOWS/$file"
}
read_state() { curl -s -m 5 "$SERVER/proof/state" || echo '{}'; }
read_attention() { curl -s -m 5 "$SERVER/proof/attention" || echo '{}'; }
# Client-side diagnostics (PO, 2026-11-25): evidence only, never a verdict, and nothing here can fail a case. They start
# before ITG-01 (run 45612961224: ITG-02's tap reached the app and nothing followed, with no client evidence), so the
# app's pid is looked up on every tick: ITG-01's launch replaces the app process.
start_client_diagnostics() {
  mkdir -p "$OUT/client"
  # The app's log is read ONCE, when the run ends (collect_client_log), never streamed: run 45601664395 measured a live
  # `log stream` at about a third of a core (diagnosticd and log) on a host with no idle CPU.
  CLIENT_LOG_FROM="$(date '+%Y-%m-%d %H:%M:%S')"
  # epoch seconds, host load average, the app's pid, %CPU and RSS (KiB)
  ( while :; do pid="$(pgrep -x QANDEEL | head -n 1)"
      printf '%s\t%s\t%s\t%s\n' "$(date +%s)" "$(sysctl -n vm.loadavg)" "${pid:--}" "$([ -n "$pid" ] && ps -o %cpu=,rss= -p "$pid" | tr -s ' ')"
      sleep 1; done ) \
    > "$OUT/client/load-1hz.tsv" 2>/dev/null &
  DIAG_PIDS="$DIAG_PIDS $!"
}
client_snapshot() {
  [ -d "$OUT/client" ] || return 0
  top -l 2 -s 1 -n 12 -o cpu -stats pid,command,cpu,mem > "$OUT/client/$1-top.txt" 2>&1 || true
  { echo; echo '# the largest resident processes'; ps -axm -o rss,pcpu,comm | head -n 16; } >> "$OUT/client/$1-top.txt" 2>&1 || true
}
# collect_client_log: the app's unified log (default level and above) from before ITG-01 on, read once at the end of the run.
CLIENT_LOG_FROM=""
collect_client_log() {
  [ -n "$CLIENT_LOG_FROM" ] && [ -d "$OUT/client" ] || return 0
  $BOUND --seconds 180 --label client-log --out "$OUT" --quiet -- xcrun simctl spawn "$UDID" log show --style compact --start "$CLIENT_LOG_FROM" \
    --predicate 'process == "QANDEEL" OR eventMessage CONTAINS[c] "com.qandeel.mobile"' > "$OUT/client/app-log.txt" 2>&1 || true
}
# ITG-03's recovery record: the server's own connection-loss lines.
losses() { grep -c '"kind":"connection-lose"' "$EVENTS" 2>/dev/null || true; }
# loss_detail <losses before>: the next loss's code, reason and epoch, and how long after the latest stimulus it came.
loss_detail() {
  node -e 'const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const loss = lines.filter((e) => e.kind === "connection-lose")[Number(process.argv[2])];
const stimulus = lines.filter((e) => e.kind === "stimulus" && e.at <= loss.at).pop();
process.stdout.write(`${loss.code} ${loss.reason} on connection epoch ${loss.epoch}, ${stimulus ? loss.at - stimulus.at : "?"} ms after the stimulus`);' "$EVENTS" "$1" 2>/dev/null \
    || echo "a loss the evidence does not parse"
}
# loss_epoch <losses before>: the epoch the next loss ended (empty if the evidence names none).
loss_epoch() {
  node -e 'const l = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").flatMap((x) => { try { return [JSON.parse(x)]; } catch { return []; } }).filter((e) => e.kind === "connection-lose")[Number(process.argv[2])];
process.stdout.write(String(Number.isInteger(l && l.epoch) ? l.epoch : ""));' "$EVENTS" "$1" 2>/dev/null
}
PLAYED='s => Array.isArray(s.exchanges) && s.exchanges.some((e) => e.turn_channel === "SPEECH" && e.delivery_state === "COMPLETE" && e.close_reason === "PLAYED_OUT")'
# wait_turn <seconds> <saved-name> <losses before>: 0 = a spoken reply PLAYED_OUT; 2 = the server recorded a connection loss
# first (the wait stops at once); 1 = neither in time. The last body is kept either way.
wait_turn() {
  local seconds="$1" saved="$2" before="$3" waited=0 body='{}'
  while [ "$waited" -le "$seconds" ]; do
    body="$(read_state)"
    if node -e "const s = JSON.parse(process.argv[1]); process.exit((${PLAYED})(s) ? 0 : 1)" "$body" 2>/dev/null; then
      echo "$body" > "$OUT/host/$saved.json"
      return 0
    fi
    if [ "$(losses)" -gt "$before" ]; then
      echo "$body" > "$OUT/host/$saved.json"
      return 2
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo "$body" > "$OUT/host/$saved.json"
  return 1
}
# wait_json <seconds> <reader> <saved-name> <JavaScript predicate over the parsed body>: the last body is kept either way.
wait_json() {
  local seconds="$1" reader="$2" saved="$3" predicate="$4" waited=0 body='{}'
  while [ "$waited" -le "$seconds" ]; do
    body="$($reader)"
    if node -e "const s = JSON.parse(process.argv[1]); process.exit((${predicate})(s) ? 0 : 1)" "$body" 2>/dev/null; then
      echo "$body" > "$OUT/host/$saved.json"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo "$body" > "$OUT/host/$saved.json"
  return 1
}

# The S8B-06 CP3 proof server, with the attention lane ON. It refuses anything but a loopback database. It runs
# --transpile-only: the workflow type-checks it in its own step before the build. Measured locally (one call, the lane ON):
# type-checking in process held 658 MB and spent 3.2 – 3.6 CPU-s on the call, transpile-only 312 MB and 2.4 CPU-s, on a
# runner that had 129 MB free during run 45601664395.
PROOF_ATTENTION=ON PROOF_EVENTS_FILE="$EVENTS" PORT=8806 NODE_ENV=development \
  node "$REPO/node_modules/ts-node/dist/bin.js" --transpile-only --project "$REPO/apps/api/tsconfig.scripts.json" \
  "$REPO/apps/api/scripts/s8b-06-cp3-device-proof-server.ts" > "$OUT/host/server.log" 2>&1 &
SERVER_PID=$!
DIAG_PIDS=""
finish() {
  kill $SERVER_PID $DIAG_PIDS 2>/dev/null || true
  collect_client_log
}
trap finish EXIT
for _ in $(seq 1 120); do grep -q '"kind":"listening"' "$EVENTS" 2>/dev/null && break; sleep 2; done
grep -q '"kind":"listening"' "$EVENTS" || infrastructure "the proof server did not start (host/server.log)"
grep -q '"kind":"attention-lane","state":"ON"' "$EVENTS" || infrastructure "the proof server's attention lane is not ON"
note "proof server: listening on 8806, attention lane ON"

$BOUND --seconds 300 --label simulator-boot --out "$OUT" -- xcrun simctl bootstatus "$UDID" -b || infrastructure "the simulator did not finish booting"
xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl privacy "$UDID" reset all "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP" || fail ITG-01 "the proof build did not install"
xcrun simctl privacy "$UDID" grant microphone "$BUNDLE" || infrastructure "simctl privacy grant microphone"
{
  echo "simulator: $UDID / $(xcrun simctl list devices | grep "$UDID" | head -n 1 | sed 's/^ *//')"
  echo "app: $APP"
} | tee -a "$SUMMARY"
DRIVER_START="$(date +%s)"
if ! $BOUND --seconds 300 --label driver-readiness --out "$OUT" --quiet -- maestro --device "$UDID" hierarchy --compact; then
  bash "$REPO/scripts/validation/ios-driver-diagnostics.sh" "$UDID" > "$OUT/driver-diagnostics.txt" 2>&1 || true
  infrastructure "the Maestro XCTest driver did not answer after $(( $(date +%s) - DRIVER_START )) s; no Product step was run"
fi
note "driver-readiness: answered after $(( $(date +%s) - DRIVER_START )) s"

# ITG-01 — launch: the call entry is drawn only after the production runtime reached the server.
start_client_diagnostics
flow itg-call-launch.yaml launch -e SHOT=01-launch || fail ITG-01 "the Conversation's call entry was not drawn after launch"
record ITG-01 PASS "the proof build installed and launched; the Conversation's call entry is drawn"

# ITG-02 — connect.
flow itg-call-tap.yaml connect -e ID=qandeel-call-entry -e WAIT_ID=qandeel-call-rail:end -e SHOT=02-in-call \
  || fail ITG-02 "a tap on the call entry did not draw the call line's End"
wait_json 60 read_state 02-call-active 's => s.call != null && s.call.state === "ACTIVE"' \
  || fail ITG-02 "the server holds no ACTIVE call (host/02-call-active.json)"
record ITG-02 PASS "the tap opened a call the server holds ACTIVE; the call line's End is drawn"

# ITG-03 — one turn: the synthetic voiced signal, the endpointer's commit, the reply, played out by the iOS engine.
RECOVERED=""
BEFORE="$(losses)"
curl -s -m 5 -f -X POST "$SERVER/proof/speak?ms=1500" > "$OUT/host/03-speak.json" || fail ITG-03 "the server refused /proof/speak (no open uplink)"
wait_turn 120 03-attempt-1 "$BEFORE"
TURN=$?
if [ "$TURN" -eq 2 ]; then
  # The ONE repeat (PO, 2026-11-25): only after a server-confirmed loss before PLAYED_OUT, and only once the call is back.
  RECOVERED="$(loss_detail "$BEFORE")"
  LOST_EPOCH="$(loss_epoch "$BEFORE")"
  grep '"kind":"connection-lose"' "$EVENTS" | tail -n +"$((BEFORE + 1))" > "$OUT/host/03-loss-1.jsonl"
  note "ITG-03: the server recorded the connection lost before PLAYED_OUT: $RECOVERED (first attempt kept: host/03-attempt-1.json, host/03-loss-1.jsonl)"
  xcrun simctl io "$UDID" screenshot "$OUT/shots/itg-03-loss-1.png" >/dev/null 2>&1 || true
  client_snapshot 03-loss-1
  [ -n "$LOST_EPOCH" ] || fail ITG-03 "the connection was lost ($RECOVERED) and the evidence names no epoch; nothing was repeated"
  wait_json 60 read_state 03-reconnected "s => s.call != null && s.call.state === \"ACTIVE\" && s.call.epoch > $LOST_EPOCH" \
    || fail ITG-03 "the connection was lost ($RECOVERED) and the call was not ACTIVE again at a later epoch within 60 s (host/03-reconnected.json)"
  note "ITG-03: the call is ACTIVE again after epoch $LOST_EPOCH (host/03-reconnected.json); the spoken turn is repeated once"
  BEFORE="$(losses)"
  SPOKE=1
  for _ in $(seq 1 15); do
    if curl -s -m 5 -f -X POST "$SERVER/proof/speak?ms=1500" > "$OUT/host/03-speak-repeat.json"; then SPOKE=0; break; fi
    sleep 2
  done
  [ "$SPOKE" -eq 0 ] || fail ITG-03 "reconnected after the loss ($RECOVERED), but no uplink opened for the repeat within 30 s"
  wait_turn 120 03-repeat "$BEFORE"
  TURN=$?
  [ "$TURN" -ne 2 ] || fail ITG-03 "a second connection loss ($(loss_detail "$BEFORE")) after the first ($RECOVERED)"
  [ "$TURN" -eq 0 ] || fail ITG-03 "after recovering from the loss ($RECOVERED), the repeat's reply was not PLAYED_OUT within 120 s (host/03-repeat.json)"
  cp "$OUT/host/03-repeat.json" "$OUT/host/03-turn-played-out.json"
else
  [ "$TURN" -eq 0 ] || fail ITG-03 "no spoken turn's reply was PLAYED_OUT within 120 s (host/03-attempt-1.json)"
  cp "$OUT/host/03-attempt-1.json" "$OUT/host/03-turn-played-out.json"
fi
flow itg-call-visible.yaml after-turn -e ID=qandeel-call-rail:end -e SHOT=03-after-turn \
  || fail ITG-03 "the call line was not drawn after the turn"
if [ -n "$RECOVERED" ]; then
  record ITG-03 "PASS AFTER RECOVERY" "the first attempt's connection was lost before PLAYED_OUT ($RECOVERED; kept in host/03-attempt-1.json, host/03-loss-1.jsonl, client/); the call was ACTIVE again at a later epoch and the ONE repeat's spoken turn was PLAYED_OUT through the iOS engine; the call line is still drawn. The interruption is unresolved"
else
  record ITG-03 PASS "a spoken turn committed, its reply PLAYED_OUT through the iOS engine's playout confirmations; the call line is still drawn"
fi

# ITG-04 — end. The person's own End does not move them (S8B-06 CP3 J3): the call line goes and the Analysis stays; the
# door back to the Conversation then shows the call entry again.
flow itg-call-end.yaml end \
  || fail ITG-04 "after End, the call line did not go, the Analysis did not stay, or the Conversation did not draw the call entry again"
wait_json 60 read_state 04-call-ended 's => s.call != null && s.call.state === "ENDED" && s.call.end_reason === "USER_ENDED"' \
  || fail ITG-04 "the server did not end the call USER_ENDED (host/04-call-ended.json)"
record ITG-04 PASS "the tap on End ended the call USER_ENDED; the call line went and the Analysis stayed (J3); back in the Conversation the call entry is drawn again"

# ITG-05 — the provisional attention lane on both tracks, settled at the call's end.
wait_json 60 read_attention 05-attention \
  's => ["USER", "QANDEEL"].every((t) => (s.evaluations || []).some((r) => r.track === t && r.outcome === "DEVELOPMENTS") && (s.events || []).some((r) => r.track === t && r.op === "SET") && (s.settlements || []).some((r) => r.track === t && r.half_state === "COMPLETE"))' \
  || fail ITG-05 "the attention lane did not write and settle both tracks (host/05-attention.json)"
if grep -Eiq 'write_failed|integrity_failure' "$EVENTS"; then fail ITG-05 "an attention write failed (host/server-events.jsonl)"; fi
record ITG-05 PASS "both tracks evaluated, written (SET) and settled COMPLETE; no write failed"

# ITG-06 — stability.
xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "UIKitApplication:$BUNDLE" || fail ITG-06 "the app is no longer running"
if ls "$HOME/Library/Logs/DiagnosticReports" 2>/dev/null | grep -Eiq 'qandeel'; then fail ITG-06 "a crash report names the app"; fi
record ITG-06 PASS "the app is still running; no crash report names it"

if [ -n "$RECOVERED" ]; then
  note "iOS Targeted Gate (live call): every case passed; ITG-03 PASS AFTER RECOVERY (an unresolved interruption: $RECOVERED)"
else
  note "iOS Targeted Gate (live call): every case PASS"
fi
