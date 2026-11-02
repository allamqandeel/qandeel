'use strict';
/**
 * S8B-06 CP1 — run the proof app's automated scenarios (A1, L1, R1, H1) on the connected proof phone, one after another.
 * VALIDATION TOOLING ONLY: taps the proof root's buttons over adb (`com.qandeel.mobile.s806proof` only), sets the fake
 * gateway's reply to continuous, and waits for each scenario's own content-free report. Numbers only.
 *
 *   node scripts/s8b-06/device-scenarios.cjs --serial <adb serial> [--out <evidence dir>] [--only A1,L1]
 *
 * Button positions are the proof root's grid on a 1200 px wide screen (HONOR ALI-NX1).
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const serial = opt('--serial', null);
const out = opt('--out', path.join(process.cwd(), '.s8b-06-device-proof'));
if (!serial) throw new Error('--serial is required (the verified proof phone)');

const BUTTONS = { B1: [167, 769], B2: [451, 769], A1: [736, 769], L1: [1018, 769], R1: [167, 948], H1: [451, 948] };
const TIMEOUT_S = { A1: 240, L1: 90, R1: 120, H1: 180 };
const plan = (opt('--only', null) ?? 'A1,L1,R1,H1').split(',');

const post = (p) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: 8806, path: p, method: 'POST' }, (res) => {
    res.resume();
    res.on('end', resolve);
  });
  req.on('error', reject);
  req.end();
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reports = () => fs.readdirSync(out).filter((f) => f.startsWith('device-report-')).sort();

async function main() {
  const model = execFileSync('adb', ['-s', serial, 'shell', 'getprop', 'ro.product.model']).toString().trim();
  process.stdout.write(`[scenarios] phone ${serial} ${model}\n`);
  await post('/fv/gate?mode=none');
  for (const name of plan) {
    if (!BUTTONS[name]) throw new Error(`unknown scenario ${name}`);
    const before = reports();
    execFileSync('adb', ['-s', serial, 'shell', 'input', 'tap', String(BUTTONS[name][0]), String(BUTTONS[name][1])]);
    let file = null;
    for (let t = 0; t < (TIMEOUT_S[name] ?? 180) && !file; t += 1) {
      await wait(1000);
      file = reports().find((f) => !before.includes(f)) ?? null;
    }
    process.stdout.write(`[scenarios] ${name}: ${file ?? 'no report'}\n`);
    await wait(3000);
  }
  process.stdout.write('[scenarios] DONE\n');
}

main().catch((e) => { process.stdout.write(`[scenarios] FAILED ${e.message}\n`); process.exit(1); });
