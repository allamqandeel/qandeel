#!/usr/bin/env bash
# S6-01 CI-R2 — read-only evidence for an iOS Maestro driver that did not answer.
#
# Maestro cli-2.10.0 starts its XCTest driver with `test-without-building` and writes that process's output
# to `<session>/xctest_runner_<date>.log`, beside `maestro.log`, in `~/.maestro/tests/<session>/`
# (`XCRunnerCLIUtils.xctestLogFile`, logsDir = `TestDebugReporter.getDebugOutputPath()`). CI-R1 printed only the
# tail of `maestro.log`, which held nothing but refused status checks. This prints the runner's own output,
# the launch lines at the HEAD of `maestro.log`, and the simulator's XCTest services log.
#
# It reads and prints; it changes no state, decides no result and always exits 0.
#
# Usage: bash scripts/validation/ios-driver-diagnostics.sh <simulator-udid>

udid="${1:-}"
here="$(cd "$(dirname "$0")" && pwd)"

echo '::group::simulators (booted)'
xcrun simctl list devices booted 2>&1 || true
echo '::endgroup::'

# ACCT-DEL-01 CI-iOS correction: how many XCTest runner launches are alive, and which port each driver serves.
# Run 39047797516 had two (ports 22087 and 51962) at once. The smoke must reuse the probe's single driver.
echo '::group::XCTest runner launches and driver ports (live)'
pgrep -fl 'test-without-building' 2>&1 || echo 'no test-without-building process'
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -i 'maestro-d\|xctrunner\|iosUITests' || echo 'no XCTest driver port listening'
echo '::endgroup::'

for dir in $(ls -td "$HOME"/.maestro/tests/*/ 2>/dev/null | head -n 3); do
  echo "::group::maestro.log, launch lines — $dir"
  grep -nE 'Running command line operation|Install|test-without-building|Exception|ERROR|WARN' "$dir/maestro.log" 2>/dev/null | head -n 60 || true
  echo '::endgroup::'
  echo "::group::maestro.log, last lines — $dir"
  tail -n 25 "$dir/maestro.log" 2>/dev/null || true
  echo '::endgroup::'
  for log in "$dir"/xctest_runner_*.log; do
    [ -f "$log" ] || continue
    echo "::group::XCTest runner output — $log ($(wc -l < "$log" | tr -d ' ') lines)"
    tail -n 200 "$log" 2>/dev/null || true
    echo '::endgroup::'
  done
done

if [ -n "$udid" ]; then
  echo '::group::simulator log — XCTest services, last 15 minutes'
  node "$here/bounded-run.mjs" --seconds 120 --label ios-driver-simulator-log -- \
    xcrun simctl spawn "$udid" log show --last 15m --style compact \
      --predicate 'process == "testmanagerd" OR process CONTAINS[c] "xctrunner" OR process CONTAINS[c] "maestro-driver"' \
    2>&1 | tail -n 200 || true
  echo '::endgroup::'
fi

exit 0
