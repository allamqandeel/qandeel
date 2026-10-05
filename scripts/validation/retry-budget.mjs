#!/usr/bin/env node
/**
 * VAL-01 — the retry budget of an isolated validation consumer (Task Contract §10).
 *
 *   attempt 1   normal validation
 *   attempt 2   ONE explicit "Re-run failed jobs", after the failure was classified
 *   attempt 3+  refused: VALIDATION RETRY BUDGET EXHAUSTED
 *
 * It is the first step of every device-driving consumer job, so a third unchanged attempt stops in
 * seconds instead of booting an emulator again. A new commit is a new run — `github.run_attempt` starts
 * at 1 — so a real fix to Product or to the harness is a new validation head, never a third retry.
 *
 * There is no automatic retry anywhere; this only bounds the manual one. Deterministic unit / database
 * tests carry no budget at all: they do not retry, they fail.
 *
 * Usage: node scripts/validation/retry-budget.mjs --attempt "$GITHUB_RUN_ATTEMPT" [--max 2]
 */

import process from 'node:process';

export const MAX_ATTEMPTS = 2;
export const EXHAUSTED = 'VALIDATION RETRY BUDGET EXHAUSTED';

/** Pure verdict. An attempt that is not a positive integer is refused, never assumed to be the first. */
export function retryVerdict(attempt, max = MAX_ATTEMPTS) {
  const n = Number(attempt);
  if (!Number.isInteger(n) || n < 1) return { ok: false, message: `${EXHAUSTED}: the run attempt ${JSON.stringify(attempt)} is not established` };
  if (n > max) {
    return {
      ok: false,
      message: `${EXHAUSTED}: attempt ${n} of an unchanged run exceeds the budget of ${max} (one normal run + one classified rerun). `
        + 'Diagnose the classified failure; a change to Product or to the harness is a new commit and a new validation head.',
    };
  }
  return { ok: true, message: `retry budget: attempt ${n} of ${max}` };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const verdict = retryVerdict(flag('attempt') ?? process.env.GITHUB_RUN_ATTEMPT, Number(flag('max') ?? MAX_ATTEMPTS));
  if (!verdict.ok) {
    process.stdout.write(`::error title=${EXHAUSTED}::${verdict.message}\n`);
    process.exit(1);
  }
  process.stdout.write(`${verdict.message}\n`);
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/validation/retry-budget.mjs')) {
  main();
}
