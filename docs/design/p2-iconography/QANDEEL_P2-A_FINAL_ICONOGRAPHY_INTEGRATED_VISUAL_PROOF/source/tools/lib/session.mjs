// G3.2 (from G3.1) — one place that opens the prototype in headless Chrome over CDP (lib/cdp.mjs, G2.1's driver with Google-Fonts
// replay from the vendored set). Every capture, check and journey goes through here, so they all see the same page.
//
// Paths are relative to this source tree, so the package rebuilds and re-captures from wherever it is unpacked.
//   PROTO  — the prototype folder to serve (default: <package>/prototype; tools pass another folder when validating a
//            clean rebuild)
//   WORK   — scratch for intermediates (frames, raw shots). env G32_WORK, else <package>/../.g32-work
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { launch } from './cdp.mjs';
import { serve } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(HERE, '..', '..');
export const PKG = resolve(SOURCE, '..');
export const FONTS = join(SOURCE, 'vendor', 'fonts', 'google');
// P2-A: scratch lives OUTSIDE the repository by default (env P2_WORK, else the OS temp folder).
export const WORK = process.env.P2_WORK ? resolve(process.env.P2_WORK) : join(tmpdir(), 'qandeel-p2a-work');
mkdirSync(WORK, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const settle = 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>r(true),250))))';

let servers = {};
export async function serveDir(dir, port) {
  const key = dir + '|' + port;
  if (!servers[key]) servers[key] = await serve(dir, port);
  return `http://127.0.0.1:${port}`;
}
export async function closeServers() { for (const k of Object.keys(servers)) await new Promise((r) => servers[k].close(r)); servers = {}; }

/** Opens one page. `q` extra query; `capture` true → virtual clock + no harness. Returns the CDP api. */
export async function openPage({ proto = join(PKG, 'prototype'), httpPort = 8831, cdpPort = 9431, lang = 'ar', scheme = 'dark', rm = false,
  w = 390, h = 844, dpr = 2, capture = true, state = null, q = '', rmParam = true } = {}) {
  const base = await serveDir(proto, httpPort);
  const c = await launch({ port: cdpPort, fontDir: FONTS, fontMode: 'replay' });
  await c.viewport({ width: capture ? w : 1100, height: capture ? h : 1000, dpr: capture ? dpr : 1, mobile: capture });
  await c.media({ scheme, reducedMotion: rm ? 'reduce' : 'no-preference' });
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const qs = new URLSearchParams({ ...(capture ? { capture: '1' } : {}), lang, w: String(w), h: String(h), ...(rm && rmParam ? { rm: '1' } : {}), ...(state ? { state } : {}) });
  await c.goto(`${base}/index.html?${qs.toString()}${q}`);
  const t0 = Date.now(); let ready = null;
  while (Date.now() - t0 < 120000) { ready = await c.eval(`(document.getElementById('phone')||{getAttribute(){return null}}).getAttribute('data-ready')`); if (ready) break; await sleep(250); }
  if (ready !== '1') throw new Error(`page not ready (${ready}): ` + await c.eval('window.__err || null'));
  const iw = await c.eval('innerWidth');
  if (capture && iw !== w) throw new Error(`layout viewport is ${iw}, expected ${w}`);
  c.meta = { lang, scheme, rm, w, h, dpr, capture };
  return c;
}

/** Keyboard helpers — Enter is sent as a real keyboard does (text '\r'), or a focused <button> is not activated. */
export async function key(c, k, mods = 0) {
  const map = { Enter: [13, '\r'], Escape: [27, ''], Tab: [9, ''], ArrowDown: [40, ''], ArrowUp: [38, ''], ArrowLeft: [37, ''], ArrowRight: [39, ''], ' ': [32, ' '], Shift: [16, ''] };
  const [code, text] = map[k] || [k.charCodeAt(0), k];
  const base = { key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: code, modifiers: mods };
  await c.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text, unmodifiedText: text } : {}) });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
/** Clicks the centre of an element, after asserting the element at that point IS the target (or inside it). */
export async function clickEl(c, sel, waitMs = 2000) {
  const probe = `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();const x=b.left+b.width/2,y=b.top+b.height/2;const at=document.elementFromPoint(x,y);return {x,y,hit:!!at&&(at===e||e.contains(at)),w:b.width,h:b.height,at:at&&(at.id||at.tagName)}})()`;
  let r = await c.eval(probe);
  const t0 = Date.now();
  while (r && !r.hit && Date.now() - t0 < waitMs) { await sleep(60); r = await c.eval(probe); }  // a transition still settling
  if (!r) throw new Error('no element ' + sel);
  if (!r.hit) throw new Error(`element not pressable at its centre: ${sel} (under the pointer: ${r.at})`);
  await c.click(r.x, r.y);
  return r;
}
