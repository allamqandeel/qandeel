# QANDEEL — A3-02 Native Push, Permission & Platform Delivery Integration — Implementation Record v1

**Task:** `A3-02 — Native Push, Permission & Platform Delivery Integration` (Stage 3 — Activity & Notifications Production)
**Task Contract:** `QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_TASK_CONTRACT_v1.0.md` (Product Owner)
**Baseline:** `a2ec76507e43c82dcabf4194053e318c2fb9d509` (the merge of PR #307, A3-01)
**Branch:** `feat/a3-02-native-push-platform-delivery`
**PR:** Draft — see §1
**Status:** **`A3-02 IMPLEMENTED — PRODUCT COPY GATE APPROVED (§24a) — DEVICE PROOF / GITHUB CI: SEE §16–§19, §24 — DO NOT MERGE`**. Claude does not merge it.

> A3-01 decides what may interrupt and what the reader sees. A3-02 delivers that eligible intent to the reader's own
> Android / iOS devices when the app is not already handling it in-app — through the platforms' own push services, at
> the disclosure level A3-01 computes, re-judged against current truth at every attempt, with per-device evidence that
> claims only what the platform actually reports. It adds no source producer: production Activity stays truthfully
> empty until a source domain publishes (A3-01 record §3.2), and so does production Push.

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `a2ec76507e43c82dcabf4194053e318c2fb9d509` (PR #307 merged 2026-10-04T16:28:53Z) |
| Branch | `feat/a3-02-native-push-platform-delivery`, cut from the exact baseline |
| PR | Draft (number in the PR) |
| Final code head / CI | §24 |

## 2. Repo Truth Gate

| Check | Result |
|---|---|
| remote fetched | yes |
| `origin/main` | `a2ec76507e43c82dcabf4194053e318c2fb9d509` = the canonical kickoff baseline |
| PR #307 | `MERGED`, merge commit `a2ec7650…` |
| working tree clean | yes |
| `main` moved since the Task Contract | no — no re-sweep needed |
| migration head at kickoff | `0136_activity_attention_core_v1.sql` → A3-02 takes **`0137`** |
| read in full | `AGENTS.md`; Current State; Project Map; Product Roadmap; the backlog (BG-05); the A3-01 record; `I-08N-01` (D02–D59, §2, §10, §19, §21); the P3 closure (§2, §6, §9–§18); P3-A `P3_PERMISSION_EDUCATION_PROOF.md`, `P3_PLATFORM_REFERENCE_GATE.md`, `P3_PRIVACY_DISCLOSURE_PROOF.md`, `data/COPY_TABLE.md`; the pinned P4-C3 `COPY_REGISTRY.json` and P4-C4; P4-C2 §5; E2E-01 gap rows E-04 / E-05 / E-09 / E-10 / E-15 |
| CI / native inspected | `mobile-ci.yml`, `a3-01-inapp-proof.yml`, `qan-inf-04-artifact-reuse-demonstration.yml`, `scripts/phase-m/**` (manifest / provenance / fingerprint), `app.json`, `app.config.js`, both config plugins, the local Expo module, every A3-01 runtime-entry / integration / composition seam |

**Locator drift found (reconciled in this change, §21):** Current State §3.6 / §3.7 / §4 / §7 and Project Map §3 / §5.1
still described A3-01 as a Draft PR, CI pending, not merged.

**BG-05 (kickoff).** One item names A3-02: `QAN-BL-NOTIF-01` — *included in this contract* (it is the task).

## 3. Anti-duplication / gap sweep

Classes: **R** already reusable · **F** frozen Product law only (consumed) · **W** genuine A3-02 work · **O** another named owner.

| Concern | Class | Disposition |
|---|---|---|
| platform delivery intent from A3-01 | R + W | the A3-01 projection (`activity_items`) is the ONE model; 0137 adds an *intent* row per (item, device) referencing it — no second notification model |
| device registration / identity | W | `push_devices` (0137): one row per (account, random installation id); no hardware id |
| token lifecycle / rotation / invalidation | W | register / refresh / rotate in one owner command; provider dead-token → device `INVALIDATED` |
| sign-out cleanup | W | the ONE sign-out (W3-01) first detaches this installation (bounded, never blocks) |
| sign-out-others / password change | W | the identity transport tells the push boundary; every other installation detaches |
| account deletion cleanup | R | `ON DELETE CASCADE` from `public.users`; the governed Personal erasure (0130) removes every 0137 row (verifier §erasure) |
| multi-device delivery | W | one intent per live granted device; one item reaching N devices is ONE interruption (D53) |
| per-device evidence | W | `ACCEPTED` (provider), `opened_at` (THIS device's tap); no delivered / presented column exists |
| deduplication | W | unique (item, device) (D57) + provider collapse (FCM tag / collapse key, APNs collapse-id) |
| retry and semantic expiry | W | bounded back-off (6 transport attempts); every attempt revalidated; TTL never past `expires_at` / 24 h freshness (D59) |
| OS permission state | W | read live through the platform port; Android 13+'s never-asked-reads-as-denied handled truthfully (§8) |
| permission education | W + F | P3 §11 behaviour (F); the sheet + its copy (W; Copy Gate §24a) |
| Android notification channels | W | five category channels + the neutral L0 channel, names = approved filter words |
| iOS notification categories | F | none registered: no quick action exists (D42) — `thread-id` grouping only |
| Lock Screen disclosure rendering | R + W | A3-01 `disclosureLevel` (R); the bounded platform projection L0–L3 (W, §14) |
| app icon badge | F | not used — P3 §6 / D44–D48 forbid a count; a presence badge cannot be kept truthful by the OS (§9, §10) |
| foreground suppression | W | by evidence on the server (A3-01 settled / presented → no push) + the device's foreground policy (no OS presentation) |
| background / terminated delivery | W | platform-presented; tap → launch tap → Direct Entry (§13) |
| native Direct Entry | R + W | Activity `open` (R, D38); the tap inbox + composition hook (W) |
| stale notification tap | R | `open` answers STALE → the A3-01 fail-closed path |
| revoked / muted / expired target | R | revalidation (`platformVerdict`) at every attempt; `open` at tap |
| logout / wrong-account tap | W | signed out → the tap is dropped / never held; another account's item → 404 → nowhere |
| locale | W | the device's language picks the producer's rendered language; channel names in the reader's language |
| Android / iOS settings handoff | W | `APP_NOTIFICATION_SETTINGS` intent (Android), app settings (iOS) |
| observability without content | W | `PUSH_DELIVERY` operational outcomes, finite labels only |
| platform credentials / secrets | W | env names only (§7); nothing committed |
| physical-device gates | O | `QAN-BL-NOTIF-05` → Release Hardening & Launch (§20) |
| CI proof | W | §17–§19 |
| A3-01 proof workflow architecture | W | replaced by isolated legs (§18) |
| Proactive Gate / producer | O | `QAN-BL-NOTIF-02` (`PROACTIVE-EVT-01`), unchanged |
| reminder runtime / producer | O | `QAN-BL-NOTIF-03` (`REMINDER-EVT-01`), unchanged |
| security / account event source | O | `QAN-BL-NOTIF-04` (`ACCOUNT-SEC-EVT-01`), unchanged |
| Shared / Public / Introductions surfaces, producers, education moments | O | Stages 4 / 5 / 6 (A3-01 G-15 … G-17); §22 G-12 |
| export of notification preferences | O | `QAN-BL-PRIV-02` (`PRIV-EXPORT-01`), unchanged |

No backlog alias was created: the backlog held no push / device / channel / badge item other than `QAN-BL-NOTIF-01`.

## 4. Product authority map

1. **I-08N-01** — D02, D14–D17 (disclosure; L3 never default; Introductions L0), §10 (bounded projection), D36 (critical
   security never bypasses OS permission), D38–D43 (Direct Entry), D41 (Delivered / Presented / Seen / Opened distinct),
   D44–D48 (badge / counts), D49–D59 (channels, permission, foreground, per-device evidence, retry, unknown stays
   unknown, dedupe, no fallback, no retry past expiry).
2. **P3 closure** — §10 (L0–L3, "Native outside, QANDEEL inside"), §11 (permission education and its moments), §12.2
   (Device Notification Settings is a hand-off; OS-off said once), §14 (ceilings over delivery evidence), §15, §18.
3. **P4-C4** — the Lock Screen strings (`p3.l0`, `p3.generic.*`, `p3.ctxTitle.*`), `p3.osOff`, `p3.device*` — APPROVED,
   byte-exact from the pinned registry.
4. **A3-01** — `platformVerdict`, `budgetVerdict`, `disclosureLevel`, `lockSubjectOf`, `chooseOne`, the `open` boundary.
5. **P3-A platform reference gate** — evidence only (P3 §2): "Class ≠ OS level", Critical Alerts not authorized,
   provisional not adopted, channel importance not Product law.

## 5. Platform / provider implementation decision

**Census.** The repository had no notification module, no Firebase, no APNs code. Expo SDK 57 ships the first-party
`expo-notifications` (bundled `~57.0.17`), which registers with **APNs** and **FCM** natively and returns the **raw
platform device token** (`getDevicePushTokenAsync`), reads / requests the OS permission, registers Android channels,
handles taps (including the launching tap) and lets the app decide foreground presentation.

**Decision — the smallest production-safe path:**

| Layer | Choice | Not chosen, and why |
|---|---|---|
| device | `expo-notifications` (first-party, SDK-bundled) | `@react-native-firebase/messaging` (a second native stack for one platform), notifee (third party) |
| token | raw FCM / APNs device token | Expo push token — would route every message through Expo's relay (a third-party gateway) |
| server → platform | FCM HTTP v1 and APNs HTTP/2 **directly**, on Node's own `fetch` / `crypto` / `http2` | `firebase-admin`, `node-apn`, Expo Push Service, OneSignal — new dependencies or a relay for convenience |

New dependencies: mobile `expo-notifications ~57.0.17` (lockfile resolves 57.0.21, with its first-party
`expo-application` and the small JS `badgin`); root devDependency `yaml ^2.9.0` (already in the tree; used only by the
LEG-isolation contract to parse the workflow). **No new API dependency.** Native config: `app.json` plugins
`./plugins/with-qandeel-push` (typed manifest mods: the notification small icon references the ratified I-08B2.5
monochrome drawable the W2-02 plugin installs; the neutral default channel) and `expo-notifications` with
`mode: production` (iOS `aps-environment`). The order is load-bearing and pinned (expo-notifications' mod otherwise
strips the icon meta-data — found on the generated manifest).

## 6. Schema / API / device-registration architecture

**Migration `0137_push_platform_delivery_v1.sql`** (verifier `database/verify-migration-0137.mjs`, wired in API CI):

| Object | Purpose | Access |
|---|---|---|
| `public.push_devices` | one row per (account, installation): platform, transport (FCM / APNS), APNs environment, token + SHA-256 digest, OS permission, IANA zone, locale, status ACTIVE / DETACHED / INVALIDATED | none for any client |
| `public.push_delivery_attempts` | one delivery INTENT per (Activity item, device): state, finite reason, attempt count, re-evaluation flag, lease, disclosure level used, provider acceptance, this device's open | none for any client |
| `sync_own_push_device_v1` | register / refresh / rotate; the installation and token move to the account signed in now; ≤ 10 live devices | `authenticated` (owner = `auth.uid()`) |
| `detach_own_push_device_v1`, `detach_own_other_push_devices_v1` | sign-out; sign-out-others | `authenticated` |
| `record_own_push_open_v1` | this installation's tap, only for an ACCEPTED intent | `authenticated` |
| `server_plan_push_attempts_v1` | plan intents (eligible item × live granted device, item younger than the device, ≤ 24 h) | `service_role` |
| `server_claim_push_attempts_v1` | claim under lease with the CURRENT item, preferences, mute, device, evidence | `service_role` |
| `server_record_push_attempt_v1` | record under the claim token; dead token invalidates the device | `service_role` |

Deploy-time self-assertions refuse any client privilege on either table and any client-run server pass. No 0137
function writes `activity_items` (the user-level attention lifecycle stays A3-01's).

**API** (`apps/api/src/push/`, `PushModule` composed beside `ActivityModule`): `PUT /push/device`,
`POST /push/device/detach`, `POST /push/device/detach-others`, `POST /push/opened` (all `AUTHENTICATED` in the route
census; identity from the token; answers are one outcome word; no token is ever echoed); the server-only
`PushDispatcherWorker` (single-flight timer, the Privacy-pass shape; enabled only with the server channel AND at least
one platform credential; `PUSH_DISPATCH_DISABLED=true` switches it off; never on the Conversation path).

**Mobile** (`apps/mobile/src/push/`): the `PushPlatformPort` seam (production: `expo-push-platform.ts`), the device store
(own `qandeel-push.db`: installation id, "Not now", "OS prompt shown" — no token), the per-identity `PushController`,
the app-level tap inbox, the education sheet; `runtime-entry/push-api.ts` (`PushApiClient`, strict decoding).

## 7. Secrets / credential contract

| Secret (name only) | Purpose | Where | Operational owner |
|---|---|---|---|
| `QANDEEL_FCM_PROJECT_ID`, `QANDEEL_FCM_CLIENT_EMAIL`, `QANDEEL_FCM_PRIVATE_KEY` | Firebase service account → FCM HTTP v1 | API deployment secret store | Release Hardening & Launch (`QAN-BL-NOTIF-05`, PD-01) |
| `QANDEEL_APNS_TEAM_ID`, `QANDEEL_APNS_KEY_ID`, `QANDEEL_APNS_PRIVATE_KEY`, `QANDEEL_APNS_TOPIC` | APNs token-based auth (.p8) | API deployment secret store | as above |
| `QANDEEL_ANDROID_GOOGLE_SERVICES_FILE` | path to the Firebase client config at BUILD time | mobile build secret store (EAS / CI) | as above |

Nothing is committed (contract §4 scans for private keys, Firebase keys, service accounts, the two Firebase client
files). No server credential is a mobile input. No credential appears in a log, an artifact, a fixture or a screenshot.
Without them: the transports answer `NOT_CONFIGURED` and send nothing; the build has no FCM token and registers none.

## 8. Permission runtime

- **Nothing at launch.** The OS permission is READ at session start and on every return to the foreground; nothing asks.
- **Truthful state.** Android 13+ reports a never-asked `POST_NOTIFICATIONS` as `denied` + `canAskAgain` (found on the
  device proof, §17). QANDEEL records on the device when it shows the OS prompt; before that, that answer is
  `NOT_REQUESTED`; after it, `DENIED` is a refusal and is never re-prompted. Apple provisional is not adopted.
- **Legitimate moments (P3 §11).** Choosing «سماح» / Allow for Proactive QANDEEL (once — never again after "Not now"), and
  the reader's own visit to Device Notification Settings (the "Allow notifications" act there). The first Shared entry
  and entering Introductions are the other two moments; those surfaces do not exist yet (§22 G-12).
- **Education → REAL OS prompt.** The sheet's allow act calls the platform prompt (the ONE call site); "Not now" says the
  note once and is remembered on the device.
- **After refusal.** The page says `p3.osOff` once; Activity, the mark and the strip keep working; Device Notification
  Settings hands off to the OS (Android `APP_NOTIFICATION_SETTINGS`, iOS app settings).
- **Registration** carries the permission; a token is held only while it is GRANTED.

## 9. Android path

FCM HTTP v1 message: `notification` {title only at L2 / L3, body}, `data` {`qandeel: 'a3'`, `item`}, `android`
{`priority: high` (delivery mechanics only; Class is never an OS level), `ttl` ≤ the semantic window, `collapse_key` =
`tag` = the item id, `channel_id`}. Channels (DEFAULT importance, no badge dot, Lock Screen visibility left to the
device): `qandeel` (neutral, every L0 message), `category-qandeel` / `-shared` / `-public` / `-introductions` /
`-system`, named «قنديل» / «من قنديل» / «العالم المشترك» / «العالم العام» / «التعارف» / «النظام» (CANON / APPROVED).
Small icon: the ratified monochrome brand drawable. Badge: none (`showBadge: false`, no count anywhere).

## 10. iOS path

APNs HTTP/2, ES256 provider token (≤ 50 min), `apns-push-type: alert`, `apns-priority: 10`, `apns-expiration` ≤ the
semantic window, `apns-collapse-id` = the item id, `aps.alert` {title only at L2 / L3, body}, `thread-id` = the category
group, data {`qandeel`, `item`}. No `badge` key; authorization requested with `allowBadge: false`; no category and no
quick action (D42); no interruption level, no Critical Alert, no time-sensitive (P3 §9; not authorized). APNs
environment from the build (`aps-environment: production` via the plugin; SANDBOX for development builds).

## 11. Per-device evidence model

| Fact | Where | Claimed only when |
|---|---|---|
| user-level attention (NEW / SEEN / OPENED) | `activity_items` (A3-01) | the reader acts in the Product — never by a push event |
| intent planned / deferred / suppressed / expired | `push_delivery_attempts.state` + finite `reason` | the revalidation decided it |
| provider ACCEPTED | `provider_accepted_at` | FCM / APNs answered 200 — **not delivered, not presented** |
| delivered / presented | — (no column) | never: neither transport reports them here (D41, D56) |
| opened on THIS device | `opened_at` | the reader tapped this installation's notification, for an ACCEPTED intent |

Cross-device: an item opened / seen / settled anywhere suppresses the remaining intents on every device at their next
revalidation (`ALREADY_SEEN` / `SETTLED`) — duplicate interruption is reduced without fabricating any device's evidence.
The P3 §14 ceilings count one provider-accepted interruption per ITEM (conservative: acceptance is counted toward the
ceiling, never reported as delivery).

## 12. Retry / dedupe

Intent identity = (item, device), unique in the database (D57); the provider collapses repeats of the same intent.
Every claim revalidates from scratch (D54, D55): stale / withdrawn / expired → `EXPIRED`; > 24 h → `EXPIRED`; Quiet Hours
/ Snooze → `DEFERRED` until the device-local end, then re-evaluated with **at most one item per reader per pass**
(`reevaluated_not_chosen` for the rest — no morning dump); seen / settled / muted / category off / OS permission / gate
absent / ambient → `SUPPRESSED`. Transport: `TOKEN_INVALID` retires the device and its waiting intents; `REJECTED` is
terminal; transient → back-off 30 s, 2 m, 10 m, 30 m, 2 h, then `EXHAUSTED` (unknown stays unknown); `NOT_CONFIGURED`
waits uncounted. A provider outage changes no Product truth. No other channel is tried (D58).

## 13. Native Direct Entry

A tap (running, background, or the one that launched the app from a terminated process) → the app-level inbox (one
pending tap, the latest) → once the reader's world is drawn, taken ONCE → `POST /push/opened` (this device's evidence)
and Activity's `POST /activity/items/:id/open` — the SAME revalidation the strip and Activity rows use (`enterItem`):
ENTER → the destination; STALE / UNAVAILABLE → the A3-01 fail-closed path; **404 (another account's item, or gone) →
nowhere, nothing invented** (D39). Signed out, a tap is dropped and never held for whoever signs in next. The payload is
read strictly: the `a3` marker and one UUID; nothing else in it is ever read. No deep-link authority was added.

## 14. Privacy / disclosure

The server renders the platform words at A3-01's `disclosureLevel` (the lower of the reader's ceiling and the event's
own projection; importance never raises it): L0 «إشعار جديد» / New notification on the neutral channel for every category
(so not even the channel reveals Introductions); L1 the category's generic line only; L2 a context title + the
producer's bounded sentence; L3 adds the producer's secondary line. Every fixed string is the approved registry byte
(contract §8). The OS may only show less; QANDEEL never relies on it to hide more. The data carries an opaque item id
only — never content, never an account. No preview combines Worlds (one item → one message).

## 15. Failure classification

| Red result | Class | Action |
|---|---|---|
| Android never-asked read as refused (education never offered) | 2 Implementation defect | fixed (§8), unit + integration tests added |
| `expo-notifications` manifest mod stripped the icon meta-data | 2 Implementation defect | plugin order fixed and pinned |
| sign-out blocked when the device store throws | 2 Implementation defect | `detach()` made total and bounded |
| a tap while signed out held for the next sign-in | 2 Implementation defect (security) | taps dropped while signed out |
| cold-started proof root could not answer `open` for a pre-kill tap | 3 Validation / proof defect | the validation stand-in answers the push cases from its first request |
| six `depth` / `w2-account-access` jest tests on this `ar-EG` host | 4 Environment | identical on the untouched baseline `a2ec765`; not changed |
| five "no generated `android/`" root contracts locally | 4 Environment | the local build folder; 1 119 / 1 119 with it set aside |
| API CI and Mobile CI "workflow file issue" on the first push (`c0ebbd3`): no job ran | 2 Implementation defect (CI configuration) | the A3-02 step's flow-mapping name held an unquoted comma (a stray step key); quoted; no workflow step carries an unknown key |
| `android-delivery-background` (CI and local): «the L0 message is not exactly …» | 3 Validation / proof defect | the runner's notification reader counted the OS's own auto-group summary and misread an absent title (`=null`); the OS records themselves were right (L0 «إشعار جديد» on `qandeel`, no sentence) |
| `android-terminated-entry` (CI and local): the cold-start tap did not reach its destination | 3 Validation / proof defect | two or more QANDEEL messages are bundled by the OS; the tap landed on the OS group summary (plain launch, group cleared, no response delivered). The tap flow expands the group first, as a reader does; a cold-start tap then reached Direct Entry |
| `android-permission-deny` (local only): education not offered | 3 Validation / proof defect | the runner reinstalled over the previous leg's device-local state («the OS prompt was shown»), so DENIED was read — correctly. Each leg now installs clean |
| `ios-permission-delivery-entry` (CI): `qandeel-push-education` not visible | 3 Validation / proof defect | the sheet WAS presented (failure screenshot, approved copy); iOS omits plain container views from its accessibility tree. The iOS flow reads the sheet by its Allow control |
| API CI preflight: verifier-hazard H4 on `verify-migration-0137.mjs` | 2 Implementation defect (verifier) | the literal 10 is the migration's ceiling of live registrations; named as such |
| API CI, verifier 0137 on real PostgreSQL: «registration: the platform / transport pairing — expected to be refused, and it succeeded» | 2 Implementation defect (migration) | an iOS registration with no APNs environment passed `push_devices_platform_check`: `NULL IN (…)` is NULL and a CHECK accepts NULL. The constraint now requires the environment (`IS NOT NULL AND … IN (…)`); every other 0137 CHECK was re-read for the same hole (none: NOT NULL columns or explicit `IS NULL OR`). API and mobile already enforced it |
| API CI, verifier 0137 (`d5bcb11`): «sign-out: detach … — 3 !== 2» | 3 Validation / proof defect (verifier) | the planning pass is global and the same transaction also held another account's item, legitimately plannable for a device registered after it within the frozen transaction clock; the assertion counted that running total. The verifier now counts only the asserted item's intents |
| iOS leg (`6268cba`): the XCUITest driver did not answer in time; no app step ran | 4 Infrastructure | the driver started (FlyingFox on 127.0.0.1:50171) seconds after Maestro stopped waiting on a cold macOS runner; the previous run started it normally. Only the failed leg job re-run |
| iOS leg re-run (`6268cba`, attempt 2): the Settings entry tap reported done, the screen did not change | 3 Validation / proof defect | on a slow cold start the drawn control did not take its first tap; the shared navigation sub-flow repeats a tap only when nothing changed (`retryTapIfNoChange`), the destination assertions unchanged |
| iOS leg (`61f4515`, attempt 1): the job reached its 60-minute limit | 4 Infrastructure | Maestro's XCUITest driver answered its first `/deviceInfo` with HTTP 500 before the flow's first step; Maestro raised and its process did not exit, so the job idled to the limit. No app step ran. Only the failed leg job re-run (the same verified binary of the same run) |
| iOS leg re-run (`61f4515`, attempt 2): «registered: GRANTED» not visible | 3 Validation / proof defect | education → the real iOS alert → Allow all passed; the proof's status link then met iOS's own «Open in "QANDEEL"?» confirmation (failure screenshot), so the status screen never opened. The flow confirms it. Re-read of the iOS steps not yet reached: the background message is pushed before the tap flow starts (≈ 3 min of driver start on CI), by then out of the banner and in Notification Center, so the tap flow opens Notification Center when the message is not in view. Flow files only; no Product code |
| local `android-terminated-entry` stale step: the words not found | 4 Environment (local Windows host) | Maestro `-e` arguments lose U+064B (ARABIC FATHATAN) on this host; the same words match from a UTF-8 flow file. CI runs the leg on Linux |
| Mobile CI «Android (API 36 emulator boot smoke)»: `launchApp clearState` fails before any assertion | 4 Infrastructure (intermittent, pre-existing) | identical on `main` at the baseline `a2ec765` (run 37216917512) and `34ea439` (run 37188980195); on this PR it failed at `6268cba` (run 37228370161) and passed unchanged at `63399f1` (run 37230477521). Not introduced by A3-02, not touched here (no unrelated cleanup); surfaced as its own task |

## 16. A3-01 regression evidence

| Suite | Result |
|---|---|
| API full (`npm run test:api`) | 219 suites / 4 996 tests pass (A3-01's 218 / 4 963 + A3-02's) |
| mobile full (`npm run test:mobile`) | 2 004 / 2 010 → the six host-locale tests only (identical on the baseline) — A3-02 adds 26 |
| root contracts | **1 119 / 1 119** (incl. `a3-01-activity-attention-inapp-contract` 12 / 12, `forward-safety-contract`) |
| A3-01 device legs | §17 (the nine legs, unchanged in meaning, now isolated jobs) |

Re-anchored, each with its reason in place: the A3-01 contract's "A3-02 owns it" pins; three AppModule byte-pins (one
more strip for `PushModule`); six `app.json` plugin-list pins; the mobile dependency set; the plugin-file listings
(W2-02, W3-01); W3-01's sign-out pin; T-13's storage-module set (a fourth device-local store); T-12P's token-issuance
scan (the FCM OAuth JWT-bearer grant); QAN-INF-04's recipe list; the runtime-entry barrel allowlist.

## 17. A3-02 platform proof matrix

The proof root (`A301ProofRoot`, validation only) presents the **server-rendered** messages
(`a302-platform-payloads.json`, generated by `push-proof-payloads.spec.ts` from production code and pinned byte-exact)
through the REAL OS notification system; everything else on the device is production code.

| Leg | Capability | Proves | Result |
|---|---|---|---|
| `android-permission-allow` | permission (granted) | nothing at launch; not-requested said once; education BEFORE the OS; the real Android 13+ prompt → Allow; registered GRANTED; the six channels registered | §24 |
| `android-permission-deny` | permission (refused) | education at Proactive Allow; Not now said once; no repeated pressure; settings visit re-offers; real prompt → Don't allow; said plainly; never re-prompted; registered DENIED without token; Device Notification Settings → the OS settings screen | §24 |
| `android-delivery-background` | delivery, foreground, Lock Screen | foreground → nothing posted; background L0 = «إشعار جديد» on `qandeel`, no sentence; L2 = «الحساب» + the bounded sentence on `category-system`, no L3 preview (asserted from the OS's own notification records); Lock Screen screenshot; tap → revalidated Direct Entry | §24 |
| `android-terminated-entry` | terminated entry, stale, foreign | process killed with notifications posted; tap → cold start → Direct Entry; stale → Activity; another account's item → nowhere | §24 |
| `ios-permission-delivery-entry` | iOS mechanics | nothing at launch; education → the real iOS alert → Allow; registered GRANTED; the APNs payload (`simctl push`) not presented in front; presented in the background; tap → Direct Entry | §24 |

Server-side capabilities proved by unit + real-PostgreSQL tests rather than a device leg (equivalence class: they do
not differ by platform): Quiet Hours / Snooze deferral and one-per-pass re-evaluation, expiry never retried, muted /
revoked / category-off / gate-absent suppression, ceilings over evidence, token register / rotate / move / detach /
invalidate, multiple devices, no fabricated evidence, erasure (§16, verifier 0137). Signed-out / wrong-account taps:
integration test on the production composition (`a3-02-native-push.test.tsx`).

## 18. LEG isolation architecture

`.github/workflows/a3-proof.yml` **replaces** `a3-01-inapp-proof.yml` (one job: build + nine sequential legs).

```text
build-android (BUILD PRODUCER: proof APK ONCE, manifest PROOF_VALIDATION / a3-activity-push-proof)
  └─► android-leg × 13  (matrix leg; fail-fast: false; own emulator; download → provenance → ONE leg → own artifact)
build-ios     (BUILD PRODUCER: proof .app ONCE)
  └─► ios-leg × 1
```

A consumer contains no Gradle / xcodebuild / pod / prebuild / npm ci; it verifies provenance (`same-run`, role, recipe,
entry, bytes, inputs, configuration) before installing. "Re-run failed jobs" reruns only the failed leg job(s) and
reuses the same producer artifact (artifacts belong to the run). Stable leg ids: the nine A3-01 ids unchanged + four
Android + one iOS A3-02 ids. Each leg runs its own cold-start readiness gate (boot + package manager + the A3-01
readiness walk, ≤ 3 attempts) and every tap waits for its destination surface (stale-tap guard, A3-01 G-32).
`tests/a3-proof-leg-isolation-contract.test.mjs` fails if the matrix collapses back into a sequential job, a consumer
builds, a leg loses its job / artifact / provenance check, fail-fast returns, or a runner runs more than one leg.

## 19. Exact-head binary provenance

Each leg's evidence carries `device.txt` (device, API, APK SHA-256) and the consumer step summary carries the verified
manifest (commit, build-input fingerprint, artifact digest). Local device evidence (§24) records the APK SHA-256 it ran.

## 20. Physical-device Exit Gates

Emulators / simulators prove neither real FCM / APNs receipt nor physical Lock Screen and assistive-technology
behaviour. Named pre-release gates, owned by **Release Hardening & Launch** (roadmap §5 "physical iOS / Android device
validation"), carried by **`QAN-BL-NOTIF-05`**:

| Gate | Evidence required |
|---|---|
| PD-01 | production credentials provisioned by name (§7) in the deployment / build secret stores; dispatcher enabled |
| PD-02 | real FCM receipt on a physical Android (background and terminated), via the production API |
| PD-03 | real APNs receipt on a physical iPhone (background and terminated), production + sandbox environments |
| PD-04 | Lock Screen appearance at L0 and L2 on both platforms (secure lock screen) |
| PD-05 | token rotation / reinstall / account switch on a device: the old address stops receiving |
| PD-06 | tap from the real OS tray: Direct Entry, stale, another account's item |
| PD-07 | the real permission prompts (iOS one-shot; Android 13+ twice-then-blocked) and the settings hand-off |
| PD-08 | no app-icon badge appears on either platform |
| PD-09 | VoiceOver / TalkBack on the education sheet and the Notifications & Activity device section |

A3-02 claims none of these as passed.

## 21. Backlog reconciliation (BG-08 / BG-09)

- **Inherited:** `QAN-BL-NOTIF-01` → **`CLOSED — TOMBSTONE`** by A3-02: every implementation obligation of its Exit Gate
  is delivered (§5–§14); its physical-evidence clause is re-owned, not dropped, to `QAN-BL-NOTIF-05`.
- **Admitted (BG-06, one item):** `QAN-BL-NOTIF-05 — Native Push Physical-Device Exit Gates (PD-01 … PD-09)` →
  `Release Hardening & Launch — physical iOS / Android device validation`, `HIGH`, `DEFERRED — OWNED`.
- **Unchanged:** `QAN-BL-NOTIF-02` / `03` / `04` (their producers publish through A3-01; A3-02 delivers what they publish),
  `QAN-BL-PRIV-02`, every other item.
- **Locators:** A3-01 → merged (PR #307, `a2ec7650…`); A3-02 → this PR; Stage 3 per §23.

## 22. Stage-3 Gap Matrix

Classes: (1) already closed · (2) implemented here · (3) in-scope gap fixed here · (4) owned by an existing backlog item ·
(5) true dependency with a named owner and an Exit Gate · (6) not an obligation.

| # | Candidate | Source | Class | Disposition |
|---|---|---|---|---|
| G-01 | Device registration + token lifecycle | Task §5.1 | 2 | §6 |
| G-02 | Permission runtime + education → real prompt | Task §5.2–§5.3 | 2 | §8 (copy: G-11) |
| G-03 | Dispatcher + revalidation | Task §5.4 | 2 | §12 |
| G-04 | Android / iOS paths | Task §5.5–§5.6 | 2 | §9, §10 |
| G-05 | Per-device evidence | Task §5.7 | 2 | §11 |
| G-06 | Retry / dedupe / expiry | Task §5.8 | 2 | §12 |
| G-07 | Native Direct Entry | Task §5.9 | 2 | §13 |
| G-08 | Isolated proof legs + build once | Task §10 | 2 | §18 |
| G-09 | Android never-asked = denied | device proof | 3 | fixed (§8) |
| G-10 | Icon meta-data stripped by plugin order | generated manifest | 3 | fixed (§5) |
| G-11 | Permission-education copy unapproved (`AUDIT_OWNED`) | registry; NOTIF-01 Exit Gate | 3 | **fixed in A3-02: the Product Copy Gate (§24a), APPROVED by the Product Owner and bound byte-exact** |
| G-12 | Education moments at first Shared entry / entering Introductions | P3 §11 | 5 | Stage 4 / Stage 6 (A3-01 G-15 / G-17 owners). Exit Gate: those surfaces call `push.offer(...)` at first entry |
| G-13 | Physical device proof, credentials provisioning | Task §12 | 5 | `QAN-BL-NOTIF-05` (§20) |
| G-14 | Producers (Proactive, Reminder, Security) | A3-01 | 4 | `QAN-BL-NOTIF-02` / `03` / `04` |
| G-15 | Export of notification preferences | A3-01 | 4 | `QAN-BL-PRIV-02` |
| G-16 | Notification-service-extension delivery / presentation receipts | D41, D56 | 6 | not adopted; unknown stays unknown |
| G-17 | App-icon badge | P3 §6 | 6 | not implemented, by Product law |
| G-18 | Six host-locale jest tests; five local `android/` contract checks | host | 6 | environment; identical on the baseline |

**Orphan gaps = 0.**

## 23. Stage-3 status

A3-01 is merged ✔; the native permission boundary, registration / token lifecycle, Android / iOS runtime paths,
Direct Entry, retry / dedupe / evidence are implemented ✔; physical-device items have a named owner ✔;
`QAN-BL-NOTIF-01` is tombstoned ✔; orphan gaps = 0 ✔; and the Copy Gate is APPROVED (§24a) ✔.

On the final implementation head `a7b0386f5016b3e6f95cc07f5246a4ef993a79bd`, API CI and Mobile CI are green.
The A3 proof passed both platform builds and all 13 Android legs. The only remaining iOS proof failure is the simulator
harness failing to expose Notification Center after the background-message step; registration, the real iOS permission
alert, foreground non-presentation and the preceding iOS steps passed. This is classified **Validation / Infrastructure**,
not a confirmed Product defect, and the unproved real-device facts are already owned by `QAN-BL-NOTIF-05`, especially
PD-03 (real APNs background / terminated receipt) and PD-06 (real OS-tray tap → Direct Entry).

Under **QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE**, A3-02 is ready to merge with that owned pre-release
residue. Stage 3 closes on merge. Production Activity may still be empty because its source producers are separately
owned. The next numbered direction is **Stage 4 — Shared World Product Integration**.

## 24. Final CI run IDs / exact SHA

**Final implementation head:** `a7b0386f5016b3e6f95cc07f5246a4ef993a79bd`

| Evidence | Result |
|---|---|
| API CI — run `37238811145` | ✅ PASS |
| Mobile CI — run `37238811170` | ✅ PASS |
| A3 proof — run `37238809479` | ⚠️ PARTIAL: both build producers + all 13 Android legs PASS; iOS leg fails only at simulator Notification Center exposure |
| iOS proof job `111546688597` | Validation / Infrastructure residue → `QAN-BL-NOTIF-05` PD-03 / PD-06; no Product defect established |

No further proof cycle is required for this residue before merge. Real iOS background / terminated APNs receipt and
tray-tap Direct Entry remain explicit Release Hardening & Launch exit gates on physical hardware.

## 24a. A3-02 Product Copy Gate — APPROVED by the Product Owner

The permission-education sheet is `AUDIT_OWNED` (P4-C2 §5; E2E-E-10 `PRODUCT OWNER DECISION REQUIRED`), and the
NOTIF-01 Exit Gate requires it approved before the OS prompt ships. Proposed from P3-A's own DIRECTION / PROOF wording;
the Product Owner **approved with edits** to `eduTitle` (Arabic: «خلّيني») and `eduBody` (both languages); the other three
rows were approved as proposed. Bound **byte-exact** in `apps/mobile/src/push/copy.ts` (`PUSH_COPY_GATE`, status
`APPROVED BY THE PRODUCT OWNER — A3-02 PRODUCT COPY GATE`), and pinned row by row by the A3-02 contract §9. No other
copy changed.

| Key | Where | Arabic — APPROVED | English — APPROVED |
|---|---|---|---|
| `eduTitle` | sheet heading | خلّيني أوصلك لما يكون في حاجة تستاهل | Let me reach you when it's worth it |
| `eduBody` | sheet body | مش هبعتلك إشعار لمجرد إني أرجعك للتطبيق. هستخدم الإشعارات بس لما يكون في حاجة مهمة ليك، وتقدر تقللها أو توقفها في أي وقت. | I won't notify you just to bring you back to the app. I'll use notifications only when there's something that matters to you, and you can get fewer notifications or turn them off anytime. |
| `eduAllow` | sheet primary act → the OS prompt; also the Device Notification Settings act before any ask | السماح بالإشعارات | Allow notifications |
| `eduNotNow` | sheet secondary act | مش دلوقتي | Not now |
| `notNowNote` | said once after "Not now" | تمام. النشاط هيفضل يظهر هنا جوه التطبيق. | Okay. Activity will keep showing here in the app. |

Not used: `p3.osBoundary` / `p3.osBoundaryNote` (proof-only schematic; the real OS prompt replaces it).
