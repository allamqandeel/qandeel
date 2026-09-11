#!/usr/bin/env bash
# T-13 — the native restart / recovery sequence, one script for both platforms.
#
# Every phase is a Maestro flow against ONE installation of the validation build, and every "after"
# phase is preceded by a REAL interruption performed here, outside any flow: a process kill, a
# home-and-reopen, or a device restart. A phase runs only when the phases it depends on succeeded;
# otherwise it is recorded as `blocked`, never as a pass — a phase that passes because a prerequisite
# failed is worse than a phase that fails.
#
# Portability: this runs under macOS's /bin/bash 3.2 as well as Linux bash 5, so it uses no bash-4
# feature. The first cloud run died on `declare -A` under 3.2 — before any outcome was recorded — and
# left an empty results file behind. The results file IS the record now: every outcome is appended
# there as it happens and read back from there, and the gate declares for itself what "complete" means.
#
# Inputs (environment):
#   PLATFORM            android | ios
#   DEVICE              iOS simulator UDID (ios only)
#   EMAIL_A PASSWORD_A EMAIL_B PASSWORD_B     the two validation identities (never printed; only their
#                                             character counts reach a flow, so a flow can check that
#                                             the whole value arrived without seeing it)
#   SESSION_ID          a Session the server populated for identity A (adopted through the store)
#   FOREIGN_SESSION_ID  a syntactically valid Session locator that is NOT identity A's
#   MOMENT              the Session Position to pin (must be <= the adopted Session's Live Head)
#   DEBUG_ROOT          where each phase writes its Maestro diagnostics
#   RESULTS             the phase-results file this script appends to
#
# VALIDATION TOOLING. Runs Maestro and platform tools; writes diagnostics and one results file.
set -uo pipefail

: "${PLATFORM:?PLATFORM is required (android|ios)}"
: "${DEBUG_ROOT:?DEBUG_ROOT is required}"
: "${RESULTS:?RESULTS is required}"
: "${EMAIL_A:?EMAIL_A is required}"
: "${PASSWORD_A:?PASSWORD_A is required}"
: "${EMAIL_B:?EMAIL_B is required}"
: "${PASSWORD_B:?PASSWORD_B is required}"
: "${SESSION_ID:?SESSION_ID is required}"
: "${FOREIGN_SESSION_ID:?FOREIGN_SESSION_ID is required}"
: "${MOMENT:?MOMENT is required}"
APP_ID="com.qandeel.mobile"
FLOWS="apps/mobile/.maestro"
# The flows assert the temporal mode as a regular expression, so the parentheses are escaped here.
PINNED_TM="PINNED\\($MOMENT\\)"
mkdir -p "$DEBUG_ROOT"
: > "$RESULTS"

maestro_cmd() {
  if [ "$PLATFORM" = "ios" ]; then
    maestro --device "${DEVICE:?DEVICE is required on ios}" test "$@"
  else
    maestro test "$@"
  fi
}

# --- the interruptions, performed here and never simulated in a flow --------------------------
kill_app() {
  if [ "$PLATFORM" = "ios" ]; then
    xcrun simctl terminate "$DEVICE" "$APP_ID" || true
  else
    adb shell am force-stop "$APP_ID" || true
  fi
  sleep 3
}

restart_device() {
  if [ "$PLATFORM" = "ios" ]; then
    xcrun simctl shutdown "$DEVICE" || true
    sleep 5
    xcrun simctl boot "$DEVICE" || true
    xcrun simctl bootstatus "$DEVICE" -b
  else
    adb reboot
    adb wait-for-device
    local waited=0
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
      sleep 5
      waited=$((waited + 5))
      if [ "$waited" -ge 600 ]; then
        echo "device did not finish booting within 600s"
        return 1
      fi
    done
    adb shell input keyevent 82 || true
  fi
  sleep 5
}

# --- the record -------------------------------------------------------------------------------
# outcome_of <phase>: the recorded outcome, read back from the results file ("" when never recorded).
outcome_of() {
  sed -n "s/^$1=\([a-z]*\).*/\1/p" "$RESULTS" | tail -n 1
}

# record <phase> <outcome> [detail]: append one line to the results file, and echo it.
record() {
  if [ -n "${3:-}" ]; then
    echo "$1=$2 ($3)" | tee -a "$RESULTS"
  else
    echo "$1=$2" | tee -a "$RESULTS"
  fi
}

# --- the sequencer ----------------------------------------------------------------------------
# run_phase <name> <flow> <requires (comma-separated names or -)> [maestro -e args...]
run_phase() {
  local name="$1" flow="$2" requires="$3"
  shift 3
  local r prior
  if [ "$requires" != "-" ]; then
    for r in $(printf '%s' "$requires" | tr ',' ' '); do
      prior="$(outcome_of "$r")"
      if [ "${prior:-missing}" != "success" ]; then
        record "$name" blocked "requires $r=${prior:-missing}"
        return 0
      fi
    done
  fi
  echo "=== phase $name: $flow"
  if maestro_cmd --debug-output "$DEBUG_ROOT/$name" "$@" "$FLOWS/$flow"; then
    record "$name" success
  else
    record "$name" failure
  fi
}

# 1. clean install, identity A signs in, the locator is written
run_phase phase-01-fresh-signin t13-recovery-phase-1-fresh-signin.yaml - \
  -e EMAIL_A="$EMAIL_A" -e EMAIL_A_CHARS="${#EMAIL_A}" -e PASSWORD_A="$PASSWORD_A" -e PASSWORD_A_CHARS="${#PASSWORD_A}"
# The Session locator phase 1 minted is not known to this script; the resume claim for phase 2 is
# therefore "RESUMED" plus the mode, and the identity of the Session is proven by phase 4 onward,
# where the locator IS known.
kill_app
run_phase phase-02-kill-resume t13-recovery-after.yaml phase-01-fresh-signin -e SHOT=t13-phase-2-kill-resume -e TM=FOLLOW_LIVE -e SESSION=""
# 3. adopt the server-populated Session for identity A, through the production store and codec
run_phase phase-03-adopt-session t13-recovery-adopt-session.yaml phase-02-kill-resume \
  -e SESSION_ID="$SESSION_ID" -e SESSION_ID_CHARS="${#SESSION_ID}" -e SHOT=t13-phase-3-adopt
kill_app
# 4. FOLLOW_LIVE recovery of the adopted Session: fresh LH from the server, no Live Head in the record
run_phase phase-04-kill-adopted-follow-live t13-recovery-after.yaml phase-03-adopt-session -e SHOT=t13-phase-4-adopted-follow-live -e TM=FOLLOW_LIVE -e SESSION="$SESSION_ID"
# 5. pin a Moment, then 6. kill: PINNED(t) recovery keeps exactly t
run_phase phase-05-pin-moment t13-recovery-pin-moment.yaml phase-04-kill-adopted-follow-live -e MOMENT="$MOMENT" -e MOMENT_CHARS="${#MOMENT}"
kill_app
run_phase phase-06-kill-pinned t13-recovery-after.yaml phase-05-pin-moment -e SHOT=t13-phase-6-kill-pinned -e "TM=$PINNED_TM" -e SESSION="$SESSION_ID"
# 7. a normal close and reopen keeps the pinned viewpoint
run_phase phase-07-close-reopen t13-recovery-close-reopen.yaml phase-06-kill-pinned -e "TM=$PINNED_TM" -e SESSION="$SESSION_ID"
# 8. a device / simulator restart, where the environment supports it. Reported on its own line and
#    judged on its own: the phases after it depend on phase 7, so an environment that cannot restart
#    cleanly is recorded as exactly that and cannot mask the kill / reopen proofs. When the restart
#    DID succeed, phase 9 is a recovery claim like any other and the gate holds it to that.
if [ "${SKIP_DEVICE_RESTART:-0}" = "1" ]; then
  record phase-08-device-restart skipped
elif restart_device; then
  record phase-08-device-restart success
else
  record phase-08-device-restart failure
fi
run_phase phase-09-after-device-restart t13-recovery-after.yaml phase-08-device-restart -e SHOT=t13-phase-9-after-device-restart -e "TM=$PINNED_TM" -e SESSION="$SESSION_ID"
# 10. sign out, kill, and a signed-out launch exposes nothing
run_phase phase-10-sign-out t13-recovery-sign-out.yaml phase-07-close-reopen
kill_app
run_phase phase-11-signed-out-launch t13-recovery-after-signed-out.yaml phase-10-sign-out
# 12. identity replacement: B fresh, B out, A resumes A's own pinned record
run_phase phase-12-replacement t13-recovery-replacement.yaml phase-11-signed-out-launch \
  -e EMAIL_A="$EMAIL_A" -e EMAIL_A_CHARS="${#EMAIL_A}" -e PASSWORD_A="$PASSWORD_A" -e PASSWORD_A_CHARS="${#PASSWORD_A}" \
  -e EMAIL_B="$EMAIL_B" -e EMAIL_B_CHARS="${#EMAIL_B}" -e PASSWORD_B="$PASSWORD_B" -e PASSWORD_B_CHARS="${#PASSWORD_B}" \
  -e "TM=$PINNED_TM"
# 13. adopt a Session that is NOT identity A's, kill, and recovery fails closed
run_phase phase-13-adopt-foreign t13-recovery-adopt-session.yaml phase-12-replacement \
  -e SESSION_ID="$FOREIGN_SESSION_ID" -e SESSION_ID_CHARS="${#FOREIGN_SESSION_ID}" -e SHOT=t13-phase-13-adopt-foreign
kill_app
run_phase phase-14-refused t13-recovery-after-refused.yaml phase-13-adopt-foreign

echo "--- T-13 recovery phases ($PLATFORM) ---"
cat "$RESULTS"
