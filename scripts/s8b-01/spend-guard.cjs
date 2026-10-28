'use strict';
// S8B-01 — network and spend guard PRELOAD for the voice benchmark (operator-only; never a CI step's runtime; never
// imported by production code). Loaded with `node --require` before the benchmark runner, on the pattern of
// scripts/s8a-02/network-guard.cjs.
//
// simulate / dry: loopback only. Every other socket, TLS connection, DNS lookup and fetch is refused before a byte leaves
// the process, and every provider variable is scrubbed.
//
// live (CP2, the Product Owner's CP2 approval recorded in cp2-approval.json; or a named check, below): the guard loads only when
//   - bench-plan.json `guard.authorized` is true,
//   - cp2-approval.json is `APPROVED` (not `CONSUMED`), its `planSha256` equals the plan's hash, and
//   - QANDEEL_S8B_RUN_ID equals the approval's `runId`.
// Then the hosts of `guard.allowedHosts` are reachable as well as loopback, only over https and only through `fetch`,
// and each fetch to them needs a RESERVATION made just before it:
//   - `reserve(bucket, worstUsd)` refuses when the bucket's budget (`guard.budgetUsd`) or the USD cap would be exceeded by
//     what is already settled plus what is reserved;
//   - a reservation admits exactly one request, so nothing can retry without a new reservation;
//   - `settle(id, actualUsd)` replaces the worst case by the measured cost; an unsettled reservation stays charged at its
//     worst case;
//   - the cumulative spend is written to the run's spend-state file after every reservation and settlement.
// Only the approved provider keys (`guard.liveKeys`) survive the scrub in live mode.
const fs = require('node:fs');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const path = require('node:path');
const crypto = require('node:crypto');

// The plan and the approval it reads. By default the S8B-01 benchmark (bench-plan.json, cp2-approval.json); a named check
// selects its own pair beside the guard, from this fixed list only (the Product Owner's Google Cloud PayGo check,
// 2026-10-28: gcp-paygo-plan.json, gcp-paygo-approval.json; and its full Google Cloud evaluation of the same day:
// cp2-cloud-plan.json, cp2-cloud-approval.json; and its Speechmatics real-time ASR test: asr-sm-plan.json, asr-sm-approval.json).
// Nothing else is selectable.
const CHECKS = {
  '': ['bench-plan.json', 'cp2-approval.json'],
  'gcp-paygo': ['gcp-paygo-plan.json', 'gcp-paygo-approval.json'],
  'cp2-cloud': ['cp2-cloud-plan.json', 'cp2-cloud-approval.json'],
  'asr-sm': ['asr-sm-plan.json', 'asr-sm-approval.json'],
};
const CHECK = process.env.QANDEEL_S8B_CHECK ?? '';
if (!Object.hasOwn(CHECKS, CHECK)) throw new Error('S8B_01_GUARD: unknown check; nothing was sent');
const [PLAN_FILE, APPROVAL_FILE] = CHECKS[CHECK];
const planText = fs.readFileSync(path.join(__dirname, PLAN_FILE), 'utf8');
const plan = JSON.parse(planText);
const MODE = process.env.QANDEEL_S8B_MODE ?? '';
if (!['simulate', 'dry', 'live'].includes(MODE)) throw new Error('S8B_01_GUARD: QANDEEL_S8B_MODE must be simulate, dry or live');

const planSha256 = crypto.createHash('sha256').update(planText.replace(/\r\n/gu, '\n')).digest('hex');
let approval = null;
if (MODE === 'live') {
  if (plan.guard.authorized !== true) {
    throw new Error('S8B_01_GUARD: the S8B-01 benchmark is not authorized for a live run (CP1 lock); nothing was sent');
  }
  const file = path.join(__dirname, APPROVAL_FILE);
  approval = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (!approval || approval.status !== 'APPROVED') {
    throw new Error('S8B_01_GUARD: no unconsumed Product Owner approval for a live run; nothing was sent');
  }
  if (approval.planSha256 !== planSha256) throw new Error('S8B_01_GUARD: the plan differs from the approved plan hash; nothing was sent');
  if (process.env.QANDEEL_S8B_RUN_ID !== approval.runId) throw new Error('S8B_01_GUARD: the run id is not the approved run; nothing was sent');
  if (!(approval.capUsd <= plan.guard.costCapUsd && plan.guard.costCapUsd <= 10)) throw new Error('S8B_01_GUARD: the cap exceeds the approval; nothing was sent');
}

// Provider keys are never present in simulate / dry mode; in live mode only the approved ones are kept.
const KEEP = MODE === 'live' ? new Set(plan.guard.liveKeys ?? []) : new Set();
const SCRUB = /^(?:DEEPSEEK_|OPENAI_|ANTHROPIC_|GEMINI_|GOOGLE_|AZURE_|SPEECH_|ELEVENLABS_|DEEPGRAM_|SPEECHMATICS_|SONIOX_|PG|DATABASE_URL|SUPABASE_)/u;
const scrubbed = Object.keys(process.env).filter((n) => SCRUB.test(n) && !KEEP.has(n)).sort();
for (const n of scrubbed) delete process.env[n];

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const PROVIDER_HOSTS = new Set(MODE === 'live' ? Object.values(plan.guard.allowedHosts ?? {}) : []);
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
// A socket to a provider host opens only inside a fetch or a WebSocket session the guard admitted (undici connects within it).
let fetchInFlight = 0;
let socketsOpen = 0;
const allowedSocket = (host) => LOOPBACK.has(host) || (PROVIDER_HOSTS.has(host) && (fetchInFlight > 0 || socketsOpen > 0));

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const host = hostOf(args);
  if (!allowedSocket(host)) forbid(`net.connect:${host}`);
  return originalConnect.apply(this, args);
};
const originalTlsConnect = tls.connect;
tls.connect = function guardedTlsConnect(...args) {
  const o = typeof args[0] === 'object' && args[0] !== null ? args[0] : { host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  const host = o.servername ?? o.host ?? 'localhost';
  if (!allowedSocket(host)) forbid(`tls.connect:${host}`);
  return originalTlsConnect.apply(this, args);
};
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6']) {
  const original = dns[name];
  dns[name] = function guardedDns(hostname, ...rest) {
    if (!allowedSocket(hostname)) forbid(`dns.${name}:${hostname}`);
    return original.call(this, hostname, ...rest);
  };
}

// ── spend ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const cap = plan.guard.costCapUsd;
const budgets = plan.guard.budgetUsd;
const spend = { settledUsd: 0, reservedUsd: 0, byBucket: {}, reservations: 0, settled: 0, refused: 0, overruns: 0 };
const open = new Map();
let pending = null; // the one reservation the next provider fetch consumes
let nextId = 1;
const stateFile = MODE === 'live' ? process.env.QANDEEL_S8B_STATE_FILE ?? null : null;
function persist() {
  if (!stateFile) return;
  const tmp = `${stateFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ runId: approval?.runId ?? null, capUsd: cap, ...spend, updatedAt: new Date().toISOString() }, null, 2));
  fs.renameSync(tmp, stateFile);
}
const bucketUsed = (b) => (spend.byBucket[b]?.settledUsd ?? 0) + (spend.byBucket[b]?.reservedUsd ?? 0);
function reserve(bucket, worstUsd) {
  if (!(bucket in budgets)) throw new Error(`S8B_01_SPEND: unknown bucket ${bucket}`);
  if (!(Number.isFinite(worstUsd) && worstUsd >= 0)) throw new Error('S8B_01_SPEND: a reservation needs a finite worst-case cost');
  if (pending !== null) throw new Error('S8B_01_SPEND: a reservation is already waiting for its request');
  const total = spend.settledUsd + spend.reservedUsd + worstUsd;
  if (bucketUsed(bucket) + worstUsd > budgets[bucket] + 1e-12 || total > cap + 1e-12) {
    spend.refused += 1; persist();
    const e = new Error(`S8B_01_BUDGET_REFUSED:${bucket}`); e.code = 'S8B_01_BUDGET_REFUSED'; throw e;
  }
  const id = nextId++;
  spend.byBucket[bucket] ??= { settledUsd: 0, reservedUsd: 0, calls: 0 };
  spend.byBucket[bucket].reservedUsd += worstUsd;
  spend.byBucket[bucket].calls += 1;
  spend.reservedUsd += worstUsd;
  spend.reservations += 1;
  open.set(id, { bucket, worstUsd });
  pending = id;
  persist();
  return id;
}
function settle(id, actualUsd) {
  const r = open.get(id);
  if (!r) throw new Error('S8B_01_SPEND: unknown or already settled reservation');
  // A measured cost above its own worst case is charged in full: the cap counts what was spent, not what was hoped.
  const usd = Math.max(0, Number(actualUsd) || 0);
  open.delete(id);
  spend.reservedUsd -= r.worstUsd;
  spend.byBucket[r.bucket].reservedUsd -= r.worstUsd;
  spend.settledUsd += usd;
  spend.byBucket[r.bucket].settledUsd += usd;
  spend.settled += 1;
  if (usd > r.worstUsd) spend.overruns += 1;
  if (pending === id) pending = null;
  persist();
  return { overrun: usd > r.worstUsd };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async function guardedFetch(input, init) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url);
  if (LOOPBACK.has(url.hostname)) return originalFetch(input, init);
  if (!PROVIDER_HOSTS.has(url.hostname)) forbid(`fetch:${url.hostname}`);
  if (url.protocol !== 'https:') forbid(`fetch:${url.protocol}${url.hostname}`);
  if (pending === null) forbid(`fetch-without-reservation:${url.hostname}`);
  pending = null; // one request per reservation: no retry is possible without a new reservation
  fetchInFlight += 1;
  try {
    return await originalFetch(input, init);
  } finally {
    fetchInFlight -= 1;
  }
};
// A WebSocket session (Speechmatics real-time) is admitted like a fetch: an allowed host, wss only, and one session per
// reservation; its sockets stay allowed until the session closes.
const OriginalWebSocket = globalThis.WebSocket;
if (OriginalWebSocket) {
  globalThis.WebSocket = class GuardedWebSocket extends OriginalWebSocket {
    constructor(input, init) {
      const url = new URL(String(input));
      const provider = !LOOPBACK.has(url.hostname);
      if (provider) {
        if (!PROVIDER_HOSTS.has(url.hostname)) forbid(`websocket:${url.hostname}`);
        if (url.protocol !== 'wss:') forbid(`websocket:${url.protocol}${url.hostname}`);
        if (pending === null) forbid(`websocket-without-reservation:${url.hostname}`);
        pending = null;
        socketsOpen += 1;
      }
      super(input, init);
      if (provider) {
        let ended = false;
        const end = () => { if (!ended) { ended = true; socketsOpen -= 1; } };
        this.addEventListener('close', end);
        this.addEventListener('error', end);
      }
    }
  };
}
persist();

globalThis.__QANDEEL_S8B_01_GUARD__ = Object.freeze({
  check: CHECK || null, mode: MODE, authorized: plan.guard.authorized, runId: approval?.runId ?? null, planSha256, scrubbed, blocked,
  reserve, settle, spend: () => JSON.parse(JSON.stringify(spend)),
});
