# QANDEEL — INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02) — Implementation Record v1

**Status:** `INTEL-TM-01` — **IMPLEMENTED — PR OPEN, AWAITING INDEPENDENT REVIEW / PRODUCT OWNER MERGE DECISION — NOT MERGED, NOT DEPLOYED.**
Merge only on the Product Owner's explicit «ادمج».
**Authority:** the Product Owner's *INTEL-TM-01 / PG-02 Implementation Task Contract* (2026-10-10, "APPROVED FOR BOUNDED
IMPLEMENTATION"), which approved the WP0R2 architecture with mandatory amendments. Design references, in precedence order:
WP0R2 *Final Architecture Correction*, WP0R *Revised Architecture Decision*, WP0 *Repo Truth & Architecture Decision*
(task-local reports; WP0R2 wins where it amends WP0R).
**Baseline:** `main = 44a440cfbb2c05421ed36639a5cf67ee7a8d25e5` (the merge of PR #325); migrations `0001`–`0150`.
**Branch:** `intel/intel-tm-01-pg02-personal-evidence-truth-maintenance`.
**Migration:** `0151_personal_evidence_truth_maintenance_v1.sql` (the next free slot; forward-only; no historical
migration edited).
**Backlog:** owner of `QAN-BL-INTEL-01`. Its disposition is made by the closing change at the Product Owner's merge
decision (§9).

---

## 1. Product outcome

When the reader forgets, disables or corrects a Memory, QANDEEL no longer relies on a Hypothesis **known** to depend on
that information. The Hypothesis, its statement, history and provenance are kept, and nothing declares it false. The
guard works from committed facts alone — immediately, with no worker, no Redis and no Confidence run involved.

The guarantee is exactly that, and no more: **QANDEEL never relies on a Hypothesis that is known to depend on withdrawn
or corrected evidence.** PG-02 is not a universal forgotten-content erasure mechanism (§7).

## 2. Reliance — three layers, one definition

| Layer | What it is | Where |
|---|---|---|
| **L1 — Memory standing** | per linked row: `CURRENT` (owned, `ACTIVE`, unexpired, `USER_STATED` / `USER_CONFIRMED`, not `DERIVED_INSIGHT` — exactly `0028` steps A + B, without the 64-row window and without deduplication), `WITHDRAWN` (`DELETED` / `DISABLED`), `CORRECTED` (`SUPERSEDED`), `LAPSED` (`EXPIRED` / past `expires_at`), `OTHER` (anything else, a missing row included) | `personal_evidence_standing_v1` |
| **L2 — canonical Evidence** | `canonical_eligible_memory_ids_v1` (`0028`): 64 candidates, exact deduplication. **Unchanged**, and still the only input of attach, Confidence and the Understanding evidence text | `0028` |
| **L3 — Hypothesis reliance** | a function of L1 over the current links plus the immutable withdrawal records. It only ever **withholds**; it never grants Evidence and never feeds Confidence | `hypothesis_evidence_change_core_v1` |

```
tainted(h)         := a withdrawal record exists for h, or a current link (either role) is WITHDRAWN / CORRECTED
had_support(h)     := h has a supporting link, or a record of h detached a supporting link
current_support(h) := a supporting link of h is CURRENT
evidenceChange(h)  := NO_REMAINING_SUPPORT if had_support and not current_support
                      REVIEW_PENDING       else if tainted
                      NONE                 otherwise          -- the only value QANDEEL relies on
```

- **Invariant L2 ⊆ CURRENT** (proved by `verify-migration-0151`): every id the projection counts has standing `CURRENT`, so
  reliance sees support wherever Evidence does. A `CURRENT` link outside the window, or a deduplication loser, keeps the
  item usable — as today — and still counts as no Evidence in Confidence — also as today.
- **Five source classes:** `DELETED` / `DISABLED` taint and are detached by the housekeeping, with a record;
  `SUPERSEDED` taints and is **kept** (a correction is not a forget); `EXPIRED` withholds only when no support is left and
  taints nothing; a valid out-of-window source changes nothing; a missing row is not a withdrawal.
- **Monotonic.** A Memory never becomes `ACTIVE` again, a link leaves only through the recorded step (§3, CC-1) and a
  record is removed only with its Hypothesis by the governed erasure. Taint therefore never returns to false, and the
  value is identical before and after the housekeeping, and if it never runs.
- **Restoration.** None in V1 for a tainted item: not remaining support, a new attach, a lifecycle move, a fresh
  Confidence, a PG-01 resolve or time. Lifting it requires a separately authorized semantic-verification authority
  (Controlled Change). An **untainted** `NO_REMAINING_SUPPORT` (expiry only) becomes `NONE` only when a `CURRENT`
  supporting link exists. A newly generated, independent Hypothesis may say the same thing with its own provenance; it is
  never treated as proof that the old one is valid.

## 3. Controlled Changes (approved, binding over the frozen texts named)

The frozen documents are not rewritten; these amendments live here, with binding-over pointers in the locators.

**CC-1 — Evidence withdrawal and provenance** (amends `docs/hypothesis-update-loop-v1.md`'s append-only attach and the
`0036` header "Hypothesis Update remains an Evidence loop that never touches status", which stays literally true).
- One system-only operation: `reevaluate_withdrawn_hypothesis_evidence_core_v1` (executable by no role) behind the
  service-role wrapper `background_reevaluate_withdrawn_hypothesis_evidence_v1(p_user_id, p_limit ≤ 32)`. It detaches
  **only** links to `DELETED` / `DISABLED` Memory, writes the immutable record **first**, bumps the version by one and runs
  the unchanged `background_create_confidence_evaluation_v1` for the new exact version, all in one transaction.
- The record `hypothesis_evidence_withdrawal_reevaluations` holds which links, which version step and which Confidence
  evaluation — no statement, content, reason text or provider payload. Owner-only `SELECT` under RLS, no client write,
  immutable, `ON DELETE CASCADE` with the Hypothesis and a `DELETE` guard that admits only the governed `0130` erasure.
- **Row invariant** (trigger `hypotheses_evidence_link_removal_guard`): a link leaves a Hypothesis only together with a
  matching record for exactly that version step, naming exactly the removed links, every one `WITHDRAWN`, with no link
  added and no status, owner or competitor change. Every existing writer only appends (`0005`, `0008`, `0021`, `0028`,
  `0032`, `0150`).
- No status, statement or Confidence-semantics change; no `REJECTED` / `RETIRED` is written, so `0134` never fires.

**CC-2 — Understanding** (amends the W3-MEGA-U §2.2 Product view model and the U1 / U2 key pins).
- One always-present key `evidenceChange` (`NONE` / `REVIEW_PENDING` / `NO_REMAINING_SUPPORT`). The four confidence
  states are unchanged; no fifth state exists.
- A withheld item: `summary: null`; `evidence`, `contradictions`, `alternatives` and `unresolved` are `[]`; confidence
  keeps rules 1–2 (contested or `MIXED` → Mixed) and is otherwise Needs more — never Clear / Taking shape. `theme`, `ref`,
  `revision`, `underReview` and `evolution` (kinds and times only) are as before.
- A relied-on item never names a withheld competitor in `alternatives`.
- Discussion open on a withheld item answers the existing `409 UNDERSTANDING_ITEM_CHANGED` and writes no focus. Disagree
  and resolve (PG-01) are unchanged and lift nothing.
- Outbound audit (fail closed): `evidenceChange ≠ NONE ⇒ summary = null, the four lists empty, confidence ∈ {MIXED,
  NEEDS_MORE}`; `evidenceChange = NONE ⇒ summary` is text. The mobile strict decoder enforces the same shape.

**CC-3 — Question safety** (amends QIR-006 selection and finalization semantics; `0063` is not edited and
`finalize_conversation_turn_v2` is not redefined).
- `select_formal_question_opportunity_v1` is redefined in `0151` as `0063`'s body byte for byte plus exactly three marked
  lines: a withheld Hypothesis is never a new candidate; a same-turn `SELECTED` reservation whose Hypothesis became
  withheld answers `NO_ELIGIBLE_GAP` with the row untouched (the existing trigger releases it); a `BOUND` question on a
  withheld item stays `BOUND` as history and no longer blocks the session.
- Bind-time guard `formal_question_turn_binding_reliance_guard` (`BEFORE UPDATE … WHEN SELECTED → BOUND`): locks the
  Hypothesis row, then its linked Memory rows, `FOR SHARE` in id order; re-evaluates reliance on committed state; refuses
  a withheld binding. The whole finalization rolls back, no assistant turn is committed or returned, and the orchestrator's
  existing failure path frees the reservation through the existing release trigger.
- Lock order: a withdrawal / correction locks only its Memory row and its own turn; the housekeeping locks only the
  Hypothesis; finalization takes nothing of the 0072 capture clocks. No cycle exists, and the two-connection proofs show
  no deadlock.
- **Policy for questions already generated:** a question bound before a withdrawal was lawfully delivered with its reply
  and is not recalled; nothing claims to cancel a started reply. Its `BOUND` row is history only.

**CC-4 — Background housekeeping** (amends the post-response dispatcher's strict step sequence).
- One **fail-soft** step, `maintainWithdrawnEvidence`, for every `ALLOW` execution right after the canonical reread and
  before any step that can end the execution early. No provider, no effect key, no retry engine, no `0061` change. Any
  failure is one content-free signal (`PERSONAL_EVIDENCE_TRUTH_MAINTENANCE` / `withdrawal_reevaluate` /
  `success | transport_failure | integrity_failure`) and changes nothing else: no quarantine, no redelivery, no skipped
  step. Pending work is derived from committed facts on every call, so a lost, late or duplicated event neither loses nor
  fabricates work.

## 4. Where reliance is enforced — the guarded consumer paths

| Consumer | Mechanism |
|---|---|
| Conversation reasoning context (and Recommendation grounding, which reads only it) | `HypothesisReasoningContextService.build` reads `hypothesis_evidence_reliance_v1` after the list, version-pinned; only `NONE` items are offered, focused or contested-first |
| Generation (authenticated and background) | `listReliableActiveForUser` / `listReliableActiveHypotheses`: a withheld item is never shown to the generator and never a collision key |
| Association (authenticated and background) | the same reliable lists: a withheld item is never a candidate or a target |
| Formal Question selection and binding | SQL: the selector's three lines and the bind-time guard (CC-3) |
| Understanding discussion focus | open refuses a withheld item; the reasoning context excludes it whatever a focus says |
| Owner view | Understanding shows the withheld item safely (CC-2) |

**Read rules:** one reliance read per consumer, after the list read, answering only the caller's own items for the
version it judged. An answer for another version, or no answer, makes that item unusable for the read; a malformed
answer or a failed read omits the whole context (the existing fail-closed pattern) and writes nothing.

## 5. Copy (Product-Owner approved)

| Value | Arabic (PO, byte-for-byte) | English |
|---|---|---|
| `REVIEW_PENDING` | «هذا الاستنتاج يحتاج إلى مراجعة بعد تغيير معلومات كان يعتمد عليها.» | "This conclusion needs review after a change to information it relied on." |
| `NO_REMAINING_SUPPORT` | «لا توجد حاليًا معلومات مؤهلة تدعم هذا الاستنتاج، ولذلك لن يعتمد عليه قنديل.» | "No eligible information currently supports this conclusion, so QANDEEL won't rely on it." |

The English is the WP0R2 equivalent with the product name in its established `QANDEEL` form, matching every other
English string of the surface. Both lines state a state, never a process; neither names, quotes or hints at any Memory.
The line stands in the statement's place on screen **and** in the screen-reader label, so the hidden statement is never
announced. A withheld item offers no "talk" control.

## 6. Implementation notes and deviations from the WP0R2 text (disclosed)

1. **Bind refusal SQLSTATE is `42501`, not `PT409`.** WP0R2 named `PT409`. The PROD-RETRY-01 census (`verify-migration-0150`,
   `tests/prod-retry-01-…`) freezes PT409 to exactly its thirteen raisers, and the retry-hazard analysis reaches a trigger
   from every write to its table — every conversation-turn writer would have changed classification. `42501` is
   finalize v2's own family for an invalid binding (`INVALID_QUESTION_BINDING`), is never re-run by PostgREST, and leaves
   both frozen pins untouched. The orchestrator fails the turn on any finalization error, so the behaviour is identical.
2. **Mobile disagree / agree on a withheld item.** Today these acts are reachable only from the discussion strip, which a
   withheld item cannot open (no "talk"). They are not added elsewhere: each would act on a statement the reader is not
   shown. The server commands are unchanged and work on withheld items (proved), contested withheld items still read
   Mixed + under review, and a discussion whose item turns out withheld on a re-read ends.
3. **Re-anchored verifier pins** (each explicit, named and narrow): `verify-migration-0028` admits the L1 standing
   predicate by name only while it stays executable by no role and unused by every Evidence consumer (the QAN-AUD-03
   objection WP0R2 pre-empted); `verify-migration-0134` gives its compiled-service stub the real reliance read. Static
   contracts re-anchored: U1 (`evidenceChange`, `summary: string | null`), W3-CORR-U (the priority groups over `reliable`).
   The e2e smoke adapters gain the reliance RPC and the two background methods.

## 7. Limits — stated, not guaranteed

- **L-1:** a Hypothesis created with no evidence link cannot be traced by PG-02 to a withdrawn Memory, and the
  `0029` / `0033` ledger that could trace it belongs to `INTEL-RET-01` (`QAN-BL-INTEL-02`). PG-02 claims nothing for
  unlinked items.
- **L-2:** PG-02 covers derived Hypotheses only. Conversation history (still passed to the provider), the export (which
  already contains forgotten Memory text labelled «forgotten», `0130:578-584`, by approved design) and other derived
  stores keep their own contracts. No conversation-history rewrite, export redesign or retention policy is made here.
- **Linearization:** a turn whose inputs were read before a withdrawal committed is a pre-withdrawal turn, exactly as for
  Memory retrieval today; only the question gets a commit-point check, because only it binds durably to the Hypothesis.
- **No Redis / no further turn:** the housekeeping simply does not run; links stay attached and the state computed from
  them is identical; every consumer stays guarded.

## 8. Validation

- `database/verify-migration-0151.mjs` (real PostgreSQL): catalog and privileges; T1–T9, T11, T14, T15; the housekeeping;
  two-connection races (forget / correction in flight during the bind, a withdrawal that rolls back, the bind first,
  duplicate housekeeping, housekeeping holding the Hypothesis while a bind waits); erasure with a populated record table.
  A mutation run with the bind guard disabled fails at T12 (non-vacuous).
- Jest (API): reliance projection and service; reasoning context; generation and association lists; Understanding
  projection, audit and service; dispatcher fail-soft step; telemetry relation. Jest (mobile): strict decoder, surface
  (Arabic and English, screen-reader labels, no talk), controller, integration flow.
- Static: `tests/intel-tm-01-personal-evidence-truth-maintenance-contract.test.mjs`, plus the re-anchored U1 and W3-CORR-U.
- CI-01: the F1 scenario re-run on the implementation SHA, recorded in a **new** results file; the `6a5fa42` results stay
  untouched. The driver gains a per-Hypothesis reliance measure beside the old item count.

## 9. Backlog and residues

- **`QAN-BL-INTEL-01`:** resolved in the repository by this task; it stays `DEFERRED — OWNED` until the closing change at
  the Product Owner's merge decision disposes of it under BG-08.
- **`QAN-BL-INTEL-02`:** its reopen condition 3 fired when INTEL-TM-01 opened; discharged by check, not absorbed: PG-02
  reads and writes no `0029` / `0033` `result_payload`. It stays `VALIDATION — OPEN`, owner `INTEL-RET-01`.
- **R3-G — general question-finalization version recheck (residue, proposed for Product Owner decision).** The bind-time
  guard closes the **PG-02** reliance race only. `finalize_conversation_turn_v2` still binds without re-checking the
  Hypothesis version or lifecycle for other causes (an owner transition or an attach between selection and finalize);
  QIR-006 Fix 02 makes such a `BOUND` row non-current afterwards, but the bind itself is not re-checked. No existing backlog
  item or owner covers it. **Proposed:** admit it at the closing change as a `MEDIUM` item, proposed owner
  `QIR-006-R1 — Formal Question Bind-Time Version & Lifecycle Recheck`, if the Product Owner agrees. It is not marked
  resolved and no scope is created here.
- **R2 (observation, unchanged):** clarification-answer turns are not caught by the background `MEMORY_CONTROL_COMMAND`
  guards; for the Memory-control owner to verify before any admission.

## 10. Not done here, on purpose

No new LLM call, provider, lifecycle state, Confidence category or retry engine; no change to `0063`, finalize v2,
`0128`, `0130`, `0134` or the canonical Evidence; no conversation-history rewrite, export redesign or retention policy; no
roadmap change; no deployment.
