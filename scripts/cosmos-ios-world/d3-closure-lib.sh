#!/bin/bash
# D-3 CP4 closure validation (PO review 2026-11-19). VALIDATION BRANCH ONLY; never merged. Sourced after
# d3-validate-lib.sh. `test-without-building` installs the app its xctestrun names, so the xctestrun picks the app.

# replay_run <udid> <out> <name> <xctestrun>: the Replay journey once, on a fresh install of that app, outcome recorded.
replay_run() {
  local u="$1" out="$2" name="$3" outcome
  mkdir -p "$out"
  xcrun simctl terminate "$u" com.qandeel.mobile 2>/dev/null || true
  xcrun simctl uninstall "$u" com.qandeel.mobile 2>/dev/null || true
  echo "[$(date -u +%H:%M:%S)] $name: content_size=$(xcrun simctl ui "$u" content_size 2>&1)" | tee -a "$out/run.log"
  TEST_RUNNER_D3_TAG="$name" xcodebuild test-without-building -xctestrun "$4" -destination "id=$u" \
    -only-testing "QandeelWorldUITests/ReplayCompatUITests/testReplayJourneyCompatibility" -resultBundlePath "$out/$name.xcresult" > "$out/$name.log" 2>&1 || true
  outcome="$(grep -oE "Test [Cc]ase '[^']*' (passed|failed|skipped)" "$out/$name.log" | tail -n 1 | awk '{print $NF}')"
  printf '%s\t%s\t%s\t%s\n' "$name" testReplayJourneyCompatibility "${outcome:-not run}" "$(grep -E 'error: -\[' "$out/$name.log" | sed 's/.*error: -\[[^]]*\] : //' | tr '\n' ' ' | cut -c1-600)" >> "$out/summary.tsv"
  grep -E "Test [Cc]ase|error: -\[|\*\* TEST" "$out/$name.log" | tee -a "$out/run.log" || true
  xcrun xcresulttool export attachments --path "$out/$name.xcresult" --output-path "$out/$name" > /dev/null 2>&1 || true
  rm -rf "${out:?}/$name.xcresult"
  find "$out/$name" -name '*.png' 2>/dev/null | while read -r f; do
    sips -s format jpeg -s formatOptions 70 -Z 1000 "$f" --out "${f%.png}.jpg" > /dev/null 2>&1 && rm -f "$f"
  done
}
