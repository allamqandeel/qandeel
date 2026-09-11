#!/usr/bin/env bash
# T-12 Phase M — the iOS Release SIMULATOR evidence set for `QAN-BL-RSP-01`.
#
# What a simulator can honestly answer, and this captures: the real iOS type engine at the largest
# system text size, Arabic wording, forced right-to-left layout, and whether the composition survives
# all four combinations. `jest-expo` performs no layout at all, so every local responsive assertion is
# made against a supplied measurement — these images are the first time a real type engine has laid
# this app out.
#
# What it cannot answer, and this therefore does not attempt: frame pacing, drag feel, velocity
# handoff, the composite beat, pop-in during a real drag, and real safe-area insets on a notched or
# gesture-bar device. Those are MOT-03, MOT-04 and the RSP-4 row, they need a finger on hardware, and
# every image here is labelled `IOS RELEASE SIMULATOR` for exactly that reason.
#
# RTL is FORCED rather than inferred. The app declares no Arabic localization, so `-AppleLanguages`
# alone changes the JavaScript locale (`Intl` → `deviceProductLanguage()`) without changing UIKit's
# layout direction (`I18nManager.isRTL` → `deviceLayoutDirection()`). Those two axes are deliberately
# independent in the Product, so the pseudolanguage switches are used to drive the second one, and the
# file names record that the direction was forced.
set -euo pipefail

UDID="${1:?usage: capture-ios-simulator-evidence.sh <simulator udid> <output directory>}"
OUT="${2:?usage: capture-ios-simulator-evidence.sh <simulator udid> <output directory>}"
APP_ID="com.qandeel.mobile"

mkdir -p "$OUT"

capture() {
  local label="$1"; shift
  local content_size="$1"; shift
  xcrun simctl terminate "$UDID" "$APP_ID" >/dev/null 2>&1 || true
  xcrun simctl ui "$UDID" content_size "$content_size" >/dev/null 2>&1 || echo "note: content_size ${content_size} was not accepted by this runtime"
  # shellcheck disable=SC2068 — the remaining arguments are deliberately word-split launch arguments.
  xcrun simctl launch "$UDID" "$APP_ID" $@ >/dev/null
  sleep 8
  xcrun simctl io "$UDID" screenshot "$OUT/${label}.png" >/dev/null
  echo "captured ${label}.png  (content_size=${content_size}, launch args: $*)"
}

capture 'en-ltr-default'            medium                              -AppleLanguages '(en)' -AppleLocale en_US
capture 'en-ltr-largest-text'       accessibility-extra-extra-extra-large -AppleLanguages '(en)' -AppleLocale en_US
capture 'ar-rtl-forced-default'     medium                              -AppleLanguages '(ar)' -AppleLocale ar_EG -AppleTextDirection YES -NSForceRightToLeftWritingDirection YES
capture 'ar-rtl-forced-largest-text' accessibility-extra-extra-extra-large -AppleLanguages '(ar)' -AppleLocale ar_EG -AppleTextDirection YES -NSForceRightToLeftWritingDirection YES

# Left as it was found, so a later step in the same job does not inherit an accessibility text size it
# never asked for and misread the result.
xcrun simctl ui "$UDID" content_size medium >/dev/null 2>&1 || true
xcrun simctl terminate "$UDID" "$APP_ID" >/dev/null 2>&1 || true

cat > "$OUT/README.txt" <<'TXT'
IOS RELEASE SIMULATOR evidence — QAN-BL-RSP-01 only.

en-ltr-default              English, left-to-right, default system text size.
en-ltr-largest-text         English, left-to-right, largest accessibility text size.
ar-rtl-forced-default       Arabic JS locale, layout direction FORCED right-to-left, default text.
ar-rtl-forced-largest-text  Arabic JS locale, layout direction FORCED right-to-left, largest text.

The layout direction is forced with -AppleTextDirection / -NSForceRightToLeftWritingDirection because
the app declares no Arabic localization; the language axis and the direction axis are independent in
this Product by design, and these images exercise them independently on purpose.

NONE of these images is evidence for QAN-BL-MOT-03 or QAN-BL-MOT-04. A simulator cannot answer frame
pacing, drag feel, velocity handoff or pop-in during a real drag, and it cannot show the real
safe-area insets of a notched or gesture-bar device (the RSP-4 row). Those remain physical-only.
TXT
