# P4-C3 — Product proof report

**Status:** `P4-C3 — RESIDUAL VISUAL + COPY PROOF — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`.
**P4 remains ACTIVE — NOT CLOSED / NOT FROZEN.** APP-OPS-01 is untouched and not frozen. The End-to-End audit has not
started. PR #280 was not merged.

## 1. What was proved

| Family | Proved | Boards | Checks |
|---|---|---|---|
| A · Launch → handoff | iOS launch = one solid World colour, byte-identical to the first app-owned frame (Dark and Light). Android 12+ SplashScreen = the I-08B2.5 adaptive icon (vendored bytes) in the 160 dp mask on a single opaque World colour, then the same ground without the icon. No text, logo, delay, second splash or lantern. The app-owned frame is left empty for the standalone lantern task | 01, 02 | C-L1 … C-L6 |
| B · Non-signal Voice | the Voice Note as the reader's UTTERANCE with stored playback state drawn by form. The finished-call record as a non-interactive history mark with no play and no transcript. Recording as a non-signal FIELD state. The Live Call Analysis-first, one call across Conversation ↔ Analysis by real input, P2 Call Rail A, no prose, no signal | 03 – 07 | C-V1, C-V3 … C-V11 |
| C · Bilingual copy | 233 registry rows, each with one of the five statuses. Every page word is registered and matches (C-COPY-5). Frozen names are verbatim. English casing is QANDEEL. The Arabic opener is exact. All P3 keys are dispositioned. Arabic T1 register and gender are clean. The English register rule holds | 08 – 12 | C-COPY-1 … C-COPY-12 |
| Stress / accessibility | 320 × 568, large text, Increased Contrast, Reduced Motion parity, names, targets, focus | 13, 14 | C-A1 … C-A8 |

## 2. Automated checks

`data/CHECKS.json` — **44 / 44 checks pass · 19 / 19 planted defects rejected.** Scope (4), provenance (3), voice (10), copy (12),
accessibility (9) and launch (6). Every planted defect is rejected by the check that names it:

| Defect | Rejected by |
|---|---|
| a waveform in the Voice Note · G3.2's level trace visible in the call | C-V1 |
| a play control on the call record · a transcript under it | C-V3 |
| a different call id on the Conversation side | C-V5 |
| "microphone on" visible in the call line | C-V6 |
| the Voice Note on the wrong side (direction flipped) | C-V8 |
| stored playback state carried by colour only | C-V10 |
| the Analysis turned Light | C-V11 |
| one letter of the frozen Arabic opener "corrected" | C-COPY-1 |
| "Qandeel" in English | C-COPY-2 |
| a gated word re-keyed as a proposed one · "Needs more context" | C-COPY-5 |
| "Live" on the Live edge | C-COPY-10 |
| an unnamed icon-only control | C-A1 |
| a 30 pt Voice Note control | C-A2 |
| text on the iOS launch screen | C-L1 |
| a declared minimum splash duration | C-L5 |
| a lantern-like element in the app-owned boundary frame | C-L6 |

C-A6s is informational. It measures standard contrast so that the Increased Contrast result has a baseline, and it can
report low values that belong to frozen tokens without failing.

## 3. Skills Used (G1 Skills Gate)

Installed skills were inspected through the session's skill list. Every one that bears on Product / UI, Arabic writing,
Arabic / RTL frontend, accessibility and visual proof was loaded. Two ran only in part on this host, and the table says so.

| Skill | Where used | Concrete effect |
|---|---|---|
| `sibawayh:writing-eloquent-arabic` | every Arabic string authored or revised (`content.mjs`); the copy report | **Register:** Settings / help / labels moved to T1 MSA-neutral; spoken-Egyptian proof lines («ده بيتحكم … بس», «مفيش حاجة هنا دلوقتي») rewritten. **english-word-order:** the fronted «افتراضيًا،» moved to trail; proactive help made verb-first («يحدّد هذا الخيار…»). **calque:** «من فعل ماذا» rewritten; «مدة مخصّصة» rejected for «مدة أخرى». **weak-connector:** the OS-off line bound with «و». **robotic-tone:** the "we" voice («لن نفتح») replaced by an impersonal passive. **Eloquent ≠ ornate:** the simplest native words for confidence («واضح», «يتشكّل»). The frozen opener was deliberately **not** "corrected" |
| `sibawayh:designing-arabic-frontends` | `app.js`, `build.mjs`, checks | **§4:** diagnosed and fixed a real bug — the call line's elapsed time sat on the End Call button because an element with `direction:ltr` resolved `inset-inline-start` against its own direction; the positioned box now keeps the page direction and only the digits are an LTR island. Handles (`@nightlamp27`) and digits are `<bdi dir="ltr">` islands. **§6:** play / pause and the call glyphs never mirror; the call record's seam mirrors as layout. **§2:** Arabic line-height ≥ 1.6 enforced by C-A5. **§3:** one numeral system (Western, T-12). **§7:** Arabic counted nouns in spoken lengths (12 دقيقة · 4 ثوانٍ) and Snooze labels. **§5:** no letter-spacing on Arabic |
| `ui-ux-pro-max:ui-ux-pro-max` | accessibility and interaction checks; the Public ID warning | Its search script needs Python, which is **not installed on this host**, and none was installed, so no database search ran. Its own references were read instead: `pro-rules.md` Pre-Delivery Checklist and `ux-guidelines.csv` (grep). Effects: 44 pt iOS / **48 dp Android** targets (C-A2 plus finding F-05); an irreversible action gets an explicit confirmation with two named choices (the Public ID warning); focus not obscured (C-A8); Reduced Motion (C-A7); never colour alone (C-A3, C-V10); icon-only controls named (C-A1); dark / light contrast measured separately (C-A6 / C-A6s) |
| `impeccable` | the build and one verification round | The installed copy is **partial**: `SKILL.md` plus `reference/craft-floor.md`, `critique.md` and `audit.md` only. `context.mjs`, the detector and the clarify / harden playbooks are absent. The craft floor was applied: contrast measured on the built result, states (rest / paused / playing, idle / recording, muted / route), controls that name their action, no emoji or Unicode icons, no decorative glass or gradient text, one bounded batched inspection round (Arabic / English, 320 / 390 / 430) with every issue fixed in one batch. **No impeccable `critique` run is claimed**: its required detector does not exist on this host |

Considered and not used: `animate` / `animate-expo` / `emil-design-eng` / `frontend-design`. No new motion is designed
here, the lantern is a hard stop, and the visual system is frozen.

## 4. Findings (recorded, not silently amended)

| ID | Finding | Disposition |
|---|---|---|
| F-01 | **Appearance preference vs a static launch surface.** P1 §12 gives an in-app Dark / Light / System preference (default Dark); an iOS launch screen can follow only the system appearance. Android 12+ can follow the app's choice (`setApplicationNightMode`). | the one Product Owner question (Q-1, §6) |
| F-02 | I-08A4 §8 / §9 still carry the concept row «عرض الجلسة» / "Session Replay"; G1.1 §5 and G3 §G later hold the Arabic Replay noun open. P4-C3 proposes «إعادة العرض» / "Replay". | if approved, the P4 closure must amend the I-08A4 row in its narrow scope. Not done here |
| F-03 | P3-A's COPY_TABLE marks «كتم الميكروفون» / «إنهاء المكالمة» (mute / end call) `CANON` ("G1.2 R1"), but G1.2 §6 and P4-C2 §5 keep call strings gated. | recorded as `RUNTIME_GATED`. P3-A's bytes are not edited |
| F-04 | G1.1 §3's `UTTERANCE` wording lets a voice turn carry "its committed textual representation", while G1.2 §6 leaves Voice Note transcripts open (P4-GAP-024). The proof draws the voice turn **with no text**. | compatible if the textual representation is optional; the P4 closure should say so explicitly |
| F-05 | Android recommends 48 dp targets; P2 §10 / P3 §16 freeze 44 pt and P2 freezes the Call Rail geometry (44 pt targets). | reported per control (C-A2, A11Y.json). No frozen value changed. An implementation / device gate |
| F-06 | G3.2's preserved bytes still carry the pre-P2 call line (circular End Call, simulated level trace), the pre-P2 switcher, a second assistive call channel and English "Qandeel" names. | hidden, made inert or renamed **at runtime only** in this proof. Production follows P2 / P4-C1 / P4-C2 |
| F-07 | The Living Analysis world's labels («العمل», «جلسة ١١») stay Arabic under English. | the frozen I-08B1 world. Out of scope; noted for the End-to-End audit |
| F-08 | Truth drift in P3-A proof copy: the Quiet Hours help promised a "morning" review; P3 §13 freezes re-evaluation when Quiet Hours **end**. | corrected in the proposed row |
| F-09 | Older proofs used "Public world" / "Shared" where I-08A4 and G1.2 freeze "Public World" / "Shared World". | corrected (CANON / proposed rows) |

## 5. Known limitations

- **Browser evidence only.** VoiceOver / TalkBack, Dynamic Type, OS Increase Contrast and Reduce Motion, 48 dp on
  hardware, real launch timing, CallKit / Telecom and audio are device and implementation gates.
- The system status bar and Android system chrome are stand-ins drawn by the proof. The launch surfaces are
  representations of the platform surfaces, not native builds.
- The Understanding and Settings pages are **copy contexts** marked as not frozen: specimen rows and a group list, not
  screen designs (P4-C2 §3).
- Durations, times, handles and every conversation sentence are fixture facts.
- The call's other states (connecting, reconnecting, failure, ended-while-away, hold) are not drawn: they depend on
  runtime truth. The connecting word exists in the registry as `RUNTIME_GATED`.
- Large text is a browser stand-in (118 % plus the ramp), not iOS Dynamic Type or Android font scale (nonlinear on
  Android 14+).

## 6. Question for the Product Owner

**Q-1 — Launch appearance when the reader's QANDEEL appearance differs from the phone's.** (F-01)

The platform research surfaced this. P4-C1 / P4-C2 do not resolve it, and it decides the first app-owned frame the lantern
task inherits.

| Option | What happens | Trade-off |
|---|---|---|
| **A. System-following launch on both platforms; Android also reports the in-app choice** *(proof default; recommended)* | iOS and Android launch surfaces follow the system appearance; Android API 31+ uses `setApplicationNightMode` so its splash already matches the reader's choice. On iOS a mismatched reader meets one appearance change after launch, handled with F2's own switch semantics (cut under Reduce Motion) before the lantern task's content | follows Apple S1 exactly; one visible change on iOS only for readers whose choice differs from the phone |
| B. Always-Dark launch (P1's default) | the launch surface is World Dark whatever the system says | matches the default reader; breaks Apple's "match the current appearance" for Light-system readers, who see Dark → Light |
| C. The lantern task decides | P4 freezes nothing about the boundary's appearance | defers a platform-truth question into a creative task |

## 7. Explicit statements

- **No lantern research, design, animation exploration, storyboard, timing or technology selection was performed.**
- **No production runtime was implemented.** No `apps/`, schema, migration or dependency change.
- **P4 is still ACTIVE / NOT CLOSED.** APP-OPS-01 is not frozen. The End-to-End audit is not started.
- **PR #280 was not merged.**
