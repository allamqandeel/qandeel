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
// usage: node maestro-phases.mjs <maestro.log> [startEpochMs] [endEpochMs]
//   prints one line: key=value pairs (seconds with one decimal), for gate.log
import { readFileSync } from 'node:fs';
import process from 'node:process';

const LINE = /^(\d\d):(\d\d):(\d\d)\.(\d{3}) \[\s*([A-Z]+)\] (.*)$/u;

/** Parses the log text into the named instants (ms since UTC midnight of the log's day) plus tap evidence. Pure. */
export function readTimeline(text) {
  const out = { log0: null, selected: null, flow: null, devinfo: null, cmd0: null, last: null, lastCommand: null,
    tapDispatch: null, tapCompleted: false, tapStarted: false, failed: null };
  for (const raw of text.split(/\r?\n/u)) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const t = ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]);
    const msg = m[6];
    if (out.log0 === null) out.log0 = t;
    if (out.selected === null && /\bSelected device\b/u.test(msg)) out.selected = t;
    if (out.flow === null && /\bRunning flow\b/u.test(msg)) out.flow = t;
    if (out.devinfo === null && /\bGot device info\b/u.test(msg)) out.devinfo = t;
    const cmd = /runCommands\$lambda\$\d+: (.+) (RUNNING|COMPLETED|FAILED)$/u.exec(msg);
    if (cmd) {
      if (cmd[2] === 'RUNNING') {
        if (out.cmd0 === null) out.cmd0 = t;
        if (/^Tap on\b/u.test(cmd[1])) out.tapStarted = true;
      } else {
        out.last = t;
        out.lastCommand = `${cmd[1]} ${cmd[2]}`;
        if (cmd[2] === 'FAILED' && out.failed === null) out.failed = cmd[1];
        if (cmd[2] === 'COMPLETED' && /^Tap on\b/u.test(cmd[1])) out.tapCompleted = true;
      }
    }
    const tap = /(Tapping on element|Try tapping at \(\d+, \d+\))/u.exec(msg);
    if (tap) out.tapDispatch = `${raw.slice(0, 12)} ${tap[1]}`;
  }
  return out;
}

const s = (ms) => (ms === null || ms === undefined || Number.isNaN(ms) ? '' : (ms / 1000).toFixed(1));
const diff = (a, b) => (a === null || b === null ? null : b - a);

/** One line for gate.log. `start` / `end` are epoch ms from the caller (optional). Pure. */
export function phaseLine(timeline, start = null, end = null) {
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
  return `${fields.map(([k, v]) => `${k}=${s(v)}`).join(' ')} last="${t.lastCommand ?? 'none'}"${t.failed ? ` failed="${t.failed}"` : ''}${tap}`;
}

if (process.argv[1] && process.argv[1].replace(/\\/gu, '/').endsWith('maestro-phases.mjs')) {
  const [file, start, end] = process.argv.slice(2);
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { console.log('no maestro.log'); process.exit(0); }
  console.log(phaseLine(readTimeline(text), start ? Number(start) : null, end ? Number(end) : null));
}
