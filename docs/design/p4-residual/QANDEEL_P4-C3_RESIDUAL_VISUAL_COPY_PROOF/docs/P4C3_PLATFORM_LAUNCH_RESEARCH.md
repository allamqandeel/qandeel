# P4-C3 — Platform launch research (evidence, not authority)

**Checked:** 2026-09-27, first-party sources only. Platform guidance is **evidence** for this proof. QANDEEL's Product
authority stays with its own canonical records (P4-C2 §2 for the launch sequencing and the lantern boundary).

**Scope boundary.** This research covers the platform launch surfaces and the handoff to the first app-owned frame. It
performs **no lantern research** — no animation technique, storyboard, timing, Q-reveal or technology — because all of
that belongs to the standalone later task **QANDEEL — Lantern Gateway Identity Moment v1** (P4-C2 §2).

Apple's HIG pages render client-side, so they were read through Apple's own JSON data endpoints for the same pages
(`developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`).

## 1. Sources

| # | Source | URL |
|---|---|---|
| S1 | Apple HIG — Launching (launch screens) | https://developer.apple.com/design/human-interface-guidelines/launching |
| S2 | Apple HIG — Branding | https://developer.apple.com/design/human-interface-guidelines/branding |
| S3 | Apple HIG — Accessibility (targets, Reduce Motion, contrast, colour) | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| S4 | Apple HIG — Motion | https://developer.apple.com/design/human-interface-guidelines/motion |
| S5 | Android Developers — Splash screens (SplashScreen API, Android 12+) | https://developer.android.com/develop/ui/views/launch/splash-screen |
| S6 | Android Developers — Implement dark theme (splash theme under an app night mode) | https://developer.android.com/develop/ui/views/theming/darktheme |
| S7 | Android Developers — Make apps more accessible (touch targets, labels, contrast) | https://developer.android.com/guide/topics/ui/accessibility/apps |

## 2. What each source establishes (paraphrased)

**iOS launch screen (S1, S2) — verified, not assumed.**
- The launch screen should be nearly identical to the app's first screen, match the device's current orientation and
  appearance, and, when the app first shows a solid colour, show only that solid colour.
- It should carry no text, because launch-screen text is not localised, and no logo or branding unless it is a fixed part of
  the first screen.
- Its only job is to make launch feel fast; it is not onboarding, not a splash screen and not artistic expression. Apple
  says in S2 that the launch screen is "not a branding opportunity", and points branding to a welcome or onboarding screen
  at the start of the experience instead.

**Android 12+ SplashScreen (S5, S6) — verified.**
- The system always shows a splash on cold and warm starts, built from the app icon and a single window background colour
  with no transparency.
- Icon geometry: with an icon background, the icon is 240 × 240 dp and must fit a 160 dp circle; without one, 288 × 288 dp
  inside a 192 dp circle. An animated icon (AnimatedVectorDrawable) is optional, and a custom exit animation is optional.
- Apps with an older custom splash activity are told to migrate to the SplashScreen API, not to keep a second splash.
- Keeping the splash on screen is tied to real readiness. A keep-on-screen condition exists; it is not a branding timer.
- On API 31+, `UiModeManager.setApplicationNightMode` lets the system match the splash to the app's own theme (S6).

**Reduced Motion and accessibility (S3, S4, S7).**
- Motion must be optional, and must never be the only way information is carried. Under Reduce Motion, replace travel
  with fades, tighten springs and avoid depth and blur animation.
- Targets: 44 × 44 pt by default on iOS; 48 × 48 dp on Android.
- Contrast: 4.5:1 for normal text and 3:1 for large text. Never convey state by colour alone.
- Icon-only controls need a content description that says the purpose, not the drawing.

## 3. How P4-C3 applies it

| Rule | P4-C3 application | Check |
|---|---|---|
| iOS launch = first screen, solid colour, no text or logo | the iOS launch surface is the World fill in the current appearance and nothing else | C-L1 |
| iOS launch "nearly identical" to the first app frame | the first app-owned frame is the same ground; the two captures are byte-identical in Dark and Light | C-L2 |
| Launch is not a branding moment | no Q, no wordmark, no lantern on the launch surface; the identity moment starts after the boundary, in its own task | C-L1, C-L6 |
| Android: icon + one opaque colour | the I-08B2.5 adaptive foreground (vendored bytes, 48 dp framing) masked to 160 dp inside the 240 dp icon box, on the World colour | C-L3 |
| Android: no second custom splash | the first app-owned frame keeps the splash colour, drops the icon and adds nothing | C-L4 |
| No fake delay | nothing declares a minimum duration or a hold; the launch path has no timer | C-L5 |
| Reduced Motion parity | the launch proof is static in both modes; no motion exists to remove | C-A7 (app surfaces) |

## 4. What the research exposes

1. **Appearance preference vs a static launch surface — RESOLVED BY PRODUCT OWNER (P4-C3R; formerly question Q-1).**
   P1 §12 gives the reader a Dark / Light / System preference inside QANDEEL, with Dark as the default. The iOS launch
   screen can follow only the **system** appearance (S1); Android can follow the app's own choice on API 31+ (S6). The
   Product Owner approved the platform split
   ([P4-C3R approval record](../../../../canonical-authority/final-product-experience/p4/QANDEEL_P4C3_RESIDUAL_VISUAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md) §1):
   - **iOS:** the system launch screen follows the device / system appearance and does not reproduce the in-app
     preference. A reader with QANDEEL Dark on a Light phone sees the system-Light launch, then the app's Dark once
     app-owned UI takes over; that transition is accepted.
   - **Android:** where supported, the system splash follows the effective QANDEEL app appearance through the platform's
     application night-mode mechanism.
   - Dark is not forced universally, and there is no duplicate custom splash. The lantern task's work is untouched.
2. **Android touch targets.** Android recommends 48 dp. P2 and P3 freeze 44 pt for the icon controls. The proof keeps
   44 pt and reports it (finding F-05); it changes no frozen value.
3. **Implementation carry-forward (not P4):** wiring `app.json` `icon` / `splash` / `adaptiveIcon`, the iOS launch
   storyboard colour asset, and the Android splash theme remain Production Integration work (P4-GAP-017).
