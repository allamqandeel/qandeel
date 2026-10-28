'use strict';
// S8B-01 — network and spend guard PRELOAD for the voice benchmark (operator-only; never a CI step's runtime; never
// imported by production code). Loaded with `node --require` before the benchmark runner, on the pattern of
// scripts/s8a-02/network-guard.cjs.
//
// CP1 state: bench-plan.json `guard.authorized` is false. While it is, the guard
//   - refuses to load in live mode (QANDEEL_S8B_MODE=live), so nothing can be sent;
//   - in simulate / dry mode, allows loopback connections only (the local simulated stream) and refuses every other
//     socket, TLS connection, DNS lookup and fetch, before a byte leaves the process.
// CP2 replaces nothing here: it adds the approved provider hosts, their per-call worst-case cost and the cumulative spend
// state, and lifts the lock as the single change recorded beside the plan's new hash.
const fs = require('node:fs');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const path = require('node:path');

const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'bench-plan.json'), 'utf8'));
const MODE = process.env.QANDEEL_S8B_MODE ?? '';
if (!['simulate', 'dry', 'live'].includes(MODE)) throw new Error('S8B_01_GUARD: QANDEEL_S8B_MODE must be simulate, dry or live');
if (MODE === 'live' && plan.guard.authorized !== true) {
  throw new Error('S8B_01_GUARD: the S8B-01 benchmark is not authorized for a live run (CP1 lock); nothing was sent');
}
// Provider keys are never present in simulate / dry mode: a stray key in the environment is deleted, by name only.
const SCRUB = /^(?:DEEPSEEK_|OPENAI_|ANTHROPIC_|GEMINI_|GOOGLE_|AZURE_|SPEECH_|ELEVENLABS_|DEEPGRAM_|SPEECHMATICS_|SONIOX_|PG|DATABASE_URL|SUPABASE_)/u;
const scrubbed = Object.keys(process.env).filter((n) => SCRUB.test(n)).sort();
for (const n of scrubbed) delete process.env[n];

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const blocked = [];
function forbid(what) {
  blocked.push(what);
  const e = new Error(`S8B_01_NETWORK_FORBIDDEN:${what}`); e.code = 'S8B_01_NETWORK_FORBIDDEN'; throw e;
}
function hostOf(args) {
  const a = args[0];
  if (a !== null && typeof a === 'object') return a.path ? `pipe:${a.path}` : (a.host ?? 'localhost');
  if (typeof a === 'string' && !/^\d+$/u.test(a)) return `pipe:${a}`;
  return typeof args[1] === 'string' ? args[1] : 'localhost';
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const host = hostOf(args);
  if (!LOOPBACK.has(host)) forbid(`net.connect:${host}`);
  return originalConnect.apply(this, args);
};
const originalTlsConnect = tls.connect;
tls.connect = function guardedTlsConnect(...args) {
  const o = typeof args[0] === 'object' && args[0] !== null ? args[0] : { host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  if (!LOOPBACK.has(o.host ?? 'localhost')) forbid(`tls.connect:${o.host}`);
  return originalTlsConnect.apply(this, args);
};
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6']) {
  const original = dns[name];
  dns[name] = function guardedDns(hostname, ...rest) {
    if (!LOOPBACK.has(hostname)) forbid(`dns.${name}:${hostname}`);
    return original.call(this, hostname, ...rest);
  };
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async function guardedFetch(input, init) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url);
  if (!LOOPBACK.has(url.hostname)) forbid(`fetch:${url.hostname}`);
  return originalFetch(input, init);
};

globalThis.__QANDEEL_S8B_01_GUARD__ = Object.freeze({ mode: MODE, authorized: plan.guard.authorized, scrubbed, blocked });
