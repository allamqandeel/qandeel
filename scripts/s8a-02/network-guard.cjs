'use strict';
// S8A-02 — network and spend guard PRELOAD for the DeepSeek-only brain-eval run (operator-only; never a CI step; never
// imported by production code). Loaded with `node --require` BEFORE ts-node and every production module, on the pattern of
// scripts/ci-01/network-guard.cjs and the S8A-01 CP4 guard. One difference from both: the caps are CUMULATIVE across every run of one round (Round 1: the
// baseline and the candidate, D3; Round 2: both arms and the FAST / DEEP pairs): one spend-state file carries every attempt those runs
// made, and a request that would pass the attempt cap or the cost cap is refused HERE, before a byte leaves the process.
//
// Allowed: HTTPS POST to https://api.deepseek.com/chat/completions (and its TLS / DNS while that request is in flight), and
// the loopback port of the disposable ledger database. Everything else throws. Bodies are read only for their byte length,
// max_tokens and the reported usage numbers; no text is logged or stored.
const fs = require('node:fs');
const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');
const http2 = require('node:http2');
const dns = require('node:dns');
const dgram = require('node:dgram');

// 1. Inherited database / provider / proxy environment is deleted (names recorded, values never read). The DeepSeek key
//    and mode are the only provider variables kept; the launcher put them in this process's environment.
const SCRUB = /^(?:PG[A-Z0-9_]*|DATABASE_URL|SUPABASE_[A-Z0-9_]*|REDIS[A-Z0-9_]*|OPENAI_[A-Z0-9_]*|ANTHROPIC_[A-Z0-9_]*|GEMINI_[A-Z0-9_]*|GOOGLE_[A-Z0-9_]*|MODEL_PROVIDER|[A-Za-z0-9_]*[Pp][Rr][Oo][Xx][Yy])$/u;
const KEEP_DEEPSEEK = new Set(['DEEPSEEK_API_KEY', 'DEEPSEEK_QUALIFICATION_MODE']);
const scrubbed = Object.keys(process.env).filter((n) => SCRUB.test(n) || (n.startsWith('DEEPSEEK_') && !KEEP_DEEPSEEK.has(n))).sort();
for (const n of scrubbed) delete process.env[n];

const DEEPSEEK_HOST = 'api.deepseek.com';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
// The Product Owner's caps, per approved round; each round has its own spend-state file, so one round can never spend
// another's allowance. Round 1 (D3): 60 paid calls and USD 0.50, baseline and candidate together. Round 2 (decision of
// 2026-10-21): at most 200 attempts and USD 0.35, both arms and the FAST / DEEP pairs together (exhausted). Round 3 (the
// focused comparison, Part A Shared language and Part B gender and brevity; Product Owner Round 3 decision D4,
// 2026-10-21; nothing runs before the final copy is approved verbatim): at most 80 attempts and USD 0.22 for both parts
// together, independent of Round 2. Round 4 (the Shared attribution probe; Product Owner Shared Attribution Engineering
// Decision D2, 2026-10-21): at most 2 attempts and USD 0.02, its own file. Round 5 (Part T of the Shared attribution test;
// Attribution Probe Review D1, 2026-10-21): at most 60 attempts and USD 0.12, its own file; with round 4 it stays inside the
// cumulative 100 attempts and USD 0.20. Part L (round 6) has no caps here because it is not authorized: it refuses. Round 7
// (the focused check of the server-sourced candidate; Product Owner Attribution Integrity Prototype decision D1,
// 2026-10-21): at most 30 attempts and USD 0.04, its own file, both arms together.
const ROUND_CAPS = { 1: { maxAttempts: 60, costCapUsd: 0.5 }, 2: { maxAttempts: 200, costCapUsd: 0.35 }, 3: { maxAttempts: 80, costCapUsd: 0.22 },
  4: { maxAttempts: 2, costCapUsd: 0.02 }, 5: { maxAttempts: 60, costCapUsd: 0.12 }, 7: { maxAttempts: 30, costCapUsd: 0.04 },
  // Round 8: CP3 Personal qualification, Product Owner Round 8 Execution Authorization, 2026-10-22 (prereg v2).
  8: { maxAttempts: 123, costCapUsd: 0.25 },
  // Round 9: CP3 Final Integrated Correction acceptance, Product Owner Final Correction Approval, 2026-10-22 (132, USD 0.20).
  9: { maxAttempts: 132, costCapUsd: 0.2 },
  // Round 10: S8A-02 / CP2 attribution-layer comparison (B / S / S_R, 468 planned provider calls). Founder Round 10 Run
  // Authorization, 2026-10-22: at most 468 actual calls within these caps, no retries, no raised limits; the lock is lifted
  // as the single change PREREGISTRATION_ROUND10.md permits, and its new hash is recorded beside it before the first call.
  10: { maxAttempts: 495, costCapUsd: 0.6 },
  // Round 11: S8A-03 CP3 Focused Real-Model Memory Acceptance (scripts/s8a-03/cp3-launch.mjs; 14 fixed cases, 31 capture +
  // 10 reply calls at most, no retries). Founder CP3 Final Preparation Approval, 2026-10-23: 41 attempts and USD 0.15, its
  // own spend-state file. The lock is lifted by the Founder's CP3 Final Real-Model Execution Authorization (2026-10-23):
  // ONE paid run within these caps, no retries, no raised limit; the launcher refuses a second (the state file exists).
  11: { maxAttempts: 41, costCapUsd: 0.15 },
  // Round 18: S8A-04 CP1 Shared Social Understanding — the isolated real DeepSeek reading (scripts/s8a-04/). Product Owner
  // D5, 2026-10-24: at most 64 calls and USD 0.15 — a ceiling, not a target — synthetic data only, no automatic retry, every
  // stage cumulative in ONE spend-state file; stop on identity confusion or repeated misattribution.
  18: { maxAttempts: 64, costCapUsd: 0.15 },
  // Round 19: S8A-04 CP2 Shared Social Memory — the paid stages of the Controlled Amendment §11 (scripts/s8a-04/cp2-*).
  // Product Owner Final Implementation Authorization, 2026-10-24, and the Product Owner's approval of the paid stages,
  // 2026-10-25 (after the zero-cost rehearsal, amendment §13.5): at most 80 calls and USD 0.08 at peak — a ceiling, not a
  // target — synthetic data only, no automatic retry, every stage in ONE spend-state file (the driver holds each stage to its
  // own share: reading 14 / 0.010, placement 10 / 0.006, recall 24 / 0.035, integrated 32 / 0.029). The lock is lifted by
  // that approval; no ceiling is exceeded even when a stage cannot complete.
  19: { maxAttempts: 80, costCapUsd: 0.08 },
  // Round 20: S8A-04 CP2 — the integrated proof of the placer binding (scripts/s8a-04/cp2-binding-*; amendment §7). The
  // zero-cost runs (dry, simulated) need no approval. A paid run needs the Product Owner's approval of its budget; until
  // then the round is locked, and lifting the lock is the single change. Synthetic data only, no automatic retry. Lifted
  // by the Product Owner's approval of 2026-10-25: at most 12 DeepSeek Flash calls and USD 0.02, scenario A only, one run.
  20: { maxAttempts: 12, costCapUsd: 0.02 },
  // Round 21: S8A-04 CP3 — the free integrated proof of Personal Knowledge in a Shared World (scripts/s8a-04/cp3-*). Product
  // Owner Final Implementation Authorization, 2026-10-25: dry and simulated runs only; no paid call is authorized (CP3-D's
  // budget request comes first), so the round is locked for a live run and has no paid allowance at all.
  21: { maxAttempts: 0, costCapUsd: 0, authorized: false },
  // Round 22: S8A-04 CP3-D — the preregistered evaluation of the Shared disclosure judge (scripts/s8a-04/cp3d-*; amendment §4).
  // Product Owner CP3-D Final Evaluation Authorization, 2026-10-25: ONE run of the 120 preregistered synthetic cases, DeepSeek
  // Flash, at most 120 calls and USD 0.05 in total, no automatic retry, no second run; the launcher refuses a second (the
  // spend state exists).
  22: { maxAttempts: 120, costCapUsd: 0.05 },
  // Rounds 23 / 24: S8A-04 CP3-D V2 — the preregistered two-tier acceptance of Trusted Claim Spans (scripts/s8a-04/cp3d-v2/;
  // amendment §11.6; the Product Owner's D-7 gate, 2026-10-26): 23 = Tier 1 (the check over 150 fixed replies), 24 = Tier 2
  // (60 end-to-end scenarios and 20 runs without knowledge). Product Owner budget approval, 2026-10-26: Tier 1 at most 150
  // calls and USD 0.08, Tier 2 at most 145 calls and USD 0.17 (the measured call lists; budget.mjs). One paid run per tier,
  // no automatic retry; Tier 2 only after Tier 1 is ACCEPTED (launch.mjs enforces it).
  23: { maxAttempts: 150, costCapUsd: 0.08 },
  24: { maxAttempts: 145, costCapUsd: 0.17 },
  // Round 25: S8A-05 CP3 — the preregistered Tier S / Tier P evaluation of the Public semantic interpretation
  // (scripts/s8a-05/cp3/; Controlled Amendment A-4). Product Owner CP3 order, 2026-10-27: the paid evaluation is prepared,
  // and no paid call is made before the Product Owner explicitly approves its ceiling. Until then the round is LOCKED for a
  // live run and has no paid allowance at all; the approval's single change sets its caps and lifts the lock.
  25: { maxAttempts: 0, costCapUsd: 0, authorized: false } };
const ROUND = Number(process.env.QANDEEL_EVAL_ROUND);
if (!Object.prototype.hasOwnProperty.call(ROUND_CAPS, ROUND)) throw new Error(`S8A_02_GUARD: QANDEEL_EVAL_ROUND must name an approved round (${Object.keys(ROUND_CAPS).join(', ')})`);
const DRY = process.env.QANDEEL_EVAL_DRY === '1';
// Simulated mode (round 10 readiness): scripts/s8a-02/simulated-deepseek.cjs is preloaded BEFORE this guard and replaces
// fetch for the DeepSeek URL with a local stub, so the guard below wraps the stub and counts, caps and settles exactly as it
// would a live call, at zero cost. It is refused without the stub, and the stub is refused outside simulated mode.
const SIMULATED = process.env.QANDEEL_EVAL_SIMULATE === '1';
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (SIMULATED && (stub === undefined || globalThis.fetch !== stub.fetch)) throw new Error('S8A_02_GUARD: simulated mode requires the simulated DeepSeek preload');
if (!SIMULATED && stub !== undefined) throw new Error('S8A_02_GUARD: the simulated DeepSeek stub is loaded outside simulated mode');
if (ROUND_CAPS[ROUND].authorized === false && !DRY && !SIMULATED) throw new Error(`S8A_02_GUARD: round ${ROUND} is not authorized for a live run; nothing was sent`);
// Simulated cap overrides (the cap-enforcement tests only): "maxAttempts,costCapUsd", honoured in simulated mode alone.
const simulatedCaps = SIMULATED && /^\d+,\d+(?:\.\d+)?$/u.test(process.env.QANDEEL_EVAL_SIMULATED_CAPS ?? '') ? process.env.QANDEEL_EVAL_SIMULATED_CAPS.split(',').map(Number) : null;
const MAX_ATTEMPTS = simulatedCaps ? simulatedCaps[0] : ROUND_CAPS[ROUND].maxAttempts;
const COST_CAP_USD = simulatedCaps ? simulatedCaps[1] : ROUND_CAPS[ROUND].costCapUsd;
// Official deepseek-flash rates, USD per 1M tokens, checked on api-docs.deepseek.com/quick_start/pricing on 2026-10-21.
// Off-peak is half the peak rate; peak is 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday (Chinese public holidays are
// off-peak and are not modelled here, so a holiday is charged at peak: the safe direction). The CAP is always enforced at
// peak, the worst case; the applicable rate is recorded beside it for the report.
const PEAK = { cacheHit: 0.006, cacheMiss: 0.30, output: 1.20 };
const isPeak = (date) => {
  const day = date.getUTCDay(); const hour = date.getUTCHours();
  return day >= 1 && day <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10));
};
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const dbPort = /^\d+$/u.test(process.env.QANDEEL_EVAL_LEDGER_DB_PORT ?? '') ? Number(process.env.QANDEEL_EVAL_LEDGER_DB_PORT) : null;

// 2. The cumulative spend state. A live run refuses to start without it; a dry run never writes it.
const statePath = process.env.QANDEEL_EVAL_SPEND_STATE ?? '';
const initial = { round: ROUND, maxAttempts: MAX_ATTEMPTS, costCapUsd: COST_CAP_USD, attempts: [], spentPeakUsd: 0, spentApplicableUsd: 0 };
let spend = initial;
if (!DRY) {
  if (!statePath) throw new Error('S8A_02_GUARD: QANDEEL_EVAL_SPEND_STATE is required for a live run');
  if (fs.existsSync(statePath)) spend = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (spend.maxAttempts !== MAX_ATTEMPTS || spend.costCapUsd !== COST_CAP_USD) throw new Error('S8A_02_GUARD: spend state caps differ from the approved caps');
  // Round 1's file predates the round field; any file that names a round must name this one.
  if (spend.round !== undefined && spend.round !== ROUND) throw new Error('S8A_02_GUARD: spend state belongs to another round');
}
const persist = () => { if (!DRY) fs.writeFileSync(statePath, JSON.stringify(spend, null, 2)); };
// S8A-02 Round 3: the state file is created (with its directory) when the guard loads, so a state that cannot be written
// stops the run before any attempt is counted or sent, never inside an attempt.
if (!DRY) { fs.mkdirSync(require('node:path').dirname(statePath), { recursive: true }); persist(); }
const run = { label: process.env.QANDEEL_EVAL_RUN_LABEL ?? null, attemptsThisRun: 0, blocked: [], scrubbed };

function forbid(what) {
  run.blocked.push(what);
  const e = new Error(`S8A_02_NETWORK_FORBIDDEN:${what}`); e.code = 'S8A_02_NETWORK_FORBIDDEN'; throw e;
}
const costOf = (u, rate) => (((u.prompt_cache_hit_tokens ?? 0) * rate.cacheHit) + ((u.prompt_cache_miss_tokens ?? u.prompt_tokens ?? 0) * rate.cacheMiss)
  + ((u.completion_tokens ?? 0) * rate.output)) / 1e6;
const half = { cacheHit: PEAK.cacheHit / 2, cacheMiss: PEAK.cacheMiss / 2, output: PEAK.output / 2 };

// 3. fetch: only POST https://api.deepseek.com/chat/completions, under both cumulative caps.
const originalFetch = globalThis.fetch;
let deepSeekInFlight = 0;
globalThis.fetch = async function guardedFetch(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
  if (url !== DEEPSEEK_URL) forbid(`fetch:${String(url).slice(0, 60)}`);
  if (DRY) forbid('fetch:dry-run');
  if (spend.attempts.length >= MAX_ATTEMPTS) forbid('fetch:attempt-cap');
  const body = typeof init?.body === 'string' ? init.body : null;
  if (body === null) forbid('fetch:unreadable-body');
  const parsed = JSON.parse(body);
  if (!(Number(parsed.max_tokens) > 0)) forbid('fetch:no-max-tokens');
  // Worst case before sending: every request byte a cache-miss token (a token is at least one byte) and the whole
  // max_tokens spent as output, at the peak rate.
  const worstUsd = (Buffer.byteLength(body) * PEAK.cacheMiss + Number(parsed.max_tokens) * PEAK.output) / 1e6;
  if (spend.spentPeakUsd + worstUsd > COST_CAP_USD) forbid('fetch:cost-cap');
  const startedAt = new Date();
  const attempt = { n: spend.attempts.length + 1, run: run.label, startedAt: startedAt.toISOString(), peakWindow: isPeak(startedAt),
    model: parsed.model, thinking: parsed.thinking?.type ?? null, reasoningEffort: parsed.reasoning_effort ?? null, maxTokens: parsed.max_tokens,
    messages: parsed.messages.length, requestBytes: Buffer.byteLength(body), worstCaseUsd: worstUsd, settled: false };
  // The attempt is counted and persisted BEFORE it is sent, so a crash can never hide a sent request from the cap.
  spend.attempts.push(attempt); spend.spentPeakUsd += worstUsd; spend.spentApplicableUsd += worstUsd; run.attemptsThisRun += 1; persist();
  const t0 = performance.now();
  deepSeekInFlight += 1;
  const settle = (peakUsd, applicableUsd) => {
    spend.spentPeakUsd += peakUsd - worstUsd; spend.spentApplicableUsd += applicableUsd - worstUsd; attempt.peakUsd = peakUsd; attempt.applicableUsd = applicableUsd;
    attempt.settled = true; persist();
  };
  try {
    const response = await originalFetch(input, init);
    attempt.httpStatus = response.status;
    attempt.headersMs = Math.round(performance.now() - t0);
    try {
      const json = await response.clone().json();
      attempt.bodyMs = Math.round(performance.now() - t0);
      const u = json.usage ?? null;
      // A refusal's reason, as DeepSeek states it (its own words, never request or reply text), bounded.
      if (response.status >= 400) attempt.providerError = { type: String(json.error?.type ?? ''), code: String(json.error?.code ?? ''), message: String(json.error?.message ?? '').slice(0, 300) };
      attempt.finishReason = json.choices?.[0]?.finish_reason ?? null;
      attempt.usage = u && { prompt: u.prompt_tokens, cacheHit: u.prompt_cache_hit_tokens, cacheMiss: u.prompt_cache_miss_tokens,
        completion: u.completion_tokens, reasoning: u.completion_tokens_details?.reasoning_tokens ?? null, total: u.total_tokens };
      // Unknown usage is charged at the worst case, never as zero.
      if (u) settle(costOf(u, PEAK), costOf(u, attempt.peakWindow ? PEAK : half)); else settle(worstUsd, worstUsd);
    } catch (e) { attempt.bodyMs = Math.round(performance.now() - t0); attempt.bodyError = e?.name ?? 'Error'; attempt.usage = null; settle(worstUsd, worstUsd); }
    return response;
  } catch (error) {
    attempt.headersMs = Math.round(performance.now() - t0);
    attempt.transportError = error?.name ?? 'Error';
    attempt.usage = null;
    settle(worstUsd, worstUsd); // an aborted request may still have been billed
    throw error;
  } finally { deepSeekInFlight -= 1; }
};

// 4. Lower transports: only the DeepSeek TLS connection (while a sanctioned fetch is in flight) and the ledger database.
const originalConnect = net.Socket.prototype.connect;
function target(args) {
  const a = args[0];
  if (a !== null && typeof a === 'object') return a.path ? { host: `pipe:${a.path}`, port: null } : { host: a.host ?? 'localhost', port: Number(a.port) };
  if (typeof a === 'string' && !/^\d+$/u.test(a)) return { host: `pipe:${a}`, port: null };
  return { host: typeof args[1] === 'string' ? args[1] : 'localhost', port: Number(a) };
}
net.Socket.prototype.connect = function guardedConnect(...args) {
  const { host, port } = target(args);
  const toDb = LOOPBACK.has(host) && dbPort !== null && port === dbPort;
  const toDeepSeek = host === DEEPSEEK_HOST && port === 443 && deepSeekInFlight > 0;
  if (!toDb && !toDeepSeek) forbid(`net.connect:${host}:${port}`);
  return originalConnect.apply(this, args);
};
const originalTlsConnect = tls.connect;
tls.connect = function guardedTlsConnect(...args) {
  const o = (args[0] !== null && typeof args[0] === 'object') ? args[0] : (typeof args[2] === 'object' ? args[2] : {});
  const host = o.servername ?? o.host ?? (typeof args[1] === 'string' ? args[1] : undefined);
  const port = Number(o.port ?? args[0]);
  if (host !== DEEPSEEK_HOST || port !== 443 || deepSeekInFlight === 0) forbid(`tls.connect:${host}:${port}`);
  return originalTlsConnect.apply(this, args);
};
http.request = () => forbid('http.request'); http.get = () => forbid('http.get');
https.request = () => forbid('https.request'); https.get = () => forbid('https.get');
http2.connect = () => forbid('http2.connect'); dgram.createSocket = () => forbid('dgram.createSocket');
const originalLookup = dns.lookup;
dns.lookup = function guardedLookup(hostname, ...rest) {
  if (hostname !== 'localhost' && !(hostname === DEEPSEEK_HOST && deepSeekInFlight > 0)) forbid(`dns.lookup:${hostname}`);
  return originalLookup.call(this, hostname, ...rest);
};
for (const name of ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolveSrv', 'resolveTxt', 'reverse']) dns[name] = () => forbid(`dns.${name}`);
const originalPromisesLookup = dns.promises.lookup;
dns.promises.lookup = async function (hostname, ...rest) {
  if (hostname !== 'localhost' && !(hostname === DEEPSEEK_HOST && deepSeekInFlight > 0)) forbid(`dns.promises.lookup:${hostname}`);
  return originalPromisesLookup.call(this, hostname, ...rest);
};

// 5. Self-test: every forbidden destination throws before any byte leaves the process.
async function selfTest() {
  const probes = [
    ['fetch OpenAI', () => globalThis.fetch('https://api.openai.com/v1/responses', { method: 'POST', body: '{}' })],
    ['fetch Gemini', () => globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models', { method: 'POST', body: '{}' })],
    ['fetch Anthropic', () => globalThis.fetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' })],
    ['fetch other DeepSeek path', () => globalThis.fetch('https://api.deepseek.com/v1/models', { method: 'GET' })],
    ['https.request', () => https.request('https://example.com')],
    ['http.request', () => http.request('http://example.com')],
    ['http2.connect', () => http2.connect('https://example.com')],
    ['tls.connect DeepSeek outside fetch', () => tls.connect({ host: DEEPSEEK_HOST, port: 443, servername: DEEPSEEK_HOST })],
    ['tls.connect other', () => tls.connect({ host: 'example.com', port: 443 })],
    ['net.connect public', () => new net.Socket().connect(53, '8.8.8.8')],
    ['net.connect loopback other port', () => new net.Socket().connect(6379, '127.0.0.1')],
    ['dns.lookup other', () => dns.lookup('example.com', () => {})],
    ['dgram', () => dgram.createSocket('udp4')],
  ];
  const results = [];
  for (const [name, probe] of probes) {
    try { await probe(); results.push({ name, outcome: 'NOT_BLOCKED' }); }
    catch (e) { results.push({ name, outcome: e?.code === 'S8A_02_NETWORK_FORBIDDEN' ? 'BLOCKED' : `OTHER:${e?.code ?? e?.name}` }); }
  }
  const blockedBySelfTest = run.blocked.length;
  return { allBlocked: results.every((r) => r.outcome === 'BLOCKED'), results, blockedBySelfTest };
}

globalThis.__QANDEEL_DEEPSEEK_EVAL_GUARD__ = {
  dry: DRY, simulated: SIMULATED, round: ROUND, maxAttempts: MAX_ATTEMPTS, costCapUsd: COST_CAP_USD, peakRates: PEAK, spend, run, selfTest,
  remainingAttempts: () => (DRY ? 0 : MAX_ATTEMPTS - spend.attempts.length),
};
