# T-12 Phase M — External Native / Physical Validation

**Status:** PREPARED — awaiting external device execution. **No result in this document is a PASS.**
**Baseline:** `fee91dc80d68ba23b0320ff4420bc5399ec32aaa`
**Branch:** `feat/t12-final-living-analysis-map-integration-v1` (uncommitted working tree)

Four T-12-owned items are mandatory closure gates and none may be closed from unit tests or a CI boot
smoke: `QAN-BL-MOT-03`, `QAN-BL-MOT-04`, `QAN-BL-RSP-01`, `QAN-BL-T12-04`.

This host cannot produce the evidence. It has no Android SDK, no emulator, no `adb`, no `java`, no
Xcode, and is Windows. What it can do is make the external validation exact, reproducible and safe,
and that is all this document is.

## Evidence states — never collapse these four

| State | Means |
| --- | --- |
| `PHYSICAL PASS` | observed on real hardware, with device model, OS version and build SHA recorded |
| `SIMULATOR PASS` | observed on an emulator or simulator. Never sufficient for a perceptual claim |
| `FAIL` | the stated failure condition was observed. Reopens the item |
| `NOT TESTED` | not attempted, or attempted and inconclusive |

A claim with no recorded device model, OS version and build identity is `NOT TESTED`, whatever it
looked like at the time.

---

## 0. TWO builds, and neither can do the other's job

This is the correction that matters most, and an earlier draft of this document got it wrong by
describing one alternate-root build as closing all four items. It cannot.

| | **Product-root build** | **Auth-validation build** |
| --- | --- | --- |
| `main` | `expo-router/entry` *(unmodified)* | `src/integration/__validation__/validation-entry.tsx` |
| Root on screen | the real `qandeel-product-root` | the isolated T12-04 harness |
| Validates | **`QAN-BL-MOT-03`, `QAN-BL-MOT-04`, `QAN-BL-RSP-01`** | **`QAN-BL-T12-04` only** |
| Cannot validate | T12-04 — it mounts no harness, so the storage procedure cannot be driven | **anything in §1–§3** — it mounts no Product root, so there is no Map, no Timeline, no chrome, no motion and no responsive composition to observe |

The auth-validation build **does not mount the Product root at all**. Any motion, drag, layout or
responsive observation made in it would be an observation of a text form, not of the Product, and
must never be recorded against MOT-03, MOT-04 or RSP-01.

**Both builds must be derived from the same exact T-12 working-tree identity.** Build both from one
checkout, record that identity once, and record the entry-point difference explicitly in the evidence
for the T12-04 rows. Two builds from two different trees prove nothing about one candidate.

Recommended order: build and run the **Product-root** build first (§1–§3), then apply the one-line
`main` change, rebuild, run §4, and restore `main`.

---

## 1. `QAN-BL-MOT-03` — Physical Motion Validation

**Requires physical hardware for every row.** An emulator cannot answer any of these: the Android CI
emulator runs with `disable-animations: true`, and a simulator's frame pacing is not a device's.

Common setup unless a row says otherwise: Release build, a Session with at least 20 committed
Moments, projection FETCHED, reduced motion OFF, English, LTR, default text size.

| # | Case | Action | Frozen truth | Expected perceptual result | FAIL / reopen | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| M03-1 | 260–540 ms travel band | Return to World from a deep inspection; then a Locate across ≥1 viewport | camera lands exactly where the act authorized | continuous travel through one world; short landings feel immediate, long ones deliberate; never a jump | any teleport, any visible discontinuity, a flight that reads as cinematic | 60 fps screen recording, both platforms |
| M03-2 | commit acknowledgement | commit a Moment from the Timeline | `TM := PINNED(m)` | the acknowledgement is perceptible without being a flourish; the 6 %→9 % `scaleY` tuning reads | imperceptible, or attention-grabbing | recording + subjective note |
| M03-3 | Android drag/release continuity | drag the Map, release mid-flick | drag commits ONE `PAN` on release | plane stays under the finger 1:1; release settles without a hitch or a second motion | any stutter at release, any velocity the finger did not give it | recording, mid-range Android |
| M03-4 | Arabic/RTL 1:1 scrub | Arabic + RTL, drag the Timeline | one physical mirror rule; `presentationX` from T-05's own viewport | the Track tracks the finger exactly, in the RTL direction, with no drift | any lag, drift or inverted direction | recording |
| M03-5 | depth-change release performance | semantic zoom between rungs | `MC.depth` changes; disclosure ≤260 ms, reinforcement ≤320 ms from the act | no stall; the T-10.0 ~190–220 ms dev-bundle stall must NOT reproduce in Release | a reproducible stall in a Release build | recording + note of build config |
| M03-6 | interruption / retarget | start a travel, immediately trigger a second act that retargets it | last act wins; springs retarget from current position | the world redirects from where it is; no restart from zero, no carried velocity | a restart, a jump, or momentum the reader did not create | slow-motion recording |
| M03-7a | **composite beat — short landing** | Pin to history, then Go Live + Locate where the referent is a few points away | ONE act: `FOLLOW_LIVE` + the landing; 110 ms beat then 260 ms travel | the held frame reads as *you are Live*, then *and it is here* | **it reads as a stall or a hesitation** | slow-motion recording |
| M03-7b | composite beat — ordinary landing | same, referent ~1 viewport away | 110 ms beat then ~380 ms travel | the beat explains the second truth rather than delaying it | the beat is imperceptible, or the pair reads as one jump | slow-motion recording |
| M03-7c | composite beat — reduced motion | same, reduced motion ON | beat kept; travel becomes a 140 ms opacity resolve | the dip explains the viewpoint change; no movement | a bare cut, a blink, or movement surviving | recording, both platforms |

M03-7 is the row that did not exist before this task: `cause` was hard-coded `null`, so no production
path could arm the beat. It has therefore **never been seen by anyone**.

---

## 2. `QAN-BL-MOT-04` — Direct-Drag Presentation Culling

The behaviour under test is deliberate: the surface does not re-render while a finger is down, which
is what makes a 60-frame drag cost zero React renders. The item asks only whether that is *visible*.

**Physical hardware required.** Setup: a Session whose world has objects beyond the visible viewport,
`CULL_MARGIN_POINTS` outside the resting cull.

| # | Case | Action | Expected | FAIL / reopen | Evidence |
| --- | --- | --- | --- | --- | --- |
| M04-1 | pop-in | drag slowly so an object outside the cull margin is carried in | it appears without announcing itself | **visible pop-in** as it crosses | slow-motion recording |
| M04-2 | blank entry | drag fast toward unpainted space | the incoming region is never empty | **blank entry** at the leading edge | recording |
| M04-3 | missing current-`V` object | drag so a currently-disclosed object should be on screen | every object in current `V` is drawn | a **disclosed object missing** during the drag | recording + note which locus |
| M04-4 | continuity at commit | release and let the `PAN` commit | nothing appears or moves at the commit that was not there during the drag | any **continuity break** at release | slow-motion recording |

**If none occurs: the item closes BY VALIDATION.** No architecture churn — the performance property
that produces this behaviour is intentional and predates T-10.

---

## 3. `QAN-BL-RSP-01` — Physical Responsive Recomposition

`jest-expo` performs no layout at all, so every local responsive assertion is made against a supplied
measurement. **Physical hardware required for the type-engine and inset rows**; a simulator can
partially serve the window-behaviour rows and that must be recorded as `SIMULATOR PASS`.

| # | Case | Setup | Expected | FAIL / reopen | Evidence |
| --- | --- | --- | --- | --- | --- |
| RSP-1 | real type engine, largest text | 320 pt wide, largest system text, Arabic then English, both directions | no clipped final line, no ellipsis on any identity, status or Return wording | any clipped or ellipsized essential wording | screenshots ×4 |
| RSP-2 | **large-text Outboard Live label** | 200 % text, then largest; Arabic and English | the full Live wording is visible; the slot grew; the edge is still OUTBOARD and beside the strip | "Go" instead of "Go live"; the slot inside the strip; a fake Moment | screenshots ×4 — **this is the `QAN-BL-RSP-02` correction's only real proof** |
| RSP-3 | 44 pt floor under stress | largest text, 320 pt, every act offered | every control still ≥44 pt and reachable | any control below 44 pt, or unreachable | screenshots + measurement note |
| RSP-4 | real safe-area insets | notched device; gesture-bar device; landscape (asymmetric) | chrome's bottom seam correct; Map's usable rect correct; nothing under the notch | content under system chrome, or a wrong seam | screenshots ×3 per device |
| RSP-5 | portrait / landscape | rotate with content on screen | recomposition without loss; no act hidden | an act disappears, or the world vanishes | recording |
| RSP-6 | rapid resize / split view | iPad split view, Stage-Manager drag, Android multi-window | no visible lag, no band flip-flop, no layout loop | oscillation, lag, or a loop | recording |
| RSP-7 | mid-motion recomposition | resize DURING a camera travel | no teleport; the travel continues | a teleport or a restart | slow-motion recording |
| RSP-8 | mid-scrub recomposition | resize with a finger down on the Timeline | no stale-mapped commit; the preview retires silently under the finger | a stale-mapped commit | recording — **also record whether the silent retirement READS as an interruption**; that perceptual question is the open one T-11 recorded |

---

## 4. `QAN-BL-T12-04` — Mobile Auth Session Storage

Release-equivalent or physical iOS **and** Android. Requires a live Supabase project and at least two
test identities. Uses the harness in §5.

Run in the **auth-validation build only** (§0). Rows marked **API** additionally require a reachable
QANDEEL API test environment verifying against the same Supabase project; without it they are
`NOT TESTED` and T12-04 does not close, while the storage-only rows can still be recorded.

| # | Claim | Procedure | Expected | FAIL / reopen | Evidence |
| --- | --- | --- | --- | --- | --- |
| T04-1 **API** | session persists through the authorized mechanism | harness → `BEFORE_RESTART` | `T12-04.1` PASS; a Session is acquired | sign-in fails, or nothing is stored | screenshot of the report |
| T04-2 | restart restores AUTH SESSION only | **force-kill** the app, relaunch, → `AFTER_RESTART` | `T12-04.2a` PASS and `T12-04.2b` PASS | auth lost, OR any Product truth restored | screenshots of both phases |
| T04-3 | token refresh works after restore | leave the app foregrounded past the access-token lifetime (default 3600 s), or force a refresh, then re-run `AFTER_RESTART` | still AUTHENTICATED; the reported token length is a fresh token | refresh fails, or material duplicates | screenshots + elapsed-time note |
| T04-4 | sign-out removes/invalidates the credential | → `SIGN_OUT_AND_REPLACEMENT` | `T12-04.4` PASS; then force-kill and relaunch: restore must yield SIGNED_OUT | credential survives a sign-out | screenshots either side of the kill |
| T04-5 **API** | identity replacement cannot adopt the prior runtime | supply a SECOND identity, → `SIGN_OUT_AND_REPLACEMENT` | `T12-04.5` PASS; the Session id length/report differs from identity one's | the previous Session is adopted | screenshots of both runs |
| T04-6 | no Product truth persisted | covered by `T12-04.2b` | `FOLLOW_LIVE`, empty RH, no inspection after restart | any restored viewpoint | screenshot |
| T04-7 **API** | conversation `sessionId` not persisted | compare the phase-1 and phase-2 Session evidence | a NEW Session per launch | the same Session returns after a kill | both screenshots |
| T04-8 | storage-at-rest disposition | Architecture + Security review the observed session size and the then-current official Expo/Supabase guidance | an explicit, written accept-or-change decision | — | the written disposition |

**T04-8 is a decision, not an observation**, and it is the only one of the four items whose closure is
partly a judgement. Official guidance is currently mixed — Supabase's RN quickstart uses AsyncStorage,
its Expo quickstart and Expo's own guide use `expo-sqlite`, Supabase's client reference documents a
SecureStore-backed `LargeSecureStore` wrapping **hand-rolled AES**, and Expo's auth guide recommends
`expo-secure-store` for tokens. T-12P took the unencrypted official Expo path because hand-rolled
cryptography is forbidden. No custom or hand-rolled cryptography is authorized by this gate either.

### T04-5 needs a BACKEND, not only a Supabase project

An earlier draft listed "a live Supabase project and two test identities" as the whole T12-04
prerequisite. That is insufficient for claim 5, and the gap is structural rather than a detail.

*Identity replacement cannot adopt the previous identity's QANDEEL runtime/session* is not a claim
about storage. A QANDEEL conversation Session is minted **only** by `POST /conversation/sessions`,
which sits behind the API's own `SupabaseAuthGuard` and derives Session ownership from the
authenticated identity it verifies. Sign-in and token storage are Supabase's; the Session, its
ownership and its isolation are the **QANDEEL API's**. Without that API the harness reaches
`SESSION_ACQUISITION` and stops, and the claim is untestable — not weakly tested, untestable.

So T04-1, T04-5 and T04-7 additionally require:

> a reachable **QANDEEL API test environment** whose `SUPABASE_URL` — and therefore whose
> `GET /auth/v1/user` verifier — is the **same Supabase project** the two test identities belong to.

If the API verifies against a different project, identity A's token is rejected and nothing is proven.
If it is unreachable, the runtime never reaches READY.

**Do not substitute a fake backend, a stub or a local mock for this claim.** A stub would be a client
proving a property of itself; the claim is about a real authorization boundary between two identities,
and only the real verifier can decide it. If no compatible QANDEEL test backend exists, record that
exact infrastructure dependency and leave T04-1, T04-5 and T04-7 as `NOT TESTED`. **T12-04 does not
close.** T04-2, T04-3, T04-4 and T04-6 are storage-only and *can* still be observed without it —
record them individually rather than letting the whole item pass or fail together.

The sequence claim 5 must actually demonstrate, end to end, on the real path:

1. identity A authenticates; 2. conversation Session A is acquired from the real API;
3. sign-out or replacement retires A's runtime; 4. identity B authenticates;
5. B cannot reuse or adopt Session A; 6. B receives and uses only its own authorized Session.

---

## 5. The validation-only auth harness

`apps/mobile/src/integration/__validation__/` — three files, none of them Product code:

| File | Role |
| --- | --- |
| `auth-storage-validation.ts` | the headless procedure: three phases, typed step reports |
| `AuthStorageValidationHarness.tsx` | the least surface that can take two credentials and show a report |
| `validation-entry.tsx` | `registerRootComponent(...)`, referenced by nothing in the repository |

**It is not a login gateway** and must never become one: no branding, no onboarding, no provider
buttons, no Product copy, no Product language, no visual language, and no route to a Product surface.

**It creates no second authority.** It drives `createIntegrationRuntime`, which owns the one Supabase
client and the one auth authority, through the T-12P public barrel and nothing deeper. It never uses
`existingSessionId`, so every run acquires a real Session exactly as the Product does.

**Isolation.** The T-12 static contract walks the **transitive import closure** from the router root
and asserts no module in it references `__validation__` — a substring check on the route file would
prove nothing, since the harness could be reached through any intermediate module. The barrel does not
export it, `main` still points at `expo-router/entry`, and `app.config.js` does not select it.

**Credentials.** Typed at validation time, held in component state for one run, `secureTextEntry` on
both password fields, cleared when the run ends. The contract asserts: no credential-shaped literal,
no default, no placeholder, no `console.*`, no alert, no analytics sink, no storage API. The report
carries SHAPES — a kind, a boolean, a character count — never a value, and a failure reports its KIND.
A screenshot of the report is therefore safe to attach as evidence.

**The restart boundary is real.** A process cannot restart itself, so the procedure is split into two
phases run either side of a genuine force-kill. Anything that simulated a restart in-process would be
testing nothing.

### Producing the AUTH-VALIDATION build — and only for `QAN-BL-T12-04`

Exactly one line differs from the Product-root build. Apply it locally, **never commit it**:

```jsonc
// apps/mobile/package.json
"main": "src/integration/__validation__/validation-entry.tsx"   // was: "expo-router/entry"
```

**IDENTICAL to the Product-root build:** every module under `runtime-entry/` — the Supabase client,
the auth authority, the `expo-sqlite` session storage, the config authority — and the whole
integration runtime. That is exactly the code path T12-04 is about, in the same Release configuration,
on the same generated native project, from the same checkout.

**DIFFERENT:** which root component mounts, and nothing else. Which is also why **this build proves
nothing about MOT-03, MOT-04 or RSP-01** — it renders no Map, no Timeline, no chrome and no responsive
composition, so there is no Product motion or layout in it to observe. Use the Product-root build for
those, and record which build produced each row.

### Configuration

Both builds need real public config, supplied as environment variables at build time and never
committed (`app.config.js` is the one boundary that reads them):

```
QANDEEL_API_BASE_URL          https origin of a reachable QANDEEL API test environment
QANDEEL_SUPABASE_URL          https Supabase project URL
QANDEEL_SUPABASE_PUBLIC_KEY   the PUBLISHABLE key — never the secret key
```

`QANDEEL_API_BASE_URL` is not optional decoration for §4: the API mints and owns the conversation
Session, so T04-1, T04-5 and T04-7 cannot be observed without it, and its `SUPABASE_URL` must name the
**same project** the test identities belong to or every request is rejected at the guard.

A `sb_secret_` key, a legacy `service_role` or `authenticated` JWT is refused at the boundary with a
typed `FORBIDDEN_SECRET` and no runtime is built. That refusal is itself worth capturing once.

---

## 6. External execution options

Inspected read-only. Nothing was installed, no account was created, no secret was altered, nothing
was pushed, and no Windows security control was touched.

### Android

| Option | Builds from uncommitted tree | Push needed | Signing | Credentials | Evidence class | Can close |
| --- | --- | --- | --- | --- | --- | --- |
| **A1 — existing CI Android job** | no | **yes** | debug keystore, automatic | none configured | emulator, and **not even that for motion**: the job sets `disable-animations: true` | **nothing** |
| **A2 — download the CI Release APK artifact** | no | yes | as A1 | none | **`x86_64` only** — will not install on any physical ARM device | **nothing** |
| **A3-P — local `assembleRelease`, PRODUCT-ROOT build** | **yes** | **no** | debug keystore (measured; sideload only) | public config at build time | `PHYSICAL PASS` on a connected device | **MOT-03, MOT-04, RSP-01** |
| **A3-V — the same build with the validation entry** | **yes** | **no** | as A3-P | public config **+ two identities + a reachable QANDEEL API** | `PHYSICAL PASS` for storage claims | **T12-04 only** — and only the backend-dependent claims if the API is reachable |
| **A4 — EAS Build** | no (uploads a snapshot) | not to GitHub | EAS-managed | build-time env | `PHYSICAL PASS` via internal distribution | same split as A3-P / A3-V, but **no `eas.json` exists and an Expo account would have to be created** — out of scope here |

**A3 is the recommended Android path**, and the only one that needs no account and no push.
Prerequisites: Android SDK + platform 36, JDK 17, `adb`, a physical device with USB debugging. The
repo's own scripts do the rest: `npm run prebuild:android --workspace @qandeel/mobile`, then
`./gradlew :app:assembleRelease` in `apps/mobile/android`, then `adb install -r`.

#### Android build truth — MEASURED, not assumed

An earlier draft asserted installability from template knowledge. The generated project was produced
on 2026-09-09 by `npm run prebuild:android --workspace @qandeel/mobile` and read directly; it was
deleted again afterwards, and nothing generated is tracked (`apps/mobile/android` is gitignored and
`git ls-files` over it is empty).

| Fact | Measured value | Source |
| --- | --- | --- |
| Artifact path | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` | the CI job's own install step |
| ABI coverage (default) | `armeabi-v7a, arm64-v8a, x86, x86_64` — a universal APK | `android/gradle.properties:31` `reactNativeArchitectures=` |
| ABI coverage (CI) | **`x86_64` only** — CI passes `-PreactNativeArchitectures=x86_64` | `.github/workflows/mobile-ci.yml` |
| Release signing config | `buildTypes.release { signingConfig signingConfigs.debug }` | `android/app/build.gradle:112–115` |
| Keystore | `app/debug.keystore`, alias `androiddebugkey`, password `android` — generated by prebuild, present | `android/app/build.gradle:100–105` |
| Minify / shrink in release | **off** by default (`android.enableMinifyInReleaseBuilds` unset) | `android/app/build.gradle:69` |
| New Architecture / Hermes | `newArchEnabled=true`, `hermesEnabled=true` | `android/gradle.properties:38,42` |
| `applicationId` | `com.qandeel.mobile` | `android/app/build.gradle:92` |

**What follows, and what does not.** A local `assembleRelease` *without* the CI's ABI override
produces a universal APK that includes `arm64-v8a`, so it is architecturally installable on a physical
ARM device, and it is signed — with the **debug** keystore, which `adb install` accepts. The template
carries the comment *"Caution! In production, you need to generate your own keystore file."*, so this
is a **sideloadable Release-type build, not a distributable production-signed artifact**; record it
that way in the evidence. No new signing architecture is authorized or proposed here.

**Still unproven on this host, and it must be stated:** no APK was built, because there is no Android
SDK, no JDK and no Gradle here. Installability is *inferred from the measured ABI set and signing
config*, not observed. The first validator must confirm the artifact exists at that path with those
ABIs and that `adb install -r` succeeds, and record it — that confirmation is itself the first piece
of Phase-M evidence.

**Do not use the CI artifact (A2) for physical validation:** it is `x86_64`-only by that explicit
override and will not install on an ARM phone.

### iOS

| Option | Builds from uncommitted tree | Push needed | Signing | Apple Developer | Evidence class | Can close |
| --- | --- | --- | --- | --- | --- | --- |
| **I1 — existing CI iOS job** | no | **yes** | `CODE_SIGNING_ALLOWED=NO` | no | **simulator slice only** — cannot install on an iPhone | **nothing** |
| **I2 — download the CI simulator app artifact** | no | yes | none | no | `SIMULATOR PASS` on a Mac | parts of **RSP-01** only, recorded as simulator |
| **I3-P — local Xcode SIMULATOR build, product root** | **yes** | **no** | none | no | `SIMULATOR PASS` | parts of **RSP-01**; **no** MOT-03, **no** MOT-04, **no** real insets |
| **I3-V — local Xcode SIMULATOR build, validation entry** | **yes** | **no** | none | no | `SIMULATOR PASS` for storage | **T12-04** — `expo-sqlite` is a real native module on a simulator, so this is genuinely useful, but it must be recorded as simulator, not physical |
| **I4-P — local Xcode DEVICE build, product root** | **yes** | **no** | **yes** | **yes — signing identity + provisioning profile for `com.qandeel.mobile`** | `PHYSICAL PASS` | **MOT-03, MOT-04, RSP-01** |
| **I4-V — the same, validation entry** | **yes** | **no** | as I4-P | as I4-P | `PHYSICAL PASS` | **T12-04 only** |
| **I5 — EAS Build** | no | not to GitHub | EAS-managed | yes, for device builds | `PHYSICAL PASS` | same split; same account/`eas.json` caveat as A4 |

**I4 is the only iOS path that closes anything perceptual, and it requires a Mac, an Apple Developer
account and a provisioning profile.** None of the three exists here. I3-V is worth noting separately:
an iOS **simulator** can legitimately exercise the T12-04 storage claims, because `expo-sqlite` is a
real native module there — so a Mac with no Apple Developer account still moves T12-04 forward even
though it moves MOT-03 and MOT-04 not at all.

### What a simulator or emulator can and cannot prove

**Can:** layout under a real type engine (iOS Simulator honours Dynamic Type), RTL mirroring, window
resize and split view, the large-text Outboard Live label, and the T12-04 storage behaviour, since
`expo-sqlite` is a real native module on a simulator.

**Cannot:** anything in §1 or §2 — frame pacing, drag feel, velocity handoff, the composite beat, and
pop-in during a real 60-frame drag. Also cannot prove real safe-area insets on a notched or gesture-bar
device, or performance on mid-range Android hardware.

---

## 7. Runbook

For every row: record **device model**, **OS version**, **build identity** (the working-tree SHA once
committed, or `uncommitted @ fee91dc8 + T-12 working tree`), **build config** (Release / validation
build), and where applicable **reduced-motion**, **locale**, **direction**, **text size** and **window
state**. A row without these is `NOT TESTED`.

1. **Prepare.** Provision the three environment variables (§5). For §4 additionally provision **two
   test identities** in the Supabase project **and confirm the QANDEEL API test environment is
   reachable and verifies against that same project** — never in source, never in the repo, never in
   a screenshot. If the API is unavailable, §4's backend-dependent claims are `NOT TESTED` and T12-04
   does not close; go no further on those rows rather than substituting anything.
2. **Record the tree identity ONCE.** `git rev-parse HEAD` plus, while uncommitted, `git status
   --porcelain` and `git diff --stat`. Both builds below come from this one checkout, and the
   evidence for every row references this single identity.
3. **Build the PRODUCT-ROOT app** (§6 A3-P / I4-P). `main` is unmodified. Run **§1, §2 and §3**
   against it — and only those. Capture 60 fps recordings and screenshots at the exact settings each
   row names. Confirm and record the Android artifact facts (§6 "Android build truth") on first build.
4. **Build the AUTH-VALIDATION app** (§6 A3-V / I3-V / I4-V) — same checkout, the one `main` line
   changed (§5). Run **§4 only**. Record in the evidence that this build's root is the harness and
   that no Product surface exists in it.
5. **Restore `main`** to `expo-router/entry` and confirm `git status` shows it clean.
6. **Record every outcome** as one of the four states in the table at the top. Do not merge a
   simulator observation into a physical claim, and **never record a §1–§3 observation made in the
   auth-validation build** — that build mounts no Product root, so there was nothing there to observe.
7. **Report failures as failures.** A FAIL reopens its item under BG-01 and is fixed inside T-12; it is
   not deferred, and it is not moved to the backlog.

---

## 8. What this host proved, and what it did not

**Proved locally:** 44/44 root static contracts, 106 Jest suites / 1201 tests, TypeScript, ESLint,
`expo install --check`, Expo Doctor 21/21, prebuild idempotency, native-impact classifier, and the
harness's isolation and credential-handling properties above.

**Not proved, by anyone, anywhere:** every row in §1–§4. All four items remain OPEN, T-12 remains
ACTIVE, and no PASS is claimed here.

---

# PART TWO — CLOUD VALIDATION RECOVERY

Everything above describes what an external validator would do by hand. This part replaces the parts
of it that a cloud runner can do instead, and records what was measured while building that path.

The correction it rests on: **the Windows `hermesc.exe` / Application Control failure is a property of
this host, not of the Product.** The repository's own Mobile CI already builds an Android Release APK
on Linux and an iOS Release simulator app on macOS, and both have been green on every recent run. So
the artifacts are producible; they were simply being produced in the wrong shape.

## 9. `t12-phase-m-cloud-validation.yml` — four jobs, one checkpoint

`workflow_dispatch` only. It is not a gate, nothing triggers it, and `mobile-ci.yml` is untouched.

| Job | Runner | Root component | Artifact | Can close |
| --- | --- | --- | --- | --- |
| `android-product-arm64` | `ubuntu-latest` | Product root | Release APK, `arm64-v8a` | nothing by itself — it is the binary the Honor session uses for MOT-03, MOT-04, RSP-01 |
| `android-auth-validation-arm64` | `ubuntu-latest` | T12-04 harness | Release APK, `arm64-v8a` | `QAN-BL-T12-04` on physical Android |
| `ios-product-simulator` | `macos-26` | Product root | Release `.app` + evidence set | parts of `QAN-BL-RSP-01`, recorded as `IOS RELEASE SIMULATOR PASS` |
| `ios-auth-validation-simulator` | `macos-26` | T12-04 harness | screenshots + redacted logs | `QAN-BL-T12-04` on release-equivalent iOS |

Exactly **three** things differ from the canonical Mobile CI native jobs, and each is written down in
the workflow beside the step that does it:

**ABI.** The gate passes `-PreactNativeArchitectures=x86_64` because it installs onto an x86_64
emulator, and §6 already recorded that such an artifact cannot be installed on any physical ARM phone.
These jobs build `arm64-v8a`. Hermes stays enabled, the New Architecture stays canonical, and the
signing disposition stays the repository's own measured one — the prebuild-generated debug keystore,
which makes this a **sideloadable Release-type build and not a distributable production-signed
artifact**. No new signing architecture is introduced or proposed.

**Configuration.** The gate builds with no configuration at all, which is exactly why its boot smoke
can only assert that the root mounted. These jobs receive the three public values through
`app.config.js`, so the runtime can reach an identity and a Session.

**Entry.** `apps/mobile/scripts/select-validation-entry.mjs` performs the one-line `main` change the
runbook states verbatim, in the two auth-validation jobs and nowhere else. It refuses without
`T12_PHASE_M_VALIDATION=1`, refuses unless `main` is currently exactly the Product entry — so it can
never run twice or over an unexpected value — and rewrites nothing else. The two Product jobs assert
the committed Product entry *before* building. The repository still carries `expo-router/entry` at
every commit, and the T-12 static contract still proves it.

### The `QAN-BL-T12-04` sequence is driven, not narrated

Four Maestro flows under `apps/mobile/.maestro/`, run against one simulator installation, with a real
`xcrun simctl terminate` between them and never a reinstall:

| Flow | Proves |
| --- | --- |
| `t12-04-phase-1-before-restart` | identity A signs in; a Session is acquired (`T12-04.0`, `.1`, `.1b`) |
| `t12-04-phase-2-after-restart` | the AUTH session returns and nothing else does (`.2a`, `.2b`, `.7`) |
| `t12-04-phase-3-signout-replacement` | sign-out retires the runtime; identity B cannot adopt A's Session (`.4`, `.5`) |
| `t12-04-phase-4-signed-out-survives-restart` | a signed-out store still gives nothing back after a kill |

Phase 4's pass condition is a **failing** report — `allPassed=false` with `auth=SIGNED_OUT`. A passing
one there would mean credential material survived a sign-out, which is the failure it exists to catch.

Every phase runs even when an earlier one fails, so one run collects the whole finding set instead of
stopping at the first, and a final gate step decides the job from the four recorded outcomes.

**Credentials never reach an artifact.** Two independent measures, because either alone is one point of
failure: the flows erase the identity field before any screenshot is taken, and
`scripts/phase-m/collect-validation-evidence.mjs` redacts every supplied value out of the text
evidence before it is uploaded. The harness's own report was already safe — it carries kinds, booleans
and character counts, never a value.

## 10. What was MEASURED before anything was pushed — and it stops the run

Four things were found by building the path rather than by reasoning about it. The first two are
defects in `apps/api` that no T-12 change caused and no T-12 change may fix; the third gates
everything; the fourth changes what MOT-03 and MOT-04 actually require.

### B-1 — the API declares no HTTP platform adapter, so it cannot be served at all

`apps/api/package.json` lists `@nestjs/common` and `@nestjs/core` and **no platform package**.
`@nestjs/platform-express` appears in `package-lock.json` only as an OPTIONAL peer of `@nestjs/core`
and is not installed anywhere in the tree. `NestFactory.create(AppModule)` therefore cannot select a
driver, and `main.ts` exits:

> `ERROR [PackageLoader] No driver (HTTP) has been selected.`

Nothing in CI catches this, because nothing in CI boots the server: `verify:a2-e2e-runtime-smoke` and
`verify:full-intelligence-e2e-runtime` are `ts-node` scripts that construct services directly. **The
QANDEEL API has never been served over HTTP by this repository.**

Not a T-12 defect, and deliberately not fixed inside T-12: adding a dependency to the API manifest
inside a mobile integration candidate would be exactly the scope laundering §16 forbids. For the
validation run only, the adapter was installed with `npm install --no-save --no-package-lock`, which
left `package.json`, `apps/api/package.json` and `package-lock.json` byte-identical.

### B-2 — provider configuration is read EAGERLY at bootstrap

With a driver present, the process still refused to start:

> `ERROR [ExceptionHandler] Error: OPENAI_API_KEY is required for hypothesis intent extraction.`
> `ERROR [ExceptionHandler] Error: MODEL_PROVIDER must be either anthropic or openai.`

`ConversationModule` documents its CU segmentation binding as lazy *precisely so that starting the
application never depends on a provider credential*, and for that binding it is. The hypothesis intent
extraction and model-router configurations are not: they are read at Nest bootstrap. So §9 of the
directive — "No AI provider key" — is **not true of the current API** for booting.

Worked around for validation with deliberately non-functional placeholders. The Phase-M path calls no
provider, so a real key is neither supplied nor needed; had any path reached one it would have failed
loudly rather than quietly doing AI work.

With B-1 and B-2 worked around, the API starts and answers:

```
GET /health -> 200 {"status":"ok","service":"qandeel-api"}
```

on the two Supabase values alone. No PostgreSQL installation, no Docker, no Redis, no service-role key.

### B-3 — the live Supabase database is fifty migrations behind, and this gates everything

Measured against the project the existing `SUPABASE_URL` secret names, authenticated as the existing
test identity:

| Migration | Object | Live |
| --- | --- | --- |
| 0001 | `conversation_sessions`, `conversation_turns`, `users` | present |
| 0004–0022 | `memories`, `hypotheses`, `information_gaps`, `him_*`, `runtime_event_outbox`, `post_response_intelligence_executions` | present |
| 0024 | `complete_post_response_intelligence_effect_v1` | **MISSING** |
| **0030** | **`create_conversation_session_v1`** | **MISSING** |
| 0035–0038 | `post_response_confidence_batch_items`, `hypothesis_lifecycle_transitions`, `information_gap_confidence_sources` | MISSING |
| 0055, 0063 | `him_session_context_bindings`, `formal_question_turn_bindings` | MISSING |
| **0064–0072** | `conversation_units`, `session_semantic_clocks`, `conversation_threads`, `conversation_live_focus_transitions`, `session_historical_coverage` | **MISSING** |
| 0073–0074 | `qandeel_keepalive` | present — applied out of band, which is why the gap was invisible |

The high-water mark is **0022**. Confirmed end to end rather than inferred: sign-in succeeds, and

```
POST /conversation/sessions -> 500
  ERROR [ExceptionsHandler] DataApiError: Data API request failed with status 404
```

— the API is healthy and its guard is correct; the database simply has no
`create_conversation_session_v1` to call.

**Why this gates every row, not only T12-04.** `ProductRoot` reaches `READY` only through
`bootstrapWithAuthorities` → `POST /conversation/sessions` → `GET .../temporal`. Without a Session
there is no Map, no Timeline, no chrome and no responsive composition on screen, in **any** build, on
**any** device. So MOT-03, MOT-04 and RSP-01 have nothing to observe either. One missing migration
band blocks all four items.

**The gap is closable and the shape of the fix is known.** Migrations 0023–0072 are 50 files that
contain no `DROP TABLE`, no `DROP SCHEMA`, no `DROP DATABASE`, no `CREATE ROLE`, no `CREATE EXTENSION`
and no `ALTER SYSTEM`. They are additive DDL plus `ALTER … OWNER TO postgres`, which is valid because
the Supabase pooler login is `postgres`. Each file carries its own `BEGIN;`/`COMMIT;`, so a failure
rolls that file back whole. It is the same sequence `api-ci.yml` applies to a fresh PostgreSQL on
every run — the same order against a different target.

Once applied, a brand-new Session **does** reach `READY` with no conversation at all: migration 0065's
`conversation_sessions_provision_semantic_clock` trigger provisions the clock row atomically with the
session insert, so `get_session_live_state_v1` returns a row, `liveHead` is `null`, and the bootstrap
skips the disclosure fetch by its own `snapshot.liveHead !== null` guard.

This is a **validation-infrastructure blocker**, not a Product one. No implementation owner reopens.

### B-4 — MOT-03 and MOT-04 need a world, and an empty Session is not one

§1 sets up "a Session with at least 20 committed Moments, projection FETCHED"; §2 needs "objects
beyond the visible viewport". A Session that reaches `READY` with `liveHead: null` has none of that:
no Moment to commit, no Track to scrub, no depth to change, no object to carry in.

Committed CUs are produced only by `POST /conversation/sessions/:id/turns`, which runs the orchestrator
and then the semantic chain — segmentation, focus resolution, Thread establishment, Live Focus — every
one of which is a real provider call. **There is no path to a populated world without real AI provider
credentials.** Seeding the substrate by hand was considered and rejected: it would be fabricating
Product truth, and the invariants it would have to satisfy span seven migrations.

The mobile app cannot create turns either — its whole conversation surface is `createSession`; it is a
reader of conversational truth. So the turns must be driven against the Session the device just minted,
from outside, while the device's live driver polls `/temporal` and picks them up. That is a faithful
setup rather than a workaround, and it exercises the live-delivery path that MOT-03's commit
acknowledgement row is about.

RSP-01 is **not** blocked by this: safe area, orientation, text scaling, Arabic/RTL and the Outboard
Live label are all observable on an empty-but-`READY` Product surface.

## 11. How the Product build reaches an authenticated identity with no login gateway

T-12P shipped no sign-in experience and no task owns one, so the Product build has no way to
authenticate — which would leave MOT-03, MOT-04 and RSP-01 unobservable even with the database fixed.

It is reachable without building one, and without weakening anything:

1. install the **auth-validation** APK and sign in through the harness;
2. `adb install -r` the **Product** APK over it.

Both artifacts carry `applicationId com.qandeel.mobile` and the auth store is a private
`expo-sqlite/kv-store` database (`qandeel-auth-session.db`) in that application's own sandbox, so a
same-signature reinstall preserves it and `ProductRoot` restores the session on its next launch.

This is **not** assumed. Android permits a data-preserving reinstall only for a matching signature, so
`scripts/phase-m/record-artifact-identity.mjs` records the `apksigner` certificate DN, the certificate
SHA-256 digest and the `debug.keystore` digest into **both** artifacts, and the two are compared before
the technique is relied on. If they differ, the technique is off and MOT/RSP stay `NOT TESTED`.

The evidence must state that the authenticated identity was established by the validation harness and
not by a Product surface. It is a validation affordance, not a discovered Product capability, and it
does not close `QAN-BL-T13-01` or create a login gateway.

## 12. Temporary HTTPS origin — measured, not planned

`cloudflared` 2026.9.0 was installed user-scope at `E:\QANDEEL\TOOLS\cloudflared`, from the official
Cloudflare release, Authenticode signature **Valid**, signer `CN="Cloudflare, Inc."`. Not a Windows
service, no firewall policy changed, no security control touched.

A Quick Tunnel to `http://localhost:3000` was started and health-checked **externally**:

```
GET  https://<generated>.trycloudflare.com/health              -> 200 {"status":"ok","service":"qandeel-api"}
POST https://<generated>.trycloudflare.com/conversation/sessions -> 401   (SupabaseAuthGuard, unauthenticated)
```

The origin is regenerated per session, so it is a `workflow_dispatch` input rather than a secret — it
is a public origin, not a credential. It is validation infrastructure only and must never become
production infrastructure.

## 13. Local state at the end of the preparation

Baseline `fee91dc80d68ba23b0320ff4420bc5399ec32aaa`, branch
`feat/t12-final-living-analysis-map-integration-v1`, still uncommitted.

* **44/44** root static contracts, including `forward-safety-contract`, which mirrors the whole
  repository — this workflow, its scripts and its Maestro flows included — and runs the entire contract
  set against four mutated trees;
* **107/107** mobile Jest suites, **1206/1206** tests;
* `package-lock.json` untouched; `apps/mobile/package.json` `main` is `expo-router/entry`;
* the generated `apps/mobile/android` project left over from the abandoned local Windows build was
  removed. It is gitignored, so it never appeared in `git status` — but four contracts assert that no
  generated native project is in the tree, and `forward-safety-contract` mirrors `apps/` wholesale, so
  its presence was failing them silently against a working tree that looked clean.

---

# PART THREE — UPSTREAM REPAIR AND PROVIDER-NEUTRAL VALIDATION STATE

Architecture reclassified one Part Two finding and corrected one plan. Both changes are recorded here
with what was actually measured, including a measurement of mine that was wrong.

## 14. The API HTTP repair — inside T-12, not deferred

Part Two called the missing Nest HTTP platform adapter a validation-infrastructure problem and worked
around it with an unsaved install. That was the wrong classification. T-12 depends on the real
authenticated HTTP API — `POST /conversation/sessions`, the temporal reads, the projection read — so
an API that cannot be served is a **T-12 blocking upstream defect**, and it is repaired here.

### 14.1 The adapter

`@nestjs/platform-express@^11.1.6` is now a declared dependency of `apps/api`, on the same major line
as `@nestjs/common` and `@nestjs/core`, and the root lockfile records it normally. The lockfile diff
is additive — the package and its transitive tree — plus twenty-three `"dev": true` markers correctly
dropped from packages that are now reachable in production.

### 14.2 The second defect the repair exposed — provider choice as a boot precondition

With an adapter present the process still refused to start:

> `Error: OPENAI_API_KEY is required for hypothesis intent extraction.`
> `Error: MODEL_PROVIDER must be either anthropic or openai.`
> `Error: GOOGLE_AI_API_KEY is required for hypothesis candidate generation.`

Nest calls `useFactory` at BOOTSTRAP, so four provider registrations constructed their provider — and
therefore validated its credential — merely to start the process. Selecting an AI provider was a
precondition of serving `/health`, auth, Session, temporal and projection, **none of which reach a
provider at all**. QANDEEL's production provider choice is deliberately still open, and nothing may
force it just to run those routes.

The repair is the deferral the codebase already blesses elsewhere — `ConversationModule` registers its
segmentation binding as `useValue: <factory>` precisely so "nothing is constructed and no
configuration is read at Nest bootstrap". Each of the four provider interfaces has exactly ONE method,
so the deferral is one delegation and no new abstraction:

| Module | Token | Method |
| --- | --- | --- |
| `ModelRouterModule` | `MODEL_ROUTER` | `generate` |
| `HypothesisIntentExtractionProviderModule` | `HYPOTHESIS_INTENT_EXTRACTION_PROVIDER` | `extract` |
| `HypothesisCandidateGeneratorProviderModule` | `HYPOTHESIS_CANDIDATE_GENERATOR` | `generate` |
| `HypothesisEvidenceAssociationProviderModule` | `HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER` | `propose` |

Every `createConfigured…` function is **byte-unchanged**. No interface changed, no consumer changed,
no provider-selection logic changed, and no error message changed. Only the MOMENT of construction
moved: from bootstrap to first use. Each delegate is `async`, so a construction failure arrives as a
rejection rather than as a synchronous throw from a Promise-returning method, and only success is
memoized — caching the failure would turn "no provider is configured" into a stale error object that
outlives the condition.

**Generation still fails closed.** That is asserted, not asserted-about: with nothing configured, a
`generate` call still rejects with `MODEL_PROVIDER must be either anthropic or openai.` and an
`extract` call still rejects with `OPENAI_API_KEY is required for hypothesis intent extraction.`

This is not a provider-lifecycle redesign and does not select a provider.

### 14.3 The regression gate

`apps/api/src/health/api-http-bootstrap.spec.ts`. It runs inside the existing `npm run test:api`, so
it needs no workflow change.

It boots the REAL `AppModule` through the REAL `NestFactory`, binds a REAL socket on an
OS-chosen loopback port, and makes REAL HTTP requests. Nothing else in the repository does: every
other test constructs services directly or uses `@nestjs/testing`, and the two "end-to-end runtime
smoke" verifiers are `ts-node` scripts. A defect living exactly between "the modules resolve" and "the
process serves" was invisible to all of them.

Two details that decide whether it proves anything:

**It boots as `production`.** Under `test`, all four provider factories short-circuit to fakes and read
no configuration, so a `test` boot would pass with or without the repair. The gate sets
`NODE_ENV=production` for the duration and requires the API to serve anyway.

**It withholds everything.** No `SUPABASE_*`, no `REDIS_URL`, no `DATABASE_URL`, and no provider
variable of any kind is visible while it boots — so no Supabase read or write is possible, both
background workers stay inert for want of Redis, and no provider can be called because none can be
selected.

Eight assertions: the manifest declares exactly one HTTP platform adapter on `@nestjs/core`'s major
line; `/health` returns the canonical liveness body; `/health/live` returns 200; an unauthenticated
`POST /conversation/sessions` is refused 401 over real HTTP; the withheld set really was absent; and
generation and extraction each still fail closed.

**Proven non-tautological.** With `@nestjs/platform-express` renamed away in `node_modules`, the gate
fails with the original `No driver (HTTP) has been selected`. The adapter was restored afterwards.

### 14.4 Measured after the repair

| | |
| --- | --- |
| API Jest suite | **179 suites / 3854 tests**, all passing |
| Root static contracts | **44/44** |
| Real process, `NODE_ENV=production`, no provider configured | `GET /health` → `200 {"status":"ok","service":"qandeel-api"}` |
| Same process, no credential | `POST /conversation/sessions` → `401` |

A first attempt at that last measurement was **invalid and is recorded as such**: an older API
instance still held port 3000, so the `200` came from a process started WITH provider placeholders.
The listener was killed, the port confirmed free, and the measurement retaken against a freshly
started provider-free process.

So the Phase-M claim that the API path needs only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` is now
TRUE of the repository. It was false when it was written.

## 15. The migration reconciliation — a corrected measurement, and where it stopped

### 15.1 My Part Two measurement was wrong

Part Two put the live database at migration **0022**, from PostgREST probes. PostgREST returns 404 for
a function the calling ROLE cannot see, and the conversation-authority functions are granted to
`service_role` only. **Visibility is not existence**, and only the catalog can answer the second
question.

Read from `pg_proc` / `information_schema`, per migration, by strong signature — new tables, new
non-`OR REPLACE` functions, new triggers, added columns:

> **live head = 0024.** 0025 onward absent. Nothing after 0025 applied — a clean PREFIX, not the
> interleaved patchwork the first failure suggested.

`0025` reads PARTIAL only because two of its four functions (`finalize_conversation_turn`,
`fail_conversation_turn`) already exist from migrations 0003/0019/0022 — and `0025` DROPs both by
exact signature before recreating them, so it re-applies cleanly. **The remaining set is 0025→0072,
48 files.**

### 15.2 The safety gate

Twelve read-only checks, all PASS: project identity via the QANDEEL-specific `qandeel_keepalive`
contract; catalog snapshot (25 tables, 61 functions, 17 triggers); row counts; 0073/0074 confirmed
already applied and excluded; the ordered set contiguous and correctly bounded; destructive scan clean.

**The scan failed first, and that was the gate working.** Seven files matched `TRUNCATE` — every
occurrence inside a regex STRING LITERAL in the migration's own read-only self-proof, where the word
appears precisely because that migration forbids truncation. The scanner was sharpened to read only
statements that actually EXECUTE (comments, single-quoted literals and `CREATE FUNCTION` bodies
removed; `DO$ … $$` blocks kept, because those do run) — and, because relaxing a scanner until it
passes is indistinguishable from auditing, it now carries a **six-case self-test** proving it still
catches a top-level `DROP TABLE`, a `DROP TABLE` inside a `DO` block, a top-level `TRUNCATE` and a
`CREATE EXTENSION`, while correctly ignoring a definition body and a self-proof literal.

Across 0025→0072 the only DROPs are 7 `DROP POLICY IF EXISTS` (RLS tightening — the point of the
hardening migrations), 2 `DROP FUNCTION` by exact signature immediately recreated, and 11
`DROP CONSTRAINT` where a CHECK is widened and re-added. No data destruction anywhere.

**A logical backup was taken** rather than declared unavailable. `pg_dump` is absent from this host,
but the project holds 46 rows across 7 non-empty tables, which the same client that read them exported
in full — a complete row-level export of the data at risk, the schema half being reproducible from the
repository's own migrations.

### 15.3 What was applied, and where it stopped

Under Part Two's §3 authorization, after the gate passed, sequential application began:

* `0023` — **applied** (89 ms). It is redefinitions and grants only, so applying it was idempotent.
* `0024` — **failed and rolled itself back**: `42701 column "result_code" … already exists`. It was
  already applied. This is what prompted the catalog re-measurement above.

Application stopped there and has not resumed. A later Architecture correction added an explicit
user-approval requirement for live Supabase writes, which arrived after `0023` had already run; that
is recorded here rather than smoothed over. **Nothing was manually patched to bypass a migration.**

## 16. Provider-neutral deterministic validation state

Architecture has deferred QANDEEL's production provider selection, and no provider may be chosen
implicitly to finish Phase M. Part Two's B-4 — that MOT-03 and MOT-04 need real provider credentials —
is therefore superseded.

**The replacement, and why it is not fabrication.** Committed Moments, Threads and Live Focus are
produced by DATABASE authorities, not by the model. Migrations 0064–0072 expose those authorities as
commands, and the repository's own verifiers already drive them with canonical payloads. The single
final authority is 0071's

> `public.commit_finalized_exchange_with_full_semantic_chain_v1(…)`

which matches T-03D exactly: after the cutover, ONE application path writes Session Positions, and it
always carries B1 focus, the Thread layer and Live Focus. Driving that command with deterministic
payloads produces canonical state through the same invariants production uses — the database validates
every one of them — with no model in the loop.

Binding constraints on that work:

* drive the commit authorities; **never** insert rows into final semantic tables directly;
* reuse the verifiers' proven payload shapes; invent no Product semantics;
* **never label synthetic data with a real provider name.** The verifiers use `OPENAI` / `gpt-5-mini`
  as fixture provenance. The schema does not require it: `conversation_unit_commit_batches` constrains
  `segmentation_provider` (≤64), `segmentation_model` (≤128) and `segmentation_prompt_version` (≤64)
  by length and non-emptiness only, with no vocabulary CHECK. Phase-M state will therefore carry an
  unmistakably synthetic provenance, so no reader of the database can mistake it for a model's output.

RSP-01 does **not** depend on this: safe area, orientation, text scaling, Arabic/RTL and the Outboard
Live label are all observable on an empty-but-`READY` Product surface. MOT-03 and MOT-04 do, because a
world with no objects and a Timeline with no Moments offer nothing to pan, scrub, commit or cull.

This work is **blocked on the migration reconciliation**: every authority it drives lives in
0064–0072, and none of them exists in the live project yet.

---

# PART FOUR — RECONCILIATION APPLIED

## 17. The applied range

Architecture approved the live reconciliation. Applied in strict numerical order, each file as it
exists in the repository, each in its own transaction:

> **`0025_conversation_authority_hardening_v1.sql` → `0072_historical_coverage_projection_disclosure_v1.sql` — 48 of 48 applied, no failure.**

`0023` had already been applied earlier (redefinitions and grants only, so idempotent). `0024` was
already present and is untouched. `0073`/`0074` were neither re-applied nor modified. Nothing was
patched by hand and no migration was edited.

## 18. Post-reconciliation verification — 14/14, read-only

| # | Claim | Result |
| --- | --- | --- |
| 1 | the live schema reached the intended 0072 state | 48 migrations, **326 strong signatures**, 0 incomplete |
| 2 | the Phase-M canonical authorities exist | **20/20**, including `commit_finalized_exchange_with_full_semantic_chain_v1`, `get_session_live_state_v1`, `get_session_historical_projection_v1` |
| 3 | ACL posture is the intended one | **8/8** — the six authenticated reads are `authenticated`, the semantic-chain writer is `service_role` ONLY, the keep-alive is `anon` ONLY |
| 4 | 0073/0074 intact | `qandeel_keepalive` present, **anon-only** (0074's correction preserved), and live: `POST rpc/qandeel_keepalive → 200 true` |
| 5 | no unexpected Product rows | 6 documented seed tables grew, **0 unexpected**; `conversation_sessions`, `conversation_turns`, `memories`, `hypotheses`, `users` unchanged; `auth.users` 3 → 3 |
| 6 | the pre-migration backup remains available | 41 445 bytes, 46 rows across 25 tables, taken before the first apply |

The two per-Session backfills are asserted **by value**, not by count — a count alone cannot tell a
documented backfill from an accidental write:

* `session_historical_coverage`: exactly one row, `LEGACY_UNCOVERED`, for exactly the pre-existing
  Session id. 0072 says so in its own words: *"Every Session that exists when this migration runs is
  a LEGACY UNCOVERED SESSION. This is the only row this migration ever writes about a Session."*
* `session_semantic_clocks`: exactly one row, `current_sp` NULL — nothing backdated.

**A consequence worth carrying forward:** the pre-existing Session is `LEGACY_UNCOVERED`, while every
Session created from now on is `COVERED` by 0072's trigger. Phase-M validation must therefore run
against a NEW Session — which is what the mobile runtime mints on every launch anyway.

The first verification run FAILED on `session_historical_coverage`, because that table was missing
from the expected-seed list. The migration source was read before the classification was changed, and
the value assertion above was added so the correction rests on the canonical text rather than on the
convenience of making a check pass.

## 19. The Phase-M blocker is cleared, end to end

The real local API — `NODE_ENV=production`, **no AI provider configured**, only `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` — was driven through the exact `canonical-runtime-bootstrap` sequence with
identity A:

| Step | Result |
| --- | --- |
| Supabase sign-in (identity A) | OK |
| `POST /conversation/sessions` | **201** — a real Session, `ACTIVE` / `TEXT` |
| `GET .../temporal` | **200** — `liveHead: null`, `liveFocus: NONE`, `liveFocusAtSp: null` |
| `GET .../temporal/events` | **200**, empty |
| `GET .../temporal/live-focus-events` | **200**, empty |
| `GET .../historical-projection?tc=1` | **409 `LIVE_HEAD_NOT_ESTABLISHED`** — correct, and never called at this point by the bootstrap |
| `GET .../sessions/:id` | **200** |

That is precisely the shape `canonical-runtime-bootstrap` requires: step 2 returns a snapshot, and
`snapshot.liveHead !== null` is false, so the disclosure fetch is skipped and the store is built.

**The mobile runtime can now reach `READY`.** Before the reconciliation it could not, and neither
`QAN-BL-T12-04` nor any of MOT-03, MOT-04, RSP-01 had a Product surface to be observed on.

An empty-but-`READY` surface is enough for `QAN-BL-RSP-01` and for `QAN-BL-T12-04`. `QAN-BL-MOT-03`
and `QAN-BL-MOT-04` still need a populated world, which §16's provider-neutral deterministic seeder
now has live authorities to drive.

---

# PART FIVE — THE PROVIDER-NEUTRAL CANONICAL WORLD

> **This seed validates runtime consumption and visual/navigation behaviour only. It is not evidence
> of AI semantic quality or provider integration.**

## 20. What was built

| File | Role |
| --- | --- |
| `scripts/phase-m/canonical-world-fixture.mjs` | the deterministic fixture — pure, no database, no network |
| `scripts/phase-m/seed-canonical-world.mjs` | the executor — mints a Session through the real API, drives the canonical authorities |
| `tests/phase-m-canonical-world-seeder-contract.test.mjs` | 18 focused tests, all pure |
| `package.json` | registers `test:phase-m-canonical-world-seeder-contract` |

**The canonical writer, and the reason there is no second option:**

> `public.commit_finalized_exchange_with_full_semantic_chain_v1(…)` — 44 parameters, `SECURITY DEFINER`

`verify-migration-0071.mjs` asserts that this is the **only** committing function `service_role` may
execute after the T-03D cutover. There is no fallback and no alternative path, which is exactly what
lets the seeded world be called canonical rather than merely plausible.

**Three semantic commits** — one per finalized exchange. Not a round number: two would give a single
travel band, and each extra exchange is one ordinary explicit focus shift, which is a decision the
repository's own `sessionOne` scenario already makes twice.

Every payload shape is copied from `verify-migration-0064.mjs` … `0071.mjs`. Nothing was designed
here, because a shape invented for this purpose is a shape no contract has ever validated.

**Not one `INSERT`, `UPDATE`, `DELETE` or `TRUNCATE` appears in either file.** A focused test proves
it by stripping comments and string literals and scanning what remains; a second test enumerates
every statement the executor issues and requires each to be a `SELECT` from a canonical authority or
transaction/role plumbing. Even the optimistic-concurrency token is read through
`get_conversation_full_semantic_runtime_context_v1` — the same read the real application path uses —
rather than off the clock tables, which `service_role` cannot see anyway.

Each exchange runs in ONE transaction: both conversation turns and the semantic commit land together
or not at all. A failure rolls back whole, the seeder stops, and nothing is repaired by hand.

**Provenance is deliberately unmistakable:** provider `PHASE_M_VALIDATION`, model
`DETERMINISTIC_FIXTURE`, and every evaluator/policy/prompt version prefixed `phase-m-`. The live
schema constrains these by length only, so naming a real provider would have been possible and would
have written a false provenance record into a durable table. A test asserts no provenance value
contains `openai`, `gpt`, `anthropic`, `claude`, `gemini`, `google`, `mistral`, `llama`, `cohere`,
`deepseek`, `grok` or `qwen`.

**Determinism with per-run identity:** every identifier is `uuidV5(namespace, "<sessionId>:<label>")`.
One Session reproduces byte-identical payloads; two Sessions share not one identifier — asserted by a
test. That is what makes a failed or repeated seed harmless rather than corrupting.

## 21. The seeded world

**Validation Session `8138f210-8609-4aca-8b10-532541f1c67a`**, owner `838cbaba-7713-4fd5-ab41-e95b916641fa`,
minted fresh through `POST /conversation/sessions` and therefore `COVERED` by the 0072 contract.

Read back **only through the paths the mobile runtime itself consumes** — 24/24 checks:

| Read | Result |
| --- | --- |
| `GET .../temporal` | `liveHead: 13`, `liveFocus: {kind: THREAD, threadId: b58abff9…}`, `liveFocusAtSp: 10` |
| `GET .../temporal/events` | 6 events tiling SP `1-3 4-5 6-7 8-9 10-11 12-13` — contiguous, no gap, ending exactly at the Live Head |
| `GET .../temporal/live-focus-events` | 4 transitions at SP 1, 3, 6, 10, each to a DISTINCT Thread, each reached once |
| snapshot vs transitions | the authoritative snapshot equals the last transition — a client that trusts the snapshot and one that replays agrees |
| `GET .../historical-projection?tc=13` | 200 — the disclosure the bootstrap fetches when `liveHead` is not null |
| `GET .../historical-projection?tc=5` | 200, and **2 684 bytes against the live head's 5 307** — an earlier TC genuinely discloses less |
| all five semantic depths | `WORLD`, `THREAD`, `SESSION`, `ANALYTICAL_OBJECT`, `SOURCE_PROVENANCE` → 200 |

**Four destinations, with Homes the database placed** — `compute_canonical_home_placement_v1` chose
these, not the fixture:

| Thread | established | state | Home |
| --- | --- | --- | --- |
| `801fbd2a…` | SP 1 | `ESTABLISHED_DORMANT` | (840 670, −255 507) |
| `a9a850c2…` | SP 3 | `ESTABLISHED_DORMANT` | (1 449 541, 138 479) |
| `314be2db…` | SP 6 | `ESTABLISHED_DORMANT` | (590 000, 758 593) |
| `b58abff9…` | SP 10 | `ESTABLISHED_ACTIVE` | (1 317 894, 1 360 753) |

Pairwise separations: **725 223, 944 683, 1 044 622, 1 059 883, 1 229 343, 1 685 242** — furthest over
nearest is **2.32×**. That spread is what makes short, medium and long camera travel distinguishable,
and it is measured from the disclosed world rather than asserted by the fixture.

One `ESTABLISHED_ACTIVE` against three `ESTABLISHED_DORMANT` is what gives `GO_LIVE_AND_LOCATE`
somewhere to travel *from*: a reader pinned inside history is looking at a dormant destination while
Live Focus sits elsewhere.

The committed wording is Arabic, deliberately — `QAN-BL-RSP-01`'s Arabic rows and `QAN-BL-MOT-03`'s
RTL Timeline scrub both need RTL content, and this way they get it from the Product's own data.

## 22. Isolation

Every other Session in the project holds **zero** units and **zero** turns:

| Session | units | turns | coverage |
| --- | --- | --- | --- |
| `33a3de7b…` | 0 | 0 | `LEGACY_UNCOVERED` — the pre-0072 Session, untouched |
| `ba146fa5…`, `b8da3fb8…` | 0 | 0 | `COVERED` — minted by the API path probes |
| `c0709fb6…` | 0 | 0 | `COVERED` — the FIRST seed attempt, which failed on a permission boundary and rolled back whole |
| **`8138f210…`** | **13** | **6** | `COVERED` — the seeded world |

`c0709fb6…` is worth naming rather than hiding: the first attempt read the concurrency token straight
off `session_semantic_clocks`, which `service_role` cannot select. The exchange rolled back whole and
left an empty Session — which is precisely the fail-closed behaviour intended, and the fix was to read
the token through the canonical authority instead. No row was patched to recover.

Every `conversation_unit_commit_batches` row in the project carries
`PHASE_M_VALIDATION` / `DETERMINISTIC_FIXTURE`. Nothing was deleted by ad-hoc SQL; the validation
Sessions stay isolated and documented.

## 23. Gates

| Gate | Result |
| --- | --- |
| Root static contracts | **45/45** (44 + the new seeder contract) |
| Seeder focused tests | **18/18** |
| API suite | **179 suites / 3 854 tests** |
| Mobile suite | **107 suites / 1 206 tests** |
| `npm ci` from the modified lockfile | **PASS** — 1 665 packages |
| TypeScript (mobile `tsc --noEmit`, api `nest build`) | **PASS** |
| ESLint, mobile, every non-resolver rule | **PASS**, 0 problems |
| Secret scan | **no live value in any repository file** |
| Validation-entry Product isolation | **PASS** (T-12 contract's transitive import-closure proof) |

Two gate notes, both about this host rather than the code:

**`npm run lint:mobile` cannot complete here.** `eslint-config-expo` loads
`eslint-import-resolver-typescript`, which needs `unrs-resolver`'s native binding —
`Cannot find native binding`, the documented Windows Application Control block. The substitute above
really checks every non-resolver rule; the resolver rules remain CI-only.

**The mobile suite failed once mid-session and it was local drift, not a regression.** After the
incremental `npm install` calls, all 107 suites failed to LOAD with
`Cannot find module 'expo/src/async-require/messageSocket'`. `npm ci` restored the tree exactly from
the lockfile and all 107 passed again with the resolver shim unchanged. The diagnosis was worth the
detour: a first attempt to "fix" the shim made it resolve raw TypeScript and produced a different,
worse failure — the tree was wrong, not the shim.

**Secret scan detail.** Zero live values appear anywhere. The shape scan flagged four PRE-EXISTING,
unmodified files, and each is synthetic by design: `runtime-entry/__tests__/config.test.ts` carries two
obviously fake secret-key literals precisely to prove the `FORBIDDEN_SECRET` refusal fires,
`runtime-entry/__fixtures__/runtime-entry.ts` carries an example publishable key, and `api-ci.yml`
carries the throwaway password of its own ephemeral PostgreSQL service container.

This paragraph deliberately DESCRIBES those literals instead of quoting them. An earlier draft quoted
them in full, and the scan then flagged this document too — the same self-match trap as a contract
that contains the string it forbids.

## 24. What this unblocks, and what it does not

`QAN-BL-MOT-03` and `QAN-BL-MOT-04` now have a world to be observed in, and `QAN-BL-RSP-01` has one
with real Arabic wording. `QAN-BL-T12-04` never needed one.

It remains true that none of the four is closed. Every one of them still needs the artifacts built and
run on hardware, and no seeded database changes that.

---

# PART SIX — ARCHITECTURE CLOSURE CORRECTION (AC-01 … AC-04)

The Architecture Closure Review accepted the Product, motion and responsive corrections and returned
four items. None reopens Phase M. This part records what each turned out to be.

## 25. `AC-01` — request-time credential freshness

**Finding CONFIRMED, corrected, and proven by a regression that fails without the correction.**

`TemporalApiConfig` and `HistoricalProjectionApiConfig` hold the bearer as an immutable field and
read it on every request. `createMobileRuntimeEntry` built both bootstrap clients from the access
token as it stood at bootstrap, so any request they issued after a `TOKEN_REFRESHED` went out on the
superseded token — and because a refresh deliberately keeps `authGeneration`, nothing retired,
nothing re-bootstrapped and nothing failed. `P19` proved only that a refresh creates no second
Session; it says nothing about what the next request carries.

Five authenticated request paths exist. **Three were already fresh and were NOT changed**, which the
review asked to be recorded rather than churned:

| Path | How it reaches freshness | Changed |
| --- | --- | --- |
| live driver catch-up | T-12P `clientForRequest()` builds a transport per request (R1-02) | no |
| T-12 projection coordination | `createProjectionClient(held.accessToken)` per request | no |
| conversation Session create | now issued through the seam | yes |
| bootstrap temporal snapshot | now issued through the seam | yes |
| bootstrap historical projection | now issued through the seam | yes |

The correction is one narrow seam owned by runtime entry —
`apps/mobile/src/runtime-entry/auth/request-credential.ts` — which stamps the `Authorization`
header at the moment of each request from the credential read one line earlier, bound to one auth
generation. No frozen T-03 module changed. The two frozen transports are constructed with
`NO_CAPTURED_CREDENTIAL` rather than a live token, so a stale bearer is not merely unused but
structurally absent; if the seam is ever bypassed the result is an immediate self-describing `401`
rather than a well-formed stale token.

Proven by `apps/mobile/src/integration/__tests__/credential-freshness.test.ts`, which refreshes the
token WHILE the bootstrap is in flight — the only window in which those clients can issue a
post-refresh request. Against the pre-correction source that test fails with exactly the defect
(`Bearer token-A` where `token-B` was required) while its two sibling cases pass, which is also the
evidence that the other three paths were already correct.

## 26. `AC-02` — the 90-minute `SIGNED_OUT`

**Classification: EXPECTED / TEST-CAUSED. Not a Product defect.**

No logcat was retained for the device event, so it cannot be replayed. What decides the
classification is settled from source instead:

1. **The runtime cannot sign a reader out on its own.** The whole runtime-entry layer contains no
   clock and no expiry field — no `Date.now`, no `expires_at` — so elapsed time is not an input to
   it. Pinned by `tests/t12p-mobile-runtime-entry-contract.test.mjs`.
2. **After `start()` there are exactly two sources of `SIGNED_OUT`:** an explicit `signOut()`
   command, and the SDK delivering a null session. The Product build reaches neither by itself — it
   ships no sign-in and no sign-out surface, and the validation harness is proven unreachable from
   the Product route, transitively.
3. **The validation procedure revokes that identity, globally, by design.** `T12-04` phases 3 and 6
   call `client.auth.signOut()`, whose SDK default is `{ scope: 'global' }` — which revokes every
   refresh token for that user on every device. Both phases EXECUTED and PASSED during the same
   window, on `T12_TEST_EMAIL_A`; the device was holding a session for the validation identity
   established by that same harness. The device's next refresh would then fail, and a failed refresh
   is precisely how the SDK removes the local session and emits `SIGNED_OUT`.

What is NOT attested, stated so the classification can be weighed rather than taken: there is no
device-side timestamp to correlate, and no retained record proving the identity typed into the
host-local device sign-in is byte-identical to `T12_TEST_EMAIL_A`. Every remaining reading is still
non-Product, because of (1) and (2).

Deterministic coverage added instead of a 90-minute device vigil:
`apps/mobile/src/runtime-entry/__tests__/signed-out-provenance.test.ts` — sixty consecutive
refreshes never sign anybody out, a four-hour wall-clock jump changes nothing, backgrounding stops
the refresh loop without signing out, and a null session from the SDK IS honoured whatever kind
carries it, so this runtime cannot mask a real one.

## 27. `AC-03` — auth storage at rest

**Disposition produced: ACCEPTED V1 RISK.** Written in full at
[`t12-auth-storage-at-rest-disposition-v1.md`](t12-auth-storage-at-rest-disposition-v1.md). Nothing
about the storage mechanism changed.

Two things are carried forward rather than accepted silently: `AC-03-R1`, that
`android:allowBackup` resolves to `true` — measured by evaluating the real project config through
Expo's own plugin — so Android Auto Backup includes the auth database; and the absence of iOS
hardware evidence, the iOS run being a simulator.

The documentation correction the review required is applied in two places: Expo documents **no**
fixed SecureStore size limit, only that the platform may reject a large value and that some
historical iOS releases rejected values around 2048 bytes.

## 28. `AC-04` — the T-11 allocation arithmetic

**Classification: non-blocking implementation detail.** T-11 is not altered.

Measured rather than argued, across heights 300–1400 at fifteen widths:

- **no region is allocated zero anywhere in the envelope** — the failure this mechanism exists to
  prevent does not occur at any measurement;
- the partition `ceiling + band + gap` equals the measured column **exactly**, everywhere the
  world's own floor does not bind;
- where it does bind, the plan asks for more than the surface — and that window is exactly
  **456…478 usable points, 23 values wide, at most 23 points deep**, width-independent;
- **any vertical safe-area inset of 23 points or more removes the window entirely**, because the
  branch arithmetic runs on the usable height while the ceiling is taken from the measured column;
- the short-height composition never over-subscribes: both short branches subtract the world's floor
  before allocating, which is exactly what the taller branch does not do;
- both Honor configurations, portrait and short landscape, are outside the window either way up — so
  the observation is arithmetic, not something the device ever showed.

No truth-bearing region becomes inaccessible, overlaps or collapses in any measured configuration,
which is the review's own test for a Product defect. The excess is smaller than either support
floor.

Pinned as a boundary rather than a note by
`apps/mobile/src/responsive/__tests__/allocation-envelope.test.ts`: any change that widens the
window, deepens the excess, or lets a region reach zero fails there instead of on a device.
