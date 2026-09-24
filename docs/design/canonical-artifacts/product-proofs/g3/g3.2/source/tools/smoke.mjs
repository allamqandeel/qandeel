// G3.1 smoke: every deterministic state in both languages enters without an error, and a quick PNG of each lands in
// <WORK>/smoke/<lang>/ for a look. Not a check — tools/checks.mjs is the verification.
// usage: node tools/smoke.mjs [ar|en] [STATE,STATE]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPage, WORK, settle, closeServers } from './lib/session.mjs';

const langs = process.argv[2] ? [process.argv[2]] : ['ar', 'en'];
for (const lang of langs) {
  const c = await openPage({ lang, cdpPort: 9441 });
  const dir = join(WORK, 'smoke', lang); mkdirSync(dir, { recursive: true });
  const states = process.argv[3] ? process.argv[3].split(',') : await c.eval('window.__G32.states');
  for (const st of states) {
    try {
      const t = await c.eval(`(window.__G32.clock(0), window.__G32.enter(${JSON.stringify(st)}))`);
      await c.eval(settle);
      writeFileSync(join(dir, `${st}.png`), await c.shot());
      console.log(lang, st, 'OK', t.place, t.TM, t.TC, 'LH', t.LH, 'call', t.call, 'offered', t.offered.join(','), 'rendered', t.rendered.join(','));
    } catch (e) { console.log(lang, st, 'FAIL', e.message); }
  }
  await c.close();
}
await closeServers();
