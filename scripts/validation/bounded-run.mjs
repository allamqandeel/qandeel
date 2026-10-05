#!/usr/bin/env node
/**
 * VAL-01 — the bounded runner: a platform-neutral watchdog for one device-driver invocation (Task Contract §9).
 *
 * A3-02 measured the failure: run `37232517476`, attempt 1, the iOS leg sat for the job's full 60 minutes
 * and was cancelled with no Product step evidence at all. A step `timeout-minutes` bounds the job, but it
 * kills without saying WHAT hung, and a dead driver is indistinguishable from a slow Product.
 *
 * This wraps ONE command. It uses Node alone — `timeout(1)` is GNU coreutils and absent on the macOS
 * runner — so the same line works on GitHub's Linux and macOS images. On expiry it:
 *
 *   1. prints `::error::` with the classification (default INFRASTRUCTURE) and the label;
 *   2. terminates the command's whole process group (SIGTERM, then SIGKILL after a grace period), so a
 *      Maestro JVM or a driver child cannot outlive it;
 *   3. writes `<out>/watchdog-<label>.txt` for the evidence upload;
 *   4. exits 124 (the conventional timeout status), never 0.
 *
 * A timeout is Validation / Infrastructure evidence, never a reason to edit Product code. It does not
 * retry anything: retrying is the human decision the retry budget (`retry-budget.mjs`) bounds.
 *
 * Usage:
 *   node scripts/validation/bounded-run.mjs --seconds 300 --label driver-readiness \
 *     [--classification INFRASTRUCTURE] [--out <dir>] -- <command> [args…]
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

export const TIMEOUT_EXIT_CODE = 124;
export const USAGE_EXIT_CODE = 2;

/** Parses argv. Pure, so the contract can exercise every refusal. */
export function parseArgs(argv) {
  const separator = argv.indexOf('--');
  if (separator < 0 || separator === argv.length - 1) return { error: 'a command is required after --' };
  const options = argv.slice(0, separator);
  const command = argv.slice(separator + 1);
  const flag = (name) => {
    const index = options.indexOf(`--${name}`);
    return index >= 0 ? options[index + 1] : undefined;
  };
  const seconds = Number(flag('seconds'));
  if (!Number.isFinite(seconds) || seconds <= 0) return { error: '--seconds must be a positive number' };
  const label = flag('label');
  if (!label || !/^[A-Za-z0-9_.-]+$/u.test(label)) return { error: '--label must be a plain identifier' };
  return {
    seconds,
    label,
    classification: flag('classification') ?? 'INFRASTRUCTURE',
    out: flag('out'),
    graceSeconds: Number(flag('grace-seconds') ?? 10),
    // A readiness probe's answer (a whole view hierarchy) is not evidence; only whether it came back is.
    quiet: options.includes('--quiet'),
    command,
  };
}

function killGroup(child, signal) {
  try {
    // A negative pid addresses the process group the detached child leads.
    process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* already gone */ }
  }
}

/** Runs the command under the bound. Resolves to `{ code, timedOut, elapsedSeconds }`. */
export function boundedRun({ seconds, label, classification = 'INFRASTRUCTURE', out, graceSeconds = 10, quiet = false, command }, io = process) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command[0], command.slice(1), {
      stdio: ['inherit', quiet ? 'ignore' : 'inherit', 'inherit'],
      detached: process.platform !== 'win32',
    });
    let timedOut = false;
    let killTimer = null;

    const timer = setTimeout(() => {
      timedOut = true;
      const line = `${classification}: ${label} exceeded its ${seconds}s bound and was terminated; no result from it is evidence`;
      io.stdout.write(`::error title=${classification} — ${label}::${line}\n`);
      if (out) {
        try {
          mkdirSync(out, { recursive: true });
          writeFileSync(join(out, `watchdog-${label}.txt`), `${line}\ncommand: ${command.join(' ')}\n`);
        } catch { /* the error annotation above already carries the classification */ }
      }
      killGroup(child, 'SIGTERM');
      killTimer = setTimeout(() => killGroup(child, 'SIGKILL'), graceSeconds * 1000);
    }, seconds * 1000);

    const finish = (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: timedOut ? TIMEOUT_EXIT_CODE : code, timedOut, elapsedSeconds: (Date.now() - started) / 1000 });
    };
    child.on('error', (error) => {
      io.stderr.write(`bounded-run: could not start ${command[0]}: ${error.message}\n`);
      finish(127);
    });
    child.on('exit', (code, signal) => finish(code ?? (signal ? 128 : 1)));
  });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(`bounded-run: ${parsed.error}\n`);
    process.exit(USAGE_EXIT_CODE);
  }
  const result = await boundedRun(parsed);
  process.exit(result.code);
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/validation/bounded-run.mjs')) {
  main();
}
