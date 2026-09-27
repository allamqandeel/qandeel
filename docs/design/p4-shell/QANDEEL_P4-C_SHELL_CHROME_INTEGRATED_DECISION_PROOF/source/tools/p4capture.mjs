// P4-C — renders the capture plan (tools/shots.mjs) in headless Chrome at 2×, and records what each capture SHOWS:
// its declared state, and the measured geometry the boards and the checks read (upper chrome, Personal row, switcher,
// «سياق الكلام», G3.2's own rects and room). Output: WORK/shots/<id>.png, data/SHOTS.json, and captures/<id>.png for KEEP.
//   node source/tools/p4capture.mjs [--only id,id]
import { writeFileSync, readFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openState, shotPhone, kbdFocus, closeBrowser, closeServers, WORK, PKG, sleep } from './lib/session.mjs';
import { SHOTS, KEEP } from './shots.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const SHOTDIR = join(WORK, 'shots');
mkdirSync(SHOTDIR, { recursive: true });

const MEASURE = `(()=>{const g=P4.g32();return {phone:{dir:document.getElementById('phone').dir,lang:document.getElementById('phone').lang,appearance:document.getElementById('phone').dataset.appearance,
  surface:document.getElementById('phone').dataset.surface,s:P4.P.s,u:P4.P.u,q:P4.P.q,sw:P4.P.sw,x:P4.P.x,direction:P4.P.dir,defect:P4.P.defect},
  hdr:P4.hdr(),prow:P4.prow(),conv:P4.conv(),rail:P4.rail('#phone .rail'),qs:P4.qs().map(q=>({where:q.where,x:q.x,y:q.y,w:q.w,h:q.h})),ctx:P4.ctx(),
  g32:g?{state:g.state,place:g.place,call:g.call,TM:g.TM,room:g.room,shellDark:g.shellDark,rects:g.rects}:null,
  controls:P4.controls().map(c=>({id:c.id,entry:c.entry,nav:c.nav,name:c.name,x:c.x,y:c.y,w:c.w,h:c.h}))}})()`;

const out = [];
for (const s of SHOTS) {
  if (only && !only.includes(s.id)) continue;
  const c = await openState({ state: s.state, lang: s.lang, appearance: s.appearance, contrast: s.contrast, w: s.w, h: s.h, q: s.q });
  if (s.focus) { const ok = await kbdFocus(c, s.focus); if (!ok) throw new Error(`${s.id}: focus target ${s.focus} not found`); await sleep(80); }
  const png = await shotPhone(c);
  writeFileSync(join(SHOTDIR, s.id + '.png'), png);
  const m = await c.eval(MEASURE);
  if (s.focus) m.focused = await c.eval(`(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();return {id:a.id||a.dataset.nav||a.dataset.entry||'',name:(a.getAttribute('aria-label')||a.textContent||'').trim(),x:r.x,y:r.y,w:r.width,h:r.height,ring:getComputedStyle(a).boxShadow!=='none'}})()`);
  out.push({ ...s, png: `${s.id}.png`, bytes: png.length, sha256: sha(png), measured: m });
  process.stdout.write('.');
}
await closeBrowser(); await closeServers();
{
  mkdirSync(join(PKG, 'data'), { recursive: true });
  // --only merges the re-captured entries into the existing record, in plan order
  const prev = only ? JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')).shots : [];
  const byId = Object.fromEntries([...prev, ...out].map((s) => [s.id, s]));
  const all = SHOTS.map((s) => byId[s.id]).filter(Boolean);
  writeFileSync(join(PKG, 'data', 'SHOTS.json'), JSON.stringify({ note: 'Every Product capture: its declared state and what the page measured while it was taken. PNGs at 2× in WORK/shots; the KEEP subset is in captures/.', count: all.length, shots: all }, null, 1) + '\n');
  const cap = join(PKG, 'captures');
  mkdirSync(cap, { recursive: true });
  for (const f of readdirSync(cap)) rmSync(join(cap, f));
  for (const id of KEEP) copyFileSync(join(SHOTDIR, id + '.png'), join(cap, id + '.png'));
}
console.log(`\ncaptured ${out.length}`);
