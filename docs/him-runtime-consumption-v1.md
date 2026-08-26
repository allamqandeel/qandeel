# HIM Runtime Consumption v1

Phase: Phase II — Intelligence Runtime Completion
Forward migration: `database/migrations/0037_background_him_runtime_consumption_v1.sql`
Real PostgreSQL verifier: `database/verify-migration-0037.mjs` (`verify:background-him-runtime-consumption:integration`)

## Architectural position

The authenticated foreground TEXT conversation path already carried a frozen
HIM consumption chain before this task: claimed USER turn → canonical HIM Turn
Context Selection → HIM Intelligence Snapshot → HIM Reasoning Consumption →
HIM FAST/DEEP Projection → `ModelRouterRequest.himContext` → normal ModelRouter
provider call. That Foundation behavior is preserved semantically unchanged;
this task does NOT add a second foreground integration and does not move
foreground HIM into the post-response path. Foreground and background are two
consumers of the same canonical HIM truth.

What was missing was the background boundary: the post-response intelligence
runtime executes under `BackgroundIntelligenceExecutionContext` with
service-role database authority and zero user bearer token, and the only
canonical snapshot read, `read_him_intelligence_snapshot_v1(text,text)`,
derived ownership from `auth.uid()` — authenticated-only. The background
runtime must never reconstruct a user JWT, set fake request claims, or call
the authenticated function with service-role credentials. Controlled
Hypothesis Generation therefore received no HIM structured state.

## Shared database snapshot core

Migration 0037 introduces `read_him_intelligence_snapshot_core_v1(p_user_id
uuid, p_context_kind text, p_context_id text)`: the EXACT migration-0018
source-row semantics (context ownership, frozen slot matrix, active
binding/model/calibration integrity, latest-event/observation/correction/
currentness selection, row shape and order, and failure behavior for
unsupported, unowned, and integrity-broken contexts) with one change only —
the owner is an explicit trusted parameter and `auth.uid()` is never called.
It is `SECURITY DEFINER`, `STABLE`, `search_path`-hardened, fully qualified,
persists nothing, and is internal-only: EXECUTE is revoked from `PUBLIC`,
`anon`, `authenticated`, and `service_role`; only the owner/definer chain can
reach it.

### Authenticated wrapper parity

`read_him_intelligence_snapshot_v1(text,text)` is `CREATE OR REPLACE`d as a
narrow wrapper: derive the user from `auth.uid()`, reject missing auth, and
delegate to the core. Signature, application-visible behavior, errors, and
grants (authenticated-only) are unchanged, so the foreground HIM runtime is
semantically untouched. One SQL core prevents semantic drift between the two
authorities.

### Session-only background wrapper

`background_read_him_conversation_snapshot_v1(p_user_id uuid, p_session_id
uuid)` is the ONE background read authority: it rejects null identity, calls
the shared core with exactly `CONVERSATION_SESSION` and `p_session_id::text`
(canonical session-owner verification included), uses no `auth.uid()`, no
request JWT, sets no claims, persists nothing, and is executable by
`service_role` only. No generic background SITUATION / DECISION / GOAL
snapshot authority exists.

## Shared TypeScript canonicalization

The source-row → canonical `HimIntelligenceSnapshot` projection moved
unchanged into one shared pure boundary,
`projectHimIntelligenceSnapshot(...)` in
`apps/api/src/human-model/him-intelligence-snapshot.projector.ts` (same
`HIM_SNAPSHOT_SLOTS`, integrity checks, unassessed reasons, ordinal mapping,
provenance-chain checks, FULL/PARTIAL/EMPTY calculation). The foreground
`HimIntelligenceSnapshotService.getSnapshot(...)` keeps its public behavior
and delegates; the background path uses the SAME projector — no second
canonicalizer exists. The background canonical snapshot is then transformed by
the existing `HimReasoningConsumptionService`; no second reasoning mapper
exists either.

## Minimized provider-facing HIM state

`HimHypothesisGenerationContext` (`contractVersion: 1`, `source:
'HIM_STRUCTURED_STATE'`, `contextKind: 'CONVERSATION_SESSION'`) carries
exactly three metric entries in canonical order — `hse.stress` → `hse.energy`
→ `hse.attention` — each only `{metricKey, knowledgeState, ordinalCategory}`.
KNOWN carries exactly one canonical ordinal category (`VERY_LOW` … `VERY_HIGH`,
latest-known within the snapshot contract, not guaranteed current); UNKNOWN
carries `null` and must remain unknown. It contains NO user/session UUID, no
timestamps, no freshness or confidence claim (both remain UNASSESSED and are
simply not claimed), no numeric storage value, no instrument/scale/model/
binding/calculation/provenance identifiers, no trends, no composites, no
readiness, no diagnosis or personality. A valid EMPTY snapshot is not a
failure: it becomes three explicit UNKNOWN entries.

The internal `HypothesisGenerationRequest` gained an optional `himContext`
field (optional only to preserve frozen callers/tests); the production
background generation path supplies it for every fresh Candidate Generator
call. The Gemini candidate adapter serializes only the minimized fields inside
the existing untrusted `hypothesis_generation_data` envelope, keeps all
prompt-injection escaping, adds advisory model guidance (structured state, not
Evidence, not proof; UNKNOWN stays unknown; no trend/diagnosis/readiness
inference; no manufactured Evidence IDs; no ranking), and the candidate output
JSON schema is unchanged.

## Fresh-path ordering and failure behavior

On the fresh generation path the dispatcher reads and projects HIM BEFORE
claiming `CANDIDATE_PROVIDER`:

- durable upstream authority → generation request READY → if
  `CANDIDATE_PROVIDER` is durably COMPLETED: recover the exact durable result
  with ZERO HIM read and ZERO provider replay;
- otherwise: read canonical HIM → project canonically → build the minimized
  context → only then claim `CANDIDATE_PROVIDER` → exactly one existing
  Candidate Generator call (now with `himContext`) → validate → durable
  completion.

A HIM read/integrity/database failure therefore can never strand
`CANDIDATE_PROVIDER` in CLAIMED before the provider was invoked. On failure
the dispatcher claims nothing, calls no provider, never fabricates
EMPTY/UNKNOWN, never silently omits HIM, and returns a non-terminal (non-ACK)
outcome so the existing bounded delivery-attempt policy retries; exhaustion
quarantines through the existing `MAX_ATTEMPTS` handling. No new durable
effect, ledger, queue, cache, or snapshot history exists.

## Durable recovery

The HIM snapshot is never persisted. Once `CANDIDATE_PROVIDER` is durably
COMPLETED its validated durable result is the recovery authority: redelivery
performs zero HIM rereads and zero provider replays, and a later HIM change
never rewrites the durable candidate plan. The QAN-AUD-06 post-persistence
Confidence resume performs zero HIM reads.

## Boundaries preserved

- HIM is not Evidence: no `EvidenceItem` or `memory:*` identity from HIM, no
  HIM identifiers in supporting/contradicting Evidence, Evidence eligibility
  unchanged, and the provider output schema cannot express a HIM-derived
  Evidence ID.
- HIM is not Confidence: no score/band/threshold, QAN-AUD-06 Confidence Batch
  and exact-version post-update Confidence unchanged.
- No lifecycle semantics: no automatic SUPPORTED/MIXED/WEAK/REJECTED/RETIRED/
  REOPENED transitions from HIM; the migration-0036 CANDIDATE → ACTIVE
  admission is untouched.
- No HIM mutation: read/consume only; measurement/calculation pipelines remain
  authoritative.
- Zero new provider calls: fresh Candidate generation remains maximum one
  call; HIM is additional structured input to that one call.

## Later roadmap boundaries

Information Gap / Question Integration and Reasoning → Recommendation
Integration remain separate planned tasks; nothing here prepares them with
speculative persistence or APIs.
