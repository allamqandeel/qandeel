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
role, lifecycle state, processing path, complexity, routing metadata, channel, and
server identifiers are authoritative and cannot be supplied by the client. The
response contains the authoritative `userTurn` and, after successful generation,
exactly one `assistantTurn`.

Conversation Orchestrator owns this TEXT lifecycle. It claims a new user turn once,
uses Fast by default, selects Deep only for the explicit input-size threshold, and
calls a provider-independent Model Router contract. Runtime generation uses the
official Anthropic SDK with Claude Sonnet 4.6. Set `ANTHROPIC_API_KEY` in the ignored
local environment before starting the API; startup fails closed when it is absent.
Tests use an in-process fake and never make paid provider calls. Database-atomic
finalization suppresses late output after cancellation or
other terminalization and enforces one assistant result per source turn.

Memory Runtime, additional model providers, full Behavioral/Safety runtimes, streaming,
voice, and UI remain later focused implementation gates.

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

An explicit local Claude smoke gate is available:

```bash
npm run verify:claude:smoke
```

It reads `ANTHROPIC_API_KEY` from the process or ignored root `.env`, makes exactly
one minimal request with SDK retries disabled, and verifies only that normalized
text and token usage are present. It is not part of ordinary CI. Its output never
includes the prompt, context, credential, raw provider response, transcript, or
private identifiers; without a credential it reports `NOT RUN` without making a call.

