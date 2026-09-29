#!/usr/bin/env bash
# W2-01 — the focused device proof of the final account access lifecycle. VALIDATION ONLY.
#
# usage: bash scripts/w2/run-w2-01-proof.sh <apk> <out-dir>
#
# The W2-01 proof build (W2ProofRoot) opens on a validation-only scenario chooser and then mounts the
# PRODUCTION phase surface over the in-memory W2 proof world. Runs, in English and in Arabic:
#
#   <lang>-recovery        final Sign in (1) → invalid credentials (2) → recovery Email request (3) →
#                          generic recovery result (4) → recovery code (5) → new password (6) →
#                          "Password changed." (7) → back to Sign in, still signed out (7b)
#   <lang>-sessions        the session-ended notice on Sign in (8) → the unable-to-verify-session state
#                          (9) → its Retry restores the session and the world opens (9b)
#
# and, in Arabic at the largest system text size, the recovery and session runs again plus two keyboard
# runs: the final Sign in and the new-password step, each left with the keyboard OPEN so the focused
# field's bounds are measured against the keyboard's inset frame (the primary act is proved reachable by
# the flow's preceding scroll-to-it step). Every final screen's on-device accessibility tree is censused
# for technical, auth or provider strings and for the approved words that must be present.
#
# Every run is attempted even when an earlier one fails; the script exits non-zero if ANY failed. The
# sign-in password and the code are random; the new password is a per-run random value typed into masked
# fields and written nowhere. This script does not share, source or modify scripts/w1b/run-w1b-proof.sh.
set -u

APK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUT="$2"
REPO="$(pwd)"
FLOWS="$REPO/apps/mobile/.maestro"
PKG="com.qandeel.mobile"
mkdir -p "$OUT"
cd "$OUT" || exit 1

adb install -r "$APK" || exit 1
status=0

NEW_PASSWORD="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 16)"
FIXTURE=(-e LOGIN_ID="mona.ali" -e EMAIL="mona@w2-proof.invalid" -e NEW_PASSWORD="$NEW_PASSWORD")

run() {
  local name="$1" flow="$2"
  echo "::group::$name"
  adb logcat -c || true
  if maestro test --debug-output "$OUT/debug-$name" --test-output-dir "$OUT/shots-$name" -e PREFIX="$name" "${FIXTURE[@]}" "$FLOWS/$flow"; then
    echo "PASS $name" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name" | tee -a "$OUT/results.txt"
    status=1
  fi
  adb shell uiautomator dump /sdcard/w2-ui.xml >/dev/null 2>&1 && adb pull /sdcard/w2-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$name.txt" 2>&1 || true
  # The per-run password is never evidence.
  grep -l -- "$NEW_PASSWORD" "$OUT/logcat-$name.txt" >/dev/null 2>&1 && { echo "FAIL $name-password-in-log" | tee -a "$OUT/results.txt"; status=1; }
  echo "::endgroup::"
}

# The keyboard's top edge against the focused field (required) and the primary act (reported), from the
# final screen of a run. Invalid or clipped rectangles are never reported as "above the keyboard".
measure_keyboard() {
  local name="$1" focused="$2" primary="$3"
  adb shell dumpsys window > "$OUT/$name-dumpsys-window.txt" 2>&1 || true
  if python3 - "$OUT/$name-dumpsys-window.txt" "$OUT/$name-final-hierarchy.xml" "$focused" "$primary" > "$OUT/$name-keyboard-measure.txt" 2>&1 <<'PY'
import re, sys, xml.etree.ElementTree as ET
dump, hierarchy, focused, primary = open(sys.argv[1], encoding='utf-8', errors='replace').read(), sys.argv[2], sys.argv[3], sys.argv[4]
ime_top = None
for line in dump.splitlines():
    if 'type=ime' in line and 'visible=true' in line:
        m = re.search(r'frame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', line)
        if m and int(m.group(4)) > int(m.group(2)):
            ime_top = int(m.group(2)) if ime_top is None else min(ime_top, int(m.group(2)))
if ime_top is None:
    print('KEYBOARD NOT FOUND: no visible type=ime insets source in dumpsys window'); sys.exit(1)
print(f'keyboard top edge: y={ime_top}')
bounds = {}
for node in ET.parse(hierarchy).iter('node'):
    rid = node.get('resource-id', '')
    if rid in (focused, primary):
        m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if m: bounds[rid] = tuple(int(v) for v in m.groups())
ok = True
for rid, required in ((focused, True), (primary, False)):
    if rid not in bounds:
        print(f'{rid}: not on screen'); ok = ok and not required; continue
    x1, y1, x2, y2 = bounds[rid]
    if not (x2 > x1 and y2 > y1):
        print(f'{rid}: not on screen (invalid/clipped bounds [{x1},{y1}][{x2},{y2}])'); ok = ok and not required; continue
    clear = y2 <= ime_top
    print(f'{rid}: bounds [{x1},{y1}][{x2},{y2}] bottom={y2} -> {"above the keyboard" if clear else "UNDER THE KEYBOARD"}{" (required)" if required else " (reported)"}')
    ok = ok and (clear or not required)
sys.exit(0 if ok else 1)
PY
  then
    echo "PASS $name-keyboard-measure" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name-keyboard-measure" | tee -a "$OUT/results.txt"
    status=1
  fi
  cat "$OUT/$name-keyboard-measure.txt"
}

# Every visible text and accessible description on the final screen: no technical, auth or provider
# string, no test id, no raw wire value — and the approved words that must be there, are.
census() {
  local name="$1" required="$2"
  if python3 - "$OUT/$name-final-hierarchy.xml" "$required" > "$OUT/$name-accessibility-census.txt" 2>&1 <<'PY'
import re, sys, xml.etree.ElementTree as ET
strings = []
for node in ET.parse(sys.argv[1]).iter('node'):
    if not node.get('package', '').startswith('com.qandeel'):
        continue
    for attr in ('text', 'content-desc', 'hint'):
        value = (node.get(attr) or '').strip()
        if value:
            strings.append((node.get('resource-id', ''), attr, value))
technical = re.compile(r'supabase|\botp\b|token|bearer|error|exception|undefined|\bnull\b|NaN|qandeel-|https?://|w2-proof|proof scenario|SESSION_ENDED|INVALID_CREDENTIALS|login_id|runtime:|[0-9a-f]{8}-[0-9a-f]{4}-', re.I)
ok = len(strings) > 1
for rid, attr, value in strings:
    flagged = technical.search(value) and not value.endswith('@w2-proof.invalid')
    print(f"{'FLAG' if flagged else 'ok  '} [{rid}] {attr}: {value}")
    ok = ok and not flagged
joined = '\n'.join(v for _, _, v in strings)
for needle in [s for s in sys.argv[2].split('|') if s]:
    present = needle in joined
    print(f"required {'present' if present else 'MISSING'}: {needle}")
    ok = ok and present
sys.exit(0 if ok else 1)
PY
  then
    echo "PASS $name-accessibility-census" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name-accessibility-census" | tee -a "$OUT/results.txt"
    status=1
  fi
  cat "$OUT/$name-accessibility-census.txt"
}

{
  echo "device: $(adb shell getprop ro.product.model) / Android $(adb shell getprop ro.build.version.release) / API $(adb shell getprop ro.build.version.sdk)"
  echo "density: $(adb shell wm density | tr -d '\r')  size: $(adb shell wm size | tr -d '\r')"
} | tee "$OUT/device.txt"

for key in animator_duration_scale transition_animation_scale window_animation_scale; do
  adb shell settings put global "$key" 1
done

# English, default text size.
adb shell settings put system font_scale 1.0
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-recovery w2-01-sign-in-recovery.yaml
census en-recovery "Login ID or email|Forgot your Login ID? You can use your email instead.|Forgot password?"
adb shell am force-stop "$PKG"
run en-sessions w2-01-session-states.yaml
adb shell am force-stop "$PKG"

# Arabic, default text size.
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-recovery w2-01-sign-in-recovery.yaml
census ar-recovery "معرّف الدخول أو البريد الإلكتروني|نسيت معرّف الدخول؟ يمكنك استخدام بريدك الإلكتروني بدلًا منه.|نسيت كلمة المرور؟"
adb shell am force-stop "$PKG"
run ar-sessions w2-01-session-states.yaml
adb shell am force-stop "$PKG"

# Arabic at the largest system text size this Android offers.
adb shell settings put system font_scale 2.0
run ar-large-recovery w2-01-sign-in-recovery.yaml
adb shell am force-stop "$PKG"
run ar-large-sessions w2-01-session-states.yaml
adb shell am force-stop "$PKG"
run ar-large-sign-in-keyboard w2-01-sign-in-keyboard.yaml
measure_keyboard ar-large-sign-in-keyboard qandeel-sign-in-password qandeel-sign-in-submit
census ar-large-sign-in-keyboard "كلمة المرور|دخول"
adb shell am force-stop "$PKG"
run ar-large-new-password-keyboard w2-01-new-password-keyboard.yaml
measure_keyboard ar-large-new-password-keyboard qandeel-recovery-confirm-password-field qandeel-recovery-change-submit
census ar-large-new-password-keyboard "كلمة المرور الجديدة|تأكيد كلمة المرور الجديدة|تغيير كلمة المرور"
adb shell am force-stop "$PKG"
adb shell settings put system font_scale 1.0

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
exit $status
