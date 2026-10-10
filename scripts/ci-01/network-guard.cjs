'use strict';
// CI-01 C1-B — network guard PRELOAD (dev-only; never imported by production code).
//
// Loaded with `node --require scripts/ci-01/network-guard.cjs …` so it runs BEFORE ts-node, before any
// production module and before any dependency. It enforces C1 Task Contract §0.3 by code, not by
// agreement:
//
//   1. Inherited database / provider / proxy environment is DELETED from process.env (names recorded,
//      values never read): PG*, DATABASE_URL, SUPABASE_*, REDIS*, OPENAI_*, ANTHROPIC_*, GEMINI_*,
//      GOOGLE_*, DEEPSEEK_*, *_PROXY. The harness then reads only QANDEEL_CI01_* variables that its own
//      parent process set.
//   2. Every outbound transport Node offers is replaced by a thrower: global fetch, http/https request
//      and get, http2.connect, tls.connect, dgram sockets, dns lookups (except "localhost"), and
//      net.Socket.prototype.connect for any host other than loopback or any port other than the one
//      process-owned PostgreSQL port in QANDEEL_CI01_DB_PORT. Named pipes / unix sockets are refused.
//   3. `globalThis.__QANDEEL_CI01_NETWORK_GUARD__.selfTest()` exercises every thrower and reports what
//      was blocked; the driver refuses to run unless every probe is BLOCKED.
//
// Nothing here knows anything about QANDEEL semantics.
const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');
const http2 = require('node:http2');
const dns = require('node:dns');
const dgram = require('node:dgram');

const SCRUB = /^(?:PG[A-Z0-9_]*|DATABASE_URL|SUPABASE_[A-Z0-9_]*|REDIS[A-Z0-9_]*|OPENAI_[A-Z0-9_]*|ANTHROPIC_[A-Z0-9_]*|GEMINI_[A-Z0-9_]*|GOOGLE_[A-Z0-9_]*|DEEPSEEK_[A-Z0-9_]*|[A-Za-z0-9_]*[Pp][Rr][Oo][Xx][Yy])$/u;
const scrubbedInheritedEnvNames = Object.keys(process.env).filter((name) => SCRUB.test(name)).sort();
for (const name of scrubbedInheritedEnvNames) delete process.env[name];

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const allowedPort = /^\d+$/u.test(process.env.QANDEEL_CI01_DB_PORT ?? '') ? Number(process.env.QANDEEL_CI01_DB_PORT) : null;
const blockedAttempts = [];

function forbid(what) {
  blockedAttempts.push(what);
  const error = new Error(`QANDEEL_CI01_NETWORK_FORBIDDEN:${what}`);
  error.code = 'QANDEEL_CI01_NETWORK_FORBIDDEN';
  throw error;
}

function normalizeConnectArgs(args) {
  const first = args[0];
  if (first !== null && typeof first === 'object') {
    if (first.path) return { host: `pipe:${first.path}`, port: null };
    return { host: first.host ?? 'localhost', port: Number(first.port) };
  }
  if (typeof first === 'string' && !/^\d+$/u.test(first)) return { host: `pipe:${first}`, port: null };
  return { host: typeof args[1] === 'string' ? args[1] : 'localhost', port: Number(first) };
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const { host, port } = normalizeConnectArgs(args);
  if (!ALLOWED_HOSTS.has(host)) forbid(`net.connect:${host}:${port}`);
  if (allowedPort !== null && port !== allowedPort) forbid(`net.connect:${host}:${port}`);
  return originalConnect.apply(this, args);
};

globalThis.fetch = () => forbid('fetch');
http.request = () => forbid('http.request');
http.get = () => forbid('http.get');
https.request = () => forbid('https.request');
https.get = () => forbid('https.get');
http2.connect = () => forbid('http2.connect');
tls.connect = () => forbid('tls.connect');
dgram.createSocket = () => forbid('dgram.createSocket');

const RESOLVERS = ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolveSrv', 'resolveTxt', 'reverse'];
const originalLookup = dns.lookup;
dns.lookup = function guardedLookup(hostname, ...rest) {
  if (hostname !== 'localhost') forbid(`dns.lookup:${hostname}`);
  return originalLookup.call(this, hostname, ...rest);
};
for (const name of RESOLVERS) dns[name] = () => forbid(`dns.${name}`);
const originalPromisesLookup = dns.promises.lookup;
dns.promises.lookup = async function guardedPromisesLookup(hostname, ...rest) {
  if (hostname !== 'localhost') forbid(`dns.promises.lookup:${hostname}`);
  return originalPromisesLookup.call(this, hostname, ...rest);
};
for (const name of RESOLVERS) dns.promises[name] = async () => forbid(`dns.promises.${name}`);

function probe(name, attempt) {
  try {
    const result = attempt();
    // A thrower never returns; reaching here means the transport was NOT blocked.
    if (result && typeof result.then === 'function') result.then(() => undefined, () => undefined);
    if (result && typeof result.destroy === 'function') result.destroy();
    return { probe: name, outcome: 'NOT_BLOCKED' };
  } catch (error) {
    return error && error.code === 'QANDEEL_CI01_NETWORK_FORBIDDEN'
      ? { probe: name, outcome: 'BLOCKED' }
      : { probe: name, outcome: 'NOT_BLOCKED', error: String(error && error.message) };
  }
}

function selfTest() {
  const pipeName = ['\\\\', '.', '\\', 'pipe', '\\', 'qandeel-ci01-guard-probe'].join('');
  const probes = [
    probe('fetch', () => globalThis.fetch('https://example.invalid/')),
    probe('http.request', () => http.request('http://example.invalid/')),
    probe('http.get', () => http.get('http://example.invalid/')),
    probe('https.request', () => https.request('https://example.invalid/')),
    probe('https.get', () => https.get('https://example.invalid/')),
    probe('http2.connect', () => http2.connect('https://example.invalid')),
    probe('tls.connect', () => tls.connect({ host: 'example.invalid', port: 443 })),
    probe('dgram.createSocket', () => dgram.createSocket('udp4')),
    probe('dns.lookup', () => dns.lookup('example.invalid', () => undefined)),
    probe('dns.resolve4', () => dns.resolve4('example.invalid', () => undefined)),
    probe('net.connect:public-host', () => net.connect(443, 'example.invalid')),
    probe('net.connect:public-ip', () => net.connect({ host: '1.1.1.1', port: 53 })),
    probe('net.connect:named-pipe', () => net.connect({ path: pipeName })),
  ];
  if (allowedPort !== null) {
    probes.push(probe('net.connect:loopback-other-port', () => net.connect(allowedPort === 9 ? 10 : 9, '127.0.0.1')));
  }
  return { version: 'qandeel-ci01-network-guard-v1', allowedHosts: [...ALLOWED_HOSTS], allowedPort, probes,
    allBlocked: probes.every((entry) => entry.outcome === 'BLOCKED') };
}

globalThis.__QANDEEL_CI01_NETWORK_GUARD__ = Object.freeze({
  version: 'qandeel-ci01-network-guard-v1',
  scrubbedInheritedEnvNames,
  allowedHosts: [...ALLOWED_HOSTS],
  allowedPort,
  blockedAttempts,
  selfTest,
});
