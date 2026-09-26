// P3-A — regenerates the whole package from source, in order: build → captures + clips → boards (+ M06) → checks.
// The manifest and the review ZIP are a separate, final step (tools/p3package.mjs).
//   node source/tools/p3pipeline.mjs [--no-git]
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (file, ...args) => {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(HERE, ...file.split('/')), ...args], { stdio: 'inherit' });
  console.log(`— ${file} ${args.join(' ')}: exit ${r.status} in ${Math.round((Date.now() - t0) / 1000)} s`);
  return r.status;
};
if (run('../src/build.mjs') !== 0) process.exit(1);
if (run('p3capture.mjs', 'all') !== 0) process.exit(1);
if (run('p3boards.mjs') !== 0) process.exit(1);
if (run('p3copy.mjs') !== 0) process.exit(1);
process.exit(run('p3checks.mjs', ...process.argv.slice(2)));
