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
```

Apply migration 0001 first on a clean database. The current verifier applies migration
0002 only when none of its expected objects exists and refuses partial state. It then
checks the safe Auth trigger/function definition, proves Auth provisioning with a
rolled-back `auth.users` insert, checks RLS and policy catalogs, and exercises owner,
cross-user, ownership-transfer, and anon behavior. All temporary rows are rolled back.

This command is an explicit integration gate and is not run by ordinary CI because
CI does not receive a development database secret. The secret-free structural test
remains available through `npm run test:database`.

## Real Supabase Auth smoke test

The explicit Auth smoke command signs a dedicated test user in through Supabase Auth
and exercises the application tables through Supabase's authenticated PostgREST path.
It is a local integration gate and is not part of ordinary secret-free CI.

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
