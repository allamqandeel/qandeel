# QANDEEL — A3-01 Activity & Attention Core + In-App Production Integration — Implementation Record v1

**Task:** `A3-01 — Activity & Attention Core + In-App Production Integration` (Stage 3 — Activity & Notifications Production)
**Task Contract:** `QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_TASK_CONTRACT_v1.0.md` (Product Owner)
**Baseline:** `34ea439b98eecd5f22628f41749245f81bb2b9f8` (the merge of PR #306, VPORT-02)
**Branch:** `feat/a3-01-activity-attention-inapp`
**PR:** Draft — see §1
**Status:** **`A3-01 IMPLEMENTED — PRODUCT COPY GATE APPROVED — EXACT-HEAD PROOF PASSED (a50e847) — GITHUB CI PENDING — NOT YET READY FOR INDEPENDENT REVIEW — DO NOT MERGE`**. Claude does not merge it.

> The provider-neutral Product notification / Activity spine and its in-app production integration, over I-08N-01 + P3:
> the durable per-user Activity projection, the attention decision, the global entry and presence mark, Activity, the
> ordinary Attention Strip, the Analysis deferral and exit re-evaluation, Direct Entry, and Notifications & Activity.
> No source producer exists yet, so production Activity is truthfully empty (§3.2). No native Push (A3-02). **A3-01 does
> not close Stage 3.**

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `34ea439b98eecd5f22628f41749245f81bb2b9f8` |
| Branch | `feat/a3-01-activity-attention-inapp`, cut from the exact baseline |
| PR | Draft (opened with this record; number in the PR) |
| Implementation evidence head | **`a50e847405f6eaa899d1a9c3ce27618abac62858`** — the final code head (the Copy Gate binding); the Release proof APK was built from it and proved 9 / 9 on it (§18). Every commit after it changes documentation only — this record and the locator status lines (`git diff --stat a50e847..HEAD` lists no code, test, workflow or migration file) |

## 2. Repo Truth Gate

| Check | Result |
|---|---|
| working tree clean before the branch | yes (`git status --porcelain` empty) |
| remote fetched | yes |
| `origin/main` | `34ea439b98eecd5f22628f41749245f81bb2b9f8` = the canonical kickoff baseline |
| PR #306 | `MERGED` 2026-10-04T08:27:29Z, merge commit `34ea439b…` |
| VPORT-02 record on `main` | present: `docs/e2e/QANDEEL_VPORT_02_TIMELINE_ORIENTATION_P2_FINAL_COHERENCE_IMPLEMENTATION_RECORD_v1.md` |
| Stage 2 | consumed as merged production work (VPORT-01 #297, VPORT-02 #306) |
| branch cut from exact head | yes |
| `main` moved since the Task Contract | no — no re-sweep needed |

**Locator drift found (to be reconciled at closure, §22):** `QANDEEL_CURRENT_STATE.md` §3.7 and the Project Map §5.1 still
read VPORT-02 as "IMPLEMENTED ON DRAFT PR #306 — … NOT MERGED", and Stage 2 as ACTIVE. PR #306 is merged.

## 3. Anti-Duplication Gate

Read: `AGENTS.md`; `QANDEEL_CURRENT_STATE.md`; `QANDEEL_PROJECT_MAP.md`; `QANDEEL_PRODUCT_ROADMAP.md`; the canonical
backlog in full (BG-05); `I-08N-01` in full (D01–D59, §19–§21); the P3 closure in full; P3-A `P3_READ_FIRST.md`, all eight
`docs/P3_*` specs, `data/COPY_TABLE.md`, `source/src/model.mjs`, `source/src/p3glyphs.mjs`; P4-C4 and the pinned P4-C3
`COPY_REGISTRY.json` (blob `feaee440…`); the VPORT-02 record; and the production owners in `apps/mobile/src/`
(`integration/composition`, `conversation`, `settings`, `iconography`, `appearance`, `motion/runtime`, `runtime-entry`,
`integration/runtime`), `apps/api/src/` (all modules, `auth`, `account`, `understanding`, `http-security`,
`runtime-events`, `human-model`, `connected-worlds`), `database/migrations/` 0001–0135, and the root contracts.

| Concern | Product / design frozen? | Backend / runtime exists? | Production mobile exists? | Genuine missing work |
|---|---|---|---|---|
| Activity destination «النشاط» | yes — P3 §3 | no | no | the whole surface |
| Activity entry (non-Analysis upper chrome, START) | yes — P3 §3, §16 | — | no; the Conversation upper chrome holds one control (the depth door), pinned by W1A-01 / W3-01 / W3-MEGA-U2 contracts and `surface.test.tsx` as *earlier-task anti-scope* | the entry + a controlled update of those chrome pins (P3 §3 / §19.4 authorizes the entry) |
| Activity event store | I-08N-01 D29: Activity is **not** the canonical store | no notification code anywhere (`apps/api/src`, migrations) | — | a typed candidate boundary that carries a *reference* to source truth, never source truth |
| Activity user projection | P3 §4; storage/pagination/retention **not** frozen (P3 §18, I-08N-01 §21) | no | no | durable per-user projection (new migration `0136`) |
| Seen / Opened / Waiting / Stale facts | P3 §4; D31, D40, D41, D47 | no | no | attention lifecycle on the projection, never writing source state |
| categories | D28, D30; P3 §3 filters | no | no | five-category vocabulary |
| coalescing | D09; P3 §4 | no | no | same-category + same-exact-context coalescing key |
| attention eligibility | D10–D13, D23–D27; P3 §7 | no | no | pure decision layer |
| in-app Attention Strip | P3 §7 | — | no | strip component + foreground seam |
| Analysis deferral | P3 §8 | — | `DepthComposition` owns `depth: 'CONVERSATION' \| 'ANALYSIS'` (the real navigation truth) | consume `depth`; no parallel navigation state |
| re-evaluation on Analysis exit | P3 §8 (tie-break **not** frozen) | — | no | re-evaluate on `ANALYSIS → CONVERSATION`, at most one strip |
| Live Call deferral boundary | P3 §9 | **no call authority** (`QAN-BL-VOICE-01`) | `CallRail.tsx` is a controlled visual, mounted only on the VPORT-02 validation root | typed call-truth seam answering "no call is known"; no fabricated call state |
| call-safe exceptions | P3 §9 | no | no | decision path + fixture-validated component, not mounted |
| Direct Entry | D38–D43; P3 §15 | — | executable Product destinations today: Personal Conversation, Analysis, General Settings, QANDEEL Understanding | typed descriptor + tap-time revalidation; Stage 4–8 destinations typed but fail closed |
| attention mark | P3 §6; D44–D48 | no | no | presence mark, no count field |
| Quiet Hours | P3 §13 (23:00 → 08:00, ON) | no | no | preference + re-evaluation, no queue flush |
| Snooze | P3 §13 (1 h / 8 h / 24 h / Custom) | no | no | preference |
| Proactive Allow / Reduce / Off | P3 §12.1; Reduce = tighter Gate, not a score | **no Proactive Gate runtime exists** | no | the preference; Reduce and Allow **fail closed** for interruption until a Gate exists (Task Contract §7) |
| Shared per-World mute | D34; P3 §12.2 | Shared runtime exists in the database only (0075–0090); **no Product route lists a user's Shared Worlds** | no | global Shared switch; per-World mute shown **only for Worlds that exist for the user — today none can be listed** |
| Public interactions / discovery | D03, D25; P3 §12.2 | Public runtime in the database only; no Product route | no | preferences (discovery OFF by default) |
| Introductions setting availability | D26; P3 §12.2 | I-07 runtime in the database only; no Product entry exists | no | the control is **not drawn** (the capability cannot be entered today) |
| Security / account rules | D27, D36; P3 §12.2 | **no security/sign-in event is recorded anywhere**; account-security actions write no event row | no | the statement row (no off switch) + "other account updates" preference |
| Lock Screen disclosure ceilings | D14–D17; P3 §10 | no | no | per-subject ceiling preferences (D15 defaults, L3 never default) |
| permission education | P3 §11; its sheet copy is `AUDIT_OWNED` | — | no | **A3-02** (the education sheet → real OS prompt boundary) |
| native Push / device registration / APNs / FCM / channels / categories / platform badge | P3 §18 | none | none | **A3-02** |
| Open Ledger | P3 §5.1 | — | no; no bell/activity glyph exists in production | port via the existing generator + Skia mechanism |
| Open Link | P3 §5.2 | — | no | port via the same mechanism |

### 3.1 HIM / HSE "attention" — semantic separation (Task Contract §4)

`apps/api/src/human-model/hse-attention.*` computes the metric `hse.attention@1`: a user's *self-reported* attention
level on an ordinal-5 scale (migration `0014`), and `him-decision-attention-consumption.*` reads it for foreground prompt
context through `read_him_session_decision_attention_v1` (migration `0057`). It is internal human-model measurement. It
has no event, delivery, interruption or Activity semantics. **Nothing in A3-01 reads, writes or references it**, and the
contract test pins that.

### 3.2 Source-producer truth — the decisive finding

No source domain on `main` can publish a truthful Product notification candidate today:

| I-08N-01 category | Would-be producer | Exists on `main`? |
|---|---|---|
| From QANDEEL (Proactive) | the Proactive Gate (I-08N-01 §4) | **no** |
| From QANDEEL (requested exact-time reminder) | a reminder runtime | **no** (Memory explicitly classes «افتكر …» cues as reminders it does not handle) |
| Shared Worlds | I-04 runtime | database only; no Product route, no user surface (Stage 4) |
| Public World | I-05 runtime | database only; launch prerequisite fails closed (Stage 5) |
| Introductions | I-07 runtime | database only (Stage 6) |
| System / Account (incl. critical security) | a security / sign-in event source | **no** — W3-MEGA-A's account actions are provider calls that write no event |

And no approved Product copy exists for any event sentence: every P3-A event sentence is `FIXTURE_ONLY` (P3 §17; the
pinned P4-C3 registry).

**Conclusion.** Product semantics and realization are frozen by I-08N-01 + P3 (+ P4-C4 copy). The repository has no
canonical notification runtime, Activity projection, Push transport, device registration, native channel/category
integration or production Activity module. HIM/HSE "attention" is internal measurement and is not Product notification
attention. **In addition — beyond the Task Contract's expected conclusion — no source producer exists**, so the
production Activity feed is truthfully empty until a source domain publishes through the A3-01 boundary.

### 3.3 Copy-authority sweep (Task Contract §15, §24)

| Copy | Authority | Use in A3-01 |
|---|---|---|
| «النشاط» / Activity; «الكل» / All; «من قنديل» / From QANDEEL; «الإشعارات والنشاط» / Notifications & Activity; Allow / Reduce / Off; the four Lock Screen labels; World / Introductions names | `CANON` (P3 §17; registry) | final |
| the 72 `p3.*` rows + `activityNew` | `APPROVED` by P4-C4 (exact bytes in the pinned registry, which differ from P3-A's table — e.g. `p3.empty` «لا شيء هنا الآن.», `p3.proactive` «مبادرة قنديل», `activityNew` «هناك جديد») | final, byte-exact from the registry |
| permission education (`p3.edu*`, `p3.osBoundary*`, `p3.notNowNote`) | `AUDIT_OWNED` | not used — A3-02 |
| every event sentence (`p3fx.*`) | `FIXTURE_ONLY` | validation fixtures only, never Product copy |
| Snooze-active state, end-Snooze, custom-duration picker, Quiet Hours start / end edit labels, Activity loading / load-failure state | **no approved copy existed** | the A3-01 Product Copy Gate — now APPROVED by the Product Owner (§24a) |

---

## 4. Authority precedence used

1. **I-08N-01** — the foundational notification semantics (truth, authority, World boundaries, privacy / disclosure,
   interruption classes, Direct Entry, lifecycle, OS permission boundary). Nothing in A3-01 restates or relaxes a D-row.
2. **P3 closure** — the final Product realization (Activity, the entry, Open Ledger / Open Link, the mark, the strip, the
   Analysis and Live Call laws, the L0–L3 labels, Notifications & Activity, Quiet Hours / Snooze defaults, the v1
   ceilings). Where P3 calls a value *craft* or a proof *interpretation* (timings, the exit tie-break, the 08:00 reading,
   `view`, `reduceEligible`), A3-01 treats it as reference, never law.
3. **P4-C4** — the ratified copy, byte-exact from the pinned P4-C3 registry (blob `feaee440…`).
4. **P1 / P2 / G1.1 / G3** — the shell, appearance (non-Analysis follows Dark / Light / System; the Analysis stays dark),
   the icon grammar and production mechanism (VPORT-02), and G3 §D (Matching never interrupts a Live Call).
5. **P3-A** — evidence and reference only. No prototype, DOM / CSS architecture, harness parameter or proof field was
   promoted (the contract test pins `reduceEligible` and the `view` field out of production code).

## 5. Separation from HIM / HSE "attention"

`hse.attention@1` (migrations `0014`, `0057`; `human-model/hse-attention.*`, `him-decision-attention-*`) is the reader's
self-reported attention level, consumed as prompt context. It is internal human-model measurement and has no event,
delivery or Activity meaning. A3-01 reads, writes and references none of it: the contract test (§8) refuses any
`human-model` import in the Activity module and any `hse_` / `him_` / `decision_attention` object in migration `0136`, and
the real-PostgreSQL verifier asserts no 0136 function body references a human-model object. Notification delivery state
cannot influence intelligence truth: no Activity table is read by any intelligence module.

## 6. Runtime architecture

```text
source event truth (owned by its source domain — none exists yet, record §3.2)
  → ActivityPublisher.publish(candidate)            server-only; one typed boundary (apps/api/src/activity)
  → public.server_publish_activity_candidate_v1     service_role only; validated by every frozen constraint
  → public.activity_items (+ members)               the per-user Activity PROJECTION — never the event store
  → attention: NEW → SEEN → OPENED                  owner commands; attention only, never source resolution
  → interruption ELIGIBILITY (server)               interruptionVerdict: controls, mutes, Quiet Hours / Snooze in the
                                                    device zone, staleness, the absent Proactive Gate (fails closed)
  → PRESENTATION (device)                           decidePresentation: foreground, Analysis or not, origin, call truth,
                                                    at most one strip; the rest settled
  → in-app evidence                                 presented_in_app_at / interruption_settled_at — only what happened
  → platform verdict for A3-02                      platformVerdict: OS permission, D51, P3 §14 ceilings over evidence
```

The split follows where the truth lives: preferences, mutes, staleness and the Gate are the server's; foreground, the
surface in front, the origin and the one-at-a-time rule are the device's own navigation truth (the composition's
`depth` and overlay state — no parallel navigation state, and not P3-A's `view` field).

| Layer | Files |
|---|---|
| database | `database/migrations/0136_activity_attention_core_v1.sql`, `database/verify-migration-0136.mjs` |
| API | `apps/api/src/activity/` — `activity.types.ts`, `activity-decision.ts`, `activity-publisher.service.ts`, `activity.repository.ts`, `activity.service.ts`, `activity.controller.ts`, `activity.module.ts` (+ two specs); `app.module.ts` composes it; `http-security/route-rate-limit.census.ts` classifies its nine routes `AUTHENTICATED` |
| mobile transport | `runtime-entry/activity-api.ts` (`ActivityApiClient`, strict decoders); `mobile-runtime-entry.ts` gains `activityFor(bundle)` and exposes its one existing `foreground` signal |
| mobile Activity | `src/activity/` — controllers (`attention-controller`, `feed-controller`, `preferences-controller`), the law (`presentation.ts`, `call-truth.ts`), `copy.ts`, `time.ts`, `vocabulary.ts`, surfaces (`ActivityEntry`, `ActivitySurface`, `AttentionStrip`, `CallSafeStrip`) |
| integration | `integration-runtime.ts` builds / retires the three controllers per generation; `DepthComposition.tsx` composes the entry, the Activity overlay, Direct Entry execution, the surface truth and the strip host |
| shell slots | `ConversationSurface.tsx` gains one START-edge slot (`chromeStart`) in its upper chrome; it still draws one control of its own |
| settings | `settings/NotificationsSection.tsx`; `SettingsSurface.tsx` gains the real group and its page |
| iconography | `scripts/generate-p3-production.mjs` → `iconography/p3-production.generated.ts`; `iconography/P3Glyph.tsx` |

## 7. Persistence / schema (migration `0136`)

| Object | Purpose | Access |
|---|---|---|
| `public.activity_items` | the per-user projection: category, kind, interruption class, `critical` / `requested`, context kind + opaque ref + labels, ONE Direct Entry descriptor, speaker, bounded bilingual sentence, `actionable`, `disclosure_max`, coalescing key + member count, occurrence / expiry / withdrawal times, attention state, in-app evidence | owner `SELECT` (RLS); no client write |
| `public.activity_item_members` | one row per delivery intent (D57): `(user_id, candidate_key)` primary key, `source_ref`, withdrawal | no client privilege, no policy |
| `public.activity_preferences` | the frozen controls and defaults; no row = defaults; no column exists for critical security (D36) | owner `SELECT` |
| `public.activity_context_mutes` | per-context mute (D34) | owner `SELECT` |
| `server_publish_activity_candidate_v1`, `server_withdraw_activity_source_v1` | the two server passes | `service_role` only |
| `activity_private.*_own_*` + `public` INVOKER wrappers | seen / open / strip evidence / preferences / snooze / mute | `authenticated` only; owner = `auth.uid()` |

Frozen rules enforced by the database itself: the kind ↔ category map; Class 1 only when critical; `critical` only on
SECURITY and `requested` only on REMINDER; every Direct Entry destination inside its own authority scope (D43); QANDEEL
voice only in the QANDEEL category (D18); disclosure levels L0–L3; the attention lifecycle shape; L3 never a default;
Quiet Hours never a zero-length window. Deploy-time self-assertions refuse a client write, an anon read or a client-run
server pass. Erasure: every table references `public.users ON DELETE CASCADE`; the governed Personal erasure (0130)
removes every row (proved by the 0136 verifier and by 0130's own footprint sweep, §17).

**Implementation policy, not Product authority** (D32 freezes no retention period; none is promised): a publish removes
the recipient's items older than 90 days, keeps at most 2000 per recipient, at most 100 deletions per publish; a coalesced
item holds at most 64 members; Snooze ends within 7 days; the custom Snooze picker steps whole hours; Quiet Hours are
chosen on a 30-minute grid.

## 8. Activity projection

- **Event → projection.** One candidate for one recipient → one item (or a coalesced member); a replay of the same
  `candidate_key` answers `DUPLICATE` and changes nothing (D57).
- **Source independence.** The item carries an opaque `source_ref`; nothing in 0136 reads or writes a source table; opening,
  seeing, settling and muting write attention / evidence columns only (verifier §5; contract §7).
- **Categories** are preserved per item and drive the five filters (D28, D30).
- **Coalescing (D09).** Only Class ≥ 3, non-actionable, non-critical candidates of the SAME category, kind, class, voice,
  exact context and Direct Entry fold into the still-unseen item; never across Worlds or authorities (the key holds them
  all); one Direct Entry survives; the row shows the latest sentence; counts are rows, not members. Every candidate is
  first validated by the full table constraints as its own row (a defect the real-PostgreSQL verifier found and this task
  fixed: a coalescing candidate had bypassed the constraints).
- **Stale / withdrawn.** Expiry (D59) or a withdrawn source makes an item stale; a stale item never interrupts, never
  carries the mark and never resurrects (a replay is `DUPLICATE`).

## 9. Decision / orchestration

Server (`activity-decision.ts`), in I-08N-01 §19 order: stale → already seen → settled → controls (per-World mute, category
switches, Discovery opt-in, Introductions not entered, Proactive Off) → **Proactive Gate absent → fail closed** →
Class 4 ambient → Discovery never strips → Snooze / Quiet Hours in the device's IANA zone, except the two exceptions →
freshness (24 h, implementation bound) → ELIGIBLE. **Reduce** has no score, weight, class rule or threshold: with no
Gate runtime, Allow and Reduce both fail closed for proactive interruption (`QAN-BL-NOTIF-02` owns the Gate); Off
additionally drops the mark. Off never touches Memory, Understanding or the Analysis (D35).

Device (`presentation.ts`): background → wait; a strip showing → wait; a known Live Call → only the two call-safe
exceptions, dismiss-only form, nothing settled (no call is known in production); the Analysis → wait (critical security
outside a call included, P3 §8); the surface that IS the origin, or Activity → settled in place; otherwise ONE strip and
the rest settled. Ranking among eligible candidates — implementation choice, not Product law (P3 §8 leaves it to D11):
lowest class, then freshest.

Platform (`platformVerdict`, for A3-02): the product already has attention → no external interruption (D51); OS
permission is a hard boundary (D50); the P3 §14 ceilings over delivery EVIDENCE (4 / 24 h and 12 / 7 d ordinary;
1 / 24 h, 3 / 7 d, 48 h same thread proactive; 1 / 7 d Discovery; the two exceptions outside the budget); the lower of the
user's ceiling and the event's own projection (D17). Re-evaluation never flushes: `chooseOne` picks at most one.

## 10. Settings

General Settings gains its seventh real group, «الإشعارات والنشاط» / Notifications & Activity, in P1 §8.1's place (after
QANDEEL & Conversation), whose row opens the page as a state of the ONE destination (no route, no second framework).
Activity's own settings act opens the destination directly on that page; Back then returns to Activity. Sections, in P3
order: QANDEEL reaching out (Allow / Reduce / Off, help line for the selected one); Shared World (global switch; per-World
rows are drawn only for Worlds that exist for the reader — no Product route lists them yet, Stage 4); Public World
(interactions; Discovery OFF by default); Introductions (only once the capability is entered — not drawn today);
Security & Account (critical security is a sentence, not a switch; "other account updates" is a switch); Quiet Hours
(ON, 23:00 → 08:00, editable start / end, the "re-evaluated, never all at once" help); Snooze (1 h / 8 h / 24 h / Custom,
then its active state and End); Lock Screen previews (one ceiling per subject in the approved labels with help lines;
Introductions hidden with the capability); Device Notification Settings (a hand-off to the app's OS settings — the
notification-specific deep link is A3-02's). Every switch shows state by position, fill and words; every target ≥ 44 pt;
a change the server did not confirm keeps the confirmed state and says so once (the announcement is keyed on the failure, G-29).

## 11. Direct Entry

One typed descriptor (`ENTRY_DESTINATIONS`, once in the API; the client's `DirectEntryDestination`), constrained by the
database to its own authority scope (D43). Opening an item calls `POST /activity/items/:id/open`, which marks OPENED and
revalidates NOW (D38): `ENTER` into PERSONAL_CONVERSATION, QANDEEL_UNDERSTANDING or GENERAL_SETTINGS (SECURITY / ACCOUNT /
NOTIFICATIONS) — the composition executes these only; `STALE` → the explanation and only a safe act into its own
originating context, never a guessed replacement (D39); `UNAVAILABLE` → Shared / Public / Introductions / Replay
destinations stay typed but fail closed until their Stage owns a surface; `NO_ENTRY`; a foreign or malformed id → 404.
Opening resolves nothing (D40). Native-notification entry (A3-02) must call the same boundary.

## 12. Activity mobile surface

`ActivitySurface.tsx`: a full page over the Conversation without World navigation; non-Analysis appearance; the title
receives screen-reader focus; one chronological feed grouped Today / Yesterday / Earlier; filters as toggle buttons with
E1R SELECTED (weight + 2-pt marker) and indicators (Shared row count, System actionable count, presence otherwise,
Introductions presence only); rows with source / context identity, time, one sentence, optional secondary line; NEW =
solid presence mark, WAITING = hollow ring (shape, not colour), OPENED = secondary ink, stale = tertiary ink + words, muted
= «مكتوم» — every state also in the row's accessible name; rows seen at ≥ 50 % for 1.2 s (P3-A craft) become SEEN;
opening Activity clears nothing; loading / unavailable (with the frozen «إعادة المحاولة») / empty states; keyset paging
near the end. The source-glyph column draws Open Link for Introductions and P2's `settings` glyph for System; the P2
World navigation glyphs are not ported (§16).

## 13. Attention Strip

`AttentionStrip.tsx`: under the non-Analysis upper chrome, nonmodal, no scrim, the functional Surface tone, radius 14;
source · «الآن» meta, a two-line sentence, the body one Direct-Entry control, a 44-pt dismiss carrying the approved words
(no P2 close glyph is ported); calm entrance (opacity + 10 pt) or opacity only under Reduce Motion (the live
`useReduceMotion`, `ReduceMotion.Never` on every animation); a 6-s readable hold that pauses under a finger and never runs
under a screen reader; announced once. No bounce, pulse, countdown or progress. Timings are P3-A craft.

## 14. Analysis deferral and exit re-evaluation

The surface truth is the composition's own state; `setSurface('ANALYSIS')` makes ordinary attention wait (no strip, no
region, no announcement, nothing recorded) and removes a strip that was showing. Items stay in Activity with their mark.
Leaving the Analysis re-reads `/activity/attention` (current truth) and then presents at most one strip; every other
then-eligible candidate is settled; stale / muted / seen / in-origin candidates are not presented because they waited.
The strip host never mounts at the Analysis depth (contract §5), and the Analysis never receives the entry.

## 15. Call boundary

No canonical Live Call authority exists (`QAN-BL-VOICE-01`). `call-truth.ts` types the seam and production answers
`NO_CALL_KNOWN`; nothing fabricates an active call (contract §5). The call-safe decision path (only critical security and
a requested exact-time reminder; dismiss-only; nothing settled) is implemented and tested with fixture call truth;
`CallSafeStrip.tsx` is built, tested and shown on the device only as a labelled validation SPECIMEN, never mounted on a
Product route. The Replay-slot occlusion geometry belongs to the future mount (Stage 8).

## 16. Iconography

Open Ledger (22 px, stroke 1.66) and Open Link (20 px, stroke 1.75) are generated by EXECUTING the merged P3-A
`p3glyphs.mjs` — the generator refuses unless the accepted members are still `ledger` / `link`, Open Link is ring-free,
and P3-A's vendored `sig.mjs` is byte-identical to P2-A's — and drawn by `P3Glyph.tsx` through the installed Skia
renderer exactly as W1A-01's `Glyph` draws P2's. Decorative (hidden from assistive technology), never mirrored, rest ink,
never Brass. No runtime icon package, no `react-native-svg`. Quiet Bell / At the Door / the two-opening drawing are never
executed. Not ported, by the Task Contract's own limit: P2's World navigation family (still VPORT-02 G-14's owner) and
P2's `close` utility glyph (the dismiss carries approved words instead).

## 17. Tests

| Suite | Result |
|---|---|
| API `src/activity` (decision, service, controller, publisher) | **51 / 51** |
| API full (`npm run test:api`) | **218 suites / 4 963 tests pass**; `npm run build:api` clean; `tsc` clean |
| database static (`npm run test:database`) | **1 281 / 1 281**; `verifier-hazards` 0 findings |
| real PostgreSQL 17.10 (local, fresh cluster: bootstrap + 0001–0136) | **Migration `0136` itself: `verify-migration-0136` PASS on all ten stages** (catalog / privileges; publication + replay; authority constraints; account isolation; coalescing; attention ≠ resolution; withdrawal; strip evidence; preferences / Snooze / mute; retention + governed erasure). **Wider local verifier sweep (CI order): 133 / 137.** The four not passing locally are classified environment / baseline, not A3-01 regressions, and no Product code was changed for them: (a) two verifiers need a Redis server this host does not run; (b) `0133` shells out to a `psql` binary this PostgreSQL build does not ship; (c) `0130` fails two 7-day-window assertions on this host clock / timing — the identical two fail on the untouched baseline `34ea439` (with only those two neutralised in a scratch diagnostic copy, never committed, `0130` otherwise verifies end to end on the A3-01 set, including the Personal erasure of a populated footprint to zero rows). **The full integration-verifier sweep is NOT claimed green until CI (`api-ci`) proves it.** |
| mobile `src/activity` + A3-01 integration | **43 / 43** (attention law, controllers, strict wire, surfaces in ar / en × Dark / Light, Reduced Motion, screen reader, Notifications & Activity; 8 end-to-end scenarios on the production phase surface) |
| mobile full (`npm run test:mobile`) | **167 suites; 2 004 / 2 010 pass on this host** (clean worktree, full suite at the proof head `a50e847`: the same six, and only them). The six failures are pre-existing locale-dependent W1A-01 / session-state tests that assume an English device; the identical six fail on the untouched baseline on this host (`ar-EG`). Every A3-01 and re-anchored suite passes |
| mobile `tsc` / `expo lint` | clean / 0 errors (no warning in any A3-01 file) |
| root contracts | clean worktree at the proof head `a50e847` (no local `android/`): **1 102 / 1 102 — every root contract passes**, including `a3-01-activity-attention-inapp-contract` **12 / 12** and `forward-safety-contract` **35 / 35** (G-30). In this checkout five contracts that assert no `apps/mobile/android` directory exists fail only because of an ignored local native build folder |

Re-anchored (validation only, each with its reason in place): the three `AppModule` byte-pins (one more `.replace` for
`ActivityModule`, exactly as W3-MEGA-U / PROD-SEC-01 did), the W3-01 group-count contract (6 → 7 real groups), four
integration tests' exact group lists, and the runtime-entry barrel allowlist (`ActivityApiClient`, one plain class).

## 18. Integrated in-app proof

Harness (validation only): `A301ProofRoot.tsx` + `a301-proof-entry.tsx`, selected by `select-a301-proof-entry.mjs`
(`A301_INAPP_PROOF=1`, one `main` change in an ephemeral checkout), driven by `apps/mobile/.maestro/a3-01-activity.yaml`
and `a3-01-light.yaml` through `scripts/a301/run-a301-inapp-proof.sh`, on an Android API 36 emulator; mirrored in CI by
`.github/workflows/a3-01-inapp-proof.yml` (branch-scoped). The proof root is the ONE validation-only producer seam: an
in-memory stand-in for `/activity/*` announcing synthetic events by proof link; it is unreachable from a Product build.

**Proof head: `a50e847405f6eaa899d1a9c3ce27618abac62858`** — the Product Copy Gate binding head (§24a), i.e. the final
code head. The Release APK was built from exactly this commit (fresh
`expo prebuild` + `:app:assembleRelease -PreactNativeArchitectures=x86_64`, no build cache carried across heads) with
the ONE recorded difference applied in the ephemeral proof worktree — `apps/mobile/package.json` `main`:
`expo-router/entry` → `src/integration/__validation__/a301-proof-entry.tsx` (`select-a301-proof-entry.mjs --apply`).
APK SHA-256 `2a539a5d767831fd1f50681c511b36190af8e420c10e37fa1bd432a2be266a5e`. The generated world / P2 / P3
geometry was `--check`ed current before the build. Every commit after the proof head changes documentation only (§1). The screenshots show the approved Copy Gate wording
(e.g. Quiet Hours «من» / «إلى», «إنهاء الإيقاف المؤقت»).

Device: Android emulator `sdk_gphone64_x86_64`, Android 16 / API 36, 1080 × 2400 @ 420 dpi; Maestro 2.10.0.

| Leg | Setting | Flow | Result |
|---|---|---|---|
| `ar-standard` | Arabic (RTL), standard phone | `a3-01-activity.yaml` | **PASS** |
| `en-standard` | English (LTR), standard phone | `a3-01-activity.yaml` | **PASS** |
| `ar-rtl-device` | Arabic, Android system RTL layout forced | `a3-01-activity.yaml` | **PASS** |
| `ar-narrow` | Arabic, 320 dp wide | `a3-01-activity.yaml` | **PASS** |
| `en-narrow` | English, 320 dp wide | `a3-01-activity.yaml` | **PASS** |
| `ar-narrow-large` | Arabic, 320 dp at 200 % system text | `a3-01-activity.yaml` | **PASS** |
| `ar-increased` | Arabic, high-text-contrast (Increased Contrast) | `a3-01-activity.yaml` | **PASS** |
| `ar-reduced` | Arabic, launched under Reduce Motion (animator scales 0) | `a3-01-activity.yaml` | **PASS** |
| `en-light` | English, Light appearance (General Settings → Appearance) | `a3-01-light.yaml` | **PASS** |

**9 / 9 PASS**; 131 screenshots, a final hierarchy dump and a logcat per leg (no `FATAL EXCEPTION`, no JS error in any
logcat). Each `a3-01-activity` leg proves, by element, on the production phase surface: the global entry at the
Conversation's START edge (one control, not a fourth World); a synthetic arrival → one ordinary strip + presence mark;
dismiss keeps the mark (dismiss ≠ resolve); an arrival in its origin context → no strip; an arrival while in the Analysis
→ no strip and no Activity entry there; leaving the Analysis → exactly one strip; Activity: «الكل» / All grouped by day
newest first, the Shared filter, a stale row failing closed with its approved sentence, Back to the same Conversation;
Notifications & Activity: Allow / Reduce / Off (Reduce selected and confirmed), Quiet Hours, a Snooze set and shown,
the Lock Screen ceilings; and the call-safe strip only as a labelled validation specimen (no call runtime exists).
`en-light` proves the strip and Activity in Light and the Analysis staying one dark place with no entry.

Earlier runs (not closure evidence for the final head): `bc83f8c` (diagnostic, 9 / 9), `c05ccc1` (2 legs, stopped),
`c749b48` (9 / 9, before the Copy Gate binding), and a first `a50e847` run whose emulator process was stopped by the host
during the last leg (`en-light` FAIL with the device gone — an infrastructure stop, not a Product failure); the complete
9-leg matrix was then re-run from the start, on the same APK (SHA-256 re-verified), into a fresh evidence folder — the
result above. Review
of their screenshots found G-31 (fixed at the proof head); `c05ccc1`'s clean-worktree run found G-30. The CI workflow
re-proves every pushed head of this branch on GitHub's emulator.

## 19. Privacy / security

Owner-only everywhere (token identity; no route takes a user id; RLS + explicit `user_id` filter; members unreachable);
no cross-account leakage (verifier §3); no anon privilege; server passes `service_role` only; bounded disclosure (the
lower ceiling wins; importance never raises it; Introductions L0 by default; no category cap); no preview combines Worlds
(the projection is built from ONE event); revoked / muted / stale items never resurrect; nothing logs Activity content
(no log statement in the module; the global 503 names nothing). Export My Data does not yet carry the reader's
preferences and mutes — `QAN-BL-PRIV-02` (W3-PDG-01 §7.3; the `QAN-BL-PRIV-01` precedent). Erasure is complete.

## 20. Performance / fan-out

Every list is bounded (pages ≤ 50, attention read ≤ 500 rows, mutes ≤ 500, seen ≤ 64, settle ≤ 64, interruptions ≤ 8);
keyset paging on `(user_id, last_occurred_at DESC, id DESC)`; one recipient per publication (fan-out is the producer's
bounded concern), serialized per recipient, idempotent; bounded retention per publish. One new foreground read
(`GET /activity/attention`) every 30 s while the app is in the foreground, never in the background, plus reads on opening
Activity and leaving the Analysis — noted on `QAN-BL-PROD-04` (remote auth verification cost). No durable write sits on the
conversation response path.

## 21. A3-02 handoff

`QAN-BL-NOTIF-01` → `A3-02 — Native Push, Permission & Platform Delivery Integration` owns APNs, FCM, token registration /
rotation / removal, per-device delivery evidence, multi-device de-duplication, background delivery / retry, the OS prompt
and the education → prompt boundary (its copy is `AUDIT_OWNED`), iOS categories, Android channels, platform Lock Screen
projection, the app-icon badge, the notification-specific OS settings hand-off, native-notification Direct Entry, and
physical iOS / Android proof. Its provider-neutral contracts are ready: `ActivityPublisher` (one candidate boundary),
`platformVerdict` / `budgetVerdict` / `disclosureLevel` / `chooseOne` (the Product verdict it must ask), the `open`
revalidation boundary, and the stored Lock Screen ceilings. Its Exit Gate is recorded on the item. **A3-01 does not close
Stage 3.**

## 22. Backlog / map reconciliation

- **BG-05:** no item names A3-01; inherited none.
- **BG-08 admissions (five):** `QAN-BL-NOTIF-01` (A3-02), `QAN-BL-NOTIF-02` (`PROACTIVE-EVT-01`), `QAN-BL-NOTIF-03`
  (`REMINDER-EVT-01`), `QAN-BL-NOTIF-04` (`ACCOUNT-SEC-EVT-01`), `QAN-BL-PRIV-02` (`PRIV-EXPORT-01`) — each with one owner
  and an Exit Gate; no alias (the backlog held no notification / proactive / reminder / push / security-event item).
- **Notes:** `QAN-BL-PROD-04` gains a current-truth note (the 30-s foreground read); every other item unchanged.
- **Register:** 39 items — 13 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED`, 16 `CLOSED — TOMBSTONE`;
  24 `HIGH`, 14 `MEDIUM`, 1 `LOW` (mechanically from the §4 index).
- **Locators:** Stage 2 → `DONE / MERGED` (PR #306, `34ea439b…`); VPORT-02 row → merged; Stage 3 → `ACTIVE`; A3-01 → this
  Draft PR; A3-02 → the named remaining Stage-3 owner. `PROD-AUTH-01` / `PROD-DATA-01` are not promoted. Stage 3 is not
  called complete.

## 23. Stage-3 Gap Matrix

Classes: (1) already closed · (2) implemented here · (3) in-scope gap fixed here · (4) owned by an existing backlog item ·
(5) true dependency with a named owner and an Exit Gate · (6) not an obligation.

| # | Candidate | Source | Class | Disposition |
|---|---|---|---|---|
| G-01 | Activity destination, entry, mark, feed, filters, rows, states | P3 §3–§6 | 2 | §12, §14 |
| G-02 | Canonical candidate boundary + durable projection | Task §6.1–§6.2 | 2 | §6–§8 |
| G-03 | Attention eligibility + orchestration | Task §6.4; P3 §7–§9, §13–§15 | 2 | §9 |
| G-04 | Ordinary strip; Analysis deferral; exit re-evaluation | P3 §7–§8 | 2 | §13–§14 |
| G-05 | Direct Entry contract + revalidation | D38–D43 | 2 | §11 |
| G-06 | Notifications & Activity settings, Quiet Hours, Snooze | P3 §12–§13 | 2 | §10 (copy rows: G-21) |
| G-07 | Open Ledger, Open Link production port | P3 §5 | 2 | §16 |
| G-08 | Coalescing candidate bypassed the table constraints | found by the 0136 verifier | 3 | fixed: validated as its own row first (§8) |
| G-09 | Attention read in the background | found by the integration harness | 3 | fixed: reads only in the foreground |
| G-10 | Stale VPORT-02 locator status | Current State §3.7 / Map §5.1 | 3 | reconciled in this change |
| G-11 | Native Push, OS permission, channels / categories, badge, device proof | Task §17; P3 §18 | 5 | `QAN-BL-NOTIF-01` → `A3-02`; Exit Gate on the item |
| G-12 | Proactive Gate + proactive producer (Allow / Reduce effect) | I-08N-01 §4; P3 §12.1 | 5 | `QAN-BL-NOTIF-02` → `PROACTIVE-EVT-01` |
| G-13 | Requested-reminder runtime + producer | D06, D37 | 5 | `QAN-BL-NOTIF-03` → `REMINDER-EVT-01` |
| G-14 | Security / sign-in / account event source; any inline "review" act | D27, D36 | 5 | `QAN-BL-NOTIF-04` → `ACCOUNT-SEC-EVT-01` |
| G-15 | Shared producer; per-World mute rows; Shared Direct Entry + Replay entry | D24, D34 | 5 | Stage 4 — Shared World Product Integration (execution map). Exit Gate: publishes through `ActivityPublisher`; lists the reader's Worlds for the per-World rows; replaces `UNAVAILABLE` for SHARED_WORLD / REPLAY with a revalidated surface |
| G-16 | Public producer; Public Direct Entry | D25 | 5 | Stage 5 — Public World Product Integration. Exit Gate: same law for PUBLIC_WORLD |
| G-17 | Introductions capability entry, its settings / Lock Screen row, producer, entry | D26; P3 §12.2 | 5 | Stage 6 — Matching / Introductions Product Integration. Exit Gate: `INTRODUCTIONS_ENTERED` becomes real capability truth; publish via the boundary; L0 default kept |
| G-18 | Live Call truth; mounting the call-safe strip; Replay-slot occlusion | P3 §9 | 4 | `QAN-BL-VOICE-01` (unchanged; its future call authority replaces `PRODUCTION_CALL_TRUTH`) |
| G-19 | Export My Data carries no Activity preferences / mutes | W3-PDG-01 §7.3 | 5 | `QAN-BL-PRIV-02` → `PRIV-EXPORT-01` |
| G-20 | 30-s foreground attention read: auth-verification cost | PROD-READINESS-01 | 4 | `QAN-BL-PROD-04` (note added) |
| G-21 | Unapproved copy (Snooze state / End / picker; Quiet Hours labels; loading / failure; unavailable entry; save / page failure) | copy sweep §3.3 | 3 | **fixed in A3-01: the Product Copy Gate (§24a), APPROVED by the Product Owner and bound byte-exact** |
| G-22 | P2 World navigation glyphs as Activity row source marks | P3 §4 (identity "glyph / context") | 6 | identity is carried by approved words; the glyph port stays VPORT-02 G-14's owner (the first Global Switcher task, Stage 4) |
| G-23 | P2 `close` glyph for the strip dismiss | P3-A craft | 6 | the Task Contract ports only Open Ledger / Open Link; dismiss carries approved words |
| G-24 | Physical VoiceOver / TalkBack, iOS, haptics, device Increased Contrast | P3 §16, §18 | 5 | Release Hardening device gates (the owners VPORT-02 G-26 / G-27 / G-29 named) |
| G-25 | Retention period, ranking tie-break, 30-min Quiet Hours grid, hour-step custom Snooze | D32; P3 §8, §13 | 6 | implementation policy, recorded (§7, §9); no Product promise |
| G-26 | HIM / HSE "attention" | Task §4 | 6 | not Product attention; separation proved (§5) |
| G-27 | Six locale-dependent tests failing on an `ar-EG` host; five native-dir checks with a local `android/` | host | 6 | pre-existing / host-only; identical on the baseline; CI is the authority |
| G-28 | Local verifier sweep 133 / 137: two Redis verifiers, `0133` (needs `psql`), `0130` (two 7-day-window assertions on host clock / timing) | host | 6 | environment / baseline; `0130` identical on the untouched baseline; no Product code changed for them; the sweep is not claimed green until `api-ci` runs it |
| G-29 | Notifications & Activity save-failure announcement keyed on the rebuilt copy object (could repeat on re-render) | self-review | 3 | fixed: keyed on the failure and the one stable sentence (§10) |
| G-30 | The A3-01 contract asked git for the P3-A package status and read the root Project Map — neither exists in the forward-safety mirror (no repository; locators not mirrored), so `forward-safety-contract` failed | clean-worktree run | 3 | fixed: P3-A pinned by a content digest (140 files, as at the baseline); the Stage-3 owner read from this record. `forward-safety-contract` 35 / 35 |
| G-31 | The validation-only producer returned its seeded events in seed order, so the device screenshots showed «اليوم» / Today again below «أمس» / Yesterday | device-proof screenshot review | 3 | fixed in the validation producer: it answers in the server's order (`last_occurred_at DESC, id DESC`, as `ActivityRepository.page` does); production was never affected |

**Orphan gaps = 0.** Every candidate is implemented here, fixed here, resolved inside the active task (the Copy Gate, APPROVED), owned
by an existing backlog item, given a named owner with an Exit Gate, or shown not to be an obligation; none survives only in
this prose, and no backlog alias was created.

## 24. Orphan gaps

**Orphan gaps = 0** (matrix above).

## 24a. A3-01 Product Copy Gate — APPROVED by the Product Owner

Every row below is required by a control the Task Contract requires, and no earlier record approved it. The Product Owner
approved the wording below; it is bound **byte-exact** in `apps/mobile/src/activity/copy.ts` (`ACTIVITY_COPY_GATE`,
status `APPROVED BY THE PRODUCT OWNER — A3-01 PRODUCT COPY GATE`), and `a3-01-activity-attention-inapp-contract` §10
pins every row and the status. The English keeps the approval's straight apostrophe, as the P3 registry does. Four rows
differ from the proposal: `snoozeLonger`, `snoozeShorter`, `quietStart`, `quietEnd`. Everything else A3-01 shows is
CANON or P4-C4-APPROVED, byte-exact (contract §10). Reused unchanged: «إعادة المحاولة» / "Try again" (VI-01 T03). No
provisional copy remains.

| Key | Where | Arabic — APPROVED | English — APPROVED |
|---|---|---|---|
| `loading` | Activity, first page loading | جارٍ تحميل النشاط… | Loading Activity… |
| `unavailable` | Activity could not be read (beside «إعادة المحاولة») | تعذّر تحميل النشاط. | Activity couldn't load. |
| `entryUnavailable` | a row whose destination has no surface yet (Stage 4–8) | لا يمكن فتح هذا من هنا بعد. | This can't be opened from here yet. |
| `snoozeActive` | Snooze is on (`{0}` = device-local weekday + time) | الإيقاف المؤقت مفعّل حتى {0} | Snoozed until {0} |
| `snoozeEnd` | ends Snooze | إنهاء الإيقاف المؤقت | End Snooze |
| `snoozeUntil` | custom picker: the end it would set | حتى {0} | Until {0} |
| `snoozeLonger` | custom picker step | إضافة ساعة | Add an hour |
| `snoozeShorter` | custom picker step | تقليل ساعة | Subtract an hour |
| `quietStart` | Quiet Hours start edit label | من | From |
| `quietEnd` | Quiet Hours end edit label | إلى | To |
| `saveFailed` | a Notifications & Activity change not confirmed | تعذّر حفظ التغيير. حاول مرة أخرى. | The change couldn't be saved. Try again. |
| `settingsUnavailable` | the Notifications & Activity page could not be read | تعذّر تحميل إعدادات الإشعارات. | Notification settings couldn't load. |

## 25. Readiness recommendation

Implementation, tests, local real-PostgreSQL verification, the integrated proof harness, the governance reconciliation
and the Product Copy Gate (§24a, APPROVED) are complete on this branch. **`A3-01 READY FOR INDEPENDENT REVIEW — DO NOT
MERGE` is stated only once the Release APK built from the exact code head passes the full 9-leg proof (§18) and GitHub
CI is green on the final pushed head.** Backlog owners and Exit Gates are unchanged by the Copy Gate approval. Claude does
not merge. **A3-01 does not close Stage 3**: `A3-02` remains its named owner.
