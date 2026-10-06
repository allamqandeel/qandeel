# QANDEEL — S4-04 Shared Activity, Notifications & Direct Entry — Implementation Record v1

**Task:** `S4-04 — Shared Activity, Notifications & Direct Entry` (Stage 4 — Shared World Product Integration; the final
Stage-4 task named by the S4-01 Task Contract)
**Task Contract:** the Product Owner's S4-04 Task Contract (2026-10-06)
**Canonical baseline:** `71015d0f031a3e161542d5aad7d5796230bdb353` (the merge of PR #312, S4-03)
**Branch:** `feat/s4-04-shared-activity-notifications-direct-entry`
**Status:** **`S4-04 IMPLEMENTED — REVIEW CANDIDATE (open PR) — S4-04 PRODUCT COPY GATE CLOSED (1 row APPROVED — Product Owner, 2026-10-06, reconciled in S5-01 R1) — NOT MERGED`**.
Claude does not merge it.

> The real Shared World meets the already-merged Activity / Notifications / Push infrastructure: genuine Shared facts
> become recipient-scoped Activity through the ONE A3-01 boundary; an Activity row, the Attention Strip, a native
> notification tap or a QANDEEL link opens the EXACT Shared World through the existing Shared entry authority; each of
> the reader's current Worlds can be muted on its own; and the first legitimate Shared entry offers the existing,
> approved notification education.

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `71015d0f031a3e161542d5aad7d5796230bdb353` — `origin/main` confirmed equal at kickoff (the expected baseline; `main` had not moved) |
| Branch | `feat/s4-04-shared-activity-notifications-direct-entry`, cut from `origin/main` |
| PR | `S4-04 — Shared Activity, Notifications & Direct Entry` (opened at the first push; number recorded in the PR conversation) |
| Head | the review-candidate commit recorded in the PR conversation |
| Next migration | `0141` (the highest on `main` was `0140_shared_world_lifecycle_governance_product_v1.sql`) |

## 2. Anti-Duplication Gate

| Asked for | Already on `main` (consumed, not rebuilt) | Gap found | S4-04 adds |
|---|---|---|---|
| Shared Activity producer | `ActivityPublisher.publish(candidate)` (A3-01, `0136`), `SHARED_ACTIVITY` → SHARED → `SHARED_WORLD` context, the attention decision, coalescing, D57 idempotency, the L2 Shared default | no producer anywhere (A3-01 §3.2); the Shared API runs only on the caller's token and never learns another member's id | ONE producer (`shared-world/shared-activity.producer.ts`) publishing through `ActivityPublisher` only; ONE service-role server pass (`0141`) that derives recipients from durable Shared truth |
| Push for Shared | A3-02 planning (`interruption_class < 4`), revalidation through `platformVerdict`, Lock Screen projection (`p3.generic.shared`, L2 title), Android `category-shared` channel | none | nothing — Shared items flow through A3-02 unchanged |
| Direct Entry | the typed `SHARED_WORLD` destination (fails closed), Activity `open` revalidation, the notification tap inbox, the Shared controller's `openWorld(worldId)` with its neutral pre-ALLOW shell | the destination is not executable; no production `qandeel://` handler exists | `SHARED_WORLD` executes after a CURRENT entry verdict; the composition opens it through `openWorld`; one strict link form through the same path |
| Per-World mutes | `activity_context_mutes`, the D34 mute law, the global Shared switch, the `«مكتوم»` row state | the 0136 mute command refuses a World until it has produced an Activity item (`UNKNOWN_CONTEXT`); no route lists the reader's Worlds for Settings | `list_own_shared_world_alerts_v1` / `set_own_shared_world_alerts_v1` — the Shared domain authorizes the World by the entry law and writes the ONE A3-01 mute table; the rows in Notifications & Activity |
| First-entry education | `PushController.offer`, `PermissionEducationSheet`, the APPROVED A3-02 copy, decline memory, the single OS-prompt call site | no Shared moment | the `SHARED_FIRST_ENTRY` moment and its one call at the first ALLOW |
| Replay | `REPLAY` typed, failing closed; the Replay backend runtime (I-06) with no Product surface | — | nothing: generic Replay Product integration is Stage 7; no production Replay surface exists to consume, so `REPLAY` stays fail-closed (§6) |

No event feed, notification store, mute table, attention system, permission flow, Shared navigator or permission copy is
created.

## 3. Authority map

| Subject | Authority (binding) |
|---|---|
| Which Shared facts may interrupt | I-08N-01 D24 ("Shared activity earns interruption based on user relevance, not merely because activity occurred"); D10 (classes); D23 (an eligible reason is not an automatic trigger) |
| Disclosure | I-08N-01 D14–D17; P3 §10 (Shared default L2; L3 never default; the lower ceiling wins) |
| Per-World control | I-08N-01 D34; P3 §12.2 |
| Direct Entry | I-08N-01 D38–D43; P3 §15; I-08A4 §5 (never guess a substitute); CW2-07 §19 (authority before content) |
| Permission education | P3 §11; I-08N-01 D50; A3-02 record §8 and §22 G-12; the A3-02 Product Copy Gate (APPROVED) |
| The Shared truth | S4-01 / S4-02 / S4-03 records; migrations `0138`–`0140` over the frozen I-04 runtime |
| Implementation | A3-01 record §6–§11; A3-02 record §6–§14 |

## 4. Implementation

| Layer | Files |
|---|---|
| Database | `database/migrations/0141_shared_activity_notifications_v1.sql`; `database/verify-migration-0141.mjs` |
| API — producer | `apps/api/src/shared-world/shared-activity.producer.ts`, `shared-activity.repository.ts` (server channel, one pass), `shared-activity-copy.ts`; `shared-world.controller.ts` (publication after a committed outcome); `shared-world.module.ts` (imports `ActivityModule`) |
| API — alerts | `shared-world-alerts.repository.ts` / `.service.ts`; two routes; `http-security/route-rate-limit.census.ts` |
| API — Direct Entry | `activity/activity.types.ts` (`SHARED_WORLD` executable), `activity.service.ts` (`open`), `activity.repository.ts` (`sharedEntry`) |
| Mobile — transport | `runtime-entry/activity-api.ts` (the `SHARED_WORLD` destination, strictly decoded), `runtime-entry/shared-world-api.ts` (`alerts`, `setAlerts`) |
| Mobile — Direct Entry | `integration/composition/DepthComposition.tsx` (`enter` → `runtime.sharedWorld.openWorld`; the link inbox; the education moment); `shared-world/shared-link.ts`, `linking-source.ts`; `integration/runtime/integration-runtime.ts` |
| Mobile — mutes | `shared-world/shared-alerts-controller.ts`; `settings/NotificationsSection.tsx` (the rows), `SettingsSurface.tsx`; `activity/copy.ts` (`p3.mutedWorld`) |
| Mobile — education | `push/push-controller.ts` (`SHARED_FIRST_ENTRY`) |
| Proof | `apps/api/src/shared-world/shared-activity.spec.ts`; `apps/mobile/src/integration/__tests__/s4-04-shared-direct-entry.test.tsx`; `apps/mobile/src/shared-world/__tests__/s4-04-alerts-link-education.test.ts`; `tests/s4-04-shared-activity-notifications-direct-entry-contract.test.mjs` |
| Adjusted existing proofs | `apps/api/src/activity/activity.spec.ts` (a Shared row is now a Direct Entry; Stage 5–8 + Replay stay closed); `tests/a3-01-activity-attention-inapp-contract.test.mjs` test 7 (the `EXECUTABLE_DESTINATIONS` literal gains `SHARED_WORLD`); the mobile integration harness gains a `sharedLinks` port (default: none); because entering a World is now a legitimate education moment, the S4-01 navigation journeys (Jest and the S4 device proof root `S401ProofRoot.tsx`) run with "Not now" already chosen on their installation and, on device, the inert notification port — they prove navigation; the education is proven by the S4-04 suite; `.github/workflows/s4-proof.yml` adds this branch so the existing S4 device legs re-run on its head |

### 4.1 Migration `0141` (forward-only, no table)

- `public.server_read_shared_activity_source_v1(kind, id)` — pinned `public` SECURITY DEFINER, `service_role` only (the
  0136 server-pass precedent; `shared_private` grants the server channel nothing new, which the 0139 / 0140 verifiers pin).
- `shared_private.list_own_shared_world_alerts_v1()` / `set_own_shared_world_alerts_v1(world, muted)` behind SECURITY
  INVOKER `public` wrappers, `authenticated` only.
- `shared_private.shared_activity_world_name_v1` — internal, nobody's.
- No table, column, policy or trigger; no `commit_%` name; deploy-time self-assertions refuse any client reach to the
  server pass and any server reach to the `shared_private` functions.

**Historical-verifier hazard census** (checked before names and grants were chosen): `0071` / `0139` / `0140` (one
`service_role` `commit_%`; the server channel reaches exactly the three S4-02 reply-work commands in `shared_private`) —
respected; `0115` (the callers of `resolve_shared_world_history_visibility_v1`) — 0141 calls only the material resolver,
which that census does not cover; `0133` (hosted == CI ACL) — every 0141 function is revoked from PUBLIC / anon /
authenticated / service_role before its exact grant; `0136` (its own named function and table lists) — untouched; 0136's
mute table gains rows only through the new Shared-authorized command. No historical verifier needed re-anchoring.

## 5. Privacy / security

- **Recipients are never the caller's claim.** The API hands the server pass the identity of ONE committed fact (a
  material, a proposer's command, a proposal, an acceptance command, a World, a leave command) and nothing else. The
  database derives the recipients from durable Shared truth (§7).
- **No hidden truth leaks.** A message tells only current members to whom the ONE frozen material resolver returns it now
  (a deleted or invisible message tells nobody). A proposal tells exactly the people it waits on (S4-03's read law) —
  never the proposer, never the removal target. An add / rejoin request tells its target with the proposer's Name and
  NOTHING of the World (no label; destination `NONE`, since the target cannot enter before acceptance). Add / rejoin
  targets are never named to members before acceptance (the approved S4-03 words). No approver list, no count.
- **No content anywhere.** No message text, transcript, preview or derived meaning enters a candidate, a notification or
  a log; the ambient sentence is p3.generic.shared. The World label is its committed name only (else none, and the L2
  title falls back to «العالم المشترك»).
- **Disclosure** is published at `L2` (the Shared default); the reader's own ceiling may lower it; importance never raises it.
- **No logs**: no file under `apps/api/src/shared-world/` logs (pinned by the S4-01 / S4-03 / S4-04 contracts).
- **Former membership restores nothing**: the removed or departed member receives no Activity for that World; the per-World
  rows list current Worlds only; a mute of a former World is one neutral `UNAVAILABLE`.
- **Activity reads no Connected Worlds table**: its Direct Entry asks the S4-01 entry verdict on the caller's own token.

## 6. Direct Entry law

```text
Activity row / Attention Strip / native tap ──► POST /activity/items/:id/open      (A3-01; another account's item → 404 → nowhere)
                                                 ├─ OPENED + SHARED_WORLD(ref = context = World W)
                                                 │    └─ resolve_own_shared_world_entry_v1(W) on the caller's token NOW
                                                 │         ALLOW for exactly W → ENTER { SHARED_WORLD, W }
                                                 │         anything else       → UNAVAILABLE, no fallback
                                                 ├─ STALE / withdrawn          → fail closed (no guessed World)
                                                 └─ REPLAY / PUBLIC / INTRODUCTIONS → UNAVAILABLE (Stages 7 / 5 / 6)
QANDEEL link qandeel://shared/world/<W> ──► strict parse → app-level inbox (dropped when signed out) ──┐
ENTER { SHARED_WORLD, W } ──────────────────────────────────────────────────────────────────────────┴─► enter():
    close Activity / Settings / Understanding; return to the Conversation depth; runtime.sharedWorld.openWorld(W);
    area = SHARED_WORLD → the Shared controller resolves W again → neutral shell until ALLOW → the World
                                                                  → one neutral «هذا غير متاح الآن.» otherwise
```

Never trusted: a notification or link only names W. Never cached: authority is resolved at open AND at entry. Never
guessed: the item's destination must equal its own context, and the device opens exactly W. The Personal world is not
touched (it stays mounted beneath; its store is unchanged — proven). Back follows the Shared local law (World → Shared
root); no notification / link history is manufactured.

**Replay boundary.** `REPLAY` remains a typed destination that fails closed. No production Replay Product surface exists
(the Replay backend runtime has no Product route or mobile surface; `QAN-BL-NAV-02`), so there is nothing S4-04 could
consume without implementing Stage 7. Not absorbed.

## 7. Activity producer map

| Shared fact (durable source) | Published when | Recipients (derived by `0141`) | Class | Sentence (body / secondary) | Entry | Key |
|---|---|---|---|---|---|---|
| Human message (`shared_world_materials`, HUMAN_TEXT) | `send` → COMMITTED | current members, not the author, who can see it | **4** ambient | p3.generic.shared «نشاط جديد في العالم المشترك» | `SHARED_WORLD` | `s4-04:human-text:<material>` |
| Governance proposal — settings / removal / end / add / rejoin (`0084` + `0140` origin) | a propose route → PROPOSED (add / rejoin: SUBMITTED) | the people it waits on; never the proposer or removal target; only while current, actionable, uncommitted | **3** | the S4-03 proposal row / «اقتراح من {0}» | `SHARED_WORLD` | `s4-04:proposal:<command>` |
| Add / rejoin request now waiting on its target | `approve` → INVITED | the target alone | **3** | S4-03 `memberRequestAdd` / `memberRequestRejoin` | `NONE`, no label | `s4-04:member-request:<proposal>` |
| Member joined by add / rejoin (`0085` acceptance / rejoin command) | `acceptMembershipRequest` → JOINED (the joiner's own request item is withdrawn) | the other current members | **3** | «انضم {0} إلى هذا العالم.» (APPROVED, §11) | `SHARED_WORLD` | `s4-04:joined:<command>` |
| World born (`0082` acceptance command) | `accept` → BORN | the inviter | **3** | as above | `SHARED_WORLD` | `s4-04:birth:<World>` |
| Voluntary leave (`0083` leave command) | `leave` → LEFT | the remaining current members | **4** ambient | p3.generic.shared | `SHARED_WORLD` | `s4-04:left:<command>` |

All: `kind: SHARED_ACTIVITY`, `speaker: PRODUCT`, `contextRef` = the exact World, `disclosureMax: L2`, no expiry.
**Class 1 is never Shared** (D10). **Class 2 is not used**: no Shared fact here carries a genuine timing window in its
source truth. **Class 4 never interrupts and never pushes** (A3-01 `AMBIENT`; A3-02 plans only `< 4`), so no ordinary
message becomes a Push. **Idempotency**: the key is the durable fact's own identity, so a retried command is a 0136
`DUPLICATE` (D57). **Failure isolation**: publication runs after the Shared answer is decided and never changes it; a
failure is absorbed (the fact is durable; nothing is logged).

**Deliberately not published** (D24 names these as *potentially* eligible; the source domain's own gate declines them,
D23): a pre-birth invitation (no World exists yet — a `SHARED_WORLD` context must be an exact World, D43; the invitation
stays on the Shared root, §13 note); a committed settings change / removal / World end (unanimity: every recipient took
part in it); the removal itself to the removed member (former membership restores nothing); history-sharing packages
(the required approvers already see them in Manage World / Privacy & Data; no approved Activity sentence exists, and none
is invented); the QANDEEL reply (part of the requester's own exchange; others already hold the ambient message item);
a deletion (the ambient item carries no content, so nothing becomes ghost history).

## 8. Per-World mute proof

| Law | Proof |
|---|---|
| Current Worlds only; no count | 0141 verifier (`alerts`): a former member, a stranger and an unknown World see nothing and get `UNAVAILABLE`; API spec C |
| Muting World A mutes no other World and no other reader | 0141 verifier (one row, the World id, the A3-01 table); API spec C (`silenceOf` / `interruptionVerdict`: A `MUTED_CONTEXT`, B `ELIGIBLE`); mobile integration C |
| Unmute restores eligibility | 0141 verifier; API spec C; mobile integration C |
| Presentation only | 0141 verifier (episode and material counts unchanged); mobile integration C (no entry, material, send, leave or proposal call) |
| Global control stays global | API spec C (`sharedAlerts: false` → `CATEGORY_OFF`) |
| The 0136 command's gap is closed without broad access | the Shared domain authorizes by the entry law and writes only `activity_context_mutes` (contract test 2) |

## 9. Permission education proof

| Law | Proof |
|---|---|
| Nothing at launch / at the Shared root / on a refused entry | mobile integration D (three cases) |
| The first ALLOW offers the EXISTING sheet with the APPROVED A3-02 words | mobile integration D (title and body bytes from `pushCopy`) |
| Not now keeps Shared usable; decline memory prevents repeated asks (another World, another world on the same device, another moment's decline) | mobile integration D; unit D |
| Allow → the real OS prompt, once, after the education | mobile integration D; the A3-02 contract still pins ONE `requestPermission` call site |
| A granted / refused device is never asked; the moment never hands off to settings | unit D |

## 10. Test / CI evidence (local, before the first push)

| Check | Result |
|---|---|
| `node --check database/verify-migration-0141.mjs` | clean (the real-PostgreSQL run is CI's; this workstation has no PostgreSQL) |
| API `tsc --noEmit` | clean |
| API jest (full, incl. the S4-04 spec and the route census) | **225 suites, 5084 / 5084** |
| Mobile `tsc --noEmit` | clean |
| Mobile jest — S4-04 integration (12) + unit (8) | 20 / 20 |
| Mobile jest — full | **2153 / 2159**; the 6 failures (`depth.test.tsx`, `w2-account-access.test.tsx`) are the Arabic host locale, identical on the baseline (G-28) |
| Mobile `eslint` (every changed mobile file) | clean |
| Static database tests (`test:database`) / `verify:db:hazards` | **1304 / 1304** / 0 findings |
| Root contracts (`node --test tests/*.test.mjs`, the ignored `apps/mobile/android` moved aside) | **1172 / 1172** |
| Forward-only | `0001`–`0140` byte-identical to `origin/main`; `0141` is the only migration added |

No device leg was added: every S4-04 law is deterministic at the integration level with test ports (no APNs / FCM
hardware); the existing S4 device legs re-run on this branch's head through the S4 proof workflow.

## 11. S4-04 Product Copy Gate — **CLOSED — 1 row APPROVED**

*Reconciliation (S5-01 R1, 2026-10-06):* S4-04 merged with this gate still open. The Product Owner has since approved
`joined` exactly as below. This is copy governance only; S4-04 behaviour and bytes are unchanged.

Every other word is reused byte-exact from an approved source (pinned by the S4-04 contract): p3.generic.shared, the
S4-01 «شخص ما» / Someone, the S4-03 proposal rows, «اقتراح من {0}», the two membership-request rows, p3.on and
p3.mutedWorld («مكتوم» / Muted). The education sheet is A3-02's, unchanged.

| Key | Surface | Arabic | English | Status |
|---|---|---|---|---|
| `joined` | Shared Activity row (a person joined the World the reader is in — governed add, rejoin, or the birth for the inviter) | «انضم {0} إلى هذا العالم.» | "{0} joined this world." | **APPROVED** (Product Owner, 2026-10-06) |

`{0}` is the person's own Name («شخص ما» / Someone when unset).

## 12. Backlog reconciliation (BG-05 / BG-08)

- **Inherited:** none — no backlog item names S4-04 as owner.
- **Reopen conditions observed:** `QAN-BL-PRIV-02` — its current truth said no producer exists; a Shared producer now
  exists and per-World mute rows now reach the same table. The item's scope is unchanged (`DEFERRED — OWNED`,
  `PRIV-EXPORT-01`); a current-truth note is added. `QAN-BL-NOTIF-05` (physical-device Exit Gates) is unchanged and
  not claimed. `QAN-BL-ACCT-01` stays `OPEN — UNASSIGNED`: S4-04 takes Shared further toward users without opening
  any launch scope.
- **Admitted:** none.
- **Unchanged:** `QAN-BL-VOICE-01`, `QAN-BL-CW-01`, `QAN-BL-CW-02`, `QAN-BL-LAUNCH-03`, `QAN-BL-CI-01`,
  `QAN-BL-NOTIF-02` … `04`, `QAN-BL-NAV-02` and every other item. The register still holds **43** items.

## 13. Stage-4 Gap Matrix (final)

Classes: (1) already closed · (2) implemented here · (3) in-scope gap fixed here · (4) owned by an existing backlog item ·
(5) true dependency with a named owner · (6) not an obligation.

| # | Candidate | Class | Disposition |
|---|---|---|---|
| G-01 – G-03 | Reachability, invite, receive / accept / decline | 1 | S4-01 (merged) |
| G-04 | Birth and welcome | 1 | S4-01; final birth scene decided T-A + B-A (S4-03, merged) |
| G-05 | Shared conversation / attribution | 1 | S4-02 (merged) |
| G-06 | Shared voice notes | 4 | `QAN-BL-VOICE-01` |
| G-07 | Human live call | 5 | `CW-I09` / pre-launch (unchanged) |
| G-08 | Standing context in a World | 1 / 4 | Shared-history portion S4-02; private-context portion `QAN-BL-CW-02` |
| G-09 – G-13 | Add / remove / rejoin, settings, history, leave, closure | 1 | S4-03 (merged) |
| G-14 | Delete own material | 1 / 4 | S4-02; `QAN-BL-CW-01` before Public drafts open |
| G-15a | Cross-World entry through the switcher | 1 | S4-01 |
| **G-15b** | Direct Entry into a Shared World from a link / notification | **2** | §6 — Activity row, strip, native tap, QANDEEL link |
| **G-16** | Shared Activity producer; per-World mute rows | **2 / 3** | §7, §8 — the 0136 mute gap closed through the Shared authority |
| **G-17** | Permission education at first Shared entry | **2** | §9 |
| G-18 | Restricted states; report / block | 5 | `CW-I09` / `CW2-08` (unchanged) |
| G-19 | Former member's own-material control | 1 | S4-03 |
| G-20 – G-22 | Shared ID; Global Switcher; P2 navigation family | 1 | S4-01; `navPublic` → Stage 5 |
| G-23 | Production enablement of the Shared launch gate; the full CW2-08 platform | 5 | `I-09` / `CW2-08`; prerequisite `QAN-BL-ACCT-01` |
| G-24 | Shared ID sealing key custody | 4 | `QAN-BL-LAUNCH-03` |
| G-25 | World-Transition motion review | 1 | decided T-A (S4-03) |
| G-26 | iOS / physical device journeys | 5 | Release Hardening & Launch; `QAN-BL-NOTIF-05` for Push |
| G-27 | PROPOSED copy rows | — | S4-01 … S4-04 gates CLOSED (the S4-04 row APPROVED after merge, reconciled in S5-01 R1) |
| G-28 | Six host-locale mobile Jest tests | 6 | environment; identical on the baseline |
| G-29 | iOS Maestro / XCTest driver readiness | 4 | `QAN-BL-CI-01` |
| G-30 | Replay Direct Entry (A3-01 G-15 named it beside Shared) | 5 | Stage 7 (generic Replay Product integration; `QAN-BL-NAV-02`) — explicitly out of S4-04 by its Task Contract |
| G-31 | Pre-birth invitation as Activity (D24 "invitation") | 6 | not an obligation: D24 makes it *potentially* eligible; the A3-01 typed context requires an exact World (D43) and none exists before birth. The invitation is shown on the Shared root. Reported to the Product Owner as an observation, not a gap |

**Orphan gaps = 0.**

## 14. Residual ownership

Everything Stage 4 did not deliver has a named owner above: `QAN-BL-VOICE-01`, `QAN-BL-CW-01`, `QAN-BL-CW-02`,
`QAN-BL-LAUNCH-03`, `QAN-BL-ACCT-01`, `QAN-BL-CI-01`, `QAN-BL-NOTIF-05`, `CW-I09` / `CW2-08` / `I-09`, Stage 5 (Public),
Stage 6 (Introductions), Stage 7 (Replay), Release Hardening & Launch.

## 15. Stage-4 status

S4-04 satisfies G-15b, G-16 and G-17 and leaves no unowned Stage-4 Product gap. **Stage 4 — Shared World Product
Integration = DONE / awaiting merge** (of this PR; the one PROPOSED copy row is the Product Owner's to decide before
merge). No Stage 5 work is opened on this branch.
