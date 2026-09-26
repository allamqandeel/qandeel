# P3-A — Platform Reference Gate and Skills Gate

**Status:** `P3-A EVIDENCE — VISUAL PROOF / DECISION GATE — P3 NOT CLOSED / NOT FROZEN`.

Research was refreshed on **2026-09-26**, before any drawing, from primary sources only. Apple's documentation pages
render client-side, so they were read through Apple's own documentation data endpoint
(`developer.apple.com/tutorials/data/documentation/…json` — the same text the HTML page shows). A first attempt that
returned no page body, and one answer that came from a model's memory rather than the page, were discarded; nothing
below relies on them.

Platform facts shape **delivery mechanics**. They never redefine I-08N-01's Product semantics (N-01-D52).

## 1. Sources and what each changed

| Source (checked 2026-09-26) | What it says (short quotation or paraphrase) | Implication for P3 | Owner |
|---|---|---|---|
| Apple, *Asking permission to use notifications* | Request "in a context that helps people understand why your app needs authorization". The first request prompts; "Subsequent authorization requests don't prompt the person." | Education comes first, at a legitimate moment; the one system prompt is not spent at launch. A declined user is not re-asked by QANDEEL (also I-08N D50). | request timing: **QANDEEL**; the prompt and the answer: **platform** |
| same page, *Use provisional authorization* | Provisional notifications are delivered quietly and "only appear in the notification center's history"; no prompt is shown. | Recorded as a **future platform option only**. Not adopted: it would put QANDEEL notifications in the history without the user's explicit choice, a Product policy this task does not take. | platform option; adoption would be a later Product decision |
| same page | "Always check your app's authorization status … People can change your app's authorization settings at any time." | The settings surface reflects OS state ("Notifications for Qandeel are off on this device") and hands off; it never claims to own it. | **platform** |
| Apple, `UNNotificationInterruptionLevel` | passive: "adds the notification to the notification list without lighting up the screen"; active: presents immediately; timeSensitive: "breaks through system notification controls"; critical: "bypasses the mute switch". | **QANDEEL Class ≠ OS level.** Board 14 shows a mapping only as `IMPLEMENTATION EXAMPLE — NOT PRODUCT AUTHORITY`. | **platform** |
| Apple, `UNAuthorizationOptions.criticalAlert` | "Critical alerts require a special entitlement issued by Apple." | Critical Alerts are **not assumed and not authorized**; Class 1 (Critical) never implies Apple Critical. | **platform** (entitlement) |
| Apple, `UNNotificationSettings` | exposes `lockScreenSetting`, `showPreviewsSetting`, `timeSensitiveSetting`, `providesAppNotificationSettings` ("the system displays a button for in-app notification settings"). | The device decides the Lock Screen and previews; QANDEEL's L0–L3 is a ceiling on the **words** it gives the platform. A later implementation may expose the in-app settings button. | **platform** (settings) / **QANDEEL** (words) |
| Apple, `UNShowPreviewsSetting` | always · whenAuthenticated ("content is shown only when the device is unlocked") · never. | The platform can hide **more** than QANDEEL's level (board 10 note). QANDEEL never relies on the device to hide what its level should not reveal. | **platform** |
| Apple HIG, *Notifications* | "Avoid sending multiple notifications for the same thing, even if someone hasn't responded." "Handle notifications gracefully when your app is in the foreground" (e.g. "subtly inserting new data into the current view"). "Avoid creating a custom image or component that mimics the appearance or behavior of a badge." "Provide generically descriptive text to display when notification previews aren't available." | Same-thread 48 h + third-needs-new-context; foreground in-place / strip instead of a duplicate Push; the attention mark is a small attached dot, not a red numeric badge; L0 / L1 use generic words. | **QANDEEL** |
| Apple HIG, *Managing notifications* | Time Sensitive "only for notifications that are relevant in the moment … within an hour"; "Never use the Time Sensitive interruption level to send a marketing notification"; "Make sure people can manage their notification settings within your app." | Board 14's example maps only Class 1 security to timeSensitive, and only as an example. In-app settings exist (boards 07 / 08). | example only |
| Android, *Notification runtime permission* | "Android 13+ supports runtime permission for sending non-exempt notifications." Apps targeting 13+ choose when the dialog appears; new installs have notifications off until granted; use `shouldShowRequestPermissionRationale()` to decide on education. | Same contextual flow as iOS. Exemptions (media sessions, self-managed calls, FGS in the task manager) matter for the future Live Call runtime (`QAN-BL-VOICE-01`), not for P3. | **platform** |
| Android, *Notification channels* | "Once you submit the channel to the NotificationManager, you can't change the importance level." "Only the user can change the channel behaviors from system settings." | Channels are implementation; Product categories must not be defined by channel importance (D52). The "Device Notification Settings" row is a handoff. | **platform** |
| Android, *Create a notification* | `VISIBILITY_PUBLIC / PRIVATE / SECRET`, `setPublicVersion()`; "the user always has ultimate control over whether their notifications are visible on the lock screen". | L0–L3 maps to the words QANDEEL supplies (public version and private content); the user's device setting still wins. | **platform** (visibility) / **QANDEEL** (content) |

**Not verified in this refresh:** Apple's Time Sensitive entitlement page returned HTTP 404 at both path spellings
tried. No statement in this package depends on its wording.

**Material constraints that affected the proof:**
1. The OS prompt is drawn by the platform, once. So the proof draws QANDEEL's education and then a clearly labelled
   schematic boundary (`PLATFORM-OWNED · NOT DRAWN`), never a fake OS dialog (board 09, clip M05).
2. The Lock Screen frame is the platform's. The proof owns only the words per level and shows them in grey schematic
   cards labelled as such (board 10).
3. Interruption levels, Critical Alerts and channel importance are entitlement- and user-controlled. The proof keeps
   them out of Product law (board 14).

## 2. What is platform-owned and what is QANDEEL-owned

| Platform-owned (drawn and decided by iOS / Android) | QANDEEL-owned (this proof) |
|---|---|
| the permission prompt and its answer; the notification card outside the app; the Lock Screen and its preview setting; sound, alert style, banners; channel importance; Focus / Do Not Disturb; the app-icon badge's appearance; Critical Alert and Time Sensitive entitlements | when to ask and the education before it; which events may interrupt, how often, at what disclosure level, and in which words; Activity; the Attention Mark; the Attention Strip; the Notifications & Activity settings; Quiet Hours and Snooze; the Direct Entry after a tap |

## 3. Skills Gate

Enumerated from disk (project `E:\QANDEEL\.claude\skills`, user `~/.claude/skills`, plugin cache): 55 `SKILL.md`
files. The project copies of `designing-arabic-frontends` and `writing-eloquent-arabic` are byte-identical to the
plugin copies (SHA-256 compared). No skill, plugin or package was installed.

| Skill | Status | Evidence read | Concrete effect on this proof |
|---|---|---|---|
| `fixing-accessibility` | USED | `E:\QANDEEL\.claude\skills\fixing-accessibility\SKILL.md` (all 9 rule groups) | Every icon-only control has a name (entry, settings, dismiss); every glyph is `aria-hidden` (C-A11Y-1/2). Toggles are native `button role="switch"` with `aria-checked`; the Proactive choice is a `radiogroup`. The education sheet is a modal dialog that takes focus and closes on Escape as "Not now". The strip is never the only carrier ("toasts must not be the only way to convey critical information"): every strip event is also in Activity. The live region is ONE persistent node (a re-created one would never announce). |
| `designing-arabic-frontends` | USED | the loaded skill (§1–§6) | Mirror by meaning: back and row chevrons mirror (`scaleX(-1)`); the ledger, World, call and media glyphs never do; the strip and the rail follow layout direction (C-A11Y-6). Handles such as `@saharreads` are wrapped as LTR islands (otherwise the `@` lands on the wrong side). Found and fixed a real bug from its §4/host trap: `direction:ltr` on the logically-positioned call timer flipped its insets. Estedad declared; body leading ≥ 1.6; no letter-spacing on Arabic. Digits stay Western through the one locale authority, as the shell already does. |
| `writing-eloquent-arabic` | USED | the loaded skill (register table, 8 failure modes) | Register split: QANDEEL-voice lines keep the Product Owner's Egyptian direction; account and security lines are MSA («إن لم يكن هذا أنت، فراجِع الأجهزة المتصلة.»); settings lines are short and neutral. Calques avoided («تعذّر» framing is not needed; «ردّ جديد من … على منشورك» keeps the verb-first order and needs no gender). Every string carries a status in `content.mjs`; nothing is claimed canonical. |
| `animate-expo` | USED | the loaded skill (gate, easing and duration tables, reduced-motion rule) | Frequency gate: tab-like filter changes do not animate; the strip (occasional) earns a standard 240 ms ease-out entrance and 180 ms exit; nothing bounces (no finger momentum is involved). Only `transform` and `opacity` animate. Reduced Motion = "fewer and gentler": opacity only, same hold and acts (M04, C-A11Y-7). Timings are recorded as craft; feel is a device gate. |
| `apple-design` | USED | `E:\QANDEEL\.claude\skills\apple-design\SKILL.md` | "Enter and exit along the same path" — the strip leaves the way it came (up into the chrome). "Dim to focus, separate to keep flow": the strip is a nonmodal layer with **no** scrim; only the education (a genuine decision) is a modal with the one PASSAGE scrim. "Responsibility — ask at the right moment" drove the contextual permission flow. Feedback on press-down (the E1R ground wash on pointer-down). |
| `ui-ux-pro-max` | USED (data queried directly) | its `ux-guidelines.csv` rows 19, 82, 118 (the search script cannot run: no Python on this host, stated rather than hidden) | Row 118 "Contextual Live Badge Updates … one atomic status message … not a bare number": the entry's name says «النشاط، فيه جديد», never a digit. Row 19 "stable count slot for badges": category counts sit in a fixed slot after the label. Row 82 (auto-dismiss 3–5 s) was **overridden** by I-08N and the task: the strip holds 6 s, pauses under focus or a finger, and is never the only carrier. |
| `impeccable` | INSPECTED — APPLIED AS A FLOOR | `~/.claude/skills/impeccable/reference/craft-floor.md` | "Same-size cards … as the page structure" refused: Activity is rows on the World, not cards. "A modal for a task that needs neither interruption nor protected focus" refused: the strip is not a modal. "A colored border-left … on list items" refused: unread state is a small mark, never a coloured edge. Its setup script (which writes project files) was not run. |
| `emil-design-eng`, `animate`, `improve-animations`, `review-animations`, `animation-vocabulary`, `find-animation-opportunities` | INSPECTED — NOT APPLICABLE | names and descriptions | `animate-expo` and `apple-design` already govern the few motions; `review-animations` is user-invoked only on this host. |
| `frontend-design`, `design-critique`, `prototype`, `user-research` | INSPECTED — NOT APPLICABLE | descriptions | The visual world is frozen canon (C3, B4R, E1R, F1/F2, P2); no new aesthetic direction is in scope. |
| React Native / Expo / media skills (`react-native-best-practices`, `expo-horizon`, `fishjam`, `moq-kit`, `pulsar-haptics`, …) | INSPECTED — NOT APPLICABLE | descriptions | No production code or dependency is in scope; haptics are an implementation choice (P3_IMPLEMENTATION_FEASIBILITY.md). |

Repository canon and the Product Owner's accepted direction outranked every skill.
