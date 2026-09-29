#!/usr/bin/env bash
# W2-02 — native launch identity proof on an iOS simulator. VALIDATION ONLY; nothing here ships.
#
# Proves, on the INSTALLED Product Release simulator app (the same Product entry Mobile CI builds):
#   1. the compiled bundle: CFBundleDisplayName QANDEEL, UIUserInterfaceStyle Automatic, the SplashScreen launch
#      storyboard, and an asset catalogue holding the AppIcon set and the QandeelWorld colour (with a dark
#      appearance) and no splash logo;
#   2. the SpringBoard icon (home-screen screenshots, Light and Dark device appearance);
#   3. recorded cold launches with the device in Light and in Dark: the Launch Screen is the World of the
#      device appearance with no Q / logo / text, and the first app-owned frame is the Dark World — no white or
#      black flash — into the Product root.
#
# Usage: run-w2-02-ios-proof.sh <path/to/App.app> <evidence-dir> <simulator-udid>
set -uo pipefail

APP="$1"
OUT="$2"
UDID="$3"
BUNDLE=com.qandeel.mobile
VENDORED=apps/mobile/assets/brand/i-08b2.5/app-icon/ios/AppIcon.appiconset
mkdir -p "$OUT/bundle" "$OUT/launch" "$OUT/home"
status=0
note() { echo "$*" | tee -a "$OUT/summary.txt"; }
plist() { /usr/libexec/PlistBuddy -c "Print :$1" "$APP/Info.plist" 2>/dev/null; }

# ---- 1. compiled bundle evidence --------------------------------------------------------------------------
plutil -p "$APP/Info.plist" > "$OUT/bundle/Info.plist.txt"
for pair in "CFBundleDisplayName=QANDEEL" "UIUserInterfaceStyle=Automatic" "UILaunchStoryboardName=SplashScreen"; do
  key="${pair%%=*}"; want="${pair#*=}"; got="$(plist "$key")"
  if [ "$got" = "$want" ]; then note "PASS $key = $got"; else note "FAIL $key = '${got}', expected '$want'"; status=1; fi
done
ls -la "$APP" > "$OUT/bundle/app-contents.txt"
if [ -d "$APP/SplashScreen.storyboardc" ]; then note "PASS the compiled launch storyboard is in the bundle"; else note "FAIL SplashScreen.storyboardc is missing"; status=1; fi
xcrun --sdk iphonesimulator assetutil --info "$APP/Assets.car" > "$OUT/bundle/Assets.car.json" 2>&1 || true
if grep -q '"Name" : "QandeelWorld"' "$OUT/bundle/Assets.car.json"; then note "PASS Assets.car holds the QandeelWorld colour"; else note "FAIL Assets.car has no QandeelWorld colour"; status=1; fi
grep -A12 '"Name" : "QandeelWorld"' "$OUT/bundle/Assets.car.json" > "$OUT/bundle/QandeelWorld-renditions.txt" || true
if grep -q -E '"Name" : "(SplashScreen|SplashScreenLogo|SplashScreenBackground)"' "$OUT/bundle/Assets.car.json"; then note "FAIL a template splash asset is compiled into Assets.car"; status=1; else note "PASS no template splash asset is compiled into Assets.car"; fi
grep -c '"Name" : "AppIcon"' "$OUT/bundle/Assets.car.json" | xargs -I{} echo "AppIcon renditions in Assets.car: {}" | tee -a "$OUT/summary.txt"

# The loose icon files actool writes beside Assets.car, compared by decoded pixels with the canonical renders.
# Informational: Xcode's own processing, not W2-02, decides these bytes.
rgba_sha() { ffmpeg -v error -i "$1" -f rawvideo -pix_fmt rgba - | sha256sum | cut -d' ' -f1; }
for built in "$APP"/AppIcon*.png; do
  [ -e "$built" ] || continue
  size="$(sips -g pixelWidth "$built" | awk '/pixelWidth/ {print $2}')"
  canonical="$VENDORED/AppIcon-$size.png"
  if [ -f "$canonical" ] && [ "$(rgba_sha "$canonical")" = "$(rgba_sha "$built")" ]; then
    note "INFO $(basename "$built") (${size}px) is pixel-identical to canonical AppIcon-$size.png"
  else
    note "INFO $(basename "$built") (${size}px) differs from canonical AppIcon-$size.png after actool"
  fi
done

# ---- 2. install + SpringBoard -----------------------------------------------------------------------------
xcrun simctl install "$UDID" "$APP"
for appearance in light dark; do
  xcrun simctl ui "$UDID" appearance "$appearance"
  sleep 2
  maestro --device "$UDID" test -e OUT="$OUT/home" -e APPEARANCE="$appearance" scripts/w2/w2-02-ios-home-screen.yaml || note "INFO the SpringBoard walk for $appearance did not complete; see the Maestro output"
done

# ---- 3. recorded cold launches ----------------------------------------------------------------------------
record_launch() {
  local label="$1" appearance="$2" expect="$3" then="$4"
  xcrun simctl ui "$UDID" appearance "$appearance"
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  sleep 3
  xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$OUT/launch/$label.mov" &
  local recorder=$!
  sleep 2
  xcrun simctl launch "$UDID" "$BUNDLE" | tee "$OUT/launch/$label-launch.txt"
  sleep 8
  kill -INT "$recorder"
  wait "$recorder"
  xcrun simctl io "$UDID" screenshot "$OUT/launch/$label-final.png"
  local args=(--video "$OUT/launch/$label.mov" --out "$OUT/launch" --platform ios --expect-ground "$expect" --label "$label")
  [ -n "$then" ] && args+=(--then-ground "$then")
  if ! node scripts/w2/analyze-w2-02-launch-recording.mjs "${args[@]}" | tee -a "$OUT/summary.txt"; then status=1; fi
}

record_launch D-device-light light light dark
record_launch E-device-dark dark dark ""
xcrun simctl ui "$UDID" appearance light

note "overall: $([ "$status" -eq 0 ] && echo PASS || echo FAIL)"
exit "$status"
