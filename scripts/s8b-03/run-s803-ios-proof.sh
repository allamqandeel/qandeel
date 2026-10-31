#!/usr/bin/env bash
# S8B-03 CP2 — the Voice Note native-capability proof on ONE booted iOS Simulator. VALIDATION ONLY.
#
# usage: bash scripts/s8b-03/run-s803-ios-proof.sh <app-dir> <out-dir> <simulator-udid>
#
# The .app is the S8B-03 proof build (select-s803-proof-entry.mjs pointed `main` at the proof root for that build only).
# A GitHub macOS runner has no microphone: what the simulator records is silence, and the flow is proven against the fake
# voice server on 127.0.0.1:8803 (contract v1.2 §8.3). Nothing paid, no provider, no account, no credential.
#
#   B2  nothing asks at launch; «record» hands over to iOS's own alert carrying C-12; «Don't Allow» → PERMISSION_DENIED
#   B5  a recording stops into a SAVED draft whose container is complete; the uploaded file's AAC-LC / mono / 16 kHz
#       container and the CP1 duration prover's verdict (the fake server's log)
#   B6  upload with the bearer → ACCEPTED, the draft removed; playback streamed from the fake server with the bearer
#   B3  the app sent to the background mid-recording → the draft is kept, stopped LEFT_SCREEN
#   B4  a relaunch recovers the draft and sends nothing; owner B sees none of owner A's drafts; the drafts folder and the
#       drafts database carry iOS's "excluded from backup" flag (read on the host from the simulator's container)
#   B9  the production saver (C-49) into a folder chosen in iOS's own picker — attempted, its outcome recorded
#
# Every screenshot, the fake server's content-free log, the uploaded silence files and their container facts are kept in
# <out-dir>. Nothing here logs audio, a token or a transcript. A red run stays red; only B9's picker is recorded, not
# required (contract §8.2: «Android حقيقي (+ iOS Sim)»).
set -u
if [ "$#" -ne 3 ]; then echo "usage: run-s803-ios-proof.sh <app-dir> <out-dir> <udid>"; exit 2; fi
APP="$1"
OUT="$2"
UDID="$3"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
BUNDLE="com.qandeel.mobile"
OWNER_A="a0000000-0000-4000-8000-000000000803"
mkdir -p "$OUT/server" "$OUT/shots"
SUMMARY="$OUT/summary.txt"
: > "$SUMMARY"
note() { echo "$1" | tee -a "$SUMMARY"; }
fail() {
  note "FAIL — $1"
  xcrun simctl io "$UDID" screenshot "$OUT/shots/failure.png" >/dev/null 2>&1 || true
  exit 1
}
BOUND="node $REPO/scripts/validation/bounded-run.mjs"
flow() {
  local file="$1" label="$2"
  shift 2
  $BOUND --seconds 300 --label "flow-$label" --out "$OUT" -- maestro --device "$UDID" test --debug-output "$OUT/debug-$label" \
    --test-output-dir "$OUT/shots" -e PREFIX=s803 "$@" "$FLOWS/$file"
}
step() { flow s803-ios-step.yaml "$1" -e CMD="$1" -e EXPECT="$2"; }
# Recording is started and stopped by the proof root's own buttons (a reader's tap): a link opened from outside can make
# iOS mark the app inactive for a moment, which (rightly) stops a capture as LEFT_SCREEN.
tap() { flow s803-ios-tap.yaml "$1-$3" -e ID="$1" -e EXPECT="$2"; }

# The fake voice server (CP1's prover and consent text from the built API).
S803_OUT="$OUT/server" S803_LABEL=ios node "$REPO/scripts/s8b-03/fake-voice-server.cjs" > "$OUT/server/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do grep -q '"listening"' "$OUT/server/server.log" 2>/dev/null && break; sleep 0.2; done
grep -q '"listening"' "$OUT/server/server.log" || fail "INFRASTRUCTURE — the fake voice server did not start"

$BOUND --seconds 300 --label simulator-boot --out "$OUT" -- xcrun simctl bootstatus "$UDID" -b || fail "INFRASTRUCTURE — the simulator did not finish booting"
xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl privacy "$UDID" reset all "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP" || fail "install"
{
  echo "simulator: $UDID / $(xcrun simctl list devices | grep "$UDID" | head -n 1 | sed 's/^ *//')"
  echo "app: $APP"
} | tee -a "$SUMMARY"
$BOUND --seconds 300 --label driver-readiness --out "$OUT" --quiet -- maestro --device "$UDID" hierarchy --compact \
  || fail "INFRASTRUCTURE — the Maestro XCTest driver did not answer; no Product step was run"

# B2 — permission at the moment of intent, refused.
flow s803-ios-permission.yaml permission || fail "B2: the iOS alert with C-12, or the refusal"
note "PASS B2 — nothing asked at launch; iOS's own alert carried C-12; Don't Allow → PERMISSION_DENIED"

# Granted (simctl privacy, as a reader's Settings would), then relaunched without clearing the app's data.
xcrun simctl privacy "$UDID" grant microphone "$BUNDLE" || fail "simctl privacy grant microphone"
flow s803-ios-launch.yaml launch-granted -e SHOT=04-granted || fail "relaunch with the microphone granted"

# B5 / B6 — record, stop, upload, play.
tap s803-record ".*S8B-03 proof ready.*" a || fail "record"
sleep 4
tap s803-stop ".*STOPPED by=USER bytes=[1-9][0-9]* ms=[1-9][0-9]* check=COMPLETE.*" a || fail "B5: stop → a complete SAVED draft"
step list ".*LIST A drafts=1 \\[SAVED:[1-9][0-9]*\\].*B drafts=0.*" || fail "B4: owner A's one draft; owner B sees none"
step upload ".*UPLOAD ACCEPTED bytes=[1-9][0-9]* draftLeft=false.*" || fail "B6: upload ACCEPTED and the draft removed"
step play ".*PLAY loaded=true.*" || fail "B6: streamed playback with the bearer"
step pause ".*PAUSE at=.*" || fail "pause"
note "PASS B5/B6 — recorded, stopped into a complete draft, uploaded (ACCEPTED, draft removed), played from the server"

# B3 — the background stops the capture and keeps the draft.
tap s803-record ".*PAUSE at=.*" b || fail "record (background leg)"
sleep 3
xcrun simctl launch "$UDID" com.apple.Preferences >/dev/null || fail "send the app to the background"
sleep 4
xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null || fail "bring the app back"
flow s803-ios-expect.yaml background -e SHOT=05-left-screen -e EXPECT=".*STOPPED by=LEFT_SCREEN bytes=[1-9][0-9]* ms=[1-9][0-9]* check=COMPLETE.*" \
  || fail "B3: the background did not stop the capture into a kept draft"
note "PASS B3 — the background stopped the capture; the draft is kept (LEFT_SCREEN)"

# B4 — iOS's backup flag on the drafts folder and database, read on the host.
DATA="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data)" || fail "the app's data container"
FLAG="com.apple.metadata:com_apple_backup_excludeItem"
for item in "Documents/qandeel-voice-drafts" "Documents/SQLite/qandeel-voice-drafts.db"; do
  [ -e "$DATA/$item" ] || fail "B4: $item does not exist"
  xattr -p "$FLAG" "$DATA/$item" >/dev/null 2>&1 || fail "B4: $item is not excluded from backup"
done
ls "$DATA/Documents/qandeel-voice-drafts/$OWNER_A/" > "$OUT/drafts-of-owner-a.txt" 2>&1 || true
note "PASS B4 — the drafts folder and the drafts database carry iOS's excluded-from-backup flag"

# B4 — relaunch: the draft is recovered and nothing is sent.
UPLOADS_BEFORE="$(grep -c '"kind":"upload"' "$OUT/server/server.log")"
flow s803-ios-launch.yaml relaunch -e SHOT=06-relaunched || fail "relaunch"
step recover ".*RECOVER unrecoverable=0 drafts=1 \\[SAVED:LEFT_SCREEN:[1-9][0-9]*\\].*" || fail "B4: the draft recovered after relaunch"
sleep 3
[ "$(grep -c '"kind":"upload"' "$OUT/server/server.log")" = "$UPLOADS_BEFORE" ] || fail "B4: something was uploaded on recovery"
note "PASS B4 — relaunched: the draft recovered, zero uploads"
step upload ".*UPLOAD ACCEPTED bytes=[1-9][0-9]* draftLeft=false.*" || fail "upload of the recovered draft"

# The production surface, Arabic and English (screenshots).
step ui-ar ".*" || fail "the Arabic surface"
step ui-close ".*S8B-03 proof ready.*" || fail "close"
step ui-en ".*" || fail "the English surface"
step ui-close ".*S8B-03 proof ready.*" || fail "close"

# The uploaded files: container facts and the CP1 prover's verdict, from the server's own log.
for f in "$OUT"/server/ios-*.m4a; do
  [ -e "$f" ] || fail "B5: no uploaded file"
  echo "$(basename "$f") $(node "$REPO/scripts/s8b-03/m4a-info.cjs" "$f")" | tee -a "$SUMMARY"
done
grep '"kind":"upload"' "$OUT/server/server.log" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    for (const line of s.trim().split("\n")) { const o = JSON.parse(line); console.log(`upload ${o.file} bytes=${o.bytes} auth=${o.auth} prover=${JSON.stringify(o.proof)}`); }
  });' | tee -a "$SUMMARY"
grep '"kind":"play"' "$OUT/server/server.log" | head -n 3 | tee -a "$SUMMARY"
grep -q '"kind":"play","auth":true' "$OUT/server/server.log" || fail "B6: playback reached the server without the bearer"

# B9 — the production saver into a folder picked in iOS's own document picker. Recorded, not required.
if flow s803-ios-export.yaml export; then
  note "PASS B9 (iOS) — VOICES SAVED through the production saver"
else
  note "NOT PROVEN B9 (iOS) — the document picker step did not complete on this simulator; Android proves B9 (record §11)"
fi
note "PASS S8B-03 iOS Simulator proof"
exit 0
