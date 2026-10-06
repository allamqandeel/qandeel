# QANDEEL — S5-03A Public Semantic Interpretation + Publisher Review — Implementation Record v1

**Task:** `S5-03A — Public Semantic Interpretation + Publisher Review` (Stage 5 — Public World Product Integration; the first
of the Product Owner's three S5-03 tasks)
**Task Contract:** the Product Owner's S5-03A Task Contract (2026-10-06)
**Canonical baseline:** `1a10127672f8db7ff475bca4732635bf88536730` (the merge of PR #315, S5-02)
**Branch:** `feat/s5-03a-public-semantic-review`
**Status:** **`S5-03A IMPLEMENTED — DRAFT PR #316 — R1 (ASSURE-F05 semantic erasure) APPLIED — S5-03A PRODUCT COPY GATE CLOSED (21 rows APPROVED, Product Owner, 2026-10-06) — NOT MERGED`**.
Claude does not merge it. It waits for independent review of R1 on green CI and the Product Owner's Copy Gate decision.
S5-03B is not started.

> After READY_FOR_REVIEW, QANDEEL reads the exact immutable Public package of the exact current Experience Version — and
> nothing else — and proposes what it means: a short meaning, its main and other themes, why it reads it so, and a lens key
> as the structured placement intent for S5-03B. The exact controller accepts that understanding, or corrects the MEANING in
> their own words; QANDEEL checks the correction against the same package before it counts. Every committed understanding
> is an append-only revision of the frozen `0096` semantic placement of that exact version. Whether the version is
> semantically ready for spatial placement is derived, exact-version-bound and fail-closed. The lifecycle stays
> READY_FOR_REVIEW: nothing is published, no coordinate exists, and the CW2-08 prerequisites still answer `NOT_EVALUATED`.

---

## 1. Baseline / branch / head

| | |
|---|---|
| Baseline | `1a10127672f8db7ff475bca4732635bf88536730` — `origin/main` confirmed equal at kickoff (fetched), working tree clean, migration tip `0143_public_authoring_rights_privacy_v1.sql` |
| Branch | `feat/s5-03a-public-semantic-review`, cut from `origin/main` |
| Pull request | [allamqandeel/qandeel#316](https://github.com/allamqandeel/qandeel/pull/316) — Draft, NOT MERGED; first head `534e618a348adb7ddb2203f80d95e78b6227147f` |
| Head | the commit carrying this record; the exact SHA is reported in the PR and the completion report |
| Migration | `0144_public_semantic_interpretation_publisher_review_v1.sql` (one migration; no frozen function replaced) |

### 1.1 The execution map at kickoff (Project Map §5.1, as the Task Contract states it)

| Stage | Status |
|---|---|
| 1 — Personal Core | DONE |
| 2 — Final Visual Production Port | DONE |
| 3 — Activity + Notifications | DONE |
| 4 — Shared World Product Integration | DONE |
| **5 — Public World** | **ACTIVE** — S5-01 DONE / MERGED; S5-02 DONE / MERGED (PR #315); **S5-03A ACTIVE (this task)**; S5-03B NEXT (Public Semantic Field + Viewer Runtime); S5-03C LATER (Explicit Relations + Integrity Closure); S5-04 LATER (Discussion + Public QANDEEL + Final Public Integration) |
| 6 — Matching / Introductions; 7 — Replay | LATER |
| **8A — QANDEEL AI Brain / Production LLM Runtime** | LATER — named explicitly, before Voice |
| 8B — Voice Runtime; 9 — Economy + Launch Closure | LATER |

The order is unchanged; S5-03A reconciles the Project Map and Current State to it (§14).

## 2. Anti-Duplication Gate

| Need | What already exists (consumed, never rebuilt) | Real gap | What S5-03A adds |
|---|---|---|---|
| Version-bound interpretation with additive correction | `public_experience_semantic_placements` (`0096`): bound to the exact version by composite FK, append-only (guard for every role), revision 1 `INITIAL_INTERPRETATION` ⇔ later `PUBLISHER_CORRECTION` by CHECK; the frozen writer `record_public_experience_semantic_placement_v1` (exact controller from `auth.uid()`, Experience lock, idempotent) and reader `derive_public_experience_current_placement_v1` (highest revision) | the descriptor is a lens key and a ≤ 120 label only: no themes, no explanation, no record of who produced a revision (QANDEEL or the publisher) or whether the publisher reviewed it; no application path | NO second history: every interpretation IS a `0096` revision, written only through the frozen writer. Because that revision is immutable for every role, it carries the revision order and two content-free constants only; the revision's content (meaning, lens key, themes, explanation) and origin live in a companion relation keyed by the revision id, where ASSURE-F05 can erase them (R1, §7). A review relation, and the work / outcome relations of the server channel (§5) |
| Exact package, wholeness | `0091` / `0092` identity, version, immutable package; `public_package_state_v1` (`0143`) | none | consumed; a package fingerprint derived from the immutable items (§9) |
| READY_FOR_REVIEW and the actor | `0093` / `0121` / `0143`; `require_authoring_actor_v1` (`0143`) | none | consumed; READY is the only lifecycle in which the semantic stage acts |
| Provider-neutral AI | the conversational Model Router (`CONVERSATIONAL_RESPONSE` only) and the structured provider ports (hypothesis extraction / association), AI-COST-01 accounting wrappers | no structured semantic-interpretation contract; production provider selection is Stage 8A's | a provider-neutral `PublicSemanticInterpreter` port with a deterministic test implementation and a refusing production default (§6) |
| Publisher surface | the S5-02 authoring workspace and review | no semantic stage | a semantic section inside the S5-02 review, only for READY_FOR_REVIEW (§12) |

## 3. Authority map

| Fact | Owner | S5-03A |
|---|---|---|
| Semantic interpretation uses the public package only | CW2-04 §12 / D14 | enforced structurally (§4) |
| Alias / display identity is not semantic meaning | CW2-04 §10 / D12 | the input carries no publisher label, mode or identity |
| Publisher correction is truth-constrained, not map control | CW2-04 §13 / D15; Product Definition §12 ("QANDEEL proposes. The publisher can correct.") | correction of meaning only, assessed by QANDEEL against the package (§8) |
| Placement binds the exact Experience Version | CW2-04 §14 / D16; `0096` | every row is version-bound; readiness is exact-version-bound (§9) |
| Exact semantic model / coordinates | deferred by CW2-04 §36 | NOT decided here: a lens key is intent, not geometry (S5-03B) |
| Publication, CW2-08 | CW2-04 §12, `0095`, the CW2-08 seam (Stage 9) | untouched; unreachable (§11) |
| Production LLM | Stage 8A (Task Contract §5) | no provider bound (§6) |

## 4. PUBLIC PACKAGE ONLY — the privacy boundary

- **One reader.** The interpreter's whole input is served by `public_semantic_private.read_public_semantic_work_input_v1`,
  executable by the server channel (`service_role`) only. Its body reads the work, the Experience, the version, the package
  items and their public bodies, and nothing else. It returns the item ordinal, whether the item is source content or
  QANDEEL's analysis, the exact public text, and — for a correction — the publisher's own words as the database stored them.
- **Banned by source text, at deploy time and by the verifier (B07):** sealed provenance, Shared World relations, Personal
  conversation, memory, the human model, hypotheses, Matching, Introductions, accounts, Public identities, display labels
  and modes, the Personal owner. Every function of the schema and every wrapper is held to that ban.
- **The API holds nothing else to give.** `PublicSemanticService` composes only that reader's rows into
  `PublicSemanticPackageInput { contract, items }`; it has no Personal, Shared, memory, Human Intelligence, account or
  Model Router dependency (the API spec scans the four S5-03A files). A correction's words reach the interpreter as the
  database stored them, never as the client sent them.
- **Proven:** the verifier (S05) checks the input equals the package items exactly and contains none of the Personal QANDEEL
  analysis, a hidden Shared material, a visible but unpackaged Shared material, the publisher's Public ID or any account /
  World identifier; the API spec checks the exact input object and its keys.
- **Not a prompt instruction:** there is no prompt in this task; isolation is the shape of the only input path.

## 5. Schema, runtime, API and mobile changes

### 5.1 Migration `0144` — `public_semantic_private` (non-exposed), four append-only relations, no direct account reference

| Relation | What it is |
|---|---|
| `semantic_work` | one requested PROPOSAL or CORRECTION of one exact version, bound to a server-derived package fingerprint; a correction names the exact revision it corrects and carries the publisher's meaning and themes |
| `semantic_work_outcomes` | the interpreter's structured answer for one work — machine state, written by the server channel only: `PROPOSED` (lens key, meaning, themes, explanation), `CONSISTENT` (lens key) or `NOT_SUPPORTED` |
| `semantic_interpretations` | the content of ONE committed `0096` revision — meaning, lens key, themes, explanation — and the work that produced it: `QANDEEL_PROPOSAL` (revision 1) or `PUBLISHER_CORRECTION` |
| `semantic_reviews` | the controller's review of ONE exact revision: `ACCEPTED` (a QANDEEL proposal) or `CORRECTED` (their own correction), by composite FK to the interpretation's origin |

Every relation: RLS, no privilege for any application role, an append-only guard for every role including the owner (its ONE
exception is the one-way ASSURE-F05 erasure, re-proven inside the guard — §10), CHECKs
mirroring the shape rules (one line, trimmed, ≤ 120 meaning / ≤ 40 theme / ≤ 280 explanation, 1–3 primary and 0–3 secondary
distinct, disjoint themes, no identifier), and no foreign key to `public.users`, `auth.users` or `public_identities` (deploy
assertion H6, verifier B05). They are not outside `QAN-BL-ACCT-01`, though: their version and `0096` placement bindings are
`ON DELETE RESTRICT` (verifier B05a; §15).

| Function | Who | What |
|---|---|---|
| `read_own_public_semantic_review_v1(experience)` | authenticated | the controller's review: `NOT_READY_FOR_REVIEW` / `UNAVAILABLE` / `NO_PROPOSAL` / `AWAITING_REVIEW` / `REVIEWED`, the current revision's id, revision, origin, meaning, themes, explanation, decision and `semantically_ready`. Zero rows for anyone else. No lens, no fingerprint, no account |
| `request_own_public_semantic_proposal_v1(command, experience)` | authenticated | opens a PROPOSAL work: `WORK_OPEN` / `WORK_STAGED` / `ALREADY_INTERPRETED` / `NOT_READY_FOR_REVIEW` / `UNAVAILABLE` / `STALE` / `LIMITED` |
| `request_own_public_semantic_correction_v1(command, experience, interpretation, meaning, primary, secondary)` | authenticated | opens a CORRECTION work: + `UNCHANGED` / `NO_PROPOSAL` |
| `commit_own_public_semantic_work_v1(work)` | authenticated | adopts the recorded answer of the requester's own work: `PROPOSED` / `CORRECTED` / `ALREADY_COMMITTED` / `NOT_SUPPORTED` / `PENDING` / `STALE` / `NOT_READY_FOR_REVIEW` / `UNAVAILABLE` |
| `accept_own_public_semantic_proposal_v1(command, experience, interpretation)` | authenticated | `ACCEPTED` / `ALREADY_ACCEPTED` / `ALREADY_REVIEWED` / `STALE` / `NO_PROPOSAL` / `NOT_READY_FOR_REVIEW` / `UNAVAILABLE` |
| `read_public_semantic_work_input_v1(work)` | service_role | the package-only input (§4) |
| `record_public_semantic_work_outcome_v1(work, outcome, lens, meaning, primary, secondary, explanation)` | service_role | first answer wins: `RECORDED` / `ALREADY_RECORDED` / `STALE` / `UNAVAILABLE`; a malformed answer is refused (22023); no answer is judged by its text |
| `derive_public_semantic_readiness_v1(experience)` and 11 shape / derivation / guard helpers (incl. the item lock and the erasure trigger function) | nobody | internal (§9, §10) |

The seven exposed commands have `public` SECURITY INVOKER wrappers; every private function is a pinned postgres-owned
SECURITY DEFINER with an empty `search_path` (H4).

**Why the server channel.** The frozen writer derives the recorder from `auth.uid()`, so a revision must be committed on the
human's own token. But anything executable by `authenticated` is callable by a client with its own token. Splitting the
flow keeps both laws: what QANDEEL proposed can only arrive through `service_role`, and the human's commit can only adopt an
answer the server recorded for that human's own work (its request identity is re-derived from `auth.uid()`). A client can
neither forge a proposal nor commit someone else's work (verifier S05 / S10).

**Spend bound.** At most 12 semantic works per version within a day (`LIMITED`), and the two interpreter-reaching routes
take the strict `SECURITY_SENSITIVE` rate class. An interpreter failure keeps the same command, so a retry resumes the same
work rather than opening a new one; a recorded but uncommitted proposal is adopted (`WORK_STAGED`) instead of paid for twice.

### 5.2 API — `apps/api/src/public-world/`

| File | What |
|---|---|
| `public-semantic-interpreter.ts` | the provider-neutral port, its strict decoders, the deterministic test implementation and the refusing default (§6) |
| `public-semantic.repository.ts` | the five owner RPCs on the caller's token and the two server RPCs on the service-role channel (`SupabaseServiceRoleApiService`) |
| `public-semantic.service.ts` | the orchestration: open → package-only input → interpreter (20 s bound) → record → the human's commit |
| `public-semantic.controller.ts` | four routes (below); `public-world.module.ts` registers it in the ONE Public module |

Routes (census: proposal / correction `SECURITY_SENSITIVE`, the others `AUTHENTICATED`):
`GET /public/authoring/drafts/:experienceId/semantic`, `POST …/semantic/proposal` `{ commandId }`,
`POST …/semantic/accept` `{ commandId, interpretationId }`,
`POST …/semantic/correction` `{ commandId, interpretationId, meaning, primaryThemes, secondaryThemes }`.
Every body is decoded with an exact key set: a coordinate, a lens, a rank, a weight, a vector, a neighbour, a user, a
controller, a lifecycle, a readiness or a fingerprint is a 400 before any database call (API spec). No route publishes.

### 5.3 Mobile — `apps/mobile/src/`

| File | What |
|---|---|
| `runtime-entry/public-semantic-api.ts` | `PublicSemanticApiClient`, carried by `PublicWorldApiClient.semantic` on the same identity-bound transport (no new runtime-barrel value; types only) |
| `public-authoring/public-authoring-controller.ts` | an optional `semantic` transport; REVIEW loads the understanding only for a whole READY_FOR_REVIEW package; `requestUnderstanding`, `acceptUnderstanding`, `openCorrection`, `cancelCorrection`, `submitCorrection`; `semanticCorrectionOf` normalizes the reader's words exactly to the server's bounds |
| `public-authoring/PublicSemanticReview.tsx` | the semantic section drawn inside the S5-02 review |
| `public-authoring/semantic-copy.ts` | the S5-03A copy and its own Product Copy Gate (§13) |
| `integration/runtime/integration-runtime.ts` | passes `publicTransport.semantic` to the authoring controller |

## 6. The model / provider boundary

- **Not the conversational Model Router.** `ModelRouterRequest.task` is `CONVERSATIONAL_RESPONSE` only, with conversation,
  memory, Human Intelligence and behavioural guidance. A semantic interpretation has none of them; widening that contract
  would make it lie. `PublicSemanticInterpreter` is its own port (`propose`, `assessCorrection`), shaped like the existing
  structured provider ports.
- **Strict structured output.** Both methods return `unknown`; this boundary decodes them: a proposal is exactly
  `{ meaning, primaryThemes, secondaryThemes, explanation, placementIntent: { lensKey } }`; an assessment is exactly
  `{ verdict: 'CONSISTENT', placementIntent }` or `{ verdict: 'NOT_SUPPORTED_BY_PACKAGE' }`. Any other key (a coordinate, a
  score) or shape is no answer. The database re-validates the same rules.
- **Deterministic test seam.** `FakePublicSemanticInterpreter` (NODE_ENV=test only) is a pure function of its input, copies no
  package text and is never shown to a real person.
- **No provider, no fallback.** Outside tests the factory returns `UnconfiguredPublicSemanticInterpreter`, which refuses:
  never the conversational router, never another provider, never a canned answer. The Product then shows "QANDEEL couldn't
  propose an understanding right now", and nothing is recorded.
- **AI usage / cost.** No provider call exists, so nothing bypasses AI-COST-01. When Stage 8A binds a provider, its adapter is
  composed in `createConfiguredPublicSemanticInterpreter` around an accounted transport (`ai-usage/accounted-provider-clients`)
  with its own ledger feature family — the existing structured-provider pattern (G01, G02).
- **No logging** of package text, input or output anywhere in the S5-03A API (API spec scan).

## 7. Semantic input and output shapes

```text
PublicSemanticPackageInput   { contract: 'PUBLIC_SEMANTIC_INTERPRETATION_V1',
                               items: [{ ordinal, kind: 'SOURCE_CONTENT' | 'ANALYSIS', text }] }
PublicSemanticCorrectionInput  … + correction: { meaning, primaryThemes, secondaryThemes }

PublicSemanticProposal       { meaning (≤120, one line), primaryThemes (1–3, ≤40), secondaryThemes (0–3, ≤40, disjoint),
                               explanation (≤280, for the publisher), placementIntent: { lensKey: ^[a-z0-9][a-z0-9_.-]{0,63}$ } }
PublicSemanticCorrectionAssessment  { verdict: 'CONSISTENT', placementIntent } | { verdict: 'NOT_SUPPORTED_BY_PACKAGE' }
```

Stored (R1): the meaning, the lens key, the themes and the explanation live in `semantic_interpretations`, keyed by the
`0096` revision id. The immutable `0096` revision receives the revision order and two fixed, content-free constants —
`lens_key = 's5-03a.private'`, `semantic_label = 'S5-03A_PRIVATE_SEMANTIC_INTERPRETATION_V1'` — so nothing derived from the
package is ever stored where it could not be erased. The lens key is the structured placement intent S5-03B consumes — the
semantic region the meaning is read under, never a coordinate, an embedding, a rank or a neighbour (CW2-04 §36 keeps the
exact model deferred).

**No text is judged by its content (R1).** The first head refused any meaning, theme or explanation containing a
32-character run of the package text. That was a heuristic introduced by the implementation, not canonical law: it could
miss a shorter or a split copy, and it could refuse a valid interpretation. It is removed, with its two outcomes
(`QUOTES_CONTENT`, `COPIES_PACKAGE`) and its copy row. Privacy now rests on lineage and erasure (§10), never on a
similarity threshold: even an answer that repeats the package verbatim is stored only where ASSURE-F05 erases it
(verifier S08, E03).

## 8. Correction semantics

- The publisher corrects the MEANING: a line of meaning and 1–3 main / 0–3 other themes, in their own words, against the
  exact revision they saw (`interpretationId`). Never a coordinate, a location, a rank, a popularity weight, a proximity target,
  "next to Experience X" (an identifier in the text is refused) or a vector: the signature has no room for one.
- QANDEEL assesses the correction against the same exact package. `CONSISTENT` → the next `0096` revision
  (`PUBLISHER_CORRECTION`) with the publisher's meaning and the lens key QANDEEL — not the publisher — assigns, its themes,
  and the review `CORRECTED`. `NOT_SUPPORTED` → nothing is written; the form keeps the publisher's words.
- Additive and auditable: earlier revisions are untouched (verifier S13b, S15); no version, package, approval, right, control
  or lifecycle moves (S16); no new version is created.
- A correction that would need different public content is not a semantic correction: it would be a new package / version
  through the frozen preparation path, which READY_FOR_REVIEW does not reopen here.
- `UNCHANGED` (identical to the current revision) is refused before any work.

## 9. Version binding and semantic readiness

- Every work, outcome, interpretation and review binds the exact version (composite FK) and the package fingerprint:
  `sha256(manifest ‖ ordinal:classification:public_body_digest …)`, derived server-side, never supplied; NULL once any item's
  digest is erased.
- `derive_public_semantic_readiness_v1(experience)` — the ONE boundary S5-03B and the Stage-9 publication path consume — is
  derived on every call, stored nowhere and executable by no application role: `SEMANTICALLY_READY` only when the Experience
  is READY_FOR_REVIEW, its exact current package is whole, the CURRENT (highest) `0096` revision of that exact version was
  committed by S5-03A against that exact package, and the controller reviewed exactly that revision against that exact package.
  Otherwise `NOT_READY` with one reason: `NOT_READY_FOR_REVIEW`, `UNAVAILABLE`, `PACKAGE_UNAVAILABLE`, `NO_INTERPRETATION`,
  `UNREVIEWED_REVISION`, `AWAITING_REVIEW`, `STALE`.
- Proven: ready for the exact version and revision (S12, S13b); a revision written by the raw frozen primitive is
  `UNREVIEWED_REVISION` and shown to nobody (S17); a successor version carries nothing over (S18); a client can supply no
  readiness, fingerprint or lens (input census B03, API spec).

## 10. Stale and deletion behaviour

- A work is admissible only while its exact package is still the whole current package of a READY_FOR_REVIEW Experience, and —
  for a proposal — no interpretation exists, or — for a correction — the revision it corrects is still current. Otherwise no
  input is served, no outcome is recorded and no commit lands (`STALE` / `UNAVAILABLE`).
- **Owner deletion mid-flight** (verifier E01–E02): a correction is opened and its input served; the Shared owner deletes their
  words; ASSURE-F05 erases the package copy. Then: the review is `UNAVAILABLE` with no meaning, theme or explanation;
  readiness `PACKAGE_UNAVAILABLE`; the open work gets no input, no outcome, no commit; accept and new requests are refused.
  Nothing is rebuilt from private or sealed provenance; nothing is resurrected.
- **ASSURE-F05 reaches the semantic content (R1; verifier E03–E05).** The law is the S5-02 one, composed — never re-decided
  by inspecting text. Shared owner deletion physically erases the deleted material and its transitive `MATERIAL_DEPENDENCY`
  closure (never a `REASONING_DEPENDENCY` target), and `0143` erases every Public package item copied from an erased
  material. Every semantic byte was produced FROM the whole package — QANDEEL read every item; a correction is assessed
  against every item — so by lineage it is a material derivative of every item of that package. When ANY item of a package
  is erased, an `AFTER UPDATE` trigger on the package items erases, in the same transaction and at the same instant, every
  content-bearing semantic byte bound to a version of that package: QANDEEL's meaning, lens key, themes and explanation; the
  committed meaning, lens key, themes and explanation; the publisher's correction words; and every package fingerprint and
  request digest (content verifiers over the erased bytes and those words, as `0143` treats its digests). What survives is
  audit identity only — ids, kinds, origins, outcomes, review decisions, the version binding, the `0096` revision order and
  the instants — exactly as `0143` keeps an erased item's identity, ordinal and classification. Proven: every content column
  of every semantic row of the Experience is NULL and stamped with the deletion instant, no row is deleted, no package text,
  meaning, theme, lens key or correction word survives anywhere in the four relations, and the `0096` revisions are
  unchanged because they held nothing to erase (E03); an Experience whose package nobody erased keeps its interpretation byte
  for byte (E04); the erased content can never be written back, by any role (E05).
- **Append-only, with one narrow exception.** The four relations stay append-only for every role. The guard admits exactly
  one UPDATE — that relation's content columns to NULL, the erasure instant arriving, nothing else moving — and only while the
  row's own package holds an `ERASED_BY_OWNER` item at exactly that instant, re-proven inside the guard. A hand-made
  "erasure" without that proof is refused, and no row is inserted already erased (verifier S15a).
- **Races** (two real connections): two corrections of the same revision — one lands, the other is `STALE` (C01). A semantic
  write and an owner deletion serialize (C02): every writer takes the Experience row `FOR UPDATE` and then the current
  package's items `FOR SHARE` before it reads wholeness; `0143`'s erasure updates those items, so a deletion that comes second
  waits and then erases what the write committed, and a write that comes second reads `ERASED_BY_OWNER` and writes nothing.
  Owner deletion never takes an Experience lock, so the item lock closes no cycle.

## 11. CW2-08 unchanged, PUBLISHED unreachable

- Deploy-time (`0144` H1, H2): no application role executes `record_public_experience_semantic_placement_v1`,
  `derive_public_experience_current_placement_v1`, `publish_public_experience_v1`, `resolve_public_publication_prerequisites_v1`,
  the frozen READY commit, discussion or Public QANDEEL; the seam's source still answers `NOT_EVALUATED` and never `'CLEARED'`.
- Source bans (H3, verifier B07, the static contract): nothing S5-03A owns names publication, the seam, `'PUBLISHED'`,
  `ABSENT_FROM_PUBLIC_WORLD`, discussion or Public QANDEEL.
- Live (verifier L01–L03): a SEMANTICALLY_READY Experience still meets `NOT_EVALUATED`; every application role is refused
  publication and the raw placement primitive; READY_FOR_REVIEW stays `NOT_PUBLICLY_VISIBLE`; the frozen public placement
  resolver serves the interpretation to no viewer, not even the publisher; no search / lens projection exists; no Experience is
  PUBLISHED.
- API / mobile: no publish route (census), no publish call, no `PUBLISHED` state or copy; the semantic UI keeps the S5-02
  "Not published yet" line.

## 12. Mobile Product surface

The S5-02 review gains ONE section, only when the package is whole and the Experience is READY_FOR_REVIEW: a heading, one
line explaining that QANDEEL proposes the meaning before anything is published and that the reader can accept or correct it;
"ask" when there is no proposal; the meaning, the main and other meanings and why QANDEEL reads it so; "accept" for exactly
the revision shown; "correct the understanding", which opens three fields (the meaning, main meanings separated by commas,
other meanings) prefilled from the current understanding, with the line "a correction is about the meaning only; it doesn't
move the experience to a place you choose". No map, coordinate, lens, model, prompt or vector appears; no Public Map is
built; no "published" state exists. Arabic and English. Hardware Back is not registered (the S5-01 rule).

## 13. Product Copy Gate — **S5-03A PRODUCT COPY GATE — CLOSED — 21 rows APPROVED (Product Owner, 2026-10-06)**

Census: every S5-03A user-visible string is in `apps/mobile/src/public-authoring/semantic-copy.ts`. No S5-01 / S5-02 frozen
string was changed. The Product Owner approved all 21 rows exactly as written on 2026-10-06; this closes the S5-03A Product Copy Gate.

| Key | Class | العربية | English |
|---|---|---|---|
| actionUnavailable | REUSED (S4-01 gate, through S5-02) | تعذّر ذلك الآن. | That didn't work right now. |
| cancel | REUSED (S4-01 gate) | إلغاء | Cancel |
| heading | **APPROVED** | كيف فهم قنديل هذه التجربة | How QANDEEL understood this experience |
| explain | **APPROVED** | قبل أي نشر، يقترح قنديل المعنى الذي يفهمه من هذه التجربة. يمكنك قبوله أو تصحيحه. | Before anything is published, QANDEEL proposes the meaning it understands in this experience. You can accept it or correct it. |
| ask | **APPROVED** | اطلب فهم قنديل لهذه التجربة | Ask for QANDEEL's understanding of this experience |
| meaningHeading | **APPROVED** | المعنى | Meaning |
| primaryHeading | **APPROVED** | المعاني الأساسية | Main meanings |
| secondaryHeading | **APPROVED** | معانٍ أخرى | Other meanings |
| whyHeading | **APPROVED** | لماذا فهمها قنديل هكذا | Why QANDEEL understands it this way |
| accept | **APPROVED** | أوافق على هذا الفهم | I accept this understanding |
| correct | **APPROVED** | تصحيح الفهم | Correct the understanding |
| correctionScope | **APPROVED** | التصحيح يخص المعنى فقط، ولا ينقل التجربة إلى مكان تختاره. | A correction is about the meaning only; it doesn't move the experience to a place you choose. |
| meaningLabel | **APPROVED** | المعنى بكلماتك | The meaning, in your words |
| primaryLabel | **APPROVED** | المعاني الأساسية، مفصولة بفاصلة | Main meanings, separated by commas |
| secondaryLabel | **APPROVED** | معانٍ أخرى، اختياري | Other meanings, optional |
| submitCorrection | **APPROVED** | إرسال التصحيح | Send correction |
| acceptedState | **APPROVED** | وافقت على فهم قنديل. | You accepted QANDEEL's understanding. |
| correctedState | **APPROVED** | هذا هو الفهم بعد تصحيحك. | This is the understanding after your correction. |
| interpretationUnavailable | **APPROVED** | تعذّر على قنديل اقتراح فهم الآن. | QANDEEL couldn't propose an understanding right now. |
| notSupported | **APPROVED** | محتوى التجربة لا يدعم هذا التصحيح. يمكنك صياغته بشكل آخر. | The experience's content doesn't support this correction. You can phrase it differently. |
| unchanged | **APPROVED** | هذا التصحيح مطابق للفهم الحالي. | This correction matches the current understanding. |
| correctionInvalid | **APPROVED** | المعنى سطر واحد حتى 120 حرفًا، ومن معنى أساسي إلى ثلاثة، كلٌّ منها حتى 40 حرفًا. | The meaning is one line of up to 120 characters, with one to three main meanings of up to 40 characters each. |
| limited | **APPROVED** | وصلت هذه التجربة إلى الحد المسموح اليوم. حاول لاحقًا. | This experience has reached today's limit. Try again later. |

Notes for the Product Owner: the heading deliberately avoids «فهم قنديل» / "QANDEEL Understanding" — P1 §10's name for the
Personal Understanding surface; the body rows use the ordinary phrase «فهم قنديل» ("QANDEEL's understanding") in running text.
"Themes" are presented as «المعاني» / "meanings" so no internal term appears. R1 withdrew the proposed `quotesContent` row
("Describe the meaning in your own words rather than copying the text."): the refusal it named no longer exists.

## 14. Documentation reconciliation (current-truth entry points only)

- `QANDEEL_PROJECT_MAP.md` §5.1: Stage 5 row — S5-02 `MERGED / CLOSED` through PR #315 at `1a101276…`; S5-03A (this branch, not merged),
  S5-03B NEXT, S5-03C LATER, S5-04 LATER; Stage 8 written as **8A — QANDEEL AI Brain / Production LLM Runtime** then **8B —
  Voice Runtime** (order unchanged); the current-task line.
- `QANDEEL_CURRENT_STATE.md`: the S5-02 row `MERGED / CLOSED`, an S5-03A row, the Public runtime row, the counts paragraph, the
  sequencing (S5-03A/B/C, 8A before Voice), the owner table (S5-03B / S5-03C / S5-04, Stage 8A), and the merged wording of the
  `QAN-BL-CW-01` / `E2E-H-08` mentions.
- `docs/qandeel-canonical-backlog-v1.md`: the `QAN-BL-CW-01` tombstone's PR / SHA filled in (PR #315, `1a101276…`, with the
  original wording kept); a `QAN-BL-ACCT-01` current-truth note; the S5-03A reconciliation paragraph; the §9 row.
- `database/README.md`: the `0144` section.
- Not rewritten: historical records keep their own words — the S5-02 record keeps its pre-merge banner (G04);
  `QANDEEL_PRODUCT_ROADMAP.md` carries no stage map and is unchanged.

## 15. `QAN-BL-ACCT-01` — still `HIGH`, `OPEN — UNASSIGNED`

S5-03A does not solve it, and it does add to the footprint that blocker covers. No S5-03A column names an account and no
foreign key reaches one directly (H6, B05). But S5-03A creates new dependent rows through edges that are part of the
blocker:

- **Experience Version.** `semantic_work` and `semantic_interpretations` bind `public_experience_versions`
  `ON DELETE RESTRICT` (and the outcome and review rows hang from them), so an Experience Version that has semantic history
  cannot be removed while that history exists.
- **Semantic Placement.** `semantic_interpretations` (and a correction's `semantic_work`) bind
  `public_experience_semantic_placements` `ON DELETE RESTRICT`; and every `0096` revision S5-03A writes through the frozen
  primitive binds its recorder's Public identity and account (`recorded_by_public_identity_ref`, `recorded_by_user_id`,
  `RESTRICT`, as I-05 froze it), as does its `0096` command row (`actor_user_id`).
- **`ON DELETE RESTRICT` throughout.** Verifier B05a pins exactly these four edges.

So an account that has received a semantic interpretation now has more `RESTRICT`-bound Public rows than after S5-02. An
author's governed Personal erasure was already BLOCKED by S5-02's footprint and still is. These edges are recorded as part of
the current blocker, **`QAN-BL-ACCT-01 — HIGH / OPEN`**, and S5-03A does not attempt to resolve them. **The Public World is
not launch-ready**; no Launch Readiness is claimed.

## 16. Stage-5 Gap Matrix (S5-03A)

| # | Gap / observation | Class | Owner / disposition |
|---|---|---|---|
| G01 | No production provider behind `PublicSemanticInterpreter`: outside tests it refuses, so no real Experience becomes semantically ready yet | 2 — closure-time backlog admission candidate | Stage 8A by the Task Contract; the Product Owner names the owner task within 8A, then it is admitted (BG-02 / BG-08) |
| G02 | The interpreter's AI-COST-01 feature family and per-account spend admission (today: 12 works / version / day + the strict rate class) | 2 — same candidate as G01 | Stage 8A, with the provider binding |
| G03 | No Android device leg for the semantic stage (the S5-02 journey is unchanged); mobile Jest covers both languages | 4 assigned | S5-03B, whose viewer runtime closes the Publish-side journey through placement |
| G04 | The S5-02 record still carries its pre-merge banner ("NOT MERGED") | 5 — observe / report | historical record kept as written, per this Task Contract §16; a governance reconciliation may update it if the Product Owner wants (BG-09) |
| G05 | The S5-02 record's copy table renders the reused English refusal as "That couldn't be done right now."; the frozen string is "That didn't work right now." | 5 — observe / report | historical text; the code was always correct |
| G06 | Semantic readiness is semantic only: an approval withdrawn after READY (S5-02 G15) does not change it; publication revalidation (`0095`) and the Stage-9 path compose both | 5 — not an obligation now | Stage 9 / CW2-08 consumes readiness beside the approval state |
| G07 | The lens-key vocabulary is the interpreter's (a bounded slug), not a frozen taxonomy; it lives in the erasable private row | 4 assigned | S5-03B — the exact semantic model and geometry (CW2-04 §36) |
| G08 | The content of an interpretation of a later-erased package is physically erased with it (R1); only its audit identity survives | 5 — by design | ASSURE-F05 / CW2-02 §27, composed with the S5-02 erasure law (§10) |
| G09 | Themes are free text in the publisher's language | 4 assigned | S5-03B (cross-language semantic proximity is the field's) |
| G10 | The S5-03A Product Copy Gate | CLOSED | §13 — 21 rows APPROVED by the Product Owner on 2026-10-06 (BG-01) |
| G11 | Export My Data does not include the semantic footprint | 3 existing owner | `E2E-D-16` (world-scoped export `NOT YET INCLUDED`) |
| G12 | Public semantic field, FAR / MID / NEAR, camera, search / lens / panel UI | 4 assigned | S5-03B |
| G13 | Explicit Public relations, relation lines, integrity closure | 4 assigned | S5-03C |
| G14 | Discussion, replies, Public QANDEEL participation, Public Activity / Push | 4 assigned | S5-04 |
| G15 | `PUBLISHED`, CW2-08, Safety / moderation, entitlement, signed-out viewing | 3 existing owner | `CW2-08` / `I-09` / Stage 9 — unchanged |
| G16 | Account deletion across Connected Worlds — S5-03A adds Experience Version and Semantic Placement dependents, `ON DELETE RESTRICT` | 3 existing item | `QAN-BL-ACCT-01` — `HIGH / OPEN`, scope unchanged, the new edges recorded (§15) |
| G17 | Public Voice, Replay | 3 existing items | `QAN-BL-VOICE-01` / Stage 8B; Stage 7 |
| G18 | The frozen I-05 public readers (`0097` search / lens projection, the `0096` placement resolver) read the `0096` descriptor, which S5-03A now fills with content-free constants (R1); the reviewed meaning and lens key live in the erasable S5-03A row | 4 assigned | S5-03B consumes the lens key through the S5-03A boundary (never the raw placement); the Stage-9 publication path must serve the S5-03A meaning, never the `0096` constant. Nothing is public today (`PUBLISHED` is unreachable) |

**Orphan gaps = 0** — every row has class 1–5 and a named owner or disposition.

## 17. Remaining Stage-5 ownership

- **S5-03B — Public Semantic Field + Viewer Runtime:** turns the reviewed interpretation into a stable spatial placement,
  consuming `derive_public_semantic_readiness_v1` (never the raw placement), the Public semantic field, FAR / MID / NEAR, the
  viewer, camera, search / lens / panel surfaces.
- **S5-03C — Explicit Relations + Integrity Closure:** `EXPLICIT_PUBLIC_RELATION`, relation lines, integrity closure.
- **S5-04 — Discussion + Public QANDEEL + Final Public Integration.**
- **Stage 8A:** the production provider behind the S5-03A interpreter (G01, G02). **Stage 9 / CW2-08:** `PUBLISHED`.

## 18. Validation

Local real PostgreSQL 17.10 (the CI major), on `localhost` only, from the `@embedded-postgres/windows-x64@17.10.0-beta.17`
binaries already in the local npm cache — never the hosted `.env` database. Bootstrap + every migration from zero, each file
as one batch.

| Check | Result |
|---|---|
| `0144` applies; its deploy-time self-assertions (H1–H8) pass | PASS |
| `database/verify-migration-0144.mjs` — boundary, PUBLIC PACKAGE ONLY, flow, version binding, erasure, launch closure, concurrency | PASS (first run) |
| neighbouring verifiers on the same database: `0091`–`0099`, `0121`, `0142`, `0143` | 12 / 12 PASS |
| every database verifier API CI runs, in CI order, on a fresh database with `0144` | 140 PASS; `0130` and `0133` C (§19 F11, F12); 8 non-database steps skipped |
| database static (`database/tests`) | 1304 / 1304 |
| API Jest (full) | 228 suites, 5121 / 5121 |
| API focused (`src/public-world`, `src/http-security` incl. the AppModule route census) | 120 / 120 |
| API `tsc --noEmit` | PASS |
| mobile `tsc --noEmit` | PASS |
| mobile Jest focused (`src/public-authoring`, `src/public-world`, `src/runtime-entry`) | 283 / 283 |
| mobile Jest (full) | 185 suites; 2196 / 2202 — the 6 failures are the recorded local-locale baseline in `w2-account-access` and `depth` (§19 F13), untouched by S5-03A |
| root static contracts (`tests/*.test.mjs`, with the ignored `apps/mobile/android` moved aside), incl. the new S5-03A contract (10 / 10), the re-anchored S5-02 contract, the task-closure governance contract and the forward-safety mirror | 1197 / 1197 |
| API CI, Mobile CI on the first head `534e618` | reported in Draft PR #316 |

**R1 — targeted validation after the ASSURE-F05 correction** (local real PostgreSQL 17.10, the same harness; full suites and
native proof loops were not re-run, by the Product Owner's instruction):

| Check | Result |
|---|---|
| `0144` applies on a fresh pre-`0144` database; H1–H8 pass | PASS |
| `database/verify-migration-0144.mjs` incl. S08 (no text judged), S10 / S13b (constants in `0096`, content in the private row), S15a (no borrowed erasure, no erased insert), E03–E05 (erasure, scoping, one way), C02 (write vs deletion race), B05a / B05b | PASS |
| mutation check: the erasure trigger function emptied → E03 fails; the item lock emptied → C02 fails | both caught |
| verifiers touching the package items or owner deletion, on the same database: `0090`, `0092`, `0093`, `0096`, `0100`, `0101`, `0103`, `0104`, `0122`, `0143` | 10 / 10 PASS |
| the root static contracts that read any changed path (21 files, incl. S5-01 / S5-02 / S5-03A, task-closure governance, forward-safety mirror; `apps/mobile/android` moved aside as before) | 21 / 21 files PASS |
| database static tests that read `0144` / `0096` / `0097` | 41 / 41 |
| API focused (`src/public-world`, `src/http-security` incl. the route census) | 120 / 120 |
| mobile focused (`src/public-authoring`, `src/public-world`, `src/runtime-entry`) | 283 / 283 |
| API and mobile `tsc --noEmit` | PASS |

## 19. Failure classification (A Product / Security · B Validation / Proof · C Infrastructure)

| # | Where | Class | Disposition |
|---|---|---|---|
| F01 | my own S5-03A mobile test: it hard-coded the reused English refusal as "That couldn't be done right now." | B | the test reads the frozen string from its source module |
| F02 | my own S5-03A mobile test: the "never published" ban matched the conditional "Before anything is published" | B | the ban is the S5-02 one (an achieved "Published"), case-sensitive |
| F03 | S5-02 static contract 5: `controllers: [PublicWorldController, PublicAuthoringController]` exactly | B | re-anchored: the S5-03A controller joins the SAME module (still one Public module) |
| F04 | S5-02 static contract 6: the wiring line exactly | B | re-anchored: the authoring controller also receives the semantic client on the same transport |
| F05 | S5-02 static contract 8: Current State / Project Map S5-02 "Draft PR" | B | re-anchored to the merged truth (PR #315) |
| F06 | my own first mobile split put the semantic UI and client inside S5-02's pinned files (`TextInput`, the POST census) | B (design, caught before commit) | moved to `PublicSemanticReview.tsx` and `public-semantic-api.ts`; S5-02's pins stay true unchanged |
| F07 | my own copy proposal used «فهم قنديل» as the heading — P1's Personal surface name | A — Product copy | heading re-proposed (§13) |
| F08 | the new S5-03A contract: the Arabic list separator was a literal inside the surface file | B | moved to the copy module as `semanticListSeparator` (typography, not a copy row) |
| F09 | `committed-conversational-unit-activation-boundary` contract: my API spec's ban-list text contained the literal `conversation-unit`, which that census reads as a substrate reach | B | the word removed from the spec's ban list; no production code reaches the substrate |
| F10 | `t12p-mobile-runtime-entry` contract: my mobile test deep-imported `runtime-entry/public-semantic-api` | B | the test reaches the client the way the app does: `PublicWorldApiClient(...).semantic` through the barrel |
| F11 | `verify-migration-0130` locally: `days <= 7` | C | the clock-skew flake already reproduced without `0143` by S5-02 (database vs Node clock on Windows); no change |
| F12 | `verify-migration-0133` locally | C | it shells out to `psql`, absent here; CI has it |
| F13 | mobile Jest: 6 tests in `w2-account-access` / `depth` | B — Validation / Baseline | the local-locale baseline (the machine renders Arabic where those tests expect English labels); recorded in the S4 / S5 sessions; unrelated suites. Reclassified from C by the Product Owner (R1): there is no evidence that it is infrastructure |
| F14 | the first head's 32-character "not a copy" rule as the ASSURE-F05 guarantee for immutable semantic history | A — Product / Privacy (independent review R1) | a heuristic, not canonical law: it could miss a short or split copy while the history is append-only. Corrected: nothing derived from the package enters the immutable `0096` revision; every content-bearing semantic byte is erased with the package by lineage (§7, §10) |

No Product or Security defect was found in the frozen runtime. F14 was a defect of this task's own first head, corrected in R1.
