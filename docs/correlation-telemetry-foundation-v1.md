# QANDEEL — Correlation & Telemetry Foundation v1

QANDEEL uses a provider-neutral correlation chain: `request_id → session_id → turn_id → orchestration_id → engine_call_id → provider_call_id`. These UUIDs are application correlation identifiers, not OpenTelemetry trace or span IDs, and are never derived from `traceparent`.

The server generates `request_id` for every inbound request and returns it as `x-request-id`; inbound values are not authoritative. Canonical session and turn IDs are bound only after owned runtime objects resolve. An orchestration ID exists only after a successful claim. Engine and provider identifiers are nested, per-call values propagated with `AsyncLocalStorage`.

## Privacy and conventions

Spans use bounded `qandeel.*` attributes. Incoming automatic HTTP/Express span export is reduced to method, verified route template when available, and response status; automatic events, status descriptions, raw paths, targets, URLs, addresses, and headers are removed, and outgoing automatic HTTP spans are disabled. Metrics use only engine, provider, model, processing path, and outcome dimensions. Telemetry never contains messages, outputs, prompts, Memory or HIM payloads, credentials, bodies, query strings, raw rows, idempotency keys, or correlation IDs as metric labels. No correlation identifier enters provider prompts, bodies, or headers. Signal-specific OTLP endpoints and the generic OTLP base endpoint are resolved by the official exporters, preserving standard `/v1/traces` and `/v1/metrics` behavior.

OpenTelemetry exclusively owns tracing and metrics. HTTP, Express, and manual QANDEEL spans are enabled; OTLP HTTP exporting is created only when an explicit OTLP endpoint is configured and is disabled in tests. Standard OTEL sampling configuration remains authoritative.

Sentry owns error/crash reporting through `@sentry/nestjs`. Its tracing is disabled, OpenTelemetry setup is skipped, default PII is disabled, and project sanitization removes request URLs and paths, bodies, query strings, all request headers and cookies, transactions, users, extras, raw contexts, breadcrumbs, raw exception messages, stack locals, and code context while retaining bounded structural stack fields. Sentry networking is disabled without `SENTRY_DSN` and in tests.

Required metrics are engine/provider duration, provider calls/errors/input/output tokens, and turn outcomes. Token metrics use returned provider usage only; monetary cost is not calculated.

Observability is fail-soft and does not participate in database transactions or alter conversation output, routing, safety, Memory, or HIM behavior. Export failures must not fail successful runtime work, and underlying runtime errors remain authoritative.

Configuration uses standard `OTEL_*` variables, including explicit OTLP trace/metric endpoints, plus `SENTRY_DSN`, `NODE_ENV`, and service/environment/version resource metadata.

## Reconciliation status

Transactional Runtime Outbox + Event Publisher v1 and Health / Readiness / Dependency Probes v1 were completed after this telemetry foundation and are now part of the reconciled Foundation v1. They remain separate operational surfaces and do not change this document's correlation or telemetry ownership rules.

Still deferred beyond Foundation are persistence of correlation IDs beyond the implemented runtime propagation model, voice correlation, product analytics, and prompt/response monitoring.
