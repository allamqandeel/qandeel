# Future Improvement — Public topic interpreter: respect the source language

- **Admitted by Product Owner:** 2026-10-27, S8A-05 / CP3 independent human review.
- **Status:** FUTURE / NON-BLOCKING / UNSCHEDULED.
- **Owner:** Future Public semantic interpreter quality work, not S8A-05 CP3/CP4.
- **Evidence:** Tier S/P round 25 (2026-10-27), 15/15 English source-topic meanings returned in Arabic (0/15 matched the source language); some Egyptian colloquial readings also shifted into MSA.
- **Requested behavior:** The meaning, themes and explanation returned by the Public semantic interpreter should respect the principal language/dialect of the source topic. English input should produce English interpretation; Egyptian Arabic should remain colloquial when appropriate; MSA remains MSA. This is interpreter output language, **not** the application's UI copy contract (UI is neutral simplified MSA).
- **Scope:** A future, bounded fix and independent language-specific evaluation. Do not edit the frozen round-25 cases, rubric, thresholds, instructions, scores, or verdict. No provider retry or further paid run is authorized here.
- **Product decision:** The Product Owner personally reviewed the original QANDEEL responses, accepted their quality as correct/suitable for the product and explicitly authorized merging S8A-05 CP3 despite the preregistered Tier S/P result **NOT ACCEPTED**. This is a **separate Product Owner acceptance**, not a retrospective claim that the zero-fabrication test passed. No other improvement from the CP3 review is admitted by this decision.
- **Canonical evidence:** `docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md` §12.7; PR #361.
- **Register reconciliation:** Companion text entry in the future-improvements directory; the existing Word register `QANDEEL_FUTURE_IMPROVEMENTS.docx` is unmodified in this PR. Incorporate this single item into the Word register on its next controlled editing pass without creating duplicate improvement items.
