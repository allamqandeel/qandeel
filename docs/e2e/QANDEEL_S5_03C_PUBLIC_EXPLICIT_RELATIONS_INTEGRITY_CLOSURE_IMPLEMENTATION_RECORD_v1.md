# QANDEEL — S5-03C Public Explicit Relations + Integrity Closure — Implementation Record v1

**Status:** `ACTIVE — IMPLEMENTED ON DRAFT PR — S5-03C PRODUCT COPY GATE OPEN (13 rows PROPOSED, awaiting the Product Owner) — NOT CLOSED — NOT MERGED`

| | |
|---|---|
| Task | `S5-03C — Public Explicit Relations + Integrity Closure` (the third of the Product Owner's three S5-03 tasks) |
| Stage | 5 — Public World Product Integration (**ACTIVE**) |
| Canonical baseline | `origin/main` = `afd5e8caecc06884b5adfdb381eef8e650e03c1f` — the merge of PR #317 (S5-03B), verified by fetch before any work |
| Branch | `feat/s5-03c-public-explicit-relations-integrity` |
| Migration | `0146_public_explicit_relations_integrity_v1.sql` (append-only; 0091–0099 and 0142–0145 untouched) |
| Product decision | the Product Owner's **R+** (2026-10-07): D1–D5 approved with clarifications, D6 replaced (§4) |
| Owns | S5-03B gap `G07` — explicit Public relations, relation lines, integrity closure |
| Does not touch | S5-04, Public Discussion / replies / `@QANDEEL` / Public QANDEEL, Public Activity / Push, Stage 8A, Voice, Replay, Matching, Shared visual integration, CW2-08 publication, signed-out viewing, pricing, exploration lenses, G04 / G05, `QAN-BL-VIS-01`, account deletion |

---

## 1. Current-truth reconciliation

`git fetch origin` proved `origin/main = afd5e8caecc06884b5adfdb381eef8e650e03c1f`, PR #317 merged. The branch was
created from it. The locators still described S5-03B as `ACTIVE — NOT MERGED`; this task corrects them in place
(`QANDEEL_CURRENT_STATE.md` §3.7 and §7, `QANDEEL_PROJECT_MAP.md` §5.1) — **S5-03B = DONE / MERGED through PR #317 at
`afd5e8caecc06884b5adfdb381eef8e650e03c1f`; S5-03C = ACTIVE** — with no separate docs task.

One further B-class docs drift was corrected (Product Owner instruction): the S5-03B record §19 still listed "Public
performance at scale (G04, G05)" under S5-04, contradicting its own R1 withdrawal. §19 now states G04 / G05 as OPEN PRODUCT
GAPS awaiting the Product Owner's ownership decision, owned by no task. S5-03C does not take them (§16).

## 2. Anti-duplication / repo-truth gate

| | Finding |
|---|---|
| A. Canonical relation truth | architecture text only: CW2-04 §16 — a visible relation requires `EXPLICIT_PUBLIC_RELATION` "with public evidence, relation type, endpoint/version validity and current validity state"; D18 (semantic proximity creates no line), D19 (public evidence / version validity), §30 / D31 (deletion removes edges, no ghost), §34 (relation invalidation stales an operation). The Public World Product Definition §11.2–§11.3: a line means a real recorded relation, never similarity; relations are revealed on focus. |
| B. What creates one | not frozen before this task — one example only (Product Definition §11.2). Decided by the Product Owner's R+ (§4). |
| C. Current / stale / invalid | principles only; no state model existed. |
| D. Identities bound | named ("endpoint/version validity"), not defined. |
| E. Visibility / admission law | fully present and consumed: 0095 / 0098 visibility, 0099 disappearance, the frozen audience gate, S5-03B's one visible-entry derivation (`derive_visible_spatial_entry_v1`). 0092 forbids a package item referencing outside its package, so a relation cannot be a package item. |
| F. Relation reader / resolver | none in 0091–0099, 0142–0145, `apps/api` or `apps/mobile`. |
| G. Relation-line renderer | yes, generic and optional: `WorldCanvas.renderConnections` (default none) and the canonical connection style `WorldTether` (LA-VIS-01). LA-VIS atmospheric filaments are a stitched-turbulence shader in `WorldStrata.tsx`: no endpoints, no identity, no accessibility node. |

So nothing was rebuilt: the relation authority is the minimal additive boundary that did not exist, and everything it
needs about visibility, versions, revisions, placement, admission, erasure and disappearance is consumed unchanged.

## 3. The central law

**SIMILARITY IS NOT A RELATION.** Zero explicit relations = zero relation lines. Proximity, a shared semantic region, colour,
theme, popularity, discussion, views, recency and any score create nothing: the only writer of a relation in the whole
database is a human controller's request, and it becomes a relation only on the other side's explicit acceptance
(verifier B06, L02, L08; deploy assertion H3a).

## 4. The Product decision applied (R+, Product Owner, 2026-10-07)

- **D1–D5 approved, with clarifications:** one explicit, mutual, undirected relation type in v1; QANDEEL creates and
  auto-publishes none (future AI suggestions are outside S5-03C and would still need explicit human authority); the source
  controller initiates; the target controller must explicitly accept before any Public relation exists; a pending request
  may be cancelled by its initiator or declined by the target; once ACTIVE either endpoint controller may remove it;
  canonical evidence is the explicit authenticated authority acts, no free text; the relation binds both exact Experience
  Versions and both exact reviewed revisions; any endpoint version / revision change, withdrawal, disappearance, loss of
  visibility / admission or removal makes it non-servable immediately and nothing carries forward; similarity never
  creates a relation; relation truth never changes geography; no line at FAR or MID; at NEAR, for the selected Experience,
  only its ACTIVE relations whose other endpoint is serveable to that viewer — undirected, unlabelled, non-tappable lines in
  the existing canonical connection style, no counts, panel unchanged.
- **D6 replaced:** S5-03C includes the minimal end-to-end authoring / management surface **inside the existing Public
  authoring workspace** (no separate destination, no graph screen), reusing the existing Public search: request, cancel,
  see a received request, accept / decline, remove, every state re-derived from canonical truth. No Activity, Push or
  notification for relation requests (S5-04). Publication remaining fail-closed is no reason to defer the surface.
- **Copy:** every new string in ONE S5-03C Product Copy Gate, not silently approved; the line's accessible name identifies
  the visible other endpoint (pattern «علاقة مع {0}» / "Relation with {0}"), never "Connected to N" (§13).

## 5. Architecture

```
human controller (auth.uid())                                   viewer (auth.uid(), admitted)
   │ request / accept / decline / cancel / remove                  │ panel read of a served Experience
   ▼                                                               ▼
public.*_public_relation_v1 (INVOKER)                    public.read_public_semantic_relations_v1 (INVOKER)
   ▼                                                               ▼
public_relation_private (DEFINER, pinned) ── reads ──► public_spatial_private.derive_visible_spatial_entry_v1 (S5-03B)
   │ writes only its own two append-only tables          (0098 visibility + reviewed S5-03A revision + current placement)
   ▼
explicit_relations (request: both versions + both revisions)     ← no account, no text, no coordinate
explicit_relation_acts (ACCEPT | DECLINE | CANCEL | REMOVE, side)
```

API: `PublicRelationController` (`/public/authoring/relations`) and the field panel read (`/public/field/experiences/:id`
now carries `relations`). Mobile: the authoring controller's `RELATIONS` screen and workspace section; the field
controller holds only what the latest panel read served; `PublicRelationLines` fills the shared renderer's optional
connection slot. `WorldCanvas`, `WorldViewSurface`, `LivingAnalysisSurface` and every `map/` file are unchanged; Personal
passes no connection of this kind and is unchanged; Shared is untouched.

## 6. Relation truth — migration 0146

- **`explicit_relations`** — one row per request: `relation_type` (`CHECK = 'EXPLICIT_PUBLIC_RELATION'`), the source and
  target Experience, each with its exact Version (composite FK) and exact reviewed S5-03A revision (FK), `requested_at`.
  `CHECK source <> target`. An insert trigger proves each revision belongs to its own version (as 0145 does).
- **`explicit_relation_acts`** — the authority acts: `act` ∈ ACCEPT / DECLINE (side TARGET), CANCEL (side SOURCE), REMOVE
  (either side), `acted_at`. Unique: one acceptance, one ending per relation. The insert trigger admits only a legal
  transition (request → accept | decline | cancel; accepted → remove); nothing is revived or rebound.
- Both tables: append-only for every role (`PUBLIC_RELATION_HISTORY_IS_IMMUTABLE`, 55000), RLS on, no privilege for any
  application role, no text beyond the three closed vocabularies, no direct account FK.
- **Life** (`derive_relation_life_v1`): PENDING | ACTIVE | DECLINED | CANCELLED | REMOVED, from the acts alone.
- **Integrity** (`relation_is_current_v1`): both bound endpoints answer, NOW, from the ONE S5-03B visible-entry derivation,
  with exactly the bound version and the bound reviewed revision. Derived on every read, stored nowhere.
- **Why staleness needs no write:** every input is monotonic in the frozen runtime (the version pointer only advances, the
  current revision is the highest, a withdrawal is append-only, an erasure NULLs content for good, absence is terminal), and
  the bindings are immutable — a relation that stopped matching its pair can never match it again.
- **Commands** (authenticated; the actor is `auth.uid()` admitted by the frozen gate): `request_public_relation_v1`
  (REQUESTED | ALREADY_PENDING | ALREADY_RELATED | UNAVAILABLE; one current relation per unordered pair), and `accept_` /
  `decline_` / `cancel_` / `remove_public_relation_v1` (their word | NOT_PENDING / NOT_ACTIVE | UNAVAILABLE). Idempotent per
  (actor, command id); a reused id for something else is `23505`. Lock order: both Experience rows `FOR UPDATE` in id order,
  then both current packages' items `FOR SHARE` in the same order (the S5-03A / S5-03B discipline, for two Experiences).
- **Owner reads:** `read_own_public_relation_experiences_v1` (own Experiences served now, ≤ 100) and
  `read_own_public_relations_v1` (every PENDING / ACTIVE current relation from the caller's side — ACTIVE, REQUEST_SENT,
  REQUEST_RECEIVED — the other endpoint named by its reviewed meaning only, ≤ 200).
- **Viewer read:** `read_public_semantic_relations_v1(experience)` — for a served Experience, each ACTIVE current relation's
  OTHER endpoint's served entry (place, reviewed meaning, region) and the relation id; ≤ 24, ordered by the other
  endpoint's place (never by anything about the relation).
- **The server channel holds nothing** (`service_role` executes no 0146 function): a relation is a human act. No
  `commit_%` name exists, so the 0071 / 0139 / 0140 / 0141 `commit_%` census family is unaffected (re-run anyway, §17).
- **Deploy assertions H1–H7** (the migration fails otherwise): no server grant and no derivation reachable; the CW2-08 seam
  still `NOT_EVALUATED`; no S5-03C body reads the field prefilter, nearby, search, a distance, a region comparison, a theme,
  vitality, discussion, publication or private truth, or writes outside its family; exactly one writer of a relation and
  one of an act in the whole database; pinned definers; append-only; no free text; no account FK; one Public World and the
  signed-out policy `UNRESOLVED`.

## 7. Integrity laws proven (real PostgreSQL, `database/verify-migration-0146.mjs`)

| # | Law | Proof |
|---|---|---|
| 1 | Both endpoints belong to the ONE Public World | every endpoint is a 0091 Public Experience (FK); H7; the visible-entry derivation reads the ONE visibility |
| 2 | Both endpoints serveable to this exact viewer | `admitted_viewer_v1` + both endpoints current, in every read (L08: unadmitted / anon / token-less read nothing) |
| 3 | Exact current visible version / reviewed revision | bound by FK (L04 row check); `endpoint_is_current_v1` compares both exactly |
| 4 | A stale relation is not served | I01 (new current revision), I02 (successor version) |
| 5 | A withdrawn relation is not served | L10 (remove), L11 (decline, cancel) |
| 6 | A superseded endpoint leaves no old edge | I01, I02 — and a pending request through it is stale too (I01) |
| 7 | Owner deletion / disappearance leaves no orphan line | I04 (ASSURE-F05 erasure), I05 (0099 removal from the Public World), I03 (withdrawn approval) |
| 8 | No inference of a hidden endpoint through line / count / metadata / panel / placeholder | `assertGone`: no row from the surviving endpoint, the gone id never appears, nothing from the gone one, no management row, every act UNAVAILABLE; I03 — a1's read shows only the visible other endpoint, no count |
| 9 | One visible endpoint never discloses an invisible other | I03, I04, I05 (`assertGone`) |
| 10 | Admission / visibility re-derived, never a client cache | every read derives; mobile: every panel read REPLACES the relations (§10) |
| 11 | Fails closed | every non-served path answers nothing / UNAVAILABLE; a failed mobile read shows no relation |
| 12 | No relation survives in a presentation cache | I07 — staleness wrote nothing; mobile disappearance tests (§12) |

Plus: B01–B08 (boundary, grants, columns, RESTRICT edges, single writers, no geography / similarity in any body, seam),
L01–L12 (lifecycle, idempotency, sides, illegal transitions and direct mutations refused by the database), X01 (launch
closure). **Mutation checks:** replacing the integrity gate with `true` fails the verifier at the integrity stage;
making every request ACTIVE without acceptance fails it at L04.

## 8. Similarity alone draws no line — the proof

- **DB:** a1 and a2 are placed side by side (10 units apart) in the SAME semantic region; with nobody asking, both read
  zero relations and zero management rows (L02); after a1–b is accepted, a2 still has none (L08).
- **API:** the panel serves `nearby` (similarity context, S5-03B) and `relations` (explicit) as different fields; a
  nearby Experience never appears as a relation (spec "the panel carries explicit relations only").
- **Mobile:** `explicitRelationSegments` with no served relation is empty even for the same-region neighbour; no
  accessible "Relation with" element exists for it; FAR and MID draw nothing.

## 9. Geography is untouched

No S5-03C function writes `public_spatial_private` or reads a distance (H3, B07); placements and the whole field read are
byte-identical before and after requests, acceptance and lines (L09); the mobile projection places every node at exactly
the same point with or without relations (unit test). Camera, pan, zoom, Semantic Zoom thresholds, motion, hit testing,
search geography and selected-place geometry are unchanged (no `map/` file and no camera / projection file changed).

## 10. API

- `GET /public/authoring/relations` → `{ experiences: [{ id, meaning }], relations: [{ relationId, experienceId, other: { id, meaning }, state }] }`
- `POST /public/authoring/relations` `{ commandId, experienceId, otherExperienceId }` → `{ outcome }` (strict class)
- `POST /public/authoring/relations/:relationId/{accept|decline|cancel|remove}` `{ commandId }` → `{ outcome }`
- `GET /public/field/experiences/:id` → the S5-03B panel **plus** `relations: [{ relationId, other: entry }]`

Every body is exact (extra keys → 400); no route takes a user, side, type, strength, distance or text; nothing is logged;
no server channel. Route census: GET + four acts `AUTHENTICATED`, the request `SECURITY_SENSITIVE` (it creates durable
state another human is asked to accept, as preparing a package does).

## 11. Mobile — management inside the authoring workspace

- **Workspace** (existing screen): after the drafts and approval requests, «طلبات علاقة» / "Relation requests" (each:
  the other Experience's meaning, «مع تجربتك: {0}» / "With your experience: {0}", Accept, Decline) and «تجاربك في العالم
  العام» / "Your experiences in Public World" (each opens its relations). Drawn only when non-empty.
- **`RELATIONS` screen** (inside the same workspace, its own Back): the Experience's meaning; requests received for it;
  current relations (Remove); its waiting requests (Cancel); «ربطها بتجربة أخرى» / "Relate it to another experience" with the
  hint, the SAME Public field search (`/public/field/search`, the S5-03B label), its results (never the open Experience
  itself), each with «طلب علاقة» / "Request a relation".
- **Truth:** every screen and every act re-reads `GET /public/authoring/relations`; nothing an act assumed is shown; a
  failed read shows no relation section (fail closed) and leaves the rest of the workspace usable; opening an Experience
  the server no longer serves is the honest unavailable state.
- **Not here:** no Activity, Push, notification or badge for a request (S5-04); no suggestion, count, rank, strength,
  type or free text.

## 12. Mobile — the field, the renderer and accessibility

- The field remains ONE field. At NEAR with a selected Experience whose latest panel read served relations, the view
  supplies `PublicRelationLines` to `WorldCanvas.renderConnections`: one straight `WorldTether` (the canonical connection
  style) from the selected place to each other endpoint's served place. FAR, MID, no selection, or no served relation →
  nothing. Undirected, unlabelled, not pressable, no count; the panel is unchanged.
- The other endpoints a panel serves join the field as served entries (as nearby context already does) — they are served
  to this viewer, so drawing them discloses nothing.
- **Disappearance:** every panel read replaces the relations (no merge, no cache); a complete field read that no longer
  serves an endpoint removes its relation at once; an ABSENT panel removes all. Proven by Jest.
- **Accessibility:** each drawn line has exactly one accessible, non-pressable element (`pointerEvents="none"`, no role,
  no action) named «علاقة مع {0}» / "Relation with {0}" by the OTHER endpoint's reviewed meaning — served to this viewer,
  or there is no line. The LA-VIS atmosphere (filaments, nebula, stars) stays inaccessible decorative paint and is never
  announced; a nearby / same-region place is never announced as a relation. The lines draw no animation of their own
  (Reduce Motion: unchanged, the shared presentation camera's).
- **Renderer law:** no fork; `WorldCanvas` decides nothing; the Public World owns the relation semantics; Personal is
  visually and behaviourally unchanged (no Map file changed; the VPORT-02 pins and the Personal golden are untouched).

## 13. S5-03C Product Copy Gate — OPEN

Copy census first. **Reused** (byte-exact, from their own modules): Back, Try again, the neutral action refusal and Cancel
(S4-01 gate); the search label and the no-match line (S5-03B gate). **New — 13 rows, PROPOSED, not approved**
(`apps/mobile/src/public-authoring/relation-copy.ts`):

| Key | Arabic | English | Context | Accessibility use |
|---|---|---|---|---|
| `relationsHeading` | تجاربك في العالم العام | Your experiences in Public World | workspace section heading | header |
| `relationsTitle` | العلاقات | Relations | the RELATIONS screen title | header |
| `receivedHeading` | طلبات علاقة | Relation requests | workspace + screen section heading | header |
| `withYours` | مع تجربتك: {0} | With your experience: {0} | names the reader's own Experience on a received request | read in order |
| `activeHeading` | علاقات قائمة | Current relations | screen section heading | header |
| `sentHeading` | بانتظار القبول | Waiting for acceptance | screen section heading (own requests) | header |
| `requestHeading` | ربطها بتجربة أخرى | Relate it to another experience | screen section heading | header |
| `requestHint` | لا تظهر العلاقة إلا بعد أن يقبلها صاحب التجربة الأخرى، ويمكن لأي منكما إزالتها. | A relation appears only once the other experience's owner accepts it, and either of you can remove it. | under the request heading | read in order |
| `requestAction` | طلب علاقة | Request a relation | button on a search result | button label |
| `accept` | قبول | Accept | button on a received request | button label |
| `decline` | رفض | Decline | button on a received request | button label |
| `remove` | إزالة العلاقة | Remove relation | button on a current relation | button label |
| `relationWith` | علاقة مع {0} | Relation with {0} | none visible — the line is unlabelled | the accessible name of one relation line; {0} = the other Experience's reviewed meaning |

No row speaks of nearness, similarity, strength, a count, a type or QANDEEL finding a relation. **The gate stays OPEN until
the Product Owner decides;** S5-03C cannot close before that (Task Contract §11).

## 14. MATERIAL / REASONING and `QAN-BL-ACCT-01`

The relation tables hold identities, instants and three closed vocabularies — no content, so no ASSURE-F05 erasure path is
needed: an erasure darkens the reviewed interpretation, the visible entry goes, and the relation stops being served at
that instant (I04). **`QAN-BL-ACCT-01 — HIGH / OPEN`:** no S5-03C column names an account and no FK reaches one directly,
but each relation binds two Experience Versions and two S5-03A interpretations `ON DELETE RESTRICT` (B05a), and those bind
their recorders' accounts. These edges are recorded in the backlog's current-truth note as part of the blocker; S5-03C
solves nothing of it. The Public World is not launch-ready.

## 15. Backlog reconciliation (BG-05 at kickoff, BG-08 now)

- **Inherited by owner:** none — no backlog item names S5-03C. G07 was an S5-03B Gap-Matrix assignment, delivered here.
- **Observed, unchanged:** `QAN-BL-VIS-01` `OPEN — UNASSIGNED` (real-phone / heavy-history / LOD stress — relation density
  adds to what it must one day prove; not closed); `QAN-BL-CW-03 / SHARED-VIS-01` `DEFERRED — OWNED` (Shared untouched;
  still blocked until Stage 5 is DONE); `QAN-BL-ACCT-01` `OPEN — UNASSIGNED` (current-truth note added, §14).
- **Admitted:** none. G04 / G05 are OPEN PRODUCT GAPS awaiting the Product Owner (not backlog items, not self-assigned);
  relation notifications are S5-04's by the Product Owner's decision; the export footprint is `E2E-D-16`'s.
- The register still holds **44** items: 17 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9 `OPEN — UNASSIGNED`, 18
  `CLOSED — TOMBSTONE`; by severity 27 `HIGH`, 16 `MEDIUM`, 1 `LOW`.

## 16. Stage-5 Gap Matrix (S5-03C)

| # | Gap / observation | Class | Owner / disposition |
|---|---|---|---|
| G01 | Explicit relations, lines, integrity closure (S5-03B G07) | 1 — this task | **delivered** (§6–§12) |
| G02 | The S5-03C Product Copy Gate (13 rows) | 1 — this task, before closure | §13 — PROPOSED, awaiting the Product Owner |
| G03 | Activity / Push / notification for a relation request or acceptance | 4 assigned | S5-04 (Product Owner decision R+); the management surface is sufficient when reached directly |
| G04 | Inherited S5-03B G04: field / search read-time derivation at scale | **OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision** | none named; not self-assigned |
| G05 | Inherited S5-03B G05: `LIMIT 400` field read, no dense aggregation — and, in the same bounded-v1 family, S5-03C's own read bounds (≤ 24 lines per Experience, ≤ 100 own Experiences, ≤ 200 own relations per management read) | **OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision** | none named; not self-assigned |
| G06 | Future AI-suggested relations | 5 — observe | outside S5-03C; would still need explicit human authority (R+); no task named |
| G07 | `PUBLISHED` / CW2-08 / Stage 9 (relations become reachable in production only when publication opens) | 3 existing owner | `CW2-08` / Stage 9 — unchanged; fixtures prove the path |
| G08 | Account deletion — new relation `RESTRICT` dependents | 3 existing item | `QAN-BL-ACCT-01` — HIGH / OPEN (§14) |
| G09 | Export My Data does not include relations | 3 existing owner | `E2E-D-16` |
| G10 | Relation density at real scale / on a real phone | 3 existing item | `QAN-BL-VIS-01` — OPEN / UNASSIGNED |
| G11 | No native device leg for the relation surfaces (production World is empty; Jest covers both languages' copy, field, workspace) | 5 — observe / report | the Product Owner decides whether one bounded smoke is required before merge |

**Orphan gaps = 0.**

## 17. Validation

Local real PostgreSQL 17 on `localhost:55432` (embedded binaries; never the hosted database): bootstrap + every migration
< 0146 into a base database, then `0146` applied on a copy.

| Check | Result |
|---|---|
| `0146` applies on a fresh pre-0146 database; deploy assertions H1–H7 pass | PASS |
| `database/verify-migration-0146.mjs` (boundary, similarity + lifecycle, integrity, launch closure) | PASS |
| Mutation checks: integrity gate → `true`; every request ACTIVE | both caught |
| Neighbouring verifiers on the 0146 database: `0026`, `0071`, `0090`–`0099`, `0121`, `0122`, `0139`, `0140`, `0141`, `0142`, `0143`, `0144`, `0145` | 22 / 22 PASS |
| `0133` | not run locally — needs `psql`, absent on this machine (C — infrastructure, known since S5-02); CI runs it |
| API Jest — `src/public-world`, `src/http-security` (incl. the new `public-relation.spec.ts` and the route census) | 140 / 140 |
| API `tsc --noEmit` | PASS |
| mobile `tsc --noEmit` | PASS |
| mobile Jest — `src/public-world`, `src/public-authoring` (incl. the new S5-03C suite, 12 tests) | 99 / 99 |
| mobile Jest — the wider touched scope: `src/integration` (runtime wiring changed), `src/runtime-entry`, `src/map`, `src/living-analysis` with the above | 785 / 791: the 6 failures are exactly the recorded local-locale baseline (F11); the visual fixture re-anchored (F10) |
| mobile ESLint on every touched mobile file | 0 errors (28 warnings: the existing file-wide `ReadonlyArray` style) |
| root static contracts — S5-01, S5-02 (re-anchored), S5-03A, S5-03B (re-anchored), and the four other contracts that pin Public / migration facts | 79 / 79 |
| root static contracts — the new S5-03C contract, task-closure governance, Living Analysis map runtime, VPORT-01, VPORT-02, T-12P, canonical Home placement (migration naming), VAL-01 | 121 / 121 |
| root forward-safety gate (mirrors the tree, performs the known future mutations, re-runs every contract) | 35 / 35 |

## 18. Failure classification (A Product / Security · B Validation / Proof / Docs · C Infrastructure)

| # | Where | Class | Disposition |
|---|---|---|---|
| F01 | my verifier: an `ACCEPT / SOURCE` act on an ACTIVE relation hit the transition trigger (55000) before the side CHECK | B | the side CHECK is proven on a PENDING request; the transition refusal separately |
| F02 | my verifier: a publisher correction on a PUBLISHED Experience (S5-03A corrects READY_FOR_REVIEW only) | B | a new current revision of a published version is written through the frozen 0096 primitive, as 0144's verifier does |
| F03 | S5-02 contract: the Public module's controller list and the authoring wiring line, exactly | B | re-anchored: the relation controller joins the SAME module; the workspace also receives the relation transport and the SAME field search |
| F04 | S5-03B contract 7 and mobile isolation census: "no relation" in the field files | B (superseded by canon) | re-anchored narrowly: the three files that carry the EXPLICIT relation (client, controller, view) may name it; every other S5-03B field file still names none; no file draws an edge / Line / Path of its own; S5-03C's contract pins the source |
| F05 | S5-03B contract: "no `renderConnections`" in `PublicFieldView` | B (superseded by canon) | re-anchored: the only connection is `PublicRelationLines`; still no tether / Path / Line in the view itself |
| F06 | S5-03B API spec: the panel fixture and the RPC list | B | re-anchored: the panel also reads `read_public_semantic_relations_v1`; the geography files still name no relation |
| F07 | my mobile test: a test id containing `line` tripped the field isolation census | B | renamed `qandeel-public-explicit-relation-*` |
| F08 | my mobile test: the palette fixture key | B | `CANONICAL_VISUAL.palettes.DARK.standard` |
| F09 | `verify-migration-0133` locally | C | `psql` absent locally (known); CI is the proof |
| F10 | `s5-03b-visual-fixture` (the proof world's synthetic panel) answered without `relations`, so the strict client refused it | B (fixture drift) | the fixture answers the current panel contract with `relations: []`; no relation is fabricated from its regions |
| F11 | mobile Jest `w2-account-access` / `depth` (6 tests) | B — Validation / Baseline | the recorded local-locale baseline (S5-03A F13, S5-03B F05); untouched by S5-03C |

No Product, Security or Privacy defect was found in the frozen runtime, S5-03A or S5-03B.

## 19. Remaining Stage-5 ownership

- **S5-03C:** closes after the Product Owner decides the Copy Gate (§13) and reviews the Draft PR.
- **S5-04 — Discussion + Public QANDEEL + Final Public Integration:** discussion, replies, Public QANDEEL, Public Activity /
  Push (including relation notifications), vitality / instant rendering. Not started.
- **G04 / G05:** OPEN PRODUCT GAPS awaiting the Product Owner's ownership decision.
- **Stage 8A:** the S5-03A interpreter's and the S5-03B placer's production providers. **Stage 9 / CW2-08:** `PUBLISHED`.
- **`QAN-BL-ACCT-01` remains HIGH / OPEN.** Stage 5 is not DONE.

## 20. Validation results (this delivery)

Every local result is in §17. The broad integration proof is GitHub CI on the pushed head (one push); its result is reported on the Draft PR, not in this record.
