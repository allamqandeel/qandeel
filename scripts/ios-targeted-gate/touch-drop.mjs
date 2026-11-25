#!/usr/bin/env node
// INTEL-LIVE-01 CP1 — the iOS Targeted Gate's ONE infrastructure-recovery exception for ITG-02 (PO, 2026-11-25, option 1).
// VALIDATION ONLY. It decides whether a failed call-entry tap is the simulator's own touch drop, and nothing else.
//
// usage: node touch-drop.mjs <backboardd-touch-log> <server-events.jsonl> <since-epoch-ms> <proof-state.json>
//
// Runs 45612961224 and 45630621237: the XCTest synthetic tap's touch-down reached backboardd ("contact 2 presence:
// touching"), every later event of that path was dropped ("didn't see a previous touch down or range-in event for
// pathIndex:2; skipping event"), and when the synthetic digitizer detached the contact was still touching, so the
// simulator cancelled it ("cancel -- digitizer did disappear", "canceling paths contacts: [pathIndex: 2; … touching"). The
// app received a cancelled touch, never a tap. Every tap that worked shows the touch-up ("presence: none") instead.
//
// Exit 0 (and one JSON line) only when ALL of these hold; anything else, an unreadable input included, exits 1:
//   T1  exactly one touch path was touched in the window (the one tap);
//   T2  at least one later event of that path was dropped;
//   T3  that path never lifted (no "presence: none"): the tap did not complete;
//   T4  after its touch-down, the digitizer disappeared and the simulator cancelled that path while it was touching;
//   S1  the server holds no call at all;
//   S2  no call initiation reached the server since the tap began: no `/voice/calls` request, no CALL_ACTIVATED.
import { readFileSync } from 'node:fs';

const [touchLog, eventsFile, sinceArg, stateFile] = process.argv.slice(2);
const verdict = (confirmed, detail) => {
  process.stdout.write(`${JSON.stringify({ confirmed, ...detail })}\n`);
  process.exit(confirmed ? 0 : 1);
};
if (!touchLog || !eventsFile || !stateFile || !/^\d+$/u.test(sinceArg ?? '')) verdict(false, { reason: 'usage' });

let lines;
let events;
let state;
try {
  lines = readFileSync(touchLog, 'utf8').split('\n');
  events = readFileSync(eventsFile, 'utf8').split('\n').flatMap((l) => { try { return l.trim() ? [JSON.parse(l)] : []; } catch { return []; } });
  state = JSON.parse(readFileSync(stateFile, 'utf8'));
} catch (error) {
  verdict(false, { reason: `an input could not be read: ${error.message}` });
}
const since = Number(sinceArg);

const touched = [];
lines.forEach((line, at) => {
  const m = /contact (\d+) presence: touching/u.exec(line);
  if (m) touched.push({ path: m[1], at });
});
if (touched.length !== 1) verdict(false, { reason: `T1: ${touched.length} touch paths were touched in the window, not exactly one` });
const { path, at: downAt } = touched[0];
const after = lines.slice(downAt + 1);
const time = (line) => (/(\d{2}:\d{2}:\d{2}\.\d+)/u.exec(line) ?? [null, null])[1];
const dropped = after.filter((l) => l.includes(`didn't see a previous touch down or range-in event for pathIndex:${path}; skipping event`));
if (dropped.length === 0) verdict(false, { reason: `T2: no event of path ${path} was dropped` });
if (lines.some((l) => l.includes(`contact ${path} presence: none`))) verdict(false, { reason: `T3: path ${path} lifted: the tap completed` });
const disappeared = after.findIndex((l) => l.includes('cancel -- digitizer did disappear'));
const cancelled = after.findIndex((l) => l.includes(`canceling paths contacts: [pathIndex: ${path};`) && /touching/u.test(l.slice(l.indexOf(`pathIndex: ${path};`))));
if (disappeared < 0 || cancelled < 0) verdict(false, { reason: `T4: the digitizer's disappearance and the cancellation of touching path ${path} were not both logged after its touch-down` });

if (state === null || typeof state !== 'object' || state.call !== null) verdict(false, { reason: 'S1: the server holds a call (or its state was unreadable)' });
const initiation = events.filter((e) => Number(e.at) >= since
  && ((e.kind === 'http' && typeof e.path === 'string' && e.path.startsWith('/voice/calls')) || (e.kind === 'KICK' && e.reason === 'CALL_ACTIVATED')));
if (initiation.length > 0) verdict(false, { reason: `S2: a call initiation reached the server (${initiation.map((e) => e.path ?? e.reason).join(', ')})` });

verdict(true, {
  path: Number(path),
  touchedAt: time(lines[downAt]),
  dropped: dropped.length,
  cancelledAt: time(after[cancelled]),
  detail: `path ${path} touched at ${time(lines[downAt])}, ${dropped.length} later events dropped, never lifted, cancelled at ${time(after[cancelled])} when the digitizer disappeared; the server holds no call and saw no call initiation`,
});
