#!/usr/bin/env bash
# W1A-01 correction pass — the FOCUSED device proof. VALIDATION ONLY.
#
# usage: bash scripts/w1a/run-w1a-correction-proof.sh <apk> <out-dir>
#
# The full four-way matrix (English, Arabic, Arabic at 200% text, Arabic under Reduced Motion) was proved
# on this branch in run 36410326972 and is not repeated. This proves only what the correction changed:
#
#   depth-ar-standard    ONE standard-motion recording of the depth boundary in BOTH directions,
#                        Conversation → Analysis through the door and back through Android system Back;
#   analysis-ar-language the Arabic Analysis depth, its on-device accessibility tree measured for
#                        Latin-script words, internal ids and the approved current-edge wording;
#   sign-in-ar-normal    the production Sign-in gateway with the keyboard open, default text size;
#   sign-in-ar-large     the same at the largest system text size, where clipping would show first.
#
# After each sign-in run the keyboard is still open on the password field, and the script records the
# keyboard's inset frame (`dumpsys window`, the `type=ime` insets source) and the UI hierarchy, then
# measures that the focused password field and the submit both end above the keyboard's top edge.
# Every run is attempted even when an earlier one fails; the script exits non-zero if ANY failed.
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

set_motion() {
  for key in animator_duration_scale transition_animation_scale window_animation_scale; do
    adb shell settings put global "$key" "$1"
  done
}

run() {
  local name="$1" flow="$2"
  echo "::group::$name"
  adb logcat -c || true
  if maestro test --debug-output "$OUT/debug-$name" --test-output-dir "$OUT/shots-$name" -e PREFIX="$name" "$FLOWS/$flow"; then
    echo "PASS $name" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name" | tee -a "$OUT/results.txt"
    status=1
  fi
  adb shell uiautomator dump /sdcard/w1a-ui.xml >/dev/null 2>&1 && adb pull /sdcard/w1a-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
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
bounds = {}
for node in ET.parse(hierarchy).iter('node'):
    rid = node.get('resource-id', '')
    if rid in ('qandeel-sign-in-email', 'qandeel-sign-in-password', 'qandeel-sign-in-submit'):
        m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if m: bounds[rid] = tuple(int(v) for v in m.groups())
# The focused field and the submit must both be clear of the keyboard. The email (focused earlier, see
# screenshot 02) may legitimately have scrolled away at a large text size, so it is reported, not required.
required = ('qandeel-sign-in-password', 'qandeel-sign-in-submit')
ok = True
for rid in ('qandeel-sign-in-email', 'qandeel-sign-in-password', 'qandeel-sign-in-submit'):
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

# Every visible text and accessible description of the on-screen Analysis depth, from the device's own
# accessibility tree: no Latin-script word, no internal id, and the approved current-edge wording.
measure_analysis_language() {
  local name="$1"
  if python3 - "$OUT/$name-final-hierarchy.xml" > "$OUT/$name-language-census.txt" 2>&1 <<'PY'
import re, sys, xml.etree.ElementTree as ET
strings = []
for node in ET.parse(sys.argv[1]).iter('node'):
    if not node.get('package', '').startswith('com.qandeel'):
        continue
    for attr in ('text', 'content-desc', 'hint'):
        value = (node.get(attr) or '').strip()
        if value:
            strings.append((node.get('resource-id', ''), attr, value))
internal = re.compile(r'SOURCE_PROVENANCE|ANALYTICAL_OBJECT|THREAD_READING|FOLLOW_LIVE|PINNED|thread-|reading-|binding|w1a-proof|fixture|\bSP\b|[0-9a-f]{8}-[0-9a-f]{4}-', re.I)
ok = len(strings) > 5
for rid, attr, value in strings:
    flags = []
    if re.search(r'[A-Za-z]', value): flags.append('LATIN')
    if internal.search(value): flags.append('INTERNAL-ID')
    print(f"{'FLAG ' + '+'.join(flags) if flags else 'ok  '} [{rid}] {attr}: {value}")
    ok = ok and not flags
joined = '\n'.join(v for _, _, v in strings)
current_edge = ('تتابع المحادثة الآن' in joined) or ('العودة لمتابعة المحادثة' in joined)
superseded = ('أنت عند آخر المحادثة' in joined) or ('العودة إلى المحادثة الجارية' in joined)
print(f'strings: {len(strings)}; current-edge wording present: {current_edge}; superseded wording present: {superseded}')
sys.exit(0 if ok and current_edge and not superseded else 1)
PY
  then
    echo "PASS $name-language-census" | tee -a "$OUT/results.txt"
  else
    echo "FAIL $name-language-census" | tee -a "$OUT/results.txt"
    status=1
  fi
  cat "$OUT/$name-language-census.txt"
}

{
  echo "device: $(adb shell getprop ro.product.model) / Android $(adb shell getprop ro.build.version.release) / API $(adb shell getprop ro.build.version.sdk)"
  echo "density: $(adb shell wm density | tr -d '\r')  size: $(adb shell wm size | tr -d '\r')"
} | tee "$OUT/device.txt"

adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
adb shell settings put system font_scale 1.0

# Standard motion: the depth boundary, both directions, one recording.
set_motion 1
run depth-ar-standard w1a-01-depth-proof.yaml
adb shell am force-stop "$PKG"

# The Arabic Analysis depth's language, measured on the device's own accessibility tree.
run analysis-ar-language w1a-01-analysis-language.yaml
measure_analysis_language analysis-ar-language
adb shell am force-stop "$PKG"

# The Sign-in gateway with the keyboard open, default text size, then the largest.
run sign-in-ar-normal w1a-01-sign-in-keyboard.yaml
measure_keyboard sign-in-ar-normal
adb shell am force-stop "$PKG"

adb shell settings put system font_scale 2.0
run sign-in-ar-large w1a-01-sign-in-keyboard.yaml
measure_keyboard sign-in-ar-large
adb shell am force-stop "$PKG"
adb shell settings put system font_scale 1.0

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
exit $status
