#!/usr/bin/env bash
# QAN-BL-CI-03 — read-only evidence for an Android emulator boot smoke that failed.
#
# The intermittent failure this exists for: Maestro stops at `Launch app "com.qandeel.mobile" with clear state...`
# with no assertion, no crash and no message (A3-02 record: runs 37216917512, 37188980195, 37228370161; W3-MEGA-S
# record §17; S8B-03 CP2: run 41276622163). Its cause was never seen: the emulator action kills the emulator as soon as
# its script fails, and the consumer publishes nothing (QAN-INF-04), so Maestro's own log and the device state were
# lost every time. This prints them into the job log while the emulator is still alive.
#
# It reads and prints; it changes no state, decides no result and always exits 0. Every device read is bounded, so a
# device gone offline cannot hold the step. It prints no app data: the boot smoke runs an unconfigured Release build
# with no account, and the logcat lines are only the system's process, activity and crash records.
#
# Usage (inside the emulator action's script, on the failing line only):
#   <smoke command> || { status=$?; timeout 120 bash scripts/validation/android-smoke-diagnostics.sh; exit $status; }

PKG=com.qandeel.mobile
dev() { timeout 15 adb "$@" 2>&1; }

echo '::group::adb devices and boot state'
dev devices -l
echo "sys.boot_completed=$(dev shell getprop sys.boot_completed | tr -d '\r')"
echo "uptime: $(dev shell uptime | tr -d '\r')"
echo '::endgroup::'

echo "::group::$PKG — installed, launchable, running"
dev shell pm path "$PKG"
dev shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER "$PKG"
echo "app pid: $(dev shell pidof "$PKG" | tr -d '\r')"
echo "maestro processes:"; dev shell ps -A | grep -i maestro || echo 'none'
dev shell dumpsys activity activities | grep -iE 'qandeel|mResumedActivity|topResumedActivity' | head -n 20
echo '::endgroup::'

echo '::group::logcat — crash buffer'
dev logcat -d -b crash | tail -n 120
echo '::endgroup::'

echo '::group::logcat — process, activity and runtime records (last 400 lines, filtered)'
dev logcat -d -t 400 -v time | grep -iE "$PKG|maestro|AndroidRuntime|FATAL|ActivityManager|ActivityTaskManager|am_proc|am_crash|ANR|lowmemorykiller" | tail -n 200
echo '::endgroup::'

for dir in $(ls -td "$HOME"/.maestro/tests/*/ 2>/dev/null | head -n 2); do
  echo "::group::maestro.log, errors — $dir"
  grep -nE 'Exception|ERROR|WARN|Caused by|StatusRuntime|UNAVAILABLE|launchApp|clearAppState|pm clear' "$dir/maestro.log" 2>/dev/null | head -n 80 || true
  echo '::endgroup::'
  echo "::group::maestro.log, last lines — $dir"
  tail -n 60 "$dir/maestro.log" 2>/dev/null || true
  echo '::endgroup::'
done

echo '::group::disk'
df -h / 2>&1
dev shell df -h /data
echo '::endgroup::'

exit 0
