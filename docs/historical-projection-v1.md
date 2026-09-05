# Historical Coverage Completion + Layer A Projection + Layer B Disclosure v1 (T-03C)

**Task:** T-03C — Historical Coverage Completion + Layer A Projection + Layer B Disclosure (ONE Architecture-sized task).
**Migration:** `database/migrations/0072_historical_coverage_projection_disclosure_v1.sql`.
**Runtime:** `apps/api/src/historical-projection/` (the owner-scoped Layer-A read seam and the pure Layer-B disclosure), `apps/api/src/conversation/conversation-historical-projection.controller.ts` (the ONE authenticated historical read), `packages/runtime/src/historical-projection.d.ts` (the wire, `V`), `apps/mobile/src/projection/` (the passive typed client seam).
**Gates:** `npm run test:historical-projection-contract` (static, secret-free), `npm run verify:historical-projection:integration` (real PostgreSQL, API CI), the Jest suites under `apps/api/src/historical-projection/` and `apps/mobile/src/projection/__tests__/`, and `database/tests/historical-projection-v1.test.mjs`.

T-03C completes the frozen Stage 6 temporal constitution for every v1 exposed family and delivers the two layers the constitution names:

```
K(TC) = TemporalProject(W, TC)                       Layer A - the database, owner-scoped, typed per family
V     = Disclose(K(TC), semanticDepth, inspectionContext)   Layer B - the server, pure, depth-monotonic
```

with the availability law every family obeys:

```
known(e, Session S, TC) := (e anchored in S at SP <= TC)  OR  (world_version(e) <= baseline(S))
```

## 1. The historical constitution (frozen Stage 6.5 v3 / 6.6 v3, REV66-06 .. REV66-08, R-C1 .. R-C5)

| Rule | Meaning |
| --- | --- |
| ONE COMMITTED CU = ONE MOMENT | `SP` is the gapless per-Session ordinal of a committed CU; `LH` the greatest committed `SP`; `TC` the effective selected Session Position, `1 <= TC <= LH`. |
| SP-native availability (R-C4) | Every exposed component of a Session's history receives its own `PRE_FIRST_SP \| SP(n)` anchor through the Session Semantic Clock and the ONE 0065 same-SP seam, or through the Session's baseline. A timestamp is never an anchor. |
| Actual availability, never causal source | A fact is anchored at the Session Position at which it became canonical in that Session, never at the Moment that "caused" it. |
| Server-owned Session association | The durable post-response execution (owner, Session, source turn) is the ONE association. A caller-supplied `session_id` is not authority. A fact without a server-owned association is UNASSOCIATED: it carries a world version only, is never untracked, never receives a fabricated anchor, and enters a later Session only through that Session's baseline (REV66-06 §4.5). |
| Coverage (R-C1) | Every Session that existed before 0072 is a LEGACY UNCOVERED SESSION: no Session Position can ever be committed into it, no baseline exists, no anchored event exists, and the projection fails closed. A Session created after 0072 is COVERED at creation. A Session is never partially historical. |
| Baseline / PRE_FIRST_SP | `baseline(S)` is the per-user World Semantic Clock version read under its row lock at the commit of `SP(1)`. Everything unassociated with `world_version <= baseline(S)` is known at every `TC` of `S` (`PRE_FIRST_SP`); everything later never enters `S`. There is no race gap with `SP(1)`. |
| Preservation (R-C2) | No canonical Reading, Material, Question candidate or Confidence row can be deleted; no identity, provenance or lineage column can be rewritten in place; only the lifecycle columns move. No history row is ever updated or deleted; the world clock never regresses. |
| Tracked attach paths (R-C3) | Every write to `public.hypotheses` — whatever its path (0005, 0008, 0021, 0028, the managed commands) — passes the ONE capture hook; no untracked Evidence participation can be authored. |
| Expiry (R-C5) | `expires_at` is a wall-clock policy fact. It is never compared to `TC`; it is mapped into Session Position space (`NO_EXPIRY \| PRE_FIRST_SP \| SP(n) \| PENDING \| NOT_IN_SESSION`) with half-open intervals `t(n) <= X < t(n+1)`; an exact tie is EXPIRED at `n`. Expiry never advances `LH`, never moves `TC`, never writes `RH`, never erases identity or lineage. |
| Three absences kept apart | Historically unavailable (`UNKNOWN_AT_TC`, `CONTEXT_UNAVAILABLE_AT_TC`) ≠ known but noncurrent (`KNOWN_NONCURRENT_AT_TC`: `PREVALID` / `SUPERSEDED`) ≠ withheld at this depth (`AVAILABLE_BUT_DEPTH_WITHHELD`) ≠ not fetched (client, Class B). A technical gap fails closed (Z66-05) and is never `UNKNOWN_AT_TC`. |
| No kernel write, no RH | `K(TC)`, `V`, `IF_render`, divergence and the footprint have no key in the T-02 `CanonicalState`; no Product action and no `RH` entry is ever produced by a projection. There is no generic `WORLD_TRUTH_UPDATED` event. |

## 2. Architecture decisions

**D-01 — A per-user World Semantic Clock.** `historical_world_semantic_clocks(user_id, current_version)` advances by exactly one per capture context, under its row lock. It orders unassociated facts for baselines; it is never a Session Position and never appears on the wire as a temporal authority.

**D-02 — Coverage decided at creation; the CU gate; the SP(1) baseline.** The migration decides every existing Session `LEGACY_UNCOVERED`; an `AFTER INSERT` hook on `conversation_sessions` decides every new Session `COVERED`. A `BEFORE INSERT` hook on `conversation_units` refuses `HISTORICAL_COVERAGE_UNAVAILABLE` for anything else, so an uncovered Session can never gain a Session Position. An `AFTER INSERT` hook cuts `session_historical_baselines` at `session_position = 1` from the world clock read `FOR UPDATE` (the lock is held to commit, so the cut is exact) and anchors the Formal Question ↔ Turn appearance of the exchange at that exchange's first committed Moment (D-07).

**D-03 — ONE capture boundary, clock-first (AF66-01).** `historical_capture_begin_v1(user, session | null, require)` establishes a transaction-local context `{ user, requested session, associated session | null, SP | null, same-SP sequence | null, world version }`: Session Semantic Clock `FOR UPDATE` → the ONE 0065 seam `reserve_session_same_sp_event_v1` (only while an addressable `SP` exists) → World Semantic Clock `FOR UPDATE`, `+1`. One context per (user, requested Session association) per transaction. Every capture hook reads the newest context of the writing user through `historical_capture_context_v1`; a write without one is UNASSOCIATED and receives a world-only context — never an untracked write, never a fabricated anchor. No caller can supply an `SP`, a sequence or a world version. A Session of another user is `HISTORICAL_CAPTURE_ASSOCIATION_INTEGRITY`.

**D-04 — The durable execution is the association; wrappers, not rewrites.** The three managed commands keep their public names, signatures, results and `service_role` grants: their frozen 0034 / 0035 / 0036 bodies live on under `*_core` (executable by NO application role) and the public names are wrappers that call `historical_capture_begin_for_execution_v1(p_execution_id)` (owner + Session from `post_response_intelligence_executions`) and then the core. `sync_post_response_information_gaps_v1` keeps its name and its v2 delegation with the same first step. `server_create_memory_for_execution_v1(p_source_turn_id, …)` derives owner AND Session from the RUNNING execution that owns the source turn with `MEMORY_WRITE` claimed, then runs the frozen 0026 command; the TypeScript background Memory writer calls it instead of naming a user id. Every existing caller and every historical verifier enters the boundary unchanged.

**D-05 — Typed per-family history with deterministic identities.** Eight append-only event tables (`historical_reading_events` with `CREATED / STATUS_TRANSITION / VERSION_ADVANCED`, `historical_evidence_participation_events` `ATTACHED / DETACHED`, `historical_reading_relation_events` `LINKED / UNLINKED` over one unordered pair, `historical_material_events`, `historical_gap_events` `CREATED / CLOSED / REOPENED` by epoch, `historical_question_events`, `historical_confidence_events`, `historical_question_appearance_events`) plus `historical_thread_availability`, each row carrying the ONE anchor shape `(session_id, session_position, same_sp_event_sequence, world_version)`. Identities are RFC 4122 v5 through the frozen 0068 authority over `79466f6b-04fd-5150-aa23-59682098057c` = uuidV5(URL, `https://qandeel.app/runtime/historical-availability-event/v1`); an identity reused with a different payload is `HISTORICAL_EVENT_IDENTITY_CONFLICT`, an identical retry duplicates nothing. The migration seeds a `LEGACY_BASELINE` event (world version 0, no Session anchor) for every pre-existing canonical row and writes nothing else.

**D-06 — The Thread ↔ Reading appearance substrate.** `thread_reading_bindings(binding_id, session, thread, reading, bound_sp, unbound_sp, …)` with `bind_reading_to_thread_v1` / `unbind_reading_from_thread_v1`: clock-first through the boundary (association REQUIRED), identity uuidV5(`11be3a36-745a-54fd-a938-3f14eaedee14` = uuidV5(URL, `https://qandeel.app/runtime/thread-reading-binding/v1`), `session:thread:reading:boundSp`), idempotent, unbound by ordinal, one life per Session Position (`THREAD_READING_BINDING_IDENTITY_CONFLICT`). The writers are granted to NO application role: the Product evaluator that decides WHEN a Reading is bound to a Thread is owned by no merged task; T-03C owns the truthful history of the appearance and its projection. This is the one gap the canonical repository revealed against the Stage 6.6 v3 matrix (A-1 names a `thread_reading_bindings` equivalent that did not exist); it is filled as substrate, not invented as Product semantics.

**D-07 — The Formal Question ↔ Turn appearance anchors at the exchange's first committed Moment.** A binding becomes `BOUND` at `finalize_conversation_turn_v2`, before the exchange's CUs are committed; anchoring it at finalization would need a Session Position that does not exist yet or a lock taken out of AF66-01 order. The appearance is therefore captured by the SP(1) hook of D-02 at the first committed CU of the same exchange (user or assistant turn), at same-SP sequence 0, identity `question-appearance:<binding_id>`. `SELECTED` is a transient reservation and `RELEASED` a non-appearance; neither is exposed.

**D-08 — R-C5 as ONE STABLE mapping.** `historical_memory_expiry_at_sp_v1(session, expires_at)` with `t(k) = max(created_at of committed CUs with sp <= k)`: `NO_EXPIRY`; `PRE_FIRST_SP` when `X < t(1)`; `SP(n)` when `t(n) <= X < t(n+1)` (an exact tie is EXPIRED at `n`); `SP(LH)` when `t(LH) <= X <= now` and the Session is open; `NOT_IN_SESSION` when the Session closed before `X`; `PENDING` when `X` is in the future. The projection consumes the mapping and marks a Material `EXPIRED` at `TC` iff the mapped `SP <= TC` (or `PRE_FIRST_SP`); identity and lineage stay known. The projection itself reads no timestamp.

**D-09 — Preservation by guard.** `guard_historical_canonical_row_preservation_v1` refuses `DELETE` (`CANONICAL_HISTORICAL_ROW_IS_PRESERVED`) and any rewrite outside the lifecycle columns (`CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE`: Reading `status / version / updated_at / supporting_evidence_ids / contradicting_evidence_ids / competing_hypothesis_ids`; Material `status / updated_at`; otherwise `updated_at`). Every history table is append-only (`CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE`); the world clock is `WORLD_SEMANTIC_CLOCK_IS_PERMANENT / MONOTONIC`.

**D-10 — R-C3 by capture, not by breaking live callers.** `attach_hypothesis_evidence` (0005), `apply_hypothesis_evidence_update` (0008) and `background_attach_hypothesis_evidence_v1` (0021 / 0028) are live production callers (the authenticated Hypothesis endpoint and the background data API). They keep their object identity and grants; every write they make to `public.hypotheses` passes the ONE capture hook and authors exactly one TRACKED participation event — unassociated (world-only) because they carry no server-owned Session association — so the old bypass can no longer author untracked Evidence participation, and no fabricated Session anchor exists. The verifier proves it per path.

**D-11 — Layer A: ONE owner-scoped, coverage-gated, fail-closed projection.** `get_session_historical_projection_v1(session, tc)` (STABLE SECURITY DEFINER, `auth.uid()`): `FORBIDDEN` for a Session the caller does not own; `HISTORICAL_COVERAGE_UNAVAILABLE` for a LEGACY UNCOVERED SESSION; `LIVE_HEAD_NOT_ESTABLISHED` before `SP(1)`; `SESSION_POSITION_NOT_ADDRESSABLE` outside `[1, LH]`; `HISTORICAL_BASELINE_MISSING` for corruption. Every family is projected by its own anchor under the ONE availability law; then-current status / version / epoch is the latest known event; relations, participations, Confidence and appearances require BOTH endpoints known; Thread lifecycle at `TC` comes from the durable 0070 history, `LF` at `TC` from the durable 0071 history, the ONE Home from `conversation_thread_homes`; Confidence resolves `CURRENT / SUPERSEDED / PREVALID` against the then-current version (Z66-04). No current mutable row is ever a historical fallback. The result is byte-stable for a sealed `TC` and evolves only at the open head.

**D-12 — Layer B: pure server disclosure over the five frozen rungs.** `disclose(K, depth, inspection)` discloses exactly the rungs at or below `depth` (WORLD: Threads + LF; THREAD: + Thread ↔ Reading appearances; SESSION: + Moments, Emerging Focuses, Formal Question ↔ Turn appearances; ANALYTICAL_OBJECT: + Readings, relations, Materials, Gaps, Questions, Confidence; SOURCE_PROVENANCE: + Evidence participations); a rung above is `DEPTH_WITHHELD`, never empty. Reading discloses at the analytical-object rung, never a depth of its own. An inspection is answered along three orthogonal axes: knowledge (`UNKNOWN_AT_TC`, `KNOWN_AND_CURRENT_AT_TC`, `KNOWN_NONCURRENT_AT_TC` with `PREVALID` / `SUPERSEDED`), context (`NOT_REQUESTED`, `CONTEXT_AVAILABLE_AT_TC`, `CONTEXT_UNAVAILABLE_AT_TC`) and disclosure (`AVAILABLE_AND_RENDERABLE`, `AVAILABLE_BUT_DEPTH_WITHHELD` with the required depth). Threads carry `ESTABLISHED_ACTIVE / ESTABLISHED_DORMANT / ESTABLISHED_REOPENED / ESTABLISHED_UNBOUND_IN_SESSION`; Emerging Focuses `EMERGING_PREGEOGRAPHIC`. `K(TC)` never leaves the server.

**D-13 — Additive wire, passive client, frozen kernel.** `packages/runtime/src/historical-projection.d.ts` declares `V` (typed per rung, `HistoricalRung<T>`, no timestamp, no same-SP sequence, no score, no label, a Home as exact integer text). `apps/mobile/src/projection/` validates it at runtime (exact keys, depth-monotonic rungs, `SP <= TC <= LH`, closed vocabularies), fetches it through ONE injected-fetch route bound to the requested Session / TC / depth, and holds it as Class B with `NOT_FETCHED` ≠ `FETCHED` (with `UNKNOWN_AT_TC` / `DEPTH_WITHHELD` inside) ≠ `UNAVAILABLE` (the typed refusal). Nothing writes the T-02 kernel, dispatches a Product action, appends `RH`, moves the camera or is mounted. The kernel, the shell, the router root and the T-03A2 / T-03D temporal seam are byte-identical.

## 3. Migration 0072

| Section | Contents |
| --- | --- |
| 0 | Preconditions: UTF-8, the 0065 seam, the 0068 v5 authority, the 0070 lifecycle read, the 0071 LF read, the four managed commands, the v2 synchronization authority, the 0026 Memory command, the attach paths, the FINAL coordinator, every canonical table. |
| 1 | `historical_world_semantic_clocks` + `guard_historical_world_semantic_clock_v1` (`+1` only, never deleted). |
| 2 | `session_historical_coverage` (every existing Session `LEGACY_UNCOVERED`), `session_historical_baselines`, `provision_session_historical_coverage_v1` (new Sessions `COVERED`). |
| 3 | `historical_thread_availability`. |
| 4 | The eight typed event tables with the ONE anchor shape and their CHECK constraints. |
| 5 | `thread_reading_bindings` + `guard_thread_reading_binding_mutation_v1` (only the unbind transition). |
| 6 | `reject_historical_projection_mutation_v1` on every history table. |
| 7 | `historical_event_identity_v1`, the capture boundary (`historical_capture_begin_v1`, `historical_capture_context_v1`, `historical_capture_begin_for_execution_v1`). |
| 8 | `historical_event_identity_conflict_v1`, the capture hooks (Reading incl. participations and relations, Material, Gap, Question, Confidence, Thread availability), the CU coverage gate, the SP(1) baseline / appearance hook, the preservation guard. |
| 9 | Legacy `LEGACY_BASELINE` seeding (world version 0, no anchor). |
| 10 | `CREATE TRIGGER` statements. |
| 11 | The wrappers (three managed commands renamed to `*_core` and re-created under their public names; `sync_post_response_information_gaps_v1` re-created; `server_create_memory_for_execution_v1`). |
| 12 | `bind_reading_to_thread_v1` / `unbind_reading_from_thread_v1`. |
| 13 | R-C5: `historical_session_position_wall_time_v1`, `historical_memory_expiry_at_sp_v1`. |
| 14 | Layer A: `get_session_historical_projection_v1`. |
| 15 | Ownership, RLS, THE AUTHORITY POSTURE (one `authenticated` grant, five `service_role` grants, cores and boundary revoked, no table privilege). |
| 16 | Terminal self-assertions (coverage decided, legacy baselines complete, nothing fabricated, namespaces and the identity vector re-derive, read-only by declaration, tables unreachable, the posture exact, the ONE Reading capture hook enabled, the Session Semantic Clock unchanged). |

## 4. The Stage 6.6 v3 matrix, reconciled after the build — 31 FULL AFTER BUILD / 4 NOT EXPOSED / 0 BLOCKER

Availability anchor: the Session Position at which the fact became canonical in the Session (through the execution association), or `PRE_FIRST_SP` through the baseline. Validity at TC: what the projection resolves from the latest known event.

| Row | Family / component | Availability anchor (SP-native) | Validity at TC | Delivered by | Status |
| --- | --- | --- | --- | --- | --- |
| C1 | Committed CU — identity, source turn, role, ordinal | its own `SP` (the clock assigns it at commit) | immutable | `moments` (SESSION rung) | FULL AFTER BUILD |
| C2 | Committed CU — surface text + source span | its own `SP` | immutable | `moments` | FULL AFTER BUILD |
| C3 | Committed CU — `SP` (audit time never exposed) | its own `SP` | immutable | `moments` | FULL AFTER BUILD |
| E1 | Emerging Focus — identity | `started_sp` (0066) | immutable | `emergingFocuses` | FULL AFTER BUILD |
| E2 | Emerging Focus — attention evidence | per attention event `SP` (0066) | `lastAttentionSp <= TC`, no timer | `emergingFocuses` | FULL AFTER BUILD |
| E3 | Emerging Focus — current attention status | derived from E2 `<= TC` | derived | `emergingFocuses`, `world.liveFocus` | FULL AFTER BUILD |
| E4 | Emerging Focus — promotion lineage | establishing `SP` of the Thread | `promotedThreadId` only once known | `emergingFocuses` | FULL AFTER BUILD |
| T1 | Thread — identity, TE path, grounding focus | `established_sp` (0068) in this Session, or world availability `<= baseline` | immutable | `world.threads` | FULL AFTER BUILD |
| T2 | Thread — the ONE Home | same transaction as T1 | immutable, exact integer text | `world.threads[].home` | FULL AFTER BUILD |
| T3 | Thread — Session-local lifecycle | `SP` per lifecycle transition (0070) | state before `TC + 1` | `world.threads[].state` | FULL AFTER BUILD |
| A-1 | Appearance — Thread ↔ Reading | own `bound_sp` (0072 substrate) | `bound_sp <= TC < unbound_sp` → `current` | `thread.threadReadingAppearances` | FULL AFTER BUILD |
| L1 | Live Focus — value | `SP` per transition (0071) | greatest transition `SP <= TC` | `world.liveFocus` | FULL AFTER BUILD |
| L2 | Live Focus — effective Session Position | `SP` per transition (0071) | same | `world.liveFocus.atSp` | FULL AFTER BUILD |
| R1 | Reading — `statement` | `CREATED` event (`reading-created:<id>`) | immutable, preserved | `analyticalObject.readings` | FULL AFTER BUILD |
| R2 | Reading — `type`, `domain`, `scope`, `origin` | same creation event | immutable, preserved | `readings` | FULL AFTER BUILD |
| R3 | Reading — `assumptions` | same creation event | immutable, preserved | `readings` | FULL AFTER BUILD |
| R4 | Reading — `disconfirming_conditions` | same creation event | immutable, preserved | `readings` | FULL AFTER BUILD |
| R5 | Reading — `status` / lifecycle | `STATUS_TRANSITION` / `VERSION_ADVANCED` events | latest known event `<= TC` (`statusAtTc`, `versionAtTc`) | `readings` | FULL AFTER BUILD |
| R6 | Reading — Evidence participation (A-2, Material ↔ Reading appearance) | `ATTACHED` / `DETACHED` events from the ONE capture hook | latest known kind, both endpoints known | `sourceProvenance.evidenceParticipations` | FULL AFTER BUILD |
| R7 | Reading — peer / competing relations | `LINKED` / `UNLINKED` events over one unordered pair | latest known kind, both endpoints known | `analyticalObject.readingRelations` | FULL AFTER BUILD |
| R8 | Reading — provenance / lineage | anchor of the carrying event | known lineage `<= TC`, never current | `readings[].lineage` | FULL AFTER BUILD |
| M1 | Material — `content`, `type`, `source`, `confidence`, `importance` | `CREATED` event (`material-created:<id>`) | immutable, preserved | `analyticalObject.materials` | FULL AFTER BUILD |
| M2 | Material — `status` (`→SUPERSEDED`, `→DELETED`) | `STATUS_TRANSITION` events | latest known event `<= TC` | `materials[].statusAtTc` | FULL AFTER BUILD |
| M3 | Material — expiry validity | R-C5 mapping `ExpiryAtSP(session, expires_at)` | `EXPIRED` iff mapped `SP <= TC` or `PRE_FIRST_SP`; exact tie EXPIRED | `materials[].statusAtTc`, `materials[].expiry` | FULL AFTER BUILD |
| M4 | Material — supersession lineage | creation event of the successor | lineage only when both are known | `materials[].supersedes… / supersededBy…` | FULL AFTER BUILD |
| U1 | Unknown / Gap — static fields | `CREATED` event (`gap-created:<id>`) | immutable (0063 guard) | `analyticalObject.gaps` | FULL AFTER BUILD |
| U2 | Unknown / Gap — `status`, `closure_reason`, `open_epoch` | `CLOSED` / `REOPENED` events by epoch | latest known event `<= TC` | `gaps[].statusAtTc / openEpochAtTc / closureReasonAtTc` | FULL AFTER BUILD |
| A-3 | Appearance — Unknown ↔ Reading | same creation event as U1 (one transaction, one anchor) | related Readings filtered to those known | `gaps[].readingIds` | FULL AFTER BUILD |
| Q1 | Question candidate — all fields | `CREATED` event (`question-created:<id>`) | immutable (zero `UPDATE` statements exist) | `analyticalObject.questions` | FULL AFTER BUILD |
| A-4 | Appearance — Formal Question ↔ Turn | first committed Moment of the binding's exchange (D-07) | terminal `BOUND` only; `SELECTED` / `RELEASED` never appear | `session.questionAppearances` | FULL AFTER BUILD |
| F1 | Confidence — evaluation, `target_version`, snapshots | `CREATED` event (`confidence-created:<id>`), independent of the target Reading | `CURRENT / SUPERSEDED / PREVALID` against the then-current version | `analyticalObject.confidences` | FULL AFTER BUILD |
| H1 | HIM — measurement / snapshot / trend | — | — | — | NOT EXPOSED |
| H2 | HIM — session context bindings | — | — | — | NOT EXPOSED |
| N1 | Numeric confidence value / band | — | forced `NULL` by CHECK | — | NOT EXPOSED |
| N2 | Question `expected_information_gain` / `question_utility` | — | forced `NULL` by CHECK | — | NOT EXPOSED |

Totals: 31 FULL AFTER BUILD / 4 NOT EXPOSED / 0 BLOCKER.

## 5. Release conditions

- **R-C1 — LEGACY UNCOVERED SESSION never partially historical.** Every pre-existing Session is decided `LEGACY_UNCOVERED` at migration time; the CU gate refuses any Session Position into it; no baseline and no anchored event ever exist for it; the projection refuses `HISTORICAL_COVERAGE_UNAVAILABLE` (never `UNKNOWN_AT_TC`). A Session without a coverage decision fails the same way. New Sessions are `COVERED` at creation. Proven by verifier stage B.
- **R-C2 — Preservation.** No canonical Reading / Material / Question / Confidence row deletable; identity, provenance and lineage columns immutable in place; every history row append-only; the world clock monotonic and permanent. Proven by verifier stage I; the pre-0072 verifier fixtures that reshaped canonical rows now do so only as the postgres fixture owner in replica mode (0004, 0026, 0028, 0035), exactly as the fixture cleanup helper does.
- **R-C3 — Tracked attach paths.** Every legacy Evidence-attach path authors exactly one tracked participation event and no untracked one; an unassociated attach never receives a fabricated Session anchor and is never that Session's knowledge. Proven by verifier stage I per path (0005, 0008, 0021 / 0028).
- **R-C4 — SP-native availability.** Every exposed component is anchored through the Session Semantic Clock and the ONE 0065 seam, or through the SP(1) baseline; no timestamp is an anchor; the projection reads no timestamp. Proven statically and by verifier stages D–H.
- **R-C5 — Expiry mapped into SP space.** `historical_memory_expiry_at_sp_v1` maps `expires_at` into `NO_EXPIRY / PRE_FIRST_SP / SP(n) / PENDING / NOT_IN_SESSION` with half-open intervals and an exact tie EXPIRED at `n`; a Material known `ACTIVE` at `TC = n-1` is `EXPIRED` from `TC = n` once `SP(n)` seals, with identity and lineage intact; the mapping writes nothing. Proven by verifier stage G.

## 6. Adversarial proofs (verify-migration-0072, real PostgreSQL)

| Proof | Stage | What is proven |
| --- | --- | --- |
| P66-A | D, E, F, H | Every exposed family is `UNKNOWN_AT_TC` before its own anchor and known from it on: Threads (SP3 unknown at TC = 1), Readings / relations / Confidence created at SP5 unknown at TC = 4, Gaps / Questions at SP5 unknown at TC = 4, appearances before their bound / appeared SP, a generated Reading at SP7 unknown at TC = 6. |
| P66-B | D, E, F | Then-current status / version / epoch at `TC`: a Thread `ACTIVE` at TC = 2 and `DORMANT` from TC = 3; a Gap `OPEN` at TC = 6 and `RESOLVED` at TC = 7; a Reading's `versionAtTc` follows its known `VERSION_ADVANCED` / `STATUS_TRANSITION` events. |
| P66-C | D | An unassociated fact written after Session 1's baseline never enters Session 1 and enters a later Session at its SP(1) through its own baseline; Threads of Session 1 are inherited through world availability with no Session-local lifecycle there. |
| P66-D | F | The Formal Question ↔ Turn appearance is anchored at the first committed Moment of its exchange (SP6, sequence 0), unknown at TC = 5. |
| P66-E | K | Concurrent associated writes serialize on the Session Semantic Clock (AF66-01); a committing exchange cannot advance the clock under a held association; the write is anchored at the SP it observed. |
| P66-F | E, J | `K(SP3)` and `K(SP4)` are identical before and after every later commit, analytical write and expiry; the open head evolves with an associated write while `LH` does not move. |
| P66-G / P66-H | G | A Material expiring inside `SP(4)` is `ACTIVE` at TC = 3 and `EXPIRED` from TC = 4; a Material expiring exactly at `t(4)` is `EXPIRED` at TC = 4 (tie), `ACTIVE` at TC = 3; identity and lineage stay known; the mapping covers `NO_EXPIRY / PRE_FIRST_SP / SP / open head / PENDING / NOT_IN_SESSION`. |
| Z66-03 | G | A successor Material created at SP7 is unknown at TC = 6 although its predecessor (its lineage anchor) is known; forward lineage appears only once both are known. |
| Z66-04 | E | Confidence resolves `SUPERSEDED` (earlier version), `CURRENT` (latest known evaluation of the then-current version) and `PREVALID` (a version the Session does not know because its advance was unassociated). |
| Z66-05 | B, I | A LEGACY UNCOVERED SESSION, a Session without a coverage decision, a Session before SP(1), an unaddressable TC and a missing baseline all fail closed with typed codes; none is `UNKNOWN_AT_TC`. |
| Spoofing | I | No application role reaches the boundary or a history table; a Session of another user is `HISTORICAL_CAPTURE_ASSOCIATION_INTEGRITY`; no caller supplies an SP, a sequence or a world version; a foreign owner cannot project the Session (`FORBIDDEN` → not visible). |
| Identity | I | An identical retry duplicates nothing; the same identity with a different payload is `HISTORICAL_EVENT_IDENTITY_CONFLICT`; the namespaces and the pinned vector re-derive in TypeScript and SQL. |
| Wrappers | H | The three managed commands and the synchronization entry anchor through the execution's Session; a durable retry duplicates no history; the cores are `permission denied` for `service_role`; the Memory command refuses without a claimed `MEMORY_WRITE` execution. |

## 7. Delivery

- **API:** `GET /conversation/sessions/:sessionId/historical-projection?tc=&depth=[&inspectFamily=&inspectId=&inspectVersion=&appearanceKind=&appearanceBindingId=]` → `HistoricalDisclosure`. Refusals: `409 { code: HISTORICAL_COVERAGE_UNAVAILABLE | LIVE_HEAD_NOT_ESTABLISHED | HISTORICAL_BASELINE_MISSING }`, `400 { code: SESSION_POSITION_NOT_ADDRESSABLE }`, `404` for a Session the caller cannot see. The repository reads the ONE RPC through the AUTHENTICATED channel and classifies the database's typed refusals through the opaque upstream identity, exactly as the B1b2 / B3 repositories read their stale tokens.
- **Wire:** `@qandeel/runtime` `historical-projection.d.ts`, re-exported additively from the index; the T-03A2 / T-03D wire files are byte-identical.
- **Client seam:** `apps/mobile/src/projection/` — `decodeHistoricalDisclosure`, `decodeUnavailableBody`, `HistoricalProjectionApiClient`, `HistoricalDisclosureCache`. Passive, typed, unmounted.

## 8. Executor decisions beyond the task text (recorded, not Product semantics)

1. A-1 needed a `thread_reading_bindings` equivalent that the canonical repository did not carry; T-03C ships the substrate and writers granted to no application role (D-06). The evaluator that decides binding is a later task.
2. A-4 anchors at the exchange's first committed Moment (D-07) rather than at finalization, because no Session Position exists at finalization and the clock must be taken first.
3. R-C3 is enforced by the ONE capture hook rather than by revoking the live 0005 / 0008 / 0021 callers (D-10); the verifier proves the tracking per path.
4. Unassociated writes (an authenticated client mutation, a background write outside an execution) are world-only by the frozen REV66-06 §4.5 rule; they enter later Sessions through their baselines and are never the current Session's knowledge.
5. `VERSION_ADVANCED` Reading events (a version bump without a status change: an attach, a peer link) exist so `versionAtTc` is exact and a known Confidence is never mistaken for `PREVALID`.
6. The projection's `revision` (`liveHead`, `worldVersion`, `pendingExpiries`) is a cache input for the open head only; the internal same-SP sequence never crosses the wire.

## 9. Anti-scope (unchanged by T-03C)

No Return-to-Live-Focus, no Go Live + Locate (T-07); no Map geometry, Timeline window, viewport or camera (T-04 / T-08); no visual UI; no HIM history (H1 / H2 NOT EXPOSED); no numeric confidence or question utility (N1 / N2 NOT EXPOSED); no generic `WORLD_TRUTH_UPDATED`; no wall-clock comparison to `TC`; no `K(TC)` / `V` in the T-02 kernel; no `RH` from a projection; no new dependency; no lockfile change; migrations 0001–0071 byte-identical; the Session Semantic Clock unchanged; the mobile CI classifier untouched (the mobile source change runs the native smoke gates by the frozen MOB-CI-01 rule).
