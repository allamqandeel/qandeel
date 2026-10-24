'use strict';
// S8A-04 CP1 — the Shared semantic reading answer of the LOCAL DeepSeek stand-in (operator-only; never a CI step; never
// imported by production code). Preloaded with `node --require` AFTER scripts/s8a-02/simulated-deepseek.cjs and BEFORE
// scripts/s8a-02/network-guard.cjs, so the guard still wraps the stand-in and counts, caps and settles every attempt exactly
// as it would a live one. Nothing leaves the process.
//
// For a Shared reading request (recognised by the first words of its system message, both arms) a well-formed answer has its
// content replaced with a deterministic reading of the production shape: no place when the World already holds a meaning,
// otherwise one place read from the first two contributions. It is NOT a model and proves no quality: it makes the
// zero-cost run exercise the adapter, the decoder, the accounting and the local ledger end to end. A fault the s8a-02
// stand-in injected is passed through untouched.
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (!stub || globalThis.fetch !== stub.fetch) throw new Error('SIMULATED_SOCIAL_READING: scripts/s8a-02/simulated-deepseek.cjs must be preloaded first');
const READING_MARK = 'You read one group conversation of a Shared World for the server';
const DATA = /^<shared_semantic_data>([\s\S]*)<\/shared_semantic_data>$/u;
const counts = { readings: 0, others: 0, passedThroughFaults: 0 };

function readingOf(data) {
  if (data.existing.length > 0) return { places: [] };
  const refs = data.contributions.slice(0, 2).map((contribution) => contribution.ref);
  const meaning = [...data.contributions[0].text].slice(0, 60).join('').trim();
  return { places: [{ meaning, primaryThemes: ['محادثة'], secondaryThemes: [], sourceRefs: refs, lensKey: 'plans' }] };
}

const inner = stub.fetch;
async function simulatedSocialReadingFetch(input, init) {
  const body = JSON.parse(init.body);
  const reading = String(body.messages?.[0]?.content ?? '').startsWith(READING_MARK);
  if (reading) counts.readings += 1; else counts.others += 1;
  const faultsBefore = stub.counts.faults.length;
  const response = await inner(input, init);
  if (!reading) return response;
  if (stub.counts.faults.length !== faultsBefore) { counts.passedThroughFaults += 1; return response; }
  const json = await response.json();
  const content = JSON.stringify(readingOf(JSON.parse(DATA.exec(body.messages.at(-1).content)[1])));
  json.choices[0].message.content = content;
  json.usage.completion_tokens = Math.max(1, Math.ceil(Buffer.byteLength(content) / 3));
  json.usage.total_tokens = json.usage.prompt_tokens + json.usage.completion_tokens;
  return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
}

stub.fetch = simulatedSocialReadingFetch;
stub.socialReadingCounts = counts;
globalThis.fetch = simulatedSocialReadingFetch;
