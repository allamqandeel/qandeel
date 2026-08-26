# Hypothesis Lifecycle Completion v1

Forward migration: `database/migrations/0036_hypothesis_lifecycle_completion_v1.sql`
Real PostgreSQL verifier: `database/verify-migration-0036.mjs`
(`npm run verify:hypothesis-lifecycle-completion:integration`)

This task completes the deterministic mechanics and authority of the Hypothesis
lifecycle. It invents no semantic scoring, no Confidence interpretation and no
new orchestration surface.

## 1. The canonical lifecycle graph is frozen

The status vocabulary is exactly:

`CANDIDATE`, `ACTIVE`, `SUPPORTED`, `MIXED`, `WEAK`, `REJECTED`, `RETIRED`,
`REOPENED`.

There is no `CONFIRMED` status. The transition graph is exactly:

```text
CANDIDATE -> ACTIVE

ACTIVE ->
  SUPPORTED
  MIXED
  WEAK
  REJECTED
  RETIRED

SUPPORTED ->
  MIXED
  WEAK
  REJECTED
  RETIRED

MIXED ->
  SUPPORTED
  WEAK
  REJECTED
  RETIRED

WEAK ->
  ACTIVE
  MIXED
  REJECTED
  RETIRED

REJECTED -> REOPENED
RETIRED  -> REOPENED

REOPENED -> ACTIVE
```

Self-transitions are forbidden. Migration 0036 changes neither the vocabulary
nor a single edge.

The graph is now stated in the database by one narrow, pure primitive:

```sql
public.hypothesis_lifecycle_transition_allowed_v1(from_status text, to_status text)
```

It is `IMMUTABLE PARALLEL SAFE` with a fixed empty `search_path`, reads no
table, holds no caller-controlled authority, returns a hard `false` for a NULL
or unknown status, and is executable by no application role (`PUBLIC`, `anon`,
`authenticated` and `service_role` all hold nothing). It is the single
expression of the graph inside PostgreSQL: the transition core consults it, and
the lifecycle audit's edge `CHECK` constraint reuses it rather than restating
the graph.

`canTransitionHypothesis` in
`apps/api/src/hypothesis/hypothesis-lifecycle.ts` remains the application's
early-validation mirror and is unchanged. **The database is authoritative at
mutation time.** `apps/api/src/hypothesis/hypothesis-lifecycle.spec.ts` and
`database/tests/hypothesis-lifecycle-completion-v1.test.mjs` keep the two
statements of the graph aligned for every ordered status pair, and the real
PostgreSQL verifier exercises all 64 pairs against the live database.

## 2. Lifecycle state is not Confidence

Hypothesis `status` is lifecycle state. It is **not** a numeric Confidence, a
Confidence band, a calibration state or a score, and nothing in this task
derives one from the other.

Confidence lives in `public.confidence_evaluations` and remains uncalibrated
and unscored (`numeric_score IS NULL`, `confidence_band IS NULL`,
`calibration_state = 'UNCALIBRATED'`). A Confidence evaluation records the
Hypothesis it targets and the exact version it targets; it never writes status,
and status never reads it.

## 3. Exact-version transition authority

Before this migration the operational path was
`public.transition_hypothesis(uuid,text)` (migration 0005). It locked the owned
row, checked the graph against whatever status it happened to find, bumped the
version, and wrote no audit. Two real defects followed:

1. **Last-writer-wins.** A caller that read version 4 and then raced another
   canonical mutation to version 7 still transitioned the version-7 row. The
   transition it applied was decided against a Hypothesis the caller never saw.
2. **No durable lifecycle record.** Nothing anywhere recorded that a Hypothesis
   moved between lifecycle states, when, from what, to what, or under whose
   authority.

Migration 0036 replaces that operational path with one internal atomic core and
one narrow authenticated wrapper.

### The internal core

```sql
public.transition_hypothesis_core_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_expected_version integer,
  p_status text, p_source text
) RETURNS SETOF public.hypotheses
```

`SECURITY DEFINER`, fixed empty `search_path`, owned by `postgres`, and
executable by **no** application role. Its sequence is:

1. owner-scoped `SELECT ... FOR UPDATE` on the exact `(id, user_id)` row —
   a missing or cross-user target returns zero rows and mutates nothing;
2. the exact expected version must match, or the call fails closed with the
   repository's established stale-version `SQLSTATE 40001`;
3. the canonical graph must allow `current.status -> p_status`, or the call
   fails closed with `22023`;
4. one `UPDATE` that re-asserts `version = p_expected_version` and sets
   `status`, `version + 1` and `updated_at` — and nothing else;
5. one immutable lifecycle audit `INSERT` in the **same transaction**.

There is exactly one version increment, the audit identity is generated inside
the database (`pg_catalog.gen_random_uuid()`) so no caller can choose, replay or
collide one, and an audit failure rolls the status and version mutation back
with it. This is deliberately not a generic Hypothesis mutation function: it can
change status, version and `updated_at`, and nothing else.

### The authenticated wrapper

```sql
public.transition_hypothesis_v2(
  p_hypothesis_id uuid, p_expected_version integer, p_status text
) RETURNS SETOF public.hypotheses
```

`SECURITY DEFINER`, granted to `authenticated` only. It derives the owner from
`auth.uid()` alone, forces the transition source to `AUTHENTICATED_TRANSITION`,
and calls the shared core. There is no parameter for an owner, a source, a
before/after version, an audit identifier or any audit metadata.

### Application path

`HypothesisService.transition(userId, token, id, status)` keeps its exact
external signature. Its existing owned read supplies the exact expected version:

```ts
const current = await this.getOwned(userId, token, id);
if (!canTransitionHypothesis(current.status, status)) throw new BadRequestException(...);
return this.requireResult(await this.repository.transition(token, id, current.version, status));
```

`HypothesisRepository.transition` posts to `rpc/transition_hypothesis_v2` with
exactly `{ p_hypothesis_id, p_expected_version, p_status }`. A concurrent
mutation between the owned read and the transition produces a stale-version
failure; it is **not** retried against the newer version, because the caller's
lifecycle decision was made about a Hypothesis that no longer exists in that
form.

### Legacy RPC disposition

`public.transition_hypothesis(uuid,text)` is **not dropped** — migration 0005
stays historical text and the function object survives for provenance — but
migration 0036 revokes all execution authority from `PUBLIC`, `anon`,
`authenticated` and `service_role`. It therefore cannot remain a bypass around
exact-version concurrency control or the lifecycle audit. No compatibility
wrapper re-opens it. The other migration 0005 commands
(`attach_hypothesis_evidence`, `link_competing_hypotheses`) and the
migration 0008/0032 Evidence update path are untouched.

## 4. The immutable lifecycle transition audit

```sql
public.hypothesis_lifecycle_transitions(
  id, user_id, hypothesis_id,
  before_status, after_status, before_version, after_version,
  source, created_at
)
```

It follows the existing `public.hypothesis_updates` convention from migration
0008 exactly:

* a composite owner FK to `public.hypotheses(id, user_id)`, so an audit row can
  never describe another tenant's Hypothesis;
* `CHECK (before_version > 0 AND after_version = before_version + 1)`;
* both statuses constrained to the canonical vocabulary;
* an edge `CHECK` that calls the one lifecycle policy primitive, so a stored row
  can never describe a transition the canonical graph forbids;
* a closed bounded source vocabulary:
  `AUTHENTICATED_TRANSITION` and `SYSTEM_GENERATION_ACTIVATION`;
* RLS enabled, owner-scoped `SELECT` for `authenticated`, and **no**
  `INSERT`/`UPDATE`/`DELETE` grant for any application role — `service_role`
  included. The only writer is the internal core.

The table carries durable facts only. There is no rationale column, no
transcript, no provider payload, no hidden reasoning, no chain-of-thought, no
free-text error field and no arbitrary metadata.

## 5. Generated Candidate → Active admission

A canonical `SYSTEM_GENERATED` Hypothesis persisted by
`persist_post_response_hypothesis_generation_v1` (migration 0033) previously
stayed in `CANDIDATE` indefinitely, because nothing in the canonical runtime
ever moved it.

Migration 0036 appends one deterministic phase to that same managed atomic
command. The `HYPOTHESIS_PERSISTENCE` transaction is now:

```text
create SYSTEM_GENERATED CANDIDATE
→ attach authorized Evidence
→ link generated competitors
→ CANDIDATE -> ACTIVE (per target, in durable generated-ID order)
→ complete HYPOTHESIS_PERSISTENCE
```

Details:

* every migration-0033 guarantee is preserved verbatim — the same typed effect
  result, the same durable Candidate plan as the only target authority, the same
  `create -> supporting -> contradicting -> earlier-competitor` order through
  the same narrow canonical background primitives, the same immutable first
  result;
* activation order is deterministic: it replays `created_ids`, which is the
  exact durable plan order. Target identity is never inferred or reconstructed
  from current Hypothesis rows;
* each activation reads that target's exact current version (the version the
  graph-building phase produced) and passes it to the shared core, so the
  version increments **exactly once** and exactly one
  `SYSTEM_GENERATION_ACTIVATION` audit row is written per target;
* `HYPOTHESIS_PERSISTENCE` may become typed `COMPLETED` only after every
  activation has succeeded.

**This is deterministic admission, not evidence scoring.** No Evidence count and
no Confidence value participates in it.

### Atomicity

Graph construction, activation, the lifecycle audit and the typed persistence
completion remain **one** PostgreSQL transaction. If any activation fails:

* no `HYPOTHESIS_PERSISTENCE` completion;
* no partially persisted generated graph;
* no partially `ACTIVE` generated batch;
* no surviving lifecycle audit row;
* no false success.

The effect simply stays `CLAIMED` and result-less, which is exactly the state
the existing generation atomicity/recovery mechanism (migration 0033) already
handles. No compensation logic, no second orchestration ledger, no new
post-response effect key and no lifecycle queue was added.

## 6. Confidence sees the ACTIVE version

The ordering after this task is:

```text
HYPOTHESIS_PERSISTENCE transaction
  └─ generated graph
  └─ CANDIDATE -> ACTIVE
  └─ lifecycle audit
  └─ typed persistence completion
→ CONFIDENCE_BATCH
```

QAN-AUD-06 (migration 0035) is intact and unchanged. `CONFIDENCE_BATCH` is
still a managed typed effect that initializes only from a durably `COMPLETED`
`HYPOTHESIS_PERSISTENCE` result, and it still freezes each target's version once
from the canonical post-persistence Hypothesis row. Because activation now
happens before that durable completion, the version it freezes **is** the
post-activation `ACTIVE` version.

Therefore:

* the Confidence batch initializes only after activation is durable;
* the frozen `target_version` is the exact `ACTIVE` version;
* the immutable Confidence evaluation targets that same version;
* no generated Confidence receipt can refer to the pre-activation Candidate
  version;
* QAN-AUD-06's stable evaluation identities, retry, quarantine
  (`TARGET_VERSION_DRIFT` included) and idempotency are unchanged.

There is no Confidence evaluation against a Candidate version followed by a
lifecycle transition that immediately makes that evaluation stale.

## 7. No backfill, no reinterpretation

The migration is forward-only:

* no historical `CANDIDATE` row is activated, rewritten or reinterpreted;
* no lifecycle audit history is fabricated — the audit table starts empty and
  its first row is written by the first post-upgrade transition;
* pre-0036 Hypothesis rows keep their exact status, version, Evidence,
  competitors and both timestamps;
* the reasoning/active-set contract is unchanged. `listActiveForUser` still
  reads `CANDIDATE, ACTIVE, SUPPORTED, MIXED, WEAK, REOPENED` with the same
  bounds, so legacy `CANDIDATE` rows remain readable exactly as before.

This migration changes future canonical generated lifecycle behaviour, not
historical interpretation.

## 8. No semantic Evidence or Confidence thresholds

The **only** automatic transition introduced by this task is
`SYSTEM_GENERATED CANDIDATE -> ACTIVE` inside canonical successful generation
persistence.

Explicitly **not** implemented, and explicitly out of scope:

* `2 supporting = SUPPORTED`, or any Evidence-count rule;
* numeric Confidence thresholds or band thresholds;
* automatic `SUPPORTED`, `MIXED` or `WEAK`;
* automatic `REJECTED`, `RETIRED` or `REOPENED`;
* automatic winner selection among competitors.

The Hypothesis Update Loop is **not** a lifecycle decision engine. Evidence
attachment and update change Evidence arrays, version and `updated_at` only;
they never produce a lifecycle transition. Its exact-version Evidence update,
its immutable `hypothesis_updates` audit and its post-update exact-version
Confidence contract are unchanged.

Creation semantics are unchanged too: `server_create_hypothesis_v1` still
creates every Hypothesis as `CANDIDATE` at version 1 with empty
Evidence/competitor state and database-derived timestamps. `HUMAN_REVIEWED`,
`USER_PROPOSED`, `ADMIN_CONTROLLED` and arbitrary standalone creation calls are
never automatically activated.

## 9. Future boundary

Deciding `SUPPORTED`, `MIXED`, `WEAK`, `REJECTED`, `RETIRED` or `REOPENED` is a
**semantic** judgement about Evidence and calibrated Confidence. It requires
work this task deliberately does not do: calibrated Confidence, evidence
weighting, disconfirmation assessment and competitor comparison.

Until that exists, those six transitions remain **capability only** — reachable
through the explicit, exact-version, audited
`transition_hypothesis_v2` boundary, decided outside the database, and never
inferred by a threshold. When a semantic layer is eventually added, it inherits
the mechanics built here for free: it will call the same audited core, it will
have to supply an exact expected version, and every decision it makes will be
recorded as an immutable lifecycle transition with its own bounded source.
