# Qandeel API

NestJS backend for the Qandeel runtime.

## Current scope

This branch intentionally implements only the backend skeleton and the first health endpoint. It does **not** implement authentication, database access, model providers, memory, voice, or product behavior yet.

## Local commands

From the repository root:

```bash
npm install
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
