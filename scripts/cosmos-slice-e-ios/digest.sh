#!/bin/bash
# COSMOS-INT-01 Slice E iOS baseline (VALIDATION ONLY): condense the audit's scene artifacts into a digest small enough
# to fetch over a slow link. The full-size evidence stays in the run's artifacts, untouched.
# Per scene: one contact sheet (every screenshot, labelled with its step), the step table rows, each failed step's last
# Maestro error, and per step the accessibility ids and labels the driver saw (with frames for qandeel/cosmos ids).
# usage: digest.sh <download dir with one sub-dir per artifact> <out dir>
set -u
IN="$1"; OUT="$2"; mkdir -p "$OUT"
for rec in "$IN"/*-record; do
  [ -d "$rec" ] || continue
  job="$(basename "$rec" -record)"; job="${job#cosmos-ios-audit-}"
  mkdir -p "$OUT/$job"
  cp "$rec"/*.tsv "$rec"/runner.log "$rec"/device.txt "$OUT/$job/" 2>/dev/null
done
for d in "$IN"/cosmos-ios-audit-*; do
  case "$d" in *-record) continue ;; esac
  [ -d "$d" ] || continue
  name="$(basename "$d")"; name="${name#cosmos-ios-audit-}"; scene="${name##*-}"; job="${name%-*}"
  o="$OUT/$job/$scene"; mkdir -p "$o"
  ls "$d"/*.png >/dev/null 2>&1 && montage -label '%t' -font DejaVu-Sans -pointsize 11 -tile 6x -geometry 200x+4+6 -quality 60 \
    $(ls "$d"/*.png | sort) "$o/sheet.jpg" 2>>"$o/montage.err"
  for j in "$d"/*.json; do
    [ -f "$j" ] || continue
    s="$(basename "$j" .json)"
    jq -r '[.. | objects | select((.identifier // "") != "" or (.label // "") != "") |
      ((.identifier // "") as $i | (.label // "") as $l | (.frame // {}) as $f |
       if ($i | test("qandeel|cosmos")) then "\($i)\t\($l[0:60])\t\($f.X|floor),\($f.Y|floor),\($f.Width|floor),\($f.Height|floor)"
       else "\($i)\t\($l[0:60])" end)] | unique | .[]' "$j" > "$o/$s.ids" 2>/dev/null || echo "(unparsed)" > "$o/$s.ids"
  done
  for l in "$d"/logs/*.log; do
    [ -f "$l" ] || continue
    s="$(basename "$l" .log)"
    t="$(find "$d/logs/$s.d" -name '*.tail' 2>/dev/null | head -1)"
    { grep -v -E '^\s+at |^\s*$' "$l" | head -n 30
      [ -n "$t" ] && grep -E 'Exception|not found|Assertion|Unreachable|timed out|FAILED|Error' "$t" | grep -v -E '^\s+at ' | tail -n 6
    } > "$o/$s.flow" 2>/dev/null
  done
  # R4 check: what the node finder returns on each World's settled stage (integer points, 402-pt-wide device).
  for f in "$d"/p02b-*.png "$d"/s02b-*.png "$d"/u01-field.png; do
    [ -f "$f" ] && echo "$(basename "$f") $(node scripts/cosmos-slice-e-ios/nodes-r4.mjs --any "$f" 402)" >> "$o/finder.txt"
  done
  ls -l "$d"/*.mp4 2>/dev/null | awk '{print $5, $NF}' > "$o/recordings.txt"
done
du -sh "$OUT"
