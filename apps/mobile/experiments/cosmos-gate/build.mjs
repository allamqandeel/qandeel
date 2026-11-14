// Bundles the preview into ONE self-contained HTML file. Usage: node build.mjs <esbuild-module-dir> <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const esbuild = createRequire(join(process.argv[2], 'x.js'))('esbuild');
const out = await esbuild.build({ entryPoints: [join(here, 'main.ts')], bundle: true, write: false, format: 'iife', target: 'es2020', minify: true, legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
writeFileSync(process.argv[3], readFileSync(join(here, 'shell.html'), 'utf8').replace('/*BUNDLE*/', () => js));
console.log('bundle bytes', js.length);
