# QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v3
## Stage 6.5 — Implementation Contract + Build Sequencing

**Status:** CANDIDATE — for final Stage 6.5 Architecture review
**Supersedes:** `…CANDIDATE_v2` (which superseded `…CANDIDATE_v1`)
**Applies:** `QANDEEL_STAGE6_5_BLOCKER_RESOLUTION_AND_V3_RULING_v1` — REV65-08, RESOLUTION-01, RESOLUTION-02, MOM-01…06, TE-01…03, LF-01…04, R-02 freeze
**Carries forward:** `QANDEEL_STAGE6_5_ARCHITECTURE_RULING_v1` — REV65-01…07, A65-01…05
**Date:** 2026-09-03
**Canonical repository baseline:** `f322112ec5b862a83716bf9d65b4553b06931774` (`allamqandeel/qandeel`)

> **Stage 6.5 is NON-CODING and is NOT declared frozen by this package.** No source was modified. No branch, commit, PR or migration was created. No file was written into the repository. No deferred OPEN was resolved. Implementation is **not** authorized by this document.

> ## ✅ BOTH PRODUCT BLOCKERS ARE RESOLVED AND REMOVED
> v2 reported BLOCKER-01 (Thread constitution) and BLOCKER-02 (Live Focus constitution). Architecture has supplied both from the already-frozen Stage 0 / Stage 1 authority, which was outside v2's repository-only inspection scope. **Both are now implemented as contracts in §8A and removed from §36.** A third correction — **REV65-08: a Moment is one committed Conversational Unit, not a finalized exchange** — is applied throughout.
>
> **No Stop Rule fires and no technical blocker is reported.** Three *frozen-authority inputs* (INPUT-01…03) must be handed to the implementing tasks as executable specifications — §36 states them as task preconditions, not as decisions for coding.

---

# 0. Ruling compliance map

## v3 ruling — `QANDEEL_STAGE6_5_BLOCKER_RESOLUTION_AND_V3_RULING_v1`

| Ruling item | Where applied | Outcome |
|---|---|---|
| **REV65-08 / MOM-01…06** Moment = one committed CU | **§8A SDM-01 rewritten** · §12 · §14 · §15 · §18 · §19 · §34 | v2's finalized-exchange mapping **rejected and replaced** |
| **RESOLUTION-01** Thread constitution (§§4–11 of the ruling) | **§8A SDM-02 rewritten** — Emerging Focus, TE-01/02/03, `ThreadEstablished`, Home once, refinement vs reframing, Reading↔Thread binding, lifecycle | BLOCKER-01 **removed** |
| **RESOLUTION-02** LF constitution (§§12–20 of the ruling) | **§8A SDM-04 rewritten** — `NONE \| EmergingFocus(id) \| EstablishedThread(id)`, analysis-derived, LF-01…04, `live_focus_transitions`, §17 same-SP order | BLOCKER-02 **removed** |
| **§18** Emerging Focus identity — nullable `focus_ref` rejected | §8A SDM-04 | stable session-scoped `emerging_focus_id` |
| **§21/§22** R-02 approved, closed/expired-Session correction | **§27A rewritten as frozen policy** · T-13 | integrated; "return to Live" **narrowed** |
| **§23** SDM status | §8A — SDM-01/02/04 rewritten; SDM-03 retained; SDM-05/06 extended | 6 of 6 closed |
| **§24** delta register additions | §8 — **15 new rows** | no Product-semantic row remains `UNKNOWN` |
| **§25** task-sequence consequences | §31–§33 — T-03A split, T-03B unblocked and split, T-03D added; 14 → **19 tasks** | count not preserved cosmetically |
| **§26** new proofs P65-02R / 08 / 09 / 10 | §30 | added; P65-02 **superseded** by P65-02R |
| **§28** blocker expectation | §36 | both removed; **no** replacement TODOs asking coding to decide semantics |
| **§29** Stop Rules | §36 | all eleven tested; **none fires** |

## v1 ruling — carried forward, preserved

| Item | Status in v3 |
|---|---|
| **A65-01** RN New Architecture + Expo CNG + TypeScript in `apps/mobile` | preserved (§5) |
| **A65-02** custom GPU/canvas Map + real accessible View overlay | preserved (§16) |
| **A65-03** virtualized Timeline | preserved, **re-checked against CU Moments** (§18, §19) |
| **A65-04 / REV65-02** `K(TC)` vs disclosure view `V`; `RenderStyle` seam | preserved, **extended to the new object families** (§13, §26) |
| **REV65-03** state/action authority | preserved, **`LF` writer now defined** (§9, §10, §11) |
| **REV65-04** AF64-02 presentation-position scale | preserved verbatim; **re-checked against CU-density growth** (§20, §20A, §20B) |
| **REV65-06** native escape-hatch policy | preserved (§5.6) |
| **REV65-07** Map accessibility / navigation | preserved, **now unblocked** (§21A) |

---

# Implementation Decision Index

```text
CLIENT STACK              → React Native (New Architecture) + Expo CNG, TypeScript, apps/mobile.
                            APPROVED (A65-01).  Escape hatch is a FOUR-LEVEL ladder whose bottom
                            level (dangerous mods / hand-edited native files) is NOT pre-authorized.

MOMENT                    → ONE COMMITTED CONVERSATIONAL UNIT.  Not a turn row, and NOT a
(SDM-01, rewritten)         finalized USER+ASSISTANT exchange.  A CU belongs to exactly one turn,
                            never crosses a turn boundary, and one turn may yield 0..N CUs.
                            USER CU → Moment m ; ASSISTANT CU → Moment m+1 — never merged.
                            The committed-CU substrate is MISSING / BUILD: the repository is
                            turn-oriented and holds no unit, segment, span or utterance concept.

SP                        → per-session, integer, monotonic, GAPLESS over committed CUs, never
(SDM-01)                    assigned to provisional source.  Multiple CUs committed in one
                            operation take ONE contiguous SP block allocated atomically, in source
                            conversational order, preserving ordinal_within_turn.  A timestamp is
                            not SP.

LH                        → greatest committed-CU SP in the Session.  ConversationTurnCompleted
(SDM-01)                    remains operational evidence but is NOT the canonical Moment
                            establishment event; a ConversationalUnitsCommitted event carries the
                            latest committed SP and non-content lifecycle metadata only.

THREAD                    → a persistent, navigable locus of genuine conversational attention
(SDM-02, RESOLVED)          around one sufficiently identifiable, user-addressable focus.
                            Mention → Emerging Focus → Established Thread → Active ↔ Dormant ↔
                            Reopened.  Geography begins only at establishment, by TE-01 explicit
                            user conversational selection, TE-02 sustained substantive engagement,
                            or TE-03 recurrent independent attention.  NEVER by hypothesis-graph
                            connectivity, similarity, score, keyword count or timer.

EMERGING FOCUS            → provisional, session-grounded, PRE-GEOGRAPHIC, may disappear without
(SDM-02/04)                 leaving Thread geography — and carries a STABLE SESSION-SCOPED
                            emerging_focus_id.  v2's nullable focus_ref is rejected: two distinct
                            Emerging Focuses must never collapse into one anonymous value.

LIVE FOCUS  LF            → CURRENT LIVE CONVERSATIONAL ATTENTION ONLY, analysis-derived from
(SDM-04, RESOLVED)          committed conversation.  LF = NONE | EmergingFocus(id) |
                            EstablishedThread(id).  It may change with no navigation act; Map
                            inspection, Pan, Zoom and explicit context activation NEVER set it.
                            Live Focus ≠ Inspected Focus.  History is append-only, SP-anchored.

READING ONTOLOGY          → Reading ≡ Hypothesis (proven in v2, retained).  Readings are
(SDM-03, retained)          interpretations ASSOCIATED WITH a focus; they do not constitute it.
                            Thread↔Reading binding is append-only and validity-aware; binding is
                            not ownership; relation/similarity alone can never create membership.

TWO-LAYER PROJECTION      → K(TC) = TemporalProject(W, TC)   ·   V = Disclose(K(TC), depth, ctx)
(preserved)                 Renderer, accessibility overlay and field navigator all read V.
                            Three states: NOT_KNOWN_AT_TC / NOT_DISCLOSED_AT_DEPTH / NOT_FETCHED.

AF64-02 REACH             → disclosed-presentation position scale in presentation regions;
(preserved)                 bounded cost, log_R N — 45 interactions at 10k, 56 at 100k.
                            Re-checked: CU Moments raise N, and the proof is stated in Moments,
                            so it holds — and matters more.

RECOVERY                  → R-02 FROZEN BY ARCHITECTURE.  Versioned app-private local checkpoint
(§27A)                      of TM, TC, IF_ref, camera intent, RH, session identity + version.
                            On restart: re-read LH AND LF, recompute K(TC) and V, restore no
                            animation.  A restart is not an act, writes no RH, is not
                            Back-reversible.  A checkpoint for a non-current Session is discarded
                            whole and enters the canonical app/session entry flow — NOT a
                            synthesized FOLLOW_LIVE.

TASK COUNT / ORDER        → 19 tasks.  T-03A splits into T-03A1/T-03A2; T-03B unblocks and splits
                            into T-03B1/T-03B2/T-03B3; T-03D added for the LF resolver.
                            Nothing is blocked.  No task decides Product semantics.
```

---

# 1. Authorization + ruling compliance

| Requirement | Compliance |
|---|---|
| Stage 6.5 remains NON-CODING | No code, no repo file, no branch, no commit, no PR, no migration. |
| Canonical baseline `f322112e` | §2, §7A — every canonical read pinned to that SHA via the GitHub Contents API. |
| No fetch into / mutation of the dirty local clone | §3 — verified before and after; 38 entries, same `HEAD`, same branch. |
| Do NOT redo Stage 6.5 from scratch | §43 change log names exactly what changed and what is carried forward untouched. |
| Do NOT repeat broad client-stack research | §5 preserved; no new stack comparison. |
| Preserve unaffected v2 evidence | §5, §6 S1–S8, §13, §17, §20/§20A/§20B, §21A, §22–§26, §37 carried forward. |
| Do not resolve OPEN-06 / 08 / 09 / 19 | §37 — untouched. |
| Do not declare Stage 6.5 frozen | Not declared; §42. |
| Report a TECHNICAL blocker if one appears; do not reopen Product semantics | §36 — **none found**; three frozen-authority inputs named as task preconditions. |

---

# 2. Canonical repository baseline

| Fact | Value |
|---|---|
| Repository | `https://github.com/allamqandeel/qandeel.git` — public, default branch `main` |
| **Canonical baseline** | **`f322112ec5b862a83716bf9d65b4553b06931774`** — *Merge pull request #189*, 2026-09-01T15:55:27Z |
| Read method | GitHub Contents API, every request pinned `?ref=f322112e…` |
| Local `HEAD` (untouched) | `95a48c7` on `docs/design-phase-vi-vi03-visual-truth-matrix-v1` |
| Baseline present locally? | **No** — obtaining it would require a forbidden fetch |

Committed tree, `apps/api` domains, `packages/runtime` (README only), `apps/mobile` (README only), 63 migrations with 60+ executable verifiers, 22 `node --test` contract suites, `docs/design/phase-v` and `docs/implementation-foundation` — as recorded in v2 §2 and unchanged.

---

# 3. Dirty-tree isolation evidence

**38 entries — 4 tracked modifications, 34 untracked.** Verified unchanged after all inspection. The 4 tracked modifications are classified only and never read as canonical. **The untracked `apps/mobile` client spike is excluded from all authority**; at the canonical baseline `apps/mobile` contains only `README.md`.

---

# 4. Source / authority inventory

Stage 6.4 → 6.3 → 6.2 → 6.1 Final Freeze Records → Core Checkpoint v2 → committed repository facts (§7A) → **Phase V frozen structural grammar** → **and, newly authoritative in v3, the Stage 0 / Stage 1 Experience + Conversational Analysis Architecture as transmitted by `QANDEEL_STAGE6_5_BLOCKER_RESOLUTION_AND_V3_RULING_v1`**: the Stage 1.2 Conversational Unit contract, the Stage 1 conversational reference / attention grammar, the Thread Establishment grammar, and the Stage 0/1 Live Conversational Focus contract.

**Stated plainly:** v2 concluded that the Thread and LF constitution rules were missing. They were missing *from the repository and from Phase V*, which was v2's inspection scope; they exist upstream. v3 consumes them as frozen and does not restate, approximate or extend them.

---

# 5. Client Stack Decision Record — preserved

§5.1–§5.5 stand unchanged and are not re-argued. **Selected: React Native (New Architecture) + Expo CNG, TypeScript, as the `apps/mobile` workspace.** C (native ×2) rejected on *semantic divergence risk* and CS-C11; D (Flutter) rejected for forking the contract layer; B retained as a capability, governed by §5.6. **Renderer split:** Map = GPU/canvas + accessibility overlay of real views; Timeline = virtualized list of real views, never a canvas.

## 5.6 Native escape-hatch policy under Expo CNG — preserved

| Level | Mechanism | Authorization |
|---|---|---|
| **1** | Supported Expo / RN APIs and maintained libraries | Default |
| **2** | Idempotent Expo config plugin | Pre-authorized, idempotency asserted in CI |
| **3** | Expo Module / explicit native module | Pre-authorized, with the frozen requirement named |
| **4** | Direct manipulation of generated native files / dangerous mods | **NOT PRE-AUTHORIZED** — task-specific Engineering Architecture review proving no supported path exists, idempotency under regeneration, contained upgrade risk, and CI verification of generated native output |

**Manual edits to generated CNG native projects are not canonical source.**

## 5.7 Committed tech-stack corroboration — preserved

`docs/implementation-foundation/QANDEEL_Recommended_TECH_STACK_v1.0.md` recommends React Native + Expo + Expo Router + TypeScript, mobile-first, with `apps/mobile`. v1 did **not** read it and scored CS-C11 as if `apps/mobile` were empty; the decision is therefore independently derived *and* corroborated. Expo Router and a `contracts` package are naming/navigation choices for T-01/T-02 — **and note that QANDEEL's return acts are not a route stack** (§11).

---

# 6. Technical research inventory — preserved

**S1** RN Accessibility (`accessibilityValue`, `adjustable`, increment/decrement) · **S2** react-native-skia canvas accessibility and the documented overlay pattern · **S3** Reanimated `useReducedMotion` / `ReducedMotionConfig` · **S4** Expo CNG, config plugins, dangerous mods · **S5** FlashList v2 cell recycling at 10⁵ · **S6** carried Stage 6.2/6.3/6.4 findings · **S7** RN `accessibilityActions` **custom** named actions surfaced in the platform actions menu — the mechanism that makes REV65-04 answerable · **S8** the committed tech-stack record (§5.7).

**No new research was conducted for v3.** The ruling supplied Product authority, not technology; the only new evidence in v3 is the targeted repository inspection in §7A.

---

# 7. Repository architecture inventory — unchanged in substance

Monorepo npm workspaces · `apps/api` NestJS with 15 domains · `packages/runtime` declared and empty · `database` with 63 migrations and the protected-transition idiom · `tests/` contract suites · `docs/design/phase-v` · `apps/mobile` README-only with its committed sequencing constraint, honoured in §31.

---

# 7A. Targeted repository inspection record

v2's 16 sources stand. **v3 adds three targeted reads, all bearing on REV65-08:**

| # | Read | What it settles |
|---|---|---|
| 17 | Full-corpus scan for `conversation_unit`, `_segment`, `utterance`, `char_start`, `span_start`, `text_span` | **Zero matches.** No committed-CU substrate of any kind exists → `MISSING / BUILD`, exactly as MOM-04 anticipated |
| 18 | Full-corpus scan for `emerging`, `focus`, `entity_`, `coreference` | **Zero relevant matches.** No Emerging Focus, no focus resolver, no reference/coreference concept exists |
| 19 | `0025_conversation_authority_hardening_v1.sql` + every `UPDATE … conversation_turns` in 63 migrations | **No statement anywhere writes `conversation_turns.content`.** 0025 revokes `INSERT/UPDATE/DELETE` from `authenticated` *and* `service_role`, drops the permissive write policies, and routes all writes through `SECURITY DEFINER` commands — none of which touches `content` |

**Why #19 matters, precisely.** CU identity requires source-span provenance into the turn's text. That is only sound if the source text is immutable once written. It effectively is — but by a *property of the current function set*, not by an enforced invariant. **v3 therefore makes an explicit content-immutability guard a MUST of T-03A1** (§39.4), in the repository's own protected-transition idiom, rather than relying on the enumeration staying true as new commands are added. This is a strengthening, not a defect report.

**Also confirmed for §8A SDM-04's persistence rule:** the repository already establishes the *durable provider-result* pattern — `post_response_intelligence_executions` / `_effects` / `_confidence_batch_items`, plus the durable intent (0029) and association (0031) result migrations. Analytical outputs are persisted as durable facts rather than re-derived. The CU segmenter, the focus/attention resolver and the LF resolver follow that precedent exactly.

---

# 8A. SEMANTIC DOMAIN MAPPING RECORD — all six closed

## SDM-01 — Timeline Moment, `SP`, `LH` — **REWRITTEN per REV65-08**

### v2's mapping is withdrawn

v2 defined a Moment as the finalized USER + ASSISTANT exchange constituted by `finalize_conversation_turn`. **That is rejected.** It was derived from the repository's commitment boundary rather than from the frozen Stage 1.2 unit contract, and it violates three frozen CU properties at once: it merges USER and ASSISTANT contributions into one unit, it makes turn finalization the definition of commitment, and it cannot represent a turn that carries several independently addressable contributions.

### The canonical mapping

> # **ONE COMMITTED CONVERSATIONAL UNIT = ONE `Moment(m)`**
>
> A CU is the smallest contiguous span of committed conversational source material constituting one independently addressable conversational contribution.

| Frozen CU property | Implementation consequence |
|---|---|
| One CU belongs to exactly one runtime turn | `source_turn_id` is `NOT NULL` on every CU |
| One turn may contain multiple CUs | `UNIQUE (source_turn_id, ordinal_within_turn)`; a turn yields **0..N** Moments |
| A CU never crosses a turn boundary | structurally impossible — a CU has exactly one `source_turn_id`; **a rejection fixture asserts no cross-turn span** |
| USER and ASSISTANT contributions cannot form one CU | `speaker` is a CU column, not a pair; **`MOM-02`: USER CU → `m`, ASSISTANT CU → `m+1`, never merged** |
| CU identity begins only when wording, boundary, attribution and provenance are committed/stable | commitment is its own transition, **not** assistant-response completion (`MOM-04`) |
| Provisional/live/revisable source has no permanent analytical authority | no `SP`, no Moment, no Timeline presence, no `K(TC)` membership |

### `MOM-04` — the commitment boundary, stated so it is not weakened

**Stage 6.5 does not make `finalize_conversation_turn` the definition of CU commitment.** Turn finalization is a *runtime* event; CU commitment is a *conversational-source* event governed by the frozen Stage 1.2 contract. They will frequently coincide in time, and the implementation may well perform both in one transaction — but the Product rule is not redefined to fit the existing function. Where they diverge, the CU contract wins.

### `MOM-05` — the required committed-CU substrate — **MISSING / BUILD**

The repository is turn-oriented and holds **no** unit, segment, span or utterance concept (§7A #17). The required substrate, semantically (exact column names are Engineering Architecture):

| Required semantics | Contract |
|---|---|
| Ownership + scope | `user_id`, `session_id`, with the repository's `UNIQUE (id, user_id)` owner-composite idiom so every child FK is owner-scoped |
| Source binding | `source_turn_id NOT NULL`, owner-scoped FK; `speaker` (the turn's role, denormalised onto the CU because attribution is CU-level truth) |
| Order within the turn | `ordinal_within_turn ≥ 1`, `UNIQUE (source_turn_id, ordinal_within_turn)` |
| Source-span provenance | an exact, replayable reference into the committed source text of `source_turn_id` — sufficient for the Stage 1 grammar to re-read the exact wording |
| Commitment provenance | which operation committed it, under which grammar/policy version — following the `policy_version` + `provenance` convention already used by `confidence_evaluations` |
| `SP` | per-session ordinal, `UNIQUE (session_id, sp)`, `sp ≥ 1` |
| Committed timestamp | **audit metadata only** — explicitly not `SP`, and never a commitment criterion |
| Immutability | append-only; `DELETE` rejected; `UPDATE` rejected except by nothing at all — the 0063 protected-transition trigger idiom, with **no** authorized transition |

**And, per §7A #19, a companion guard making `conversation_turns.content` explicitly immutable once written** — because CU spans reference it.

### `MOM-03` — `SP` allocation

`SP` is session-scoped, integer, monotonic, **gapless over committed CUs**, and never assigned to provisional source. When several CUs are committed by one source-finalization operation:

1. allocate **one contiguous `SP` block atomically**, under the session row lock;
2. assign in **source conversational order**;
3. preserve `ordinal_within_turn` as the within-turn tiebreak.

Because allocation and commitment are the same transaction, *every Moment has an `SP`* and *every `SP` denotes a committed CU* are both structural. **A timestamp is not `SP`.**

**Consequence for Stage 6.2, checked rather than assumed:** the ordinal constant step holds — `SP` is gapless, so the index *is* the position (§18). What changes is **density**: one exchange may now produce several Moments, so `N` grows by the average CUs-per-turn factor. §20B's bounded-reach proof is stated **in Moments**, so it is unaffected in form and more necessary in practice.

### `MOM-06` — `LH` and its delivery

`LH` = the greatest committed-CU `SP` in the Session. It advances **only** on CU commitment.

**`ConversationTurnCompleted` is retained as operational evidence and demoted:** it is **not** the canonical Moment establishment event once Moment = committed CU, because a turn can complete while committing zero CUs, or commit several. The canonical event is an equivalent of:

```text
ConversationalUnitsCommitted
```

emitted transactionally with the commitment. It may carry the **latest committed `SP`**, source/session identity, and non-content lifecycle metadata — and nothing else.

**Three committed facts make this fit the existing outbox unusually well.** The table's `contains_content = false` `CHECK` is already unconditional, so a content leak through this event is structurally impossible. Its `UNIQUE (event_type, subject_turn_id)` accommodates exactly one batched CU-commit event per source turn. And the transactional-outbox pattern is already the committed idiom. **The additions are:** widening the `event_type` `CHECK` (currently exactly three values) and adding the client-facing delivery surface, which does not exist at any baseline — the controller exposes four request/response routes and the outbox drains to an internal transport.

**Delivery rule:** the event tells the client *that* `LH` advanced and *to which `SP`*; the client then **re-reads entitled Timeline data through the §13 projection boundary**. `FOLLOW_LIVE` is always *event → entitled re-read*, never *event payload*.

### `MOM-01` restated as a rejection fixture

```text
conversation_turn row  ≠  Moment
finalized exchange     ≠  Moment
```

Both are asserted negatively in **P65-02R**, and the second explicitly: an exchange is never one Moment merely because it finalizes atomically.

---

## SDM-02 — Canonical Thread — **RESOLVED**

### Constitution

> # **A Thread is a persistent, navigable locus of genuine conversational attention around one sufficiently identifiable, user-addressable focus/subject.**

A Thread is **not** a keyword, an entity mention, a person-name occurrence, a runtime turn, a Reading/Hypothesis, a connected component of competing hypotheses, an embedding/similarity cluster, or something created because QANDEEL finds it analytically interesting.

```text
Mention / Entity  →  Emerging Focus  →  Established Thread  →  Active ↔ Dormant ↔ Reopened
                                             ▲
                                   persistent geography begins HERE
```

**v2's disproof of `Thread = connected component(competing_hypothesis_ids)` is accepted and retained** — and is now redundant, since relations are formally excluded from constituting focus.

### Focus continuity

Committed CUs belong to the same focus continuity when their conversational subject/reference **resolves to the same canonical focus identity** under the frozen Stage 1 reference / attention grammar. The focus may be a sufficiently identifiable person, topic, place, organisation, relational focus, or other subject the grammar permits.

**Mere lexical similarity does not constitute continuity.** Same-name and ambiguous references obey the frozen reference / coreference / disambiguation contract (**INPUT-02**, §36). The implementation resolves; it does not define.

### Emerging Focus — **MISSING / BUILD**

Provisional · session/conversation-grounded · **pre-geographic** · not yet a Thread · allowed to disappear without leaving Thread geography.

**Creation requires at least one committed CU containing genuine independent conversational-attention evidence.** QANDEEL-generated Readings, Unknowns, Questions and analytical interest **may strengthen** an Emerging Focus; they **may not create one**, and may never establish a permanent Thread without conversational grounding.

**Identity (per the ruling's §18, correcting v2):** every Emerging Focus that may become `LF` receives a **stable session-scoped `emerging_focus_id`** — provisional, non-geographic, not a Thread id, sufficient for focus continuity and history, and allowed to terminate. **v2's nullable `focus_ref` is rejected**: two distinct Emerging Focuses must never collapse into one anonymous value.

| Required semantics | Contract |
|---|---|
| Identity | `emerging_focus_id`, `UNIQUE (session_id, emerging_focus_id)` — session-scoped by construction |
| Grounding | append-only evidence rows, each citing the committed CU `SP` that contributed attention evidence, with a **reason code** |
| Termination | an explicit terminal state; termination leaves **no** geography |
| Promotion lineage | `promoted_to_thread_id`, written once at establishment. **The pre-establishment object is not retroactively a Thread** — the Emerging record and its history survive promotion unchanged |

### Establishment — the canonical promotion test

A Thread is Established only when **both** hold:

```text
A. genuine independent conversational attention
AND
B. user-addressable significance / stable subject identity
```

| Path | Rule |
|---|---|
| **TE-01** — explicit user conversational selection | A **single** committed CU may establish the Thread if the user explicitly selects/addresses a sufficiently identifiable focus as the subject of attention. **Incidental mention is not enough.** |
| **TE-02** — sustained substantive engagement | Multiple committed CUs sustain substantive independent attention to the same Emerging Focus such that the subject is no longer incidental. |
| **TE-03** — recurrent independent attention | The focus returns independently across committed conversation and demonstrates stable user-addressable continuity. |

> **No generic numeric score, similarity threshold, keyword count or timer is the establishment rule.** The implementation **may** use deterministic evidence predicates and reason codes — and **must** record which path fired — but may not replace the semantic paths with a score. This is a rejection fixture in T-03B2, not a guideline.

### The establishment event — **MISSING / BUILD**

`ThreadEstablished`, occurring after a committed CU makes TE-01/02/03 true, in one transaction recording: stable Thread identity · **establishing `SP`** · establishing Session · **establishment reason/path** (`TE_01|TE_02|TE_03` + evidence reason codes) · grounding focus identity (the `emerging_focus_id` promoted) · **permanent Home locus**.

| Requirement | Contract |
|---|---|
| **Home assigned exactly once** | written at insert from **then-legitimate world context**; immutable thereafter, enforced by a `BEFORE UPDATE` guard trigger in the committed protected-transition idiom |
| **No Thread in `K(t)` before its establishment `SP`** | decided by **ordinal comparison** `established_at_sp ≤ SP(TC)` — no clock involved |
| **No future Home borrowed backward** | follows from the two above: the locus is fixed at establishment and the Thread is invisible before it |

### Identity refinement vs reframing

**Refinement of the same focus preserves Thread identity. Genuine reframing into a different conversational subject creates a new Thread.** Two established Threads are **never** merged because later analytical relations or competing Readings connect them — *relations do not constitute Thread identity*. A merge path is therefore **not implemented at all**, which is the strongest available guarantee that `Home(e, t ≥ establishment) = constant` holds.

### Reading ↔ Thread binding

> **Readings are analytical interpretations associated with a conversational focus; they do not constitute the focus itself.**

A Reading may receive a Thread contextual binding **only when its subject grounding legitimately resolves to that Thread/focus**. Contract: an **owner-scoped, append-only, validity-aware** binding table with `bound_at_sp` and nullable `unbound_at_sp`, so a binding's then-current state at any `TC` is an ordinal comparison rather than a mutable current row (the failure mode §8B documents for peer relations).

- binding does **not** duplicate Reading identity;
- **contextual appearance does not create ownership**;
- a canonical Reading **may** have more than one legitimate contextual appearance where upstream truth supports it;
- **relation or similarity alone can never silently create Thread membership** — asserted negatively in P65-08.7.

### Lifecycle

| State | Meaning |
|---|---|
| **Active** | Established Thread currently receiving conversational attention |
| **Dormant** | same identity and Home after attention has **stably shifted away** — **conversational, never clock- or timer-based** |
| **Reopened** | a **committed conversational return**; preserves identity and Home; **does not create a new Thread** |

v2's append-only lifecycle-history direction is **approved**: `analysis_thread_lifecycle_transitions`, modelled exactly on `hypothesis_lifecycle_transitions` (0036) — owner-composite FK, an `IMMUTABLE` edge-check predicate shared by the table `CHECK` and the single internal transition core, RLS on, `SELECT` to `authenticated`, **no INSERT/UPDATE/DELETE grant to any application role** — plus an `at_sp` column, because Stage 6.3 requires the *past* lifecycle to be reconstructable at any `TC` while rendering current state only.

---

## SDM-03 — Reading / analytical object ontology — **retained from v2**

**Reading ≡ Hypothesis**, proven feature-for-feature against Phase V's frozen grammar: reading states are exactly the `hypotheses` status vocabulary; assumptions, disconfirming conditions and stored role membership are literal committed columns; peers are unranked; and numeric confidence is forced `NULL` by `confidence_score_unassigned_check`, which is committed proof that Stage 6.3's `FORBIDDEN` channel has no quantity to leak.

**One correction from RESOLUTION-01:** the classification table's "Peer relation" row is now explicitly **not** a Thread-membership signal. Its Map role is an edge between Readings; it has no bearing on focus identity.

**Object family union** in `packages/runtime`, extended for v3:

```text
MapObject = Thread | Reading | Material | Unknown | ContextualAppearance
FocusRef  = NONE | EmergingFocus(emerging_focus_id) | EstablishedThread(thread_id)
```

Each carries an explicit `kind`, so a schema change cannot silently change what the Map believes an object is. **Emerging Focus is a `FocusRef`, not a `MapObject`** — it is pre-geographic and has nothing to draw.

---

## SDM-04 — Live Focus `LF` — **RESOLVED**

### Constitution

> # **`LF` is CURRENT LIVE CONVERSATIONAL ATTENTION ONLY.**

It is **not** importance, rank, centrality, confidence, analytical strength, permanent priority, the currently inspected object, the latest Map click, or user-owned context activation.

### Value domain

```text
LF  =  NONE
    |  EmergingFocus(emerging_focus_id)
    |  EstablishedThread(thread_id)
```

`NONE` is **legitimate** — before a stable live focus exists, and after attention leaves a prior focus without establishing another. Eligible targets are **exactly** Emerging Focus and Established Thread. **Readings, Material, Questions, Unknowns, Evidence edges and Confidence objects are never direct `LF` targets**; they may be inspected or participate in analysis without becoming live conversational focus.

### Analysis-derived, not user-declared

`LF` is derived from **committed conversational attention** under the frozen grammar, and **may change with no navigation act**. A Map action — inspection, Pan, Zoom, contextual navigation — **does not change `LF`**.

```text
Live Focus  ≠  Inspected Focus            (Stage 4, preserved)
```

**Explicit conversational selection may change `LF`** — because it is itself committed conversational evidence: a committed user CU that explicitly makes Focus X the subject of conversation may create/update Emerging Focus X, establish Thread X under TE-01, and make X the current `LF`. **This is not the same as clicking X in the Map.** Conversational intent and UI inspection remain separate, and P65-10 proves it.

### Change rule

| | Rule |
|---|---|
| **LF-01** New independent focus | a committed CU grounds a real shift to a new Emerging Focus or Established Thread |
| **LF-02** Continued local focus | attention remains on the current focus — **no transition is written** |
| **LF-03** Return | a committed CU returns to an existing Established Thread; `LF` becomes that Thread, and if it was Dormant the lifecycle may transition to **Reopened under the same committed conversational evidence** — one transaction, one evidence basis |
| **LF-04** Stable departure | `LF` may become `NONE`. **Brief interruptions do not necessarily change `LF`, and no wall-clock timer alone changes it** |

### Same-`SP` resolution order (the ruling's §17)

All five steps occur **inside the CU commitment transaction**, so `LF` and Thread state are a function of committed CUs only and there is **exactly one effective `LF` per `SP`**:

```text
1. CU is committed / receives SP
2. references + conversational focus are resolved
3. Emerging Focus continuity is resolved
4. optional Thread establishment occurs
5. effective LF for that SP is resolved
```

If the same CU establishes the currently attended Emerging Focus as a Thread, **the effective `LF` at that `SP` is the newly Established Thread**. Earlier `SP`s retain the Emerging Focus in history. **No historical rewrite occurs** — which is why the promotion lineage in SDM-02 keeps the Emerging record intact rather than converting it.

### History and transport — **MISSING / BUILD**

`live_focus_transitions`, **append-only and anchored to committed-CU `SP`**, recording the transition value as one of `NONE` / `EMERGING(emerging_focus_id)` / `THREAD(thread_id)` — never a nullable anonymous Emerging focus.

**Why persisted rather than derived, restated with the frozen rule behind it:** Stage 5.5 must bind `LF_at_activation` and `LF_at_post-live-boundary` **without re-deriving today's focus for a historical boundary**. Both become ordinal look-ups — *the row with the greatest `SP ≤ SP(boundary)`* — against one append-only log. That **eliminates** rather than narrows the binding-time race that blocked the Stage 5 freeze once already (AMB-01), because there is no mutable current value to read twice.

**Delivery** rides the same client subscription surface built for `LH`, carries **no content**, and requires an entitled re-read through the §13 boundary.

**Determinism obligation.** The focus/attention resolver and the `LF` resolver may consult analytical providers, but their **outputs are persisted as durable canonical facts at commitment time and are never re-derived at read time** — following the committed durable-provider-result precedent (§7A). Re-derivation would make historical `LF` a function of today's analysis, which is a hindsight violation and a Stop Rule.

### Context Activation is not `LF`

```text
Explicit Context Activation  =  user-owned context binding
Live Focus                   =  analysis-derived current conversational attention
```

The committed `conversation-context-activation` contract — *"QANDEEL may never silently infer or auto-bind one from conversation content"* — remains valid and **does not redefine `LF`**. v2 read that clause as evidence that `LF` could not be produced; it is in fact a rule about **user-owned context binding**, a different object. **No contradiction exists, and neither contract may be implemented as the other.** P65-10 proves both directions.

---

## SDM-05 — `KF` / `VF` / `VT` — **retained, extended**

v2's findings stand in full:

- **A `version` integer is not a version history**, and `hypotheses.version` is bumped by **three** paths, one of which (`link_competing_hypotheses`) writes **no audit** — so a replay meets version numbers no audit describes, and **must not interpolate**.
- **Migration 0036 is forward-only and its audit "starts empty"** → historical Reading status below that boundary is `NOT_RECONSTRUCTABLE`, exposed as a **knowledge-horizon floor**.
- **The `attach_hypothesis_evidence` bypass (0005) is still un-defanged**, so two evidence-attach paths exist, one audited and one not. Closing it is a named migration.

**Extended for v3.** The five new families are **append-only or immutable by construction**, so their `KF`/`VF`/`VT` are exact rather than reconstructed: committed CUs (`SP` is both identity-order and knowledge time), Emerging Focus evidence, Thread establishment and lifecycle (`at_sp`), Thread↔Reading bindings (`bound_at_sp`/`unbound_at_sp`), and `LF` transitions (`SP`-anchored). **This is deliberate:** the legacy families are the ones with reconstructability debt, and nothing new is allowed to join them.

---

## SDM-06 — Historical reconstructability — **retained, extended** (matrix in §8B)

Rule unchanged: **an audit table covering one mutation path does not prove full object-state history**, discharged path-by-path.

---

# 8B. P65-01 — Domain-history reconstructability matrix

| Family | Identity | Version history | Validity | `KF` | Then-current state | Provenance | **Class** |
|---|---|---|---|---|---|---|---|
| **Committed CU / Moment** *(new)* | ✔ | ✔ append-only, no retraction | ✔ | ✔ `SP` | ✔ | ✔ span + commitment provenance | **MISSING / BUILD → FULL by construction** |
| **Emerging Focus** *(new)* | ✔ session-scoped id | ✔ append-only evidence | ✔ | ✔ `SP` | ✔ | ✔ reason codes | **MISSING / BUILD → FULL by construction** |
| **Thread — establishment + Home** *(new)* | ✔ | ✔ immutable | ✔ `established_at_sp` | ✔ | ✔ | ✔ TE path + grounding focus | **MISSING / BUILD → FULL by construction** |
| **Thread — lifecycle** *(new)* | ✔ | ✔ append-only, 0036 idiom | ✔ `at_sp` | ✔ | ✔ by replay | ✔ | **MISSING / BUILD → FULL by construction** |
| **Thread ↔ Reading binding** *(new)* | ✔ | ✔ append-only | ✔ `bound_at_sp` / `unbound_at_sp` | ✔ | ✔ | ✔ grounding basis | **MISSING / BUILD → FULL by construction** |
| **`LF` transitions** *(new)* | ✔ | ✔ append-only | ✔ `SP`-anchored | ✔ | ✔ | ✔ LF-01…04 reason | **MISSING / BUILD → FULL by construction** |
| **Reading — status** | ✔ | ✔ **from 0036 only** | ✔ post-0036 | ~ not ordinal-anchored | ✔ post-0036 by replay | ✔ `source` | **PARTIAL / EXTEND** |
| **Reading — evidence participation** | ✔ | ~ one path audited, one not | ~ | ~ | ~ only if the bypass is closed | ✔ | **PARTIAL / EXTEND** |
| **Reading — peer relations** | ✔ | ✘ none | ✘ | ✘ | ✘ | ✘ | **CURRENT-ONLY / BUILD HISTORY** |
| **Reading — assumptions / disconfirming conditions / statement** | ✔ | ✘ none | ✘ | ✘ | ✘ | ✘ | **CURRENT-ONLY / BUILD HISTORY** |
| **Material** (Memory) | ✔ | ~ supersession lineage only | ~ | ✔ | ~ lineage-level | ✔ | **PARTIAL / EXTEND** |
| **Unknown** (Gap) | ✔ | ~ `open_epoch` count only | ✘ prior closures erased on reopen | ✔ | ✘ current epoch only | ✔ | **PARTIAL / EXTEND** |
| **Question — contextual appearance** | ✔ | ✔ immutable | ✔ terminal states | ✔ turn-anchored | ✔ | ✔ | **FULL HISTORY / REUSE** |
| **Confidence** | ✔ | ✔ append-only | ✔ `target_version` | ✔ | ✔ | ✔ | **FULL HISTORY / REUSE** |
| **HIM** | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **NOT IN v1 PROJECTION** |

**The shape of the debt is now clear and bounded.** Everything v3 builds is `SP`-anchored and append-only. The two `CURRENT-ONLY` rows are legacy, both on the Reading family, and both must gain history before a `PINNED` Map renders them truthfully — until then `K(TC)` returns `NOT_RECONSTRUCTABLE`, never today's value.

---

# 8. Architecture Delta Register — v3

30 v2 rows, revised, plus the 15 rows the ruling's §24 requires. **No Product-semantic row remains `UNKNOWN`, and no row is `BLOCKED`.**

| # | Frozen requirement | Class | Evidence / smallest correction |
|---|---|---|---|
| 1 | **Committed Conversational Unit substrate** | **MISSING / BUILD** | §7A #17 — zero unit/segment/span/utterance concepts in 63 migrations. `conversation_units` per MOM-05. |
| 2 | **CU commitment producer** (segmenter under the frozen grammar) | **MISSING / BUILD** | No such component exists. Output persisted durably per the 0024/0029/0031 precedent. **INPUT-01** required. |
| 3 | **CU → `SP` allocation** | **MISSING / BUILD** | No sequence/identity/`nextval` anywhere. Contiguous atomic block under the session lock. |
| 4 | **Turn source-text immutability guard** | **PARTIAL / EXTEND** | §7A #19 — no statement writes `content`, and 0025 revoked all direct write authority; make it an enforced invariant rather than a property of the current function set. |
| 5 | **CU-commit / `LH` event delivery** | **PARTIAL / EXTEND** *(server)* + **MISSING / BUILD** *(client)* | Widen the outbox `event_type` `CHECK`; `contains_content=false` and `UNIQUE(event_type, subject_turn_id)` already fit. No client-facing surface exists. |
| 6 | **`LH` derivation** | **MISSING / BUILD** | Greatest committed-CU `SP`; `ConversationTurnCompleted` demoted to operational evidence (MOM-06). |
| 7 | **Emerging Focus entity + continuity** | **MISSING / BUILD** | §7A #18 — no focus/reference/coreference concept exists. Session-scoped stable id; **INPUT-02** required. |
| 8 | **Emerging → Thread promotion lineage** | **MISSING / BUILD** | `promoted_to_thread_id` written once; the pre-establishment object is never retroactively a Thread. |
| 9 | **Thread constitution / establishment evaluator** | **MISSING / BUILD** | TE-01/02/03 with deterministic evidence predicates and reason codes; **no score may substitute**. **INPUT-03** required. |
| 10 | **`ThreadEstablished` event** | **MISSING / BUILD** | Records identity, establishing `SP`, Session, TE path, grounding focus, Home. |
| 11 | **Immutable Home assignment** | **MISSING / BUILD** | Written once from then-legitimate world context; `BEFORE UPDATE` guard; **no merge path is implemented at all**. |
| 12 | **Thread ↔ Reading contextual bindings** | **MISSING / BUILD** | Owner-scoped, append-only, validity-aware; binding ≠ ownership. |
| 13 | **Thread lifecycle history** | **MISSING / BUILD** | 0036 idiom + `at_sp`; Dormancy conversational, never timer-based. |
| 14 | **`LF` resolver** | **MISSING / BUILD** | LF-01…04, inside the CU commitment transaction; outputs persisted, never re-derived. |
| 15 | **`LF` transition history** | **MISSING / BUILD** | `live_focus_transitions`, `SP`-anchored, three-valued, append-only. |
| 16 | **`LF` client delivery** | **MISSING / BUILD** | Same non-content subscription surface as `LH`. |
| 17 | **R-02 local committed-navigation checkpoint** | **MISSING / BUILD** *(client-local)* | §27A; app-private, versioned, session-keyed. Not a migration. |
| 18 | **Reading / object ontology** | **PARTIAL / EXTEND** | Reading ≡ Hypothesis proven; typed union extended with `Thread` and `FocusRef`. |
| 19 | **Reading status history** | **PARTIAL / EXTEND** | 0036 forward-only → knowledge-horizon floor. |
| 20 | **Reading evidence-participation history** | **PARTIAL / EXTEND** | 0008 audited; **0005 bypass must be defanged**. |
| 21 | **Reading peer-relation history** | **CURRENT-ONLY / BUILD HISTORY** | `link_competing_hypotheses` writes no audit. |
| 22 | **Reading assumption / disconfirming-condition history** | **CURRENT-ONLY / BUILD HISTORY** | No mutator writes history. |
| 23 | **Material history** | **PARTIAL / EXTEND** | Supersession lineage only. |
| 24 | **Unknown lifecycle history** | **PARTIAL / EXTEND** | Reopen clears closure metadata; add append-only epoch history. |
| 25 | **Contextual appearance** | **REUSE** | `formal_question_turn_bindings` — the template for every new appearance record. |
| 26 | **Confidence receipt** | **REUSE** | Append-only, version-targeted. |
| 27 | **Layer A `K(TC)`** | **MISSING / BUILD** | Now projects Threads by `established_at_sp ≤ SP(TC)`, Emerging history, `LF` history, CU Moments. |
| 28 | **Layer B `V`** | **MISSING / BUILD** | Separate contract; the depth ladder's Thread rung is now a real object. |
| 29 | **Three-state expression** | **MISSING / BUILD** | `NOT_KNOWN_AT_TC` / `NOT_DISCLOSED_AT_DEPTH` / `NOT_FETCHED`. |
| 30 | **Canonical `S` on the client** | **MISSING / BUILD** | No client. |
| 31 | **Map world model, camera, Semantic Zoom** | **MISSING / BUILD** | **No longer blocked** — Home loci are now defined. |
| 32 | **Timeline model, horizon, window** | **MISSING / BUILD** | Re-checked for CU density (§18). |
| 33 | **`RH` and the six return acts** | **MISSING / BUILD** | **All six unblocked** once T-03D lands. |
| 34 | **`IF_ref` / `IF_render` divergence** | **MISSING / BUILD** | Derived client-side from `V`. |
| 35 | **Accessible Map navigation** | **MISSING / BUILD** | §21A; **no longer blocked**. |
| 36 | **Shared contract types** | **PARTIAL / EXTEND** | `packages/runtime` exists, declares the role, empty. |
| 37 | **Test infrastructure / CI / auth** | **REUSE / EXTEND** | Jest, `node --test`, migration-verifier discipline, `apps/api/src/auth`. |
| — | **Conflict between committed behaviour and frozen semantics** | **NONE FOUND** | The committed runtime is *silent* about CUs, focus and `LF`, not contrary to them. The one apparent conflict — the context-activation no-auto-bind rule — is resolved by RESOLUTION-02 §20: it governs user-owned context binding, not `LF`. |

---

# 9. State-class inventory

- **A · Canonical Product State — the authoritative independently mutable variables:** `LH`, `LF`, `TM`, `TC`, `IF_ref`, `MC` **intent**, `RH`.
  > `K(TC)` remains a canonical product projection derived from authoritative world truth + `TC`; it is not an independently mutable variable and is not stored in class A. **`LF` now has a defined producer** (the resolver, at CU commitment) and remains server-authoritative.
- **B · Derived Product State** — `K(TC)`, **`V = Disclose(K(TC), depth, ctx)`**, `IF_render`, divergence, locatability, projection-state expression, disclosure horizon, derived visible footprint.
- **C · Transient Interaction State** — `PTC`, pointer/gesture stream, held-activation timing, in-flight presentation target.
- **D · Presentation State** — Timeline window position, disclosed-presentation position (§20A), responsive composition, animation progress, virtualized rendered range, focus proxies.

```text
TimelineWindow ≠ TC ≠ PTC              animation progress ≠ semantic settle
responsive viewport envelope ≠ Map geography
K(TC) ≠ V        not disclosed at depth ≠ not known at TC ≠ not fetched
Live Focus ≠ Inspected Focus           committed CU ≠ runtime turn ≠ finalized exchange
Emerging Focus ≠ Thread                contextual binding ≠ ownership
```

---

# 10. State Ownership Matrix

| State | Class | Owner | Producer | Mutation authority | Persistence | `RH`? | API? | Recovery | Test oracle |
|---|---|---|---|---|---|---|---|---|---|
| `LH` | A | client store, mirrored | **server — committed-CU `SP`** | authoritative server event only | server-durable | no | **yes** | **re-read** | **P65-02R** |
| **`LF`** | A | client store, mirrored | **server — the LF resolver, inside the CU commitment transaction** | authoritative server event only; **no client action, ever** | server-durable, **append-only history** | no | **yes** | **re-read** | **P65-09, P65-10** |
| `TM` | A | client store | user acts | frozen Product actions with authority over `TM` | session-scoped + **R-02 checkpoint** | **yes** | no | §27A | mode-transition fixture |
| `TC` | A | client store | user acts | frozen Product actions with authority over `TC` | session-scoped + **R-02 checkpoint** | **yes** | no | §27A | commit fixture |
| `K(TC)` | B | server-resolved, client-cached | Layer A | recomputed on `TC` change | **cache only — never checkpointed** | no | **yes** | **recomputed** | entitlement fixtures |
| `V` | B | derived | Layer B | recomputed on depth/context change | **cache only — never checkpointed** | no | **yes** | **recomputed** | P65-03 |
| `IF_ref` | A | client store | explicit inspection acts | inspection acts only; **never rebinds**; **never sets `LF`** | session-scoped + **R-02** | **yes** | no | §27A | IF-A…E, **P65-09.6** |
| `IF_render` | B | derived selector | resolution against `V` | none — computed | none | no | no | recomputed | divergence fixture |
| `MC` **intent** | A | client store | camera-authorising acts | those acts only; **never sets `LF`** | session-scoped + **R-02** | **yes** | no | §27A | camera fixtures |
| derived visible footprint | B/D | render layer | intent × surface envelope | recomputed on resize | none | **no** | no | recomputed | AF64-03 |
| `RH` | A | client store | effective transactions | transaction commit only | session-scoped + **R-02** | — | no | §27A | Back / Exact-Return |
| `PTC` | **C** | interaction layer | Preview | interaction layer only | **never** | **no** | no | discarded | MA-08 / IN-01 |
| disclosure horizon | B | derived selector | `= TC` at rest, `= PTC` while previewing | none | none | no | **yes** | recomputed | AX4-05 |
| Timeline window position | **D** | Timeline component | scroll / window navigation | **component only** | **never** | **no** | no | may reset | REV64-AT-01 |
| disclosed-presentation position | **D** | position control | §20A | **component only** | **never** | **no** | no | may reset | P65-04 |
| animation progress | D | presentation controller | motion | controller only | **never** | **no** | no | resolves immediately | X64-01/02 |
| responsive layout · input stream | D · C | layout · gesture system | surface geometry · platform | those only | never | no | no | recomputed / cancelled | RP-03 · X64-06B |
| lifecycle render state | B | derived from `V` | Layer B | none | none | no | via projection | recomputed | HT-01…04 |
| projection-state expression | B | derived from `TM` (+`TC<LH`) | mode | none | none | no | no | recomputed | X63-03 |

---

# 11. Action Catalog

The v2 catalog stands, with the blocked acts released and one invariant added.

## Class-A writer invariant — preserved from v2

> **Presentation / transient actions may not write Class A.** Class A changes **only** by (1) an explicit frozen Product action with authority over that field, or (2) an authoritative upstream/server event explicitly allowed by frozen semantics.

| Class-A field | May be written by |
|---|---|
| `LH` | authoritative server event only — the committed-CU event |
| **`LF`** | **authoritative server event only — the resolver's committed transition. No client action of any kind, including every Map act.** |
| `TM`, `TC` | `COMMIT_MOMENT`, `COMMIT_LIVE_EDGE`, `COMMIT_MOMENT_AND_LOCATE`, `RETURN_LIVE_HEAD`, **`GO_LIVE_AND_LOCATE`**, `EXACT_RETURN`, `BACK_ONE_STEP` |
| `IF_ref` | explicit inspection acts, `EXACT_RETURN`, `BACK_ONE_STEP` |
| `MC.intent` | `PAN`, `ZOOM_SEMANTIC`, `CHOOSE_LOCUS`, `RETURN_WORLD`, **`RETURN_LIVE_FOCUS`**, `GO_LIVE_AND_LOCATE`, `EXACT_RETURN`, `BACK_ONE_STEP` |
| `RH` | transaction commit only, on an **effective** change |

## Released and added

| Action | Status in v3 | Note |
|---|---|---|
| `RETURN_LIVE_FOCUS` | **UNBLOCKED** | Activation-time binding against the **committed** `LF` value; if `LF = NONE` the act is a **no-op with no fabricated landing** and no `RH` |
| `GO_LIVE_AND_LOCATE` *(P5)* | **UNBLOCKED** | Post-live one-shot binding reading `LF` from the append-only history at the boundary `SP`, never re-derived |
| `PRESENTATION_POSITION_MOVE(Δregions)` · `…_REFINE / _WIDEN` | preserved | class D only |
| `MAP_FOCUS_OBJECT(o)` | preserved | camera-follows-focus; **explicitly does not write `LF`** |

> **New catalog-wide invariant (RESOLUTION-02):** **no action in this catalog writes `LF`.** `LF` has no client-side writer at all. This is the executable form of *Live Focus ≠ Inspected Focus*, and its rejection fixture is P65-09.6.

**Second invariant, unchanged:** no action whose semantic boundary is "none" may ever produce an `RH` entry.

---

# 12. Event / derived-state flow

```text
committed source ──▶ [CU COMMITMENT TRANSACTION]
                          1. CU committed → contiguous SP block (gapless)
                          2. references + conversational focus resolved
                          3. Emerging Focus continuity resolved
                          4. optional Thread establishment (TE-01/02/03) → Home, once
                          5. effective LF for that SP resolved → live_focus_transitions
                          ├─▶ ConversationalUnitsCommitted   (latest SP, no content)
                          └─▶ ThreadEstablished              (identity, SP, path, Home)
                                     │
world truth W ──▶ [LAYER A: K(TC) = TemporalProject(W, TC)]      ← temporal/epistemic entitlement
                                     ▼
                  [LAYER B: V = Disclose(K(TC), depth, ctx)]     ← Semantic Zoom disclosure
                                     │
client store (A): LH  LF  TM TC IF_ref MC-intent RH
        │                            │
        ├─ selectors (B): V-derived view · IF_render · divergence · horizon · lifecycle
        ├─ interaction (C): PTC · gesture stream ─┐
        │                                         ▼
        └─ presentation (D): Timeline window · presentation position · animation · layout
                                                  │
                              ┌───────────────────┴────────────────────┐
                    Map canvas + a11y overlay + field navigator   Timeline virtualized list
                         └────────── all read  V  ────────────────┘
```

**One direction only:** A → B → D. C may propose (Preview); only a frozen Product action moves it into A. **D never writes A or B. `LH` and `LF` enter only from the server.**

---

# 13. Two-layer projection architecture — preserved, extended

```text
K(TC) = TemporalProject(W, TC)          Layer A — temporal / epistemic
V     = Disclose(K(TC), depth, ctx)     Layer B — Semantic Zoom disclosure
```

**Layer A** decides knowledge availability (`KF`), then-validity (`VF`/`VT`), contextual-appearance availability, relation and evidence availability, Confidence and Question/Gap entitlement, lifecycle truth, and no-hindsight filtering. **Future-unavailable material MUST be filtered before it reaches any general semantic UI surface.**

**Extended for v3** — Layer A now also decides, all by ordinal comparison against `SP(TC)`:

| Family | Rule |
|---|---|
| **Moments** | committed CUs with `SP ≤ SP(TC)` |
| **Threads** | present iff `established_at_sp ≤ SP(TC)`; Home as assigned at establishment — **never a later Home** |
| **Thread lifecycle** | replayed from `analysis_thread_lifecycle_transitions` up to `SP(TC)`; the client renders **current state only** (Stage 6.3), but the projection knows the past |
| **Thread ↔ Reading bindings** | active iff `bound_at_sp ≤ SP(TC) < COALESCE(unbound_at_sp, ∞)` |
| **Emerging Focus** | pre-geographic; it has **no Map presence at any depth**, and appears only where `LF` history is legitimately expressed |
| **`LF` at a boundary** | the transition row with the greatest `SP ≤ SP(boundary)` — **read, never re-derived** |

**Layer B** decides what of temporally-entitled truth is disclosed at the current depth — World / Thread / Session / Reading / Source-Provenance — where the **Thread rung is now a real object rather than a placeholder**.

## The three-state contract — preserved

| State | Meaning | Renders as | Accessible phrasing |
|---|---|---|---|
| `NOT_KNOWN_AT_TC` | Layer A: not yet known/existent at `TC` | historical absence — nothing drawn | nothing; no placeholder, no count |
| `NOT_DISCLOSED_AT_DEPTH` | Layer B: entitled but not shown at this depth | the depth-appropriate summary form | *"shown at greater depth"* — never *"unavailable"* |
| `NOT_FETCHED` | transport: entitled, disclosed, not retrieved | pending | *"loading"* — never *"none"* |

**A transport optimization may never redefine `not fetched` as `not known`.** Layer B may be served in slices; a slice boundary produces `NOT_FETCHED` and there is no code path from it to `NOT_KNOWN_AT_TC`.

**Accessibility source:** the overlay, the field navigator and the renderer all derive from **`V`** — never from raw `K(TC)`, never from the canvas.

---

# 14. Backend / API delta

| Need | Class | Note |
|---|---|---|
| **Committed CU persistence + span provenance** | **MISSING / BUILD** | MOM-05; migration + verifier |
| **Turn content-immutability guard** | **PARTIAL / EXTEND** | §7A #19 |
| **`SP` allocation (contiguous atomic block)** | **MISSING / BUILD** | MOM-03 |
| **`ConversationalUnitsCommitted` event + `event_type` widening** | **PARTIAL / EXTEND** | MOM-06 |
| **Client-facing subscription/poll surface** (`LH` **and** `LF`) | **MISSING / BUILD** | none exists at the baseline |
| **Emerging Focus + continuity resolver** | **MISSING / BUILD** | INPUT-02 |
| **Thread establishment evaluator + `ThreadEstablished`** | **MISSING / BUILD** | TE-01/02/03; INPUT-03 |
| **Immutable Home assignment** | **MISSING / BUILD** | guard trigger; **no merge path** |
| **Thread lifecycle transitions** | **MISSING / BUILD** | 0036 idiom + `at_sp` |
| **Thread ↔ Reading bindings** | **MISSING / BUILD** | append-only, validity-aware |
| **`LF` resolver + `live_focus_transitions`** | **MISSING / BUILD** | inside the CU transaction |
| **Layer A / Layer B read endpoints** | **MISSING / BUILD** | §13 |
| Peer-relation, assumption, gap-epoch history | **BUILD HISTORY** | required before any truthful `PINNED` Map |
| `attach_hypothesis_evidence` defang | **EXTEND** | 0036 precedent — revoke, don't drop |
| Auth / session identity | **REUSE** | `apps/api/src/auth` |
| Timeline windows, camera, motion, `RH`, `PTC`, presentation position, **R-02 checkpoint** | **not an API concern** | client-side; §15 |

**Not reopened:** the frozen Backend Intelligence Architecture. Every addition is a substrate, a projection, a read surface, or an append-only history in the repository's own idiom.

---

# 15. Schema / persistence delta

| Item | Verdict |
|---|---|
| `conversation_units` (+ `SP`, span provenance, `ordinal_within_turn`, commitment provenance) | **Persist** — append-only; `DELETE` rejected; **no authorized `UPDATE` at all** |
| `conversation_turns.content` immutability guard | **Enforce** — currently a property of the function set, not an invariant |
| `emerging_focuses` + attention evidence | **Persist** — session-scoped, append-only, terminable |
| `analysis_threads` + immutable `home_locus` | **Persist** — Home written once, guard trigger, **no merge path implemented** |
| `analysis_thread_lifecycle_transitions` | **Persist** — append-only, `at_sp`, 0036 idiom |
| `thread_reading_bindings` | **Persist** — append-only, `bound_at_sp` / `unbound_at_sp` |
| `live_focus_transitions` | **Persist** — append-only, `SP`-anchored, three-valued |
| Peer-relation / assumption / gap-epoch history | **Persist** — append-only |
| `TM` / `TC` / `IF_ref` / `MC` intent / `RH` | **Not persisted to the backend.** Persisted **locally, app-private, versioned** under the frozen R-02 policy (§27A) |
| **`PTC`, animation progress, input stream, responsive layout, Timeline window position, presentation position, cached `K(TC)`, cached `V`** | **Never persisted, anywhere — including in the R-02 checkpoint** |

Every migration ships with an executable `verify-migration-*.mjs`.

---

# 16. Map rendering architecture — preserved, unblocked

Five separated concerns: **canonical spatial model** (Thread Home loci — **now defined**, canonical identity, relation truth, contextual appearances; author-owned world coordinates; **no layout engine may compute geography**) · **projection model** (`V`) · **camera intent** (class A) · **surface envelope** (class D) · **presentation** (motion, focus, chrome, the two `PARAM` channels).

**Render pipeline:** `world coords → (camera intent × surface envelope) → screen coords → canvas draw`, and **from the same transform** → accessibility overlay node positions. Draw pass, overlay and field navigator all consume `V`.

**Lifecycle** is drawn as object-intrinsic boundary constitution (HL-02) — never position, scale, opacity or salience — with state notation on the overlay node's accessible name at every depth (HL-03, HL-10), and the **presence floor** (HL-04) as a render-layer invariant.

**New in v3:** **Emerging Focus has no Map presence at any depth.** It is pre-geographic by frozen definition; drawing it would create geography before establishment and borrow a Home backward. A Thread appears on the Map **only** from its `established_at_sp` onward, at the Home assigned then.

---

# 17. Camera / surface-envelope architecture — preserved

Canonical camera **intent** in class A; **derived visible footprint** as a pure function of intent × surface envelope; a responsive breakpoint is not a navigation act and writes no `RH`; forbidden on resize — moving world anchors, recentring to content, refitting, changing semantic depth, inventing a destination; **Exact Return** restores the stored *intent*, never a content fit (AF64-03).

---

# 18. Timeline architecture — re-checked against CU Moments

Ten owners as in v2, with owner 3 sourced from `V` and now **CU-based**:

| # | Owner | Class |
|---|---|---|
| 1 | temporal state (`TM`, `TC`) | A |
| 2 | disclosure horizon | B |
| 3 | ordinal target model — **disclosed committed CUs, `SP`-ordered** | B |
| 4 | Timeline presentation window | D |
| 5 | virtualized target rendering + focus | D |
| 6 | relative forward continuation | C → A on commit |
| 7 | Live target | A on commit |
| 8 | P3a actions | A on commit |
| 9 | platform accessibility adapter | D over B |
| 10 | disclosed-presentation position scale (§20A) | D |

## What REV65-08 changes here, checked rather than assumed

| Question | Answer |
|---|---|
| **Does the constant ordinal step survive?** | **Yes.** `SP` is gapless and monotonic over committed CUs, so the index *is* the position — and this is now a property of the *data*, not only of the layout. |
| **Does one-Moment traversal still mean one thing?** | **Yes**, and it becomes finer-grained: the semantic unit is one committed CU. A USER contribution and the ASSISTANT contribution answering it are **two** traversal steps, not one. |
| **What about a batched commit?** | A single commit operation may advance `LH` by several `SP` in **one** event. That is a *delivery* fact, not a navigation fact: `FOLLOW_LIVE` lands on the greatest `SP`, and relative traversal still moves exactly one Moment. **Stage 6.2's traversal unit is unchanged.** |
| **Does density growth break anything?** | `N` grows by the average CUs-per-turn factor. Constant step is unaffected; §19's virtualization is designed for 10⁵; and §20B's reach proof is **stated in Moments**, so it holds as written — and matters more, which is why §20A is load-bearing rather than a nicety. |
| **`Moment(LH)` vs `LIVE_EDGE`?** | Unchanged. `Moment(LH)` is the greatest committed CU; `LIVE_EDGE` remains a distinct, co-temporal, non-metric target rendered **outside** the list, consuming no ordinal extent. |

```text
TimelineWindow ≠ TC      TimelineWindow ≠ PTC      presentation position ≠ temporal position
one turn may be several Moments — and is never one Moment merely because it finalized atomically
```

---

# 19. Timeline virtualization / window architecture — preserved

Data source is the disclosed ordinal target model from `V` — the list's item count **is** the disclosed count, so undisclosed material has no representation to leak. Cell recycling for 10⁵-scale sessions. **Focus stability under recycling is a first-class acceptance criterion.** The window position is the scroll offset, class D. Post-`TC`, the list contains only disclosed targets, so scrolling **cannot** reach undisclosed material — RE-10 is enforced by the data source, not a guard.

---

# 20. AF64-02 — practical disclosed-region reach — preserved

**Retained:** `presentation-position navigation ≠ temporal cursor navigation`; a position control over the already-disclosed presentation extent is legal in principle; it writes an offset, never `TC`.

**Withdrawn in v2 and still withdrawn:** any `O(1)` claim for assistive interaction, and any appeal to library-internal complexity. The acceptance requirement is **bounded / practical user interaction cost**.

# 20A. The Disclosed-Presentation Position Scale — preserved

```text
P ∈ [0, 1]   0 = beginning of the disclosed extent   1 = the disclosure horizon
```

**`P` is not session time, not a temporal unit, and names no Moment.** It is the virtualized list's scroll position expressed as a fraction of disclosed content extent — so its exposed form carries **no Moment count at all**.

- **Movement unit:** `R` equal presentation regions, `R = 10`, **independent of Moment count**. One adjustment moves 1/R of the current span; the whole span is crossed in **≤ R adjustments at any history size**.
- **Granularity refinement:** custom actions **Refine** (the current region becomes the new span) and **Widen** (restore the parent). Depth to bring a screenful into range is `⌈log_R N⌉`.
- **Three bounded absolute custom actions**, one interaction each: *beginning of disclosed history* · *end of disclosed history* (the horizon) · *current temporal position* (a **presentation** return writing no state). The action list is **fixed at five** and never grows with content.

| Modality | Primitives |
|---|---|
| **Touch** | momentum scroll; direct drag on the position control; the three absolute actions as controls |
| **Pointer** | direct position manipulation; wheel/trackpad; Home/End |
| **Keyboard** | Home/End; page keys; focus the control and use arrows (one region per press) with refine/widen on a modified key |
| **Assistive** | `accessibilityRole="adjustable"` moved by `increment`/`decrement` **in presentation regions**, plus the five custom actions in the platform actions menu (§6 S7) |

| Metadata | Rule |
|---|---|
| `accessibilityValue.text` | **MUST** — describes disclosed-presentation position and granularity |
| `min` / `now` / `max` | **MAY**, as `0 / P×100 / 100` — legal **only here**, because the scale is normalized over the disclosed extent |
| Anything expressed in Moments | **MUST NOT** — no count, index, remainder or total, at any granularity |
| Undisclosed extent | **MUST NOT** participate — structural, since the list contains none |

> **A scrubber over the *disclosed presentation extent* is a scroll position. A scrubber over *session time* would be a temporal cursor, and would be OPEN-08.** Three separation tests, all rejection fixtures in T-05: what it writes (class D only); what its units are (presentation fractions); what it does at the horizon (stops, because there is nothing beyond it to scroll to).

# 20B. P65-04 — bounded reach at 10,000 and 100,000 — preserved

| Modality | `N` = 10,000 | `N` = 100,000 | Scaling |
|---|---|---|---|
| Touch | **1–2** | **1–2** | constant |
| Pointer | **1–2** | **1–2** | constant |
| Keyboard | ≤ 45 *(or ≤ 2 with direct entry)* | ≤ 56 | log₁₀ N |
| **Assistive** | **≤ 45** | **≤ 56** | log₁₀ N |
| *Rejected baseline* — one-Moment increments | 8,500 | 89,500 | linear |

A tenfold history costs **eleven more interactions, not ninety thousand**. Throughout, in all four modalities and at both sizes: `TM` unchanged · `TC` unchanged · `PTC` never created · `RH` unwritten · nothing beyond the horizon visible, focusable, countable or announced · **no temporal unit larger than one Moment anywhere in the mechanism**.

**Re-checked for v3:** the proof is stated **in Moments**, so CU-level Moments — which raise `N` — leave it valid in form and stronger in motivation.

---

# 21. Accessibility platform mapping — preserved, extended

| Element | Mapping | Metadata exposed | Never exposed |
|---|---|---|---|
| Disclosed-region target navigator | the virtualized list over `V`; each disclosed **committed CU** a real, labelled, focusable view | accessible name; focus state | `min`/`now`/`max`; set size; position-in-set; any total |
| Relative forward action | one `adjustable` control + `increment`/`decrement` | **`accessibilityValue.text` only** | **no `min`, `now`, `max`**; no remaining count; no advance end-stop |
| Live target | its own view outside the list | name and state | any ordering relative to `Moment(LH)`; any "later than" phrasing |
| P3a acts | primary activation + a discrete second control | both act names, distinguishable **before** invocation | — |
| Presentation-position control | §20A | `text` (MUST); normalized range (MAY) | anything in Moments; anything undisclosed |
| Map objects | overlay views, one per object in `V` within the footprint | identity as disclosed; **lifecycle state as a state description** | `disabled`/`unavailable` for Dormant; anything not in `V` |
| **`LF` expression** *(new)* | a status element naming the **current live conversational focus** as a relationship, when entitled | that `LF` is `NONE`, an Emerging Focus, or a named Thread | **any implication of importance, rank, centrality, strength or priority** — RESOLUTION-02's forbidden readings |
| Depth-withheld material | depth-appropriate summary form | *"shown at greater depth"* | *"unavailable"*, *"none"*, or any withheld count |
| Projection state | a status element | mode as a pinned/fixed temporal projection; *"earlier than current Live"* only when true (AF63-01) | counts, direction, completion |
| IF divergence | a standing element | the *relationship* | the unavailable side; remedy-based D/E phrasing (AF63-05) |

**The conventional range role remains rejected on evidence**, with the deliberate asymmetry stated: the §20A position control **may** publish a normalized range because its range is disclosed-extent only; the relative-forward control **may not**, because its range would be temporal.

---

# 21A. Map accessibility and navigation mapping — preserved, unblocked

Two structures, both derived from **`V`**: the **overlay** (one node per object in `V` within the footprint — spatial parity) and the **field navigator** (an ordered, focusable enumeration of **all** objects in `V` at the current depth; focusing an entry moves the camera). The navigator's membership is exactly `V` — precisely what a sighted user can reach by panning, so it is neither a leak nor less than parity.

| Frozen intent | Route |
|---|---|
| Semantic Zoom In / Out | named control **and** custom action; never pinch-only |
| Return World | named control / custom action; **no-op when already at World** |
| **Return Live Focus** | **UNBLOCKED** — named control / custom action; **no-op with no fabricated landing when `LF = NONE`** |
| **Go Live + Locate (P5)** | **UNBLOCKED** — a discrete named act, distinct from Return Live Head **before** invocation |
| Select / inspect a disclosed object | primary activation on an overlay node or navigator entry; **never changes `LF`** |
| Contextual-locus choice | an explicit chooser over loci entitled at `TC` and disclosed at depth; never a "nearest" heuristic |
| Orientation / projection chrome | content-independent status element |

**Spatial Pan without a geometric drag:** **camera-follows-focus** (moving focus through the field navigator brings each object into the footprint — the user names a destination, the system computes the vector) plus **four directional viewport actions** for exploratory movement, fixed in number. What is identical to the sighted route: Home loci, world coordinates, semantic neighbourhood, membership, disclosure and the resulting `MC.intent`. What differs: only how a camera destination is expressed. **Never done:** exposing off-depth or future objects to improve reach, or synthesising an ordering the visual field lacks.

**P65-07 is now fully executable** — the Map half was blocked only by the absence of Threads and Home loci.

---

# 22. P3a modality mapping — preserved

| Modality | Act 1 — temporal only | Act 2 — Temporal + Locate |
|---|---|---|
| Touch | tap the target | tap the discrete locate affordance |
| Pointer | click the target | click the same discrete affordance |
| Keyboard | primary activation on the focused target | a second, distinctly named activation |
| Assistive | primary activation | a custom accessibility action **plus** the discrete control |

Distinguishable before invocation; never hover-, drag-, modifier-, long-press- or path-gesture-only; identical settle/locus/`RH` behaviour in every modality; zero-locus says nothing about the spatial outcome.

---

# 23. Motion / presentation-controller architecture — preserved

A controller that subscribes to committed state and owns none of it. It cannot write `TM`, `TC`, `IF_ref`, `MC.intent` or `RH`, decide commit, or gate settle. Historical projection changes resolve **immediately** — no ghost, no cross-fade, no per-object interpolation. Reduced motion via the platform config plus an explicit subscription for mid-session change. Interruption retargets from the current presentation value, and **no animation frame is ever an `RH` checkpoint**.

**New in v3, for the same reason:** an `LF` change arriving from the server is a **committed state change**, not an animation trigger. The controller may depict the transition; it may never gate it, and `motion = 0` must leave the `LF` expression identical.

---

# 24. Responsive architecture — preserved

Chrome recomposes; **canonical Map geography does not**. Across any breakpoint or rotation: `TM`, `TC`, `IF_ref`, `MC.intent`, `RH` preserved; focus preserved or moved to the equivalent affordance; footprint recomputed; **no `RH` write**; and **an active Preview survives** — only a genuine input-stream cancellation cancels it.

---

# 25. Interruption implementation rules — preserved, one row added

| Case | Rule |
|---|---|
| Preview + spatial input | Preview cancels **first**, then the spatial act executes; no Preview `RH` |
| Preview + new temporal input | the new input owns Preview; the old `PTC` is discarded |
| Preview + Return to Live | executes from **committed** state, not from `PTC` |
| Camera motion + new camera act | retarget to the newest authoritative destination; one transaction per effective act |
| Camera motion + `Back` | reverses the latest effective **transaction**, not frames |
| Historical transition + new `TC` | previous transition abandoned; new projection resolves immediately |
| P3a settling + new act | P3a's boundary is frozen and unaffected |
| Responsive recomposition, input stream alive | **`PTC` survives**, target re-mapped, no `RH` |
| Platform terminates the input stream | input-cancellation event → discard `PTC`, withdraw transient disclosure, no commit, no `RH` |
| Presentation-position movement during Preview | **`PTC` survives** — repositioning is presentation, not input cancellation |
| **`LF` changes while a Preview is active** *(new)* | **`PTC` survives; no commit; no `RH`.** `LF` is server truth arriving asynchronously and has **no authority over temporal state** — it may update the `LF` expression and nothing else |
| Reduced-motion preference change | motion resolves immediately; no `RH` |
| No-op activation | nothing starts, nothing cancels, no acknowledgement animation, no `RH` |

Recomposition is a **layout** event; cancellation is an **input** event; they arrive on different channels, and the layout system has no write access to class C at all.

---

# 26. OPEN-17 — reversible-seam proof — preserved, re-checked

Two `PARAM` channels, both confined to the Map render layer as an injected `RenderStyle` consumed only by the canvas draw pass: `RenderStyle.ambient` and `RenderStyle.emptySpace`. **Its only inputs are static design tokens** — not `W`, not `K(TC)`, not `V`, not the camera, not counts, and **not `LF` or Thread lifecycle**.

| # | Condition | Proof |
|---|---|---|
| 1 | No Home-locus mutation path | positions come solely from `project(worldCoords, cameraIntent, surfaceEnvelope)`; `RenderStyle` is **not a parameter** and is consumed after it. **Strengthened in v3:** Home is now also immutable *in the database*, so a style token could not reach it even through a write path. |
| 2 | No future-relative input path | Layer A filters server-side, so no future-relative fact exists client-side — and `RenderStyle` takes no projection input regardless |
| 3 | No depth-relative input path | `Disclose()` runs before and independently of the render layer; `RenderStyle` is not an argument to it |
| 4 | No semantic meaning depends on the parameter | overlay and field navigator are built from **`V`**; every semantic channel is `TRUTH`, not a parameter |
| 5 | A conservative default is valid | uniform ambient treatment and content-independent empty space satisfy `M-02`, `M-03`, `M-04`, the absence rule, `S5-HIST-08`, `S5-HIST-10` |
| 6 | Later tuning needs no migration | render-time only: not in `S`, not persisted, not in any schema, API payload or event, never in `RH`, absent from both projection layers and the accessibility layer |

**P65-05** asserts: identical `K(TC)`, identical `V`, identical canonical state, identical accessible tree (overlay **and** navigator), identical Home loci, identical three-state classification — pixels differing only in the two non-semantic channels.

**Disposition rule:** any channel that cannot satisfy all six against its actual boundary becomes **`FIXED`** or is removed. **OPEN-17 is not widened.** T-04 merge gate.

---

# 27. Reload / recovery matrix

| State | Re-render | Route change | Background→foreground | Reconnect | **Process restart (R-02)** |
|---|---|---|---|---|---|
| `LH`, **`LF`** | preserved | preserved | **re-read** | **re-read** | **re-read authoritative value** |
| `TM`, `TC` | preserved | preserved | preserved | preserved | **restored from checkpoint** |
| `IF_ref`, `MC.intent`, `RH` | preserved | preserved | preserved | preserved | **restored from checkpoint** |
| `K(TC)`, `V`, all derived | recomputed | recomputed | recomputed | refetched | **recomputed — never restored** |
| `PTC` | preserved in-component | discarded | discarded | discarded | **discarded** |
| Timeline window position, presentation position | preserved | may reset | may reset | may reset | **reset** |
| Animation progress | resolves | resolves | resolves | resolves | **not restored** |
| Responsive layout, input stream | recomputed / cancelled | — | — | — | — |

---

# 27A. Recovery policy — **R-02, FROZEN BY ARCHITECTURE**

v2 recommended R-02; Architecture has **approved it for v1**. It is no longer a recommendation and is integrated as a contract.

## The policy

Persist a **versioned, app-private, local** checkpoint containing committed navigation intent sufficient to restore:

```text
TM  ·  TC  ·  IF_ref  ·  canonical camera intent  ·  RH
     ·  session identity  ·  checkpoint version
```

**Do NOT persist:** `PTC` · animation progress · input-stream state · Timeline presentation window/position · responsive layout · **cached `K(TC)`** · **cached depth-disclosed view**.

## On restart

1. **re-read authoritative `LH`**;
2. **re-read authoritative `LF`**;
3. **recompute `K(TC)`**;
4. **recompute the depth-disclosed view `V`**;
5. **restore no presentation animation.**

## The restart itself

```text
is not a user act   ·   writes no RH   ·   is not Back-reversible
```

`Back` after a restart reverses the last real user transaction, exactly as it would have without the restart.

## Non-current Session — the v2 phrase is narrowed

v2 said *"discard the checkpoint and return to Live."* **Too broad.** If the checkpoint's Session is no longer an active/current Session:

- **discard the checkpoint whole** — never a partial restore;
- **do NOT synthesize `FOLLOW_LIVE` for a Session that has no active Live edge** — there is no Live edge to follow, and manufacturing one would be a fabricated temporal state;
- **enter the canonical app/session entry flow for the current authoritative runtime state**;
- **no `RH` entry is written.**

The exact screen and chrome of that entry flow is **implementation routing, not a new Stage 5 temporal semantic.** The committed `conversation_sessions.status ∈ {ACTIVE, IDLE, CLOSED, EXPIRED}` already supplies the authoritative test.

An **unrecognised checkpoint version** is likewise discarded whole.

## Why this changes no Stage 5 return semantics

1. **Only class A is checkpointed**; `LH`/`LF` are re-read; every projection is recomputed.
2. **The restart is not an act** — no `RH`, not effective, not reversible.
3. **Restoration cannot manufacture hindsight** — `K(TC)` and `V` are recomputed from the restored `TC`. Restoring `TC` restores a *question*, never an *answer*.
4. **Divergence behaves as frozen** — `IF_ref` is restored exactly; `IF_render` is re-resolved against the fresh `V`; if the world moved on, divergence appears, which is correct and already frozen.
5. **`Moment(LH)` vs `LIVE_EDGE` is preserved** — `TM` is restored as a *mode*: `FOLLOW_LIVE` re-reads `LH` and follows it; `PINNED(m)` restores `m` unchanged even if `LH` advanced during the kill.
6. **`LF` is never checkpointed** — it is server truth, re-read on restart, so a stale focus cannot be resurrected locally.

## P65-06 — recovery fixture

| Fixture | Expected |
|---|---|
| `FOLLOW_LIVE` | `TM = FOLLOW_LIVE`; `LH` and `LF` re-read; `TC = LH`, which **may have advanced** |
| `PINNED(m)` historical | `TM = PINNED(m)`, `TC = m` unchanged; `K(TC)`/`V` recomputed; **no drift toward Live** |
| Active `IF` divergence | `IF_ref` exact; `IF_render` re-resolved; divergence chrome as frozen |
| Non-empty `RH` | restored intact; `Back` reverses the last real user transaction; **the restart is not an entry** |
| *(negative)* transient/presentation state | `PTC`, window position, presentation position, animation, cached `K(TC)`/`V` — **none survives** |
| *(negative)* **non-current Session** | checkpoint discarded whole; **canonical entry flow**; **no synthesized `FOLLOW_LIVE`**; no `RH` |
| *(negative)* unrecognised checkpoint version | discarded whole; **no partial restore** |

---

# 28. Performance / virtualization plan

| Concern | Approach | Semantic guard |
|---|---|---|
| **Timeline at CU density** | cell-recycling virtualization over disclosed CU targets | constant step holds because `SP` is gapless; the index **is** the position |
| Focus under recycling | focus retention keyed to target identity, not cell index | holding forward while the window advances must not lose focus or stall |
| Reach at 10⁵ | §20A / §20B | bounded interaction cost; **no coarse temporal unit** |
| **Batched CU commits** | one event may advance `LH` by several `SP` | a delivery fact only — traversal remains one Moment (§18) |
| **`SP` allocation under concurrency** | contiguous block under the session row lock | **gaplessness is asserted by fixture**, not assumed |
| Map at high object counts | GPU canvas draw with culling by the derived footprint | culling changes what is **drawn**, never world coordinates, and never the field navigator's membership |
| Accessibility overlay cost | overlay nodes only for objects in `V` within the footprint | overlay membership never exceeds `V` |
| Layer B slicing | depth-scoped fetch | a slice boundary yields `NOT_FETCHED`, never `NOT_KNOWN_AT_TC` |
| No-hindsight filtering location | **server, Layer A, before transport** | performance is never a reason to filter later |

**Rule:** no optimisation may change constant-step meaning, Home loci, target identity, `RH`, focus, the three-state contract, `LF` history, or accessibility truth.

---

# 29. Test architecture

| Layer | Scope | Convention |
|---|---|---|
| **Unit** | reducers/selectors: transitions, **per-field class-A authority**, `RH` rules, horizon, divergence, `V`-to-view mapping | Jest |
| **Component** | Timeline list + window + position scale, target navigator, forward action, Live target, Map overlay + field navigator, **`LF` expression**, lifecycle, IF chrome | Jest + RN testing |
| **Integration** | store ↔ Layer A ↔ Layer B ↔ Timeline ↔ Map ↔ camera ↔ `RH` ↔ **recovery** | Jest |
| **Accessibility** | metadata assertions, focus stability, announcements, reduced motion, modality parity | component-level + device checks |
| **Responsive** | breakpoint/rotation, Preview preservation, camera envelope | component + integration |
| **Adversarial** | no-hindsight, future side channels, depth-vs-absence confusion, **CU/turn/exchange conflation**, **relation-derived Thread membership**, **Map act writing `LF`**, stale Preview, window-vs-cursor | **contract suites in `tests/`**, `node --test` |
| **Server** | **CU commitment and `SP` gaplessness**, **Thread establishment paths**, **`LF` resolution**, Layer A entitlement, Layer B disclosure, reconstructability limits | Jest + `verify-migration-*.mjs` per migration |

---

# 30. Frozen-test → implementation-test traceability

| Frozen test | Layer | Fixture | Oracle | Owner task |
|---|---|---|---|---|
| DT-01…DT-15 (6.2) | unit + component | disclosed sets, co-temporal edge | targets/commit results | T-05, T-06 |
| HT-01…HT-20 (6.3) | component + integration | fixed loci, five categories, IF cases | render + a11y tree | T-04, T-08 |
| X63-01…X63-10 (6.3) | adversarial | 1-vs-100, colourless, motionless | equality of outputs | T-08, T-12 |
| MA-01…MA-09 (6.4) | integration + adversarial | motion 0/short/long, interrupts | identical `RH`/state | T-10 |
| AX4-01…AX4-08 (6.4) | accessibility | pinned with large post-`TC` | emitted metadata | T-09 |
| RP-01…RP-04 (6.4) | responsive | breakpoints, rotation | state + Preview survival | T-11 |
| X64-01…X64-10 (6.4) | adversarial | durations, frames, rotation, parity | `RH` equality | T-10, T-11, T-12 |
| REV64-AT-01 | integration | 10,000 disclosed, `TC=m9000`, target `m500` | `TM`/`TC`/`PTC`/`RH` unchanged | T-05 |
| P65-01 reconstructability | server contract | each family in §8B | classification matches the committed mutators, path by path | T-03C |
| **P65-02R** CU → Moment commitment *(supersedes P65-02)* | server contract | **§30.1 below** | only committed CUs become Moments | **T-03A1, T-03A2** |
| P65-03 `K` vs depth | integration + a11y | same `TC`, two depths | truth identical; `V` differs; withheld ≠ absent | T-03C, T-04 |
| P65-04 practical reach | integration + device | 10,000 and 100,000 | bounded interaction cost in four modalities | T-05, T-09 |
| P65-05 OPEN-17 seam | unit + component | two `RenderStyle` values | identical `K(TC)`, `V`, state, a11y tree | T-04 |
| P65-06 recovery | integration | cold restart × 4 + 3 negatives | deterministic per §27A | **T-13** |
| P65-07 Map modality parity | accessibility | every frozen Map intent | no hover-only, drag-only or off-depth exposure | **T-09 — now fully executable** |
| **P65-08** Thread establishment | server contract + integration | **§30.2** | TE paths honoured; no score, no relation | **T-03B1, T-03B2, T-03B3** |
| **P65-09** LF constitution | server contract + integration | **§30.3** | LF-01…04; Map acts inert | **T-03D, T-07, T-09** |
| **P65-10** Context activation ≠ LF | server contract | **§30.4** | both contracts hold; neither implements the other | **T-03D** |

## 30.1 P65-02R — CU → Moment commitment

**Fixtures:** one turn → one CU · one turn → **multiple** CUs · provisional/live source · **revised source before commitment** · cancelled source · failed source · a USER CU · an ASSISTANT CU · a full USER + ASSISTANT exchange.

**Expected:** only committed CUs become Moments · **one CU = one Moment** · **no CU crosses a turn boundary** · **an exchange is never one Moment merely because it finalizes atomically** · a USER CU and an ASSISTANT CU are `m` and `m+1`, never merged · **`SP` is gapless over committed CUs** · provisional and revised-before-commitment source receives no `SP` and has no Timeline presence · cancelled and failed source likewise · a batched multi-CU commit allocates one contiguous block in source order preserving `ordinal_within_turn`.

## 30.2 P65-08 — Thread establishment

1. incidental mention → **no** Emerging Focus and **no** establishment unless independent attention exists;
2. one committed CU with genuine independent attention → **Emerging Focus** (pre-geographic, no Map presence);
3. explicit user conversational selection → **may establish immediately** (TE-01);
4. sustained substantive engagement → establish (TE-02);
5. recurrent independent attention → establish (TE-03);
6. **an analytical Reading alone cannot establish**;
7. **similarity or peer relation alone cannot establish**, and cannot create Thread membership;
8. **refinement → same Thread** identity and Home;
9. **genuine reframing → a new Thread**;
10. establishment at `SP n` → **absent from `K(t < n)`**, present at a **fixed Home for all `t ≥ n`**.

*Negative fixtures:* no numeric score, similarity threshold, keyword count or timer may appear as the establishment predicate; **no Thread-merge path exists to invoke.**

## 30.3 P65-09 — LF constitution

1. no stable focus → `LF = NONE`;
2. Emerging focus current → `LF = EmergingFocus(id)`;
3. the same CU establishes the Thread → **`LF` resolves to the Thread at that `SP`**, with earlier `SP`s retaining the Emerging Focus and **no historical rewrite**;
4. brief interruption → **`LF` unchanged**;
5. stable conversational shift → `LF` changes;
6. **Map inspection, Pan, Zoom or contextual navigation elsewhere → `LF` unchanged**;
7. explicit **conversational** selection → `LF` may change;
8. return to a Dormant Thread → **same Thread + lifecycle Reopened**, on one committed evidence basis;
9. **two distinct Emerging Focuses retain distinct ids** — never one anonymous value;
10. `P5` activation and post-live boundaries **read the append-only `LF` history**, never re-derive from present analysis.

## 30.4 P65-10 — Context activation ≠ LF

Explicit context activation changes **user-owned context state** · it does **not** set `LF` · `LF` changes from committed conversation **without** any context activation · **neither contract violates the other**, and neither is implemented as the other.

**Rejection fixtures** (must fail a non-compliant build): full-session range metadata · future focus stops · window or position navigation writing `TC`/`PTC`/`RH` · a position scale expressed in Moments · depth-withheld material rendered as historical absence · `NOT_FETCHED` rendered as absence · a turn row or a finalized exchange treated as a Moment · a CU spanning two turns · a Thread created from graph connectivity or a similarity score · a Home mutated after establishment · **any client action writing `LF`** · an Emerging Focus with no identity · historical `LF` re-derived from present analysis · ghost or cross-fade frames · a no-op animation · recomposition cancelling Preview · a presentation action writing class A.

---

# 31. Implementation Task / BR sequence — 19 tasks

The count changes again because REV65-08 and the two resolutions introduce genuinely separate architectural responsibilities. **No task decides Product semantics; each executes a frozen contract.** The committed `apps/mobile` instruction is honoured — T-01…T-03D build contracts, substrate and entitlement before any screen exists.

| ID | Name | One architectural reason |
|---|---|---|
| **T-01** | Client foundation — `apps/mobile` workspace | establish the stack in the monorepo with CI, **no product screens** |
| **T-02** | Canonical client state + action catalog | `S`, per-field class-A authority, `RH`, four-class separation |
| **T-03A1** | **Committed CU substrate** *(server)* | a Moment must exist as a durable, immutable, span-provenanced unit before anything can order it |
| **T-03A2** | **`SP` / `LH` / commit event + client delivery** *(server)* | ordering and observability are a different contract from constitution |
| **T-03B1** | **Emerging Focus + focus-continuity resolver** *(server)* | pre-geographic focus continuity must exist before promotion can be evaluated |
| **T-03B2** | **Thread establishment, immutable Home, lifecycle** *(server)* | geography begins here, once, and never moves |
| **T-03B3** | **Thread ↔ Reading contextual bindings** *(server)* | binding is not ownership, and relation must never create membership |
| **T-03C** | **Layer A `K(TC)` + Layer B `V`** *(server)* | temporal entitlement and depth disclosure are different contracts |
| **T-03D** | **`LF` resolver + transition history + delivery** *(server)* | live conversational attention is analysis-derived and must be recorded, never re-derived |
| **T-04** | Map world model, camera, render pipeline + OPEN-17 seam | author-owned geography and the proved seam |
| **T-05** | Timeline model, virtualization, window + §20A position scale | disclosed-region targets and presentation-only repositioning |
| **T-06** | Temporal navigation — Preview, commit, one-CU traversal, Live target | the frozen temporal grammar |
| **T-07** | `RH` and **all six** return acts | transaction truth before anything consumes it |
| **T-08** | Lifecycle, projection-state, IF divergence chrome | Stage 6.3 expression on a stable `V` |
| **T-09** | Accessibility topology + **Map navigation parity** | ships **with** the components that own the interaction |
| **T-10** | Motion / presentation controller | consumes transaction truth; never defines it |
| **T-11** | Responsive contracts | ships with its owning components |
| **T-12** | Integrated adversarial system pass | the frozen suites end-to-end |
| **T-13** | **R-02 committed-navigation recovery** | recovery is a frozen policy with its own fixture |

**Nothing is blocked.** Every task has an executable contract in this document.

---

# 32. Task-by-task contracts

**T-01 — Client foundation.** *MUST:* build for iOS and Android; join the workspace; run in CI; **express navigation as the §11 action catalog, not a route stack**. *MUST NOT:* add product screens; adopt any file from the untracked spike; use §5.6 Level 4 without a task-specific Architecture review. *Gate:* CI green on both platforms.

**T-02 — Canonical state + actions.** *MUST:* implement the per-field class-A authority table as executable checks, **including that no client action writes `LF`**; keep `PTC` and both presentation positions outside the store. *MUST NOT:* create a generic `navigate()`; let any presentation/transient action write class A; persist class C or D. *Gate:* the invariant is executable, not prose.

**T-03A1 — Committed CU substrate.** *MUST:* implement MOM-05 — `conversation_units` with owner-composite identity, `source_turn_id`, `speaker`, `ordinal_within_turn`, exact source-span provenance, commitment provenance and policy version; append-only with `DELETE` rejected and **no authorized `UPDATE`**; **add the `conversation_turns.content` immutability guard** (§7A #19). *MUST NOT:* let a CU span two turns; merge USER and ASSISTANT contributions; make turn finalization the definition of commitment. *Inputs:* **INPUT-01**. *Tests:* P65-02R constitution half; migration + verifier. *Gate:* every P65-02R fixture classifies correctly.

**T-03A2 — `SP` / `LH` / delivery.** *MUST:* allocate a contiguous `SP` block atomically under the session lock, in source order, preserving `ordinal_within_turn`; derive `LH` as the greatest committed `SP`; widen the outbox `event_type` and emit `ConversationalUnitsCommitted` transactionally, carrying **latest `SP`, identity and non-content lifecycle metadata only**; add the client-facing subscription surface. *MUST NOT:* use a timestamp as `SP`; assign `SP` to provisional source; embed analytical or future content in the event; retract an established Moment. *Tests:* P65-02R gaplessness half **under concurrent commits**. *Gate:* gaplessness holds under concurrency.

**T-03B1 — Emerging Focus + continuity.** *MUST:* create an Emerging Focus only from **≥ 1 committed CU carrying genuine independent conversational-attention evidence**; assign a **stable session-scoped `emerging_focus_id`**; record attention evidence append-only with reason codes and `SP`; support explicit termination leaving no geography. *MUST NOT:* create one from a Reading, Unknown, Question or analytical interest; use lexical similarity as continuity; give two Emerging Focuses one anonymous value. *Inputs:* **INPUT-02**. *Tests:* P65-08.1, .2, .6, .7; P65-09.9.

**T-03B2 — Thread establishment, Home, lifecycle.** *MUST:* evaluate TE-01/02/03 with **deterministic evidence predicates and recorded reason codes**; emit `ThreadEstablished` recording identity, establishing `SP`, Session, TE path, grounding focus and **Home assigned once from then-legitimate world context**; guard Home immutability with a `BEFORE UPDATE` trigger; implement Active/Dormant/Reopened as an **append-only `at_sp` history in the 0036 idiom**, with Dormancy **conversational, never timer-based**; write `promoted_to_thread_id` on the Emerging record without converting it. *MUST NOT:* substitute a score, similarity threshold, keyword count or timer for the TE paths; **implement any Thread-merge path**; change Home after establishment; let refinement create a new Thread or reframing preserve one. *Inputs:* **INPUT-03**. *Tests:* P65-08.3, .4, .5, .8, .9, .10 + negatives. *Gate:* no numeric threshold appears as an establishment predicate.

**T-03B3 — Thread ↔ Reading bindings.** *MUST:* bind only where subject grounding legitimately resolves to that Thread; append-only with `bound_at_sp` / `unbound_at_sp`; allow multiple legitimate contextual appearances where upstream truth supports it. *MUST NOT:* duplicate Reading identity; treat binding as ownership; **let relation or similarity create membership**. *Tests:* P65-08.7.

**T-03C — Layer A + Layer B.** *MUST:* implement the two layers as separate contracts; return the three states distinctly; project Threads by `established_at_sp ≤ SP(TC)` and bindings by their validity ordinals; return `NOT_RECONSTRUCTABLE` per §8B rather than the current value; add append-only history for peer relations, assumptions and gap epochs; **defang `attach_hypothesis_evidence`** per the 0036 precedent; expose the knowledge-horizon floor. *MUST NOT:* send unentitled material for the client to hide; let a slice boundary produce `NOT_KNOWN_AT_TC`; interpolate across an unaudited version bump; surface a Thread before its establishment `SP` or with any later Home. *Tests:* P65-01, P65-03, P65-08.10.

**T-03D — `LF` resolver + history + delivery.** *MUST:* resolve `LF` **inside the CU commitment transaction** in the §17 order; write `live_focus_transitions` append-only, `SP`-anchored, three-valued; implement LF-01…04 including `NONE` and "brief interruptions do not necessarily change `LF`"; **persist resolver output as durable canonical fact** (0024/0029/0031 precedent); serve `LF_at_activation` and `LF_at_post-live-boundary` as ordinal look-ups; deliver without content. *MUST NOT:* let any Map act, inspection or context activation set `LF`; re-derive historical `LF` from present analysis; use a wall-clock timer alone; admit a Reading, Material, Question, Gap, Evidence edge or Confidence object as an `LF` target; write a transition for LF-02. *Tests:* **P65-09, P65-10**. *Gate:* P65-09.6 and P65-10 both pass.

**T-04 — Map world model, camera, renderer, OPEN-17.** *MUST:* author-owned world coordinates; `project()` excludes `RenderStyle`; overlay **and field navigator built from `V`**; presence floor in the draw path; **Emerging Focus drawn nowhere at any depth**. *MUST NOT:* let a layout engine compute geography; let style reach a coordinate; draw a Thread before its establishment `SP`. *Tests:* HT-, X63-, **P65-05**. *Gate:* two `RenderStyle` values yield identical `K(TC)`, `V`, state and accessible trees — otherwise the channel becomes `FIXED`.

**T-05 — Timeline, virtualization, window, position scale.** *MUST:* list membership = disclosed **committed CU** targets from `V`; window and presentation position both class D; implement §20A exactly. *MUST NOT:* write `TM`/`TC`/`PTC`/`RH` from either; express the scale in Moments; include undisclosed targets. *Tests:* REV64-AT-01, **P65-04 at 10,000 and 100,000**, focus stability, the three separation rejection fixtures.

**T-06 — Temporal navigation.** *MUST:* **one-committed-CU** traversal; earned forward disclosure; co-temporal `Moment(LH)`/`LIVE_EDGE`; P3a two acts; a batched `LH` advance lands `FOLLOW_LIVE` on the greatest `SP` without changing the traversal unit. *MUST NOT:* introduce a coarser unit; auto-locate. *Tests:* DT-01…DT-15.

**T-07 — `RH` and all six returns.** *MUST:* implement all six, including `RETURN_LIVE_FOCUS` (**activation-time binding against committed `LF`**; a **no-op with no fabricated landing when `LF = NONE`**) and `GO_LIVE_AND_LOCATE` (**post-live one-shot binding read from `LF` history at the boundary `SP`**); effective-change rule; `PINNED(capturedTC)` restoration. *MUST NOT:* collapse acts; write `RH` on passive events; re-derive `LF` at return time. *Tests:* Back/Exact-Return suites, P65-09.10.

**T-08 — Lifecycle, projection-state, IF chrome.** *MUST:* object-intrinsic lifecycle; presence floor; **Reopened renders current state only** while the projection knows the past; content-independent projection statement; standing divergence. *MUST NOT:* dim Dormant; trigger on sparsity; render unavailable references. *Tests:* HT-/X63- suites.

**T-09 — Accessibility + modality parity.** *MUST:* §21 exactly, including text-only adjustable for relative forward and §20A's metadata rules; **§21A Map routes in full**, including camera-follows-focus and the four directional viewport actions; the `LF` status element expressed as a **relationship only**. *MUST NOT:* publish `min`/`now`/`max` or set size on the relative-forward control; express any position in Moments; make any act hover-, drag- or gesture-only; expose off-depth objects to improve reach; **imply importance, rank, centrality or strength in the `LF` expression**. *Tests:* AX4-, X64-08/09, P65-04, **P65-07 in full**, P65-09.6. *Sequencing:* ships **with** T-04…T-08 (SEQ-04), never after.

**T-10 — Motion controller.** *MUST:* subscribe to committed state; resolve historical projection immediately; retarget on interruption; **treat an `LF` change as a committed state change, not an animation trigger**. *MUST NOT:* own canonical state; gate settle; ghost or cross-fade. *Tests:* MA-, X64-01…03.

**T-11 — Responsive.** *MUST:* chrome recomposes; geography invariant; **Preview survives recomposition and an `LF` change**; footprint derived. *MUST NOT:* let layout cancel Preview or write `RH`. *Tests:* RP-, X64-06A/B.

**T-12 — Integrated adversarial pass.** *MUST:* run every frozen suite plus P65-01, P65-02R, P65-03…P65-10 end-to-end. *Gate:* Stage 6.6 input.

**T-13 — R-02 recovery.** *MUST:* implement §27A exactly — checkpoint class A only, versioned and app-private; re-read `LH` **and `LF`**; recompute `K(TC)` and `V`; restore no animation; **enter the canonical entry flow for a non-current Session rather than synthesizing `FOLLOW_LIVE`**. *MUST NOT:* persist class C or D or any cached projection; write `RH` for a restart; partially restore an unrecognised version. *Tests:* **P65-06**. *Stop:* if the frozen policy would require changing any Stage 5 return semantics.

---

# 33. Dependency graph

```text
T-01 ─▶ T-02 ─▶ T-03A1 ─▶ T-03A2 ─┬─▶ T-03B1 ─▶ T-03B2 ─▶ T-03B3 ─┐
                                   │                               │
                                   ├─▶ T-03C ─────────────────────┼─▶ T-04 ─┐
                                   │                               │        │
                                   ├─▶ T-03D ──────────────┐       └─▶ T-05 ─┴─▶ T-06 ─▶ T-07 ─▶ T-08 ─▶ T-10 ─▶ T-11 ─▶ T-12
                                   │                       │                                ▲
                                   └─▶ T-13                └────── RETURN_LIVE_FOCUS ────────┘
                                                                   GO_LIVE_AND_LOCATE

                       T-09 runs WITH T-04 … T-08 (SEQ-04) — never after
```

**Parallelisable after T-03A2:** the `T-03B*` chain, `T-03C`, `T-03D` and `T-13` are independent of one another. **T-04 requires T-03B2** (Home loci) and **T-03C** (`V`). **T-07 requires T-03D** for two of its six acts.

---

# 34. API / schema migration order

1. **`conversation_units`** + contiguous `SP` allocation inside the CU commitment operation + append-only guards — migration + verifier *(T-03A1/T-03A2)*
2. **`conversation_turns.content` immutability guard** — migration + verifier *(T-03A1)*
3. **Outbox `event_type` widening + `ConversationalUnitsCommitted`** — migration + verifier *(T-03A2)*
4. **`emerging_focuses`** + append-only attention evidence — migration + verifier *(T-03B1)*
5. **`analysis_threads`** + immutable `home_locus` guard + **`analysis_thread_lifecycle_transitions`** + `ThreadEstablished` — migration + verifier *(T-03B2)*
6. **`thread_reading_bindings`** — append-only, validity-aware — migration + verifier *(T-03B3)*
7. **`live_focus_transitions`** — append-only, `SP`-anchored — migration + verifier *(T-03D)*
8. **Peer-relation, assumption and gap-epoch history** — migration + verifier *(T-03C)*
9. **`attach_hypothesis_evidence` defang** — revoke `EXECUTE` from application roles; **do not drop** *(T-03C)*
10. **Layer A / Layer B read endpoints** — no schema change *(T-03C)*

**Nothing client-side is persisted server-side.** No migration exists for `TM`, `TC`, `IF_ref`, `MC`, `RH`, `PTC`, window position, presentation position, animation or layout. The R-02 checkpoint is **local** and is not a migration.

---

# 35. Implementation risks

1. **CU segmentation determinism.** If the segmenter is provider-assisted, its output must be **committed as durable fact** and never re-derived — otherwise Moment identity itself becomes non-replayable. *Mitigation:* the 0024/0029/0031 durable-result precedent; append-only `conversation_units`; **P65-02R replay**.
2. **`LF` resolver determinism** — the same concern, one level up, and a Stop Rule if violated. *Mitigation:* append-only `live_focus_transitions`; **P65-09.10**.
3. **`SP` gaplessness under concurrency** — a contiguous block under the session lock is correct but is the kind of invariant that decays. *Mitigation:* a concurrency fixture, not an assertion.
4. **CU density growth** — `N` rises by the CUs-per-turn factor, raising both virtualization and reach pressure. *Mitigation:* §20A is bounded in `log N`; §28 names the guards.
5. **Turn-content immutability is currently a property of the function set**, not an invariant. *Mitigation:* the T-03A1 guard.
6. **Establishment predicates drifting into a score** — the single most likely way TE-01/02/03 is quietly replaced. *Mitigation:* the T-03B2 gate and P65-08's negatives.
7. **`LF` written by a Map act** — the most likely way *Live Focus ≠ Inspected Focus* is lost. *Mitigation:* `LF` has **no client-side writer at all**; P65-09.6.
8. **Version-number/audit mismatch in `hypotheses`** — unaudited bumps produce versions no audit describes. *Mitigation:* explicit `NOT_RECONSTRUCTABLE`; **never interpolate**.
9. **Depth-vs-absence confusion.** *Mitigation:* the three-state contract plus rejection fixtures.
10. **Canvas accessibility is an overlay discipline.** *Mitigation:* one `V` feeds draw pass, overlay and navigator.
11. **Virtualized focus stability** under recycling while holding forward. *Mitigation:* named acceptance criterion.
12. **Window/cursor and position/cursor conflation** — silently recreates OPEN-08. *Mitigation:* class separation + the three §20A separation tests.
13. **Metadata drift** — adding `min`/`max` to the relative-forward control, encouraged by §20A permitting it on the position control. *Mitigation:* the asymmetry is stated and is a rejection fixture.
14. **Low-end Android** for a large world plus a long Track.
15. **Dependency risk**, governed by §5.6 rather than an open escape hatch.

---

# 36. Blockers

## Product blockers — **BOTH REMOVED**

| | Status |
|---|---|
| **BLOCKER-01 — Thread constitution** | # ✅ **RESOLVED** by RESOLUTION-01; implemented as a contract in §8A SDM-02; delta rows 7–13; tasks T-03B1/B2/B3 |
| **BLOCKER-02 — Live Focus constitution** | # ✅ **RESOLVED** by RESOLUTION-02; implemented as a contract in §8A SDM-04; delta rows 14–16; task T-03D |

**No replacement TODO asks coding to decide Product semantics.** Every previously blocked decision now has a frozen rule and an executable contract.

## Technical blockers — **NONE**

Targeted repository inspection (§7A) found no technical inability to implement the now-frozen rules. The repository is turn-oriented and lacks every required substrate, but that is `MISSING / BUILD` — ordinary work with a clear contract — not an inability. Two committed facts actively help: turn writes are already funnelled through definer commands with `content` untouched (§7A #19), and the outbox already forbids content in events by `CHECK`.

## Required frozen-authority inputs — preconditions, not decisions

These are **already frozen upstream**; they must be *handed to* the implementing tasks as executable specifications. Naming them is the opposite of asking coding to decide: it is the condition under which coding does not have to.

| | Input | Consumer |
|---|---|---|
| **INPUT-01** | The **Stage 1.2 Conversational Unit boundary grammar** — what constitutes one independently addressable contribution, and the commitment/finalization criteria that make its wording, boundary, attribution and provenance stable | T-03A1 |
| **INPUT-02** | The **Stage 1 conversational reference / attention grammar**, including the coreference and same-name disambiguation contract and what counts as *genuine independent conversational attention* | T-03B1, T-03D |
| **INPUT-03** | The **Thread Establishment grammar's evidence predicates** for TE-01, TE-02 and TE-03 — the deterministic conditions distinguishing incidental mention from explicit selection, sustained substantive engagement and recurrent independent attention | T-03B2 |

Stage 6.5 **does not restate, approximate or extend** any of the three. Each is a precondition of its task's start, and is listed in §38.

## Stop Rules — all eleven tested, none fires

| Ruling §29 stop rule | Status |
|---|---|
| Merging committed CUs across turn boundaries | **No** — a CU has exactly one `source_turn_id`; a cross-turn span is a rejection fixture |
| Treating a raw turn or finalized exchange as the canonical Moment | **No** — v2's mapping is withdrawn; P65-02R asserts both negatives |
| Using hypothesis graph connectivity to constitute Threads | **No** — excluded by constitution; **no merge path is implemented at all** |
| Using generic similarity/score thresholds as the establishment rule | **No** — TE-01/02/03 with recorded reason codes; a T-03B2 gate |
| Letting analytical interest alone establish Thread geography | **No** — Emerging Focus requires ≥ 1 committed CU with independent attention evidence |
| Using Map inspection / context activation as `LF` | **No** — `LF` has no client-side writer; P65-09.6 and P65-10 |
| Giving two Emerging LF targets no distinct identity | **No** — stable session-scoped `emerging_focus_id`; v2's nullable form rejected |
| Changing Home after establishment | **No** — assigned once, guard trigger, no merge path |
| Re-deriving historical `LF` from present analysis | **No** — append-only `SP`-anchored history; ordinal look-up |
| Changing Stage 5 temporal/return semantics | **No** — §27A's six-point check; §18's traversal check |
| Reopening deferred OPEN-06/08/09/19 | **No** — §37 |

---

# 37. Deferred / non-goals register

**OPEN-06** in-session bookmarks · **OPEN-08** coarse temporal step · **OPEN-09** object-originated version jump · **OPEN-19** dedicated no-op acknowledgement — all remain **deferred beyond v1**. No task creates a control, state field, storage, event type, animation slot, announcement contract, `RH` marker or strategy hook for any of them.

**§20A is re-checked against OPEN-08 and does not revive it:** presentation regions and refine/widen are fractions of *presentation extent*; they address no Moment, write no `TC`, and stop at the horizon rather than deciding what lies beyond it. **CU-level Moments do not revive it either** — a finer Moment is still one Moment, and no coarser semantic unit is introduced anywhere.

**Also non-goals:** Replay; final visual design; voice/live-session implementation; web client; HIM in the v1 Map projection; and any implementation execution whatsoever.

---

# 38. Stage 6.6 proof inputs

**§8A the Semantic Domain Mapping Record** (all six closed) · **§8B the reconstructability matrix** · §8 the 37-row delta register · §10 state ownership · §11 the action catalog and its per-field authority table, including that **`LF` has no client writer** · §13 the two layers, the three states and the ordinal projection rules · §18's CU-Moment re-check of the Timeline · §20A/§20B the position scale and its bounded-cost proof · §21A Map navigation parity · §26/P65-05 the OPEN-17 seam · **§27A the frozen R-02 policy and its seven-fixture proof** · §30 traceability including **P65-02R, P65-08, P65-09, P65-10** · §31–§33 the 19-task sequence, dependency graph and per-task gates · §35 risks · **§36's zero blockers and its three required frozen-authority inputs (INPUT-01…03), which Stage 6.6 must find supplied.**

---

# 39. MUST

1. Read canonical content only at `f322112e`; never from the dirty tree.
2. **Treat one committed Conversational Unit as one Moment** — never a turn row, never a finalized exchange.
3. **Keep every CU inside exactly one turn**, with `speaker` and `ordinal_within_turn` preserved.
4. **Enforce source-text immutability** for any turn a CU spans.
5. Allocate `SP` gaplessly and monotonically over committed CUs, as one contiguous atomic block in source order, inside the commitment transaction.
6. Advance `LH` only on CU commitment, and only from an authoritative server event carrying no content.
7. **Establish a Thread only by TE-01, TE-02 or TE-03, recording which path fired**, and only from committed conversational grounding.
8. **Assign Home exactly once at establishment and make it immutable**; surface no Thread before its establishment `SP`.
9. **Give every Emerging Focus a stable session-scoped identity**, and draw it nowhere.
10. **Resolve `LF` inside the CU commitment transaction** in the §17 order, and record every transition append-only and `SP`-anchored.
11. **Read historical `LF` from history**; never re-derive it from present analysis.
12. Keep the four state classes separate, and enforce class-A authority **per field**.
13. Compute `K(TC)` and `V` as two separate contracts, and return the three states distinctly.
14. Filter temporal/epistemic entitlement **server-side, in Layer A**.
15. Build the renderer, the accessibility overlay **and the field navigator** from **`V`**.
16. Return `NOT_RECONSTRUCTABLE` where §8B says history is absent; never today's value for a past `TC`.
17. `project()` and `Disclose()` must both exclude `RenderStyle`.
18. Timeline list membership = disclosed committed-CU targets only.
19. Window navigation and presentation-position movement must write **only** class D.
20. Express the presentation-position scale in normalized presentation fractions, never in Moments.
21. Relative forward must expose `accessibilityValue.text` only.
22. Provide a nonvisual route to every frozen Map intent, including Pan, without requiring a geometric drag.
23. Both P3a acts must exist in every modality, distinguishable before invocation.
24. Camera intent is canonical; the footprint is derived and recomputed without an `RH` write.
25. The motion controller must own no canonical state.
26. Responsive recomposition must preserve an active Preview — and so must an `LF` change.
27. **Implement R-02 exactly**: checkpoint class A only; re-read `LH` and `LF`; recompute `K(TC)` and `V`; restore no animation; enter the canonical entry flow for a non-current Session.
28. Persist analytical resolver outputs as durable canonical facts, following the committed durable-result precedent.
29. Every migration ships with an executable verifier; every new lifecycle table follows the protected-transition idiom.
30. Accessibility ships with the component that owns the interaction.
31. Settle the `SYSTEM`-role and `SUPERSEDED`-turn questions before any path produces either.

# 40. MUST NOT

1. MUST NOT treat the untracked spike, or any dirty-tree content, as canonical.
2. **MUST NOT treat a `conversation_turns` row, or a finalized USER+ASSISTANT exchange, as a Moment.**
3. **MUST NOT merge a USER contribution and an ASSISTANT contribution into one CU**, or let a CU cross a turn boundary.
4. **MUST NOT make assistant-response completion the definition of CU commitment**, or use a timestamp as `SP`.
5. MUST NOT assign `SP` to provisional, revisable, cancelled or failed source, or retract an established Moment.
6. **MUST NOT constitute a Thread from hypothesis-graph connectivity, similarity, an embedding cluster, a keyword count, a score or a timer.**
7. **MUST NOT let a Reading, Unknown, Question or analytical interest alone create an Emerging Focus or establish a Thread.**
8. **MUST NOT merge two established Threads, or change a Home after establishment** — no merge path may exist to invoke.
9. MUST NOT let refinement create a new Thread, or reframing preserve one.
10. MUST NOT treat a contextual binding as ownership, or let relation/similarity create Thread membership.
11. **MUST NOT let any client action — inspection, Pan, Zoom, contextual navigation, or explicit context activation — write `LF`.**
12. MUST NOT admit a Reading, Material, Question, Gap, Evidence edge or Confidence object as a direct `LF` target.
13. MUST NOT give two Emerging Focuses one anonymous value, or draw an Emerging Focus on the Map.
14. MUST NOT change `LF` on a wall-clock timer alone, or write a transition for LF-02.
15. MUST NOT implement Explicit Context Activation as `LF`, or `LF` as Explicit Context Activation.
16. MUST NOT let a presentation or transient action write class A.
17. MUST NOT persist `PTC`, animation progress, input stream, responsive layout, window position, presentation position, cached `K(TC)` or cached `V` — **including in the R-02 checkpoint**.
18. **MUST NOT synthesize `FOLLOW_LIVE` for a Session with no active Live edge**, or partially restore a checkpoint.
19. MUST NOT write an `RH` entry for a process restart, or make a restart `Back`-reversible.
20. MUST NOT render depth withholding as historical absence, or `NOT_FETCHED` as either.
21. MUST NOT let a transport or slice boundary redefine `not fetched` as `not known`.
22. MUST NOT infer historical state from a `version` integer, or interpolate across an unaudited version bump.
23. MUST NOT publish `min`/`now`/`max`, set size, position-in-set, or any quantity dependent on undisclosed material — and MUST NOT extend §20A's normalized-range permission to the relative-forward control.
24. MUST NOT include undisclosed targets in the Timeline list, the accessible tree, or any scale.
25. MUST NOT expose off-depth or future objects to improve accessible reach.
26. MUST NOT imply importance, rank, centrality, strength, priority or confidence in the `LF` expression.
27. MUST NOT let a layout engine compute Map geography, or a resize refit/recentre it.
28. MUST NOT let animation progress decide commit, `RH`, or settle — an `LF` arrival is a state change, not an animation trigger.
29. MUST NOT introduce a temporal unit larger than one Moment, in any guise.
30. MUST NOT widen OPEN-17; a failing `PARAM` channel becomes `FIXED`.
31. MUST NOT use §5.6 Level 4 without a task-specific review, or commit generated native files as canonical source.
32. MUST NOT create a branch, commit, PR, migration or repository file in Stage 6.5.
33. MUST NOT scaffold anything for OPEN-06/08/09/19.

# 41. SHOULD / MAY

- **SHOULD** place shared client/server contract types in `packages/runtime`, which exists and declares that role.
- **SHOULD** model every new append-only history on `hypothesis_lifecycle_transitions` (0036), every immutability guard on the 0063 protected-transition triggers, every contextual-appearance record on `formal_question_turn_bindings`, and every durable resolver output on the 0024/0029/0031 durable-result migrations.
- **MAY** publish a normalized `{min: 0, now, max: 100}` on the §20A position control only.
- **MAY** serve Layer B in depth-scoped slices, provided the three states remain distinct.
- **MAY** use deterministic evidence predicates and reason codes for TE-01/02/03 — but never a score in their place.
- **MAY** use §5.6 Levels 1–3 freely, recording at Level 3 the frozen requirement that demands it.
- **MAY** parallelise the `T-03B*` chain, `T-03C`, `T-03D` and `T-13` after T-03A2.

---

# 42. Architecture Review Handoff

## What v3 returns

A **complete Semantic Domain Mapping** — all six items closed, with the two Product blockers replaced by executable contracts rather than by TODOs. A **corrected Moment constitution**: one committed Conversational Unit, with the turn-oriented repository honestly classified `MISSING / BUILD` and the Product rule not weakened to fit `finalize_conversation_turn`. A **Thread contract** in which geography begins once, at establishment, by conversational grounding alone, and in which **no merge path exists to invoke**. An **`LF` contract** that is analysis-derived, three-valued, append-only, `SP`-anchored, and unreachable from any client action. The **frozen R-02 recovery policy** integrated with its non-current-Session correction. A **37-row delta register with no `UNKNOWN` and no blocked row**, a **19-task sequence** in which nothing is blocked and no task decides semantics, and **four new proofs** (P65-02R, P65-08, P65-09, P65-10). Everything the first ruling approved is carried forward untouched.

## What Architecture should scrutinise first

1. **§8A SDM-01 and P65-02R** — the CU-Moment mapping, and specifically §18's re-check that constant step, one-Moment traversal and `Moment(LH)`/`LIVE_EDGE` all survive a batched multi-CU commit.
2. **§8A SDM-02's establishment contract** — that deterministic evidence predicates with recorded reason codes implement TE-01/02/03 without becoming a score, and that **implementing no merge path at all** is the right way to guarantee Home permanence.
3. **§8A SDM-04's §17 ordering** — that resolving `LF` inside the CU commitment transaction, with Thread promotion at step 4 and `LF` at step 5, gives exactly one effective `LF` per `SP` with no historical rewrite.
4. **§36's INPUT-01…03** — the three frozen Stage 1 artifacts that must be supplied to T-03A1, T-03B1/T-03D and T-03B2. Stage 6.5 deliberately does not restate them; Stage 6.6 should find them handed over.
5. **§8B's two `CURRENT-ONLY` rows** — peer relations and assumptions still have no history, so a `PINNED` Map cannot render them truthfully until T-03C builds it.
6. **§27A's non-current-Session behaviour** — that entering the canonical entry flow, rather than synthesizing `FOLLOW_LIVE`, is routing rather than a new temporal semantic.

## Stop rule

**Stage 6.5 is not declared frozen, complete or approved by this package, and implementation is not authorized.** Nothing was coded; no repository file, branch, commit, PR or migration was created; the working tree and `HEAD` are unchanged; no deferred OPEN was resolved; no frozen semantics were reopened; and no Product rule delivered by the ruling was reinterpreted. Stage 6.6 remains the final integrated readiness gate.

---

# 43. v2 → v3 change log

| Ruling item | Change |
|---|---|
| **REV65-08 / MOM-01…06** | **§8A SDM-01 rewritten** — Moment = one committed CU; v2's finalized-exchange mapping withdrawn. New: `conversation_units` contract, contiguous `SP` block, `ConversationalUnitsCommitted`, `ConversationTurnCompleted` demoted. **§18 re-checked** for constant step, traversal unit, batched commits and density. §12, §14, §15, §19, §28, §34 updated. **P65-02R supersedes P65-02.** |
| **RESOLUTION-01** | **§8A SDM-02 rewritten** — constitution, Emerging Focus with stable identity, TE-01/02/03, `ThreadEstablished`, Home once, refinement vs reframing, Reading↔Thread binding, lifecycle. **BLOCKER-01 removed.** §16 (Emerging drawn nowhere), §21A unblocked, **P65-08 added.** |
| **RESOLUTION-02** | **§8A SDM-04 rewritten** — `NONE \| EmergingFocus(id) \| EstablishedThread(id)`, analysis-derived, LF-01…04, §17 same-`SP` order, append-only `SP`-anchored history, context-activation distinction. **BLOCKER-02 removed.** §10, §11 (**no client writer**), §21, §23, §25 (new row), §32 T-07 unblocked. **P65-09, P65-10 added.** |
| **Ruling §18** | v2's nullable `focus_ref` **rejected and replaced** by a stable session-scoped `emerging_focus_id`. |
| **Ruling §21/§22** | **§27A rewritten from recommendation to frozen policy**; "return to Live" narrowed to the canonical entry flow; `LF` added to the restart re-read list; P65-06 extended to seven fixtures. |
| **Ruling §24** | §8 delta register — **15 new rows**, 37 total, no `UNKNOWN`, no blocked row. |
| **Ruling §25** | §31–§33 — 14 → **19 tasks**: T-03A → T-03A1/T-03A2; T-03B unblocked → T-03B1/T-03B2/T-03B3; **T-03D added**; T-04/T-08/T-09/T-07 unblocked. |
| **Ruling §28/§29** | **§36 — both Product blockers removed; no technical blocker; all eleven stop rules tested and clear; INPUT-01…03 named as task preconditions.** |
| **New evidence** | §7A #17–#19 — no CU substrate, no focus/reference concept, and turn `content` never written by any statement (0025 revoked all direct write authority). |
| — *(preserved)* | §5 CS-01 and the escape-hatch policy · §6 S1–S8 · §13 two-layer projection · §17 · §20/§20A/§20B · §21A · §22 · §24 · §26 seam direction · §37 — carried forward unchanged. |

---

**END — QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v3**
