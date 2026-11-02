'use strict';
/**
 * S8B-06 CP1 — the automated echo series on the connected proof phone. VALIDATION TOOLING ONLY.
 *
 * Drives the proof app (`com.qandeel.mobile.s806proof` only) through adb taps, sets the fake gateway's reply reference
 * pattern for each run, waits for the run's device report, then asks the gateway for the echo analysis against the known
 * reference (echo-analysis.cjs) with the run's barge-in onsets, and writes it beside the report. Numbers only.
 *
 *   node scripts/s8b-06/device-echo-series.cjs --serial <adb serial> [--out <evidence dir>] [--plan default]
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
const only = opt('--only', null); // e.g. E6:prbs:2,E4:prbs:1 — a subset of runs instead of the default plan

const BUTTONS = {
  E1: [1018, 232], E2: [167, 411], E3: [451, 411], E4: [736, 411], E5: [1018, 411], E6: [167, 590], E7: [451, 590], E8: [736, 590], E9: [1018, 590],
};
const PLAN = [
  ['E6', 'prbs', 2, 'positive control: no communication mode, media playback, unprocessed microphone, no canceller'],
  ['E7', 'prbs', 2, 'positive control on the VOICE_PERFORMANCE source'],
  ['E8', 'prbs', 2, 'positive control on the CAMCORDER source'],
  ['E9', 'prbs', 2, 'positive control on the UNPROCESSED source, asked for although the property says unsupported'],
  ['E4', 'prbs', 1, 'the plain microphone under the communication mode, canceller effect off'],
  ['E5', 'silent', 2, 'external-noise control: the reply makes no sound (canceller on, report only)'],
  ['E5', 'prbs', 3, 'canceller on, speaker, report only'],
  ['E3', 'prbs', 2, 'voice-communication path with the canceller effect disabled, speaker, report only'],
  ['E1', 'prbs', 3, 'canceller on, speaker, STOP'],
  ['E2', 'prbs', 3, 'canceller on, earpiece, STOP'],
];

const request = (method, p) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: 8806, path: p, method }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
  });
  req.on('error', reject);
  req.end();
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * The capture clients of the proof app as the audio policy lists them mid-run, with the effects attached to each session
 * (by the platform itself or by the app) — names and states only, read from `dumpsys media.audio_policy`.
 */
function captureEffects() {
  const uid = execFileSync('adb', ['-s', serial, 'shell', 'pm', 'list', 'packages', '-U', 'com.qandeel.mobile.s806proof']).toString().match(/uid:(\d+)/u)?.[1];
  const lines = execFileSync('adb', ['-s', serial, 'shell', 'dumpsys', 'media.audio_policy']).toString().split(/\r?\n/u);
  const clients = [];
  lines.forEach((line, i) => {
    if (!uid || !line.includes(`uid ${uid}; State:`)) return;
    const near = lines.slice(i + 1, i + 12);
    const source = near.map((l) => l.match(/Source: (AUDIO_SOURCE_\w+)/u)?.[1]).find(Boolean) ?? null;
    if (!source || source === 'AUDIO_SOURCE_INVALID') return; // playback clients
    const effects = [];
    for (const l of near) {
      if (/uid \d+; State:/u.test(l)) break;
      const m = l.match(/"([^"]+)"; (Enabled|Disabled); (Active|Inactive)/u);
      if (m) effects.push({ name: m[1], enabled: m[2] === 'Enabled', active: m[3] === 'Active' });
    }
    clients.push({ state: line.match(/State: (\w+)/u)?.[1] ?? null, source, effects });
  });
  return clients;
}

const reports = () => fs.readdirSync(out).filter((f) => f.startsWith('device-report-')).sort();

async function main() {
  const model = execFileSync('adb', ['-s', serial, 'shell', 'getprop', 'ro.product.model']).toString().trim();
  process.stdout.write(`[echo-series] phone ${serial} ${model}\n`);
  const plan = only ? only.split(',').map((x) => { const [b, g, n] = x.split(':'); return [b, g, Number(n), PLAN.find((p) => p[0] === b)?.[3] ?? '']; }) : PLAN;
  for (const [button, gate, reps, why] of plan) {
    for (let rep = 1; rep <= reps; rep += 1) {
      await request('POST', `/fv/gate?mode=${gate}`);
      const before = reports();
      execFileSync('adb', ['-s', serial, 'shell', 'input', 'tap', String(BUTTONS[button][0]), String(BUTTONS[button][1])]);
      await wait(8000);
      let capture = null;
      try { capture = captureEffects(); } catch (e) { capture = { error: e.message }; }
      let file = null;
      for (let t = 0; t < 90 && !file; t += 1) {
        await wait(1000);
        file = reports().find((f) => !before.includes(f)) ?? null;
      }
      if (!file) {
        process.stdout.write(`[echo-series] ${button} ${gate} #${rep}: no report\n`);
        continue;
      }
      const report = JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
      const r = report.report;
      const replies = report.gateway?.replies ?? [];
      const turn = replies.at(-1)?.turn ?? 1;
      const cuts = replies.map((x) => x.bargeIn?.captureMs).filter((x) => typeof x === 'number');
      const cands = [...(r.candidateCaptureMs ?? []), ...cuts];
      const echo = await request('GET', `/fv/echo?turn=${turn}&cands=${cands.join(',')}`);
      const record = { button, gate, rep, why, report: file, capture, falseCuts: r.falseCuts, reportOnlyCandidates: r.reportOnlyCandidates, quietOnsets: r.quietOnsets, echo };
      fs.writeFileSync(path.join(out, `echo-${file}`), JSON.stringify(record, null, 2));
      const a = echo.analysis ?? {};
      const classes = (a.candidates ?? []).map((c) => c.class).reduce((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {});
      process.stdout.write(`[echo-series] ${button} ${gate} #${rep}: tl=${a.timeline}/${a.marks} cuts=${r.falseCuts} cand=${r.reportOnlyCandidates} lag=${a.bestLagMs} rho=${a.correlation} p=${a.pNull} pairs=${a.validPairs}/${a.onSegments} analyzable=${a.analyzable} leak=${a.leakDb} ref=${a.refOnDb} diff=${a.pairDiffDb?.median} offBase=${a.offBaselineDb} ext=${a.externalEvents?.count} classes=${JSON.stringify(classes)} capture=${JSON.stringify(capture)}\n`);
      await wait(2500);
    }
  }
  process.stdout.write('[echo-series] DONE\n');
}

main().catch((e) => { process.stdout.write(`[echo-series] FAILED ${e.message}\n`); process.exit(1); });
