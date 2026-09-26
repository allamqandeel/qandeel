// P3-A — one place that opens the prototype in headless Chrome over CDP (lib/cdp.mjs, vendored byte-exact from P2-A).
// Every capture, check and clip goes through here, so they all see the same page under the same device stand-ins.
//   WORK — scratch outside the repository (env P3_WORK, else the OS temp folder).
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { launch } from './cdp.mjs';
import { serve } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(HERE, '..', '..');
export const PKG = resolve(SOURCE, '..');
export const WORK = process.env.P3_WORK ? resolve(process.env.P3_WORK) : join(tmpdir(), 'qandeel-p3a-work');
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
export async function browser(port = 9531) { if (!chrome) chrome = await launch({ port }); return chrome; }
export async function closeBrowser() { if (chrome) { await chrome.close(); chrome = null; } }

/** Loads one state in the shared headless page. Returns the CDP api with `meta`. Asserts the layout viewport width. */
export async function openState({ proto = join(PKG, 'prototype'), httpPort = 8931, state = 'conv', lang = 'ar', appearance = 'dark', rm = false,
  contrast = false, w = 390, h = 844, dpr = 2, q = {}, scheme = null } = {}) {
  const base = await serveDir(proto, httpPort);
  const c = await browser();
  await c.viewport({ width: w, height: h, dpr, mobile: true });
  const sysScheme = scheme ?? (appearance === 'light' ? 'light' : 'dark');
  await c.media({ scheme: sysScheme, reducedMotion: rm ? 'reduce' : 'no-preference', contrast: contrast ? 'more' : 'no-preference' });
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const qs = new URLSearchParams({ capture: '1', state, lang, appearance, w: String(w), h: String(h), ...(rm ? { rm: '1' } : {}), ...(contrast ? { contrast: 'more' } : {}), ...q });
  await c.goto(`${base}/index.html?${qs.toString()}`);
  const t0 = Date.now(); let ready = null;
  while (Date.now() - t0 < 60000) { ready = await c.eval(`(document.getElementById('phone')||{getAttribute(){return null}}).getAttribute('data-ready')`); if (ready) break; await sleep(100); }
  if (ready !== '1') throw new Error('page not ready: ' + state);
  const iw = await c.eval('innerWidth');
  if (iw !== w) throw new Error(`layout viewport is ${iw}, expected ${w}`);
  // the webfont must be APPLIED, not merely loaded (silent-artifact trap 6): compare three weights' widths
  const fp = await c.eval(`(()=>{const s=[...document.querySelectorAll('.fprobe span')].map(e=>e.getBoundingClientRect().width);return document.fonts.check('500 16px Estedad')&&new Set(s.map(v=>v.toFixed(2))).size})()`);
  if (!fp) throw new Error('Estedad not applied');
  c.meta = { state, lang, appearance, rm, contrast, w, h, dpr };
  return c;
}
/** Sends a real keyboard Tab / Shift so :focus-visible paints in headless Chrome (cdp trap 6). */
export async function key(c, k, mods = 0) {
  const map = { Enter: [13, '\r'], Escape: [27, ''], Tab: [9, ''], Shift: [16, ''], ' ': [32, ' '] };
  const [code, text] = map[k] || [k.charCodeAt(0), k];
  const base = { key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: code, modifiers: mods };
  await c.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text, unmodifiedText: text } : {}) });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
/** Keyboard-focuses a selector the way a keyboard user would reach it (modality first, then focus). */
export async function kbdFocus(c, sel) {
  await key(c, 'Shift');
  await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e&&e.focus();return !!e})()`);
}
export async function shotPhone(c) {
  const { w, h } = c.meta;
  return c.shot({ x: 0, y: 0, width: w, height: h, scale: 1 });
}
