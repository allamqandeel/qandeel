# T-12 — Mobile Auth Storage-at-Rest: Architecture / Security Disposition v1

**Verdict: ACCEPTED V1 RISK.** No storage mechanism change is required before T-12 closes.

This is `T04-8`, the one item of `QAN-BL-T12-04` that was always a decision rather than an
observation. It is written against the mechanism as it stands, and it changes nothing: no storage
adapter is replaced, no dependency is added, and no cryptography is introduced.

One residual is named below and is **not** accepted silently — Android Auto Backup — with a
concrete one-line remedy deferred to the storage follow-up for the reason given.

---

## 1. What is actually stored

One dedicated SQLite database, `qandeel-auth-session.db`, reached only through
`apps/mobile/src/runtime-entry/auth/auth-session-storage.ts` — an adapter that exposes exactly
`getItem` / `setItem` / `removeItem` and nothing else, so `clear`, `getAllKeys`, `multiSet` and raw
SQL are unreachable from anywhere in the app.

Everything in it is written by `@supabase/supabase-js` under its own key. This repository writes no
key by hand. The serialised session contains:

| | |
| --- | --- |
| `access_token` | a JWT, default lifetime 3600 s, sent as `Authorization: Bearer` to the QANDEEL API |
| `refresh_token` | opaque, single-use, never expires, 10-second reuse interval; reuse outside it revokes the whole session |
| `expires_at`, `token_type` | the server-computed expiry and scheme |
| `user` | the Supabase user object: id, email, metadata |

**It is not encrypted by this application.** That is stated plainly here, in the module itself, and
in `docs/mobile-runtime-entry-preconditions-v1.md`. Nothing in this document should be read as a
claim that SQLite is encrypted, because it is not.

What *is* true, and is a different statement, is that the file is covered by the platform's own
file-based encryption — Android FBE, iOS Data Protection — keyed to the device credential. That is
the platform's encryption, not ours, and it protects a powered-off or never-unlocked device. It does
not protect a running, unlocked, compromised one.

## 2. Why Product truth and the conversation `sessionId` are excluded

The unencrypted surface is acceptable only because of what is *absent* from it, so the absence is
machine-checked rather than asserted.

`CanonicalState`, the camera, `TC`/`PTC`, the reversible history, inspection, Live Focus, Return
state and the disclosure cache are T-13's and appear nowhere in this store. Neither does the QANDEEL
conversation `sessionId` — and that one matters most here: it is the identifier every temporal and
projection route is addressed by, and persisting it would turn a credential store into a pointer at
the reader's analytical history.

`tests/t12p-mobile-runtime-entry-contract.test.mjs` scans the storage module for
`CanonicalState`, `RhEntry`, `sessionId`, `camera` and `inspection` and fails on any of them, and
separately proves `auth/auth-session-storage.ts` is the ONLY module in the layer that touches
storage at all. The physical evidence agrees: `T12-04.2b` and `.7` confirmed that a restart restores
the auth session and **nothing else**, and that each launch creates a new conversation Session.

So what sits unencrypted is Supabase's own session material, and only that.

## 3. The threat boundary, stated exactly

**Accepted — the app sandbox holds.** On a non-rooted Android device running a release
(non-debuggable) build, the database sits in the app's private data directory under its own UID and
SELinux domain; no other app can open it. On a non-jailbroken iOS device the app container is
sandboxed equivalently. This is the boundary the disposition rests on, and it is the same boundary
every documented Supabase-on-Expo storage route rests on.

**Accepted — a lost or stolen locked device.** The file is covered by platform file-based encryption
keyed to the device credential. An attacker with the hardware but not the passcode does not get the
refresh token.

**NOT defended — a rooted, jailbroken or otherwise compromised device.** Root defeats the sandbox
and the session material is readable. This is stated rather than mitigated, and the mitigation
usually proposed does not actually change it: a Keychain / Keystore item with default accessibility
is readable by anything that can execute *as the app*, so an attacker who has already achieved code
execution on an unlocked device reaches it either way. SecureStore raises the bar against **offline
file extraction**, not against a live compromise.

**NOT defended — a reader who hands over an unlocked device.** Out of scope for any storage choice.

**Bounded blast radius.** The credential is a Supabase session for one user, not a QANDEEL
privilege: the publishable key ships in the bundle and is safe there because Row Level Security is
the boundary, and the API verifies every bearer against `auth/v1/user` rather than trusting it. A
stolen refresh token is revocable — a global sign-out revokes every refresh token for that user, and
single-use rotation means a reused token revokes the session on its own.

## 4. Backup and extraction — the one named residual

**Finding (AC-03-R1): `android:allowBackup` resolves to `true`.**

`apps/mobile/app.json` sets no `android.allowBackup`, and Expo's `getAllowBackup` defaults to `true`
(`node_modules/@expo/config-plugins/build/android/AllowBackup.js`). Resolved against the real
project config, the generated manifest would therefore carry `android:allowBackup="true"`, and
Android Auto Backup would include the app's data directory — `qandeel-auth-session.db` among it — in
the user's cloud backup.

This is measured, not assumed: the value was resolved by evaluating the real config through Expo's
own plugin, without prebuilding anything.

Why it is a residual and not a blocker:

- Auto Backup on Android 9+ is end-to-end encrypted with a key derived from the user's own device
  credential, which Google cannot decrypt. The token does not become readable to a third party.
- The exposure it creates is **continuity**, not disclosure: a restore onto a new device would carry
  the session across without a fresh sign-in, which contradicts the model this layer describes.
- It is revocable after the fact by the same global sign-out as any other stolen session.

Why it is not changed here: `allowBackup` is a manifest attribute, so changing it changes the native
artifact that Phase M validated on hardware, and no device is available in this correction to
re-validate against. Changing it blind would trade a named, bounded residual for an unvalidated
build.

**Recommended remedy, for the storage follow-up, in priority order:** set
`android.allowBackup: false` (one line in `app.json`), or keep backup enabled and exclude the auth
database with Android 12+ `dataExtractionRules`. On iOS the equivalent question — whether the
container file is excluded from iCloud backup — is not configured today either and should be settled
in the same pass.

## 5. The size question, and the documentation correction

`QAN-BL-T12-04` asked for this disposition to be taken "against the observed session size". It is
not, and does not need to be.

The validation harness reports the ACCESS TOKEN's length as a character count, deliberately, so a
screenshot of its report is safe to attach as evidence. The serialised session blob was never
measured, so there is no observed session size on record.

That gap is now moot, because the threshold it was to be compared against does not exist. **Expo
documents no size limit of its own for SecureStore.** It states that the underlying platform may
reject a large value, and that some historical iOS releases rejected values around 2048 bytes. There
is no universal current 2048-byte hard limit, and this repository's two statements implying one have
been corrected — in `auth-session-storage.ts` and in
`docs/mobile-runtime-entry-preconditions-v1.md`.

The reason to refuse Supabase's published `LargeSecureStore` pattern therefore stands on its own and
is narrower than the size argument ever was: **it wraps the value in hand-rolled AES**, and custom
cryptography is forbidden. No custom cryptography is introduced by this disposition either.

## 6. Evidence this rests on

**Physical Android — Honor X9b (ALI-NX1), MagicOS 9.0.0.226, Android 15, arm64-v8a.** All eight
`T12-04` claims passed on hardware, verified BY VALUE through a database session census rather than
from the harness's own length-only report, whose "the ids must DIFFER" check is vacuous between two
UUIDs of equal length. The security-relevant ones:

| Claim | Result |
| --- | --- |
| `.1` a session is acquired and stored through the authorized mechanism | PASS |
| `.2a` a force-kill and relaunch restores the AUTH session | PASS |
| `.2b` and restores **no Product truth** | PASS |
| `.4` sign-out removes the credential | PASS |
| `.5` identity replacement cannot adopt the prior runtime, and the replacement is durable | PASS |
| `.7` a signed-out store still gives nothing back after a kill | PASS |

`.4` and `.7` together are the load-bearing pair for this disposition: **the credential does not
survive a sign-out**, which is what makes the residual risk bounded and revocable.

**iOS — Release simulator, run `34535928589` @ `a7200d64`.** All seven `T12-04` phases executed and
passed; the evidence pipeline reported `result=COMPLETE` (53 files, all seven phase directories).

The limit of that evidence is stated rather than glossed: a **simulator is not a device**. It proves
the functional storage contract — write, restore across relaunch, sign-out, replacement — and it
proves nothing about iOS Data Protection classes, Keychain behaviour or backup inclusion, because a
simulator does not implement them. No iOS hardware evidence exists for this item.

## 7. Decision

**ACCEPTED V1 RISK**, on this exact boundary:

> Supabase session material — access token, refresh token, expiry and user object — is stored
> unencrypted **by the application** in an isolated SQLite database inside the app sandbox, relying
> on the OS sandbox and platform file-based encryption for confidentiality. This is accepted against
> a non-rooted, non-jailbroken device. It is **not** defended against a rooted or jailbroken device,
> against a compromised device with live code execution, or against a reader who hands over an
> unlocked one. No Product truth and no QANDEEL conversation `sessionId` is stored, so the exposure
> is one revocable Supabase session for one user and nothing about what that reader has analysed.

Accepted because: the mechanism is an officially documented Supabase-on-Expo route; the only
published alternative introduces forbidden cryptography; the credential is revocable and does not
survive a sign-out, proven on hardware; and the isolation that makes the exposure narrow is
machine-checked rather than asserted.

**Carried forward, not accepted silently:** `AC-03-R1` (Android Auto Backup includes the auth
database) with the remedy in §4, and the absence of iOS hardware evidence in §6. Both belong to
`QAN-BL-T12-04`, whose status this document does not change — admitting a closed item against the
register is BG-08's reconciliation, not this correction's.
