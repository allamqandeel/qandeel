# QANDEEL — SHARED-VIS-01 Shared World Living Analysis Map Product Integration — Implementation Record v1

**Status:** `ACTIVE — IMPLEMENTED ON feat/shared-vis-01-shared-living-analysis — NOT MERGED; NOT CLOSED`

Closure waits on three things, in this order: the Product Owner's visual acceptance of the native screenshots (§11), the
SHARED-VIS-01 Product Copy Gate (§12, `OPEN — 6 rows PROPOSED`), and green CI on the exact head. Merge waits on the
Product Owner's «ادمج». Stage 6 is not started.

| | |
|---|---|
| Backlog owner | `QAN-BL-CW-03 — Shared World Living Analysis Map / Semantic Geography Product Integration` |
| Baseline | `d4255744d090b11f383c270b5f1fdeb96af4ba51` (the merge of PR #320), verified as `origin/main` at kickoff |
| Branch | `feat/shared-vis-01-shared-living-analysis` |
| Migration | `0148_shared_semantic_field_living_analysis_v1.sql` (one, additive, its own schema `shared_semantic_private`) |
| Product Owner decisions | Option A and D1–D7 of the SHARED-VIS-01 Product Decision Gate (2026-10-08), §3 |
| Does not touch | Personal or Public semantics, the common renderer, Matching (Stage 6), Replay (Stage 7), provider binding (Stage 8A), Voice (8B), economy (9), reactions, heavy-history scale (`LA-SCALE-01`), any I-04 runtime |

---

## 1. Current-truth reconciliation

`origin/main` at kickoff was `d425574`: PR #319 (S5-04) merged as `99470a92efe580f8939c0e416da8a3b9289a7a5f` and its
follow-up fix PR #320 merged as `d4255744d090b11f383c270b5f1fdeb96af4ba51`. **Stage 5 — Public World Product Integration is
therefore DONE / MERGED**, and by the Product Owner's sequencing `QAN-BL-CW-03 / SHARED-VIS-01` is the current task.
`QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md` and `QANDEEL_PRODUCT_ROADMAP.md` were reconciled in this change; the
S5-04 record keeps its pre-merge banner as historical evidence. "Stage 5 DONE" is not "Public World launch-ready".

## 2. Research and the anti-duplication matrix (written before implementation)

The research (§B of the task) established one blocking fact: **no Shared semantic data existed anywhere.** A Shared World
held members, governance, history shares and a chronological stream of material; 0140 states it outright ("no canonical
topic / Session / period grouping source exists … so none is invented"), and the `QANDEEL_ANALYSIS` material kind was
reserved with no producer. The common renderer, by contrast, was already world-agnostic (S5-03B R2).

| Capability | Existing owner — consumed, never rebuilt | Missing integration — built here |
|---|---|---|
| Renderer | `LivingAnalysisSurface → WorldViewSurface → WorldCanvas`, `useWorldView`, LA-VIS-01 material, Reduced Motion, accessible semantic step | a Shared consumer: `SharedLivingAnalysis` + `SharedFieldView` (view glue only) |
| Semantic-field camera / disclosure | the S5-03B semantic-field policy (`public-field-camera`, `placePublicField`, `PublicExperienceMark`, `layoutFieldLabels`) — world-neutral | nothing: re-exported and consumed unchanged, owned per World by the Shared field controller |
| Semantic data | the frozen I-04G vocabulary: `QANDEEL_ANALYSIS`, `MATERIAL_DEPENDENCY`, the 0090 QANDEEL core, the owner-deletion closure | the Shared semantic place: one `QANDEEL_ANALYSIS` per place + one additive relation for themes, region and World-local coordinates (0148) |
| Interpretation / placement | the S5-03A / S5-03B provider-neutral port pattern and their shape rules and coordinate decoder | Shared ports (`SharedSemanticInterpreter`, `SharedSpatialPlacer`) reusing those rules; both refuse until Stage 8A |
| Generation authority | the S4-02 I-03 chain: EffectiveContext, audience-wide visibility, Source Disclosure Gate, revalidation, commit binder, server-owned commit under a lease | one pass service composing the same chain (`connected-worlds/material-commit/shared-semantic-place.service.ts`) and a per-World pass lease (0148) |
| Conversation | S4-02 `SharedThread` / `SharedSendBar` / controller, unchanged | one entry from the World's chrome and Back to the same field (D7); the conversation and the ended World's read exclude `QANDEEL_ANALYSIS` |
| Authority | S4-01 authority-first entry, tickets, denial | the field opens only after ALLOW and is forgotten on denial / leave / removal |
| Activity / Direct Entry | S4-04 `enter()` → `openWorld`, unchanged | none: Direct Entry lands on the exact World's main experience, its field |
| History / time | durable chronology (`established_at`, history items) | none: no Shared Timeline UI (D5) |

## 3. Product Owner decisions (SHARED-VIS-01 Product Decision Gate, 2026-10-08)

Option A approved — Shared Semantic Meaning Chain + Living Analysis Integration — with D1–D7:

- **D1 — Semantic Place:** a meaningful unit derived from authorized Shared material: a concise meaning, themes, exact
  source provenance, a stable World-local identity and place; never a message disguised as a point; no separate
  Decision / Question / Follow-up taxonomy in v1.
- **D2 — Production:** QANDEEL produces meaning from eligible authorized Shared material; reuse existing interpretation,
  Safety, routing, bounded generation and placement capabilities where compatible; provider-neutral; fail-closed until
  Stage 8A; no fake model output in production; no member review in v1, but attribution, access and correction rules
  stay intact.
- **D3 — Visibility:** a place is visible only when the reader currently may see EVERY source it depends on; no
  cross-World disclosure through counts, positions, labels or cached state.
- **D4 — Deletion:** a place must not remain visible once a required source is deleted, erased or no longer authorized;
  no cached meaning after source loss; no silent regeneration; reconcile with the Product Definition's preservation rule.
- **D5 — Timeline:** no new Shared Timeline UI; durable chronology and stable geography kept; future Shared temporal
  navigation is a separate Product decision.
- **D6 — Members and QANDEEL:** not invented map objects in v1; their identification, attribution and governance stay.
- **D7 — Conversation:** Living Analysis is the main experience; the S4-02 conversation stays one clear entry away; Back
  returns to the same World with its camera, depth and focus; sending, deletion, ordering, attribution and permissions
  are preserved.

### 3.1 Canon reconciliation (no contradiction found)

- **D4 against the Product Definition §19** ("analysis that happened while the material existed is not erased
  automatically"): the frozen I-04G dependency semantics already draw this line. A place states the meaning OF its
  sources, so it is source-content-bearing (`MATERIAL_DEPENDENCY`): owner deletion of any source makes it `UNAVAILABLE`
  and physically removes its body through the frozen 0090 closure (CW2-02 §27), and 0148's relation is bound to that body
  `ON DELETE CASCADE`. §19's preserved analysis is QANDEEL's conversational output, which carries no material dependency
  and stays as historical discussion. Preservation applies only where lawful source authority remains.
- **D2 "eligible QANDEEL contributions":** under the frozen core (0090 as 0119 remediated it), QANDEEL's conversational
  output records an UNRESOLVED additional human requirement and is refused as a `MATERIAL_DEPENDENCY` source
  (`SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE`, proven by `verify-migration-0148.mjs`). It is therefore not an eligible
  source, and recording it as an unproven influence would break exact provenance. v1 places are read from the World's
  `HUMAN_TEXT` only. Changing this would be a controlled change of the frozen I-04G core; it is recorded as
  `QAN-BL-CW-05` (§10) and not attempted here.

## 4. What a Shared semantic place is (migration 0148)

- **The meaning** is ONE `QANDEEL_ANALYSIS` material committed through the frozen 0090 QANDEEL core, with one
  `MATERIAL_DEPENDENCY` edge per exact source. The core derives its audience, its required approvers (the union of its
  sources' human authorities — never "every member") and its history item, and refuses stale or forged I-03 evidence.
- **The rest of the place** — themes (1–3 primary, 0–3 secondary), semantic region, the World-local coordinates
  (`QANDEEL_SHARED_FIELD_V1`, exact integers within ±2^62) and the layout version — lives in
  `shared_semantic_private.semantic_places`, keyed by the material, append-only, removed only with its meaning body.
- **Identity** is server-derived from (the pass's human command, the place ordinal), so an equivalent retry names the same
  place; nothing a client sends chooses an identity, a coordinate or a source.
- **Production** runs as one pass per committed human message, under a per-World lease (one live pass per World, a
  rolling per-World budget), bound to the `SHARED_CONVERSATION` capability. The interpreter receives only human text every
  current recipient may see (no author, Name or identifier) and the World's existing meanings that rest entirely on it;
  it answers 0–3 places with their exact sources; the placer places each in its own World. While no provider is bound
  (production today) the pass returns before leasing, reading or spending anything: **the production field is empty by
  truth until Stage 8A.**
- **The member reads** (`list_own_shared_semantic_field_v1`, `read_own_shared_semantic_place_v1`,
  `list_own_shared_semantic_place_sources_v1`) serve a CURRENT member of an ACTIVE World only, and a place only when the
  frozen 0089 resolver serves the reader its meaning AND every source. Coordinates travel as exact integer text.
- **The conversation stays the conversation:** the API's conversation projection and the reply's input exclude
  `QANDEEL_ANALYSIS`; the ended World's read moves to the 0148 v2 read (the 0140 read without places).

## 5. The mobile World

An ALLOWed World opens on `SharedLivingAnalysis` — the ONE Living Analysis surface (always dark, `CHROME_ONLY`: no temporal
track, D5) with the World's own band: Back to the Shared root, the World's label, «المحادثة» / Conversation (D7) and
Manage World. The world frame is `SharedFieldView`: the served places under FAR (mass) / MID (legible places and their
one-line meanings) / NEAR (the focused place selected, its region kept, the rest receding), the same drag, pinch,
accessible semantic step and Reduced Motion as Personal and Public, keyed by the World so no presentation continues from
one World into another. The chrome band shows the focused place's panel — its meaning, themes and exact sources with the
conversation's attribution — or the field's honest empty / unavailable state. No member, QANDEEL figure, line, count or
ranking is drawn (D6).

`SharedFieldController` (owned by the Shared area controller) holds ONE open World's places, camera and focus, and a
per-World anchor. It is opened only after the World's entry verdict is ALLOW, reads fresh, then restores that World's
anchor (CW2-07 §43); a remembered focus whose place is no longer served is dropped (§44). It is closed (anchor kept) for the
Shared root, Manage World and ended Worlds, and forgotten on denial, leave and removal. Answers for another World or an
earlier open are dropped. The conversation is the unchanged S4-01 / S4-02 screen; its Back returns to the field, read
again at the same camera and focus. Hardware Back releases a focused place first.

## 6. Changed files

- **Database:** `database/migrations/0148_shared_semantic_field_living_analysis_v1.sql`;
  `database/verify-migration-0148.mjs`; `database/README.md`.
- **API:** `apps/api/src/shared-world/{shared-semantic-interpreter.ts, shared-spatial-placer.ts,
  shared-semantic-field.service.ts, shared-semantic-field.spec.ts}`;
  `apps/api/src/connected-worlds/material-commit/{shared-semantic-place.service.ts, shared-semantic-place.service.spec.ts}`;
  `shared-world.{module,controller}.ts`, `shared-world-conversation.service.ts` (+ spec), `shared-world-lifecycle.repository.ts`,
  `shared-activity.spec.ts` (constructor arity), `http-security/route-rate-limit.census.ts` (two GET routes).
- **Mobile:** `apps/mobile/src/shared-world/field/*` (controller, camera re-export, projection, view, composition, copy,
  barrel, tests); `shared-world-controller.ts`, `SharedWorldArea.tsx`; `runtime-entry/{shared-field-api.ts,
  shared-world-api.ts, index.ts}`; `integration/runtime/integration-runtime.ts`; the S4 proof world
  (`__validation__/{s401-proof-world.ts, S401ProofRoot.tsx, shared-vis-proof-field.ts}`, VALIDATION ONLY); the S4 integration
  tests re-anchored (§9) and `integration/__tests__/shared-vis-01-proof-field.test.tsx`.
- **Governance:** this record; `QANDEEL_CURRENT_STATE.md`; `QANDEEL_PROJECT_MAP.md`; `QANDEEL_PRODUCT_ROADMAP.md`;
  `docs/qandeel-canonical-backlog-v1.md`; `package.json`, `.github/workflows/api-ci.yml`; `tests/shared-vis-01-shared-living-analysis-contract.test.mjs`;
  re-anchored contracts (§9).

## 7. Validation evidence

| Check | Where | Result |
|---|---|---|
| `verify-migration-0148.mjs` (boundary, place, D3 incl. newcomer + history grant + leaver, D4 deletion, ended World) | local real PostgreSQL 17 (embedded), full 0001–0148 chain | PASS |
| Neighbour / census verifiers 0026, 0071, 0089, 0090, 0122, 0125, 0126, 0129, 0131, 0132, 0134–0147 | same database | PASS |
| API specs `src/shared-world`, `src/connected-worlds/material-commit`, `src/http-security` | jest | PASS |
| Mobile `src/shared-world`, `src/public-world`, `src/living-analysis`, `src/integration/__tests__/s4-0*`, `shared-vis-01-proof-field` | jest | PASS |
| Typecheck (API, mobile); focused mobile lint | tsc / eslint | PASS |
| Repository contracts | `node --test tests/*.test.mjs` | see the PR; CI is authoritative |
| API CI / Mobile CI | GitHub | pending on the exact head |
| Native proof | Android emulator, S4 proof build | §11 |

## 8. Deliberately not implemented

A production interpreter or placer (Stage 8A); a Shared Timeline (D5); members or QANDEEL as map objects (D6); explicit
relations between Shared places; search over the Shared field; a map in the ended World's read-only view (§10,
`QAN-BL-CW-06`); dense-world aggregation and LOD (`LA-SCALE-01`); QANDEEL output as a place source (`QAN-BL-CW-05`); any
change to Personal, Public, the common renderer, the I-04 runtime or Stage-4 governance.

## 9. Re-anchored validation (class B — no product semantics changed)

- `apps/mobile/src/integration/__tests__/s4-0{1,2,3,4}-*.test.tsx`: an entered World now opens on its field (D7); the
  journeys that read the welcome, members, messages or composer first open «المحادثة» / Conversation. Every authority,
  denial, isolation and Direct Entry assertion is unchanged.
- `tests/s4-03-shared-lifecycle-governance-contract.test.mjs`: the ended World's read is the 0148 v2 read.
- `tests/s5-03c-…` / `tests/s5-04-…`: Stage 5 and S5-04 are now DONE / MERGED.

## 10. Backlog reconciliation (BG-08)

- `QAN-BL-CW-03` — owned by this task; it stays `DEFERRED — OWNED` with an ACTIVE note until this task's closing change
  tombstones it.
- Admitted (Product Owner decision needed, not this task's to decide): `QAN-BL-CW-05` (QANDEEL conversational output as a
  Shared semantic source — a controlled change of the frozen I-04G core), `QAN-BL-CW-06` (the ended World's read-only
  Living Analysis view, CW2-07 §22), `QAN-BL-CW-07` (Shared temporal navigation, D5).
- Observed, unchanged: `QAN-BL-VIS-01` → `LA-SCALE-01` (Shared density at scale is included in its scope as observed);
  Stage 8A (now also owns the production binding of the two Shared ports); `QAN-BL-ACCT-01` (no new account edge: 0148
  references no account); `QAN-BL-VOICE-01` (voice notes are not projected, so never a place source).

## 11. Native proof (Android)

`qandeel://s401-proof/shared-field/seed` seeds two synthetic Worlds (VALIDATION ONLY, `shared-vis-proof-field.ts`).
Journey: Shared → World A → authority-first shell → field FAR → MID → NEAR focus → panel with sources → Conversation →
Back to the same field → World B (its own places, FAR, no focus) → Activity Direct Entry → denied / ended → Personal and
Public non-regression. Evidence and the screenshots presented for the Product Owner's visual acceptance are recorded in
the PR. **Product visual acceptance: PENDING.**

## 12. SHARED-VIS-01 Product Copy Gate — `OPEN — 6 rows PROPOSED`

| Key | Arabic | English | Status |
|---|---|---|---|
| `fieldLabel` | خريطة المعاني في هذا العالم المشترك | This Shared World's field of meaning | PROPOSED |
| `empty` | لم يتكوّن شيء في خريطة هذا العالم بعد. | Nothing has formed on this World's map yet. | PROPOSED |
| `fieldUnavailable` | تعذّر عرض هذا العالم المشترك الآن. | This Shared World can't be shown right now. | PROPOSED |
| `conversation` | المحادثة | Conversation | PROPOSED |
| `placeUnavailable` | لم يعد هذا المكان في هذا العالم المشترك. | This place is no longer in this Shared World. | PROPOSED |
| `sourcesHeading` | قرأه قنديل من | QANDEEL read it from | PROPOSED |

Every other word is REUSED from its approved owner (Back, Retry, You, Someone, the S5-03A theme headings, the Living
Analysis accessible step) or CANON (Manage World, QANDEEL).
