// P4-C3 — the whole deterministic pipeline, in order. The checks run before the boards (the boards print their
// summary) and once more at the end, after the boards and documents exist.
//   node source/tools/c3pipeline.mjs [--skip-capture] [--no-git]
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const pass = process.argv.includes('--no-git') ? ['--no-git'] : [];
const run = (f, ...a) => { console.log(`\n== ${f} ${a.join(' ')}`); execFileSync(process.execPath, [join(HERE, f), ...a], { stdio: 'inherit' }); };
run('../src/build.mjs');
run('c3copytable.mjs');
if (!process.argv.includes('--skip-capture')) run('c3capture.mjs');
run('c3package.mjs');     // a first seal, so C-PROV-3 and every link resolve
run('c3checks.mjs', ...pass);
run('c3boards.mjs');
run('c3package.mjs');
run('c3checks.mjs', ...pass);
run('c3package.mjs');     // the final seal covers the final CHECKS.json
