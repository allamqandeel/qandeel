#!/usr/bin/env node
// QAN-BL-CI-04 (PO, 2026-11-23): one Maestro call's own timeline, read from the debug log the call wrote
// (`--debug-output <dir>` → <dir>/maestro.log). It reads evidence only: it never decides a case.
//
// The phases are cut at lines Maestro cli-2.10.0 itself logs, in this order (maestro-cli TestCommand / TestRunner,
// maestro-orchestra Orchestra.runFlow):
//   start      the wall-clock instant the gate spawned the call (from the caller, epoch ms), when given
//   log0       the CLI's first log line (the JVM is up and the debug reporter installed)
//   selected   "Selected device …"   — after the device enumeration (Android AVDs and adb, simctl, devicectl), twice
//   flow       "Running flow …"
//   devinfo    "Got device info …"   — the XCTest driver answered POST /deviceInfo
//   cmd0       the first "… RUNNING" — Orchestra.runFlow has built its GraalJS engine (initJsEngine) by then
//   last       the last "… COMPLETED" / "… FAILED" line of a command
//   end        the wall-clock instant the call returned to the gate (epoch ms), when given
// Each phase is the difference of two of these instants. A missing line leaves its phase empty, never estimated.
//
// Tap dispatch evidence (where Maestro logs it): the last "Tapping on element" / "Try tapping at (x, y)" line, and
// whether a "Tap on …" command reached COMPLETED. A tap whose command never COMPLETED is NOT proven delivered.
//
// acted: "yes" when the flow's own commands all reached COMPLETED — as many as the flow file declares at its top level
// (Maestro's own "Define variables" / "Apply configuration" are not counted), none still in flight, none FAILED, SKIPPED
// or WARNED — so the step did its part even if the process then failed to exit. Maestro logs no "flow finished" line, so
// without the count a call stopped BETWEEN two commands would look complete; without a flow file, acted is never "yes".
// "no" when anything is missing; "none" when no command started. The gate FAILs a case on a missing UI effect only when
// its step exited 0 or acted=yes; otherwise the action itself is not proven and the case is NOT TESTED (INFRASTRUCTURE),
// never FAIL and never PASS.
//
// With a bound (seconds), the watchdog's SIGTERM instant is start + bound exactly (bounded-run.mjs arms one timer at the
// spawn); "after_term" is how long Maestro's own log went on after it (a dying JVM may still drive the device until
// SIGKILL, 10 s later), measured, not assumed.
//
// usage: node maestro-phases.mjs <maestro.log> [startEpochMs] [endEpochMs] [boundSeconds] [flow.yaml]
//   prints one line: key=value pairs (seconds with one decimal), for gate.log
import { readFileSync } from 'node:fs';
import process from 'node:process';

const LINE = /^(\d\d):(\d\d):(\d\d)\.(\d{3}) \[\s*([A-Z]+)\] (.*)$/u;
const COMMAND = /runCommands\$lambda\$\d+: (.+) (RUNNING|COMPLETED|FAILED|SKIPPED|WARNED)$/u;
// the commands Maestro adds to every flow (its -e variables and the flow's config), not the flow file's own
const ADDED_BY_MAESTRO = /^(Define variables|Apply configuration)$/u;

/** The number of top-level commands a flow file declares (its "- command" lines after the "---"). Pure. */
export function flowCommandCount(yaml) {
  const parts = yaml.split(/^---[ \t]*$/mu);
  if (parts.length < 2) return 0;
  return (parts.slice(1).join('\n').match(/^- \S/gmu) ?? []).length;
}

/** Parses the log text into the named instants (ms since UTC midnight of the log's day) plus tap evidence. Pure. */
export function readTimeline(text) {
  const out = { log0: null, selected: null, flow: null, devinfo: null, cmd0: null, last: null, lastCommand: null,
    tapDispatch: null, tapCompleted: false, tapStarted: false, failed: null, unfinished: null, started: 0, ended: 0,
    completedOwn: 0, inflight: null, lastLine: null };
  for (const raw of text.split(/\r?\n/u)) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const t = ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]);
    const msg = m[6];
    if (out.log0 === null) out.log0 = t;
    out.lastLine = t;
    if (out.selected === null && /\bSelected device\b/u.test(msg)) out.selected = t;
    if (out.flow === null && /\bRunning flow\b/u.test(msg)) out.flow = t;
    if (out.devinfo === null && /\bGot device info\b/u.test(msg)) out.devinfo = t;
    const cmd = COMMAND.exec(msg);
    if (cmd) {
      const [, name, state] = cmd;
      if (state === 'RUNNING') {
        if (out.cmd0 === null) out.cmd0 = t;
        out.started += 1;
        out.inflight = name;
        if (/^Tap on\b/u.test(name)) out.tapStarted = true;
      } else {
        out.ended += 1;
        out.inflight = null;
        out.last = t;
        out.lastCommand = `${name} ${state}`;
        if (state === 'FAILED' && out.failed === null) out.failed = name;
        if ((state === 'SKIPPED' || state === 'WARNED') && out.unfinished === null) out.unfinished = `${name} ${state}`;
        if (state === 'COMPLETED' && !ADDED_BY_MAESTRO.test(name)) out.completedOwn += 1;
        if (state === 'COMPLETED' && /^Tap on\b/u.test(name)) out.tapCompleted = true;
      }
    }
    const tap = /(Tapping on element|Try tapping at \(\d+, \d+\))/u.exec(msg);
    if (tap) out.tapDispatch = `${raw.slice(0, 12)} ${tap[1]}`;
  }
  return out;
}

const s = (ms) => (ms === null || ms === undefined || Number.isNaN(ms) ? '' : (ms / 1000).toFixed(1));
const diff = (a, b) => (a === null || b === null ? null : b - a);

/** "yes" | "no" | "none" — see the header. `expected` is flowCommandCount of the call's flow (null: unknown). Pure. */
export function acted(t, expected = null) {
  if (t.started === 0) return 'none';
  const finished = t.inflight === null && t.failed === null && t.unfinished === null && t.ended >= t.started;
  return finished && Number.isInteger(expected) && expected > 0 && t.completedOwn >= expected ? 'yes' : 'no';
}

/** One line for gate.log. `start` / `end` epoch ms (optional); `bound` seconds (optional); `expected` own commands. Pure. */
export function phaseLine(timeline, start = null, end = null, bound = null, expected = null) {
  const day = (epoch) => (epoch === null ? null : epoch % 86_400_000);
  const t = timeline;
  const startDay = day(start);
  const endDay = day(end);
  const fields = [
    ['jvm', diff(startDay, t.log0)],
    ['enumerate', diff(t.log0, t.selected)],
    ['session', diff(t.selected, t.flow)],
    ['deviceinfo', diff(t.flow, t.devinfo)],
    ['engine', diff(t.devinfo, t.cmd0)],
    ['commands', diff(t.cmd0, t.last)],
    ['after', diff(t.last, endDay)],
    ['total', diff(startDay, endDay)],
  ];
  const tap = t.tapStarted
    ? ` tap=${t.tapCompleted ? 'COMPLETED' : 'NOT-COMPLETED'}${t.tapDispatch ? ` dispatch="${t.tapDispatch}"` : ' dispatch=none-logged'}`
    : '';
  const term = startDay === null || bound === null ? null : startDay + bound * 1000;
  const killed = end !== null && start !== null && bound !== null && end - start >= bound * 1000;
  const termText = killed ? ` after_term=${s(diff(term, t.lastLine))}` : '';
  return `${fields.map(([k, v]) => `${k}=${s(v)}`).join(' ')} acted=${acted(t, expected)} own=${t.completedOwn}/${expected ?? '?'}`
    + `${t.inflight ? ` inflight="${t.inflight}"` : ''}${t.unfinished ? ` unfinished="${t.unfinished}"` : ''}`
    + ` last="${t.lastCommand ?? 'none'}"${t.failed ? ` failed="${t.failed}"` : ''}${tap}${termText}`;
}

if (process.argv[1] && process.argv[1].replace(/\\/gu, '/').endsWith('maestro-phases.mjs')) {
  const [file, start, end, bound, flow] = process.argv.slice(2);
  let expected = null;
  try { if (flow) expected = flowCommandCount(readFileSync(flow, 'utf8')); } catch { expected = null; }
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { console.log(`acted=none own=0/${expected ?? '?'} no-maestro-log`); process.exit(0); }
  const num = (v) => (v ? Number(v) : null);
  console.log(phaseLine(readTimeline(text), num(start), num(end), num(bound), expected));
}
