// Minimal CDP driver (Node 24 global WebSocket, no npm) with FONT REPLAY.
// Adapted from the G1.1/G1.2 driver (product-proofs/g1.2/source/tools/cdp.mjs, sha256 111ca91a…).
// Added: Fetch interception that serves Google-Fonts requests from a hashed local vendor set
// (record once, replay forever), so the canonical world's <link> is fulfilled byte-exactly
// without editing the canonical file and without depending on the network at capture time.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => createHash('sha256').update(b).digest('hex');

export async function launch({ port = 9341, fontDir = null, fontMode = 'replay', gpu = true, extra = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'g21-chrome-'));
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    ...(gpu ? [] : ['--disable-gpu']), ...extra, '--hide-scrollbars', '--force-color-profile=srgb',
    '--disable-lcd-text', '--disable-font-subpixel-positioning',
    '--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1400,1900', 'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore', windowsHide: true });
  let ver = null;
  for (let i = 0; i < 80 && !ver; i++) {
    await sleep(125);
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* not up yet */ }
  }
  if (!ver) { proc.kill(); throw new Error('Chrome DevTools endpoint never came up'); }
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} ${m.error.data ?? ''}`)); else res(m.result);
    } else if (m.method) for (const l of [...listeners]) l(m);
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const waitEvent = (method, timeout = 30000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting for ${method}`)), timeout);
    const l = (m) => { if (m.method === method) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); res(m.params); } };
    listeners.push(l);
  });
  await send('Page.enable');
  await send('Runtime.enable');

  // ---- font record / replay -------------------------------------------------------------
  const fontLog = [];
  if (fontDir) {
    mkdirSync(fontDir, { recursive: true });
    const manPath = join(fontDir, 'FONT_MANIFEST.json');
    const man = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : { entries: {} };
    await send('Fetch.enable', { patterns: [
      { urlPattern: 'https://fonts.googleapis.com/*', requestStage: fontMode === 'record' ? 'Response' : 'Request' },
      { urlPattern: 'https://fonts.gstatic.com/*', requestStage: fontMode === 'record' ? 'Response' : 'Request' },
    ] });
    listeners.push(async (m) => {
      if (m.method !== 'Fetch.requestPaused') return;
      const p = m.params, url = p.request.url;
      try {
        if (fontMode === 'record') {
          const body = await send('Fetch.getResponseBody', { requestId: p.requestId });
          const buf = Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8');
          const h = sha(buf);
          const ct = (p.responseHeaders || []).find((x) => x.name.toLowerCase() === 'content-type')?.value || 'application/octet-stream';
          const file = h.slice(0, 16) + (ct.includes('css') ? '.css' : '.woff2');
          writeFileSync(join(fontDir, file), buf);
          man.entries[url] = { file, sha256: h, bytes: buf.length, contentType: ct };
          writeFileSync(manPath, JSON.stringify(man, null, 1));
          fontLog.push({ url, recorded: file });
          await send('Fetch.continueResponse', { requestId: p.requestId });
        } else {
          const e = man.entries[url];
          if (!e) { fontLog.push({ url, missing: true }); await send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' }); return; }
          const buf = readFileSync(join(fontDir, e.file));
          if (sha(buf) !== e.sha256) throw new Error('vendored font bytes changed: ' + e.file);
          fontLog.push({ url, served: e.file });
          await send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: e.contentType }, { name: 'Access-Control-Allow-Origin', value: '*' }],
            body: buf.toString('base64') });
        }
      } catch (err) { fontLog.push({ url, error: String(err) }); try { await send('Fetch.continueRequest', { requestId: p.requestId }); } catch { /* ignore */ } }
    });
  }

  const api = {
    send, waitEvent, fontLog,
    async viewport({ width, height, dpr = 2, mobile = true }) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
    },
    async media({ scheme = 'dark', reducedMotion = 'no-preference', contrast = 'no-preference' } = {}) {
      await send('Emulation.setEmulatedMedia', { features: [
        { name: 'prefers-color-scheme', value: scheme },
        { name: 'prefers-reduced-motion', value: reducedMotion },
        { name: 'prefers-contrast', value: contrast },
      ] });
    },
    async goto(url) {
      const loaded = waitEvent('Page.loadEventFired', 60000);
      await send('Page.navigate', { url });
      await loaded;
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    async shot({ x = 0, y = 0, width, height, scale = 1 } = {}) {
      const params = { format: 'png', captureBeyondViewport: false, fromSurface: true };
      if (width) params.clip = { x, y, width, height, scale };
      const r = await send('Page.captureScreenshot', params);
      return Buffer.from(r.data, 'base64');
    },
    async click(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },
    async close() {
      try { ws.close(); } catch { /* already closed */ }
      proc.kill();
      await sleep(400);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold a lock */ }
    },
  };
  return api;
}
