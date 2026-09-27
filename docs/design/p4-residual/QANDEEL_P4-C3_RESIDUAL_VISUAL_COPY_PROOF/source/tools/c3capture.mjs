// P4-C3 — renders the capture plan (tools/shots.mjs) in headless Chrome at 2× and records what each capture SHOWS: its
// declared state and what the page measured while it was taken (call identity, the voice turn's geometry, every
// registered string and accessible name, every control). Journeys are driven by REAL pointer input (no scripted
// .click()). Output: WORK/shots/<id>.png, data/SHOTS.json, and captures/<id>.png for KEEP.
//   node source/tools/c3capture.mjs [--only id,id]
import { writeFileSync, readFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openState, shotPhone, kbdFocus, realClick, closeBrowser, closeServers, WORK, PKG, sleep } from './lib/session.mjs';
import { SHOTS, KEEP } from './shots.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const SHOTDIR = join(WORK, 'shots');
mkdirSync(SHOTDIR, { recursive: true });

export const MEASURE = `(()=>{const ph=document.getElementById('phone');const cl=[...document.querySelectorAll('.callline')].find(e=>C3.visible(e))||null;const R=(e)=>e?C3.rectOf(e):null;
  const vn=[...document.querySelectorAll('.vn')].map(v=>({id:v.id,play:v.dataset.play,rect:R(v),bg:getComputedStyle(v).backgroundColor,radii:['borderStartStartRadius','borderStartEndRadius','borderEndStartRadius','borderEndEndRadius'].map(k=>getComputedStyle(v)[k]),
    done:R(v.querySelector('.done')),doneVisible:C3.visible(v.querySelector('.done')),doneH:parseFloat(getComputedStyle(v.querySelector('.done')).height),restH:parseFloat(getComputedStyle(v.querySelector('.rest')).height),pos:!!v.querySelector('.pos')&&C3.visible(v.querySelector('.pos')),
    time:v.querySelector('.vtime').textContent,name:v.getAttribute('aria-label'),svgPaths:v.querySelectorAll('svg path,svg rect,svg polyline').length,extraSvg:v.querySelectorAll('svg:not(.vplay svg)').length-v.querySelectorAll('.vplay svg').length}));
  const crec=[...document.querySelectorAll('.crec')].map(c=>({id:c.id,rect:R(c),buttons:c.querySelectorAll('button').length,text:c.textContent.trim(),name:c.getAttribute('aria-label'),next:c.nextElementSibling?(c.nextElementSibling.dataset.transcript||''):''}));
  return {phone:{dir:ph.dir,lang:ph.lang,appearance:ph.dataset.appearance,place:ph.dataset.place,call:ph.dataset.call,contrast:ph.dataset.contrast,rm:ph.dataset.rm,textsize:ph.dataset.textsize,defect:ph.dataset.defect},
    call:cl?{id:cl.dataset.callId,muted:cl.dataset.muted,route:cl.dataset.route,elapsed:cl.querySelector('.celapsed').textContent,visibleText:[...cl.querySelectorAll('*')].filter(e=>C3.visible(e)&&!e.children.length&&!e.closest('.sr')&&e.textContent.trim()).map(e=>e.textContent.trim()),rect:R(cl),
      mute:cl.querySelector('#c-mute').getAttribute('aria-pressed'),glyphs:{end:cl.querySelector('#c-end').innerHTML,mute:cl.querySelector('#c-mute').innerHTML,route:cl.querySelector('#c-route').innerHTML}}:null,
    g32:C3.g32(),g32Composer:(()=>{const d=C3.frameDoc();if(!d)return null;const e=d.getElementById('composer');return e?{visibility:getComputedStyle(e).visibility,inert:e.hasAttribute('inert')}:null})(),
    vn,crec,texts:C3.texts(),names:C3.names(),controls:C3.controls(),
    launch:(()=>{const l=document.querySelector('.launch');if(!l)return null;return {owner:l.dataset.owner,surface:l.dataset.surface,children:[...l.children].map(c=>c.className||c.tagName),text:[...l.querySelectorAll('*')].filter(e=>!e.closest('.status')&&e.textContent.trim()).length,bg:getComputedStyle(l).backgroundColor,icon:(()=>{const m=l.querySelector('.asplash .mask');return m?{rect:R(m),box:R(l.querySelector('.asplash')),src:l.querySelector('img').src.length,bg:getComputedStyle(m).backgroundColor}:null})(),minDuration:l.dataset.minDurationMs||null}})()}})()`;

async function waitFor(c, expr, ms = 60000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await c.eval(expr)) return true; await sleep(100); } throw new Error('timed out waiting for ' + expr); }
async function settle(c) {
  // the Analysis overlay follows G3.2's own boxes: wait until a live call's line (if any) and the switcher stand in them
  await waitFor(c, `(()=>{const p=document.getElementById('phone');if(p.dataset.place!=='analysis')return true;const f=C3.frameDoc();if(!f||!window.C3.g32())return false;return !!document.getElementById('arail')&&(p.dataset.call!=='live'||!!document.getElementById('acall'))})()`);
  await sleep(700);
}
export async function runJourney(c, steps) {
  for (const [op, arg] of steps) {
    if (op === 'click') { await realClick(c, arg); await sleep(200); await settle(c); }
    else if (op === 'frameClick') {
      const r = await c.eval(`(()=>{const d=C3.frameDoc();const e=d&&d.querySelector(${JSON.stringify(arg)});if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
      if (!r) throw new Error('no frame element ' + arg);
      await c.click(r.x, r.y); await sleep(200); await settle(c);
    } else if (op === 'advance') { await c.eval(`C3.advance(${arg})`); await sleep(120); await settle(c); }
  }
}

const out = [];
if (process.argv[1] && process.argv[1].endsWith('c3capture.mjs')) {
  for (const s of SHOTS) {
    if (only && !only.includes(s.id)) continue;
    const c = await openState({ state: s.state, lang: s.lang, appearance: s.appearance, contrast: s.contrast, w: s.w, h: s.h, q: s.q, reducedMotion: s.rm });
    if (s.journey) await runJourney(c, s.journey);
    await settle(c);
    if (s.focus) { const ok = await kbdFocus(c, s.focus); if (!ok) throw new Error(`${s.id}: focus target ${s.focus} not found`); await sleep(80); }
    const png = await shotPhone(c);
    writeFileSync(join(SHOTDIR, s.id + '.png'), png);
    const m = await c.eval(MEASURE);
    if (s.focus) m.focused = await c.eval(`(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();return {id:a.id,name:(a.getAttribute('aria-label')||a.textContent||'').trim(),x:r.x,y:r.y,w:r.width,h:r.height,ring:getComputedStyle(a).boxShadow!=='none'}})()`);
    out.push({ ...s, png: `${s.id}.png`, bytes: png.length, sha256: sha(png), measured: m });
    process.stdout.write('.');
  }
  await closeBrowser(); await closeServers();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  let prev = [];
  if (only) { try { prev = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')).shots; } catch { prev = []; } }
  const byId = Object.fromEntries([...prev, ...out].map((s) => [s.id, s]));
  const all = SHOTS.map((s) => byId[s.id]).filter(Boolean);
  writeFileSync(join(PKG, 'data', 'SHOTS.json'), JSON.stringify({ note: 'Every Product capture: its declared state and what the page measured while it was taken. PNGs at 2× in WORK/shots; the KEEP subset is in captures/.', count: all.length, shots: all }, null, 1) + '\n');
  const cap = join(PKG, 'captures');
  mkdirSync(cap, { recursive: true });
  if (!only) for (const f of readdirSync(cap)) rmSync(join(cap, f));
  for (const id of KEEP) if (!only || only.includes(id)) copyFileSync(join(SHOTDIR, id + '.png'), join(cap, id + '.png'));   // --only refreshes just the KEEP captures it retook (P4-C3R)
  console.log(`\ncaptured ${out.length}`);
}
