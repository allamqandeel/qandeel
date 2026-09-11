#!/usr/bin/env bash
# T-13 — decide a recovery job from the recorded phase outcomes, and write the summary table.
#
# Four states, kept apart: `success`, `failure`, `blocked` (a prerequisite failed, so the phase never
# ran — a different fact from failing) and `skipped`. The device / simulator restart pair (phases 8 and
# 9) is reported on its own line and never decides the job: the architecture asks for it "where the
# environment supports it", and an environment that cannot restart cleanly must not be able to mask
# the kill and reopen proofs, nor be read as a Product failure.
#
# Usage: gate-t13-recovery-phases.sh <results file> <platform label>
set -uo pipefail
results="$1"
label="$2"
{
  echo "### T-13 recovery / persistence — $label"
  echo ''
  echo '| phase | result |'
  echo '| --- | --- |'
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
if [ ! -f "$results" ]; then
  echo "| (no results file) | \`NOT EXECUTED\` |" >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
  echo "no phase results were recorded"
  exit 1
fi
failed=0
while IFS='=' read -r phase outcome; do
  [ -n "$phase" ] || continue
  case "$outcome" in
    success) state='EXECUTED — PASS' ;;
    failure) state='EXECUTED — FAIL' ;;
    blocked) state='NOT EXECUTED — prerequisite blocked' ;;
    skipped) state='NOT EXECUTED — skipped' ;;
    *) state="UNKNOWN ($outcome)" ;;
  esac
  case "$phase" in
    phase-08-*|phase-09-*)
      [ "$outcome" = success ] || state="$state (device restart: reported, not gated)"
      ;;
    *)
      [ "$outcome" = success ] || failed=1
      ;;
  esac
  echo "| $phase | \`$state\` |" >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
  echo "$phase: $state"
done < "$results"
{
  echo ''
  echo "$label evidence only. Functional recovery contract on a Release build against the real API; never a physical, tactile, backup or Data Protection claim."
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
exit "$failed"
