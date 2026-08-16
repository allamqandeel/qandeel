# Qandeel

Qandeel is entering controlled implementation.

This repository is the canonical codebase for the product. Engineering implements the frozen contracts and does not invent missing product logic.

## Current status

- Engineering Foundation: frozen for controlled implementation
- First target: project skeleton, then the first authenticated end-to-end text vertical slice
- Model provider: configurable behind Model Router
- Voice provider: configurable behind Voice Adapter

## Working rule

Build, test, benchmark, observe, and change contracts only when evidence requires it.

## Local development

Install Node.js 20 or newer (including npm) and Git through your normal machine setup.
GitHub CLI is optional for local implementation and verification; it is needed only
when publishing a pull request. Repository scripts never install or modify global
software.

From a fresh checkout, use the committed root lockfile:

```sh
npm run preflight
npm ci
```

This repository uses npm only. Do not use pnpm, fallback package runners, or
package-manager download shims. The ordinary secret-free verification flow is:

```sh
npm run test:database
npm run test:toolchain
npm run test:api
npm run build:api
```

Real integration checks are separate and require the ignored root `.env`:

```sh
npm run verify:integrations:diagnose
npm run verify:database:integration
npm run verify:auth:smoke
```

Copy `.env.example` to `.env` and populate only the variables needed locally. `.env`
remains ignored; preflight and diagnostics report names/status only and never values.
The database integration check needs `DATABASE_URL`. The Auth/RLS smoke check needs
all five database and Supabase test variables documented in `database/README.md`.

If dependencies become corrupt, close running Node processes, remove only the local
root `node_modules` directory manually, and rerun `npm ci`. Dependency deletion or
renaming is deliberately not part of normal repository scripts.
