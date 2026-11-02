# QANDEEL — S8B-04 QANDEEL's Voice — Implementation Record v1

**Task:** S8B-04 — QANDEEL's Voice (Stage 8B). This record covers **CP1 — Server & Intelligence** (§1 … §10, merged) and
**CP2 — the automatic voice reply and the Fast Voice Path, S8B-04's closing change** (§11).
**Status:** `S8B-04 CLOSED / READY FOR THE PRODUCT OWNER'S MERGE DECISION (2026-11-02, the CP2 closing change; §11) — CP1 MERGED THROUGH PR #372 AS 54b5333e — CP2 ON s8b/s8b-04-cp2 AS A DRAFT PULL REQUEST, NOT MERGED (MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج») — THE PAID RUNS (D-S5, SPEECHMATICS REALTIME QUALITY, P-1) NOT RUN, NOT AUTHORIZED — MIGRATIONS 0187 AND 0188 NOT HOSTED — ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL, NO PRODUCTION RESOURCE — NOT USER-READY`
**Date:** 2026-11-01 (CP1); 2026-11-02 (CP2)
**Branch / base:** CP1 `s8b/s8b-04-cp1`, from `main` at `71b1088be761c7aaa558a264fa34b796558085e9`, merged through PR #372 as
`54b5333e`; CP2 `s8b/s8b-04-cp2`, from `main` at `54b5333e`.
**Authority:** the Product Owner's *QANDEEL — S8B-04 CP1 — Server & Intelligence — QANDEEL's Voice* authorization
(2026-11-01), which approved the WP0 Research & Execution Contract v1.2 (consolidated) and the L-0 results report, and
authorized **CP1 only** (§1). The contract and the L-0 report are the Product Owner's local review files
(`E:\QANDEEL_REPORTS\S8B-04\`); this record carries what binds from them. The provider decision is narrowed by the
[VA-11R controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-04_VA-11R_TTS_ABUSE_MONITORING_CONTROLLED_AMENDMENT_v1.0.md).
**Not a phase:** S8B-04 is a Stage 8B task, not a Connected Worlds phase. CP1 did not close it; CP2 is its closing change
(BG-08 / BG-09, §11.11).

---

## 1. The Product Owner's approval (2026-11-01), recorded as binding

| # | Decision |
|---|---|
| P-01 | **Provider:** Google Cloud only (`aiplatform.googleapis.com`), `gemini-3.8-flash-tts`, voice `Achird`. No AI Studio, no fallback, no other model or voice. |
| P-02 | **VA-11R:** flagged prompts may be retained up to 90 days and possibly reviewed by authorized Google staff; no training; no extension beyond TTS. |
| P-03 | **Diacritization:** the composite path C, very selective. A name or a reading Gemini already gets right is never diacritized. |
| P-04 | **Tone:** six expressions (CALM, JOY, PLAYFUL, SURPRISE, EMPATHY, SERIOUS) from the SAME DeepSeek generation, CALM by default; no classifier, no extra call. |
| P-05 | **Listen:** voice-message replies only; paid creation separate from fetching; a temporary store of 15 minutes; never a recording, never a Replay source. |
| P-06 | **Per-user name pronunciation:** out of scope (Future Improvements, not a backlog item). |
| P-07 | **Copy Gate for CP1:** TM-01, TM-02, TM-03, S-01 … S-06, VOICE_RECORDING_V2 K-01 … K-15, and the failure line F-01 alone, APPROVED verbatim (§2). |
| P-08 | **PROPOSED values are tunable configuration, not proof of capacity** (queue, breaker, timeouts, TTL bounds). |
| P-09 | **Markup:** fix the DeepSeek markup issue during implementation — fail closed, no extra call, no substitute reply. |
| P-10 | **Limits:** CP1 only. No merge without «ادمج». Free read-only Google Cloud checks only; no project setting changed, no key revoked, no paid service created; any manual change is presented first. No GET starts a paid operation. No new audio file. Not P-1, not any paid Google or DeepSeek call, not any Voice Gate, not production, not the mobile UI or CP2, not Realtime calls / barge-in / Replay, not a provider / model / voice change. |

H26 (the L-0 confirmation point) is **not** answered by the authorization and stays pending (§8).

## 2. Product Copy Gate — 25 rows APPROVED verbatim for CP1 (2026-11-01)

Each row is byte-identical in the code that uses it; `tests/s8b-04-qandeel-voice-contract.test.mjs` pins every row of this
section to the code (a `\|` in a cell is a literal bar). The Listen UI rows (contract §11.2) are **not** approved and are
not in CP1.

### 2.1 Model-facing texts (English only, never shown) — `apps/api/src/conversation/behavioral-response-policy.service.ts`

TM-01 is appended to a VOICE_NOTE turn's guidance; TM-03 only when the hint policy is not `OFF` (CP1: `OFF` until P-1);
TM-02 is the spoken-call text S8B-05 consumes and is wired nowhere in S8B-04.

| ID | State | Text |
|---|---|---|
| TM-01 | APPROVED | Begin your answer with one line exactly in the form [[speech:STYLE]], where STYLE is one of CALM, JOY, PLAYFUL, SURPRISE, EMPATHY or SERIOUS: the delivery that best fits how this reply would sound if spoken aloud. Prefer CALM unless the moment clearly calls for another. Never mention or explain this line. Then write your reply as usual. |
| TM-02 | APPROVED | This reply will be spoken aloud. Keep it short and easy to follow by ear: plain sentences, with no lists, headings, markdown, links or symbols. Say numbers, dates and times the way they are spoken. End at a natural point; the user may interrupt at any time. |
| TM-03 | APPROVED | Right after any sentence of your reply that contains a word you intend in its less common reading, one a reader would likely misread without vowel marks in a way that changes the meaning, add a marker in the form [[say:WORD]], writing that word exactly as it appears in the sentence with only the diacritics needed for the intended reading. Do not mark a word used in its usual reading. Mark at most two words in a sentence, separated by \|. Mark a word only when you are certain of its intended reading; if you are not certain, mark nothing. Never mark the name of a person or a place. Never mention or explain these markers. |

### 2.2 Style sentences (reach TTS only) — `apps/api/src/speech-rendering/speech-styles.ts`

| ID | State | Expression | Style sentence |
|---|---|---|---|
| S-01 | APPROVED | CALM | warm, friendly and natural, like a close friend talking casually; relaxed pace |
| S-02 | APPROVED | JOY | warm and genuinely happy for a friend, natural, never over the top |
| S-03 | APPROVED | PLAYFUL | teasing gently, joking, smiling |
| S-04 | APPROVED | SURPRISE | amazed, light and friendly |
| S-05 | APPROVED | EMPATHY | gentle and caring, at a natural pace, not dramatic |
| S-06 | APPROVED | SERIOUS | calm, clear and steady, serious without being cold |

### 2.3 Consent, version `VOICE_RECORDING_V2` — `apps/api/src/voice-media/voice-consent-text.ts`; installed by `0187`

The one current version from `0187` until `0188` (CP2), which installs `VOICE_RECORDING_V3` (§11.3) and keeps V2, unchanged,
as history. `VOICE_RECORDING_V1` (C-01 … C-11) stays installed, unchanged, as history; a
grant of V1 is no longer current consent. Digests (UTF-8, rows joined by `\n`): Arabic
`84b546b49ed718f683bc38388c9191310da125b853a6d6d0e2a97466d3141740`, English
`c3297ff4142651fb7b175060172c92769570ca636ec3f0572d15bb479dc5ccce`, required by `0187`'s deploy guard.

| ID | State | Arabic | English |
|---|---|---|---|
| K-01 | APPROVED | التسجيل الصوتي وصوت قنديل | Voice recording and Qandeel's voice |
| K-02 | APPROVED | تُحفظ كل رسالة صوتية تُرسل إلى قنديل تسجيلًا صوتيًا. وإذا استخدمت المكالمات مع قنديل عند توفرها، تُحفظ كل مكالمة تسجيلًا صوتيًا يشمل صوت قنديل كما سُمع فيها. | Each voice message sent to Qandeel is kept as an audio recording. If you use calls with Qandeel once they're available, each call is kept as an audio recording that includes Qandeel's voice as heard in it. |
| K-03 | APPROVED | تُحفظ الرسالة الصوتية 30 يومًا من وصولها إلى قنديل، وتُحفظ المكالمة 30 يومًا من بدايتها، ثم يُحذف التسجيل تلقائيًا. ويمكن حذف أي تسجيل قبل ذلك. | A voice message is kept for 30 days after it reaches Qandeel, and a call for 30 days from its start; then the recording is deleted automatically. Any recording can be deleted sooner. |
| K-04 | APPROVED | يُحوَّل الكلام إلى نص يفهمه قنديل ويرد عليه، ويمكن الاستماع إلى التسجيل طوال مدة حفظه. | Speech is converted to text that Qandeel understands and replies to, and the recording can be listened to while it's kept. |
| K-05 | APPROVED | عندما يصبح الصوت متاحًا في إعادة عرض المحادثة، يمكن استخدام التسجيل فيها خلال مدة حفظه، وبطلب منك فقط. | When audio becomes available in Conversation replay, a recording can be used in it while it's kept, and only when you ask. |
| K-06 | APPROVED | يبقى النص المستخرج في المحادثة بعد حذف التسجيل أو انتهاء مدته، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه. | The transcribed text stays in the conversation after the recording is deleted or expires, and what Qandeel remembers from it stays until it's corrected or forgotten on request. |
| K-07 | APPROVED | تحوّل خدمة Speechmatics الكلام إلى نص، ويطلب قنديل منها حذف التسجيل بعد التحويل مباشرة. | Speechmatics converts speech to text, and Qandeel asks it to delete the recording right after conversion. |
| K-08 | APPROVED | عند الضغط على «استمع»، وفي المكالمات عند توفرها، يُرسل نص رد قنديل إلى Google لتحويله إلى صوت. ولا تُرسل تسجيلاتك إلى Google. وقد يتضمن نص الرد شيئًا مما قلته. | When you press Listen, and in calls once they're available, the text of Qandeel's reply is sent to Google to turn it into speech. Your recordings aren't sent to Google. The reply text may include something you said. |
| K-09 | APPROVED | لا تستخدم Google هذا النص لتدريب نماذجها. وقد تحتفظ بالنصوص التي ترصدها أنظمتها كإساءة استخدام محتملة مدة تصل إلى 90 يومًا، وقد يراجعها موظفون مخوّلون لديها وفق شروط خدمتها. | Google doesn't use this text to train its models. It may keep text its systems flag as possible misuse for up to 90 days, and authorized Google staff may review it under Google's service terms. |
| K-10 | APPROVED | لا يراجع أحد في قنديل تسجيلاتك أو محتواك الصوتي. | No one at Qandeel reviews your recordings or voice content. |
| K-11 | APPROVED | قد يلتقط التسجيل أصواتًا قريبة. | A recording may capture nearby voices. |
| K-12 | APPROVED | النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها. | A downloaded or shared copy leaves Qandeel and cannot be recalled. |
| K-13 | APPROVED | يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة والمكالمات و«استمع»، ولا يحذف التسجيلات الحالية. | Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages, calls and Listen, and doesn't delete existing recordings. |
| K-14 | APPROVED | أوافق وأتابع | Agree and continue |
| K-15 | APPROVED | ليس الآن | Not now |

### 2.4 The fixed spoken failure line — `apps/api/src/voice/failure-line/spoken-failure-line.ts`

One line for both cases (audio never started; audio cut off). Spoken in the reply's language. CP1 ships the contract and
the structure only: `apps/api/fixtures/voice-tts/manifest.json` is `NOT_INSTALLED`, with no audio file.

| ID | State | Arabic | English |
|---|---|---|---|
| F-01 | APPROVED | تعذّر إكمال الرد الصوتي. الكتابة متاحة. | The spoken reply couldn't be completed. Writing is available. |

## 3. What CP1 implements (scope A … H)

**A. Speech rendering** — `apps/api/src/speech-rendering/` (pure, provider-free):
- `S8B-04-SR-v1`, a closed list of transforms on a speech-only copy, each recorded as a span: formatting and links removed
  (SR-F1), `<` / `>` neutralized (SR-F2), numbers, dates, times, percentages and counted amounts as words in Arabic
  replies (SR-N1, L-0 4 / 4), the lexicon (SR-L1), validated hints (SR-D1), segmentation at whitespace (SR-S1: first
  segment ≤ 120 characters, then ≤ 240, at most 16); the visible, stored and remembered text is never changed;
- the pronunciation lexicon `S8B-04-A2-v1`: the four L-0 candidates (each a non-default reading L-0 proved misread),
  each firing only on its exact undiacritized spelling with its context cue, built and tested, **all `enabled: false`**
  until P-1;
- the protection rules: no name, no foreign word, no common reading is ever vocalized; a word already diacritized is
  never touched; a hint on a protected name is dropped;
- minimal diacritics (`MINIMAL`, A5's hypothesis), selected by no production profile — tests and P-1 only;
- the hint validator: `[[say:WORD]]` kept only when it equals exactly one undiacritized word of its sentence, carries a
  diacritic, is not a protected name, at most 2 per sentence and 4 per reply; the P-1 policies `B_ALL` / `B_FILTERED`;
  the conflict rule (lexicon and hint disagree on a word → neither applies, counted); `SPEECH_HINT_POLICY = 'OFF'`;
- L-0 as regression tests over its rated items (text expectations only; no audio).

**B. The voice-note reply channel** — `conversation-orchestrator.service.ts`, `conversation.service.ts`:
- the Voice Note runner (`runCommittedTurn`) alone passes `modality: 'VOICE_NOTE'`; that turn's guidance is the turn's own
  text guidance + `\n\n` + TM-01 (TM-03 only when the hint policy is on); every other turn's guidance is byte-identical
  to before (Text v5);
- the expression and the validated hints are stored speech-only in `voice_private.reply_speech_hints` (0187), never in
  the conversation, Memory or history; on a GUIDED (Safety) turn PLAYFUL and JOY become CALM (a constraint, not a
  classifier); no delivery line, or an unknown one, is CALM;
- TM-02 is built (`withSpokenCallReply`) and wired nowhere.

**C. The markup fix** — `apps/api/src/speech-rendering/speech-markup.ts`, one parser for VOICE_NOTE output only:
- a well-formed leading `[[speech:STYLE]]` and well-formed `[[say:…]]` markers are removed; the visible reply is the rest;
- **fail closed:** a truncated, nested, corrupted, in-word or markers-only output fails the turn (503, `failTurn`,
  telemetry `separate/malformed`, a count without text) — no extra model call, no substitute reply, nothing stored;
- the one unclosed case removed with certainty: a stream that ends inside a valid hint token at the very end (no hint);
- a spaced lookalike (`[[ say:…]]`) is ordinary text and is kept; a typed turn's output is stored exactly as the model
  wrote it and the parser is never called for it;
- `assertNoSpeechMarkup` before `finalizeTurn` is a tripwire (`SPEECH_MARKUP_LEAK`), not a filter.

**D. The Vertex adapter** — `apps/api/src/voice/vertex-speech/`:
- ADC only (`google-auth-library` 11.3.1, scope `cloud-platform`); no API key anywhere;
- `POST …/v1/projects/{p}/locations/global/publishers/google/models/gemini-3.8-flash-tts:streamGenerateContent?alt=sse`,
  `redirect: 'error'`;
- the closed request body (14 JSON paths: text, `speechMetadata.style`, `responseModalities: ['AUDIO']`, voice `Achird`);
- PCM (`audio/L16` / `audio/pcm`, consistent rate) streamed and converted to WAV (`voice/listen/wav.ts`);
- first-byte timeout 2,000 ms, whole-attempt timeout `ceil(0.57 × max(1, ceil(chars/10)) × 1000) + 2000` ms, caller
  cancel; a 3 MiB audio cap;
- classified failures; **no retry after audio has started**, one retry before audio only for 429 / 5xx / network, never for
  a timeout; jitter 200 … 600 ms;
- the provider-agnostic admission guard `voice/speech-admission.guard.ts`: 4 in flight, 8 queued, 1,000 ms wait, circuit
  breaker 5 capacity/system failures in 60 s → open 30 s (all `PROPOSED`, P-08);
- a ledger row in `public.ai_provider_calls` per attempt (state settled on success, failure or sweep);
- `testing/fake-vertex-speech.server.ts`, a loopback fake (ok, status, hang, first-byte delay, drop / error after audio,
  empty, malformed, gated) that counts calls. No fake is composed in production.

**E. VA-11R and the Cloud checks** — the [controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-04_VA-11R_TTS_ABUSE_MONITORING_CONTROLLED_AMENDMENT_v1.0.md)
and §6.

**F. Migration `0187_s8b_04_qandeel_voice_v1.sql`** — forward-only, one transaction:
- `voice_private.reply_speech_hints` (expression + validated hints per assistant turn, speech-only) and
  `voice_private.reply_speech_segments` (the Listen store: audio bytes per segment, a 15-minute expiry, no text column);
- the `server_*` Listen definers, `service_role` only (record channel, read for Listen, start, admit, retry, complete,
  fail, read audio, cancel, sweep); the database decides ownership, voice-turn eligibility, consent, gate, TTL, the one
  admission per segment and the ledger;
- `VOICE_RECORDING_V2` installed as current (V1 kept as history), the deploy guard pinning its digests;
- the erasure coverage of both relations; a deploy guard refusing any open voice gate. No gate is set.

**G. The Listen API** — `apps/api/src/voice/listen/` (guarded, every answer `no-store, private`):

| Route | Effect |
|---|---|
| `POST /voice/replies/:turnId/listen` `{listenId}` | free: checks eligibility, renders the speech text, opens the 15-minute listen (idempotent) |
| `POST …/listen/:listenId/segments/:i/synthesis` | the ONE paid command: admitted once per segment by the database; a repeat answers READY / IN_PROGRESS / FAILED for free |
| `GET …/listen/:listenId/segments/:i/audio` | free: reads the store only; never starts provider work |
| `DELETE /voice/replies/:turnId/listen/:listenId` | free: discards the listen's segments |

Another human's reply, a typed turn's reply and a missing reply are one 404; no consent 403; gate closed / no route 503.
The sweeper (`voice-media/reply-speech-sweep.worker.ts`, every 60 s) settles expired leases as usage-unknown and deletes
expired segments. **No mobile UI.**

**H. F-01** — §2.4: the text, the language rule and the pinned-digest manifest loader; no audio.

## 4. Verification (all free; nothing sent off the machine but the read-only checks of §6)

**Run locally on the final tree** (Windows, Node 24):
- `apps/api`: `tsc --noEmit` clean; the full jest suite **317 suites, 7,495 passed, 1 skipped**; `npm run build:api` OK.
  The S8B-04 specs inside it: `speech-rendering/` (numbers, lexicon, hints, markup incl. truncated / nested / corrupted /
  streamed markers, renderer, L-0 regressions), `conversation/s8b-04-voice-note-reply-channel.spec.ts` (16),
  `voice/vertex-speech/vertex-speech.adapter.spec.ts` (25, against the fake Vertex server), `voice/failure-line/` (4),
  `voice-media/voice-notes.service.spec.ts` (15, V2 served, V1 refused), `http-security/` (the census).
- Root static contracts, each file on its own: `tests/s8b-04-qandeel-voice-contract.test.mjs` 9 / 9, the re-pinned
  `s8b-02` 9 / 9, `s8b-03` 10 / 10, `prod-retry-01` 9 / 9, `prod-sec-01` 31 / 31, `npm run test:task-closure-governance-contract`
  24 / 24, and every other contract file green except `forward-safety-contract.test.mjs`, which does not finish on this
  machine (a known local hang, also seen at S8B-03) and is left to CI.
- Real PostgreSQL 17 (local harness, a fresh database at `0187` and one at `0186`): `verify-migration-0187` 13 / 13;
  `verify-migration-0183` 20, `0185` 3, `0186` 29 scenarios passed on both; `prove-0187` L01 … L10 PASS with residue 0 and
  every gate DISABLED afterwards.

**Re-pinned predecessors** (each with a dated S8B-04 RE-ANCHOR note): `verify-migration-0183` (V2 current, V1 history,
0187's six internals), `0185` (internal count + 6), `0186` (two texts, V2 current), `prove-0185` / `prove-0186` (grant the
installed current version), `tests/s8b-02-voice-foundation-contract.test.mjs` (the second network path `vertex-speech/`,
ADC in its auth file alone, the K-07 disclosure naming Speechmatics, no logging in the S8B-04 files),
`tests/s8b-03-personal-voice-notes-contract.test.mjs` (V1 under `VOICE_CONSENT_V1_VERSION`).

**`prove-0187` (Listen against real PostgreSQL and the fake Vertex server):** L01 start free and idempotent · L02 two
concurrent synthesis requests → one provider call, one ledger row · L03 a lost answer asked again is READY for free; ten
GETs return the same bytes for free · L04 re-listening within the TTL → zero calls · L05 one retry before audio → two
calls, two ledger rows · L06 failure after audio → no retry, FAILED, asked again FAILED for free · L07 a crash after
admission → the sweeper settles it unknown, asking again calls nobody · L08 DELETE removes the segments, the TTL closes the
store and the sweeper deletes it · L09 refusals before anything is written or sent · L10 the allowlist, no identity, the
recorded style, no recording write, one ledger row per call. Locally through the pg transport; in CI also through every
PostgREST version of the loop (the wire proof runs in CI only).

**GitHub CI:** §10.

## 5. Declared engineering decisions and deviations (inside the approved contract)

1. **§7.4 deviation — fail closed.** The contract's §7.4 rule kept an unproven marker as text. The Product Owner's CP1
   order replaces it for malformed markup: a VOICE_NOTE output whose markup is malformed fails the turn (no extra call, no
   substitute reply, nothing stored); the user sees the ordinary failed-turn state and may send again. Well-formed markers
   are removed; a spaced lookalike stays text; typed turns are untouched.
2. **The lexicon is TypeScript, not JSON files** (§9.1 said JSON): one versioned, typed, frozen module, tested in place.
3. **The admission guard sits at the `voice/` root**, provider-agnostic; the Vertex route is injected into Listen
   (`LISTEN_SYNTHESIS_ROUTE`), null without `QANDEEL_VERTEX_TTS_PROJECT` (Listen then answers NOT_AVAILABLE_NOW).
4. **No retry on a timeout** (first-byte or whole-attempt): a timed-out attempt may still be billed; one retry is allowed
   only before audio and only for 429 / 5xx / network.
5. **The sweeper lives in `voice-media/`**, because `voice/` reads no environment outside the adapters' config files.
6. **`attempt_number`** counts every speech call of the source turn (the ledger's existing meaning), not per segment.
7. **Rate-limit census (PROD-SEC-01):** opening a listen, reading a segment and discarding are `AUTHENTICATED`; the paid
   synthesis is `CONVERSATION` (a reply is up to 16 segments; the database, not the throttler, admits each segment once
   and bounds a human's concurrent synthesis).
8. **`0187`'s one PT409** is the AI-usage identity conflict on a reused provider call id (re-pinned in
   `tests/prod-retry-01-data-api-stale-state-contract.test.mjs`).
9. **F-01's language** is the reply's (an English reply hears the English line), narrowing contract §4.5 «in neutral MSA».

## 6. Google Cloud checks (2026-11-01, read-only, development project `gen-lang-client-0473671267`)

| Check | Result | State |
|---|---|---|
| V-1 | `fetchPublisherModelConfig` for `gemini-3.8-flash-tts` (global) → HTTP 404 `NOT_FOUND`: no request-response logging configured | **PROVEN** (this project) |
| V-2 | `GET cacheConfig` → HTTP 200 `retentionType: DURABLE`, no `disableCache`: in-memory and durable caching are **on** | **NOT SATISFIED** — needs a manual change (§9) |
| V-7 | Google's *Abuse monitoring* and *Zero data retention* pages (updated 2026-10-30) re-read: 90-day flagged-prompt retention, possible authorized-staff review, no training, logging off by default, caching on by default | **RECORDED** — K-08 / K-09 stay accurate |
| V-3 / V-5 | AI Studio key revocation, budget alert | **NOT CHECKED** — state changes the Product Owner performs (§9) |

The access token was read into memory through ADC and never printed or stored. No setting was changed.

## 7. Residual limits and gaps

- **Mobile consent is V1 and now fails closed** (resolved by CP2: the phone carries V3, §11.5 B, §11.6 item 4). `apps/mobile/src/voice-note/voice-note-copy.ts` pins
  `VOICE_RECORDING_V1`; with `0187` applied the API serves V2 only, so the mobile consent step refuses. No user is affected
  (every gate DISABLED, `0187` not hosted). CP2 must ship K-01 … K-15 on mobile before any gate opens.
- **No live Google call** was made: the adapter's wire behaviour is proven against the fake server only; the real
  stream's framing, usage fields and latency are unproven until P-1.
- **The Listen PostgREST wire proof runs in CI only** (locally the pg transport).
- **V-2 is not satisfied** on the development project (§6); V-1 / V-2 on the production project belong to PC-S7.
- **Not measured:** naturalness, pronunciation accuracy, tone fit, first-byte latency, cost per reply — all P-1.
- **PROPOSED values** (P-08) are configuration, not capacity proof.

## 8. Open items

| Item | State | Note |
|---|---|---|
| H26 | PENDING | L-0: was «مردتش» mispronounced in version B (`C0559`)? Changes no recommendation; decides only whether L-0 records a corruption of a non-target word. |
| P-1 | NOT AUTHORIZED | The paid measurement (pronunciation A/B, hints, tone, latency) under its own approved plan and cap. |
| Lexicon entries | DISABLED | Each is enabled only by P-1 evidence. |
| `QAN-BL-VOICE-01` | WORKED, NOT DELIVERED | S8B-04 carries its pronunciation side; reconciled at S8B-04's closing change. |
| `QAN-BL-VOICE-02` | UNCHANGED | V-1 / V-2 for the production project are added inside PC-S7, not as a new item. |

## Approvals needed before CP2

*(Settled by the Product Owner at the CP2 gate, 2026-11-02, §11.1: 1 and 2 by D1 / D2 / D3 — the automatic reply replaced
the Listen UI; 3 stays unauthorized (D9, §11.9); 4 is the Product Owner's to perform (D8); 5 is carried by `QAN-BL-VOICE-05`.)*

1. **The Listen UI visual design** (the button, its states, playback, the 15-minute expiry, failure) and the Listen Copy
   Gate rows (contract §11.2), still `PROPOSED`.
2. **The CP2 start itself**, including shipping `VOICE_RECORDING_V2` (K-01 … K-15) on mobile.
3. **The paid P-1 plan** — its fixed corpus, the cap and the acceptance criteria — before any paid Google or DeepSeek call.
4. **Google Cloud manual changes (performed by the Product Owner, or explicitly authorized):** disable caching
   (`PATCH cacheConfig {disableCache: true}`, role `aiplatform.admin`), then a free re-read of V-2; revoke the unused AI
   Studio key (V-3); a budget alert (V-5).
5. **H26** — yes / no.

## 9. The manual Google Cloud change proposed (NOT performed)

```
PATCH https://aiplatform.googleapis.com/v1/projects/gen-lang-client-0473671267/cacheConfig
{"name": "projects/gen-lang-client-0473671267/cacheConfig", "disableCache": true}
```

It turns off both in-memory and durable caching for the project (Google's ZDR page). It is a state change: CP1 did not
run it. After it is applied, V-2 is read again (free) and recorded.

## 10. GitHub CI on the Draft pull request

The CI result on this record's own head is reported on the Draft pull request and in the report to the Product Owner; this record does not claim it. Merge only on «ادمج».

### 10.1 CI repair R1 (2026-11-01, the Product Owner's focused repair order; head `acaa671f` → R1)

- **API CI run `41320539778` — `verify-migration-0150` `PT409_CENSUS` failed. Proven cause:** `0187`'s
  `public.server_admit_reply_speech_synthesis_v1` raises the 0135 AI-usage identity conflict (`AI_PROVIDER_CALL_IDENTITY_CONFLICT`,
  PT409) on a provider call id already in the ledger, a raiser the census did not list. **Change:** the census admits
  exactly that one function with exactly that message when `0187` is applied (absent before it); the 23 stale-state sites
  stay exactly 23; any other new PT409 raiser still fails. Migration `0150` is unchanged. `verify-migration-0187` V-A now
  asserts the exact reason, that the conflict writes no `ai_provider_calls` / `ai_provider_call_usage` row, and that the
  segment stays PENDING. **Local, real PostgreSQL 17:** `verify-migration-0150` 28 / 28 on a database at `0187` and on one at
  `0186`; `verify-migration-0187` 13 / 13.
- **Mobile CI run `41320539649` — Android boot smoke `Assert that "QANDEEL" is visible` failed** (APK built and installed,
  emulator booted, the app process alive and `MainActivity` resumed, no crash; load average 42.8 three minutes after
  boot). This change touches no mobile code; its lockfile change only adds API-side packages (no existing version
  changed). **The screen itself was never recorded** (the consumer job may not publish an artifact, QAN-INF-04), so the
  cause is **not proven** from that run. **Change:** `scripts/validation/android-smoke-diagnostics.sh` (read-only,
  failure path only) now prints the window's UI hierarchy (element attributes only) and one bounded base64 screenshot.
  The assertion and its timeout are unchanged. The result on the R1 head decides the next step.

### 10.2 CI repair R2 (2026-11-01; head `53fe8124` → R2)

- **On `53fe8124`: API CI green.** Mobile CI run `41324976926`, job `124909137558`: the boot smoke failed again, and
  the R1 diagnostics showed the screen — Android's **"System UI isn't responding"** dialog (`android:id/alertTitle`,
  `aerr_close` "Close app", `aerr_wait` "Wait") over the app, which was installed, alive and resumed, with no app crash.
  Guest load average **42.20 / 20.76 / 8.08** at 3 minutes' uptime on **2 emulated cores** (the action's default); the
  emulator logged "AVD 'test' will run more smoothly with 4 CPU cores (currently using 2)"; the runner (public
  repository, `ubuntu-24.04`) has 4 vCPUs. **Proven cause: the emulator's System UI hung under post-boot CPU starvation —
  an environment failure, not a Product UI result.** The single 72 KB base64 screenshot line also cut the step's log.
- **Change (CI / environment only; no Product, voice or test-assertion change):**
  - `mobile-ci.yml`: the emulator runs with `cores: 4`.
  - `scripts/validation/android-system-ui-ready.sh`, run after the driver probe and before the smoke: every 5 s it reads
    System UI's pid, an ANR dialog, an `am_anr` for System UI and the load; it settles on three samples in a row with
    the same System UI pid, no ANR and load ≤ 2 per core (bound 300 s; a load that does not settle is printed and the
    smoke decides). A **proven hang** (ANR dialog, `am_anr` for System UI, or System UI absent) gets **one** clean
    recovery (an emulator reboot and the same boot wait); a second proven hang fails the step as `ENVIRONMENT` (exit 3)
    and the smoke does not run. It never dismisses a dialog, never touches the app and never retries the smoke
    (QAN-INF-04 forbids an automatic retry).
  - `android-smoke-diagnostics.sh`: the guest's loadavg, memory, busiest processes and `am_anr` / `am_crash` events; the
    screenshot in 76-character lines, bounded at 256 KiB.
  - `boot-smoke.yaml` (`assertVisible: QANDEEL`) and its timeout are unchanged; the native build fingerprint is unchanged
    (`9f72473c…`), so CI reuses the APK already built.
- **Focused local proof** (the APK CI built for this PR, sha256 `ae40a942…` as its manifest states; a fresh API 36
  `google_apis` x86_64 `pixel_7` AVD with 4 cores, CI's emulator options; then deleted): after install and the driver probe
  the guest load was 31.47 and fell to ≤ 8 in 147 s (`am_anr` for GMS and `com.google.android.as` during the first boot's
  storm, none for System UI); the gate settled and the unchanged smoke passed. A System UI ANR provoked on that emulator
  (`kill -STOP` on System UI, then input: `am_anr … com.android.systemui … Input dispatching timed out`) was detected, the
  emulator rebooted once, the gate settled at load 6.93, and the smoke passed. A stubbed second hang exits 3 with the
  `ENVIRONMENT` message.

---

## 11. CP2 — the automatic voice reply and the Fast Voice Path (S8B-04's closing change)

**Date:** 2026-11-02. **Branch / base:** `s8b/s8b-04-cp2`, from `main` at `54b5333e`, the merge of PR #372 (CP1).
**Authority:** the Product Owner's *S8B-04 CP2* brief and Fast Voice Path decision (2026-11-01: D-S1 … D-S5, the speed
target «لا أريد مطاردة رقم 3 ثوانٍ على حساب الجودة»), the gate review (2026-11-02) and the *Product Owner Final Approval
Gate — APPROVED* (2026-11-02, D1 … D9). The gate package, the 20 design captures, the device report and the paid plans
are the Product Owner's local review files (`E:\QANDEEL_REPORTS\S8B-04\CP2\`); this record carries what binds from them.
The [Fast Voice Path controlled amendment FVP v1.0](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-04_FAST_VOICE_PATH_CONTROLLED_AMENDMENT_v1.0.md)
binds the path (Personal Voice Notes only).

### 11.1 The Product Owner's decisions (2026-11-02), recorded as binding

| # | Decision |
|---|---|
| D1 | APPROVED: the 20 design captures — the design, the control's place, the Timeline and P2 icons, the states, RTL / LTR. Changed only to fix a proven defect. |
| D2 | APPROVED: T2-01 … T2-07 verbatim (§11.2). |
| D3 | APPROVED: `VOICE_RECORDING_V3` with K-07 v1.1 verbatim, K-08 and K-13 (§11.3), and R-01. Keep V1 and V2 and every historical consent unchanged, with no automatic upgrade. Verify that the Speechmatics training opt-out is in place and that the text promises nothing beyond the provider's terms (§11.4). |
| D4 | APPROVED: one consent vocabulary across the layers (`GRANTED_CURRENT` / `VERSION_NOT_CURRENT` / `NOT_GRANTED` / `WITHDRAWN`); an earlier consent opens nothing on the new path; V3 needs a new explicit consent before any audio is sent during recording. |
| D5 | APPROVED: FVP-1 … FVP-10, Personal Voice Notes only; the record, Current State, Project Map and backlog updated; CP1's state corrected after PR #372. No S8B-05, no live call. |
| D6 | APPROVED, final: accept-first. No speculative generation; kept as a future improvement, not open work. |
| D7 | APPROVED: the speed is measured L2 (on the phone) with L3 calibration; real apart from simulated, the player's start apart from the first audible sound. |
| D8 | APPROVED in principle: `disableCache: true`, performed by the Product Owner, never by QANDEEL's engineering. Gemini 3.8 Flash TTS does not support context caching; disabling the cache does not cancel any other retention. |
| D9 | NOT AUTHORIZED: the paid runs. Their plans and caps stand: D-S5 latency USD 1.50, Speechmatics Realtime quality USD 1.00, P-1 USD 2.00. |

### 11.2 Product Copy Gate — the spoken reply (APPROVED verbatim, 2026-11-02) — `apps/mobile/src/voice-note/voice-note-copy.ts`

These rows replace the contract's T-01 … T-05 (the manual «استمع» of CP1, which no screen shows).

| ID | State | Arabic | English |
|---|---|---|---|
| T2-01 | APPROVED | إيقاف مؤقت | Pause |
| T2-02 | APPROVED | متابعة | Resume |
| T2-03 | APPROVED | إعادة الاستماع | Play again |
| T2-04 | APPROVED | رد قنديل الصوتي | Qandeel's spoken reply |
| T2-05 | APPROVED | جارٍ تجهيز الصوت | Preparing audio |
| T2-06 | APPROVED | تعذّر تشغيل الصوت الآن. الرد مكتوب أعلاه. | Audio couldn't play right now. The reply is written above. |
| T2-07 | APPROVED | لم يعد صوت هذا الرد متاحًا. الرد مكتوب أعلاه. | This reply's audio is no longer available. The reply is written above. |
| R-01 | APPROVED | تغيّرت شروط التسجيل الصوتي. راجعها ووافق عليها لمتابعة الرسائل الصوتية. | The voice recording terms have changed. Review and agree to them to keep using voice messages. |

R-01 is shown above the consent text only to a reader who agreed to an earlier version; it is in no version's text or
digest.

### 11.3 Consent, version `VOICE_RECORDING_V3` — `apps/api/src/voice-media/voice-consent-text.ts`; installed by `0188`

The one current version from `0188` on: V2 (§2.3) with exactly K-07, K-08 and K-13 replaced; K-01 … K-06, K-09 … K-12,
K-14 and K-15 are V2's, unchanged. `VOICE_RECORDING_V2` and `VOICE_RECORDING_V1` stay installed, unchanged, as history;
a grant of either is `VERSION_NOT_CURRENT` and opens nothing. Digests (UTF-8, K-01 … K-15 joined by `\n`): Arabic
`2550241d69c0cf2fc510c3b09e9fa857012ad4fe0360e3febb2b0d7452e0226b`, English
`b593945f15f8e0858e35befeef191d89273ab3149cdee28cd5fbcda3e080bec9`, required by `0188`'s deploy guard together with V2's and
V1's unchanged digests.

| ID | State | Arabic | English |
|---|---|---|---|
| V3 K-07 | APPROVED | تحوّل خدمة Speechmatics الكلام إلى نص. أثناء تسجيل رسالة صوتية يُرسل صوتك إليها مباشرةً لتحويله لحظيًا، قبل الضغط على «إرسال»، ليصل الرد أسرع؛ ووفق شروطها تعالج هذا الصوت اللحظي في الذاكرة دون حفظه. وبعد الإرسال قد يُرسل إليها التسجيل المحفوظ أيضًا لتحويله، ويطلب قنديل منها حذفه بعد التحويل مباشرة. ولم يأذن لها قنديل باستخدام صوتك في تدريب نماذجها. وإذا ألغيت الرسالة قبل إرسالها، لا يُنشئ قنديل منها رسالة ولا يتذكر منها شيئًا، أما ما وصل إلى الخدمة قبل الإلغاء فيكون قد عولج بالفعل. | Speechmatics converts speech to text. While you record a voice message, your voice is streamed to it for live conversion, before you press Send, so the reply comes faster; under its terms, it processes this live audio in memory without storing it. After you send, the saved recording may also be sent to it for conversion, and Qandeel asks it to delete that recording right after conversion. Qandeel hasn't allowed it to use your audio to train its models. If you cancel a message before sending it, Qandeel creates no message and remembers nothing from it, but whatever already reached the service before you cancelled has already been processed. |
| V3 K-08 | APPROVED | عندما ترسل رسالة صوتية، يرد قنديل بصوته تلقائيًا: يُرسل نص الرد إلى Google لتحويله إلى صوت أثناء كتابته. ويحدث ذلك أيضًا عند الضغط على «استمع»، وفي المكالمات عند توفرها. ولا تُرسل تسجيلاتك إلى Google. وقد يتضمن نص الرد شيئًا مما قلته. ويُحفظ صوت الرد التلقائي 15 دقيقة لإعادة الاستماع، ثم يُحذف. | When you send a voice message, Qandeel replies in its voice automatically: the text of its reply is sent to Google to turn it into speech as it's written. This also happens when you press Listen, and in calls once they're available. Your recordings aren't sent to Google. The reply text may include something you said. The audio of an automatic reply is kept for 15 minutes so you can play it again, then deleted. |
| V3 K-13 | APPROVED | يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة والردود الصوتية والمكالمات و«استمع»، ولا يحذف التسجيلات الحالية. | Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages, spoken replies, calls and Listen, and doesn't delete existing recordings. |

### 11.4 The Speechmatics training opt-out (D3)

- **In the code:** no request QANDEEL sends to Speechmatics carries any training or data-use field. The realtime
  `StartRecognition` (`speechmatics-realtime.adapter.ts`) sends the audio format and the transcription settings only; the
  batch job (`speechmatics-batch-jobs.adapter.ts`) sends the language and the operating point only. Model training is a
  workspace setting at Speechmatics (Terms of Service §10.4: no use of customer data for training unless the workspace
  opts in; the opt-in is off by default), not a request field.
- **On record:** the [S8B-01 provider evidence record](QANDEEL_S8B_01_VOICE_RUNTIME_CONTRACT_PROVIDER_EVIDENCE_RECORD_v1.md)
  (§9.11 ff.) — the setting **off**, confirmed by the Product Owner for the S8B-01 run (`modelTrainingOff: true`, the
  launcher refused without it); Realtime audio "never recorded or stored", processed in memory; batch jobs kept 7 days and
  deleted by QANDEEL at once.
- **Not readable from here:** the account's current setting is visible only in the Speechmatics portal. Before any paid
  or production Speechmatics run, the Product Owner confirms it there (a condition of the paid plans, §11.9).
- **The text:** K-07 says only what the terms and the setting give — Realtime "in memory without storing it" "under its
  terms"; the saved recording "asks it to delete"; "hasn't allowed it" to train; a cancel does not undo what the service
  already processed. It promises no zero retention beyond the provider's own terms.

### 11.5 What CP2 implements

**A. The server (accept-first, FVP-4):**
- *The live note (D-S1, FVP-1 … FVP-3)* — `apps/api/src/voice/live-note/` and the Speechmatics Realtime adapter
  (`voice/speechmatics/speechmatics-realtime.adapter.ts`, `ar_en` Enhanced, the S8B-01 configuration). Admitted only with a
  consent to V3, the gate, an active session and one live note per person, its ledger row begun in the same definer call.
  Interim words are never kept; final words live only in the process until Send. The recognizer is bound only when the
  server key is set **and** `VOICE_NOTE_LIVE_TRANSCRIPT=ADOPT`; otherwise no audio is ever streamed and the note is
  transcribed by Batch exactly as before. Adoption: every chunk in order, the live note finalized, its heard length within
  ±1200 ms of the recording's proven length, and the batch path's own classification giving HIGH or MEDIUM.
- *Accept + the live transcript in one transaction* — the upload `?liveId=&liveChunks=` calls
  `server_accept_live_voice_note_v1` (accept v1 unchanged inside it, and the transcription row READY), so the batch claim
  never races it; the unchanged commit `?auto=1` creates the turn and answers `REPLYING {turnId, replyId}`.
- *The reply (VA-1 / VA-2 on this path, FVP-5)* — the Conversation Orchestrator streams DeepSeek through the Model Router
  (`deepseek-model-router.ts`, accounted stream) and releases it through the incremental release guard
  (`model-router/incremental-release-guard.ts`). COMPLETE stores exactly the text the non-streamed path would store;
  WITHHELD_TAIL stores the released prefix through `server_finalize_voice_note_withheld_tail_v1` with **no completed
  event**, so no Memory or post-response intelligence reads an incomplete reply. A Safety BLOCK and a Memory or
  preference command finalize their own reply and are spoken whole (`speakWhole`, FVP-6). The typed path is unchanged.
- *The automatic voice (D-S3, FVP-7 / FVP-8)* — `apps/api/src/voice/live-reply/`: one live reply per voice-note turn; one
  ledger row per synthesis attempt, written before the call; no repeat after `USAGE_UNKNOWN`; PCM kept 15 minutes, then
  deleted; `GET /voice/live-replies/:id?wait=&have=&final=&done=` (status long-poll with the released text),
  `GET …/audio` (ONE continuous WAV stream per reply, the bearer in a header, its length announced once complete) and
  `DELETE` (stops new synthesis). Replay reads the store and never pays.
- *Migration `0188_s8b_04_fast_voice_path_v1.sql`* — forward-only, one transaction: the live note, accept-live, the live
  reply store and its segments, the delivery record of the withheld tail, the sweep, `ACCOUNT_CASCADE` for the five new
  relations, every new definer `service_role` only, and `VOICE_RECORDING_V3` installed as the one current version **in the
  same transaction** (D4). Its deploy guard requires every voice gate `DISABLED`, the erasure census clean, no client
  access, and exactly the three approved texts (V3 current; V2 and V1 historical, their digests unchanged).

**B. The phone:**
- `voice-live-note.ts` + `voice-pcm-stream-port.ts` — the live note during recording (16 kHz PCM chunks beside the
  S8B-03 M4A recorder); cancel and leaving discard it.
- `voice-reply.ts` — the automatic player: it starts by itself on a voice note sent here, long-polls the text, plays the
  one stream, stops itself at the announced length (−60 ms), pause / resume / play again; `quiet()` pauses and stops new
  synthesis when the conversation is left, the app leaves the foreground or a new recording starts (FVP-9). Nothing old
  plays when a conversation is reopened; a typed message stays text only.
- The reply companion slot (`ConversationSurface` `replyCompanion`, `VoiceNoteViews` control) with T2-01 … T2-07;
  `accessibilityState.busy` only while PREPARING.
- The consent: `VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V3'` and K-01 … K-15 as the client's guard copy (the title the
  first row, agree and decline the last two); R-01 for an `OUTDATED` consent; Settings offers the withdrawal (C-46) for a
  current or `OUTDATED` consent.

### 11.6 Defects found and fixed in CP2

1. **The native player kept playing after release (S8B-03 inheritance, found on the phone).** In `expo-audio` 57.0.5 on
   Android, `remove()` only forgets the player in the module; ExoPlayer keeps playing. `voice-note-player-port.ts` now
   pauses, removes **and** releases (`player.release()`). Device: 0 playing media sessions after the reply ended and after
   leaving the conversation. Pinned by the S8B-04 contract test against the module's own source.
2. **Play again after the store's 15 minutes showed T2-06.** The player cannot see the 404; on a failure the phone now
   reads the reply's status once, and `NOT_FOUND` shows T2-07 (verified on the phone, Arabic).
3. **A stale screen-reader busy state** after PREPARING: `busy` is now an explicit boolean.
4. **The consent vocabulary (S8B-03 `faff8e70`, in `main`).** The API passes the database's words through
   (`GRANTED_CURRENT`, `VERSION_NOT_CURRENT`, `NOT_GRANTED`, `WITHDRAWN`), but the phone read only `NONE` / `GRANTED` /
   `WITHDRAWN` — words no real server sends — so Voice Notes were never offered against a real server; and the phone
   still pinned V1 while `0187` had made V2 current. The phone now maps exactly the four database words
   (`SERVER_VOICE_CONSENT_STATES`) and carries V3; one contract test reads the four words from `0183`, the API's
   pass-through, the phone's map and the fakes. No user was affected (every gate `DISABLED`, nothing hosted).

### 11.7 Verification (free; no provider called)

| Check | Result |
|---|---|
| `verify-migration-0188` (real PostgreSQL 17, local) | 17 / 17 — catalogue; V3 current, the file text the installed text, V1 / V2 unchanged; the live note refused on a V1 or V2 consent; accept-first; one reply per turn; one ledger row per attempt; UNKNOWN final; finish; the withheld tail with no outbox event; the sweep; erasure; three races on two connections |
| Re-anchored predecessors on a database **with** `0188` | `verify-migration-0183` 20 / 20 · `0185` 3 / 3 · `0186` 29 / 29 · `0187` 13 / 13 (a V2 grant refused under V3) |
| The same on a database at `0187` (without `0188`) | `verify-migration-0186` and `0187` pass unchanged |
| `0188` applied on top of `0187` | the deploy guard passes; V1 / V2 / V3 digests as §2.3 / §11.3 |
| API jest (full) · mobile voice-note jest | 322 suites, 7,580 passed, 1 skipped · 13 suites, 150 / 150 |
| Root contracts | S8B-02 / S8B-03 / S8B-04 voice contracts, AI-COST-01, S8A-01, W3-MEGA-M, the task-closure governance contract |
| The Android phone (Huawei ALI-NX1, Android 15; a side-by-side proof app, the owner's own app untouched) | T10 auto reply and replay with no new synthesis · T11 pause / resume / `quiet()` with exactly one DELETE · T7 a 3 s data gap · T12 the live note beside the M4A with real speech (20 / 20 chunks in order) · T9 neither microphone capture silences the other · the 20 design captures · fixes 1 – 3 above. Provider timings there are **simulated**; the phone's part is real |

The GitHub CI result on the Draft pull request is reported there and to the Product Owner, not claimed here.

### 11.8 Not proven by CP2

- **Real speed** with the real providers (D-S5), **live-transcript quality** (Speechmatics Realtime: negation, names,
  numbers, Egyptian Arabic; the earlier WER 0.29 to be reviewed; the recorder-first order lowers the stream 6 – 10 dB on
  the phone) and **Qandeel's voice quality** (P-1: naturalness, pronunciation, tone, the four lexicon candidates, H26).
  `VOICE_NOTE_LIVE_TRANSCRIPT` stays `OFF` and the lexicon stays disabled until those plans pass.
- **V-2 on the development project** (the cache) until the Product Owner applies `disableCache: true` (D8) and a free
  re-read records it; **the Speechmatics training setting** until the Product Owner confirms it in the portal.
- **iOS on a device**, TalkBack / VoiceOver on the reply control, a headset and a call during playback
  (`QAN-BL-VOICE-04`'s list).

### 11.9 The paid plans (D9 — NOT AUTHORIZED; each needs its own approval)

| Plan | Cap | Before it runs |
|---|---|---|
| D-S5 — real latency, L2 on the phone with L3 calibration (first audible ≤ 3 s p50, p95 ≤ 5 s, ≥ 10 s a failure) | USD 1.50 | V-1 / V-2 verified (VA-11R §2 item 6); the training setting confirmed |
| Speechmatics Realtime quality (live-transcript adoption) | USD 1.00 | the training setting confirmed in the portal |
| P-1 — Gemini voice: pronunciation A/B, hints, tone, the lexicon, H26 | USD 2.00 | V-1 / V-2 verified |

They are owned by `QAN-BL-VOICE-05` (§11.11).

### 11.10 GitHub CI and the local runs

The CI result on this record's own head is reported on the Draft pull request and in the report to the Product Owner;
this record does not claim it. Merge only on «ادمج».

### 11.11 S8B-04's closure (BG-08 / BG-09)

- **`QAN-BL-VOICE-01` — worked by S8B-04 and not delivered:** Speech Rendering, the production TTS route, Listen's server,
  the automatic spoken reply of Personal Voice Notes and the live note are built; calls, barge-in and realtime
  conversation stay with S8B-05, and every gate stays `DISABLED`. Owner, severity and status unchanged.
- **Admitted (BG-06):** `QAN-BL-VOICE-05` — S8B-04's unrun paid evidence and the conditions before it (§11.9, H26, the
  lexicon, `VOICE_NOTE_LIVE_TRANSCRIPT`, V-2 and the training setting), owned by `S8B-08 — Voice Cost, Privacy & Launch
  Evidence`. No item survives only in this record.
- **Read and left unchanged:** `QAN-BL-VOICE-02` (PC-S1 … PC-S7, PC-D: V-1 / V-2 for the production project stay in
  PC-S7), `QAN-BL-VOICE-03`, `QAN-BL-VOICE-04` (the reply control joins its list as a screen-reader item), `QAN-BL-PROD-06`
  / `08` (`0187` / `0188` not hosted), `QAN-BL-AI-01`, `QAN-BL-ACE-02`.
- **Speculative generation** (D6) is a future improvement, not open work and not a backlog item.
- **BG-09:** this record's banner states S8B-04's closing state; so do the three locators and the FVP amendment.
