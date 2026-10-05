# QANDEEL — S4-03 Shared Membership Lifecycle, Governance, Settings & Historical Access — Implementation Record v1

**Task:** `S4-03 — Shared Membership Lifecycle, Governance, Settings & Historical Access Production Integration v1` (Stage 4 —
Shared World Product Integration)
**Task Contract:** `QANDEEL_S4-03_SHARED_LIFECYCLE_GOVERNANCE_TASK.md` (Product Owner, `READY FOR IMPLEMENTATION — DO NOT MERGE`)
**Product Owner decisions:** `S4-03 — PRODUCT OWNER DECISIONS / PRE-PUSH CORRECTION` (2026-10-05), applied in §4 / §9 / §11
**Canonical baseline:** `5ea952027d8c230d5d22d82e206394a985954934` (the merge of PR #311, S4-02)
**Branch:** `feat/s4-03-shared-lifecycle-governance`
**Status:** **`S4-03 IMPLEMENTED — REVIEW CANDIDATE — PRODUCT OWNER DECISIONS APPLIED — S4-03 PRODUCT COPY GATE CLOSED — NOT MERGED`**.
Claude does not merge it. The review candidate is pushed only after the Product Owner closed the Copy Gate (§11).

> The Shared World's lifecycle becomes real Product over the frozen I-04 runtime: a current member opens «إدارة العالم» /
> Manage World inside the exact World, sees its committed settings and the proposals that wait on them — each with who
> proposed it and the neutral progress, never who approved — proposes a settings change, a removal, the World's end, or
> adding a member / bringing a former member back by that person's CURRENT Shared ID (never approving by proposing),
> approves, shares earlier words with one member through an exact item-level preview, leaves at once, reads an ended World
> read-only through their closed-view entitlement, and controls — and, where their material authority survives, approves
> sharing — their own words in Worlds they left through Privacy & Data.

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `5ea952027d8c230d5d22d82e206394a985954934` — `origin/main` confirmed equal at kickoff; PR #311 `MERGED` |
| Branch | `feat/s4-03-shared-lifecycle-governance`, cut from `origin/main` |
| PR | opened at the first push of the review-candidate head, after the Product Owner closed the Copy Gate |
| Head | the review-candidate commit recorded in the PR conversation |

## 2. Start Gate

| Check | Result |
|---|---|
| `origin/main` | `5ea952027d8c230d5d22d82e206394a985954934`, equal to the Task Contract baseline; no re-cut |
| PR #311 | `MERGED`; merge commit `5ea9520` |
| Working tree | clean at kickoff |
| Next migration | `0140` (the highest on `main` is `0139_shared_world_conversation_material_v1.sql`) |
| Read in full | Current State, Project Map, Product Roadmap, the canonical backlog (BG-05), I-04 record, S4-01 / S4-02 records, the Shared World Product Definition, CW2-01 / 02 / 03 / 07 / 08 (through four bounded census passes), P1 §5 / §13, migrations `0081`, `0083`–`0088`, `0119`, `0129`, `0138`, `0139` and their verifiers, `apps/api/src/shared-world/**`, `apps/mobile/src/shared-world/**`, General Settings / Privacy & Data |

## 3. Validation Impact Census

| Area | Paths | What binds them |
|---|---|---|
| Database | `database/migrations/0140_*.sql`; `database/verify-migration-0140.mjs`; `database/tests/shared-world-lifecycle-governance-product-v1.test.mjs`; `database/README.md` | `test:database`; `verify:db:hazards`; the whole-schema historical verifiers (§3.1) |
| API | `apps/api/src/shared-world/` (controller, module, `shared-world.service.ts`, the lifecycle repository / service / spec, `shared-world.spec.ts`); `http-security/route-rate-limit.census.ts` | the route census spec; `tests/s4-01-…` test 2 (no `@Query(`, no identity parameter; `shared-world.repository.ts` untouched — it may call only 0138 wrappers); `tests/s4-02-…` test 2 (the conversation repository untouched) |
| Mobile | `apps/mobile/src/shared-world/*` (controller, area, thread read-only row, Manage World, ended World, the copy module); `runtime-entry/shared-world-api.ts` + `index.ts`; `settings/` (former-material controller / section, `SettingsSurface.tsx`, `index.ts`); `integration/runtime/integration-runtime.ts`; `integration/composition/DepthComposition.tsx`; `integration/__validation__/s401-proof-world.ts`, `S401ProofRoot.tsx`; tests | `tests/s4-01-…` tests 4–6 (the area's four props; no Arabic literal; no proof code); `tests/s4-02-…` test 5 (the composer `KeyboardAvoidingView` string); `tests/w3-02-…` (the `SettingsSurface` prop order); `t12p`; `t12` Phase M |
| Proof | `apps/mobile/.maestro/s4-03-journey-{a,b}.yaml`; `scripts/phase-m/run-s401-proof-leg.sh`; `.github/workflows/s4-proof.yml` (branch trigger) | `proof-legs.mjs` derivation; `tests/s4-0*-…` test 6 / 7 |
| Root contract | `tests/s4-03-shared-lifecycle-governance-contract.test.mjs`, registered in `package.json`, API CI and Mobile CI | the forward-safety contract reruns every root contract |
| Docs | this record; the visual decision package; `QANDEEL_CURRENT_STATE.md`; `QANDEEL_PROJECT_MAP.md`; `docs/qandeel-canonical-backlog-v1.md` | the backlog readers; `task-closure-governance` |

### 3.1 Historical-verifier hazard census (before any name or grant was chosen; re-run for the corrections)

| Verifier | Whole-schema / exact assumption | 0140 choice |
|---|---|---|
| `0071` (+ `0139` repeats it) | exactly one `service_role`-executable public `commit_%` function | no S4-03 name starts `commit_`; nothing granted to `service_role`; the deploy-time self-assertion refuses a `commit_` name |
| `0139` | `service_role` executes exactly the three reply-work commands in `shared_private` | `service_role` is granted nothing and explicitly revoked from every 0140 function and from the one 0140 table |
| `0139` / `0138` | `SHARED_LIVE_CALL` / `PUBLIC_EVERYTHING` must stay refused by the scope CHECK | neither literal added; the CHECK gains exactly `SHARED_GOVERNANCE`, `SHARED_HISTORY_ACCESS` |
| `0138` | zero rows in `shared_launch_capability_states`; no `shared_private` column matching `shared_id\|plaintext\|clear`; its own table list | 0140 seeds nothing; its one table (`shared_governance_proposal_origins`) has no such column (its own self-assertion also refuses `lookup_ref`); the 0138 / 0139 table loops are explicit lists, untouched |
| `0133` | no new public function keeps PUBLIC / anon EXECUTE; the hosted-default scratch replay equals CI | every 0140 function and the table are revoked from PUBLIC, anon, authenticated AND (when present) `service_role` before the exact `authenticated` grant (functions only) |
| `0115` | the exact `public` callers of `resolve_shared_world_history_visibility_v1` | the only new caller is a `shared_private` helper (the census is `public`-only) |
| `0088` / `0090` / `0114` / `0117` / `0118` / `0119` / `0121` / `0122` | exact `public` writer lists (`INSERT INTO`, body `DELETE`, closed entitlements, …) | 0140's only own write is `INSERT INTO shared_private.shared_governance_proposal_origins`, in a `shared_private` helper; every public write is inside a frozen core |
| `0081` / `0085` / `0084` | their own functions' bodies, no trigger on their tables | the 0081 credential row is only READ (FOR SHARE) by 0140; no trigger, no `CREATE OR REPLACE`; no verifier censuses the callers of the 0085 / 0084 cores 0140 now consumes (`prepare_*_add_member` / `_rejoin`, `dispatch_…`, `accept_…`, `commit_…_rejoin`, `resolve_…_approval`) — checked |
| `0083`–`0088`, `0119` | every frozen core executable by no application role; no trigger added; no `CREATE OR REPLACE` | no grant on a frozen core; no trigger; no `CREATE OR REPLACE`; the self-assertion re-proves the ACL |
| name-pattern verifiers (`0098`, `0104`, `0112`, `0125`, `0127`, `0129`, `0134`–`0137`) | `match` + `accept`, `public_id`, `understanding`, `ai_`, exact helper names | no S4-03 name collides |
| FK censuses (`0075`, `0076`, `0078`, `0091`, `0092`, `0096`, `0097`, `0100`, `0102`, `0108`, `0110`, `0113`, `0131`, `0135`) | each scoped to its own tables | the new table's three restrictive foreign keys (proposal, World, proposer) fall in no census |

No historical verifier needed re-anchoring.

## 4. The two Product Owner gates — decided (2026-10-05)

### 4.1 Add-member target presentation — **DECIDED: the target's CURRENT Shared ID; implemented**

The census had found no canonical approver-side presentation of the target, and that P1 §5.2–§5.3 requires every
reachability act toward a non-current member — add AND rejoin — to use the target's CURRENT Shared ID, bound to its current
epoch and revalidated before acceptance, while `0085` carries no epoch. The Product Owner decided (not a new policy — P1
already requires it):

- **The Product boundary takes a Shared ID, never a user id.** The proposer types it; `0140` normalizes it and derives its
  lookup reference exactly as `0138` does, resolves the target internally under the target's credential row (`FOR SHARE`),
  and returns ONE word — `SUBMITTED` for every well-formed Shared ID (nobody, a rotated-away one, the caller's own, a current
  member's, someone already asked for at this epoch, or a real request opened now), `INVALID_SHARED_ID` for a typing error,
  `UNAVAILABLE` for a closed capability or a non-member caller. No Shared ID, user id, epoch or lookup result ever leaves
  the database; Shared IDs are 60-bit random values, so the one answer is no enumeration oracle; there is no people
  directory or search route.
- **The minimum forward-only binding.** One sealed table, `shared_private.shared_governance_proposal_origins`, written in
  the same transaction as the frozen preparation: the proposal, its World, the command that opened it, the proposer, and —
  for ADD_MEMBER / REJOIN_MEMBER only — `target_credential_epoch` and a `request_digest` (a namespaced derivation of the
  command and the lookup reference, so a replay proves the exact same Shared ID without keeping it). `0085` is not modified.
- **Revalidated before every consequential act.** Each approval (before anything is recorded), the satisfying approval's
  dispatch of the one member invitation (ADD) or proof of the satisfied set (REJOIN), and the target's acceptance re-read the
  target's credential row `FOR SHARE` and refuse unless its epoch is still the bound one. A rotation therefore makes every
  not-yet-accepted add / rejoin of the older epoch permanently non-actionable: epochs only grow, so nothing revives; an
  approval after a rotation is `STALE` and records nothing; an old Shared ID opens nothing new. Existing Worlds and current
  memberships are untouched by rotation.
- **Presentation before acceptance.** Approvers see that an exact "add member" / "a former member returning" request exists,
  who proposed it, their own approval and the neutral progress — never the target's Name, photo, profile, Shared ID or any
  identity. The target sees, at the Shared root, who proposed it — nothing of the World. After acceptance the frozen
  post-membership identity rules apply (the new member is a current member like any other).
- **Exact-World / operation / target / snapshot before any shortcut.** The proposal's replay is answered only for the same
  World, family, kind, proposer and Shared-ID digest; an acceptance only for the same World, request and human; the frozen
  `0084` / `0085` cores keep their own topology (snapshot) validation, and a moved topology is `STALE`.

### 4.2 Birth scene and World-Transition — **DECIDED: T-A + B-A**

The Product Owner approved **T-A + B-A** from the bounded decision package
[`QANDEEL_S4_03_BIRTH_WORLD_TRANSITION_VISUAL_DECISION_PACKAGE_v1.md`](QANDEEL_S4_03_BIRTH_WORLD_TRANSITION_VISUAL_DECISION_PACKAGE_v1.md):
the current plain World transition stays for v1, and the World shell itself is the birth scene for v1. No new geometry,
duration, easing or motion semantics are invented; production motion is unchanged. This closes the S4-03 ambiguity gate
(`G-04`, `G-25`).

### 4.3 Governance presentation — **DECIDED**

A proposal shows the proposer's Name (the proposer gains no authority and still approves separately — proposing is never
approving), the operation, the reader's own approval state and the neutral progress (`approved / required`). Never a list
of who approved or has not. A REMOVE_MEMBER names its target (a current, visible member of the exact World); unanimity is
all current members except the target. No owner / admin / super-member semantics exist.

## 5. Anti-duplication census

| Area | Frozen authority | What existed | What S4-03 added |
|---|---|---|---|
| Leave | CW2-03 §23 | `0083` core (no role) | `leave_shared_world_v1` — NOT gated (an exit right) |
| Governance substrate | CW2-02 §31–§34 | `0084` capture / approval / satisfaction (no role) | nothing new: consumed by every proposal and approval |
| Removal | CW2-03 §25 | `0085` prepare / commit (no role) | `propose_shared_world_member_removal_v1` (an opaque member handle) |
| Add / rejoin | CW2-03 §16, §28; P1 §5.2–§5.3 | `0085` prepare / dispatch / accept / commit (no role); `0081` credential state + epoch | `propose_shared_world_member_v1` (a Shared ID), the epoch binding in the proposal origin, `accept_shared_membership_request_v1`, the target's request read |
| Settings | CW2-03 §30 | `0086` prepare / commit (no role) | `propose_shared_world_settings_v1` (name, description, topic; the visual marker is carried forward, never exposed) |
| World end | CW2-03 §31–§33 | `0088` prepare / commit / closed reader | `propose_shared_world_end_v1` |
| Approval | CW2-02 §31 | `0084` approval + each operation's commit core | `approve_shared_world_proposal_v1` — records the human's approval, then the satisfying approval commits the operation (or dispatches / proves the add / rejoin) in the same transaction |
| Proposer / progress | Product Owner decision 2026-10-05 | `0084` records no proposer | the proposal origin (proposer) and a count-only progress read — no second governance model |
| Selective history | CW2-02 §29, §37–§38; CW2-03 §17–§22 | `0087` / `0119` prepare / approve / grant / visibility resolver; the `0090` / `0119` unresolved-widening trigger | `propose_shared_world_history_share_v1`, `approve_shared_world_history_share_v1`, the paged candidates and the requests reads |
| Former-member material authority | CW2-03 §24; `0119` | the `0087` approval core requires only the exact required approver | `list_own_former_shared_history_share_requests_v1` (own words only); the same approval command, without any membership requirement |
| Closed viewing | CW2-03 §32–§33 | `0088` entitlement + the `0089` resolver's closed branch | three entitlement reads (never membership) |
| Former-member control | CW2-03 §24 / C21 | the `0139` ungated owner deletion | one read of the reader's own words in former Worlds |
| Launch gate | CW2-08 §24–§29, §40 | the S4-01 gate (three scopes) | `SHARED_GOVERNANCE`, `SHARED_HISTORY_ACCESS`, closed by default |

One table, and it is no second membership, governance, settings, history, closure or authority model: it records only the
Product origin of a proposal and grants nothing.

## 6. Database — migration `0140` (forward-only)

`database/migrations/0140_shared_world_lifecycle_governance_product_v1.sql`. Every privileged part is a pinned `SECURITY
DEFINER` in `shared_private` deriving the human from `auth.uid()`; every exposed function is a `SECURITY INVOKER` one-liner
granted to `authenticated` only; twelve internal helpers are executable by nobody; `service_role` gains nothing.

| Command / read | What it does |
|---|---|
| `read_shared_governance_capabilities_v1` | presentation hints (two real booleans) |
| `list_own_shared_world_names_v1` | the committed names of the caller's current Worlds (the label once committed) |
| `read_own_shared_world_settings_v1` | the committed name / description / topic (one row for a current member) |
| `list_own_shared_world_member_handles_v1` | current members with an opaque World-bound handle, Name, `is_self` |
| `list_own_shared_world_proposals_v1` | the CURRENT, still-actionable, incomplete proposals whose captured topology includes the caller as a REQUIRED member — never the removal target — with the proposer's Name / `proposer_is_self`, `approved_by_self`, `approved_count` / `required_count`; an add / rejoin target is never projected |
| `list_own_shared_history_share_candidates_v1` | the human words the caller can see whose authority is `RESOLVED_EXACT_HUMAN_REQUIREMENT` and which the grantee cannot see (the ONE visibility resolver decides) — whether or not their authors are still members; newest first, keyset-cursored, 1–100 per page |
| `list_own_shared_history_share_requests_v1` | packages waiting on the caller's material authority, inside the World: the grantee's Name and ONLY the caller's own words |
| `list_own_former_shared_history_share_requests_v1` | the same, for a caller who is no longer a member: ONLY the caller's own words and the opaque World / package identity — no grantee, no World state; never gated |
| `list_own_shared_membership_requests_v1` | the add / rejoin requests waiting on the caller as their exact target (an ADD with a PENDING invitation; a REJOIN whose set is complete), only while the epoch binding and the topology hold: kind, proposer Name, opaque World identity |
| `list_own_closed_shared_worlds_v1` / `…_members_v1` / `…_material_v1` | ended Worlds by closed-view entitlement only; the members at closure; the entitled material |
| `list_own_former_shared_world_material_v1` | the caller's own `HUMAN_TEXT` in STANDARD Worlds where they are no longer a current member |
| `leave_shared_world_v1` | the frozen leave core; NOT gated |
| `propose_shared_world_settings_v1` / `…_member_removal_v1` / `…_end_v1` | gated by `SHARED_GOVERNANCE`; the proposer must be a current member (checked under the World lock); the origin is recorded; a proposal is never an approval |
| `propose_shared_world_member_v1` | gated; the target's CURRENT Shared ID (§4.1); ADD_MEMBER for a never-member, REJOIN_MEMBER for a former member (the frozen 0085 split); one answer |
| `approve_shared_world_proposal_v1` | gated; the epoch binding (add / rejoin) before anything is recorded; the frozen approval; then the operation's frozen core under identities derived from the PROPOSAL; incomplete (`55000`) is `APPROVED`; a moved topology or a broken binding is `STALE`; a completed add / rejoin is `INVITED` |
| `accept_shared_membership_request_v1` | gated; the target's own acceptance (`auth.uid()` inside the frozen accept / rejoin core) after re-proving the epoch binding; `JOINED` |
| `propose_shared_world_history_share_v1` / `approve_shared_world_history_share_v1` | gated by `SHARED_HISTORY_ACCESS`; 1–20 exact candidates re-checked under the World lock; the approver is whoever the frozen derivation requires — current member or former member — and nobody else; the completing approval commits the grant |

### 6.1 Cross-World law (applied before ANY replay answer)

Every mutation first resolves which S4-03 command family already holds the command id (LEAVE / PROPOSAL / APPROVAL /
HISTORY_PROPOSAL / HISTORY_APPROVAL / ACCEPTANCE). A committed command is answered as committed only after it is proven to
belong to the exact supplied World, the exact operation family and kind, the exact request (settings values with NULL-safe
equality; the removal handle; the Shared-ID digest; the exact item set) and the exact human (the proposer recorded in the
origin; the approver's episode; the accepting actor); anything else is one `UNAVAILABLE` that names nothing.

### 6.2 Lock order (continues 0138 / 0139 / 0083–0088 / 0081; never reversed)

| Wrapper | Order |
|---|---|
| leave | World `FOR UPDATE` → the caller's open episode (inside the frozen core) |
| propose (settings / removal / end) | gate row `FOR SHARE` → World `FOR UPDATE` → snapshot / proposal / payload / origin writes |
| propose member | gate `FOR SHARE` → World `FOR UPDATE` → the target's credential row `FOR SHARE` → snapshot / proposal / payload / origin writes |
| approve | gate `FOR SHARE` → World `FOR UPDATE` → [add / rejoin: the target's credential row `FOR SHARE`] → proposal `FOR UPDATE` (approval core) → [operation core: World, proposal, removal target's episode / the invitation] |
| accept | gate `FOR SHARE` → World `FOR UPDATE` → the caller's own credential row `FOR SHARE` → invitation / episode (frozen core) |
| history propose / approve | gate `FOR SHARE` → World `FOR UPDATE` → manifest → items in UUID order → [grant core] |

The 0081 rotation takes the credential row `FOR UPDATE` and never a World row, so World → credential cannot form a cycle; a
rotation and an acceptance serialize on the credential row (the verifier races them). No advisory lock, table lock or
process mutex is added.

### 6.3 Product booleans

Every Product-facing boolean is a real boolean (`COALESCE(EXISTS (…), false)` / `COALESCE(x = y, false)`), including
`proposer_is_self`; counts are non-negative integers with `approved ≤ required`; the API refuses anything else (503).

## 7. API boundary — `apps/api/src/shared-world/`

| Route | Rate class | Answer |
|---|---|---|
| `GET /shared` | AUTHENTICATED | S4-01's root + each World's committed `name`, the reader's `closedWorlds` and `memberRequests` (kind, proposer Name, opaque World) |
| `GET /shared/worlds/:worldId/manage` | AUTHENTICATED | the entry verdict, then capabilities, settings, member handles, proposals (proposer, own approval, progress), history requests / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/leave` | AUTHENTICATED | `LEFT` / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/proposals/settings` | SECURITY_SENSITIVE | `{ commandId, name, description, topic }` → `PROPOSED` / `UNCHANGED` / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/proposals/removal` | SECURITY_SENSITIVE | `{ commandId, memberHandle }` → `PROPOSED` / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/proposals/end` | SECURITY_SENSITIVE | `{ commandId }` → `PROPOSED` / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/proposals/member` | SECURITY_SENSITIVE | `{ commandId, sharedId }` (≤ 64 characters) → `SUBMITTED` / `INVALID_SHARED_ID` / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/proposals/:proposalId/approve` | AUTHENTICATED | `APPROVED` / `COMMITTED` / `INVITED` / `STALE` / `UNAVAILABLE` |
| `POST /shared/membership-requests/:worldId/:requestId/accept` | AUTHENTICATED | `JOINED` / `UNAVAILABLE` |
| `GET /shared/worlds/:worldId/history-shares/candidates/:memberHandle[/before/:materialId/:establishedAt]` | AUTHENTICATED | the entry verdict, then one bounded page (oldest first) + `hasOlder` |
| `POST /shared/worlds/:worldId/history-shares` | SECURITY_SENSITIVE | `{ commandId, memberHandle, materialIds }` → `PROPOSED` / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/history-shares/:packageId/approve` | AUTHENTICATED | `APPROVED` / `GRANTED` / `STALE` / `UNAVAILABLE` |
| `GET /shared/own-material/history-shares` | AUTHENTICATED | the former member's requests: own words only |
| `POST /shared/own-material/history-shares/:worldId/:packageId/approve` | AUTHENTICATED | the same approval, outside the World: `APPROVED` / `GRANTED` / `STALE` / `UNAVAILABLE` |
| `GET /shared/closed/:worldId[/before/:materialId/:establishedAt]` | AUTHENTICATED | the ended World by entitlement: label, members at closure, one page |
| `GET /shared/own-material[/before/:materialId/:establishedAt]` | AUTHENTICATED | the reader's own former words, one page |
| `POST /shared/own-material/:worldId/:materialId/delete` | AUTHENTICATED | the `0139` owner deletion |

No route takes a user, actor, approver, target account, audience, rule, snapshot or authority; the add-member route takes
the typed Shared ID only (as S4-01's invitation does) and uses S4-01's strict class; no new rate class; nothing is logged.

## 8. Mobile

- **Manage World** (`SharedManagePage.tsx`): reached by one action inside an ALLOWed World; a place of its own (`MANAGE`);
  Back returns to the World it manages. World Settings; the proposal form; **Add a member** (S4-01's approved Shared ID field
  and hint, the consequence first, one answer that names nobody); the proposals that wait on the reader — each with its
  title (an add / rejoin never names its person), «اقتراح من …» / "Proposed by …" or "Proposed by you", the neutral progress
  and Approve / "you approved"; the share requests (own words only); the members with "propose removing" and "share with";
  leave and end behind a confirmation that states the consequence BEFORE the act. With the governance / history scopes
  closed, only leaving stays.
- **Selective history** (the share panel): explicit item-level multi-select, at most 20 per package, one bounded page of
  candidates at a time with «عرض رسائل أقدم» / "Show older messages" (REUSED) for the next page; the exact preview.
- **The target of an add / rejoin** sees, at the Shared root under S4-01's «الدعوات» / Invitations, who proposed it and
  Accept (S4-01's word) — nothing of the World; there is no decline in canon (the reader simply does not accept). JOINED
  enters the World through the same authority-first entry as any World.
- **Keyboard:** Manage World is wrapped in the same `KeyboardAvoidingView behavior="padding"` as the S4-02 composer.
- **Leave** returns to the Shared root at once with «غادرت العالم.» / "You left the world.".
- **Ended Worlds** («عوالم منتهية» / "Ended Worlds" — Product Owner decision; `READ_ONLY_CLOSED`, not deletion): listed apart,
  opened read-only by entitlement.
- **Privacy & Data:** «كلامك في عوالم مشتركة غادرتها» / "Your words in Shared Worlds you've left" — the reader's own words with
  Delete; above them, any request to share the reader's own earlier words that still needs their approval (own words only,
  no grantee; approving brings them back into nothing).
- **Accessibility:** 44 pt targets; roles; every name from the copy module; focus return; RTL / LTR parity (the Shared ID
  field is a left-to-right Latin run in both languages); the Arabic progress reads «وافق {0} من {1}» so digits never reorder
  in RTL; no motion added.

## 9. Selective history sharing — the unit and material authority

- **Unit (Product Owner decision):** explicit item-level multi-select, 1–20 messages per manifest. No Topic / Session /
  semantic grouping is invented. The candidate read is a **bounded page, not a ceiling**: every older eligible message stays
  reachable page by page (keyset on the instant and identity of the last row shown), and no page reveals anything about
  what is not offered.
- **Material authority survives membership (Product Owner correction):** the earlier narrowing — offering an item only if
  every required approver was still a current member — is removed. A former member who is an item's exact required
  approver approves their own included words through Privacy & Data, using the same exact manifest / required-approver /
  approval / grant runtime (`0087` / `0119`); approving restores no World entry, browsing, surrounding history, counts,
  topics, member activity or any other World state, and the former-member read shows no grantee.
- QANDEEL output stays `UNRESOLVED` and is never offered or packageable; each author is shown only their own words in a
  package; nothing widens until the exact required set completes.

## 10. Invariants and where each is proven

| Invariant | Proof |
|---|---|
| Closed scopes: nothing proposed, approved or widened; leave ungated | verifier §closed gate, §stale topology; static contract |
| Unanimity; the proposal is no approval; settings apply once; the name becomes the label | verifier §unanimity; API spec; mobile `lifecycle.test.tsx`; Journey A |
| Proposer Name and neutral progress shown; never who approved | verifier §unanimity (exact row keys; 1 / 3, 2 / 3); static contract; API spec; mobile tests |
| The removal target never votes and is never shown the proposal | verifier §removal; static contract |
| Add / rejoin by CURRENT Shared ID: one answer; no target identity returned or shown; current epoch succeeds; rotation before approval → STALE, nothing recorded; rotation before acceptance → non-actionable for good; old ID opens nothing; existing Worlds unaffected; rejoin is a NEW episode | verifier §reachability (6c); static contract; root contract test 3; API spec; mobile tests |
| Rotation vs acceptance serialize on the credential row | verifier §concurrency (committed rows, two connections) |
| Stale topology refuses; no approval set carries over | verifier §stale topology and §concurrency |
| Cross-World / cross-operation / cross-request / cross-human replay refused | verifier (per stage); static contract (family check precedes every success) |
| History: membership ≠ historical / material access; candidates paged without a ceiling; unresolved never packageable; exact authors approve; only granted words widen | verifier §history widening and §material authority (6b); Journey B |
| A former required approver approves outside the World and still browses nothing; exact manifest / approver binding | verifier §material authority (6b); API spec; settings tests |
| World end → READ_ONLY_CLOSED; entitlement = members at closure; read-only | verifier §World end; Journey B |
| Former member: own words only; deletion reopens nothing | verifier §former member; settings tests; Journey A |
| Non-null booleans | verifier (every read); static contract; API spec |
| No application role executes a frozen core or reaches the origin table; `service_role` gains nothing | verifier §boundary; migration self-assertions |

### 10.1 Authority regression check for the final copy (2026-10-05)

The ten final wordings carry authority semantics; production behaviour was re-checked against each and needed no change:

| Area | Wording now promises | Runtime truth |
|---|---|---|
| Removal | every OTHER member approves; the target does not; earlier words stay under their name | `0085` prepares REMOVE_MEMBER with `ALL_CURRENT_MEMBERS_EXCEPT_TARGET` and excludes the target's episode from the required set (the verifier sees `required_count = 2` in a three-member World and the target's approval refused); the removal closes the episode in place and deletes nothing (`0085` verifier: no `DELETE`); material keeps its `author_user_id` (the verifier reads the removed member's own words back) |
| Add / rejoin | the target's identity is not shown to the other members before acceptance | the Product boundary takes the CURRENT Shared ID only; the proposals read projects no target for ADD / REJOIN; the binding is re-proved under the credential row and a rotation ends the request; `0085` is byte-identical to `main` |
| Approval status | the request waits for "the remaining required approvals" (not only members) | history packages are approved by the exact derived required set, which may include a former member (§9; verifier stage 6b) |
| History sharing | no automatic pre-membership history; shared only after all required approvals | candidates come from the ONE visibility resolver (membership periods AND explicit History Access Grants); the frozen grant core commits only when the exact required set is complete; UNRESOLVED material is never packageable |
| World end | read-only; each person sees only what was available to them | `0088` → `READ_ONLY_CLOSED`; closed viewing reads the per-(World, human, item) entitlement snapshot that `0088` builds through the visibility entry point while the World is still ACTIVE (`0119` §6), so closure never widens anyone; nothing is deleted; a member removed earlier is not restored (verifier) |

## 11. S4-03 Product Copy Gate — **CLOSED — Product Owner, 2026-10-05**

Every S4-03 word is in `apps/mobile/src/shared-world/lifecycle-copy.ts`, the ONE copy source; the table below is generated
mechanically from that source. **3 CANON** (the two I-08A4 names and the Product Owner's «عوالم منتهية» / "Ended Worlds"),
**54 APPROVED** (Product Owner, 2026-10-05 — ten of them in the Product Owner's own final wording: `proposalRemoval`,
`proposeRemoval`, `removeExplain`, `confirmRemoval`, `approvedWaiting`, `addMemberExplain`, `shareExplain`,
`shareRequestsHeading`, `shareRequest`, `endExplain`), **17 REUSED** (imported from the S4-01 / S4-02 modules, never
copied), **0 PROPOSED**. The device runner asserts `left` (ar) and `granted` (en) byte-for-byte.

The corrected wordings are narrower than the drafts on purpose and match the runtime: the approval status is not limited
to "other members" (a required history approver may be a former member); the add-member guarantee is that QANDEEL does
not reveal the target's identity to the other members before acceptance (the proposer may know the person outside
QANDEEL); history sharing is not described as "since they joined" or "its author's approval" (visibility may also come
from an explicit History Access Grant, and the required approvers are the exact derived set); and a World's end makes it
read-only without widening anyone's visibility.

| # | Key | Arabic | English | Where shown | Why needed | Status |
|---|---|---|---|---|---|---|
| 1 | `manageWorld` | إدارة العالم | Manage World | World shell action; Manage World title | the one way into the World's own management place (I-08A4 §7) | CANON |
| 2 | `worldSettings` | إعدادات العالم | World Settings | Manage World section heading | the committed name / description / topic | CANON |
| 3 | `endedHeading` | عوالم منتهية | Ended Worlds | Shared root section heading | the ended Worlds the reader may still read (closed-state name: PO decision, E2E-G-13) | CANON |
| 4 | `nameLabel` | الاسم | Name | World Settings row + form field | label of the World name setting (0086 `name`) | APPROVED |
| 5 | `descriptionLabel` | الوصف | Description | World Settings row + form field | label of `description` | APPROVED |
| 6 | `topicLabel` | الموضوع | Topic | World Settings row + form field | label of `topic` | APPROVED |
| 7 | `notSet` | لم يُحدَّد بعد | Not set yet | World Settings value; field placeholder | a setting nobody has committed | APPROVED |
| 8 | `proposeChange` | اقتراح تغيير | Propose a change | World Settings action | opens the settings proposal form | APPROVED |
| 9 | `proposeSettingsExplain` | لن يتغيّر شيء إلا إذا وافق كل الأعضاء الحاليين. | Nothing changes unless every current member approves. | settings form, above the fields | unanimity stated before proposing (CW2-03 §30) | APPROVED |
| 10 | `sendProposal` | إرسال الاقتراح | Send proposal | settings form action | sends the exact proposed version | APPROVED |
| 11 | `proposalSent` | تم إرسال الاقتراح. يحتاج موافقة كل الأعضاء، وأنت منهم. | Proposal sent. It needs every member's approval, including yours. | Manage World notice (after a settings, removal or end proposal) | a proposal is not an approval; the proposer must approve too | APPROVED |
| 12 | `unchanged` | هذه هي الإعدادات الحالية بالفعل. | These are already the current settings. | Manage World notice | the proposed values equal the committed ones | APPROVED |
| 13 | `governanceNotOpen` | إدارة العالم غير متاحة بعد. | Managing this world isn't available yet. | Manage World, governance scope closed | truthful closed-capability state | APPROVED |
| 14 | `proposalsHeading` | اقتراحات تنتظر موافقتك | Proposals waiting for your approval | Manage World section heading | the proposals that wait on THIS reader | APPROVED |
| 15 | `proposalSettings` | تغيير إعدادات العالم | Change the World Settings | proposal row title | a settings-change proposal | APPROVED |
| 16 | `proposalRemoval` | إزالة {0} من هذا العالم | Remove {0} from this world | proposal row title ({0} = Name) | a removal proposal (never shown to its target) | APPROVED |
| 17 | `proposalEnd` | إنهاء هذا العالم | End this world | proposal row title | a World-end proposal | APPROVED |
| 18 | `proposalAdd` | انضمام شخص جديد إلى هذا العالم | A new person joining this world | proposal row title | an add request; the person is never named before acceptance | APPROVED |
| 19 | `proposalRejoin` | عودة عضو سابق إلى هذا العالم | A former member returning to this world | proposal row title | a rejoin request; the person is never named before acceptance | APPROVED |
| 20 | `proposedBy` | اقتراح من {0} | Proposed by {0} | proposal row ({0} = proposer Name) | who proposed it (Product Owner decision); no authority | APPROVED |
| 21 | `proposedBySelf` | اقتراح منك | Proposed by you | proposal row | the reader proposed it | APPROVED |
| 22 | `progress` | وافق {0} من {1} | {0} / {1} approved | proposal row ({0} approved, {1} required) | neutral progress; never who approved | APPROVED |
| 23 | `approve` | موافقة | Approve | proposal row; share-request row; Privacy & Data former-words request | the reader's own approval | APPROVED |
| 24 | `approvedWaiting` | تمت موافقتك. ما زال الطلب ينتظر باقي الموافقات المطلوبة. | Your approval is recorded. The request is still waiting for the remaining required approvals. | proposal row; share-request row; Privacy & Data request; notice | the reader approved; others still required (no names / counts) | APPROVED |
| 25 | `committed` | تم تطبيق التغيير. | The change has been applied. | Manage World notice | the satisfying approval applied the operation | APPROVED |
| 26 | `invited` | وافق الجميع. ينتظر الطلب الآن قبول الشخص. | Everyone approved. The request now waits for the person to accept. | Manage World notice | add / rejoin approved by all; waits for the person | APPROVED |
| 27 | `stale` | لم يعد هذا الاقتراح قائمًا. | This proposal no longer stands. | Manage World notice; Privacy & Data notice | topology moved; the proposal no longer stands | APPROVED |
| 28 | `addMember` | إضافة عضو | Add a member | Manage World action | opens the add-member form | APPROVED |
| 29 | `addMemberExplain` | تحتاج إضافة عضو جديد موافقة جميع الأعضاء الحاليين، ثم قبول الشخص نفسه. لن تظهر هويته لباقي الأعضاء قبل أن يقبل. | Adding a new member requires every current member's approval, then the person's own acceptance. Their identity won't be shown to the other members before they accept. | add-member form, first line | unanimity + own acceptance; nobody named before acceptance | APPROVED |
| 30 | `sendRequest` | إرسال الطلب | Send request | add-member form action | sends the Shared ID | APPROVED |
| 31 | `memberRequestSent` | إذا كان هذا المعرّف صحيحًا، سيُطلب من الأعضاء الموافقة. | If this Shared ID is right, the members will be asked to approve. | Manage World notice | the one answer for every well-formed Shared ID | APPROVED |
| 32 | `memberRequestAdd` | {0} يقترح انضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه. | {0} proposed that you join a Shared World, and all its members approved. | Shared root, Invitations ({0} = proposer Name) | the target view of an add | APPROVED |
| 33 | `memberRequestRejoin` | {0} يقترح عودتك إلى عالم مشترك كنت فيه، وقد وافق عليها كل أعضائه. | {0} proposed that you return to a Shared World you were in, and all its members approved. | Shared root, Invitations ({0} = proposer Name) | the target view of a rejoin | APPROVED |
| 34 | `proposeRemoval` | اقتراح إزالة عضو | Propose removing a member | member row action | opens the removal confirmation | APPROVED |
| 35 | `removeExplain` | تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين. لا يحتاج {0} إلى الموافقة، ويبقى كلامه السابق باسمه. | Removing {0} requires every other member's approval. {0} doesn't approve the removal, and their earlier words remain under their name. | removal confirmation ({0} = Name) | consequence before the act (CW2-03 §25) | APPROVED |
| 36 | `confirmRemoval` | اقتراح إزالة العضو | Propose removal | removal confirmation action | sends the removal proposal | APPROVED |
| 37 | `shareExplain` | لا يرى العضو التاريخ السابق على عضويته تلقائيًا. يمكنك اقتراح مشاركة رسائل سابقة معه، ولا تتم مشاركة أي رسالة إلا بعد اكتمال الموافقات المطلوبة عليها. | A member doesn't automatically see history from before their membership. You can propose sharing earlier messages with them, and a message is shared only after all required approvals are complete. | share panel, first line | FROM_JOIN_FORWARD + author approval explained | APPROVED |
| 38 | `shareWith` | مشاركة مع {0} | Share with {0} | member row action ({0} = Name) | opens sharing earlier messages with that member | APPROVED |
| 39 | `noCandidates` | لا توجد رسائل سابقة يمكن مشاركتها مع {0}. | There are no earlier messages to share with {0}. | share panel ({0} = Name) | nothing the reader may offer | APPROVED |
| 40 | `previewHeading` | سيرى {0} هذه الرسائل فقط: | {0} will see only these messages: | share panel preview ({0} = Name) | the exact preview before proposing (CW2-03 §21) | APPROVED |
| 41 | `proposeShare` | اقتراح المشاركة | Propose sharing | share panel action | sends the exact package | APPROVED |
| 42 | `shareRequestsHeading` | طلبات مشاركة تحتاج موافقتك | Sharing requests needing your approval | Manage World section heading; Privacy & Data former-words page | packages waiting on the reader's authority | APPROVED |
| 43 | `shareRequest` | اقتراح بأن يرى {0} الرسائل السابقة التالية، ويحتاج ذلك إلى موافقتك: | A proposal for {0} to see the following earlier messages; your approval is required: | share-request row ({0} = grantee Name) | only the reader's own words are shown | APPROVED |
| 44 | `formerShareRequest` | اقتراح بأن يرى عضو في عالم غادرته كلامك السابق هذا. موافقتك لا تعيدك إلى العالم: | A proposal for a member of a world you've left to see these earlier words of yours. Approving doesn't bring you back: | Privacy & Data former-words page | former member approves own words; no grantee | APPROVED |
| 45 | `granted` | تمت المشاركة. | Shared. | Manage World notice; Privacy & Data notice | the exact approver set completed; the grant committed | APPROVED |
| 46 | `historyNotOpen` | مشاركة الرسائل السابقة غير متاحة بعد. | Sharing earlier messages isn't available yet. | Manage World, history scope closed | truthful closed-capability state | APPROVED |
| 47 | `leave` | مغادرة هذا العالم | Leave this world | Manage World action | opens the leave confirmation | APPROVED |
| 48 | `leaveExplain` | ستغادر فورًا، ولن ترى هذا العالم ولا ما يُقال فيه بعد ذلك. يبقى كلامك السابق فيه، ويمكنك حذفه لاحقًا من الإعدادات ← الخصوصية والبيانات. | You'll leave right away and won't see this world or anything said in it after that. Your earlier words stay, and you can delete them later from Settings → Privacy & Data. | leave confirmation | consequence before the act (CW2-03 §23–§24); where own words stay controllable | APPROVED |
| 49 | `leaveConfirm` | مغادرة | Leave | leave confirmation action | the exit right | APPROVED |
| 50 | `left` | غادرت العالم. | You left the world. | Shared root notice | the reader left; nothing of the World remains | APPROVED |
| 51 | `endWorld` | إنهاء هذا العالم | End this world | Manage World action | opens the World-end confirmation | APPROVED |
| 52 | `endExplain` | ينتهي العالم فقط إذا وافق جميع الأعضاء الحاليين. بعدها يصبح للقراءة فقط، ويظل كل شخص يرى فقط ما كان متاحًا له. | The world ends only if every current member approves. After that it becomes read-only, and each person can see only what was available to them. | World-end confirmation | unanimity + archival closure stated first (CW2-03 §31–§33) | APPROVED |
| 53 | `endConfirm` | اقتراح الإنهاء | Propose ending | World-end confirmation action | sends the World-end proposal | APPROVED |
| 54 | `endedNotice` | انتهى هذا العالم. يمكنك قراءة ما كان متاحًا لك فقط. | This world has ended. You can only read what was available to you. | ended World, top | read-only by entitlement | APPROVED |
| 55 | `formerRow` | كلامك في عوالم مشتركة غادرتها | Your words in Shared Worlds you've left | Settings → Privacy & Data row; page title | own-material control outside the World (E2E-G-18) | APPROVED |
| 56 | `formerExplain` | هذا كلامك أنت فقط. لا يظهر هنا شيء آخر من تلك العوالم. | These are only your own words. Nothing else from those worlds appears here. | former-material page | only the reader's own words; no World browsing | APPROVED |
| 57 | `formerEmpty` | لا يوجد كلام لك في عوالم غادرتها. | You have no words in worlds you've left. | former-material page | nothing to show | APPROVED |
| 58 | `back` | (imported) | (imported) | S4-03 surfaces | S4-01 back | REUSED |
| 59 | `cancel` | (imported) | (imported) | S4-03 surfaces | S4-01 cancel | REUSED |
| 60 | `retry` | (imported) | (imported) | S4-03 surfaces | S4-01 retry | REUSED |
| 61 | `actionUnavailable` | (imported) | (imported) | S4-03 surfaces | S4-01 actionUnavailable | REUSED |
| 62 | `someone` | (imported) | (imported) | S4-03 surfaces | S4-01 someone | REUSED |
| 63 | `you` | (imported) | (imported) | S4-03 surfaces | S4-01 you | REUSED |
| 64 | `membersHeading` | (imported) | (imported) | S4-03 surfaces | S4-01 membersHeading | REUSED |
| 65 | `inviteFieldLabel` | (imported) | (imported) | S4-03 surfaces | S4-01 inviteFieldLabel (add-member field) | REUSED |
| 66 | `inviteHint` | (imported) | (imported) | S4-03 surfaces | S4-01 inviteHint | REUSED |
| 67 | `invalidSharedId` | (imported) | (imported) | S4-03 surfaces | S4-01 invalidSharedId | REUSED |
| 68 | `invitationsHeading` | (imported) | (imported) | S4-03 surfaces | S4-01 invitationsHeading (root, member requests) | REUSED |
| 69 | `accept` | (imported) | (imported) | S4-03 surfaces | S4-01 accept (member requests) | REUSED |
| 70 | `delete` | (imported) | (imported) | S4-03 surfaces | S4-02 delete | REUSED |
| 71 | `deleteExplanation` | (imported) | (imported) | S4-03 surfaces | S4-02 deleteExplanation | REUSED |
| 72 | `deleteConfirm` | (imported) | (imported) | S4-03 surfaces | S4-02 deleteConfirm | REUSED |
| 73 | `deleted` | (imported) | (imported) | S4-03 surfaces | S4-02 deleted | REUSED |
| 74 | `olderMessages` | (imported) | (imported) | S4-03 surfaces | S4-02 olderMessages (ended World; former words; share candidates) | REUSED |

## 12. Validation (local, before any push)

Rerun after the Product Owner corrections (focused on what they touched, plus the cheap whole-repository gates):

| Check | Result |
|---|---|
| Root contracts (`node --test tests/*.test.mjs`, the ignored `apps/mobile/android` moved aside on the same drive) | **1164 / 1164** |
| S4-03 root contract | **8 / 8** |
| `test:database` (incl. the 0140 static contract, 8 / 8) | **1304 / 1304** |
| `verify:db:hazards` | **0 findings** |
| `node --check database/verify-migration-0140.mjs` | clean (the real-PostgreSQL run is API CI's) |
| API `tsc --noEmit` / jest (incl. the route census) | clean / **224 suites, 5065 / 5065** |
| Mobile `tsc --noEmit` / `expo lint` | clean / 0 errors (the remaining warnings are all in files S4-03 does not touch) |
| Mobile jest | **2133 / 2139**; the 6 failures (`depth.test.tsx`, `w2-account-access.test.tsx`) reproduce identically on an untouched `5ea9520` worktree — the Arabic host locale (ENVIRONMENT) |
| Forward-only | `0001`–`0139` byte-identical to `origin/main`; `0140` is the only migration added |
| Native impact | `true` (mobile JS reaches the bundle) |
| VAL-01 S4 legs | every Android leg (INFRA — workflow files changed): the six S4-01 / S4-02 legs + `ar-s403-journey-a`, `en-s403-journey-b`; the S4-03 flows assert ids plus the unchanged `left` / `granted` words, so the corrections need no flow change |

Real PostgreSQL is **not runnable locally** (this workstation has none; the repository's local-harness policy forbids
installing one ad hoc); the 0140 verifier — including the Shared-ID epoch, former-member authority, paging and rotation
race proofs — first runs in API CI on the review-candidate head, with every historical verifier in order. No device leg ran
locally.

## 13. Backlog reconciliation (BG-05 / BG-08)

- **Inherited:** none — no backlog item names S4-03 as owner.
- **Reopen conditions observed, dispositions recorded:** `QAN-BL-ACCT-01` (S4-03 takes the Shared World further toward
  users — now including governed add / rejoin) stays `OPEN — UNASSIGNED`, unchanged in scope; both S4-03 scopes ship
  closed and claim no production readiness. `QAN-BL-VOICE-01` is not claimed: voice notes appear in no S4-03 read.
  `QAN-BL-CW-02` is untouched. `QAN-BL-LAUNCH-03` (Shared ID key custody) is unchanged: S4-03 reads only the lookup
  reference and epoch, never a sealed value.
- **Admitted:** none. Both Product Owner gates were decided at the pre-push checkpoint and are implemented / recorded here (§4); the Copy Gate is CLOSED (§11).
- **Unchanged:** `QAN-BL-CW-01`, `QAN-BL-CI-01` and every other item.

## 14. Stage-4 Gap Matrix (S4-03 delta)

| # | Candidate | Class | Disposition |
|---|---|---|---|
| G-04 | Final birth-scene graphic | — | **Decided T-A + B-A** (Product Owner 2026-10-05): the World shell is the birth scene for v1; no new motion |
| G-09 | Add / remove / rejoin | 2 | removal, add and rejoin delivered (§4.1, §6–§8) |
| G-10 | Shared settings | 2 | name, description, topic; the general visual marker carried forward, not exposed (no frozen meaning) |
| G-11 | Selective historical access | 2 | item-level multi-select, 1–20 per manifest, paged candidates; former-member material authority (§9) |
| G-12 | Leave | 2 | §6–§8 |
| G-13 | World end / closed viewing | 2 | §6–§8; the closed-state name «عوالم منتهية» / "Ended Worlds" (Product Owner decision) |
| G-19 | Former member's own-material control | 2 | Privacy & Data (§8), including approving their own included words |
| G-25 | World-Transition motion review | — | **Decided T-A** (Product Owner 2026-10-05): the current plain transition stays for v1 |
| G-15b, G-16, G-17 | Direct Entry, Shared Activity, first-entry education | 5 | **S4-04** (unchanged) |
| G-07, G-18, G-23, G-26, G-29 | | unchanged | as the S4-01 record §17 assigns them |

**Orphan gaps:** none silently dropped. Every candidate is delivered here, decided and recorded here, or owned by S4-04 or
an existing item.

## 15. Stage-4 status

Stage 4 stays **ACTIVE**: S4-03 is a review candidate on an open PR (Copy Gate CLOSED); S4-04 follows. No Stage 5 work is
opened.
