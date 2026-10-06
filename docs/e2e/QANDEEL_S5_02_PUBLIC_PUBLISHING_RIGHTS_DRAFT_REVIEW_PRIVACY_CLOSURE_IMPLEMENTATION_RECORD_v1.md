# QANDEEL — S5-02 Public Publishing, Rights, Draft / Review & Privacy Closure — Implementation Record v1

**Task:** `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` (Stage 5 — Public World Product Integration; the
second Stage-5 task)
**Task Contract:** the Product Owner's S5-02 Task Contract (2026-10-06)
**Canonical baseline:** `8dfc7b38baa133c8cecbffea8c65ae17ddc245ff` (the merge of PR #314, S5-01)
**Branch:** `feat/s5-02-public-publishing-rights-review-privacy`
**Status:** **`S5-02 IMPLEMENTED — REVIEW CANDIDATE (Draft PR) — S5-02 PRODUCT COPY GATE OPEN (rows PROPOSED) — NOT MERGED`**.
Claude does not merge it. **R1 (independent review, 2026-10-06) applied:** G16 corrected (MATERIAL_DEPENDENCY erasure
propagates physical Public erasure; REASONING_DEPENDENCY does not), G17 wording corrected, the copy rows revised (§12, §18).

> Owner deletion now physically erases the Public copy of what the owner deleted. When a Shared human deletes their own
> words, every Public package item that copied them — or copied a Shared output in their exact MATERIAL_DEPENDENCY
> closure, which the same deletion physically erases — loses the bytes AND both digests of them, whatever its Public
> label, in the same transaction, at the same canonical instant (a REASONING_DEPENDENCY output is not erased for that
> reason); the package keeps its audit identity and is never served
> as a smaller package (`ASSURE-F05` / `QAN-BL-CW-01`). On top of that closed gate, a real human can take their own
> EXISTING QANDEEL material — their committed Personal words, or the Shared words they can see — into a Public DRAFT, see
> exactly what would become public under their CURRENT public display, collect the exact content rightsholders' approvals
> (each approver seeing only the exact included content requiring their approval), withdraw an approval, and reach READY_FOR_REVIEW. Nothing is
> published: READY_FOR_REVIEW is not public, and the CW2-08 prerequisites still answer `NOT_EVALUATED`.

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `8dfc7b38baa133c8cecbffea8c65ae17ddc245ff` — `origin/main` confirmed equal at kickoff (fetched), working tree clean, migration tip `0142_public_world_entry_identity_product_v1.sql` |
| Branch | `feat/s5-02-public-publishing-rights-review-privacy`, cut from `origin/main` |
| PR | `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` — a Draft PR opened at the first push (number in the PR conversation) |
| Head | the commit carrying this record; the exact SHA is reported in the PR and the completion report |
| Migration | `0143_public_authoring_rights_privacy_v1.sql` (one migration: every part shares one deploy-time proof) |

### 1.1 The execution map at kickoff (Project Map §5.1)

| Stage | Status |
|---|---|
| 1 — Personal Core / W3 core | DONE (named residuals) |
| 2 — Final Visual Production Port | DONE / MERGED |
| 3 — Activity & Notifications | DONE / MERGED |
| 4 — Shared World | DONE / MERGED |
| **5 — Public World** | **ACTIVE** — S5-01 MERGED (PR #314); **S5-02 = this task**; S5-03 / S5-04 NOT STARTED |
| 6 – 9 | LATER |

Reused, never rebuilt: the I-05 runtime (`0091`–`0099`, `0119`, `0121`), the I-04 owner deletion (`0090` → `0115` → `0122`),
the S5-01 display derivation and bridge (`0142`), the S5-01 Public root and entry controller.

## 2. Anti-Duplication Gate

| Need | Existing authority / runtime | Gap | What S5-02 adds |
|---|---|---|---|
| Public identity | `public_identities` / `public_identity_display_state` (`0091`), `ensure_public_identity_v1` (`0093` → `0121`, executable by nobody, caller-supplied ref and label) | no application path; a 64 label ceiling | ONE internal provisioning at the first authoring act: ref random server-side, mode and label from the ONE S5-01 derivation (§6) |
| Draft | `create_public_experience_draft_v1` (`0121`) | unreachable | one owner command that provisions, then calls it (§7) |
| Package | `prepare_public_experience_manifest_v1` (`0119`), the immutable `0092` package, `resolve_public_package_items_v1` | unreachable; F05 | one owner command supplying ONLY the chosen sources and derived opaque ids (§7) |
| Rights | `derive_public_publication_authority_v1`, the derived `publication_manifest_required_approvers`, `approve_public_experience_manifest_v1` (`0093`), the effective-state derivation and `withdraw_publication_approval_v1` (`0094`) | unreachable; the frozen READY commit counts approval ROWS and ignores withdrawals | owner commands for approve / withdraw; READY gated on EFFECTIVE approvals under the canonical locks (§8) |
| READY | `commit_public_experience_ready_for_review_v1` (`0121`) | unreachable | one owner command (§8) |
| Review | `resolve_public_experience_review_v1` (`0093`, service_role, inner-joins bodies: silently partial after an erasure) | serves deleted bytes (F05) | forward-replaced dark for a non-whole package; a Product review with an explicit UNAVAILABLE state (§4.5) |
| Owner deletion | `delete_shared_world_owned_material_v1` (`0122`) | never reaches Public | the erasure, inside it (§4) |
| Public root | `PublicWorldArea`, `createPublicWorldController` (S5-01) | content-empty by truth | ONE entry into an authoring workspace drawn inside the root; the field stays empty (§9) |
| Display choice | S5-01 `0142` derivation + bridge | refuses a 65–80-char Name | the ceiling reconciled to 80 (§6) |

No second publication model, identity store, rights model, approval relation or navigation system exists. The S5-02
schema `public_authoring_private` holds **no relation**; every row it writes is written by a frozen I-05 primitive.

## 3. Authority map

| Fact | Owner | S5-02 |
|---|---|---|
| Owner-deleted content non-serving, non-reconstructable | CW2-02 §27 (B19/B20), CW2-03 §37 (C32), CW2-01 A18, CW2-08 §2 | consumed; physical erasure per the Product Owner's F05 decision |
| Derivative classes | CW2-02 §27; the `0093` classification by material kind | the label is kept as audit identity, but it does not decide erasure: Public erasure follows Shared PHYSICAL erasure — the deleted source and its exact transitive `MATERIAL_DEPENDENCY` closure; a `REASONING_DEPENDENCY` target is not erased (R1, G16) |
| Experience control ≠ content rights | CW2-04 §7 / D8; `0091` / `0092` | consumed unchanged; proven both ways (§8) |
| Rightsholder set | CW2-02 §38 / B27; the `0093` derivation | consumed; never supplied |
| Lifecycle | CW2-04 §3; `0093` / `0121` | DRAFT → READY_FOR_REVIEW only |
| Publication | CW2-04 §12 + Product Definition §12; `0095` + the CW2-08 seam | untouched; unreachable (§10) |
| Public identity / label | CW2-04 §9 / D10; P1 §6; S5-01 | provisioned at first authorship; label derived |

## 4. ASSURE-F05 — the physical-erasure closure (migration `0143` part A)

### 4.1 Mechanism

- **State, structurally.** `publication_package_manifest_items` gains `content_state` (`CONTENT_PRESENT` |
  `ERASED_BY_OWNER`) and `content_erased_at`; `public_body_digest` becomes nullable, and a biconditional CHECK makes
  `NULL` representable ONLY in `ERASED_BY_OWNER` (whatever the item's historical classification — R1).
  `publication_package_item_provenance` gains `captured_digest_erased_at`; `captured_source_digest` becomes nullable under
  its own biconditional CHECK, ONLY for a `SHARED_WORLD` source. The frozen `0092` digest shape CHECKs still bind every
  non-NULL value.
- **The one-way exception (not a disabled trigger).** The `0092` guard keeps its NAME on all seven package relations; its
  body is forward-replaced with exactly three permitted operations, each re-proving canonical truth INSIDE the trigger:
  provenance digest `sha256:… → NULL`; item `CONTENT_PRESENT → ERASED_BY_OWNER` (digest → NULL); `DELETE` of the body of an
  item already erased. Required: a `SHARED_WORLD` source whose Shared body is physically gone, and EITHER its exact history
  item terminal `DELETED_BY_OWNER` with its own canonical `MATERIAL_DELETED` event at the exact erasure instant, OR its
  history item `UNAVAILABLE` with a `MATERIAL_DELETED` event at that instant naming a material upstream of it through
  `MATERIAL_DEPENDENCY` edges only (owner deletion is the only writer of `UNAVAILABLE`); the item's instant must equal
  its provenance's. The item's classification is not consulted (R1, G16). Every other UPDATE / DELETE of every package
  relation is refused, as before, for every role including the table owner. A new `BEFORE INSERT` guard refuses
  inserting a body beside an erased item (no resurrection, even by the owner).
- **Same transaction, same instant.** `delete_shared_world_owned_material_v1` is forward-replaced from `0122` with two
  changes only: after the terminal transition and the `MATERIAL_DELETED` fact, it calls
  `public_authoring_private.erase_owner_deleted_public_derivatives_v1(p_material_id, delete_instant)` (provenance digest →
  item digest → body, then a proof that nothing of it survives, else the whole deletion rolls back); and its
  committed-answer retry additionally proves no Public package retains the bytes or a digest of them. Its lock order,
  kind branches, transitive invalidation, events, commands, refusal classes and result columns are unchanged. Every
  application deletion path (`delete_own_shared_world_material_v1`, S4-02 / S4-03) reaches it. A partial index on
  `publication_package_item_provenance (shared_material_id)` keeps that lookup from scanning every package.
- **Already-unsafe rows** are erased forward, at the instant the owner actually deleted (the canonical event; for a
  closure target, the earliest upstream deletion that reaches it), whatever the item's label. A packaged Shared source
  whose body is gone with no proven erasure, a `DELETED_BY_OWNER` source with no canonical event, an `UNAVAILABLE`
  source with no upstream deletion, or an erased source whose body survives, REFUSES deployment — never normalized.
- **Audit identity survives:** manifest, Experience, version, every item / ordinal / classification, sealed provenance
  identity, per-item authority, required approvers, approvals, withdrawals, transitions, and the erasure fact and time.

Physical erasure is at the logical level — the row is deleted and the columns are NULLed, exactly the standard of the
Shared body deletion `0090` already applies; storage reclamation is the database's own (`VACUUM`).

### 4.2 Content-verifier census (Task Contract §3.2)

| Durable field | What it is derived from | Verifier of the deleted bytes? | Disposition |
|---|---|---|---|
| `public_experience_text_derivative_bodies.public_text_body` | the exact source text | IS the content | row DELETED |
| `publication_package_manifest_items.public_body_digest` | `sha256(public body)` = `sha256(source)` | yes — unsalted, low-entropy-confirmable (the `0122` reasoning) | ERASED |
| `publication_package_item_provenance.captured_source_digest` | `sha256(source body)` | yes | ERASED |
| `publication_package_prepare_commands.request_ref` | actor, Experience, manifest, version, `item@unit` / `item@world:material` ids | no — identifiers only | kept |
| `authority_request_fingerprint` (prepare / READY / publish commands), `bound_authority_fingerprint` (approvals), publication state | action, target, audience class, readiness, Experience / version / manifest ids, publisher ref, item count, source SCOPE (ids), approvers, snapshot | no — identifiers and vocabulary | kept |
| draft / READY / withdrawal / disappearance `request_ref` | ids only | no | kept |
| `public_identity_commands.request_ref` / `committed_display_label` | the PUBLIC display label | not source content | kept |
| `public_qandeel_responses.context_fingerprint`, semantic placement, discussion, search projection (`0096` / `0097`) | ids / the publisher's semantic label / third parties' own posts / QANDEEL's own reply | not copies of the source; exist only after PUBLISHED, which no path can reach | not touched (S5-03 / S5-04 own those surfaces; CW2-02 §27 keeps analytical derivatives) |
| `public_authoring_private` | — | holds no relation | n/a |

The whole-database census in the verifier (P01 / P03) scans every text, varchar, json and bytea column of every
application relation for the deleted text and its digest: before deletion it finds exactly the Shared body, the Public
body and the two digests; after deletion, nothing.

### 4.3 Concurrency (real PostgreSQL, two connections)

| Race | Result |
|---|---|
| C01 delete wins first | the preparation queues on the deletion's Shared World lock, then fails closed (`UNAVAILABLE`); no derivative byte was ever created |
| C02 prepare wins first | the deletion queues on the preparation's World lock, then erases the package it waited for, in its own transaction; nothing is observable before it commits |
| C03 six interleaved races, both orders | never a committed deletion beside surviving bytes; `pg_stat_database.deadlocks` unchanged |
| C00 two concurrent first authorings, one human | one Public Identity |

The erasure touches only already-committed, immutable package rows that no Public primitive locks for update, so it adds
no edge to the canonical Public order (singleton → Experience → manifest → Shared World → materials → history items).

### 4.4 MATERIAL vs REASONING dependency (R1, G16)

**The rule is Shared physical erasure, not the Public label.** Canonical Shared owner deletion already treats the
transitive `MATERIAL_DEPENDENCY` closure as source-content-bearing: it physically removes each dependent target's body and
makes it `UNAVAILABLE` (`0090` / `0122`), while a `REASONING_DEPENDENCY` target is intentionally kept. Public erasure
now follows exactly that: `erase_owner_deleted_public_derivatives_v1` computes the deleted material plus the same
`MATERIAL_DEPENDENCY`-only closure the deletion traverses, and erases every package item whose sealed provenance names a
material of that set — including an item the `0093` classification labelled `ANALYTICAL_DERIVATIVE` (a QANDEEL output).
The guard re-proves each row from canonical truth (above). Proven by G01–G10 and R03 (§15):

- human source → QANDEEL target (→ a second QANDEEL target, transitively) through `MATERIAL_DEPENDENCY`; a Public package
  snapshots both targets (both `ANALYTICAL_DERIVATIVE`) and an equivalent `REASONING_DEPENDENCY` output;
- the human owner deletes the source: both targets are `UNAVAILABLE` with their Shared bodies gone; their Public bytes and
  both verifiers are physically gone at the deletion instant, and the whole-database census finds nothing of them;
- the review is dark (Product and frozen resolver); the erased items stay one-way and non-resurrectable;
- the `REASONING_DEPENDENCY` output keeps its bytes and digests, its own package still reviews `CURRENT`, and the guard
  refuses erasing it by hand even at the deletion's own instant;
- an unrelated analytical output in another package keeps its bytes (P05); the committed retry re-proves the closure.

### 4.5 The review boundaries (complete-dark census)

- `read_own_public_experience_review_v1` (Product): `UNAVAILABLE` — with no item and no byte — when the package has an
  erased item, a missing body, or any source the ONE `0093` derivation no longer accepts. Never a partial package.
- `resolve_public_experience_review_v1` (frozen, service_role): forward-replaced to return zero rows for a non-whole
  package (it previously inner-joined bodies, so an erasure would have silently produced a SMALLER package). Signature,
  columns, posture and the exact-controller rule unchanged; it still never names sealed provenance.
- The approver's request: `UNAVAILABLE`, no byte. The outward Public surfaces: `assertCompletelyDark` (P06).

## 5. API and mobile surfaces

| Layer | Path | What |
|---|---|---|
| DB | `public_authoring_private` (9 owner commands, 7 internal helpers incl. 2 trigger functions; no relation) + 9 `public` INVOKER wrappers | `authenticated` executes the 9 owner commands only; anon and the server channel nothing |
| API | `apps/api/src/public-world/public-authoring.{controller,service,repository}.ts`, `public-world.module.ts` | 9 routes under `/public/authoring` (census: start / package `SECURITY_SENSITIVE`, the rest `AUTHENTICATED`) |
| Mobile | `apps/mobile/src/public-authoring/` (controller, workspace, copy), `runtime-entry/public-authoring-api.ts`; the Public root gains ONE entry | the workspace drawn inside the Public root |
| Proof | `s401-proof-world.ts` S5-02 routes, `.maestro/s5-02-journey-b.yaml`, leg `ar-s502-journey-b` | one Android leg |

Routes: `GET /public/authoring`, `GET /public/authoring/sources`, `POST /public/authoring/drafts`,
`POST /public/authoring/drafts/:experienceId/package`, `GET /public/authoring/drafts/:experienceId/review`,
`POST /public/authoring/drafts/:experienceId/ready`, `GET /public/authoring/approvals`,
`POST /public/authoring/approvals/:manifestId/approve`, `POST /public/authoring/approvals/:manifestId/withdraw`. No route
takes a user, a Public ref, a label, an approver, an authority, an audience, a body text or a clearance; bodies are
`{ commandId }` (and, for a package, `{ personal: [unitId], shared: [{ worldId, materialId }] }`, 1–20 distinct).

## 6. Identity law (E2E-H-08) and the 64 → 80 Name reconciliation

- **No identity by viewing.** Entering Public World, reading or choosing the display mode, listing Drafts, sources or
  requests provisions nothing (verifier I01).
- **One identity at first real authorship.** `start_own_public_experience_draft_v1` provisions it under the account row
  (`FOR NO KEY UPDATE`: it queues behind a Name / Public ID / mode change, so the label is never stale at birth, and blocks
  none of the foreign-key checks a concurrent preparation makes), then creates the Draft. The opaque ref is
  `gen_random_uuid()` server-side; mode and label come from `public_world_private.derive_account_public_display_v1` — the
  ONE S5-01 derivation. Two concurrent first authorings: one identity (C00). The raw `ensure_public_identity_v1` stays
  executable by no application role.
- **Rendering.** PSEUDONYM = the CURRENT Public ID, REAL_NAME = the CURRENT Name, through the controller review; a Name,
  Public ID or mode change re-renders through the S5-01 bridge (I02 / I04).
- **64 → 80.** `public_identity_display_label_check` and `public_identity_commands_answer_label_check` move to 80;
  `ensure_public_identity_v1` / `update_public_display_label_v1` are forward-replaced from `0121` with only `> 64` → `> 80`;
  the S5-01 bridge likewise. A full 80-character Name round-trips byte for byte to the review (I04; and the re-anchored
  `0142` verifier). The account Name limit (`0123`: 1–80) is unchanged; nothing is truncated.
- **`E2E-H-08` — CLOSED (S5-02)**: Account Public ID / Name choice → the ONE I-05 Public Identity → the Public Experience
  authorship / review rendering, with no stale label and no second identity system.

## 7. Authoring boundary

- Sources (`list_own_public_authoring_sources_v1`): the reader's OWN committed Personal `USER` text (Personal QANDEEL
  analysis has no resolvable authority and is not offered) and, for each Shared World they currently belong to, the text
  material the ONE `0089` resolver lets them see, still `AVAILABLE`, of a packageable kind, with RESOLVED authority. No
  other human's Personal material, no World they are not in, nothing hidden is enumerable. **Selection is not source
  access**: the frozen `0119` preparation re-proves every source under its own locks.
- Preparation supplies only the chosen sources and opaque ids derived from the command id; the frozen primitive derives
  every body, classification, ordinal, provenance, authority and rightsholder. A hidden, foreign or absent source is ONE
  non-enumerating `UNAVAILABLE`; Voice and Personal QANDEEL analysis are `NOT_PUBLISHABLE` (no `PUBLIC_VOICE` is
  fabricated; no Replay).
- There is no free-text composer anywhere (§9; the mobile test proves no text field is drawn).

## 8. Rights / approval model consumed

- The required set is the frozen derivation's (union of the exact included material's human authorities). A Shared
  member who is not a rightsholder, a stranger and the controller-for-another's-item are all `UNAVAILABLE` and record
  nothing (R06). An approver sees only the exact included items for which they are a required approver — their words, or
  QANDEEL output over which they hold the exact publication authority — plus the publisher's public display and counts
  (R05); never another rightsholder's items, another approver, sealed provenance or hidden context. The approval is
  authority over those displayed items only, not an endorsement of the rest of the Experience (R1, G17).
- Approval binds the exact manifest, the CURRENT authority fingerprint and `PUBLISH_TO_PUBLIC_WORLD` (frozen `0093`).
- Withdrawal is the frozen `0094` append-only event: effective immediately (R07); a withdrawn approval is never
  resurrected (the `0092` one-approval-per-manifest key; `ALREADY_DECIDED`); proceeding needs a new package.
- **The frozen READY gap, closed at the boundary.** `commit_public_experience_ready_for_review_v1` counts approval rows
  and ignores withdrawals — the verifier proves the raw primitive would accept a withdrawn approval (R07). The S5-02 READY
  takes the canonical Public prefix (the singleton, then the Experience — the same two locks a withdrawal takes first),
  requires every required approval `EFFECTIVE` and bound to the current fingerprint, then calls the frozen commit. The
  raw primitive stays unreachable.
- Control never substitutes for content approval, and approval never grants control (R06 / R09).

## 9. Mobile Product surface

The Public root (S5-01) gains ONE entry, only after ALLOW. The workspace is drawn in place of the (still empty) field
and left by its own Back: Drafts and approval requests → choose existing material → review → own approval / withdraw →
"ready for review". A package that is no longer whole is one explicit line. No state says "published"; no Experience is
placed in the field (S5-03). Hardware Back is not registered (the S5-01 rule for the Public root).

## 10. Publication stays impossible

Asserted at deploy (`0143` E1 / E2) and by the verifier (B06 / B07 / L01–L03): no application role executes
`publish_public_experience_v1`, the seam, or any frozen primitive; nothing S5-02 owns names the publish boundary, the
seam, `PUBLISHED`, placement, discussion or Public QANDEEL; the seam answers `NOT_EVALUATED` for a real READY Experience;
READY_FOR_REVIEW is `NOT_PUBLICLY_VISIBLE` and served to nobody; no PUBLISHED Experience is produced. CW2-08 stays
fail-closed; signed-out stays `UNRESOLVED` and unreached.

## 11. Privacy / security invariants (Task Contract §21) — where each is proven

| Invariant | Proof |
|---|---|
| DRAFT / READY do not widen audience | L02; the frozen visibility derivation |
| no hidden-source navigation, no sealed provenance out | B07, R04 column ban, the review / request outputs; the API decoders |
| no caller-chosen identity / approver / body / audience | B03 (input census), API spec bodies |
| no hidden context reaches Public content | R01 / R02 (non-enumerating sources and preparation) |
| no contact endpoint / Shared ID in Public identity | the `0091` structural checks (unchanged); provisioning derives only mode + label |
| deleted owner content not recoverable / not confirmable | P02 / P03 (whole-database census), P07 (one-way), P08 (retry), R01 (reconciliation) |
| stale authority / availability fail closed | R08, P06, the `0093` derivation |
| withdrawal respected | R07 |
| control ≠ content approval, both ways | R06 / R09 |
| another World / package unaffected | P05 |
| signed-out fail-closed | I05 (anon 42501) |
| CW2-08 fail-closed | B10 / L01 |

## 12. Product Copy Gate — **OPEN (rows PROPOSED for the Product Owner)**

Census: every S5-02 user-visible string is in `apps/mobile/src/public-authoring/copy.ts`.

| Key | Class | العربية | English |
|---|---|---|---|
| qandeel | CANON (I-08A4 §8–§9, via the Shared module) | قنديل | QANDEEL |
| sharedWorld | CANON (G1.2 §3) | العالم المشترك | Shared World |
| back / retry / actionUnavailable / you | REUSED (S4-01 gate) | رجوع / إعادة المحاولة / تعذّر ذلك الآن. / أنت | Back / Try again / That couldn't be done right now. / You |
| shownAs | REUSED (S5-01 gate) | الظهور في العالم العام | Shown in Public World as |
| entry | **PROPOSED** | مشاركة تجربة في العالم العام | Share an experience in Public World |
| workspaceTitle | **PROPOSED** | مسوداتك في العالم العام | Your Public World drafts |
| draftsHeading | **PROPOSED** | المسودات | Drafts |
| noDrafts | **PROPOSED** | لا توجد مسودات بعد. | No drafts yet. |
| startDraft | **PROPOSED** (R1 wording) | بدء مسودة من محتوى موجود | Start a draft from existing content |
| draftState | **PROPOSED** (R1 wording) | مسودة. لم تُنشر بعد. | Draft. Not published yet. |
| readyState | **PROPOSED** (R1 wording) | جاهزة للمراجعة. لم تُنشر بعد. | Ready for review. Not published yet. |
| chooseHeading | **PROPOSED** | اختر ما سيصبح عامًا | Choose what would become public |
| chooseHint | **PROPOSED** | من كلامك في قنديل، ومما تراه في عوالمك المشتركة. حتى 20 عنصرًا. | From your words in QANDEEL and what you can see in your Shared Worlds. Up to 20 items. |
| noSources | **PROPOSED** (R1 wording) | لا يوجد محتوى يمكنك مشاركته بعد. | There is no content you can share yet. |
| review | **PROPOSED** | مراجعة ما سيصبح عامًا | Review what would become public |
| reviewHeading | **PROPOSED** | ما سيصبح عامًا | What would become public |
| analysisItem | **PROPOSED** | تحليل قنديل | QANDEEL analysis |
| approvals | **PROPOSED** | الموافقات: {0} من {1} | Approvals: {0} of {1} |
| waiting | **PROPOSED** (R1 wording) | بانتظار الموافقات المطلوبة. | Waiting for the required approvals. |
| approveShown (replaces `approveOwn`) | **PROPOSED** (R1 wording) | أوافق على أن يصبح المحتوى المعروض هنا عامًا | I approve making the content shown here public |
| approvalScope (new, R1) | **PROPOSED** (R1 wording) | موافقتك تخص المحتوى المعروض هنا فقط، ولا تعني موافقتك على باقي محتوى التجربة. | Your approval applies only to the content shown here; it does not approve the rest of the experience. |
| approved | **PROPOSED** | موافقتك مسجّلة. | Your agreement is recorded. |
| withdraw | **PROPOSED** | سحب موافقتي | Withdraw my agreement |
| withdrawn | **PROPOSED** | سُحبت موافقتك. | Your agreement was withdrawn. |
| markReady | **PROPOSED** | تجهيز للمراجعة | Mark ready for review |
| approvalsIncomplete | **PROPOSED** | لا تزال موافقات مطلوبة. | Approvals are still needed. |
| notPublishable | **PROPOSED** | لا يمكن مشاركة هذا في العالم العام. | This can't be shared in Public World. |
| noLongerAvailable | **PROPOSED** | لم تعد هذه المسودة متاحة كما أُعدّت. | This draft is no longer available as it was prepared. |
| requestsHeading | **PROPOSED** (R1 wording) | طلبات تحتاج موافقتك | Requests needing your approval |
| requestFrom | **PROPOSED** | طلب من {0} | Requested by {0} |
| approvalContent (replaces `yourWords`) | **PROPOSED** (R1 wording) | المحتوى الذي يحتاج موافقتك | Content requiring your approval |

27 rows PROPOSED, in the ONE S5-02 Product Copy Gate (no second gate). R1 revised nine rows to the independent review's
wording and added `approvalScope`, drawn beside every approve action; "No one else can see it" is removed everywhere,
because it is Product-false once a rightsholder inspects their bounded approval content. The PR is not Product-complete
until the Product Owner decides them.

## 13. Backlog reconciliation (BG-05 / BG-08)

- **Inherited:** `QAN-BL-CW-01` (owner `S5-02`), and two Product Owner assignments that are not backlog items: closing
  `E2E-H-08`, and the 64 → 80 reconciliation.
- **`QAN-BL-CW-01` — `CLOSED — TOMBSTONE`** (from this PR's merge). Evidence, all real PostgreSQL 17 (§15): erasure of the
  body and both verifiers (P02); no verifier anywhere (P03 census); controller review dark and never partial, the frozen
  resolver dark, every outward surface dark (P06); already-unsafe rows reconciled and contradictory state refused
  (reconciliation R01 / R02); delete-vs-prepare races safe and deadlock-free (C01–C03); ordinary immutability intact and
  the transition one-way (P07); MATERIAL_DEPENDENCY closure targets erased whatever their label, REASONING_DEPENDENCY and
  unrelated outputs kept (G01–G10, R03, P05; R1); no new widening (B01–B10).
- **`E2E-H-08` — CLOSED** (§6). **64 → 80 — DONE** (§6).
- **`QAN-BL-ACCT-01` — unchanged: `HIGH`, `OPEN — UNASSIGNED`.** S5-02 makes it more important and does not solve it: the
  first authoring act creates an I-05 Public Identity (`ON DELETE RESTRICT` to the account) and packages whose sealed
  provenance references the author's Personal units (`RESTRICT`), so the governed Personal erasure (`0130`) truthfully
  answers BLOCKED for an author. **The Public World is NOT production-launch-ready while it is unresolved; CW2-08 stays
  closed.** Current-truth note added.
- **Admitted: none.** Every residue is classified in §14.

## 14. Stage-5 Gap Matrix (S5-02)

| # | Gap / observation | Class | Owner / disposition |
|---|---|---|---|
| G01 | F05: Public DRAFT bytes survive owner deletion | 1 fixed here | `QAN-BL-CW-01` tombstoned |
| G02 | F05: two digests survive as verifiers | 1 fixed here | §4.2 |
| G03 | the frozen review resolver serves a silently partial package after erasure | 1 fixed here | §4.5 |
| G04 | resurrection by owner INSERT of an erased body | 1 fixed here | `0143` A.4b |
| G05 | the frozen READY commit ignores withdrawals | 1 fixed here (boundary) | §8; raw primitive unreachable |
| G06 | `E2E-H-08` | 1 fixed here | closed |
| G07 | 64-char label vs 80-char Name | 1 fixed here | §6 |
| G08 | S5-01 locators still "Draft PR / NOT MERGED" | 1 fixed here (governance reconciliation) | Current State, Project Map, S5-01 record banner |
| G09 | an author's Personal account deletion becomes BLOCKED (RESTRICT chains) | 3 existing item | `QAN-BL-ACCT-01` (unchanged; note added) |
| G10 | final `PUBLISHED`, semantic interpretation / correction / placement | 4 assigned | S5-03 |
| G11 | Public Activity / Push for approval requests | 4 assigned | S5-04 (Task Contract §13) |
| G12 | Public Voice derivative / media boundary | 3 existing item | `QAN-BL-VOICE-01` / Stage 8 |
| G13 | Replay authoring / publication; Replay's own captured digests of Shared sources | 4 assigned | Stage 7 (consumes I-06 `0100`–`0107`, whose source-availability semantics are I-06's) |
| G14 | CW2-08 Launch / Safety / entitlement; signed-out policy | 3 existing owner | `I-09` / `CW2-08` (frozen contract), unchanged |
| G15 | a READY_FOR_REVIEW Experience whose approval is later withdrawn cannot return to DRAFT | 5 not an obligation now | frozen I-05A: no transition out of READY; publication revalidation (`0095`) refuses it — S5-03 owns what a publisher sees there |
| G16 | an `ANALYTICAL_DERIVATIVE` copy of a Shared QANDEEL output that MATERIAL_DEPENDS on deleted human text kept its bytes | 1 fixed here (R1, A — Product / Privacy) | §4.4: Public erasure follows the Shared `MATERIAL_DEPENDENCY` closure; `REASONING_DEPENDENCY` does not propagate |
| G17 | the approver's view described as "their own words" | 1 fixed here (R1) | privacy boundary approved by independent review; wording corrected to "the exact content requiring this human's approval" in code, record and copy (§8, §12) |
| G18 | Export My Data does not include the Public authoring footprint | 3 existing owner | `E2E-D-16` (world-scoped export categories `NOT YET INCLUDED`) — observe / report only |
| G19 | storage-level reclamation of erased tuples | 5 not an obligation | the database's own VACUUM, the `0090` standard |
| G20 | the S5-02 Product Copy Gate | 1 current-task gate | §12 — Product Owner decision before merge (BG-01) |

**Orphan gaps = 0** — every row has class 1–5 and a named owner or disposition.

## 15. Validation

Local real PostgreSQL: PostgreSQL **17.10** (the CI major), started in the session scratchpad from the
`@embedded-postgres/windows-x64@17.10.0-beta.17` binaries already present in the local npm cache (installed offline), on
`localhost` only — never the hosted `.env` database. Migrations applied from zero with the Supabase-compatible bootstrap
(each file as one batch; no migration uses a psql meta-command).

| Check | Result |
|---|---|
| `0143` applies; its deploy-time self-assertions pass | PASS |
| `database/verify-migration-0143.mjs` (boundary, identity, rights, privacy + census, reconciliation, launch, concurrency) | PASS |
| every database verifier API CI runs, in CI order, on a from-zero database with `0143` | 138 PASS; `0133` C (needs `psql`); `0130` C (flake, §16) |
| re-anchored `0092`, `0098`, `0142` verifiers | PASS |
| database static (`database/tests`) | 1304 / 1304 |
| root contracts (`tests/*.test.mjs`, with the ignored `apps/mobile/android` moved aside) | all pass after the S5-01 re-anchors (§16) |
| API Jest (full) | 5103 / 5103 |
| API focused (`src/public-world`, the route census) | PASS |
| mobile `tsc --noEmit` | PASS |
| mobile Jest focused (`src/public-authoring`, `src/public-world`) | PASS |
| mobile Jest (full) | see the PR / completion report |
| API CI, Mobile CI, S5 proof (`ar-s501-journey-a`, `ar-s502-journey-b`) | on the PR |
| **R1:** `verify-migration-0143.mjs` with the new `material vs reasoning` stage (G01–G10) and R03, on a fresh from-zero database | PASS |
| **R1:** the neighbouring verifiers `0089`, `0090`, `0092`, `0093`, `0094`, `0098`, `0115`, `0118`, `0119`, `0122`, `0139`, `0142` | PASS |
| **R1:** directly affected static / API / mobile tests | see §18 |

## 16. Failure classification (A Product / Security · B Validation / Proof · C Infrastructure)

| # | Where | Class | Disposition |
|---|---|---|---|
| F01 | my own `0143` design: an owner `INSERT` could restore an erased body | A | fixed: `BEFORE INSERT` guard (G04) |
| F02 | frozen READY commit ignores withdrawals | A (pre-existing, made reachable by S5-02) | fixed at the boundary (G05) |
| F03 | `verify-0142`: a 70-char Name expected REFUSED | B | re-anchored to the PO's 80 decision (still: never truncated) |
| F04 | `verify-0092`: digest columns pinned NOT NULL | B | re-anchored (nullable only in the erased state) |
| F05 | `verify-0098` CE09: the whole package byte-identical after deletion | B | re-anchored: identity identical, only the deleted bytes and their two digests gone |
| F06 | S5-01 contract 4: word ban over every `public-world/` API file | B | re-anchored to S5-01's own four files |
| F07 | S5-01 contract 7: S5-01 banner and `QAN-BL-CW-01` row | B | re-anchored to the merged / tombstoned truth |
| F08 | `0143` verifier: Name without Login ID; a sealed read under `authenticated`; teardown of a Personal fixture | B | verifier fixed |
| F09 | mobile tests: unsupported API, mount settle, an unawaited `cleanup`, a duplicated text | B | tests fixed |
| F10 | `verify-0133` locally | C | it shells out to `psql`, absent here; CI has it |
| F11 | `verify-0130` locally: `days <= 7` | C | reproduced on the base database WITHOUT `0143` (database vs Node clock skew on Windows); no change |
| F12 | independent review R1: a `MATERIAL_DEPENDENCY` closure target's Public copy survived because it was labelled analytical (G16) | A — Product / Privacy | fixed in `0143` (§4.4); proven G01–G10, R03 |
| F13 | independent review R1: "their own words" and "No one else can see it" were semantically / Product false (G17) | A — Product copy | wording corrected; copy rows revised, gate stays OPEN |

## 17. Remaining Stage-5 ownership

- **S5-03 — Public Experience + Semantic World:** semantic interpretation, publisher correction, placement, the final
  `READY_FOR_REVIEW → PUBLISHED` path behind CW2-08, the Public field's Experiences.
- **S5-04 — Discussion + Public QANDEEL + Final Public Integration:** discussion, Public QANDEEL, Public Activity / Push
  (approval-request attention included).
- Launch: `CW2-08` / `I-09`; `QAN-BL-ACCT-01` stays a Public / Connected-World launch blocker.

## 18. R1 — the independent review correction

Applied on the same PR on top of `d9152fee25ad5e954097a1c33f8eb3a88478f8b9` (API CI #922 green at that head):

- **G16 (A).** `0143` part A: the erasure set is the deleted material plus its exact transitive `MATERIAL_DEPENDENCY`
  closure (never a `REASONING_DEPENDENCY` edge); the classification gate is gone from the erasure, the guard, the shape
  CHECK, the committed-answer retry proof and the reconciliation; the guard proves a closure target from canonical truth
  (its own `UNAVAILABLE` state, its body gone, and a `MATERIAL_DELETED` event at the exact instant naming a material
  upstream of it through `MATERIAL_DEPENDENCY` edges). Same owner-deletion transaction, same instant, one-way,
  non-resurrectable, unreachable as a raw primitive (B08 and the application-role refusals unchanged).
- **G17.** No behaviour change — the requests command already filters to the items whose required approvers include this
  human. Comments, record and copy now say "the exact content requiring this human's approval"; `approvalScope` is drawn
  beside every approve action.
- **Copy.** §12 — nine rows revised, one added, one gate, all PROPOSED.
- **Validation, proportional to the change.** The focused `0143` verifier and its neighbours on a fresh database; the S5-02
  static contract; the focused API and mobile tests. The S5-02 Android journey asserts test IDs, not copy, and its flow is
  unchanged, so it is not re-run beyond the normal CI run on push.
