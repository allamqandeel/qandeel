// SE-FU-1 (VALIDATION ONLY, never merged): symbolicate macOS `sample` output for the app's own image with `atos` and the
// build's dSYM. `sample` prints an unsymbolicated frame of a stripped image as
//   ???  (in QANDEEL)  load address 0x104a1c000 + 0x2f3e4  [0x104a4b3e4]
// Every such address is resolved in one batched `atos` call per load address, and the line is rewritten in place.
// usage: node sample-symbolicate.mjs <dwarf binary> <image name> <sample.txt>...
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const [dwarf, image, ...files] = process.argv.slice(2);
const re = new RegExp(String.raw`\?\?\?\s+\(in ${image}\)\s+load address (0x[0-9a-f]+) \+ 0x[0-9a-f]+\s+\[(0x[0-9a-f]+)\]`, 'g');
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const byLoad = new Map();
  for (const m of text.matchAll(re)) {
    if (!byLoad.has(m[1])) byLoad.set(m[1], new Set());
    byLoad.get(m[1]).add(m[2]);
  }
  const names = new Map();
  for (const [load, set] of byLoad) {
    const addrs = [...set];
    for (let i = 0; i < addrs.length; i += 400) {
      const chunk = addrs.slice(i, i + 400);
      let out = '';
      try { out = execFileSync('xcrun', ['atos', '-o', dwarf, '-arch', 'arm64', '-l', load, ...chunk], { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch { continue; }
      out.split('\n').forEach((line, k) => { if (k < chunk.length && line.trim() !== '' && !line.startsWith('0x')) names.set(chunk[k], line.trim()); });
    }
  }
  const rewritten = text.replace(re, (whole, _load, addr) => (names.has(addr) ? `${names.get(addr)}  (in ${image})  [${addr}]` : whole));
  fs.writeFileSync(file, rewritten);
  console.log(`${file}: ${names.size} of ${[...byLoad.values()].reduce((n, s) => n + s.size, 0)} ${image} addresses symbolicated`);
}
