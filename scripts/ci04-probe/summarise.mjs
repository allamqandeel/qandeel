// CI-04 probe: medians per load x variant of each phase in calls.tsv (measurement only).
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const groups = new Map();
for (const [load, v, , rc, wall, ph] of rows) {
  const k = `${load} ${v}`; const g = groups.get(k) ?? { n: 0, fail: 0, wall: [], ph: {} }; groups.set(k, g);
  g.n += 1; if (rc !== '0') g.fail += 1; g.wall.push(Number(wall));
  for (const m of ph.matchAll(/(\w+)=([\d.]+)(?=\s|$)/g)) (g.ph[m[1]] ??= []).push(Number(m[2]));
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const keys = ['jvm', 'enumerate', 'session', 'deviceinfo', 'engine', 'commands', 'after', 'total'];
console.log(['load variant', 'n', 'nonzero', 'wall(med)', 'wall(range)', ...keys.map((k) => `${k}(med)`)].join('\t'));
for (const [k, g] of [...groups].sort()) console.log([k, g.n, g.fail, med(g.wall), `${Math.min(...g.wall)}..${Math.max(...g.wall)}`, ...keys.map((x) => (g.ph[x] ? med(g.ph[x]).toFixed(1) : ''))].join('\t'));
