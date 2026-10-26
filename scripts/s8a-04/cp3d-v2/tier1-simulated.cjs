'use strict';
// S8A-04 CP3-D V2 — Tier 1: the LOCAL checker stand-in for the zero-cost harness proofs (operator-only; never a CI step;
// never imported by production code). Preloaded with `node --require` AFTER scripts/s8a-02/simulated-deepseek.cjs and BEFORE
// scripts/s8a-02/network-guard.cjs, so the guard still wraps it and counts, caps and settles every attempt. Nothing leaves
// the process. It is NOT a model and proves no quality: it proves that the driver scores, counts and accounts correctly.
//
// QANDEEL_CP3D_V2_SIM  oracle  answers what each case expects (the driver publishes it on a global before each call): a
//                              BLOCK case gets ADDS on its first span, or — with no span — the whole reply reported as an
//                              outside passage; an ALLOW case gets every span ENTAILED and nothing reported. Expect ACCEPTED.
//                      silent  every span ENTAILED and nothing reported (a checker that never sees anything). Expect every
//                              BLOCK case to LEAK, and NOT ACCEPTED.
// A fault injected by simulated-deepseek.cjs (QANDEEL_EVAL_SIMULATED_FAULTS: HANG / HTTP500 / MALFORMED / INVALID @ n) is
// passed through untouched, so the driver's INVALID accounting is exercised on the adapter's own failure paths.
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (!stub || globalThis.fetch !== stub.fetch) throw new Error('CP3D_V2_T1_SIMULATED: simulated-deepseek.cjs must be preloaded first');
const MODE = process.env.QANDEEL_CP3D_V2_SIM;
if (MODE !== 'oracle' && MODE !== 'silent') throw new Error('CP3D_V2_T1_SIMULATED: QANDEEL_CP3D_V2_SIM must be oracle or silent');
const CHECK_MARK = 'You check one reply written by QANDEEL in a group, for private items only.';
const CHECK_DATA = /^<check_data>([\s\S]*)<\/check_data>$/u;
const oracle = { current: null };
globalThis.__QANDEEL_CP3D_V2_ORACLE__ = oracle;
const counts = { checks: 0, passedThroughFaults: 0 };

function answerOf(data) {
  const spans = [...data.reply.matchAll(/⟦(K[1-9][0-9]*)@?: [^⟦⟧]*⟧/gu)].map((match) => match[1]);
  const block = MODE === 'oracle' && oracle.current?.expected === 'BLOCK';
  if (!block) return { spans: spans.map((id) => ({ id, verdict: 'ENTAILED' })), outside: [], sealed: [] };
  if (spans.length > 0) return { spans: spans.map((id, i) => ({ id, verdict: i === 0 ? 'ADDS' : 'ENTAILED' })), outside: [], sealed: [] };
  return { spans: [], outside: [{ id: data.items[0].id, passage: data.reply }], sealed: [] };
}

const inner = stub.fetch;
async function tier1SimulatedFetch(input, init) {
  const body = JSON.parse(init.body);
  const check = String(body.messages?.[0]?.content ?? '').startsWith(CHECK_MARK);
  const faultsBefore = stub.counts.faults.length;
  const response = await inner(input, init);
  if (!check) return response;
  if (stub.counts.faults.length !== faultsBefore) { counts.passedThroughFaults += 1; return response; }
  counts.checks += 1;
  const json = await response.json();
  const content = JSON.stringify(answerOf(JSON.parse(CHECK_DATA.exec(body.messages.at(-1).content)[1])));
  json.choices[0].message.content = content;
  json.usage.completion_tokens = Math.max(1, Math.ceil(Buffer.byteLength(content) / 3));
  json.usage.total_tokens = json.usage.prompt_tokens + json.usage.completion_tokens;
  return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
}

stub.fetch = tier1SimulatedFetch;
stub.cp3dV2Tier1Counts = counts;
globalThis.fetch = tier1SimulatedFetch;
