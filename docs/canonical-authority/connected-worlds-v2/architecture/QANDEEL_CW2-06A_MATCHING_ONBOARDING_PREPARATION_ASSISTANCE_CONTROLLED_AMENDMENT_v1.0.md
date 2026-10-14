# QANDEEL — Connected Worlds v2
## CW2-06A — Matching Onboarding Preparation, Onboarding Assistance Consent and the Declared Sex Fact — Controlled Amendment to CW2-06 v1.0

**Status:** `CANONICAL CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`  
**Amends:** [CW2-06](QANDEEL_CW2-06_INTRODUCTIONS_MATCHING_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md) §4–§5 (it adds a
pre-enrollment preparation stage before activation), §7 (it adds one separate consent family beside the Matching
Context Grant, without changing the grant) and §9 (it fixes where the declared sex fact lives and how its confirmation
is evidenced). Only in the scope named in §2–§5 below  
**Does not amend:** every other CW2-06 section and invariant (§7 below), the I-07 runtime (`0108`–`0122`), the
SEC-MATCH-00 protection (`0149`) or the CW2-08 launch law  
**Reason:** the Product Owner's *S6-01 Final Implementation Authorization* (2026-10-13), decisions D2 (secure, erasable
preparation), D3 (`CA-05`, authorized onboarding assistance) and D4 (`CA-09` part 1, explicit sex confirmation). These
resolve, for S6-01's scope, the conflicts the Stage 6 WP0 record classified as `CA-05` and `CA-09` (WP0 record §14.7,
§14.14), and they carry out GATE-05, GATE-11, GATE-12, GATE-15 and GATE-16 (D1) of that record (§14.5)  
**Task:** S6-01 — Intelligent Matching Onboarding. This is a controlled amendment to CW2-06. It is not CW2-09 and not a
new Connected Worlds phase  
**Implementation:** realized by S6-01 (migration `0154`; the
[S6-01 implementation record](../../../e2e/QANDEEL_S6_01_INTELLIGENT_MATCHING_ONBOARDING_IMPLEMENTATION_RECORD_v1.md))

This record is additive. The original CW2-06 file remains the historical frozen record; its bytes are not changed and
its entry in `CW2_SOURCE_PROVENANCE.sha256` stays valid. For the narrow questions below, this later controlled
amendment is authoritative. The binding takes effect on the merge of the pull request that carries it.

---

# 1. Why an amendment is needed

Three things the Product Owner approved have no place in frozen CW2-06 as written:

1. **A preparation stage before enrollment.** CW2-06 §4–§5 go from an offer straight to an explicit activation, with a
   short flow that establishes intent, dealbreakers, preferences, the Introduction Profile and the grant. In the I-07
   runtime every one of those acts writes a participation, profile, requirement or grant version (`0109`), and the first
   such write makes the account undeletable through the governed erasure (`QAN-BL-ACCT-01`). SEC-MATCH-00 therefore
   closed the six widening commands (`0149`), and the Product Owner keeps them closed (D1). The Product Owner approved
   instead a server-side preparation draft that carries none of those consequences (D2).
2. **A second consent family.** CW2-06 §7 fixes the Matching Context Grant's purpose as candidate evaluation and safe
   compatibility reasoning. Helping the user prepare their own onboarding is outside that purpose, so the grant cannot
   be used for it (WP0 `CA-05`; GATE-11). The Product Owner approved a separate, narrow consent family for it (D3).
3. **The declared sex fact.** The Product Owner's opposite-sex rule (WP0 §14.14 D1) needs each human's own declared and
   confirmed sex. CW2-06 §9 forbids inferring it, but nothing in CW2-06 or in the runtime says where the declared fact
   lives or how its confirmation is evidenced, and every Introduction Profile field is a disclosure candidate
   (`0108:578-597`). WP0 recorded this as `CA-09`. The Product Owner split it: S6-01 owns capture, confirmation, owner
   review and correction (part 1); S6-03 owns the pair-level predicate and the durable integration (part 2) (D4).

The Product Owner's non-negotiable rule governs all three:

> **NO REAL MATCHING WITHOUT QANDEEL'S ACTUAL, AUTHORIZED UNDERSTANDING OF THE USER.**

This amendment builds preparation, not Matching. Nothing it creates is enrollment, eligibility or understanding
adequacy, and nothing it creates may be presented as such.

---

# 2. Pre-enrollment preparation

## 2.1 Definition

`MATCHING_PREPARATION_DRAFT` is one owner's private, server-side preparation of their own future enrollment: the
declared basic facts, the optional progressive profile, the hard requirements and soft preferences, and the private
notes the owner wrote or confirmed. It exists so the owner can prepare, review, correct, leave and resume before a
reviewed enrollment path exists.

## 2.2 Binding properties

The preparation draft:

1. is separate from the frozen I-07 state. It is not a `MATCHING_PARTICIPATION_STATE`, an
   `INTRODUCTION_PROFILE_VERSION`, a requirement set, a Matching Context Grant or a Pre-Match Proposal Disclosure
   Authority, and it writes none of them;
2. is owner-scoped. Only its owner reads or changes it, through owner-bound commands that derive the human from the
   authenticated identity. No service-side act on the owner's behalf exists;
3. has versioned updates. Every change names the version it expects, a stale expectation changes nothing and is
   answered as stale, and a repeated command is answered with its first result;
4. is erasable with the owner's account. Every relation it creates is removed by the governed account erasure, and none
   can hold a reference that makes the erasure fail or wait;
5. cannot obstruct the governed account-deletion path, and no preparation write is accepted while the owner's account
   deletion is scheduled;
6. is never enrollment, participation, eligibility, matchability or understanding adequacy, and is never presented as
   any of them;
7. is never read by candidate discovery or evaluation (I-07B), by proposals, by the Public World or by the Shared World;
8. never writes Memory, Hypotheses, HIM or any other Personal intelligence record;
9. sits behind a closed-by-default, operator-controlled preparation gate. An absent gate is closed.

## 2.3 Truthful state

While the six commands `0149` closed stay closed, the end of preparation is a reviewed draft and the statement that
enrollment is not yet available. A reviewed draft is not a submitted enrollment.

---

# 3. `MATCHING_ONBOARDING_ASSISTANCE` — a separate consent family

## 3.1 Scope

```text
grantor  = the user
source   = the user's own current, self-attributed MY_WORLD Memory, in the classes of §3.2
target   = the user's own Matching onboarding preparation
purpose  = assisting the user's own onboarding: showing QANDEEL's relevant prior understanding,
           one item at a time, for the user to confirm, correct or reject
```

The permission:

- is independent of the Matching Context Grant, of participation and of the Pre-Match Proposal Disclosure Authority.
  None of them implies it, and it implies none of them;
- is off by default. It is granted only by the human's explicit act, and revoked by the human at any time;
- is purpose-restricted. It permits no candidate evaluation, compatibility reasoning, disclosure, model call or Memory
  write, and it never transfers into Matching evaluation, the Shared World or the Public World;
- is versioned: every grant records the exact consent text version the user saw.

The Matching Context Grant is never a substitute for it, and it is never a substitute for the Matching Context Grant.

## 3.2 Exact source scope

An item may be shown only if all of these hold when it is read:

- it is a Memory of the caller (`public.memories.user_id` is the authenticated user);
- its status is `ACTIVE` and it has not expired;
- its source is `USER_STATED` or `USER_CONFIRMED`;
- its type is one of `PERSONAL_FACT`, `STABLE_PREFERENCE`, `GOAL` or `DECISION_COMMITMENT`;
- its subject attribution is `SELF` (`memory_subject_attributions`, `0152`).

Excluded, whatever their content:

- Memory attributed to someone else (`OTHER`) and unattributed Memory (no attribution row);
- every other Memory type, including `DERIVED_INSIGHT`, `RELATIONSHIP_CONTEXT`, `INTERACTION_PREFERENCE` and
  `TEMPORARY_STATE`;
- Hypotheses, in any state, as facts or otherwise;
- HIM measurements;
- raw conversation history, transcripts and any other unrestricted conversation content.

## 3.3 Read authority

- The only reader is an owner-bound server boundary that derives the human from the authenticated identity.
- Every read re-checks, in the same statement that reads the Memory, that the owner's assistance consent is current and
  that the preparation and assistance gates are open. Nothing read earlier is reused as authority.
- The reader returns at most a small bounded set, each item with its words exactly as stored. It performs no inference,
  summarization, ranking by meaning, extraction or model call.
- The reader never writes Memory and never changes an item's status.

## 3.4 Confirmation into the draft

- Items are shown one at a time. The user may confirm an item, correct it in their own words, mark it as no longer
  accurate, or decline to use it.
- Only a confirmed or corrected item enters the preparation draft, as the user's own private note. When an item is
  confirmed, the server re-reads it under the same checks as §3.3 and copies its words; a client cannot assert that an
  item came from prior understanding.
- A correction or a rejection changes the draft only. It never changes, supersedes or deletes the Memory.
- The user's decision on each item is recorded without its content, so the item is not asked about again.
- If no item qualifies, or the user declines the permission, onboarding continues as ordinary guided onboarding, and
  QANDEEL does not claim any prior understanding.

## 3.5 Revocation and cleanup

- Revocation takes effect immediately: every later read returns nothing, and a confirmation that reaches the server
  after the revocation is refused.
- Revocation leaves in the draft what the user already confirmed. Those notes are the user's own preparation content
  and are removed with the draft.
- Consent evidence (grant, version and revocation times) holds no Memory content. It is removed with the account by
  the governed erasure.
- Discarding the preparation revokes a current assistance consent and removes the draft, its notes and the recorded
  decisions.

---

# 4. `CA-09` part 1 — the declared sex fact

1. **Values.** Matching v1 knows exactly two declared values, `MALE` and `FEMALE`.
2. **Source.** The fact is declared by the user and then confirmed by the user in a separate act. It is never inferred
   from name, appearance, voice, behavior, language, HIM, Memory, a Hypothesis or a model.
3. **Where it lives.** In the preparation draft's declared facts, with its own confirmation evidence (the state and the
   time of the confirming act), separately from the optional progressive profile fields. It is not an Introduction
   Profile field, it can never be chosen for a Pre-Match Proposal Disclosure Authority, and it is never a
   `matching_proposal_safe_field_keys` value.
4. **Correction.** The owner may read and correct it. A corrected value is unconfirmed until the owner confirms it
   again.
5. **Unknown.** A missing or unconfirmed fact is `UNKNOWN`, and `UNKNOWN` never passes real eligibility.

**Left to S6-03 (part 2):** the pair-level opposite-sex predicate in discovery and in the eligibility snapshot, which
fails closed when either side's fact is missing or unconfirmed; how the frozen-body verifiers of the migrations it
touches are amended; and how the confirmed fact moves into the durable enrolled state.

---

# 5. Declared basics and the other fields

The basics GATE-15 requires, with the sex fact, are declared facts with their own confirmation state: the Introduction
First Name (a distinct source from the account Name, P1 §4, GATE-12), year and month of birth, broad area (country and
first-level region from a controlled catalogue) and marital status. The short self-introduction and the work field are
optional progressive fields. Hard requirements and soft preferences stay separate; "no additional personal hard
dealbreakers" is a valid confirmed answer, and zero soft preferences is valid. Product-wide eligibility rules are not
user dealbreakers and are never written as one. The exact catalogue is in the S6-01 implementation record.

Birth year and month are private source facts. A legal-adult conclusion is drawn only when it is certain at that
precision; otherwise it is `UNKNOWN`. The legal threshold and the jurisdiction rules are Stage 9 decisions and are not
fixed here. Recording a marital status, including currently married, decides no eligibility.

---

# 6. What stays as it is

- **The six commands `0149` closed stay closed** (Product Owner D1). No wrapper, grant, default privilege or
  re-created function reaches them, and SEC-MATCH-00's `NO_BACKDOOR` property is unchanged. The secure enrollment
  path, any `CA-01` amendment and the explicit empty-hard-requirement compatibility change (`CA-10`, `0109:671`) are
  deferred until account-deletion integrity is resolved (`ACCT-DEL-01`).
- **No Pre-Match disclosure** (D6, GATE-24a). No preparation field becomes recipient-visible before a Mutual Match, and
  no Pre-Match Proposal Disclosure Authority is created or implied.
- **The Matching Context Grant** keeps its §7 purpose and its independent requirement for context-based eligibility
  (GATE-10).

---

# 7. Explicit non-amendments

Everything in CW2-06 other than the additions of §2–§5 is preserved unchanged, including:

- product identity and the doorway rule (§1);
- the separation of participation and context authority (§2) and the participation states (§3);
- the entry paths and the rule that an offer is not activation (§4);
- no mandatory identity or age proof (§6);
- the Matching Context Grant (§7) and candidate self-truth (§8);
- the non-inference rule (§9), which this amendment applies and does not narrow;
- the Introduction Profile (§10), the Pre-Match Proposal Disclosure Authority and its ceiling (§11–§12);
- hard dealbreakers, dealbreaker truth and the eligibility snapshot (§13–§15);
- everything from internal evaluation to the canonical invariants (§16–§56) and the deferred list (§57).

---

# 8. Implementation status

S6-01 realizes §2–§5 in migration `0154` and its application and mobile boundaries, behind gates that start closed.
Nothing is deployed or opened. Real enrollment, real eligibility, the pair-level predicate, candidate evaluation and
the understanding-readiness work owned by `QAN-BL-MATCH-04` (Stage 8A) remain unimplemented.

> **CW2-06A — MATCHING ONBOARDING PREPARATION AND ASSISTANCE CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE**
