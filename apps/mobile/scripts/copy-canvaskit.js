/**
 * Puts CanvasKit's .wasm where the Expo web dev server can serve it.
 *
 * Skia has no JS fallback on web: without this file the thread layer renders nothing and
 * the failure is silent. The blob is ~8 MB, so it is copied out of node_modules at
 * prestart and git-ignored rather than committed.
 */
const fs = require('node:fs');
const path = require('node:path');

const source = require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
const targetDir = path.join(__dirname, '..', 'public');
const target = path.join(targetDir, 'canvaskit.wasm');

fs.mkdirSync(targetDir, { recursive: true });

const from = fs.statSync(source);
const to = fs.existsSync(target) ? fs.statSync(target) : null;
if (to && to.size === from.size) {
  process.stdout.write('canvaskit.wasm already in public/\n');
} else {
  fs.copyFileSync(source, target);
  process.stdout.write(`copied canvaskit.wasm (${from.size} bytes) to public/\n`);
}
