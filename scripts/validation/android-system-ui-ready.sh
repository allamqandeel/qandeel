#!/usr/bin/env bash
# S8B-04 CP1 CI repair R2 — System UI readiness on the Android emulator, BEFORE the boot smoke runs.
#
# Why (run 41324976926, job 124909137558): the boot smoke's `assertVisible: QANDEEL` failed while the app was installed,
# alive and resumed, and the screen was Android's own "System UI isn't responding" dialog (android:id/alertTitle,
# aerr_close, aerr_wait), with a guest load average of 42.20 three minutes after boot on 2 emulated cores. That is the
# emulator's System UI hung, not a Product UI fact, and `sys.boot_completed=1` / a working adb did not exclude it.
#
# What it does: samples the guest every 5 s — System UI's pid, an ANR dialog on screen, an `am_anr` event for System UI,
# and the 1-minute load average — and prints every sample. A HANG is proven by an ANR dialog, an `am_anr` for System UI,
# or System UI absent on three samples in a row. On a proven hang the emulator gets ONE clean recovery (a reboot, then
# the same wait for boot); a second proven hang fails this step as an ENVIRONMENT failure (exit 3) and the smoke does not
# run. It settles when System UI keeps the same pid, with no ANR, and the load is at most 2 per core, on three samples in
# a row; a load that has not settled within the bound is printed and the smoke then decides (exit 0).
#
# It never touches the app, never dismisses a dialog, never retries the smoke (QAN-INF-04 §13: a retry is a human's),
# and reads no app data. Every device call is bounded.
#
# Usage (inside the emulator action's script, before the smoke):
#   timeout 900 bash scripts/validation/android-system-ui-ready.sh || { status=$?; timeout 120 bash scripts/validation/android-smoke-diagnostics.sh; exit $status; }

SYSUI=com.android.systemui
WAIT_SECONDS=${QANDEEL_SYSUI_WAIT_SECONDS:-300}
dev() { timeout 15 adb "$@" 2>/dev/null | tr -d '\r'; }

sysui_anrs() { dev logcat -d -b events | grep -E 'am_anr' | grep -c "$SYSUI"; }
anr_dialogs() { dev shell dumpsys window windows | grep -cE "Application Not Responding|isn't responding"; }

# settle <seconds>: 0 settled, 1 not settled within the bound (no hang), 2 hang proven.
settle() {
  local deadline=$((SECONDS + $1)) streak=0 absent=0 last='' cores cap pid load anr dialog
  cores=$(dev shell nproc); cores=${cores:-2}; cap=$((cores * 2))
  echo "cores=$cores load cap=$cap bound=${1}s"
  while [ "$SECONDS" -lt "$deadline" ]; do
    pid=$(dev shell pidof "$SYSUI")
    load=$(dev shell cat /proc/loadavg | cut -d' ' -f1)
    anr=$(sysui_anrs); dialog=$(anr_dialogs)
    echo "t=${SECONDS}s uptime=$(dev shell cat /proc/uptime | cut -d' ' -f1)s systemui_pid=${pid:-none} load1=${load:-?} systemui_anr=${anr:-?} anr_dialog=${dialog:-?}"
    if [ "${anr:-0}" -gt 0 ] || [ "${dialog:-0}" -gt 0 ]; then return 2; fi
    if [ -z "$pid" ]; then
      absent=$((absent + 1)); streak=0
      [ "$absent" -ge 3 ] && return 2
    else
      absent=0
      if [ "$pid" = "$last" ] && awk -v l="${load:-999}" -v c="$cap" 'BEGIN { exit !(l <= c) }'; then streak=$((streak + 1)); else streak=0; fi
      last=$pid
      [ "$streak" -ge 3 ] && return 0
    fi
    sleep 5
  done
  return 1
}

report() {
  case "$1" in
    0) echo "System UI ready: stable, no ANR, load settled." ;;
    1) echo "System UI up with no ANR; the load did not settle within the bound. The smoke decides." ;;
  esac
}

echo '::group::System UI readiness'
settle "$WAIT_SECONDS"; result=$?
if [ "$result" -ne 2 ]; then report "$result"; echo '::endgroup::'; exit 0; fi

echo "System UI hang PROVEN. One clean recovery: reboot the emulator."
dev logcat -d -b events | grep -E 'am_anr' | tail -n 5
dev reboot
timeout 120 adb wait-for-device
booted=''
for _ in $(seq 1 48); do
  [ "$(dev shell getprop sys.boot_completed)" = 1 ] && { booted=1; break; }
  sleep 5
done
if [ -z "$booted" ]; then echo 'ENVIRONMENT: the emulator did not finish booting after the recovery.'; echo '::endgroup::'; exit 3; fi
echo "rebooted: uptime $(dev shell cat /proc/uptime | cut -d' ' -f1)s"
settle "$WAIT_SECONDS"; result=$?
if [ "$result" -eq 2 ]; then
  echo 'ENVIRONMENT: System UI hung again after one clean recovery. The boot smoke is not run; this is not a Product result.'
  echo '::endgroup::'
  exit 3
fi
report "$result"
echo '::endgroup::'
exit 0
