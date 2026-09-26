// P2-A — renders a self-contained HTML sheet (a board or a lab page) to PNG in headless Chrome, at a fixed CSS size and
// device scale. Used for the boards that are not phone captures (glyph family, legibility, utility comparison).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';
import { WORK, sleep } from './session.mjs';

let chrome = null;
export async function sheetBrowser() { if (!chrome) chrome = await launch({ port: 9451 }); return chrome; }
export async function closeSheetBrowser() { if (chrome) { await chrome.close(); chrome = null; } }

/** Writes `html` to WORK/<name>.html, loads it at width × (measured height), returns the PNG buffer. */
export async function renderSheet(name, html, { width = 1600, dpr = 2, scheme = 'dark' } = {}) {
  const file = join(WORK, `${name}.html`);
  writeFileSync(file, html);
  const c = await sheetBrowser();
  await c.viewport({ width, height: 800, dpr, mobile: false });
  await c.media({ scheme });
  await c.goto(pathToFileURL(file).href);
  await c.eval('document.fonts.ready.then(()=>true)');
  const h = await c.eval('Math.ceil(document.documentElement.scrollHeight)');
  await c.viewport({ width, height: h, dpr, mobile: false });
  await sleep(150);
  return c.shot({ x: 0, y: 0, width, height: h, scale: 1 });
}
