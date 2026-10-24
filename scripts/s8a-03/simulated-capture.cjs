'use strict';
// S8A-03 CP3 readiness — the Personal Understanding capture answer of the LOCAL DeepSeek stand-in (operator-only; never a CI
// step; never imported by production code). Preloaded with `node --require` AFTER scripts/s8a-02/simulated-deepseek.cjs and
// BEFORE scripts/s8a-02/network-guard.cjs, so the guard still wraps the stand-in and counts, caps and settles every attempt
// exactly as it would a live one. Nothing leaves the process.
//
// The s8a-02 stand-in answers every request (fault injection, latency, usage from the request bytes). For a capture request
// (recognised by the first words of the capture system message) a well-formed answer has its content replaced with a
// deterministic capture JSON of the exact production shape: each clause of the message as one proposal, read naively from
// its words, with a few fixed search keys; every supplied Memory handle with the same naive reading. It is NOT a model and
// proves no quality: it makes the zero-cost run exercise the verifier, the 0171 write / index, the semantic read and the
// served context end to end. A fault the s8a-02 stand-in injected is passed through untouched.
const stub = globalThis.__QANDEEL_SIMULATED_DEEPSEEK__;
if (!stub || globalThis.fetch !== stub.fetch) throw new Error('SIMULATED_CAPTURE: scripts/s8a-02/simulated-deepseek.cjs must be preloaded first');
const CAPTURE_MARK = 'You read one message a user wrote to a personal companion.';
const DATA = /^<personal_understanding_data>([\s\S]*)<\/personal_understanding_data>$/u;
const counts = { captures: 0, replies: 0, passedThroughFaults: 0 };

// A few fixed search keys per topic word: what a model might add, so the simulated run reaches the semantic read.
const SIM_KEYS = [
  [/محاسب/u, ['مهنتي', 'وظيفتي'], 'OCCUPATION'], [/مهندس/u, ['وظيفتي'], 'OCCUPATION'], [/مدر[ّ]?س/u, ['وظيفتي', 'معلم', 'العيال'], 'OCCUPATION'],
  [/ممرض/u, ['شغلانتي'], 'OCCUPATION'], [/بنك|اتصالات|صيدلي|كول سنتر/u, ['بشتغل'], 'EMPLOYER'], [/ساكن|أسكن/u, ['عايش', 'مقيم', 'مدينة'], 'RESIDENCE'],
  [/بدخن/u, ['سجاير', 'بشرب'], 'SMOKING'], [/متجوز/u, ['جواز'], 'MARITAL_STATUS'], [/بنتين|ابنتان/u, ['عيال', 'كام'], null],
  [/ألماني/u, ['لغة', 'بتعلم', 'حاليا'], 'STUDY'], [/اسكواش/u, ['رياضة', 'بمارس'], null], [/قطة/u, ['حيوان', 'أليف', 'مربي'], null],
];
function reading(text) {
  const hit = SIM_KEYS.filter(([word]) => word.test(text));
  const negated = /(?:^|\s)(?:مش|لا|مبقتش)(?:\s|$)|(?:^|\s)م\S+ش(?:\s|$)/u.test(text);
  return {
    polarity: negated ? 'NEGATED' : 'AFFIRMED',
    modality: /[؟?]/u.test(text) ? 'QUESTION' : /(?:^|\s)(?:لو|إذا)(?:\s|$)/u.test(text) ? 'HYPOTHETICAL' : /نفسي/u.test(text) ? 'WISH' : 'STATED',
    temporal: /زمان|كنت/u.test(text) ? 'PAST' : /ناوي/u.test(text) ? 'PLANNED' : 'CURRENT',
    slot: hit.find(([, , slot]) => slot)?.[2] ?? null,
    keys: [...new Set(hit.flatMap(([, keys]) => keys))].slice(0, 16),
  };
}
function captureOf(data) {
  const message = data.currentUserText;
  const clauses = message === null ? [] : message.split(/[،,]/u).map((clause) => clause.trim()).filter((clause) => [...clause].length >= 4).slice(0, 3);
  return {
    facts: clauses.map((span) => {
      const r = reading(span);
      const subject = /(?:^|\s)(?:أخويا|أختي|أخويا|أبويا|مراتي|جوزي)(?:\s|$)/u.test(span) ? 'OTHER' : 'SELF';
      return { span, subject, polarity: r.polarity, modality: /[؟?]/u.test(message) ? 'QUESTION' : r.modality, temporal: r.temporal,
        type: r.temporal === 'PLANNED' || r.modality === 'WISH' ? 'GOAL' : 'PERSONAL_FACT', slot: r.slot, keys: r.keys };
    }),
    memories: data.memories.map((memory) => { const r = reading(memory.content); return { handle: memory.handle, slot: r.slot, temporal: r.temporal, keys: r.keys }; }),
  };
}

const inner = stub.fetch;
async function simulatedCaptureFetch(input, init) {
  const body = JSON.parse(init.body);
  const capture = String(body.messages?.[0]?.content ?? '').startsWith(CAPTURE_MARK);
  if (capture) counts.captures += 1; else counts.replies += 1;
  const faultsBefore = stub.counts.faults.length;
  const response = await inner(input, init);
  if (!capture) return response;
  if (stub.counts.faults.length !== faultsBefore) { counts.passedThroughFaults += 1; return response; }
  const json = await response.json();
  const data = JSON.parse(DATA.exec(body.messages.at(-1).content)[1]);
  const content = JSON.stringify(captureOf(data));
  json.choices[0].message.content = content;
  json.usage.completion_tokens = Math.max(1, Math.ceil(Buffer.byteLength(content) / 3));
  json.usage.total_tokens = json.usage.prompt_tokens + json.usage.completion_tokens;
  return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
}

stub.fetch = simulatedCaptureFetch;
stub.captureCounts = counts;
globalThis.fetch = simulatedCaptureFetch;
