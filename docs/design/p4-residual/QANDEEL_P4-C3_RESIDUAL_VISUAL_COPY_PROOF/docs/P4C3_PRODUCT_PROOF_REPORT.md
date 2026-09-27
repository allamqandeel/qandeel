# P4-C3 — Product proof report

**Status:** `P4-C3 — CORRECTIONS COMPLETE / READY FOR FINAL INDEPENDENT REVIEW`.
The independent review found P4-C3 **APPROVED WITH MINOR CORRECTIONS**. The P4-C3R pass (§6) applied exactly the four
Product Owner approvals. P4-C3 is **not** closed.
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
| F-01 | **Appearance preference vs a static launch surface.** P1 §12 gives an in-app Dark / Light / System preference (default Dark); an iOS launch screen can follow only the system appearance. Android 12+ can follow the app's choice (`setApplicationNightMode`). | **RESOLVED BY PRODUCT OWNER** (P4-C3R; the former question Q-1 is resolved): iOS system launch follows the device / system appearance; Android system splash follows the effective QANDEEL app appearance where supported; no forced Dark, no duplicate custom splash. Approval record §1 |
| F-02 | I-08A4 §8 / §9 carry the concept row «عرض الجلسة» / "Session Replay"; G1.1 §5 and G3 §G later hold the Arabic Replay noun open. P4-C3 proposed «إعادة العرض» / "Replay". | **RESOLVED BY PRODUCT OWNER / CONTROLLED AMENDMENT** (P4-C3R): «إعادة العرض» / Replay is the user-facing name; the I-08A4 row is superseded for that Product-facing name only, its bytes preserved; no Replay runtime change. Approval record §4 |
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

## 6. P4-C3R — the minor correction pass

The Product Owner approved four corrections; P4-C3R applied exactly those, recorded in
[`QANDEEL_P4C3_RESIDUAL_VISUAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md`](../../../../canonical-authority/final-product-experience/p4/QANDEEL_P4C3_RESIDUAL_VISUAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md)
(`EFFECTIVE / FROZEN ON MERGE`). No Product Owner question remains open in this package.

| # | Correction | Where it shows |
|---|---|---|
| A | Launch appearance (F-01): iOS follows the device / system appearance; Android follows the effective QANDEEL appearance where supported; no forced Dark; no duplicate custom splash | boards 01 / 02 annotations (their phones are unchanged captures); `P4C3_PLATFORM_LAUNCH_RESEARCH.md` §4 |
| B | Confidence «يوجد تعارض» / Mixed (was «فيه تعارض») | `confMixed`; boards 09, 13 |
| C | Public ID English body: "This is the only time you can manually change your Public ID. After you confirm, the new ID is permanent and can’t be changed again." | `pidBody`; board 10 |
| D | Replay name «إعادة العرض» / Replay; the I-08A4 «عرض الجلسة» / Session Replay row is superseded for that name only (F-02) | `replayNoun`; board 08 |

The three copy rows carry the new proof-only status `APPROVED_BY_PO_P4C3`. It is not `CANON`, and no other
`PROPOSED_FOR_PO_REVIEW` row changed. The pass was **targeted**:

- **Recaptured (6):** `und-ar`, `s320-und-ar`, `lg-und-ar` (the Arabic confidence word) and `pid-en`, `s320-pid-en`,
  `f-pid-en` (the English warning). The other 89 capture entries in `SHOTS.json` are unchanged.
- **Rerendered boards (6):** 01 and 02 (their "open question Q-1" annotation was stale — now resolved), 08, 09, 10, and 13
  (two of its phones show the confidence word). **Byte-identical (8):** 03, 04, 05, 06, 07, 11, 12, 14. Their footers still
  quote the full P4-C3 check summary, which is still their true record.
- **Checks:** `data/CHECKS_P4C3R.json` holds the targeted run. New: **C-COPY-13** (approved wording active; «فيه تعارض»,
  the earlier Public ID English and «عرض الجلسة» / Session Replay rejected in the registry, the generated table and on the
  page; planted `oldmixed`, `oldpid`, `sessionreplay`) and **C-GOV-1** (F-01 / F-02 resolved, no open Q-1, the approval
  record present and exact, I-08A4 bytes unchanged, no lantern technology; planted `openq`). Also changed: C-SCOPE-1
  (now allows exactly the approval record and three locators, and rejects any apps / database / services / dependency /
  schema / migration path) and C-COPY-4 (six statuses; `APPROVED_BY_PO_P4C3` is carried by exactly the three approved rows).
  `data/CHECKS.json` stays the record of the full P4-C3 run at `eb7f554`.

**Skills Used (P4-C3R).**
- `sibawayh:writing-eloquent-arabic` — confirmed that «يوجد تعارض» removes the colloquial «فيه» (register) while staying a
  neutral statement of fact about the understanding, never about the reader, and that it needs no gendered form.
- `sibawayh:designing-arabic-frontends` — Arabic line-height and fit of the longer word at 320 pt and large text (C-A4,
  C-A5 rerun), and the `<bdi>` isolation of quoted Arabic in the regenerated boards and table.
- `ui-ux-pro-max` (references only; Python is absent) — the warning keeps its two named choices and no fear, urgency or
  extra confirmation step; the English now keeps the reader as the one who acts.

## 7. Explicit statements

- **No lantern research, design, animation exploration, storyboard, timing or technology selection was performed.**
- **No production runtime was implemented.** No `apps/`, schema, migration or dependency change.
- **P4 is still ACTIVE / NOT CLOSED.** APP-OPS-01 is not frozen. The End-to-End audit is not started.
- **PR #280 was not merged.**
