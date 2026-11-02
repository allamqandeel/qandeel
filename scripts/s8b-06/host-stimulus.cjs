'use strict';
/**
 * S8B-06 CP1 — the repeatable "person speaks over QANDEEL" stimulus for the device proof (B1 / B2). VALIDATION TOOLING ONLY.
 *
 * It watches the fake call gateway (`/fv/summary`), and for every new reply waits a random 1.5–4 s, then plays a SYNTHETIC
 * speech-like sound (harmonics at a voice pitch under a syllable envelope — no recording of anyone) from this computer's
 * speaker, close to the phone. Its WAV is written once into the evidence folder (it is a synthetic test asset).
 *
 * Windows only (PowerShell's SoundPlayer). Usage:
 *   node scripts/s8b-06/host-stimulus.cjs [--port 8806] [--out <dir>] [--ms 1600] [--gain 0.6]
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const port = Number(opt('--port', '8806'));
const out = opt('--out', path.join(process.cwd(), '.s8b-06-device-proof'));
const ms = Number(opt('--ms', '1600'));
const gain = Number(opt('--gain', '0.6'));
const onlyChunks = Number(opt('--chunks', '600'));
const RATE = 24_000;

function stimulusPcm() {
  const n = Math.round((RATE * ms) / 1000);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const pitch = 190 + 25 * Math.sin(2 * Math.PI * 1.3 * t);
    const syllable = Math.max(0, Math.sin(2 * Math.PI * 4 * t)) ** 0.6;
    const attack = Math.min(1, t / 0.01);
    let v = 0;
    for (let h = 1; h <= 10; h += 1) {
      const f = pitch * h;
      const formant = Math.exp(-(((f - 700) / 400) ** 2)) + 0.6 * Math.exp(-(((f - 1200) / 500) ** 2)) + 0.25;
      v += (formant * Math.sin(2 * Math.PI * f * t)) / h;
    }
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(9000 * gain * attack * (0.25 + 0.75 * syllable) * v))), i * 2);
  }
  return pcm;
}

function writeWav(file, pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
}

const summary = () => new Promise((resolve) => {
  http.get({ host: '127.0.0.1', port, path: '/fv/summary' }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve(null); }
    });
  }).on('error', () => resolve(null));
});

const play = (file) => new Promise((resolve) => {
  execFile('powershell.exe', ['-NoProfile', '-Command', `(New-Object Media.SoundPlayer '${file.replace(/'/gu, "''")}').PlaySync()`], () => resolve());
});

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `synthetic-stimulus-${ms}ms.wav`);
  writeWav(file, stimulusPcm());
  process.stdout.write(`[s806-stimulus] ${file}; watching 127.0.0.1:${port}\n`);
  const seen = new Set();
  let n = 0;
  for (;;) {
    const s = await summary();
    const callId = s?.call?.callId ?? null;
    for (const r of s?.call?.replies ?? []) {
      const key = `${callId}:${r.turn}`;
      if (seen.has(key) || r.closed) continue;
      seen.add(key);
      if (r.chunks !== onlyChunks) continue; // only the barge-in replies (B1 / B2 ask for 12 s), never the echo-only runs
      const delay = 1500 + Math.random() * 2500;
      await new Promise((resolve) => setTimeout(resolve, delay));
      n += 1;
      process.stdout.write(`[s806-stimulus] #${n} turn ${r.turn}: playing after ${Math.round(delay)} ms\n`);
      await play(file);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

main();
