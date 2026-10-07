# QANDEEL — S5-03B Public Semantic Field + Stable Spatial Placement + Viewer Runtime — Implementation Record v1

**Task:** `S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime` (Stage 5 — Public World Product
Integration; the second of the Product Owner's three S5-03 tasks)
**Task Contract:** the Product Owner's S5-03B Task Contract (2026-10-06)
**Canonical baseline:** `c9338af9ecbfcecccc281f96f52fab335ad9bc7b` (the merge of PR #316, S5-03A)
**Branch:** `feat/s5-03b-public-semantic-field-viewer`
**Status:** **`S5-03B IMPLEMENTED ARCHITECTURALLY — PRODUCT OWNER PAUSED — VISUAL ACCEPTANCE NOT GRANTED — NOT MERGED — PRODUCT COPY GATE OPEN (13 rows PROPOSED after the R2 census; 3 rows RETIRED)`**.
Pause head: `430118ae2d27c2d9d686a1edb0ee26ed433eb16d` on draft PR #317 (2026-10-07). Claude does not merge it. No Copy Gate decision is made, S5-03C is not started, and no further Product work is authorized during the pause.

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

## 14. Product Copy Gate — **S5-03B PRODUCT COPY GATE — OPEN — 13 rows PROPOSED (R2 census, §25; 3 rows RETIRED)**

Census: every S5-03B user-visible string is in `apps/mobile/src/public-world/field/field-copy.ts`. No frozen string was changed.
Nothing is self-approved.

| Key | Class | العربية | English |
|---|---|---|---|
| back | REUSED (S4-01) | رجوع | Back |
| cancel | REUSED (S4-01) | إلغاء | Cancel |
| retry | REUSED (S4-01) | إعادة المحاولة | Try again |
| analysisItem | REUSED (S5-02) | تحليل قنديل | QANDEEL analysis |
| primaryHeading / secondaryHeading | REUSED (S5-03A) | المعاني الأساسية / معانٍ أخرى | Main meanings / Other meanings |
| moreDetail / lessDetail | REUSED (Living Analysis accessible step, W1A-01; added in R2) | إظهار تفاصيل أكثر / إظهار تفاصيل أقل | Show more detail / Show less detail |
| fieldLabel | **PROPOSED** | حقل المعاني في العالم العام | Public World's field of meaning |
| empty | **PROPOSED** | لا يوجد في العالم العام شيء بعد. | Nothing is in Public World yet. |
| fieldUnavailable | **PROPOSED** | تعذّر عرض العالم العام الآن. | Public World can't be shown right now. |
| searchLabel | **PROPOSED** (text revised by the Product Owner, R1) | ابحث عن تجربة أو شعور أو معنى | Search for an experience, feeling, or meaning |
| noResults | **PROPOSED** | لا شيء في العالم العام يطابق هذا البحث. | Nothing in Public World matches this search. |
| closer | ~~PROPOSED~~ **RETIRED (R2, D3)** — control removed, row deleted | ~~اقترب~~ | ~~Closer~~ |
| farther | ~~PROPOSED~~ **RETIRED (R2, D3)** — control removed, row deleted | ~~ابتعد~~ | ~~Farther~~ |
| wholeWorld | ~~PROPOSED~~ **RETIRED (R2, D3)** — control removed, row deleted | ~~العالم كله~~ | ~~The whole World~~ |
| nearHeading | **PROPOSED** | قريب في المعنى | Near in meaning |
| sharedBy | **PROPOSED** | شاركها {0} | Shared by {0} |
| experienceUnavailable | **PROPOSED** | لم تعد هذه التجربة في العالم العام. | This experience is no longer in Public World. |
| placeHeading | **PROPOSED** | مكان التجربة في العالم العام | The experience's place in Public World |
| placeExplain | **PROPOSED** | يحدد قنديل مكانها من معناها وحده، ولا يمكن اختيار المكان يدويًا. | QANDEEL places it by its meaning alone; the place can't be chosen by hand. |
| placeAsk | **PROPOSED** | اطلب من قنديل تحديد مكانها | Ask QANDEEL to find its place |
| placeReady | **PROPOSED** (text revised by the Product Owner, R1) | تم تحديد مكانها. | Its place has been set. |
| placeUnavailable | **PROPOSED** | تعذّر على قنديل تحديد مكانها الآن. | QANDEEL couldn't find its place right now. |

(R2: the zoom controls and their three rows are removed — see §25.) Notes for the Product Owner: English follows S5-01 / S5-02's "Public World" without an article. The zoom controls show the
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
| G11 | The S5-03B Product Copy Gate | 1 — this task, before merge | §14 — 13 rows PROPOSED for the Product Owner (R2 census; 3 retired) |
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

## 21. R2 — stale search / panel on navigation (2026-10-06)

The R1 review accepted A1 (Living Analysis visual reuse: **CLOSED / ACCEPTED**) and found one bounded gap: the whole-World
read cleared the field but kept the open search's results (which the surface draws with the field), and a camera move
re-read only the glass, not the open search or the focused panel.

**Correction (controller only; no DB, API, polling or realtime change).** One `revalidateShown()` asks again for
everything on display — the glass (`refreshViewport`), the focused panel (`openPanel`), and the open search with its
last query (`runSearch`) — and every camera move (`setCamera`: pan, Semantic Zoom, a tap at FAR, focus, Back) goes
through it; `focusOn` sets the new focus before the camera so the one navigation read opens that panel only. The
whole-World read publishes `LOADING` with no field place **and no search result** (the search stays open, `IDLE`), and
re-runs the open search with its last query beside the fresh World read. A withdrawn search result is therefore neither
drawn nor focusable during or after the transition; a withdrawn focused target becomes `ABSENT` on the next navigation.
`revalidate()` (foreground) uses the same `revalidateShown()`.

**R2 validation (as requested: focused only).** S5-03B focused mobile suite 36 / 36 (new: whole World hides and re-runs
the search; pan and Semantic Zoom each re-run it and drop a withdrawn result; a withdrawn focused target becomes `ABSENT`
on a pan; on the surface, a withdrawn search result is neither drawn — no row, no mark, no body — nor focusable after the
whole World). Mutation check: against the R1 controller, 4 of the 5 new tests fail. S5-03B static contract 10 / 10
(test 10 pins R2). Mobile `tsc` PASS. Not re-run: the 0145 PostgreSQL verifier and the DB loops (no DB change).

## 22. Product Visual Review → architectural unification, Phase 1 (2026-10-07)

**Product Owner decision.** After the device renders (§21 head `1fa7556`), the Product Owner stopped visual polish on
`PublicFieldWorld` and decided that Public World has no visual world of its own: it uses the SAME Stage-2 Living
Analysis renderer, world surface, camera physics, pan, Semantic Zoom and FAR / MID / NEAR grammar, fed by a
Public-specific projection. Approved: **D1** the same world-unit presentation scale and `DEFAULT_MAP_SCALE` for Public
(1,000,000 units is a presentation spacing convention, NOT a semantic truth unit — semantic similarity stays the
`PublicSpatialPlacer`'s); **D2** a neutral circle, for now, inside the shared material (no new token family); **D3** MID
labels stay a Public RN overlay (no text in the canonical renderer); **D4** a controlled VPORT-02 re-anchor only after
golden equivalence. Two phases; Phase 2 (Public adoption, deleting `PublicFieldWorld` and the duplicate camera math)
waits for the Product Owner's approval of Phase 1.

**Phase 1 — generic extraction only (no Public adoption, no Personal change).**

- *Golden equivalence first* (`apps/mobile/src/map/__tests__/golden-equivalence.test.tsx`, committed in `7fbc93f`
  BEFORE any source change): the production `MapSurface` over a real canonical store and `MapCanvas` under the
  presentation-camera stub, across FAR / MID / NEAR, Homes, contextual appearances and tethers, the register,
  selection (Home, identity everywhere, named appearance), an arrival (surface and canvas, from-host and local, reduced
  motion), a travel in progress, the empty world, a stale context, increased contrast and reduced motion — 14 cases,
  every Skia stand-in element in order with every prop, pinned in `__golden__/personal-map.golden.json`. Each
  case was checked to differ from its baseline (contrast changes the material, reduced motion holds the strata).
- *The seam* (moved verbatim; comments travel with the code):
  - `map/renderer/WorldCanvas.tsx` — the world composition (tone, ground, strata, plane, one atmosphere per PLACE,
    arrivals, counter-scale, `PresentationCameraRebase` as the last plane child, veil, register). What a node IS is
    the projection's: `isPlace`, `hostOf`, `renderConnections`, `renderObject`, `renderRegister`.
  - `map/renderer/useWorldSurface.ts` — `useWorldMotion` (presentation camera, travel / drag corridor) and
    `useWorldFrame` (camera commit and rebase, presentation culling, the membership record, the residual-true
    `nodeAt`), called at the two places `MapSurface` always did that work so every effect keeps its order. The
    authority is any identity (`owner`); the Personal owner passes its store.
  - `map/visual/WorldMarks.tsx` — `WorldMark`: the world's mark MATERIAL (tier ground, light, NEAR limb and core,
    SELECTED marker) apart from its SHAPE; `WorldObject` supplies a family's morphology.
  - Type-only: `map/camera/viewport.ts` reads a structural `WorldViewCamera` (anchor, scale, depth);
    `hitTest` is generic over `{ x, y, radius }`.
- *Personal owners unchanged in role and signature:* `MapCanvas` (Personal paint: Thread Home = place, Reading
  appearance tethered to its Home, family morphologies) and `MapSurface` (store, the ONE freshness rule, gestures,
  inspection, accessible Map). `LivingAnalysisMap` untouched. The generic files import no `state`, `CanonicalStore`,
  `projection`, `inspection` or accessibility (S5-03B contract test 11).
- *Controlled re-anchors* (no invariant weakened; each now asserted on the owner together with the seam its code moved
  to): VPORT-02 byte pins (MapCanvas, MapSurface, WorldMarks, visual barrel; WorldCanvas and useWorldSurface added),
  VPORT-01 canvas assertions, T-10 (11 assertions), T-11 (1), the Living Analysis Map authorized file list (+2 files).

**Phase 1 validation.** Golden equivalence 16 / 16 (mutation: moving the tethers fails 11 cases, swapping one halo profile
fails 12). Map + motion Jest 27 suites / 268 tests; full mobile Jest 2249 / 2255 — the 6 failures are the pre-existing
ar-EG host-locale baseline (`w2-account-access`, `depth`). Mobile `tsc` PASS; eslint clean on the changed files.
Contracts: VPORT-01 9 / 9, VPORT-02 9 / 9, T-10 31 / 31, T-11 27 / 27, T-12 6 / 6, T-12P 23 / 23, S5-03B 11 / 11, Living
Analysis Map runtime 15 / 15 (with this workstation's ignored `apps/mobile/android/` prebuild moved aside; with it in
place the one "no generated native project" check fails, as before), task-closure governance 24 / 24. No DB, API, migration, copy or Public change; the 0145 verifier and DB loops were not re-run.

## 23. Phase 2 — Public adoption of the one Living Analysis World (2026-10-07)

The Product Owner approved Phase 1 at `c3bdfcf` (golden equivalence, mutation proof and the targeted Stage-2 validation
suffice; no separate device proof) and approved Phase 2, with one bounded proof correction first.

**B — verify-0071 scope correction (`cf93d69`).** `database/verify-migration-0071.mjs` asserted that exactly one
function of ALL `public.commit_*` is executable by `service_role`. 0145's `public.commit_public_spatial_placement_v1` is
legitimately a second one, owned and proven by `verify-migration-0145`, not by T-03D — so API CI failed from R0 on. The
census now selects the conversation commit family T-03D owns by its two name stems (`commit_conversation_units*`,
`commit_finalized_exchange*`), pins that family to exactly the legacy, focus, Thread, lifecycle and FINAL committers, and
asserts that within it only the FINAL coordinator is executable by `service_role`. No name whitelist, no migration and no
DB authority changed. Real PostgreSQL (local, every migration through 0145): the previous verifier fails at the census
exactly as CI did; the corrected one passes (827 assertions); a re-granted legacy committer is still caught. The related
static contracts (T-03D cutover, canonical Home placement engine, Thread establishment evaluator) pass 34 / 34.
Disclosed, not changed: verifiers 0139 / 0140 / 0141 carry the same whole-`commit_%` census (S4 focused verifiers, not run
by API CI); they will report the same drift whenever they run against a database that includes 0145.

**The Public field is the Living Analysis World.**

- *Projection* (`public-world/field/public-field-projection.ts`): served Experiences → generic world nodes, one per
  Experience at the Map's `projectAddress` of its exact place, every node on the world plane with the Map's Home hit radius.
  Presence is disclosure alone (FAR mass, MID place, NEAR focus + semantic neighbourhood / receded; a search result or the
  focus is a place at every rung). An empty World projects to no node.
- *Renderer*: `PublicSemanticField` paints through `WorldCanvas` under `useWorldMotion` / `useWorldFrame` — the same
  tone, ground, strata, place atmosphere (`750,000` world units, so a region of places reads as one luminous body), veil,
  presentation camera, travel, drag corridor, rebase and residual-true hit test as the Personal Map. Every served place
  is a place (`isPlace`), nothing is hosted (`hostOf` → none), nothing is joined (no `renderConnections`), and the field
  keeps no disclosure record (`membership: null`): a served Experience coming onto the glass because the glass moved is
  navigation, never an arrival.
- *Mark* (`PublicExperienceMark.tsx`, D2): the world's own `WorldMark` material in a neutral circle — no Personal
  morphology, no token family of its own; tier constant per presence, the frozen SELECTED ink and marker for focus.
- *Camera policy only* (`public-field-camera.ts`): the three rungs, the whole-World viewpoint, focus and nearest place.
  FAR is `DEFAULT_MAP_SCALE`, MID / NEAR one and two frozen ×8 reinforcements (`reinforcedScale`), so the material reads
  approach 0 / ½ / 1 exactly as the Personal Map's. The pan is the Map's `panFromTranslation`; projection and footprint are the Map's
  (`projectAddress`, `visibleFootprint`), and a tap is read through the presentation camera's residual. No
  camera is fitted to the content (`fittedCamera` is gone): the World has the same physics with 0, 5 or 5,000
  Experiences, and the whole World is FAR from the World's origin. World units are a presentation spacing convention only.
- *Drag*: the Map's grammar — the plane follows the hand on the UI runtime (`grab` / `dragBy` / `release`), ONE crossing at
  the end of a completed drag hands the finger's own translation to the controller's one pan, and a pan that moved nothing
  brings the presentation home.
- *Deleted*: `PublicFieldWorld.tsx` (the parallel world module and its screen-relative mass radius).
- *Shared code touched, type-level or additive only*: `map/camera/pan.ts` and `map/visual/world-presentation.ts` read a
  camera as `Pick<MapCamera, 'anchor' | 'scale'>`; `useWorldMotion` exposes the Class-D `atRest` fact (no travel or drag
  corridor open). The Personal golden stays 16 / 16 with the golden file unchanged.

**Public chrome fixes (from the Product Visual Review).** MID meanings stay a screen-space RN overlay (D3) laid out by
`layoutFieldLabels`: deterministic and meaning-free (the focused place first, then top to bottom), each label on its
reading side or the other, never overlapping another label or covering another place (only the focused meaning may lie
over a neighbour), never cut by the glass, the search or the panel; a label that cannot be placed is not drawn (the place
is still focusable and announced by its meaning). Labels and targets wait for the world to come to rest. A chosen search
result folds the list away so it never covers the panel (Back returns to it); a closed search — by its control or by Back
— shows no query, and reopening starts empty; the keyboard is dismissed on a choice.

**Unchanged.** Every R1 / R2 protection (reads replace the field, every navigation re-reads the glass, the open search
and the focused panel, the whole World is a fresh read with nothing held on display, the ONE foreground signal, fail
closed), exact Public authority and visibility, PUBLISHED closed, CW2-08 NOT_EVALUATED, no S5-03C relation, the Copy Gate
(OPEN, 16 rows PROPOSED). The validation-only visual fixture is recalibrated to the World's presentation convention
(regions 1.2–1.6 million units apart, neighbours 25–110 thousand units) and is still reachable only from the S4-01 proof world.

**Phase 2 validation.** Personal golden equivalence 16 / 16 with `__golden__/personal-map.golden.json` unchanged. Public
field Jest 44 / 44 (new: the projection adapter — empty World, one node per served Experience at the Map projection,
presence by disclosure, unrepresentable places omitted; the MID label layout — reading side, glass, no overlap, clear of
its own SELECTED marker, search / panel clearance; the search fold and query clearing; the existing R1 / R2 stale-cache
tests unchanged in substance). Map + motion Jest 28 suites / 269. Full mobile Jest 2257 / 2263 — the same 6 ar-EG
host-locale baseline failures (`w2-account-access`, `depth`). Mobile `tsc` PASS; eslint 0 errors. Every root static
contract 1208 / 1208 (with this workstation's ignored `apps/mobile/android/` moved aside), including S5-03B 11 / 11
(tests 7, 10 and 11 re-anchored to Phase 2), VPORT-02 9 / 9 (re-pinned: useWorldSurface, world-presentation), T-10 31 / 31
(the `panFromTranslation` signature re-anchored to its structural camera), VPORT-01, T-11, T-12, T-12P, Living Analysis
Map runtime and task-closure governance. verify-0071 on real PostgreSQL as above; no other DB verifier was re-run.

## 24. Task Contract amendment and R1 — ONE Living Analysis SCREEN, Personal-only extraction (2026-10-07)

**Product Owner decision (after the architecture study of Phase 2).** Phase 2 is NOT accepted as S5-03B's closure: Public
shared the Living Analysis renderer (`WorldCanvas`) but not the Living Analysis SCREEN — its own full-screen composition,
own world view, own overlay layout, the reader's appearance instead of the Analysis place. The approved direction is ONE
Living Analysis Surface at screen / composition level: `LivingAnalysisSurface` → `WorldViewSurface` → `WorldCanvas`,
with Personal and Public (and, later, Shared — `QAN-BL-CW-03` / `SHARED-VIS-01` stays DEFERRED until Stage 5 closes) each
bringing only a projection and capabilities. Decisions: **D1** Public runs inside the same always-dark Analysis scope;
**D2** the Public Experience panel moves into the chrome / support band (no 46 % overlay); **D3** the visible `+` / `−` /
`○` controls are removed (the non-gesture accessible semantic step stays, from the same generic surface) and the copy
rows `closer`, `farther`, `wholeWorld` are retired — with the controls, in R2; the Copy Gate is not approved until it is
re-censused after R2; **D4** Public title / Activity entry / authoring entry / Search are Public content in the same
top-band slot (no separate header, no fixed `SEARCH_ROW` arithmetic on the world viewport); **D5** the gesture / commit
core is generalised cleanly, Personal hooks, wrappers, testIDs and behaviour kept, no Public duplicate wrappers;
**D6** the S5-03B Task Contract is amended.

**Task Contract amendment (D6, 2026-10-07).** The S5-03B Task Contract additionally authorizes, within S5-03B and as no
new roadmap task (Stage 5 stays ACTIVE; S5-03C stays unopened): the extraction of `LivingAnalysisSurface` and
`WorldViewSurface`; controlled T-11 / T-12 / VPORT re-anchors (no invariant weakened); no Product redesign; Personal
golden equivalence (the existing Map golden AND a new screen golden recorded before the extraction); and Public adoption
of the same screen (R2, only after the Product Owner approves R1).

**R1 — Personal-only screen extraction.**

- *Screen golden first* (`351653f`, BEFORE any source change): `integration/__tests__/living-analysis-screen-golden.test.tsx`
  renders the real `LivingAnalysisMap` over the real bootstrapped runtime (the integration harness gains an optional
  projection route, registered before the bootstrap fetches; default unchanged) and pins every host element in order with
  every prop (type, testID, accessibility, resolved style; functions by name, animated handles by value) in
  `__golden__/living-analysis-screen.golden.json`: EN, AR-RTL, compact, expansive (EN / AR), short landscape, 200 % text
  (EN / AR), following live, previewing, Return offered after a pan, historical with Go Live offered, inspection, stale
  projection, increased contrast — 13 cases, each asserted distinct. It is never regenerated to match the refactor.
- *`living-analysis/LivingAnalysisSurface.tsx`* — the screen: the Analysis place (`AnalysisAppearanceScope`), the Analysis
  ground, the top-band slot (read first; its measured height replaces the top inset), T-11's responsive column, the
  measured world frame (`world(envelope)`), ONE support band with the `timeline` capability (line + layer, or `null`) and
  the `chrome` slot, and an `after` observer slot. It imports only React, RN, the Analysis ink, the appearance scope, the
  camera's `viewportEnvelope` and the responsive owner — no store, projection, inspection, time or world.
- *`map/renderer/WorldViewSurface.tsx`* — the world view: `useWorldView` (presentation camera and corridor, contrast, the
  world's expression, authority generation, the ONE drag and the ONE semantic step composed `Simultaneous`, then the
  camera commit / culling / membership — exactly the order `MapSurface` ran them, as a hook the owner calls in place) and
  `WorldViewSurface` (surface, gesture plane, tap route, accessibility slot).
- *Generic gesture core (D5)*: `useWorldPanGesture` (in `useMapPanGesture.ts`) and `useWorldSemanticStepGesture` (in
  `useMapSemanticZoomGesture.ts`) are the unchanged bodies with the act injected (`commit` / `step`, read when the crossing
  arrives); `useMapPanGesture(store, …)` / `useMapSemanticZoomGesture(store, …)` keep their names, signatures and
  behaviour as the Personal bindings to `PAN` / `ZOOM_SEMANTIC`.
- *Responsive capability*: `recompositionPlan(…, { support })` — `TIMELINE_AND_CHROME` (default; asking for it or for
  nothing is the frozen plan, value for value) or `CHROME_ONLY` (no instrument: the band keeps the same room, so the world
  frame is identical for every world; the chrome takes the whole band, with no row-to-chrome gap).
- *Personal consumer*: `LivingAnalysisMap` is now the Personal world ON the surface — `MapSurface` in `world`, the
  Timeline + temporal orientation line in `timeline`, `OrientationChrome` (Return / Live) in `chrome`, `ComposedMark` in
  `after`; the store, cache, journey, spatial cause and every Personal derivation unchanged. `DepthComposition` hands
  `AnalysisReturnBar` to the surface's top band (same element order and style). `MapSurface` calls `useWorldView` and
  renders `WorldViewSurface` with the same testIDs and API; it still owns the store, the freshness rule, the scene, the
  two acts, inspection, `MapCanvas` and `MapAccessibilityLayer`.
- *No Public change in R1.* `PublicSemanticField` and every Public file are untouched (contract test 12 asserts it).

**Controlled re-anchors (no invariant weakened; each asserted on the owner together with the seam its code moved to).**
Living Analysis Map runtime — the authorized T-04 file list + `renderer/WorldViewSurface.tsx`. T-10 — the surface set now
includes `WorldViewSurface`; Q1 asserts the Personal binding `panByTranslation(store, …)` and the crossing's
`current.commit(…)` (still exactly one `panByTranslation(` in the file); R1-01 asserts staleness is decided before
`current.commit(`; the owner hand-off is `useWorldView<…>({ owner: store, … })` → `useWorldFrame<C, N>(worldMotion, { owner, … })`;
R1-04's slice ends at `<WorldViewSurface`. T-11 — `let timelineWidthPoints`, plus: exactly two assignments, the frozen
rule and `0` only under `CHROME_ONLY`. VPORT-01 — the surface set includes `WorldViewSurface`. VPORT-02 — MapSurface
re-pinned (previous pin `19440a92`) and `WorldViewSurface` pinned; the G3 composition is asserted on the surface (ground,
line in the Timeline row, the chrome band's yield) together with `LivingAnalysisMap` (the line it hands in, WITH_TIMELINE,
LIVE_EDGE). S5-03B test 11 — the generic layer includes `WorldViewSurface`; MapSurface owns `panByTranslation(store,` /
`zoomSemanticStep(store,`. New S5-03B test 12 — the screen seam, the Personal bindings, the Personal world composed on
the surface and building no screen, the top band, the frozen responsive default, the enforced screen golden, and no
Public adoption. `depth-band.test` (W1A-01) — its `LivingAnalysisMap` stand-in now mounts the top band and records the
inset the surface composes the world with (`{ ...insets, top: top.height }`, proven on the real surface): the band's
measured height still reaches the world.

**R1 validation.** Personal Map golden 16 / 16 with `personal-map.golden.json` unchanged; Living Analysis screen golden
15 / 15 (13 cases + coverage + distinctness) with `living-analysis-screen.golden.json` unchanged since `351653f`.
Mutations: a changed ground fails 13 screen cases; a keyed support band (remount on band change) fails the continuity
proof; a removed line-height yield fails the surface test (the test renderer fires no layout for the temporal line, so the
screen golden cannot see that yield — disclosed; the surface test covers it). New: `living-analysis-surface.test`
(8: Analysis place dark, top band first and paid as top inset, device insets without one, Timeline row present with a
track, `CHROME_ONLY` with the same band and world envelope, the line yield, the observer slot, imports nothing of a world),
`support-capability.test` (4: default ≡ frozen plan across 90 surfaces × 3 bands; `CHROME_ONLY` keeps the frame and band),
`living-analysis-screen-continuity.test` (the Map surface and plane, the Timeline layer and row, the chrome band and the
chrome are the SAME instances across a preview, a band-changing resize and back, an inspection and a language change;
the preview survives). Full mobile Jest 2285 / 2291 — the same 6 ar-EG host-locale baseline failures, identical by name
before and after R1 (`w2-account-access`, `depth`). Mobile `tsc` PASS; eslint 0 errors (warnings only in untouched
files). Every root static contract 1209 / 1209 (with this workstation's ignored `apps/mobile/android/` moved aside).
No DB, migration, API, copy or Public change; no DB verifier was run. The Copy Gate stays OPEN (16 rows PROPOSED; D3's
three retirements land with R2). CW2-08 NOT_EVALUATED; PUBLISHED closed; S5-03C not started. R2 waits for the Product
Owner's approval of R1.

## 25. R2 — Public adoption of the ONE Living Analysis surface (2026-10-07)

**Product Owner decision.** R1 APPROVED at `405821c` (independent review): `LivingAnalysisSurface` is the one Analysis
screen, `WorldViewSurface` the one world view, the Personal Analysis its first consumer with both goldens unchanged. R2 —
Public adoption only — was authorised.

**What Public is now.** `PublicWorldArea` keeps only what is Public's to decide: the entry verdict, its RESOLVING /
DENIED states, the authoring workspace routing, and the Public-local ownership of its controllers. On ALLOW, with no
authoring workspace open, it mounts `PublicLivingAnalysis` and hands it its heading. The component path is:

`PublicWorldArea` → `PublicLivingAnalysis` → `LivingAnalysisSurface` → [top band: Public heading + search] ·
[world: `PublicFieldView` → `useWorldView` + `WorldViewSurface` → `WorldCanvas`] · [`timeline={null}` → `CHROME_ONLY`] ·
[chrome band: the field's panel / results / state].

- *The Analysis place (D1).* The surface's own `AnalysisAppearanceScope`: dark under every reader preference; the area's
  status bar is decided for that ground.
- *Top band (D4).* The Public World's name, the Activity entry and the way into authoring (`PublicHeading`, painting in
  the place it is drawn in), then the search. The band is measured and its height is the world's top inset. There is no
  `SEARCH_ROW`; the pre-measurement seed is only the rows' minimum heights, exactly as the Personal return bar seeds its own.
- *World.* `PublicFieldView` calls `useWorldView` with the Public field controller as the owner, the Public camera, the
  Public projection (`placePublicField`, unchanged), `membership: null`, no cause, `inspection: null`, and the Public acts
  (`controller.pan`, `controller.step`). It renders `WorldViewSurface` with the generic gesture plane; the canvas slot holds
  `WorldCanvas` + `PublicExperienceMark` (neutral circle, unchanged), the MID labels and the accessible targets — the Public
  overlay inside the world frame. The labels are laid out against the measured envelope's own insets.
- *No temporal track.* `timeline={null}`: no Timeline, no Live, no Return-to-Live, no Personal temporal semantics; the
  plan composes `CHROME_ONLY`, so the world frame is the one every world gets.
- *Chrome band (D2).* One thing at a time: the focused Experience's panel (with its nearby context); else the open
  search's results (folded once a result is chosen, Back returns to them); else the field's empty / unavailable state. The
  band's own scroller holds it; `PANEL_MAX`, the 46 % overlay and every absolutely positioned screen piece are gone.
- *Deleted.* `PublicSemanticField.tsx` — the Public field's own full-screen composition, its own `useWorldMotion` /
  `useWorldFrame` / `worldPresentation` calls, its own `Gesture.Simultaneous`, pan worklet, pinch recogniser and
  `PINCH_STEP`, and its own tap plane. Its remaining pieces moved to their homes (`PublicLivingAnalysis.tsx`,
  `PublicFieldView.tsx`).
- *Camera / acts.* The shared drag and semantic step commit into the Public controller: `pan(…)` and `step(direction)` now
  return a `PublicFieldOutcome` (`APPLIED` or why not), which is all the generic mechanic reads. `closer()` / `farther()`
  became the one `step(direction)` along the Public ladder (NEAR still focuses the place nearest the centre, OUT of NEAR
  still releases focus); `setSize` became `setEnvelope` (the measured envelope, with its insets, is what the controller
  reads the server for). `public-field-camera.ts` is unchanged: rungs, bounds, whole-World start, focus, nearest, ladder
  boundary; no Personal `CameraIntent` or store semantics.
- *D3.* The visible `+` / `−` / `○` are removed. The non-gesture route is the generic surface's: `useWorldView` returns
  `semanticStep` (the SAME step the pinch commits, under the same enablement and observer) and `WorldViewSurface` offers it,
  when a world asks (`semanticStep` prop), as the `zoom-in` / `zoom-out` accessible actions of the world's container,
  labelled with the field's name. The Personal Map does not pass it (its `MapAccessibilityLayer` already offers the step),
  so its tree is unchanged. With the ○ control gone, the controller's `wholeWorld()` act (and its private `reloadWorld`)
  is removed: the World as a whole is where every entry starts, read fresh.

**Copy Gate census after R2 (fresh; not approved).** `closer`, `farther`, `wholeWorld` — RETIRED (rows deleted in both
languages, listed in `PUBLIC_FIELD_COPY_GATE.retired`). `moreDetail` / `lessDetail` — REUSED byte-exact from the Living
Analysis copy (W1A-01) for the accessible step. **13 rows PROPOSED**, 8 REUSED, 0 APPROVED. The gate stays OPEN for the
Product Owner.

**Controlled re-anchors (validation only).** VPORT-02 — `WorldViewSurface` re-pinned (previous pin `50786b8e`; the change
is additive). S5-03B contract — `FIELD_FILES` names the two new files instead of the deleted one; test 7's root mount and
Back registration read `PublicLivingAnalysis`; test 8 is the R2 census; test 10's seams read `PublicFieldView`
(`useWorldView<…>` instead of the field's own `useWorldMotion` / `useWorldFrame` / `worldPresentation`) and the whole-World
act assertions are replaced by "no such act; an entry reads the whole World with nothing held on display"; test 11 reads
`PublicFieldView`. New test 13 — Public consumes the surface and the world view, builds no screen or mechanics of its own,
has no fixed geometry or floating panel, no Personal camera semantics, no visible zoom control, and its accessible step is
the generic one. `s5-01-public-world.test` (integration) — the surface's top band now carries the root's own heading, so
"no button in the field" is asserted on the world frame and the chrome band, and the field's buttons are exactly the
Activity entry and the way into authoring. `public-field.test` — the controller API (`setEnvelope`, `step`), the label
layout against envelope insets, the mount through the measured surface, and the whole-World tests rewritten as entry /
pan tests.

**R2 validation (proportional).** Personal Map golden 16 / 16 and Living Analysis screen golden 15 / 15, both files
unchanged; R1 continuity proof, the surface tests and every responsive test pass (170 / 170 across 17 suites incl.
`depth-band` and the authoring suites). Public suites 59 / 59, including new R2 proofs: the shared surface composed (top
band, world frame, CHROME_ONLY support band, no temporal row) in AR and EN; dark under a LIGHT reader preference; the
authoring entry in the top band and its workspace in place of the surface; no visible zoom control and the accessible
step FAR → MID → FAR, then MID → NEAR (focus) → MID; panel / results in the chrome band with the world frame unchanged;
the same surface, plane and band instances across FAR → MID → NEAR and search. Full mobile Jest 2291 / 2297 — the same 6
ar-EG host-locale baseline failures (`w2-account-access`, `depth`). `tsc` PASS; eslint 0 errors. Root contracts run where
changed: S5-03B 13 / 13, VPORT-02 9 / 9, VPORT-01 9 / 9, T-10 31 / 31, T-11 27 / 27, S5-01 7 / 7, S5-02 8 / 8, S5-03A 10 / 10;
the Living Analysis Map runtime contract passes except its "no generated native project" check, which fails only on
this workstation's ignored `apps/mobile/android/` (unchanged from R1). No DB, migration or API change; no DB verifier run.
CW2-08 NOT_EVALUATED; PUBLISHED closed; S5-03C not started; `QAN-BL-CW-03` / `SHARED-VIS-01` DEFERRED.

**R2 device proof (2026-10-07).** Build of `ab9a7fe` (`assembleRelease`, x86_64) with the S4-01 proof entry selected
(`S401_SHARED_PROOF=1 select-s401-proof-entry.mjs --apply`; restored afterwards, the tree clean); Android emulator AVD
`QANDEEL_API36` (Pixel 7 profile, Android 16 / API 36, 1080 × 2400, 420 dpi, `-gpu swiftshader_indirect`), device
language English. Fixture: `integration/__validation__/s503b-visual-field.ts` (SYNTHETIC, validation only, reachable only
through `qandeel://s401-proof/public/seed` in the proof build; never a Product module), entered through the Public tab and
`qandeel://s401-proof/public/allow`. The Personal control uses the same build's proof world (VPORT-01 data). Screenshots
(not committed, `.s503b-visual/r2/`): A Personal Analysis control, B Public FAR, C Public MID, D Public NEAR / focus with
the panel in the chrome band, E Public SEARCH (query in the top band, results in the chrome band), E2 a chosen result
(list folded, place focused). The device view hierarchy (`uiautomator`, testIDs as resource-ids) shows the SAME
composition for both worlds: `qandeel-responsive-surface` → `qandeel-responsive-map-frame` (full-bleed, the top band
over it as its top inset: `qandeel-analysis-return-bar` 0–262 px for Personal, `qandeel-public-band` 0–544 px for
Public) → `qandeel-responsive-support-band`, which holds `qandeel-responsive-timeline-row` + `qandeel-responsive-chrome-band`
for Personal and `qandeel-responsive-chrome-band` alone for Public (CHROME_ONLY); world frame 1362 px (Personal) and
1349 px (Public). Observed for the Product Owner: (1) with nothing focused and no search open, the Public chrome band is
empty — the CHROME_ONLY plan keeps the band's room by design (R1), so the lower part of the Public screen is the
Analysis ground; (2) under software GL the app raised Android "not responding" dialogs on input while the world was
painting; the stack is the main thread inside Skia's `notifyTaskReadyNative`, the same signature this emulator recorded
on 2026-10-04 before R2, so it is classified as the emulator's software rendering, not R2 — it is not proven on hardware.


## 26. Product Owner pause checkpoint — shared Living Analysis visual redesign (2026-10-07)

The Product Owner pauses the project at PR #317 head `430118ae2d27c2d9d686a1edb0ee26ed433eb16d`. R1 and R2 solved the architecture problem that triggered the rework: Personal and Public now consume the same production Analysis composition, `LivingAnalysisSurface → WorldViewSurface → WorldCanvas`, instead of Public maintaining a second screen. This is an architecture checkpoint only; **the current Living Analysis visual production quality is not accepted**. The latest device proof is substantially below the Product Owner's intended North Star and must not be treated as final visual approval.

**Future visual-development rule.** Do not rebuild or tune three independent Analysis screens. A later visual-design pass may be developed safely in an isolated branch / proof harness against the shared Analysis stack, so visual exploration does not destabilize the current Product while it is being judged. Once approved, shared changes to camera/pan/semantic-step mechanics, world framing, ground, atmosphere, lighting/material, motion, visual hierarchy and responsive composition should land once in the shared stack. Personal and Public then receive those shared changes from the same implementation. World-specific projection, labels, search, panels, temporal capabilities and other Product chrome remain owned by their world and are not forced into generic semantics.

**Shared World.** Shared is not yet a consumer of this surface in production. Its existing Stage-4 runtime stays closed/merged, and `QAN-BL-CW-03 / SHARED-VIS-01` remains `DEFERRED — OWNED` until Stage 5 / Public World is fully DONE / MERGED. When that correction is opened, Shared must adopt this same Analysis surface with Shared-specific projection/state rather than create another renderer.

**Resume point.** On resume, first review whether to open a dedicated Living Analysis visual-redesign workstream/proof branch; do not resume from S5-03C. S5-03B remains unmerged, its Copy Gate remains open, and the Public visual proof is evidence of architecture/function only, not final visual acceptance.
