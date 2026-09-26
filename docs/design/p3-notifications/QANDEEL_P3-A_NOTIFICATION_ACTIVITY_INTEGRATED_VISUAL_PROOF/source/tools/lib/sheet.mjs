// P3-A — renders a self-contained HTML sheet (a board, or one frame of a board-drawn clip) to PNG in headless Chrome.
// Guards (host traps): the board root is LTR (an RTL root hides left overflow); rows never shrink their children; the
// render is REFUSED if any painted element lies outside the canvas, or if the page scrolls sideways.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';
import { WORK, sleep } from './session.mjs';

let chrome = null;
export async function sheetBrowser() { if (!chrome) chrome = await launch({ port: 9551 }); return chrome; }
export async function closeSheetBrowser() { if (chrome) { await chrome.close(); chrome = null; } }

export async function renderSheet(name, html, { width = 1900, dpr = 1, scheme = 'dark' } = {}) {
  const file = join(WORK, `${name}.html`);
  writeFileSync(file, html);
  const c = await sheetBrowser();
  await c.viewport({ width, height: 900, dpr, mobile: false });
  await c.media({ scheme });
  await c.goto(pathToFileURL(file).href);
  await c.eval('document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{throw new Error("image failed: "+i.src)}))))');
  const bad = await c.eval(`(()=>{const W=document.documentElement.clientWidth;const out=[];for(const e of document.querySelectorAll('.board *')){const r=e.getBoundingClientRect();if(r.width&&(r.left<-0.5||r.right>W+0.5)&&!e.closest('.clip'))out.push(e.tagName+'.'+e.className+' '+Math.round(r.left)+'..'+Math.round(r.right)+' '+(e.textContent||'').slice(0,40))}return {sw:document.documentElement.scrollWidth,W,out:out.slice(0,5)}})()`);
  if (bad.sw > width || bad.out.length) throw new Error(`${name}: content outside the canvas ${JSON.stringify(bad)}`);
  const h = await c.eval('Math.ceil(document.documentElement.scrollHeight)');
  await c.viewport({ width, height: h, dpr, mobile: false });
  await sleep(120);
  return c.shot({ x: 0, y: 0, width, height: h, scale: 1 });
}
