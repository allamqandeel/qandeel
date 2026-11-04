# INTEL-04 — Thread Lifecycle Derivation Correction: Implementation Record v1

**Status:** `INTEL-04 — CLOSED / READY FOR PO MERGE DECISION` — NOT MERGED / NOT DEPLOYED. Delivered on Draft PR
"INTEL-04 — Thread Lifecycle Derivation Correction" from `intel/intel-04-thread-lifecycle-derivation`. That branch starts
from `main` at `8e59023414788c831468b9f5590df35240951b6a`, the merge of S8B-06 CP3 (PR #381).
- Merging needs the Product Owner's explicit «ادمج».
- Migration `0194` is **not hosted**. A hosted migration goes only through `HOSTED-DEPLOY-01` (its `0075`+ catch-up).
- The next migration is `0195`.

**Backlog:**
- Inherits `QAN-BL-INTEL-04` (`HIGH`; a pre-launch correctness blocker of the live analysis). It is **tombstoned** by this
  closing change (§10).
- Admits `QAN-BL-INTEL-05` (`MEDIUM`, `UNASSIGNED`): the residue this task found and was not authorized to change (§10).

**Authority:**
- The Product Owner's execution order for INTEL-04 (2026-11-04), option A of the S8B-06 CP3 F-H decision memo, "once
  tests prove it".
- The S8B-06 CP3 record, F-H (§5, §6.1).
- [Thread Lifecycle + Cross-Session Continuity v1](../thread-lifecycle-cross-session-continuity-v1.md) §3, whose §11 is
  added by this task.

**Migration:** `database/migrations/0194_intel_04_lifecycle_relation_at_binding_sp_v1.sql`.

This record states what changed, why, what was deliberately not changed, and how it was verified. It contains no secret,
credential, transcript of a real person, or hosted identifier. Every conversation in it is synthetic.

---

## 1. The root cause (proven)

**How the database checks a lifecycle payload.** For every committed CU, the database re-derives the Thread lifecycle
transitions and refuses a payload that differs. The re-derivation is `derive_conversation_thread_lifecycle_transitions_v1`
(`0070`). The refusal is `THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL` (SQLSTATE `22023`).

**What SUSTAINED_DEPARTURE needs.** Two CUs must both be away from the Thread: the current CU and the CU at
`session_position − 1`. "Away" is answered by `conversation_thread_cu_relation_v1`.

**The defect.** That relation's `attention_on` predicate counted a focus → Thread binding only when it was made
**strictly before** the CU being read (`b.bound_sp < cu.session_position`). The CU that establishes a Thread carries that
binding at **its own** position, and so does a CU that binds an existing Thread by Session continuity. The relation
therefore answered "away" for that CU and its own Thread.

**The two derivations, side by side.** Take an establishing CU followed directly by a CU whose attention is elsewhere:

| Side | Derived transition |
| --- | --- |
| The database | `ACTIVE → DORMANT (SUSTAINED_DEPARTURE)`, after **one** departure |
| The reducer (`apps/api/src/thread-lifecycle/thread-lifecycle-reducer.ts`) | nothing |

The reducer reads attention through every binding visible to the current CU, including the previous CU's own binding.
The record (§3) agrees with the reducer: a CU is never away "when its attention is on the Thread's bound focus".

**The proof.** The T6 counter-test (§4.1) puts `0070`'s relation back inside a rolled-back transaction. The reducer's
payload is then refused again, and the database's one-departure SUSTAINED claim is accepted.

## 2. The reducer and the database, before and after

| Sequence | Reducer (TS) | `0070` (PG, before) | `0194` (PG, after) |
| --- | --- | --- | --- |
| Establish, then **one** away CU (T1) | no transition | `SUSTAINED_DEPARTURE` → payload **refused** | no transition, **accepted** |
| Establish, a reply with **no unit** (a call reply cut before a word is heard), then one away CU (T3) | no transition | **refused** | **accepted** |
| Establish, then two consecutive away CUs (T2) | `ACTIVE → DORMANT` at the 2nd | refused at the 1st, so never reached | `ACTIVE → DORMANT` at the 2nd |
| `ACTIVATE_EXISTING_IN_SESSION`, then one away CU (T4) | no transition | **refused** (the memo's suspicion, confirmed) | **accepted** |
| Two Threads established in consecutive CUs, then away (T4) | only the earlier Thread departs | **refused** | only the earlier Thread departs |
| Establish, then an `EXPLICIT_FOCUS_SHIFT` (T4) | `EXPLICIT_FOCUS_SHIFT` | `EXPLICIT_FOCUS_SHIFT` (unchanged neighbour) | `EXPLICIT_FOCUS_SHIFT` |

After `0194`, the database and the reducer agree on every sequence above.

## 3. The change

**One forward-only migration, `0194`.**
- It replaces `public.conversation_thread_cu_relation_v1` in place with `CREATE OR REPLACE`.
- The signature, OUT columns, `STABLE`, `SECURITY DEFINER`, `search_path=''`, owner `postgres` and the revokes are kept.
- The body is `0070`'s verbatim, with exactly one predicate changed:

```sql
attention_on := att.attention_kind <> 'NO_INDEPENDENT_FOCUS' AND EXISTS (
  SELECT 1 FROM public.conversation_thread_focus_bindings b
   WHERE b.thread_id = p_thread_id AND b.session_id = cu.session_id
     AND b.emerging_focus_id = att.emerging_focus_id AND b.bound_sp <= cu.session_position);
```

- A self-proof inside the same transaction refuses the migration if any of these drifted: the posture, the single `<=`,
  the strict `targets_thread`, or the absence of grants. Its refusal tokens are `INTEL_04_RELATION_*`.

**Why the change is sound.**
- The validator runs **before** the current CU's own binding is written. For the current CU, the change therefore admits
  nothing new.
- For the previous CU, it admits exactly the binding that CU made itself, which is the reducer's reading.
- After persistence, a binding at the current position is always the current CU's own focus, bound to a Thread that is
  not in the derivation's loop. It changes no transition when the rows are re-derived.

**Deliberately unchanged (each `<` is intended).** The Product Owner's order was not to turn every `<` into `<=`.

| Kept as is | Why |
| --- | --- |
| `targets_thread` (`b.bound_sp < cu.session_position`) | A target is an earlier CU. A target focus bound at the reading CU's own position is that CU's own attention, already counted by `attention_on`. |
| The derivation's loop over Threads bound strictly before the current CU, its `own_thread` read and its order | A Thread first bound at this CU is a baseline, never a transition: the reducer's `threadStates`. |
| `conversation_thread_session_lifecycle_state_v1` | It reads strictly before `p_before_sp`. |
| The validator's refusal of a binding at or after the current position | It is the structural check. |

Also unchanged: the semantic batch state, the readiness audit, every writer and coordinator, the identities, events,
bindings and Homes, the same-SP sequencing, and the order of Threads.

**Migration hygiene.**
- `0070` is byte-identical. A sha256 pin in the INTEL-04 contract enforces this.
- `0194` writes no row and runs no backfill or rewrite.
- It touches no queue item and grants nothing.

**The reducer is not changed.** It was already canonical. Its spec gains the INTEL-04 cases (T1/T3, T2, T4 explicit
shift, T4 two Threads).

**Wiring.**

| Kind | Name |
| --- | --- |
| Package script | `verify:intel-04-lifecycle-relation:integration` |
| Package script | `prove:intel-04-lifecycle-synthetic:integration` |
| Package script | `test:intel-04-thread-lifecycle-derivation-contract` |
| API CI step | the static contract |
| API CI step | the verifier, after the `0193` verifier |
| API CI step | the integrated proof, on a throwaway `TEMPLATE` clone that is dropped afterwards |

`verify-migration-0070` keeps running, unchanged, on top of `0194`.

## 4. Evidence on real PostgreSQL (local PG 17, synthetic people only, no paid call)

### 4.1 The verifier (`database/verify-migration-0194.mjs`)

The verifier drives `0070`'s own coordinator inside `BEGIN … ROLLBACK`. It has 96 assertions, all PASS on `0194`. It
covers:
- T1: a CU establishes a Thread, then one away CU follows. The SUSTAINED claim is refused, the canonical `[]` is
  committed, and the relation answers `attention_on` / not `away`.
- T2: DORMANT at the second departure only, then REOPENED, then CONTINUED_ANCHORING.
- T3: the call shape.
- T4:
  - the explicit shift;
  - two Threads in order, with distinct Homes and positions;
  - `ACTIVATE_EXISTING` in a new Session followed by one departure, keeping the same Home and one Thread, with the
    identity version incremented by one.
- T6, the counter-test: `0070`'s relation, read from the `0070` file, is executed inside a savepoint. The canonical
  payload is refused again, and the SUSTAINED claim is accepted. The savepoint rolls back, the body is checked to be
  byte-identical to before, and T1 is re-run.
- Static checks of posture and grants, and of the reducer, state and validator predicates.

**Before / after matrix**, each scenario run on its own:

| Scenario | on `0193` | on `0194` |
| --- | --- | --- |
| T1 | FAIL (payload refused) | PASS |
| T2 + reopen / continue | FAIL | PASS |
| T3 call shape | FAIL | PASS |
| T4 explicit shift | PASS (unchanged neighbour) | PASS |
| T4 two Threads | FAIL (`NOT_CANONICAL`) | PASS |
| T4 `ACTIVATE_EXISTING` + one away | FAIL | PASS |
| T6 counter-test | FAIL at T1 (no fix to disable) | PASS |

### 4.2 The integrated proof (`apps/api/scripts/intel-04-thread-lifecycle-proof.ts`)

**What is real and what is fake.**
- Real: the semantic establishment service, the call analysis worker and queue, the background permits, the
  turn-commit RPCs, and the map's read repositories (temporal snapshot, Live Focus events, the historical projection).
- Fake: only the four layer providers.

**The two paths.**
- W, written: two exchanges.
- C, call: three turns.
  - Turn 1's reply is registered and never played.
  - Turn 2 closes exchange 1 by `NEXT_TURN`, `INTERRUPTED`, heard 0.
  - Turn 3 holds two sentences.

| Run | Database | Result |
| --- | --- | --- |
| `FIXED`, `ALL` | a clone at `0194` | **22/22 PASS**. W and C commit SP 1 – 6 contiguously, with `5:ACTIVE→DORMANT:SUSTAINED_DEPARTURE` only. One Thread, bound at SP 1. Every stored row re-derives. The Living Map checks (T5) pass on both paths. In the call, every half settles COMPLETE on its first attempt, in order. |
| `DEFECT`, `ALL` | a clone at `0193` | **5/5 PASS** (the defect reproduced). W's exchange 1 is refused with `NOT_CANONICAL` and **lost**. C's turn-2 USER half is refused three times and PARKED, and every later item waits behind it: the S8B-06 F-H device evidence. |
| `DEFECT`, `PARK`, then `0194`, then `FIXED`, `RESUME` | the same database, migrated forward in between | **3/3**, then **11/11 PASS** (§5) |

**The Living Map checks (T5), strengthened at PO Review R1.** Before R1 they checked only that the projection read
returned an object. The expectation is now taken from the durable rows alone: the CUs with their attention, the binding,
the lifecycle events and the durable Live Focus transitions. It is never taken from the read path. Each check runs on W,
C and RESUME:

| Check | What it proves |
| --- | --- |
| The live head | The snapshot's `liveHead` and the projection's `liveHead` and `tc` all equal the committed head, SP 6. |
| The expected Thread | The projection at the head holds exactly one Thread. Its id is the bound Thread's. It is established in this Session at SP 1, grounded on the establishing CU's focus, and `ESTABLISHED_DORMANT` (its state after SP 5). |
| The Live Focus events | The delivered events are exactly `1:THREAD:<that Thread>`, then `2:` / `4:` / `5:EMERGING:<that CU's focus>`. They equal both the rule (the establishing CU puts the Thread in focus; each later USER CU that starts a focus puts that focus in; an ASSISTANT CU changes nothing) and the durable LF transitions. |
| The current Live Focus | The snapshot, the last event and the projection agree on `EMERGING` at SP 5. |
| No refusal, no loss | No server RPC refused anything during the path, and every USER CU's focus is delivered. |

R1 changed no production logic. The strengthened checks found no defect.

## 5. The analysis continues after the former stall point (T5)

A 0193 database was left exactly as the defect leaves a call:

| Item | State |
| --- | --- |
| `1:USER`, `1:ASSISTANT` | COMPLETE |
| `2:USER` | PARKED (3 attempts, `TRANSPORT_UNAVAILABLE`) |
| `2:ASSISTANT` … `3:ASSISTANT` | PENDING |

`0194` was then applied to that same database. The proof shows:

1. **The migration changed no item.** The head is still PARKED and every item is exactly as it was parked.
2. **The same item completed on its own parked retry.** Its attempts went from 3 to 4; it was never reset or re-queued.
3. **It ran only when its rule made it due.** It settled at `next_attempt_at`, about 291 s later; the policy's
   `parked_retry_seconds` is 300.
4. **The rest of the order drained behind it, in order.**
5. **Every CU was committed once, contiguously.** The second departure is DORMANT at SP 5, and nothing is earlier.
6. **Every stored row re-derives.**
7. **The Living Map reaches the head with the expected Thread and Live Focus** (the T5 checks of §4.2). No server RPC
   refused anything after `0194`.

No new reprocessing was added and no ordering rule was bypassed.

## 6. Existing data and jobs

**Stored lifecycle rows.** Every stored row was accepted by `0070`, so it equals both the reducer's result and the old
derivation. The one sequence where those two differ was never committable. Every stored row therefore stays re-derivable
under `0194`. Nothing is rewritten.

**Call analysis items PARKED by this refusal.** Once `0194` reaches a database, such an item completes on its next parked
retry, in its order (§5). Nothing reprocesses it early.

**Written exchanges refused by the defect.** Their semantic chain was never committed. Their Thread never existed, and the
next exchange took their positions (§4.2 `DEFECT`). `0194` does not re-establish them: the order forbids a backfill. This
loss, and the analysis worker treating a deterministic refusal as a transient transport failure, are admitted as
`QAN-BL-INTEL-05` (§10).

**Hosted data.** No hosted database was read and nothing was deployed. Whether production met the defect is still
unknown.

## 7. Graphics and protected contracts: unchanged

No file under `apps/mobile` is changed. This includes WorldCanvas, MapCanvas, MapSurface, WorldViewSurface, `map/visual`,
colours, shapes, camera, motion, zoom and positions.

Also unchanged:
- the LA-VIS-01 and VPORT-01 contracts and their Golden Images;
- the Thread concept, Home and the disclosure rules;
- the voice replies, provider budgets, Voice Gates (every one stays `DISABLED`) and the call path. The change adds no AI
  call and no latency.

No drawing fix was found necessary.

## 8. Verification run for this change

Local, on real PostgreSQL 17 (a throwaway cluster, synthetic people only, no provider, no paid call), at the closing change:

| Check | Result |
| --- | --- |
| Fresh **sequential** install `0000` – `0194` (the Supabase-compatible bootstrap first, as in CI) | applied |
| `0194` applied forward onto a database already at `0193` (the PARK / RESUME database), and re-applied | applied; idempotent |
| `verify-migration-0066` … `0072`, `0150`, `0151`, `0183`, `0189` – `0194` on the sequential install | all exit 0 (`0070`: 580 assertions, unchanged; `0194`: 96) |
| The integrated proof: FIXED on the sequential install / FIXED / DEFECT / PARK → RESUME | 14/14 · 14/14 · 5/5 · 3/3 → 7/7 at the closing change; after PO Review R1's strengthened T5 checks: FIXED 22/22 · DEFECT 5/5 · PARK 3/3 → RESUME 11/11 |
| `npm run test:database` | 1310 / 1310 |
| Root contracts, `node --test tests/*.test.mjs` (including `test:task-closure-governance-contract` and the INTEL-04 contract) | 1747 / 1747 |
| `npm run test:forward-safety-contract` | 35 / 35 (about 11 minutes locally) |
| `apps/api` jest, full suite | 338 suites; 7745 passed, 1 skipped |
| `apps/api` jest, `src/thread-lifecycle` | 7 suites, 106 tests |
| `tsc -p apps/api/tsconfig.scripts.json --noEmit` | clean |
| API CI on the PR head | recorded on the PR (green CI alone is not taken as proof) |

## 9. Contracts re-anchored (each still checked, never deleted)

- **`tests/s8b-05-live-call-contract.test.mjs`.** The last migrations now end with `0194`.
- **`tests/thread-establishment-evaluator-contract.test.mjs`.**
  - `0194` is exempt for its one re-creation of `conversation_thread_cu_relation_v1`. That re-creation must equal `0070`'s
    statement with exactly the `attention_on` substitution. Outside it, `0194` carries no Thread / Home substrate.
  - The `0194` verifier joins the database files that drive the coordinator with the frozen TE-01 provenance and never
    import the evaluator.
- **`tests/durable-thread-home-same-sp-substrate-contract.test.mjs`.** The integrated proof's one read-only Thread count
  is exempt by its exact text. The file must still reach no writer, canonicalizer or placement mirror.
- **`tests/durable-reference-emerging-focus-sp-substrate-contract.test.mjs`** (T-03B1b1; **CI Correction R2**, 2026-11-04).
  - **What failed.** API CI on `37a9c170` (`verify-api`) failed its scripts scan: "`intel-04-thread-lifecycle-proof.ts`
    does not reach the substrate". R1's T5 checks added two reads naming `emerging_focus_id`: each CU's attention focus,
    and the Thread binding's grounding focus.
  - **The re-anchor.** Exactly those two `SELECT` texts are allowed, each exactly once. Each must be a plain SELECT that
    calls no function. The rest of the file is held to the unchanged rule (`with_focus_v1`, `focus_runtime_context`,
    `durable-focus`, `emerging_focus`) and reaches no canonicalizer in code. The file is not exempted, the forbidden
    expression is not removed, and the 0066 writer, context read and canonicalizer stay forbidden.
  - **The counter-test.** A new test plants eight unauthorized shapes into the real proof text, and every one is refused:
    another substrate read, a write, the 0066 writer, the runtime context read, the canonicalizer, an allowed read used
    twice, an allowed read turned into a write, and an allowed read widened.
  - **What R2 did not change.** No `0194`, no production lifecycle engine, no T5 assertion, no graphics file, and no other
    contract. `VAL-01` failed only as a consequence of API CI and is untouched.
  - **Local results.** The T-03B1b1 contract passes 10/10, and every static root contract passes, 1748/1748. No SQL or
    proof logic changed, so the PostgreSQL proofs were not re-run locally; CI runs them on the new head.

## 10. Backlog reconciliation (BG-08) and admission (BG-06)

**`QAN-BL-INTEL-04` → `CLOSED — TOMBSTONE`.** Every required future property is met:
- the reducer and the database derive the same transitions for the written and the call sequence, on real PostgreSQL;
- no payload the record calls canonical is refused;
- the earlier cases and the order of Threads are unchanged, proven by tests;
- the `0070` suites stay green;
- hosting goes only through `HOSTED-DEPLOY-01`.

Its history is kept in §6 of the backlog.

**`QAN-BL-INTEL-05` admitted (`MEDIUM`, `OPEN — UNASSIGNED`).** The analysis paths treat a deterministic refusal of the
semantic establishment as transient:
- In a call, the worker classifies the `22023` refusal as a provider failure, `TRANSPORT_UNAVAILABLE`, rather than through
  `0191`'s integrity class.
  - The item gets three attempts, then is PARKED.
  - It is then retried every 300 s within the person's daily attempt budget, and then from the next UTC day.
  - This repeats with no terminal state, while the Session's order waits behind it.
- In writing, the refused exchange's semantic chain is silently skipped, and the next exchange takes its positions.

`0194` removes the one known cause. The paths' response to a refusal is outside this order ("any real scope expansion
must be presented before it is implemented"). So is any repair of exchanges already lost.

**The Product Owner's decision on `QAN-BL-INTEL-05` (PO Review R1, 2026-11-04).** It stays separate from INTEL-04. It
needs a decision and handling **before the live analysis launches**: silently losing a message's analysis, or a PARK that
persists because of a final refusal, is not acceptable launch behaviour. It is not started.

**Read and left unchanged:** `QAN-BL-VOICE-01` … `05`, `07`, `08`, `09`, `QAN-BL-MOB-01`, `QAN-BL-MOB-02`,
`QAN-BL-PROD-06` / `08` (`0189` – `0194` not hosted), `QAN-BL-VIS-01`.

## 11. Deliberately not done (not authorized by the order)

- No merge.
- No hosted migration.
- No paid AI call.
- No Voice Gate opened.
- No map redesign and no graphics change.
- No change to `0070` or to any other lifecycle rule.
- No rebuild of the Thread Lifecycle engine.
- No backfill, rewrite or automatic reprocessing.
- No change to how the worker classifies refusals (`QAN-BL-INTEL-05`).

