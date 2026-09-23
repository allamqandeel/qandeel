/**
 * I-08B3.1-E1 — a minimal Chrome DevTools Protocol client, carried forward from
 * I-08B3.1-D2R unchanged in mechanism.
 *
 * Attaching once and driving one page is what makes the captures comparable: a fresh
 * `chrome.exe --screenshot` per board is a fresh page whose fonts, filters and layout
 * have to settle again. Emulation.setDeviceMetricsOverride also sets the layout viewport
 * directly, which sidesteps Chrome-on-Windows refusing a browser window narrower than
 * about 500 CSS px — a defect that has silently cropped a phone-width capture in this
 * track before.
 *
 * Input.dispatchKeyEvent is the reason this file exists rather than a page script: a
 * synthetic KeyboardEvent constructed in the page carries no default action, so a Tab
 * test written in page JS measures its own focus() calls and always passes.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CHROME_CANDIDATES = [
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
export const findChrome = () => CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null;

/**
 * --disable-lcd-text and --disable-font-subpixel-positioning in particular: Windows Chrome
 * defaults to LCD subpixel antialiasing, which puts red and blue fringes on every glyph
 * stem. In a package whose central claim is about CHROMA those fringes are not cosmetic —
 * they would be counted. A phone does not draw them at all.
 *
 * --allow-file-access-from-files: the page loads Estedad by file:// URL, and Chrome treats
 * every file:// document as its own opaque origin, so an @font-face pointing at a sibling
 * file is a cross-origin font fetch and is refused. Without it the page renders, looks
 * plausible, and every glyph is a fallback.
 */
export const CHROME_FLAGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--allow-file-access-from-files',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-lcd-text',
  '--disable-font-subpixel-positioning',
  '--force-color-profile=srgb',
  '--disable-extensions',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

export async function launch({ chrome, port = 9413 }) {
  const profile = mkdtempSync(join(tmpdir(), 'qe1-cdp-'));
  const child = spawn(chrome, [...CHROME_FLAGS, `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl || null; }
    catch { /* not listening yet */ }
    if (!wsUrl) await new Promise((r) => setTimeout(r, 250));
  }
  if (!wsUrl) { child.kill(); rmSync(profile, { recursive: true, force: true }); throw new Error('e1-cdp: DevTools endpoint never came up'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('e1-cdp: websocket refused')); });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(`${m.error.message} (${JSON.stringify(m.error.data ?? '')})`)) : res(m.result);
    }
  };
  /** Every call has a deadline. A promise that is never settled is indistinguishable from
   *  work, and a blocked call that looks like progress is worse than a blocked call. */
  const CALL_TIMEOUT_MS = 30_000;
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id;
    const timer = setTimeout(() => { pending.delete(i); rej(new Error(`e1-cdp: ${method} did not answer within ${CALL_TIMEOUT_MS} ms`)); }, CALL_TIMEOUT_MS);
    pending.set(i, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

  return {
    send,
    async close() {
      try { ws.close(); } catch { /* already gone */ }
      child.kill();
      await new Promise((r) => setTimeout(r, 250));
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows lock */ }
    },
  };
}

export async function openPage(browser, { url, width, height, dpr }) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  await browser.send('Page.enable', {}, sessionId);
  await browser.send('Runtime.enable', {}, sessionId);
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false }, sessionId);
  await browser.send('Page.navigate', { url }, sessionId);

  const evalIn = async (expression) => {
    const r = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(`e1-cdp: page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };

  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    try { ready = await evalIn('document.documentElement.getAttribute("data-qd-ready") === "1"'); }
    catch { /* document not there yet */ }
    if (!ready) await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error(`e1-cdp: page never became ready: ${url}`);

  return {
    sessionId,
    evalIn,
    async key(params) { await browser.send('Input.dispatchKeyEvent', params, sessionId); },
    async shot({ full = true } = {}) {
      const r = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, fromSurface: true }, sessionId);
      return Buffer.from(r.data, 'base64');
    },
    async close() { await browser.send('Target.closeTarget', { targetId }); },
  };
}
