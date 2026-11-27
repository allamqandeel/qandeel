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
# The functional cases start and end the call WITHOUT a touch (PO, 2026-11-25, the final functional validation approach):
# the simulator's synthetic touch delivery dropped the call-entry tap three times (runs 45612961224, 45630621237,
# 45659136860). `POST /proof/call?do=start|end` queues ONE command; the proof root takes it once and calls the session's own
# CallOwner exactly as the call entry (`if (!preparing) void owner.start()`) and the call line's End (`owner.end()`) do
# (apps/mobile/src/voice-call/__validation__/s806cp3-call-commands.ts), then acknowledges it; each case waits for that
# acknowledgement in the server's evidence. Everything after it is the app's own call: capability, the server's truth, the
# microphone, consent, the platform call, the native engine, the socket and protocol, the backend and the attention lane.
# This proves the call, never a touch.
#
#   ITG-01 launch     the proof build installs and launches; the Conversation's call entry is drawn
#   ITG-02 connect    the start command (the call entry's own call) opens a call the server holds ACTIVE
#                     (qandeel.live-call.v1 HELLO accepted); the call line's End is drawn
#   ITG-03 turn       one turn through the live-call backend: endpointer commit, reply, and the reply PLAYED_OUT, which
#                     only the iOS engine's own PLAYOUT confirmations can produce; the call line is still drawn after it.
#                     PASS AFTER RECOVERY: the one repeat above played out (the interruption stays an open finding)
#   ITG-04 end        the end command (End's own call) ends the call USER_ENDED; the call line goes and the Analysis stays
#                     (S8B-06 CP3 J3: the person's own End does not move them)
#
# UI touch, reported SEPARATELY in <out-dir>/ui-touch.tsv after the functional cases (PASS / FAIL / NOT TESTED; it never
# changes the exit status and never counts as functional evidence; nothing repeats):
#   UT-1 the door back to the Conversation, by a tap: the call entry is drawn again
#   UT-2 a tap on the call entry opens a second call the server holds ACTIVE; the call line's End is drawn
#   UT-3 a tap on End ends that call USER_ENDED; the call entry is drawn again
#   ITG-07 v3         INTEL-LIVE-01 CP2 (protocol v3, D-3): the iOS phone negotiated v3 (the lane SENT it an
#                     ATTENTION_STATE on the call's connection, which only a v3 connection ACTIVE on that call is sent) and
#                     answered v2's clock marks inside v3 with null (NOCLOCK); corpus scenario (d)'s segments 2–6 (a SET,
#                     then its correction: WITHDRAW and a new SET) reach the phone, which applies the database's latest
#                     event and then holds exactly its open subjects; the production Personal COSMOS owner compiles a stage
#                     with the mark (a new digest)
#   ITG-08 restore    with the connection's attention frames withheld (as if lost in transit), segments 7–10 (a SET, then
#                     its negation: WITHDRAW and a new SET) are written while the phone stays behind; the live-call
#                     sockets are cut, the phone resumes on a new connection, which is sent an ATTENTION_STATE, and the
#                     phone again holds exactly the database's open subjects at its latest event
#   ITG-09 cleanup    after the end, the phone holds no mark (any still shown at the end dropped with the call no longer
#                     ACTIVE) and the stage it compiles has none
# ITG-07 – ITG-09 read the proof app's attention probe (`s806cp3-attention-probe.ts`, ON only with PROOF_PROBE=ON): it
# watches the session's own CallOwner and a mirror of the production Personal owner and reports instants; nothing is
# injected into the phone's layer or the map, which the REAL v3 frames alone feed. Corpus scenario (d) runs with the
# annotation oracle (PROOF_ATTENTION_SCENARIO=d): ITG-03's one utterance is its first segment (no development); QANDEEL's
# side is CP1's proof subject (the scenario has no QANDEEL annotation). v1 and v2 compatibility is the API gateway's e2e
# and the client's tests (an iOS build offers v3 and v1 only and cannot be a v1 client here).
#   ITG-05 attention  the provisional attention lane evaluated and wrote both tracks (SET events) and settled both halves
#                     COMPLETE at the call's end; no write failed
#   ITG-06 stability  the app is still running and no crash report names it
#
# NOT proven here: the real microphone, echo cancellation, CallKit, Bluetooth, a physical iPhone (a separate future
# requirement), and the COSMOS World (the World gate's, when its own inputs change). Kept in <out-dir>: every screenshot,
# Maestro's debug output, the server's content-free evidence (counts and THIS proof's synthetic identifiers) and the host
# reads of the call and the attention lane. From before ITG-01 on, <out-dir>/client holds lightweight client-side diagnostics, never a
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
CASES="ITG-01 ITG-02 ITG-03 ITG-07 ITG-08 ITG-04 ITG-09 ITG-05 ITG-06"
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
  $BOUND --seconds "${FLOW_SECONDS:-300}" --label "flow-$label" --out "$OUT" -- maestro --device "$UDID" test --debug-output "$OUT/debug-$label" \
    --test-output-dir "$OUT/shots" -e PREFIX=itg "$@" "$FLOWS/$file"
}
# call_command <start|end> <saved-name>: queues ONE call command and waits up to 30 s for the app's acknowledgement in the
# server's evidence (the proof root took it and called the owner: STARTED for start, ENDED for end). The command's queued,
# taken and executed lines are kept in host/<saved-name>.jsonl either way.
call_command() {
  local op="$1" saved="$2" id waited=0 want=STARTED
  [ "$op" = end ] && want=ENDED
  id="$(curl -s -m 5 -f -X POST "$SERVER/proof/call?do=$op" | node -e 'let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => { try { const j = JSON.parse(s); if (Number.isInteger(j.id)) process.stdout.write(String(j.id)); } catch {} });')"
  [ -n "$id" ] || { echo '{"refused":"the server did not queue the command"}' > "$OUT/host/$saved.jsonl"; return 1; }
  while [ "$waited" -le 30 ]; do
    if grep '"kind":"call-command","step":"executed"' "$EVENTS" | grep "\"id\":$id," | grep -q "\"outcome\":\"$want\""; then break; fi
    sleep 1
    waited=$((waited + 1))
  done
  grep '"kind":"call-command"' "$EVENTS" | grep "\"id\":$id," > "$OUT/host/$saved.jsonl" 2>/dev/null || true
  grep -q "\"outcome\":\"$want\"" "$OUT/host/$saved.jsonl"
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
# INTEL-LIVE-01 CP2: the v3 attention checks (attention-checks.mjs over the server's evidence and a fresh /proof/attention).
ATT_CHECKS="$REPO/scripts/ios-targeted-gate/attention-checks.mjs"
now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
# mic_ready <label>: this app's microphone authorization in the simulator's own TCC record (auth_value 2 = allowed), kept as
# evidence in host/mic-<label>.txt. Production permission and consent are untouched: this only reads what the harness granted.
mic_ready() {
  local db="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/TCC/TCC.db" value
  value="$(sqlite3 "$db" "SELECT auth_value FROM access WHERE service = 'kTCCServiceMicrophone' AND client = '$BUNDLE';" 2>&1)"
  echo "kTCCServiceMicrophone $BUNDLE auth_value=${value:-none} ($db)" > "$OUT/host/mic-$1.txt"
  [ "$value" = "2" ]
}
# The epoch of the call's ACTIVE connection, from the server (empty when none).
active_epoch() {
  read_state | node -e 'let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => { try { const j = JSON.parse(s); if (j.call && j.call.state === "ACTIVE" && Number.isInteger(j.call.epoch)) process.stdout.write(String(j.call.epoch)); } catch {} });'
}
# How many spoken replies have PLAYED_OUT so far.
played_count() {
  read_state | node -e 'let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => { let n = 0; try { n = (JSON.parse(s).exchanges || []).filter((e) => e.turn_channel === "SPEECH" && ["PLAYED_OUT"].includes(e.close_reason)).length; } catch {} process.stdout.write(String(n)); });'
}
# wait_check <seconds> <saved-name> <check> [args]: the check over the evidence and a fresh /proof/attention read
# (host/<saved>.json) every 2 s; its last answer is kept in host/<saved>.txt either way.
wait_check() {
  local seconds="$1" saved="$2" waited=0
  shift 2
  while [ "$waited" -le "$seconds" ]; do
    read_attention > "$OUT/host/$saved.json"
    if node "$ATT_CHECKS" "$EVENTS" "$OUT/host/$saved.json" "$@" > "$OUT/host/$saved.txt" 2>&1; then return 0; fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}
# wait_event <seconds> <fixed string>: a server evidence line containing it.
wait_event() {
  local seconds="$1" needle="$2" waited=0
  while [ "$waited" -le "$seconds" ]; do
    grep -qF "$needle" "$EVENTS" 2>/dev/null && return 0
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

# The S8B-06 CP3 proof server, with the attention lane ON. It refuses anything but a loopback database. It runs
# --transpile-only: the workflow type-checks it in its own step before the build. Measured locally (one call, the lane ON):
# type-checking in process held 658 MB and spent 3.2 – 3.6 CPU-s on the call, transpile-only 312 MB and 2.4 CPU-s, on a
# runner that had 129 MB free during run 45601664395.
PROOF_ATTENTION=ON PROOF_ATTENTION_SCENARIO=d PROOF_PROBE=ON PROOF_EVENTS_FILE="$EVENTS" PORT=8806 NODE_ENV=development \
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
# CALL-ATTR-01 CI R2: this fresh install is the LAST state reset (the launch flow clears no state: Maestro's clearState
# uninstalls and reinstalls the app, which drops this grant and left its own best-effort re-grant to decide whether iOS
# would prompt). The grant is read back from the simulator's own TCC record here and again before the start command.
mic_ready granted || infrastructure "the microphone grant is not in the simulator's TCC record after simctl privacy ($(cat "$OUT/host/mic-granted.txt"))"
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

# ITG-02 — connect, by the start command (no touch; see above): the call entry's own owner.start(), then the same checks.
# The microphone authorization is in place before the command is sent (iOS would otherwise hold the call in PREPARING
# behind its own prompt): read, never waited for and never re-granted.
mic_ready before-start || infrastructure "the microphone authorization was not in place before the start command ($(cat "$OUT/host/mic-before-start.txt")); no start command was sent"
call_command start 02-command \
  || fail ITG-02 "the app did not take and execute the start command within 30 s (host/02-command.jsonl)"
wait_json 60 read_state 02-call-active 's => s.call != null && s.call.state === "ACTIVE"' \
  || fail ITG-02 "the start command was executed (host/02-command.jsonl), but the server holds no ACTIVE call (host/02-call-active.json)"
flow itg-call-visible.yaml connect -e ID=qandeel-call-rail:end -e SHOT=02-in-call \
  || fail ITG-02 "the server holds the call ACTIVE, but the call line's End was not drawn"
record ITG-02 PASS "the start command (the call entry's own owner.start(), no touch; host/02-command.jsonl) opened a call the server holds ACTIVE; the call line's End is drawn"

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

# ITG-07 — protocol v3 on iOS (INTEL-LIVE-01 CP2): negotiation, v2's clock marks inside v3, live disclosure and its
# correction, and the production Personal COSMOS owner's stage.
EPOCH="$(active_epoch)"
[ -n "$EPOCH" ] || fail ITG-07 "the server holds no ACTIVE call connection after ITG-03"
wait_check 10 07-v3 v3 "$EPOCH" || fail ITG-07 "no ATTENTION_STATE was sent on the call's connection: v3 was not negotiated ($(cat "$OUT/host/07-v3.txt"))"
wait_check 30 07-noclock noclock || fail ITG-07 "v2's clock marks inside v3 were not answered NOCLOCK only ($(cat "$OUT/host/07-noclock.txt"))"
PLAYED_BEFORE="$(played_count)"
curl -s -m 5 -f -X POST "$SERVER/proof/speak-scenario?turn=1&from=1&to=5" > "$OUT/host/07-speak.json" || fail ITG-07 "the server refused /proof/speak-scenario (no open uplink)"
wait_event 120 '"kind":"scenario-turn-end","scenario":"d","turn":1,"from":1' || fail ITG-07 "scenario (d) segments 2–6 were not spoken within 120 s"
wait_json 60 read_attention 07-written 's => (s.events || []).some((r) => r.track === "USER" && r.op === "SET") && (s.events || []).some((r) => r.track === "USER" && r.op === "WITHDRAW")' \
  || fail ITG-07 "the lane did not write the scenario's SET and its correction (host/07-written.json)"
wait_check 60 07-applied applied || fail ITG-07 "the phone did not apply the latest event and hold exactly the open subjects ($(cat "$OUT/host/07-applied.txt"))"
wait_check 10 07-cosmos cosmos 0 || fail ITG-07 "the Personal COSMOS owner compiled no stage with a mark ($(cat "$OUT/host/07-cosmos.txt"))"
xcrun simctl io "$UDID" screenshot "$OUT/shots/itg-07-disclosed.png" >/dev/null 2>&1 || true
wait_json 120 read_state 07-played-out "s => (s.exchanges || []).filter((e) => e.turn_channel === \"SPEECH\" && e.close_reason === \"PLAYED_OUT\").length > $PLAYED_BEFORE" \
  || fail ITG-07 "the scenario turn's reply was not PLAYED_OUT within 120 s (host/07-played-out.json)"
record ITG-07 PASS "v3 negotiated on iOS ($(cat "$OUT/host/07-v3.txt")); $(cat "$OUT/host/07-noclock.txt"); a SET and its correction reached the phone, which $(cat "$OUT/host/07-applied.txt"); $(cat "$OUT/host/07-cosmos.txt"); the turn's reply PLAYED_OUT"

# ITG-08 — restore: frames withheld (lost in transit), the connection cut, the state restored on the resumed connection.
EPOCH="$(active_epoch)"
[ -n "$EPOCH" ] || fail ITG-08 "the server holds no ACTIVE call connection after ITG-07"
curl -s -m 5 -f -X POST "$SERVER/proof/attention-hold?on=1" > "$OUT/host/08-hold.json" || fail ITG-08 "the server refused /proof/attention-hold"
curl -s -m 5 -f -X POST "$SERVER/proof/speak-scenario?turn=1&from=6&to=9" > "$OUT/host/08-speak.json" || fail ITG-08 "the server refused /proof/speak-scenario (no open uplink)"
# The negation (segment 9: a WITHDRAW and a new SET) written, read every 0.5 s: the connection is cut at once, while the
# last segment is still spoken and before the turn commits, so the restore carries what the phone missed (a settlement
# reaching it first would leave nothing to restore; the local rehearsal showed exactly that with a 2 s read).
NEGATED=1
for _ in $(seq 1 240); do
  read_attention > "$OUT/host/08-written.json"
  if node -e 'const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.exit((s.events || []).filter((r) => r.track === "USER" && r.op === "WITHDRAW").reduce((n, r) => n + r.n, 0) >= 2 ? 0 : 1)' "$OUT/host/08-written.json" 2>/dev/null; then
    NEGATED=0
    break
  fi
  sleep 0.5
done
[ "$NEGATED" -eq 0 ] || fail ITG-08 "the lane did not write the scenario's negation within 120 s (host/08-written.json)"
node "$ATT_CHECKS" "$EVENTS" "$OUT/host/08-written.json" behind > "$OUT/host/08-behind.txt" 2>&1 \
  || fail ITG-08 "the phone applied the withheld events: nothing was withheld ($(cat "$OUT/host/08-behind.txt"))"
DROP_AT="$(now_ms)"
curl -s -m 5 -f -X POST "$SERVER/proof/drop" > "$OUT/host/08-drop.json" || fail ITG-08 "the server refused /proof/drop"
wait_json 60 read_state 08-resumed "s => s.call != null && s.call.state === \"ACTIVE\" && s.call.epoch > $EPOCH" \
  || fail ITG-08 "the call was not ACTIVE again on a later connection within 60 s after the cut (host/08-resumed.json)"
curl -s -m 5 -f -X POST "$SERVER/proof/attention-hold?on=0" > "$OUT/host/08-release.json" || true
wait_check 60 08-restored restored "$EPOCH" "$DROP_AT" || fail ITG-08 "the resumed connection did not restore the phone's attention ($(cat "$OUT/host/08-restored.txt"))"
xcrun simctl io "$UDID" screenshot "$OUT/shots/itg-08-restored.png" >/dev/null 2>&1 || true
# The last segment's stimulus is used up on the resumed connection; its end is evidence only.
wait_event 60 '"kind":"scenario-turn-end","scenario":"d","turn":1,"from":6' || note "ITG-08: the last segment's stimulus was not used up within 60 s (evidence only)"
record ITG-08 PASS "with the connection's frames withheld the phone stayed behind ($(cat "$OUT/host/08-behind.txt")); after the cut it resumed and $(cat "$OUT/host/08-restored.txt")"

# ITG-04 — end, by the end command (no touch): End's own owner.end(). The person's own End does not move them (S8B-06
# CP3 J3): the call line goes and the Analysis stays.
END_AT="$(now_ms)"
call_command end 04-command \
  || fail ITG-04 "the app did not take and execute the end command within 30 s (host/04-command.jsonl)"
flow itg-call-gone.yaml end -e ID=qandeel-call-rail:end -e STAY_ID=qandeel-depth-to-conversation -e SHOT=04-ended \
  || fail ITG-04 "after the end command (host/04-command.jsonl), the call line did not go or the Analysis did not stay"
wait_json 60 read_state 04-call-ended 's => s.call != null && s.call.state === "ENDED" && s.call.end_reason === "USER_ENDED"' \
  || fail ITG-04 "the server did not end the call USER_ENDED (host/04-call-ended.json)"
record ITG-04 PASS "the end command (End's own owner.end(), no touch; host/04-command.jsonl) ended the call USER_ENDED; the call line went and the Analysis stayed (J3)"

# ITG-09 — the call's attention leaves with it.
wait_check 30 09-cleanup cleanup "$END_AT" || fail ITG-09 "the phone or its stage still holds attention after the end ($(cat "$OUT/host/09-cleanup.txt"))"
record ITG-09 PASS "after the end: $(cat "$OUT/host/09-cleanup.txt")"

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
  note "iOS Targeted Gate (live call): every functional case passed, with recovery: ITG-03 PASS AFTER RECOVERY (an unresolved interruption: $RECOVERED)"
else
  note "iOS Targeted Gate (live call): every functional case PASS"
fi

# UI touch — SEPARATE from the functional cases above, which all passed: real taps through the simulator's synthetic touch
# delivery (the delivery that dropped the call-entry tap in runs 45612961224, 45630621237 and 45659136860). Each check is
# recorded once in ui-touch.tsv as PASS / FAIL / NOT TESTED; nothing repeats; each flow is bounded to 120 s. Nothing here
# changes the exit status, and none of it is functional evidence: a FAIL here is the touch's, reported as it is.
UI_TOUCH="$OUT/ui-touch.tsv"
printf 'case\tresult\tdetail\n' > "$UI_TOUCH"
ut() {
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$UI_TOUCH"
  note "UI TOUCH $2 $1 — $3"
}
ut_untested() { for c in "$@"; do ut "$c" "NOT TESTED" "not reached: an earlier UI touch check did not pass"; done; }
FIRST_CALL="$(node -e 'try { process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).call.id)); } catch {}' "$OUT/host/04-call-ended.json" 2>/dev/null)"
ui_touch() {
  FLOW_SECONDS=120 flow itg-call-tap.yaml ut-1 -e ID=qandeel-depth-to-conversation -e WAIT_ID=qandeel-call-entry -e SHOT=ut-1-conversation \
    || { ut UT-1 FAIL "a tap on the door back to the Conversation did not draw the call entry"; ut_untested UT-2 UT-3; return 0; }
  ut UT-1 PASS "a tap on the door back to the Conversation drew the call entry again"
  FLOW_SECONDS=120 flow itg-call-tap.yaml ut-2 -e ID=qandeel-call-entry -e WAIT_ID=qandeel-call-rail:end -e SHOT=ut-2-in-call \
    || { read_state > "$OUT/host/ut-2-state.json"; ut UT-2 FAIL "a tap on the call entry did not draw the call line's End (host/ut-2-state.json)"; ut_untested UT-3; return 0; }
  wait_json 60 read_state ut-2-call-active "s => s.call != null && s.call.id !== \"$FIRST_CALL\" && s.call.state === \"ACTIVE\"" \
    || { ut UT-2 FAIL "the call line's End was drawn, but the server holds no second ACTIVE call (host/ut-2-call-active.json)"; ut_untested UT-3; return 0; }
  ut UT-2 PASS "a tap on the call entry opened a second call the server holds ACTIVE; the call line's End is drawn"
  FLOW_SECONDS=120 flow itg-call-tap.yaml ut-3 -e ID=qandeel-call-rail:end -e WAIT_ID=qandeel-call-entry -e SHOT=ut-3-ended \
    || { ut UT-3 FAIL "a tap on End did not draw the call entry again"; return 0; }
  wait_json 60 read_state ut-3-call-ended "s => s.call != null && s.call.id !== \"$FIRST_CALL\" && s.call.state === \"ENDED\" && s.call.end_reason === \"USER_ENDED\"" \
    || { ut UT-3 FAIL "the call entry is drawn again, but the server did not end the second call USER_ENDED (host/ut-3-call-ended.json)"; return 0; }
  ut UT-3 PASS "a tap on End ended the second call USER_ENDED; the call entry is drawn again"
}
ui_touch
note "UI touch (separate; not functional evidence): $(tail -n +2 "$UI_TOUCH" | cut -f1,2 | tr '\t' ' ' | paste -sd ',' - | sed 's/,/, /g')"
exit 0
