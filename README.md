# Qandeel

This repository is the canonical codebase for the product. Engineering implements the frozen contracts and does not invent missing product logic.

## Start here

1. [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md) — where the project stands, per domain, and where each
   domain's authority lives.
2. [`QANDEEL_PROJECT_MAP.md`](QANDEEL_PROJECT_MAP.md) — the repository map, the authority precedence, and the
   historical documents that must not be read as current.
3. [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md) — the one canonical cross-task
   backlog.

Coding agents also follow [`AGENTS.md`](AGENTS.md). These entry points are locators. They create no Product
authority, and they schedule no task.

## Current status

The repository holds two different kinds of material. Keep them apart.

- **Merged runtime implementation.** This covers the NestJS conversation and intelligence runtime, the
  Living Analysis Map mobile client, and the Connected Worlds database runtime phases. Several of these are
  closed and frozen, and each one's lifecycle is stated by its own record.
- **Frozen Product / design authority that production code does not yet implement.** This covers the I-08B
  visual system and the Product proofs, among others.

Neither is the finished Product. For each domain's lifecycle, what is implemented as opposed to only
decided, and the open register, see [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md). Those entry points
do not schedule a next Product or implementation task.

Provider rule (frozen): model providers sit behind the Model Router, and a realtime voice provider will sit
behind a Voice Adapter. No voice runtime exists yet (`QAN-BL-VOICE-01`).

## Working rule

Build, test, benchmark, observe, and change contracts only when evidence requires it.

## Local development

Install Node.js 22.13 or newer (including npm 10 or newer) and Git through your normal machine setup.
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

## Mobile client

`apps/mobile` is the React Native (New Architecture) + Expo (Continuous Native
Generation) + TypeScript workspace for iOS and Android. It is installed and locked by
this root lockfile only; never create a nested lockfile there. Its secret-free gates:

```sh
npm run test:mobile-foundation-contract
npm run typecheck:mobile
npm run lint:mobile
npm run test:mobile
npm run deps:check:mobile
npm run doctor:mobile
npm run prebuild:mobile
```

Native builds and the device boot smoke run in `.github/workflows/mobile-ci.yml`
(Android emulator and iOS simulator). Generated `apps/mobile/ios` and
`apps/mobile/android` directories are never committed. See `apps/mobile/README.md` for
the toolchain pins and the intentional TypeScript exception.
