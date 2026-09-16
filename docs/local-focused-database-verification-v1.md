# Focused Database Verification v1

**Task:** `QAN-INF-05 — Focused Database Verification + Local Disposable PostgreSQL Harness v1`
**Status:** CANDIDATE — awaiting independent ChatGPT review
**Scope:** DevEx / CI infrastructure. No Product semantics, no runtime behaviour, no migration.

---

## 1. Why full API CI is not the debugger

A real-PostgreSQL verifier is a program. On a development host with no PostgreSQL it is written
blind, so its own defects can only be found by running it — and the only place it ran was API CI,
which executes about a hundred and forty steps and reaches the database verifiers at the end of
them.

That makes the cost of one finding roughly twenty minutes, and a verifier that stops at its first
failure yields exactly one finding per run. The arithmetic is unforgiving:

```text
total wall clock  ~=  (latent verifier defects)  x  (CI round-trip)
```

`I-06A` carried nine latent defects in two verifiers and paid six full rounds for them. Not one of
the six was a defect in the migration being proven. Every one was a defect in the program doing the
proving — a `now()` that could not change a value, a swallowed error that aborted a transaction, a
microsecond truncated by a JavaScript `Date`, a literal count the verifier itself had outgrown, a
mutation anchor taken from the migration's line wrapping rather than from PostgreSQL's own output.

This task attacks both factors:

| Factor | Before | After |
| --- | --- | --- |
| Round-trip | full API CI, ~20 min | focused gate, ~4 min |
| Findings per round | 1 (fail-fast) | all independent scenarios at once |
| Where a defect class is caught | CI, eventually | `npm run test:database`, before the push |

API CI goes back to being the **confirmation gate** it should be.

---

## 2. The focused gate

`.github/workflows/focused-database-verification.yml` starts a fresh `postgres:17`, applies the
Supabase-compatible bootstrap, applies **every** migration from zero in canonical filename order,
and then runs **only** the selected verifier(s).

It carries no secrets, needs none, never touches production Supabase, deploys nothing and merges
nothing. `contents: read` is the whole of its authority. It has no Redis: the Replay verifiers need
PostgreSQL only, and parity does not mean "copy every service full CI happens to run".

### The canonical bootstrap

`database/supabase-compatible-bootstrap.sql` is the **one** definition of the Supabase-compatible
posture — the three roles migrations grant to, the `auth` schema, `auth.users`, and `auth.uid()`.
Both `api-ci.yml` and this gate apply that same file; neither carries a copy.

This is not a style preference. Parity was originally enforced by comparing this file against inline
SQL in `api-ci.yml`, and that comparison can only ever run in one direction: API CI could grow a
bootstrap requirement while the focused gate silently stayed weaker, and the check would still pass.
Sharing one artifact removes the direction entirely — a statement added here strengthens both gates
in the same commit.

The version number is not the parity claim; these roles and this function are. The contract pins
both halves: that both workflows still consume the file, that neither reintroduces inline
bootstrap SQL, and that the file itself still creates the whole posture, so sharing it cannot become
a way to weaken both gates at once.

### Using it

From the repository's Actions tab, select **Focused Database Verification**, choose the **default
branch** in the workflow's own branch selector, and run it with two inputs:

| Input | Meaning |
| --- | --- |
| `target_ref` | the branch, tag or SHA to verify |
| `verifier` | which verifier(s) to run |

Choosing any other branch in that selector fails the run in its first step, on purpose — see below.

### Two refs, and which one judges which

The job makes **two** checkouts, and they are pinned separately and explicitly:

| Checkout | Ref | Supplies |
| --- | --- | --- |
| `.qan-harness` | on a dispatch, the **repository default branch**; on the self-test, the PR's own commit | the selector mapping, the canonical bootstrap, the runner |
| `repo` | the validated `target_ref` | migrations, verifiers, `package.json` |

This split is deliberate and load-bearing, in both directions.

**Dispatch the workflow FROM `main`. Select what to test with `target_ref`.**

This is a rule about the run, not only about a checkout, because a `workflow_dispatch` run executes
the **workflow definition belonging to the ref it was dispatched from** — this file, its steps, its
`env` block. Pinning the harness checkout is necessary and *not* sufficient: a branch could edit the
gate, dispatch it from itself, and be judged by job logic it wrote, with the harness pin quietly
removed. The pin cannot defend itself, because it lives in the thing being replaced.

So the job's **first step** refuses any manual dispatch whose workflow ref is not the repository
default branch, before any checkout:

```text
github.event_name == 'workflow_dispatch' && github.ref_name != github.event.repository.default_branch
```

It fails immediately and says what to do instead: run the workflow from the default branch and put
the branch, tag or SHA under test in `target_ref`. It does not warn and continue.

With that in place, `FOCUSED_HARNESS_REF` — which resolves to
`github.event.repository.default_branch` — is the second half of the same guarantee rather than the
whole of it: the run executes default-branch job logic, and that job logic checks out default-branch
harness files. `target_ref` remains completely free: any branch, any tag, any SHA.

**A feature branch needs no infrastructure of its own.** The branch under test supplies only its
migrations, its verifiers and its manifest, so a slice in flight is verifiable the day this gate
merges.

**The self-test deliberately inverts the first rule.** On `pull_request`, `FOCUSED_HARNESS_REF` is
`github.sha`, so the PR's own harness runs — proving a change to this gate is the only thing that
self-test exists for.

Every run prints the harness ref, the resolved harness commit and the target ref, so the artifact
says which harness produced the answer.

`target_ref` is validated before anything is fetched: it must read as a plain branch, tag or SHA, and
it is passed to `actions/checkout` through the environment rather than interpolated into any shell
command. A selector or a ref that does not resolve costs four seconds, not a checkout and an install.

### Allowed verifier selectors

A selector is a **name**, never a command.

| Selector | Runs |
| --- | --- |
| `i06a-0100` | `database/verify-migration-0100.mjs` |
| `i06a-0101` | `database/verify-migration-0101.mjs` |
| `i06a-all` | both, in migration order |
| `i05c-all` | `database/verify-migration-0098.mjs`, `database/verify-migration-0099.mjs` |
| `migration-NNNN` | the generic form: `database/verify-migration-NNNN.mjs` |

Named groups live in `database/focused-verifiers.json`. **A new migration needs no entry there** —
the generic `migration-NNNN` form already reaches it. Add a group only when a set of verifiers is
worth naming.

Validation happens in three independent places: the name must match a bounded pattern, it must
resolve against the mapping, and each resolved path must still look like `database/verify-*.mjs`. No
path through the runner reaches a shell — `spawnSync` with an argument vector is the only process
primitive it imports — so neither a workflow input nor a mapping file can introduce a command.

### The artifact

Uploaded under `focused-verification-<selector>-<run number>`, with `if: always()`, so it exists
precisely when it is needed:

```text
environment.txt   selector, group, verifiers, target ref, target head SHA, node, psql, server version
bootstrap.log     the Supabase-compatible bootstrap
migrations.log    every migration applied, in order
<verifier>.log    each selected verifier's full stdout and stderr
summary.md        the scenario/probe table
summary.json      the same, machine-readable
```

The summary is also written to the job summary, so the answer is visible without downloading
anything.

---

## 3. The aggregation rule

`database/verifier-scenarios.mjs` is the permanent result contract. Independent scenarios run in
isolation, each records its own outcome, and the run fails **once** at the end with all of them
named.

```text
0101 forward safety f1 pass
0101 forward safety f2 FAIL: the canonical check ACCEPTED the weakened state
0101 forward safety f3 pass
...
  8 scenario(s), 7 passed, 1 failed
```

Three properties make this a strengthening rather than a weakening:

1. the run still **fails**, and still exits non-zero;
2. every scenario is isolated by its own `SAVEPOINT`, rolled back and released on every path, and any
   session state it changed is restored — so one failure cannot contaminate the next;
3. a **mutation probe** must prove BOTH halves: that the weakening actually changed the text, and
   that the canonical check actually refused it. A weakening that matched nothing would otherwise
   report "the contract accepted a weakening" for a weakening that was never made.

**Only independent scenarios are aggregated.** Where a later section consumes state an earlier one
committed — a fixture built in stages, a lifecycle walked forwards — a failure genuinely invalidates
everything after it, and those sections keep failing fast.

---

## 4. The hazard contract

`database/verifier-hazards.mjs` implements seven detectors, and
`database/tests/verifier-hazard-contract-v1.test.mjs` runs them under `npm run test:database`.

| Class | What it refuses |
| --- | --- |
| `H1-transaction-timestamp` | `SET created_at = now()` — `now()` is the *transaction* timestamp, so this writes back the value already there |
| `H2-aborted-transaction` | a refusal swallowed with `.catch`, leaving the transaction aborted and every later statement failing `25P02` |
| `H3-timestamp-precision` | a `timestamptz` read into a JavaScript `Date` and sent back, silently truncating `clock_timestamp()` microseconds |
| `H4-magic-fixture-count` | a large literal asserted against a running fixture total the verifier itself maintains |
| `H5-functiondef-anchor` | a weakening anchored on the migration's text — `pg_get_functiondef` regenerates the signature in its own canonical form |
| `H6-unproven-mutation` | a weakening probe that never proves the mutation landed |
| `H7-transaction-context` | a shared helper that opens a `SAVEPOINT` without saying what a caller in autocommit should do |

Each rule was **calibrated against every verifier this repository already has** and is silent on all
of them. A gate that fires on healthy historical code is worse than no gate, because it teaches the
next author to ignore it. Each rule is also required to catch the exact line, from the exact commit,
that cost the CI round it was written for — and to accept the correction that replaced it.

Run them alone with `npm run verify:db:hazards`.

### A known-latent instance, deliberately not failed

`database/verify-migration-0097.mjs:179` asserts a literal count of `3` against posts it created
itself. It is correct today. The `H4` threshold is therefore `4` — the largest literal the existing
corpus uses, plus one. This is recorded rather than fixed because `QAN-INF-05` does not own I-05B's
verifier; the next task that touches it should snapshot the count and assert the delta.

---

## 5. The local disposable runner

```bash
npm run verify:db:focused -- i06a-all
```

The same runner the focused gate uses, against a `DATABASE_URL` of your own. It requires `psql` on
`PATH` and will say so plainly if it is missing. It never installs anything, never elevates and
never targets a live database.

**Status on this host: NOT AVAILABLE.** There is no PostgreSQL here yet — see §6.

### The fresh-database rule

Every focused run starts from an **empty** database and applies every migration from zero. A run
against a database that already carries the bootstrap roles fails deliberately, because a
half-migrated database proves nothing about a fresh one: ordering defects, forward-reference defects
and self-assertion defects in a migration are only visible from empty.

---

## 6. Portable PostgreSQL — second, not first

A user-space portable PostgreSQL distribution is the local half of this task, and it comes **after**
the focused gate, not before. Requirements: no installer, no administrator rights, no service
registration, confined to a QANDEEL tooling directory, removable by deleting that directory,
documented provenance.

### The Smart App Control stop condition

This host runs OS-wide Smart App Control, which has already refused unsigned binaries here (see
`ENV-01`). If it blocks a required PostgreSQL binary or DLL:

```text
STOP the portable-local attempt.
```

No exclusions. No weakening of Defender, Smart App Control or any other Windows security control. No
administrator elevation. No Docker, no WSL. The focused GitHub gate is the supported fallback and is
on its own sufficient to break the long CI loop — which is exactly why it is built first.

**Status: NOT ATTEMPTED YET.** The focused gate is the deliverable of this change.

---

## 7. The two-green-focused-runs rule, and the exact-head rule

For any database-heavy task, before the final full API CI candidate:

1. run the focused gate against the branch while hunting defects;
2. diagnose **every** reported failure from the artifact — not just the first;
3. fix, and rerun;
4. require **two consecutive fresh focused runs green**, because the gate creates a new database
   every time and a single green run cannot distinguish a real pass from a lucky ordering;
5. only then push the final candidate and run **one** exact-head full API CI;
6. run Mobile CI as the normal regression gate.

### Debugging may target a ref. Acceptance must target a SHA.

A branch name is a moving target: it resolves to whatever was pushed last. Two green runs against
`my-branch` can therefore be two runs of two **different trees**, and prove nothing jointly — the
second could be green because the first one's defect was pushed away, or red on a tree nobody meant
to test.

So:

| Purpose | `target_ref` | Why |
| --- | --- | --- |
| Hunting a defect | a branch name is fine | you want whatever is newest |
| The **two green acceptance runs** | the **exact 40-character commit SHA** | two runs must be two runs of the *same* tree |
| The final full API CI | the same exact SHA | the head that is being accepted |

The runner states which kind of run it just did, in the console, in the summary and in
`environment.txt`:

```text
ACCEPTANCE-ELIGIBLE: the target is an exact commit SHA
DEBUGGING RUN: the target "my-branch" is a moving ref, so this run cannot count toward the
two green acceptance runs - rerun against the exact commit SHA for those
```

It does not refuse a branch — that would make ordinary debugging awkward for no gain. It refuses to
let a moving-ref run be **mistaken** for acceptance evidence afterwards, which is the failure that
actually costs anything.

There is no step that reads "push another correction and see what CI says". The loop this task exists
to end is:

```text
fix -> full API CI -> first failure -> repeat
```

---

## 8. What this task deliberately does not do

It changes no migration, no runtime, no Product semantics and no Replay invariant. It does not
weaken any verifier to obtain a green build: the hazard contract makes verifiers *stricter*, and the
aggregation helper changes only *when* a run reports, never *whether* it fails.

It makes exactly one change to `api-ci.yml`: the bootstrap step now applies the canonical file
instead of an inline copy of the same statements. Nothing else in that workflow moves, and the SQL
executed is unchanged.

It adds no backlog item. No open item in `docs/qandeel-canonical-backlog-v1.md` names an
infrastructure task as owner, and every `OPEN — UNASSIGNED` item is left alone under BG-05 step 5.
