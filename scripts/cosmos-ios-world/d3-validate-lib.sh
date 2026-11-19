#!/bin/bash
# COSMOS-INT-01 Slice E, D-3 validation (PO 2026-11-18, contract §24): helpers for .github/workflows/cosmos-ios-d3-validation.yml.
# Sourced; uses XCTESTRUN and APP from the build step. Every test is run once, never retried; its outcome is recorded.

# boot_wait <udid>: boot and wait (bounded).
boot_wait() {
  xcrun simctl boot "$1" 2>/dev/null || true
  node scripts/validation/bounded-run.mjs --seconds 300 --label ios-simulator-boot -- xcrun simctl bootstatus "$1" -b > /dev/null
}

# set_lang <udid> <AppleLanguages tag> <AppleLocale>: the simulator's own language (the app follows the device locale).
set_lang() {
  local p="$HOME/Library/Developer/CoreSimulator/Devices/$1/data/Library/Preferences/.GlobalPreferences.plist"
  xcrun simctl shutdown "$1" 2>/dev/null || true
  plutil -replace AppleLanguages -json "[\"$2\"]" "$p" && plutil -replace AppleLocale -string "$3" "$p"
  boot_wait "$1"
}

# run_test <udid> <out dir> <name> <test method> [D3_TAG]: one test; its outcome appended to <out>/summary.tsv; its
# attachments exported (screenshots as JPEG at most 1000 px) and the result bundle dropped.
run_test() {
  local u="$1" out="$2" name="$3" test="$4" tag="${5:-$3}"
  mkdir -p "$out"
  echo "[$(date -u +%H:%M:%S)] $name: $test (D3_TAG=$tag)" | tee -a "$out/run.log"
  TEST_RUNNER_D3_TAG="$tag" xcodebuild test-without-building -xctestrun "$XCTESTRUN" -destination "id=$u" \
    -only-testing "QandeelWorldUITests/CosmosWorldGestureUITests/$test" -resultBundlePath "$out/$name.xcresult" > "$out/$name.log" 2>&1 || true
  local outcome
  outcome="$(grep -oE "Test [Cc]ase '[^']*' (passed|failed|skipped)" "$out/$name.log" | tail -n 1 | awk '{print $NF}')"
  printf '%s\t%s\t%s\t%s\n' "$name" "$test" "${outcome:-not run}" "$(grep -E 'error: -\[' "$out/$name.log" | sed 's/.*error: -\[[^]]*\] : //' | tr '\n' ' ' | cut -c1-400)" >> "$out/summary.tsv"
  grep -E "Test [Cc]ase|error: -\[|\*\* TEST" "$out/$name.log" | tee -a "$out/run.log" || true
  xcrun xcresulttool export attachments --path "$out/$name.xcresult" --output-path "$out/$name" > /dev/null 2>&1 || true
  rm -rf "${out:?}/$name.xcresult"
  find "$out/$name" -name '*.png' 2>/dev/null | while read -r f; do
    sips -s format jpeg -s formatOptions 70 -Z 1000 "$f" --out "${f%.png}.jpg" > /dev/null 2>&1 && rm -f "$f"
  done
}

# fresh_round <udid> <out dir> <name>: a freshly booted simulator, a fresh install, then the D-a test alone.
fresh_round() {
  xcrun simctl shutdown "$1" 2>/dev/null || true
  boot_wait "$1"
  xcrun simctl uninstall "$1" com.qandeel.mobile 2>/dev/null || true
  xcrun simctl install "$1" "$APP"
  run_test "$1" "$2" "$3" testFreshInstallFirstVisibleDoorTapOpensTheAnalysis
}

# layout_pass <udid> <out dir> <tag> <lang tag> <locale> <content size>: one cell of the enlarged-text matrix.
layout_pass() {
  local u="$1" out="$2" tag="$3"
  set_lang "$u" "$4" "$5"
  xcrun simctl ui "$u" content_size "$6"
  mkdir -p "$out"
  echo "content_size=$(xcrun simctl ui "$u" content_size 2>&1)" > "$out/$tag-content-size.txt"
  run_test "$u" "$out" "$tag" testLayoutAtTheReadersTextSize "$tag"
}
