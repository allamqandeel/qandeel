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
 * `--fail-fast <signature>` (opt-in; ACCT-DEL-01 CI-iOS correction) names ONE entry of FAIL_FAST_SIGNATURES:
 * a failure whose evidence is already complete, after which the command is known to hang rather than exit.
 * On the signature's exact lines, the runner does steps 1–3 above without waiting for the bound, then exits
 * FAIL_FAST_EXIT_CODE, never 0. Only the named signature matches. No free pattern can be passed, so an
 * unrelated HTTP 500 or an app assertion is never reclassified. Without the flag the runner's streams and
 * behaviour are exactly as before.
 *
 * Usage:
 *   node scripts/validation/bounded-run.mjs --seconds 300 --label driver-readiness \
 *     [--classification INFRASTRUCTURE] [--out <dir>] [--fail-fast <signature>] -- <command> [args…]
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

export const TIMEOUT_EXIT_CODE = 124;
export const FAIL_FAST_EXIT_CODE = 125;
export const USAGE_EXIT_CODE = 2;

/**
 * The closed set of fail-fast signatures. Each one is a `header` line and a `frame` line that must follow it within
 * `window` lines, matched after ANSI colour codes are removed.
 *
 * `maestro-xctest-device-info-500`: Maestro cli-2.10.0's CLI main thread dies of an uncaught
 * `UnknownFailure` when the XCTest driver answers HTTP 500 to `POST /deviceInfo`, the call `Maestro.cachedDeviceInfo`
 * makes before the first flow step (the driver's handler gives up after its own 100 s). The JVM then does not exit:
 * the driver's `xcodebuild` child and the client threads keep it alive until the outer bound kills it
 * (run `39047797516`: the exception at 16:42:31, the 780 s bound at 16:51:47). Both lines are Maestro's own:
 * the driver URL on the loopback and the `xcuitest.XCTestDriverClient.deviceInfo` frame.
 */
export const FAIL_FAST_SIGNATURES = Object.freeze({
  'maestro-xctest-device-info-500': Object.freeze({
    header: /^Exception in thread "main" UnknownFailure\(errorResponse=Request for http:\/\/127\.0\.0\.1:\d+\/deviceInfo failed, code: 500\b/u,
    frame: /^\s*at xcuitest\.XCTestDriverClient\.deviceInfo\(/u,
    window: 20,
    reason: 'the Maestro CLI main thread died on the XCTest driver answering HTTP 500 to /deviceInfo',
  }),
});

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/gu;

/** A line scanner for one signature. Pure, so the contract can feed it any transcript. */
export function signatureScanner(name) {
  const signature = FAIL_FAST_SIGNATURES[name];
  if (!signature) throw new Error(`unknown fail-fast signature ${name}`);
  let sinceHeader = -1;
  return (rawLine) => {
    const line = rawLine.replace(ANSI, '');
    if (signature.header.test(line)) {
      sinceHeader = 0;
      return false;
    }
    if (sinceHeader < 0) return false;
    sinceHeader += 1;
    if (signature.frame.test(line)) return true;
    if (sinceHeader >= signature.window) sinceHeader = -1;
    return false;
  };
}

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
  const failFast = flag('fail-fast');
  if (options.includes('--fail-fast') && !Object.hasOwn(FAIL_FAST_SIGNATURES, failFast ?? '')) {
    return { error: `--fail-fast must name one of: ${Object.keys(FAIL_FAST_SIGNATURES).join(', ')}` };
  }
  return {
    seconds,
    label,
    classification: flag('classification') ?? 'INFRASTRUCTURE',
    out: flag('out'),
    graceSeconds: Number(flag('grace-seconds') ?? 10),
    // A readiness probe's answer (a whole view hierarchy) is not evidence; only whether it came back is.
    quiet: options.includes('--quiet'),
    failFast,
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

/** Runs the command under the bound. Resolves to `{ code, timedOut, failedFast, elapsedSeconds }`. */
export function boundedRun({ seconds, label, classification = 'INFRASTRUCTURE', out, graceSeconds = 10, quiet = false, failFast, command }, io = process) {
  return new Promise((resolve) => {
    const started = Date.now();
    // Without --fail-fast the streams are exactly what they always were. With it, both are piped so the signature can
    // be seen, and forwarded unchanged; a --quiet probe still forwards nothing from stdout.
    const stdout = failFast ? 'pipe' : (quiet ? 'ignore' : 'inherit');
    const child = spawn(command[0], command.slice(1), {
      stdio: ['inherit', stdout, failFast ? 'pipe' : 'inherit'],
      detached: process.platform !== 'win32',
    });
    let timedOut = false;
    let failedFast = false;
    let killTimer = null;

    // Steps 1–3 of the header: classify, write the evidence file, end the whole process group.
    const terminate = (line) => {
      io.stdout.write(`::error title=${classification} — ${label}::${line}\n`);
      if (out) {
        try {
          mkdirSync(out, { recursive: true });
          writeFileSync(join(out, `watchdog-${label}.txt`), `${line}\ncommand: ${command.join(' ')}\n`);
        } catch { /* the error annotation above already carries the classification */ }
      }
      killGroup(child, 'SIGTERM');
      killTimer = setTimeout(() => killGroup(child, 'SIGKILL'), graceSeconds * 1000);
    };

    const timer = setTimeout(() => {
      if (failedFast) return;
      timedOut = true;
      terminate(`${classification}: ${label} exceeded its ${seconds}s bound and was terminated; no result from it is evidence`);
    }, seconds * 1000);

    if (failFast) {
      const matches = signatureScanner(failFast);
      const watch = (stream, sink) => {
        let pending = '';
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => {
          if (sink) sink.write(chunk);
          pending += chunk;
          const lines = pending.split('\n');
          pending = lines.pop();
          for (const line of lines) {
            if (failedFast || timedOut || !matches(line.replace(/\r$/u, ''))) continue;
            failedFast = true;
            const elapsed = Math.round((Date.now() - started) / 1000);
            terminate(`${classification}: ${label} — ${FAIL_FAST_SIGNATURES[failFast].reason} (signature ${failFast}); `
              + `its process group was terminated after ${elapsed}s without waiting for the ${seconds}s bound; `
              + 'the run stays failed and no result from it is evidence');
          }
        });
      };
      watch(child.stdout, quiet ? null : io.stdout);
      watch(child.stderr, io.stderr);
    }

    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      // A fail-fast stop must leave nothing behind: whatever in the group outlived SIGTERM (an `xcodebuild` the JVM
      // started) is killed now, before this runner exits and the pending SIGKILL timer would die with it.
      if (failedFast) killGroup(child, 'SIGKILL');
      const result = failedFast ? FAIL_FAST_EXIT_CODE : (timedOut ? TIMEOUT_EXIT_CODE : code);
      resolve({ code: result, timedOut, failedFast, elapsedSeconds: (Date.now() - started) / 1000 });
    };
    child.on('error', (error) => {
      io.stderr.write(`bounded-run: could not start ${command[0]}: ${error.message}\n`);
      finish(127);
    });
    child.on('exit', (code, signal) => {
      const status = code ?? (signal ? 128 : 1);
      if (!failFast) {
        finish(status);
        return;
      }
      // The last lines a dying command wrote may still sit in the pipes when 'exit' fires. Read them before
      // deciding, so a signature printed just before an exit is never lost. The wait is short and bounded,
      // because a grandchild could hold a pipe open.
      let open = 2;
      const flushed = setTimeout(() => finish(status), 2000);
      const ended = () => {
        open -= 1;
        if (open === 0) {
          clearTimeout(flushed);
          finish(status);
        }
      };
      for (const stream of [child.stdout, child.stderr]) {
        if (stream.readableEnded) ended(); else stream.once('end', ended);
      }
    });
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
