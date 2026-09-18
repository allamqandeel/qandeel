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

## Focused database verification (QAN-INF-05)

Start here when a verifier is failing. Full API CI runs about a hundred and forty steps and
reaches the database verifiers at the end of them, so using it to find a defect in one verifier
costs roughly twenty minutes per finding. The focused gate is the same PostgreSQL 17, the same
Supabase-compatible bootstrap, the same migrations from zero and the same verifier command, with
the unrelated steps removed.

**In GitHub:** run the **Focused Database Verification** workflow from the Actions tab with a
`target_ref` (any branch, tag or SHA) and a `verifier` selector. The workflow runs from the default
branch and checks the target out separately, so a feature branch needs no infrastructure of its own.
The artifact — environment, migration log, per-verifier output and a scenario table — is uploaded on
failure as well as on success.

**Locally**, once a PostgreSQL is available:

```sh
npm run verify:db:focused -- i06a-all
```

**Selectors:** `i06b-0102`, `i06b-0103`, `i06b-all`, `i06a-0100`, `i06a-0101`, `i06a-all`, `i05c-all`,
or the generic `migration-NNNN`,
which reaches any `database/verify-migration-NNNN.mjs` with no mapping entry. Named groups live in
`database/focused-verifiers.json`.

**Before a push**, the defect classes that used to be found by CI are found by:

```sh
npm run verify:db:hazards
```

which also runs inside `npm run test:database`. It refuses seven shapes that make a verifier wrong
while it looks right — a `now()` that cannot change a value inside its own transaction, a refusal
swallowed into an aborted transaction, a `timestamptz` truncated by a JavaScript `Date`, a literal
fixture count the verifier has outgrown, a mutation anchored on migration text that
`pg_get_functiondef` regenerates, a weakening probe that never proves it weakened anything, and a
savepoint helper that does not say it needs an open transaction.

`database/verifier-scenarios.mjs` is the companion result contract: independent scenarios run
isolated, each reports its own outcome, and the run fails once with all of them named — so eight
latent probe defects cost one CI round rather than eight.

Full detail, including the fresh-database rule and the two-green-focused-runs rule for
database-heavy tasks, is in `docs/local-focused-database-verification-v1.md`.

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

## Standard voluntary leave and membership episode closure (migration 0083, I-04C)

Migration `0083_shared_world_standard_voluntary_leave_v1.sql` adds the first primitive that
ENDS a membership episode, and it is
deliberately the only membership mutation frozen canon makes **unilateral**: CW2-03 section
23 / C19 and CW2-02 section 35 make voluntary leave an individual authority that requires no
group approval. Add-member, removal, rejoin and Standard World end all require a unanimous
governance substrate that does not exist yet, so none of them is implemented here.

A valid leave commits as one transaction: the exact authenticated human's own open membership
episode is closed with `end_reason = VOLUNTARY_LEAVE`, one `MEMBER_LEFT` fact is appended and
one durable leave command is written. All writes commit together or not at all.

The canonical episode gains **exactly one additive, unconstrained column**:

```sql
ALTER TABLE public.shared_world_membership_episodes ADD COLUMN end_reason text;
```

CW2-03 section 15 models the episode as `{user, start, end?, end_reason?}`; migration 0075
created every part of that except the reason, because it had no writer for it yet. The column
is nullable and carries **no check constraint**: CW2-03 section 25 removal and section 32
closure must be able to write their own canonical reasons later without a superseding
migration, and an enum frozen here would freeze exactly the future this slice must not
decide. An open episode keeps `ended_at = NULL` and `end_reason = NULL`; the only writer in
this repository sets both together, in one statement.

Five predecessor verifiers were repaired to make that additive evolution legal. Migrations
0075 - 0082 are **byte-identical**; the verifiers of 0075, 0076, 0078, 0081 and 0082 were
asserting the exact LIVE column, constraint and index shape of tables they do not own
forever, which is a
mutable-global ceiling rather than a fact about the historical migration. Each now proves the
stronger and correct thing - every column it owns is still present with its original type,
nullability, default and ordinal position (a prefix, so a drop, a type change or a reorder
still fails), and every constraint and index it owns is still present and still means exactly
what it meant - while permitting later additive evolution. Migration 0078's census of every
function in the database whose name matched a Standing Context pattern was narrowed to the
exact two commands it created, for the same reason.

The leave core is **executable by no application role**, exactly as I-04B left the birth core.
Closing a membership episode is irreversible - the episode is permanent historical truth and a
later rejoin is a NEW episode, never a reopening (CW2-03 section 28 / C25) - and CW2-08
section 25 / H18 binds a current Launch Gate Snapshot before an irreversible commit, with
section 40 failing closed. So `commit_shared_world_standard_voluntary_leave_v1` is fully
implemented and real-PostgreSQL tested while `PUBLIC`, `anon`, `authenticated` and
`service_role` all hold no `EXECUTE`: migration 0083 contains no `GRANT` statement at all and
refuses to deploy if any of those four can execute it. A later reviewed launch-gated wrapper
is expected; nothing here forbids one.

Human authority is exact and unilateral. The function takes **no actor, target, episode,
instant or reason parameter** - only three opaque uuid identities (the command id, the exact
World and the identity the new `MEMBER_LEFT` row will carry), which must be non-null.
They are opaque in the strict sense: they address three different domains, so equality
between any two of them is legal input and commits normally. No cross-domain distinctness
rule is invented, because nothing frozen assigns identifiers that algebra. The leaving human is `auth.uid()`, and the episode is resolved from
canonical current state as `world_id = p_world_id AND user_id = auth.uid() AND ended_at IS
NULL`. No other member approves, no owner or admin exists, and QANDEEL has no session
identity so can never leave for a human.

**Canonical lock order: the exact World row first**, then the actor's own open episode.
Membership topology is a property of the World, not of one human, so every future topology
mutation must bind the exact current topology and serialize there. The frozen I-03C consent
commands already take that same row first, which gives a leave racing a grant exactly two
canonical outcomes: the grant commits under current membership and the later leave ends that
membership without revoking anything, or the leave commits and the later grant finds no
current membership and fails closed under I-03C's own unchanged rule.

**ONE database-owned instant** is captured once and persisted unchanged as the episode's
`ended_at`, the event's `occurred_at` and the command's `committed_at`; the verifier compares
all three in SQL at full precision.

Ordinary leave mechanics are **ACTIVE / STANDARD only**. CW2-03 section 14 keeps ordinary
add-member / remove-member / leave mechanics out of `INTRODUCTION`, which has its own single
terminal transition, and section 35 blocks ordinary mutation on `READ_ONLY_CLOSED`. All three
other legal states are refused through the one bounded class
`SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE`, which also answers an outsider, an
already-departed human and a World that does not exist - so no future wrapper can become a
membership oracle. No Introduction exit is implemented or guessed.

Leave never closes, deletes or converts the World. One remaining active human is a valid
Shared World with no sole-survivor authority (section 26, C22 - C23); zero remaining active
humans is the valid inert `NO_ACTIVE_HUMAN_MEMBERS` state, **derived** from zero open
episodes rather than stored, with no automatic deletion, conversion or recovery and with
empty-set unanimity never treated as approval (section 27, C24). There is no
"must retain one member" rule: the last human may leave.

**Standing Context Grants are not touched.** Leaving does not revoke the departed grantor's
`ACTIVE` grant, does not contract its audience ceiling, appends no consent event and installs
no trigger that could do any of it implicitly. CW2-02 section 32 freezes that there is no
universal retroactive revocation rule and that a Standing Context Grant is revocable for
FUTURE reasoning - explicitly, by its owner - and section 35 makes leave invalidate future use
"according to grant policy" rather than by rewriting the grant. Frozen I-03E states that a
departed owner's private context is still unavailable unless there is a valid independent
authority basis, and that a valid current Standing Context Grant IS such a basis where all
frozen conditions permit it; frozen I-03A deliberately derives nothing from membership.
Membership loss and grant revocation are separate canonical truths. What leave changes is the
canonical membership topology, and therefore the current human Audience Snapshot the frozen
0079 resolver derives from open episodes - which is the input the already-frozen authority,
admission and delivery-revalidation layers consume. A grant or reconfirm ATTEMPTED after
leaving still fails, but under I-03C's own unchanged current-membership rule. An explicit
revoke after leaving still works.

Idempotency is durable and checked at every point an equivalent retry can arrive: before the
lock, under the lock, and inside the uniqueness conflict that two commands sharing a command
id across different humans have as their only serialization point. A retry returns the
immutable committed result and reads neither current membership nor the current World row, so
a later authorized rejoin or closure cannot change a historical answer. Uniqueness is per
EPISODE and per EVENT, never per `(world_id, actor_user_id)`, so a future rejoin episode may
itself later leave.

Deliberately absent: no application wrapper, controller or route; no Launch Gate, feature flag
or entitlement; no removal, add-member, rejoin, World-end, closed-world-viewing or
history-grant command; no `INTRODUCTION_ENDED` event and no phase transition; no Shared
conversation, message or QANDEEL generation; no Personal-context read.

The secret-free structural contract runs under `npm run test:database`, and a test-only Jest
spec proves the frozen I-03F revalidator turns exactly the observed audience transition into
`STALE / AUDIENCE_CHANGED` and `STALE / NO_ACTIVE_HUMANS` without inventing a new authority
code. The real PostgreSQL verifier proves the catalog, both ACLs, the additive column with
every 0075 invariant intact, the atomic closure and its single instant, every bounded refusal,
the audience transition through the frozen 0079 resolver, Standing Context Grant survival,
idempotency and the multi-connection races, with rolled-back and cleaned-up fixtures:

```sh
npm run verify:shared-world-standard-voluntary-leave:integration
```
## Exact membership snapshot and Shared governance approval foundation (migration 0084, I-04D)

Migration `0084_shared_world_governance_approval_foundation_v1.sql` adds the shared governance
authority substrate every remaining Standard membership mutation needs. I-04C delivered the only
one frozen canon makes unilateral; add-member, removal, rejoin, settings changes and World end all
require exact current-member approval (CW2-03 sections 16, 25, 28, 30 and 31), and CW2-02 section
31 / B20 freezes what an approval binds:

```text
exact operation + exact proposed payload/version + exact membership snapshot
```

An approval is never a reusable token. If the proposal or the topology changes, authority is
recomputed and approvals are re-collected.

**Topology identity is the EPISODE set, not the human set.** Current members are the humans holding
an open membership episode, and a rejoin is a NEW episode rather than a reopening (CW2-03 section
28 / C25). So `A leaves` then `A rejoins` restores an identical human set and an identical member
count while producing a different episode set. A count comparison and a user-id comparison both
accept that; exact set equality over `membership_episode_id`, in BOTH directions, is the only
comparison that rejects it. The real PostgreSQL verifier proves the trap directly: it asserts that
the human sets and the counts really are identical again, and that the old proposal is still stale.

Four narrow relations are created. `shared_world_membership_snapshots` is a durable identity for one
captured topology - a World and an instant, with no status, no current flag and no member-list
column. `shared_world_membership_snapshot_members` is the captured episode set, keyed on
`(membership_snapshot_id, membership_episode_id)`, with no duplicated human id.
`shared_world_governance_proposals` binds one operation, one OPAQUE
`proposed_payload_version_id`, one approval rule and one exclusion to exactly one captured topology.
`shared_world_governance_approvals` records one exact human approval, and two COMPOSITE foreign keys
make the binding structural rather than procedural: `(proposal_id, membership_snapshot_id)` can only
name a proposal that really carries that topology, and `(membership_snapshot_id,
membership_episode_id)` can only name an episode really inside it. `UNIQUE (proposal_id,
membership_episode_id)` makes one snapshot episode worth exactly one effective approval, so one
human can never cover a two-human rule.

The exact v1 mapping is

```text
ADD_MEMBER             -> ALL_CURRENT_MEMBERS
REMOVE_MEMBER          -> ALL_CURRENT_MEMBERS_EXCEPT_TARGET
REJOIN_MEMBER          -> ALL_CURRENT_MEMBERS
WORLD_SETTINGS_CHANGE  -> ALL_CURRENT_MEMBERS
END_WORLD              -> ALL_CURRENT_MEMBERS
```

and it is enforced in the primitives rather than frozen into a CHECK constraint, for the same
forward-safety reason migration 0083 left `end_reason` unconstrained: a later reviewed slice must be
able to extend Shared governance without a superseding migration.

**Initiation is not authority.** No initiator, proposer or owner column exists, and the capture
primitive records no actor and consults no session identity at all (CW2-01 sections 5 and 7; CW2-03
section 16). Who may open a proposal is a later reviewed launch-gated consumer's question. The
approving human, by contrast, is exactly `auth.uid()`, with no actor, episode or instant parameter,
so QANDEEL and service execution both fail closed.

**For a removal, the target stays inside the captured topology and outside the required set.** The
supplied human is resolved under the World lock to their exact current open episode, that episode is
stored as the exclusion, and only the required-approval set excludes it. The target cannot approve
their own removal, and a sole current human can never be removed through an empty required set:
empty-set unanimity is never approval (CW2-03 section 27 / C24), which is also why zero active humans
cannot open ordinary governance and why a required count of zero is never satisfied.

All three primitives lock the exact `shared_worlds` row FIRST - the row the frozen I-03C consent
commands and the frozen I-04C leave already take first - so a proposal or an approval racing a leave
serializes with exactly two canonical outcomes and cannot deadlock. The satisfaction resolver
persists nothing: a proof is not a stored permission, and a future operation-specific transaction
must revalidate it inside the same transaction as its own irreversible mutation.

Deliberately absent: no add-member, removal, rejoin, settings or World-end command; no
`MEMBER_INVITATION`; no history access or closed-world entitlement; no Launch Gate, feature flag or
wrapper; no application controller or route; no Shared conversation; no Personal-context read; no
Standing Context or consent mutation; no membership or lifecycle mutation of any kind. All four
tables are RLS-enabled with zero policies, and no application role holds any privilege on them or
EXECUTE on any primitive, because the frozen Launch Gate precondition is unimplemented.

The secret-free structural contract runs under `npm run test:database`. The real PostgreSQL verifier
proves the catalog, both ACLs, the exact captured topology, the non-reusable approval, the
leave-then-rejoin staleness, the removal exclusion, the empty-set refusals, idempotency, the
multi-connection races and forward safety against the add-member consumer this foundation exists to
serve, with rolled-back and cleaned-up fixtures:

```sh
npm run verify:shared-world-governance-approval-foundation:integration
```
## Governed Standard membership lifecycle (migration 0085, I-04E)

Migration `0085_shared_world_governed_membership_lifecycle_v1.sql` is the first CONSUMER of the
I-04D governance substrate. It implements three of the four remaining governed Standard mutations
(CW2-03 sections 16, 25 and 28):

```text
ADD_MEMBER     -> ALL_CURRENT_MEMBERS               -> MEMBER_INVITATION -> the exact target accepts
REMOVE_MEMBER  -> ALL_CURRENT_MEMBERS_EXCEPT_TARGET -> the exact excluded episode closes in place
REJOIN_MEMBER  -> ALL_CURRENT_MEMBERS               -> a NEW membership episode
```

Everything about authority is consumed rather than duplicated: `capture_shared_world_governance_
proposal_v1` opens the proposal over the exact current topology and
`resolve_shared_world_governance_approval_v1` re-proves it inside the SAME transaction as each
irreversible mutation. What is new is the operation-owned immutable PAYLOAD. I-04D deliberately left
`proposed_payload_version_id` opaque, so each operation now owns one narrow table -
`shared_world_add_member_payload_versions`, `shared_world_remove_member_payload_versions` and
`shared_world_rejoin_payload_versions` - whose primary key IS that opaque identity. The binding back
to the proposal is STRUCTURAL: a four-column composite foreign key on
`(governance_proposal_id, world_id, governance_operation_kind, id)` can only name a proposal that
really carries that exact World, that exact operation and that exact payload version, so a payload
for one operation can never be presented as another's. For a removal the target episode is bound the
same way, to the proposal's own `excluded_membership_episode_id`, so a removal can never close an
episode the approvers did not exclude.

`shared_world_member_invitations` is the durable MEMBER_INVITATION between the two human acts of an
add. It binds the exact target, World, proposal, captured topology and payload version, and
`UNIQUE (governance_proposal_id)` makes one proposal worth exactly one effective invitation. Its
state VOCABULARY carries no CHECK - a later reviewed decline, cancel or expiry state must not need a
superseding migration - while the CONSISTENCY of the states is frozen structurally: `PENDING` is the
only non-terminal state in both directions, and an accepted membership episode exists exactly when
the invitation is `ACCEPTED`.

**The terminalization mechanism, and why it is a trigger.** The topology change that stales an
invitation may come from the ALREADY FROZEN I-04C leave, which this slice may not modify and which
knows nothing about invitations. A staleness check performed only at acceptance would leave every
OTHER pending invitation of that World in a state that is no longer true. So two narrow AFTER
triggers sit on `shared_world_membership_episodes`, each reacting to exactly one real open-topology
transition - a new OPEN episode appearing, and an OPEN episode becoming closed - and nothing else.
The trigger function transitions only still-PENDING member invitations of the exact World whose
captured topology has actually stopped matching, exactly once, with a database-owned terminal
instant; it writes that one relation and no other. Acceptance is ordered so the trigger cannot race
it: the invitation moves from `PENDING` to `ACCEPTED` BEFORE the new episode is inserted, inside one
transaction that rolls back as a whole.

`FROM_JOIN_FORWARD` is the new episode's `joined_at` and the ABSENCE of any retrospective grant.
Nothing is stored to encode the default, because storing a synthetic entitlement would manufacture a
history-access record this slice has no authority to write. A rejoin likewise leaves the absence
interval between the old `ended_at` and the new `joined_at` explicit and ungranted; selective past
history belongs to I-04F.

Membership loss is not revocation. Governed removal changes the canonical membership topology - and
therefore the current human Audience Snapshot the frozen 0079 / I-03A / I-03E / I-03F layers derive
from open episodes - and rewrites, revokes, deletes and widens nothing else. No add or rejoin widens
an audience ceiling either.

**Four predecessor verifiers were narrowed.** `verify-migration-0075.mjs`, `verify-migration-0076.mjs`,
`verify-migration-0077.mjs` and `verify-migration-0083.mjs` each asserted that
`shared_world_membership_episodes` carried NO trigger at all. Those verifiers run against a FULLY
migrated database, so that was a ceiling on the whole roadmap rather than a fact about their own
migrations - exactly the defect class 0078 had already excluded for this table and the I-04D FIX-01
correction removed from 0084. Each was narrowed to the invariant it really owns: 0075 now proves no
trigger on its tables DELETES canonical Shared history, and 0076, 0077 and 0083 prove that no trigger
on the membership table reaches a Standing Context relation - which is strictly stronger than a
count, because it fails a real membership-to-grant coupling however it was installed. The Standing
Context tables keep their live zero-trigger census, because there an automatic ceiling-mutation path
IS what CW2-02 B13 / B14 forbid.

Deliberately absent: no World closure, history-access grant, absence-period grant or closed-world
entitlement; no Shared conversation, message or material; no Introduction, Matching, Public or
Replay path; no Launch Gate, feature flag, entitlement or moderation policy; no route, controller or
application wrapper; no decline, cancel or expiry lifecycle. Every new table is RLS-enabled with zero
policies, and no application role holds any privilege on them or EXECUTE on any primitive, because
the frozen Launch Gate precondition is unimplemented.

The secret-free structural contract runs under `npm run test:database`. The real PostgreSQL verifier
proves the catalog, both ACLs, the two topology triggers, the whole add / remove / rejoin journey,
the staleness law across a frozen leave and a same-human rejoin, the exact count deltas that show no
history access is created, the multi-connection races and forward safety against the I-04F and I-04G
substrate, with rolled-back and cleaned-up fixtures:

```sh
npm run verify:shared-world-governed-membership-lifecycle:integration
```
## Governed Shared settings (migration 0086, I-04E)

Migration `0086_shared_world_governed_settings_v1.sql` is the fourth governed Standard operation:
World-level settings affecting all participants require exact unanimous current-member governance
(CW2-03 section 30).

```text
WORLD_SETTINGS_CHANGE -> ALL_CURRENT_MEMBERS
```

It is a separate migration from 0085 because settings and membership topology have different durable
ownership: a settings change moves no topology, terminalizes no member invitation, and a later
reviewed settings extension must be able to evolve without reopening the membership lifecycle.

Architecture freezes exactly four optional v1 fields, and they are REAL COLUMNS on
`shared_world_settings_versions`: `name`, `description`, `topic` and `general_visual_marker`, each
nullable text with no default. There is deliberately no JSON blob, no generic key/value settings
store and no common-metadata table - a generic settings engine would be exactly the polymorphic
structure I-04D refused to invent for payloads, and it would make every future reviewed setting
invisible to the schema. A later reviewed setting is an ADDITIVE column or table, which this slice
forbids nowhere. No avatar or media storage decision is taken; no commercial, safety, moderation or
entitlement setting exists here at all; and there is no owner, admin, creator or moderator column,
because settings authority is unanimity and never a role.

A settings VERSION is immutable and is proposed once. Changing a value - even back to a value some
earlier version already carried - is a NEW version under a NEW proposal with NEWLY collected
approvals, which the frozen I-04D resolver enforces directly because the commit must name the exact
payload version it is about to apply. `shared_world_settings_state` is the only mutable relation: one
row per World, and NO row at all is the valid neutral/default state.

Deliberately absent: no membership mutation, no invitation terminalization (the topology did not
change, so 0085's triggers never fire), no grant, ceiling or consent mutation, no World creation or
closure, and no history-access or closed-World entitlement. Both primitives derive no actor of any
kind, all four tables are RLS-enabled with zero policies, and no application role holds any privilege
on them or EXECUTE on either primitive, because the frozen Launch Gate precondition is unimplemented.

The secret-free structural contract runs under `npm run test:database`. The real PostgreSQL verifier
proves the catalog, both ACLs, the neutral state, one committed pointer and SETTING_CHANGED on one
instant, the non-reusable approval across a value that returns to an earlier one, the exact count
delta showing nothing else moved, the settings-versus-topology and settings-versus-settings races and
forward safety against later additive settings schema, with rolled-back and cleaned-up fixtures:

```sh
npm run verify:shared-world-governed-settings:integration
```

## I-04F - Selective Historical Access (migration 0087)

`0087_shared_world_selective_history_access_v1.sql` implements the first of the two frozen Shared
laws I-04E left unimplemented: **membership is not historical access** (CW2-01 A9 / A25, CW2-02 B21 /
B22, CW2-03 sections 19-22 and 29). A new member defaults to `FROM_JOIN_FORWARD`; past access is a
separate explicit authority object whose approval requirement derives from the EXACT included
material rather than from World membership.

Because the Shared material store belongs to I-04G, this slice creates a minimal **history-visibility
projection** rather than content: `shared_world_history_items` is an opaque item identity carrying
only which World, when it occurred, how its human material authority is expressed
(`EXACT_HUMAN_APPROVER_SET` or `NO_HUMAN_APPROVAL_REQUIRED`) and whether its source is still
`AVAILABLE`, `DELETED_BY_OWNER` or `UNAVAILABLE`, at which `availability_revision`. There is no
message text, transcript, audio, analysis body, JSON payload, provenance payload or content blob
anywhere in the migration, and no column one could hide in. I-04G will bind real material to this
item identity atomically.

`shared_world_history_item_baseline_viewers` is the item's exact ORIGINAL human audience, so the
ordinary historical-membership basis is the conjunction *membership interval AND baseline viewer
membership* - a membership interval alone never means "could see everything that existed".
`shared_world_history_item_required_approvers` is the exact set of humans whose material authority
must be exercised to expose that item as old history.

A `shared_world_history_package_manifest_versions` row is immutable, holds a normalized exact item set
with each captured availability revision, and binds the grantee's EXACT open membership episode, so a
leave-then-rejoin needs a fresh manifest and can never revive the old one. Its required approver set
is DERIVED as the exact union over the included items and is never caller-supplied; an approval is
bound by composite foreign key into that derived set, so an approval by a human the manifest does not
require is structurally impossible. A committed `HISTORY_ACCESS_GRANT` carries no mutable status
column at all, because grant withdrawal after viewing is explicitly deferred frozen policy.

Material authority survives membership loss: the approval primitive requires the exact derived
required set and NOT current World membership, and approving writes no membership episode, so it
restores no browsing. One narrow server-only resolver,
`resolve_shared_world_history_visibility_v1`, answers "what history may this exact human see in this
exact Shared World" as item identity and time only - never content and never a placeholder for hidden
history. It is the ONLY application/server-role historical visibility entry point in I-04F, and
`service_role` is its only executor. Availability dominates every mode, so no grant or entitlement can
reconstruct owner-deleted source.

**`occurred_at` means one thing, and it is frozen.** It is the canonical Shared-World
establishment/commit instant of the history item - the moment it became Shared truth in this exact
World - and that is the only reading under which comparing it against a membership episode is
correct. It is NOT an underlying recalled event time, source-event semantic timestamp or provenance
event time; those belong to I-04G material/provenance and must never be written here. The rule is
deployed as a `COMMENT ON COLUMN`, not left in a source comment, so the slice that later writes this
column meets it in the catalog. The distinction is load-bearing: if A says at `t2` "last week at `t1`
I changed jobs", the history item is established at `t2` and a member B really did receive it -
storing `t1` here would hide from B a statement B actually received.

**Owner deletion is terminal.** Once `availability_state` is `DELETED_BY_OWNER`, both availability
fields this migration owns are frozen exactly as they are: no higher revision can resurrect the item
as `AVAILABLE`, and none can relabel it `UNAVAILABLE` either, because the historical truth that its
*owner* deleted it is part of what must survive. The rule is scoped to those two owned fields and is
not a table freeze - a later reviewed slice may still append columns and write them. Whether
`UNAVAILABLE` is permanently terminal is deliberately not decided: frozen canon does not require it,
and an item that is merely unavailable may legitimately become available again.

```sh
npm run verify:shared-world-selective-history-access:integration
```

## I-04F - Standard World Closure (migration 0088)

`0088_shared_world_standard_closure_v1.sql` implements the second frozen law: an `ACTIVE / STANDARD`
Shared World ends by unanimous `END_WORLD` (CW2-03 section 31) and becomes
`READ_ONLY_CLOSED / STANDARD`, with the CW2-03 Final Freeze Review tightening F1 that comes with it.

Archival closure is not deletion: the World id, its phase, its whole history, its settings and its
governance record all remain. What changes is the lifecycle, the closure instant, and the fact that no
membership episode stays open. At the same instant every open episode closes in place with
`end_reason = WORLD_CLOSED`, and every exact current human receives one bounded
`CLOSED_WORLD_VIEW_ENTITLEMENT` plus its exact frozen item snapshot - exactly what that human could
resolve immediately BEFORE closure, captured through the one frozen I-04F visibility resolver while
the World is still ACTIVE.

The snapshot is exact rather than a rule evaluated later, so future material, future grants and future
episode objects cannot widen a closed entitlement - while later owner deletion still narrows it
dynamically, because the closed reader re-checks current availability on every read. An entitlement may
legitimately hold zero item rows and still truthfully represent a historical viewer. A human who had
already left before closure is never silently restored to browsing.

The entitlement is not membership: it carries no open, current or active state, and it needs no rule to
block ordinary activity because every ordinary Shared mutation primitive in 0083, 0085, 0086 and 0087
already requires `ACTIVE / STANDARD`. No blanket freeze is added, so a later reviewed
`PRIVACY_MATERIAL_MUTATION` such as owner deletion stays possible on a closed World without reopening
lifecycle. Pending member invitations terminalize through the reviewed I-04E topology trigger rather
than a second mechanism. Introduction closure is deliberately not implemented here.

`resolve_shared_world_closed_history_visibility_v1` is not a second resolver and not a second read
boundary: it is the implementation of the `READ_ONLY_CLOSED / STANDARD` branch of 0087's single entry
point, living here because the entitlement snapshot is what **this** migration owns. It is an INTERNAL
postgres-owned helper - migration 0088 grants nothing to anybody, so no application role executes it,
`service_role` included; its only caller is 0087's postgres-owned `SECURITY DEFINER` resolver, which
reaches it as its own owner. I-04F therefore keeps exactly ONE application/server-role historical
visibility entry point, `resolve_shared_world_history_visibility_v1`. The helper also refuses any World
that is not an archived Standard World, and consults no membership at all.

```sh
npm run verify:shared-world-standard-closure:integration
```
## I-04G - Shared Material Persistence (migration 0089)

`0089_shared_world_material_persistence_v1.sql` creates the actual Shared material that every
authority built by I-04A-I-04F governs. One material is one envelope bound one-to-one to exactly one
I-04F history item in exactly one Shared World, plus exactly one normalized body in the relation its
kind structurally requires. There is no universal JSON payload, no generic content column, no owner,
admin or moderator column and no mutable audience blob: the audience of a history item is the frozen
I-04F baseline-viewer relation and its material authority is the frozen I-04F required-approver
relation, and this slice adds neither a second history model nor a second audience model.

The frozen CW2-03 section 36 vocabulary is complete in the envelope. `HUMAN_TEXT`, `HUMAN_VOICE_NOTE`,
`QANDEEL_OUTPUT` and `QANDEEL_ANALYSIS` pin their producer exactly; `EXPLICIT_DISCLOSURE` and
`WORLD_EVENT_DERIVED_MATERIAL` are RESERVED and get no producer path at all, because neither has an
authority/source contract in this repository yet and inventing one would be engineering inventing
missing Product logic. Their body form is `RESERVED`, which no body relation accepts.

**The kind-to-body binding is structural.** `body_form` is CHECK-derived from `material_kind`, the
envelope carries `UNIQUE (id, body_form)`, and each body relation pins its own form and binds BOTH
columns by composite foreign key - so a text body on a voice note is a constraint violation rather
than a defect a reviewer must catch. The bodies are separate relations because owner deletion has to
be able to DESTROY a body while the envelope, the history identity and the provenance identity survive
as non-content history; a body in a column could only be nulled, a body in its own row can be
physically removed.

The text body is a real non-empty UTF-8 body with **no invented maximum**: no frozen contract states a
Product copy limit. The voice-note body keeps an opaque immutable server-side `audio_object_ref` that
is CHECKed to be neither a public URL nor a credential - no scheme separator, no query string, no
fragment, no credential-shaped token - plus an optional transcript and an optional positive
`duration_ms`. There is no `media_type` column, because the repository has no media-type convention to
follow. I-04G builds no storage provider, upload path or storage credential.

Provenance keeps the three frozen kinds apart by one exact-shape CHECK:
`MATERIAL_DEPENDENCY` names a committed Shared source material and no context, `REASONING_DEPENDENCY`
names an opaque bounded whitespace-free server-owned context reference and no material, and
`INDEPENDENT_TARGET_TRUTH` names neither. Reasoning influence therefore cannot be stored as material
provenance by accident, and raw private prose cannot be stored in a context reference.

**A `MATERIAL_DEPENDENCY` cycle is unrepresentable, not merely refused.** Each dependency row carries
both endpoints' exact `established_at`, bound by composite foreign key to the material each names, and
CHECKs that the source's instant is strictly EARLIER than the target's. Every edge therefore strictly
increases a total order, which also makes migration 0090's recursive invalidation traversal provably
terminating.

`resolve_shared_world_material_v1` is the only function here and the only thing any application role
may execute. It CONSUMES 0087's `resolve_shared_world_history_visibility_v1` - the single authority for
which history item identities a human may see - and intersects that answer with the material bodies
that still exist. It returns renderable material only: no row at all for an item the human may not see
or whose body is gone, and no provenance source identity, private context reference, material
authority row, dependency or membership data. Every direct relation stays sealed.

```sh
npm run verify:shared-world-material-persistence:integration
```

## I-04G - Shared Material Commit Runtime and Owner Deletion (migration 0090)

`0090_shared_world_material_commit_owner_deletion_v1.sql` creates the only things that ever write the
material store, and the only thing that ever destroys a body.

A material commit is ONE transaction that produces all of this or none of it: the envelope, its
normalized body, the I-04F history item that IS its Shared identity, that item's exact original human
audience, that item's exact human material authorities, its provenance record and the durable command
that answers an equivalent retry. `clock_timestamp()` is read EXACTLY ONCE and written to
`materials.established_at`, `history_items.occurred_at`, `history_items.registered_at` and
`commit_commands.committed_at`. No caller supplies baseline viewers, an approver, an episode, a count
or an instant.

**Material authority.** Human text and voice notes carry `EXACT_HUMAN_APPROVER_SET` with the exact
human author as the only required approver - membership does not co-own material owned by another
human; every other current member is a baseline VIEWER, which is a different relation and a different
meaning. QANDEEL output and analysis derive their required approver set as the exact UNION of the human
material authorities of their `MATERIAL_DEPENDENCY` sources; it is never every World member, and a
`REASONING_DEPENDENCY` contributes nothing to it. An empty union is written explicitly as
`NO_HUMAN_APPROVAL_REQUIRED`, and missing or contradictory source authority metadata fails the commit
closed rather than being read as approval-free.

The task also admits a second contributor to that union - exact protected-human subject authorities
from an already-reviewed server-owned authority source - **if such a source exists**. In this
repository it does not: the whole I-03 chain terminates at `materialDisclosureAuthority: NOT_GRANTED`
and `provenanceDisclosure: SEALED` and produces no protected-subject authority set. Accepting one as a
parameter would be an app supplying final authority claims, so this slice derives from dependencies
alone and leaves the second contributor to the reviewed slice that first builds a real source for it.

**The QANDEEL core is unreachable and its evidence is not a clearance.** It has no `auth.uid()` and no
human author. It binds the exact I-03 operation evidence of the output it commits, and binds it to the
exact BYTES: the supplied output digest must equal the digest of the body, and the supplied readiness
reference must equal the I-03G readiness fingerprint RECOMPUTED in SQL from its own four parts, so
evidence for one output cannot be replayed for another body or World. `UNIQUE (readiness_ref)` makes
one readiness commit at most one material. I-03G froze that `READY_FOR_LATER_DELIVERY_GATES` is not
System/Safety clearance, not Launch Gate clearance and not delivery or commit permission; the evidence
relation therefore carries no system-safety, launch-gate or delivery-permission column, the migration
refuses to deploy if one appears, and no fake Safety or Launch evidence is manufactured anywhere.

**Owner deletion** is a `PRIVACY_MATERIAL_MUTATION`. The deleting human is exactly `auth.uid()`, and a
human may delete their own human-authored material as a current member, a former member or a viewer of
an archived World - `READ_ONLY_CLOSED` does not block it and it never reopens the lifecycle. It makes
reconstruction impossible rather than merely hidden: the body row is PHYSICALLY REMOVED - human text,
audio object reference and stored transcript together - and the history item transitions to the
terminal `DELETED_BY_OWNER` through the frozen I-04F revision semantics. Envelope, history identity
and provenance identity remain as non-content history.

Every Shared target that is transitively source-content-bearing through `MATERIAL_DEPENDENCY` becomes
`UNAVAILABLE` and loses its body too, because it reproduces or contains the deleted source. It is NOT
marked `DELETED_BY_OWNER` - that would falsely claim its own owner deleted it - and its dependency
identity is never erased. `REASONING_DEPENDENCY` targets are ANALYTICAL derivatives and are not erased:
legitimate prior analysis may remain historical. A history grant audit and a closed-World entitlement
audit both survive a later owner deletion, while both resolvers stop returning the source.

Every consequential mutation locks `shared_worlds FOR UPDATE` first, then material, history and
dependency rows in deterministic identity order. There is no advisory lock, table lock or process
mutex. All five primitives are executable by no application role at all, `service_role` included: this
migration grants nothing to anybody, and 0089's read-only resolver stays the one material read
boundary.

```sh
npm run verify:shared-world-material-commit-owner-deletion:integration
```

## I-05A - Public World and Experience Foundation (migration 0091)

`0091_public_world_experience_identity_foundation_v1.sql` is the first Public World persistence in
the repository. It creates the ONE logical Public World, the audience-policy gate beside it, the
stable Public Identity a public authorship binds to, the mutable display label a public rendering
later uses, the stable Public Experience, its control authority, its immutable versions and the
append-only truth of its lifecycle transitions.

**Exactly one Public World is representable, not merely expected.** `public_world_state` is keyed on
a boolean that a CHECK pins to `true`, so the relation can hold exactly one row and a second Public
World cannot exist. Every Public object binds to the World through that same boolean by foreign key,
so "belongs to the one Public World" is a constraint rather than a convention. There is deliberately
no `public_world_id uuid`: the merged I-01A kernel's `PublicWorldRef` carries no identifier either,
because a singleton needs none, and a uuid here would be the first step towards a second one.

A `PUBLIC_EXPERIENCE` is an OBJECT inside that World, never a World. It is not a row in
`shared_worlds`, and it carries no world type, phase, birth basis, membership or governance - each of
which the migration refuses to deploy with.

**The audience policy is a gate, not identity.** `public_audience_policy_state` records the current
registered-member direction and keeps the frozen CW2-08 `SIGNED_OUT_PUBLIC_VIEW_POLICY` as
`UNRESOLVED`, which fails closed. Nothing references it by foreign key and no authority decision
reads it, so changing who may view Public World later creates no new World and alters no Experience
identity, version, manifest or fingerprint.

**The Public Identity ref is stable and opaque; the display label is not.** One Public Identity per
human in v1. `public_identity_ref <> user_id` is CHECKed, so the public ref is structurally distinct
from the private account identifier, and no relation here carries an email, phone, address,
credential or invite column - the migration refuses to deploy if one appears. Display labels are
`PSEUDONYM` or `REAL_NAME`, are deliberately NOT unique (uniqueness would invent a public namespace no
frozen contract states), assert no identity verification, and live in a relation with no foreign key
to an Experience, a version or a package - so an alias change creates no version and mutates no
manifest. Historical alias rendering is deferred, so there is no label history relation.

`EXPERIENCE_CONTROL_AUTHORITY` is a normalized `(Experience, controller)` relation rather than an
owner column, so a later reviewed multi-controller or transfer semantics is additive; I-05A invents
neither. `control_basis` is deliberately an open bounded string: no frozen contract enumerates control
bases, and pinning one here would force a later reviewed transfer to reopen this migration.

Experience Versions are immutable, ordinal within their Experience, bijective with their manifest, and
carry no semantic placement, coordinate, embedding, vitality or ranking column - semantic
interpretation binds to the exact version and belongs to I-05B. A version and a committed lifecycle
transition are append-only by TRIGGER rather than by privilege, because a privilege does not bind the
table owner.

The lifecycle vocabulary is complete - `DRAFT`, `READY_FOR_REVIEW`, `PUBLISHED`,
`ABSENT_FROM_PUBLIC_WORLD` - so I-05B and I-05C are additive. There is deliberately no trigger refusing
`PUBLISHED`: a guard a later authorized slice would have to remove is a ceiling on the roadmap rather
than an invariant of this one. PART A creates no writer at all, so it can produce no lifecycle; the
one function it owns is the append-only trigger function.

```sh
npm run verify:public-world-experience-foundation:integration
```

## I-05A - Publication Package and Authority (migration 0092)

`0092_public_experience_publication_package_authority_v1.sql` creates the IMMUTABLE PUBLICATION
PACKAGE those versions are made of: the manifest, its exact item set, the bounded PUBLIC derivative
each item carries, the SEALED internal provenance that says where each item came from, the exact
content rightsholder set derived from that provenance, and the manifest-bound human approvals. It
creates no writer; every primitive is migration 0093.

**The public payload and the source provenance are different relations, physically.** A Public
Experience stores a bounded public derivative, not a live pointer into its source: publication never
creates navigation back into a source World, Session, omitted material or future source update. So
`publication_package_manifest_items` and `public_experience_text_derivative_bodies` carry the payload
and the public classification and NO source identifier of any kind - no Session, turn, conversational
unit, Shared World, Shared material or history item - while
`publication_package_item_provenance` carries the exact source and is sealed against every application
role. That is provenance truth without provenance disclosure.

The derivative is a SNAPSHOT: the body row holds its own bytes, and no foreign key, trigger, rule or
view connects it to a source, so no later source update can rewrite it. There is no maximum length,
because no frozen contract states a Product copy limit.

**Reserved body kinds have no producer, and none is faked.** `public_body_form` admits `PUBLIC_TEXT`,
`PUBLIC_VOICE` and `RESERVED`; only `PUBLIC_TEXT` has a body relation. There is no durable Personal
voice or call source in this repository at all - `conversation_units.source_modality` is CHECK-pinned
to `TEXT` and no audio object exists anywhere in the Personal schema. A Shared `HUMAN_VOICE_NOTE` does
have a durable `audio_object_ref`, but that is an opaque server-side handle I-04G left for a future
reviewed media boundary; copying it into a public row would put a hidden source identifier in the
public payload and turn the derivative into a live pointer into private storage. A public voice
derivative therefore needs a reviewed public media boundary that mints a public object reference, and
building one here would be engineering inventing missing Product logic.

`REPLAY_ARTIFACT` is reserved as a source class with no identifier to bind: no Replay runtime exists.

**An item whose source authority is unresolved is UNREPRESENTABLE inside a package.**
`publication_package_item_authority` admits only `RESOLVED_EXACT_HUMAN_REQUIREMENT` and
`RESOLVED_NO_HUMAN_REQUIREMENT`. This is not reinterpreting unresolved as zero approvers: "we cannot
compute the requirement" and "we computed it and there is none" stay different facts, the second is
written only when the source state explicitly proves it, and the first cannot enter a package at all.
The unresolved state is deliberately not re-represented here - it is a property of the SOURCE and
already has exactly one canonical home in I-04G's `shared_world_material_historical_authority`, and a
second copy in the Public domain could drift from it. The representation stays additive: a later
reviewed protected-human subject-authority resolver moves the SOURCE row forward and the same material
becomes packageable with no change here.

`publication_manifest_required_approvers` is the `CONTENT_RIGHTSHOLDER_SET` and
`public_experience_controllers` is the `EXPERIENCE_CONTROL_AUTHORITY`. They are different relations
with no foreign key between them in either direction. An approval binds its approver into the DERIVED
required set by composite foreign key, exactly as the frozen I-04F history package does, so recording
an approval by a human the exact manifest does not require is structurally impossible however the row
is produced.

```sh
npm run verify:public-experience-publication-authority:integration
```

## I-05A - Draft / Approval / READY_FOR_REVIEW Runtime (migration 0093)

`0093_public_experience_review_ready_runtime_v1.sql` creates the only things that ever write any of
it. It can produce `DRAFT` and `READY_FOR_REVIEW` and nothing else: no primitive writes `PUBLISHED` or
`ABSENT_FROM_PUBLIC_WORLD`, no primitive creates a public serving surface, and no resolver here is
reachable by any public audience. Draft and review are not publication.

**Source-access authority is proven before any Shared body is copied.** Content publication authority
is not source-access authority: a rightsholder approving the widening of THEIR material says nothing
about whether the human assembling the package was ever entitled to see it. So for every selected
`SHARED_WORLD` item, preparation requires the initiating human to be CURRENTLY entitled to view that
exact history item, and only then reads the body. The entitlement question is not re-implemented here
— it consumes the canonical I-04F entry point `resolve_shared_world_history_visibility_v1`, which
already owns the whole meaning: the ACTIVE union of membership-period visibility and explicit history
grants, the `READ_ONLY_CLOSED` delegation to the exact frozen closure entitlement, the requirement of
an open episode, availability dominating every basis, and a truthful EMPTY answer rather than a
distinguishable error for a human with no standing. The refusal uses the same bounded class a
NONEXISTENT source gets, and runs before the kind, availability and authority checks, so nothing in
the error surface reveals whether a guessed identifier is real.

This is a different right from approval, in both directions. A former member whose material authority
survived their departure may still approve their own included material — and may still not use
preparation as a backdoor to retrieve it.

**The canonical Public mutation lock order** is the Public World singleton, then the exact Experience,
then the exact manifest, then `shared_worlds`, then `shared_world_materials`, then
`shared_world_history_items`, then `conversation_units` — each by id — then the rows it writes. That
order is not free: every I-04 consequential mutation that can change what a human may see (leave,
removal, rejoin, a history grant, Standard closure, owner deletion) locks `shared_worlds` FIRST, then
materials by id, then history items by id. This migration takes the SAME relative order, so the two
domains queue behind each other and can never form a cycle — I-04 never takes a Public lock, so no
Public lock can be the second edge of one. Holding the Shared World row is what stops the
source-view answer from going stale between resolution and the copy. Public source locks are SHARE
locks throughout: Public reads Shared truth and never writes it.

The two Public Identity primitives deliberately take no singleton lock - they touch one identity's own
rows, and serializing every display-label change in the product behind one global row would be a
bottleneck with no correctness benefit.

**One authority derivation, shared by preparation, approval and the READY commit.**
`derive_public_publication_authority_v1` recomputes from CURRENT state that every included source is
still available at the exact captured revision, that none carries unresolved additional human
authority, that the source authority metadata agrees in both directions, the exact
`CONTENT_RIGHTSHOLDER_SET`, and the `AUTHORITY_REQUEST_FINGERPRINT`. It fails closed rather than
returning a partial answer, and missing metadata is never an empty requirement.

The fingerprint binds the INTENDED PROTECTED ACTION, the target Public World, the Public World
audience class, the privacy/ownership readiness, the exact Experience, the exact prospective version,
the exact manifest, the exact publisher identity, the exact source scope, the exact derived
rightsholder set and the Public World authority snapshot version. It is DERIVED and never supplied, so
it is not a bearer token: it cannot authorize another package, Experience, version, source or
audience. It deliberately does NOT bind `PUBLIC_AUDIENCE_POLICY`, because who may currently view
Public World is a gate rather than the identity of a package.

**The action it binds is `PUBLISH_TO_PUBLIC_WORLD`, not the command that ran.** Preparing a package is
`PREPARE_PUBLICATION`, it lives in `publication_package_prepare_commands.command_action` with its own
request-reference namespace, and it is explicitly not audience expansion. What a rightsholder consents
to when they approve an exact immutable package is the future publication of that package, so that is
what `publication_package_manifest_versions.intended_publication_action` records and what their
approval is bound to. A frozen authority decision is request-bound and may not be replayed for a
different action, which is precisely why I-05B can revalidate THIS approval before executing
`PUBLISHED` instead of having to collect every human's consent a second time — and why a preparation
request reference can never read as a publication consent token.

Binding the future action changes nothing about what I-05A does: committing `READY_FOR_REVIEW`
performs no publication, widens no audience and creates no public visibility. I-05B must still
revalidate the exact manifest-bound authority, the EFFECTIVE approval state — a later reviewed
withdrawal or supersession object composes beside the append-only approval evidence, which I-05A
freezes nothing against — and the Safety, Launch and entitlement gates this slice evaluates none of.

**Source adapters.** `MY_WORLD` binds `conversation_units` - the committed Conversational Unit of
migration 0064, append-only for every role - and the actor must own it exactly. A `USER` unit is human
material whose exact owning human is the content authority; an `ASSISTANT` unit is Personal QANDEEL
analysis and FAILS CLOSED, because no reviewed server-owned producer of a protected-human subject
authority exists in this repository and accepting one from the caller would be exactly the
app-supplied authority claim the frozen contract forbids. `SHARED_WORLD` binds the exact I-04G
material, its exact I-04F history item and its exact availability revision, and takes I-04G's EXACT
material authority set for the exact included item. World membership contributes nothing: a human
appears in the rightsholder set only because material whose authority is theirs is actually in this
package, and a FORMER member whose material authority survived their departure may approve their own
included material without regaining any Shared browsing, because no primitive here reads membership at
all.

The public derivative is the exact committed source text. Sub-item portion selection is deliberately
not invented: a publisher selects which committed units to include, and the public body is provably a
faithful copy of authorized source rather than free text a caller could substitute for it. Item order
is derived canonically from the source scope, so the same selection always produces the same package.

**Committing `READY_FOR_REVIEW`** requires the exact controller, the Experience's CURRENT version (a
newer preparation stales the attempt), the complete derived approval set, and every approval still
carrying the currently derived fingerprint. A controller cannot substitute for a missing content
approval, and an approval grants no Experience control.

Every consequential primitive is postgres-owned, `SECURITY DEFINER`, `VOLATILE`, search_path-pinned and
executable by NO application role: the frozen CW2-08 Launch Gate precondition that would make any of
them reachable is unimplemented, so granting EXECUTE now would be manufacturing a launch decision
I-05A has no authority to make. The one read boundary, `resolve_public_experience_review_v1`, answers
the exact controller and nobody else, returns zero rows to anyone else, discloses no account
identifier or contact endpoint and never reads sealed provenance. It is not the Public World serving
resolver; I-05B creates that.

```sh
npm run verify:public-experience-review-ready-runtime:integration
```

## I-05B - Public Publication, Semantic Presence and Public Runtime v1 (migrations 0094-0097)

I-05B is the additive runtime layer above the frozen I-05A foundation. It owns: the effective state
of a historical approval, the ONE `READY_FOR_REVIEW -> PUBLISHED` transition, the canonical
`PUBLIC_VISIBILITY_STATE`, the Public World serving resolver, semantic interpretation bound to the
exact version with publisher correction, Public discussion and replies, `Public QANDEEL`, vitality,
and the search / lens / panel projections. Migrations 0091-0093 are byte-identical; every slice pins
them and their frozen I-04 / 0064 inputs by content.

**What stays non-public and sealed.** Sealed provenance, every account identifier, contact
endpoint, Shared World, Session, material, history item and storage handle. No I-05B relation
references `publication_package_item_provenance`, no resolver reads it, and every result column of
every Public read boundary is checked against a disclosure ban in the migration, in the verifier and
in the static contract.

**What I-05B does NOT own and leaves explicitly open.** `I-05C` owns deletion, complete public
disappearance, final source-unavailability handling, the full I-05 race matrix and I-05 closure: no
I-05B function can write `ABSENT_FROM_PUBLIC_WORLD`, and the visibility model is built so a later
non-serving lifecycle or an additional gate composed into the ONE derivation turns every surface dark
without rewriting any immutable record. A successor package for an Experience that is already
`READY_FOR_REVIEW` or `PUBLISHED` is not reachable: the frozen 0093 preparation admits `DRAFT` only,
and I-05B neither duplicates it nor invents a re-preparation path. A withdrawal recorded AFTER a
publication is durable truth whose public consequence I-05C decides; I-05B records it and does not
silently act on it. I-05 is not closed.

**The CW2-08 Safety / Launch / entitlement dependency.** No executable canonical runtime for System /
Safety policy, the Launch Gate or commercial entitlement exists in this repository, so the publish
boundary consumes ONE seam, `resolve_public_publication_prerequisites_v1`, whose only answer today is
`NOT_EVALUATED`, and requires exactly `CLEARED` from it. Production publication therefore fails closed
on `PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED` even when every authority gate is satisfied,
and no permissive constant, launch-ready row or application-role grant exists to make a test reach
`PUBLISHED`. The verifiers reach it only by replacing the seam body inside a transaction they roll
back, or inside a committed race section that restores the production body and proves the
restoration byte for byte. A later reviewed CW2-08 slice replaces the seam with the real gate and
nothing in the publish boundary changes. The seam is evaluated LAST, after every authority gate, so a
refused publication is refused for the true reason.

### I-05B - Effective approval state (migration 0094)

`0094_public_publication_effective_approval_state_v1.sql` composes beside the immutable 0092
approval evidence without touching it. The existence of an approval row is NOT perpetual consent.
Effective state is DERIVED by `derive_publication_approval_effective_state_v1` from three immutable
facts and one append-only act: `WITHDRAWN` when a withdrawal event exists (a human act dominates),
`SUPERSEDED` when the approval's manifest is no longer the Experience's current version's manifest (a
later preparation replaced the package; the approval binds the old manifest by foreign key and can
never float forward), `EFFECTIVE` otherwise. `derive_publication_manifest_effective_approvals_v1`
walks the DERIVED required set and reports `MISSING` for a required human who never approved.

`withdraw_publication_approval_v1` requires the exact historical rightsholder the approval represents
- `auth.uid()` compared with the immutable `approver_user_id` - and reads no Shared membership, no
controller row and no Public Identity: current membership is not rightsholder authority, control is
not consent, and a FORMER Shared member withdraws her own consent without regaining any browsing. A
withdrawal by anyone else, and a guessed identifier, receive ONE bounded class. The event is
append-only for every role, one per approval, and bound to ONE exact approval - its id, its manifest
and its approver, all read from the same immutable row - through one composite foreign key onto an
additive candidate key `(id, manifest_version_id, approver_user_id)` that 0094 adds to the frozen
approval table (a constraint; no row is touched and migration 0092 is not edited). Two independent
foreign keys would have let approval A's id travel with approval B's `(manifest, approver)` pair and
made the derivation report A as withdrawn while the row named B; the verifier proves that cross-pair
structurally unrepresentable for the event and the command, and proves the weakening back into two
independent keys is refused. Withdrawal takes the canonical Public lock prefix so it serializes with
publication. Everything is executable by no application role.

The frozen 0093 READY commit counts historical approval rows and is deliberately NOT the publication
gate: the verifier proves READY still commits after a withdrawal, which is exactly why 0095 must
re-read effective state at publish time.

```sh
npm run verify:public-publication-effective-approval-state:integration
```

### I-05B - Publication, canonical visibility and serving (migration 0095)

`0095_public_experience_publication_visibility_serving_v1.sql` creates the ONE protected transition
`publish_public_experience_v1`. A READY snapshot is trusted for nothing: under the canonical lock
order (singleton, Experience, manifest, `shared_worlds`, materials, history items, `conversation_units`)
it revalidates, in order, the exact controller (one class with a nonexistent Experience), lifecycle
`READY_FOR_REVIEW` and nothing else, the exact version - current, and the one the canonical READY
transition committed - the exact manifest of this Experience, current Shared visibility for the
PUBLISHING human through `resolve_shared_world_history_visibility_v1` (refused with the nonexistent-
source class), Personal ownership, the ONE I-05A authority derivation, the stored required set, every
required approval currently `EFFECTIVE` through the ONE 0094 derivation (`MISSING`, `WITHDRAWN` and
`SUPERSEDED` refuse; a different bound fingerprint is stale), the READY commit's own recorded
fingerprint, and LAST the CW2-08 prerequisite seam. Then, in one transaction: lifecycle `PUBLISHED`,
an immutable publication record naming the exact version, manifest, fingerprint and clearance basis,
the append-only transition, the durable command. No failure leaves anything partial.

The record and the command bind version, Experience and manifest as ONE exact version row: one
composite foreign key onto an additive candidate key `(id, experience_id, package_manifest_version_id)`
that 0095 adds to the frozen version relation (a constraint; migration 0091 is not edited). A record
naming version V1 beside the manifest of V2 of the same Experience is therefore structurally
unrepresentable - two independent keys would have admitted it - and the version's ordinal is read
from the bound version row, never duplicated into the record. The verifier proves the mismatched pair
refused for both relations and the weakening back into independent keys refused.

**Canonical `PUBLIC_VISIBILITY_STATE`.** `resolve_public_visibility_state_v1` is the ONE serving
truth: `PUBLICLY_VISIBLE` only when the lifecycle is `PUBLISHED`, an immutable publication record
exists, the recorded version is the Experience's CURRENT version and its manifest is the recorded
manifest. Everything else - `DRAFT`, `READY_FOR_REVIEW`, a missing record, a moved pointer, a later
non-serving lifecycle, an identifier that names nothing - is ONE state, `NOT_PUBLICLY_VISIBLE`. Raw
lifecycle is never the serving truth, and no consumer tests a lifecycle string for itself.
`resolve_public_audience_admission_v1` is the separate VIEWER gate over the frozen 0091 policy: a
signed-out viewer is admitted only when the frozen requirement is resolved `ALLOWED` (it is
`UNRESOLVED`, so it is not); a registered viewer must be a real account.

**The ONE serving resolver** `resolve_public_experience_serving_v1` composes both gates and returns
the bounded public derivative in package order with the publisher's stable ref and CURRENT label. It
returns zero rows for nonexistent, `DRAFT`, `READY_FOR_REVIEW`, moved-pointer and not-admitted alike,
never reads sealed provenance, and is service_role-executable alone, following the frozen narrow
resolver precedent; every table stays deny-by-default and every other function is internal.

```sh
npm run verify:public-experience-publication-visibility-serving:integration
```

### I-05B - Semantic placement, discussion and Public QANDEEL (migration 0096)

`0096_public_semantic_placement_discussion_qandeel_v1.sql` binds semantic interpretation - a lens key
and a bounded semantic label - by composite foreign key to ONE exact immutable version of ONE exact
Experience. Publisher correction is ADDITIVE and AUDITABLE: every placement row is append-only, a
correction is the next `placement_revision` for the same version, and the current-effective
interpretation is the highest revision. `record_public_experience_semantic_placement_v1` requires the
exact controller and writes a placement row and its command and nothing else - the verifier snapshots
every version, package, body, provenance, approval, control, publication and lifecycle row before and
after a correction and proves them identical. The descriptor set is deliberately minimal: no
coordinate, embedding or ranking is invented; a later reviewed spatial model composes beside it by the
same version key. A correction that would need a different public payload is not a correction; it is
a new package through the frozen preparation path.

**Discussion** authority is its own authority. `post_public_discussion_v1` needs an authenticated
human, their own stable Public Identity (resolved, never supplied) and a target the canonical
visibility truth serves to an admitted viewer; it requires no control, grants none, reads no approval,
and a controller posts on the same terms as anyone else. A post binds the exact version that was
visible when it was made; a reply binds a parent of the SAME Experience by composite foreign key.
`DRAFT`, `READY_FOR_REVIEW`, nonexistent and missing-parent targets receive ONE bounded class. Posts
are ordered by a per-Experience ordinal derived under the Experience lock and are append-only here.

**Public QANDEEL** is machine state: `record_public_qandeel_response_v1` derives no human from
`auth.uid()`, its relation carries no author, account or approver column, it binds the visible
version, an optional reply target and the consumed posts of the same Experience, and it records a
context fingerprint over PUBLIC-domain identities only - Experience, version, manifest, current
placement revision, reply target, consumed posts - recomputed byte for byte by the verifier. It
creates no consent, no control and no rightsholder authority. Three service_role resolvers serve
placement, discussion and responses; each composes both canonical gates.

**Exact-version closure.** Every post and response binds the exact version it was made against, and
that binding is what is served: the discussion and Public QANDEEL resolvers return rows bound to the
CURRENTLY visible version only, a reply targets a post of the visible version, and Public QANDEEL
replies to and consumes posts of the visible version only - a superseded version's conversation is
never silently served, extended or consumed as the current version's. What a later reviewed successor
publication does with earlier conversation is that slice's decision; I-05B chooses no Experience-wide
policy. The verifier proves it against a simulated successor version with real V1 history behind it
(a verifier-only simulation, rolled back): V1 rows are not served, replied to or consumed as V2's, and
V2 conversation through the same writers is.

```sh
npm run verify:public-semantic-placement-discussion-qandeel:integration
```

### I-05B - Vitality and search / lens / panel projections (migration 0097)

`0097_public_vitality_search_lens_panel_projections_v1.sql` creates derived state that is rebuilt and
never trusted. `recompute_public_experience_vitality_v1` counts the public discussion and Public
QANDEEL activity bound TO the visible version - a superseded version's activity is its own history,
never the current version's heat - and writes only when the canonical answer differs from what is
stored (`VITALITY_UNCHANGED` otherwise); for a non-visible target it writes nothing. The verifier
proves, against a simulated successor version, that vitality computed for V2 counts none of V1's
activity and that the V1 row is never served as V2's.
`rebuild_public_experience_projection_v1` builds the search document from the public derivative
bodies of the visible manifest in package order plus the current semantic label, with the `simple`
text-search configuration (no ranking policy is invented), and DELETES the projection of an
Experience that is not publicly visible, so no projection outlives the visibility it was derived from.

Every read path - `resolve_public_experience_vitality_v1`, `search_public_experiences_v1`,
`resolve_public_lens_v1`, `resolve_public_panel_v1` - composes the ONE visibility derivation with the
admission gate again and serves a stored row only while it describes the CURRENTLY visible version, so
a stale projection or a planted vitality row is never an independent source of truth and can never
make an invisible Experience visible. Display labels are joined live, never copied. A later reviewed
slice that ends public presence turns every read dark through the ONE derivation and clears the
projection on the next rebuild without rewriting any historical post, response or placement.

```sh
npm run verify:public-vitality-search-lens-panel-projections:integration
```


## I-05C - Public Disappearance, Source-Loss Enforcement and I-05 Closure v1 (migrations 0098-0099)

I-05C is the final implementation slice of `I-05 - Public World Runtime`. It owns everything I-05A and
I-05B deliberately deferred: explicit removal from the Public World, complete public disappearance,
the final post-publication consequences of rightsholder withdrawal and source unavailability, the
remaining I-05 race matrix, and I-05 implementation closure. It is additive: migrations 0091-0097 are
byte-identical, every I-05C contract pins them by content, and the only two statements that touch a
frozen relation are additive candidate keys that touch no row.

**The one invariant.** If an exact published Public Experience ceases to be legitimately public for
any I-05C-governed reason, every Public World consumer stops exposing it IMMEDIATELY through canonical
serving truth - not after a projection rebuild, a queue, a cron, a cleanup job or a lifecycle
reconciliation pass. That is why the slice is two migrations and in this order: `0098` is pure
derivation and writes no row anywhere, and `0099` is the durable convergence that follows. Privacy
therefore cannot depend on the convergence, and the split is the proof rather than the claim - after
0098 alone a withdrawn approval or a lost source already turns every surface dark, and 0099 does not
yet exist.

### I-05C - Continuing public eligibility and canonical visibility closure (migration 0098)

`0098_public_continuing_eligibility_visibility_closure_v1.sql` creates ONE derivation,
`derive_public_continuing_eligibility_v1`, and replaces the canonical visibility derivation additively
through `CREATE OR REPLACE` - the repository forward method - with the identical signature and the
identical five result columns, so migration 0095 is not edited and every frozen consumer keeps reading
the same shape. It creates no table, no trigger, no index and no policy, writes no row, grants nothing,
and cannot write `ABSENT_FROM_PUBLIC_WORLD`.

**CONTINUING PUBLIC ELIGIBILITY invents no rule.** It re-asks, of CURRENT state and over the exact
immutable package the publication record names, exactly the gates migration 0095 asked before it
allowed the publication:

1. the frozen I-05B publication binding - lifecycle `PUBLISHED`, an immutable publication record, the
   recorded version is the CURRENT version and its manifest is the recorded manifest;
2. every required approval currently `EFFECTIVE` through the ONE 0094 derivation, each still bound to
   the fingerprint the publication recorded - `MISSING`, `WITHDRAWN` and `SUPERSEDED` each refuse;
3. every included source still available at the exact captured revision with resolved authority and
   non-contradictory metadata, through the ONE I-05A derivation;
4. the derived `CONTENT_RIGHTSHOLDER_SET` still equal to the stored one.

All four are properties of the PACKAGE. No actor reaches the derivation - not the viewer, not the
controller, not the publisher, and no `auth.uid()` - so continuing eligibility is a property of the
EXPERIENCE rather than of whoever happens to be reading it. Current Shared membership is never a proxy
for source access or for rightsholder authority, and the derivation reads no membership episode, no
history grant, no closed-World entitlement and no Experience control at all.

**Source AVAILABILITY is a continuing condition; actor source ACCESS is not.** The frozen runtime asks
an actor question of a similar shape, and this derivation is deliberately not it. Migration 0095 gate 6
is labelled `CURRENT SOURCE ACCESS FOR THE PUBLISHING HUMAN`: at the consequential instant of
publication it asks whether `auth.uid()` may still SEE each included Shared history item, through the
canonical I-04F entry point `resolve_shared_world_history_visibility_v1`. That is an actor gate on an
operation, and it remains exactly where it is. It is **not** re-asked afterwards. A publisher who later
leaves the Shared World, is removed from it, or falls outside a closed-view entitlement loses BROWSING;
the source they published is untouched - still `AVAILABLE`, still at the captured availability revision,
still the exact bytes the package digested. Letting one human's later browsing status delete everyone
else's Public view would be new Product policy, and no frozen contract states it: 0095 scopes that call
to that instant, and nothing in 0091-0097 re-asks it. Inferring a perpetual rule from a publish-time
gate is precisely the inference that is not available.

What genuinely belongs here is source availability and INTEGRITY, and step 3 is already exactly that
truth, actor-free: the ONE I-05A derivation refuses when an included Shared history item is no longer
`AVAILABLE` or its availability revision moved, when the Shared body is gone or its bytes no longer
match the captured digest, and when the Personal committed unit is gone, is owned by someone other than
the captured owner, or no longer digests to the captured value. Owner deletion - the canonical I-04G act
that really does take a source away - moves the item to `DELETED_BY_OWNER` and bumps the revision, so it
fails closed there, for the reason that is actually true. The migration refuses at DEPLOY time if the
continuing derivation ever asks the actor question, and `verify-migration-0098.mjs` proves both halves
live: a publisher stripped of Shared browsing leaves the publication served in full, and the same
fixture in the same state goes dark the moment the source really becomes unavailable.

**What it deliberately does not re-check, and why.** Not the CURRENT authority request fingerprint
against the published one. Every input of that fingerprint is immutable for a published package except
two: the derived rightsholder set, which step 4 compares exactly, and `authoritySnapshot`, the Public
World envelope version. Migration 0092 states what that version is for in as many words - a later
reviewed change to the Public World envelope stales an IN-FLIGHT package instead of silently applying
to it. Turning it into a retraction of every already-published Experience would be a new Product
policy, and I-05C invents none.

**Controller authority is not a continuing-eligibility condition, and that is a finding.** Nothing in
migrations 0091-0097 can remove, transfer or revoke a controller row: `create_public_experience_draft_v1`
is the ONLY writer of `public_experience_controllers` in the repository and there is no counterpart.
Controller loss therefore has no canonical producer, the frozen contracts say only that control decides
who may ISSUE a control action, and I-05C does not invent a consequence for an event the repository
cannot produce. Control is not content consent (CW2-04 D8), and this derivation keeps them apart by
never reading control.

**Fail closed, disclose nothing.** The derivation answers `ELIGIBLE` or `INELIGIBLE` for any non-null
identifier, including one that names nothing, and never raises for a target it cannot find. The two
frozen derivations it consumes DO raise, so each call is wrapped and every raise becomes an
`INELIGIBLE` answer: the source class for the frozen `P0002`, the authority class for anything else.
Its `ineligibility_class` is a bounded INTERNAL vocabulary of five values - `NOT_PUBLISHED`,
`PUBLICATION_BINDING_INVALID`, `REQUIRED_APPROVAL_NOT_EFFECTIVE`, `PUBLISHED_SOURCE_NOT_AVAILABLE`,
`PUBLICATION_AUTHORITY_INVALIDATED` - none of which names a source, a World, a Session, a human, a
revision or a digest, and none of which ever reaches a Public surface.

**Canonical visibility keeps its shape and its silence.** `resolve_public_visibility_state_v1` remains
the ONE Public visibility truth and still answers exactly two states, so nonexistent, `DRAFT`,
`READY_FOR_REVIEW`, never-published, `ABSENT_FROM_PUBLIC_WORLD`, source-unavailable, consent-withdrawn,
authority-invalidated and audience-not-admitted all remain ONE bounded non-serving class outwardly. It
still reads no viewing policy - the visibility of the OBJECT and the admission of the VIEWER are
different gates - and it depends on no projection, so there is no cycle in which a projection's own
write eligibility could decide whether the projection is servable. `PUBLISHED` is now necessary and no
longer sufficient.

**The complete-disappearance consumer list.** Every outward Public World surface reads that ONE
derivation and goes dark together: `resolve_public_experience_serving_v1`,
`resolve_public_experience_semantic_placement_v1`, `resolve_public_discussion_v1`,
`resolve_public_qandeel_responses_v1`, `resolve_public_experience_vitality_v1`,
`search_public_experiences_v1`, `resolve_public_lens_v1` and `resolve_public_panel_v1`. The verifier
holds that census against the live catalog, so a NEW outward Public resolver that bypassed visibility
could not hide from it. Every public WRITE path revalidates the same truth at execution time under its
own lock: `post_public_discussion_v1` and `record_public_qandeel_response_v1` hold the Experience row
`FOR UPDATE`, and `recompute_public_experience_vitality_v1` and
`rebuild_public_experience_projection_v1` hold it `FOR SHARE`. A stale projection row or a planted
vitality row is never an independent source of truth: the frozen readers serve a stored row only while
it describes the CURRENTLY visible version, and a rebuild deletes the projection of an Experience that
is not publicly visible.

```sh
npm run verify:public-continuing-eligibility-visibility-closure:integration
```

### I-05C - Public Experience disappearance runtime (migration 0099)

`0099_public_experience_disappearance_runtime_v1.sql` is the durable convergence. Everything in it runs
AFTER canonical truth has already gone dark; what it adds is that the lifecycle stops CLAIMING
`PUBLISHED`, that the disappearance is auditable, and that the one derived relation retaining a copy of
the public text stops retaining it. It introduces no scheduler, daemon, queue, webhook or cross-service
event system: the reconciliation is a DB-owned deterministic primitive in the exact shape the frozen
0097 derived-state writers already use.

**The ONE controlled path.** `apply_public_experience_disappearance_v1` is the only thing in the
repository that writes `ABSENT_FROM_PUBLIC_WORLD`. Both consequential primitives delegate to it and
contain no lifecycle assignment of their own. It reads the exact version and manifest that disappear
FROM the immutable publication record rather than from a parameter, refuses any predecessor state but
`PUBLISHED` bound to its own current version, appends the transition to the frozen 0091 append-only
lifecycle truth on ONE database-owned instant, writes the sealed evidence, and deletes the derived
search / lens projection as defense in depth. No I-05C function writes a serving lifecycle at all, so
nothing here reactivates an absent Experience; the frozen 0093 preparation admits `DRAFT` alone, so an
absent Experience reaches no successor package either. Whether a reviewed republication path should
exist is a question migrations 0091-0097 do not answer, and I-05C does not answer it by accident:
absence is terminal here. There is deliberately no trigger refusing the value schema-wide - a guard a
later authorized slice would have to remove is a ceiling on the roadmap - and none is needed: the
application roles hold no privilege at all on `public_experiences`, which keeps row security on with
zero policies, and every primitive here is executable by none of them.

**Authorized removal.** `remove_public_experience_from_public_world_v1` derives the removing human from
`auth.uid()` and requires EXPERIENCE CONTROL AUTHORITY over the exact Experience. There is no
controller, actor, authority, basis or force parameter, and current Shared membership is never
consulted: a content rightsholder who is not a controller cannot remove, and a controller who is not a
rightsholder can, because removing your own Public Experience is a container act. A stranger, a
non-controller and a nonexistent Experience receive ONE bounded class; a command identity reused
against a different target is refused before anything about that target is read, so idempotency keys
cannot probe either. The caller names the exact published version and the manifest is read from the
record, so the command row binds ONE exact publication. A `DRAFT` and a `READY_FOR_REVIEW` Experience
were never in the Public World, so there is nothing to remove from it and both are refused. A repeated
legitimate removal converges: the same command identity replays its committed answer, and a fresh
command against an already-absent Experience answers `ALREADY_ABSENT`.

**Deterministic reconciliation.** `reconcile_public_experience_disappearance_v1` is machine state - no
`auth.uid()`, no human, no control read - that asks the ONE continuing-eligibility truth under the
canonical locks and converges the lifecycle to match an answer that was already true before it ran.
Its outcomes are bounded and deterministic for the same database state: `DISAPPEARANCE_CONVERGED`,
`STILL_ELIGIBLE`, `ALREADY_ABSENT` and `NOT_APPLICABLE`.

**One vocabulary, no translation layer.** `disappearance_basis` is the authorized act plus the three
convergeable ineligibility classes, spelled identically to 0098 so the reconciliation passes the class
straight through: `AUTHORIZED_CONTROLLER_REMOVAL`, `REQUIRED_APPROVAL_NOT_EFFECTIVE`,
`PUBLISHED_SOURCE_NOT_AVAILABLE`, `PUBLICATION_AUTHORITY_INVALIDATED`. `PUBLICATION_BINDING_INVALID` is
deliberately NOT a basis: a `PUBLISHED` Experience whose binding does not hold is contradictory state
rather than a disappearance cause, no canonical primitive can produce it, and serving is already dark
for it - so the reconciliation reports `NOT_APPLICABLE` and writes nothing rather than inventing a
reason. Convergence never rewrites a recorded basis: the first cause is the one the audit keeps.

**Retained sealed evidence, and nothing erased.** Disappearance is zero public exposure, not a pretence
that the event never happened internally. The version, the manifest, the items, the public bodies, the
sealed provenance, the per-item authority, the required approver set, the approvals, the withdrawals,
the publication record, every earlier lifecycle transition and the internal discussion, placement and
Public QANDEEL history all survive exactly as they were, and the verifier snapshots every one of them
before and after and proves them identical. The ONE derived row removed is the search / lens
projection, for the same reason the frozen 0097 rebuild removes it; vitality is left exactly as 0097
leaves it - two counts and an instant, servable only for a visible version, carrying no public content.
The disappearance record itself is append-only for every role including the table owner, one per
Experience, sealed, and carries no cause detail, no free text and no source identifier. It is readable
only through `resolve_public_experience_disappearance_audit_v1`, which is INTERNAL: reading why an
Experience disappeared is a private cause, so there is no Public or ordinary-role disappearance surface
at all.

**Exact bindings.** Both relations bind ONE exact publication row - Experience, published version and
published manifest read from the same immutable record - through one composite restrictive foreign key
onto an additive candidate key `(experience_id, published_experience_version_id,
published_manifest_version_id)` that 0099 adds to the frozen 0095 record. Two independent keys would
have admitted a disappearance naming version V1 beside the manifest of V2, or a record for an
Experience that never published; the verifier proves both unrepresentable and proves the weakening back
into independent keys refused AND able to admit exactly what the exact binding refuses.

**Lock order.** Both primitives take a PREFIX of the canonical Public order migrations 0093 and 0095
established - `public_world_state FOR UPDATE`, then `public_experiences FOR UPDATE`, then for the
reconciliation the exact manifest `FOR SHARE` and the exact sources in the frozen I-04 order
(`shared_worlds`, `shared_world_materials`, `shared_world_history_items`, `conversation_units`, all
`FOR SHARE`) - and neither takes anything in a different relative order, so a removal, a
reconciliation, a publication and a withdrawal queue behind one another and can never cycle. The
removal consults no source and takes no source lock; the reconciliation consults every source through
continuing eligibility and holds them while it decides AND while it writes, so the eligibility answer
cannot go stale between the decision and the transition. No advisory lock, table lock, `TRUNCATE` or
process mutex exists anywhere in I-05C.

```sh
npm run verify:public-experience-disappearance-runtime:integration
```

### I-05C - the proven race matrix

Both orderings, and true concurrency on two connections with database-enforced wait bounds, are proven
on real PostgreSQL. Publication versus withdrawal in both orders, publication versus a competing
preparation, duplicate publication and publication versus source deletion were already proven by the
I-05B 0095 verifier and remain proven there, with one behaviour now different: a withdrawal that
commits after a publication no longer leaves the publication visible. I-05C adds: withdrawal versus a
public discussion write; source loss versus a Public QANDEEL write in both orderings; a projection
rebuild that BEGAN before the disappearance and cannot commit a newly servable stale result after it;
publication completion versus disappearance enforcement; duplicate removal from two connections;
removal versus withdrawal; reconciliation versus removal, where two independent ineligibility reasons
converge on ONE absent result; and removal versus a public write. Every one resolves as one operation
winning while the other safely refuses, or both converging to the same canonical state, or a later
operation observing and respecting the earlier committed state. No test expects a deadlock, and none
occurs.

One race resolves by design rather than by blocking, and the verifier proves the honest outcome: the
frozen 0096 writers take the Experience row and no Shared lock, because they consume no source, so a
public write that commits before an owner deletion commits does land internally. It is served to
nobody - every read path re-evaluates canonical visibility - which is exactly the frozen model: rows
may remain internally where audit requires it, but they become unservable.

### I-05C - CW2-08 status and I-05 closure

The CW2-08 Safety / Launch Gate / commercial-entitlement prerequisite is UNCHANGED and still has no
executable canonical runtime in this repository. `resolve_public_publication_prerequisites_v1` still
answers only `NOT_EVALUATED`, the publish boundary still requires exactly `CLEARED`, and production
publication therefore still fails closed on `PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED` even
when every authority gate is satisfied. `SIGNED_OUT_PUBLIC_VIEW_POLICY` is still `UNRESOLVED`, so the
signed-out audience is still not admitted. I-05C manufactures no launch readiness: it adds no
permissive constant, no launch-ready row and no application-role grant, and its verifiers reach
`PUBLISHED` only by replacing the seam inside a transaction they roll back or inside a committed
section that restores the production body and proves the restoration byte for byte.

`I-05` implementation is complete: 0091-0099 leave no Public World capability that I-05A, I-05B or
I-05C deferred to a later slice. The repository's own governance precedent permits that closure while
the external prerequisite remains fail-closed - the I-04 closure record in
[`docs/qandeel-canonical-backlog-v1.md`](../docs/qandeel-canonical-backlog-v1.md) records CW2-08 as a
boundary owned by its own frozen contract rather than as an obligation of the implementing phase, and
I-04 closed on exactly that basis. The formal register act belongs to Architecture under BG-08 and
BG-09; the I-05 closure record this slice writes there states the same thing.

**I-05 implementation closure is not launch readiness.** The Public World cannot serve anybody in
production today, and saying so is the point: publication fails closed, the signed-out policy is
unresolved, and every consequential primitive is executable by no application role. A later reviewed
CW2-08 slice replaces the seam with the real gate and nothing in the publish boundary, the visibility
truth or the disappearance runtime changes.

## I-06A - Replay Foundation, Authorized Source Capture and Draft Runtime v1 (migrations 0100-0101)

`I-06A` opens `I-06 - Replay Runtime`. The full phase document is
[`docs/replay-runtime-v1.md`](../docs/replay-runtime-v1.md); this section records the substrate and how
to run its verifiers. `I-06` is ACTIVE and `I-06A` is a CANDIDATE awaiting independent review.

A Replay is a source-bound derived artifact - `MATERIAL_ARTIFACT` of kind `REPLAY_ARTIFACT` in the
merged I-01A kernel - and never a World. The slice implements `REPLAY_CREATION_AUTHORITY` only.
Creation authority and distribution authority are different architecture concepts and live nowhere
near each other: no relation here carries a public, share, download, distribution approver, Premium,
Safety or Launch column, and migration 0100 refuses to deploy if one appears.

**There is deliberately no `REPLAY_VERSION`.** A canonical Replay Version binds four components -
source manifest, selection spec, analytical projection and render contract. I-06A owns the first two;
the projection and the render contract are I-06B. Rather than write a version bound to two real
components and two placeholders, the stable Replay carries a private DRAFT composition and the first
complete Replay Version belongs to the slice that can bind all four truthfully.

### I-06A - Replay foundation persistence (migration 0100)

`0100_replay_foundation_source_manifest_selection_v1.sql` is persistence only. It creates no writer,
grants nothing and writes no row. Six relations:

| Relation | Role |
| --- | --- |
| `replays` | the stable identity: creator, lifecycle `DRAFT` / `PREVIEW_READY` / `FINALIZED`, birth instant |
| `replay_source_manifest_versions` | one immutable manifest bound to ONE authorized source context |
| `replay_source_manifest_items` | its exact item set in canonical source order |
| `replay_selection_spec_versions` | one immutable resolved selection over one exact manifest |
| `replay_selection_spec_items` | the selected items with exact source-native anchors |
| `replay_draft_state` | the ONE mutable current-composition pointer |

The manifest binds exactly one context per class - a Personal Session the creator owns, one Shared
World, or one exact Public Experience Version - through `creation_authority_basis` pinned by CHECK to
`PERSONAL_SOURCE_OWNERSHIP`, `SHARED_HISTORY_VISIBILITY` or `PUBLIC_EXPERIENCE_CONTROL`. Items carry a
one-way `sha256:` canonical source-identity digest and no content: there is no body, text, transcript,
audio reference, payload or JSON column in the slice, no foreign key to any body relation that owner
deletion destroys, and no reference at all to `publication_package_item_provenance`.

`captured_source_digest` is the canonical BODY-IDENTITY digest each substrate already defines, recorded
so a later revision is detectable - not an independent attestation of media bytes. For Personal source
it is sha256 over the committed unit's exact UTF-8 text; for Shared text, sha256 over the material body
text; for a Public item, that item's own `public_body_digest`; and for a Shared `HUMAN_VOICE_NOTE` it
follows the frozen I-04G convention of sha256 over the opaque audio object REFERENCE and the transcript,
which does NOT attest the underlying audio media bytes and grants no media delivery capability. This
slice does not rename or redesign that convention.

Foreign keys prove each source row EXISTS; they cannot prove the several columns an item stores came
from the SAME row. A Replay-owned `BEFORE INSERT` guard proves that, for every role including the table
owner: a Personal id, Session, Session Position and role must be ONE `conversation_units` row; a Shared
material id, world and `history_item_id` must be ONE material row whose history item carries the
captured instant; and a public ordinal and classification must be read from the exact package item
named. It acts only once both compared parents exist, so it never preempts a foreign key, and it reads
identity and never content. No candidate key was added to any frozen predecessor table.

`FULL_SOURCE` is representable only over a manifest that captured the complete authorized universe,
selected whole and contiguously - `universe_complete` is GENERATED from the captured counts and bound
by composite foreign key, so a caller cannot self-assert completeness. The other coverage classes are
`SELECTED_EXCERPT` and `HIGHLIGHT_SELECTION`. A `BEFORE INSERT` trigger makes a chronology reversal
unrepresentable rather than merely refused. Every component relation is append-only for every role
including the table owner, and every relation is postgres-owned with RLS on, zero policies and zero
application-role privileges.

### I-06A - Authorized source capture and draft runtime (migration 0101)

`0101_replay_authorized_draft_runtime_v1.sql` adds the two typed command relations and eight
functions. The two human primitives - `create_replay_draft_v1` and `revise_replay_draft_v1` - derive
the human from `auth.uid()` and accept no actor, authority, audience, order, digest, medium or
completeness parameter. `resolve_replay_draft_composition_v1` is the ONE read boundary: it answers the
exact creator, returns zero rows to everybody else, and discloses no source identity of any kind.

Source adapters, truthfully:

```text
MY_WORLD text                      SUPPORTED from canonical conversation_units, owner-exact
MY_WORLD original audio / call     NOT PRODUCIBLE - no durable canonical source exists
SHARED_WORLD HUMAN_TEXT            SUPPORTED when exact history visibility allows
SHARED_WORLD HUMAN_VOICE_NOTE      source identity SUPPORTED; no media delivery is claimed
SHARED_WORLD QANDEEL_OUTPUT        SUPPORTED when exact history visibility allows
SHARED_WORLD QANDEEL_ANALYSIS      SUPPORTED when exact history visibility allows
reserved Shared kinds              NOT PRODUCIBLE - unrepresentable by CHECK
owned PUBLIC_EXPERIENCE            SUPPORTED only through exact Experience CONTROL
Replay-of-Replay                   NOT IMPLEMENTED
```

Shared eligibility consumes the ONE canonical entry point
`resolve_shared_world_history_visibility_v1` and is never re-derived from membership. Public
eligibility requires an exact `public_experience_controllers` row for the creating human and is never
taken from `resolve_public_visibility_state_v1`; the capture binds the bounded public derivative of the
exact controlled current version as ONE row through the additive 0095 candidate key, and never
traverses the sealed provenance. `derive_replay_source_manifest_currency_v1` is the ONE currency
derivation, answering availability before access.

Every consequential primitive, both internal cores, the lock helper and the currency derivation are
executable by no application role, pending a reviewed CW2-08 wrapper. `service_role` alone may execute
the read boundary.

### I-06A - lock order

```text
replays FOR UPDATE
  -> MY_WORLD          session_semantic_clocks, then conversation_units by id, FOR SHARE
     SHARED_WORLD      shared_worlds, then materials by id, then history items by id, FOR SHARE
     PUBLIC_EXPERIENCE public_world_state, then public_experiences, then the package, FOR SHARE
  -> Replay component writes
```

The Replay object is taken first and each source domain keeps its own frozen relative order, so no
Replay path can invert against a predecessor writer. The migration asserts this ordering of its own
text at deploy time.

### I-06A - verifier commands

```bash
npm run verify:replay-foundation-source-manifest:integration
npm run verify:replay-authorized-draft-runtime:integration
```

Both need `DATABASE_URL` pointing at a FULLY migrated database and are run in CI as one reported group
after the I-05C group. They roll back or explicitly remove every fixture they create and prove the
residue is zero.

## I-06B - Replay Analytical Projection, Render Truth Contract and Preview / Finalization v1 (migrations 0102-0103)

`I-06B` continues `I-06 - Replay Runtime`. The full phase document is
[`docs/replay-runtime-v1.md`](../docs/replay-runtime-v1.md); this section records the substrate and how
to run its verifiers. `I-06` is ACTIVE and `I-06B` is a CANDIDATE awaiting independent review.

I-06A owned two of the four truth components and refused to fake the rest. I-06B creates the missing
two and therefore the FIRST canonical complete `REPLAY_VERSION`: every row binds the source manifest
version, the selection spec version, the analytical projection version and the render contract version,
all four NOT NULL and bound as ONE composition by composite foreign keys. There is no nullable truth
component, no placeholder and no `PENDING` projection.

### I-06B - immutable truth components (migration 0102)

`0102_replay_analytical_projection_render_contract_versioning_v1.sql` is persistence only. It creates
no writer, grants nothing and writes no row.

| relation | what it is |
| --- | --- |
| `replay_analytical_projection_versions` | one immutable commitment to the canonical analytical state over the represented points |
| `replay_analytical_projection_points` | one point per selected item: the represented TC, the sealed answer and the state digest |
| `replay_semantic_cut_assessments` | one immutable Semantic Cut Safety assessment per selected item |
| `replay_temporal_discontinuities` | where every real gap is, with the omitted count GENERATED from the captured ranks |
| `replay_render_contract_versions` | the immutable versioned truth policies a renderer must obey |
| `replay_versions` | the FIRST complete Replay Version, binding all four components |
| `replay_current_version_state` | the ONE mutable current-version pointer, forward only |
| `replay_version_finalizations` | append-only evidence keyed by the EXACT Replay Version |
| `replay_lifecycle_events` | the append-only lifecycle history, admitting only the frozen transitions |

Six additive candidate keys are ADDED to the frozen I-06A component relations so this migration can
bind an exact source row rather than reach it through independent partial keys. They add no column,
change no constraint and rewrite no row - the frozen 0095 precedent I-06A itself consumed.

### I-06B - analytical projection capability matrix

Documented exactly, with no optimistic parity:

```text
MY_WORLD covered Session, sealed points   PERSONAL_SESSION_HISTORICAL_PROJECTION - SUPPORTED
MY_WORLD covered Session, open Live Head  NOT AVAILABLE - REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD
MY_WORLD LEGACY_UNCOVERED Session         NOT AVAILABLE - fails closed, no reconstruction
MY_WORLD source medium                    text only: conversation_units.source_modality is TEXT
SHARED_WORLD                              NOT AVAILABLE - no canonical historical analytical substrate
owned PUBLIC_EXPERIENCE                   NOT AVAILABLE - no canonical historical analytical substrate
```

The repository census behind the last two lines: a Shared history item of kind `QANDEEL_ANALYSIS` is
SOURCE CONTENT in a Shared World, and a bounded Public Experience derivative is PUBLIC SOURCE MATERIAL.
`shared_world_material_historical_authority` is a historical AUDIENCE-WIDENING resolution, and
`public_experience_search_projection` / `public_experience_vitality_state` are derived, rebuildable and
explicitly never authorities. None of them is a time-indexed, knowledge-time-truthful, version-valid,
deterministically revalidatable, hindsight-free analytical state. So preview and finalization fail
closed for those classes with ONE bounded class, `REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE`, and their
I-06A DRAFT stays exactly as valid as it was. Nothing is synthesized to make the classes symmetrical.

### I-06B - preview and finalization runtime (migration 0103)

`0103_replay_preview_finalization_runtime_v1.sql` adds three typed command relations and thirteen
functions. The three human primitives - `prepare_replay_preview_v1`, `finalize_replay_version_v1` and
`reopen_replay_for_revision_v1` - derive the creator from `auth.uid()` and accept no actor, authority,
audience, safety, digest, discontinuity, coverage or clock parameter.
`resolve_replay_current_version_v1` is the ONE read boundary: it answers the exact creator, returns
zero rows to everybody else, and discloses no source identity and no internal divergence cause.

The analytical projection is CONSUMED, never recomputed: `build_replay_analytical_projection_v1`
reaches `get_session_historical_projection_v1(session, TC)` - the canonical projection migration 0072
owns - at the exact represented Session Position of each selected item and commits a digest of what it
answered. No model, provider or prompt is reachable from any I-06B function.

The canonicalization is `QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1`: every family of K(TC) rendered in
PostgreSQL's own canonical jsonb form and sorted by that text under the C collation, so the digest is a
property of the SET rather than of the producer's order. It structurally excludes the source-event
payload - the function declares no `moments` parameter and can never be passed one - and excludes the
wall-clock Material `expiry` mapping, which 0072 section 13 states is never compared to TC and whose
`PENDING -> SP(LH)` mapping legitimately moves with wall time. The TC-domain answer that mapping feeds,
`statusAtTc`, stays inside the digest.

### I-06B - lock order

```text
replays FOR UPDATE
  -> replay_draft_state FOR UPDATE            (preview)
     replay_current_version_state FOR UPDATE  (finalize / reopen)
  -> replay_lock_source_manifest_v1, SHARE, in each domain's own frozen order
  -> the canonical historical projection, read only: STABLE, no lock, no write
  -> I-06B component writes
```

### I-06B - verifier commands

```bash
npm run verify:replay-analytical-projection-render-contract:integration
npm run verify:replay-preview-finalization-runtime:integration
```

Both need `DATABASE_URL` pointing at a FULLY migrated database and are run in CI as one reported group
after the I-06A group. Both report every scenario independently through the permanent aggregator, so
one defect can never hide the ones after it.

### I-06C - distribution package and distribution authority (migration 0104)

`0104_replay_distribution_package_authority_v1.sql` creates the immutable
`REPLAY_DISTRIBUTION_PACKAGE_VERSION`, the derived required approver set, the package-bound approvals
and their append-only withdrawals, the sanitized export descriptor, the Public `REPLAY_ARTIFACT`
bridge and the authorization record. It creates no writer at all.

A package binds ONE exact historically FINALIZED Replay Version of ONE exact Replay - through
`replay_version_finalizations`, never through `replays.current_lifecycle`, because I-06B legitimately
reopens a finalized Replay without erasing that evidence. The destination action is part of package
identity, so an approval for `PUBLISH_TO_PUBLIC_WORLD` can never resolve against `SHARE_EXTERNALLY` or
`DOWNLOAD`. Unresolved authority is UNREPRESENTABLE on both halves and on the union: only the two
RESOLVED states exist, exactly as I-05A admits only the two inside a publication package.

The sanitized export descriptor is the WHOLE audience-visible surface, as a positive allowlist of
typed columns - an opaque `rdx1_` reference, safe derived counts and the exact versioned render-truth
policies - with no private identifier class and no `jsonb` escape hatch. The audience reference is
minted at random and a `BEFORE INSERT` guard refuses one that reproduces an internal identity of its
own row. Four additive candidate keys are added to frozen relations, each trivially unique because
each contains that relation's primary key.

A Public consent act names two identities, so the Replay approval row records BOTH: the exact linked
canonical Public approval and its exact manifest version. A `CHECK` makes any other combination of
destination and link unrepresentable; one composite foreign key onto the frozen `0094` exact-identity
key proves the linked canonical row is the SAME human's; a second onto the bridge's own
`(package, manifest)` candidate key proves it is THIS package's Public package; and
`UNIQUE (linked_public_approval_id)` means one canonical Public approval belongs to at most one Replay
consent act.

### I-06C - distribution runtime, export sanitization and the Public bridge (migration 0105)

`0105_replay_distribution_runtime_export_public_bridge_v1.sql` adds three typed command relations and
seventeen functions, and replaces exactly ONE predecessor function - the canonical
`derive_public_publication_authority_v1`, additively, through the repository's canonical forward
method, so a bridged `REPLAY_ARTIFACT` item contributes the exact required approver set of its Replay
distribution package and an unbridged one fails closed instead of requiring nobody.

Production distribution is FAIL-CLOSED on two independent seams.
`resolve_replay_analytical_distribution_authority_v1` answers
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` because the protected-human SUBJECT half of a QANDEEL
analysis authority requirement has no canonical producer here, and
`resolve_replay_distribution_prerequisites_v1` answers `NOT_EVALUATED` on every CW2-08 dimension. Both
refuse rather than guess, and neither is ever reinterpreted as zero approvers or as a clearance.

`approve_replay_distribution_v1` is ONE human consent act that writes both immutable evidence rows for
a Public destination, so nobody is asked twice for the same payload and the canonical Public authority
contract is fulfilled rather than bypassed. Its command identity binds the WHOLE immutable request:
both idempotency passes - before the Replay lock and again under it - compare the committed linked
Public identity, an equivalent retry answers with what that row committed rather than with the retry's
own arguments, and the same approval id carrying a moved, dropped or newly added Public identity is
`REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT` and writes nothing. Because the Replay row names the Public
row under a foreign key, the canonical Public half is written first inside the act, and a withdrawal
takes back exactly the approval that act created. `authorize_replay_distribution_v1` revalidates the source
through the frozen I-06A path, the required set and the authority fingerprint, every approval's
effective state, the sanitized surface, and the CW2-08 prerequisite LAST - and then either calls the
canonical `publish_public_experience_v1` or records `AUTHORIZED_FOR_DELIVERY`, because no transport
boundary exists to claim anything more.

### I-06C - verifier commands

```bash
npm run verify:replay-distribution-package-authority:integration
npm run verify:replay-distribution-runtime-export-public-bridge:integration
```

Both need `DATABASE_URL` pointing at a FULLY migrated database and are run in CI as one reported group
after the I-06B group. Both report every scenario independently through the permanent aggregator. The
0105 verifier reaches past the two fail-closed seams only by replacing a seam BODY inside a
transaction it rolls back, or - for the four committed races - by restoring it in a `finally` and
proving the production body back byte for byte. No permissive seam is ever left installed.

### I-06D - post-finalization source availability and current usability (migration 0106)

`0106_replay_post_finalization_source_availability_v1.sql` makes ONE distinction operational: a Replay
Version that was historically FINALIZED stays historically finalized forever, while whether the source
it represents is still legitimately dereferenceable is a SEPARATE answer that may change.

`derive_replay_version_current_availability_v1(...)` binds one exact `replay_id` + `replay_version_id`
as one row, reads that version's own captured manifest from the immutable composition, and DELEGATES
the whole source question to the canonical I-06A `derive_replay_source_manifest_currency_v1`. It
re-derives nothing, reads no source row, recomputes no digest, and never treats historical
finalization as evidence that source is still current. Three bounded answers - `CURRENT`,
`NOT_CURRENT`, `CONTRADICTORY` - with the private I-06A staleness class carried separately and
internally. A captured digest records what the source WAS; it is never evidence that it still IS.

`resolve_replay_version_current_usability_v1(...)` is the creator-exact read boundary. It answers
`COMPLETE_REPLAY_CURRENTLY_USABLE` or `COMPLETE_REPLAY_NOT_CURRENTLY_USABLE`, and reports BOTH layers
on every row, which is what makes CW2-05 section 32 operational rather than decorative:

```text
SOURCE_CONTENT_BEARING_LAYER   DEREFERENCEABLE | NOT_DEREFERENCEABLE
ANALYTICAL_VISUAL_LAYER        SEALED_HISTORICAL_EVIDENCE | SEALED_EVIDENCE_INCOMPLETE
```

A source loss makes the source layer `NOT_DEREFERENCEABLE`, leaves the analytical layer
`SEALED_HISTORICAL_EVIDENCE` - it is not erased merely because the source moved - and still refuses the
complete Replay. There is deliberately NO state meaning "the analytical layer stands in for the
missing source", because an analytical-only rendering is not the Replay it would be served as.

The creator receives the minimum actionable class - `REPLAY_VERSION_NOT_FINALIZED`,
`SOURCE_NOT_CURRENTLY_AVAILABLE`, `SOURCE_STATE_CONTRADICTORY` or `ANALYTICAL_EVIDENCE_INCOMPLETE` - and
never the private I-06A cause. Everyone else receives zero rows, which is also what a nonexistent
Replay and another human's version answer, so the boundary is no existence oracle.

At this baseline a bound Personal source cannot be hard-deleted at all: 0100 binds
`replay_source_manifest_items.personal_conversation_unit_id` to `conversation_units` with
`ON DELETE RESTRICT`. The reachable source-loss shapes for a finalized `MY_WORLD` Replay are therefore
`SOURCE_CHANGED` and `SOURCE_UNAVAILABLE`, and both are exercised by real fixture surgery rather than
by weakening a derivation.

### I-06D - current delivery eligibility and controlled reconciliation (migration 0107)

`0107_replay_distribution_current_eligibility_reconciliation_v1.sql` separates a HISTORICAL
distribution authorization from the CURRENT ability to use it. A prior `AUTHORIZED_FOR_DELIVERY` fact
stays exactly as written; it is evidence that an authorization existed at one instant, never a
permanent bearer right to deliver after the world moved.

`derive_replay_distribution_current_eligibility_v1(...)` is total and fail-closed, and re-evaluates in
a load-bearing order: a package never authorized, the historical finalization it binds, CURRENT SOURCE
AVAILABILITY, the current authority identity and required set, every required approval's effective
state, the sanitized export descriptor, the destination's own current state, and the CW2-08
prerequisite LAST. Source is answered BEFORE authority on purpose - the analytical subject-authority
seam is unresolved in production, so an authority-first order would make the source-loss refusal
unreachable outside a test seam. An unresolved seam is a bounded `AUTHORITY_UNRESOLVED` refusal, never
an error a caller could read as permission and never reinterpreted as zero approvers.

For a Public destination the derivation CONSUMES `resolve_public_visibility_state_v1` and compares the
exact manifest that package bridged. It extends that resolver in no way, writes no second Public
visibility truth, and performs no Public lifecycle transition. **A private Replay source that later
becomes unavailable never forces `ABSENT_FROM_PUBLIC_WORLD`**: CW2-05 declines to invent that rule, the
Public `REPLAY_ARTIFACT` is a bounded sanitized derivative rather than a live private-source pointer,
and a private-source check inside the canonical Public resolver would be a source oracle addressable
by any admitted viewer. What still fails closed is everything the Public runtime already fails closed
on - approval withdrawal, controller disappearance, `ABSENT_FROM_PUBLIC_WORLD` and every other I-05C
continuing-eligibility failure - and no Replay state resurrects an Experience after any of them.

`reconcile_replay_post_finalization_state_v1(...)` is durable convergence evidence and nothing more. It
is creator-scoped through `auth.uid()` because the canonical source lock is creator-scoped by
construction, takes the canonical lock order Replay-first, and writes only append-only rows:

```text
replays                                   FOR UPDATE
  -> replay_distribution_package_versions  FOR SHARE, exact target
     replay_versions                       FOR SHARE
  -> replay_lock_source_manifest_v1(...)   each source domain's own frozen order
  -> replay_distribution_approvals         FOR SHARE, ORDER BY approver
  -> public_world_state, public_experiences FOR SHARE, only for a Public destination
  -> the append-only I-06D writes
```

Its command identity binds the WHOLE immutable request - actor, Replay, Replay Version, the exact
package or its explicit absence, and the purpose - and both idempotency passes answer from the
committed row rather than from what the retry says. The command id IS the evidence id in both
relations, so one command can never produce two observations of the same kind.

Privacy never waits for reconciliation. The live derivation is the answer the moment it is asked; a
reconciliation row can only document a result it did not create, and no derivation in 0106 or 0107
reads one. QANDEEL performs no delivery and claims no recall of already-exported external copies, and
no column of any I-06D relation can say otherwise.

### I-06D - verifier commands

```bash
npm run verify:replay-post-finalization-source-availability:integration
npm run verify:replay-distribution-reconciliation-closure:integration
```

Both need `DATABASE_URL` pointing at a FULLY migrated database and are run in CI as one reported group
after the I-06C group. Both report every scenario independently through the permanent aggregator. The
0107 verifier reaches past the two fail-closed seams only by replacing a seam BODY inside a transaction
it rolls back, or - for the six committed races - by restoring it in a `finally` and proving the
production body back byte for byte. The 0106 verifier additionally simulates the canonical I-06A source
currency for exactly one purpose - proving that current availability DELEGATES rather than re-derives -
and proves that production body back too. No permissive seam is ever left installed.

## I-07A - Matching Participation, Private Authority and Versioned Setup Foundation v1 (migrations 0108-0109)

Matching v1 is exactly one Product capability: `MARRIAGE_INTRODUCTION`. It is hosted from `MY_WORLD`,
it is a doorway, it is private by default and it is mediated by QANDEEL. It is not a Shared World, a
dating feed, a candidate marketplace, a searchable people directory, a leaderboard or a direct-contact
channel, and these two migrations create nothing that could become one. A later Mutual Match will
create exactly one `SHARED_WORLD / INTRODUCTION`; that World belongs to `I-07C` and is neither
created, reserved, pre-created nor simulated here.

### Three independent authorities

Participation, the Matching Context Grant and the Pre-Match Proposal Disclosure Authority are three
separate truths. They are independently mutable, independently inspectable, and none of them may
silently create another - so they are three separate table families with no foreign key, trigger or
generated column joining one to another. Turning participation off revokes nothing, because no
participation command has a database path into a grant, a profile, a requirement version or a
disclosure authority; holding a grant creates no participation for the same reason. Whether a grant is
EFFECTIVE for future candidate work is gated by participation later, in `I-07B`.

```text
matching_setup_locks                       the per-human serialization row, and nothing else
  matching_participation_events            immutable act CHAIN   -> matching_participation_state
  matching_context_grants                  ACTIVE | REVOKED      -> matching_context_consent_events
  introduction_profile_versions            immutable versions    -> introduction_profile_state
    introduction_profile_field_values      bounded private fields
  matching_requirement_versions            immutable versions    -> matching_requirement_state
    matching_requirement_items             HARD_DEALBREAKER | SOFT_PREFERENCE
  pre_match_disclosure_authorities         bound to ONE exact profile version
    pre_match_disclosure_authority_fields  bound to REAL fields OF THAT VERSION
    pre_match_disclosure_authority_events  immutable authority history
```

### Current state is a pointer, never a second copy

Every current truth is an explicit pointer to an exact historical identity, bound by a COMPOSITE
foreign key so it can only ever name a row of its own human. The current participation state is the
resulting state of the act the pointer names and is stored nowhere else, so divergence is
unrepresentable rather than merely avoided and `latest timestamp wins` decides nothing. Absence of a
pointer is `OFF`: participation is never inferred from a profile, a grant, a disclosure authority or
conversation history. Every pointer family carries a prior-identity link with a partial unique index,
so an identity is superseded at most once and the history is a CHAIN rather than a tree - and a truth
trigger refuses a pointer move whose target does not chain from the value being replaced, which binds
the table owner too.

### Why the I-07A resume path cannot bypass a later gate

All five CW2-06 pause reasons are representable. Only `USER_PAUSED` has an I-07A producer; the other
four - `ACTIVE_INTRODUCTION`, `POST_INTRODUCTION`, `POST_SUCCESS`, `SYSTEM_POLICY` - are reserved for
`I-07C` and `I-07D` exactly as migration 0089 carries reserved material kinds that pin no producer.
Two rules close the loop together:

1. `resume_matching_participation_v1` lifts `PAUSED / USER_PAUSED` and refuses every other pause
   reason with a bounded `MATCHING_PAUSE_NOT_USER_RESUMABLE`.
2. Activation is not a way around rule 1. It requires the current state to be `OFF`, so it can never
   be applied to a pause directly - and an `OFF` reached FROM a pause I-07A may not resume is refused
   with `MATCHING_REACTIVATION_REQUIRES_REVALIDATION`, because the obvious bypass is two steps rather
   than one. The check is exactly one hop along the immutable chain, and one hop is the whole of it:
   the only way to reach `OFF` from a pause is that single `TURN_OFF` act, and the chain cannot fork.

Opting out is never blocked. It is the human's own privacy authority and works from any state,
including a pause I-07A cannot resume; it simply does not launder the pause.

### The bounded field representation

The Product's Introduction Profile catalogue is DEFERRED by CW2-06 and neither migration decides it. A
field is a bounded lower-case identifier key with a bounded private text value, so the catalogue stays
configurable without a speculative marriage questionnaire being frozen into DDL. What the
representation may never become is an arbitrary channel: there is no JSON and no array column, the
value is structurally ceilinged, and a key may not name a DIRECT CONTACT ROUTE or an IDENTITY
DOCUMENT - phone, email, a social handle, a street or geographic address, a photo or other media
handle, a URL, an identifier number or a KYC artifact. That ban is what makes `no photo or contact
disclosure behaviour in I-07A` structural rather than a comment: a disclosure authority approves a
FIELD KEY, and no field key can name a contact route. The ban is token-delimited, so
`handles_conflict_well` is an ordinary profile field while `whatsapp_handle` can never exist. It bans
a contact-route FIELD; it does not police free text a human writes about themselves.

### An authority over V1 never covers V2

A Pre-Match Disclosure Authority binds one exact Introduction Profile version - the grantor's OWN, by
composite foreign key - and each approved field is bound by composite foreign key to a REAL FIELD ROW
OF THAT EXACT VERSION. A V1 authority therefore cannot name a V2 field even by accident: structural
impossibility, not a runtime check that could be forgotten. When the profile moves on, the old
authority stays bound to the old version and a NEW authority over the superseded version is refused;
re-approving is an explicit act over the version the human is looking at.

### The command boundary

Eleven boundaries, all `SECURITY DEFINER` with a pinned empty `search_path`, all deriving their human
from `auth.uid()`, all executable by `authenticated` and by nothing else. `PUBLIC`, `anon` and
`service_role` receive nothing: the server may facilitate the experience later, but possession of the
service-role credential must never be able to manufacture, widen or withdraw a human's Matching
participation or consent.

```text
activate_matching_participation_v1      pause_matching_participation_v1
resume_matching_participation_v1        turn_off_matching_participation_v1
grant_matching_context_v1               revoke_matching_context_v1
set_introduction_profile_v1             set_matching_requirements_v1
grant_pre_match_disclosure_authority_v1 revoke_pre_match_disclosure_authority_v1
get_my_matching_setup_v1
```

Four participation commands rather than one command with a kind parameter: the act is fixed by
FUNCTION IDENTITY exactly as the grant semantics are fixed by table identity, so a caller cannot spell
an act, cannot spell a pause reason, and cannot reach the resume path by asking an activate command
for it.

The command id IS the primary key of the row each command commits, so there is no second idempotency
table and no idempotency key that can drift from the result. An equivalent retry returns the already
committed result read back from the committed row rather than echoed from the retry's arguments; the
same id carrying a different request fails closed with `23505`, and the comparison covers the WHOLE
immutable request including the exact committed field or key SET. Every consequential command names
the exact current identity it expects, and any other current state is a bounded `40001`.

No command takes a human identifier, so a caller cannot even phrase a question about someone else, and
the self-inspection projection takes no parameter at all. A grant, authority or version that is not
the caller's own is reported through the same bounded error as one that never existed.

### Lock order

```text
matching_setup_locks                 FOR UPDATE   the caller's own row, first and always
  -> introduction_profile_state      FOR SHARE    disclosure grant only
     introduction_profile_versions   FOR SHARE    disclosure grant only
  -> the family the command owns     FOR UPDATE
```

A command only ever touches rows of ONE human - its own `auth.uid()` - so two humans can never
contend, and two commands of the same human are serialized by that human's lock row before they reach
anything else. There is no cycle to deadlock on, no advisory lock and no process-local mutex.

### I-07A - verifier commands

```bash
npm run verify:matching-participation-private-setup-foundation:integration
npm run verify:matching-setup-human-authority-commands:integration
```

Both need `DATABASE_URL` pointing at a FULLY migrated database and are run in CI as one reported group
after the I-06D group. Both report every scenario independently through the permanent aggregator. The
verifiers reach the four reserved pause reasons - which have no I-07A producer on purpose - only as
the table owner inside a scenario that rolls back, and every weakening probe restores the production
definition and proves it back byte for byte. No permissive definition is ever left installed.

## I-07B - Candidate Eligibility, Proposal and Privacy Runtime v1 (migrations 0110-0112)

```text
0110_matching_pair_eligibility_proposal_persistence_v1.sql   pair, policy, eligibility, proposal, views
0111_matching_candidate_evaluation_disclosure_gate_v1.sql    evaluation, filter, the disclosure gate
0112_matching_proposal_choreography_runtime_v1.sql           choreography, revalidation, projections
```

`I-07A` created the private Matching SETUP substrate and deliberately stopped before candidates, pairs
and proposals. `I-07B` is the first slice allowed to create durable Matching pair / eligibility /
proposal / recipient-view state, and it implements the complete pre-Mutual-Match runtime up to - but
not including - the second-party acceptance commit that can create an Introduction.

```text
private Matching setup                  I-07A, migrations 0108 / 0109
     v
candidate eligibility / pair evaluation
     v
bounded proposal preparation
     v
first recipient offer  ->  first decline  OR  first forward approval
     v
independent second-recipient proposal
     v
second decline / expiry / withdrawal / stale
     v
READY FOR THE I-07C ACCEPTANCE COMMIT
```

There is deliberately NO durable "accepted but not matched" intermediate state. `SECOND_ACCEPTED`,
`ACCEPTED_PENDING_MATCH`, `MATCH_PENDING` and `INTRODUCTION_RESERVED` do not exist and cannot be
spelled anywhere in the slice. The second recipient's acceptance must revalidate its exact view AND
converge atomically with the Mutual Match / two-slot / Introduction-birth transaction, which is
`I-07C`'s work; a durable intermediate state is precisely what would make splitting it look possible.

### The canonical unordered pair

`public.matching_pairs` stores ONE row per unordered pair, with the two members as `lower_user_id` and
`higher_user_id`, a CHECK that the first really is the smaller, and a UNIQUE over the ordered column
pair. The reverse direction is therefore UNWRITABLE rather than merely de-duplicated: there is no
(B,A) row for a UNIQUE to collide with, because the CHECK refuses one. `PAIR_KEY(A,B) = PAIR_KEY(B,A)`
is a property of the schema and not of a convention a later writer could forget.

Direction belongs to a PROPOSAL, never to the pair, and it is immutable once prepared. A CHECK pins
the first recipient and the candidate to the two arrangements of that pair's own members, so a
proposal can never name a human who is not a member of its own pair and the two sides can never be the
same person. AT MOST ONE LIVE PROPOSAL EXISTS PER PAIR, in either direction, enforced by a partial
UNIQUE index on `pair_id` over the four live states - and because the pair row is unordered, one index
is the whole of the rule.

### PASS, FAIL, UNKNOWN - and why UNKNOWN never becomes PASS

`public.matching_hard_requirement_results` records one outcome per HARD_DEALBREAKER of one human
against one eligibility snapshot, bound by composite foreign key to a REAL requirement item of that
human's exact version. The source-class vocabulary contains only the four allowed candidate self-truth
classes plus `NOT_ESTABLISHED`: a third-party claim, and an inference from a name, a voice, a photo, a
language style or any stereotype-bearing proxy, are not refused at runtime - they CANNOT BE SPELLED.

The load-bearing CHECK is one line:

```sql
(requirement_outcome = 'UNKNOWN') = (evidence_source_class = 'NOT_ESTABLISHED')
```

An UNKNOWN therefore cannot carry a confirmed source and a PASS cannot exist without one, and the row
is append-only for every role including the table owner. There is no weight, score, rank, percentage
or priority column anywhere in the slice, so a strong soft signal has nothing to override a hard FAIL
or a hard UNKNOWN with.

AN UNEVALUATED HARD DEALBREAKER BLOCKS EXACTLY LIKE AN UNKNOWN ONE. A check that only inspected the
results PRESENT would be satisfied by a snapshot carrying none at all, which is the most complete way
possible for a dealbreaker to go unsatisfied - so a truth trigger requires every HARD_DEALBREAKER of
both humans' bound requirement versions to carry a PASS of its own before a proposal may exist.
SOFT_PREFERENCE items are deliberately not required: demanding one would be the quiet promotion of a
preference into a gate.

### The eligibility snapshot binds exact identities, and certifies nothing

`public.matching_eligibility_snapshots` is the `CANDIDATE_ELIGIBILITY_SNAPSHOT`. Every identity it
binds - participation act, Matching Context Grant, Introduction Profile version, requirement version
and Pre-Match Disclosure Authority - is bound by a COMPOSITE foreign key to a row OF THAT EXACT HUMAN,
using the composite identity keys `0108` already declares, so one human's participation can never be
bound to another human's profile. The three proposal policy identities are bound the same way, each
with its kind pinned by a single-value CHECK, so a cadence policy can never be consumed as an expiry.

It carries no aggregate eligibility column, because an aggregate would be a second copy of a truth the
results already hold. And it is never the authority for a continuing truth: every advancing step
revalidates the CURRENT identities rather than trusting that the snapshot was valid when it was taken.

`I-07B` implements no `ACTIVE_INTRODUCTION_SLOT`. "No active Introduction" is derived live from the
canonical Shared World substrate migration `0075` owns - an open membership episode in an ACTIVE World
whose phase is INTRODUCTION - and `no_active_introduction_at_capture` is pinned by a CHECK so a
snapshot taken while one existed is unrepresentable.

### The one-way privacy boundary, as four different relations

```text
private Matching reasoning        matching_private_reasoning_notes
     v
safe conclusion CANDIDATE         matching_safe_conclusion_candidates      untrusted input
     v
SENSITIVE_CONCLUSION_FILTER
     v
product-permitted conclusion      matching_permitted_safe_conclusions      filter_verdict = 'PERMITTED'
     |                            matching_sensitive_filter_refusals       the PRIVATE reason
     v
authorized recipient proposal     matching_recipient_proposal_views
```

These are four different RELATIONS rather than four states of one row, because the boundary the
architecture freezes is a change of TYPE and not a flag. A recipient view binds a permitted-conclusion
row, and that relation's verdict column is pinned to `PERMITTED` by a single-value CHECK - so a
refused or unclassified conclusion is not filtered out at read time, it cannot exist in the relation a
view is able to reference. Absence IS refusal, which is what fail-closed means structurally. A safe
conclusion candidate carries no "the model says this is safe" column: provider output is untrusted
input to this pipeline and the only verdict that exists is the filter's own.

The filter is deterministic and fail-closed. It refuses a contact route, hidden provenance, a long
verbatim quoted span, VISIBLE RANKING LANGUAGE and an unauthorized sensitive fact; it records an
unclassifiable result as a REFUSAL rather than a pass; and an unconfigured filter policy refuses the
call outright, because there is no "filter unavailable, so allow" path. It also refuses a conclusion
that carries a private reasoning note of its own snapshot WORD FOR WORD WITH NO QUOTATION MARKS, which
is the leak a regex-only redaction layer never catches.

### A disclosed field needs two independent gates

A row in `public.matching_recipient_proposal_view_fields` is impossible unless BOTH are true, and each
is a foreign key rather than a check somebody has to remember:

```text
pre_match_disclosure_authority_fields (authority_id, field_key)    the SUBJECT human approved it
matching_proposal_safe_field_keys (policy_version_id, field_key)   Product permits it pre-Match
```

Human authority is necessary and NOT sufficient, exactly as `CW2-06` requires. The Product policy is
versioned and configurable, freezes no Introduction Profile catalogue, and NO POLICY ROW SHIPS IN ANY
MIGRATION - an unconfigured policy has no current version and every consequential path fails closed on
that.

`I-07A` bans a contact-route field KEY. A field VALUE is bounded free text, so `0110` bans the contact
route in the VALUE as well and `0111`'s gate filters every value before writing it, refusing the
offending field BY NAME: a benign key cannot smuggle a phone number, an email address, a URL, a bare
domain or a social handle into a recipient view. The ban is deliberately fail-closed and will refuse
some innocent text, because refusing to disclose a sentence is recoverable and disclosing a phone
number before a Mutual Match is not.

### Two independent disclosures, never one view with the names swapped

`RECIPIENT_PROPOSAL_VIEW_VERSION` is immutable, bound to one exact proposal, one exact recipient and
one exact materialized disclosure result, with the exact profile, authority, policy, eligibility and
conclusion identities it was built from. The recipient is pinned by CHECK to the proposal member its
ROLE names and the subject to the other, the authority must be the SUBJECT'S OWN and bound to exactly
the profile version being disclosed, and the conclusion must have been filtered FOR that recipient
ABOUT that subject.

The first-recipient view and the candidate view are therefore INDEPENDENT disclosures over different
subjects, different authorities, different profile versions and different conclusions. There is no
copy path between them and the gate cannot even be asked to reuse one. Currentness is an explicit
pointer that may only move forward along that recipient's own view chain; a superseded view is not
erased, because it is the record of what that human was actually shown.

### The neutral outcome IS the privacy property

```text
AWAITING_YOU          live, and this recipient is the one being asked
IN_PROGRESS           live, and they are not
CLOSED_BY_YOU         terminal by this recipient's own act
NO_LONGER_AVAILABLE   terminal any other way, whatever the way was
MATCH_CONCLUDED       the one I-07C terminal both humans are party to
```

A first recipient cannot distinguish a second decline from an expiry, from a private invalidation, or
from a competing match that cancelled the proposal: all four are one answer. A second recipient cannot
distinguish a withdrawal from an expiry. The private reason a proposal ended lives on the transition
row and reaches no recipient projection at all.

And neither human learns anything about a proposal they hold no view of: the projections answer only
about a proposal THIS EXACT CALLER has a current recipient view for, and another human's proposal, one
never offered to them and one that does not exist are the SAME bounded not-found. That is what keeps
the candidate from having a "proposal existed" oracle - they hold no view until the first recipient
explicitly approves forwarding, so until then every question they could ask answers exactly as it
would for a proposal that was never prepared.

### Nothing in I-07B is executable by any application role

Every boundary in `0111` and `0112` is postgres-owned, `SECURITY DEFINER`, empty-`search_path`-pinned
and revoked from PUBLIC, anon, authenticated AND service_role. No role holds EXECUTE on any of them.

That is the repository's established pre-launch pattern rather than an omission. Delivering a proposal
is a consequential disclosure about two humans, and the `CW2-08` Safety / moderation / entitlement /
Launch Gate runtime that must clear it does not exist here: `resolve_matching_proposal_prerequisites_v1`
answers `NOT_EVALUATED`, exactly as `I-05B`'s and `I-06`'s seams do, and every delivery and every human
decision requires exactly `CLEARED` from it as its LAST gate. Expiry, staleness and withdrawal are
deliberately NOT gated on it: all three end exposure rather than create it, and a proposal that could
not be withdrawn because a launch gate was unavailable would be the opposite of fail-closed.

The same rule answers the candidate-discovery question. `CW2-06` permits a narrow read-only service
resolver over the sealed setup state; it does not require one, and a `service_role`-executable resolver
that ENUMERATES currently matchable humans is precisely the oracle the anti-oracle law forbids.
Discovery is internal too, and `service_role` gains nothing at all from this slice.

The four HUMAN DECISION cores nevertheless derive their human from `auth.uid()` and take no actor
parameter, exactly as every `I-07A` command does, so `I-09` can wrap them later by granting EXECUTE
with no step that turns a system credential into human consent.

### A second fail-closed seam: the canonical first name

A pre-Match proposal may present the candidate's FIRST NAME from an allowed canonical source, and this
repository has none: `public.users` carries an id, an auth subject and two timestamps. The Public World
display label belongs to a different capability and reading it here would move a PUBLIC fact into
private Matching, so `resolve_matching_canonical_first_name_v1` answers
`UNRESOLVED_NO_CANONICAL_SOURCE` and the disclosure gate requires `RESOLVED`. The whole proposal path
therefore fails closed on it, and the seam is replaceable without reopening anything.

### I-07B - lock order

```text
1. both humans' matching_setup_locks   FOR UPDATE   in CANONICAL USER-ID ORDER
2. the canonical pair row              FOR SHARE
3. the proposal row                    FOR UPDATE
4. recipient view, transition and policy rows
```

The two-human lock uses the SAME upsert-and-lock statement the `I-07A` commands use, so an `I-07A`
setup command and an `I-07B` pair operation serialize on the same row rather than on two different
things that happen to concern the same human. Direction NEVER decides lock order: both connections
take the smaller identifier first, always, which is what makes simultaneous (A,B) and (B,A) work
impossible to deadlock.

Every human decision enters through `enter_matching_proposal_decision_v1`, which answers the bounded
not-found from the proposal's own immutable membership and THEN takes that lock. The order is
load-bearing rather than tidy: `materialize_matching_recipient_view_core_v1` supersedes a recipient
view while holding the same lock, so a decision that checked the exact view BEFORE taking it would
leave a window in which V1 is accepted, a concurrent materialization commits V2 and releases, and the
decision then acts on a view that is no longer current. The compare-and-swap on the proposal state
does not close that window, because materializing a view does not change the proposal state. Scenario
`E06` of the `0112` verifier proves both halves on two real connections: with the ordering the stale
view is refused, and with the pre-fix ordering installed the same interleaving accepts it.

### I-07B - verifier commands

```bash
npm run verify:matching-pair-eligibility-proposal-persistence:integration
npm run verify:matching-candidate-evaluation-disclosure-gate:integration
npm run verify:matching-proposal-choreography-runtime:integration
```

All three need `DATABASE_URL` pointing at a FULLY migrated database and run in CI as one reported
group after the `I-07A` group. All three report every scenario independently through the permanent
aggregator, so one defect cannot hide the rest. The two reserved `I-07C` states and the
competing-match cancellation are reached only as the table owner inside a scenario that rolls back -
`I-07B` has no producer for them on purpose - and both fail-closed seams are replaced only inside a
transaction and restored byte for byte afterwards, with the production answer asserted back at the end
of the run. No permissive seam or policy is ever left installed.

## I-07C - Atomic Mutual Match, Introduction Birth and Match Handoff Runtime v1 (migrations 0113-0114)

`I-07B` stopped exactly where the second-party acceptance begins: a proposal in
`FORWARDED_TO_SECOND`, with no durable "accepted but not matched" state and no producer for the two
reserved states `MUTUAL_MATCH_COMMITTED` and `CANCELLED_BY_COMPETING_MATCH`. `I-07C` is the ONE
atomic transaction that turns that proposal into a Mutual Match, and everything that transaction
needs to be exact. It is one macro slice on purpose: Mutual Match, Introduction Record birth,
active-Introduction claim acquisition, competing-proposal terminalization, participation pause and
Match handoff either commit together or not at all.

`0113_matching_mutual_match_introduction_persistence_v1.sql` creates persistence and nothing else -
no command, no resolver, no read boundary:

- seven **additive candidate keys** on predecessor relations (`matching_proposal_transitions` x2,
  `matching_proposals`, `matching_recipient_proposal_views` x3, `shared_world_membership_episodes`),
  each a candidate key over an existing primary key, so a later row binds an EXACT row of that human,
  actor, view or World rather than two independently satisfiable halves;
- the 0110 private-reason CHECK rebuilt in place with exactly one more code,
  `COMPETING_MATCH_COMMITTED` - the ONE reviewed drop in the slice, adjacent to its rebuild;
- `matching_forward_approval_view_bindings` - the durable first acceptance: the approving transition,
  the approving human and the exact `FIRST_RECIPIENT` view, bound as one row;
- `matching_match_commits` - the durable Match: its id IS the `MUTUAL_MATCH_COMMITTED` transition id
  and the command id, binding the proposal, the pair, both humans, the first-approval binding, the
  exact accepted candidate view, the World, both episodes, the record, both claims, both pause acts
  and the handoff package, all at one `committed_at`;
- `introduction_records` (`ACTIVE | COMPLETED | CLOSED`, born `ACTIVE`, one terminal move, never
  reopened), `shared_world_matching_birth_events` (`WORLD_BIRTH / MUTUAL_MATCH`) and
  `shared_world_introduction_started_events` (`INTRODUCTION_STARTED`);
- `matching_active_introduction_claims` - the INTERNAL single-winner guard (`HELD | RELEASED`, one
  partial unique index on `HELD` per human). It is a concurrency guard only; the canonical
  active-Introduction truth stays `resolve_matching_active_introduction_v1` over the Shared World
  substrate, and the Match core checks BOTH;
- `matching_match_competing_cancellations` - the private link from a `CANCELLED_BY_COMPETING_MATCH`
  transition to the Match that caused it;
- `matching_match_handoff_package_versions`, `_subjects`, `_fields` - the Match Handoff Package as a
  ONE-WAY structural projection: every subject row is bound by foreign keys to the exact view's
  subject, first name and permitted conclusion, every field row to a real field of the exact view,
  and the values are route- and provenance-banned. A handoff row that is not a copy of an exact
  recipient-view row is unrepresentable. Nothing private - reasoning, refusals, snapshots, grants,
  authorities, profile versions, competing proposals - can be reached from a handoff relation;
- six **deferred reverse bindings** onto the commit (`DEFERRABLE INITIALLY DEFERRED`, the 0085
  precedent), so the commit row can be written LAST and its truth trigger can re-read every effect;
- immutability guards on the eight append-only relations and truth triggers on the record, the claim,
  the commit (World shape, two open episodes, record, both facts, both claims, both
  `ACTIVE_INTRODUCTION` pauses, handoff, all at one instant) and the handoff (view in package,
  conclusion text is the permitted text, field value is the view value).

`0114_matching_mutual_match_commit_transaction_v1.sql` creates `commit_matching_mutual_match_v1`
(twelve opaque uuid identities in, nine bounded columns out, human = `auth.uid()`, no actor
parameter) and revises `approve_matching_proposal_forward_core_v1` byte-for-byte in its authority
and order plus ONE write: the exact-view binding. A retry of a committed approval answers from the
committed rows; a different view under the reused id is `MATCHING_COMMAND_ID_CONFLICT`; a committed
approval whose binding is missing is `MATCHING_MATCH_CONTRADICTORY_STATE` (review finding
`I07C-AUTH-01`): no historical view is inferred and nothing is backfilled. The core, in the published
order:

1. durable idempotency over the WHOLE request, before any lock;
2. `enter_matching_proposal_decision_v1` - the bounded not-found, then BOTH humans' setup locks in
   canonical user-id order, exactly once;
3. every proposal row this transaction may mutate - the winner and every LIVE proposal involving
   either human - `FOR UPDATE` in ascending proposal id;
4. the exact current `CANDIDATE` view, the winner exactly `FORWARDED_TO_SECOND` and unexpired, the
   durable first-approval binding whose bound view is STILL the first recipient's current view;
5. `resolve_matching_proposal_validity_v1` - participation, grants, profile and requirement
   versions, disclosure authorities, policies and the canonical active-Introduction truth;
6. no `HELD` claim for either human; both participation pointers `FOR UPDATE` and `ACTIVE`;
7. `resolve_matching_proposal_prerequisites_v1` must answer `CLEARED`, as the LAST gate;
8. ONE `clock_timestamp()`, then the write region under the six deferred bindings: the
   `MUTUAL_MATCH_COMMITTED` transition through `append_matching_proposal_transition_v1`, the Shared
   World (`ACTIVE / INTRODUCTION / MUTUAL_MATCH`), two open episodes, the record, both facts, both
   claims, both `PAUSE -> PAUSED / ACTIVE_INTRODUCTION` acts superseding the exact `ACTIVE` acts,
   every competitor `-> CANCELLED_BY_COMPETING_MATCH` with private reason
   `COMPETING_MATCH_COMMITTED` (database-generated ids, because their number is private), the
   handoff package copied from the two exact views, the commit row, then the bindings flushed
   `IMMEDIATE`.

No advisory lock, no table lock, no direct transition insert, no second acceptance state, no
`USER_PAUSED`, no `STANDARD`, no `READ_ONLY_CLOSED`, no `RELEASED`: the migration refuses to deploy
a core that spells any of them, and the live producer censuses are equalities - exactly the core
produces the two reserved states, the `ACTIVE_INTRODUCTION` pause, a commit, a claim, a record or a
handoff; exactly the two frozen birth paths create a Shared World; exactly the one writer appends a
transition; exactly the revised approval writes a binding. Both boundaries are executable by no
application role; the `CW2-08` seam answers `NOT_EVALUATED` in production, so nothing can commit a
Match before the Launch Gate exists.

**Forward-seam reconciliation in the same branch, not a cleanup PR.** The 0110 future-relation
absence census is now an EQUALITY against the named `I07C_LIFECYCLE_RELATIONS` list with the proposal
column ban preserved; the 0112 "no reserved-state producer" and "no acceptance producer" assertions
are equalities against `commit_matching_mutual_match_v1`; the 0108/0109 censuses filter the shared
union by their own regexes; the 0082 forward-safety probe counts `introduction_records` as ARRIVED
instead of planting over a real relation. No historical migration was edited: the I-07C static
contract pins 0075, 0082 and 0108-0112 by git blob id.

### I-07C - lock order

Every `matching_setup_locks` row is acquired through the ONE entry point in globally canonical
ascending user-id order, never in competing-proposal order; then every mutable proposal row in
ascending proposal id; then both participation pointers; then the new rows. The human lock set of
one Match is provably exactly its own two humans, so a re-scan can never discover a human outside
the precomputed set. Two Matches sharing a human serialize on that human's lock; two disjoint
Matches sharing only a competitor serialize on its row and BOTH commit; two Matches sharing nothing
never wait. The real-PostgreSQL proofs pin every interleaving with a lock-wait barrier observed from
another connection.

### I-07C - why the deadline is decided on the birth instant

`CURRENT_TIMESTAMP` is the TRANSACTION timestamp, fixed before the transaction ever waits on a lock.
A Match that entered while its proposal was still live, waited on the canonical pair lock and
resumed after `expires_at` would therefore compare a moment that had already gone by and commit a
Match the proposal no longer authorized (review finding I07C-TIME-01). So the deadline is not part
of the early re-read: `commit_matching_mutual_match_v1` finishes every currentness, authority and
prerequisite check, captures the ONE canonical instant with `clock_timestamp()` immediately before
the irreversible write region, and decides `expires_at <= birth_at` there, with nothing written yet.
There is still exactly one Match clock and one persisted Match instant - the deadline decision and
every persisted moment are the same value - and the core's terminal self-assertion refuses ANY other
clock, `CURRENT_TIMESTAMP` included. Race `C16` is the proof: the Match is observably blocked on the
lower human's lock, its own `xact_start` is shown to precede the deadline, the deadline passes while
it is still waiting, and on release it fails `MATCHING_PROPOSAL_EXPIRED` with twelve zero
cardinalities - no commit, transition, World, episode, record, fact, claim, pause, cancellation or
handoff - after which the same request commits once the proposal is live again.

### I-07C - verifier commands

```bash
npm run verify:matching-mutual-match-introduction-persistence:integration
npm run verify:matching-mutual-match-commit-transaction:integration
```

Both need `DATABASE_URL` pointing at a FULLY migrated database and run in CI as one reported group
after the `I-07B` group. `verify-migration-0113.mjs` writes the Match graph directly as the table
owner - 0113 creates no command - inside transactions it rolls back, so what it proves is what the
database itself refuses, which binds the owner too; the one revised boundary, forward approval, is
exercised as the human. `verify-migration-0114.mjs` reaches every state through the real I-07A,
I-07B and I-07C boundaries as the humans involved, replaces the two fail-closed seams for the run and
restores them byte for byte, and proves: the happy path at one instant; exactly-once retry that never
reads the live World; every refusal class writing nothing; the production seam refusing LAST; the
NO-GHOST proof (a verifier-local late failure and a late unique violation each leave ZERO surviving
effects - no commit, transition, World, episode, record, fact, claim, pause, cancellation or handoff);
the third-member freeze through the frozen 0084/0085 governance; competing-cancellation neutrality
against expiry; and sixteen barrier-pinned two-connection races (same command, same proposal,
A-B vs A-C, A-B vs C-B, reversed UUID order, the four-human competing lock set, disjoint pairs, the
Match against a concurrent pause, opt-out, profile, requirement, disclosure, candidate-view and
first-approval-view change, and the deadline crossed while the Match is provably blocked).

## I-07D - Introduction Lifecycle, Progressive Disclosure and I-07 Closure v1 (migrations 0115-0118)

I-07C left two humans inside a born `ACTIVE / INTRODUCTION` Shared World with an `ACTIVE` Introduction
Record, two open membership episodes and two `HELD` claims - and no way for the Introduction to
progress or to end. I-07D owns the whole of that: owner-controlled progressive disclosure, the two
terminal outcomes and their one winner, explicit post-Introduction Matching reactivation, and the
ordinary communication the phase exists for. The four migrations ship, review and test together as
one slice.

`0115_introduction_progressive_disclosure_history_visibility_v1.sql` creates the disclosure substrate
and the Introduction half of historical visibility. A disclosure is ONE atomic act: the owner is
`auth.uid()`, the counterpart is DERIVED from the exact Introduction Record, and the grant and the
delivery happen together - so there is no window in which a permission exists without a delivery, and
no reusable "share everything with this person" object to revoke. The resource vocabulary is closed
at five broad categories - `PARTIAL_IMAGE`, `FULL_IMAGE`, `FULL_NAME`, `CONTACT_METHOD` and
`DEEPER_PERSONAL_FIELD` - with no generic kind and no JSON anywhere; the type-to-payload binding is
structural, so a text resource carrying a media reference is a constraint violation rather than a bug
a reviewer must catch. A partial image and a full image are two INDEPENDENT resource versions and
neither authorizes the other. Image references are opaque server-side media object identities,
CHECKed exactly as 0089 CHECKs a voice note: not a URL, no query, no fragment, no credential-shaped
token. Every delivered disclosure becomes real Shared history - an I-04F history item whose exact
baseline audience is the owner and the counterpart and whose exact material authority is the owner
alone, plus the reserved `EXPLICIT_DISCLOSURE` material 0089 created and gave no producer, plus an
`INDEPENDENT_TARGET_TRUTH` provenance edge, because the owner establishes their own truth and no
Matching private reasoning is read to decide what to disclose. Non-reciprocity is structural: there
is no code path that could create a reverse row.

The same migration extends the ONE canonical historical visibility entry point,
`resolve_shared_world_history_visibility_v1`, FORWARD-ONLY. Its Standard branches are preserved
exactly - the same union of membership-period visibility and explicit history grants, the same
temporal bounds, the same availability dominance. The `ACTIVE / INTRODUCTION` branch is strictly
NARROWER: an exact currently-open matched episode is required and visibility is the baseline-audience
conjunction alone, because at v1 an Introduction has exactly two humans and no add, remove or rejoin
flow, so there is no absence period for a history package to bridge. `0088`'s closed reader gains the
failed-Introduction branch over a NARROW Introduction entitlement family of its own - the
`shared_world_standard_*` tables are named for Standard closure and stay Standard-owned. And
`delete_shared_world_owned_material_v1` gains exactly one branch, named by kind: an
`EXPLICIT_DISCLOSURE` loses its typed payload when its owner deletes it, while the resource version,
its grant fact and its material envelope survive as non-content audit identity.

`0116_introduction_terminal_lifecycle_v1.sql` owns the two terminal outcomes and makes "exactly one"
a property of the database. Both converge on `introduction_terminal_commits`, written LAST, under
`UNIQUE (introduction_record_id)`: SUCCESS versus END, END by A versus END by B and two competing
commands of either kind all resolve to one surviving row, because the loser violates a unique index
rather than losing a procedural comparison. SUCCESS requires BOTH matched humans to hold a CURRENT
approval over ONE exact immutable transition version whose payload is fixed by CHECK; approval is an
immutable act chain plus one pointer, the human is `auth.uid()` with no actor parameter, and
withdrawal works right up to the commit. The commit itself derives NO actor: system execution may run
only BECAUSE both approvals exist, and the deploy-time assertion refuses a commit that reads
`auth.uid()` or writes an approval. END is unilateral by either matched human, needs no counterpart
act, and is deliberately NOT gated on the CW2-08 seam - a safety system may restrict what a human can
create, disclose or continue, but it must never make them unable to leave.

`0117_post_introduction_matching_reactivation_v1.sql` owns the one narrow boundary that may cross a
reserved post-Introduction pause. There is no automatic restart. Eligibility is proven from ONE exact
chain of immutable identities - the current act, the act it supersedes, the exact I-07C
`ACTIVE_INTRODUCTION` pause or I-07D `POST_*` act, the terminal commit, its terminal Introduction
Record and this human's RELEASED claim - and never from a timestamp or a latest-record inference.
Every current truth is revalidated through the canonical I-07A and I-07B resolvers rather than a
second copy of their logic, and the CW2-08 seam is the LAST gate. The frozen I-07A ceilings are not
widened: the generic resume stays USER_PAUSED-only and the generic activation still refuses an OFF
that descends from a pause it may not lift.

`0118_introduction_ordinary_shared_material_v1.sql` closes a gap independent review found: after a
Mutual Match the two humans were given a Shared World they could not actually speak in. CW2-03
requires Shared v1 to carry `HUMAN_TEXT`, `HUMAN_VOICE_NOTE` and `QANDEEL_PARTICIPATION`, and the
`ACTIVE / INTRODUCTION` phase exists precisely so QANDEEL can welcome the pair, break the ice,
surface safe differences and agreements and propose the transition to Standard - but 0115 gave the
phase exactly ONE producer, the reserved `EXPLICIT_DISCLOSURE`, and 0090's two ordinary commit cores
still refused every World that was not `ACTIVE / STANDARD`.

The fix is forward-only and deliberately small. 0090 itself anticipated it: its header says the
SCHEMA is not Standard-only and that a later reviewed Introduction producer would compose the same
relations. This migration is that producer, and it is not a NEW one - it REPLACES the two existing
cores through `CREATE OR REPLACE` so the SAME primitives serve both World modes. There is no second
material store, no second history model, no Introduction-specific commit path and no parallel truth
to reconcile later; the two typed human entry points delegate to the one core and are not touched at
all. In each core exactly one gate changes - `ACTIVE` and `STANDARD` becomes `ACTIVE`, and then
either `STANDARD` as before or `INTRODUCTION` while that World's Introduction Record is still
`ACTIVE` - and exactly one invariant is ADDED on the Introduction branch alone: the derived audience
must be exactly two humans. Everything else is preserved verbatim, including the human actor from
`auth.uid()`, QANDEEL as a system actor that derives no human at all, the World-row-first lock
order, the durable request identity and its three idempotency passes, the derived-never-supplied
audience, and the exact frozen I-03 effective-context, disclosure-gate, revalidation and readiness
evidence envelope. The Introduction envelope is the same as Standard or STRICTER, never looser: no
new privacy authority arrives with the phase, no Matching Context Grant is transferred or consulted,
no third member can exist, and no application role gains EXECUTE on anything.

Nothing downstream needed changing, which is the strongest evidence that the canonical model was the
right one to extend. 0115's Introduction visibility branch resolves history items by the
baseline-audience conjunction alone and never filtered on material kind, so ordinary material is
visible to exactly the two humans the moment it commits and an `EXPLICIT_DISCLOSURE` and a
`HUMAN_TEXT` sit in ONE history. 0116 snapshots the closed view through that same ONE visibility
entry point, so END freezes ordinary material into the Introduction closed-view entitlement
automatically; SUCCESS moves the World to `STANDARD` and touches no history at all, so the same
material continues into the Standard World with nothing copied, rewritten or re-derived. Both
terminal cores take the World row first, exactly as these cores do, so commit-versus-END and
commit-versus-SUCCESS serialize on it with no hybrid and no partial outcome. Migration 0090 is NOT
edited; its runtime verifier is reconciled additively instead.

### I-07D - the published cross-domain lock order

A terminal Introduction crosses Shared World and Matching, so it publishes one order and both cores
take it: the exact Shared World row `FOR UPDATE`; the exact Introduction Record; BOTH humans'
`matching_setup_locks` rows in canonical ASCENDING user-id order through the frozen 0111 helper -
never in role order, never in pair direction order, never incrementally per counterparty; then the
membership episodes, participation pointers, approval pointers and HELD claims in deterministic
identity order; then the entitlement snapshot, the terminal event, the participation acts and the one
terminal commit row. No advisory lock, no table lock, no process mutex.

Progressive disclosure takes the World row and then the exact Introduction Record, and acquires NO
Matching setup lock: after the Match the Shared World lifecycle is independent, and taking one here
would re-couple Matching permission to Shared disclosure and invent a deadlock surface the law does
not require. Approval and withdrawal take the same World-first order as the terminal commit, which is
what makes a withdrawal that wins the World lock able to make the commit observe a missing approval
and an approval that loses it observe a closed Introduction. Reactivation is a ONE-HUMAN Matching act
and takes exactly the locks one is entitled to: the caller's own setup row, then their own
participation pointer.

ONE database-owned instant is captured per terminal transaction, AFTER every lock wait and every
currentness check, immediately before the irreversible writes, and every effect of that one event
uses it. The I-07C lesson is explicit here: `CURRENT_TIMESTAMP`, `now()` and `transaction_timestamp()`
are all settled before a lock wait begins and can therefore decide state that changed while the
transaction was waiting.

### I-07D - verifier commands

```bash
npm run verify:introduction-progressive-disclosure:integration
npm run verify:introduction-terminal-lifecycle:integration
npm run verify:post-introduction-matching-reactivation:integration
npm run verify:introduction-ordinary-shared-material:integration
```

All four need `DATABASE_URL` pointing at a FULLY migrated database and run in CI as one reported
group after the `I-07C` group. Every fixture reaches a live Introduction through the REAL I-07A,
I-07B and I-07C boundaries as the humans involved, never by a direct write, and every seam replaced
for a run is restored byte for byte on every path. `verify-migration-0115.mjs` proves the eighteen
progressive-disclosure scenarios the contract requires - exact counterpart delivery, no third viewer,
no reciprocal authority, independent image versions, structural payload separation, exact
idempotency, refusal outside `ACTIVE / INTRODUCTION`, the production seam refusing with zero effects,
owner deletion destroying the payload and the effective visibility, and no contact route created -
plus the six visibility branches and a NO-GHOST proof. `verify-migration-0116.mjs` proves the success
authority model, the unilateral end, the exact committed shape of both outcomes at one instant, the
one-winner substrate with its key proven load-bearing, terminal idempotency that never re-reads live
state, Standard continuity after SUCCESS, a later Standard end reactivating nothing, both NO-GHOST
proofs, and nine barrier-pinned two-connection races (SUCCESS versus END in both directions, END
versus END, the success commit versus approval withdrawal in both directions, competing success
commands, disclosure versus END and versus SUCCESS in both directions, END versus owner deletion, the
terminal transition versus `TURN_OFF` in both directions, and versus a Matching Context Grant
revoke). `verify-migration-0117.mjs` proves the three real reactivation paths, both frozen I-07A
ceilings still refusing with the resume ceiling proven load-bearing, the full revalidation set, that
nothing revives, that one lineage is crossed at most once, the I-07 phase-closing forward contracts on
the live catalog, and two barrier-pinned races.

## QAN-CW-REM-01 - Shared historical authority resolution (migration 0119)

`0119_shared_historical_authority_remediation_v1.sql` corrects the accepted `ASSURE-F02` finding of
the Connected Worlds phase-wide architecture assurance. The canonical QANDEEL Shared material
producer ended its authority resolution with `ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT'`, so a
`QANDEEL_OUTPUT` or `QANDEEL_ANALYSIS` committed with no `MATERIAL_DEPENDENCY` and no
`REASONING_DEPENDENCY` was durably recorded as a POSITIVELY PROVEN EMPTY human requirement and its
history item written `NO_HUMAN_APPROVAL_REQUIRED`. Both downstream widening paths then accepted it:
the frozen I-04F history package admits a zero-approver manifest precisely when every item says
approval-free, and the frozen I-05A publication authority admits a zero-approver package. Nothing had
proved anything; the absence of a caller-supplied dependency array was being read as proof about
protected humans. It bites hardest in `ACTIVE / INTRODUCTION`, the phase whose purpose is QANDEEL
speaking about BOTH matched humans while the dependency vocabulary has no representable edge for the
Match handoff those observations come from.

**The resolution changes in two places.** A QANDEEL commit that reaches the end of the resolution with
no enumerable required human now records `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` - the state this
repository already used for exactly this fact, on exactly this rationale, for the reasoning-bearing
case. `INDEPENDENT_TARGET_TRUTH` is unchanged and still written: it is provenance, it is true, and it
was never a protected-human clearance. No approver is invented, no counterpart is turned into one,
World membership is still not an authority, and no signature gained a parameter. `RESOLVED_NO_HUMAN_
REQUIREMENT` becomes unreachable from this producer, which is the honest state of the repository, and
stays representable so a later reviewed subject-authority resolver re-enables it additively.

**And an unresolved source makes an unresolved target** (`REM01-AUTH-01`, found by independent interim
review of this change). The producer classified a target from its known approver COUNT alone, so a
target whose `MATERIAL_DEPENDENCY` source was itself unresolved inherited that source's known owners,
reached `WHEN approvers > 0`, and was recorded `RESOLVED_EXACT_HUMAN_REQUIREMENT` — laundering the
source's unknown half away in exactly one edge, and then transitively, which would have made the
correction above cosmetic for every descendant. A `MATERIAL_DEPENDENCY` means the target REPRODUCES
its source, so it inherits the source's whole requirement, and the known half does not answer the
unknown half. The new arm is evaluated BEFORE the known-owner arm, and source state is read through
the same two-state predicate migrations `0093` and `0105` already use, so missing source-side
authority metadata fails closed for the same reason an unresolved one does. **The known approver rows
are still derived and still written.** An unresolved target with known required humans is a shape
this repository has produced since I-04G for the mixed reasoning case and reads correctly everywhere.

**Ordinary participation is untouched.** The material still commits, its exact baseline audience still
sees it through the same resolver in both frozen World modes, and QANDEEL can still speak. What fails
closed is a LATER AUDIENCE WIDENING of material whose protected-human requirement was never
established.

**Four surfaces, each necessary.** The PRODUCER stops writing the unproven state. The RECONCILIATION -
`reconcile_shared_world_material_historical_authority_v1`, postgres-only, fail-closed-direction-only,
idempotent - moves rows already written under the old arms forward on the authority-resolution relation
migration 0090 created for exactly that purpose; it writes one column of one relation and rewrites no
source body, provenance identity, instant, baseline viewer, approver row or dependency edge, and the
frozen `authority_requirement_mode` immutability trigger is neither disabled nor bypassed, so a
reconciled item keeps the mode its original commit really used and is refused by CURRENT state rather
than by a rewritten past. It moves **two** shapes: the unproven clearance written directly, and the
`RESOLVED_EXACT_HUMAN_REQUIREMENT` rows that depend, directly or transitively, on a source that is not
itself positively resolved — the same defect one edge later. The closure follows `MATERIAL_DEPENDENCY`
forward from every source that is not exactly resolved; `0089`'s strict source-precedes-target CHECK
makes that graph acyclic, so one traversal really is the fixed point, and the migration refuses to
deploy unless the one-edge residue is zero, which by induction witnesses the whole fixed point. The GRANT BOUNDARY re-asks under the World lock, because the frozen
preparation-time trigger cannot cover a manifest prepared BEFORE the correction and a manifest is
immutable. EFFECTIVE VISIBILITY stops an already-committed grant from continuing to widen: the grant
row and the `HISTORY_GRANTED` fact are retained as durable evidence, and the grant basis - and only
the grant basis - stops carrying currently-unresolved material, in the ACTIVE branch and in the
`READ_ONLY_CLOSED / STANDARD` snapshot alike, with the membership-period basis untouched. The
Introduction closed snapshot needs no such subtraction and gets none: its branch has no grant basis at
all, so every item it can hold is already a baseline item of the human holding it.

**The Public half is composition, not modification.** No Public code changes. Migration 0093's
preparation and the 0105 replacement of `derive_public_publication_authority_v1` both already require
a Shared source to be in one of the two RESOLVED states and both already raise
`PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED`; `derive_public_continuing_eligibility_v1` already
turns that raise into `PUBLICATION_AUTHORITY_INVALIDATED`. Correcting the source state is the whole
Public fix, and no Public lifecycle moves - this task is about authority invalidity, not source
deletion, and the frozen rule that source unavailability alone creates no retroactive withdrawal is
untouched. Historical migrations `0075`-`0118` are byte-identical.

### QAN-CW-REM-01 - verifier command

```bash
npm run verify:shared-historical-authority-remediation:integration
```

`verify-migration-0119.mjs` needs `DATABASE_URL` pointing at a FULLY migrated database and runs in CI
after the I-07D group. It commits through the REAL frozen boundaries rather than writing the rows it
then reads: a zero-dependency output commits and reaches its exact baseline audience in a Standard
World and in a live Introduction reached through the real I-07A, I-07B and I-07C ladder; it records
UNRESOLVED and never the proven-empty clearance; reasoning-only, exact-material-owner and human
material are all proven non-regressed; and a derivative cannot launder a zero-dependency output back
to proven-empty. The reconciliation is proven on a row seeded in EXACTLY the shape the pre-remediation
producer wrote - migration 0119 makes that state unreachable from the boundary by design, so the old
row is reproduced rather than faked by falsifying immutable history - and is proven idempotent, narrow
and history-preserving by full before/after equality. The widening matrix packages, approves, grants
and closes a World through the real frozen primitives, and the Public matrix prepares, reaches review
and publishes through the real ones with the CW2-08 seam simulated inside the transaction and restored
byte for byte.

It also decides the provisional `ASSURE-F04` cross-World row-lock finding on real PostgreSQL. The
claimed cycle is reconstructed from the live function bodies - `prepare_public_experience_manifest_v1`
locks Shared World rows by the World ids the CALLER named but locks Shared materials by id alone, and
migration 0089 orders dependency edges TEMPORALLY rather than on the uuid, so a target may sort below
its source and the deletion's `X then Y` crosses every other site's ascending order - and then decided
by a three-connection race whose interleaving is pinned on an observable lock wait and whose verdict
is read from PostgreSQL's own deadlock accounting, never from a sleep. Migration 0119 changes no
locking statement: the verdict is evidence, not a silent repair.

## QAN-CW-REM-02 - Matching proposal temporal correctness and exact-view command identity (migration 0120)

`0120_matching_proposal_temporal_exact_view_remediation_v1.sql` corrects two accepted findings of the
Connected Worlds phase-wide architecture assurance, and the two interim-review findings that proved
each of those corrections was still short of its own rule. All four are defect CLASSES that `I-07C`
already found and fixed at one site each, in migration `0114`, while the sibling `I-07B` sites in
migration `0112` kept them.

**`ASSURE-F01` - a transaction clock decided a deadline after a lock wait.** Both proposal-delivery
paths took the canonical two-human lock, then compared `expires_at` against `CURRENT_TIMESTAMP`, then
disclosed. `CURRENT_TIMESTAMP` is the TRANSACTION-START timestamp in PostgreSQL - and so are `now()`,
`transaction_timestamp()` and `statement_timestamp()` - so it is settled BEFORE the command ever waits
on that lock. A delivery that began while the proposal was live, blocked for minutes, crossed
`expires_at` while blocked and then resumed compared a moment that had already gone by and disclosed
protected proposal material after the real deadline.

**`REM02-TIME-01` - and "before the first irreversible write" means the first write.** Moving that
decision to just before the disclosure gate was still too early. `materialize_matching_recipient_view_
core_v1` re-enters the pair lock, answers its own view idempotency, derives the audience, re-reads the
eligibility snapshot, revalidates the subject's CURRENT setup authority, reads the Product field
policy, reads the permitted conclusion, resolves the canonical first name, takes the recipient's
view-state row `FOR UPDATE` and scans every approved value through the output filter - and the deadline
can cross during all of it. So the ONE final decision moved INTO the gate, at its real first-write
boundary:

```text
historical existing-view retry          -> answered, before any deadline decision
canonical pair lock, every current gate
view-state row FOR UPDATE
every field, policy, name and value check
delivery_at := clock_timestamp()
expires_at <= delivery_at               -> MATCHING_PROPOSAL_EXPIRED
INSERT INTO matching_recipient_proposal_views   -- the first write
```

There is exactly ONE wall-clock decision on the delivery path, not two: the two delivery cores now read
no clock at all, and the gate reads exactly one - which is also what the recipient's current-view
pointer records as its `updated_at`, so the gate is single-clocked the way the Mutual Match is. The
refusal is the existing `MATCHING_PROPOSAL_EXPIRED`, and an already materialized view answers its own
retry before the decision, because history is not re-decided.

**The sweep is a class correction, not a global clock replacement.** Every transaction-fixed clock in
the proposal choreography was classified. The other three are left exactly as they are, because in each
of them a stale clock can only refuse, delay or shorten. Preparation's cadence window moves its lower
bound EARLIER and therefore counts MORE prior proposals and refuses more often; preparation's deadline
is minted from the one coherent transaction instant `prepared_at` also carries, and an older clock
yields a SHORTER life, so replacing it would have LENGTHENED every proposal; and the protective expiry
terminal's `expires_at > CURRENT_TIMESTAMP` refusal can only decline to fire, never end a proposal that
is not really past its deadline. The four human decisions read no clock at all. The terminal
self-assertion pins all three of those in place, so a later sweep cannot tidy them away.

**`ASSURE-F08` - three human-decision retries proved no exact view.** Each of the four `I-07B` human
decisions takes `p_expected_view_id`, because a consequential human act is authorized by the exact
recipient view version that human saw. Migration `0114` made the `FIRST_FORWARD_APPROVED` retry prove
it. Its three siblings - the first decline, the second decline and the withdrawal - still answered
historical success from the transition alone, so a retry carrying a DIFFERENT view received the
original committed answer, which is a different request answered under a reused command id.

**`REM02-IDEM-01` - and the two DELIVERIES had the same defect.** A delivery retry reconstructed the
delivered view from the recipient's CURRENT view pointer, and never compared `p_permitted_conclusion_
id` at all. The frozen `I-07B` model says in so many words that a recipient view is an immutable
version, that currentness is a pointer which may move forward, and that a superseded view remains
historical truth - so a mutable pointer cannot be the durable identity of a historical command. And the
permitted conclusion is an immutable input that determines the immutable view being delivered, so same
command, same view, different conclusion is a DIFFERENT REQUEST.

**Three bindings, three different authority facts.** Migration 0120 adds two relations and replaces
none:

```text
matching_forward_approval_view_bindings   what the first party APPROVED   (0113 / 0114)
matching_proposal_delivery_view_bindings  what QANDEEL DELIVERED          (0120)
matching_proposal_decision_view_bindings  what a human TERMINALLY DECIDED (0120)
```

Each producer writes its binding in the same transaction as its transition, and each retry answers from
that durable row: the same immutable request is the historical result, any other view - or, for a
delivery, any other conclusion - is `MATCHING_COMMAND_ID_CONFLICT`, and a committed transition whose
binding is absent is `MATCHING_DELIVERY_CONTRADICTORY_STATE` or
`MATCHING_DECISION_CONTRADICTORY_STATE`. A delivery retry reads the conclusion from the IMMUTABLE bound
view rather than from a second copy of it. Withdrawal keeps `p_expected_state` as part of its command
identity, because `WITHDRAWN` is legal from three states, and now compares both.

**The bindings are structural rather than conventional.** The state fixes the role by CHECK; the role
fixes the bound view's own role by foreign key; the view is bound to THIS proposal FOR THAT HUMAN by a
second one; the transition is bound to this proposal and this exact state by a third; and the frozen
`0110` audience CHECK then pins the view's recipient to exactly one of the proposal's two members. A
binding to another proposal's view, another human's view, or a role the state does not permit is
unrepresentable. Both relations are append-only through the `0110` mutation guard, have row level
security on with no policy, and are reachable by no application role. One additive candidate key -
`UNIQUE (id, recipient_role)` over the recipient-view primary key - is the only predecessor change, and
it refuses nothing `0110` accepted.

**Transitions committed before `0120` are left exactly as they are.** No historical exact-view evidence
is invented. Such a transition keeps its row, its view rows, its private terminal reason and its
terminal proposal lifecycle; nothing is backfilled and nothing is deleted. What its command can no
longer do is claim an equivalent retry, because it cannot prove the view that authorized or carried it -
so that retry fails closed, which is the same answer `0114` chose for a forward approval with no
binding. Historical migrations `0075`-`0119` are byte-identical.

### QAN-CW-REM-02 - verifier command

```bash
npm run verify:matching-proposal-temporal-exact-view-remediation:integration
```

`verify-migration-0120.mjs` needs `DATABASE_URL` pointing at a FULLY migrated database and runs in CI
after the `QAN-CW-REM-01` verifier. It drives the real boundaries throughout. The cross-deadline races
are barrier-pinned rather than timed, and there are two kinds. The OUTER pair-lock races hold exactly
the row the canonical two-human lock takes while the delivery blocks on it from another connection; the
waiter's own `xact_start` is proven to PRECEDE the deadline it will be refused against, the real
database clock is watched until the deadline passes, the waiter is confirmed to be STILL blocked, and
only then is the lock released. The INNER race puts the wait past the pair lock and inside the
disclosure gate itself, by making the canonical first-name seam - which this verifier already replaces,
and whose future implementation is a real lookup that can wait - block on one inert serialization row
belonging to a third human who is no part of the pair. Both require ZERO surviving delivery effects: no
view, no fields, no pointer, no transition, no binding, and a proposal left exactly where it was. The
first-recipient and second-recipient proofs are independent. The SAME outer interleaving is then run
against the pre-fix decision, installed from the canonical `pg_get_functiondef` text and proven to have
changed it, to show that a transaction-fixed clock really does disclose after the real deadline; the
canonical definition is restored byte for byte and the teardown re-reads it rather than trusting the
restore.

The delivery identity matrix commits each delivery through the real boundary and proves the binding,
the same-view-and-conclusion retry, the different-view conflict, the different-conclusion conflict, the
missing-binding refusal for both states with nothing inferred and no new view materialized, and that a
current view pointer moved AFTER the delivery changes no retry identity. The exact-view matrix does the
same for the three decisions, and adds the full withdrawal matrix over prior state and view together,
the roll-back-together proof, and five wrong binding shapes refused by the database itself. The
non-regression half re-proves the `0114` forward approval in all three directions, a full Mutual Match
on the exact bound approval view, the `I07B-CONC-01` view-supersession race, that no binding reaches any
recipient projection while the neutral outcome vocabulary is unchanged, and that the CW2-08 gate still
holds the four consequential boundaries while withdrawal still ends a human's own exposure without it.