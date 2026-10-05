#!/usr/bin/env bash
# Stage 3 (A3-01 + A3-02) — ONE proof leg on ONE freshly booted Android emulator. VALIDATION ONLY.
#
# usage: bash scripts/a3/run-proof-leg.sh <apk> <leg-id> <out-dir>
#
# It runs exactly the leg it is given and nothing else: no loop over legs, no shared result file, no state carried from
# another leg (each GitHub matrix job boots its own emulator and installs the verified APK itself). The APK is the one the
# Build Producer built ONCE and the consumer job provenance-checked before calling this script; nothing here builds.
#
# The A3-01 legs keep their exact Product meaning (A3-01 record §18):
#   ar-standard / en-standard   Arabic RTL / English LTR, standard phone                    a3-01-activity.yaml
#   ar-rtl-device               Arabic on an RTL device (Android's system RTL layout)        a3-01-activity.yaml
#   ar-narrow / en-narrow       a 320-class narrow phone (320 dp wide)                       a3-01-activity.yaml
#   ar-narrow-large             320 dp at 200 % system text                                  a3-01-activity.yaml
#   ar-increased                Android high-text-contrast (the app's Increased Contrast)    a3-01-activity.yaml
#   ar-reduced                  launched under Reduce Motion (animator scales 0)             a3-01-activity.yaml
#   en-light                    the Light appearance                                         a3-01-light.yaml
#
# The A3-02 legs, one per platform-delivery capability (record §17), Arabic (the leg the Product reads first):
#   android-permission-allow    nothing at launch → education → the REAL OS prompt → Allow → registered GRANTED
#   android-permission-deny     Not now (said once, no repeat) → OS prompt → Don't allow → said plainly, never
#                               re-prompted → Device Notification Settings hands off to the OS
#   android-delivery-background foreground suppression; background delivery of the server-rendered L0 and L2 messages on
#                               their channels, words checked against the OS's own records; Lock Screen evidence; tap →
#                               revalidated Direct Entry; per-device open evidence
#   android-terminated-entry    the app process killed with notifications posted; tap → cold start → Direct Entry; a
#                               stale target fails closed into Activity; another account's item goes nowhere
#
# Exit status: 0 only if the leg passed. Its one result line is written to <out-dir>/result.txt.
set -u

if [ "$#" -ne 3 ]; then echo "usage: run-proof-leg.sh <apk> <leg-id> <out-dir> (exactly ONE leg)"; exit 2; fi
APK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
LEG="$2"
OUT="$3"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
PAYLOADS="$REPO/apps/mobile/src/integration/__validation__/a302-platform-payloads.json"
PKG="com.qandeel.mobile"

case "$LEG" in
  ar-standard|en-standard|ar-rtl-device|ar-narrow|en-narrow|ar-narrow-large|ar-increased|ar-reduced|en-light) ;;
  android-permission-allow|android-permission-deny|android-delivery-background|android-terminated-entry) ;;
  *) echo "run-proof-leg: unknown leg '$LEG' — refusing"; exit 2 ;;
esac

mkdir -p "$OUT"
cd "$OUT" || exit 1
fail() { echo "FAIL $LEG — $1" | tee "$OUT/result.txt"; capture; exit 1; }
capture() {
  adb shell uiautomator dump /sdcard/leg-ui.xml >/dev/null 2>&1 && adb pull /sdcard/leg-ui.xml "$OUT/$LEG-final-hierarchy.xml" >/dev/null 2>&1
  adb shell dumpsys notification --noredact > "$OUT/$LEG-notifications.txt" 2>&1 || true
  adb logcat -d > "$OUT/logcat-$LEG.txt" 2>&1 || true
}
maestro_flow() { # <flow> <step-name> [-e KEY=VALUE ...]
  local flow="$1" step="$2"
  shift 2
  maestro test --debug-output "$OUT/debug-$LEG-$step" --test-output-dir "$OUT/shots-$LEG" -e PREFIX="$LEG" "$@" "$FLOWS/$flow"
}

# --- Cold-start readiness gate (validation infrastructure; nothing below is evidence) -------------------------------
# A real condition each time, never a bare sleep: the device reports a completed boot, its package manager answers, the
# app is installed, and the app has walked its cold paths once (a3-01-readiness.yaml) before the leg (A3-01 G-32).
adb wait-for-device
ready_deadline=$((SECONDS + 600))
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] \
  && [ "$(adb shell getprop dev.bootcomplete 2>/dev/null | tr -d '\r')" = "1" ] \
  && adb shell pm path android >/dev/null 2>&1; do
  [ "$SECONDS" -ge "$ready_deadline" ] && { echo "READINESS: the device never reported a completed boot" | tee "$OUT/readiness.txt"; exit 1; }
  sleep 5
done
echo "READINESS: device boot completed and package manager answering" | tee "$OUT/readiness.txt"
# One leg, one clean install: no device-local state (installation id, education answers) survives an earlier leg.
adb uninstall "$PKG" >/dev/null 2>&1 || true
adb install "$APK" || exit 1
adb shell pm path "$PKG" >/dev/null 2>&1 || { echo "READINESS: $PKG is not installed" | tee -a "$OUT/readiness.txt"; exit 1; }
{
  echo "leg: $LEG"
  echo "device: $(adb shell getprop ro.product.model | tr -d '\r') / Android $(adb shell getprop ro.build.version.release | tr -d '\r') / API $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "density: $(adb shell wm density | tr -d '\r')  size: $(adb shell wm size | tr -d '\r')"
  echo "apk sha256: $(sha256sum "$APK" | cut -d' ' -f1)"
} | tee "$OUT/device.txt"

# The readiness walk never touches notifications, so it leaves no OS permission behind for an A3-02 leg.
ready=0
for attempt in 1 2 3; do
  # A shade or system dialog left open over the app (seen on a freshly cold-booted emulator) hides it from the walk.
  adb shell cmd statusbar collapse >/dev/null 2>&1 || true
  adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true
  if maestro test --debug-output "$OUT/debug-readiness-$attempt" "$FLOWS/a3-01-readiness.yaml"; then
    echo "READINESS: app cold paths walked (attempt $attempt)" | tee -a "$OUT/readiness.txt"
    ready=1
    break
  fi
  echo "READINESS: attempt $attempt did not complete; the device is not ready yet" | tee -a "$OUT/readiness.txt"
  adb shell am force-stop "$PKG"
done
adb shell am force-stop "$PKG"
[ "$ready" = "1" ] || { echo "READINESS: not ready after 3 attempts; the leg was not run" | tee -a "$OUT/readiness.txt"; exit 1; }
# ------------------------------------------------------------------------------------------------------------------

set_motion() { for key in animator_duration_scale transition_animation_scale window_animation_scale; do adb shell settings put global "$key" "$1"; done; }
locale() { adb shell cmd locale set-app-locales "$PKG" --locales "$1"; }
adb shell settings put system font_scale 1.0
adb shell settings put secure high_text_contrast_enabled 0
set_motion 1
adb logcat -c || true

# The words the OS was handed, from the server-rendered payloads (Arabic: the A3-02 legs run in Arabic).
word() { node -e "const p=require(process.argv[1]); const n=p[process.argv[2]].ar.android.notification; process.stdout.write(process.argv[3]==='title'?(n.title??''):n.body)" "$PAYLOADS" "$1" "$2"; }
# The QANDEEL notifications the OS currently holds, one record per line: channel | title | text.
posted() {
  adb shell dumpsys notification --noredact | tr -d '\r' | awk -v pkg="$PKG" '
    # The OS files its own auto-group summary under the package; it is not a QANDEEL message.
    /NotificationRecord\(/ { inpkg = index($0, "pkg=" pkg) > 0 && index($0, "GROUP_SUMMARY") == 0; if (inpkg) { n++; ch[n] = ""; t[n] = ""; x[n] = "" } }
    inpkg && /channel=/ && ch[n] == "" { if (match($0, /channel=[^ ]+/)) ch[n] = substr($0, RSTART + 8, RLENGTH - 8) }
    # An absent extra prints as "=null"; a present one as "=String (value)".
    inpkg && /android\.title=/ { sub(/.*android\.title=/, ""); if ($0 == "null") $0 = ""; else { sub(/^[A-Za-z]* \(/, ""); sub(/\)$/, "") }; t[n] = $0 }
    inpkg && /android\.text=/ { sub(/.*android\.text=/, ""); if ($0 == "null") $0 = ""; else { sub(/^[A-Za-z]* \(/, ""); sub(/\)$/, "") }; x[n] = $0 }
    END { for (i = 1; i <= n; i++) print ch[i] " | " t[i] " | " x[i] }'
}
wait_posted() { # <count> — a real condition: the OS holds at least <count> QANDEEL notifications
  local deadline=$((SECONDS + 90))
  until [ "$(posted | grep -c .)" -ge "$1" ]; do
    [ "$SECONDS" -ge "$deadline" ] && return 1
    sleep 2
  done
}
grant() { adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS; }

case "$LEG" in
  ar-standard) locale ar-EG; maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  en-standard) locale en-US; maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  ar-rtl-device)
    adb shell settings put global debug.force_rtl 1; locale ar-EG
    maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  ar-narrow) adb shell wm size 640x1386; adb shell wm density 320; locale ar-EG; maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  en-narrow) adb shell wm size 640x1386; adb shell wm density 320; locale en-US; maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  ar-narrow-large)
    adb shell wm size 640x1386; adb shell wm density 320; locale ar-EG; adb shell settings put system font_scale 2.0
    maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  ar-increased) locale ar-EG; adb shell settings put secure high_text_contrast_enabled 1; maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  ar-reduced) locale ar-EG; set_motion 0; maestro_flow a3-01-activity.yaml leg || fail "a3-01-activity.yaml" ;;
  en-light) locale en-US; maestro_flow a3-01-light.yaml leg || fail "a3-01-light.yaml" ;;

  android-permission-allow)
    locale ar-EG
    adb shell pm revoke "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
    adb shell pm clear-permission-flags "$PKG" android.permission.POST_NOTIFICATIONS user-set user-fixed >/dev/null 2>&1 || true
    maestro_flow a3-02-permission-allow.yaml leg || fail "a3-02-permission-allow.yaml"
    adb shell dumpsys package "$PKG" | tr -d '\r' | grep -q "android.permission.POST_NOTIFICATIONS: granted=true" || fail "the OS does not hold the grant"
    # The channels the device registered, mapped from the Product categories (D52), named in approved words.
    adb shell dumpsys notification --noredact | tr -d '\r' > "$OUT/$LEG-channels.txt"
    for channel in qandeel category-qandeel category-shared category-public category-introductions category-system; do
      grep -q "mId='$channel'" "$OUT/$LEG-channels.txt" || fail "channel $channel is not registered"
    done
    ;;

  android-permission-deny)
    locale ar-EG
    adb shell pm revoke "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
    adb shell pm clear-permission-flags "$PKG" android.permission.POST_NOTIFICATIONS user-set user-fixed >/dev/null 2>&1 || true
    maestro_flow a3-02-permission-deny.yaml leg || fail "a3-02-permission-deny.yaml"
    adb shell dumpsys package "$PKG" | tr -d '\r' | grep -q "android.permission.POST_NOTIFICATIONS: granted=false" || fail "the OS holds a grant the reader refused"
    focus="$(adb shell dumpsys window | tr -d '\r' | grep -m1 mCurrentFocus)"
    echo "$focus" > "$OUT/$LEG-settings-focus.txt"
    echo "$focus" | grep -q "com.android.settings" || fail "Device Notification Settings did not hand off to the OS settings ($focus)"
    ;;

  android-delivery-background)
    locale ar-EG; grant
    maestro_flow a3-02-delivery-foreground.yaml foreground || fail "a3-02-delivery-foreground.yaml"
    sleep 4 # the OS had time to present; absence is the claim, so a bounded wait is the condition
    posted > "$OUT/$LEG-after-foreground.txt"
    [ "$(grep -c . "$OUT/$LEG-after-foreground.txt")" -eq 0 ] || fail "a notification was presented while the app was in front (D51)"
    maestro_flow a3-02-delivery-background.yaml background || fail "a3-02-delivery-background.yaml"
    wait_posted 2 || fail "the OS did not post the two background messages"
    posted > "$OUT/$LEG-posted.txt"
    cat "$OUT/$LEG-posted.txt"
    l0="$(word l0 body)"; l2_title="$(word valid title)"; l2_body="$(word valid body)"; l0_sentence="نص اختبار: لا يظهر على شاشة القفل"
    grep -qF "qandeel |  | $l0" "$OUT/$LEG-posted.txt" || fail "the L0 message is not exactly «$l0» on the neutral channel"
    grep -qF "$l0_sentence" "$OUT/$LEG-posted.txt" && fail "the L0 message carried its sentence"
    grep -qF "category-system | $l2_title | $l2_body" "$OUT/$LEG-posted.txt" || fail "the L2 message is not its title + bounded sentence on its channel"
    grep -qF "معاينة" "$OUT/$LEG-posted.txt" && fail "an L2 message carried the L3 preview"
    # Lock Screen evidence (not an assertion: the words were asserted above; the OS may only show less).
    adb shell input keyevent KEYCODE_SLEEP; sleep 2; adb shell input keyevent KEYCODE_WAKEUP; sleep 3
    adb exec-out screencap -p > "$OUT/$LEG-lock-screen.png"
    adb shell wm dismiss-keyguard; sleep 2
    adb shell cmd statusbar expand-notifications
    maestro_flow a3-02-tap.yaml tap -e STEP=02 -e TEXT="$l2_body" -e TARGET=qandeel-settings || fail "the tap did not reach its revalidated destination"
    ;;

  android-terminated-entry)
    locale ar-EG; grant
    maestro_flow a3-02-delivery-arm-terminated.yaml arm || fail "a3-02-delivery-arm-terminated.yaml"
    wait_posted 3 || fail "the OS did not post the three messages"
    posted > "$OUT/$LEG-posted.txt"
    adb shell am kill "$PKG"
    deadline=$((SECONDS + 30))
    while adb shell pidof "$PKG" >/dev/null 2>&1; do [ "$SECONDS" -ge "$deadline" ] && fail "the app process did not end"; sleep 1; done
    echo "process ended; notifications still posted: $(posted | grep -c .)" | tee "$OUT/$LEG-terminated.txt"
    [ "$(posted | grep -c .)" -ge 3 ] || fail "killing the process removed the notifications"
    adb shell cmd statusbar expand-notifications
    maestro_flow a3-02-tap.yaml valid -e STEP=01 -e TEXT="$(word valid body)" -e TARGET=qandeel-settings || fail "cold start: the tap did not reach its revalidated destination"
    maestro_flow a3-02-return-home.yaml home1 || fail "return home"
    adb shell cmd statusbar expand-notifications
    maestro_flow a3-02-tap.yaml stale -e STEP=02 -e TEXT="$(word stale body)" -e TARGET=qandeel-activity || fail "a stale target did not fail closed into Activity"
    maestro_flow a3-02-return-home.yaml home2 || fail "return home"
    adb shell cmd statusbar expand-notifications
    maestro_flow a3-02-foreign-nowhere.yaml foreign -e TEXT="$(word foreign body)" || fail "another account's item was not taken nowhere"
    ;;
esac

capture
echo "PASS $LEG" | tee "$OUT/result.txt"
exit 0
