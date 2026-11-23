#!/bin/bash
# QAN-BL-CI-04 measurement probe (PO, 2026-11-23; measurement only, NEVER merged). Times what each Maestro cli-2.10.0
# call spends before its first flow command, on the gate's runner image, Xcode, simulator runtime and Maestro build.
# Variants (one environment difference each, interleaved so that drift on the runner hits every variant alike):
#   A  the gate's environment as it is
#   B  A without the Android SDK variables Maestro reads (its device enumeration then skips `avdmanager list avd`)
#   C  B + MAESTRO_OPTS=-XX:TieredStopAtLevel=1 (C1-only JIT for a short-lived JVM)
#   D  B + a dynamic AppCDS archive of the CLI's classes (created by one excluded warm-up call)
# Loads: idle, and every core busy (the gate's simulator renders a continuously animated stage while Maestro runs).
# usage: probe.sh <UDID> <OUT>
set -u
UDID="$1"; OUT="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"; PORT="${MAESTRO_IOS_DRIVER_PORT:-22087}"
mkdir -p "$OUT"; TSV="$OUT/calls.tsv"; printf 'load\tvariant\trep\texit\twall_s\tphases\n' > "$TSV"
now() { node -e 'console.log(Date.now())'; }
say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$OUT/probe.log"; }
ANDROID_VARS="ANDROID_HOME ANDROID_SDK_ROOT ANDROID_SDK_HOME ANDROID_SDK ANDROID"
{ echo "ncpu=$(sysctl -n hw.ncpu)"; echo "mem=$(sysctl -n hw.memsize)"; for v in $ANDROID_VARS; do echo "$v=${!v:-<unset>}"; done
  echo "java=$(java -version 2>&1 | head -1)"; echo "maestro opts line: $(grep -n 'MAESTRO_OPTS' "$HOME/.maestro/bin/maestro" | head -2)"; } | tee "$OUT/env.txt"
# raw cost of what Maestro's enumeration runs, three times each
raw() { local n="$1"; shift; for i in 1 2 3; do local a b; a=$(now); "$@" > /dev/null 2>&1; local rc=$?; b=$(now); printf '%s\t%s\t%s\n' "$n" "$rc" "$(( b - a ))" >> "$OUT/raw.tsv"; done; }
printf 'tool\texit\tms\n' > "$OUT/raw.tsv"
raw simctl-list xcrun simctl list -j
raw devicectl-list xcrun devicectl list devices --json-output "$OUT/devicectl.json"
avd="$(ls -d "${ANDROID_HOME:-/nonexistent}"/cmdline-tools/*/bin/avdmanager 2>/dev/null | head -1)"
[ -n "$avd" ] && raw avdmanager-list "$avd" list avd || echo "avdmanager-list	absent	0" >> "$OUT/raw.tsv"
command -v adb >/dev/null && raw adb-devices adb devices || echo "adb-devices	absent	0" >> "$OUT/raw.tsv"
cat "$OUT/raw.tsv"
CDS="$OUT/maestro-cds.jsa"
envfor() { case "$1" in
  A) echo "";;
  B) echo "-u ANDROID_HOME -u ANDROID_SDK_ROOT -u ANDROID_SDK_HOME -u ANDROID_SDK -u ANDROID";;
  C) echo "-u ANDROID_HOME -u ANDROID_SDK_ROOT -u ANDROID_SDK_HOME -u ANDROID_SDK -u ANDROID MAESTRO_OPTS=-XX:TieredStopAtLevel=1";;
  D) echo "-u ANDROID_HOME -u ANDROID_SDK_ROOT -u ANDROID_SDK_HOME -u ANDROID_SDK -u ANDROID MAESTRO_OPTS=-XX:SharedArchiveFile=$CDS";;
esac; }
call() { local load="$1" v="$2" rep="$3" d="$OUT/calls/$1-$2-$3" a b rc
  mkdir -p "$d"; a=$(now)
  # shellcheck disable=SC2046
  env $(envfor "$v") node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 300 --label "probe-$load-$v-$rep" -- \
    maestro --device "$UDID" test "$HERE/probe.yaml" --no-reinstall-driver --driver-host-port "$PORT" --debug-output "$d" --flatten-debug-output > "$d/stdout.log" 2>&1; rc=$?
  b=$(now)
  local ph; ph="$(node "$HERE/maestro-phases.mjs" "$d/maestro.log" "$a" "$b")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$load" "$v" "$rep" "$rc" "$(( (b - a) / 1000 ))" "$ph" >> "$TSV"; say "$load $v $rep exit $rc: $ph"; }
# the AppCDS archive: one excluded warm-up call writes it
env -u ANDROID_HOME -u ANDROID_SDK_ROOT -u ANDROID_SDK_HOME -u ANDROID_SDK -u ANDROID MAESTRO_OPTS="-XX:ArchiveClassesAtExit=$CDS" \
  node "$ROOT/scripts/validation/bounded-run.mjs" --seconds 300 --label probe-cds-create -- \
  maestro --device "$UDID" test "$HERE/probe.yaml" --no-reinstall-driver --driver-host-port "$PORT" --debug-output "$OUT/calls/cds-create" --flatten-debug-output > "$OUT/cds-create.log" 2>&1
say "cds archive: $(ls -la "$CDS" 2>&1)"
for rep in 1 2 3 4 5 6; do for v in A B C D; do call idle "$v" "$rep"; done; done
n="$(sysctl -n hw.ncpu)"; pids=""; for i in $(seq 1 "$n"); do yes > /dev/null & pids="$pids $!"; done; say "load: $n busy loops ($pids)"
for rep in 1 2 3 4 5; do for v in A B C D; do call busy "$v" "$rep"; done; done
kill $pids 2>/dev/null || true
node "$HERE/summarise.mjs" "$TSV" | tee "$OUT/summary.txt"
