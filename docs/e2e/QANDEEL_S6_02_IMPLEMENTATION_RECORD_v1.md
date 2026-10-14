# QANDEEL — S6-02 Implementation Record v1 (WORK IN PROGRESS)

**Task:** S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary  
**Stage:** 6 — Matching & Introductions  
**Product authority:** Product Owner approved Task Contract v1.2 and expressly authorized implementation subject to CP0–CP4. No merge or deployment without another explicit PO approval.  
**Status:** ACTIVE — CP0 initial repository truth recorded; implementation and validation NOT DONE.  
**Base:** `main` / merged PR #339 at `2224c47f3dc83b16ad011ccbbdcf2aac19bf41f5`.  
**Branch:** `s6/s6-02-introduction-privacy-end-boundary`.

## 1. Binding decisions

- **A:** On a `MUTUAL_MATCH`-born World, a person's approved Introduction first name stays the display name across SUCCESS. Never substitute `users.name`. Showing full account name as display name requires its owner's separate, explicit authorization; this new disclosure authoring experience remains S6-06.
- **A1 / D3:** After SUCCESS, forbid both ADD_MEMBER and REJOIN_MEMBER (including an original participant), in all relevant proposal / approval / acceptance paths. Ordinary Standard Worlds are unchanged.
- **D1:** Expose exactly one authenticated, ungated, human-derived unilateral END boundary over frozen `commit_introduction_end_v1`, with the narrow `NO_BACKDOOR` allowlist amendment. The six 0149-suspended Matching setup commands remain closed.
- **D2:** Build the one recipient-scoped `presented_first_name` projection in S6-02. If provenance/recipient/current authority is unproven, return `NULL` (the approved mobile “someone” fallback). S6-03 owns wiring 0154's confirmed first name into 0111's canonical resolver; S6-05 consumes the S6-02 projection.
- **D4:** Stage 4 reading AND sending/model-response paths refuse Introduction worlds; leave 0118's Introduction-capable ordinary-material cores frozen for the future specialized S6-05 producer.
- **D5:** Replay excludes pre- or at-SUCCESS material of a `MUTUAL_MATCH` World, or all its material if SUCCESS never happened. Derive from the canonical event and history-item occurrence times without new Replay phase columns.
- Additional PO clarifications: protect every `author_name`, including self-authored model turns; fence `0141` `actor_name` and `subject_name`; 0150 belongs to Data API stale-state semantics; do not introduce a new direct caller of the 0119 history-visibility resolver; record S6-03's first-name-source obligation in canonical Backlog at BG-08 closure without opening an additional task.

## 2. CP0 — initial repository truth (read only)

1. GitHub `main` matches base SHA and PR #339 is merged; historical root locator text incorrectly still says S6-01 is not merged and needs a dated closure reconciliation.
2. `database/migrations/0155_*.sql` is not present at this base; number **candidate**, not irrevocably assigned.
3. `shared_worlds.birth_basis` is the canonical origin fact (0075), not a new `origin` column.
4. `0111_matching_candidate_evaluation_disclosure_gate_v1.sql` resolves the canonical first name as `UNRESOLVED_NO_CANONICAL_SOURCE` today. `0154_matching_onboarding_preparation_v1.sql` stores independently confirmed first-name facts, not yet wired to 0111.
5. `0113_matching_mutual_match_introduction_persistence_v1.sql` defines `matching_match_handoff_subjects`: `presented_first_name` is NOT NULL for a valid handoff; rows are keyed by package + subject and audience. `0114_matching_mutual_match_commit_transaction_v1.sql` copies the approved `subject_first_name` from each recipient view, binding package, Match commit, Introduction record, World, subject and the exact `presented_to_user_id` audience. A projection MUST verify all bindings; do not read draft 0154 fields or fallback to account Name.
6. `0138_shared_world_reachability_invitation_birth_v1.sql` lists active-world members using `users.name`. `0139_shared_world_conversation_material_v1.sql` lists human author names from `users.name` and exposes Stage 4 send. `0141_shared_activity_notifications_v1.sql` derives actor and subject names from account identities. `0140_shared_world_lifecycle_governance_product_v1.sql` has Standard-phase membership proposal/approval/acceptance paths that become reachable after SUCCESS. `0148_shared_semantic_field_living_analysis_v1.sql` has Shared semantic reader exposure to assess.
7. API `apps/api/src/shared-world/shared-world-conversation.service.ts` passes `row.author_name` for both sides into model-context turns. `shared-conversation-model-input.ts` formats non-QANDEEL turns as `authorName ?? 'A participant'`. The protected database projection must apply to self and counterpart, not just UI display.
8. Mobile `apps/mobile/src/shared-world/SharedWorldThread.tsx` uses `material.authorName ?? copy.someone`; previously approved Shared copy includes a null-name neutral placeholder. Confirm the remaining surfaces with their existing focused tests; no new mobile UI or Copy Gate is planned.
9. `0116_introduction_terminal_lifecycle_v1.sql` already provides atomic unilateral END and same-World SUCCESS with one terminal winner. END requires authenticated `auth.uid()` and two participation event identities; do not expose the frozen core directly or manufacture consent.
10. `database/verify-migration-0149.mjs` `NO_BACKDOOR` transitively discovers every function reaching Matching setup writes, then compares the executable set with exactly four allowed human commands; new END wrapper must be an exact named narrow addition, retaining all negative security assertions.
11. `database/verify-migration-0115.mjs` pins the **exact** list of `public.resolve_shared_world_history_visibility_v1` callers. Replay's source proof must not add another direct caller without explicit approved controlled change.
12. `0101_replay_authorized_draft_runtime_v1.sql` captures Shared source/history occurrence time in Replay manifests and computes later currency. `0100` deliberately excludes phase/birth_basis from Replay's own persisted object model. Revalidate acquisition, currency and distribution paths under 0101–0107 and later forward overrides, fail closed on ambiguity.
13. `docs/qandeel-canonical-backlog-v1.md` already assigns `QAN-BL-MATCH-02` to S6-02; the S6-03 name-source linkage appears in the WP0 roadmap sketch but is not an independent canonical backlog item. Apply BG-05/06/08 on closing change, after collision/duplicate census. Do not admit an item merely for being out of scope.
14. No real Introduction World is currently reachable under the frozen / ungated prelaunch Matching posture. Test Introduction-origin situations with owner-set fixtures rolled back, never production grants.

## 3. Remaining CP0 checks BEFORE production edits

- Read full controlling frozen authority and any later controlled amendments. Identify any explicit conflict with privacy projection, full-name consent or membership constraints. Stop for PO decision on genuine conflict.
- Enumerate exact `0138–0141/0148` SQL signatures, ACLs, normal/Introduction predicates, output column contracts and `Object.keys` tests; choose minimally sufficient forward `CREATE OR REPLACE` targets and expected regression evidence.
- Audit all reachable Standard post-SUCCESS name sinks, including root World/member lists, materials, settings proposals, Activity, semantic field sources, closed views and deleted-own-material paths; avoid speculative rewrites of unreachable or already gated functions.
- Map Replay capture, source-currentness, render/finalization/distribution and any relevant later version overrides; confirm no additional caller violates 0115's exact consumer list; verify same-timestamp exclusion and race safety.
- Design one authenticated END wrapper using stable event identities derived from command ID and each lower/higher slot, with server-only actor and bounded safe response classes. Preserve the canonical DB lock order, historical permissions and idempotency.
- Confirm exact task-related tests and PostgREST proof footprint; run only focused mandatory tests when code exists. No test has yet been run as part of this checkpoint.

## 4. Approved work packages and hold points

- **CP1 / WP1:** forward-only SQL privacy/name/membership fence. Prove frozen cores unchanged and ordinary Standard regression absent.
- **CP2 / WP2:** API/model/Activity/Direct Entry and Replay protection. Preserve history and owner erasure semantics.
- **CP3 / WP3:** safe END wrapper, route and narrowly amended 0149 NO_BACKDOOR verification. Prove real PostgreSQL races and PostgREST boundary.
- **CP4 / WP4:** focused real-DB/API/static tests; independent security review; dated append-only governance and Backlog reconciliation; one PR prepared for PO decision.

**No merge; no deployment; no opening the six suspended Matching commands; no launch-gate change; no unauthorized frozen-contract edit.** If CP0 finds a material frozen conflict or scope expansion, stop and report it, rather than silently reinterpret the approved contract.

## 5. Verification ledger (current)

- `main` SHA and merged PR #339: **read-only verified**.
- Migration 0155 availability at base SHA: **read-only verified**.
- Source/permission review described above: **initial read-only spot checks only**.
- PostgreSQL tests: **NOT RUN**.
- PostgREST wire proof: **NOT RUN**.
- API/unit/static/CI tests: **NOT RUN**.
- Production code/migrations: **NOT CHANGED**.
- Pull request: **NOT OPENED**.
