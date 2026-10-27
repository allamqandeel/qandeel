'use strict';
// S8A-05 CP3 — Tier S: the LOCAL interpreter stand-in for the zero-cost harness rehearsals (operator-only; never a CI step;
// never imported by production code). Preloaded with `node --require` AFTER scripts/s8a-02/simulated-deepseek.cjs and
// BEFORE scripts/s8a-02/network-guard.cjs, so the guard still wraps it and counts, caps and settles every attempt. Nothing
// leaves the process. It is NOT a model and proves no quality: it proves that the driver scores, counts and accounts.
//
// QANDEEL_S8A05_TIER_S_SIM  oracle  answers each case's fixed labels (the driver publishes them on a global before each
//                                   call): the first expected sub-region (or the first acceptable major's first sub-region),
//                                   a compound's secondary major second, and the expected correction verdict. Expect the
//                                   deterministic half MET.
//                           lazy    every topic in everyday.moments, every correction CONSISTENT. Expect it NOT MET.
// A fault injected by simulated-deepseek.cjs (QANDEEL_EVAL_SIMULATED_FAULTS) is passed through untouched.
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (!stub || globalThis.fetch !== stub.fetch) throw new Error('S8A05_TIER_S_SIMULATED: simulated-deepseek.cjs must be preloaded first');
const MODE = process.env.QANDEEL_S8A05_TIER_S_SIM;
if (MODE !== 'oracle' && MODE !== 'lazy') throw new Error('S8A05_TIER_S_SIMULATED: QANDEEL_S8A05_TIER_S_SIM must be oracle or lazy');
const MARK = 'You read one public topic for QANDEEL';
const oracle = { current: null };
globalThis.__QANDEEL_S8A05_TIER_S_ORACLE__ = oracle;
const counts = { answers: 0, passedThroughFaults: 0 };

// The first sub-region of each major, in the vocabulary order (the driver's labels name keys; this only fills a THIN case).
const FIRST_OF = { romance: 'romance.attraction', marriage: 'marriage.daily_life', parenthood: 'parenthood.raising', family: 'family.parents',
  social: 'social.friendship', work: 'work.pressure', learning: 'learning.exams', transitions: 'transitions.migration', meaning: 'meaning.faith',
  loss: 'loss.grief', health: 'health.illness', inner: 'inner.anxiety', everyday: 'everyday.moments' };

function regionsOf(c) {
  if (MODE === 'lazy') return [{ key: 'everyday.moments', weight: 1 }];
  const dominant = c.expected.subRegions[0] ?? FIRST_OF[(c.expected.major ?? c.expected.acceptableMajors[0])];
  if (!c.compound) return [{ key: dominant, weight: 1 }];
  return [{ key: dominant, weight: 0.7 }, { key: FIRST_OF[c.compound.secondaryMajor], weight: 0.3 }];
}

function answerOf(expected) {
  if (expected.kind === 'PROPOSAL') {
    return { meaning: 'موضوع تجريبي', primaryThemes: ['تجربة'], secondaryThemes: [], explanation: 'قراءة تجريبية محلية.', placementIntent: { regions: regionsOf(expected.case) } };
  }
  const verdict = MODE === 'lazy' ? 'CONSISTENT' : expected.correction.expected;
  return verdict === 'CONSISTENT' ? { verdict, placementIntent: { regions: regionsOf(expected.case) } } : { verdict };
}

const inner = stub.fetch;
async function tierSSimulatedFetch(input, init) {
  const body = JSON.parse(init.body);
  const ours = String(body.messages?.[0]?.content ?? '').startsWith(MARK);
  const faultsBefore = stub.counts.faults.length;
  const response = await inner(input, init);
  if (!ours) return response;
  if (stub.counts.faults.length !== faultsBefore) { counts.passedThroughFaults += 1; return response; }
  if (!oracle.current) throw new Error('S8A05_TIER_S_SIMULATED: the driver published no case');
  counts.answers += 1;
  const json = await response.json();
  const content = JSON.stringify(answerOf(oracle.current));
  json.choices[0].message.content = content;
  json.usage.completion_tokens = Math.max(1, Math.ceil(Buffer.byteLength(content) / 3));
  json.usage.total_tokens = json.usage.prompt_tokens + json.usage.completion_tokens;
  return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
}

stub.fetch = tierSSimulatedFetch;
stub.s8a05TierSCounts = counts;
globalThis.fetch = tierSSimulatedFetch;
