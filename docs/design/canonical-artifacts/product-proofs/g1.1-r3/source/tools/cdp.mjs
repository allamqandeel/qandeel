// G1.1 — a minimal Chrome DevTools Protocol driver (Node 24 global WebSocket, no npm).
//
// Why CDP rather than `chrome --screenshot`: headless Chrome on this host refuses a window
// narrower than ~500 CSS px and captures anyway, which silently lays a 390 px phone out at 488 px
// (see memory: silent-artifact-corruption-traps #9). Emulation.setDeviceMetricsOverride sets the
// LAYOUT viewport itself, so a 390 x 844 capture is a 390 x 844 layout, and every frame of a
// motion sequence is taken from one live page instead of one process per frame.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'g11-chrome-'));
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
    // Greyscale antialiasing: LCD subpixel fringes are not what a phone draws, and they contaminate
    // any typography judgement (memory: windows-chrome-lcd-aa-contaminates-type-proofs).
    '--disable-lcd-text', '--disable-font-subpixel-positioning',
    '--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check',
    '--window-size=1200,1800', 'about:blank',
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
    } else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const waitEvent = (method, timeout = 20000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting for ${method}`)), timeout);
    const l = (m) => { if (m.method === method) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); res(m.params); } };
    listeners.push(l);
  });
  await send('Page.enable');
  await send('Runtime.enable');

  const api = {
    send,
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
      const loaded = waitEvent('Page.loadEventFired');
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
    async close() {
      try { ws.close(); } catch { /* already closed */ }
      proc.kill();
      await sleep(400);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold a lock */ }
    },
  };
  return api;
}
