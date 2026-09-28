#!/usr/bin/env bash
# W1B-01 — the focused device proof, "Auth Gateway onward". VALIDATION ONLY.
#
# usage: bash scripts/w1b/run-w1b-proof.sh <apk> <out-dir>
#
#   en-journey         English: Sign in → Create account → Verify Email → Welcome → First Conversation
#                      Opening → composer ready (labels, help, verification, Welcome, opening parity);
#   ar-journey         the same in Arabic, default text size (the complete Arabic journey);
#   ar-large-journey   the same in Arabic at the largest system text size;
#   ar-large-keyboard  Create account at the largest text size, left with the keyboard open on the password:
#                      the keyboard's inset frame and the element bounds are measured (the focused field and
#                      the create act must end above the keyboard), and the form's on-device accessibility
#                      tree is censused for technical, auth or provider strings.
#
# Every run is attempted even when an earlier one fails; the script exits non-zero if ANY failed. No
# password and no code is written anywhere: the flows type random values into an in-memory proof world.
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

FIXTURE=(-e NAME="Mona Ali" -e LOGIN_ID="mona.ali" -e EMAIL="mona@w1b-proof.invalid")

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
  adb shell uiautomator dump /sdcard/w1b-ui.xml >/dev/null 2>&1 && adb pull /sdcard/w1b-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$name.txt" 2>&1 || true
  echo "::endgroup::"
}

# The keyboard's top edge against the bottom edge of each form element, from the final screen of a run.
measure_keyboard() {
  local name="$1"
  adb shell dumpsys window > "$OUT/$name-dumpsys-window.txt" 2>&1 || true
  if python3 - "$OUT/$name-dumpsys-window.txt" "$OUT/$name-final-hierarchy.xml" > "$OUT/$name-keyboard-measure.txt" 2>&1 <<'PY'
import re, sys, xml.etree.ElementTree as ET
dump, hierarchy = open(sys.argv[1], encoding='utf-8', errors='replace').read(), sys.argv[2]
ime_top = None
for line in dump.splitlines():
    if 'type=ime' in line and 'visible=true' in line:
        m = re.search(r'frame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', line)
        if m and int(m.group(4)) > int(m.group(2)):
            ime_top = int(m.group(2)) if ime_top is None else min(ime_top, int(m.group(2)))
if ime_top is None:
    print('KEYBOARD NOT FOUND: no visible type=ime insets source in dumpsys window'); sys.exit(1)
print(f'keyboard top edge: y={ime_top}')
ids = ('qandeel-create-account-name', 'qandeel-create-account-login-id', 'qandeel-create-account-email',
       'qandeel-create-account-password', 'qandeel-create-account-submit')
bounds = {}
for node in ET.parse(hierarchy).iter('node'):
    rid = node.get('resource-id', '')
    if rid in ids:
        m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if m: bounds[rid] = tuple(int(v) for v in m.groups())
# The focused password and the create act must be clear of the keyboard. The upper fields may have
# scrolled away at a large text size (screenshots 02-03 show them), so they are reported, not required.
required = ('qandeel-create-account-password', 'qandeel-create-account-submit')
ok = True
for rid in ids:
    if rid not in bounds:
        print(f'{rid}: not on screen'); ok = ok and rid not in required; continue
    x1, y1, x2, y2 = bounds[rid]
    clear = y2 <= ime_top
    print(f'{rid}: bounds [{x1},{y1}][{x2},{y2}] bottom={y2} -> {"above the keyboard" if clear else "UNDER THE KEYBOARD"}')
    ok = ok and (clear or rid not in required)
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

# Every visible text and accessible description the app exposes on the final screen of a run: no
# technical, auth or provider string, no test id, and no raw wire value.
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
technical = re.compile(r'supabase|\botp\b|token|bearer|error|exception|undefined|\bnull\b|NaN|qandeel-|https?://|w1b-proof-reader|login_id|qandeel_name|runtime:|[0-9a-f]{8}-[0-9a-f]{4}-', re.I)
ok = len(strings) > 3
for rid, attr, value in strings:
    flagged = technical.search(value) and not value.endswith('@w1b-proof.invalid')
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

# English parity.
adb shell settings put system font_scale 1.0
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-journey w1b-01-journey.yaml
census en-journey "QANDEEL: I'm with you"
adb shell am force-stop "$PKG"

# The Arabic journey, default text size.
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-journey w1b-01-journey.yaml
census ar-journey "قنديل: أنا معك يا"
adb shell am force-stop "$PKG"

# The largest system text size this Android offers.
adb shell settings put system font_scale 2.0
run ar-large-journey w1b-01-journey.yaml
adb shell am force-stop "$PKG"
run ar-large-keyboard w1b-01-create-account-keyboard.yaml
measure_keyboard ar-large-keyboard
census ar-large-keyboard "كلمة المرور|إنشاء الحساب"
adb shell am force-stop "$PKG"
adb shell settings put system font_scale 1.0

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
exit $status
