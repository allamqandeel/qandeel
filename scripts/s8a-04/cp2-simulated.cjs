'use strict';
// S8A-04 CP2 — the answers of the LOCAL DeepSeek stand-in for the round-19 harness (operator-only; never a CI step; never
// imported by production code). Preloaded with `node --require` AFTER scripts/s8a-02/simulated-deepseek.cjs and BEFORE
// scripts/s8a-02/network-guard.cjs, so the guard still wraps the stand-in and counts, caps and settles every attempt exactly
// as it would a live one. Nothing leaves the process.
//
// Recognised by the first words of the system message, a well-formed answer has its content replaced with a deterministic
// answer of the production shape: the V2 reading (M1: one view of the last contribution's writer, revising that writer's
// existing meaning when there is one), the recall (M2: the newest current refs), the placement (M4: each new meaning near
// the first map place of its region, else its own region). Replies and the S8A-02 attribution reading keep the s8a-02
// stand-in's answers. It is NOT a model and proves no quality: it makes the zero-cost run exercise the services, the
// decoders, the accounting, the ledger and the stage ceilings end to end. A fault the s8a-02 stand-in injected is passed
// through untouched.
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (!stub || globalThis.fetch !== stub.fetch) throw new Error('CP2_SIMULATED: scripts/s8a-02/simulated-deepseek.cjs must be preloaded first');
const MARKS = {
  reading: 'You read one group conversation of a Shared World for the server',
  recall: 'You help the server choose what one Shared World already knows',
  placement: 'You place new meanings on the map of one Shared World',
};
const CONTAINERS = { reading: /^<shared_semantic_data>([\s\S]*)<\/shared_semantic_data>$/u, recall: /^<recall_data>([\s\S]*)<\/recall_data>$/u, placement: /^<placement_data>([\s\S]*)<\/placement_data>$/u };
const counts = { reading: 0, recall: 0, placement: 0, others: 0, passedThroughFaults: 0 };

function readingOf(data) {
  const last = data.contributions.at(-1);
  if (!last) return { places: [] };
  const own = data.existing.find((meaning) => meaning.holders.includes(last.from));
  const meaning = [...last.text].slice(0, 60).join('').trim();
  return { places: [{ meaning, primaryThemes: ['محادثة'], secondaryThemes: [], sourceRefs: [last.ref], lensKey: 'talk', nature: 'VIEW', holders: [last.from],
    relayedBy: [], about: [], hedged: false, ...(own ? { revises: own.ref } : {}) }] };
}
function recallOf(data) {
  return { refs: data.knowledge.filter((entry) => entry.current).slice(-3).map((entry) => entry.ref) };
}
function placementOf(data) {
  return { placements: data.new.map((meaning) => {
    const near = data.map.find((place) => place.region === meaning.region);
    return { new: meaning.ref, anchors: [near ? { to: near.ref, closeness: 1 } : { to: `R:${meaning.region}`, closeness: 2 }] };
  }) };
}
const ANSWER = { reading: readingOf, recall: recallOf, placement: placementOf };

const inner = stub.fetch;
async function cp2SimulatedFetch(input, init) {
  const body = JSON.parse(init.body);
  const system = String(body.messages?.[0]?.content ?? '');
  const kind = Object.keys(MARKS).find((key) => system.startsWith(MARKS[key])) ?? null;
  if (kind) counts[kind] += 1; else counts.others += 1;
  const faultsBefore = stub.counts.faults.length;
  const response = await inner(input, init);
  if (!kind) return response;
  if (stub.counts.faults.length !== faultsBefore) { counts.passedThroughFaults += 1; return response; }
  const json = await response.json();
  const content = JSON.stringify(ANSWER[kind](JSON.parse(CONTAINERS[kind].exec(body.messages.at(-1).content)[1])));
  json.choices[0].message.content = content;
  json.usage.completion_tokens = Math.max(1, Math.ceil(Buffer.byteLength(content) / 3));
  json.usage.total_tokens = json.usage.prompt_tokens + json.usage.completion_tokens;
  return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
}

stub.fetch = cp2SimulatedFetch;
stub.cp2Counts = counts;
globalThis.fetch = cp2SimulatedFetch;
