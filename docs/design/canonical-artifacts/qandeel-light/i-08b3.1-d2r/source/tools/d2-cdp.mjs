/**
 * I-08B3.1-D2R — a minimal Chrome DevTools Protocol client.
 *
 * Why this rather than one `chrome.exe --screenshot` per frame: 630 frames is 630 process
 * launches, and more importantly each launch is a fresh page whose fonts, filters and
 * layout have to settle again. Attaching once and SEEKING gives a single page whose only
 * changing input is the millisecond, which is the determinism the whole comparison rests
 * on. Emulation.setDeviceMetricsOverride also sets the layout viewport directly, which
 * sidesteps Chrome-on-Windows refusing a browser window narrower than about 500 CSS px —
 * a defect that has silently cropped a phone-width capture in this track before.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

/**
 * The flag set is not negotiable and is shared by every capture in the package.
 * --disable-lcd-text and --disable-font-subpixel-positioning in particular: Windows Chrome
 * defaults to LCD subpixel antialiasing, which puts red and blue fringes on every glyph
 * stem. In a comparison those fringes get read as a property of the design, and a phone
 * does not draw them at all.
 */
export const CHROME_FLAGS = [
  '--headless=new',
  /**
   * I-08B3.1-D2 ADDS THIS ONE FLAG, AND ONLY THIS ONE.
   *
   * D0 and D0R inlined the typeface as a `data:` URI, so their prototypes needed nothing to
   * load it. D1 ships no font bytes and references the project-local Estedad v8.5 runtime by
   * `file://` URL instead — and Chrome treats every `file://` document as its own opaque origin,
   * so an `@font-face` pointing at a sibling file is a cross-origin font fetch and is refused.
   * Without this flag the page loads, renders, looks plausible, and every glyph is a fallback:
   * exactly the failure the font-fingerprint guard exists to catch, which would then fail every
   * capture for a reason that has nothing to do with the design.
   *
   * It relaxes file access and nothing else — no rendering behaviour changes — and it is applied
   * identically to all six captures, so it cannot favour a direction. Recorded in D2R_METHOD.md
   * beside the instructions for opening the prototypes by hand.
   */
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

export async function launch({ chrome, port = 9411 }) {
  const profile = mkdtempSync(join(tmpdir(), 'qd0-cdp-'));
  const child = spawn(chrome, [
    ...CHROME_FLAGS,
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      wsUrl = (await r.json()).webSocketDebuggerUrl || null;
    } catch { /* the browser is not listening yet */ }
    if (!wsUrl) await new Promise((r) => setTimeout(r, 250));
  }
  if (!wsUrl) { child.kill(); throw new Error('d2-cdp: DevTools endpoint never came up'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('d2-cdp: websocket refused')); });

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
  /**
   * EVERY CALL HAS A DEADLINE, and this one was added the hard way.
   *
   * The first version of this client resolved a promise when a reply arrived and did nothing at
   * all if one never did. During the final capture a `Runtime.evaluate` went out and no answer
   * came back: the harness sat at frame 36 of 1,470 with the browser alive, the socket open, node
   * consuming no CPU, and no output for several minutes. Nothing was wrong with the capture that
   * it could report, because a promise that is never settled is indistinguishable from work.
   *
   * A blocked call is a defect. A blocked call that looks like progress is a worse one.
   */
  const CALL_TIMEOUT_MS = 30_000;
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id;
    const timer = setTimeout(() => {
      pending.delete(i);
      rej(new Error(`d2-cdp: ${method} did not answer within ${CALL_TIMEOUT_MS} ms`));
    }, CALL_TIMEOUT_MS);
    pending.set(i, {
      res: (v) => { clearTimeout(timer); res(v); },
      rej: (e) => { clearTimeout(timer); rej(e); },
    });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

  return {
    send,
    async close() {
      try { ws.close(); } catch { /* already gone */ }
      child.kill();
      await new Promise((r) => setTimeout(r, 200));
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows lock */ }
    },
  };
}

/** Open a page at the given device metrics and return a session handle. */
export async function openPage(browser, { url, width, height, dpr }) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  await browser.send('Page.enable', {}, sessionId);
  await browser.send('Runtime.enable', {}, sessionId);
  await browser.send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: dpr, mobile: false }, sessionId);
  await browser.send('Page.navigate', { url }, sessionId);

  const evalIn = async (expression) => {
    const r = await browser.send('Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) {
      throw new Error(`d2-cdp: page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    }
    return r.result.value;
  };

  // Wait for the page to declare itself ready. The page sets that attribute only after it
  // has loaded every font weight and measured its own fingerprint.
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    try { ready = await evalIn('document.documentElement.getAttribute("data-qd-ready") === "1"'); }
    catch { /* document not there yet */ }
    if (!ready) await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error(`d2-cdp: page never became ready: ${url}`);

  return {
    sessionId,
    evalIn,
    async shot() {
      const r = await browser.send('Page.captureScreenshot',
        { format: 'png', captureBeyondViewport: false, fromSurface: true }, sessionId);
      return Buffer.from(r.data, 'base64');
    },
    async close() { await browser.send('Target.closeTarget', { targetId }); },
  };
}
