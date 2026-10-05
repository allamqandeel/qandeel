# QANDEEL — VAL-01 Change-Aware Validation + Cross-Run Native Artifact Reuse — Implementation Record v1

**Slice:** `VAL-01` — CI / validation infrastructure only. `IMPLEMENTED — READY FOR INDEPENDENT REVIEW — NOT MERGED`.
**Task Contract:** `QANDEEL_VAL_01_CHANGE_AWARE_VALIDATION_TASK_CONTRACT_v1.0.md`.
**Canonical baseline:** `06a960848faaccc6e294d38fbde2918b10ed1d74` (PR #308, A3-02, merged).
**Branch:** `infra/val-01-change-aware-validation-reuse`.

VAL-01 is not a Product task and is not a Connected Worlds phase. It changes no Product behavior, Product copy,
API route, database migration, Shared World behavior or mobile Product source.

---

## 1. Repo Truth Gate

| Check | Result |
|---|---|
| `git fetch origin`; `origin/main` | `06a960848faaccc6e294d38fbde2918b10ed1d74` — equals the baseline, no drift |
| PR #308 | `MERGED` 2026-10-05T04:29:36Z, merge commit `06a9608…` |
| Stage 3 | closes on A3-02's merge by the rule `QANDEEL_CURRENT_STATE.md` itself states ("Stage 3 stays ACTIVE until A3-02 merges"). Observation: the Current State and Project Map rows still describe A3-02 as a Draft PR; that post-merge locator reconciliation belongs to A3-02's merge, not to VAL-01 (§17) |
| Files read in full | the eleven files the Task Contract §1.4 names, plus `scripts/a3/run-proof-leg.sh`, `scripts/a3/run-ios-proof-leg.sh` and every workflow under `.github/workflows/` |

## 2. Workflow census (before VAL-01)

| Workflow | Trigger | Producer job(s) | Consumer job(s) | Binary keyed by build inputs? | Validation-only change rebuilds? | PR update validates |
|---|---|---|---|---|---|---|
| `api-ci.yml` | `pull_request` paths (`apps/api`, `database`, `tests`, root package files, itself); `push` main | — (one job `verify-api`, real PostgreSQL + Redis) | same job | n/a | n/a — any update re-runs the whole ~17-minute job | **cumulative PR diff** (GitHub `paths`), no delta awareness |
| `mobile-ci.yml` | `pull_request` paths (mobile tree, mobile contracts, provenance scripts, root package files); `push` main | `build-android`, `build-ios` | `verify-android`, `verify-ios` | **yes** — `actions/cache` keyed `…-PRODUCT-mobile-ci-boot-smoke-v1-<fingerprint>` | no rebuild on a fingerprint hit; **but** the consumers' boot smoke re-runs on every update | **cumulative** — `native_impact` is computed from `merge-base(base, head)..head`, and the contract gate always runs |
| `a3-proof.yml` | `push` to the (now merged) A3-02 branch; `workflow_dispatch` | `build-android`, `build-ios` | `android-leg` × 13, `ios-leg` × 1 | **no** — the producer builds on every run; only a same-run artifact | **yes** — a Maestro-only commit rebuilt both platforms | push delta decides *whether* it runs; every run executes **all 14 legs** |
| `qan-inf-04-artifact-reuse-demonstration.yml` | `workflow_dispatch` only | `*-demonstration-build` | `*-demonstration-validate` | by explicit operator input `reuse_artifacts_from_run_id` (prior-run) | no, when the operator names a prior run | n/a |
| `t12-phase-m-cloud-validation.yml` | `workflow_dispatch` only | `android-t13-build`, `ios-t13-build` (+ three build-and-validate jobs) | `android-t13-recovery-emulator`, `ios-t13-recovery-simulator` | by explicit operator input (prior-run) | no, when the operator names a prior run | n/a |
| `vport-01`, `vport-02`, `w1a-01`, `w1b-01`, `w2-01`, `w2-02` proof workflows | `push` to their own (merged) feature branches; some `workflow_dispatch` | none separate — one job builds **and** validates | same job | no | yes | push delta (branch-scoped, inert after merge) |
| `focused-database-verification.yml` | `workflow_dispatch`; `pull_request` on its own runner files | — | — | n/a | n/a | cumulative |
| `mobile-expo-dependency-drift-advisory.yml`, `supabase-keep-alive.yml` | schedule / dispatch | — | — | n/a | n/a | n/a |

Required status checks: **none**. The `main` ruleset (`QANDEEL Main Protection`) enforces deletion / non-fast-forward
protection and the pull-request rule only, so a skipped job is never a merge-blocking "pending" check.

## 3. Root cause of the A3-02 validation churn (measured)

The fourteen A3-02 commits after `fc3e30f` produced the runs below. Every figure is read from the GitHub API.

| Head | What the head changed | What ran | Defect |
|---|---|---|---|
| `a7b0386` | two iOS Maestro flows + the record | A3 proof **rebuilt Android (13 min) and iOS (19 min)** and ran **all 13 Android legs**, which no file in the delta could affect | **V1** cross-run rebuild; **V3** leg blast radius |
| `61f4515` | one Maestro flow (`a3-02-open-notifications.yaml`) + the record | A3 proof rebuilt both platforms and ran all 14 legs; its iOS leg **hung 60 minutes** in attempt 1 (`cancelled` at the job timeout, run `37232517476`) before a manual attempt 2 | **V1**, **V3**, **V4** |
| `682cead` | the implementation record only | API CI **re-ran its 17-minute suite** (run `37263735360`); Mobile CI re-ran the contract gate and **both device boot smokes** (run `37263735217`) | **V2** cumulative-diff churn; the post-green documentation loop (§14) |
| `63399f1`, `4f45182` | one database verifier file each | Mobile CI re-ran its contract gate and native smoke | **V2** |
| attempts | — | nothing bounded the number of manual re-runs | **V5** |

## 4. Reused foundations vs new work

The census above was recorded before any infrastructure change.

| Concern | Reused, unchanged in meaning | New in VAL-01 |
|---|---|---|
| Binary identity | `native-build-fingerprint.mjs` (committed-tree blob ids, default-include, `__validation__` always included); `native-artifact-manifest.mjs` (role / recipe / platform / target / configuration / SHA-256); `verify-native-artifact-manifest.mjs` (`same-run` / `prior-run`) | one exclusion (`scripts/a3/`, the runner-only leg runners) with the required schema bump `1 → 2`. **No second hash, no second identity store** |
| Producer / consumer split | Mobile CI's producer → consumer chains; A3's producer → isolated leg matrix | A3 producers restore by fingerprint and verify `prior-run` before publishing; consumers take the producer's declared mode |
| Native relevance | `classify-mobile-native-impact.mjs` over the cumulative diff, fail-safe on an unestablished base | flows no native consumer runs, and prose, are no longer native impact |
| Change planning | — | `scripts/validation/change-planner.mjs` (domains, reference analysis, evidence law); `plan-validation.mjs` (I/O) |
| Leg selection | the A3 runners' own `case "$LEG"` lists | `scripts/validation/proof-legs.mjs` + `proof-suites.mjs` (data) |
| Bounded infrastructure | step `timeout-minutes` | `scripts/validation/bounded-run.mjs`; `scripts/validation/retry-budget.mjs` |

No new third-party dependency. Every file under `scripts/validation/` imports Node built-ins and repository
modules only (pinned by the VAL-01 contract). The contract itself uses `yaml`, already a root devDependency.

## 5. Change-domain classifier

`classifyPath` (one ordered rule list, `scripts/validation/change-planner.mjs`):

| Kind | Paths | Domains it can reach |
|---|---|---|
| `INFRA` | `.github/**`, `scripts/validation/**`, the classifier, the fingerprint, the manifest writer and the verifier | **every** domain — `CI_PROVENANCE_INFRA`: fail safe to broad validation and every leg |
| `DOC` | `docs/**`, any `*.md` | `DOCS_ONLY` — light, by reference analysis (below) |
| `FLOW` | `apps/mobile/.maestro/**` | `DEVICE_PROOF_FLOW` — the legs that run it; native only if Mobile CI's own consumers run it |
| `PROOF_RUNNER` | `scripts/a3/**`, `scripts/phase-m/**` (other than the four authority files) | `DEVICE_PROOF_FLOW` |
| `API` | `apps/api/**`, `database/**` | `API_HEAVY` |
| `CONTRACT` | `tests/**` | `API_HEAVY`, `MOBILE_CONTRACT` |
| `SHARED_ROOT` | `package.json`, `package-lock.json`, `tsconfig.base.json`, `packages/**` | `API_HEAVY`, `MOBILE_CONTRACT`, `MOBILE_NATIVE_BINARY` |
| `MOBILE` | the rest of `apps/mobile/**` | `MOBILE_CONTRACT`, `MOBILE_NATIVE_BINARY` |
| `UNKNOWN` | anything else (`infra/**`, `eslint.config.js`, `scripts/*.mjs`, …) | **every** domain — never skip |

**Reference analysis (measured, not assumed).** A "docs-only" path is not automatically irrelevant: 49 of the 77 root
contracts (VAL-01's included) name a `docs/` or `.md` path, the mobile generators read `docs/design/canonical-artifacts/**`, and four database static
tests read named canonical records. So for each light path (`DOC`, `FLOW`, `PROOF_RUNNER`) the planner finds every tracked
file that can reach it — by full path, basename, an ancestor named as a whole directory, or the extension used as a filter
(`'.md'`, `\.ya?ml`):

- a **root contract** that reaches it re-runs at the current head (and, by closure, any contract that executes or enumerates
  it — the forward-safety sweep);
- for a flow or runner, a **workflow, leg runner or other flow** is a consumer, handled by leg selection;
- the **validation tooling** classifies such paths and never reads their content;
- **any other file** (a generator, a database test, a helper, source) makes the path relevant to the heavy gates: RUN.

Workspace roots (`apps`, `apps/mobile`, `scripts`, …) are never ancestor tokens — they appear as JSON keys far more often
than as reads. A non-contract file naming the whole `docs` tree is pinned to a reviewed list of four (each builds a mirror
and reads named docs only, which the basename token already binds); a fifth fails the contract until it is classified.

Replayed against the real A3-02 heads: the record-only head `682cead` carries both heavy gates forward and re-runs 20 API
and 29 Mobile root contracts that can read a record; editing the canonical backlog or `docs/replay-runtime-v1.md` RUNS the
API gate (database tests read them); editing a canonical design artifact RUNS the Mobile contract gate (the generators).

## 6. Predecessor-success carry-forward law

`planGate` answers `CARRY_FORWARD` only when **every** one of these holds; anything else is `RUN`:

1. the event is `pull_request` with action `synchronize` (never `push`, `main`, dispatch, `opened`, `reopened`, …);
2. the predecessor head (`github.event.before`) is a full SHA and the delta `git diff --name-only --no-renames before head`
   is established and non-empty (a rename is both of its paths);
3. no path in the delta can reach the gate (by kind, by a non-contract reader, or — for native smoke — by being a flow the
   native consumers run);
4. the predecessor's evidence passes `validateEvidence`, read from GitHub and checked against facts this run knows
   independently: schema; workflow; gate; outcome `SUCCESS`; **exact** predecessor head; **same base SHA** (a moved base
   means a different merged tree); **same validation-authority digest** (the workflow file + the validation tooling, over
   committed blob ids); the record's run id is the predecessor's **latest** run of this workflow for that head; the record
   was written in that run's **latest attempt**; and that attempt's `Validation evidence (VAL-01)` job concluded `success`.

Evidence is written by the `evidence` job, **only** when the gate is green in this run: executed and successful, or carried
forward with every bound contract green. A failed gate writes nothing and turns the evidence job red, so it can never be
inherited. Chains are sound by induction: a carried record names the run that last **executed** the gate
(`sourceRunId` / `sourceHeadSha`), and each link verified its own delta. An older green run never outvotes a newer red one
(`selectPredecessorRun`); an attempt-1 green record is refused once attempt 2 went red.

The planner fails safe against itself: an exception answers RUN for every gate, and the workflows skip a heavy job only on the
literal output `CARRY_FORWARD` (or `NOT_RELEVANT` for native smoke), so an empty, failed or garbled plan runs it.

Each carry-forward writes a step summary naming the predecessor SHA, the current SHA, the latest delta, the prior successful
run used and why the heavy gate was skipped, plus the contracts re-run at this head.

## 7. Native cross-run reuse

`a3-proof.yml` producers, now the reference implementation:

1. compute the canonical fingerprint;
2. `actions/cache` keyed `qandeel-native-<platform>-<target>-PROOF_VALIDATION-a3-activity-push-proof-v1-<fingerprint>`
   (`android-x86_64`; `ios-simulator-iPhone-17-iOS-26-5`);
3. on a **hit**: no JDK, no `npm ci`, no generator check, no proof-entry selection, no prebuild, no Gradle, no CocoaPods, no
   `xcodebuild` build — every such step carries `if: steps.native-build-cache.outputs.cache-hit != 'true'`; the restored
   manifest is verified `prior-run` **before** publish; the producer declares `provenance_mode`;
4. on a **miss**: build once, write the manifest, verify `same-run`, publish; the cache keeps it for the next equivalent head;
5. consumers download the producer artifact through the run (attempt-independent) and re-verify it in the producer's
   declared mode before install.

Mobile CI's producers already followed this shape; VAL-01 additionally moved their build JDK behind the cache miss.

The fingerprint law is unchanged except for `scripts/a3/`: a Maestro flow, a leg runner or a record never moves it; Product
source, the bundled `__validation__` harness, the lockfile, native configuration and any workflow always do. The schema
bump makes every pre-VAL-01 cache entry fail closed (`FINGERPRINT_SCHEMA_MISMATCH`) rather than compare unlike digests.

## 8. Leg-selection law

`proof-legs.mjs` derives each platform's legs and their flows from the runner's own `case "$LEG"` dispatch, follows
`runFlow` / `runScript` references, and treats flows run outside the dispatch (the readiness walk) as shared:

| Change | Legs |
|---|---|
| a flow reached by one leg's dispatch | that leg (e.g. `a3-01-light.yaml` → `en-light`) |
| a sub-flow reached by several legs | exactly those (`a3-02-open-notifications.yaml` → `android-permission-allow`, `android-permission-deny`, and the iOS leg) |
| a shared readiness flow / that platform's runner | every leg of **that** platform only |
| a native build input, validation authority, unknown path, unestablished delta, manual dispatch with no `since_sha` | every leg |
| prose, API, database, root contracts | none — and a platform with no leg builds nothing |

Each selected leg keeps its own job, result and evidence artifact; `fail-fast: false`; no shared results file; no sequential
fallback. A Stage-4 proof adds a suite entry in `proof-suites.mjs` and a runner of the same shape.

Replayed: `61f4515` → 3 legs instead of 14; `a7b0386` → the one iOS leg instead of 14 plus two rebuilds.

## 9. Watchdog

`bounded-run.mjs` wraps one command in Node alone (`timeout(1)` is absent on macOS), kills the command's whole process group
on expiry (SIGTERM, then SIGKILL), prints `::error title=INFRASTRUCTURE — <label>::…`, writes `watchdog-<label>.txt` into the
evidence directory and exits 124. Applied to:

- **A3 leg runners:** a `maestro hierarchy` driver-readiness probe bounded at 300 s before any flow; every Maestro flow
  (`MAESTRO_FLOW_SECONDS`, default 600 s) and every readiness walk (300 s); the iOS `simctl bootstatus` (300 s);
- **Mobile CI consumers:** the driver probe (Android 240 s, iOS 300 s), the boot smoke, and the iOS simulator boot wait,
  each inside the existing step bound;
- **A3 leg steps:** a 45-minute step bound under the 60-minute job.

A dead driver is classified INFRASTRUCTURE within five minutes with no Product step run. A timeout is evidence, never a
reason to edit Product code.

## 10. Retry budget

`retry-budget.mjs --attempt "${{ github.run_attempt }}"` is an early step of every device consumer (`verify-android`,
`verify-ios`, `android-leg`, `ios-leg`), before any download, emulator, simulator or Maestro call. Attempt 1 and one
classified rerun pass; attempt 3+ prints `VALIDATION RETRY BUDGET EXHAUSTED` and fails in seconds. A new commit is a new run.
No automatic retry exists anywhere; deterministic unit / database gates carry no budget — they fail.

## 11. Physical-device boundary

`proof-suites.mjs` declares the dispositions: every runner leg is `SIMULATOR_PROVABLE` by construction; PD-01 … PD-09
(A3-02 record §20) are `PHYSICAL_DEVICE_REQUIRED`, owned by `QAN-BL-NOTIF-05`, can never be a runner leg, and
`assertSimulatorMatrix` refuses to schedule one. No Product Exit Gate changed.

## 12. API CI change

`plan` → `verify-api` (unchanged steps, skipped only on `CARRY_FORWARD`) → `api-bound-contracts` (on a carry-forward, the root
contracts of API CI that read a changed path, by `node --test`; no PostgreSQL) → `evidence`. Nothing was removed from the heavy
gate. The trigger also gains `packages/**` (a shared runtime the API depends on, previously absent) and `scripts/validation/**`.
`main` keeps its unconditional push trigger and always RUNS.

## 13. Mobile CI change

`plan` (now owns the native classification, same classifier, same fail-safe) → `verify-mobile-contracts` (MOBILE_CONTRACT;
skipped only on `CARRY_FORWARD`) / `mobile-bound-contracts` → producers (MOBILE_NATIVE_BINARY; skipped only on `NOT_RELEVANT`
or `CARRY_FORWARD`, and only behind a green or carried contract gate) → consumers (exactly when their producer published;
retry budget; bounded driver probe and smoke) → `evidence`. A flow-only update no longer redoes the contract gate's
typecheck / lint / Jest / Expo / prebuild work, while the flow-reading contracts (QAN-INF-04's flow parser, the leg-isolation
contract) still run.

## 14. Proof workflow (reference) change and the permanent documentation rule

`a3-proof.yml` (§7, §8, §9, §10) is updated only as infrastructure reference. A3 is not reopened and **no A3 Product proof was
run** for VAL-01.

**Permanent workflow rule — no post-green documentation loop.** A task does not add a final docs-only commit merely to paste run
IDs into its implementation record after the Product / infrastructure head is already validated. Final run IDs live in the PR
conversation, the GitHub step summary, or a post-merge documentation reconciliation that does not reopen the implementation
validation cycle. Implementation records are structurally complete **before** final validation; a run ID that is external
evidence is a placeholder, not an incompleteness. VAL-01 also makes such a commit cheap where one happens anyway: a record-only
update carries the heavy gates forward.

## 15. Planted-defect contracts

`tests/val-01-change-aware-validation-contract.test.mjs` (21 tests; Node built-ins + `yaml`; no device, no network), in Task
Contract §15 order: (1) docs-only + green → carry, with the record's readers re-run; (1b) a doc a non-contract file reads →
RUN, plus the reviewed whole-`docs` list; (2) red / missing / unknown predecessor → RUN; (3) flows / runners / records leave the
fingerprint unchanged, and the planner and fingerprint agree over the whole tree; (4) flow → only its legs, replaying `61f4515`
and `a7b0386`; (5) Product source; (6) every `__validation__` file; (7) lockfile / native config / API / database; (8) every
authority file → every gate and leg; (9) unknown / unestablished; (10) prior-run refusals on role, recipe, recipe version,
platform, ABI, simulator, fingerprint, bytes and the old fingerprint schema; (11) producer law with five planted defects;
(12) retry budget, CLI and placement; (13) a real hung child killed in < 10 s and classified, plus every Maestro call bounded;
(14) main / push / dispatch / first head never carry, and the literal-token skip conditions; (15) laundering refusals; plus
wiring, leg-matrix / physical-boundary and no-dependency tests.

Controlled re-anchors of existing contracts, each marked `VAL-01 RE-ANCHOR`:

- `qan-inf-04-native-ci-artifact-reuse-contract` — the exclusion-set digest (`scripts/a3/`), the runner-only list, and 14d's
  gating invariant (producers behind the planner's native decision, consumers behind their producer);
- `mobile-native-impact-classifier` — runner-only flows and prose are not native impact; `boot-smoke.yaml` still is;
- `a3-proof-leg-isolation-contract` — the `plan` job, the selected-leg matrix (full set pinned at the runner), the producer's
  declared mode;
- `mobile-foundation-toolchain-contract` — the fast gate is skipped only on a proven carry-forward; classification moved to `plan`;
- the same duplicated ratio in 13 contracts (`canonical-home-placement-engine`, `durable-thread-home-same-sp-substrate` ×2,
  `effective-live-focus-final-semantic-chain-cutover`, `historical-projection`, `inspection-orientation-return-chrome`,
  `living-analysis-map-runtime`, `mobile-canonical-state`, `reference-attention-focus-evaluator`, `return-navigation-layer`,
  `session-semantic-clock-sp-lh-delivery`, `t10-motion`, `temporal-navigation-layer`, `thread-establishment-evaluator`),
  replaced by one identical ratio: every native build job stays behind the native decision;
- `forward-safety-contract` — its hypothetical future native producer uses the VAL-01 gating form.

## 16. Validation performed

All local, on Windows, Node 24.19, in a clean worktree of the baseline with this change applied (so the repository's own
generated `apps/mobile/android/` folder could not mask anything):

| Check | Result |
|---|---|
| every root contract except forward-safety (`node --test`, 75 files) | **1,106 / 1,106 pass** |
| `tests/forward-safety-contract.test.mjs` (every contract re-run in mutated mirrors, including VAL-01's) | **35 / 35 pass** |
| `npm run test:task-closure-governance-contract` | pass (inside the suite above) |
| baseline control: the 17 contracts later re-anchored, run unmodified on the baseline | all pass — so every failure seen before the re-anchors was caused by VAL-01's intended shape change, and fixed by a re-anchor |
| workflow structure (all 14 workflows): strict YAML parse with duplicate-key detection; every `needs`, `needs.X.outputs.Y`, `needs.X.result` and `steps.X.outputs` reference resolves | valid |
| planner CLI against the real GitHub API, simulating A3-02's record-only `synchronize` (`a7b0386 → 682cead`) | delta = the record only; predecessor run found; no evidence artifact (it predates VAL-01) → **RUN**, as the law requires |
| `legs` CLI replaying the real `61f4515` push | 2 Android + 1 iOS legs (was 14) |
| `record` CLI: green RUN / red RUN / carry with red bound contracts / not relevant | writes evidence / exit 1, nothing written / exit 1, nothing written / nothing due |

Not run, deliberately (Task Contract §16): no A3 Product proof, no Android visual legs, no iOS Product proof, no physical
device. **The first GitHub execution of the new workflows is this PR's own CI**; final run IDs belong in the PR conversation (§14).

## 17. Limitations and owned residuals

| Item | Disposition / owner |
|---|---|
| The positive carry-forward path (an evidence artifact uploaded, then read by the next head) has not yet executed on GitHub; the pure law and the read path are proven, the upload path is structural | proven on the first natural update of this PR or of the next PR touching these workflows — **no commit will be made to trigger it** (Task Contract §19). If its first run misbehaves the failure direction is RUN, never a false skip |
| A `cancel-in-progress` Mobile CI run (rapid successive pushes) leaves no evidence, so the next head runs the gate | accepted conservative cost; no owner needed |
| A carry-forward needs an unmoved base; any `main` merge between two PR heads re-runs the heavy gates | accepted conservative cost |
| `t12-phase-m-cloud-validation.yml` and the QAN-INF-04 demonstration keep their manual `reuse_artifacts_from_run_id` prior-run reuse and get no watchdog / budget | deliberately not migrated: dispatch-only, and T-13 is `CLOSED / FROZEN` (QAN-INF-04's contract pins it). A future reopening of Phase M owns it |
| `vport-01/02`, `w1a-01`, `w1b-01`, `w2-01`, `w2-02` proof workflows still build and validate in one job | inert (their branches are merged). Any Stage-4 proof must follow the `a3-proof.yml` reference and add a `proof-suites.mjs` entry — owned by that Stage-4 task's own contract |
| Physical-device facts PD-01 … PD-09 | unchanged ownership: `QAN-BL-NOTIF-05` (Release Hardening & Launch) |
| `QANDEEL_CURRENT_STATE.md` / `QANDEEL_PROJECT_MAP.md` still describe A3-02 as a Draft PR after PR #308 merged | A3-02's post-merge locator reconciliation (a governance task, AGENTS.md §10.6) — reported, not edited here: outside VAL-01's permitted paths |

## 18. No Product behavior changed

No file under `apps/mobile/src`, `apps/api`, `database/` or `packages/` changed; no migration, route, copy, Shared World
behavior or Product Exit Gate changed. The only files touched outside CI / validation tooling / tests / this record are the two
A3 leg runners (`scripts/a3/`, validation-only: bounded invocations and a readiness probe) and one `package.json` script entry.

**Orphan gaps = 0.**
