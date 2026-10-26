'use strict';
// S8A-04 CP3 — the answers of the LOCAL DeepSeek stand-in for the CP3 integrated proof (operator-only; never a CI step; never
// imported by production code). Preloaded with `node --require` AFTER scripts/s8a-02/simulated-deepseek.cjs and
// scripts/s8a-04/cp2-simulated.cjs and BEFORE scripts/s8a-02/network-guard.cjs, so the guard still wraps the stand-in and
// counts, caps and settles every attempt. Nothing leaves the process.
//
// CP3-D V2 (Controlled Amendment R4, Trusted Claim Spans):
//   * the disclosure check (recognised by the first words of CG-6b′, `<check_data>`): the deterministic rule of the API's own
//     test checker — a span ⟦Kn: …⟧ is ENTAILED when its predicate contains item Kn's exact words, otherwise ADDS; an item's
//     exact words OUTSIDE every span are an outside passage; nothing is sealed;
//   * a reply whose request carries the member-knowledge block (CG-6a′): it states each item that carries a claim ref inside
//     its span, ⟦ref: item⟧, in the item's own words, so the server's rendering and the lane's authorized-disclosure path are
//     exercised end to end; an item with no ref (no safe Name) is not stated at all — it may only inform the reply.
// Every other request keeps the earlier stand-ins' answers; a fault they injected is passed through untouched. It is NOT a
// model and proves no quality.
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (!stub || globalThis.fetch !== stub.fetch || !stub.cp2Counts) throw new Error('CP3_SIMULATED: simulated-deepseek.cjs and cp2-simulated.cjs must be preloaded first');
const CHECK_MARK = 'You check one reply written by QANDEEL in a group, for private items only.';
const CHECK_DATA = /^<check_data>([\s\S]*)<\/check_data>$/u;
const MEMBER_KNOWLEDGE = /<member_knowledge>([\s\S]*?)<\/member_knowledge>/u;
const counts = { judge: 0, mentioningReplies: 0, passedThroughFaults: 0 };

function checkOf(data) {
  const itemOf = new Map(data.items.map((entry) => [entry.id, entry.item]));
  const spans = [...data.reply.matchAll(/⟦(K[1-9][0-9]*)@?: ([^⟦⟧]*)⟧/gu)];
  const outsideText = data.reply.replace(/⟦K[1-9][0-9]*@?: [^⟦⟧]*⟧/gu, '\u0000');
  return {
    spans: spans.map((match) => ({ id: match[1], verdict: match[2].includes(itemOf.get(match[1]) ?? '\u0000') ? 'ENTAILED' : 'ADDS' })),
    outside: data.items.filter((entry) => outsideText.includes(entry.item)).map((entry) => ({ id: entry.id, passage: entry.item })),
    sealed: [],
  };
}
function mentioningReplyOf(entries) {
  const stated = entries.filter((entry) => typeof entry.ref === 'string');
  return stated.length === 0 ? 'فكرة حلوة، خلونا نكمل.' : `فكرة حلوة. ${stated.map((entry) => `⟦${entry.ref}: ${entry.item}⟧`).join('، ')}.`;
}

const inner = stub.fetch;
async function cp3SimulatedFetch(input, init) {
  const body = JSON.parse(init.body);
  const system = String(body.messages?.[0]?.content ?? '');
  const check = system.startsWith(CHECK_MARK);
  const knowledge = check ? null : MEMBER_KNOWLEDGE.exec(body.messages.map((message) => String(message.content ?? '')).join('\n'));
  const faultsBefore = stub.counts.faults.length;
  const response = await inner(input, init);
  if (!check && !knowledge) return response;
  if (stub.counts.faults.length !== faultsBefore) { counts.passedThroughFaults += 1; return response; }
  const json = await response.json();
  let content;
  if (check) {
    counts.judge += 1;
    content = JSON.stringify(checkOf(JSON.parse(CHECK_DATA.exec(body.messages.at(-1).content)[1])));
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
