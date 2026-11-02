# QANDEEL — Stage 8B
## S8B-04 — The Fast Voice Path for Personal Voice Notes — Controlled Amendment FVP v1.0

**Status:** `APPROVED BY THE PRODUCT OWNER (2026-11-02, the S8B-04 CP2 gate: D5 the limited amendment, D6 accept-first, D4 the consent transition) — WRITTEN BY S8B-04 CP2 ON A DRAFT PULL REQUEST, NOT MERGED — BINDS FROM THAT MERGE — MIGRATION 0188 NOT HOSTED — EVERY VOICE GATE DISABLED — NO PAID PROVIDER CALL MADE`
**Scope:** the automatic spoken reply to a **Personal Voice Note** — and nothing else. Calls, barge-in and full realtime
stay with S8B-05; Shared and Public worlds are not touched.
**Amends (for the Personal Voice Note path only):** [VA-1 / VA-2 / VA-3 / VA-6](QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md)
(their §5 S8B-03 text) and [VA-11R](QANDEEL_S8B-04_VA-11R_TTS_ABUSE_MONITORING_CONTROLLED_AMENDMENT_v1.0.md) §2–§4 (the
speech route also serves the automatic reply). It edits neither the [Voice Runtime Contract](../../../voice-runtime-v1.md)
nor VA-4, VA-5, VA-7 … VA-10, and it relaxes no privacy rule: zero retention and no training stay mandatory for ASR.
**Authority:** the Product Owner's S8B-04 CP2 brief and Fast Voice Path decision (2026-11-01: D-S1 … D-S5, the speed
target, «لا أريد مطاردة رقم 3 ثوانٍ على حساب الجودة») and the CP2 gate decisions (2026-11-02): «D5 … APPROVED في النطاق
المحدود لـPersonal Voice Notes فقط» and «D6 — Accept-first: APPROVED نهائيًا لهذه الخطوة».
Record: [S8B-04 implementation record](../../../e2e/QANDEEL_S8B_04_QANDEEL_VOICE_IMPLEMENTATION_RECORD_v1.md) §11.
**Task:** `S8B-04` — CP2. It is not a Connected Worlds phase.

---

## 1. The rules (binding)

| # | Rule |
|---|---|
| FVP-1 | **Realtime ASR during recording** (Speechmatics Realtime, the approved `ar_en` Enhanced route) only while the reader holds a current consent to `VOICE_RECORDING_V3`. No microphone sample reaches any provider before it; a consent to V1 or V2 permits nothing (`VERSION_NOT_CURRENT`). |
| FVP-2 | The live transcript becomes the turn's text only through the adoption rules: every chunk received in order, the live note finalized, its duration within ±1200 ms of the proven M4A, and a confidence band of HIGH or MEDIUM. Otherwise the note waits for Batch. `VOICE_NOTE_LIVE_TRANSCRIPT` stays `OFF` (Batch only) until the Product Owner accepts the live-transcript quality plan. |
| FVP-3 | Cancel, leaving the screen, or any stop the reader did not ask for discards the live note and its interim text at once: no message, no turn, no Memory. Processing that already happened at the provider is not undone, and nothing claims it is. |
| FVP-4 | **Accept-first.** No reply generation starts before the note is accepted and READY in one transaction and the ordinary commit has created the turn. The Conversation Orchestrator keeps the authoritative turn lifecycle. Speculative generation is not implemented; it may come only as a separate controlled change if the real measurement shows the need. |
| FVP-5 | VA-1 / VA-2 on this path: the reply is streamed through the Model Router and released by the incremental release guard. COMPLETE stores exactly the text the non-streamed path would store. WITHHELD_TAIL stores the released prefix **without** the completed event, so no Memory is captured from an incomplete reply. The typed-text path keeps the whole-candidate guard byte-identical. |
| FVP-6 | A Safety BLOCK, and a Memory or preference command, finalize their own reply; it is spoken whole after it is final (never streamed in part). |
| FVP-7 | Speech is started by the server for each released sentence: one AI-COST-01 ledger row per provider attempt, written before the call; no repeat after `USAGE_UNKNOWN`; no new synthesis after the store's period. |
| FVP-8 | The reply's audio is kept 15 minutes for replay, then deleted. The phone reads ONE audio stream per reply (the bearer in a header, never in a URL), whose length the server announces once the reply is complete; replay reads the store and never pays. |
| FVP-9 | A typed message stays text only. Nothing old plays by itself when a conversation is reopened. Nothing paid runs in the background: leaving the conversation, the app leaving the foreground, or a new recording pauses the voice and stops new synthesis; a released player is stopped and released, never left to the platform. |
| FVP-10 | Withdrawing consent stops new voice notes, spoken replies, calls and Listen (V3 K-13). |

## 2. The consent transition (D4)

- Migration `0188` installs `VOICE_RECORDING_V3` as the one current version **in the same transaction** as the Fast Voice
  Path definers, so no instant exists in which a V2 consent reaches the live note or the automatic reply. V1 and V2 stay
  installed as history, unedited (0186 / 0187 and their digests unchanged).
- No consent is carried over: a reader who agreed to V1 or V2 sees the whole V3 text, with R-01 above it, and agrees again.
- The API passes the database's consent words through (`GRANTED_CURRENT`, `VERSION_NOT_CURRENT`, `NOT_GRANTED`,
  `WITHDRAWN`); the phone reads exactly those words and no word of its own. The S8B-03 phone read only words no real
  server sends, so Voice Notes were never offered; this is repaired here, under a contract across the layers.

## 3. Limits

1. Personal Voice Notes only. No call, barge-in, realtime conversation, Shared or Public surface (S8B-05 and later).
2. No provider changes: Speechmatics for ASR, `gemini-3.8-flash-tts` / Achird on Google Cloud for speech, DeepSeek through
   the Model Router. VA-11R's limits stay in force; implicit caching disabled (V-2) is verified before any paid or
   production run, and it is not a guarantee against any other retention.
3. Every voice gate stays `DISABLED`; this amendment opens nothing and authorizes no paid run, deployment or hosted
   migration. Each paid plan needs its own Product Owner approval.

## 4. Lifecycle

Written by S8B-04 CP2; binds from CP2's merge. Until that merge nothing here is in force.
