# HIM structured-measurement preflight

Before pushing or opening a PR for any structured HIM measurement model, run:

```sh
npm run verify:him-measurement-preflight
```

Do not push until it is green. Every approved context must have an explicit positive model, SQL, binding, and current-read path; every unsupported context must remain excluded and have a fail-closed path. Update the single preflight manifest when the governed calibrated set changes.

The preflight composes the fast API/model tests, database contract tests, TypeScript no-emit check, and a shared drift test for calibrated metrics, context allowlists, ACTIVE bindings, SQL predicates, and current-read routing. Its mutation assertion proves a reversed approved-context predicate is rejected locally.

This command does not replace GitHub Actions. Fresh PostgreSQL 16 migrations, historical and per-metric real-database verifiers, RLS/security checks, correction/currentness/idempotency/concurrency tests, and binding-integrity tests remain mandatory after push.
