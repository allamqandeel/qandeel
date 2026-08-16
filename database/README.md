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

This slice does not add Memory Runtime tables, RLS policies, provider routing data,
voice-provider data, or repository/service code. Executing the migration against a
real PostgreSQL instance is the next integration-test gate; the current automated
test checks the migration's structural contract without adding infrastructure.
