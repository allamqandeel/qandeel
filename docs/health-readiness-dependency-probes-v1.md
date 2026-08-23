# Health / Readiness / Dependency Probes v1

`GET /health` remains the compatibility liveness route and `GET /health/live` is its explicit equivalent. Both are dependency-free, return HTTP 200 with `{ "status": "ok", "service": "qandeel-api" }`, and make no database, Redis, provider, Sentry, or OpenTelemetry call.

`GET /health/ready` concurrently evaluates four fixed dependencies. Database and model-provider configuration are required; either failing, timing out, or being unconfigured yields HTTP 503 and `not_ready`. Runtime events and observability are optional; their `not_configured`, `unavailable`, or `degraded` state remains HTTP 200 when required dependencies are ready. Responses contain only fixed dependency names, requirement classes, and bounded states.

The database probe uses the normal core Data API boundary (`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`) to send one `HEAD` request to the PostgREST root. It is independent of the optional outbox table and publisher service-role configuration, retrieves no row or response body, performs no mutation, requires no end-user identity, and has a configurable 100–5000 ms timeout (`HEALTH_DATABASE_TIMEOUT_MS`, default 1500 ms). No migration is needed.

Model-provider readiness calls the existing OpenAI or Anthropic configuration loader selected by `MODEL_PROVIDER`; it never constructs a request or invokes generation. Runtime-event readiness reads the existing publisher/Redis transport's local configuration and connection state and never opens a second connection or performs `XADD`. Observability readiness reads only existing Sentry/OpenTelemetry configuration and initialization state and never sends an event or export.

Probe exceptions are converted to bounded states. Raw errors, endpoints, credentials, identifiers, payloads, content, and latency are never returned. Health is not a repair, migration, user-specific diagnostic, paid synthetic request, alerting, dashboard, deployment-manifest, or provider-routing system. Load balancers should use `/health/live` for process restart decisions and `/health/ready` for traffic admission.
