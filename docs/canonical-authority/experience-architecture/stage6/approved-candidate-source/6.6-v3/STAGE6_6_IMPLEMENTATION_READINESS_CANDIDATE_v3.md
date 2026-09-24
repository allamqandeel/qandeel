# QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v3
## Stage 6.6 — Integrated Implementation-Readiness Proof + Stage 6 Freeze

**Status:** CANDIDATE — for Product / Experience / Engineering Architecture review
**Supersedes:** `…CANDIDATE_v2`
**Applies:** `QANDEEL_STAGE6_6_FINAL_ARCHITECTURE_RULING_v2` — REV66-06, REV66-07, REV66-08, P66-E … P66-I
**Carries:** ruling v1 — REV66-01 … REV66-05, P66-A … P66-D
**Canonical repository baseline:** `f322112ec5b862a83716bf9d65b4553b06931774`
**Date:** 2026-09-03

> **NON-CODING.** No source changed · no migration · no branch, commit or PR · repository verified untouched (38 entries, `HEAD` `95a48c7`, branch unchanged).
>
> **Claude has no freeze authority. Stage 6 is NOT declared frozen and implementation is NOT authorized by this document.**

---

# Gate verdict summary

| Gate / proof | v2 | v3 |
|---|---|---|
| FG66-01 · FG66-02 · FG66-03 | PASS | **PASS** — carried forward, not re-run |
| **FG66-04** historical matrix | PASS | **RE-RUN (temporal-authority columns) → PASS** — **31 `FULL AFTER BUILD` · 0 `FULL BY REUSE` · 4 `NOT EXPOSED` · 0 `BLOCKER`** |
| **FG66-05** supported-session coverage | PASS | **RE-RUN (wording) → PASS** — *Legacy Uncovered Session* |
| **FG66-06** CU / Moment integrity | PASS | **RE-RUN (same-`SP` proof) → PASS** — clock, sealing, sequence |
| FG66-07 · FG66-08 · FG66-09 · FG66-10 · FG66-11 · FG66-13 · FG66-15 | PASS | **PASS** — carried forward, not re-run |
| **FG66-12** backend / migration closure | PASS | **RE-RUN → PASS** — clock ownership, legacy writer integration, background-writer association |
| **FG66-14** traceability | PASS | **RE-RUN → PASS** — P66-E…I added; P66-B superseded |
| Z66-01, 02, 03, 05 … 12 | PASS | **PASS** — carried forward |
| **Z66-04** Reading availability | PASS | **RE-RUN → PASS** — now SP-native |
| **P66-A** async analytical availability | PASS | **RE-RUN under SP-native authority → PASS** |
| **P66-B** expiry → Session Position | PASS | **SUPERSEDED** by P66-G / P66-H |
| **P66-C** Session spanning deployment | PASS | **PASS** — wording aligned to *Legacy Uncovered Session* |
| **P66-D** parent-known / appearance-unknown | PASS | **PASS** — re-verified under SP-native anchors |
| **P66-E** transaction-start timestamp adversary | — | **NEW → PASS** |
| **P66-F** SP sealing | — | **NEW → PASS** |
| **P66-G** expiry within the same SP | — | **NEW → PASS** |
| **P66-H** exact expiry tie | — | **NEW → PASS** |
| **P66-I** before-first-SP distinction | — | **NEW → PASS** |
| Contradiction audit · Ambiguity audit | NONE · 4 EA-only | **NONE · 5 EA-only** — re-evaluated (§17, §18) |
| Stop Rules (ruling v2 §23) | — | **Ten tested; none triggered** |

**Recommendation (§20–§21):** `STAGE 6 FREEZE APPROVED` — recommended to Architecture, subject to **R-C1 … R-C5**, with R-C4 and R-C5 rewritten in SP-native form.

---

# 1. Correction-consumption matrix

| Ruling item | Requirement | Applied |
|---|---|---|
| **REV66-06** | `CURRENT_TIMESTAMP` is transaction-start time and cannot order canonical visibility; freeze an SP-native **Session Semantic Clock** | **§4** · §7 matrix rebuilt · P66-E |
| Ruling §3 | One shared per-session serialization authority for CU/SP commitment **and** every canonical analytical write affecting historical `K(TC)` | §4.2 |
| Ruling §4 | Whichever transaction obtains the authority first determines legitimate order; no transaction-start timestamp overrides it | §4.3 · **P66-E** |
| Ruling §5 | Current-session availability recorded **directly** as an SP-native fact/event | §4.4 |
| Ruling §6 | Legacy families: field value REUSE, temporal availability BUILD → overall `FULL AFTER BUILD`; do not preserve the FBR count | **§7** — FBR count falls **13 → 0** |
| Ruling §7 | Wall-clock remains valid for audit/diagnostics/expiry policy/backfill, never as current-session `KF`/`VF`/`VT` | §4.6 · §19 MUST-NOT |
| **REV66-07** | Replace `PRE_SESSION` with **`PRE_FIRST_SP`** | **§5** · **P66-I** |
| Ruling §9 | `SessionHistoricalBaseline` established atomically before `SP(1)` | §5.2 |
| Ruling §10 | **SP sealing** on `LH: SP(n) → SP(n+1)` | **§6** · **P66-F** |
| Ruling §11 | Same-`SP` ordering retained and strengthened | §6.3 |
| **REV66-08** | Memory expiry obeys the same same-`SP` finalization rule | **§8** · **P66-G** |
| Ruling §14 | Exact expiry tie is **expired**, not active — half-open validity | §8.3 · **P66-H** |
| Ruling §16 | *Legacy Uncovered Session* as an implementation compatibility boundary | §9 |
| Ruling §17 | Rebuild only the temporal-authority columns of FG66-04 | §7 |
| Ruling §18 | T-03A2 owns the clock; T-03C integrates legacy writers; background writers must derive their session association | §11, §12 |
| Ruling §21 | R-C4 / R-C5 replaced in SP-native form | §21 |

## 1.1 What v2 said that v3 withdraws

| Superseded v2 wording | v3 position |
|---|---|
| `SessionAvailabilityAnchor(session, canonicalCommitTime)` converting an immutable `CURRENT_TIMESTAMP` into `SP(n)` | **Withdrawn as the authoritative path.** `CURRENT_TIMESTAMP` is transaction-start time; a transaction may hold an earlier timestamp, wait, and commit after another has advanced `SP`. Replaced by the **Session Semantic Clock** (§4). |
| "server-derived, immutable, non-caller-supplied ⇒ trustworthy availability coordinate" | **Half-withdrawn.** That evidence proves the timestamps are trustworthy **audit facts** — it does not make them the authoritative availability coordinate. Retained in that narrower role. |
| `PRE_SESSION` | **Withdrawn** — it conflated *before the first addressable SP* with *known before Session start*. Replaced by **`PRE_FIRST_SP`** (§5). |
| Expiry oracle: `m20` active, `m21` expired | **Withdrawn as internally inconsistent.** It contradicted v3 §6.3's own same-`SP` finalization rule. Corrected in §8: **`K(m20)` is EXPIRED.** |
| Exact tie ⇒ the anchor `SP` is active | **Withdrawn.** Validity is half-open (`time < expires_at`); an exact tie is **expired** (§8.3). |
| 13 `FULL BY REUSE` rows | **Withdrawn.** Temporal availability is BUILD for every exposed row; the *field value* stays REUSE for 13 of them (§7). |

---

# 2. Carried forward unchanged

Not re-argued, per the ruling's §1 and §20:

**FG66-01** the verified Authority Bundle · **FG66-02** 19/19 tasks with no Product-semantic TODO · **FG66-03** the corrected `T-03B1 → T-03B2 → {T-03D, T-03B3} → T-03C` graph · **FG66-07** state/action authority and all six failed attacks · **FG66-08** bounded Timeline reach (≤ 45 at 10k, ≤ 56 at 100k assistive) · **FG66-09** Map parity from `V` · **FG66-10** the six OPEN-17 isolation conditions · **FG66-11** the seven R-02 restart cases · **FG66-13** client-stack feasibility · **FG66-15** deferred-feature absence · **Z66-01, 02, 03, 05 … 12** · **PRE66-C01** commitment/batch identity · **PRE66-C02** the Emerging Focus invariant · all Thread / `LF` / Home / no-merge / no-coarse-step constraints · the **REV66-04** four-family appearance registry · the **REV66-05** non-removal evidence (zero `DELETE FROM` statements in 63 migrations; no role granted `DELETE`; 36 `ON DELETE RESTRICT`; all 6 `ON DELETE CASCADE` on `auth.users` inside HIM tables, which are `NOT EXPOSED`).

---

# 3. Why v2 could not freeze

v2 correctly rejected `KF = created_at`, then rebuilt availability on the premise that an immutable server-derived `CURRENT_TIMESTAMP` is a faithful proxy for **actual canonical commit time**. In PostgreSQL it is not:

```text
CURRENT_TIMESTAMP  =  transaction START time
                   ≠  statement execution time
                   ≠  row visibility time
                   ≠  transaction commit time
```

So an analytical transaction may obtain `t0`, wait, and make its row visible only **after** a CU transaction has already advanced the Session Position. A timestamp-based post-hoc mapping would then anchor that object to an **earlier** `SP` than the position at which it actually became canonical — the exact backdating REV66-01 exists to prevent. Replacing `CURRENT_TIMESTAMP` with `clock_timestamp()` would not fix it either, because visibility still depends on commit order under concurrency.

> **The fix is not a better timestamp. The fix is to serialize Product availability directly in `SP` space.**

---

# 4. REV66-06 — the Session Semantic Clock

## 4.1 The boundary

Per historical-enabled Session, a server-owned authority holding:

```text
current_sp
same_sp_event_sequence
```

**Physical realization is Engineering Architecture** — a locked session-clock row, a transaction advisory lock plus durable counters, or an equivalent database-owned mechanism. **The semantic contract is fixed.**

*Committed precedent:* row-level `FOR UPDATE` serialization is already the established idiom across the repository (0003 `finalize_conversation_turn`, 0005, 0008 and others), so a locked session-clock row introduces no new mechanism class.

## 4.2 Shared serialization rule

Every current-session canonical semantic write that can change historical `K(TC)` **must** enter the same per-session serialization boundary — CU/SP commitment, Emerging/Thread/`LF` events, and every analytical availability/validity event.

```text
BEGIN
  1. acquire Session Semantic Clock authority
  2. determine the authoritative current SP
  3. assign the component its SP-native availability / validity anchor
  4. assign the deterministic same-SP event sequence where required
  5. write the canonical fact / event
COMMIT
```

**Ordering discipline:** the clock is always acquired *first* in any transaction that will write a canonical semantic fact, so lock ordering is uniform and deadlock-free by construction.

## 4.3 The concurrency invariant

Given an analytical transaction **A** and a CU transaction **B**, *it is irrelevant which began first*. The authoritative order is the clock's.

| Order | Result |
|---|---|
| **A serializes first** | A anchors to `SP(n)`; B then advances to `SP(n+1)`. The analytical fact **is** available at `SP(n)`. |
| **B serializes first** | B advances to `SP(n+1)`; A then anchors to `SP(n+1)`. The analytical fact **is not** available at `SP(n)`. |

**No transaction-start timestamp may override this order.** Asserted by **P66-E** in both directions.

## 4.4 Availability is recorded, not inferred

For facts becoming canonical while a Session is historical-enabled, an explicit SP-native fact is written — an `available_at_sp` column, or an event log equivalent to:

```text
session_semantic_events(session_id, component identity, event kind, at_sp, event_sequence)
```

Exact schema shape is Engineering Architecture. The semantic requirement is not:

> # **`KF` / `VF` / `VT` for current-session creation and transition come from the SP-native semantic event — never from `created_at`.**

## 4.5 Background and post-response writers

Ruling §18 requires that a background writer obtain `session_id`, current `SP` and event sequence **without trusting caller-supplied Product authority**. The committed schema already supplies the server-owned relation:

```text
post_response_intelligence_executions(
  id, event_id UNIQUE, user_id, session_id NOT NULL, source_turn_id UNIQUE, state, …)
post_response_intelligence_effects(execution_id → executions(id), effect_key, state, …)
```

Every post-response analytical effect is a child of a **durable execution row that already carries `session_id` and `source_turn_id`**. The writer therefore derives its session from durable effect ownership and canonical source-turn lineage, then acquires the clock for that session. `0029_durable_intent_provider_result_v1` follows the same pattern.

> **If a writer cannot be associated with a current Session through a server-owned relation, it must not fabricate a current-session anchor.** It writes its canonical content without an in-session availability event, and the component is not exposed in that Session's historical `V`.

## 4.6 What wall-clock is still for

Audit · diagnostics · provider/runtime latency · **expiry policy input** (§8) · forensic ordering outside the Product Timeline · deterministic backfill where separately proven. It **must not** be the authoritative current-session `KF`/`VF`/`VT` source, and **must not** be used to repair an ordering race after canonical writes have committed.

---

# 5. REV66-07 — `PRE_FIRST_SP`

## 5.1 The sentinel

```text
PRE_FIRST_SP
```

> the fact is legitimately available at **every addressable `SP` of this Session**, because it was already canonical **before the first addressable committed CU**.

It **does not** assert that the fact existed before wall-clock Session creation. A fact may become canonical *after* Session creation but *before* `SP(1)`; there is **no user-addressable temporal point in between**, so the two are not equivalent and v2's `PRE_SESSION` wording conflated them.

It is **internal · non-addressable · not a Moment · not a temporal mode · not a member of `S` · never exposed in `V` or accessibility.** An implementation may use another internal token name only if its semantics match exactly. *"Pre-session knowledge"* is not a synonym unless independently true.

## 5.2 `SessionHistoricalBaseline`

Established **atomically before the first committed CU receives `SP(1)`**, defining which already-canonical world facts are `PRE_FIRST_SP` for this Session. Realizable as a baseline revision/token, an event-log high-water mark, a deterministic snapshot reference, or an equivalent server-owned mechanism.

> **It must not depend solely on comparing mutable/current rows to transaction-start timestamps** — that is the same defect at Session scope.

The baseline is **technical projection authority, not a new Product state.**

---

# 6. Ruling §10–§11 — SP sealing and same-`SP` ordering

## 6.1 Sealing

`SP(n)` is the **active** Session Position until the next CU commit. While open, canonical analytical and validity events may legitimately anchor to it through the clock. When the next committed CU advances `LH: SP(n) → SP(n+1)`:

> # **`SP(n)` IS SEALED.**

After sealing: no newly committed analytical event may anchor to `SP(n)` · **no causal-source reference may reopen it** · late background work anchors to the then-current `SP` · **historical `K(SP(n))` becomes stable.**

This is an **implementation invariant, not a user-visible state**. Asserted by **P66-F**.

## 6.2 Causal source never determines availability

A Reading whose source is `m10`, committing while `m12` is current, anchors to **`m12`**. If it commits after `m13` has sealed `m12`, it anchors to **`m13`**. The anchor answers *when it became canonical*, never *what caused it* — the rule now holds under concurrency because it is enforced by serialization rather than inferred from a timestamp.

## 6.3 Same-`SP` ordering — retained and strengthened

Within one open `SP`, `event_sequence` is **deterministic, server-owned and non-addressable**. It orders canonical analytical and validity events sharing that `SP`, and creates **no Moment, no Timeline target and no third Product temporal dimension**.

> **Historical projection for a sealed `SP(n)` uses the final valid semantic state after all events legitimately committed within that `SP` before sealing.**

This single rule now governs analytical objects **and** Memory expiry (§8) — which is what removes v2's inconsistency.

---

# 7. FG66-04 — historical matrix, temporal-authority columns rebuilt

## 7.1 The three columns the ruling requires

Each row now states its **semantic field source**, its **current-session availability source**, its **validity source**, its **same-`SP` ordering need**, and a final verdict. **No row relies on `CURRENT_TIMESTAMP → anchor` as the authoritative in-session availability path.** A legacy immutable `created_at` may remain evidence for pre-deployment/backfill and audit — never for current-session live anchoring.

Availability classes: **`SP-NATIVE (Stage-6 substrate)`** · **`BASELINE PRE_FIRST_SP`** · **`SP-NATIVE EVENT MUST BE BUILT`**.

## 7.2 The verdict shift, stated plainly

Every legacy family can become canonical **during** a historical-enabled Session, and none of them records an SP-native availability event today. Per ruling §6 each therefore resolves to:

```text
FIELD VALUE:            REUSE          (content, identity, immutable fields, lineage — unchanged)
TEMPORAL AVAILABILITY:  BUILD          (an SP-native availability event must be recorded)
OVERALL ROW VERDICT:    FULL AFTER BUILD
```

**The v2 `FULL BY REUSE` count of 13 therefore falls to 0.** This is not a regression in what can be reconstructed — the field values are still fully reusable — it is an honest restatement of where *temporal authority* comes from. The counts are not preserved for cosmetic consistency.

## 7.3 The matrix — 35 rows

Legend: **FAB** `FULL AFTER BUILD` · **NEX** `NOT EXPOSED IN v1 V` · **BLK** `BLOCKER` · *field value* column shows REUSE where content needs no rebuild.

| # | Family / component | Field value | Current-session availability source | Validity source | Same-`SP` order? | Verdict |
|---|---|---|---|---|---|---|
| C1 | Committed CU — identity, `source_turn_id`, `speaker`, `ordinal_within_turn` | BUILD | **SP-native (clock assigns `SP` at commit)** | immutable | n/a — CU commit *advances* the clock | **FAB** |
| C2 | Committed CU — surface text + source span | BUILD | SP-native | immutable | n/a | **FAB** |
| C3 | Committed CU — `SP`, `committed_at` (audit only) | BUILD | SP-native | immutable | n/a | **FAB** |
| E1 | Emerging Focus — identity | BUILD | SP-native via clock | immutable | yes | **FAB** |
| E2 | Emerging Focus — attention evidence | BUILD | SP-native per row | immutable | yes | **FAB** |
| E3 | Emerging Focus — current attention status | BUILD | derived from E2 ≤ `SP(TC)`; **no timer** | derived | yes | **FAB** |
| E4 | Emerging Focus — promotion lineage | BUILD | SP-native (establishing `SP`) | immutable | yes | **FAB** |
| T1 | Thread — identity, TE path, grounding focus | BUILD | **`established_at_sp`** via clock | immutable | yes | **FAB** |
| T2 | Thread — `home_locus` | BUILD | same transaction as T1 | immutable | yes | **FAB** |
| T3 | Thread — lifecycle state | BUILD | SP-native `at_sp` per transition | ordinal interval | yes | **FAB** |
| A-1 | Appearance — Thread ↔ Reading | BUILD | own `bound_at_sp` | `bound_at_sp ≤ SP(TC) < unbound_at_sp` | yes | **FAB** |
| L1 | Live Focus — value | BUILD | SP-native per transition | greatest `sp ≤ SP(boundary)` | yes | **FAB** |
| L2 | Live Focus — transition reason | BUILD | SP-native | same | yes | **FAB** |
| R1 | Reading — `statement` | **REUSE** — never written after insert; never deletable | **SP-NATIVE EVENT MUST BE BUILT** (creation event through the clock) | immutable | yes | **FAB** |
| R2 | Reading — `type`, `domain`, `scope`, `origin` | **REUSE** | same creation event | immutable | yes | **FAB** |
| R3 | Reading — `assumptions` | **REUSE** | same creation event | immutable | yes | **FAB** |
| R4 | Reading — `disconfirming_conditions` | **REUSE** | same creation event | immutable | yes | **FAB** |
| R5 | Reading — `status` / lifecycle | REUSE *(0036 audit rows)* | **SP-native transition event must be built** | replay to `SP(TC)` | yes | **FAB** |
| R6 / A-2 | Reading — Evidence participation *(Material ↔ Reading appearance)* | REUSE *(audited path)* | **SP-native attach event must be built**, after closing 0005/0021/0028 | append log | yes | **FAB** |
| R7 | Reading — peer / competing relations | BUILD | **SP-native append event must be built** | append log | yes | **FAB** |
| R8 | Reading — provenance / lineage | **REUSE** | anchor of the **carrying event**, not the Reading | immutable | yes | **FAB** |
| M1 | Material — `content`, `type`, `source`, `confidence`, `importance` | **REUSE** — supersession inserts a new row | **SP-native creation event must be built** | immutable | yes | **FAB** |
| M2 | Material — `status` (`→SUPERSEDED` \| `→DELETED`) | BUILD | SP-native transition event | replay | yes | **FAB** |
| M3 | Material — expiry validity | **REUSE** (`expires_at` immutable, a policy input) | **`ExpiryAtSP` — same-`SP` validity transition (§8)** | half-open: active iff `time < expires_at` | **yes — decisive** | **FAB** |
| M4 | Material — supersession lineage | **REUSE** | SP-native creation event of the successor | chain position | yes | **FAB** |
| U1 | Unknown / Gap — static fields | **REUSE** (guard-enforced immutable, 0063) | **SP-native creation event must be built** | immutable | yes | **FAB** |
| U2 | Unknown / Gap — `status`, `closed_at`, `closure_reason`, `open_epoch` | BUILD | SP-native epoch-transition event | epoch interval | yes | **FAB** |
| A-3 | Appearance — Unknown ↔ Reading | **REUSE** | same creation event as U1 (one transaction, one anchor) | immutable | yes | **FAB** |
| Q1 | Question candidate — all fields | **REUSE** (zero `UPDATE` statements exist) | **SP-native creation event must be built** | immutable | yes | **FAB** |
| A-4 | Appearance — Formal Question ↔ Turn | **REUSE** (guard-enforced, terminal) | **SP-native selection/bind/release events must be built** | terminal-state interval | yes | **FAB** |
| F1 | Confidence — evaluation, `target_version`, snapshots | **REUSE** (append-only) | **SP-native evaluation event must be built**, independent of the target Reading | `target_version` | yes | **FAB** |
| H1 | HIM — measurement / snapshot / trend | — | — | — | — | **NEX** |
| H2 | HIM — session context bindings | — | — | — | — | **NEX** |
| N1 | Numeric confidence value / band | — | — | forced `NULL` by CHECK | — | **NEX** |
| N2 | Question `expected_information_gain` / `question_utility` | — | — | forced `NULL` by CHECK | — | **NEX** |

**Totals: 31 `FULL AFTER BUILD` · 0 `FULL BY REUSE` · 4 `NOT EXPOSED IN v1 V` · 0 `BLOCKER`.**
**Field value: REUSE for 13 rows · BUILD for 18.** Temporal availability is BUILD for all 31 exposed rows.

No row resolves to "technical history missing → treat as `NOT_KNOWN`"; no semantically required field is suppressed. Every `NEX` row is excluded because the family is outside the v1 Map projection or the quantity is forced `NULL` by a committed CHECK.

---

# 8. REV66-08 — Memory expiry inside the same `SP`

## 8.1 The inconsistency v2 carried

v2 asserted `K(m20)` **active** and `K(m21)` **expired**, while simultaneously holding that same-`SP` canonical events project to the **then-final** state of that `SP`. Both cannot be true: the expiry occurred while `m20` was the current position, so it is a validity transition **inside** `m20`'s interval.

## 8.2 The corrected contract

```text
ExpiryAtSP(session, expires_at)  →  PRE_FIRST_SP | SP(n) | NOT_IN_SESSION
```

| Case | Result | Historical meaning |
|---|---|---|
| before the first addressable `SP` | `PRE_FIRST_SP` | expired at **every** addressable `SP` |
| during an open `SP(n)` | **`SP(n)`** | the expiry validity transition **belongs to `SP(n)`**; once sealed, `K(SP(n))` shows the then-final state |
| after Session end | `NOT_IN_SESSION` | no expiry transition belongs to that Session |

**Oracle for `m20 @10:00`, expiry `@10:03`, `m21 @10:08`:**

- while `m20` is current and before 10:03 — the Memory **may legitimately be active**;
- after expiry while `m20` is still current — the Memory becomes **expired**, **without advancing `LH`, moving `TC`, or writing `RH`**;
- once `m21` commits and seals `m20` — **`K(m20)` = EXPIRED**, not active.

No sub-Moment coordinate is introduced; this is the *same* rule already governing analytical objects that become canonical later inside an open `SP`.

## 8.3 Exact-tie rule

Current eligibility is `expires_at > now`, so at `now == expires_at` the Memory is **expired**. The Session-Position mapping preserves that half-open validity:

```text
active   iff  time <  expires_at
expired  iff  time >= expires_at
```

**v2's rule making the anchor `SP` active on an exact tie is withdrawn.** Asserted by **P66-H**.

## 8.4 Derived or materialized

Either derivation from immutable `expires_at` + authoritative committed-CU timing + the Session baseline/end boundary, **or** an append-only expiry validity event — but both must produce the §8.2/§8.3 oracle. **They are not equivalent if one delays expiry until the next Moment.** Identity and lineage are never erased; only active eligibility changes.

---

# 9. FG66-05 — Legacy Uncovered Session (wording aligned)

Path A stands for v1, restated as an **implementation compatibility boundary**:

> # **LEGACY UNCOVERED SESSION**

Such a Session **continues on the pre-Stage-6 committed runtime · does not receive Stage-6 Timeline/Map historical semantics · is not partially converted · remains historical-disabled through closure** unless complete deterministic backfill occurs.

Eligibility is evaluated **once, at Session start**, so an ineligible Session never enters CU commitment and therefore has no `SP`, no Moments, no Timeline extent and no `PINNED` mode — **a partial Timeline is unrepresentable, not merely prohibited.** Exposure is bounded and self-liquidating: only Sessions already open at deployment, only until they close or expire.

`historical_coverage_complete` (or a deterministic equivalent) remains **release/runtime safety metadata** — never a Product or epistemic state, never surfaced in `V`, the accessible tree or any announcement, and never given knowledge-horizon language.

---

# 10. FG66-06 — CU / Moment integrity (same-`SP` proof re-run)

The nine frozen invariants stand unchanged (1 CU = 1 Moment · 0..N per turn · no cross-turn CU · USER/ASSISTANT separate · gapless `SP` · atomic block allocation · focus/Thread/`LF` once per `SP` in source order · no historical rewrite · `LH` = greatest committed `SP`), with the per-`SP` five-step loop and Z66-01 / Z66-02 carried forward.

**Re-run portion — the loop now runs *inside* the clock:**

```text
BEGIN
  acquire Session Semantic Clock authority
  batch_id := stable commitment identity                       ← PRE66-C01
  for each CU in canonical source order:
      1. commit CU → assign next SP (contiguous block); previous SP is SEALED
      2. resolve references + conversational focus              ← INPUT-02
      3. resolve Emerging Focus continuity
      4. optionally establish Thread (TE-01/02/03)              ← INPUT-03
      5. resolve effective LF for THIS SP → append transition
  emit ConversationalUnitsCommitted(batch_id, latest SP, …)      ← non-content
COMMIT
```

Analytical events that acquire the clock **before** this transaction anchor to the pre-advance `SP`; those acquiring it **after** anchor to the new one. Either way `LF` for a given `SP` is decided exactly once, and no analytical event reopens a sealed `SP`.

---

# 11. FG66-12 — backend / API / migration closure (re-run)

Items 1–6 and 12–21 of the v2 closure matrix stand. **Revised and new:**

| # | Work | Task | Migration + verifier | Note |
|---|---|---|---|---|
| **7′** | `conversation_units.committed_at` — **demoted to audit metadata only**; no longer an availability source | T-03A1 | ✔ | retained for audit, diagnostics, backfill |
| **8′** | **Session Semantic Clock** — `current_sp`, `same_sp_event_sequence`, shared serialization authority, SP sealing | **T-03A2 owns it** | ✔ | locked session-clock row or equivalent; `FOR UPDATE` precedent exists |
| **9′** | **SP-native availability/validity events** for every legacy family (Reading creation and transitions, Evidence participation, peer relations, Memory creation/supersession/status, Gap creation/lifecycle, Question selection/binding, Confidence evaluation) | **T-03C** | ✔ | `session_semantic_events` or per-family `available_at_sp` |
| **10′** | **`ExpiryAtSP`** — derived or materialized, satisfying §8.2/§8.3 | T-03C | ✔ if materialized | must not delay expiry to the next Moment |
| **11′** | **`SessionHistoricalBaseline`** — atomic, before `SP(1)`; defines `PRE_FIRST_SP` membership | T-03C | ✔ | must not rest on transaction-start timestamps |
| **22** | **Background-writer session association** — derive `session_id` from durable effect ownership (`post_response_intelligence_executions.session_id`, `source_turn_id`) and canonical source-turn lineage; **never caller-supplied**; a writer that cannot be associated must not fabricate an anchor | T-03C | no schema | reuses committed structure (0022, 0029) |
| **23** | **Session historical-eligibility gate at Session start** *(carried, re-affirmed)* | T-03A1 / T-03C | ✔ | §9 |

**Task ownership changes:** **T-03A2** now owns or establishes the shared clock authority used by all downstream SP-native semantic writes; **T-03C** integrates the legacy analytical writers with that clock (or an equivalent append-only event boundary) and owns the baseline, the expiry mapping and the background-writer association. **T-03B1/B2/B3 and T-03D acquire the clock rather than assuming a current `SP`.**

---

# 12. FG66-14 — traceability (re-run rows only)

| Proof | Task(s) | Layer | Fixture | Oracle | Merge gate |
|---|---|---|---|---|---|
| **P66-E** transaction-start adversary | T-03A2, T-03C | server contract | `SP = m11`; A starts (`CURRENT_TIMESTAMP = t0`), waits; B commits `m12`; A resumes and makes R canonical — **and the inverse order** | **R anchors to `m12`, not `m11`**; inverse: R anchors to `m11`, B then advances | clock order, never timestamp |
| **P66-F** SP sealing | T-03A2, T-03C | server contract | `m12` current; late work sourced from `m10` commits → `m12`; `m13` commits, sealing `m12`; even later work sourced from `m12` commits | later work anchors **`m13`**, never reopens `m12` | causal source cannot determine availability |
| **P66-G** expiry within one `SP` | T-03C | server contract | `m20 @10:00`, expiry `@10:03`, `m21 @10:08` | active before expiry; expired after, with `LH`/`TC`/`RH` unchanged; **`K(m20)` = expired once sealed** | no sub-Moment coordinate |
| **P66-H** exact expiry tie | T-03C | server contract | `m20.committed_at == expires_at` | **expired at `m20`** (half-open validity) | not `<=` |
| **P66-I** before-first-`SP` | T-03C | server contract | Session created 10:00; fact canonical 10:02; `SP(1)` at 10:05 | fact is `PRE_FIRST_SP`, available at `SP(1)`; system **must not assert** it existed before Session start | terminology gate |
| **P66-A** *(re-run)* | T-03C | server contract | `m10` → post-response work → `m11`, `m12`; R canonical after `m12` | `K(m10) ∌ R`, `K(m11) ∌ R`, `K(m12) ∋ R` — **via clock order, not timestamp conversion** | every child has its own SP-native anchor |
| **P66-B** | — | — | — | **SUPERSEDED** by P66-G / P66-H | — |
| **P66-C** *(wording)* | T-03A1, T-03C | integration | Session S pre-deploy, 3 turns; deploy; 2 CUs attempted | **Legacy Uncovered Session** — historical-disabled through closure | no partial Timeline |
| **P66-D** *(re-verified)* | T-03B3, T-03C | server contract | Thread `m8`, Reading `m10`, binding `m14` | `K(m12)`: appearance absent; `K(m14)`: available — all three anchors SP-native | parent never substitutes child |
| **Z66-04** *(re-run)* | T-03C | server contract | §13.1 | historical statement from the immutable value; **availability from the SP-native creation event** | no current-row read for a past `TC`; no timestamp anchoring |
| **P65-01** *(revised)* | T-03C | server contract | the 35 rows of §7.3 | field value **and** temporal availability classified separately | 0 `BLOCKER` |

All other v2 traceability rows are carried forward unchanged.

---

# 13. Re-run and new proofs

## 13.1 Z66-04 — Reading historical availability — **PASS**

**Field value:** `hypotheses.statement` is never written after insert and cannot be physically removed or replaced (zero `DELETE FROM` statements; no `DELETE` grant; cascades confined to HIM). The historical statement **is** the immutable value.

**Availability, corrected:** the Reading is admitted to `K(TC)` by its **SP-native creation event**, written through the clock — not by converting `created_at`. `created_at` remains audit evidence and backfill input only. A Reading generated from `m10` but committing while `m12` is current is available from `m12`; if it commits after `m13` seals `m12`, from `m13`.

## 13.2 P66-A — asynchronous analytical availability, SP-native — **PASS**

```text
m10 committed  →  post-response Reading work begins
m11 committed
m12 committed
Reading R acquires the clock and commits while m12 is current
```

`K(m10) ∌ R` · `K(m11) ∌ R` · `K(m12) ∋ R`. **The causal CU `m10` does not backdate R**, and the conclusion no longer depends on any timestamp. Each of relation creation, Evidence participation and Confidence evaluation uses **its own** SP-native event: `KF(Reading) = m12`, `KF(EvidenceParticipation) = m15`.

## 13.3 P66-E — transaction-start timestamp adversary — **PASS**

```text
SP = m11
analytical transaction A begins   →  CURRENT_TIMESTAMP = t0
A waits
CU transaction B commits m12
A resumes and makes Reading R canonical
```

**A acquires the clock only on resumption, after B advanced it.** Therefore:

> **R anchors to `m12`, not `m11`** — even though A's transaction-start timestamp `t0` precedes `m12`'s commit.

**Inverse order:** if A acquires the clock and commits before B, R anchors to **`m11`**, and B then advances to `m12`. In both directions the Session Semantic Clock owns the ordering and the timestamp is irrelevant. This is precisely the case v2 could not decide correctly.

## 13.4 P66-F — SP sealing — **PASS**

```text
m12 current  →  late analytical work sourced from m10 commits   →  anchors m12
m13 commits                                                     →  m12 SEALED
even later analytical work sourced from m12 commits             →  anchors m13
```

The later work **never reopens `m12`**; no causal-source reference can backdate into a sealed position; `K(m12)` is stable from the moment of sealing.

## 13.5 P66-G — expiry within the same `SP` — **PASS**

```text
m20 @10:00     expiry @10:03     m21 @10:08
```

| Phase | State |
|---|---|
| `m20` current, before 10:03 | Memory **active** |
| `m20` current, after 10:03 | Memory **expired** — and `LH` still `m20`, `TC` unchanged, `RH` unchanged |
| after `m21` commits and seals `m20` | **`K(m20)` = expired validity** |

No sub-Moment coordinate; the expiry is ordered within `SP(m20)` by `event_sequence` and projects as that position's then-final state. **v2's "`K(m20)` active" is withdrawn.**

## 13.6 P66-H — exact expiry tie — **PASS**

With `m20.committed_at == expires_at`, the Memory is **expired at `m20`**, because active validity is half-open (`time < expires_at`), matching the committed eligibility form `expires_at > now`.

## 13.7 P66-I — before-first-`SP` distinction — **PASS**

```text
Session created  10:00
Fact canonical   10:02
SP(1) committed  10:05
```

The fact is **`PRE_FIRST_SP`** for this Session and is available at `SP(1)` and every later addressable position. The system **must not** assert that it existed before Session start — it did not; it simply became canonical at a moment with no addressable temporal coordinate. `PRE_FIRST_SP` is determined by the `SessionHistoricalBaseline`, not by comparing timestamps to `conversation_sessions.created_at`.

## 13.8 P66-C, P66-D — **PASS**

P66-C is unchanged in substance; its wording now uses **Legacy Uncovered Session**. P66-D is re-verified: with all three anchors SP-native, `K(m12)` shows Thread and Reading present and the appearance **absent**, and `K(m14)` shows it available — an ordinal comparison against the binding's own `bound_at_sp`.

---

# 14–16. Carried-forward gates

**FG66-07** state/action authority and the six failed attacks · **FG66-08** bounded reach at 10k/100k · **FG66-09** Map accessibility parity from `V` · **FG66-10** the six OPEN-17 isolation conditions · **FG66-11** the seven R-02 restart cases · **FG66-13** client-stack feasibility — **all unchanged**. The clock, sealing and expiry corrections are **entirely server-side**; the client still receives `V` and never handles a temporal address of any kind.

**FG66-15** deferred-feature absence — re-tested once more: `PRE_FIRST_SP` is not addressable, `event_sequence` is not exposed, and SP sealing is an internal invariant. None revives OPEN-06/08/09/19.

---

# 17. Contradiction audit (re-evaluated) — **NONE**

| Pair | Result |
|---|---|
| **v2 expiry oracle ↔ v2 same-`SP` finalization rule** | **This was a real internal contradiction in v2**, found by Architecture and **resolved** in §8: `K(m20)` is expired. Recorded rather than quietly fixed. |
| Session Semantic Clock ↔ Stage 5 `SP` semantics | consistent — availability is assigned in the same coordinate space the Product uses |
| SP sealing ↔ "no historical rewrite" | consistent, and strictly stronger — sealing makes the rule enforceable under concurrency |
| `PRE_FIRST_SP` ↔ Stage 5 state membership | consistent — internal sentinel, not a mode, not addressable |
| `event_sequence` ↔ "no unit below Moment" | consistent — non-addressable, creates no Moment |
| Half-open expiry ↔ committed `expires_at > now` eligibility | consistent — the mapping now *preserves* the committed semantics rather than inverting them at the boundary |
| Clock serialization ↔ committed `FOR UPDATE` idiom | consistent — same mechanism class already used by `finalize_conversation_turn` |
| Background-writer association ↔ committed `post_response_intelligence_executions.session_id` | consistent — the server-owned relation already exists |
| All v1/v2 pairs previously examined | unchanged — **NONE** |

# 18. Ambiguity audit (re-evaluated) — **NONE blocking**

| # | Item | Class | Disposition |
|---|---|---|---|
| AMB66-01 | R-02 checkpoint storage mechanism | EA | options and requirements recorded |
| AMB66-02 | Emerging Focus terminal-state column vs derived status | EA | either permitted; no timer under either |
| AMB66-03 | `ExpiryAtSP` derived vs materialized | EA | both permitted; §8.2/§8.3 oracle is the test |
| AMB66-04 | Which deterministic mechanism realizes `event_sequence` | EA | any deterministic, server-owned, non-addressable form |
| **AMB66-05** *(new)* | Physical realization of the Session Semantic Clock — locked row, advisory lock + durable counters, or equivalent | **EA** | ruling §2 permits any equivalent database-owned mechanism; the semantic contract and the uniform lock-ordering discipline are fixed |

---

# 19. Risk register — revised entries

Carried forward unchanged: CU segmentation determinism · `LF` resolver determinism · establishment predicates drifting into a score · a Map act writing `LF` · batch collapse · unaudited evidence paths · depth-vs-absence confusion · CU density · canvas a11y desynchronisation · virtualized focus stability · metadata drift · low-end Android · Emerging Focus provisional-presentation over-read · parent-substitutes-child · physical removal.

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **R-H** | **Timestamp anchoring reappearing** — an implementer "optimising away" the clock acquisition and inferring `SP` from `created_at` | **High** | §4 contract; **P66-E** in both serialization orders is the merge gate; §20 MUST-NOT |
| **R-I** | **A canonical semantic writer bypassing the clock** — the invariant holds only if *every* such writer enters the boundary | **High** | one enumerated writer list in §11 #9′; a verifier asserting no canonical availability event exists without a clock-issued `at_sp` |
| **R-J** | **Clock contention / deadlock** — routing all canonical semantic writes through one per-session boundary | Medium | the boundary is **per session**, not global; the critical section is short (read `current_sp`, take a sequence, write); **uniform lock ordering — the clock is always acquired first** |
| **R-K** | **Background writer unable to derive its Session** | Medium | durable effect ownership (`post_response_intelligence_executions.session_id`) + source-turn lineage; **if unassociable, it must not fabricate an anchor** |
| **R-L** | **Sealing race** — an analytical write in flight as a CU advances `LH` | Medium | resolved by construction: the CU commit holds the same authority, so one of the two is strictly first (§4.3) |
| **R-M** | **Expiry delayed to the next Moment** for convenience — reintroducing the v2 inconsistency | Medium | **P66-G** and **P66-H**; §8.4 states derived and materialized forms are inequivalent if one delays |
| **R-N** *(revised)* | **Availability BUILD scope** — 31 rows now require SP-native events, a materially larger T-03C than v2 implied | Medium | scope stated honestly in §7.2; field values remain REUSE, so the build is *event capture*, not content migration |

---

# 20. MUST / MUST NOT — additions and revisions

## MUST (additions)

33. Route **every** current-session canonical semantic write that can change historical `K(TC)` through the **shared per-session Session Semantic Clock**, acquiring the clock **first** in the transaction.
34. Assign availability and validity **directly in `SP` space**, from the SP-native semantic event.
35. Assign a deterministic, server-owned, non-addressable **`event_sequence`** to events sharing one `SP`.
36. **Seal `SP(n)`** when a committed CU advances `LH` to `SP(n+1)`, and project a sealed `SP` as the then-final valid state of all events committed within it.
37. Establish a **`SessionHistoricalBaseline`** atomically before `SP(1)`, defining `PRE_FIRST_SP` membership without relying on transaction-start timestamps.
38. Map Memory expiry through **`ExpiryAtSP`**, treating an expiry during an open `SP(n)` as a **same-`SP` validity transition**, with **half-open** validity so an exact tie is **expired**.
39. Derive a background writer's `session_id` from a **server-owned durable relation**; if none exists, do not fabricate a current-session anchor.

*(Revised: v2 MUST 26–29 are replaced by 33–38; MUST 28's `committed_at` is retained as audit metadata only.)*

## MUST NOT (additions)

40. MUST NOT use `CURRENT_TIMESTAMP`, `clock_timestamp()` or any wall-clock value as the authoritative **current-session** availability coordinate.
41. MUST NOT use a timestamp to repair an ordering race after canonical writes have committed.
42. MUST NOT anchor an analytical fact to a **sealed** `SP`, or reopen one by causal-source reference.
43. MUST NOT expose `event_sequence`, `PRE_FIRST_SP`, the baseline token or `historical_coverage_complete` in `V`, the accessible tree, or any announcement.
44. MUST NOT accept a caller-supplied `SP` as availability authority.
45. MUST NOT delay a same-`SP` expiry transition to the next Moment, or treat an exact expiry tie as active.
46. MUST NOT assert that a `PRE_FIRST_SP` fact existed before wall-clock Session creation.

---

# 21. Release conditions — revised canonical set

| | Condition | Owner | Gate |
|---|---|---|---|
| **R-C1** | **Complete session history coverage** — coverage starts at Session start or the Session is fully deterministically backfilled; no partially covered Session is historical-enabled; a **Legacy Uncovered Session** stays on the pre-Stage-6 runtime through closure. | T-03A1, T-03C | §9; **P66-C** |
| **R-C2** | **Static / historical row preservation** — UPDATE, physical DELETE and delete/reinsert replacement all denied for canonical rows used by historical `V`; ACLs + definer functions + triggers + verifiers tested together. Legal/account erasure remains outside Stage 6. | T-03A1, T-03C | **Z66-04** |
| **R-C3** | **Evidence-path defanging** — 0005 / 0021 / 0028 defanged before Evidence-participation history is relied upon. | T-03C | P65-01 row R6 |
| **R-C4** | **SP-native semantic availability authority** — every current-session semantic object/component exposed in historical `V` receives its availability/validity anchor through the shared server-owned **Session Semantic Clock** or an equivalent SP-native event contract. **No transaction-start timestamp determines current-session Product availability**, and no sealed `SP` is reopened. | **T-03A2 (clock), T-03C (integration)** | §4, §6, §7; **P66-A, P66-E, P66-F, P66-I** |
| **R-C5** | **Wall-clock validity mapping** — wall-clock-only policy facts such as Memory expiry are mapped into the current `SP` bucket using the frozen same-`SP` and sealing semantics. **No direct timestamp ↔ `TC` comparison. Exact expiry is expired.** | T-03C | §8; **P66-G, P66-H** |

---

# 22. Stage 6 freeze recommendation

| Stop Rule (ruling v2 §23) | Result |
|---|---|
| A user-addressable sub-Moment coordinate | **No** — `event_sequence` and `PRE_FIRST_SP` are internal and non-addressable |
| Exposing same-`SP` `event_sequence` | **No** — MUST-NOT 43 |
| Using caller-supplied `SP` as authority | **No** — MUST-NOT 44; §4.5 |
| Backdating to causal source | **No** — §6.2; **P66-E**, **P66-F** |
| Timestamp-only current-session availability | **No** — §4; **P66-E** |
| Reopening a sealed `SP` | **No** — §6.1; **P66-F** |
| Delaying a same-`SP` expiry to the next Moment | **No** — §8; **P66-G** |
| Partial-session historical enablement | **No** — §9; **P66-C** |
| Treating coverage/baseline metadata as Product truth | **No** — §5.2, §9 |
| Reopening OPEN-06 / 08 / 09 / 19 | **No** — §16 |

> # **RECOMMENDATION: `STAGE 6 FREEZE APPROVED`**

**Recommended to Product / Experience / Engineering Architecture. Claude has no freeze authority and does not declare Stage 6 frozen.**

# 23. Implementation Authorization recommendation

**Recommended: authorize implementation of the 19-task sequence, subject to R-C1 … R-C5**, with two scope notes Architecture should see before scheduling:

1. **T-03A2 grows** — it now owns the Session Semantic Clock and the sealing invariant, which every downstream SP-native write depends on.
2. **T-03C grows materially** — 31 rows require SP-native availability/validity events. The **field values remain REUSE**, so this is *event capture* rather than content migration, but the v2 impression of thirteen ready-to-reuse rows is withdrawn.

**Not authorized by this document.** Implementation begins only on Architecture's explicit authorization.

---

**END — QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v3**
