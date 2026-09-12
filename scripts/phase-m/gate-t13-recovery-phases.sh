#!/usr/bin/env bash
# T-13 — decide a recovery job from the recorded phase outcomes, and write the summary table.
#
# The expected phases are declared HERE, not read from the results file: a sequencer that died before
# recording anything must fail this gate, never pass it on an empty table. The first cloud run did
# exactly that on iOS — /bin/bash 3.2 rejected the sequencer's bash-4 array, the results file stayed
# empty, and a loop over nothing found nothing to fail. The T-13 static contract holds this list to the
# phases the sequencer actually runs.
#
# Five states, kept apart: `success`, `failure`, `blocked` (a prerequisite failed, so the phase never
# ran — a different fact from failing), `skipped`, and `missing` (never recorded: the sequencer did not
# get there). The device / simulator restart (phase 8) is reported on its own line and never decides
# the job: the architecture asks for it "where the environment supports it", and an environment that
# cannot restart cleanly must not be able to mask the kill and reopen proofs, nor be read as a Product
# failure. Phase 9 — recovery AFTER that restart — is exempt only while phase 8 did not succeed; once
# the environment did restart, phase 9 is a recovery claim like any other and is gated.
#
# Usage: gate-t13-recovery-phases.sh <results file> <platform label>
set -uo pipefail
results="$1"
label="$2"
EXPECTED_PHASES="phase-01-fresh-signin phase-02-kill-resume phase-03-adopt-session phase-04-kill-adopted-follow-live phase-05-pin-moment phase-06-kill-pinned phase-07-close-reopen phase-08-device-restart phase-09-after-device-restart phase-10-sign-out phase-11-signed-out-launch phase-12-replacement phase-13-adopt-foreign phase-14-refused"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
{
  echo "### T-13 recovery / persistence — $label"
  echo ''
  echo '| phase | result |'
  echo '| --- | --- |'
} >> "$summary"
if [ ! -f "$results" ]; then
  echo "| (no results file) | \`NOT EXECUTED\` |" >> "$summary"
  echo "no phase results were recorded"
  exit 1
fi

outcome_of() {
  sed -n "s/^$1=\([a-z]*\).*/\1/p" "$results" | tail -n 1
}

failed=0
restarted="$(outcome_of phase-08-device-restart)"
for phase in $EXPECTED_PHASES; do
  outcome="$(outcome_of "$phase")"
  outcome="${outcome:-missing}"
  case "$outcome" in
    success) state='EXECUTED — PASS' ;;
    failure) state='EXECUTED — FAIL' ;;
    blocked) state='NOT EXECUTED — prerequisite blocked' ;;
    skipped) state='NOT EXECUTED — skipped' ;;
    missing) state='NOT RECORDED — the sequencer never reached this phase' ;;
    *) state="UNKNOWN ($outcome)" ;;
  esac
  case "$phase" in
    phase-08-*)
      [ "$outcome" = success ] || state="$state (device restart: reported, not gated)"
      ;;
    phase-09-*)
      if [ "$restarted" = success ]; then
        [ "$outcome" = success ] || failed=1
      else
        [ "$outcome" = success ] || state="$state (no successful device restart to recover from: reported, not gated)"
      fi
      ;;
    *)
      [ "$outcome" = success ] || failed=1
      ;;
  esac
  echo "| $phase | \`$state\` |" >> "$summary"
  echo "$phase: $state"
done
# A recorded phase this gate does not know is a sequencer / gate mismatch, and fails loudly.
while IFS='=' read -r phase _; do
  [ -n "$phase" ] || continue
  case " $EXPECTED_PHASES " in
    *" $phase "*) ;;
    *)
      echo "| $phase | \`UNEXPECTED — not a phase this gate declares\` |" >> "$summary"
      echo "unexpected phase in the results: $phase"
      failed=1
      ;;
  esac
done < "$results"
{
  echo ''
  echo "$label evidence only. Functional recovery contract on a Release build against the real API; never a physical, tactile, backup or Data Protection claim."
} >> "$summary"
exit "$failed"
