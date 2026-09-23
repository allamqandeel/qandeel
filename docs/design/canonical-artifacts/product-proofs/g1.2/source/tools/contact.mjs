// Review aid (not shipped): contact sheets of the captured screens, 10 per sheet, to eyeball every state.
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCR = join(HERE, '..', 'out', 'screens');
const OUT = join(HERE, '..', 'out', 'contact');
mkdirSync(OUT, { recursive: true });
const filter = process.argv[2] || '';
const names = readdirSync(SCR).filter((f) => f.endsWith('.png') && f.includes(filter)).sort();
const b = await launch({ port: 9460 });
try {
  for (let i = 0; i < names.length; i += 10) {
    const set = names.slice(i, i + 10);
    const html = `<!doctype html><body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:1600px;font:12px system-ui;color:#ddd">` +
      set.map((n) => `<figure style="margin:0;width:308px"><img src="file:///${join(SCR, n).replace(/\\/g, '/')}" width="308"><figcaption>${n}</figcaption></figure>`).join('') + '</body>';
    const f = join(OUT, `sheet-${String(i / 10).padStart(2, '0')}.html`); writeFileSync(f, html);
    await b.viewport({ width: 1600, height: 1400, dpr: 1, mobile: false });
    await b.goto('file:///' + f.replace(/\\/g, '/'));
    await b.eval(`Promise.all([...document.images].map(i=>i.decode()))`);
    const h = await b.eval(`Math.ceil(document.body.getBoundingClientRect().height)`);
    await b.viewport({ width: 1600, height: h, dpr: 1, mobile: false });
    writeFileSync(f.replace('.html', '.png'), await b.shot());
  }
} finally { await b.close(); }
console.log(names.length, 'screens');
