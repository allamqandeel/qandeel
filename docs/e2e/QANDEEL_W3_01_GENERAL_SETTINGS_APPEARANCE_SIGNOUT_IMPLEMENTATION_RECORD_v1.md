# QANDEEL — W3-01 General Settings Foundation + Appearance + Sign Out — Implementation Record v1

**Task:** W3-01 — General Settings Foundation + Appearance + Sign Out (E2E-01 wave W3, first bounded slice; closes the
last W2 moment, `E2E-D-07`, only once merged)
**Rows:** `E2E-D-01` (open General Settings), `E2E-D-10` (Dark / Light / System), `E2E-D-07` (Sign out) — and
`E2E-D-02` (find a setting in its group) **advanced only, NOT CLOSED**
**Baseline:** `b650b56f7436ce63d33c0af34036a963a03f5eee` (merge of PR #286, W2-02)
**Branch:** `feat/w3-01-settings-appearance-signout`
**Status:** IMPLEMENTED ON A DRAFT PR — NOT MERGED. One bounded, Product-Owner-authorized Production Integration
slice; it opens no other wave or Product area, closes no phase, and does not close W3.

---

## 1. Starting baseline

- `origin/main` was exactly `b650b56f7436ce63d33c0af34036a963a03f5eee`; PR #286 (W2-02) was merged at it
  (`2026-09-29T16:38:55Z`). Local `main` was fast-forwarded to it and the branch was created from it. Tree clean.
- Node `v24.19.0`, npm `11.17.0` (engines: `node >=22.13.0`, `npm >=10`).
- Current native appearance seam before W3-01: the W2-02 plugin inserted
  `setApplicationNightMode(MODE_NIGHT_YES)` into `MainApplication.onCreate` (W2-02 record §8, §12 carry-forward),
  and the iOS root view was the constant `#101010`.

## 2. Skills / G1

`react-native-best-practices` was loaded (the project is an Expo / React Native app). None of its sub-skills applied:
W3-01 adds no animation, gesture, SVG, worklet or JSI work — Settings opens without motion, and the Conversation ↔
Analysis boundary keeps F2's existing cross-fade unchanged. No other Skill was used.

## 3. Product Copy Gate

Frozen copy reused: «الإعدادات» / Settings (P4-C3 registry `settings`, CANON); «المظهر وتسهيلات الاستخدام» / Appearance
& Accessibility and «الدعم ومعلومات التطبيق» / Support & About (P4-C4 §4 `gAppearance`, `gSupport`); «رجوع» / Back.

No frozen copy existed for the three appearance values or for Sign out (P1 §12.1 names the values, P1 §8.1 names the
placement; the registry has no row; `النظام` exists only as P3's Activity filter, a different meaning). The executor
stopped before any Product edit and the Product Owner approved exactly:

| Use | Arabic | English |
|---|---|---|
| Dark | «داكن» | Dark |
| Light | «فاتح» | Light |
| System | «حسب الجهاز» | System |
| Sign out | «تسجيل الخروج» | Sign out |

Also approved: no appearance helper text, no sign-out progress copy, no user-facing sign-out failure copy; the selected
appearance is conveyed by the visible selected treatment plus the accessibility selected state, never by extra copy or
colour alone. The words live in `apps/mobile/src/settings/copy.ts` and the entry's name in
`apps/mobile/src/conversation/copy.ts` (`settingsName`).

## 4. General Settings — S-B realization (`E2E-D-01`)

- **Entry (P4-C1 S-B, literally):** `ConversationSurface` draws Personal QANDEEL's own row directly beneath the upper
  chrome (44 pt high, 10 pt side padding, on the World — no card), with ONE icon-only control at the reader's logical
  END edge (left in Arabic, right in English), 44 × 44, P2's curated `settings` utility glyph at 22 px in the rest ink,
  accessible name «الإعدادات» / Settings. The upper chrome is unchanged (the depth control only). The row is drawn only
  when the Personal world supplies it, and never in the Analysis. It is structurally where the later U-A
  Understanding row entry will also stand; Understanding is not implemented.
- **Navigation:** no Expo Router route (the router root is still its two files). `DepthComposition` shows
  `SettingsSurface` OVER the Conversation as a local presentation state. The Conversation stays mounted beneath —
  hidden from assistive technology and touch — so its draft, scroll and controller are exactly preserved; opening
  Settings dispatches nothing, writes no canonical state, builds no Session, world or runtime generation, and creates
  no auth authority. Back (the control, «رجوع» / Back) and Android system Back (a handler registered only while
  Settings is shown) return to the same Personal state; screen-reader focus returns to the entry.
- **Bounded root:** exactly two functional groups — Appearance & Accessibility (the three appearance choices) and
  Support & About (Sign out) — with no placeholder, disabled row or other group name. The final nine-group hierarchy
  is not built: **`E2E-D-02` is advanced, NOT CLOSED.**
- **Visual language:** the P4-C3 page composition (evidence, not authority) with the frozen parts: the World ground,
  the shared `Control` (E1R pressed presence, F1 focus perimeter, 44 pt minimum), E3 roles. The title is set in E3's
  `statement` display role (the precedent the W1B-01 entry titles set): the proof's 20 / 32 `sectionTitle` is weight
  600, a face the app does not ship (§13 residue). Group headings are the E3 metadata role in the tertiary ink.

## 5. Appearance — ONE authority (`E2E-D-10`)

`apps/mobile/src/appearance/` is the one owner:

- `appearance-authority.ts` — state `{ bound, preference: DARK | LIGHT | SYSTEM, effective: DARK | LIGHT }`;
  new-user and signed-out default **DARK**; `SYSTEM` follows the operating system LIVE through the one system source;
  explicit Dark / Light ignore operating-system changes; observable (subscribe / getState for
  `useSyncExternalStore`); `setPreference` refused when nobody is bound; nothing logged.
- `native-appearance.ts` — the ONLY module naming a platform API: React Native `Appearance` (the system source, and
  `setColorScheme('dark' | 'light' | 'unspecified')`) and the Android local module. No Product component names a native
  constant, and nothing in the app calls `useColorScheme()`.
- `AppearanceProvider.tsx` — `AppearanceProvider`, `useAppearance`, `useSurfaceAppearance` (the effective appearance,
  or DARK inside `AnalysisAppearanceScope`), and `AppearanceStatusBar`, the one status-content decision (light content
  on a dark ground, dark on a light one, G3 K18). Every former hard-coded `StatusBar style="light"` on a Product surface
  now uses it.
- The integration runtime builds the ONE authority for the life of the runtime (beside the generations: a preference
  belongs to the reader on this device, not to a Session) and binds it synchronously on every auth change —
  the user id when AUTHENTICATED, nobody otherwise — before any world is composed.
- `usePalette()` (the single seam every surface already paints through) selects the canonical family of the
  surface's appearance, then F1's standard or increased resolution.

**Analysis law (P1 §12.2):** the whole Analysis layer and its status content stand inside `AnalysisAppearanceScope`,
so the Analysis / Living Analysis place is the Dark family under Dark, Light and System — no Light repaint, no pale
veil — and no preference reaches it. The Conversation ↔ Analysis boundary keeps F2's cross-fade, unchanged.

## 6. Persistence

Device-local and account-scoped, per task §11: `appearance-storage.ts` over the existing, officially documented
`expo-sqlite/kv-store`, in its OWN database file `qandeel-appearance.db` (neither the auth store's nor T-13's), under
`qandeel.appearance.v1:<userId>`. Reads are synchronous so a reader who chose Light never sees their world drawn Dark
first. No stored value → Dark; same identity, same device → their choice, across restarts; identity B never reads A's
key; sign-out deletes nothing and A's choice returns at A's next explicit sign-in; a storage failure is the Dark
default (nothing guessed). No server, no database migration, no sync, no dependency added.

## 7. Native appearance seam — the W2-02 carry-forward

Official documentation refreshed before implementation:

- React Native 0.86 `Appearance.setColorScheme`: `'dark'` / `'light'` override the app, `'unspecified'` returns it to
  the device; on Android it calls `AppCompatDelegate.setDefaultNightMode` (MODE_NIGHT_YES / NO / FOLLOW_SYSTEM),
  which is app-local and **not persisted** (read in the installed `AppearanceModule.kt`).
- Android `UiModeManager.setApplicationNightMode` (API 31+) "sets and persists the night mode for this application".
  Its javadoc describes `MODE_NIGHT_AUTO` in terms of location and sensors — so the **service implementation** was
  read instead (AOSP `UiModeManagerService.setApplicationNightMode`): YES → `UI_MODE_NIGHT_YES`, NO →
  `UI_MODE_NIGHT_NO`, and every other accepted mode, AUTO included, → `UI_MODE_NIGHT_UNDEFINED` — no per-app override,
  i.e. the app follows the system. Hence **Dark → YES, Light → NO, System → AUTO**.

Implementation:

- **Android:** a Level-3 local Expo module, `apps/mobile/modules/qandeel-app-appearance` (`platforms: ["android"]`,
  autolinked from `./modules`, verified with `expo-modules-autolinking search`), one function
  `setApplicationNightMode(preference)` with the mapping above, API 31+ only. The authority declares the preference on
  every bind and change; the platform persists it for the next cold launch's system splash. The authority declares
  NOTHING at construction, so while a session is restored the platform keeps the reader's own persisted mode rather
  than flipping a Light reader's window Dark.
- **The W2-02 constant is removed:** the plugin's `withMainApplication` insertion of `MODE_NIGHT_YES` is gone — a
  launch-time constant would now contradict a saved choice. This is a typed-mod removal; the two approved dangerous
  mods are unchanged and **the W2-02 Level-4 exception is not expanded**. `MainActivity` keeps `uiMode` in its
  `configChanges`, so a runtime change is taken in place (verified in the generated manifest).
- **iOS:** the Launch Screen is unchanged and follows the device (W2-02 §7, P4-C3R §1). Carry-forward item 2: the root
  view (`customize(rootView)`, a typed mod) is now `UIColor(named: "QandeelWorld")` — the World asset W2-02 already
  installs — resolved for the view's own appearance, with the Dark World as fallback. After takeover
  `Appearance.setColorScheme` sets the window's interface style, so system-drawn UI follows the reader's choice.
- The W2-02 native verifier now proves: no night mode is declared at launch (planted: the old constant) and
  `MainActivity` handles `uiMode` in place (planted: removed); the iOS root view is the World asset (planted:
  system background; planted: pinned Dark).

## 8. Canonical Light / Dark tokens

`apps/mobile/scripts/generate-conversation-visual.mjs` now resolves all four families (Dark / Light × standard /
increased) through **F2 FINAL's own resolver** (`docs/design/canonical-artifacts/accessibility-appearance/i-08b3.1-f2r/
tools/f2-resolve.mjs`), which defines the contexts. For the three contexts the G3.2 proof resolver composes the same
way (Dark standard, Dark increased, Light standard) the build refuses to emit unless both agree value for value, and
the G3.2 `palette()` still asserts the brief's frozen literals — that is also the proof that the Dark family production
already shipped is unchanged (every pre-existing value, glyph, type role and motion value is identical to `b650b56`).

**Finding:** for Light + Increased Contrast, F2's resolver loads F1's appearance-independent increased file AND F2's
Light file (`MODIFIERS.contrast.increased.light`); the G3.2 proof resolver loads only the Light file, so it would have
omitted F1's two alias moves (the control ink one rung up, tertiary → secondary) and the thicker focus perimeter. The
generator therefore takes Light-increased from F2 — `restInk` `#626059` → `#47443c`, focus 2 → 3 — exactly F1's law in
Light. No hex was hand-picked, no frozen source was edited, and the G1.1 utterance alias is added to F2's resolution as
the alias it is. Light World `#efeeeb`, Light error `#ad4739` (F2 FINAL). E1R's `selectedInk`, `selectedMarker` and
`markerThickness` were added to the generated families; P2's `settings` glyph was added at 22 px.

## 9. Sign out (`E2E-D-07`) and its durability

- One visible control, «تسجيل الخروج» / Sign out, under Support & About. It calls the handed-down
  `MobileAuthAuthority.signOut()` — `ProductRoot` binds `auth.signOut` and nothing else signs out. No confirmation
  (no authority requires one), no "all devices", no session management, no account deletion. A ref refuses a second
  press in the same frame; while in flight the control is `busy` / `disabled` and dimmed (the W1B-01 busy treatment),
  with no words (approved).
- The authority's frozen ordering is kept: the epoch retires before the await (a refresh or late sign-in in flight
  cannot resurrect), and `SIGNED_OUT` — never `sessionEnded` — is published when the port answers, whatever it
  answered. The runtime then retires the world and the ordinary Sign in replaces it; the appearance is unbound → Dark.
- **Durability finding and fix:** the installed auth-js `_signOut` returns WITHOUT removing the stored session when
  loading the session fails first — e.g. an expired access token whose refresh cannot reach the network — and also
  when the call throws. The next launch with the network back would silently restore the identity the reader asked
  to leave. The non-vacuity test proves this with the REAL SDK. Fix (narrow, one file): the port passes the session
  storage key explicitly (exactly the SDK's own default, `sb-<first host label>-auth-token`, so every existing session
  is read as before) and, after the provider's answer, unconditionally removes THIS device's session material (the
  session, `-user`, `-code-verifier`) from the auth store. The provider's answer is still returned.
- **R1 — sign-out scope (independent-review correction):** the final QANDEEL Sign out is current-session /
  current-device only. The port's final sign-out calls the existing seam as `signOutOwn('local')`, i.e.
  `client.auth.signOut({ scope: 'local' })`; before R1 it omitted the scope, which the SDK treats as `global` and which
  would also have revoked the reader's other signed-in devices. Local session material is still retired
  unconditionally afterwards, for restart durability. T-13 Product recovery (identity-namespaced) is not touched by
  sign-out. Proven with the real SDK: its bare default requests `/logout?scope=global` (non-vacuity), the production
  port requests `/logout?scope=local`; the root contract rejects a bare `signOutOwn()`, a direct `client.auth.signOut(`,
  and a `global` or `others` scope in the final sign-out path.
- Proven with the real `@supabase/supabase-js` client over the auth store contract: failed provider sign-out → the
  next app start is `SIGNED_OUT` (not restored, not `sessionEnded`), with no refresh even attempted; a successful
  sign-out leaves nothing; a later explicit sign-in works.

## 10. Exact validation (local, Windows host)

| Gate | Result |
|---|---|
| W3-01 root contract `npm run test:w3-01-general-settings-appearance-signout-contract` | 15 / 15 pass after R1 (14 before); critical predicates reject planted defects |
| `src/appearance/__tests__/appearance-authority.test.ts` | 16 / 16 |
| `src/settings/__tests__/settings-surface.test.tsx` (AR + EN) | 23 / 23 |
| `src/integration/__tests__/w3-settings-appearance-signout.test.tsx` (production phase surface) | 15 / 15 |
| `src/runtime-entry/__tests__/sign-out-durability.test.ts` (real SDK, restart, R1 local scope) | 7 / 7 after R1 (6 before) |
| Full mobile Jest (`jest --ci`) | 147 suites, 1726 / 1726 |
| Mobile root contracts run by mobile CI (T-10…T-14, T-12P, W1A, W1B, W2-01, W2-02, W3-01, foundation, classifier, QAN-INF-04) | all pass (after the narrow re-anchors below) |
| `npm run test:task-closure-governance-contract` | 24 / 24 |
| `npm run typecheck:mobile` | pass |
| ESLint on every changed JS / TS file | 0 errors, 0 warnings — with the import-resolution rules off locally, because `unrs-resolver`'s native binding does not load on this host (it crashes on untouched files too); CI lints on Linux |
| `node apps/mobile/scripts/generate-conversation-visual.mjs --check` | current |
| `npm run prebuild:launch-identity:mobile` (Android; iOS generation is refused on Windows) | PASS; 9 / 9 Android planted defects caught; repository unchanged |
| `npm run prebuild:mobile` (CNG idempotency) | PASS; 40 files; re-application byte-identical |
| `expo-modules-autolinking search` | `qandeel-app-appearance` on Android, absent on Apple |
| Kotlin module compile, iOS generation / build | **not run locally** — left to the normal Release build / boot CI (task §17) |

Re-anchored prior guards (each keeps its permanent claim): W2-02 contract (the night-mode constant, the iOS root-view
literal, its record status — all named W3 boundaries); T-13 contract (a third, named SQLite store — the appearance
preference — with its own database and no auth or recovery vocabulary; a fourth is still refused); W1A-01 contract
(the frozen «الإعدادات» / Settings name and W3-01's named entry identifiers and glyph; any other Settings code in the
Conversation layer is still refused). Two Jest tests read the generated palette under its new key.

## 11. Stable visual proof

Per task §17 and after W2-02: stable React UI proof only — no OS-transition, frame-perfect or movie test and no new
proof harness. The proof states are rendered React trees asserted for geometry, direction, colour (from the generated
canonical families), text and accessibility state. **No raster screenshots were produced.**

| # | State | Where |
|---|---|---|
| 1, 7 | AR / EN Personal with the Settings entry (Dark) | `settings-surface.test.tsx` — Personal Settings entry |
| 2, 3, 8, 9 | AR / EN Settings Dark and Light | `settings-surface.test.tsx` — each preference × OS |
| 4 | appearance selector states | the same, all three selected states, by shape and state |
| 5 | AR Support & About + Sign out | reading-order and sign-out cases |
| 6 | post-sign-out Sign in | `w3-settings-appearance-signout.test.tsx` — D-07 |
| 10, 11 | System + OS Light / Dark | `settings-surface.test.tsx`; live-follow in both suites |
| 12 | Conversation Light | `w3-settings-appearance-signout.test.tsx` — Light repaint |
| 13, 14 | Analysis still Dark under Light; return restores Light | `w3-settings-appearance-signout.test.tsx` |
| 15, 16 | 320 width, 2× text | structural: every text wraps and scales (no cap, no line limit), rows have no fixed width, the body scrolls |
| 17 | increased contrast / focus | both suites: F1 increased rest ink in Dark AND Light, 3 px focus perimeter |

## 12. Residue

1. **E3 weight 600 is not shipped.** The P4-C3 page title (`sectionTitle`, 600) and E1R's selected word weight (600)
   need a SemiBold face the app does not carry; W3-01 synthesizes no weight: the title uses E3 `statement` (500), and
   the selected appearance is told by E1R's marker shape and the accessibility state. Vendoring the official Estedad
   v8.5 SemiBold static is a separate, bounded font change.
2. **Sign-out latency when offline with an expired access token.** The SDK retries the refresh with exponential
   backoff for up to ~30 s before its sign-out answers; the control is busy for that time, then the world retires and
   the device stays signed out. Retiring before the provider answers would reopen the frozen sign-out / sign-in race
   and was not done (no auth redesign).
3. **iOS native proof.** Kotlin, the iOS root-view Swift and the iOS generated project were not compiled locally
   (Windows host); the normal Release build / boot CI is the validation.
4. **`QAN-BL-SEC-01`** (credential backup / hardware security) is untouched and still `DEFERRED — OWNED`: W3-01 changes
   no storage mechanism or backup policy; it strengthens the "sign-out removal" that item requires be preserved.

No new cross-task backlog item is admitted: W3-01 is not closing (BG-08 runs at its closure), and residue 1–3 are
W3-01's own until then.

## 13. Lifecycle truth

W3-01 is implemented on a **Draft PR and is NOT MERGED**. `E2E-D-01`, `E2E-D-10` and `E2E-D-07` are implemented and
proven as above and are ready to close only once this PR merges green; `E2E-D-02` is advanced, NOT CLOSED. W2 is
complete only when W3-01 merges with D-07 proven; W3 is not closed. This change narrowly reconciles W2-02's stale
lifecycle text to its merge through PR #286 at `b650b56f7436ce63d33c0af34036a963a03f5eee` (the W2-02 record's status
line, the Current State and Project Map locators, and the E2E-01 read-first rows) and does not rewrite the historical
census or wave baselines.
