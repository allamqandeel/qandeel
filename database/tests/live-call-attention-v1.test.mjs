import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// INTEL-LIVE-01 CP1 - the call's provisional attention (migration 0204): the static database contract. Live semantics
// (coverage, fencing, idempotency, settlement, erasure) are proven against real PostgreSQL by
// database/verify-migration-0204.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const NAME = '0204_intel_live_01_call_attention_v1.sql';
const migration = read(`../migrations/${NAME}`);
const verifier = read('../verify-migration-0204.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const executable = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

test('0204 directly follows 0203, is the only 0204, and is one forward-only transaction', () => {
  const names = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(names.filter((n) => n.startsWith('0204_')).length, 1);
  assert.match(names[names.indexOf(NAME) - 1], /^0203_/u);
  assert.match(executable, /^BEGIN;$/mu);
  assert.match(executable, /COMMIT;\s*$/u);
  assert.doesNotMatch(executable, /\bDROP\s+(?:TABLE|FUNCTION|SCHEMA)\b/u, 'nothing earlier is dropped');
});

test('the lane owns three private tables and writes nothing durable outside them (no CU, Thread, Live Focus, Memory, clock)', () => {
  const created = [...executable.matchAll(/CREATE TABLE ([\w.]+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(created, ['voice_private.call_attention_evaluations', 'voice_private.call_attention_events', 'voice_private.call_attention_settlements']);
  const writes = [...executable.matchAll(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+([\w.]+)/gu)].map((m) => m[1]);
  for (const target of writes) {
    // The one exception: 0191's permit grant, widened by the kind PROVISIONAL_ATTENTION (its own permit rows).
    assert.ok(/^voice_private\.call_attention_|^voice_private\.background_provider_permits$|^account_erasure_private\.coverage_registry$/u.test(target), `0204 writes only its own tables (found ${target})`);
  }
  // Durable authorities are READ (settlement identifies Threads by id after the durable commit), never written: the write
  // targets above are the whole of what 0204 changes.
});

test('an attention event carries no transcript: a key, a bounded label, a kind, a confidence, an optional Thread id', () => {
  const events = executable.slice(executable.indexOf('CREATE TABLE voice_private.call_attention_events'), executable.indexOf('CREATE TABLE voice_private.call_attention_settlements'));
  assert.match(events, /char_length\(label\) BETWEEN 1 AND 40/u);
  assert.match(events, /subject_key ~ '\^\[a-z0-9\]\[a-z0-9_-\]\{0,63\}\$'/u);
  assert.doesNotMatch(events, /\b(?:transcript|content|text_content|words|interim|audio)\b\s+text/iu);
  const evaluations = executable.slice(executable.indexOf('CREATE TABLE voice_private.call_attention_evaluations'), executable.indexOf('CREATE TABLE voice_private.call_attention_events'));
  assert.doesNotMatch(evaluations, /\b(?:transcript|content|prompt|answer|words|interim)\b\s+text/iu, 'the coverage ledger stores no text');
});

test('the coverage outcomes are closed, and only success or an explicit miss advances the watermark', () => {
  for (const outcome of ['DEVELOPMENTS', 'NONE', 'TIMEOUT', 'REFUSED', 'PROVIDER_FAILED', 'DEFERRED_PERMIT', 'MISSED_HANDOVER', 'DEGRADED_SUSPENDED']) {
    assert.ok(executable.includes(`'${outcome}'`), `outcome ${outcome}`);
  }
  for (const written of ['RECORDED', 'ALREADY_COVERED', 'STALE_RESULT', 'STALE_AFTER_SETTLEMENT', 'STALE_AFTER_END', 'FENCED', 'NOT_FOUND']) {
    assert.ok(executable.includes(`'${written}'`), `writer outcome ${written}`);
  }
});

test('every function is SECURITY DEFINER with an empty search_path; only the public commands reach service_role', () => {
  const fns = [...executable.matchAll(/CREATE FUNCTION ([\w.]+)\(/gu)].map((m) => m[1]);
  assert.ok(fns.length >= 11);
  for (const header of executable.split('CREATE FUNCTION ').slice(1)) {
    const head = header.slice(0, header.indexOf('AS $$'));
    assert.match(head, /SECURITY DEFINER SET search_path = ''/u, `${header.slice(0, 60)} is definer with an empty path`);
  }
  assert.match(executable, /IF fn LIKE 'public\.%' AND EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'service_role'\) THEN\s+EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO service_role', fn\);/u);
  assert.doesNotMatch(executable, /GRANT [^;]* TO (?:anon|authenticated)\b/u, 'nothing reaches a client role');
});

test('the narrow widenings: the permit kind PROVISIONAL_ATTENTION and the cost family LIVE_ATTENTION_EVALUATION', () => {
  assert.match(executable, /'PROVISIONAL_ATTENTION'/u);
  assert.match(executable, /'LIVE_ATTENTION_EVALUATION'/u);
});

test('erasure coverage is registered for every new relation', () => {
  const registry = executable.slice(executable.indexOf('INSERT INTO account_erasure_private.coverage_registry'));
  for (const rel of ['call_attention_evaluations', 'call_attention_events', 'call_attention_settlements']) assert.ok(registry.includes(`voice_private.${rel}`), rel);
});

test('the verifier runs in CI against real PostgreSQL and the static contract is wired', () => {
  assert.equal(packageJson.scripts['verify:live-call-attention:integration'], 'node --env-file-if-exists=.env database/verify-migration-0204.mjs');
  assert.match(packageJson.scripts['test:live-call-attention-contract'], /database\/tests\/live-call-attention-v1\.test\.mjs/u);
  assert.match(workflow, /verify:live-call-attention:integration/u);
  assert.match(workflow, /test:live-call-attention-contract/u);
  assert.match(verifier, /const MIGRATION = '0204_intel_live_01_call_attention_v1\.sql';/u);
  assert.match(verifier, /runVerifier\('0204'/u);
});
