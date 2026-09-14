# Database

Plain PostgreSQL migrations live in `migrations/` and are applied in filename order.
The first migration defines only the authenticated conversation core required by
Qandeel's controlled text vertical slice:

- `users` maps an application user to the authentication provider's stable subject.
- `conversation_sessions` owns the user-scoped session lifecycle and channel.
- `conversation_turns` records the Orchestrator-owned lifecycle, content, and optional
  Fast/Deep processing path without model-provider fields.

UUID values are supplied by the application or authentication boundary. All server
timestamps use PostgreSQL `timestamptz`. Restrictive foreign-key deletion is
intentional: retention and safety-aware deletion must be handled explicitly rather
than silently cascading private conversation data.

Turn isolation is enforced both by a direct user foreign key and by the composite
`(session_id, user_id)` relationship to its session. A nullable idempotency key is
unique within that same session and user scope. Indexes support user session lookup
and deterministic chronological turn reads.

Migration 0002 maps new Supabase Auth identities to Qandeel users and establishes
the first RLS baseline. The Auth trigger creates `public.users.id = auth.users.id`
and preserves `auth_subject` as the textual form of that UUID. It copies no email
or profile metadata.

Authenticated users can read their own user row and can select, insert, and update
only their own sessions and turns. Ownership changes are rejected. No application
table privileges are granted to `anon`, and end-user deletion is deliberately not
part of this slice.

Migration 0004 adds the separate durable `memories` table. Rows are strictly owned
by `auth.uid()`, constrained to the frozen v1 types, sources, and lifecycle statuses,
and protected by RLS. Corrections use the atomic `supersede_memory` function to keep
the predecessor and create a versioned successor. V1 deletion uses the `DELETED`
state; authenticated users receive no physical `DELETE` privilege. See
`docs/memory-runtime-persistence.md` for the complete boundary.

## Real PostgreSQL verification

Migrations 0001 and 0002 can be intentionally applied and verified against a supplied
PostgreSQL database. Put the connection string in the ignored local `.env` file as
`DATABASE_URL`; never paste it into a command, log, screenshot, or committed file.
For Supabase, use the direct connection when supported or the Session Pooler, with
the SSL behavior specified by the Supabase connection string. Do not use transaction
pool mode for this migration check.

From the repository root, run:

```sh
npm run verify:database:integration
npm run verify:memory:integration
```

Apply migration 0001 first on a clean database. The current verifier applies migration
0002 only when none of its expected objects exists and refuses partial state. It then
checks the safe Auth trigger/function definition, proves Auth provisioning with a
rolled-back `auth.users` insert, checks RLS and policy catalogs, and exercises owner,
cross-user, ownership-transfer, and anon behavior. All temporary rows are rolled back.

The memory verifier applies migration 0004 only from an absent state, then verifies
constraints, atomic supersession, expiration filtering, lifecycle deletion, and
cross-user isolation with rolled-back fixtures.

Migration 0009 adds the empty canonical HIM definition registry and append-only,
exact-context metric snapshots. Its verifier proves explicit missingness versus
numeric zero, unresolved metric confidence, definition identity/version integrity,
server-derived ownership/history, bounded same-user provenance, and RLS isolation:

```sh
npm run verify:him:integration
```

This command is an explicit integration gate and is not run by ordinary CI because
CI does not receive a development database secret. The secret-free structural test
remains available through `npm run test:database`.

Migration 0064 adds the committed Conversational Unit substrate:
`conversation_unit_commit_batches` and `conversation_units`, both owner-held,
RLS-enabled, append-only through an immutability trigger, and unreachable by
every application role. The single write path,
`commit_conversation_units_v1`, is `SECURITY DEFINER` and is granted to **no**
role, so merging T-03A1 alone cannot create a committed CU in production; T-03A2
owns the one migration that attaches SP allocation and grants EXECUTE. Canonical
source values (`user_id`, `session_id`, `source_role`, `speaker_state`,
`source_modality`, `source_content_sha256`, `committed_text`) are derived from
the locked source turn, never supplied by the caller. Spans are Unicode
code points, half-open, over `conversation_turns.content` exactly as stored, and
the source digest is `sha256(convert_to(content,'UTF8'))`. See
`docs/committed-conversational-unit-substrate-v1.md` for the complete contract.
Its verifier proves live semantics, including the forward-only source frontier
and the existing-batch replay split:

```sh
npm run verify:committed-conversational-unit-substrate:integration
```

Migration 0065 performs the one activation act T-03A1 reserved. It adds
`session_semantic_clocks` — exactly one server-owned row per Session, holding the
Session Position head (`current_sp`, `NULL` until the first committed CU, never
`0`) and an internal same-SP sequence — and a `NOT NULL session_position` on
`conversation_units` with `UNIQUE(session_id, session_position)`, so the Session
Position is born atomically with the CU and is immutable through the existing
append-only trigger. `LH` is derived from `current_sp`; there is no second
mutable head column and no sealed flag, because `SP(n)` is sealed exactly when
`n < current_sp`. Every semantic write takes the Session clock lock **before**
the source-turn lock (AF66-01). Committed-CU advancement is delivered through the
dedicated append-only `conversation_unit_commit_events`, keyed on the batch so
several valid batches per source turn stay representable;
`runtime_event_outbox` is untouched and never reused. Only then is
`commit_conversation_units_v1` granted to `service_role` — and to no other role —
together with the atomic USER → ASSISTANT coordinator
`commit_finalized_exchange_conversation_units_v1` and the service-role batch
snapshot read. The two owner-scoped temporal reads
(`get_session_temporal_state_v1`, `get_conversational_units_committed_events_v1`)
derive the owner from `auth.uid()` and are the delivery/catch-up transport for
LH, never a Timeline API. The internal same-SP sequencing seam
`reserve_session_same_sp_event_v1` is executable by no application role. See
`docs/session-semantic-clock-sp-lh-delivery-v1.md` for the complete contract. Its
verifier proves allocation, sealing, replay, the atomic exchange, the delivery
surface, the ACL matrix and the activation guard against live semantics:

```sh
npm run verify:session-semantic-clock-sp-lh-delivery:integration
```

## Real Supabase Auth smoke test

The explicit Auth smoke command signs a dedicated test user in through Supabase Auth
and exercises the application tables through Supabase's authenticated PostgREST path.
It is a local integration gate and is not part of ordinary secret-free CI.

The `qandeel-dev` project must have the Supabase Data API enabled and the intended
`public` schema exposed. Diagnose configuration and service availability without
displaying local values or response bodies before running the destructive smoke
fixture lifecycle:

```sh
npm run verify:integrations:diagnose
```

The diagnostic reports configuration missing, PostgreSQL unavailable, Supabase Auth
unavailable, and Supabase Data API unavailable as distinct safe statuses. It does not
replace either real verifier.

Create the dedicated email/password user manually in the Supabase Dashboard. Add the
following values only to the ignored root `.env` file:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_TEST_EMAIL=
SUPABASE_TEST_PASSWORD=
```

Use the project's public publishable key (or its supported legacy anon key), never a
service-role key. `DATABASE_URL` is also required solely to create and remove a
temporary cross-user fixture; every isolation assertion is made through the signed-in
client-facing request path.

Run from the repository root:

```sh
npm run verify:auth:smoke
```

The runner signs in, verifies the stable Auth UUID and canonical `public.users`
mapping, exercises permitted own-session and own-turn operations, proves a committed
cross-user fixture is hidden and cannot be mutated, signs out, and removes all smoke
rows. Its output intentionally contains no email, UUID, key, password, JWT, refresh
token, response body, or connection detail.

Fixture teardown runs as the `DATABASE_URL` fixture owner in replica mode (the same
controlled pattern the historical verifiers' fixture cleanup uses) and removes, in
order, the smoke turns, the T-03C coverage decisions and baselines of the two smoke
Sessions (migration 0072 attaches them behind `ON DELETE RESTRICT`), the Session
Semantic Clock rows, the Sessions and the cross-user user, then asserts zero residue.
No production guard is weakened and no role gains `DELETE`. The 0072 verifier
(`npm run verify:historical-projection:integration`) replays these exact teardown
statements from this file's source against real PostgreSQL, so the smoke's teardown
compatibility is proven in CI even when the live Supabase smoke cannot run.

## Connected Worlds Shared persistence foundation (migration 0075, I-02A)

Migration 0075 is the first Connected Worlds v2 persistence slice. It is additive
beside the frozen Personal conversation tables (nothing in `users`,
`conversation_sessions` or `conversation_turns` changes, and there is no generic
`worlds` table) and creates exactly two Shared-specific tables:

- `shared_worlds` — one row per born Shared World: `id`, `lifecycle`
  (`ACTIVE` | `READ_ONLY_CLOSED`), `phase` (`STANDARD` | `INTRODUCTION`),
  `birth_basis` (`ACCEPTED_INVITATION` | `MUTUAL_MATCH`), `born_at` (database
  clock) and `closed_at`. Checks encode only frozen truths: `ACTIVE` ⇔ `closed_at`
  null, a direct-invitation World is always `STANDARD`, and a World cannot close
  before its birth. The vocabulary is in exact parity with the merged I-01A kernel.
  There is deliberately no owner / admin / inviter column: identity is not
  participant ownership.
- `shared_world_membership_episodes` — historical, episodic membership (`id`,
  `world_id`, `user_id`, `joined_at`, `ended_at`) with `ON DELETE RESTRICT` foreign
  keys to `shared_worlds` and `users`, `ended_at >= joined_at`, and a partial unique
  index allowing at most one open episode per `(world_id, user_id)` so leave and a
  later rejoin are two rows.

Posture: both tables are RLS-enabled with **zero** policies, and `PUBLIC`, `anon`,
`authenticated` and `service_role` hold no `SELECT`, `INSERT`, `UPDATE` or `DELETE`.
No function, trigger or RPC writes or reads them, so no application caller can create
a Shared World or a membership episode, and no Shared runtime, read or write path is
activated by this migration. Membership storage is not historical-access entitlement;
authorized birth, lifecycle, membership and read boundaries arrive only with later
authority / Shared runtime contracts. The migration ends with self-assertions that
refuse to deploy a reachable, policy-bearing or owner-column-bearing substrate.

The secret-free structural contract runs under `npm run test:database`. The real
PostgreSQL verifier proves the catalog, ACL matrix, policy absence, every check and
FK rejection, open-episode uniqueness and the rejoin shape with rolled-back fixtures:

```sh
npm run verify:connected-worlds-shared-persistence:integration
```

## Shared Standing Context Grant persistence foundation (migration 0076, I-02B)

Migration 0076 persists the one Product-approved private-context exception: a
participant may explicitly allow QANDEEL to use that participant's private
`MY_WORLD` context for reasoning inside one exact Shared World (CW2-02 §16-§19,
CW2-03 §39-§40). It is additive on top of 0075 (nothing in `shared_worlds`,
`shared_world_membership_episodes` or any Personal table changes; they are only
foreign-key parents) and creates exactly two tables:

- `shared_world_standing_context_grants` — one row per Standing Context Grant:
  `id`, `world_id` (non-null `ON DELETE RESTRICT` FK to `shared_worlds`),
  `grantor_user_id` (non-null `ON DELETE RESTRICT` FK to `users`), `status`
  (`ACTIVE` | `REVOKED`), `granted_at` (database clock) and `revoked_at`. Checks:
  `ACTIVE` ⇔ `revoked_at` null, `REVOKED` ⇔ `revoked_at` set, and `revoked_at >=
  granted_at`. A partial unique index allows at most one `ACTIVE` grant per
  `(world_id, grantor_user_id)`; revoked rows stay as history and a later
  reconfirmation / expanded-audience grant is a new row. The grant's meaning is
  fixed by table identity — source = the grantor's `MY_WORLD`, target = the exact
  `world_id`, purpose = `SHARED_REASONING`, effect = reasoning eligibility only —
  so there is deliberately no generic `scope`, `purpose`, `action`, `source`,
  `permissions` or JSON column, and no TTL column (TTL is not frozen).
- `shared_world_standing_context_grant_audience` — the explicit human audience
  ceiling of one grant: `(grant_id, audience_user_id)` primary key with `ON DELETE
  RESTRICT` FKs to the grant and to `users`. Shared membership expansion never
  expands a grant: the ceiling is explicit rows, nothing reads current membership,
  and no trigger or function auto-populates a new member. Whether an output
  audience lies inside the ceiling is I-03's effective-authority decision.

What this is not: reasoning authority is not disclosure authority
(`REASON_FROM_PRIVATE_CONTEXT` ≠ `DISCLOSE_PRIVATE_FACT`), so no column or literal
implies source copying, quoting, publication, sharing, export or provenance
disclosure. It is not Matching Context Admission (its own later capability
persistence) and not Public private Context Admission (structurally unsupported in
v1): the only possible target is an existing `shared_worlds` row. Grantor and
audience are `users` rows only; QANDEEL is never a grantor, audience member, owner
or consent principal. The CW2-02 §10 `CONSENT_EVENT_LOG` is deliberately deferred:
this slice stores only the bounded standing-grant record and its ceiling, and the
later authoritative grant / revoke command must create immutable consent events,
maintain current grant state transactionally and preserve revocation history.

Posture: both tables are RLS-enabled with **zero** policies, and `PUBLIC`, `anon`,
`authenticated` and `service_role` hold no `SELECT`, `INSERT`, `UPDATE` or `DELETE`.
No function, trigger, RPC, API path or Supabase client path reads or writes them,
so no application caller can read, create, revoke or widen a grant, and no
effective-authority evaluator or model-context builder exists yet: the tables store
grant truth before runtime authority. The migration ends with self-assertions that
refuse to deploy a reachable, policy-bearing, trigger-bearing or generic-column
substrate.

The secret-free structural contract runs under `npm run test:database`. The real
PostgreSQL verifier proves the catalog, ACL matrix, policy absence, every check and
FK rejection, one-ACTIVE-grant uniqueness, the revoke-then-reconfirm shape and the
audience ceiling with rolled-back fixtures:

```sh
npm run verify:shared-world-standing-context-grants:integration
```
## Shared Standing Context Grant resolution boundary (migration 0077, I-03B)

Migration 0077 opens the **one** server-only read path from the sealed I-02B
Standing Context Grant tables into the frozen I-03A resolution type. It creates a
single function, `resolve_shared_world_standing_context_grant_v1(p_world_id uuid,
p_grantor_user_id uuid)`, that returns `(grant_id, world_id, grantor_user_id,
status, audience_user_id)` — one row per explicit audience-ceiling human, an ACTIVE
grant with an empty ceiling being one row with a `NULL` audience (distinguishable
from "no grant"). No table, view, type, trigger, policy or extension is added and
migrations 0001–0076 are untouched.

Semantics: **ACTIVE-only current resolution** — exact World + exact grantor +
`status = 'ACTIVE'`, LEFT JOINed only to that grant's explicit audience rows.
Historical `REVOKED` rows remain history and are never chosen as "the latest
grant". Membership episodes are never read, so the ceiling is never derived from
current membership. Before a zero-row answer the function positively verifies that
the Shared World and the human exist; a noncanonical World or human raises a bounded
error (`P0002`, `NULL` input `22023`) which the API resolver maps to `UNRESOLVED`,
never to `NOT_FOUND`.

Posture: `SECURITY DEFINER`, `STABLE`, `search_path = ''`, fully qualified names,
owned by postgres. EXECUTE is revoked from `PUBLIC`, `anon` and `authenticated` and
granted to `service_role` only; no `auth.uid()` or JWT is consulted. **No direct
table privilege was opened**: after 0077, `anon`, `authenticated` and `service_role`
still hold no `SELECT`, `INSERT`, `UPDATE` or `DELETE` on either Standing Context
Grant table, and both tables keep RLS on with zero policies. The migration ends with
self-assertions that refuse a client-callable, mutable, unpinned or table-privileged
deploy. There is no client access, no grant / revoke / extend mutation and no
consent-event write: those remain a later atomic authority-command slice.

The API side is `apps/api/src/connected-worlds/authority-resolution/
standing-context-grant-resolver.service.ts`, which calls exactly this RPC over the
server-only service-role transport and maps the untrusted payload into the frozen
`StandingContextGrantResolution` (`FOUND` | `NOT_FOUND` | `UNRESOLVED`) with a
deterministic versioned SHA-256 `authoritySnapshotRef`. **I-03A remains the
decision law**: the resolver establishes current authority state; whether that state
is sufficient for a request and audience is decided only by
`evaluateStandingContextAuthority`.

The 0076 verifier's former global "no public function may touch the grant tables"
assertion was a mutable ceiling on every future function rather than a property of
migration 0076; it was removed (forward-safety correction, I-03B). Every 0076 schema,
constraint, RLS, policy-absence, direct-table-ACL, uniqueness, history and restrictive-FK
proof is unchanged, and the 0076 static contract still proves that migration 0076
itself created no function, trigger, policy or application access path.

The secret-free structural contract runs under `npm run test:database`. The real
PostgreSQL verifier proves the function catalog, the execute ACL, the still-sealed
direct table ACL, the canonical existence errors, ACTIVE-only resolution, the empty
ceiling row and revoked-history exclusion with rolled-back fixtures:

```sh
npm run verify:shared-standing-context-grant-resolution:integration
```

## Standing Context consent commands and immutable consent history (migration 0078, I-03C)

Migration 0078 gives the sealed I-02B Standing Context Grant state its **one**
legitimate mutation boundary and the immutable consent history CW2-02 section 10
requires (`CONSENT_EVENT_LOG != EFFECTIVE_GRANT_STATE`). It creates exactly one
append-only table, `shared_world_standing_context_consent_events` (`id` = the
command id, `world_id`, `grantor_user_id`, `event_type` exactly `GRANTED` |
`RECONFIRMED` | `REVOKED`, `subject_grant_id`, `prior_grant_id` for `RECONFIRMED`
only, database-owned `occurred_at`; restrictive foreign keys; no JSON, scope,
purpose, source, material or disclosure column), and exactly two authenticated
commands: `grant_shared_world_standing_context_v1(p_command_id, p_new_grant_id,
p_world_id, p_audience_user_ids, p_expected_active_grant_id DEFAULT NULL)` and
`revoke_shared_world_standing_context_v1(p_command_id, p_world_id,
p_expected_active_grant_id)`. Each returns `(consent_event_id, event_type,
grant_id, prior_grant_id, grant_status)` and nothing else. No trigger, no policy,
no view, no type, no extension; migrations 0001-0077 are untouched.

**Human self-authority.** Standing Context consent belongs to the exact human: both
commands derive the grantor from `auth.uid()` and accept no grantor, status,
purpose, source, event type, timestamp or material parameter. EXECUTE is granted to
`authenticated` only. `PUBLIC`, `anon` and **`service_role` cannot execute them**:
the server may facilitate the UX later, but possession of the service-role
credential can never forge or withdraw a human's consent. There is no server-side
"act as user" consent command; QANDEEL is not a consent principal.

**Consent events vs current grant state.** Every successful command commits exactly
one authority mutation on the I-02B grant rows and exactly one immutable consent
event in one transaction. Events are never updated or deleted; a grant only ever
moves `ACTIVE -> REVOKED`; a revoked grant is never reactivated; the historical
audience ceiling of a grant is never edited. **Reconfirm = revoke old + create
new**: `p_expected_active_grant_id` names the current grant, which becomes
`REVOKED`, and `p_new_grant_id` becomes the new `ACTIVE` grant with its own
explicit ceiling and one `RECONFIRMED` event (`subject` = new, `prior` = old). The
old grant and its ceiling rows remain history. No code derives current authority
from "a `GRANTED` event once existed": the I-03B resolver keeps reading the
`ACTIVE` row only, so it returns the new grant after grant / reconfirm and zero
rows after revoke while the history remains.

**Explicit audience ceiling.** `p_audience_user_ids` is the exact human set the
grantor approves: non-empty, no `NULL`, no duplicate (rejected, never normalized),
order without authority meaning, every human a current open member of the exact
World at commit time. The ceiling is never inferred from membership, never
auto-filled and never widened; the grantor is not required inside it, and a
bounded subset is valid. Membership expansion after commit changes nothing.

**Grant preconditions.** The World must exist and be `ACTIVE` (an Introduction-phase
Shared World is still a Shared World), and the grantor must hold one open
membership episode there. **Stale-state compare-and-swap:** `NULL` expected grant
requires no current `ACTIVE` grant; a named expected grant must still be the
current `ACTIVE` grant; anything else is `40001 STANDING_CONTEXT_STALE_STATE` and
nothing is "applied to whatever is current". Commands for one World serialize on
the `shared_worlds` row (`FOR UPDATE`).

**Revoke.** Revocation is self-owned privacy authority: it requires only that the
World exists and that the exact expected grant is the caller's own `ACTIVE` grant in
that World. It is **allowed after membership loss and after the World closed**. An
expected grant that is no longer `ACTIVE` fails stale; a grant that is not the
caller's own in that World is reported as not found, so an error never discloses
another human's consent state.

**Durable idempotency.** The consent-event primary key is the command id. An
equivalent retry (same grantor, World, command kind, grant ids and exact audience
set) returns the already committed result with no new grant, event or revocation;
a materially different command under the same id fails closed with
`23505 STANDING_CONTEXT_COMMAND_ID_CONFLICT`. There is no second idempotency table.

**Not here.** No material / provenance / disclosure authority
(`REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT`), no Matching or Public
scope, no DECLINE event or consent-request object, no TTL, no automatic revocation
on leave (I-04), no Shared messaging, EffectiveContext, model invocation,
private-context retrieval, controller, route or UI. The 0077 verifier's former
"the Standing Context relations are exactly the two I-02B tables" assertion was a
mutable ceiling on future domain evolution, not a property of migration 0077; it
was removed (forward-safety correction, I-03C) while every 0077 function, ACL,
existence, ACTIVE-only and revoked-history proof is unchanged.

The secret-free structural contract runs under `npm run test:database`. The real
PostgreSQL verifier proves the schema, both ACLs, the authenticated-only execute
path, first grant, audience subset, outsider / non-member / closed-World rejection,
reconfirm with the old ceiling untouched, stale compare-and-swap, revoke (also after
leaving and after closure), durable idempotency, the World-row race and the I-03B
resolver composition with rolled-back or removed fixtures:

```sh
npm run verify:shared-standing-context-consent-commands:integration
```
## Shared human audience snapshot resolution boundary (migration 0079, I-03D)

Migration 0079 opens the **one** server-only read path from the sealed I-02A Shared
membership persistence into the frozen I-03A `SharedHumanAudienceSnapshot`. It
creates a single function, `resolve_shared_world_human_audience_snapshot_v1(p_world_id
uuid)`, returning `(world_id, membership_episode_id, user_id)` - one row per
currently open membership episode of the exact World. No table, view, type,
trigger, policy or extension is added and migrations 0001-0078 are untouched.

Semantics: the **current Shared human audience comes only from open membership
episodes** (`world_id = p_world_id AND ended_at IS NULL`, CW2-03 section 15). Closed
historical episodes, "latest episode regardless of `ended_at`", other Worlds'
members and Standing Context grant ceilings contribute nothing; the grant ceiling is
compared **to** the audience later and **never defines the audience** (CW2-02
section 44: audience is never inferred from a UI surface or a client-supplied list).
Current membership is **not historical-material access** (CW2-02 B21): a current
member may be `FROM_JOIN_FORWARD`; nothing here reads Shared material, Sessions or
history grants. Before any answer the function positively verifies that the Shared
World exists; a nonexistent World raises a bounded error (`P0002`, `NULL` input
`22023`) that the API resolver maps to `UNRESOLVED` - never to an empty audience. A
canonical World with zero open episodes is a successful zero-row answer.

**Lifecycle authority is not decided here.** A `READ_ONLY_CLOSED` World with open
episodes resolves exactly as persisted: audience-state resolution is not permission
to start a new generation, which the later pre-model execution boundary owns. If a
later lifecycle command closes episodes, the resolver reports the resulting state.

Posture: `SECURITY DEFINER`, `STABLE`, `search_path = ''`, fully qualified names,
owned by postgres. EXECUTE is revoked from `PUBLIC`, `anon` and `authenticated` and
granted to `service_role` only; no `auth.uid()` or JWT is consulted. **The direct
membership-table ACL stays sealed**: after 0079, `anon`, `authenticated` and
`service_role` still hold no `SELECT`, `INSERT`, `UPDATE` or `DELETE` on
`shared_worlds` or `shared_world_membership_episodes`, both keep RLS on with zero
policies, and the migration ends with self-assertions that refuse a client-callable,
mutable, unpinned, lifecycle-filtering or table-privileged deploy.

The API side is `apps/api/src/connected-worlds/audience/
shared-human-audience-resolver.service.ts`, which calls exactly this RPC over the
server-only service-role transport and maps the untrusted payload into
`RESOLVED { snapshot }` (the frozen I-03A `SharedHumanAudienceSnapshot`, humans
canonically ordered), `EMPTY { snapshotRef }` or `UNRESOLVED { failure }`.
**`EMPTY` is distinct from `UNRESOLVED`**: known absence is never unknown state, and
no zero-human snapshot is manufactured. The **snapshot fingerprint binds each
`user_id` together with its current membership episode** (`sha256:` over the
versioned `world` + sorted `user@episode` pairs), so a leave followed by a rejoin
changes the snapshot even when the human set is identical again - the load-bearing
stale-state property for later delivery revalidation. Row order, clock, random
identity and secrets never enter it. The `RESOLVED` snapshot **composes directly
into I-03A** as `audienceSnapshot` without translation; the later I-03 slice
composes audience + grant resolution + the I-03A decision + candidate context into an
EffectiveContext. Nothing here invokes a model, assembles an EffectiveContext, adds a
lifecycle command, a controller or a route.

The secret-free structural contract runs under `npm run test:database`. The real
PostgreSQL verifier proves the function catalog, the execute ACL, the still-sealed
membership-table ACL, the canonical existence error, open-membership-only semantics,
lifecycle separation, leave / rejoin episode identity and zero mutation with
rolled-back fixtures:

```sh
npm run verify:shared-human-audience-snapshot-resolution:integration
```
## Shared pre-model World-state resolution boundary and EffectiveContext (migration 0080, I-03E)

Migration 0080 opens the **one** server-only read path from the sealed I-02A Shared
World row into the Shared pre-model World gate. It creates a single function,
`resolve_shared_world_pre_model_state_v1(p_world_id uuid)`, returning exactly
`(world_id, lifecycle, phase)` - one row for the exact canonical World. No table,
view, type, trigger, policy or extension is added and migrations 0001-0079 are
untouched. **No lifecycle mutation exists**: the function returns lifecycle and phase,
it never sets them, and no I-04 lifecycle command is invented.

Semantics: before any answer the function positively verifies that the Shared World
exists; a nonexistent World raises a bounded error (`P0002`, `NULL` input `22023`)
that the API resolver maps to `UNRESOLVED / CONTRADICTORY_CANONICAL_STATE` - never to
a closed World, never to an empty answer, never to `NOT_FOUND`. Exactly the row's
`lifecycle` (`ACTIVE` | `READ_ONLY_CLOSED`) and `phase` (`STANDARD` | `INTRODUCTION`)
are returned: no `closed_at`, no `born_at`, no `birth_basis`, no membership, no
Standing Context state, no Shared material. **Lifecycle is returned, not decided**:
the `ACTIVE` vs `READ_ONLY_CLOSED` distinction is applied by the API-side
EffectiveContext service, where `READ_ONLY_CLOSED` blocks ordinary pre-model Shared
generation (CW2-03 section 35) while `ACTIVE / STANDARD` and `ACTIVE / INTRODUCTION`
may proceed with no extra privacy authority for Introduction (CW2-03 section 44).

Posture: `SECURITY DEFINER`, `STABLE`, `search_path = ''`, fully qualified names,
owned by postgres. EXECUTE is revoked from `PUBLIC`, `anon` and `authenticated` and
granted to `service_role` only; no `auth.uid()` or JWT is consulted and no
client-supplied lifecycle is trusted. **No direct Shared table read**: after 0080,
`anon`, `authenticated` and `service_role` still hold no `SELECT`, `INSERT`, `UPDATE`
or `DELETE` on `shared_worlds`, which keeps RLS on with zero policies; the migration
ends with self-assertions that refuse a client-callable, mutable, unpinned,
membership-, grant- or material-reading or table-privileged deploy.

The API side lives under `apps/api/src/connected-worlds/effective-context/`.
`shared-pre-model-world-state-resolver.service.ts` calls exactly this RPC over the
server-only service-role transport and maps the untrusted payload (exactly one row,
exact three keys, the requested World, a kernel-legal lifecycle / phase pair) into
`RESOLVED { snapshot }` or `UNRESOLVED { failure }`. The **World-state snapshot
reference** is `sha256:` over the versioned `world` + `lifecycle` + `phase`, so any
lifecycle or phase change changes it; clock, random identity and secrets never enter it.
It is the **state snapshot the EffectiveContext binds**, evidence for later
revalidation, never a bearer permission.

`shared-effective-context.service.ts` is the **server-internal** Shared EffectiveContext
private Context Admission boundary (CW2-02 section 21; I-00 section 7). It receives a
finite candidate list from a server-owned collector (it retrieves no private context
and reads no Personal table), validates the set structurally (MY_WORLD origin, human
owner, non-blank context id, supported availability, no duplicate owner + context id,
no content on a deleted / unavailable candidate - any violation fails the whole set
closed), resolves the World state (closed -> `BLOCKED / WORLD_READ_ONLY_CLOSED`),
resolves one exact current audience snapshot for every candidate (empty ->
`BLOCKED / NO_ACTIVE_HUMANS`), excludes `DELETED_BY_OWNER` / `UNAVAILABLE` candidates
before any grant lookup so no grant can resurrect them, resolves the Standing Context
grant once per unique owner, evaluates every AVAILABLE candidate through the frozen
I-03A evaluator against that same audience snapshot, admits `ALLOW` and excludes
`DENY` and `UNKNOWN` before any provider path. Grants are never unioned; no
grantor-in-audience rule is invented. Every admitted item is **private reasoning-only**:
it carries the exact I-03A ALLOW constraints (`PRIVATE_REASONING_ONLY_CONTEXT`, material
and direct private disclosure `NOT_GRANTED`, provenance `SEALED`, delivery
`REQUIRES_REVALIDATION`), its content byte-for-byte with a `sha256:` content digest,
and a `SourceContextRef` to its MY_WORLD source - never a `SourceMaterialRef`. The
`effectiveContextRef` binds World, World-state snapshot, audience snapshot and every
admitted item's ordinal, owner, context id, content digest, grant id and authority
snapshot; candidate order is preserved and never reranked; no byte or token budget is
invented (QIR resource budgeting stays separate). **No model integration**: nothing here
builds a `ModelRouterRequest`, invokes a provider, scans output, revalidates delivery,
persists anything or exposes a route.

The secret-free structural contract runs under `npm run test:database`. The real
PostgreSQL verifier proves the function catalog, the execute ACL, the still-sealed
`shared_worlds` ACL, the canonical existence error, every legal lifecycle / phase row,
no membership or grant read, zero mutation and forward safety against a hypothetical
later trigger, with rolled-back fixtures:

```sh
npm run verify:shared-pre-model-world-state:integration
```

## Direct Shared invitation credential and prospective invitation runtime (migration 0081, I-04A)

Migration 0081 opens the I-04 Shared World lifecycle phase with the state that may
exist **before** a World does. CW2-01 section 5 / A4 and CW2-03 sections 2-3 freeze the
rule it implements: no Shared World exists before the corresponding valid creation
event, and **an invitation is not a dormant World**. This migration therefore creates
the prospective direct path and stops exactly where World birth begins. **No Shared
World is created here**: nothing in it can insert into `shared_worlds` or
`shared_world_membership_episodes`, there is no `world_id` column, no `WORLD_BIRTH`
event and no acceptance command. I-04B owns the atomic exact-target acceptance
transaction that creates `ACTIVE / STANDARD`.

Three tables, all RLS-on with zero policies and every application role revoked from
every privilege. `shared_world_invite_credential_state` is the secret Shared
invitation credential as **user / account state** (CW2-01 section 17, CW2-03 section
4): one current row per human, private, non-searchable, rotatable, distinct from
Public Alias, never World identity, with a monotonic `epoch` from 1.
`shared_world_direct_invitations` is the `DIRECT_WORLD_INVITATION` prospective object
carrying exactly the frozen status vocabulary `PENDING | ACCEPTED | DECLINED |
CANCELLED | EXPIRED | INVALIDATED`, two distinct humans, and `PENDING <=> terminal_at
IS NULL`; the inviter's factual identity confers no owner, admin or superior World
authority. `shared_world_invitation_commands` is the narrow durable command history
whose primary key **is** the caller-supplied command id, and which deliberately stores
no target user id.

**The human-facing credential format is not frozen and is not invented here.** No short
code length, alphabet, QR shape, URL form, username syntax or Public Alias reuse is
chosen. Persistence stores only an opaque derived `credential_lookup_ref`: non-empty,
exact-match lookup only, no semantic meaning, and specifically not the user id (a CHECK
refuses that collapse). A later reviewed adapter may change how a human secret becomes
this reference without touching these tables.

Both commands are `SECURITY DEFINER`, `VOLATILE`, `search_path = ''`, owned by postgres,
and derive the actor from `auth.uid()` with **no actor, inviter, target, status, World
or timestamp parameter**. EXECUTE is granted to `authenticated` only: `PUBLIC`, `anon`
**and `service_role`** cannot execute either one, so possession of a system credential
can never manufacture a human invitation.
`rotate_shared_world_invite_credential_v1(p_command_id, p_new_credential_lookup_ref,
p_expected_epoch)` is compare-and-swap on the caller's own state - `NULL` expects no
current credential and yields epoch 1, `N` requires exactly `N` and yields `N + 1`, and
any other current state is a bounded `40001 SHARED_INVITE_CREDENTIAL_STALE_STATE`.
**A rotation must actually change the credential**: when current state exists,
re-presenting the reference that is already current is refused with a bounded
`22023 SHARED_INVITE_CREDENTIAL_UNCHANGED` **before any mutation**, so a no-op value
advances no epoch, moves no `updated_at`, invalidates no `PENDING` invitation and
writes no command-history row - accepting it would retire nothing while invalidating
everything. The comparison is against the caller's own locked row, so it discloses no
other human's state.
In the same transaction it moves every `PENDING` invitation of that target bound to an
older epoch to `INVALIDATED` with a database-clock `terminal_at` (CW2-03 section 5).
Nothing is deleted, `ACCEPTED` / `DECLINED` / `CANCELLED` / `EXPIRED` rows are never
touched, and an already-born World is entirely unaffected.

`submit_shared_world_direct_invitation_v1(p_command_id, p_invitation_id,
p_credential_lookup_ref)` takes **no target parameter**: the target is resolved only
from the exact current lookup reference, inside the transaction, under the
credential-state row lock, and the invitation binds the **exact current epoch read
under that lock** - never one supplied by the client. **Inviter-side behaviour is
non-enumerating**: the result is `SUBMITTED` with the command id and the requested
invitation id and carries no target id, name, alias, profile, epoch or existence
boolean, and a reference that never existed, was rotated away, resolves to the caller
or belongs to an unavailable account collapses into the one bounded internal class
`SHARED_INVITE_TARGET_NOT_USABLE`. Rotation's own reference-collision answer is bounded
the same way and never says that another human holds a reference.

**Canonical lock order**, a transaction invariant I-04B must continue: the target
credential-state row first, invitation rows second. Both commands take it, so a
rotation and a submission racing on the same target serialize on one row and the race
has exactly two canonical outcomes - the submission committed first against the
pre-rotation epoch and the rotation then invalidated it, or the rotation committed
first and the retired reference resolved to nothing. No advisory lock and no
process-local mutex is used. Idempotency is durable, never process-local: an equivalent
retry returns the committed result, and a reused command id with different semantics
fails closed with `23505`. It is checked at every point an equivalent retry can arrive -
before the lock, under the lock, and, for a **first** setup, inside the uniqueness
conflict handler, because a first setup has no credential row to lock and two concurrent
executions of the same command both legitimately observe absence; there the conflict
itself is the serialization point, so both callers receive the same committed epoch-1
result while a *different* losing first setup still gets bounded stale state. One
invitation identity is owned by one command forever and is never re-bound to another
target.

Deliberately absent: no accept / decline / cancel / expire command (`INVALIDATED` is the
only terminal transition this slice performs), no expiry duration, TTL, cron,
`expires_at` column or scheduler (CW2-03 section 50 defers it), no Matching or
Introduction state, no Personal context read, no Standing Context grant, no RLS policy,
no trigger, and no generic invitation engine spanning add-member governance, Matching,
Public or Replay.

The secret-free structural contract runs under `npm run test:database`. The real
PostgreSQL verifier proves the catalog, both ACLs, the still-sealed 0075 substrate,
first setup and rotation, old-epoch invalidation, non-enumerating submission,
idempotency, invitation-id collisions, that no World or membership row is ever created,
and the two-connection races, with rolled-back and cleaned-up fixtures:

```sh
npm run verify:shared-direct-invitation-runtime:integration
```

## Direct invitation acceptance and atomic Shared World birth (migration 0082, I-04B)

Migration 0082 is the first migration allowed to create a real Shared World. It implements
CW2-03 section 6 as **one atomic transaction**: a valid exact-target acceptance consumes the
exact `PENDING` invitation, creates the Shared World, creates the inviter and target
membership episodes, records one direct `WORLD_BIRTH`, marks the invitation `ACCEPTED` and
writes one durable acceptance command. All seven writes commit together or not at all.

The birth core is **executable by no application role**. CW2-03 section 6 lists `system
policy allows creation` among the birth preconditions and CW2-08 section 25 / H18 binds a
current Launch Gate Snapshot before an irreversible commit, with section 40 making
`UNKNOWN` / `UNCONFIGURED` / `UNSATISFIED` / `UNTESTED` fail closed. The Connected Worlds
Launch Gate does not exist yet, and creating a World is irreversible (section 31 makes World
end an archival closure, never a deletion). So `commit_shared_world_direct_acceptance_birth_v1`
is fully implemented and real-PostgreSQL tested but `PUBLIC`, `anon`, `authenticated` and
`service_role` all hold no `EXECUTE` - migration 0082 contains no `GRANT` statement at all,
and refuses to deploy if any of those four can execute it. That is the pre-launch security
boundary, not a temporary testing convenience. A later reviewed launch-gated wrapper is
expected to authenticate the exact human, resolve and revalidate current system policy,
preserve that human's own session claims and only then call this primitive; nothing here
forbids such a wrapper.

Human acceptance authority is exact. The function takes **no acceptor, actor or target
parameter** - only five opaque uuid persistence identities (the command id, the invitation
and the three row identities the birth will create) which must be non-null and pairwise
distinct. The accepting human is `auth.uid()`, and the birth commits only when that human IS
the invitation's persisted `target_user_id`. The inviter cannot accept on the target's
behalf, QANDEEL has no session identity and so can never accept, and `service_role` cannot
execute the primitive at all.

**Canonical lock order**, continued exactly from I-04A: the target credential-state row
first, the exact invitation row second. Because acceptance requires `auth.uid()` to be the
target, the target's credential-state row is the caller's own row and is taken before the
invitation is read. Rotation takes the same row first, so an acceptance racing a rotation
serializes on one row with exactly two canonical outcomes - acceptance commits and the later
rotation leaves the now-`ACCEPTED` invitation untouched, or the rotation commits and the
acceptance then sees a non-`PENDING` or stale-epoch invitation and no World is born. Under
both locks the command revalidates that the invitation is exactly `PENDING`, that its target
is `auth.uid()` and that its bound `target_credential_epoch` equals the current epoch.

On a valid birth the World is exactly `ACTIVE` / `STANDARD` with `birth_basis =
ACCEPTED_INVITATION` and a NULL closure, and membership is **exactly the inviter and the
exact accepting target** - two open episodes written by one statement, with both user ids
read from the persisted invitation. No third human, no QANDEEL membership, no owner, admin or
role column anywhere. `shared_world_direct_birth_events` is the canonical direct
`WORLD_BIRTH` fact: table identity is the event type, so there is no payload and no mutable
event state, and its unique `invitation_id` is one of the structural reasons one invitation
creates at most one World.

**ONE database-owned instant** is captured once inside the transaction and persisted
unchanged as the World's `born_at`, both episodes' `joined_at`, the birth event's
`occurred_at`, the invitation's `terminal_at` and the command's `committed_at`. No client
timestamp is accepted and no second clock read can drift; the verifier compares all six in
SQL at full precision.

Refusals are bounded and non-enumerating. A nonexistent invitation, a caller who is not the
exact target, a non-`PENDING` invitation, an absent credential state and a stale bound epoch
all fail through the single internal class `SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE`, which
names no human and no reason, so a future wrapper cannot become an existence oracle. Any
supplied identity that is already taken fails through `SHARED_DIRECT_BIRTH_ID_CONFLICT` and
rolls the whole birth back - no World, no episode, no birth event, no command row, and the
invitation stays `PENDING`. Acceptance idempotency is durable and checked at every point an
equivalent retry can arrive: before the locks, under the locks, and inside the uniqueness
conflict that two commands sharing a command id across different humans have as their only
serialization point. Impossible canonical state fails closed through
`SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE` rather than being silently repaired.

Deliberately absent: no application wrapper, controller or route; no Launch Gate, feature
flag, entitlement or moderation state; no decline / cancel / expiry / add-member / leave /
remove / rejoin command; no World name, description, topic, avatar or settings requirement;
no Shared conversation, message or QANDEEL generation; no Personal-context read and no
Standing Context Grant; no Matching or Introduction state; and no account-status, ban, age or
eligibility model - the repository has no such frozen Connected Worlds restriction, and this
slice requires only that the canonical human rows exist, which the restrictive foreign keys
already enforce.

The secret-free structural contract runs under `npm run test:database`, and a Jest parity
spec checks the persisted birth constants against the frozen I-01A kernel's own
`attemptSharedWorldBirth`. The real PostgreSQL verifier proves the catalog, both ACLs, the
still-sealed 0075 / 0081 substrate, the atomic birth and its single instant, every bounded
refusal, idempotency, identity-collision rollback and the multi-connection races, with
rolled-back and cleaned-up fixtures:

```sh
npm run verify:shared-direct-world-birth:integration
```
