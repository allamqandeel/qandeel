# QANDEEL — S5-03B Public Semantic Field + Stable Spatial Placement + Viewer Runtime — Implementation Record v1

**Task:** `S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime` (Stage 5 — Public World Product
Integration; the second of the Product Owner's three S5-03 tasks)
**Task Contract:** the Product Owner's S5-03B Task Contract (2026-10-06)
**Canonical baseline:** `c9338af9ecbfcecccc281f96f52fab335ad9bc7b` (the merge of PR #316, S5-03A)
**Branch:** `feat/s5-03b-public-semantic-field-viewer`
**Status:** **`S5-03B IMPLEMENTED — NOT MERGED — S5-03B PRODUCT COPY GATE OPEN (16 rows PROPOSED)`**.
Claude does not merge it. It waits for the Product Owner's Copy Gate decision and independent review. S5-03C is not started.

> Public World becomes a World. Every reviewed meaning of a semantically ready Experience Version receives ONE stable
> place in the ONE Public semantic field — canonical world coordinates, bound to that exact version and that exact
> reviewed S5-03A revision, committed once and never moved. Nearness in the field is nearness of meaning and nothing
> else. The viewer explores the field at FAR / MID / NEAR, searches the same field, and opens a compact panel over it.
> Every read is decided for the viewer now: admission, canonical visibility, the exact visible version, its reviewed
> meaning and its current place. PUBLISHED stays unreachable, so production legitimately shows an empty World — and
> nothing stands in for it.

---

## 1. Baseline / branch / head

| | |
|---|---|
| Baseline | `c9338af9ecbfcecccc281f96f52fab335ad9bc7b` — `origin/main` confirmed equal at kickoff (fetched), working tree clean, migration tip `0144_public_semantic_interpretation_publisher_review_v1.sql` |
| Branch | `feat/s5-03b-public-semantic-field-viewer`, cut from that exact SHA (not from the S5-03A branch) |
| Pull request | reported in the completion report |
| Head | the commit carrying this record; the exact SHA is reported in the completion report |
| Migration | `0145_public_semantic_field_location_viewer_v1.sql` (one migration; no frozen function replaced) |

**Current-truth reconciliation done first (Task Contract §2):** S5-03A is `MERGED / CLOSED` through PR #316 at
`c9338af9…`, its Product Copy Gate CLOSED (21 / 21 APPROVED, Product Owner, 2026-10-06); S5-03B is ACTIVE. Applied to
`QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md` and the backlog's reconciliation paragraphs; the S5-03A record keeps
its pre-merge banner (historical evidence, as S5-02's did — S5-03A G04).

## 2. Anti-Duplication Gate — what frozen runtime was consumed

| Need | What already exists (consumed, never rebuilt) | Real gap | What S5-03B adds |
|---|---|---|---|
| Serving truth | `resolve_public_visibility_state_v1` (0095, closed by 0098 continuing eligibility), `resolve_public_audience_admission_v1`, `resolve_public_experience_serving_v1` | none | consumed by every viewer read |
| The reviewed meaning | S5-03A: `derive_public_semantic_readiness_v1`, `semantic_interpretations` / `semantic_reviews`, the package fingerprint and lock | readiness is READY_FOR_REVIEW-only; nothing answers "the reviewed interpretation of a VISIBLE version" | `derive_reviewed_interpretation_v1(version)` — the same reviewed-current-revision rule, for any lifecycle, read-only |
| The current revision | `derive_public_experience_current_placement_v1` (0096) | its descriptor is S5-03A's content-free constant | its revision IDENTITY only |
| Placement geometry | none in I-05 (CW2-04 §36 defers the exact model / coordinates) | no coordinates exist anywhere | `spatial_placements` (exact version + exact revision, once) |
| Search / lens / panel | 0097: `simple` configuration, query-only relevance, visibility + admission composition, exact-version guard | its projection document and readers embed / serve the 0096 constant (S5-03A G18) | additive v2 readers composing the same foundation over the reviewed meaning, built at read time |
| Vitality | 0097 exact-version counts | none | read in the panel only (never in geography) |
| Map primitives | the exact integer address type, exact ratio math, `MapScale` clamp, the frozen ×8 Semantic Zoom reinforcement | Personal camera / depth / store / gestures are Personal semantics; the Personal Home scheme is the T-03B2b2 substrate's alone | the Public field's own coordinate space (`QANDEEL_PUBLIC_FIELD_V1`, same exact bound) and a Public-only camera over the same world primitives |

## 3. Authority map

| Fact | Owner | S5-03B |
|---|---|---|
| Meaning determines geography; proximity = similarity only | CW2-04 §14, §15, D16, D17 | the placer sees meaning only; coordinates are never written from anything else (verifier B06) |
| Placement binds the exact version | CW2-04 §14 / D16 | bound to the exact version AND the exact reviewed revision, by foreign keys + the insert guard |
| Material update → new version → new interpretation → placement | CW2-04 §17 | no inheritance across versions (verifier D03) |
| Search / lenses / panels are projections over one World | CW2-04 §27 / D28 | the same field, the same places, no second geography |
| Canonical visibility overrides caches | CW2-04 §28 / D29 | every read re-derives; nothing is cached server-side |
| Explicit relations need EXPLICIT_PUBLIC_RELATION | CW2-04 §16 / D18 / D19 | S5-03C; zero lines here |
| Exact semantic model / coordinates; lens algorithms | deferred, CW2-04 §36 | the placer is provider-neutral (Stage 8A); exploration-lens ranking is NOT built |
| Publication, CW2-08 | 0095, the CW2-08 seam, Stage 9 | untouched; unreachable |

## 4. Stable spatial placement — the schema and why geography is stable

Migration `0145`, private schema `public_spatial_private` (RLS on, no privilege for any application role, every function a
pinned postgres-owned SECURITY DEFINER with an empty `search_path`, `public` SECURITY INVOKER wrappers):

| Relation | Columns | Law |
|---|---|---|
| `spatial_requests` | id, experience, exact version, exact S5-03A interpretation (= the 0096 revision id), requested_at | one owner request per revision (a later command resumes the open one); identities and an instant only |
| `spatial_placements` | id, experience, exact version, exact interpretation, request, `spatial_contract = PUBLIC_SPATIAL_PLACEMENT_V1`, `layout_version`, `coordinate_scheme = QANDEEL_PUBLIC_FIELD_V1`, `world_x` / `world_y` (bigint, within [-(2^62), 2^62 - 1]), committed_at | `UNIQUE (experience_version_id, interpretation_id)`; the request FK binds the same version and revision; the insert guard proves the revision belongs to its own version |

**Why it is stable.** Both relations are append-only for every role, the owner included (no UPDATE, no DELETE, no
exception). The one function in the whole database that writes a coordinate is the commit (verifier B06), and it writes
only an ABSENT placement of an ADMISSIBLE request: a retry, a second request, or a later layout model asking again reads
`ALREADY_PLACED` and moves nothing (verifier P08). Popularity, views, discussion, vitality, age, the alias and the
publication instant have no write path to a coordinate at all. A correction makes a new current revision: the old
placement is not current any more, so it is never served — it is not mutated, moved or deleted (P10) — and the new
revision receives its own placement. A new Experience Version has its own interpretation and its own placement; nothing
is inherited (D03). Coordinates are canonical World state of the PUBLIC World, in its own coordinate space
`QANDEEL_PUBLIC_FIELD_V1`: exact integers within the same exact-integer bound the Map's world math uses — so the mobile
field projects them exactly — but never the Personal World's Home scheme, whose sole owner stays the T-03B2b2 substrate
(the T-03B2b1 contract holds every other migration to that; see F12). Screen coordinates are presentation, never stored.

**Spatial readiness** — `derive_public_spatial_readiness_v1(experience)`, internal, derived on every call, never stored or
supplied: `SPATIALLY_READY` only when S5-03A answers `SEMANTICALLY_READY` for the exact current version and revision, that
revision is still the reviewed current one, and a placement of exactly that version and revision exists; otherwise
`NOT_READY` with `NOT_SEMANTICALLY_READY` | `NO_PLACEMENT`. The future Stage-9 publication boundary composes it beside
semantic readiness and CW2-08 clearance; S5-03B calls no publication primitive.

**Owner surface.** `read_own_public_spatial_preparation_v1` (NOT_SEMANTICALLY_READY | NOT_PLACED | PLACED — never where,
zero rows for anyone else) and `request_own_public_spatial_placement_v1(command, experience)` (REQUEST_OPEN |
ALREADY_PLACED | NOT_SEMANTICALLY_READY | STALE | UNAVAILABLE). The owner can correct MEANING through S5-03A; they cannot
supply or see a coordinate, a region, a rank, a neighbour, a distance, a model or a readiness (verifier B03, P05).

## 5. The placer boundary — provider-neutral; the Stage-8A dependency

- **Port.** `apps/api/src/public-world/public-spatial-placer.ts`: `PublicSpatialPlacer.place(input, signal) → unknown`,
  decoded strictly HERE to exactly `{ x, y, layoutVersion }` (exact integer text within the Public field bound, a bounded slug).
  A neighbour list, a rank, an edge, a float or any extra key is no answer (API spec). The bound is exact (BigInt), never a float.
- **Input = the reviewed meaning only.** `{ contract, semanticRevision, meaning, primaryThemes, secondaryThemes,
  semanticRegion }`, served by ONE server-channel reader whose body reads the request and the reviewed S5-03A row — no
  package text, Personal / Shared / memory / HIM / Matching / provenance, account, Public identity or alias, no vitality,
  discussion or publication instant (deploy assertion H3a, verifier B08, API spec).
- **Test seam.** `FakePublicSpatialPlacer` (NODE_ENV=test only): a pure function of the meaning — the semantic region gives
  a region centre, themes and meaning settle the point within it. It is not a model and never a production fallback.
- **No provider, no fallback.** Outside tests the factory returns `UnconfiguredPublicSpatialPlacer`, which refuses: never
  a hash, random point, alphabetical slot, publication-time spiral or other fake geography. The Product then says
  "QANDEEL couldn't find its place right now" and nothing is written. **Stage 8A** owns the production placer (beside the
  S5-03A interpreter): its adapter composes here around an accounted transport (AI-COST-01), and a provider upgrade never
  recomputes a committed coordinate. The layout space a production model uses must sit inside the Map's representable
  presentation band (≤ 2^40 world units per point at FAR); the fake uses ±2^41.
- **Two channels.** The owner opens the request on their own token; the server reads the input and commits on the
  service-role channel. A client can call neither server function (verifier P05). The placer-reaching route takes the
  strict `SECURITY_SENSITIVE` rate class; one placer call is bounded to 20 s.

## 6. Semantic-version / spatial binding and the 0096 / 0097 reconciliation

- The placement's `interpretation_id` IS the S5-03A revision id (the 0096 placement id). `derive_reviewed_interpretation_v1`
  serves a version's interpretation only when its CURRENT 0096 revision has unerased S5-03A content and a review, both
  bound to the fingerprint of that version's package as it is NOW, and the package is whole.
- **The 0096 private constants never reach the Product.** S5-03B reads the 0096 revision's IDENTITY only; meaning, themes
  and the semantic region (the reviewed lens key) come from S5-03A. The frozen descriptor readers (`0097`
  `search_public_experiences_v1` / `resolve_public_lens_v1` / `resolve_public_panel_v1`, the `0096` placement resolver) and
  the `0097` projection (whose search document embeds the constant label) are left frozen and are not used by the API or
  the mobile app. Proven: deploy assertion H3 bans them by source text; the verifier shows the frozen panel would serve
  `s5-03a.private` (V03) while no S5-03B output, nor the placer input, contains either constant (P04, V09); search for
  `private` / the constants finds nothing (V04); the API spec and the static contract scan the code.
- **Search composes the frozen foundation additively:** the `simple` configuration, `plainto_tsquery`, query-only relevance
  ordering (no number is returned), visibility + admission, exact-version guard — over a document built at read time from
  the reviewed meaning, themes and the visible public bodies, stored nowhere (it can neither go stale nor outlive an erasure).

## 7. The viewer read boundary — visibility / admission law

Every viewer read (`authenticated`) derives the viewer from `auth.uid()` (a token-less caller is refused; anon has no
EXECUTE) and admits them through the frozen audience gate as REGISTERED; signed-out viewing stays closed (the policy is
untouched, deploy H7). Then, per Experience, `derive_visible_spatial_entry_v1`: canonical `PUBLICLY_VISIBLE` (0098) → the
visible version → its reviewed current interpretation → the placement of exactly that version and revision. Anything else
— Draft, READY_FOR_REVIEW (even placed), a stale revision's placement, a wrong version, an erased package, a withdrawn
approval, a guessed id, an unadmitted viewer — is the same answer: nothing. No public tombstone; no existence oracle.

| Read | Bound | Returns |
|---|---|---|
| `read_public_semantic_field_v1(min_x, min_y, max_x, max_y)` | 400, fixed spatial order (never popularity / time) | id, x, y (exact text), meaning, semantic region |
| `search_public_semantic_field_v1(query)` | 20, query relevance only; query one trimmed line ≤ 120 | the same shape: each result is a place |
| `read_public_semantic_experience_v1(id)` | one | meaning, themes, region, the CURRENT display (joined now), the published instant, exact-version vitality counts (0 if none), its place |
| `read_public_semantic_experience_content_v1(id)` | the package | through the ONE `0095` serving resolver for this viewer, only while a served field entry |
| `read_public_semantic_nearby_v1(id)` | 3 | served Experiences nearest by exact spatial distance (numeric), never itself |

Production today legitimately returns an empty World: PUBLISHED is unreachable. No demo, sample or fake Experience is
inserted anywhere; only the verifier reaches PUBLISHED, through the simulated CW2-08 seam inside a rolled-back transaction.

## 8. FAR / MID / NEAR Product behaviour (mobile)

The S5-01 root's `qandeel-public-field` is now `PublicSemanticField` (`apps/mobile/src/public-world/field/`): the field is the
hero; search sits at the top; three restrained controls (closer, farther, the whole World) sit at the end edge; the
compact bottom panel appears only with focus. Frozen for this task:

| Depth | Disclosure |
|---|---|
| **FAR** | the World as a field of meaning: each served place is a quiet point of mass, no label, not individually targetable (hidden from accessibility; the field itself is the FAR target); a tap discloses that part of the field at MID. No fixed categories are invented to fill it |
| **MID** | each Experience is a legible spatial object — a mark and its meaning in one line — and a button (accessible name = its meaning) |
| **NEAR / FOCUS** | one Experience has focus (selected marker); Experiences sharing its semantic region keep a quiet presence and the rest recede; the panel discloses its public detail |

The Public camera (`public-field-camera.ts`) reuses the Map's exact WORLD primitives as presentation math (the exact
integer address type, exact ratio projection, `MapScale` clamp, the frozen ×8 reinforcement) over the Public field's own
coordinate space and NONE of the Personal Map's semantics (no `MC`, store,
Session, Thread, `SemanticDepth`, Temporal Context, RH, gesture hooks). The World is framed from its places alone (centre
and extent, never activity or time). A step IN from MID focuses the place nearest the centre of the glass; OUT of NEAR
releases focus. Nothing animates: a camera change is one state change, so reduced-motion and full-motion are the same
field (parity by construction). Every gesture (drag, pinch) has a non-drag route (the controls, search, a focusable
Experience). No Stage-2 primitive was modified, so no Personal Map contract changed.

**Public-specific viewer state.** `createPublicFieldController` holds the served entries, the Public camera, the focus +
panel and the search, and nothing of the Personal or Shared world. Every entry into Public World starts again from the
whole World at FAR (no camera, focus or time is inherited, from anywhere, including a previous Public visit); leaving
writes nothing elsewhere. **Back** is local: panel (focus) → search → nothing registered at the World's root (the S5-01
rule), so Back never silently leaves Public World.

## 9. Search and panel behaviour

- **Search** is a compact sheet under the search field: results are meanings (one line each) AND highlighted places in the
  same field; picking a result guides the camera to its place at NEAR and opens its panel. It is not a feed; it never
  replaces the World.
- **Panel**: the meaning (statement type), "Shared by {display}" (the CURRENT public display — an alias change moves
  nothing), main / other meanings (S5-03A's words), the public content (S5-02's "QANDEEL analysis" marker), and "Near in
  meaning" — at most 3 served Experiences by spatial proximity, each focusable. It shows no view count, importance, truth
  rank or popularity. The API carries the exact-version vitality counts; the mobile panel does not render them in this
  task (there is no Public discussion yet — S5-04 — and a "0 replies" line would be noise). The published instant is
  carried, not rendered (a date-rendering Copy decision for S5-04 / the Product Owner).
- A focused Experience the server no longer serves is removed from the field at once and the panel says, neutrally,
  "This experience is no longer in Public World" — no tombstone in the field, no reason.
- **Exploration lenses** (الآن / الجديد / الصاعد / الأكثر نقاشًا / الأكثر مشاهدة) are NOT built: their ranking algorithms
  are not frozen and no view-count runtime exists. No non-functional chip is shipped. The reviewed semantic region is used
  only for the NEAR same-region presence.

## 10. Relation lines — zero

S5-03B renders zero inferred relationship edges: no line, path or SVG exists in the field (static contract 7, mobile
isolation test). Spatial proximity itself communicates similarity. `EXPLICIT_PUBLIC_RELATION`, its evidence, validity,
cleanup and focus-revealed true relation lines are S5-03C's.

## 11. MATERIAL / REASONING — ASSURE-F05

- The spatial relations store identities, instants, a contract name, a layout version and two integers. No package text,
  meaning, theme, explanation, lens key or display label is copied (deploy H5, verifier B05). No text threshold is used and
  no text is inspected.
- **Classification:** coordinates reasoned FROM a meaning are geometry — `REASONING` state, not content-bearing material.
  No new `MATERIAL_DEPENDENCY` is created, so no erasure path is added (Task Contract §8).
- **Erasure still fails closed immediately, by construction.** When ASSURE-F05 erases any package item, S5-03A NULLs the
  interpretation's content and fingerprint in the same transaction; every S5-03B derivation requires a whole package, a
  matching fingerprint and unerased reviewed content. Proven (verifier D02): the Experience is absent from field, search,
  panel, content and nearby; spatial readiness answers `NOT_SEMANTICALLY_READY`; no new request is admitted; the geometry
  rows are unchanged and unserved; nothing is rebuilt from anything private.
- Race discipline: the owner request and the server commit take the Experience row `FOR UPDATE`, then the current
  package's items `FOR SHARE` (S5-03A's lock), so a commit serializes with a correction, a version change and an erasure.

## 12. Visibility / deletion / stale proof (verifier `verify-migration-0145.mjs`)

| Case | Proof |
|---|---|
| Draft / READY_FOR_REVIEW invisible | V01, V02, V06 (READY e5 is placed and still invisible) |
| PUBLICLY_VISIBLE + admitted only | V02, V07 (an unadmitted viewer reads nothing; a token-less caller 42501; anon no EXECUTE) |
| Guessed id → neutral absence | V06 |
| Stale placement never served | V02 / V06 (e2 is public but its only place is for a superseded revision) |
| Wrong version never served | D03 (successor version) |
| Actual S5-03A meaning / region used; 0096 constants never | V02, V03, V04, V09, P04 |
| Withdrawn approval → absent everywhere | D01 |
| ASSURE-F05 erasure → absent everywhere, readiness fails closed | D02 |
| Exact version + revision binding; idempotent; model upgrade moves nothing; append-only | P07–P10 |
| No semantic readiness → no placement; non-controller → nothing | P01, P02 |
| Client cannot supply x / y | P05, B03 |
| Popularity / vitality / alias cannot move coordinates | B06, V08 |

Mutation checks (on a throwaway copy of the database): removing the revision binding from the viewer join → V02 fails;
removing the admission gate → V07 fails.

## 13. Proof that the 0096 private constants cannot reach Product output

1. Deploy H3: no S5-03B function body names `semantic_label`, `s5-03a.private`, `S5-03A_PRIVATE`, the frozen descriptor
   readers or the 0097 projection — the migration fails otherwise.
2. Verifier B07 re-checks the deployed bodies; P04 / V09 check every output and the placer input; V03 shows the frozen
   panel does carry the constant, so the trap is real and avoided.
3. API spec + static contract 3: the API repositories call only the 0145 RPCs and never the frozen readers.
4. Mobile isolation test + static contract 7: no field file names the constants.

## 14. Product Copy Gate — **S5-03B PRODUCT COPY GATE — OPEN — 16 rows PROPOSED**

Census: every S5-03B user-visible string is in `apps/mobile/src/public-world/field/field-copy.ts`. No frozen string was changed.
Nothing is self-approved.

| Key | Class | العربية | English |
|---|---|---|---|
| back | REUSED (S4-01) | رجوع | Back |
| cancel | REUSED (S4-01) | إلغاء | Cancel |
| retry | REUSED (S4-01) | إعادة المحاولة | Try again |
| analysisItem | REUSED (S5-02) | تحليل قنديل | QANDEEL analysis |
| primaryHeading / secondaryHeading | REUSED (S5-03A) | المعاني الأساسية / معانٍ أخرى | Main meanings / Other meanings |
| fieldLabel | **PROPOSED** | حقل المعاني في العالم العام | Public World's field of meaning |
| empty | **PROPOSED** | لا يوجد في العالم العام شيء بعد. | Nothing is in Public World yet. |
| fieldUnavailable | **PROPOSED** | تعذّر عرض العالم العام الآن. | Public World can't be shown right now. |
| searchLabel | **PROPOSED** (text revised by the Product Owner, R1) | ابحث عن تجربة أو شعور أو معنى | Search for an experience, feeling, or meaning |
| noResults | **PROPOSED** | لا شيء في العالم العام يطابق هذا البحث. | Nothing in Public World matches this search. |
| closer | **PROPOSED** | اقترب | Closer |
| farther | **PROPOSED** | ابتعد | Farther |
| wholeWorld | **PROPOSED** | العالم كله | The whole World |
| nearHeading | **PROPOSED** | قريب في المعنى | Near in meaning |
| sharedBy | **PROPOSED** | شاركها {0} | Shared by {0} |
| experienceUnavailable | **PROPOSED** | لم تعد هذه التجربة في العالم العام. | This experience is no longer in Public World. |
| placeHeading | **PROPOSED** | مكان التجربة في العالم العام | The experience's place in Public World |
| placeExplain | **PROPOSED** | يحدد قنديل مكانها من معناها وحده، ولا يمكن اختيار المكان يدويًا. | QANDEEL places it by its meaning alone; the place can't be chosen by hand. |
| placeAsk | **PROPOSED** | اطلب من قنديل تحديد مكانها | Ask QANDEEL to find its place |
| placeReady | **PROPOSED** (text revised by the Product Owner, R1) | تم تحديد مكانها. | Its place has been set. |
| placeUnavailable | **PROPOSED** | تعذّر على قنديل تحديد مكانها الآن. | QANDEEL couldn't find its place right now. |

Notes for the Product Owner: English follows S5-01 / S5-02's "Public World" without an article. The zoom controls show the
glyphs `+` / `−` / `○` with these rows as their accessible names. «شاركها» is used for a published Experience; the reader's
own Experience is never called published.

## 15. `QAN-BL-ACCT-01` — still `HIGH`, `OPEN — UNASSIGNED`

S5-03B does not solve it and adds to the footprint it covers. No S5-03B column names an account and no foreign key reaches
one directly (deploy H6, verifier B05). But both spatial relations bind the Experience Version and the S5-03A interpretation
`ON DELETE RESTRICT` (verifier B05a pins the five edges), and that interpretation binds its 0096 placement, which binds its
recorder's account. These edges are recorded as part of the blocker, **`QAN-BL-ACCT-01 — HIGH / OPEN`**, in the backlog's
current-truth note. The Public World is not launch-ready; no Launch Readiness is claimed.

## 16. Stage-5 Gap Matrix (S5-03B)

| # | Gap / observation | Class | Owner / disposition |
|---|---|---|---|
| G01 | No production provider behind `PublicSpatialPlacer`: outside tests it refuses, so no real Experience is placed yet | 2 — closure-time backlog admission candidate | Stage 8A, beside the S5-03A interpreter (S5-03A G01); the Product Owner names the owner task within 8A, then it is admitted (BG-02 / BG-08) |
| G02 | The placer's AI-COST-01 feature family / spend admission (today: one open request per revision + the strict rate class + 20 s bound) | 2 — same candidate as G01 | Stage 8A |
| G03 | The production layout space must fit the Map's presentation band (≤ 2^40 world units / point at FAR) | 2 — same candidate as G01 | Stage 8A, with the provider |
| G04 | Search and the field re-derive every candidate at read time (no index beyond the coordinate index; the search document is built per query) — correct and stale-proof, not tuned for a large World | **OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision** (R1: not self-assigned) | none named; the R0 self-assignment to S5-04 is withdrawn |
| G05 | One field read is bounded at 400 places (`LIMIT 400`). That is a **bounded v1**, not the final "whole World" behaviour at scale: a World denser than 400 places per rectangle shows the first 400 in spatial order, and dense-field aggregation is not built (the R1 FAR mass is one canonical world-colour per served place, not an aggregate) | **OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision** (R1: not self-assigned) | none named, with G04 |
| G06 | Exploration lenses (Now / New / Rising / Most Discussed / Most Viewed) | 3 existing owner | not frozen (CW2-04 §36); a later Product closure — no chip shipped |
| G07 | Explicit Public relations, relation lines, integrity closure | 4 assigned | S5-03C |
| G08 | Discussion, replies, Public QANDEEL, Public Activity / Push; rendering vitality counts and the published instant | 4 assigned | S5-04 |
| G09 | `PUBLISHED`, CW2-08, Safety / moderation, entitlement, signed-out viewing; Stage 9 must compose spatial readiness | 3 existing owner | `CW2-08` / Stage 9 — unchanged |
| G10 | Account deletion across Connected Worlds — new Version / interpretation RESTRICT dependents | 3 existing item | `QAN-BL-ACCT-01` — HIGH / OPEN (§15) |
| G11 | The S5-03B Product Copy Gate | 1 — this task, before merge | §14 — 16 rows PROPOSED for the Product Owner |
| G12 | No native device leg for the field (an empty World in production; Jest covers both languages, FAR / MID / NEAR, search, panel, Back) | 5 — observe / report | §17: native proof was not run in this delivery; the Product Owner decides whether one bounded smoke is required before merge |
| G13 | Export My Data does not include the spatial footprint | 3 existing owner | `E2E-D-16` |
| G14 | Public Voice, Replay | 3 existing items | `QAN-BL-VOICE-01` / Stage 8B; Stage 7 |

**Orphan gaps = 0** — every row has class 1–5 and a named owner or disposition; G04 / G05 are dispositioned as OPEN PRODUCT
GAPS awaiting the Product Owner's ownership decision (R1), not orphaned and not assigned by Engineering.

## 17. Validation

Local real PostgreSQL 17 on `localhost:55432` only (the embedded binaries from the local npm cache; never the hosted
`.env` database). Bootstrap + every migration from zero into a base database (< 0145), then `0145` applied on a copy.

| Check | Result |
|---|---|
| `0145` applies on a fresh pre-0145 database; deploy assertions H1–H7 pass | PASS |
| `database/verify-migration-0145.mjs` — boundary, stable placement (incl. the `QANDEEL_PUBLIC_FIELD_V1` space), viewer, disappearance, launch closure | PASS (re-run after the F12 correction) |
| neighbouring verifiers on the 0145 database: `0026` (catalog-wide memory authority), `0090`–`0099`, `0121`, `0122` (catalog-wide erasure census), `0142`, `0143`, `0144` | 17 / 17 PASS (`0098` after its F08 re-anchor; it also passes on the pre-0145 database) |
| Mutation checks: revision binding removed → V02 fails; admission gate removed → V07 fails | both caught |
| API focused (`src/public-world`, `src/http-security` incl. the AppModule route census) | 133 / 133 |
| API `tsc --noEmit` | PASS |
| mobile `tsc --noEmit` | PASS |
| mobile Jest — the new field suite (`src/public-world/field`) | 23 / 23 |
| mobile Jest — `src/public-world`, `src/public-authoring`, `src/runtime-entry`, the re-anchored S5-01 integration test | 312 / 312 |
| mobile Jest — `src/integration` (whose runtime wiring changed) | 259 / 265: the 6 failures are exactly the recorded local-locale baseline in `w2-account-access` / `depth` (F05), untouched by S5-03B |
| root static contracts — the WHOLE `tests/*.test.mjs` suite (incl. the new S5-03B contract, the re-anchored S5-01 / S5-02 / S5-03A contracts, T-03B2b1 Home-placement, task-closure governance and the forward-safety mirror; `apps/mobile/android` moved aside as before) | 1206 / 1206 (the first run, before F12, was 1202 / 1206) |

Stage-2 Map contracts were not re-run: no Map file changed (the Public camera imports the Map's world primitives and the
frozen zoom constant; it modifies nothing).

## 18. Failure classification (A Product / Security · B Validation / Proof · C Infrastructure)

| # | Where | Class | Disposition |
|---|---|---|---|
| F01 | my verifier: the publication simulation ran under an application role ("permission denied for schema public") | B | switch to `postgres` before the seam simulation, as the support module expects |
| F02 | my verifier: support reads (`admission`, `visibility`) ran under an application role | B | wrapped to run as `postgres` |
| F03 | my mobile tests: un-awaited `fireEvent` / mid-test `cleanup()` → overlapping `act()` scopes; FAR marks queried without `includeHiddenElements` | B | awaited; one render per test; FAR marks are hidden from accessibility by design |
| F04 | my mobile tests: MID / search assertions targeted places legitimately off-glass | B | the tests target the right places (tap E1's area; assert the picked result is drawn focused) |
| F05 | mobile Jest: 6 tests in `w2-account-access` / `depth` | B — Validation / Baseline | the recorded local-locale baseline (S5-03A F13); untouched by S5-03B |
| F06 | `s5-01-public-world` integration test: pinned the S5-01 content-empty root ("only `/public/entry` is read", "no button in the field") | B | re-anchored: the field reads the World once after ALLOW; an empty World still shows no button (the zoom controls are hidden while the World is empty) |
| F07 | S5-03A static contract 10: pinned S5-03A's own pre-merge locator truth | B | re-anchored to the merged truth (PR #316 at `c9338af9…`) |
| F08 | `verify-migration-0098` catalog census: "every outward Public World surface is in the visibility dependency census" — the name-based census (`resolve_public_*` / `search_public_*`) found the new `search_public_semantic_field_v1` | B (the census did its job) | NOT renamed to dodge it. Re-anchored: the census declares the S5-03B surface by name and proves from the live catalog that its wrapper → its definer → `derive_visible_spatial_entry_v1` → `resolve_public_visibility_state_v1`; it still fails for any surface that bypasses visibility. Passes on the 0145 and the pre-0145 database |
| F09 | S5-01 static contract 5: "no file of `public-world/` fakes Public content" — my first copy module sat at `public-world/field-copy.ts` and names "search" / "experience" | B (location) | the field's copy moved into the field's own module (`public-world/field/field-copy.ts`), beside its surface; S5-01's root files are still held to S5-01's ban, and the S5-03B files to S5-03B contract 7 (no fake content, no rank, no relation) |
| F10 | S5-02 static contracts: the module's controller list and the authoring wiring line, exactly | B | re-anchored: the S5-03B spatial and field controllers join the SAME Public module; the authoring controller also receives `spatial` on the same transport |
| F12 | `canonical-home-placement-engine` contract (T-03B2b1): a migration NAMED `…spatial…` and one naming `osdap`, and an API file referencing OSDAP — the frozen rule that the Personal Home substrate alone owns that scheme | A — Product / architecture (caught by the root suite, before any commit) | my first 0145 labelled Public coordinates `QANDEEL_OSDAP_V1`, conflating the Public World's geography with the Personal World's Home scheme. Corrected by design, not by re-anchoring the frozen contract: the Public field has its own coordinate space `QANDEEL_PUBLIC_FIELD_V1` (same exact-integer bound, so the mobile math is unchanged); the migration is renamed `0145_public_semantic_field_location_viewer_v1.sql`; the API bound constants are the Public field's |
| F11 | my S5-03B static contract: section markers stripped with the comments, a `COMMENT ON TABLE` sentence read as a column, a template literal captured as the POST body | B | markers that survive comment stripping; the CREATE TABLE bodies only; the last object literal of each POST |

No Product, Security or Privacy defect was found in the frozen runtime or in S5-03A.

## 19. Remaining Stage-5 ownership

- **S5-03C — Explicit Relations + Integrity Closure:** `EXPLICIT_PUBLIC_RELATION`, evidence, endpoint / version validity,
  relation cleanup, focus-revealed true relation lines.
- **S5-04 — Discussion + Public QANDEEL + Final Public Integration:** discussion, replies, Public QANDEEL, Public Activity,
  vitality / instant rendering, Public performance at scale (G04, G05).
- **Stage 8A:** the production providers behind the S5-03A interpreter and the S5-03B placer (G01–G03).
- **Stage 9 / CW2-08:** `PUBLISHED`, composing semantic readiness + spatial readiness + CW2-08 clearance.
- **`QAN-BL-ACCT-01` remains HIGH / OPEN.**

## 20. R1 — independent review corrections (2026-10-06)

The Product Owner's independent review of Draft PR #317 accepted the DB / authority / visibility / stable-placement law
and returned two class-A Product corrections, one ownership clarification and two Copy revisions. No migration, DB
contract, API or controller architecture changed; the 0145 verifier was therefore not re-run (§17 stands).

**A1 — the Public field is painted in the frozen Living Analysis World language.** R0 drew the field with plain views and
small circles. R1 adds `apps/mobile/src/public-world/field/PublicFieldWorld.tsx`, a Skia canvas under the field's
accessible layer that imports the Stage-2 VPORT-01 owner (`apps/mobile/src/map/visual`) **unchanged** (those files are
byte-pinned by the VPORT-02 contract): `WorldTone` (the canonical tone curve), `WorldGround` (ground + floor),
`WorldAtmosphere` (cloud / star / dust strata, world-anchored by the Public camera's own anchor and distance through
`stratumDrift`), `WorldVeil` (vignette + grain), and `WorldPlaceAtmosphere` for the field's mass. A Public Experience
does NOT borrow `WorldObject` (its morphologies are Personal Thread / Reading families); it has its own
`PublicPresence`, built only from the canonical mark material (`markMaterial`, `falloff`, `mediumHue`,
`SHADE_GRADIENT`, `MARK_RADIUS_POINTS`, the frozen `worldPalette` SELECTED ink and marker). The Map's presentation
camera is reused held at rest (the Public field applies no canonical change to it), so nothing animates and reduced
motion paints the same field. Distance: the Public rungs are exactly the Map's approach 0 / ½ / 1 (one ×8 step is
`ln 8 / ln 64`), read from the Public depth, never from a magnitude.

- **FAR** = the field's mass: one canonical world-colour atmosphere per served place, identical for every place and
  world-anchored (it grows ×8 per rung with the camera), so places that are near in meaning overlap into one luminous
  body and empty meaning stays dark; each place adds only the medium's soft light — no body, no label, no target.
  Derived only from the served spatial data; no category, no boundary, no line, no popularity.
- **MID** = each served place is a major-tier body with the cleared local ground and the medium's light; the meaning
  in one line on the accessible layer.
- **NEAR** = the focused place carries the frozen SELECTED ink and attached marker; places sharing its semantic
  region are quiet minor-tier bodies; the rest recede (a minor-tier body at a constant reduced share).

Every light, size and alpha is constant per tier (I-08B1 truth rule 2); the tier is disclosure only.

**A2 — no client cache is a source of display.** The controller now shows exactly what the LATEST read served (a read
replaces the field; R0 merged into a retained cache). Every transition that could show a different part of the World
asks again: any camera move at every rung including FAR (R0 skipped FAR), `wholeWorld()` (a fresh whole-World read with
nothing on display while it is in flight — R0 re-framed the cache), the app returning to the foreground
(through the runtime entry's ONE foreground signal, T-12P §2.7, bound by the integration runtime exactly as the Shared
World controller is — no second `AppState` listener: `ACTIVE` → `revalidate()`: glass, open search and focused panel), and every entry (unchanged). A complete answer
(< the 400 bound) removes at once every Experience inside its rectangle that it no longer serves from the field, the
search results, the focused panel (→ ABSENT) and the nearby context. A read that cannot be made fails closed: the one
honest unavailable state, holding nothing. No polling and no realtime channel were added.

**B — scale ownership.** G04 / G05 are no longer self-assigned to S5-04: they are OPEN PRODUCT GAPS awaiting the Product
Owner's ownership decision (§16). `LIMIT 400` remains a bounded v1, not a claim about the whole World at scale.

**Copy.** `searchLabel` and `placeReady` carry the Product Owner's revised text (AR «ابحث عن تجربة أو شعور أو معنى» /
EN "Search for an experience, feeling, or meaning"; AR «تم تحديد مكانها.» / EN "Its place has been set."). The gate stays
**OPEN — 16 rows PROPOSED**; the two rows are listed in `PUBLIC_FIELD_COPY_GATE.revisedByProductOwner` and nothing is
self-approved.

**R1 validation (proportional).** S5-03B focused mobile suite 31 / 31 (new: 6 stale-cache controller tests, a
foreground-revalidation surface test through a manual foreground signal, a Living-Analysis paint test, MID / NEAR
presence assertions, the revised Copy). Mutation checks: restoring the R0 FAR refresh skip fails 3 tests; restoring the R0
cached `wholeWorld()` fails 1. Mobile `tsc` PASS. Public World / authoring / S5-01 integration / VPORT-01 world-visual
Jest: all pass. `src/integration`: 259 / 265 — the same 6 pre-existing locale-baseline failures (`w2-account-access`,
`depth`), none new. Static: the S5-03B contract 10 / 10 (new test 10 pins R1); S5-01, S5-02, S5-03A, VPORT-01, VPORT-02,
Living Analysis Map runtime, canonical Home-placement engine and task-closure governance contracts pass, except the
"no generated native project" assertions, which fail only in this workstation's checkout because of an ignored local
`apps/mobile/android/` prebuild directory (2026-10-04, untracked, not part of the change); the same contract passes
15 / 15 in a clean worktree of the changed tree. Not re-run (no migration / DB contract / API change): the 0145
PostgreSQL verifier and the neighbouring DB verifiers (§17 stands).
