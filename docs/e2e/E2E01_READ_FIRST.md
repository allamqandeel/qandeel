# E2E-01 — Read First

**Task:** `E2E-01 — Complete Product Journey & Surface Census v1`
**Phase:** first task of the **QANDEEL End-to-End Product Experience Completeness Audit**
([`QANDEEL_PRODUCT_ROADMAP.md`](../../QANDEEL_PRODUCT_ROADMAP.md) §3)
**Status:** `CENSUS COMPLETE / READY FOR PRODUCT OWNER REVIEW` — audit evidence only. It creates no Product
decision, opens no implementation task and does not close the End-to-End phase.
**Baseline:** canonical `main` at `d4b20344239654fea737afb3c03036d1bb4ef0d9` (merge of PR #281, the post-P4
checkpoint).

---

## 1. Purpose

Answer, from one traceable audit:

> What parts of QANDEEL can a user actually use today, what is only decided / proved / backend-only, what is
> missing, and which missing screens / journeys can be closed now without waiting for the AI provider decision?

The census walks the Product **as a user**, from first launch to long-term return, and classifies every user
moment with exactly one of the roadmap's eight classifications. It keeps five facts apart for every moment:
Product decision exists; design / proof exists; mobile implementation exists; backend runtime exists; a
user-facing production surface exists.

## 2. Outputs

| # | File | What it is |
|---|---|---|
| A | this file | entry point |
| B | [`QANDEEL_E2E01_COMPLETE_PRODUCT_JOURNEY_SURFACE_CENSUS_v1.md`](QANDEEL_E2E01_COMPLETE_PRODUCT_JOURNEY_SURFACE_CENSUS_v1.md) | master audit: methodology, implementation-truth summary, journey walkthrough, counts, contradictions, unknowns |
| C | [`QANDEEL_E2E01_GAP_MATRIX_v1.md`](QANDEEL_E2E01_GAP_MATRIX_v1.md) | the traceable gap matrix (roadmap §3 columns plus APP-OPS-01's two fields), one row per user moment |
| D | [`QANDEEL_E2E01_NEXT_CLOSURE_WAVES_v1.md`](QANDEEL_E2E01_NEXT_CLOSURE_WAVES_v1.md) | planning evidence: gaps grouped into closure waves, `PROPOSED FOR PRODUCT OWNER REVIEW` |

Read B §1–§3 first, then C for any row, then D.

## 3. Authority reading order used

1. [`QANDEEL_CURRENT_STATE.md`](../../QANDEEL_CURRENT_STATE.md)
2. [`QANDEEL_PROJECT_MAP.md`](../../QANDEEL_PROJECT_MAP.md)
3. [`QANDEEL_PRODUCT_ROADMAP.md`](../../QANDEEL_PRODUCT_ROADMAP.md)
4. [`docs/qandeel-canonical-backlog-v1.md`](../qandeel-canonical-backlog-v1.md), in full (BG-05)
5. [`AGENTS.md`](../../AGENTS.md)
6. The task-relevant current records: P1, P2, P3, the P4 final closure with P4-C1 / C2 / C3R / C4, APP-OPS-01,
   I-08A4, I-08N-01, I-08B1, G1.1 / G1.2 / G2 / G2.3 / G3, T-14, the Connected Worlds v2 product definitions and
   CW2 architecture, and the I-04 / I-05 / I-06 / I-07 runtime records. Master audit §2 lists every path.

## 4. Boundaries this task kept

- **Audit only.** No screen was drawn, no runtime or route was changed, no Product decision was invented.
- **No provider selection.** No Qwen / Azure / GPT or other model / voice provider was chosen, benchmarked or
  integrated.
- **`QAN-BL-VOICE-01` stays `OPEN — UNASSIGNED`.** Voice gaps are classified, not solved.
- **Plans / Credits stay coupled to provider-cost evidence.** No price, formula, unit, allowance or rollover is
  proposed.
- **Lantern stays standalone.** `QAN-BL-LANTERN-01` is classified as `STANDALONE OWNED`; nothing of it is absorbed.
- **P1–P4 are not reopened.** Where the census found a tension between records it reports it (master audit §6);
  it does not resolve it.
- **Backend completion is not mobile completion.** Shared / Public / Replay / Matching runtimes are recorded as
  `BACKEND EXISTS` beside the absence of any surface.
- **The wave ordering is a proposal.** It does not decide the Product Owner's sequence and does not amend the
  roadmap.

## 5. Backlog kickoff (BG-05)

The backlog was read in full at kickoff. **No item names E2E-01 or the End-to-End audit as its Owner task**, so
E2E-01 inherits none and claims none. The `OPEN — UNASSIGNED` and `DEFERRED — OWNED` items that bear on user
moments (`QAN-BL-VOICE-01`, `QAN-BL-NAV-02`, `QAN-BL-NAV-01`, `QAN-BL-VIS-01`, `QAN-BL-CTX-01`, `QAN-BL-CW-01`,
`QAN-BL-SEC-01`, `QAN-BL-LANTERN-01`, `OPEN-06` / `08` / `09` / `19`) are cited in the matrix as dependencies and
left exactly as recorded. E2E-01 admits no backlog item: the census closes no phase, and every gap it names is
already owned by the End-to-End audit, Production Integration, Release Hardening, Connected Worlds `I-08` /
`I-09`, or an existing backlog item (BG-06).

## 6. Implementation status since the census

The census, matrix and waves above are the audit as of their baseline and are not rewritten. Rows that a later
Production Integration slice has implemented or advanced are listed here, each with its implementation record. A
row listed here is not thereby `COMPLETE / PRODUCTION-READY`: that classification still needs the audit's own
Product, visual, device and operational evidence.

| Row | Status | Slice / record |
|---|---|---|
| `E2E-B-03`, `E2E-B-04`, `E2E-B-07` | implemented — merged through PR #283 at `7c9ee5e5bcb5f567dc7ef1944bcde92e8cdf99de` | W1A-01, [`QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-A-09` Create account | implemented — merged through PR #284 at `6b333df7774d33b034575243b3592d21f2603683`: exactly Name, Login ID, Email, Password, with the canonical Name and the private case-insensitive Login ID stored server-side | W1B-01, [`QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-A-10` Verify my email | Product Owner decision taken (mandatory in-app 6-digit code before QANDEEL, resend, expiry) and implemented in the same merge. Live delivery depends on Supabase project configuration the repository does not hold, and is not proved (record §6) | W1B-01 |
| `E2E-A-13` First use / Welcome | implemented — merged through PR #284, with the Product Owner's concise Welcome (controlled amendment to I-08A4 §14) | W1B-01 |
| `E2E-A-14` First Conversation Opening | implemented — merged through PR #284, with the Product Owner's amended opening (controlled amendment to I-08A4 §15) | W1B-01 |
| `E2E-B-02` Normal opener | implemented — merged through PR #284, unchanged copy; shown in a genuinely empty Conversation once the account has committed a turn. It is reachable whenever the runtime supplies a new empty Session; no "new conversation" navigation exists yet | W1B-01 |
| `E2E-K-02` Empty Personal world / first start | advanced — merged through PR #284: a new account arrives at the Welcome and then at the First Conversation Opening in its Conversation. The Analysis depth's own empty state is unchanged | W1B-01 |
| `E2E-A-06` Sign in (final surface) | implemented — merged through PR #285 at `df194edf6d70a2a300a0251ed114e7ad8715485e`: the final Sign in — ONE identifier field (Login ID or Email) plus Password, with the approved label and persistent Login ID help | W2-01, [`QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-A-07` Sign in with Login ID | implemented in the same merge: the Login ID is resolved on the server only (migration `0124`) and spent on the provider's own password grant; no client learns which Email a Login ID belongs to | W2-01 |
| `E2E-A-08` Sign-in failure + Login ID help | implemented in the same merge: ONE approved generic failure for a Login ID and an Email alike; the approved persistent help | W2-01 |
| `E2E-A-11` Password recovery | implemented in the same merge: Email only, non-enumerating, in-app 6-digit code, new password + confirmation, ends signed out. Live branded transactional Email delivery = EXTERNAL / NOT PROVED (record §8) | W2-01 |
| `E2E-A-12` Session ended / unknown | implemented in the same merge: a proved ended session reaches Sign in with the approved notice; an unverifiable session is the approved recovery state with a working Retry — never signed out | W2-01 |
| `E2E-A-02` Final app icon | implemented — merged through PR #286 at `b650b56f7436ce63d33c0af34036a963a03f5eee`: the I-08B2.5 platform exports installed byte-for-byte (iOS 13-size set, no dark / tinted variant; Android adaptive icon at the ratified 48 dp framing, verbatim monochrome layer, legacy square / round) and the launcher label `QANDEEL` | W2-02, [`QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-A-01` Static launch → system handoff | implemented in the same merge: the iOS Launch Screen is the World of the device appearance and nothing else; the Android 12+ system splash is the canonical icon on the World, with no second splash; the first app-owned frame is the World; no timer or hold. The Android application night mode was the constant Dark; W3-01 (merged) made it the reader's preference | W2-02 |
| `E2E-D-01` Open General Settings | CLOSED in production — merged through PR #287 at `023cb9874376ac69db5848db099d06034d5deb54`: the ONE destination, from Personal QANDEEL's own row beneath the upper chrome (P4-C1 S-B), over the same runtime; Back and Android Back return to the same Personal state | W3-01, [`QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-D-10` Dark / Light / System | CLOSED in production — same merge: ONE appearance authority, Dark default, device-local per-identity persistence, the canonical Light family; the Analysis stays dark under every preference | W3-01 |
| `E2E-D-07` Sign out | CLOSED in production — same merge: current session / current device only, through the existing auth authority, ordinary Sign in afterwards, and durable across an app restart even when the provider sign-out fails | W3-01 |
| `E2E-D-02` Find a setting in its group | advanced only — NOT CLOSED: the root exposes the two groups W3-01 owns (Appearance & Accessibility; Support & About); W3-02 (merged through PR #288) adds Account & Identity as a third real group; W3-MEGA-A (merged through PR #295) adds Security & Sign-in; W3-MEGA-S (merged through PR #296) adds QANDEEL & Conversation and Privacy & Data — six real groups; Notifications, Introductions and Plan & Usage have no function yet; the nine-group hierarchy is not closed | W3-01; W3-02; W3-MEGA-A; W3-MEGA-S |
| `E2E-D-09` Public ID / one lifetime manual change | CLOSED in production — merged through PR #288 at `92444c3ab8c35f7d819888be76aa6395c93d94b8`: the auto-generated, unique, account-held Public ID and its ONE lifetime manual change, enforced by the database (migration `0125`), owner-only API, and the Account & Identity row + warned change in General Settings. `E2E-H-08` (Public display choice) is not closed | W3-02, [`QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-D-14` Open «فهم قنديل» / QANDEEL Understanding | CLOSED in production — W3-MEGA-U merged through PR #291 at `226b61710b36c1ecba27b816a460fe16c040639a`: owner-only Understanding projection (qualitative confidence from structure only; runtime remains uncalibrated), persistent Personal-row entry, first view/detail, and exact-revision "talk to QANDEEL about this" (migration `0126`) | W3-MEGA-U, [`QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-D-15` Disagree → Contested / Under Review | CLOSED in production — same merge: one explicit act bound to the revision seen, a durable owner-only contest (migration `0127`), re-evaluation through the audited lifecycle core and Confidence Runtime, Mixed + under review in the projection and reduced reliance in provider context; never a deletion. `PG-01` is CLOSED; `PG-02` and `PG-04` are not | W3-MEGA-U |
| `E2E-D-13` Ask what QANDEEL remembers; correct it; ask it to forget | CLOSED in production — W3-MEGA-M merged through PR #293 at `3c0ea458a22a17a2a50c616b708f097f5911fb34`: in the Conversation (no Memory editor), from canonical owner-only Memory truth — inspect, explicit remember, correction by supersession, forget (`DELETED`, a status change, not physical erasure), do-not-rely (`DISABLED`), and clarification instead of a guessed change; each change commits in ONE transaction with the reply that reports it (migration `0128`) | W3-MEGA-M, [`QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-D-04` Change my Email | DECIDED (W3-PDG-01 closure §2). IMPLEMENTED — merged through PR #295 at `1e7b681052c7af09576197bcfb204e1b39775554` (W3-MEGA-A): password → new Email → codes to the new AND the current Email, the current one verified first; changes only after both; non-enumerating; Login ID unchanged; signed out after. Its copy was approved by the Product Owner (R1); it closes when the PR merges green; live delivery EXTERNAL / NOT PROVED | [W3-PDG-01 closure](../canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md); [W3-MEGA-A record](QANDEEL_W3_MEGA_A_ACCOUNT_IDENTITY_SECURITY_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-D-06` Security & Login | DECIDED (closure §3). IMPLEMENTED — merged through PR #295 at `1e7b681052c7af09576197bcfb204e1b39775554` (W3-MEGA-A): the «الأمان وتسجيل الدخول» / Security & Sign-in group — Change password, Sign out from other devices, the Email + status as recovery; a password change or recovery ends every other session; no Phone / 2FA / Passkeys rows. Copy approved by the Product Owner (R1); closes when the PR merges green | W3-PDG-01; W3-MEGA-A |
| `E2E-D-08` Shared ID | DECIDED (closure §4). Backend format ready (W3-MEGA-A, merged through PR #295) (migration `0129`: server generator, case-insensitive normalizer, generated regeneration through 0081's frozen rotation; no client role, route or row). NOT surfaced until Shared invitations are usable in W6; the user journey is NOT closed | W3-PDG-01; W3-MEGA-A |
| `E2E-D-03` Name + Account Photo | ADVANCED (W3-MEGA-A, merged through PR #295): the owner's Name change is implemented; **Account Photo — BLOCKED / DEFERRED BY MEDIA STORAGE IMPLEMENTATION BOUNDARY** (no media storage primitive exists). The row is NOT closed | W3-MEGA-A |
| `E2E-D-05` Change Login ID | IMPLEMENTED — merged through PR #295 at `1e7b681052c7af09576197bcfb204e1b39775554` (W3-MEGA-A): after the password is re-entered (the provider's own password check, demanded again by the database, migration `0129`); no cooldown or limit; the old Login ID stops working at the commit. Copy approved by the Product Owner (R1); closes when the PR merges green | W3-MEGA-A |
| `E2E-D-11` App language | DECIDED (closure §5). IMPLEMENTED — merged through PR #296 at `e87aac6b4e9ec6c1b6542d2ba3c82cc6cc9af6e8` (W3-MEGA-S): the «قنديل والمحادثة» / QANDEEL & Conversation group's Language row opens the SYSTEM setting (iOS per-app language declared; Android the device language — its per-app `localeConfig` needs a Level-4 CNG review); no in-app toggle; the reply language and the one locale authority unchanged. The row is NOT closed: the Product decision is closed; Android per-app-language realization (`localeConfig`) and device validation remain | W3-PDG-01; [W3-MEGA-S record](QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-D-12` Accessibility preferences | DECIDED (closure §6). ADVANCED by W3-MEGA-S (merged through PR #296): no in-app switch; Reduce Motion now followed mid-session on the W1A / W3 surfaces; text scaling, screen reader and contrast verified on every new surface; Reduce Transparency not materially applicable; **Bold Text open** (needs the Estedad 600 face); the T-10 camera / temporal hooks' mid-session Reduce Motion parity is `QAN-BL-A11Y-01` → VPORT-02. NOT closed | W3-PDG-01; W3-MEGA-S |
| `E2E-D-16` Export my data | DECIDED (closure §7). IMPLEMENTED — merged through PR #296 (W3-MEGA-S, migration `0130`): Privacy & Data → password (the database demands the proof) → server-side asynchronous preparation → in-app download to a place the reader chooses, for a limited time; Personal world only — Shared / Public / Replay / Introductions `NOT YET INCLUDED — WORLD-SCOPED EXPORT AUTHORITY NOT IMPLEMENTED`. Product copy approved / closed by W3-MEGA-S-CLOSE-01 (PR #305) | W3-PDG-01; W3-MEGA-S |
| `E2E-D-17` Delete my account | DECIDED (journey / principles, closure §8). W3-MEGA-S (merged through PR #296): **`D-17 PERSONAL-WORLD IMPLEMENTATION — READY`** (password, cancellable grace period, ONE governed transactional Personal erasure through a controlled change to the history guards, provider account removed, Login ID / Public ID not reused) and **`D-17 FULL ACCOUNT DELETION — BLOCKED BY CONNECTED WORLDS`** (an account a Connected Worlds row references is BLOCKED, nothing erased; `QAN-BL-ACCT-01`, `QAN-BL-CW-01` open). **NOT production-ready**; the row is NOT closed | W3-PDG-01; W3-MEGA-S |
| `E2E-D-08` Shared ID — surface (S4-01) | IMPLEMENTED ON AN OPEN PR (S4-01, not merged): General Settings → Account & Identity → Shared ID: the current value (sealed server-side, migration `0138`; provisioned on the first read while Shared is open), Copy, the privacy explanation and Regenerate behind a confirmation; the legacy `0081` client rotation retired. Closes when the PR merges green and its Product Copy Gate is approved | S4-01, [`QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md`](QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md) |
| `E2E-B-01` Move between QANDEEL, Shared World and Public World | ADVANCED (S4-01, open PR): the first production Global Switcher — «قنديل» / QANDEEL and «العالم المشترك» / Shared World (P4-C1 SW-3; P2 `navMine` / `navShared`); switching is not pushing; Back stays local. The Public World destination waits for Stage 5. NOT closed | S4-01 |
| `E2E-G-01` Open Shared World and see my worlds | IMPLEMENTED ON AN OPEN PR (S4-01): the Shared root — current Worlds (birth order, no ranking), incoming invitations, ONE invite / create action; authority-first World entry with a neutral pre-authority shell (CW2-07 §19–§20) | S4-01 |
| `E2E-G-02` Invite someone with their Shared ID | IMPLEMENTED ON AN OPEN PR (S4-01): server-side normalization; one non-enumerating confirmation that names nobody; no World at invite time; behind the closed-by-default Shared launch gate | S4-01 |
| `E2E-G-03` Receive an invitation; accept or decline | IMPLEMENTED ON AN OPEN PR (S4-01): the inviter's Name in the approved meaning; Accept (launch-gated, over the frozen `0082` core); Decline (new forward-safe primitive; no World, no membership, nothing told to the inviter) | S4-01 |
| `E2E-G-04` A new Shared World is born and welcomes us | IMPLEMENTED ON AN OPEN PR (S4-01): exactly one World, exactly the inviter + invitee episodes, immediate entry into the World shell — members and QANDEEL's approved welcome; no setup, no composer. The final birth-scene graphic stays open (Product definition §25; S4-03) | S4-01 |
| `E2E-G-15` Come back to a world from a link or a notification | ADVANCED (S4-01, open PR): cross-World entry through the switcher resolves authority before anything renders and restores the World the reader was in only after ALLOW. Link / notification Direct Entry → S4-04. NOT closed | S4-01 |

With `E2E-D-07` closed, **W2 is CLOSED. W3 is not phase-closed**: its named residual rows below stay open. Execution
sequencing has moved to Stage 2, and VPORT-02 is NEXT ([`QANDEEL_PROJECT_MAP.md`](../../QANDEEL_PROJECT_MAP.md) §5.1).
W3-MEGA-U closed `E2E-D-14`, `D-15` and `PG-01`;
W3-MEGA-M closed `E2E-D-13`. At that point the remaining W3 core implementation rows were `E2E-D-03` and `D-05`, while
`E2E-D-02` was advanced only; W3-MEGA-A (below) then implemented `D-05`. W3-PDG-01 decided `D-04`, `D-06`, `D-08`, `D-11`, `D-12`, `D-16` and `D-17` as Product only, and `D-17`
stays blocked across Connected Worlds. W3-MEGA-A (merged through PR #295) implements `D-04`, `D-05` and `D-06`, the Name of
`D-03` (Photo blocked) and `D-08`'s backend format, and advances `D-02` to four real groups. W3-MEGA-S (merged through
PR #296) implements `D-11` (Android per-app language pending), advances `D-12` (Bold Text open), implements `D-16` for the
Personal world, and brings `D-17` to `D-17 PERSONAL-WORLD IMPLEMENTATION — READY` while `D-17 FULL ACCOUNT DELETION — BLOCKED BY
CONNECTED WORLDS`; `D-02` has six real groups and is not closed.
S4-01 (open PR, Stage 4) implements `E2E-D-08`'s surface and `E2E-G-01` … `G-04`, and advances `E2E-B-01` and `G-15`; `E2E-G-05` (Shared conversation) is NOT closed (S4-02).
Still open from these families: `E2E-A-03` / `QAN-BL-LANTERN-01` (the Lantern moment, not implemented).
