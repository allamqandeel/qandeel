// P4-C3 — one place that opens the prototype in headless Chrome over CDP (lib/cdp.mjs, vendored byte-exact from P2-A).
// Adapted from P4-C's lib/session.mjs. Every capture and check goes through here, so they all see the same page under
// the same device stand-ins.   WORK — scratch outside the repository (env P4C3_WORK, else the OS temp folder).
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { launch } from './cdp.mjs';
import { serve } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(HERE, '..', '..');
export const PKG = resolve(SOURCE, '..');
export const REPO = resolve(PKG, '..', '..', '..', '..');
export const WORK = process.env.P4C3_WORK ? resolve(process.env.P4C3_WORK) : join(tmpdir(), 'qandeel-p4c3-work');
mkdirSync(WORK, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let servers = {};
export async function serveDir(dir, port) {
  const key = dir + '|' + port;
  if (!servers[key]) servers[key] = await serve(dir, port);
  return `http://127.0.0.1:${port}`;
}
export async function closeServers() { for (const k of Object.keys(servers)) await new Promise((r) => servers[k].close(r)); servers = {}; }

let chrome = null;
export async function browser(port = 9731) { if (!chrome) chrome = await launch({ port }); return chrome; }
export async function closeBrowser() { if (chrome) { await chrome.close(); chrome = null; } }

/** Loads one state. `q` carries extra parameters. Asserts the layout viewport and the applied webfont. */
export async function openState({ proto = join(PKG, 'prototype'), httpPort = 8981, state = 'conv', lang = 'ar', appearance = 'dark', contrast = false,
  w = 390, h = 844, dpr = 2, q = {}, scheme = null, reducedMotion = false } = {}) {
  const base = await serveDir(proto, httpPort);
  const c = await browser();
  await c.viewport({ width: w, height: h, dpr, mobile: true });
  const sysScheme = scheme ?? (appearance === 'light' ? 'light' : 'dark');
  await c.media({ scheme: sysScheme, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', contrast: contrast ? 'more' : 'no-preference' });
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const qs = new URLSearchParams({ capture: '1', state, lang, appearance, w: String(w), h: String(h), ...(contrast ? { contrast: 'more' } : {}), ...q });
  await c.goto(`${base}/index.html?${qs.toString()}`);
  const t0 = Date.now(); let ready = null;
  while (Date.now() - t0 < 90000) { ready = await c.eval(`(document.getElementById('phone')||{getAttribute(){return null}}).getAttribute('data-ready')`); if (ready) break; await sleep(100); }
  if (ready !== '1') throw new Error('page not ready: ' + state + ' ' + qs);
  const iw = await c.eval('innerWidth');
  if (iw !== w) throw new Error(`layout viewport is ${iw}, expected ${w}`);
  const fp = await c.eval(`(()=>{const s=[...document.querySelectorAll('.fprobe span')].map(e=>e.getBoundingClientRect().width);return document.fonts.check('500 16px Estedad')&&new Set(s.map(v=>v.toFixed(2))).size})()`);
  if (!fp) throw new Error('Estedad not applied');
  c.meta = { state, lang, appearance, contrast, w, h, dpr, q, reducedMotion };
  return c;
}
/** Sends a real keyboard key so :focus-visible paints in headless Chrome. */
export async function key(c, k, mods = 0) {
  const map = { Enter: [13, '\r'], Escape: [27, ''], Tab: [9, ''], Shift: [16, ''], ' ': [32, ' '] };
  const [code, text] = map[k] || [k.charCodeAt(0), k];
  const base = { key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: code, modifiers: mods };
  await c.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text, unmodifiedText: text } : {}) });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
export async function kbdFocus(c, sel) {
  await key(c, 'Shift');
  return c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e&&e.focus();return !!e})()`);
}
/** A real pointer click at the centre of an element of the page (not a scripted .click()). */
export async function realClick(c, sel) {
  const r = await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  if (!r) throw new Error('no element to click: ' + sel);
  await c.click(r.x, r.y);
  return r;
}
export async function shotPhone(c) { const { w, h } = c.meta; return c.shot({ x: 0, y: 0, width: w, height: h, scale: 1 }); }
