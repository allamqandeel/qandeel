// G3.2 pipeline: build → the G3.1 baseline reproduced from its sealed inputs → Product snapshots (G3.2 and the G3.1
// twins) → motion journeys → the live real-input run → boards → planted-defect probes → checks. One log
// (<WORK>/pipeline.log); stops at the first failure.
// usage: node tools/pipeline.mjs [--from <step>] [--until <step>]
//   steps: build upstream snaps clips live boards probes checks
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE, WORK } from './lib/session.mjs';

const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const FROM = arg('--from'), UNTIL = arg('--until');
const LOG = join(WORK, 'pipeline.log');
writeFileSync(LOG, 'G3.2 pipeline\n');
const STEPS = [
  ['build', ['src/build.mjs']],
  ['upstream', ['tools/upstream.mjs']],
  ['snaps', ['tools/capture.mjs', 'snaps']],
  ['clips', ['tools/capture.mjs', 'clips']],
  ['live', ['tools/livecheck.mjs']],
  ['boards', ['tools/boards.mjs']],
  ['probes', ['tools/probes.mjs']],
  ['checks', ['tools/checks.mjs']],
];
let on = !FROM;
for (const [name, cmd] of STEPS) {
  if (name === FROM) on = true;
  if (!on) continue;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, cmd, { cwd: SOURCE, encoding: 'utf8', maxBuffer: 1 << 28, env: process.env });
  appendFileSync(LOG, `\n== ${name} (${Math.round((Date.now() - t0) / 1000)} s, exit ${r.status})\n${(r.stdout || '').split('\n').slice(-60).join('\n')}\n${r.stderr || ''}`);
  console.log(`${name}: exit ${r.status} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (r.status !== 0) { appendFileSync(LOG, `\nPIPELINE FAILED at ${name}\n`); process.exit(1); }
  if (name === UNTIL) { appendFileSync(LOG, `\nSTOPPED AFTER ${name}\n`); process.exit(0); }
}
appendFileSync(LOG, '\nPIPELINE DONE\n');
