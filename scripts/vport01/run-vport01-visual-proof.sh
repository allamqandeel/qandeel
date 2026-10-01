#!/usr/bin/env bash
# VPORT-01 — the production visual proof of the final Living Analysis World. VALIDATION ONLY.
#
# usage: bash scripts/vport01/run-vport01-visual-proof.sh <apk> <out-dir>
#
# The Release APK's root is the VPORT-01 proof root: the PRODUCTION phase surface over the production
# integration runtime, given an in-memory identity and a scripted network. Every capture is the shipped
# Skia world on the device. The matrix:
#
#   ar-standard      Arabic, standard contrast: FAR, MID, NEAR, NEAR + selected, the ungeographic register
#   en-standard      the same in English
#   ar-increased     Arabic under the platform's increased contrast (Android high-text-contrast)
#   ar-reduced       Arabic under Reduce Motion (animator scales 0): the settled parity captures
#   ar-narrow        Arabic on a narrow phone (360 dp wide)
#   ar-landscape     Arabic, landscape (T-11 recomposes; the world is the same world)
#   travel-standard  one recording of FAR → MID → NEAR → MID → FAR with frame statistics
#   travel-reduced   the same under Reduce Motion (the cut-and-resolve)
#
# After each world run the device's own accessibility hierarchy is dumped and censused: one accessible
# node per entitled identity at the final rung, and no internal id in any label. Every run is attempted
# even when an earlier one fails; the script exits non-zero if ANY failed.
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
  adb shell uiautomator dump /sdcard/vport01-ui.xml >/dev/null 2>&1 && adb pull /sdcard/vport01-ui.xml "$OUT/$name-final-hierarchy.xml" >/dev/null 2>&1
  adb logcat -d > "$OUT/logcat-$name.txt" 2>&1 || true
  adb shell am force-stop "$PKG"
  echo "::endgroup::"
}

# The accessible Map at the final rung (ANALYTICAL_OBJECT): 8 Threads + 17 hosted Readings + 2 ungrounded
# Readings + 2 Emerging Focuses = 29 entitled identities, each exactly once, with no internal id in a label.
census() {
  local name="$1"
  if python3 - "$OUT/$name-final-hierarchy.xml" > "$OUT/$name-accessibility-census.txt" 2>&1 <<'PY'
import re, sys, xml.etree.ElementTree as ET
nodes = []
for node in ET.parse(sys.argv[1]).iter('node'):
    rid = node.get('resource-id', '')
    if rid.startswith('qandeel-map-accessibility:'):
        nodes.append((rid, node.get('content-desc', '') or node.get('text', '')))
keys = [rid.split(':', 1)[1] for rid, _ in nodes]
families = {}
for key in keys:
    families[key.split(':', 1)[0]] = families.get(key.split(':', 1)[0], 0) + 1
internal = re.compile(r'v-thread|v-reading|v-focus|v-binding|THREAD_HOME|UNGEOGRAPHIC|[0-9a-f]{8}-', re.I)
leaks = [label for _, label in nodes if internal.search(label)]
print(f'accessible Map nodes: {len(nodes)}  unique: {len(set(keys))}  by family: {families}')
for rid, label in nodes:
    print(f'  {rid}  |  {label}')
print(f'labels carrying an internal id: {len(leaks)}')
ok = len(nodes) == 29 and len(set(keys)) == 29 and families == {'THREAD': 8, 'READING': 19, 'EMERGING_FOCUS': 2} and not leaks
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

adb shell settings put system font_scale 1.0
adb shell settings put secure high_text_contrast_enabled 0
set_motion 1

# Arabic and English, standard contrast.
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG
run ar-standard vport-01-world.yaml
census ar-standard
adb shell cmd locale set-app-locales "$PKG" --locales en-US
run en-standard vport-01-world.yaml
census en-standard
adb shell cmd locale set-app-locales "$PKG" --locales ar-EG

# The travel, with the device's own frame statistics for the whole recording.
adb shell dumpsys gfxinfo "$PKG" reset >/dev/null 2>&1 || true
run travel-standard vport-01-travel.yaml
adb shell dumpsys gfxinfo "$PKG" > "$OUT/travel-standard-gfxinfo.txt" 2>&1 || true

# Increased contrast (Android: high-text-contrast, which the app reads as the platform contrast setting).
adb shell settings put secure high_text_contrast_enabled 1
run ar-increased vport-01-world.yaml
census ar-increased
adb shell settings put secure high_text_contrast_enabled 0

# Reduce Motion: the animator scales at 0 are the Android Reduce Motion signal.
set_motion 0
run ar-reduced vport-01-world.yaml
census ar-reduced
run travel-reduced vport-01-travel.yaml
set_motion 1

# A narrow phone: 360 dp wide.
adb shell wm size 720x1520
adb shell wm density 320
run ar-narrow vport-01-world.yaml
census ar-narrow
adb shell wm size reset
adb shell wm density reset

# Landscape: the same world, recomposed by T-11.
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
run ar-landscape vport-01-world.yaml
census ar-landscape
adb shell settings put system user_rotation 0

adb shell cmd locale set-app-locales "$PKG" --locales ""
ls -la "$OUT"
cat "$OUT/results.txt"
exit $status
