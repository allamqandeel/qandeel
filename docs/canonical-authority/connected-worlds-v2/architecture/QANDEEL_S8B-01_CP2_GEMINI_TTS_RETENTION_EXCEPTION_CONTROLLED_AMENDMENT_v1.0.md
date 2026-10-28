# QANDEEL — Stage 8B
## S8B-01 CP2 — Gemini TTS Provider-Retention Exception — Controlled Amendment VA-11 v1.0

**Status:** `CANDIDATE — S8B-01 CP2 (2026-10-28) — RECORDS THE PRODUCT OWNER'S CP2 DECISION — IN FORCE FOR THE CP2 EVALUATION ON SYNTHETIC TEXT; FOR PRODUCTION ONLY FROM THE MERGE OF S8B-04 (QANDEEL'S VOICE)`.  
**Authority:** the Product Owner's S8B-01 CP2 order (2026-10-28), §1 "Product Owner decision — binding". It was given
after PR #364 merged S8B-01 CP1 (`de774cfd`).  
**Task:** `S8B-01` — CP2. It is not a Connected Worlds phase.

This amendment is additive. It edits neither the [Voice Runtime Contract](../../../voice-runtime-v1.md) nor
[VA-1 … VA-10](QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md). It narrows one passage, quoted below, for two
named models.

---

## 1. The narrowed passage

Voice Runtime Contract §7, "Retention, provider side":

> Zero retention with no training is a selection condition (D-3). A provider that cannot attest it is not selected,
> because it would break the 30-day promise.

The same condition appears in `scripts/s8b-01/bench-plan.json` (`tts.proposedThresholds.mandatory`: "zero retention and
no training").

## 2. VA-11 — the exception

**For Gemini TTS, and only for these two models:**
- `gemini-3.8-flash-tts`;
- `gemini-3.8-flash-lite-tts`.

The **zero-retention** condition is waived. Google's limited retention under the paid-service terms is accepted on these
conditions:

| # | Condition (Product Owner) | How it is met |
| --- | --- | --- |
| 1 | The data is not used to improve or train models, under the paid-service terms. | The Gemini API Additional Terms (last updated 2026-04-28) say that, for Paid Services, Google "doesn't use your prompts" or responses "to improve our products". The pricing page (last updated 2026-10-27) marks "Used to improve our products" as **No** for the paid tier of both models. The key belongs to the paid AI Studio project `QANDEEL`. The *no training* half of the condition is **not** waived. |
| 2 | The actual retention policy and the required disclosures are documented. | §3 and §4. |
| 3 | The 30-day retention of user recordings inside QANDEEL does not change. | Nothing here touches §6 – §7 of the contract. Gemini receives the text of QANDEEL's reply, never a user recording. What QANDEEL stores is its own `QANDEEL` track, confirmed-played only, under the same immutable 30-day expiry. |
| 4 | The exception never extends automatically to ASR or to another provider. | It names two model ids. Every other TTS model, every ASR provider (zero retention stays mandatory, `bench-plan.json` `asr.cp2`) and every other Google product needs its own decision. |
| 5 | No real user data in CP2. | CP2 sends only the invented corpus (`scripts/s8b-01/corpus/`). `SYNTHETIC_ONLY` holds, and the guard admits nothing else (§5). |

## 3. Google's actual retention, as documented (read 2026-10-28)

- **Abuse monitoring.** "Google logs prompts and responses for a limited period of time, solely for detecting and
  preventing violations" of the Prohibited Use Policy and for legal disclosures (Additional Terms). The period is **not
  stated**. Data "may be stored transiently or cached in any country" where Google operates. There is **no
  zero-data-retention option** in the terms.
- **Stored interactions.** By default the Interactions API stores Interaction objects (`store=true`). Paid projects keep
  them 55 days by default, and 7, 14, 28 or 55 days can be set. With **`store: false`**, the request is stateless and
  nothing is kept for later retrieval. The CP2 harness sends `store: false` on every request, and the root contract pins
  it. Production must do the same (§4).
- **Project logs.** AI Studio request logging is per project and can be turned on or off. Its logs are kept up to 55 days
  by default and are not used for product improvement unless a dataset is shared.
  - **Open item:** the Product Owner confirms that logging is **off** for the `QANDEEL` project. No API reports it, and
    the harness cannot verify it.
- **Grounding** (30 days of storage) is not used: the TTS models take text only.

## 4. What production must carry (S8B-04)

- Every Gemini TTS request is `store: false` and goes only from the server-side adapter. The key never reaches a client
  (AGENTS §5).
- The text sent is QANDEEL's released reply only: no user identifier, no Memory container and no guidance.
- **Disclosure.** The text of QANDEEL's spoken replies can contain what the user said. So the Voice disclosure (contract
  §10) and the privacy policy (Stage 9) must name Google as the speech-synthesis processor, with its limited
  abuse-monitoring retention and no training on paid-service data. That wording is a Copy Gate row of S8B-04. It is not
  written here.
- The adapter must be re-verified against Google's terms on the day S8B-04 starts. A change to the paid-tier no-training
  term ends this exception.

## 5. CP2 run controls

The one CP2 run is recorded in `scripts/s8b-01/cp2-approval.json`: the run id, the USD 10 cap across all providers and the
plan hash. Under it, `spend-guard.cjs` admits only:
- `generativelanguage.googleapis.com` and `api.deepseek.com`;
- over https;
- one request per worst-case reservation, inside each bucket and the cap;
- with no retry.

## 6. Effect

| Item | Binds from |
| --- | --- |
| The CP2 evaluation of the two models on synthetic text | this checkpoint (the Product Owner's CP2 order) |
| Selecting either model for production, and the §4 obligations | the merge of S8B-04, after the CP3 selection |
