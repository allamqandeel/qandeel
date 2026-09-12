# Native CI Build / Validation Decoupling v1 (QAN-INF-04)

Status: DELIVERED
Baseline: `5d9ba46efc6cf2d391096fcb3784bf2a5588ae15`
Scope: infrastructure only. No QANDEEL Product semantics change.

## 1. Why

T-13's cloud validation failed repeatedly in the emulator, the simulator, the ADB transport and the
Maestro driver. Every one of those retries rebuilt an Android Release APK and an iOS Release simulator
app that were never in question, because the build and the validation lived in one job and GitHub can
only re-run a job whole. Roughly half an hour of Gradle and seventeen minutes of Xcode were spent, more
than once, to retry a flow file.

The fix is to separate **producing a binary** from **validating it**, and then to make reuse of a
binary safe enough to be worth having.

## 2. The job graph

```
Phase M (t12-phase-m-cloud-validation.yml)

  android-t13-build  ──uploads──▶ t13-recovery-android-build ──▶ android-t13-recovery-emulator
    prebuild + Gradle             app-release.apk                 download → VERIFY → install
                                  native-artifact-manifest.json   emulator + Maestro + phase gate
                                  android-…-identity.txt

  ios-t13-build      ──uploads──▶ t13-recovery-ios-build     ──▶ ios-t13-recovery-simulator
    prebuild + pods + xcodebuild  qandeel-ios-simulator.app.zip   download → VERIFY → install
                                  native-artifact-manifest.json   simulator + Maestro + phase gate
                                  ios-…-identity.txt
```

The two chains share no `needs`. A failed Android consumer re-runs alone; iOS is not scheduled, not
rebuilt and not re-validated, and the converse holds.

The consumers contain **no** `gradlew`, `assembleRelease`, `xcodebuild`, `pod install` or `expo
prebuild`, and they do not run `npm ci` — every script they execute uses Node builtins, Maestro and the
platform tools alone, so a job with no `node_modules` cannot acquire a build step by accident. The
static contract asserts each of those absences and plants a defect against the predicate that asserts
them.

`android-t13-recovery-emulator` and `ios-t13-recovery-simulator` keep the job keys T-13 froze: the
consumer is the job that runs the recovery sequence, so the name belongs to it. **No T-13 contract,
flow, sequencer or phase gate was modified by this task.**

## 3. Rerunning

| situation | what runs | what does not |
| --- | --- | --- |
| fresh dispatch | both producers, both consumers | — |
| Android validation failed | re-run that one job: download + verify + emulator | Gradle, and all of iOS |
| iOS validation failed | re-run that one job: download + verify + simulator | `xcodebuild`, and all of Android |
| producer failed | nothing downstream: the consumer's `if` reaches neither branch | — |

GitHub's single-job re-run keeps the successful producer's result and its uploaded artifact, so the
consumer's same-run `download-artifact` finds the binary from the first attempt.

**There is no automatic retry loop, and there must never be one.** A flaky native failure is a human
decision to re-run; an automatic retry turns an intermittent Product defect into a green run nobody
looked at. The contract forbids the known retry actions and a hand-rolled shell loop around a Maestro
invocation.

## 4. Prior-run reuse

`reuse_artifacts_from_run_id` (workflow_dispatch, default empty) skips the producers and takes the
binaries from an earlier run of this workflow. The consumers then hold `actions: read` — granted per
job, never at workflow level, never write — so `actions/download-artifact@v4` can read that run.

This is the only mode in which the artifact's commit may legitimately differ from the checkout's.
Nothing else may differ, and nothing is trusted: verification happens before installation, always.

## 5. The identity manifest

`scripts/phase-m/native-artifact-manifest.mjs` writes `native-artifact-manifest.json` beside every
binary. Schema `qandeel.native-artifact-identity/1`:

| field | what it settles |
| --- | --- |
| `schema` | this document is the shape the verifier knows |
| `buildRecipe` `{id, version}` | which recipe produced it (`t13-recovery-validation`, `mobile-ci-boot-smoke`) |
| `commit` | the source it was built from |
| `platform`, `role`, `entry` | android/ios, PRODUCT/AUTH_VALIDATION, and the root component actually registered |
| `artifact` `{name, bytes, sha256}` | the exact bytes |
| `buildInputFingerprint` | §6 |
| `target` | Android ABIs, or the iOS SDK / configuration / simulator name and runtime |
| `toolchain` | node, expo, react-native, plus java + Gradle wrapper or Xcode |
| `configuration` | SHA-256 of each of the three build-time values, plus an explicit `present` flag |
| `provenance` | producing run id, attempt, workflow, job, timestamp |

**No credential appears.** The three configuration values are digested, never written. The API
**hostname** is recorded in clear — it is a public dispatch input, and `assert-validation-preconditions.mjs`
has already refused any URL carrying userinfo, a query or a fragment — because a refusal that can only
say "two digests differ" is a refusal nobody can act on.

`present: false` is a recorded state, not a gap. Mobile CI builds with no configuration on purpose;
that makes its artifact provably non-interchangeable with a Phase-M one, in both directions.

## 6. The build-input fingerprint

`scripts/phase-m/native-build-fingerprint.mjs` digests the **committed** content — `git ls-tree -r`
blob object ids, not bytes off the runner's disk — of every tracked path that can reach the binary.

Committed content, for three measured reasons: a validation job rewrites `apps/mobile/package.json`'s
`main` before it builds (already carried, exactly, by `role`/`entry`); a blob id is identical on a CRLF
checkout and an LF one, and this repository is developed on Windows and built on Linux and macOS; and
the ids already exist.

Classification is **default-include**. Only these are excluded, each with a proof obligation the
contract discharges:

| excluded | proof |
| --- | --- |
| `docs/`, `infra/`, any `*.md` | prose; nothing in the mobile import closure reads Markdown |
| `apps/api/`, `database/` | the server; the bundle reaches it over HTTPS and imports no file from it |
| `tests/` | root `node:test` contracts, executed by Node, absent from the mobile workspace |
| `apps/mobile/.maestro/` | **flow files** — interpreted on the runner, driving the app from outside it |
| `scripts/phase-m/` | **runner-only orchestration** — sequencer, phase gate, evidence collector, seeder |
| `.env.example`, `.gitignore`, `AGENTS.md` | environment samples and prose |

The last two rows are what make a fixed flow or a fixed sequencer reusable. The contract proves them
rather than asserting them: it walks every `import`/`require` specifier in `apps/mobile/src` and
`app.config.js` and requires that none resolves into an excluded tree.

`.github/workflows/` is **included on purpose**: a workflow file *is* the build recipe — it carries the
ABI flag, the Xcode selection, the Gradle invocation — and no static rule can prove a given workflow
edit did not change how the binary is produced. Editing a workflow therefore invalidates prior-run
reuse. That is a false negative, and false negatives are the acceptable direction.

`apps/mobile/src/integration/__validation__/` is in `ALWAYS_INCLUDED_PREFIXES`, which wins over every
exclusion. It sits beside `__tests__` and `__fixtures__` and reads exactly like test scaffolding, but it
is the registered root component of every validation build. The contract plants an exclusion that would
otherwise swallow it and requires it to survive.

**The digest is self-protecting against its own drift**: any rule change that alters the included set
alters the digest, because the set is what is digested; a rule change that does not alter the set cannot
change the answer. `FINGERPRINT_SCHEMA_VERSION` is mixed in as well, so a change to *how* the digest is
computed cannot compare equal to one computed the old way.

At the baseline: **322 files included, 982 excluded.**

## 7. The gate

`scripts/phase-m/verify-native-artifact-manifest.mjs` runs in every consumer, after download and before
any install. It has no accept-on-doubt path: an artifact whose validity cannot be *proven* is refused,
with a named reason.

1. **Structure** — parses, is this schema, carries every required field, digests are well-formed.
2. **Identity** — platform, role, entry↔role agreement, recipe id and version, device target (ABI set,
   or SDK + simulator name and runtime).
3. **Bytes** — the downloaded file re-digests to the recorded SHA-256, at the recorded size.
4. **Inputs** — the fingerprint domain and schema version match, and the value equals this checkout's.
5. **Configuration** — each of the three values matches on both presence and digest.

Refusal codes: `MANIFEST_NOT_AN_OBJECT`, `SCHEMA_MISMATCH`, `MANIFEST_FIELD_MISSING`,
`COMMIT_MALFORMED`, `ARTIFACT_DIGEST_MALFORMED`, `PLATFORM_MISMATCH`, `ROLE_MISMATCH`,
`ENTRY_ROLE_DISAGREEMENT`, `RECIPE_MISMATCH`, `RECIPE_VERSION_MISMATCH`, `TARGET_ABI_MISMATCH`,
`TARGET_KIND_MISMATCH`, `TARGET_SIMULATOR_MISMATCH`, `ARTIFACT_HASH_MISMATCH`, `ARTIFACT_SIZE_MISMATCH`,
`FINGERPRINT_SCHEMA_MISMATCH`, `BUILD_INPUT_FINGERPRINT_MISMATCH`, `COMMIT_MISMATCH`, `MODE_INVALID`,
`CONFIGURATION_MISSING`, `CONFIGURATION_FIELD_MALFORMED`, `CONFIGURATION_PRESENCE_MISMATCH`,
`CONFIGURATION_VALUE_MISMATCH`.

Modes: `same-run` additionally requires the commit to equal the checkout's; `prior-run` relaxes **that
one field and nothing else**.

`QANDEEL_API_BASE_URL` is a build-time value — `app.config.js` embeds it in `extra` — so an artifact
built for a Cloudflare Quick Tunnel that has since died is refused against a new tunnel, by name.

## 8. Mobile CI

Mobile CI keeps its three jobs and its full contract: the fast mobile contract gate, then Android and
iOS native smoke gated by the unchanged native-impact classifier. The Release build, the install and
the boot smoke are exactly what they were.

What is new is that each native job keys its binary by the build-input fingerprint (`actions/cache`),
and skips `npm ci`, the CNG prebuild and the compile on a hit. The restore is a hint, never a licence:
the same provenance gate runs on both paths, declaring a restored artifact honestly as `prior-run`
because its commit is expected to differ. A miss simply builds.

This is what gives Mobile CI the property §Mobile CI of the task asks for: a head that changed only
documentation, a Maestro flow or runner-only Phase-M orchestration restores the binary an equivalent
head already produced, because those paths are excluded from the fingerprint and the key is therefore
unchanged. A head that touched `apps/mobile/src`, the bundled harness, the lockfile or the app config
gets a different key and a real build.

The native-impact classifier is untouched. Deciding *when* native smoke runs remains its job, and reuse
is never a reason to skip a gate the classifier said was needed.

## 8a. The demonstration workflow

`.github/workflows/qan-inf-04-artifact-reuse-demonstration.yml` demonstrates this architecture itself
on real GitHub native runners. It is **not a gate**, and it makes **no T-13 or Product claim**.

It is the same producer/consumer shape — `android-demonstration-build` →
`android-demonstration-validate`, `ios-demonstration-build` → `ios-demonstration-validate` — building
the **Product** root under recipe `qan-inf-04-demonstration` with **no configuration at all**. The
consumers download, provenance-verify, install and launch the binary through
`apps/mobile/.maestro/boot-smoke.yaml`, which asserts one integration identifier: the app launched and
the Product root mounted.

It therefore claims only CI architecture facts — build-once, download, provenance verification,
install, launch, reuse and platform isolation — and it cannot claim more: it sets no `QANDEEL_*`
value, reaches no secret, never selects the validation entry, and never runs the recovery sequencer.
The contract asserts every one of those absences.

`t12-phase-m-cloud-validation.yml` remains the only place a recovery or auth claim can be made, still
against the live API with a seeded Session, unchanged. A distinct build recipe keeps the two artifact
families non-interchangeable in both directions.

Triggers: `workflow_dispatch` (including `reuse_artifacts_from_run_id` for prior-run reuse), and
`pull_request` scoped tightly to this workflow and the three provenance scripts — which is exactly
when the architecture is worth re-demonstrating.

## 9. Residual limitations

1. **The build toolchain is recorded, not compared.** A consumer does not build, so it cannot re-derive
   the compiler that produced the binary; asserting equality against the consumer's own runner would
   compare two unrelated things and read like a guarantee. A prior-run artifact built on an older
   GitHub runner image is accepted on the strength of identical inputs, identical configuration and
   identical bytes. Bounded by GitHub's image versioning and by artifact retention (30 days).

2. **A workflow edit invalidates prior-run reuse**, including an edit that only touches an unrelated
   job. Deliberate: the workflow is the build recipe, and no static rule here can prove otherwise.

3. **No automatic cross-head reuse in Phase M.** Prior-run reuse is explicit and manual by design;
   deciding *for* an operator which earlier run is compatible would require assumptions this task
   cannot prove. Mobile CI gets the automatic form only because the cache key *is* the proof and the
   gate re-derives it.

4. **Mobile CI's build steps are conditional rather than absent.** The Phase-M consumers can be proven
   not to build by inspection; Mobile CI's native jobs still contain their build, guarded by the cache
   hit. Splitting them into producer/consumer jobs would be the stronger shape, and was not done here:
   T-13's frozen contract pins `mobile-ci.yml` to exactly three jobs, and reopening a closed task's
   self-limiting assertion was out of scope.

5. **Artifact size.** The iOS `.app` archive and the APK are uploaded on every Phase-M dispatch
   (30-day retention) and cached on every Mobile CI native run. Worth watching against the repository
   cache budget; nothing in this task evicts.

## 10. Gates

`npm run test:qan-inf-04-native-ci-artifact-reuse-contract`, registered in the Mobile CI fast gate and
in its trigger paths. Twenty-one tests covering: consumers do not build; producers upload binary and
manifest together; download precedes verification precedes install; reuse requires provenance; a
build-affecting mobile change invalidates; a bundled `__validation__` change invalidates; a runner-only
Phase-M or flow change does not; configuration, artifact-hash, missing/malformed identity, platform,
role, entry, recipe and device-target mismatches each refuse by name; platform isolation; no automatic
retry loop; Mobile CI reuse is gated; no credential in the manifest; no Product semantics moved.
