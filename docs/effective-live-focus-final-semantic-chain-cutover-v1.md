# Effective Live Focus + Final Semantic-Chain Cutover v1 (T-03D)

**Task:** T-03D — Effective Live Focus + FINAL Same-SP Semantic Chain + Production Authority Cutover (ONE Architecture-sized task).
**Migration:** `database/migrations/0071_effective_live_focus_final_semantic_chain_cutover_v1.sql`.
**Runtime:** `apps/api/src/live-focus/` (the FINAL post-finalization establishment), `packages/runtime/src/live-focus.d.ts` (the wire), `apps/mobile/src/temporal/live-focus-sync.ts` (passive client ingestion).
**Gates:** `npm run test:effective-live-focus-final-semantic-chain-cutover-contract` (static, secret-free), `npm run verify:effective-live-focus-final-semantic-chain-cutover:integration` (real PostgreSQL, API CI), the Jest suites under `apps/api/src/live-focus/` and `apps/mobile/src/temporal/__tests__/live-focus-sync.test.ts`, and `database/tests/effective-live-focus-final-semantic-chain-cutover-v1.test.mjs`.

T-03D closes the semantic chain that stayed production-inert through T-03B1, T-03B2 and T-03B3, and it is the ONE authorized activation act:

```
committed CU / Session Position
  -> B1 reference + conversational focus + Emerging Focus            [same-SP seq 1]
  -> the FINAL Thread layer (0068 + 0070)                             [seq 2, at most one]
  -> effective Live Focus (LF)                                        [seq 2 or 3, at most one]
  -> durable LF transition history + technical LF capture
  -> authoritative LF snapshot / catch-up delivery + passive client ingestion
  -> the FINAL B1 + B2 + B3 + LF runtime is the ONE application mutation authority
  -> the temporary T-03A2-only live writer is retired; no temporal-only fallback remains
```

## 1. The Live Focus constitution (frozen Stage 6.5 v3, SDM-04, LF-01 .. LF-04)

**LF = the Session's CURRENT LIVE CONVERSATIONAL ATTENTION ONLY.** Its domain is closed:

```
LF = NONE | EMERGING(emerging_focus_id) | THREAD(thread_id)
```

Only an Emerging Focus and an Established Thread may be direct LF values. LF is **not** importance, rank, confidence, analytical strength, centrality, permanent priority, the Inspected Focus, the latest Map click, the current viewport, or an explicit user-owned Context Activation. Map navigation never changes LF. LF changes passively when committed conversation changes attention, and never because of elapsed time.

| Rule | Meaning |
| --- | --- |
| LF-01 | A committed CU that starts an independent focus makes that focus (or, if the same Moment binds it to a Thread, that Thread) the effective LF. |
| LF-02 | A committed CU that attends the current focus, a Mention inside a reported claim, a brief interruption, and a **local clarification** leave LF unchanged. |
| LF-03 | A committed CU that starts or attends another independent focus replaces LF; attending a Thread already bound in the Session returns LF to that Thread. Same-Moment Emerging → Thread promotion makes the effective LF the Thread at that same SP. |
| LF-04 | **Conservative departure:** LF becomes NONE only for a CU with NO independent focus whose canonical B1 functions include `FOCUS_SHIFT`, whose attention reason is not `LOCAL_CLARIFICATION_OR_CORRECTION`, whose canonical `target_cu_id` (if any) does not anchor the CU back to the prior LF (an EMERGING prior is anchored by a target CU attending that focus; a THREAD prior by a target CU attending a focus bound to that Thread), **and — R1-01, the B3 → D same-Moment closure — whose prior THREAD (if the prior is a Thread) is DORMANT under the frozen B3 lifecycle after this same CU's Thread-layer truth.** A departure is only as stable as the frozen lifecycle says: an ACTIVE or REOPENED Thread keeps the LF, so the chain can never state "stably departed Thread T" and "Thread T remains ACTIVE" for the same Moment. An EMERGING prior has no lifecycle and departs. Nothing else — one quiet CU, one interruption, one clarification, background analysis, or time — ever clears LF. |

The transition reasons are exactly five and each is tied to its shape by CHECK: `NEW_INDEPENDENT_FOCUS` (from NONE), `THREAD_PROMOTION` (EMERGING(focus) → THREAD bound to that same focus), `RETURN_TO_THREAD` (to a pre-existing Thread), `FOCUS_REPLACEMENT` (to another Emerging Focus, or to a Thread established at this CU), `STABLE_DEPARTURE_NO_REPLACEMENT` (to NONE).

## 2. Architecture Decisions

**D-01 — Deterministic LF reducer, NO provider.** Effective LF is a pure function of the canonical B1 bundle of the CU, its FINAL Thread-layer unit result, the prior effective LF, the durable canonical B1 history needed for target closure, and the Session focus → Thread bindings visible to the CU. The TypeScript reducer (`live-focus-reducer.ts`) and the SQL reducer (`derive_conversation_effective_live_focus_v1`) are mirrors; the database **re-derives** the effective LF of every CU from durable rows and refuses any payload that differs (`LIVE_FOCUS_NOT_CANONICAL`). No model, no timestamp, no Map / inspection / camera state, no analytical object, no confidence, no similarity, no Home coordinate, no Thread importance and no future CU participates. No LF model, prompt, schema or provider exists.

**D-02 — Same-SP placement (frozen).** B1 = seq 1; the whole Thread layer = at most one seq 2; an LF transition = seq 2 when no Thread-layer event exists at the CU and seq 3 when the Thread layer used seq 2; an **unchanged LF reserves NO sequence**. The FINAL per-Moment writer derives LF **after** the FINAL Thread-layer truth of the same CU and before the next CU advances the clock, so the LF of CU *i* is part of the prior LF of CU *i+1* and a sealed SP is never reopened or backdated. The 0065 seam `reserve_session_same_sp_event_v1` is the ONE sequence authority (called exactly three times per CU at most).

**D-03 — Technical LF capture beside the durable history.** `conversation_live_focus_transitions` holds one append-only row per **change** of LF at its exact (SP, sequence): `from_kind/from_ref`, `to_kind/to_ref`, `reason_code`, and a deterministic RFC 4122 v5 identity. `conversation_live_focus_commit_batches` holds one row per committed-CU batch (unit count, transition count, DB-derived fingerprint, reducer version) so that "LF evaluated and unchanged for every CU" and "LF never evaluated" stay distinguishable forever. The capture carries NO SP and NO same-SP sequence: it is capture metadata, not a Timeline object. Neither table can carry a label, a name, a Home coordinate, a direction, a relation count, a confidence, an importance, committed text, a timeline position or a K(TC) projection.

**D-04 — ONE completeness authority, reused.** `conversation_full_semantic_batch_state_v1` REUSES the 0070 B3 authority (which reuses 0068's) for the commitment, B1, B2 and B3 layers and adds the LF layer: `ABSENT` (every layer absent), `COMPLETE` (B3 COMPLETE, the LF capture present with the batch's own counts, and for every CU the DB-re-derived effective LF agrees with the stored transition history — existence, SP, sequence, from / to / reason, identity, and a real same-Session Emerging Focus or same-user Thread), `PARTIAL` (anything else, including legacy T-03A2-only, B1-only, B2-only, B3-only-without-LF, and every corruption). PARTIAL is never upgraded, repaired, replayed or backfilled from today's inference.

**D-05 — The cutover is all-or-nothing and lives in one section.** After migration 0071: `service_role` executes exactly ONE committing function (`commit_finalized_exchange_with_full_semantic_chain_v1`), its two reads, and the 0070 dossier page the FINAL runtime screens; `authenticated` executes exactly the two owner-scoped LF delivery reads beside the two T-03A2 delivery reads; the temporary T-03A2 producer and exchange coordinator are **revoked** from `service_role`; every predecessor integrated writer / coordinator (0066, 0068, 0070) and this migration's own per-batch writer stay executable by NO application role; the same-SP seam stays internal. There is no temporal-only fallback writer: no application path can seal an SP without B1, the Thread layer and LF.

**D-06 — Additive wire, passive client, frozen kernel.** The shared wire gains `LiveFocusWireValue` (`NONE | EMERGING{emergingFocusId} | THREAD{threadId}`), `liveFocus` + `liveFocusAtSp` on the Session snapshot, and the passive domain event `LIVE_FOCUS_TRANSITION { sessionId, atSp, value }`. The T-03A2 `ConversationTemporalDelivery` keeps exactly its two frozen fields; the FINAL service returns the additive `ConversationLiveDelivery` subtype. On the client, `live-focus-sync.ts` is the ONE seam from the wire event to the T-02 mirror (`EMERGING → EMERGING_FOCUS`, `THREAD → ESTABLISHED_THREAD`) through the same `ingest()` path; it never writes `LF` directly, never dispatches a Product action, never appends RH, never moves the camera, never creates a persistent focus-follow, and never touches `LH`, `TM`, `TC`, `IF_ref` or `MC` — also while the client is historically pinned. The kernel is not redesigned.

**D-07 — Bounded recovery, no third stale authority.** The FINAL runtime keeps the frozen recovery of T-03B1b2 / T-03B3: after any evaluation or commit failure it re-reads the FINAL snapshots first (a canonical winner is returned as is; partial or legacy history fails closed); only the two exact typed stale conditions — the Session Semantic Clock token and the user/world Thread identity version — earn ONE shared semantic re-evaluation against a re-read context and re-read dossiers; segmentation is never repeated; a generic 40001 never qualifies. LF adds no third optimistic authority: the current LF is read under the same Session clock token, and that token moves with every SP.

**D-08 — Conservative departure is DB-enforced.** The four LF-04 exclusions (anchored shift, local clarification, no `FOCUS_SHIFT`, and — R1-01 — a prior Thread the frozen lifecycle leaves ACTIVE / REOPENED) are proven by the database for every payload, not merely by the client: a payload that clears LF for an anchored shift, a clarification, or an ACTIVE Thread is `LIVE_FOCUS_NOT_CANONICAL`, and the readiness audit additionally refuses any stored Thread departure the lifecycle contradicts (`LIVE_FOCUS_DEPARTURE_LIFECYCLE_CONTRADICTION`).

**D-09 — R1-01: B3 → D same-Moment lifecycle / Live-Focus closure.** The frozen B3 reducer never makes a Thread DORMANT at a `NO_INDEPENDENT_FOCUS` CU (such a CU is never "away"), while the original LF-04 could clear a Thread LF at exactly such a CU — a contradictory canonical Moment (`LF: THREAD(T) → NONE, STABLE_DEPARTURE_NO_REPLACEMENT` beside `T = ACTIVE`). The closure binds the departure to the lifecycle: the TypeScript reducer receives the prior Thread's lifecycle state after the same CU's Thread-layer transitions (`priorThreadLifecycleState`, computed from the frozen B3 walk), the SQL reducer reads `conversation_thread_session_lifecycle_state_v1(prior_ref, session, sp + 1)`, and both admit `THREAD(T) → NONE` only when that state is `DORMANT`. Deterministic, same-Moment, database-authoritative (re-derived by the completeness authority and the audit), idempotent and replay-safe; 0064–0070 untouched.

## 3. Migration 0071

| Section | Contents |
| --- | --- |
| 0 | Preconditions: UTF-8, the 0065 seam, the 0066 B1 persist path, the 0068 B2 gates, the 0070 B3 gates, writer and reads, the T-03A2 producer / coordinator (for retirement). |
| 1–3 | `conversation_live_focus_transitions` (kinds, shape, change, reason, reason-shape and position CHECKs; one per CU, one per SP; FK to the committed Moment), `conversation_live_focus_commit_batches` (FK to the 0070 capture), the ONE immutability trigger (`CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE`). |
| 4 | `canonical_live_focus_transition_id_v1`: uuidV5(`14cd67f4-be9d-54f6-b735-cbe38a7cb311`, `session:cu:kind:ref|NONE`), namespace derived from `https://qandeel.app/runtime/live-focus-transition/v1` through the frozen 0068 v5 authority. |
| 5 | `conversation_session_live_focus_before_v1` / `conversation_session_current_live_focus_v1`: the current LF is the latest transition by canonical (SP, sequence), never by timestamp; no transition yet → NONE. |
| 6 | `derive_conversation_effective_live_focus_v1` (D-01). |
| 7 | `validate_conversation_live_focus_decision_v1` (exactly six keys, exact re-derivation, derived identity) and `persist_conversation_live_focus_transition_v1` (seq 2 or 3, never reserves). |
| 8 | `conversation_full_semantic_batch_state_v1` (D-04). |
| 9 | `commit_conversation_units_with_full_semantic_chain_v1` (34 parameters = the 0070 writer + `p_live_focus_units`, `p_lf_reducer_version`): a NEW batch runs the whole per-Moment loop itself under AF66-01 (Session clock FIRST → source turn → B1 → identity clock → spatial authority → Thread-layer rows → LF); replay delegates the CU / B1 / B2 / B3 layers to the frozen 0070 writer with zero mutation and then requires the LF capture identity byte-for-byte (`LIVE_FOCUS_BATCH_PAYLOAD_CONFLICT`). |
| 10 | `commit_finalized_exchange_with_full_semantic_chain_v1` (44 parameters): the 0070 shape plus both LF payloads, the LF provenance and the LF delivery facts (`live_focus_kind/ref/sp`, `live_focus_transitions`). |
| 11 | `get_conversation_full_semantic_integrated_batch_snapshot_v1` and `get_conversation_full_semantic_runtime_context_v1`: the 0070 reads by delegation plus the LF facts; the context fails closed (`INCOMPLETE_PRIOR_SEMANTIC_HISTORY` / `PRIOR_BATCH_NOT_FULL_CHAIN_COMPLETE`) on any prior batch that is not full-chain COMPLETE. |
| 12 | The authenticated LF delivery: `get_session_live_state_v1(session)` → (session, LH, LF kind / ref / effective SP) and `get_live_focus_transition_events_v1(session, after_sp, limit)` → (session, SP, to kind / ref); ownership from `auth.uid()`; no sequence, label, Home, content or projection. |
| 13 | `assert_conversation_full_semantic_chain_cutover_ready_v1()`: fails closed on any batch not full-chain COMPLETE, any orphan transition, or any non-contiguous Session LF chain. STABLE, mutates nothing. |
| 14 | Ownership, `search_path` hardening, RLS, and THE CUTOVER (D-05). |
| 15 | Terminal self-assertions: nothing backfilled, append-only, no label / Home / content / score column, the capture carries no SP, function posture, reuse of 0066 / 0068 / 0070, exactly one committing function for `service_role`, the authenticated reads, the frozen namespace and vectors, the Session Semantic Clock unchanged. |

Migrations 0064–0070 are byte-identical. The migration applies WITHOUT the audit passing: the audit is the explicit deployment blocker of application activation against a database that holds legacy canonical batches.

## 4. The FINAL runtime (`apps/api/src/live-focus/`)

| Module | Role |
| --- | --- |
| `live-focus.types.ts` | The closed LF domain, the five reasons, the reducer version, `LiveFocusReductionInput` / `LiveFocusReduction`, `LiveFocusRejectedError`. |
| `live-focus-reducer.ts` | `reduceLiveFocus` — the pure D-01 reducer (mirror of section 6). |
| `durable-live-focus-payload.types.ts` / `durable-live-focus-canonicalizer.ts` | The exact 0071 payload (`unit_id`, `effective_kind`, `effective_ref`, `transition`, `reason_code`, `transition_event_id`) and its deterministic identity. |
| `conversation-semantic-runtime.types.ts` / `-mapper.ts` / `.repository.ts` | Strict mapping of the two 0071 reads and the coordinator row (exact keys, no LF before the first SP, never beyond the token, a THREAD LF must be bound in the Session, an EMERGING LF must be a known focus); the repository calls exactly the two 0071 reads, the 0070 dossier page and the ONE 0071 coordinator, and reuses both exact typed stale predicates. |
| `live-focus-wire.ts` | The wire value and the `LIVE_FOCUS_TRANSITION` event from a stored transition. |
| `conversation-semantic-establishment.service.ts` | The FINAL post-finalization phase: relation gate → FINAL snapshots (replay / partial gate) → ONE context → segmentation → sequential B1 → ONE B1 canonicalization → per CU the frozen T-03B3 Thread-layer walk THEN the LF reduction → ONE Thread, ONE Thread-layer and ONE LF canonicalization → ONE coordinator commit against both tokens → the additive live delivery, proven coherent before it leaves. |

`ConversationService` calls the FINAL service on every orchestrated path (new turn, idempotency replay, unique-violation replay); `ConversationModule` registers it with the four lazy binding factories (segmentation, focus, Thread, continuity) and the service-role repository. The T-03A2 `ConversationTemporalEstablishmentService` and `ConversationUnitRepository` are no longer registered; the temporal controller keeps its two T-03A2 reads (now served by `get_session_live_state_v1` for the snapshot) and gains `GET /conversation/sessions/:sessionId/temporal/live-focus-events`.

## 5. Verification

- **Static contract** — `tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs`: the migration shape and cutover posture, the runtime directory, the deterministic reducer with no provider, the same-SP rule, the wire and mobile ingestion shape, the frozen predecessor pins, the anti-scope (no T-03C, no Return-to-Live-Focus, no visual UI, no new dependency), and the CI wiring.
- **Database contract** — `database/tests/effective-live-focus-final-semantic-chain-cutover-v1.test.mjs`: the migration text, section order, CHECKs, reuse, the cutover grants / revocations, the self-assertions and the verifier's proof surface.
- **Real-PostgreSQL verifier** — `database/verify-migration-0071.mjs` (API CI, after the 0070 verifier): the cutover posture live; every LF rule (LF-01 .. LF-04, promotion, Emerging-only LF, return, replacement, departure and its three exclusions); seq 2 / seq 3 / no reservation; the DB re-derivation for every CU; every forced value, invented / hidden transition, authored reason or identity refused; both stale tokens; exact replay; legacy / B1 / B2 / B3-only and corrupt shapes; atomic rollback; append-only truth; the owner-scoped delivery reads.
- **Jest** — `apps/api/src/live-focus/*.spec.ts` (reducer cases 1–22, canonicalizer 23–32, mappers 33–44, repository 45–49, wire 50–51, service 52–79) and `apps/mobile/src/temporal/__tests__/live-focus-sync.test.ts`.

## 6. Re-anchors (mechanical, never semantic)

The older real-PostgreSQL verifiers (0065–0070) asserted the temporary T-03A2 `service_role` grants "unchanged"; after the cutover they assert the retirement and that the T-03A2 snapshot read stays live (the 0070 verifier additionally expects `service_role` to execute the dossier page the FINAL runtime screens). The older static contracts that assumed "0070 is the newest", "the B1 / B2 / B3 runtimes are not wired", "no LF on the wire" or "no live-focus directory" now assert that ONLY the FINAL chain is wired and that each superseded runtime stays unregistered and uncalled. No semantic assertion was weakened.

## 7. Anti-scope

No T-03C historical projection, knowledge frontier or PRE_FIRST_SP. No Return-to-Live-Focus, no Go Live + Locate, no focus-follow. No LF label, Home, direction, relation count, confidence, importance, content or spatial hint on the wire or in the database. No visual UI, no mobile shell change, no kernel change. No new dependency, no lockfile change. No Thread merge, no Home relocation, no rewrite of any 0064–0070 object.
