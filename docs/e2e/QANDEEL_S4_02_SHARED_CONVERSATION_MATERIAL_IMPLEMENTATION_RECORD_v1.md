# QANDEEL — S4-02 Shared Conversation & Material Production Integration — Implementation Record v1

**Task:** `S4-02 — Shared Conversation & Material Production Integration v1` (Stage 4 — Shared World Product Integration)
**Task Contract:** `QANDEEL_S4-02_SHARED_CONVERSATION_MATERIAL_TASK.md` (Product Owner, approved 2026-10-05)
**Canonical baseline:** `d6047489f402cc286e4b27954ec16dc650e57339` (the merge of PR #310, S4-01)
**Branch:** `feat/s4-02-shared-conversation-material`
**Status:** **`S4-02 IMPLEMENTED LOCALLY — PRE-PUSH CHECKPOINT — S4-02 PRODUCT COPY GATE OPEN — NOT PUSHED — NOT MERGED`**.
Claude does not merge it.

> A real Shared conversation with QANDEEL, over the frozen I-04G material runtime: a current member reads the World's
> visible material, sends real text, sees who said what, receives one request-driven QANDEEL reply that reasons over that
> World's history only, and deletes their own words for everyone. Shared Voice Notes are not faked (`QAN-BL-VOICE-01`).

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `d6047489f402cc286e4b27954ec16dc650e57339` — `origin/main` confirmed equal at kickoff; PR #310 MERGED 2026-10-05T12:52:51Z |
| Branch | `feat/s4-02-shared-conversation-material`, cut from `origin/main` |
| PR | not opened yet (the first push waits for the Product Copy Gate) |
| Head | the review-candidate commit recorded in the PR conversation |

## 2. Start Gate

| Check | Result |
|---|---|
| `origin/main` | `d6047489f402cc286e4b27954ec16dc650e57339` — equal to the Task Contract baseline; no intervening merge, so no re-cut |
| PR #310 | `MERGED`; merge commit `d604748`; S4-01 canonical |
| Working tree | clean at kickoff |
| Next migration | `0139` (the highest on `main` is `0138_shared_world_reachability_invitation_birth_v1.sql`) |
| Voice runtime | none landed: no durable audio source, upload provider or Voice / Live Call runtime exists; `QAN-BL-VOICE-01` is still `OPEN — UNASSIGNED` |
| Shared material foundations | `0089` (envelope, bodies, provenance, `resolve_shared_world_material_v1`, service_role only); `0090` (human text / voice-note / QANDEEL commit cores and owner deletion, executable by NO application role); `0118` (Introduction-phase extension of both commit cores); `0119` (historical-authority remediation; the current QANDEEL core); `0122` (the current owner-deletion body) |
| Shared generation foundations | `connected-worlds/`: I-03D audience, I-03E pre-model World state + EffectiveContext, I-03F delivery-authority revalidation, I-03G Source Disclosure Gate + readiness, I-04G FIX-B commit binder. **No module registers any of them; no production caller exists; the two dependency contracts `SHARED_SOURCE_DISCLOSURE_DETECTOR` and `SHARED_PRIVATE_SOURCE_STATE_RESOLVER` have no implementation** |

## 3. Validation Impact Census (written before the first push)

| Area | Paths | What binds them |
|---|---|---|
| Database | `database/migrations/0139_*.sql`; `database/verify-migration-0139.mjs`; `database/tests/shared-world-conversation-material-v1.test.mjs`; **re-anchored** `database/verify-migration-0138.mjs` | `test:database` (every migration-wide rule); `verify:db:hazards`; the 0133 hosted-replay census (every later migration replayed; PUBLIC EXECUTE must be absent); the 0089 / 0090 / 0118 / 0119 verifiers (no application role executes a 0090 primitive; service_role keeps the 0089 resolver) |
| API | `apps/api/src/shared-world/*` (controller, module, conversation repository / service, model-input assembler, reply generator, spec); `apps/api/src/connected-worlds/material-commit/shared-qandeel-reply.*` + `shared-unavailable-private-context-boundaries.ts`; `http-security/route-rate-limit.census.ts` | the route census spec; `tests/s4-01-…` test 2; `tests/connected-worlds-i03-authority-closure-contract` (no I-03 name outside Connected Worlds); `shared-delivery-authority-revalidation`, `shared-pre-model-…`, `shared-human-audience-…` (name firewalls; no module / controller under `connected-worlds/`); `shared-world-material-commit-owner-deletion-v1` (the binder is imported only inside `material-commit/`); `conversation-focus-…` (the exact `readDataApiUpstreamIdentity` readers — no new reader); `ai-cost-01` (no new provider transport) |
| Mobile | `apps/mobile/src/shared-world/*`; `runtime-entry/shared-world-api.ts` + `index.ts`; `integration/runtime/integration-runtime.ts`; `integration/__validation__/s401-proof-world.ts`, `S401ProofRoot.tsx`; `integration/__tests__/s4-02-proof-world.test.tsx` | `tests/s4-01-…` tests 4–6 (SharedWorldArea props, no `Composer` token in `SharedWorldArea.tsx`, S4-01 copy byte-exact); `t12p` (no timer in `runtime-entry`, barrel-only imports); `t12` Phase M (literal bans in `__validation__/`) |
| Proof | `apps/mobile/.maestro/s4-02-journey-{a,b}.yaml`; `scripts/phase-m/run-s401-proof-leg.sh`; `.github/workflows/s4-proof.yml` (the S4-02 branch added to its push trigger) | `tests/s4-01-…` test 6; `tests/qan-inf-04-…` (recipe set unchanged — `s4-shared-world-proof` reused); `proof-legs.mjs` derivation |
| Root contract | `tests/s4-02-shared-conversation-material-contract.test.mjs`, registered in `package.json`, API CI and Mobile CI | `tests/forward-safety-contract.test.mjs` runs it with every other root contract |
| Docs | this record; `QANDEEL_CURRENT_STATE.md`; `QANDEEL_PROJECT_MAP.md`; `docs/qandeel-canonical-backlog-v1.md`; `database/README.md` | the backlog readers; `task-closure-governance` |

**Historical verifiers affected.** `verify-migration-0138.mjs` asserted its exact definer set and its exact client-executable
set over the WHOLE `shared_private` schema, which 0139 legitimately extends. It is re-anchored to filter by its own twelve
names — every 0138 fact (presence, pinning, ownership, grants) is still proved; the later definers are proved by
`verify-migration-0139.mjs`. No grant was widened and no historical migration was edited. The 0089 / 0090 / 0118 / 0119
verifiers need no change: 0139 grants nothing on any frozen function.

**VAL-01 consequence.** The delta touches `database/`, `apps/api/`, `tests/`, `apps/mobile/`, `scripts/phase-m/` and
`.github/workflows/` → API_HEAVY, MOBILE_CONTRACT and MOBILE_NATIVE_BINARY all RUN; the native fingerprint moves (mobile
JS, `__validation__/`, `.github/workflows/`), so Mobile CI and the S4 producer build once. The S4 runner changed, so every
S4 leg runs: the four S4-01 legs (regression of the area they prove, which S4-02 extends) and the two S4-02 legs.

## 4. Anti-duplication census

| Area | Frozen authority | What existed | What S4-02 added |
|---|---|---|---|
| Material, history, audience, ownership | CW2-01 / CW2-02 / CW2-03; I-04G | 0089 / 0090 / 0118 / 0119 / 0122, executable by no application role | **nothing new**: no table, no second message / history / audience / QANDEEL model |
| Human text | CW2-03 §36, §41 | `commit_shared_world_human_text_v1` (no role) | the launch-gated owner wrapper `send_shared_world_human_text_v1` (server-derived persistence identities) |
| Material read | CW2-03 §20, §37 | `resolve_shared_world_material_v1` (service_role) | the owner read `list_own_shared_world_material_v1` (current member only, bounded, cursored) |
| QANDEEL output | CW2-02 §21–§22; CW2-03 §43 | the QANDEEL core (no role); the I-03 chain and the binder (never composed) | the server-only `commit_shared_world_qandeel_reply_v1` + the one composition in `connected-worlds/material-commit/` |
| Owner deletion | CW2-03 §35, §37 | `delete_shared_world_owned_material_v1` (no role) | the owner wrapper `delete_own_shared_world_material_v1` (NOT gated: a privacy mutation) |
| Launch gate | CW2-08 §24–§29, §40 | the S4-01 gate (two scopes) | one additive scope, `SHARED_CONVERSATION`, closed by default |
| Provider, accounting, safety | QIR; AI-COST-01; Safety Runtime | `MODEL_ROUTER`, `runWithAiUsageAttribution`, `SafetyResponseGateService`, `TEXT_V1_BEHAVIORAL_GUIDANCE` | consumed as they are; one Shared model-input assembler |

## 5. Database — migration `0139` (forward-only)

`database/migrations/0139_shared_world_conversation_material_v1.sql`. Every privileged part is a pinned `SECURITY DEFINER`
in `shared_private`; every exposed function is a `SECURITY INVOKER` one-liner. It creates no table and writes no row.
Historical migrations `0001`–`0138` are byte-unchanged.

| Part | What it does |
|---|---|
| gate scope | the 0138 scope CHECK is replaced by the same CHECK plus `SHARED_CONVERSATION` — the one forward alteration of a 0138 relation; no row is touched; no scope is configured |
| `derive_shared_conversation_identity_v1` | the material / history-item / event identities the frozen primitives need, derived from the caller's command id under a per-role namespace: one logical command is one material; no client chooses a persistence identity. Executable by nobody |
| `read_shared_conversation_capability_v1` | presentation hint only (CW2-08 §24) |
| `list_own_shared_world_material_v1` | `auth.uid()`; a current member of an ACTIVE World (the S4-01 entry law) or nothing; the frozen resolver's text-form material; newest first; 1–200 per page; cursor `(established_at, material_id)`; adds only each human author's Name and whether THIS reader may delete. A voice-note body (no Product source) is not projected |
| `send_shared_world_human_text_v1` | `auth.uid()`; 1–20 000 characters (the Personal route's bound, reused); binds the conversation gate FOR SHARE before the frozen commit (a committed command of this human / World replays whatever the gate says); the frozen commit derives audience, authority and kind; `COMMITTED` / one neutral `UNAVAILABLE`; the frozen 23505 conflict propagates |
| `commit_shared_world_qandeel_reply_v1` | **service_role only** — the server's act. At most one reply per committed HUMAN_TEXT command of the same World (identities derived from the human command; an existing reply is the answer); binds the gate; kind is the literal `QANDEEL_OUTPUT`; the I-03 evidence passes untouched to the frozen core, which recomputes the readiness and output digests, re-derives the audience under the World lock and refuses stale evidence (`STALE`) |
| `delete_own_shared_world_material_v1` | `auth.uid()`; the frozen primitive decides ownership; not gated; `DELETED` / one neutral `UNAVAILABLE` |
| privileges | `authenticated`: exactly the four human commands. `service_role`: USAGE on `shared_private` and EXECUTE on exactly the reply commit — no table, no human command, no gate. Every 0090 primitive stays executable by no application role. Deploy-time self-assertions refuse anything else |

## 6. API boundary — `apps/api/src/shared-world/`

| Route | Rate class | Answer |
|---|---|---|
| `GET /shared/worlds/:worldId/materials` | AUTHENTICATED | the entry verdict first; `ALLOW` + `conversation` hint + the newest 50 visible materials (`SELF` / `HUMAN` + Name / `QANDEEL`, `canDelete`), oldest first / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/messages` | SECURITY_SENSITIVE | `{ commandId, content }` → `COMMITTED` + `materialId` + `qandeel: COMMITTED / UNAVAILABLE` / `UNAVAILABLE` |
| `POST /shared/worlds/:worldId/materials/:materialId/delete` | AUTHENTICATED | `{ commandId }` → `DELETED` / `UNAVAILABLE` |

Identity is the verified token. No route takes a user, author, member, viewer, audience, kind or authority. The send is
held to the strict class because it can start one provider generation and no database work lease bounds Shared
generation (0131 is keyed on Personal turns). Nothing is logged.

## 7. The QANDEEL generation path (exact)

`POST …/messages` → (1) the human's words commit through 0139 on the caller's token → (2) the newest page the caller may
read → `SharedQandeelReplyService.reply` in `connected-worlds/material-commit/`:

1. `SharedEffectiveContextService.resolve(worldId, [])` — exact World state (READ_ONLY_CLOSED blocks) and exact current
   audience; **no private candidate is offered**, so no Personal context can enter;
2. the conversation EVERY current recipient may see: the caller's read ∩ the frozen 0089 resolver for each audience human
   (CW2-02 §15) — hidden and deleted material never reach the model; the newest item must be the answered message;
3. `SharedConversationReplyGenerator` — the canonical Safety Response Gate (BLOCK answers with its own deterministic
   words, no provider), the one Shared model-input assembler (TEXT_V1 guidance + a structural Shared frame, Names only,
   the frozen 16 KiB history budget, no Memory / HIM / Hypothesis / Recommendation / Question), the provider-neutral
   `MODEL_ROUTER` inside `runWithAiUsageAttribution({ userId })`;
4. `SharedPrivacyAuthorityDeliveryReadinessService.evaluate` (Source Disclosure Gate → I-03F revalidation, in order), then
   `SharedDeliveryAuthorityRevalidatorService.revalidate` and a fresh audience read;
5. `bindSharedQandeelMaterialCommit` (QANDEEL_OUTPUT; no material and no reasoning dependency — a conversational reply
   reproduces no source, so an owner's later deletion leaves it as historical discussion);
6. `commit_shared_world_qandeel_reply_v1` on the server channel.

Any refusal commits nothing; the human's words stay. The two dependency contracts no slice implements are bound to
fail-closed implementations (never CLEAR, never AVAILABLE) that are unreachable with zero candidates.

## 8. Mobile

- **Controller** (`shared-world-controller.ts`): the World's `thread` belongs to one World; read only after ALLOW;
  emptied on every move; stale answers dropped; a `DENIED` read hides the World. One command per logical submission until
  the server answers; the words are confirmed (cleared) only on `COMMITTED`. Refresh on entry, on foreground (the
  production `ForegroundSignal`), after the reader's own send / delete, and on the explicit Refresh — no timer, no socket.
- **Thread** (`SharedWorldThread.tsx`): the reader's words on the start edge on the utterance slab; another person's on
  the end edge on the functional surface under their Name; QANDEEL open on the World under «قنديل» / QANDEEL, no surface.
  Paragraph bidi per G1.1. Delete only on the reader's own words: tap → Delete → a confirmation that states what deletion
  does → Delete for everyone. The input only while sending is open; one submission at a time; no microphone, no voice.
- **State independence:** the thread and the input are keyed by World; nothing crosses My World ↔ Shared or World A ↔ B.

## 9. Invariants and where each is proven

| Invariant | Proof |
|---|---|
| HUMAN_TEXT by a current member of an ACTIVE / STANDARD World only; author = `auth.uid()`; audience derived | verifier 0139 §human text; §former member; §closed World |
| Same-command retry commits nothing new; a different text conflicts; another human's command conflicts | verifier 0139; concurrency stage |
| Read = the frozen resolver, current member only; no other World; no hidden / deleted row | verifier 0139 §read, §deletion |
| Owner deletion only; not QANDEEL's, not another's, not another World's; body gone for every reader; not a new source | verifier 0139 §deletion |
| Gate closed → no send, no reply; deletion not gated | verifier 0139 §closed gate |
| QANDEEL: system actor, QANDEEL_OUTPUT, one per human command, exact bytes / World / audience, stale refused | verifier 0139 §reply; API spec `shared-qandeel-reply.service.spec.ts` (real chain) |
| No Personal intelligence in a Shared call; no other World; reasoning-only context never material | API spec; root contract §3–§4 |
| No application role executes a 0090 primitive or a table | verifier 0139 §boundary; migration self-assertions; 0090 / 0118 / 0119 verifiers |
| Mobile: nothing before ALLOW; one World; draft / idempotency; attribution; no voice; refresh; authority loss | `shared-thread.test.ts`, `shared-thread-surfaces.test.tsx`, `s4-02-proof-world.test.tsx`; device legs |

## 10. S4-02 Product Copy Gate

**OPEN — waiting for the Product Owner.** Every S4-02 word is in `apps/mobile/src/shared-world/conversation-copy.ts`.
CANON: «قنديل» / QANDEEL. REUSED (imported, never copied): the W1A-01 composer placeholder, Send, the read-aloud forms,
waiting / unconfirmed / refused / reply-failed / history-unavailable; the S4-01 Cancel, Try again, "That didn't work right
now", "Someone". PROPOSED (seven rows): composer accessible name, Delete, the deletion explanation, Delete for everyone,
Deleted, Refresh, conversation-not-open.

## 11. Validation

**Local, on this workstation, before the first push:**

| Check | Result |
|---|---|
| API `tsc --noEmit` | clean |
| API Jest (all) | **223 suites, 5041 tests, all pass** — incl. the real-chain reply spec, the conversation spec and the route census |
| Mobile `tsc --noEmit` | clean |
| Mobile ESLint (every changed file) | clean |
| Mobile Jest (all) | 2086 pass; the 6 documented host-locale tests (`depth`, `w2-account-access`; this host resolves Arabic) fail exactly as on the baseline — ENVIRONMENT. Every S4 suite passes (S4-01 + S4-02: 57 tests) |
| `npm run test:database` | **1295 / 1295** |
| `verify:db:hazards` | 0 findings |
| Root contracts (`node --test tests/*.test.mjs`, forward-safety and task-closure governance included) | **1156 / 1156** with the git-ignored local `apps/mobile/android` build directory set aside; with it present, five contracts that assert its absence fail — ENVIRONMENT (the same known local-only condition the S4-01 record names) |
| Real PostgreSQL (`verify-migration-0139`, re-anchored `0138`) | **not runnable locally**: this workstation has no PostgreSQL, and the focused gate takes a pushed `target_ref`. It runs in API CI on the review-candidate head, with `0089` / `0090` / `0118` / `0119` / `0133` / `0138` |
| VAL-01 simulation on the local commit | API_HEAVY, MOBILE_CONTRACT, MOBILE_NATIVE_BINARY all **RUN** (first head); native impact **yes**; S4 legs **6 of 6** (a workflow file changed → every leg) |

**Failure classifications so far (all local, all before any push):** the S4-02 contract's own over-broad patterns and a
stray control character written by a scripted edit (VALIDATION / PROOF, fixed in the contract only); one unneeded
runtime-entry barrel export caught by the exact-surface test (VALIDATION / PROOF, export removed); `hideKeyboard` in the
two new flows, which the T-13 contract forbids (VALIDATION / PROOF, removed). No Product code changed for any of them.

GitHub results are recorded in the PR conversation and, once final, here.

## 12. Backlog reconciliation (BG-05 / BG-08)

- **Inherited:** none by owner. `QAN-BL-VOICE-01`'s reopen condition ("a production implementation task explicitly claims …
  Voice Note persistence / playback") is NOT met: S4-02 claims no Voice Note; it stays `OPEN — UNASSIGNED`.
- **Admitted (BG-06, a canonical deferral — CW2-02 §58 and I-03F):** `QAN-BL-CW-02` — Shared Standing Context
  admission: a Personal-context collector, the Source Disclosure detector, the private source-state resolver and the JIT
  grant / revoke surface — `UNASSIGNED`, `MEDIUM`, `OPEN — UNASSIGNED`. The register holds **43** items (15 / 0 / 11 / 17;
  25 / 17 / 1). Until they exist, S4-02 offers no private candidate and the Shared reply reasons over Shared
  history only.
- **Unchanged:** `QAN-BL-CW-01`, `QAN-BL-ACCT-01`, `QAN-BL-CI-01`, `QAN-BL-LAUNCH-03`, every other item.

## 13. Stage-4 Gap Matrix (S4-02 delta)

| # | Candidate | Class | Disposition |
|---|---|---|---|
| G-05 | Shared conversation / attribution | 2 | §5–§8 |
| G-06 | Shared voice notes | 4 | `QAN-BL-VOICE-01` (no durable audio runtime; nothing faked) |
| G-08 | Standing context in a World | 2 / 4 | Shared-history context delivered (§7); Personal Standing Context admission → `QAN-BL-CW-02` |
| G-14 | Delete own material (current member) | 2 | §5, §8; the Public derivative stays `QAN-BL-CW-01` |
| G-19 | Former member's own-material control | 5 | **S4-03** (unchanged) |
| G-23 | Production enablement of the Shared gates; a production cost bound on Shared generation | 5 | `I-09` / `CW2-08` launch work (unchanged; the conversation scope ships closed) |
| G-07, G-09 – G-13, G-15b – G-18, G-25, G-26, G-29 | | unchanged | as the S4-01 record §17 assigns them |

**Orphan gaps = 0.** Every candidate is delivered here, owned by an existing item or task, or admitted (`QAN-BL-CW-02`).

## 14. Stage-4 status

Stage 4 stays **ACTIVE**: S4-03 and S4-04 remain.
