// P4-C — the whole deterministic pipeline, in order. The checks run three times on purpose: once to measure the world
// cost the matrix classifies, once with the matrix present (the boards print that summary), and once last, after the
// boards and documents exist, so the label / link scans see the final package.
//   node source/tools/p4pipeline.mjs [--skip-capture]
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (f, ...a) => { console.log(`\n== ${f} ${a.join(' ')}`); execFileSync(process.execPath, [join(HERE, f), ...a], { stdio: 'inherit' }); };
const soft = (f, ...a) => { try { run(f, ...a); } catch { console.log(`(${f}: failures expected before the matrix exists)`); } };
run('../src/build.mjs');
if (!process.argv.includes('--skip-capture')) run('p4capture.mjs');
soft('p4checks.mjs');
run('p4matrix.mjs');
run('p4package.mjs');   // a first seal, so every link resolves (MANIFEST.json included) before the boards print the check summary
run('p4checks.mjs');
run('p4boards.mjs');
run('p4package.mjs');
run('p4checks.mjs');
run('p4package.mjs');   // the final seal covers the final CHECKS.json
