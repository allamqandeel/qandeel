#!/bin/bash
# S8B-07 CP2-A.1 iOS Replay gate: the results file, sourced by run-replay-gate.sh (and by its contract's regression proof).
# Needs RES (the results.tsv path) and LOG (the gate log path).
#
# Run 46007215812 / 46037104976: J-SAVED-LINE's evidence held three matching label lines, and every line after the first
# became a row of its own with no result, so a cell whose cases all passed was red. The detail is now written on one line,
# and the file is validated against the exact case set before it is judged.

say() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }

# one_line <text>: carriage returns go, tabs become spaces, line breaks become " | " (POSIX tr and awk: GNU and BSD alike).
one_line() { printf '%s' "$1" | tr -d '\r' | tr '\t' ' ' | awk 'NR > 1 { printf " | " } { printf "%s", $0 }'; }

# result <case> <PASS|FAIL|NOT TESTED> <detail>: exactly one row.
result() { local d; d="$(one_line "$3")"; printf '%s\t%s\t%s\n' "$1" "$2" "$d" >> "$RES"; say "RESULT $1 $2 — $d"; }

# validate_results <case>...: the file is its header, then exactly these cases, in this order, each once, each with
# three fields and a result of PASS, FAIL or NOT TESTED. Prints what is wrong; non-zero when anything is.
# Run 46059753878: the cases went to awk one per line, and the runner's BSD awk refuses a newline in a -v value ("awk:
# newline in string"). Case names hold no space, so they go space-separated, which every awk takes.
validate_results() {
  awk -F'\t' -v want="$*" '
    BEGIN { n = split(want, w, " "); bad = 0 }
    NR == 1 { if ($0 != "case\tresult\tdetail") { print "results.tsv: the header is not case/result/detail"; bad = 1 } next }
    { i = NR - 1
      if (NF != 3) { print "results.tsv: line " NR " has " NF " fields, not 3"; bad = 1 }
      if ($2 != "PASS" && $2 != "FAIL" && $2 != "NOT TESTED") { print "results.tsv: line " NR " has the result \"" $2 "\""; bad = 1 }
      if (i > n || $1 != w[i]) { print "results.tsv: line " NR " is \"" $1 "\", expected \"" (i > n ? "(no more cases)" : w[i]) "\""; bad = 1 } }
    END { if (NR - 1 < n) { print "results.tsv: " (n - (NR - 1)) " expected case(s) missing"; bad = 1 } exit bad }' "$RES"
}
