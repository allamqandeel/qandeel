#!/bin/bash
# COSMOS-INT-01 Slice E iOS baseline (VALIDATION ONLY), probe 3: the Public steps the audit (run 44185138506) could not
# reach. There, its section tap chose a row scrolled under the search field (a harness fault), the search then opened
# while the section list was still showing, and everything after it cascaded. Here every target is a visible one:
#   sections -> one visible section -> every section; a search with results -> a result -> PEEK -> EXPANDED -> discussion
#   -> back; the search closed; a node tap (re-aimed) -> PEEK; and, recorded as it is, a search typed while the section
#   list is open. Nothing is retried; the app binary is the checksummed proof build.
# usage: tap-probe-3.sh <OUT> <UDID>
set -u
OUT="$1"; UDID="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; F="$HERE/flows"; ROOT="$(cd "$HERE/../.." && pwd)"
PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"; mkdir -p "$OUT"; LOG="$OUT/probe.log"
say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
mt() { local n="$1" f="$2"; shift 2; local a=(); for kv in "$@"; do a+=(-e "$kv"); done
  maestro --device "$UDID" test "${a[@]}" "$F/$f" --no-reinstall-driver --driver-host-port "$PORT" > "$OUT/$n.log" 2>&1; local rc=$?
  say "  maestro $n ($f) exit $rc$( [ $rc -ne 0 ] && grep -m1 -E 'not found|No visible|FAILED' "$OUT/$n.log" | sed 's/^/ :: /')"; return $rc; }
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1; }
tree() { curl --silent --max-time 30 -X POST -H 'Content-Type: application/json' \
  --data '{"appIds":["com.qandeel.mobile"],"excludeKeyboardElements":false}' "http://127.0.0.1:$PORT/viewHierarchy" > "$OUT/$1.json"; }
has() { grep -q "\"$1" "$OUT/$2.json" 2>/dev/null && echo YES || echo no; }
ev() { sleep 3; shot "$1"; tree "$1"
  say "  after $1: sections=$(has qandeel-public-sections "$1") section-near=$(has qandeel-public-section-near "$1") results=$(has qandeel-public-search-result- "$1") panel=$(has qandeel-public-panel "$1") discussion=$(has qandeel-public-discussion "$1") sheet-handle=$(has cosmos-detail-sheet-handle "$1") search-field=$(has qandeel-public-search\" "$1")"; }
wpt="$(curl --silent --max-time 60 -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$PORT/deviceInfo" | grep -o '"widthPoints":[0-9]*' | cut -d: -f2)"
node_at() { (cd "$ROOT" && node "$HERE/nodes.mjs" --any "$OUT/$1.png" "$wpt"); }
S() { local n="$1"; shift; mt "$n" "$@"; ev "$n"; }

say "== Public, seeded"
mt u-launch launch.yaml NAME=probe3-launch; mt u-seed link.yaml URL=qandeel://s401-proof/public/seed
mt u-enter tap.yaml ID=qandeel-switcher-public_world IDX=0; mt u-allow link.yaml URL=qandeel://s401-proof/public/allow
mt u-field wait-id.yaml ID=qandeel-public-search T=30000; sleep 4; ev u00-field
say "== sections: a visible one, then every section"
S u01-sections tap.yaml ID=qandeel-public-section-control IDX=0
S u02-section-love tap.yaml ID=qandeel-public-section-love IDX=0
S u03-sections-again tap.yaml ID=qandeel-public-section-control IDX=0
S u04-section-all tap.yaml ID=qandeel-public-section-all IDX=0
say "== search (submitted by the keyboard's own key), a result, PEEK, EXPANDED, discussion"
S u05-search type.yaml ID=qandeel-public-search "TEXT=خوف"
S u06-result tap.yaml "ID=qandeel-public-search-result-.*" IDX=0
S u07-expanded swipe-id-up.yaml ID=cosmos-detail-sheet-handle
S u08-discussion scroll-tap.yaml ID=qandeel-public-panel-discussion
S u09-discussion-back tap.yaml ID=qandeel-public-discussion-back IDX=0
S u10-collapse swipe-id-down.yaml ID=cosmos-detail-sheet-handle
S u11-search-close tap.yaml ID=qandeel-public-search-close IDX=0
say "== a node tap on the field, re-aimed from the frame before each tap"
prev=u11-search-close
for i in 1 2 3; do pt="$(node_at "$prev")"; say "  node $i at $pt"; [ "$pt" = none ] && break
  S "u12-node-$i" tap-point.yaml "P=$pt"; prev="u12-node-$i"
  [ "$(has qandeel-public-panel "$prev")" = YES ] && break; done
S u13-expanded swipe-id-up.yaml ID=cosmos-detail-sheet-handle
S u14-collapse swipe-id-down.yaml ID=cosmos-detail-sheet-handle
S u15-close swipe-id-down.yaml ID=cosmos-detail-sheet-handle
say "== recorded as it is: a search typed while the section list is open"
S u16-sections tap.yaml ID=qandeel-public-section-control IDX=0
S u17-search-over-sections type.yaml ID=qandeel-public-search "TEXT=خوف"
say "done"
