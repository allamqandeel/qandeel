# Mobile Product Sign-In Gateway v1 — T-14

**Status:** CANDIDATE — awaiting independent review
**Baseline:** `e132091ae9af1e2a2137d59494c04505c218032c` (canonical `main` after QAN-INF-04)
**Branch:** `feat/t14-mobile-product-sign-in-gateway-v1`
**Architecture:** `QANDEEL — T-14 Mobile Product Sign-In Gateway v1`, FROZEN FOR IMPLEMENTATION
**Owner of:** the signed-out Product entry surface (`apps/mobile/src/integration/auth-gateway/`), the
frozen bilingual sign-in copy, the local required-field rejections, the one in-flight request state,
the mapping from the frozen auth failure vocabulary to Product sentences, and the `SIGNED_OUT` arm of
the Product root's phase mapping
**Not owner of:** authentication itself, auth persistence, token refresh, the Supabase client, Session
creation, Product recovery, canonical state, the Map, the Timeline, Return, routing, the visual
language, or credential storage hardening (`QAN-BL-SEC-01`)

> **A signed-out reader has one real Product entry surface that invokes the already-frozen mobile
> auth authority. A successful sign-in hands control back to the existing integration runtime.
> Nothing about authentication storage, recovery, Session creation, Product truth, navigation, or the
> Living Analysis Map is redefined here.**

`T-14 backlog inheritance: 1 item` — `QAN-BL-AUTH-01 — Mobile Product Sign-In Gateway`, explicitly
claimed by this contract (BG-05). `QAN-BL-SEC-01` is out of scope and untouched. `QAN-BL-T13-01` is
not T-14 work; T-14 records its tombstone under BG-08 because T-13 delivered it and closed without
reconciling the register.

---

## 1. Why this task is small

The hard authentication work was already finished, and finished twice over:

| Already owned, elsewhere | Owner |
| --- | --- |
| the one Supabase client, the narrow port, the typed failure vocabulary | T-12P `runtime-entry/auth/supabase-auth-port.ts` |
| persisted auth session storage, auth-only, isolated | T-12P `runtime-entry/auth/auth-session-storage.ts` |
| `signInWithPassword`, auth generations, the sign-out race, foreground-only refresh | T-12P `runtime-entry/auth/mobile-auth-authority.ts` |
| `AUTHENTICATED → RECOVERING → BOOTSTRAPPING → READY`, one store, one generation | T-12 `integration/runtime/integration-runtime.ts` |
| identity-scoped Product recovery, and its refusal to read anything while signed out | T-13 `recovery/` |

What was missing was a **caller**. T-12P §8 says so in as many words — "No login experience.
`signInWithPassword` is a runtime capability for a future auth gateway to call" — and T-12 §14 named
the absent gateway as a residual limitation, which `QAN-BL-AUTH-01` later registered.

T-14 is that caller and nothing else. It behaves like an adapter:

```text
SIGNED_OUT
    ↓
ProductSignInGateway
    ↓ explicit reader submit
MobileAuthAuthority.signInWithPassword
    ↓ existing authority publishes authentication
AUTHENTICATED
    ↓ existing integration runtime
T-13 recovery / bootstrap
    ↓
READY
```

---

## 2. The one structural change

`ProductRoot` previously mapped **one** phase to a reader-facing surface. It now maps **two**, and
those two are the only phases that can honestly have one:

| Phase | Surface | Changed by T-14 |
| --- | --- | --- |
| `CONFIG_REFUSED` | technical `RuntimeState` | no |
| `RESTORING` | technical `RuntimeState` | no |
| `SIGNED_OUT` | **`ProductSignInGateway`** | **yes — the whole of T-14** |
| `AUTH_ERROR` | technical `RuntimeState` | no |
| `RECOVERING` | technical `RuntimeState` | no |
| `BOOTSTRAPPING` | technical `RuntimeState` | no |
| `BOOTSTRAP_FAILED` | technical `RuntimeState` | no |
| `RECOVERY_FAILED` | technical `RuntimeState` | no |
| `READY` | the unchanged Living Analysis Map | no |

`IntegrationPhase` gains no member and loses none. No canonical field is added for authentication UI.
No route is added: `apps/mobile/src/app/` is still exactly `_layout.tsx` and `index.tsx`, and
signed-out versus signed-in remains an integration phase rather than route topology.

The static contract asserts the strong form of this: the ONLY phase kinds `ProductRoot` compares
against are `READY` and `SIGNED_OUT`. A technical failure or a loading phase cannot be dressed as an
invented Product state, because there is no branch in which it could be.

**Why a technical failure stays technical.** Before there is an identity, a Session and an
authoritative snapshot there is no Product to show, and inventing one is the exact lie the technical
state view exists to refuse. `SIGNED_OUT` is different in kind: it is not a failure and not work in
progress — it is a correct resting state whose one honest answer to the reader is a way in.

---

## 3. The owner boundary

`apps/mobile/src/integration/auth-gateway/`

| File | What it is |
| --- | --- |
| `ProductSignInGateway.tsx` | the surface: two fields, one action, one request state, one notice |
| `product-sign-in-copy.ts` | every reader-facing word, in both Product languages, and the failure mapping |
| `index.ts` | the allowlist barrel |

It is an **integration Product surface that consumes the auth owner**, not a second auth owner. No
T-12P code moved into it, and it lives outside `runtime-entry/auth/`, `recovery/`, `state/`, `map/`
and `orientation-chrome/` because it belongs to none of them.

Proven absent by construction, not by convention: a Supabase client, `@supabase/supabase-js`, any
storage mechanism, any token or JWT inspection, any recovery import, any QANDEEL API client, any
Session locator, any canonical dispatch, any router symbol, any second locale authority, and any
second auth command beyond the one it calls. Each of those guards carries a planted-defect check, so
an absence predicate that stopped discriminating would fail this gate rather than pass it quietly.

---

## 4. Exact v1 scope

Email input; password input; one submit; local required-field validation; one in-flight state; one
error surface; bilingual Arabic/English copy; keyboard-safe, safe-area-safe, screen-reader-accessible
layout. Nothing else.

### Input semantics

**Email.** Controlled, `keyboardType="email-address"`, `autoCapitalize="none"`,
`autoCorrect={false}`, `autoComplete="email"`, `textContentType="emailAddress"`. Trimmed **only at
submit**, and never rewritten in the field: no lowercasing, no normalization, no client-side pattern
posing as an authority over what a real address looks like. Empty after trim is the only local
rejection.

**Password.** Controlled, `secureTextEntry`, `autoComplete="current-password"`,
`textContentType="password"`, no autocorrect, no auto-capitalization. Never trimmed, never
transformed, never logged, never put in an error, never persisted, never copied into Product or
recovery state. Empty string is the only local rejection. The masking is the bare boolean prop, not a
bound expression — which is how "no visibility toggle" is enforced rather than remembered.

### Submission law

One local request state: `IDLE | SUBMITTING`. No queue, no automatic retry, no backoff, no hidden
second submit, no timer of any kind in the layer.

A second press while the first is in flight is **ignored by the handler**, not merely disabled in the
renderer. Two presses in one tick both read the same rendered state, so a guard living in `useState`
would let the second through before React re-rendered; the guard is a ref, read and written
synchronously where the race actually is. The control still reports `disabled` and `busy` through
`accessibilityState`, which is what a screen-reader user needs, and stays in the responder tree, which
is what makes the guard testable.

### Failure mapping

| Frozen `AuthPortFailure['kind']` | Product copy | Password |
| --- | --- | --- |
| `INVALID_CREDENTIALS` | "Email or password is incorrect." | cleared |
| `NETWORK` | "Couldn't connect. Try again." | preserved |
| `UNEXPECTED` | "Couldn't sign in right now. Try again." | cleared |

The mapping takes the **kind** and nothing else. `failure.detail` is a technical description for a
typed model and a log; there is no expression anywhere in this layer that reads it, so no provider's
own words can reach a Product surface. The vocabulary is imported from the frozen port rather than
re-declared, and both mappings are exhaustive over it, so a fourth kind would stop compiling instead
of silently rendering nothing.

A transport failure is not evidence about the credential, so the password survives it and an explicit
reader retry costs no re-entry. A rejected or unexplained credential is cleared, because the reader is
about to type a different one.

**One sentence for a rejected credential, not two.** Distinguishing "no such address" from "wrong
password" is an account-enumeration oracle. Neither language does it, and no copy claims account
existence separately from credential validity.

---

## 5. Copy, language and direction

Every reader-facing word lives in `product-sign-in-copy.ts`, in one interface implemented by both
language packs, so a phrase cannot exist in one language and be missing from the other — the compiler
refuses the pack rather than the reader meeting the wrong language. The component contains no Arabic
character and assembles no sentence at all; the static contract asserts exactly that, which is the
structural claim that outlives any wording revision.

The strings are **T1 · Chrome** under the frozen VI-01 register law: neutral contemporary Arabic, no
displayed case endings, gender-neutral. VI-01 froze no sign-in vocabulary — the archive contains none
— so nothing here overrides a frozen term; what T-14 does is apply the register law to microcopy VI-01
deliberately left open. No string contains a digit, so the v1 numeral policy is not engaged, and no
bidi control character is embedded anywhere.

Language and direction remain **independent**, which is the whole point of the one locale authority:
the words follow `locale.language`, the layout follows `locale.direction`, and
`direction = language === 'ar' ? 'RTL' : 'LTR'` appears nowhere. Arabic under LTR and English under
RTL are both supported and both proven. The two credential fields stay physically left-to-right,
because an email address and a password are Latin byte sequences whose caret behaviour is unusable
when the field mirrors; that is a decision inside the fields and it does not mirror the Product around
them.

The gateway resolves no locale of its own. It is handed the one app-level locale the Product root
already resolves for the composed world.

---

## 6. Keyboard, safe area, responsive and accessibility

Existing React Native / Expo primitives only; no new package. `KeyboardAvoidingView` over a
`ScrollView`, flex layout, a bounded content width, natural content height, and real safe-area insets
from the provider the app already mounts.

Forbidden and absent: fixed viewport-height assumptions, absolute positioning of form controls,
keyboard-dependent pixel constants, disabled font scaling, and `overflow: hidden` used to make the
form fit. The screen **scrolls rather than clips** when the keyboard and a large text size take the
viewport, and every control is a floor for its content rather than a ceiling on it.

Accessibility: the title is a header; both fields carry explicit accessible labels; the submit is a
button with `disabled`/`busy` semantics while in flight; one polite live region carries the status
while a request runs and the frozen failure sentence afterwards, and is mounted at all times so it has
something to announce a change against; focus order is title → email → password → submit → notice;
Return moves from the email to the password and submits from the password; errors are visible words,
never a colour; the submit target is at least the platform minimum; the surface names the language it
is written in, in both languages. No accessibility wording reveals the entered password.

---

## 7. Visual boundary

Deliberately narrow. No logo, no lantern, no illustration, no gradient, no animation, no motion, no
material effect, no icon pack, no custom font, no new design token, no brand system, no decorative
loading sequence — and **no colour at all**, which the contract asserts directly. T-14 is not VI-03
and freezes nothing that belongs to it.

The acceptance criterion is: clear, readable, accessible, native, and not visually contradictory.

---

## 8. Security and privacy

Every T-12P / T-13 property is preserved because none of them is touched. No password or token in a
log, a snapshot or an error; no credential in Product recovery; no auth material in analytics — there
is no analytics; no raw provider detail in Product UI; no second Supabase client; no new storage
mechanism; no token inspection; no secret in build configuration; no custom cryptography; no credential
retry loop; no credential default and no placeholder, so a screenshot of this surface is safe to attach
to a review.

`QAN-BL-SEC-01` stays deferred to `QAN-SEC-01`. T-14 implements no backup policy, no
encryption-at-rest change, no hardware credential hardening and no storage replacement.

---

## 9. Lifecycle

T-14 invents no second auth epoch rule. `MobileAuthAuthority` already owns command ordering and the
stale-sign-in-versus-sign-out race, and remains the only judge of whether a sign-in completion is
current. What the gateway adds is surface-local only: a late Promise completion after unmount issues
no React state update. No `AbortController` is created, because the frozen capability supports none and
inventing one would be a second cancellation with its own ordering.

On success the gateway does nothing at all. It does not navigate, does not bootstrap, and manufactures
no success UI: the authority publishes authentication, the integration runtime leaves `SIGNED_OUT` on
its own, and this surface is replaced by whatever that runtime decides comes next.

---

## 10. Evidence

**Deterministic, and sufficient.** A fake auth authority is enough for the success and failure
semantics of a signed-out surface. The real Supabase transport was independently validated by
T-12P / T-12 and T-14 is forbidden from re-proving that layer.

| Gate | What it proves |
| --- | --- |
| `integration/__tests__/sign-in-gateway.test.tsx` | the exact copy in both languages; both code-switched combinations; the trimmed email and the byte-exact password; empty fields never reaching auth; one submit, one call; a second press refused; the three failures mapped with no detail leak; the password disposition per failure; a late completion after unmount; masking and autofill intent; the accessible tree; no sign-up, reset, social or toggle control, and exactly one press target |
| `integration/__tests__/signed-out-product-root.test.tsx` | `SIGNED_OUT` renders the gateway and no longer the engineering surface; six other non-`READY` phases stay technical; `READY` still composes the unchanged world; a real sign-in through the real runtime reaches `READY` with exactly one Session create, and no Product recovery read occurs while signed out |
| `tests/t14-mobile-product-sign-in-gateway-contract.test.mjs` | the permanent boundary, by construction, with planted-defect checks on every absence predicate that matters |
| T-12P / T-12 / T-13 contracts, full mobile Jest, typecheck, lint, root contracts | no regression |

**No cloud dependency.** T-14 created no Phase-M run, no T-13 recovery validation, no Quick Tunnel, no
seeded Session and no live QANDEEL API. None of them is needed to prove a signed-out auth gateway, and
running one would have been a broad native execution bought for a screenshot.

### One re-anchored assertion

`tests/t13-recovery-persistence-contract.test.mjs` §6 pinned the exact line
`if (phase.kind !== 'READY') return <RuntimeState phase={phase.kind} />;` under the heading "no
Product frame before READY". That line was a **delivery fact** about a Product with no signed-out
entry, and T-14 built exactly the entry T-12 §14 recorded as missing.

The semantic owner is unchanged, and the re-anchored assertion is stronger than the line match it
replaces: the composed **world** exists in one place, is reachable from one phase, and that phase is
`READY` — so no world, no Session, no viewpoint and nothing derived from a recovery record can be on
screen before the bootstrap has reconciled against server authority. T-13's signed-out non-exposure is
untouched and still proven behaviourally by `S1-10`: the gateway reads no Product recovery at all.

---

## 11. What T-14 did not do

Sign-up, email verification, password reset, magic link, OTP, social auth, biometrics, passkeys,
profile, avatar, onboarding, tutorial, permissions onboarding, subscription, account deletion, account
linking, multi-account switching, "remember me", a password visibility toggle, sign-out chrome, backend
auth routes, backend or database migrations, new Supabase policies, changed auth or Session semantics,
changed token refresh or persistence, SecureStore migration, encryption changes, Android backup policy,
iOS Data Protection policy, Product recovery changes, Session creation changes, Map / Timeline / Return
changes, cross-Session navigation, Analysis Replay, visual redesign, brand assets, motion work,
analytics, crash reporting, a new package, a second locale provider, a second auth client, a second
runtime, or new router topology.

**None of that is backlog.** BG-06 admits an item only where one already has an `OPEN` identifier, is
deferred by a canonical document, is carried forward for validation, or Architecture designates it.
None of the above qualifies, and T-14 admitted no new item.

---

## 12. Backlog reconciliation (BG-08)

| Item | Before | After |
| --- | --- | --- |
| `QAN-BL-AUTH-01` | `OPEN — UNASSIGNED`, owner `UNASSIGNED` | `CLOSED — TOMBSTONE`, closed by T-14 |
| `QAN-BL-T13-01` | `DEFERRED — OWNED` by T-13 | `CLOSED — TOMBSTONE`, delivered by T-13, recorded by T-14 |
| `QAN-BL-SEC-01` | `DEFERRED — OWNED` by `QAN-SEC-01` | unchanged |

The `QAN-BL-T13-01` entry is a **register correction**, in the same shape as the late `QAN-BL-AUTH-01`
admission before it: T-13 stays `CLOSED / FROZEN`, nothing about its semantics is reopened, and T-14
claims none of its work.
