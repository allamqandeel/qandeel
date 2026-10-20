# Stage 8A — DeepSeek Brain / Production Intelligence — WP0 Product Direction

**Status:** `PRODUCT OWNER DIRECTION / PLANNING ONLY — NO IMPLEMENTATION AUTHORIZATION`  
**Recorded:** 2026-10-20, after Stage 7 PR #351 merged (`daa5c415cb1d3bbbb987ea6e9ce750ceb43768dd`).  
**Scope:** QANDEEL APP repository `allamqandeel/qandeel` (not the separate QANDEEL Company employee model).

## 1. Decision and intent

The Product Owner selects **DeepSeek Flash as the single candidate to qualify** for Stage 8A. This replaces the **multi-vendor model comparison** as the planned Stage 8A work approach; it does not promise provider performance, freeze model/version/API parameters, set plans/credits or approve production launch. Verify exact DeepSeek model identifier, endpoint, reasoning configuration, official pricing, caching terms, service reliability and data/privacy posture before spending real tokens or binding production. Other vendors are not planned for this qualification; a failed capability triggers diagnosis and tuning of DeepSeek and QANDEEL's guidance/architecture first, with any model switch requiring a new PO decision.

**Product success is QANDEEL intelligence plus QANDEEL personality, not merely a working LLM API.** Cost is a major objective, measured jointly with successful outcomes, not optimized by eroding intelligence.

## 2. Personality and interaction decision

QANDEEL's default conversational register is **naturally warm, friendly, familiar, spontaneous and friend-like from the beginning**. It should not sound like a stiff assistant, formal report, canned empathy or excessive bullet formatting. It can show situational light humour naturally, adapt answer depth and organize substantial requests clearly; when grief, urgency, consequential decisions or other serious content require it, it becomes promptly responsible, calm, precise and direct without becoming cold. Respect the user's clear current request and durable reply preferences, their language/dialect, any humour opt-out and Safety. Never claim human identity, invented mutual feelings, non-existent intimacy or memories.

Reuse `apps/api/src/conversation/behavioral-response-policy.service.ts` (existing personality guidance), `apps/api/src/interaction-preferences/interaction-preference-guidance.ts`, the existing ONE `composeServerGuidance`, `ModelRouter`, the approved ACE-01 / ACE-SP-01 / IP-IMP-01 contracts, Safety, and existing Golden Conversations. The existing wording uses 'warm when fitting'; the PO direction elevates friendly closeness as QANDEEL's **baseline**. Any changed approved model-facing text, or frozen Product semantics, must pass its proper reviewed Product Copy / Controlled Amendment approval before changing runtime bytes. Do not build a parallel persona engine, tone-word trigger classifier or extra model call for style.

## 3. Stage 8A outcome gates

1. **Real provider binding and accounting:** production-appropriate DeepSeek adapter(s), correct provider call attribution / admission, working test/production configuration, fast/deep behavior, token and latency instrumentation and error handling. Current production router accepts only OpenAI/Anthropic, so do not pretend DeepSeek is already wired. Evaluation harness currently compares those two and must be adapted to DeepSeek-only without duplicating the existing evaluation framework.
2. **Conversational realism:** natural friendliness, non-mechanical humour, serious shifts, non-robotic brevity, respectful disagreement, coherence across turns and flexibility to produce structured analysis where genuinely needed; avoid mistaking warmth for flattery or fake personal attachment. Evaluate the real model on existing ACE-02 Golden Conversations with PO review.
3. **Reply language and dialect fidelity:** existing IP-02 preferences, temporary-request precedence, Egyptian/Levantine/Gulf/Maghrebi/MSA/English, honouring the relevant user or approved world-neutral language context; no unsupported claim that API locale metadata itself controls the model. Prove with a real model.
4. **Personal knowledge intelligence:** organic acquisition from free conversation, semantic retrieval across sessions, correction and reversal, authoritative Memory vs inferred Hypothesis, relevant HIM guidance, well-grounded answers. Evaluate using synthetic but end-to-end knowledge-bearing sessions, not just the current reply-only bakeoff. Privacy and deletion remain binding.
5. **Shared/Public intelligence:** bind `SharedSemanticInterpreter`, `SharedSpatialPlacer`, `PublicSemanticInterpreter`, `PublicSpatialPlacer` (currently fake in tests, unconfigured fail-closed in normal production), reusing provider-neutral contracts, proven semantic meanings and truthful spatial placement. `QAN-BL-CW-05` requires an explicit Product/Controlled Amendment decision if expanding QANDEEL-output source authority; do not silently alter I-04G or visibility.
6. **Matching intelligence:** `QAN-BL-MATCH-04` requires meaningful knowledge readiness from user-authorized information before real Matching; `QAN-BL-MATCH-03` requires a real compatibility-conclusion producer with source-safe evaluation and accounted cost. Keep the existing I-07B Sensitive Conclusion Filter, consent, neutral pre-Match presentation, disclosure and CW2-08/Stage 9 launch gates. Do not infer third-party private truth or publish a score/rank.
7. **Sustainable economics and operations:** measure successful turn/workflow cost, overall input/output tokens including context, effective prompt cache, latency, budget admission, failure/refusal rate and quality tradeoffs. Avoid pretending low per-token pricing alone proves low real-world cost. All real paid tests require scoped approval and their verified config/budget.

## 4. Provisional work division (not yet eight authorized tasks)

| Proposed slice | Outcome | Prior implementation to reuse |
| --- | --- | --- |
| S8A-01 DeepSeek production connector + first real dialogue | One accounted provider path and scoped smoke, no provider bake-off | Model Router, AI-COST-01, FAST/DEEP |
| S8A-02 QANDEEL friend-like conversation & dialect proof | Tuned approved guidance, Golden Conversations, real model IP-02 / ACE-02 evidence | ACE-01, ACE-SP-01, IP-IMP-01, behavioral policy, Safety |
| S8A-03 Personal understanding reality | Acquisition/correction/semantic retrieval/HIM actual impact proven | Memory, HIM, Question/Recommendation/Hypothesis runtime |
| S8A-04 Shared semantic intelligence | Semantic and spatial production ports; CW-05 reviewed decision | Shared existing contracts, Privacy/Safety, Living Analysis |
| S8A-05 Public semantic intelligence | Reviewed Public semantic/spatial producer | Public publisher review and projection contracts |
| S8A-06 Matching understanding readiness | Knowledge relevance/adequacy proof for real Matching | Matching I-07 lifecycle, S6-01, MATCH-04 |
| S8A-07 Safe Compatibility Conclusion | Producer, filter, attribution, evaluations | I-07B filter, Stage 6 pipeline, MATCH-03 |
| S8A-08 End-to-end qualification | Real-model quality/cost/latency regressions across Personal/Shared/Public/Matching | Reuse all prior QA/harness and provider accounting |

The order is provisional. Focused real-model quality tests begin early and continue through integration; do not defer all personality testing to S8A-08. WP0 independent checks/PO decisions precede each task contract; do not fabricate new frozen authority or reopen closed stages.

## 5. Deferred Voice handoff — contextual Arabic vocalization

The PO explicitly reiterates a prior usability problem: unvowelled Arabic words can have materially different meanings/pronunciations under different diacritics, and naive TTS reads them unnaturally. **Stage 8B**, not Stage 8A, must design/test the **speech-only Arabic contextual disambiguation and pronunciation-preparation step before the selected TTS engine**. The design should resolve from intended conversational meaning and dialect; choose selective diacritics or compatible phonetic pronunciation cues; pass only a verified TTS input while preserving the unchanged visible text and original content. Test ambiguous readings, proper names, colloquial Egyptian, other required dialects, latency and live streaming; define a safe fallback when ambiguous or unsupported. Do not promise universal correct vocalization or hardcode one dialect. This requirement has been appended to existing `QAN-BL-VOICE-01` without a new backlog ID, state, owner or count.

## 6. Lifecycle, sources and next authority gate

- Stage 1–7 planned engineering work is merged (S7-05 PR #351), **not deployed or launch ready**. TalkBack for S7-05 was expressly waived; no newly invented validation obligation.
- Stage 8A: **NEXT, PLANNING DIRECTION ONLY**; no DeepSeek runtime, copy revision, provider payment, code change, task, CI, PR or merge authorized by this record itself.
- Stage 8B: Voice runtime and Arabic pre-TTS vocalization; Stage 9: economy, legal/security/deployment/store and production rollout gates.
- Canonical cross-task backlog IDs and lifecycle remain exactly as before: `QAN-BL-CW-05`, `QAN-BL-IP-02`, `QAN-BL-ACE-02`, `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04`; `QAN-BL-VOICE-01` captures Voice. No new item and no backlog count change.
- Authority precedence: `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md`, canonical backlog, approved ACE/Shared/Public/Matching authorities. This record expresses the **latest explicit PO planning intent**, does not override frozen contracts, and identifies the required future copy/product gates.
