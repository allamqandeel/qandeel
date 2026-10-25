'use strict';
// S8A-04 CP3 — the answers of the LOCAL DeepSeek stand-in for the CP3 integrated proof (operator-only; never a CI step; never
// imported by production code). Preloaded with `node --require` AFTER scripts/s8a-02/simulated-deepseek.cjs and
// scripts/s8a-04/cp2-simulated.cjs and BEFORE scripts/s8a-02/network-guard.cjs, so the guard still wraps the stand-in and
// counts, caps and settles every attempt. Nothing leaves the process.
//
//   * the disclosure judge (recognised by the first words of CG-6b): the deterministic rule of the API's own test judge —
//     an item whose exact words appear in the reply is stated and tied to a person, to its owner when the owner's token
//     appears too; anything else is nothing;
//   * a reply whose request carries the member-knowledge block (CG-6a): it mentions each item as its member's, in the
//     item's own words, so the lane's authorized-disclosure path is exercised end to end.
// Every other request keeps the earlier stand-ins' answers; a fault they injected is passed through untouched. It is NOT a
// model and proves no quality.
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (!stub || globalThis.fetch !== stub.fetch || !stub.cp2Counts) throw new Error('CP3_SIMULATED: simulated-deepseek.cjs and cp2-simulated.cjs must be preloaded first');
const JUDGE_MARK = 'You check one reply written by QANDEEL in a group. You are given that reply and the private items of ONE member (OWNER).';
const JUDGE_DATA = /^<judge_data>([\s\S]*)<\/judge_data>$/u;
const MEMBER_KNOWLEDGE = /<member_knowledge>([\s\S]*?)<\/member_knowledge>/u;
const counts = { judge: 0, mentioningReplies: 0, passedThroughFaults: 0 };

function judgeOf(data) {
  return { items: data.items.map((entry) => {
    const stated = data.reply.includes(entry.item);
    return { ref: entry.ref, findings: stated ? ['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION'] : [],
      attributedTo: stated && data.reply.includes(data.owner) ? 'OWNER' : 'NONE', unsupportedOwnerClaim: false };
  }) };
}
function mentioningReplyOf(entries) {
  return `فكرة حلوة. ${entries.map((entry) => `${entry.member}: ${entry.item}`).join('، ')}.`;
}

const inner = stub.fetch;
async function cp3SimulatedFetch(input, init) {
  const body = JSON.parse(init.body);
  const system = String(body.messages?.[0]?.content ?? '');
  const judge = system.startsWith(JUDGE_MARK);
  const knowledge = judge ? null : MEMBER_KNOWLEDGE.exec(body.messages.map((message) => String(message.content ?? '')).join('\n'));
  const faultsBefore = stub.counts.faults.length;
  const response = await inner(input, init);
  if (!judge && !knowledge) return response;
  if (stub.counts.faults.length !== faultsBefore) { counts.passedThroughFaults += 1; return response; }
  const json = await response.json();
  let content;
  if (judge) {
    counts.judge += 1;
    content = JSON.stringify(judgeOf(JSON.parse(JUDGE_DATA.exec(body.messages.at(-1).content)[1])));
  } else {
    counts.mentioningReplies += 1;
    content = mentioningReplyOf(JSON.parse(knowledge[1]));
  }
  json.choices[0].message.content = content;
  json.usage.completion_tokens = Math.max(1, Math.ceil(Buffer.byteLength(content) / 3));
  json.usage.total_tokens = json.usage.prompt_tokens + json.usage.completion_tokens;
  return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
}

stub.fetch = cp3SimulatedFetch;
stub.cp3Counts = counts;
globalThis.fetch = cp3SimulatedFetch;
