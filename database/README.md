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
