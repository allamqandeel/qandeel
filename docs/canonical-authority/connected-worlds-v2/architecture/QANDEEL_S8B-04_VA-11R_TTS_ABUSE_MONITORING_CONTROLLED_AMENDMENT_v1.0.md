# QANDEEL — Stage 8B
## S8B-04 — Gemini TTS Production Route on Google Cloud — Controlled Amendment VA-11R v1.0

**Status:** `APPROVED BY THE PRODUCT OWNER (2026-11-01, the S8B-04 CP1 authorization approving WP0 contract v1.2 §5.1) — WRITTEN BY S8B-04 CP1 ON A DRAFT PULL REQUEST, NOT MERGED — BINDS FROM THAT MERGE — MIGRATION 0187 NOT HOSTED — EVERY VOICE GATE DISABLED — NO PAID GOOGLE CALL MADE`
**Scope:** narrows Controlled Amendment VA-11 (the Gemini TTS provider-retention exception) to the one production route
S8B-04 implements, and records the decision's binding limits.
**Amends:** [VA-11](QANDEEL_S8B-01_CP2_GEMINI_TTS_RETENTION_EXCEPTION_CONTROLLED_AMENDMENT_v1.0.md) (tightened, as VA-1 … VA-10
§2 allows a task to tighten a text). It edits neither the [Voice Runtime Contract](../../../voice-runtime-v1.md) nor
[VA-1 … VA-10](QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md).
**Authority:** the Product Owner's *S8B-04 CP1 — Server & Intelligence — QANDEEL's Voice* authorization (2026-11-01): «VA-11R:
احتفاظ بالنصوص المرصودة حتى 90 يومًا ومراجعة محتملة من موظفي Google المخوّلين، دون تدريب ودون توسيع خارج TTS».
Record: [S8B-04 implementation record](../../../e2e/QANDEEL_S8B_04_QANDEEL_VOICE_IMPLEMENTATION_RECORD_v1.md).
**Task:** `S8B-04` — CP1. It is not a Connected Worlds phase.

---

## 1. The decision recorded

**Product Owner, S8B-01 CP2, reconfirmed 2026-11-01.** The zero-retention condition (Voice Runtime Contract §7) is waived
for Google Gemini TTS on the production route in §2. The waiver covers:

- Google's retention of prompts that its abuse classifiers flag, for up to 90 days;
- possible review of those flagged prompts by authorized Google staff, under Google's service terms.

A Google Cloud Master Agreement is **not** a launch condition.

## 2. Limits of the exception (binding)

1. It covers Google Cloud TTS (Agent Platform / Vertex AI, `aiplatform.googleapis.com`, `streamGenerateContent`, location
   `global`) with the model `gemini-3.8-flash-tts` and the voice `Achird` only. `gemini-3.8-flash-lite-tts` is removed from
   VA-11. The AI Studio / Gemini API route and the Interactions API are not used, and nothing falls back to them.
2. It does not cover Speechmatics, any ASR provider, or any other provider or model. Zero retention and no training stay
   mandatory for ASR (Voice Runtime Contract §4.7).
3. The no-training condition stays in force. A change to Google's training restriction ends this exception.
4. The prohibition of human review inside QANDEEL (CW2-08A; Voice Runtime Contract §10 item 5) stays in force. This
   exception grants no QANDEEL staff member any access to private conversations or voice content.
5. Google's possible review of flagged prompts is a narrow, external exception under Google's terms. It is not a general
   authorization to review user data.
6. Before any paid or production run, the project's Cloud logging and caching settings are verified and recorded:
   request-response logging not configured (V-1) and implicit caching disabled (V-2).

## 3. What reaches Google

- Only the speech-only text derived from QANDEEL's own reply, the approved style sentence (Copy Gate S-01 … S-06) and the
  voice `Achird`.
- No user identifier, user recording, user message, Memory, guidance, `labels`, `systemInstruction` or `tools`.
- The request body is a closed allowlist (`apps/api/src/voice/vertex-speech/vertex-speech.request.ts`), enforced by the
  adapter spec (every JSON path of the body equals the 14 allowed paths) and by
  `tests/s8b-04-qandeel-voice-contract.test.mjs`.
- Authentication is Application Default Credentials only. No API key exists in the route, the environment or a client.

## 4. Disclosure

The user is told, before first use, exactly the facts above: Copy Gate rows **K-08** and **K-09** of the consent version
`VOICE_RECORDING_V2`, installed by migration `0187` as the one current version. `VOICE_RECORDING_V1` is history and is never
edited.

## 5. Re-verification

Google's terms are re-read on the day S8B-04 CP1 starts and again before any gate opens (S8B-08, `QAN-BL-VOICE-02` PC-S7).

**V-7, 2026-11-01 (CP1 start; free web read).** Google's *Abuse monitoring* and *Zero data retention* pages (both last
updated 2026-10-30 UTC) still state, for Google models under the Google Cloud terms: prompts are logged only when automated
classifiers flag possible abuse, kept up to 90 days, and may be reviewed by authorized Google employees (customers on a
Cloud Master Agreement are exempt by default); the data is not used to train or fine-tune models; request-response logging
is off by default; in-memory and durable caching are **on by default** and are turned off by `cacheConfig`
`disableCache: true`. The exception's facts hold; K-08 / K-09 stay accurate.

**V-1 / V-2, 2026-11-01 (read-only, the development project `gen-lang-client-0473671267`).** V-1: no request-response
logging configuration exists for `gemini-3.8-flash-tts` (HTTP 404 `NOT_FOUND`) — **PROVEN** for that project. V-2: caching
is **not disabled** (`cacheConfig` answers `retentionType: DURABLE`, no `disableCache`) — **NOT SATISFIED**. Limit 6 is
therefore not met; no paid run (P-1) or production run may start until the Product Owner applies the change (or authorizes
it) and V-2 is read again. Nothing was changed by CP1. The production project repeats V-1 / V-2 inside PC-S7.
