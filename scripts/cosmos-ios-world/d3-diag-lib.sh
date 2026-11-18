#!/bin/bash
# COSMOS-INT-01 Slice E, D-3 CP1 — DIAGNOSTIC ONLY (branch cosmos/slice-e-d3-diag; never merged). Helpers for
# .github/workflows/cosmos-slice-e-d3-diag.yml. Sourced; uses XCTESTRUN from the build step.

# reboot_sim <udid>: a cold simulator (the app stays installed).
reboot_sim() {
  xcrun simctl shutdown "$1" 2>/dev/null || true
  xcrun simctl boot "$1"
  node scripts/validation/bounded-run.mjs --seconds 300 --label ios-simulator-reboot -- xcrun simctl bootstatus "$1" -b > /dev/null
}

# set_lang <udid> <AppleLanguages tag> <AppleLocale>: the simulator's own language (the app follows the device locale).
set_lang() {
  local p="$HOME/Library/Developer/CoreSimulator/Devices/$1/data/Library/Preferences/.GlobalPreferences.plist"
  xcrun simctl shutdown "$1" 2>/dev/null || true
  plutil -replace AppleLanguages -json "[\"$2\"]" "$p" && plutil -replace AppleLocale -string "$3" "$p"
  xcrun simctl boot "$1"
  node scripts/validation/bounded-run.mjs --seconds 300 --label ios-simulator-boot -- xcrun simctl bootstatus "$1" -b > /dev/null
}

# run_test <udid> <out dir> <name> <test method> <D3_TAG>: one diagnostic test, its attachments exported and compacted
# (screenshots as JPEG at most 1000 px), the result bundle dropped.
run_test() {
  local u="$1" out="$2" name="$3" test="$4" tag="$5"
  echo "[$(date -u +%H:%M:%S)] $name: $test (D3_TAG=$tag)" | tee -a "$out/run.log"
  TEST_RUNNER_D3_TAG="$tag" xcodebuild test-without-building -xctestrun "$XCTESTRUN" -destination "id=$u" \
    -only-testing "QandeelWorldUITests/CosmosD3DiagUITests/$test" -resultBundlePath "$out/$name.xcresult" > "$out/$name.log" 2>&1 || true
  grep -E "Test [Cc]ase|error: -\[|\*\* TEST" "$out/$name.log" | tee -a "$out/run.log" || true
  xcrun xcresulttool export attachments --path "$out/$name.xcresult" --output-path "$out/$name" > /dev/null 2>&1 || true
  rm -rf "${out:?}/$name.xcresult"
  find "$out/$name" -name '*.png' 2>/dev/null | while read -r f; do
    sips -s format jpeg -s formatOptions 70 -Z 1000 "$f" --out "${f%.png}.jpg" > /dev/null 2>&1 && rm -f "$f"
  done
}

# layout_pass <udid> <out dir> <tag> <lang tag> <locale> <content size>: one cell of the enlarged-text matrix.
layout_pass() {
  local u="$1" out="$2" tag="$3"
  set_lang "$u" "$4" "$5"
  xcrun simctl ui "$u" content_size "$6"
  echo "content_size=$(xcrun simctl ui "$u" content_size 2>&1)" > "$out/$tag-content-size.txt"
  run_test "$u" "$out" "$tag" test3_layout "$tag"
}
