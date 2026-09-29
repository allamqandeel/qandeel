# QANDEEL — W2-02 Production Launch Identity — Implementation Record v1

**Task:** W2-02 — Production Launch Identity: Final App Icon + Native Static Launch / System Handoff (E2E-01 wave W2,
second bounded implementation slice)
**Rows:** `E2E-A-01` (static launch → system handoff), `E2E-A-02` (final QANDEEL app icon on the device)
**Baseline:** `df194edf6d70a2a300a0251ed114e7ad8715485e` (merge of PR #285, W2-01; final W2-01 head `7f7d492`)
**Branch:** `feat/w2-02-production-launch-identity`
**Status:** IMPLEMENTED ON A DRAFT PR — NOT MERGED. One bounded, Product-Owner-authorized Production Integration
slice; it opens no other wave or Product area and closes no phase.

---

## 1. Starting baseline

Before any edit: the working tree was clean; `git fetch origin` moved `origin/main` to exactly
`df194edf6d70a2a300a0251ed114e7ad8715485e`, the expected SHA; PR #285 is `MERGED` (2026-09-29T06:59:22Z) with that merge
commit; local `main` was fast-forwarded from `6b333df` and the branch created from it. Node `v24.19.0`, npm `11.17.0`
(engines: Node `>=22.13.0`, npm `>=10`; CI runs Node 22). Expo `57.0.21`, React Native `0.86.3`,
`@expo/prebuild-config` `57.0.15`. `apps/mobile/android` and `apps/mobile/ios` are generated, ignored and untracked
(`git ls-files` returns nothing for either), and `npm run prebuild:mobile` is the CNG idempotency gate.

## 2. Branch

`feat/w2-02-production-launch-identity`, from the baseline above. Draft PR only.

## 3. Skills / G1

Census of the installed Skills against this task: `react-native-best-practices` and `upgrading-react-native` (React
Native runtime / upgrade guidance — W2-02 writes no React Native runtime code), `github-actions` (CI build pipelines —
the repository already has pinned, reviewed Android / iOS build and emulator patterns, which the W2-02 proof mirrors),
`animate`, `animate-expo`, `emil-design-eng`, `impeccable`, `frontend-design` (motion / UI design — excluded outright:
W2-02 draws nothing and the Lantern boundary forbids motion work). None is materially relevant to installing approved
native resources through a config plugin.

**No applicable Skill was used.**

## 4. Official platform / Expo research (refreshed 2026-09-29, first-party only)

Sources, by owner:

- **Expo** — `docs.expo.dev/versions/v57.0.0/config/app/`; `/develop/user-interface/splash-screen-and-app-icon/`;
  `/versions/v57.0.0/sdk/splash-screen/`; `/versions/v57.0.0/sdk/system-ui/`; `/workflow/continuous-native-generation/`;
  `/workflow/prebuild/`; `/config-plugins/introduction/`, `/plugins/`, `/mods/`, `/dangerous-mods/`,
  `/development-and-debugging/`.
- **Apple** — HIG *Launching* and *App icons* (read through `developer.apple.com/tutorials/data/…json`, because the HIG
  renders client-side); `UILaunchScreen` / `UIColorName`; Xcode *Specifying your app's launch screen* and *Configuring
  your app icon*.
- **Android** — `developer.android.com/develop/ui/views/launch/splash-screen` and `/splash-screen/migrate`;
  `/develop/ui/views/launch/icon_design_adaptive`; `UiModeManager` reference; `/develop/ui/views/theming/darktheme`;
  `/guide/topics/resources/providing-resources`.
- **The installed SDK itself**, because the docs leave the decisive details unstated: `@expo/prebuild-config` 57.0.15
  (`withAndroidIcons`, `withIosIcons`, `withIosUserInterfaceStyle`, the `expo-system-ui` fallback), `expo-system-ui`
  57.0.4 and `expo-splash-screen` 57.0.8 (read from their npm tarballs, not installed), React Native 0.86.3
  (`RCTRootViewFactory`, `RCTDefaultReactNativeFactoryDelegate`), Expo's `ExpoReactNativeFactoryDelegate`, and the
  SDK 57 bare template `expo-template-bare-minimum` 57.0.27.

Conclusions that decided the implementation:

1. **App icons through Expo config would not be canonical.** The docs say only that sizes are "generated". The installed
   source shows how: every Android layer is re-encoded to WebP from one source image at each density, the monochrome
   layer can only be a raster, and the legacy round icon is Expo's own circle crop. On iOS a single 1024 image is
   re-encoded and flattened onto `#ffffff`, and a white square is written when no icon is set.
2. **`userInterfaceStyle` defaults to `light`** (docs, and `withIosUserInterfaceStyle`), which writes
   `UIUserInterfaceStyle = Light` into Info.plist and would pin the iOS Launch Screen to Light on every device.
   `ios.userInterfaceStyle: "automatic"` is the documented high-level setting that lets it follow the device.
3. **Apple:** the Launch Screen should match the first screen and the device's appearance, carry no text, and "isn't a
   branding opportunity". An asset-catalog colour resolves per appearance.
4. **Android 12+:** the system always shows a splash on cold and warm start, built from `windowBackground` (or
   `windowSplashScreenBackground`) and, by default, the launcher icon; a custom splash activity produces duplicate
   splashes; keep-on-screen conditions are for real readiness, not branding.
5. **`UiModeManager.setApplicationNightMode` (API 31+)** "sets and persists" the app's night mode until the app changes
   it, its data is cleared or it is uninstalled, and the dark-theme guide names it as the way the system matches the
   app theme during the splash. It needs no permission. `AppCompatDelegate.setDefaultNightMode` is app-local and does
   not persist.
6. **`expo-splash-screen` is not added.** Its SDK 57 plugin always sets `windowSplashScreenAnimatedIcon` to its own
   `splashscreen_logo`, which would replace the canonical adaptive icon on the Android 12+ splash, and it installs
   `androidx.core:core-splashscreen` with a keep-on-screen manager. Expo documents that Expo Go and development builds
   do not show the real Android splash; only Release builds are evidence, which is what §14 uses.
7. **`expo-system-ui` is not added.** It would supply the iOS root-view background, but on Android it forces
   `AppCompatDelegate` night mode from a string that defaults to `light`. React Native sets the root view to
   `systemBackgroundColor` (white on a Light device) and then calls the factory delegate's `customize(rootView)`, which
   is where W2-02 paints the World instead.
8. **CNG:** native directories are generated from config; customization belongs in config plugins; the Expo guide
   reserves generating, moving and deleting files for dangerous mods and warns they must be written to re-apply cleanly.

## 5. Canonical Brand sources and hashes consumed

Authority: I-08B2.5, ratified as the final Brand Authority by P4-C2 §1 (Android framing 48 dp; no iOS dark / tinted icon
in v1). The canonical app-icon source
`docs/design/canonical-artifacts/brand/i-08b2.5/app-icon/APP_ICON_B_DARK_LUMINOUS.svg` hashes to the frozen
`859665D86A7BBF4248FF479034031A8DF1F08833C7DB36336B3D29832BCDDD09`. It is not edited and not consumed directly.

The 33 consumed platform exports — `android/res/**` (15 PNGs, the two adaptive XMLs, the monochrome VectorDrawable, the
`#0A0B0D` background colour) and `ios/AppIcon.appiconset/**` (13 PNGs + `Contents.json`) — are vendored byte-for-byte to
`apps/mobile/assets/brand/i-08b2.5/app-icon/`. `apps/mobile/assets/brand/i-08b2.5/VENDORED_FROM_CANONICAL.json` records
each file's canonical path, vendored path, size and SHA-256; the W2-02 contract re-proves all 33 against both copies on
every run. `PLAY_STORE_ICON_512.png` and `android/source/ANDROID_FOREGROUND.svg` are store / source assets and are not
consumed. The copy is `-text` in `.gitattributes`, so no checkout converts line endings.

**Why a vendored copy:** the native build-input fingerprint excludes `docs/` (`classifyBuildInput` → `EXCLUDED_PREFIX:docs/`),
so a build that read the canonical tree directly could reuse a cached binary after the icon changed. The vendored
copy under `apps/mobile/` is a build input and native-impact. No file was re-rendered, resized, re-encoded or re-framed,
and no derivative exists: the deterministic-derivative clause of task §6.4 was not needed.

The launch World values are the frozen ones: Dark `#101010` (A3R2, carried into B4R and the W1A generated palette) and
Light `#efeeeb` (F2 FINAL_CANONICAL, artifact index). `#0A0B0D` is used only as the icon's own ground.

## 6. CNG implementation strategy and why

Option A (plain Expo config) was tried against the installed SDK and cannot preserve the frozen output (§4.1). W2-02
therefore uses Option B: one config plugin, `apps/mobile/plugins/with-qandeel-launch-identity.js`, registered after
`expo-router` in `app.json`. It does exactly this:

| Mod | Kind | Effect |
|---|---|---|
| Android install | `withDangerousMod` | deletes the template `mipmap-*/ic_launcher*.webp`, `drawable-*/splashscreen_logo.png` and `drawable/ic_launcher_background.xml`; copies the 19 vendored Android resources |
| `withAndroidColors` / `withAndroidColorsNight` | typed | `qandeel_world` = `#efeeeb` / `#101010` (`values-night`); removes the template `splashscreen_background` |
| `withAndroidStyles` | typed | `AppTheme` and `Theme.App.SplashScreen` `android:windowBackground` = `@color/qandeel_world`; `android:windowSplashScreenBackground` = `@color/qandeel_world` (`tools:targetApi="31"`) |
| `withMainApplication` | typed | after `super.onCreate()`, API 31+: `setApplicationNightMode(MODE_NIGHT_YES)` (§8) |
| iOS install | `withDangerousMod` | replaces `AppIcon.appiconset` with the 14 vendored files; writes `QandeelWorld.colorset` (any `#efeeeb`, dark `#101010`); deletes the template `SplashScreen.storyboard` (R2) |
| `withInfoPlist` | typed | R2: `UILaunchScreen` = `{ UIColorName: QandeelWorld }`; removes `UILaunchStoryboardName` (§7) |
| `withXcodeProject` | typed | R2: removes the template storyboard's file reference, build file, group entry and Resources-phase entry |
| `withAppDelegate` | typed | overrides `customize(_ rootView:)` to paint the root view `#101010` (§7) |

`app.json` also sets `name: "QANDEEL"` (§10) and `ios.userInterfaceStyle: "automatic"` (§4.2). No `icon`, `splash`,
`adaptiveIcon` or `backgroundColor` key is set, so Expo's own icon generation stays off. No dependency was added.

**CNG hierarchy (apps/mobile/README.md).** The T-01 policy makes dangerous mods Level 4: not pre-authorized, needing a
separate Engineering Architecture review. The Product Owner's task contract authorizes Option B, and Expo's own guide
puts file installs in dangerous mods. W2-02 therefore confines the two dangerous mods to copying vendored bytes,
deleting named template files and writing the World colour asset (R2 removed the storyboard write), and narrows the mobile-foundation contract so this one
file, and no other, may use a dangerous mod.

**Architecture disposition (W2-02 R1): APPROVED — bounded W2-02 Level-4 exception.** The independent Engineering
Architecture review approved it for exactly: `apps/mobile/plugins/with-qandeel-launch-identity.js`; its two current
`withDangerousMod` file-install steps; and the canonical icon / launch resource installation W2-02 requires. It does not
authorize any future expansion; another dangerous mod or a wider use needs a new review. The README policy records the
same bounded approval, and the general CNG hierarchy is unchanged. The Kotlin / Swift insertions are
typed mods with begin / end markers that replace themselves on re-application and fail the build if their anchor
moves.

Invariants kept: `android/` and `ios/` stay generated and untracked; `npm run prebuild:mobile` stays byte-identical on
re-application and reproducible across clean generations; the canonical package is untouched.

## 7. iOS launch behaviour

- **Launch Screen (final mechanism, R2):** Apple's Info.plist launch screen, `UILaunchScreen` = `{ UIColorName:
  QandeelWorld }`, and nothing else: no `UIImageName`, no bars, no storyboard, and no `UILaunchStoryboardName`.
  `UILaunchScreen` needs iOS 14; this app's minimum is iOS 16.4. `UIColorName` names an asset-catalog colour, resolved
  as `UIColor(named:)` resolves it, so the system shows the `QandeelWorld` colorset for the device appearance
  (`UIUserInterfaceStyle` = `Automatic`): Light `#efeeeb`, Dark `#101010`. There is no image, label, Q, wordmark, text
  or Lantern, and it does not reproduce the in-app preference (P4-C3R §1).
  - Why R2 moved off the storyboard: the storyboard route compiled correctly, yet rendered black on the iOS 26.5
    simulator (see §14). Apple states no precedence between `UILaunchScreen` and `UILaunchStoryboardName`, so the
    storyboard key is removed rather than left beside it. The template storyboard also leaves the project.
- **First app-owned pixels:** React Native's root view is painted `#101010` in `customize(rootView)`, before the first
  frame. It never shows `systemBackgroundColor` (white on a Light device, `#000` on Dark). `#101010` is the only
  appearance production renders. On a Light device the reader therefore sees the Light launch, then the Dark app, once,
  at the takeover. P4-C3R §1 accepts exactly that transition.
- No timer, no minimum duration, no custom animation, no onboarding. The existing Product root is the first destination.
- `UIUserInterfaceStyle` = `Automatic` has one app-wide consequence beyond the Launch Screen: system-drawn UI (the
  keyboard, alerts) now follows the device appearance instead of being forced Light. It changes no QANDEEL surface,
  which paints its own colours.

## 8. Android launch behaviour

- **System splash (Android 12+):** the launcher icon, which is the canonical I-08B2.5 adaptive icon, on one opaque
  `@color/qandeel_world` ground (`windowSplashScreenBackground`). There is no animated icon, branding image, exit
  animation or keep-on-screen condition, no splash library, and still exactly one activity. Below API 31 the starting
  window is the World only.
- **First app-owned frame:** `AppTheme` `windowBackground` is the same `@color/qandeel_world`, so when the system removes
  the splash the ground stays and only the icon goes. The Product root then draws on `#101010`.
- **Appearance:** DayNight resources hold both Worlds. In `MainApplication.onCreate` the app sets the application night
  mode to the **effective QANDEEL appearance**. Production has no appearance preference yet, and P1 §12's new-user
  default and the only appearance production renders are both Dark, so the constant is `MODE_NIGHT_YES`. The platform
  persists the value, so from the next cold start the system splash is the Dark World even on a Light device (P4-C3R
  §1).
- **Platform limitation, recorded:** the very first cold start after install, and every start below API 31, happens
  before the app can declare its mode. The splash then follows the system appearance. On a Light device that one launch
  shows the Light World splash, then the Dark app.

## 9. Icon integration by platform

- **iOS:** the canonical 13-size classic asset catalogue (iPhone, iPad, 1024 marketing) is installed unchanged: square,
  no alpha (PNG colour type 2), no baked corners. There is no dark or tinted variant, and `Contents.json` carries no
  `appearances`. On iOS 18+ the system may derive its own dark / tinted renderings of an icon that supplies none (Apple
  HIG). That is platform behaviour, not a QANDEEL variant.
- **Android:** `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` are the canonical adaptive icon:
  `@color/ic_launcher_background` (`#0A0B0D`), the per-density opaque foreground rasters at the ratified 48 dp framing
  (108 dp canvas: 108–432 px), and the monochrome VectorDrawable carrying the approved path data verbatim (the Android
  13+ themed icon). The legacy square / round PNGs (48–192 px) are the canonical ones, and the manifest keeps
  `@mipmap/ic_launcher` / `@mipmap/ic_launcher_round`.

## 10. Product-name casing

`expo.name` controls both launcher labels (Android `app_name`, iOS `CFBundleDisplayName`, verified by Expo's
introspection and by the native gate), so it moves from the provisional `Qandeel` to the frozen `QANDEEL` (P4-C2 §5).
The generated project and scheme are now `QANDEEL`. Mobile CI discovers both by glob and is unaffected. The slug,
scheme, bundle id and package stay unchanged. No Arabic app name or logo treatment was invented.

## 11. Lantern non-scope

`QAN-BL-LANTERN-01` is untouched and remains `DEFERRED — OWNED`. W2-02 adds no Lantern asset, component, route,
animation, timing, Q reveal, placeholder or motion technology, and chooses nothing for that task. The launch ends at
the Product root, exactly where it did before. The contract pins the complete set of mobile files that may mention the
Lantern: the four pre-existing comments, plus this plugin's non-scope sentence.

## 12. Appearance dependency — W3 carry-forward

What W2-02 closes: both Light and Dark launch resources exist on both platforms; iOS follows the device; the Android
splash is driven by the platform application night mode through the app's own DayNight resources; there is no
Expo / white flash; and the effective appearance is declared as the constant it is today.

**W3 integration carry-forward** (owned by W3, *General Settings, identity, appearance and Understanding*, which carries
the Dark / Light / System journey):

1. Replace the `MODE_NIGHT_YES` constant in the W2-02 seam (`MainApplication`, between the
   `@qandeel-w2-02 application-night-mode` markers) with the user's preference: Dark → `MODE_NIGHT_YES`, Light →
   `MODE_NIGHT_NO`, System → `MODE_NIGHT_AUTO`. Set it again whenever the preference changes, which needs a small native
   bridge. The platform persists it, so no W3 storage is needed for the splash itself.
2. Make the iOS root view (`customize(rootView)`, between the `@qandeel-w2-02 root-view-world` markers) follow the
   effective appearance once non-Analysis surfaces can be Light. Until then `#101010` is correct.
3. The iOS Launch Screen needs nothing: it follows the device by frozen decision.

No preference, store, setting or appearance-reading code was created here. This is not a backlog admission: W2-02 is
not closing (BG-08 runs at closure), and the work already has a named owner, the W3 wave (BG-06).

## 13. Exact validation

Local (Windows host). Every check below ran and passed unless it says otherwise:

| Gate | Result |
|---|---|
| `node --test tests/w2-02-production-launch-identity-contract.test.mjs` | 17 / 17 pass; every predicate rejects a planted defect |
| `npm run prebuild:launch-identity:mobile` (Android; iOS generation is refused on Windows) | PASS; 8 / 8 Android planted defects caught; repository state unchanged |
| iOS checks on a synthetic tree (the real SDK 57 template, the plugin's own iOS install and AppDelegate mods, Info.plist keys as Expo writes them) | `checkIos` PASS; 6 / 6 iOS planted defects caught (scratch harness, not committed) |
| `npm run prebuild:mobile` (CNG Level 2) | PASS; 40 files; re-application byte-identical; clean generations identical |
| `expo config --type introspect` | `name` QANDEEL; iOS `UIUserInterfaceStyle` Automatic, `CFBundleDisplayName` QANDEEL, `UILaunchScreen` `{ UIColorName: QandeelWorld }` and no `UILaunchStoryboardName` (R2); no `icon` / `splash` |
| `npm run doctor:mobile` (`EXPO_OFFLINE=1`, directory check off, as in CI) | 20 / 20 checks passed |
| `npm run typecheck:mobile` | pass |
| ESLint on the changed JS | pass with every non-resolver rule on; `npm run lint:mobile` cannot run here because Smart App Control blocks the resolver's native binding, so the full lint is CI-authoritative |
| Contracts whose inputs changed: mobile-foundation-toolchain, T-04, T-06, T-07, native-impact classifier, QAN-INF-03, QAN-INF-04, T-12P, T-12 | all pass |
| Frame analyzer on synthetic recordings | 2 good sequences PASS; planted white flash, missing Android splash icon and a Q on the iOS Launch Screen each FAIL |
| `git diff --check` | clean |

No Jest suite ran: no Product or runtime source under `apps/mobile/src` changed, and CI runs the whole mobile Jest
suite anyway. No dependency changed, so `expo install --check` was not needed. The API is untouched.

GitHub CI on the Draft PR: see §14 and the PR.

## 14. Visual / native evidence

`.github/workflows/w2-02-native-launch-proof.yml` (branch-scoped) builds the **Product** Release binaries exactly as
Mobile CI does, installs them and captures real cold launches. No production delay was added for it.
`scripts/w2/analyze-w2-02-launch-recording.mjs` classifies every frame as splash / world / content / product / white /
black / other. `splash` means one compact, centred mark on a World-like ground, which is the icon. Centred text on a
World-like ground (for example the unconfigured build's `CONFIG_REFUSED` screen) is `content`, never `splash`.

**Proof semantics (R3; the boundary from R1 and R2, which changed no Product file).** W2-02 owns only the OS launch
surface. Each captured launch gets one of three verdicts:

- **PASS:** the launch surface was observed and it is correct.
- **FAIL:** a launch defect was **observed**. Only this verdict gates.
- **CAPTURE_MISSED:** the transient OS surface was not sampled, and nothing observed is a defect. It is reported and
  kept as evidence, and it is non-gating. A missing frame is never taken as proof of a defect.

The deterministic evidence stays gating and authoritative: the generated native configuration and resources, the
canonical asset hashes, APK / app-bundle inspection, the Release builds, the native verifier, CNG integrity, and the
boot smokes. The launch window opens at the first full-screen launch frame, so a white or black flash falls inside
it.

- **Android:**
  - When the system splash was captured, it is judged strictly. It must sit on the expected World. There must be no
    white or black flash before it or at its exit (the Expo-default flash), and no second icon splash anywhere after
    it.
  - Nothing else after the splash is judged, and no empty World frame is required.
  - When the splash was not captured, only what was observed before the first app-owned frame can fail (an observed
    white / black flash or a wrong World). Otherwise the verdict is CAPTURE_MISSED.
- **iOS:**
  - The launch-colour gate closes as soon as a stable launch surface of the expected World is observed (6 frames,
    200 ms): Light `#efeeeb` or Dark `#101010`.
  - Apple's handoff / crossfade after it (interpolated greys, then the Dark app root) is not judged.
  - Before it, any observed black, white, mark (Q / logo / image), text or wrong World fails.

What the app shows after the launch (Sign in, `CONFIG_REFUSED`, anything else) is the boot smokes' to prove. The W2-02
contract pins these semantics with planted sequences for every case.

- **Android (API 36 emulator):**
  - APK badging and resources; all 15 icon rasters compared by decoded pixels with the vendored canonical bytes; the
    installed-launcher screenshot.
  - Cold launches A (system Light, first launch), B (system Light, after the night-mode seam) and C (system Dark).
  - **Capture:** one `screenrecord`, pre-armed 2 s before `am start`, with a 12 s limit.
    - R2's on-device `screencap` burst reached only 1–3 frames per launch on API 36 CI (head `9d7c86d`), so R3 removed
      it as complexity without value.
    - A splash the recording misses is CAPTURE_MISSED, not a failure.
- **iOS (iPhone 17 / iOS 26.5 simulator):** the compiled Info.plist (R2: `UILaunchScreen` / `UIColorName`, no storyboard
  compiled) and the `Assets.car` catalogue; SpringBoard screenshots in Light and Dark; per appearance, a first cold
  launch (diagnostic) and a repeat cold launch (gating), D1 / D2 (device Light) and E1 / E2 (device Dark).

**First-run evidence (head `6bdf288`, run 36538191115), read under the R1 boundary:**

- **Android:**
  - The APK label is `QANDEEL`, and 15 / 15 icon rasters are pixel-identical to I-08B2.5.
  - No template icon or splash logo is in the APK, and the installed icon is on the home screen.
  - Launch A (first launch, system Light) is the system splash on the Light World, then a stable Dark World handoff.
    This is the documented first-launch limitation, with the seam taking effect.
  - Launches B (system Light, relaunch) and C (system Dark) are the system splash with the canonical icon on the
    Dark World, then a stable Dark World handoff. B proves the application night mode persists across launches.
- **iOS:**
  - The bundle checks pass: `CFBundleDisplayName` QANDEEL, `UIUserInterfaceStyle` Automatic, the launch storyboard,
    `QandeelWorld` in `Assets.car`, and no template splash asset. The installed QANDEEL icon appears on SpringBoard.
  - **Open finding:** in both appearances the launch surface recorded **black** (`#000000`), ~0.7 s on the device-Light
    run and ~1 s on the device-Dark run, then a stable Dark World root view. The Light World never appeared.
  - Either the World-only storyboard's named colour did not resolve (an implementation defect), or the simulator had
    no Launch Screen snapshot yet for that first launch (infrastructure). The run cannot tell the two apart.
  - R1 does not authorize a change to the iOS launch design. The R1 proof therefore adds a repeat launch per
    appearance, which gates. If the repeat is still black, it is a W2-02 iOS Launch Screen defect for the Product
    Owner, not a proof artifact.

**R1 evidence (head `3af1ae5`, run 36542496920) and the R2 diagnosis:**

- **iOS:** both **repeat** launches, D2 (Light) and E2 (Dark), were still black before the Dark World root view.
  First-run snapshot timing is therefore excluded: the Launch Screen itself rendered black.
- **Inspection of the CI-built app** (`qandeel-ios-simulator.app` from Mobile CI run 36542499592):
  - Info.plist declared `UILaunchStoryboardName` = `SplashScreen` and `UIUserInterfaceStyle` = `Automatic`.
  - `Assets.car` holds `QandeelWorld` with `UIAppearanceAny` and `UIAppearanceDark` renditions.
  - The compiled `SplashScreen.storyboardc` nib references the dynamic catalog colour `QandeelWorld`, with the Light
    fallback `0.937 / 0.933 / 0.922` embedded.
- **Conclusion:** every input compiled correctly. A failed colour lookup would have produced the Light fallback, not
  black, so the defect lies in how the iOS 26.5 simulator renders the storyboard-based launch snapshot.
  - The artifacts cannot narrow it further.
  - R2 therefore removes that path: `UILaunchScreen` / `UIColorName`, Apple's colour-only launch definition (§7).
- **Android (R1 run):**
  - `screenrecord` captured no splash in A and C; B captured the splash but ended before its exit. That is a capture
    defect, not a Product one: the same app's splash was captured correctly on `6bdf288`.
  - Re-read under the R2 boundary, `6bdf288` A / B / C pass: splash (Light on first launch, Dark after the seam and on
    a Dark system), then the app.

**R2 evidence (head `9d7c86d`, run 36548903170): the black launch is resolved by R2.**

- **Mobile CI on `9d7c86d`:** all green, including the Android and iOS Release builds and both boot smokes.
- **iOS bundle:**
  - `UILaunchScreen:UIColorName` = `QandeelWorld`.
  - No `UILaunchStoryboardName`, and no storyboard compiled.
  - `UILaunchScreen` declares the colour only, and `QandeelWorld` is in `Assets.car`.
- **iOS launches:**
  - Device Light (first and repeat) shows the Light World launch surface (`#efeeeb`: 18 / 41 frames) with no black frame.
  - Device Dark (first and repeat) shows the Dark World.
  - The job was red only because the pre-R3 analyzer demanded a stable Dark app segment after the launch and read
    Apple's crossfade greys as launch content.
  - Read under R3, D1 / D2 / E1 / E2 all PASS. The pre-R2 storyboard recordings (`3af1ae5` D2 / E2) still FAIL on the
    observed black, so the analyzer still sees the real defect.
- **Android:** the deterministic checks passed: label `QANDEEL`, 15 / 15 icon rasters, no template icon or splash
  logo. Of the three bursts, B captured the splash on the Dark World (PASS). A and C sampled no splash and observed no
  defect, which under R3 is CAPTURE_MISSED.
- **Re-read under R3:**
  - `6bdf288` A / B / C: PASS.
  - `3af1ae5`: A and C CAPTURE_MISSED; B PASS.

R3 changed proof semantics only, in these files: the analyzer, the two proof drivers, the contract and this record.
No Product, Brand or native-configuration file changed. An Android CAPTURE_MISSED does not contradict the
deterministic native proof. It records that CI sampling missed a transient, OS-owned surface.

**Capture limitation:** a recording is H.264, so colours are matched within a tolerance (±9 per channel), and every
measured ground is reported. A simulator or emulator is not a device: OEM launchers, icon masks and themed-icon tinting
on real hardware remain Release Hardening device checks.

## 15. Residue

- **Level-4 CNG exception:** APPROVED — bounded W2-02 Level-4 exception (R1; §6). Any expansion needs a new review.
- **W3 carry-forward** (§12).
- **iOS black launch surface** (§14): **resolved by R2.** The storyboard path was replaced by `UILaunchScreen` /
  `UIColorName`, and the R2 run shows the Light and Dark World launch surfaces with no black frame.
- **Transient Android splash capture** may be CAPTURE_MISSED on CI (§14, R3). This is non-gating, and the
  deterministic native proof and boot smoke remain the authority.
- **Device validation** of the icon and launch on physical iOS / Android hardware and OEM launchers: Release Hardening.
- **Not implemented, by scope:** the Lantern (`QAN-BL-LANTERN-01`), Sign out (`E2E-D-07`), the appearance preference and
  General Settings (W3), store signing and upload.
- **Unchanged pre-existing locator text:** the Current State visual-system row still says no commit after T-14 changes
  `apps/mobile/`. W1A-01 onward already made that stale, and task §13 forbids a broad cleanup, so it is reported here
  rather than rewritten.

## 16. Lifecycle truth

W2-02 is implemented on a **Draft PR and is not merged**. W2 is not fully closed, the Lantern is not implemented, Sign
out is not implemented, and no W3 appearance preference exists. This record changes no P4 or I-08B2.5 byte. It also
reconciles W2-01's stale Draft lifecycle to its merge through PR #285: the W2-01 record's status line, the Current
State and Project Map locators, and the E2E-01 read-first §6 rows.
