// S8B-07 CP2-A.1 iOS Replay gate: the timing of each command of one Maestro flow, from its flattened debug output
// (`--debug-output <dir> --flatten-debug-output`: <dir>/commands-*.json). One line per command — its kind, its status,
// its start relative to the flow's first command and its duration, in ms — or "unreadable" when Maestro wrote nothing
// this script recognises. Only command kinds, statuses and times are printed: no hierarchy, no label, no screen content.
//
// usage: node maestro-timing.mjs <debug dir>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
let entries = [];
try {
  for (const name of readdirSync(dir).filter((n) => /^commands-.*\.json$/u.test(n)).sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    if (Array.isArray(parsed)) entries = entries.concat(parsed);
  }
} catch {
  entries = [];
}
const rows = entries.flatMap((entry) => {
  const meta = entry?.metadata;
  const command = entry?.command;
  if (meta === undefined || command === null || typeof command !== 'object' || typeof meta.timestamp !== 'number') return [];
  const kind = Object.keys(command).find((key) => command[key] !== null && command[key] !== undefined) ?? '?';
  return [{ kind: kind.replace(/Command$/u, ''), status: String(meta.status ?? '?'), at: meta.timestamp, ms: typeof meta.duration === 'number' ? meta.duration : null }];
});
if (rows.length === 0) {
  console.log('unreadable');
} else {
  const t0 = rows[0].at;
  for (const r of rows) console.log(`${r.kind} ${r.status} +${r.at - t0} ms ${r.ms === null ? '-' : `${r.ms} ms`}`);
}
