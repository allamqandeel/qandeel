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
calls a provider-independent Model Router contract. Runtime generation supports
Anthropic and OpenAI through separate official-SDK adapters. Select exactly one with
the server-owned `MODEL_PROVIDER=anthropic|openai` setting and provide the matching
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in the ignored local environment before
starting the API. Missing, invalid, or incomplete provider configuration fails closed.
The selected server-owned profile maps the Orchestrator's already-selected path as follows:

| Provider profile | FAST | DEEP | Reasoning |
| --- | --- | --- | --- |
| `anthropic` | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` | Thinking disabled for both paths |
| `openai` | `gpt-5.6-luna` | `gpt-5.6-terra` | FAST `none`; DEEP `low` |

Provider activation remains static for the process. There is no fallback, per-turn
provider switching, client override, adaptive reasoning, or extended/adaptive Claude
thinking. Model and reasoning configuration remain internal to the Model Router and
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

An explicit local Claude smoke gate is available:

```bash
npm run verify:claude:smoke
```

It reads `ANTHROPIC_API_KEY` from the process or ignored root `.env`, makes exactly
one minimal request with SDK retries disabled, and verifies only that normalized
text and token usage are present. It is not part of ordinary CI. Its output never
includes the prompt, context, credential, raw provider response, transcript, or
private identifiers; without a credential it reports `NOT RUN` without making a call.

The equivalent explicit OpenAI gate is:

```bash
npm run verify:openai:smoke
```

It uses the centralized OpenAI text baseline through the Responses API, makes one
bounded attempt with retries disabled, and applies the same safe output rules. It is
never invoked by tests or CI and reports `NOT RUN` when `OPENAI_API_KEY` is absent.

