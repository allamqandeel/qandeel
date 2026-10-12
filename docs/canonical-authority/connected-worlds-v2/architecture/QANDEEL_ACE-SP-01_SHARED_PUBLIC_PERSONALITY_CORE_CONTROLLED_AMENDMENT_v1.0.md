# QANDEEL — Connected Worlds v2
## ACE-SP-01 — Shared / Public QANDEEL Personality Core — Controlled Amendment v1.0

**Status:** `CANONICAL CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`  
**Amends:** the model-facing behavioural guidance of the Shared World QANDEEL reply and of the Public World QANDEEL
response, exactly:
- the [S4-02 implementation record](../../../e2e/QANDEEL_S4_02_SHARED_CONVERSATION_MATERIAL_IMPLEMENTATION_RECORD_v1.md)
  §4 row "Provider, accounting, safety" (its "consumed as they are" for `TEXT_V1_BEHAVIORAL_GUIDANCE`) and §7 step 3
  ("TEXT_V1 guidance + a structural Shared frame");
- the Public model-input composition realized under the
  [S5-04 implementation record](../../../e2e/QANDEEL_S5_04_PUBLIC_DISCUSSION_QANDEEL_FINAL_INTEGRATION_IMPLEMENTATION_RECORD_v1.md)
  §7 step 5 ("The Public-only assembler").

**Binds within, superseding no sentence of:** CW2-03 §41, §43, §44; CW2-04 §21, §22; CW2-08 §17 and H13  
**Does not amend:** everything in §6 below  
**Authority:** the Product Owner — ACE-01 Gate B, Option A (2026-10-12), and the *ACE-SP-01 — Final Product Approval &
Implementation Authorization* (2026-10-12): D-1 … D-4 and the Product Copy Gate CG-1 … CG-6, recorded verbatim in §5  
**Task:** `ACE-SP-01` — the owner of `QAN-BL-ACE-01`. This is a controlled amendment. It is not CW2-09 and not a new
Connected Worlds phase  
**Implementation:** ACE-SP-01, in the pull request that carries this record, in a later commit

This record is additive. CW2-03, CW2-04 and CW2-08 remain the historical frozen records; their bytes are not changed and
their entries in `CW2_SOURCE_PROVENANCE.sha256` stay valid. The S4-02 and S5-04 implementation records are not edited.
For the narrow guidance question below, this later controlled amendment is authoritative. The binding takes effect on
the merge of the pull request that carries it.

---

# 1. Why an amendment is needed

The Foundation Freeze classes core behavioural principles as Controlled Change
([`QANDEEL_FOUNDATION_FREEZE_v1.0.md`](../../../implementation-foundation/QANDEEL_FOUNDATION_FREEZE_v1.0.md)). ACE-01
activated the ONE approved QANDEEL personality core in the Personal conversation only. The Product Owner decided at
ACE-01 Gate B, Option A, that the same personality reaches Shared and Public QANDEEL replies through a world-neutral
variant without the Personal preference clause, after a narrow controlled amendment of S4-02 and CW2-04 / S5-04.

S4-02 recorded Text v1 as "consumed as they are" and the Shared guidance as "TEXT_V1 guidance + a structural Shared
frame". Those two sentences are the only ones this change contradicts. The S5-04 record contains no guidance sentence,
and no CW2 sentence names a guidance, personality or prompt text. The S4-02 and S5-04 records are not entries of the
[Canonical Authority Index](../../CANONICAL_AUTHORITY_INDEX.md), so a section appended to them would not be reachable
through the precedence rules. That is why this is a standalone, indexed amendment, on the precedent of CW2-08A.

---

# 2. Definitions

- **Text v1** — `TEXT_V1_BEHAVIORAL_GUIDANCE`, the eight frozen hard Behavioral Policy lines, byte-identical.
- **The World frame** — `SHARED_CONVERSATION_FRAME` (Shared) or `PUBLIC_QANDEEL_FRAME` (Public): unchanged structural
  text from the current contracts (CG-6).
- **The approved core** — `QANDEEL_PERSONALITY_CORE_V1`, the eight paragraphs the Product Owner approved with ACE-01
  Gate A. It stays the Personal core, unchanged.
- **The world-neutral core** — the approved core with paragraph 3 replaced (CG-1) and one protective phrase changed in
  each of paragraphs 6 and 7 (CG-2, CG-3). Paragraphs 1, 2, 4, 5 and 8 are the approved bytes (CG-5).
- **The Safety humour-suspension line** — `SAFETY_HUMOUR_SUSPENSION_LINE`, IP-IMP-01 Copy Addendum CA-2 R2, reused
  verbatim (CG-4).

---

# 3. The binding rule

For every Shared World QANDEEL reply and every Public World QANDEEL response that reaches the provider, the behavioural
guidance is exactly:

1. Text v1, a line break, the World frame — the bytes those Worlds sent before this amendment, as a verbatim prefix;
2. a blank line, then the world-neutral core;
3. only on a turn the Safety Response Gate decided `GUIDED`: a blank line, then the Safety humour-suspension line. The
   server composition then places it immediately before the Safety guidance block.

Nothing else is added. The locale stays `und`. A `BLOCK` turn reaches no provider and answers with the gate's
deterministic words, as before.

## 3.1 One personality

The world-neutral core is derived from the approved core by reference, in the one Behavioral Runtime file. There is no
second persona, no second copy of any approved paragraph and no World-specific personality. FAST and DEEP receive the
same guidance, and routing decisions are unchanged.

## 3.2 What this amendment does not create

- **No context source.** Shared keeps its exact-World, current-audience conversation. Public keeps Public Servable
  Context only.
- **No Personal data.** No Memory, Human Intelligence, Hypothesis, Recommendation, Question or Personal interaction
  preference enters a Shared or Public model input, and no Personal preference machinery is imported or read.
- **No authority for the requester.** The requesting human's identity is used for cost accounting only and never enters
  the request. The guidance follows the message being answered and the requests made in it. It grants no participant a
  standing preference over the others.
- **No persistence.** No participant's language or style is saved. No setting, preference or saved trait is created.
- **Nothing new at runtime.** No new model call, tone classifier, emotion engine or behavioural runtime.
- **No change to Introduction-phase Shared Worlds' boundaries.** They use the same Shared reply path and gain no
  Matching or Introduction context. The richer behaviour creates no extra privacy authority (the CW2-03 §44 principle).

---

# 4. Exact supersession

S4-02, quoted for traceability only:
- §4, row "Provider, accounting, safety": "`MODEL_ROUTER`, `runWithAiUsageAttribution`, `SafetyResponseGateService`,
  `TEXT_V1_BEHAVIORAL_GUIDANCE` | consumed as they are; one Shared model-input assembler".
- §7 step 3: "the one Shared model-input assembler (TEXT_V1 guidance + a structural Shared frame, Names only, the frozen
  16 KiB history budget, no Memory / HIM / Hypothesis / Recommendation / Question)".

**Amended meaning.** Text v1 and the Shared frame are no longer the whole Shared guidance. They are its verbatim prefix,
followed by the world-neutral core (§3).

Everything else in those sentences is preserved unchanged:
- one Shared assembler;
- Names only;
- the 16 KiB history budget;
- no Memory / HIM / Hypothesis / Recommendation / Question.

The Source Disclosure Gate, I-03F revalidation and the commit sequence of S4-02 §7 are also unchanged.

S5-04 §7 step 5: no sentence is superseded. The Public-only assembler's guidance gains the same world-neutral core,
after its unchanged Text v1 + Public frame prefix.

---

# 5. The amended copy — Product Copy Gate CG-1 … CG-6 (Product Owner approved, 6 / 6, 2026-10-12)

**CG-1 — paragraph 3 — APPROVED.**
- Approved Personal paragraph, unchanged for Personal: "Match the user's language or dialect when reliably supported,
  respecting safety, explicit current requests and durable interaction preferences. Never infer identity from language
  or dialect."
- World-neutral paragraph: "Match the language or dialect of the message you are answering when reliably supported,
  respecting safety and explicit current requests. Never infer identity from language or dialect."
- Changed:
  - "the user's" is removed;
  - "of the message you are answering" is added;
  - "safety," becomes "safety and";
  - "and durable interaction preferences" is removed.

  The second sentence is byte-identical.
- The rejected alternatives (PRIMARY, A2) would have let an earlier language request from one participant become a
  standing preference for the others.

**CG-2 — paragraph 6 — APPROVED.**
- Approved Personal paragraph: "Light humour may arise naturally in suitable everyday moments, but never force it,
  repeat it mechanically, use it at the user's expense, or use it during distress, loss or crisis. Shift immediately to
  a serious register when appropriate."
- World-neutral paragraph: "Light humour may arise naturally in suitable everyday moments, but never force it, repeat it
  mechanically, use it at anyone's expense, or use it during distress, loss or crisis. Shift immediately to a serious
  register when appropriate."
- Changed: "the user's" → "anyone's".

**CG-3 — paragraph 7 — APPROVED.**
- Approved Personal paragraph: "When genuine evidence supports disagreement, be clear and respectful. Explain the reason
  without moralizing, humiliating the user or arguing to win."
- World-neutral paragraph: "When genuine evidence supports disagreement, be clear and respectful. Explain the reason
  without moralizing, humiliating anyone or arguing to win."
- Changed: "the user" → "anyone".

**CG-4 — the Safety humour-suspension line — APPROVED (reuse).**
- Text: "This turn carries safety guidance: do not use humour or playfulness in this reply."
- It is byte-identical to IP-IMP-01 CA-2 R2.
- Its scope is extended to Shared and Public `GUIDED` turns only, without importing or reading any Personal interaction
  preference.

**CG-5 — paragraphs 1, 2, 4, 5 and 8 — APPROVED (reuse by reference).** The approved ACE-01 Gate A wording, verbatim and
from the same source constant. The Personal personality is unchanged.

**CG-6 — the World frames — APPROVED (unchanged).**
- `SHARED_CONVERSATION_FRAME` and `PUBLIC_QANDEEL_FRAME` stay byte-identical, as existing structural text whose source
  is the current contracts.
- No alternative copy authority is created, and neither frame is reworded.

---

# 6. Explicit non-amendments

This amendment does not change:
- CW2-03 §41, §43, §44, §51;
- CW2-04 §8, §9, §19, §21, §22, §23, §28;
- CW2-08 §17, §18, §20, §21, §25, §39–§41, H13, H16, H27;
- CW2-02 §15, §21, §22;
- S4-02 §5, §6, §7 steps 0–2 and 4–6, §9;
- S5-04 §6, §7 steps 1–4 and 6–8, §8, §12;
- the `0139` / `0147` work leases and RPCs;
- `PUBLIC_QANDEEL_RESPONSE_MAX`;
- QIR-004;
- AI usage attribution;
- the ONE Model Router and its FAST / DEEP routing;
- Text v1, the Personal Text v2, the approved core and the durable preference compiler;
- the scope of `QAN-BL-CW-02` (Shared Standing Context, `SHARED-CTX-01`);
- the scope of `QAN-BL-IP-01` (Public Personal preferences, `PUBLIC-PREF-01`);
- the scope of `QAN-BL-MATCH-01`;
- Replay, the Semantic Map, the Shared launch-gate scope, and the CW2-08 publication / entitlement seams.

---

# 7. Implementation status

Realized by ACE-SP-01 in three files:
- `apps/api/src/conversation/behavioral-response-policy.service.ts`: the world-neutral core and one pure append-only
  helper;
- the Shared World assembler, `apps/api/src/shared-world/shared-conversation-model-input.ts`;
- the Public World assembler, `apps/api/src/public-world/public-qandeel-model-input.ts`.

There is no migration, storage, API, screen or provider change. The task's record is the
[ACE-SP-01 implementation record](../../../e2e/QANDEEL_ACE_SP_01_SHARED_PUBLIC_PERSONALITY_CORE_IMPLEMENTATION_RECORD_v1.md).
Real-model behaviour in Shared and Public is validated under `QAN-BL-ACE-02` (Stage 8A).

> **ACE-SP-01 — SHARED / PUBLIC PERSONALITY CORE CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE**
