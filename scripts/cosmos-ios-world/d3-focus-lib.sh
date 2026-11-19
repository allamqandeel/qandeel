#!/bin/bash
# D-3 CP4 focused validation (PO review 2026-11-19). VALIDATION BRANCH ONLY; never merged. Sourced after
# d3-validate-lib.sh. `test-without-building` installs the app its xctestrun names, so the xctestrun picks the app.

ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time*1000'; }

# utap_run <udid> <out> <name> <xctestrun>: the U-TAP discriminator on one app.
utap_run() {
  XCTESTRUN="$4" run_test "$1" "$2" "$3" testD3ProbeUTapHold
}

# ab_run <udid> <out> <name> <xctestrun> <app>: one P-2 / P-3 / P-4 run on a fresh install, the screen recorded.
# Two status-bar clock changes at recorded host times mark the video, so its frames map to the host's clock.
ab_run() {
  local u="$1" out="$2" name="$3" rec i=0
  mkdir -p "$out"
  xcrun simctl terminate "$u" com.qandeel.mobile 2>/dev/null || true
  xcrun simctl uninstall "$u" com.qandeel.mobile 2>/dev/null || true
  xcrun simctl install "$u" "$5"
  xcrun simctl status_bar "$u" override --time "9:41"
  xcrun simctl io "$u" recordVideo --codec=h264 --force "$out/$name.mp4" > "$out/$name-rec.log" 2>&1 &
  rec=$!
  until grep -q "Recording started" "$out/$name-rec.log" || [ $i -ge 150 ]; do sleep 0.2; i=$((i + 1)); done
  echo "$(ms) recording-started" > "$out/$name-host.txt"
  sleep 2
  echo "$(ms) marker-1 request (status bar 11:11)" >> "$out/$name-host.txt"
  xcrun simctl status_bar "$u" override --time "11:11"
  echo "$(ms) marker-1 returned" >> "$out/$name-host.txt"
  sleep 2
  XCTESTRUN="$4" run_test "$u" "$out" "$name" testD3ProbeABPerf
  sleep 2
  echo "$(ms) marker-2 request (status bar 12:12)" >> "$out/$name-host.txt"
  xcrun simctl status_bar "$u" override --time "12:12"
  echo "$(ms) marker-2 returned" >> "$out/$name-host.txt"
  sleep 2
  kill -INT "$rec" 2>/dev/null || true
  wait "$rec" 2>/dev/null || true
  echo "$(ms) recording-stopped" >> "$out/$name-host.txt"
  xcrun simctl status_bar "$u" clear || true
  ls -la "$out/$name.mp4" >> "$out/$name-host.txt" 2>&1 || true
  "$PY" scripts/cosmos-ios-world/d3-focus-frames.py "$out/$name.mp4" "$out/$name-frames.csv" 402 >> "$out/$name-host.txt" 2>&1 || echo "frame analysis failed" >> "$out/$name-host.txt"
}
