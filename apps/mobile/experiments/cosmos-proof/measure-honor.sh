#!/usr/bin/env bash
# COSMOS proof (experimental, isolated) — the Product Owner's on-device measurement run. VALIDATION TOOLING ONLY.
#
# !!! WRITTEN WITHOUT A DEVICE. It has never been run against a phone. The parts most likely to need a fix on the
# !!! first run are marked "FIRST-RUN CHECK": the SurfaceFlinger layer name, and the `dumpsys meminfo` row names.
#
# Usage (phone on USB, USB debugging on, the PROOF apk installed):
#
#   ./measure-honor.sh <package-id> [serial]
#   ./measure-honor.sh com.qandeel.mobile.cosmosproof
#
# It measures ONLY the given package, and drives it only through that package's own deep links
# (`qandeel-cosmos-proof://…`, sent with an explicit package). It installs nothing and changes ONE system property, in
# the optional overdraw step, which it sets back. The Product app is never launched.
#
# WHAT IT MEASURES (modelled on docs/e2e/QANDEEL_MAP_CLOSE_01_V3_PRODUCTION_VISUAL_PORT_RECORD_v1.md §9)
#   1. Cold and warm opening: `am start -W` TotalTime, COLD after force-stop, WARM after Home (6 runs each).
#   2. Per world (personal, shared, public) × per overdraw mode (full, no-bodies, plates) at FAR:
#        PAN   three rounds of six 700 ms `input swipe` pans;
#        ZOOM  three rounds of step/in, step/in, step/out, step/out through the proof's deep links. This is the
#              ACCESSIBLE semantic step (the settle animation), NOT a two-finger pinch: adb cannot inject one here.
#              A real pinch must be judged by hand, with the in-app HUD.
#      Frames are the times SurfaceFlinger PRESENTED on the app's layer (`dumpsys SurfaceFlinger --latency <layer>`),
#      because `gfxinfo` sees only the host window's own HWUI work and misses the Skia canvas. Reported per cell:
#      fps (presented frames / time moving), p95 and max frame interval (ms), stalls (> 50 ms) and freezes (> 100 ms).
#      Gaps over 1.5 s (between swipes) are dropped.
#   3. Memory: `dumpsys meminfo` Native Heap and Graphics (PSS, MB) before and after the proof's own open/close cycle
#      (`cycle/20`: the world canvas is mounted and unmounted 20 times, cycling worlds), after a trim.
#   4. The in-app probe lines (`[cosmos-proof] probe {…}` in logcat): UI-thread frame-callback intervals and
#      "gesture event → next UI frame". These are NOT presented-frame times and NOT touch-to-photon latency.
#   5. Optional (OVERDRAW=1): a "Debug GPU overdraw" screenshot per world. HONEST LIMIT: `debug.hwui.overdraw` colours
#      what HWUI (the Android view renderer) draws. The Skia canvas is ONE texture to HWUI (TextureView, the default)
#      or is not drawn by HWUI at all (SurfaceView), so this shows the overdraw of the React Native chrome over the
#      canvas, NOT the overdraw INSIDE the Skia canvas. The primary overdraw evidence is therefore row 2: the
#      frame-time difference between FULL, NO_BODIES and PLATES_ONLY at FAR.
#
# THE LAYER NAME (FIRST-RUN CHECK). `dumpsys SurfaceFlinger --list` is searched for layers containing the package.
# A `SurfaceView[<package>/…]` layer is preferred when one exists (the proof's "SurfaceView" switch); otherwise the
# activity's window layer `<package>/<activity>#<n>` is used (the default TextureView composes into the window).
# If the script prints "no frames" everywhere, run:   adb shell dumpsys SurfaceFlinger --list | grep <package>
# and pass the right one:                              LAYER='<exact layer name>' ./measure-honor.sh <package-id>
#
# EXPECTED OUTPUT (the exact table; dashes stand for values — none are invented here):
#
#   == COSMOS proof · <package> · <device model> · <date> ==
#   layer: <layer name>            refresh period: -- ms
#
#   OPENING (am start -W TotalTime, ms)
#   start   runs   min    median   max
#   COLD    6      --     --       --
#   WARM    6      --     --       --
#
#   FRAMES PRESENTED (SurfaceFlinger) at FAR
#   world      mode        motion   frames   fps     p95 ms   max ms   stalls>50   freezes>100
#   personal   full        PAN      --       --      --       --       --          --
#   personal   full        ZOOM     --       --      --       --       --          --
#   personal   no-bodies   PAN      --       --      --       --       --          --
#   personal   no-bodies   ZOOM     --       --      --       --       --          --
#   personal   plates      PAN      --       --      --       --       --          --
#   personal   plates      ZOOM     --       --      --       --       --          --
#   shared     full        PAN      --       --      --       --       --          --
#   …          (the same six rows for shared and for public)
#
#   MEMORY (dumpsys meminfo, PSS MB, after trim)
#   when                 native heap   graphics   total
#   before cycle/20      --            --         --
#   after cycle/20       --            --         --
#   growth               --            --         --
#
#   IN-APP PROBE LINES (UI-thread frame-callback intervals; not presented frames)
#   [cosmos-proof] probe {…}        (one line per gesture, as logged by the app)
#
set -u

PKG="${1:-}"
SERIAL="${2:-}"
if [ -z "$PKG" ]; then echo "usage: $0 <package-id> [serial]" >&2; exit 2; fi
ADB=(adb)
[ -n "$SERIAL" ] && ADB=(adb -s "$SERIAL")
SCHEME="qandeel-cosmos-proof"
ROUNDS="${ROUNDS:-3}"
OUT="${OUT:-./cosmos-proof-measure-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"

sh_() { "${ADB[@]}" shell "$@" </dev/null | tr -d '\r'; }
link() { sh_ am start -W -a android.intent.action.VIEW -d "$SCHEME://$1" "$PKG" >/dev/null 2>&1; }

"${ADB[@]}" get-state >/dev/null 2>&1 || { echo "no device (adb get-state failed)" >&2; exit 1; }
sh_ pm path "$PKG" | grep -q package: || { echo "package $PKG is not installed" >&2; exit 1; }
ACTIVITY="$(sh_ cmd package resolve-activity --brief "$PKG" | tail -n 1)"
[ -n "$ACTIVITY" ] || { echo "could not resolve the launcher activity of $PKG" >&2; exit 1; }
MODEL="$(sh_ getprop ro.product.model)"
SIZE="$(sh_ wm size | sed -n 's/.*: \([0-9]*\)x\([0-9]*\).*/\1 \2/p' | tail -n 1)"
W="${SIZE% *}"; H="${SIZE#* }"
CX=$((W / 2)); CY=$((H / 2)); DX=$((W * 3 / 10)); DY=$((H / 5))

# ── 1. opening ──────────────────────────────────────────────────────────────────────────────────────────────────────
total_time() { sh_ am start -W -n "$ACTIVITY" | sed -n 's/^TotalTime: *//p' | tail -n 1; }
stats3() { sort -n | awk '{ v[NR] = $1 } END { if (NR == 0) { print "--  --  --"; exit } m = (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2; printf "%s  %s  %s\n", v[1], m, v[NR] }'; }
COLD=""; WARM=""
for _ in 1 2 3 4 5 6; do sh_ am force-stop "$PKG"; sleep 1; COLD="$COLD$(total_time)\n"; sleep 2; done
for _ in 1 2 3 4 5 6; do sh_ input keyevent KEYCODE_HOME; sleep 1; WARM="$WARM$(total_time)\n"; sleep 1; done

# ── the layer (FIRST-RUN CHECK) ─────────────────────────────────────────────────────────────────────────────────────
sleep 2
find_layer() {
  if [ -n "${LAYER:-}" ]; then echo "$LAYER"; return; fi
  local all; all="$(sh_ dumpsys SurfaceFlinger --list | grep -F "$PKG")"
  local pick; pick="$(echo "$all" | grep -F 'SurfaceView[' | grep -v 'Background for' | tail -n 1)"
  [ -n "$pick" ] || pick="$(echo "$all" | grep -F "$PKG/" | grep -v -e 'Splash' -e 'ActivityRecord' -e 'Task=' | tail -n 1)"
  echo "$pick"
}

# Frame intervals (ms) from the layer's present times since the last clear: one interval per line.
intervals() {
  sh_ dumpsys SurfaceFlinger --latency "$1" | awk 'NR > 1 && NF == 3 && $2 > 0 && $2 < 9000000000000000000 { if (prev > 0 && $2 > prev) printf "%.3f\n", ($2 - prev) / 1000000; prev = $2 }'
}
# One table cell: frames, fps, p95, max, stalls, freezes, from a file of intervals; gaps over 1.5 s are dropped.
cell() {
  awk '$1 <= 1500 { v[++n] = $1; sum += $1; if ($1 > 50) s++; if ($1 > 100) f++ }
    END { if (n == 0) { printf "%-8s %-7s %-8s %-8s %-11s %s\n", "0", "--", "--", "--", "--", "-- (no frames: check the layer)"; exit }
      for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++) if (v[j] < v[i]) { t = v[i]; v[i] = v[j]; v[j] = t }
      p = int(n * 0.95); if (p < 1) p = 1; if (p > n) p = n
      printf "%-8d %-7.1f %-8.1f %-8.1f %-11d %d\n", n, 1000 * n / sum, v[p], v[n], s + 0, f + 0 }' "$1"
}

pan_round() { # six 700 ms pans: right, left, down, up, and the two diagonals back
  local layer="$1" file="$2"
  for s in "$((CX - DX)) $CY $((CX + DX)) $CY" "$((CX + DX)) $CY $((CX - DX)) $CY" "$CX $((CY - DY)) $CX $((CY + DY))" "$CX $((CY + DY)) $CX $((CY - DY))" \
           "$((CX - DX)) $((CY - DY)) $((CX + DX)) $((CY + DY))" "$((CX + DX)) $((CY + DY)) $((CX - DX)) $((CY - DY))"; do
    sh_ dumpsys SurfaceFlinger --latency-clear "$layer" >/dev/null
    # shellcheck disable=SC2086
    sh_ input swipe $s 700
    sleep 0.6
    intervals "$layer" >>"$file"
  done
}
zoom_round() { # the accessible semantic step, both ways (each is one settle animation)
  local layer="$1" file="$2"
  for step in in in out out; do
    sh_ dumpsys SurfaceFlinger --latency-clear "$layer" >/dev/null
    link "step/$step"
    sleep 0.9
    intervals "$layer" >>"$file"
  done
}

sh_ logcat -c >/dev/null 2>&1
FRAMES_TABLE=""
for world in personal shared public; do
  for mode in full no-bodies plates; do
    link "world/$world"; sleep 2.5
    link "mode/$mode"; sleep 1
    L="$(find_layer)"
    for motion in PAN ZOOM; do
      file="$OUT/$world-$mode-$motion.intervals"; : >"$file"
      r=0
      while [ "$r" -lt "$ROUNDS" ]; do
        if [ "$motion" = PAN ]; then pan_round "$L" "$file"; else zoom_round "$L" "$file"; fi
        r=$((r + 1))
      done
      FRAMES_TABLE="$FRAMES_TABLE$(printf '%-10s %-11s %-8s ' "$world" "$mode" "$motion")$(cell "$file")\n"
    done
  done
done
link "mode/full"
PERIOD="$(sh_ dumpsys SurfaceFlinger --latency "$L" | awk 'NR == 1 { printf "%.2f", $1 / 1000000 }')"

# ── 3. memory around the open/close cycle (FIRST-RUN CHECK: the row names of `dumpsys meminfo`) ─────────────────────
mem() {
  sh_ am send-trim-memory "$PKG" RUNNING_CRITICAL >/dev/null 2>&1; sleep 2
  sh_ dumpsys meminfo "$PKG" | awk '/Native Heap:/ { n = $3 } /Graphics:/ { g = $2 } /TOTAL PSS:/ { t = $3 } /TOTAL:/ && t == "" { t = $2 }
    END { printf "%.1f %.1f %.1f\n", n / 1024, g / 1024, t / 1024 }'
}
link "world/public"; sleep 3
BEFORE="$(mem)"
link "cycle/20"
# The cycle takes about (first stage frame + 0.5 s) per open; its end is logged by the app.
i=0; while [ "$i" -lt 150 ]; do sleep 2; sh_ logcat -d -s ReactNativeJS:I | grep -q '\[cosmos-proof\] cycle' && break; i=$((i + 1)); done
sleep 2
AFTER="$(mem)"

# ── 5. optional: the HWUI overdraw view (see the header for what it can and cannot show) ────────────────────────────
if [ "${OVERDRAW:-0}" = 1 ]; then
  sh_ setprop debug.hwui.overdraw show
  sh_ am force-stop "$PKG"; sh_ am start -W -n "$ACTIVITY" >/dev/null; sleep 4
  for world in personal shared public; do link "world/$world"; sleep 3; "${ADB[@]}" exec-out screencap -p >"$OUT/overdraw-$world.png"; done
  sh_ setprop debug.hwui.overdraw false
  sh_ am force-stop "$PKG"
fi

# ── the one table ───────────────────────────────────────────────────────────────────────────────────────────────────
{
  echo "== COSMOS proof · $PKG · $MODEL · $(date '+%Y-%m-%d %H:%M') =="
  echo "layer: $L            refresh period: ${PERIOD:---} ms"
  echo
  echo "OPENING (am start -W TotalTime, ms)"
  echo "start   runs   min    median   max"
  echo "COLD    6      $(printf '%b' "$COLD" | grep -E '^[0-9]+$' | stats3)"
  echo "WARM    6      $(printf '%b' "$WARM" | grep -E '^[0-9]+$' | stats3)"
  echo
  echo "FRAMES PRESENTED (SurfaceFlinger) at FAR"
  echo "world      mode        motion   frames   fps     p95 ms   max ms   stalls>50   freezes>100"
  printf '%b' "$FRAMES_TABLE"
  echo
  echo "MEMORY (dumpsys meminfo, PSS MB, after trim)"
  echo "when                 native heap   graphics   total"
  echo "before cycle/20      $BEFORE" | awk '{ printf "%-20s %-13s %-10s %s\n", $1 " " $2, $3, $4, $5 }'
  echo "after cycle/20       $AFTER" | awk '{ printf "%-20s %-13s %-10s %s\n", $1 " " $2, $3, $4, $5 }'
  echo "$BEFORE $AFTER" | awk '{ printf "%-20s %-13.1f %-10.1f %.1f\n", "growth", $4 - $1, $5 - $2, $6 - $3 }'
  echo
  echo "IN-APP PROBE LINES (UI-thread frame-callback intervals; not presented frames)"
  sh_ logcat -d -s ReactNativeJS:I | grep -F '[cosmos-proof]' | sed 's/^.*\[cosmos-proof\]/[cosmos-proof]/'
  [ "${OVERDRAW:-0}" = 1 ] && echo && echo "HWUI overdraw screenshots: $OUT/overdraw-*.png (chrome over the canvas only; see the header)"
} | tee "$OUT/results.txt"
echo
echo "raw intervals and results: $OUT"
