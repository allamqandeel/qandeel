#!/bin/bash
# COSMOS-INT-01 Slice E iOS baseline audit (VALIDATION ONLY): choose the first available simulator of the given names on
# the iOS 26.5 runtime (creating it from its device type when the image has the type but no device), boot it, and export
# IOS_SIM_UDID. Records which device was used, and why, in <OUT>/device.txt.
# usage: sim.sh "<name>|<fallback name>|..." <OUT dir>
set -u
CANDS="$1"; OUT="$2"; SUFFIX="${IOS_RUNTIME_SUFFIX:-iOS-26-5}"
mkdir -p "$OUT"
runtime="$(xcrun simctl list runtimes -j | jq -r --arg s "$SUFFIX" '.runtimes[] | select(.identifier | endswith($s)) | select(.isAvailable) | .identifier' | head -n 1)"
if [ -z "$runtime" ]; then echo "STOP: no available runtime *$SUFFIX"; xcrun simctl list runtimes; exit 1; fi
udid=; name=; how=
IFS='|' read -r -a names <<< "$CANDS"
for n in "${names[@]}"; do
  udid="$(xcrun simctl list devices available -j | jq -r --arg r "$runtime" --arg n "$n" '.devices[$r][]? | select(.name == $n) | .udid' | head -n 1)"
  if [ -n "$udid" ]; then name="$n"; how="existing device on $runtime"; break; fi
done
if [ -z "$udid" ]; then
  for n in "${names[@]}"; do
    type="$(xcrun simctl list devicetypes -j | jq -r --arg n "$n" '.devicetypes[] | select(.name == $n) | .identifier' | head -n 1)"
    [ -z "$type" ] && continue
    udid="$(xcrun simctl create "$n (audit)" "$type" "$runtime" 2>/dev/null)" || udid=
    if [ -n "$udid" ]; then name="$n"; how="created from $type on $runtime"; break; fi
  done
fi
if [ -z "$udid" ]; then echo "STOP: none of [$CANDS] is available or creatable on $runtime"; xcrun simctl list devices available; exit 1; fi
xcrun simctl boot "$udid" 2>/dev/null || true
node scripts/validation/bounded-run.mjs --seconds 300 --label ios-simulator-boot -- xcrun simctl bootstatus "$udid" -b
{ echo "name=$name"; echo "udid=$udid"; echo "how=$how"; echo "candidates=$CANDS"; } | tee "$OUT/device.txt"
echo "IOS_SIM_UDID=$udid" >> "${GITHUB_ENV:-/dev/null}"
