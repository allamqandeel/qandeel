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
calls a provider-independent Model Router contract. Since S8A-03 (Founder decision D1) every
AI call - the reply and the seven structured semantic adapters - runs on DeepSeek Flash
through one shared client; the Anthropic, OpenAI and Gemini adapters were removed. Set the
server-owned `MODEL_PROVIDER=deepseek`, `DEEPSEEK_API_KEY` and
`DEEPSEEK_QUALIFICATION_MODE=SYNTHETIC_ONLY` in the ignored local environment before
starting the API. DeepSeek is qualification-only: it may process synthetic data only, and a
production process refuses it. Missing, invalid, or incomplete provider configuration fails closed.
The server-owned profile maps the Orchestrator's already-selected path as follows:

| Provider profile | FAST | DEEP | Reasoning |
| --- | --- | --- | --- |
| `deepseek` | `deepseek-flash` | `deepseek-flash` | FAST thinking disabled; DEEP thinking enabled, effort `low` |

The structured adapters run DeepSeek Flash with thinking disabled and JSON Output; their own
fail-closed parsers and deterministic validators remain the enforcement.

Provider activation remains static for the process. There is no fallback, per-turn
provider switching, client override, or adaptive reasoning. Model and reasoning configuration remain internal to the Model Router and
are not returned in client or domain contracts.
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

The former Claude and OpenAI smoke gates (`verify:claude:smoke`, `verify:openai:smoke`) were
removed with those providers in S8A-03. Paid DeepSeek evaluation stays an explicit,
operator-only, synthetic-data command and is never invoked by tests or CI.

