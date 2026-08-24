# Existing-Hypothesis Fresh-Evidence Association Authority Foundation v1

This is Phase II Track A2 A2.2a. It defines the provider-neutral semantic proposal and server-authorization boundary between the merged fresh-Evidence identity handoff and the existing Hypothesis Update contract. It stops before a production provider binding and before any Hypothesis mutation.

## Fresh Evidence and candidate authority

Preparation accepts server-owned user/token authority, the canonical current conversation session ID, and the exact `memory:<id>` produced by the current-turn WRITE handoff. `EvidenceService.listEligibleForUser` is read once to find that exact item; absence fails closed as `FRESH_EVIDENCE_NOT_ELIGIBLE`, with no substitution. Provider-facing Evidence contains only ID, kind, statement, and source.

The canonical active Hypothesis list is read once and retains repository order (`updated_at DESC, id ASC`). Candidates are restricted to owner-matching active records whose scope is exactly `CONVERSATION_SESSION:<current session UUID>`. There is no fallback to GLOBAL, another session, or any goal, decision, relationship, or situation scope, and no semantic ranking.

The projection contains at most eight complete candidates and at most 24,000 Unicode string characters across statement, type, domain, scope, assumptions, and disconfirming conditions. It preserves whole-item prefix behavior and stops at the first over-budget candidate. Each candidate contains only canonical ID/version, semantic fields, and booleans indicating whether the fresh Evidence is already supporting or contradicting; unrelated Evidence, competitors, Confidence, user/session fields, and audit/provider metadata are omitted.

## Provider-neutral proposal and server authorization

The dedicated port receives contract version, the bounded fresh Evidence item, bounded candidates, and `maxAssociationCount: 4`. It may propose only closed `{ hypothesisId, evidenceRole }` items, where role is exactly `SUPPORTING` or `CONTRADICTING`. Empty output is valid `NO_ASSOCIATION`. A deterministic fake exists for tests; there is no production adapter or provider call.

Authorization independently rejects malformed or extra fields, more than four proposals, duplicate targets, targets outside the supplied universe, already-attached Evidence, opposite-role conflicts, stale versions, scope drift, and invariant failures. Before issuing commands it performs one bounded currentness reread of the eligible Evidence universe and active Hypothesis list. This confirms the exact fresh ID remains eligible and each proposed same-session target still has the supplied canonical version. There are no per-target queries.

Successful output is a bounded list directly shaped as future `HypothesisUpdateRequest` commands: canonical hypothesis ID, current `expectedVersion`, exact server-owned fresh Evidence ID, and the validated provider-proposed role. The authority never repairs or infers a role, substitutes a target or Evidence item, or rewrites a Hypothesis.

## Zero-mutation and privacy boundary

This foundation does not invoke `HypothesisUpdateService`, attach Evidence, transition lifecycle, recalculate Confidence, create Questions or Information Gaps, mutate Memory/Evidence/HIM, call a model or normal Model Router, or add persistence, migrations, jobs, API, UI, Voice, embeddings, or cross-session behavior. No telemetry is added, so Evidence/Hypothesis IDs, text, versions, scope/session/user identity, and proposal JSON cannot enter telemetry through this foundation.

The explicit next prerequisite is a dedicated production association-provider binding. A later integration must preserve this candidate universe and final server authority before applying any authorized command.
