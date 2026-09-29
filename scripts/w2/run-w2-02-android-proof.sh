#!/usr/bin/env bash
# W2-02 — native launch identity proof on an Android emulator. VALIDATION ONLY; nothing here ships.
#
# Proves, on the INSTALLED Product Release APK (the same Product entry Mobile CI builds, no proof root):
#   1. the APK's launcher resources are the I-08B2.5 exports, pixel-identical to the vendored canonical bytes
#      (aapt2 may re-compress a PNG losslessly, so decoded RGBA is compared, not file bytes);
#   2. the launcher label is QANDEEL and the installed launcher shows the canonical icon;
#   3. three cold launches, each captured by a pre-armed on-device screenshot burst (below):
#        A  system Light, first launch after install — the platform has no app night mode yet, so the splash
#           is the Light World; the app then sets the effective (Dark) application night mode;
#        B  system Light, next cold launch — the splash now follows the effective QANDEEL appearance: Dark;
#        C  system Dark — Dark;
#      each the real system splash with the canonical icon on the expected World and no white / black flash.
#      The window closes when the system splash exits; the boot smoke owns what the app shows after it.
#
# Usage: run-w2-02-android-proof.sh <app-release.apk> <evidence-dir>
set -uo pipefail

APK="$1"
OUT="$2"
PACKAGE=com.qandeel.mobile
ACTIVITY="$PACKAGE/.MainActivity"
VENDORED=apps/mobile/assets/brand/i-08b2.5/app-icon/android/res
mkdir -p "$OUT/apk" "$OUT/launch" "$OUT/launcher"
status=0
note() { echo "$*" | tee -a "$OUT/summary.txt"; }

AAPT2="$(ls -d "$ANDROID_HOME"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -n 1)"
note "aapt2: ${AAPT2:-<none>}"

# ---- 1. static APK evidence -------------------------------------------------------------------------------
if [ -n "$AAPT2" ]; then
  "$AAPT2" dump badging "$APK" > "$OUT/apk/badging.txt" 2>&1 || true
  "$AAPT2" dump resources "$APK" > "$OUT/apk/resources.txt" 2>&1 || true
  "$AAPT2" dump xmltree --file AndroidManifest.xml "$APK" > "$OUT/apk/manifest.txt" 2>&1 || true
  grep -E "application-label|application-icon|launchable-activity" "$OUT/apk/badging.txt" | tee -a "$OUT/summary.txt"
  if grep -q "application-label:'QANDEEL'" "$OUT/apk/badging.txt"; then note "PASS label: QANDEEL"; else note "FAIL label is not QANDEEL"; status=1; fi
  grep -A3 -E "color/qandeel_world|color/ic_launcher_background" "$OUT/apk/resources.txt" | tee "$OUT/apk/world-colours.txt" >/dev/null
fi
# The file behind a resource, as aapt2 recorded it (a Release build may shorten resource paths).
resource_file() {
  awk -v res="$1" -v dens="($2" '
    $1 == "resource" { inres = ($3 == res); next }
    inres && index($0, dens) && index($0, "(file)") { for (i = 1; i <= NF; i++) if ($i == "(file)") { print $(i + 1); exit } }
  ' "$OUT/apk/resources.txt"
}
rgba_sha() { ffmpeg -v error -i "$1" -f rawvideo -pix_fmt rgba - | sha256sum | cut -d' ' -f1; }
compared=0
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  for name in ic_launcher ic_launcher_round ic_launcher_foreground; do
    canonical="$VENDORED/mipmap-$density/$name.png"
    path="$(resource_file "mipmap/$name" "$density")"
    if [ -z "$path" ]; then note "FAIL mipmap/$name ($density) is missing from the APK"; status=1; continue; fi
    built="$OUT/apk/$name-$density.png"
    unzip -p "$APK" "$path" > "$built"
    if [ "$(rgba_sha "$canonical")" = "$(rgba_sha "$built")" ]; then
      compared=$((compared + 1))
      echo "  $name ($density) -> $path pixel-identical" >> "$OUT/summary.txt"
    else
      note "FAIL mipmap/$name ($density) at $path differs from the canonical pixels"; status=1
    fi
  done
done
note "icon rasters pixel-identical to I-08B2.5: $compared / 15"
grep -A8 -E "resource 0x[0-9a-f]+ (mipmap/ic_launcher|drawable/ic_launcher_monochrome)$" "$OUT/apk/resources.txt" > "$OUT/apk/launcher-resources.txt" || true
if grep -q -E "splashscreen_logo|ic_launcher[a-z_]*\.webp" "$OUT/apk/resources.txt"; then
  note "FAIL an Expo template icon or splash logo is inside the APK"; status=1
else
  note "PASS no Expo template icon or splash logo is inside the APK"
fi

# ---- 2. install + launcher --------------------------------------------------------------------------------
adb install -r "$APK"
adb shell cmd uimode night no
adb shell input keyevent KEYCODE_HOME
sleep 2
# Open the all-apps drawer (swipe up from the lower middle) and photograph the installed icon.
read -r W H < <(adb shell wm size | tr -d '\r' | awk -F'[ x]' '/Physical/ {print $3, $4}')
adb shell input swipe $((W / 2)) $((H * 85 / 100)) $((W / 2)) $((H * 20 / 100)) 300
sleep 3
adb exec-out screencap -p > "$OUT/launcher/all-apps-light.png"
adb shell input keyevent KEYCODE_HOME

# ---- 3. captured cold launches ----------------------------------------------------------------------------
# R2: `screenrecord` on the API 36 emulator started late or stopped early and missed the transient system splash.
# The capture is now a PRE-ARMED ON-DEVICE SCREENSHOT BURST: a loop pushed to the emulator runs `screencap` back to
# back, starts BEFORE `am start`, and runs for a bounded time — no host round trip per frame, no production delay.
BURST_SCRIPT="$OUT/launch/burst.sh"
cat > "$BURST_SCRIPT" <<'BURST'
dir="$1"; seconds="$2"; max="$3"
rm -rf "$dir"; mkdir -p "$dir"
end=$(( $(date +%s) + seconds )); i=0
while [ "$(date +%s)" -lt "$end" ] && [ "$i" -lt "$max" ]; do
  screencap -p "$dir/$(printf %04d "$i").png"
  i=$((i + 1))
done
BURST
adb push "$BURST_SCRIPT" /data/local/tmp/w2-02-burst.sh >/dev/null

record_launch() {
  local label="$1" expect="$2" then="$3"
  adb shell am force-stop "$PACKAGE"
  sleep 2
  adb shell input keyevent KEYCODE_HOME
  sleep 2
  adb shell sh /data/local/tmp/w2-02-burst.sh "/sdcard/w2-02-burst/$label" 8 120 &
  local burst=$!
  sleep 1
  adb shell am start -W -n "$ACTIVITY" | tee "$OUT/launch/$label-am-start.txt"
  wait "$burst"
  mkdir -p "$OUT/launch/$label"
  adb pull "/sdcard/w2-02-burst/$label/." "$OUT/launch/$label" >/dev/null
  adb shell rm -rf "/sdcard/w2-02-burst/$label"
  note "$label: $(ls "$OUT/launch/$label" | wc -l | tr -d ' ') burst frames"
  local args=(--video "$OUT/launch/$label/%04d.png" --images --out "$OUT/launch" --platform android --expect-ground "$expect" --label "$label")
  [ -n "$then" ] && args+=(--then-ground "$then")
  if ! node scripts/w2/analyze-w2-02-launch-recording.mjs "${args[@]}" | tee -a "$OUT/summary.txt"; then status=1; fi
}

adb shell cmd uimode night no
record_launch A-system-light-first-launch light dark
record_launch B-system-light-after-seam dark ""
adb shell cmd uimode night yes
sleep 2
record_launch C-system-dark dark ""
adb shell cmd uimode night no
adb shell dumpsys uimode > "$OUT/launch/dumpsys-uimode.txt" 2>&1 || true
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" > "$OUT/launch/activities.txt" 2>&1 || true

note "overall: $([ "$status" -eq 0 ] && echo PASS || echo FAIL)"
exit "$status"
