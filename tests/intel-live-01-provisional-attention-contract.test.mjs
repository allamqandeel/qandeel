import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// INTEL-LIVE-01 CP1 - the provisional attention lane's static source contract (Product Owner Final Execution
// Authorization, 2026-11-25; CP0 v1.0 -> v1.1 -> A1 -> A2). It pins what the acceptance interpretations require of the
// code's shape: DeepSeek decides (no threshold of time, words or keywords gates understanding), INTERIM never leaves the
// recognizer, nothing provisional is durable outside 0204, voice/ stays provider-free, and the voice path never waits.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const code = (source) => source.split('\n').filter((line) => !/^\s*(?:\/\/|\*|\/\*)/u.test(line)).join('\n');
const LANE = 'apps/api/src/live-attention/';
const laneFiles = readdirSync(new URL(`../${LANE}`, import.meta.url)).filter((n) => n.endsWith('.ts') && !n.endsWith('.spec.ts'));
const lane = Object.fromEntries(laneFiles.map((n) => [n, read(`${LANE}${n}`)]));
const tracker = read(`${LANE}call-attention.tracker.ts`);
const types = read(`${LANE}provisional-attention.types.ts`);
const provider = read(`${LANE}live-attention.provider.ts`);
const engine = read('apps/api/src/voice/call-turn/live-call-turn.engine.ts');
const reply = read('apps/api/src/voice/call-turn/call-reply.ts');
const port = read('apps/api/src/voice/call-turn/live-call-attention.port.ts');
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const worker = read('apps/api/src/live-analysis/call-analysis.worker.ts');

test('no threshold of time, word count or keyword decides whether understanding happens', () => {
  const config = types.slice(types.indexOf('export const DEFAULT_PROVISIONAL_ATTENTION_CONFIG'), types.indexOf('});', types.indexOf('export const DEFAULT_PROVISIONAL_ATTENTION_CONFIG')));
  const keys = [...config.matchAll(/^\s+(\w+):/gmu)].map((m) => m[1]).sort();
  assert.deepEqual(keys, ['backoffMs', 'emergencyCallSpendUsd', 'evaluatorTimeoutMs', 'failuresBeforeBackoff', 'maxOpenSubjects', 'maxThreads',
    'maxTurnTextWords', 'overloadedFailuresBeforeDegraded', 'permitRetryMs'], 'backpressure and the context bound only (A1 D-6 withdrawn)');
  assert.match(config, /emergencyCallSpendUsd: null,/u, 'the emergency guard is disabled by default (A2 §1)');
  const body = code(tracker);
  assert.doesNotMatch(body, /\b(?:minWords|minMs|debounce|silenceMs|idleMs|keyword|KEYWORDS|stopWords|threshold)\b/iu);
  assert.doesNotMatch(body, /\.test\(\s*(?:unit|u|h)?\.?text\b|text\.(?:includes|match|startsWith)\(/u, 'the tracker never filters by the words');
  // The span is ALL pending evidence; maxTurnTextWords only splits it into whole sub-spans, never drops or delays one.
  assert.match(body, /if \(units\.length > 0 && words \+ n > this\.config\.maxTurnTextWords\) break;/u);
  assert.match(body, /private kick\(\): void \{\n\s+if \(this\.stopped \|\| !this\.ready \|\| this\.inFlight \|\| this\.retry !== null\) return;/u);
});

test('only success or an explicit miss covers evidence; a failure leaves it pending', () => {
  const body = code(tracker);
  assert.match(body, /if \(w\.outcome === 'MISSED_HANDOVER' \|\| w\.outcome === 'DEGRADED_SUSPENDED'\) \{\n\s+this\.cover\(/u);
  assert.match(body, /if \(result === null \|\| w\.outcome === 'DEFERRED_PERMIT'\) return;/u);
  // TIMEOUT / REFUSED / PROVIDER_FAILED: counted toward the backoff, never covered.
  assert.match(body, /ledger\.failures \+= 1;\n\s+if \(ledger\.failures >= this\.config\.failuresBeforeBackoff\) ledger\.backoffUntil = this\.now\(\) \+ this\.config\.backoffMs;/u);
});

test('INTERIM never leaves the recognizer: only a FINAL is handed to the lane, at exactly one site', () => {
  assert.match(engine, /if \(event\.kind !== 'FINAL' \|\| event\.speech\.text\.trim\(\) === ''\) continue;\n\s+this\.finals\.push\(event\.speech\);\n\s+this\.attend\(event\.speech\);/u);
  assert.equal((code(engine).match(/this\.attend\(/gu) ?? []).length, 1);
  assert.equal((code(engine).match(/evidence\('USER'/gu) ?? []).length, 2, 'attend and the held-evidence release');
  assert.doesNotMatch(code(engine).slice(code(engine).indexOf('private attend(')), /INTERIM/u);
  // QANDEEL evidence is a whole piece the phone confirmed it played (its range ends at or before the heard mark).
  assert.match(reply, /if \(range\.endMs > this\.markMs\) return;/u);
});

test('the voice path never waits for the lane; only the bounded hand-over flush awaits it', () => {
  const body = code(engine);
  assert.deepEqual(body.match(/await this\.attention[^;]*;/gu), ['await this.attention?.handover();']);
  assert.match(port, /evidence\(track: LiveCallAttentionTrack, text: string, clockStartMs: number, clockEndMs: number\): void;/u);
  assert.match(port, /turnCommitted\(\): void;/u);
  assert.match(reply, /readonly heard\?: \(text: string, clockStartMs: number, clockEndMs: number\) => void;/u);
  // The analysis worker never awaits the attention settlement on its queue.
  assert.match(worker, /this\.track\(attention\.settle\(claim\.userId, claim\.callId, claim\.callTurnIndex, claim\.half\)\.then\(\(\) => undefined, \(\) => undefined\)\);/u);
});

test('voice/ stays provider-free and permit-free: the port imports nothing but Nest, the engine nothing of the lane', () => {
  assert.deepEqual([...port.matchAll(/^import .* from '([^']+)';$/gmu)].map((m) => m[1]), ['@nestjs/common']);
  for (const [name, source] of [['engine', engine], ['reply', reply]]) {
    const imports = [...source.matchAll(/^import [^;]* from '([^']+)';$/gmu)].map((m) => m[1]);
    assert.ok(imports.every((from) => !/live-attention|deepseek|model-router|background-permits/u.test(from)), `${name} imports nothing of the lane`);
    assert.doesNotMatch(code(source), /process\.env/u, `${name} reads no configuration`);
  }
});

test('nothing provisional is durable outside 0204, nothing is logged, the lane is OFF unless switched ON', () => {
  for (const [name, source] of Object.entries(lane)) {
    const rpcs = [...source.matchAll(/rpc(?:<[^>]*>)?\('([^']+)'/gu)].map((m) => m[1]);
    for (const rpc of rpcs) assert.match(rpc, /^server_(?:record|read|settle|settle_due)_call_attention_\w+_v1$|^server_settle_call_attention_v1$|^server_settle_due_call_attention_v1$/u, `${name} calls only 0204 (${rpc})`);
    assert.doesNotMatch(code(source), /console\.|Logger|\.log\(/u, `${name} logs nothing`);
  }
  assert.match(provider, /if \(environment\[LIVE_CALL_PROVISIONAL_ATTENTION_ENV\]\?\.trim\(\) !== 'ON'\) return null;/u);
  assert.match(conversationModule, /process\.env\.NODE_ENV === 'test' \? null : productionLiveCallAttention\(process\.env, serviceApi, permits\)/u);
});

test('DeepSeek is the semantic authority, behind the SYNTHETIC_ONLY gate, through one accounted client', () => {
  const evaluator = read(`${LANE}deepseek-attention-evaluator.ts`);
  assert.match(evaluator, /assertDeepSeekFlashSelection\(environment, 'LIVE_ATTENTION'\);/u);
  assert.match(evaluator, /requireDeepSeekQualification\(environment, /u);
  assert.match(provider, /costLedgerDecorator\('LIVE_ATTENTION_EVALUATION'\)\(createDeepSeekClient\(config\)\)/u);
  assert.match(types, /export type AttentionTrack = 'USER' \| 'QANDEEL';/u);
});
