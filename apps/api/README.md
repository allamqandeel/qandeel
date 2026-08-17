# Qandeel API

NestJS backend for the Qandeel runtime.

## Current scope

The API exposes the health endpoint and the first authenticated Conversation Runtime
boundary. Supabase access tokens are verified server-side, the verified Auth UUID is
the only accepted user identity, and the same bearer token is forwarded to the
Supabase Data API so PostgreSQL RLS remains an active enforcement layer.

Authenticated endpoints:

```text
POST  /conversation/sessions
GET   /conversation/sessions/:sessionId
POST  /conversation/sessions/:sessionId/turns
PATCH /conversation/sessions/:sessionId/turns/:turnId/cancel
```

The turn body accepts only `content` and optional `idempotencyKey`. User identity,
role, initial lifecycle state, channel, and server identifiers are authoritative and
cannot be supplied by the client. Duplicate idempotency keys resolve to the existing
turn. Cancellation updates only non-terminal turns, so completed, failed, cancelled,
or superseded outcomes cannot be rewritten by a late request.

This boundary deliberately does not generate an assistant response yet. Model Router,
provider adapters, Context Builder, Memory Runtime, and complete Behavioral/Safety
policy stages remain later focused implementation gates.

## Local commands

From the repository root:

```bash
npm ci
npm run start:api
```

Then open:

```text
GET http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "qandeel-api"
}
```

Tests:

```bash
npm run test:api
```

