# QANDEEL — S8A-05 Public World: «اكتب موضوعك» / Write Your Topic — Implementation Record v1

**Task:** S8A-05 — Public World (Stage 8A). This record covers **CP1 — Write Your Topic** (§1 – §10), **CP2 — Publish
from QANDEEL** (§11) and **CP3 — Public Semantic Intelligence & Deterministic Spatial Placement** (§12)
**Status:** `CP1 MERGED THROUGH PR #359 AS 7c0356b7 (2026-10-26) — CP2 MERGED THROUGH PR #360 AS 72898797 (2026-10-27) — CP3
DELIVERED ON ITS DRAFT PULL REQUEST — AT THE S8A-05 CP3 REVIEW GATE — NO NEW COPY — TIER S / TIER P RUN ONCE: NOT ACCEPTED
— CP3 NOT MERGED / NOT DEPLOYED / PRODUCTION PUBLISHING CLOSED / CLOSED TO USERS` (§12). S8A-05 is not closed: CP4
has not started. CP2's status as written at its review: `CP1 MERGED THROUGH PR #359 AS 7c0356b7 (2026-10-26) — CP2 DELIVERED ON ITS DRAFT PULL REQUEST — AT THE S8A-05 CP2
REVIEW GATE — CP2 COPY GATE CLOSED / APPROVED (37 rows, Product Owner, 2026-10-27) — CP2 NOT MERGED / NOT DEPLOYED / PRODUCTION PUBLISHING CLOSED (freeze seam
NOT_EVALUATED; CW2-08 untouched) / CLOSED TO USERS`. S8A-05 is not closed: CP3 – CP4 have not started, and BG-08 / BG-09
are reconciled at S8A-05's last checkpoint, not here. CP1's status as written at its review: `CP1 DELIVERED — R2 REVIEW CORRECTIONS APPLIED — AT THE S8A-05 CP1 FINAL REVIEW GATE — COPY GATE CLOSED (every row
APPROVED by the Product Owner, 2026-10-26) — NOT MERGED / NOT DEPLOYED / PRODUCTION PUBLISHING CLOSED (freeze seam NOT_EVALUATED; CW2-08 untouched) / CLOSED TO USERS`. S8A-05 is not
closed: CP2 – CP4 have not started, and BG-08 / BG-09 are reconciled at S8A-05's last checkpoint, not here  
**Date:** 2026-10-26 (CP1); 2026-10-27 (CP2, §11; CP3, §12)  
**Branch / base:** `s8a/s8a-05-cp1` from `main` at `9459245e10bb763eaa0fc20bdfeb1acd27c90bc8`, the merge of PR #358
(S8A-04, merged 2026-10-26)  
**Authority:** the Product Owner's *S8A-05 CP1 order* (2026-10-26), which approves the S8A-05 WP1 design with its WP1-R1
corrections as the implementation basis; the candidate
[S8A-05 Public Authored Topics Controlled Amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLIC_AUTHORED_TOPICS_CONTROLLED_AMENDMENT_v1.0.md)
(A-1, A-2), which binds from this pull request's merge. The WP0 / WP1 / WP1-R1 research reports were delivered to the
Product Owner outside the repository.

Merging, deploying, opening any publication gate, opening Public discussion, starting CP2 and any paid model call each
need the Product Owner's explicit approval. None is done here. No DeepSeek or other paid API was called. Synthetic data only.

---

## 1. What CP1 delivers

| PO CP1 scope item | Delivered | Where |
| --- | --- | --- |
| 1. Private account-bound draft: save, edit, retrieve, delete | Yes | 0179 §A.2, §D.1 – §D.5; API `public/compose/drafts*`; mobile list / editor |
| 2. Editor: title, text, section | Yes | `PublicComposeWorkspace` (13 section choices, counters) |
| 3. Preview of what the public sees, with a privacy warning | Yes | 0179 §D.6 (public form, publisher display, deterministic notes); mobile preview |
| 4. Source `PUBLIC_AUTHORED` | Yes | 0179 §B (A-2(a)) |
| 5. Linked to the existing Package / Experience | Yes | 0179 §C.7: the 0119 preparation sequence for one authored item; no parallel posts system |
| 6. A section change does not change the semantic location | Yes | 0179 §A.5, §D.8; verifier F03 / F04 |
| 7. Human title instead of `meaning` in map, search and panel | Yes | 0179 §E; API field / search / panel merge; mobile `publicEntryLabel` |
| 8. Cancel preparation and return to the draft, erasing unpublished content (R1-03) | Yes | 0179 §B.3 – §B.4, §D.4 (A-2(c)); verifier F05 / F06 |
| 9. Identity, rights, deletion limits and account deletion preserved | Yes | no identity before freeze (D06); drafts `ACCOUNT_CASCADE` (B06, S02); I-05A derivation extended, not bypassed |
| 10. Export of private drafts | Yes | 0179 §G: Export My Data gains `publicTopicDrafts` (D07) |

The freeze (prepare for publication) is implemented and **closed in production**: its seam answers `NOT_EVALUATED` in every
environment, so no Public Identity is created and nothing reaches `READY_FOR_REVIEW` outside the controlled verifier. The
mobile client shows the honest outcome (`PUBLICATION_NOT_OPEN` → the Product Owner's «النشر في العالم العام مش متاح حاليًا.
مسودتك محفوظة.», whose second sentence appears only while the account has confirmed the draft shown, §6).

### 1.1 R2 — the Product Owner's review corrections (2026-10-26, same pull request)

| PO correction | Done | Where |
| --- | --- | --- |
| 1. The API CI failure (`introduction-lifecycle-progressive-disclosure-v1.test.mjs`) caused by a new focused group | Yes | `database/focused-verifiers.json` is back to `main` byte for byte; CI selects 0179 by the generic `migration-0179` selector. No historical contract is touched |
| 2. Autosave; no text lost on an abrupt exit; an honest «saved» | Yes | `public-compose-controller.ts`: a save 1.2 s after typing rests; one save out at a time, the next at the confirmed revision (never STALE against itself); unsaved words saved at once on Back, on closing the workspace, on retiring the Public area and on leaving the foreground (the runtime's one `ForegroundSignal`); `isDraftSaved` drives «حُفظت المسودة.» / «مسودتك محفوظة.», shown only after the account confirmed exactly the words shown; a failed save says so and keeps the words |
| 3a. The section view (WP1 §2.5) | Yes | One control in the top band («كل الأقسام ▾», on its own row under the search); the list in the chrome band; topics outside the section recede at every rung (nothing moves, nothing leaves the field, a FAR tap ignores them); search inside the section with «في: …» and ✕; up to three topics of the section nearest the centre, by distance alone; Back closes the list first and releases the section last; every entry starts from every section. The camera glide toward a section (optional in WP1) is not implemented |
| 3b. Search inside the body | Yes | The 0145 search already reads `public_experience_text_derivative_bodies`, which holds the authored body, so the field search finds a published topic's body (proved in the 0179 verifier F04). New viewer read `read_public_section_topic_matches_v1` searches title, meaning, themes and public text inside one section |
| 3c. Human titles in relations management | Yes | The relations read merges the title of each own and other topic through the same `read_public_topic_headers_v1`; the strict mobile client accepts exactly one more key, a non-empty `title`; `PublicRelations` names every topic by `publicEntryLabel` |
| 4. The Copy Gate as an Arabic / English table, nothing APPROVED without approval | Yes | §6; the Product Owner's decision of 2026-10-26 is recorded there |

### 1.2 R3 — the API CI correction (2026-10-26, same pull request)

On `1b93de38`, `verify-api` failed in `verify-migration-0150.mjs`, the two GUARD scenarios. The topic freeze reaches the
frozen authoring cores' `40001` refusals (the guard records the start's `ensure_public_identity_v1` path), and its
one block handler caught only `QC179` and `23505`, so a `40001` could reach the Data API, where PostgREST before v16
re-runs the whole request without bound. The Product Owner ordered the narrowest fix:

- `0179` §D.7: the block handler also catches `40001` and `PT409`, answering the same bounded `NOT_PREPARED`. The
  block is a subtransaction, so every write it made (identity, Experience, package, title, section) is rolled back
  with it, exactly as for `QC179`; nothing is committed inside a function, so no failure after a commit is hidden. In
  production the block is unreachable anyway: the clearance seam answers `PUBLICATION_NOT_OPEN` first.
- `verify-migration-0150.mjs`: `freeze_own_topic_draft_v1` is added to `ABSORBED` with a dated comment. `RETAINED`
  and every assertion are unchanged.

Proof (local PostgreSQL 17 with 0179): `verify-migration-0150` passes 28 of 28, including the five weakening
guards g1 – g5. The repository's own guard reports the freeze as reaching a `40001` raise with nothing retryable
escaping, absorbed by the handler `WHEN QC179 OR 23505 OR 40001 OR PT409`. Negative control: with only that handler
line reverted, the same verifier fails exactly the two GUARD scenarios CI failed (26 of 28). `verify-migration-0179`
and `npm run test:database` (1,310 of 1,310) pass.

## 2. Database — migration `0179_s8a_05_public_authored_topics_v1.sql`

Forward-only; 0001 – 0178 byte-unchanged; not hosted (the next migration is `0180`).

- **Schema `public_compose_private`** (not exposed through the Data API; RLS on every relation, no policy, postgres-owned):
  `sections` (12 + `open`, keys stable, names are client copy), `topic_drafts` (title ≤ 100, body ≤ 5,000, optional
  section, compare-and-set revision, the Experience it was prepared as; `user_id → public.users ON DELETE CASCADE`, a
  technical bound of 50 drafts per person), `version_titles` (one title per Experience Version, erasable one-way),
  `experience_sections` + append-only `experience_section_events`, `discard_commands` (the discard proof).
- **The fourth source class `PUBLIC_AUTHORED`** (A-2(a)): provenance CHECKs re-added with it;
  `derive_public_publication_authority_v1` forward-replaced with one more digest check, one more approver branch (the
  author, who is the manifest's publisher) and one more source-scope token.
- **The fifth lifecycle mover** `public.discard_never_published_public_experience_v1` (A-2(c)): `DRAFT | READY_FOR_REVIEW
  → ABSENT_FROM_PUBLIC_WORLD` for a never-published, all-authored topic, with its immutable event under the command
  identity and the one-way erasure of every public body, both digests, the title and (by the 0144 trigger) derived
  semantic text. The 0092 / 0143 package guard is forward-replaced with exactly this second exception, proven by the
  discard command at the same instant.
- **Owner commands** (the human from `auth.uid()` only; ten wrappers, `SECURITY INVOKER` → definer): list / read / save /
  delete drafts, preview, freeze, discard, change section; **viewer reads**: `read_public_topic_headers_v1` (title of
  exactly the visible version + section, ≤ 400 served ids), `read_public_topic_title_matches_v1` (≤ 20, through the one
  0145 visibility predicate) and, from R2, `read_public_section_topic_matches_v1` (≤ 20, one section; title, meaning,
  themes and the public text of the visible version, through the same predicate).
- **Preview privacy notes** are deterministic (no model, nothing stored) and never block: a phone-like number, an email
  address, a link, the account's own Name while publishing under a Public ID, and appearing under the real Name.
- **Export My Data** (0168 body re-stated) gains one section, `publicTopicDrafts`.

## 3. API (NestJS, `apps/api/src/public-world/`)

- New `PublicComposeController` (`public/compose`), `PublicComposeService` (strict body validation; outcome allowlists;
  `TOPIC_SECTIONS`, `TOPIC_TITLE_MIN = 8`, `TOPIC_TITLE_MAX = 100`, `TOPIC_TEXT_MAX = 5000`) and `PublicComposeRepository`
  (the eight owner wrappers through the Data API under the caller's token).
- Routes, each in the route census: `GET drafts`, `GET drafts/:draftId`, `PUT drafts/:draftId`, `POST
  drafts/:draftId/delete`, `GET drafts/:draftId/preview`, `POST drafts/:draftId/prepare` (`SECURITY_SENSITIVE`), `POST
  topics/:experienceId/discard`, `POST topics/:experienceId/section` (the others `AUTHENTICATED`).
- The field, search and panel reads (`PublicFieldService`) merge the human title and section from the two new viewer reads
  (strictly validated: only the ids asked, only known sections, a non-empty title). Search lists title matches first, then
  meaning matches, deduplicated, at most 20. The 0145 reads are unchanged. R2: `GET /public/field/search` accepts exactly
  `q` or `q` + `section` (a known section, else 400) and then answers inside that section only; the relations read
  (`PublicRelationService`) merges the human title of each own and other topic.

## 4. Mobile (`apps/mobile/src/`)

- `runtime-entry/public-compose-api.ts` — the strict transport client; `public-world-api.ts` composes it as `compose`. The
  runtime-entry barrel adds the topic types and exactly four values (`PUBLIC_TOPIC_SECTIONS`, `PUBLIC_TOPIC_TEXT_MAX`,
  `PUBLIC_TOPIC_TITLE_MAX`, `publicEntryLabel`), recorded in its scope census; consumers import only through the barrel.
- `public-compose/` — `copy.ts` (§6), `public-compose-controller.ts` (screens LIST / EDIT / PREVIEW, one command id per
  act until a definite answer, STALE reloads, save before preview and on Back, discard = «العودة إلى المسودة», delete with
  confirmation; R2: autosave and `isDraftSaved`, §1.1), `PublicComposeWorkspace.tsx` (R2: the save state under the editor).
- `public-world/field/` — R2: the section view (§1.1): `public-field-controller.ts` (`section` state, `openSections` /
  `chooseSection` / `closeSections`, Back order), `public-field-projection.ts` (outside the section → `RECEDED`),
  `public-field-camera.ts` (`nearestOf`), `PublicLivingAnalysis.tsx` (the control, the list, the search scope, the nearby
  topics), `PublicFieldView.tsx`.
- `public-authoring/PublicRelations.tsx` and `runtime-entry/public-relation-api.ts` — R2: relations named by title.
- `public-world/` — the heading's «موضوع جديد» entry (`qandeel-public-compose-entry`), the workspace drawn over the area,
  `compose.retire()` with the area.
- `runtime-entry/public-field-api.ts` — `title?` / `section?` on a field entry (present only when served);
  `publicEntryLabel(entry) = entry.title ?? entry.meaning`, used by the map labels, search results, the panel heading (plus
  a section line), the nearby list and the relation-line label.

## 5. Acceptance tests (the PO's CP1 list)

| PO acceptance test | Evidence | Result |
| --- | --- | --- |
| Draft restored from another session of the same account | verifier S01 (a second connection, same account) | PASS |
| No cross-user access | verifier D03 (every command, and the relation itself) | PASS |
| Deleting a draft erases its content | verifier D08, F06 (content census) | PASS |
| Cancelling leaves no texts, fingerprints or private references | verifier F05 / F06 (bodies, both digests, title, semantic text; census empty) | PASS |
| No Public Identity is created by drafting | verifier D06 | PASS |
| Drafts do not block account deletion | verifier B06, S02 (account deleted by its row alone) | PASS |
| The human title is displayed | verifier F04; API `public-compose.spec.ts` (field / search / panel); mobile `public-compose.test.tsx` | PASS |
| The section does not change the location | verifier F03 (place, interpretation, version, revision unchanged), F04 (after publication too) | PASS |
| The preview equals the prepared content | verifier F01 (byte for byte, and its digest) | PASS (controlled) |
| The production publish path stays closed | verifier B07, B08, D05, L01 – L03; freeze seam restored byte for byte | PASS |
| Frozen contracts and existing tests intact | §7 | PASS, with the recorded baseline exceptions |
| Arabic / RTL visual check | §8 | see §8 |

## 6. Copy Gate — S8A-05 CP1 Product Copy Gate: `CLOSED` — every row `APPROVED` (Product Owner, 2026-10-26)

The Product Owner approved every new CP1 row in Arabic and English and the 13 section names on 2026-10-26, with four
edits in the Owner's own Arabic (★ below). The English of those rows was adjusted to match, as the Owner asked. The Owner's
publishing-unavailable text «النشر في العالم العام مش متاح حاليًا. مسودتك محفوظة.» is carried as two rows, `notOpen` and
`draftKept`, because the Owner's condition is that «مسودتك محفوظة» appears **only after the save is confirmed**: the
mobile client adds `draftKept` only while `isDraftSaved` holds (the account confirmed exactly the words shown, nothing
typed since, no save out or failed). Without that confirmation the notice is `notOpen` alone. The same rule governs
`saved`, which is now a save state under the editor, not a one-time notice. The ★ rows use the Owner's colloquial,
second-person wording verbatim («بيك», «هيقدر»), which departs from the gender-considerate rule the other fixed rows follow;
this is recorded, not changed.

Reused, already approved rows: `save` (S7-02), `back`, `retry`, `actionUnavailable` (S4-01), and the publisher display
heading reused through `publicAuthoringCopy().shownAs` (S5-01 Product Copy Gate). Status lives on each row in
`apps/mobile/src/public-compose/copy.ts` (`status` for Arabic, `enStatus` for English); nothing is approved by being
shipped.

| Key | Arabic (APPROVED) | English (APPROVED) |
| --- | --- | --- |
| entry | موضوع جديد | New topic |
| draftsHeading | مسوداتي | My drafts |
| noDrafts | لا توجد مسودات بعد. | No drafts yet. |
| newDraft | كتابة موضوع جديد | Write a new topic |
| untitled | بلا عنوان | Untitled |
| privateNote ★ | مسوداتك خاصة بيك، ومش ظاهرة لأي حد تاني. | Your drafts are private. No one else can see them. |
| titleLabel | العنوان | Title |
| titleHint | من 8 إلى 100 حرف | 8 to 100 characters |
| textLabel | النص | Text |
| textCount | {0} من 5000 | {0} of 5,000 |
| sectionLabel | القسم | Section |
| saved | حُفظت المسودة. | The draft was saved. |
| stale | تغيّرت هذه المسودة من مكان آخر، فأُعيد تحميلها. | This draft changed somewhere else, so it was reloaded. |
| limitReached | بلغت المسودات الحد الأقصى (50). | The draft limit (50) has been reached. |
| deletionPending | الحساب قيد الحذف. | The account is being deleted. |
| invalid | تعذّر حفظ هذا النص كما هو. | This text couldn't be saved as it is. |
| preview | معاينة | Preview |
| previewHeading ★ | معاينة الموضوع قبل النشر | Preview the topic before publishing |
| publicWarning ★ | عند نشر الموضوع، هيقدر الآخرون يقرؤوا عنوانه ونصه. | Once the topic is published, others will be able to read its title and text. |
| privacyHeading | قبل النشر | Before publishing |
| noteContactNumber | يبدو أن النص يحتوي على رقم هاتف. | The text seems to contain a phone number. |
| noteEmailAddress | يبدو أن النص يحتوي على بريد إلكتروني. | The text seems to contain an email address. |
| noteLink | النص يحتوي على رابط. | The text contains a link. |
| noteOwnName | يبدو أن النص يحتوي على اسم صاحب الحساب. | The text seems to contain the account holder's name. |
| noteRealName | سيظهر الموضوع بالاسم الحقيقي. | The topic would appear under the real name. |
| titleTooShort | يحتاج العنوان إلى 8 أحرف على الأقل. | The title needs at least 8 characters. |
| textRequired | نص الموضوع مطلوب. | The topic needs its text. |
| sectionRequired | اختيار القسم مطلوب. | A section needs to be chosen. |
| prepare | تجهيز للنشر | Prepare for publishing |
| notOpen ★ | النشر في العالم العام مش متاح حاليًا. | Publishing in Public World isn't available right now. |
| draftKept ★ | مسودتك محفوظة. | Your draft is saved. |
| preparedState | مُجهّز للنشر، ولم يُنشر بعد | Prepared for publishing, not published yet |
| backToDraft | العودة إلى المسودة | Back to the draft |
| backToDraftNote | تُمحى النسخة المجهّزة، وتبقى المسودة. | The prepared copy is erased; the draft stays. |
| delete | حذف المسودة | Delete draft |
| deleteConfirm | حذف نهائي | Delete permanently |
| deleteNote | يُمحى العنوان والنص نهائيًا. | The title and text are erased permanently. |
| deleted | حُذفت المسودة. | The draft was deleted. |

Section names (WP1 §2.2, APPROVED): love الحب والارتباط · marriage الزواج والطلاق · family الأهل والعائلة · parenting
الأبناء والتربية · people الأصدقاء والناس · work_money العمل والمال · study_future الدراسة والمستقبل · inner_self النفس
والمشاعر · health_body الصحة والجسد · loss_crisis الفقد والأزمات · faith_meaning الإيمان والمعنى · life_changes الغربة
والتحولات · open حكايات مفتوحة (English: Love and relationships · Marriage and divorce · Parents and family · Children and
parenting · Friends and people · Work and money · Study and the future · The self and feelings · Health and the body · Loss
and crises · Faith and meaning · Living abroad and big changes · Open stories).

**R2 rows — `APPROVED` unchanged by the Product Owner (2026-10-26).** The review corrections (§1.1) added nine rows
after the decision above: the draft's save state, and the reader's view of one section. They were presented as
`PROPOSED`, and the Product Owner approved all nine in Arabic and English without edits, with the R3 CI correction.
No row is `PROPOSED` now, so the gate is closed. No row names a lens, a rank, a count or a popularity.

| Key | Arabic (APPROVED) | English (APPROVED) | Where it appears |
| --- | --- | --- | --- |
| saving | جارٍ حفظ المسودة… | Saving the draft… | while a save is out |
| saveFailed | تعذّر حفظ المسودة الآن، وما كُتب ما زال هنا. | The draft couldn't be saved right now. What was written is still here. | a save got no answer; the words stay on screen |
| allSections | كل الأقسام | All sections | the section control by default, and the first choice of the list |
| sectionsHeading | الأقسام | Sections | the heading of the list of sections |
| sectionShown | القسم المعروض: {0} | Section shown: {0} | the section control's spoken name |
| inSection | في: {0} | In: {0} | beside a search that runs inside one section |
| showAllSections | إظهار كل الأقسام | Show all sections | the ✕ that searches every section again |
| sectionNear | من هذا القسم، قريبًا من هنا | From this section, near here | above the (at most three) topics of the section nearest the centre |
| sectionNoneHere | لا توجد مواضيع من هذا القسم هنا. | No topics from this section here. | when the section has no topic in the field |

## 7. Verification (all run locally on 2026-10-26; CI results are read on the pull request)

**Real PostgreSQL 17 (local harness, fresh database per verifier).** The new `database/verify-migration-0179.mjs` passes:
boundary B01 – B10, the second-session restore S01 / S02, private drafts D01 – D08, and — inside one transaction that it
rolls back, with the freeze seam replaced by a probe and restored byte for byte — the controlled path F01 – F08 and L01 –
L03 (the CW2-08 seam simulated only there). R2 adds to F04: before publication nothing is found; after it the 0145 field
search finds a word that appears only in the body, the section search finds it (and the title) inside the topic's section
and nothing in another, a stranger finds it too, invalid input answers `22023`, `anon` is refused (`42501`), and the
section view follows a section change. CI selects 0179 through the generic `migration-0179` selector; the R1 focused group
`s8a-05-cp1` was removed (§1.1). At R1 a 23-verifier local run passed 22; `0130` failed
on one millisecond-scale assertion ("grace period", 7.0000000347 against 7) caused by clock skew between PostgreSQL
`clock_timestamp()` and Node `Date.now()` on the Windows harness. It fails identically on the `main` state without 0179
(`SPLIT=0180`), so it is a harness flake, not caused by this change; CI runs it on Linux.

Re-anchored verifiers (validation only, each with a dated comment): `0121` (five lifecycle movers), `0143` B08 (two
destroyers), `0153` and `0168` (the live Export My Data builder is the 0179 re-statement; it equals the 0168 body plus the
one marked `publicTopicDrafts` section). On the final R2 tree `0179`, `0121`, `0143`, `0153` and `0168` were run again
locally and pass. `npm run test:database` (the repository's database contracts, including the focused-verifier ownership
contracts that the R1 group broke in CI): 1,310 of 1,310 passed.

**API.** Full jest on the final R2 tree: 294 suites passed, 7,009 tests passed (1 skipped); `nest build` and `tsc` clean. New
`public-compose.spec.ts` (service validation and outcomes, title merge in field / search / panel, R2 search inside one
section, the static boundary and the route census). Re-anchored: `public-field.spec.ts` (the viewer RPC list gains the
three topic reads), `public-relation.spec.ts` (its field mock gains them; R2: the relations read merges titles).

**Mobile.** `tsc` clean; `eslint` 0 errors. New `public-compose.test.tsx` (18 tests; R2: the save state and the Product
Owner's Copy Gate), R2 `public-compose-autosave.test.ts` (6: debounce, SAVING / FAILED, a save during a save, close,
retire, leaving the foreground), R2 `public-field-section.test.tsx` (12: projection, controller, surface in Arabic and
English) and R2 tests in `public-relations.test.tsx` (2: strict titles, titles in the workspace). Re-anchored: `s5-01-public-world.test.tsx` (the heading's
buttons now include `qandeel-public-compose-entry`, and from R2 `qandeel-public-section-control`) and the runtime-entry
`scope.test.ts` census (the four values above), and the proof-world stand-in guard `s8a-05-proof-compose.test.ts` (new, 3
tests). Full jest on the final R2 tree: 233 of 235 suites and 2,953 of 2,959 tests passed. The failures in `depth.test` and
`w2-account-access` (6 tests) occur identically on the S8A-04 baseline `3987f6a1` (= the tree of `main` `9459245e`) and are
not caused by this change.

**Root contracts.** `node --test tests/*.test.mjs` on the final R2 tree: 1,639 of 1,639 passed (an intermediate R2 run
caught two frozen S5-03B #13 anchors — a `maxHeight` on the section list and the one-line `placePublicField({ camera,
envelope,` call — both fixed in the code, the contract unchanged). `npm run test:task-closure-governance-contract`: 24 of 24 passed.

## 8. Arabic / RTL visual check

Run on 2026-10-26 on the Android emulator `QANDEEL_API36` (x86_64, Arabic device language), from a validation-only
release build of this branch: the S4-01 proof root, selected by `select-s401-proof-entry.mjs --apply` and restored after
the build (APK sha256 `c3543904ed5b502a8fb792814d137e728fb43295c5b07002210bb6187c249a9f`). Every module the reader
sees is the shipped one; only the network is the in-memory proof world. The new link
`qandeel://s401-proof/public/topics` turns on the SYNTHETIC stand-in `integration/__validation__/s805-proof-compose.ts`:
one saved draft (title «كيف تعلّمت أن أطلب المساعدة», section `inner_self`), a preview, preparation answering
`PUBLICATION_NOT_OPEN`, and human titles on four fixture Experiences of the S5-03B field. Before that link every
earlier proof leg meets the proof world exactly as before. The stand-in is guarded by
`integration/__tests__/s8a-05-proof-compose.test.ts` (2 tests): what it answers is what the production strict client
accepts.

Seen, right to left, with Arabic shaping intact and no clipped text:

- The map labels show the human titles. The legacy topics keep their meaning.
- A stepped-in cluster's marks carry the titles.
- The panel heading is the title, with its section line.
- The heading shows «موضوع جديد» beside the existing authoring entry.
- The drafts list shows the private-drafts note and the saved draft.
- The editor shows the title and text with their counters and the 13 section choices.
- The preview shows the public form, the publisher display and the privacy warning.
- Preparing shows the notice that publishing is not open, and the draft is unchanged afterwards.

Two defects were found on the device and fixed in this change:

1. The list repeated the screen's «مسوداتي» heading.
2. Android kept the loading view's `busy` accessibility state on the list. The loading view and the list are now keyed apart.

Both fixes were re-checked on a rebuilt APK, with one heading and no busy state on the list.

The evidence stays untracked, in `.s8a-05-device-proof/` of the main checkout:

- `00-launch-ar` … `10-list-after-ar` (the first build);
- `05b-drafts-list-fixed-ar` (the rebuild).

TalkBack was not run. Typing Arabic through `adb` is not possible, so the editor was checked with the seeded Arabic
draft. No physical device was used.

**R2 device check (2026-10-26, same emulator, rebuilt validation-only APK sha256
`f0ebb707666d674277c93ca718d8cd242f7f9bc04bfad54d0f99b3475c7d6eb9`).** Seen in Arabic, right to left:

- «كل الأقسام ▾» on its own row at the start, under the search.
- The list of sections in the chrome band, in catalogue order.
- «الأهل والعائلة» chosen: the control names it, and «من هذا القسم، قريبًا من هنا» lists «حين خفت أن أخذل أهلي» by
  its title.
- A search opened inside the section shows «في: الأهل والعائلة ✕».
- Back closes the search, and the next Back releases the section.
- In the editor, one keystroke (a synthetic Latin `x`) was saved by itself, without pressing Save: «حُفظت المسودة.»
  appeared under the section choices.
- The preview carries the Owner's «معاينة الموضوع قبل النشر» and «عند نشر الموضوع، هيقدر الآخرون يقرؤوا عنوانه
  ونصه.», and the drafts note is the Owner's «مسوداتك خاصة بيك، ومش ظاهرة لأي حد تاني.».
- Preparing shows the Owner's whole text «النشر في العالم العام مش متاح حاليًا. مسودتك محفوظة.».

One defect was found and fixed in this change: the first R2 build put the section control beside the search, which
cut the search placeholder short («…أو شعور أو»); the control now has its own row and the placeholder reads whole
again (compare `02-field-titled-ar`). The software-rendered emulator raised one "isn't responding" dialog while the
world was first drawn (answered with Wait), as in earlier Public device checks. Evidence: `r2-01` … `r2-10` in
`.s8a-05-device-proof/`. TalkBack was not run.

## 9. Deliberately not implemented in CP1

- No production publishing, no Public Identity before the gates, no CW2-08 change, no Public discussion or commenting.
- No topic from a QANDEEL conversation, no long-conversation path, and no discard of a topic that holds non-authored
  items (CP2).
- No Public semantic / spatial binding: placement at publication is CP3's. A placement committed through the unchanged
  S5-03B path before a discard would leave its integer coordinates (no text); production cannot reach that before Stage 9.
- No revision of a published topic and no edit note (CP4).
- No mobile control to change the section of a prepared topic: the command exists in the database and the API only.
- No camera glide toward a chosen section (optional in WP1 §2.5); the field stays where the reader left it.
- Sections are never separate pages or tabs; no section count, rank or popularity.
- A legacy topic without a human title keeps showing its `meaning`.
- Compare-and-set revisions and command identities are used instead of a separate command ledger.
- No Replay, no Voice, no paid model call, no DeepSeek.

## 10. Backlog (BG-05 at kickoff)

S8A-05 owns no backlog item at kickoff. CP1 admits, tombstones and re-owns nothing. Observed and left as they stand:
`QAN-BL-PRIV-05` (Export My Data across worlds — CP1 adds the reader's own drafts as `publicTopicDrafts`; the item stays
with its owner), `QAN-BL-ACCT-01` and `QAN-BL-PROD-09` (`topic_drafts` is `ACCOUNT_CASCADE`, registered in the
account-deletion coverage census; a prepared topic exists only after the closed gate opens and then follows the Public
residue owner, `ACCT-DEL-02`).

---

## 11. S8A-05 CP2 — Publish from QANDEEL

**Checkpoint:** `S8A-05 CP2 — «انشر من قنديل» / Publish from QANDEEL — DELIVERED ON ITS DRAFT PULL REQUEST — AT THE PRODUCT
OWNER'S CP2 REVIEW — CANDIDATE CONTROLLED AMENDMENT A-3 + A-2(c) NARROWING — MIGRATION 0180 NOT HOSTED — COPY GATE CLOSED /
APPROVED (37 rows, 2026-10-27) — PRODUCTION PUBLISHING CLOSED — NOT MERGED`. S8A-05 is not closed: CP3 and CP4 have not started, and
BG-08 / BG-09 are reconciled at S8A-05's last checkpoint, not here  
**Date:** 2026-10-27  
**Branch / base:** `s8a/s8a-05-cp2` from `main` at `7c0356b7`, the merge of PR #359 (S8A-05 CP1, merged 2026-10-26)  
**Authority:** the Product Owner's *S8A-05 CP2 order* (2026-10-27), which applies the WP1 design with its WP1-R1
corrections; the candidate
[S8A-05 Publish from QANDEEL Controlled Amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLISH_FROM_QANDEEL_CONTROLLED_AMENDMENT_v1.0.md)
(A-3 verbatim from WP1-R1 §6.3, and the WP1-R1 §8 narrowing of CP1's A-2(c)), which binds from this pull request's merge.
The CP1 amendment (A-1, A-2) is effective since the merge of PR #359.

Merging, deploying, opening any publication gate, opening Public discussion, starting CP3 and any paid model call each
need the Product Owner's explicit approval. None is done here. No DeepSeek or other paid API was called. Synthetic data
only.

### 11.1 What CP2 delivers

| PO CP2 order item | Delivered | Where |
| --- | --- | --- |
| 1. A whole conversation, a contiguous range, separate whole messages, emphasized messages | Yes | 0180 §A.1, §B.4, §G; mobile `public-share/` (selection by message, «المحادثة كاملة»), emphasis in the preview |
| 2. Speakers shown clearly: the person by their public name, QANDEEL as «قنديل» | Yes | `PublicTopicItems` (author = the publisher display label; «صاحب الموضوع» only when the topic shows none) |
| 3. QANDEEL's original replies, or the shown «فهم قنديل» summary | Yes | 0180 §B.3 – §B.4; `POST /understanding/items/:ref/public-topic`; the Understanding detail's share action |
| 4. A faithful preview, privacy warnings, preparation through the existing Experience / Package / Manifest | Yes | 0180 §E.6 (one projection for preview and freeze), §F.1 (warnings read every item), §C (the 0179 freeze forward-replaced) |
| 5. Long conversations paged, nothing dropped silently | Yes | pages of 50 everywhere (draft preview, sealed topic, reader panel); the envelope refuses before any write |
| 4.1 Reuse `ConversationSelection` (S7-02) and `resolve_personal_range_v1` (0169) | Yes | the S7-02 anchor proof and the `ConversationSurface` selection seam; 0180 §B.5 |
| 4.2 A reference-only source; the server trusts no text, speaker, order or owner; re-resolved at preparation | Yes | 0180 §A.1, §B.4 – §B.5, re-checked in the freeze under its own locks |
| 4.3 A-3 exactly as WP1-R1 §6.3 | Yes | amendment §3.2 (verbatim), §3.3 (how) |
| 5 Bounded search document 8 KB; interpreter input 24 KB (CP3); `@qandeel` context 6 KB (CP4) | Yes | 0180 §A.3, §G (executable by no application role; nothing calls a model) |
| Performance gate (< 3 s at the envelope, local PG17) | Yes | §11.5 |
| 6 Freeze atomic and closed in production; discard erases every class | Yes | 0180 §C, §D; verifier `0180` |
| 7 Two mobile entries, CP1 drafts reused, RTL and accessibility, Copy Gate PROPOSED | Yes (the gate then CLOSED / APPROVED, 2026-10-27) | §11.4, §11.9 |

### 11.2 Database — migration `0180_s8a_05_publish_from_qandeel_v1.sql` (not hosted; the next is `0181`)

Forward-only; migrations 0001 – 0179 are byte-unchanged. A new schema `public_compose_source_private` (not exposed through
the Data API; RLS on with no policy; postgres-owned) holds two relations — `item_presentation` (the sealed display order:
display position, role, true Session Position, message, emphasis, gap; no text) and `version_search_documents` (one
bounded document per sourced version) — both append-only behind rejecting triggers. The CP1 draft gains the source
specification columns (references only) and the acknowledgement bound to one draft revision.

**Security classification of every new or forward-replaced function** (each pinned by `database/verify-migration-0180.mjs`
B01 – B07):

| Function | Class | Executable by |
| --- | --- | --- |
| `public.set_own_topic_conversation_source_v1`, `public.set_own_topic_understanding_source_v1`, `public.clear_own_topic_source_v1`, `public.acknowledge_own_topic_source_v1` | `SECURITY INVOKER` wrapper, one-line call into its definer (VOLATILE) | `authenticated` |
| `public.read_own_topic_source_v1`, `public.read_own_topic_items_v1`, `public.read_public_topic_items_v1` | `SECURITY INVOKER` wrapper (STABLE) | `authenticated` |
| the seven definers behind them in `public_compose_source_private` | `SECURITY DEFINER`, `search_path = ''`, owner derived from `auth.uid()` (never a parameter) | no application role (reached only through the wrappers) |
| `envelope_units_v1`, `envelope_bytes_v1`, `page_size_v1`, `search_document_bytes_v1`, `interpreter_input_bytes_v1`, `qandeel_context_bytes_v1`, `bounded_text_v1`, `understanding_state_v1`, `draft_source_items_v1`, `draft_source_outcome_v1`, `sourced_readiness_v1`, `prepare_sourced_package_v1`, `bounded_package_input_v1`, `interpreter_input_v1`, `qandeel_context_v1`, the two rejecting triggers | internal | no application role; `service_role` holds nothing in the schema |
| forward-replaced: `public.derive_public_publication_authority_v1` (I-05A: `MY_WORLD` items, an Understanding item's own sealed body), `public.reject_publication_package_mutation_v1` (the discard's erasure exception), `public.discard_never_published_public_experience_v1` (A-2(c) narrowed), `public_compose_private.freeze_own_topic_draft_v1`, `public_compose_private.preview_own_topic_draft_v1`, `public_spatial_private.search_public_semantic_field_v1`, `public_compose_private.read_public_section_topic_matches_v1`, `personal_data_private.build_personal_export_v1` | unchanged class and grants of the replaced function | unchanged |

Deploy-time self-assertions (0180 §K) fail the migration if the freeze seam stops answering `NOT_EVALUATED` first, if a
sixth Public lifecycle mover appears, or if any CP2 relation or internal function becomes reachable by an application role.

**Re-anchored historical verifiers (validation only, each with a dated comment):** `0153` and `0168` (the live Export My
Data builder is the 0180 re-statement: the 0179 body plus exactly the one CP2 source reference), `0175` (its census of
body-reaching reads gains `read_public_topic_items_v1`, which reaches a body only through the canonical serving resolver,
like 0145 E.4), `0179` F08 (a never-published `MY_WORLD` topic is now `DISCARDED`, as A-2(c) is narrowed). `0150` (40001 / PT409 absorption) needs no change: the freeze is still the one ABSORBED entry, and
the CP2 commands reach no frozen 40001 core.

### 11.3 API (NestJS)

| Route | Module | Census class |
| --- | --- | --- |
| `GET /public/compose/drafts/:draftId/source` | public-world (compose) | `AUTHENTICATED` |
| `PUT /public/compose/drafts/:draftId/source/conversation` | public-world (compose) | `SECURITY_SENSITIVE` |
| `POST /public/compose/drafts/:draftId/source/clear` | public-world (compose) | `AUTHENTICATED` |
| `POST /public/compose/drafts/:draftId/source/acknowledge` | public-world (compose) | `AUTHENTICATED` |
| `GET /public/compose/drafts/:draftId/items?page=` | public-world (compose) | `AUTHENTICATED` |
| `POST /understanding/items/:ref/public-topic` | understanding | `SECURITY_SENSITIVE` |
| `GET /public/compose/topics/:experienceId/items?page=` | public-world (compose controller, field service; a viewer read — the frozen S5-03B field controller keeps its three routes) | `AUTHENTICATED` |

Every call runs on the caller's own token; the server holds no channel of its own. The Understanding item is named by its
opaque ref and resolved only inside the Understanding module (a hypothesis id never leaves the API); a revision that is not
the item's current version answers 409. The field panel now reads page 1 of `read_public_topic_items_v1` (replacing the
unbounded 0145 content read) and states `contentPages`; further pages have their own route. A reader's items carry no
Session Position (§11.6).

### 11.4 Mobile

- **From the conversation:** «شارك في العالم العام» in the Personal row (beside the Introductions entry) opens the S7-02
  selection seam over the conversation's own messages: the reader toggles whole messages, or chooses «المحادثة كاملة».
  The choice is proven with the S7-02 anchor proof and sent as two ends, the whole messages left out inside them and
  whether QANDEEL's replies are in. A private draft is created and opened in Public World, through the same Public entry
  verdict. One selection at a time: opening it cancels a Replay selection and the reverse.
- **From «فهم قنديل»:** the item's detail offers the same action only while its summary is shown and not under review; it
  sends the opaque ref at the exact revision shown. A changed item asks the reader to open it again; nothing opens.
- **The draft** (the CP1 editor, reused): it names its material and can remove it while keeping its words; the text
  becomes optional once the topic has material.
- **The preview** pages the exact items, 50 a page, with the author's public name, «قنديل» or the fixed Understanding
  label, the emphasis bar, «…» where messages were left out, an emphasis toggle on each whole message while the draft can
  change, the privacy warnings, and the ONE acknowledgement whenever QANDEEL material is present (asked again after any
  change of revision).
- **The reader's panel** (`PublicTopicContent`) pages a served topic the same way, reading a later page only when asked
  and reading the shown page again on every new panel read; content without sealed speakers is drawn exactly as before.
  It lives in its own file, so the frozen S5-03B #13 anchors of `PublicLivingAnalysis.tsx` are unchanged.
- Layout is logical (start / end), Arabic first; every control is at least 44 × 44 with its accessible name; the gap has
  its own spoken label and an emphasized message is announced as such.

### 11.5 Performance gate (binding; local PostgreSQL 17, synthetic data only)

Measured on local PostgreSQL 17.10 (Windows) with production durability (`fsync`, `synchronous_commit` and
`full_page_writes` on; `shared_buffers` 128 MB, `work_mem` 4 MB by default), on synthetic data only: one Personal
conversation of **10,000 committed units** (5,000 messages, USER / ASSISTANT alternating) of 830 bytes each —
**8,300,000 bytes**, at the envelope (10,000 units / 8 MiB = 8,388,608 bytes). The draft takes the whole conversation
with QANDEEL's replies and every tenth message emphasized. The freeze runs through the real public wrapper
`public.freeze_own_topic_draft_v1`; only the freeze clearance seam is opened inside the measured transaction and closed
again before it ends (production keeps it `NOT_EVALUATED`). Seeding is not timed. Harness: a scratch script, not in
the repository.

**Final result (after the last 0180 change), five consecutive committed runs:**

| Run | Freeze (whole wrapper) | Commit | Discard + commit | After discard (bodies / pointers / digests / documents) |
| --- | --- | --- | --- | --- |
| 1 (cold, right after the database was built) | 2,816 ms | 8 ms | 1,545 + 4 ms | 0 / 0 / 0 / 0 |
| 2 | 2,359 ms | 14 ms | 1,422 + 1 ms | 0 / 0 / 0 / 0 |
| 3 | 2,335 ms | 3 ms | 1,425 + 3 ms | 0 / 0 / 0 / 0 |
| 4 | 2,320 ms | 1 ms | 1,387 + 4 ms | 0 / 0 / 0 / 0 |
| 5 | 2,376 ms | 2 ms | 1,405 + 4 ms | 0 / 0 / 0 / 0 |

- **Gate: under 3 s — PASS in every run** (median 2,359 ms, maximum 2,816 ms). The Public World singleton is held for the
  freeze plus its commit, and for nothing else.
- **Every run's package is exact.** It has 10,000 items, all distinct, with `item_ordinal` = display position. The
  source positions rise strictly with no loss or duplicate, and the bytes total 8,300,000. There are 5,000
  `ANALYTICAL_DERIVATIVE` items (QANDEEL's replies) and 1,000 emphasized. Every public body equals its committed text.
- **Two plan findings, both fixed inside 0180's own new functions (no frozen function touched):**
  1. With the statistics of a near-empty package table, PostgreSQL planned every foreign-key check of the one
     preparation statement as a scan over the rows that statement had just written, which is quadratic at 10,000
     items (about 4.3 s). `prepare_sourced_package_v1` therefore pins `enable_seqscan = off`.
  2. The final measurement before the last change missed the gate in two of three runs (3,130, 3,129 and 2,844 ms).
     A per-function profile found where the time went: the projection's windows and sorts, and the preparation's
     materialized projection, carry every body (up to the 8 MB envelope). At the default 4 MB `work_mem` they spilled
     to disk. `draft_source_items_v1` and `prepare_sourced_package_v1` now pin `work_mem = '32MB'` (per plan node;
     the envelope bounds the data), and the projection's two calls fell from about 420 ms to about 146 ms.

  Both settings are asserted by the 0180 verifier (B01).
- **Beyond the envelope:** a 10,001-unit or 8 MiB + 1 byte selection is refused `TOO_LARGE` before any write
  (verifier), and the reader is asked to choose a smaller part.

### 11.6 Privacy, erasure and findings

- **No conversation position is public.** The owner's read keeps `sessionPosition` (to emphasize a message); the public
  read `read_public_topic_items_v1` never emits it, and both clients refuse it on a reader's page (verifier F08; mobile
  `public-topic-source-api.test.ts`).
- **Discard erases every class** at one instant: bodies, both digests, the personal source pointers, the version's title,
  the sealed presentation rows and the bounded search document (verifier F09). The author's draft keeps its
  reference only.
- **There is no conversation-deletion feature today.** A source becomes unavailable only through account deletion (the
  drafts cascade with the account) or through a range that no longer resolves; either way preview and freeze refuse
  `SOURCE_UNAVAILABLE` and nothing is written.
- **Shared QANDEEL output** stays unpublishable (S09): CP2 adds no path that can name Shared material at all; the verifier
  models Shared output in the shape the frozen I-04G core records it (an additional human requirement left unresolved),
  not through a Shared-World runtime fixture.
- **Not exercised with two live sessions:** a freeze racing a source change. The source commands serialize on the draft
  (proven: the second answers `STALE`), and the freeze re-resolves the source under its own locks; the race itself is
  argued from those locks, not run.
- **Two historical contracts caught two placements, and the code moved, not the contracts.** The first full root run
  failed exactly two contracts (and, through the mirror, the forward-safety copies of the same two):
  - S5-03B #6 pins the field controller to its three routes. The reader's page route had been added there, so it moved
    to the CP2 compose controller as `GET /public/compose/topics/:experienceId/items`. It is the same viewer read on the
    same field service, and the S5-03B controller is byte-identical to `main`.
  - W3-MEGA-U1 forbids a `number` field in the Understanding Product types. The source command's answer
    (`draftRevision`) is a draft's answer, so it moved beside the drafts in `public-compose.service.ts`, and
    `understanding.types.ts` is byte-identical to `main`.

  No historical test was edited or weakened.

### 11.7 Verification

Every result below was read from its own exit code and full log, locally on Windows with Node 24 and PostgreSQL 17.10.
The suites ran one at a time. GitHub CI on the pull request's head is the binding run.

| Gate | Result |
| --- | --- |
| Root contracts (`node --test tests/*.test.mjs`, mirror and forward-safety included) | **1,639 / 1,639 pass**, exit 0, on the final tree. The first run failed 2 contracts (and their 10 mirror copies); see §11.6 for the fixes in code. |
| Database static contracts (`npm run test:database`) | **1,310 / 1,310 pass**, exit 0 |
| Task-closure governance (`npm run test:task-closure-governance-contract`) | **24 / 24 pass**, exit 0 |
| API (`npm run test:api`) | **294 suites, 7,019 pass, 1 skipped**, exit 0. After the route and type moves, the affected public-world, understanding and http-security suites passed again: 12 suites, 287 / 287. `tsc --noEmit` is clean. |
| Mobile | The full run before the final changes: 2,995 of 3,001 pass. The 6 failures (`depth.test`, `w2-account-access`, locale) fail identically on `main` and are not CP2's. After the final changes, the affected suites (public-compose, public-share, understanding, public-world, runtime-entry, W3-MEGA-U) passed again in Arabic and English: **35 suites, 555 / 555**, exit 0. `tsc --noEmit` is clean. |
| PG17 verifiers on a database built from zero (final 0180) | **0180, 0179, 0175, 0153, 0168, 0150, 0121, 0143, 0135 — all pass** (exit 0) |
| 0135 | **Passes.** Its earlier local failure was the environment: the verifier builds `apps/api/dist` itself by spawning `npm.cmd` without a shell, which Node 24 on Windows refuses (`spawnSync npm.cmd EINVAL`, reproduced on its own). With `npm run build:api` first, as API CI does, it passes. The verifier is unchanged from `main`. |
| 0130 | **Fails locally, and is not CP2's.** It fails at the same assertion (`available for a limited period (7 days)`) on a copy of the database built only up to 0179, without 0180. That assertion compares a database timestamp with the client clock, and this machine and its server run in `Africa/Cairo`. Nothing in 0130 was changed. |
| Performance gate | §11.5: under 3 s in 5 / 5 runs |

The local Supabase-compatible harness builds a fresh database from every migration, from 0001. It is a scratch tool and not in
the repository.

### 11.8 Arabic / RTL visual check

**Not performed in CP2.** No device or emulator run was made for this checkpoint. A faithful device check of both
entries would need a new proof-world stand-in for the source routes and the paged items, built on the S7-04 proof
world. That is new harness scope, so it was not added here. The Arabic-first, right-to-left layout and the accessible
names are covered by the Arabic and English component tests listed in §11.7 (logical start / end, every control at least
44 × 44, the gap's own spoken label, an emphasized message announced as such). They are rendered in the test renderer,
not on a device. A device visual check stays open for the Product Owner's review of this pull request; it is not claimed.

### 11.9 Copy Gate — S8A-05 CP2 Product Copy Gate: `CLOSED / APPROVED` (Product Owner, 2026-10-27)

**Closed by the Product Owner on 2026-10-27.** The Product Owner approved all 37 new CP2 rows exactly as presented, in
Arabic and in English, with no edit, and kept the two reused rows as approved before: `shareWhole` (G1.1 / S7-05 D2)
and `shareCancel` (S4-01). Three Arabic rows (★) are the Product Owner's own words from the CP2 order, verbatim. The
Product Owner restated the language rule: QANDEEL's interface speaks simplified, neutral Modern Standard Arabic, and
QANDEEL's conversations follow the user's dialect. No CP1 row is reopened or changed
(`apps/mobile/src/public-compose/copy.ts` is unchanged in wording), and the approved rows are not to be reworded.
Status lives on each row in `apps/mobile/src/public-compose/source-copy.ts` (`status` for Arabic, `enStatus` for
English, the decision named in `source`), and `public-compose-source.test.tsx` pins the gate CLOSED with 37 approved
rows and nothing proposed. Deliberately absent: any word saying the topic IS published, any QANDEEL-written summary, any score, evidence or
memory word, a count of readers, and any engineering term.

| Key | Arabic | English | Status |
| --- | --- | --- | --- |
| shareEntry ★ | شارك في العالم العام | Share in Public World | APPROVED (2026-10-27) |
| shareTitle | اختيار الرسائل التي يصير منها الموضوع | Choose the messages the topic is made from | APPROVED (2026-10-27) |
| shareHint | يُختار ما يُنشر رسالةً رسالة، كلامك وردود قنديل. | Choose what is shared message by message: your words and QANDEEL's replies. | APPROVED (2026-10-27) |
| shareWhole | المحادثة كاملة | The whole conversation | APPROVED (reused) |
| shareContinue | متابعة | Continue | APPROVED (2026-10-27) |
| shareCancel | إلغاء | Cancel | APPROVED (reused) |
| shareNothing | لم تُختر أي رسالة بعد. | No message is chosen yet. | APPROVED (2026-10-27) |
| shareUnprovable | تعذّر التأكد من رسائل هذه المحادثة الآن. | The messages of this conversation couldn't be confirmed right now. | APPROVED (2026-10-27) |
| understandingChanged | تغيّر هذا الفهم منذ عرضه. يُرجى فتحه من جديد. | This understanding changed since it was shown. Please open it again. | APPROVED (2026-10-27) |
| sourceHeading | مادة الموضوع | The topic's material | APPROVED (2026-10-27) |
| sourceConversation | من المحادثة مع قنديل | From the conversation with QANDEEL | APPROVED (2026-10-27) |
| sourceUnderstanding | من «فهم قنديل» | From «QANDEEL Understanding» | APPROVED (2026-10-27) |
| textOptional | النص اختياري حين تكون للموضوع مادة. | The text is optional when the topic has material. | APPROVED (2026-10-27) |
| clearSource | إزالة المادة | Remove the material | APPROVED (2026-10-27) |
| clearSourceNote | تبقى المسودة وما كُتب فيها. | The draft and what was written in it stay. | APPROVED (2026-10-27) |
| understandingLabel ★ | فهم قنديل — استنتاج غير مؤكد، ليس حقيقة | QANDEEL Understanding — an unconfirmed inference, not a fact | APPROVED (2026-10-27) |
| speakerQandeel | قنديل | QANDEEL | APPROVED (2026-10-27) |
| speakerAuthor | صاحب الموضوع | The topic's author | APPROVED (2026-10-27) |
| writtenLabel | النص المكتوب | Written text | APPROVED (2026-10-27) |
| gap | رسائل غير مضمّنة | Messages not included | APPROVED (2026-10-27) |
| emphasized | مُبرَز | Emphasized | APPROVED (2026-10-27) |
| emphasize | إبراز | Emphasize | APPROVED (2026-10-27) |
| unemphasize | إلغاء الإبراز | Remove emphasis | APPROVED (2026-10-27) |
| page | صفحة {0} من {1} | Page {0} of {1} | APPROVED (2026-10-27) |
| next | التالي | Next | APPROVED (2026-10-27) |
| previous | السابق | Previous | APPROVED (2026-10-27) |
| mentionWarning | قد يذكر هذا الكلام أشخاصًا آخرين أو يصفهم. | These words may mention or describe other people. | APPROVED (2026-10-27) |
| acknowledgement ★ | كلام قنديل قد يصف أشخاصًا آخرين؛ نشره قرارك | QANDEEL's words may describe other people; publishing them is your decision | APPROVED (2026-10-27) |
| acknowledge | أُقرّ بذلك | I acknowledge this | APPROVED (2026-10-27) |
| acknowledged | تمّ الإقرار. | Acknowledged. | APPROVED (2026-10-27) |
| sourceUnavailable | لم تعد مادة الموضوع متاحة. | The topic's material is no longer available. | APPROVED (2026-10-27) |
| notWholeMessages | يجب أن يبدأ الاختيار وينتهي برسالة كاملة. | The selection must start and end with a whole message. | APPROVED (2026-10-27) |
| selectionInvalid | تغيّر شيء في الاختيار؛ يُرجى الاختيار من جديد. | Something in the selection changed; please choose again. | APPROVED (2026-10-27) |
| nothingSelected | لم تُختر أي رسالة. | No message is chosen. | APPROVED (2026-10-27) |
| tooLarge | الاختيار أكبر من المسموح (10,000 جزء أو 8 ميغابايت). يُرجى اختيار جزء أصغر من المحادثة. | The selection is larger than allowed (10,000 parts or 8 MB). Please choose a smaller part of the conversation. | APPROVED (2026-10-27) |
| understandingChangedReady | تغيّر هذا الفهم منذ اختياره. | This understanding changed since it was chosen. | APPROVED (2026-10-27) |
| understandingUnderReview | هذا الفهم قيد المراجعة الآن. | This understanding is under review now. | APPROVED (2026-10-27) |
| understandingWithheld | هذا الفهم غير معروض الآن. | This understanding isn't shown now. | APPROVED (2026-10-27) |
| acknowledgementRequired | يلزم الإقرار قبل التجهيز للنشر. | The acknowledgement is needed before preparing. | APPROVED (2026-10-27) |

### 11.10 Deliberately not implemented in CP2

- No production publishing, no Public Identity before the gates, no CW2-08 change, no Public discussion.
- No Shared World or Replay source; no voice (Stage 8B).
- No excerpt inside a message (whole messages only, WP1-R1 §5.3 7).
- No interpreter run and no `@qandeel` context use: the bounded inputs are CP3's and CP4's.
- No revision of a published topic (CP4).
- The reader's panel pages with controls inside the existing scroll view rather than a virtualized `FlatList`
  (WP1-R1 §5.3 10): each page is at most 50 items, so nothing is unbounded, and a nested virtualized list inside the panel's
  scroll view is avoided.
- No paid model call, no DeepSeek.

### 11.11 Backlog (BG-05 for CP2)

CP2 admits, tombstones and re-owns nothing. Read and left as they stand: `QAN-BL-CW-05` (Shared QANDEEL output — still
unpublishable, outside A-3), `QAN-BL-PRIV-05` (Export My Data across worlds — CP2 prints each draft's source reference
under `publicTopicDrafts`), `QAN-BL-ACCT-01` / `QAN-BL-PROD-09` (the source columns live on `topic_drafts`, which is
`ACCOUNT_CASCADE`). `REPLAY-DIST-01` keeps Replay artifacts.

---

## 12. S8A-05 CP3 — Public Semantic Intelligence & Deterministic Spatial Placement

**Checkpoint:** `S8A-05 CP3 — DELIVERED ON ITS DRAFT PULL REQUEST — AT THE PRODUCT OWNER'S CP3 REVIEW — CANDIDATE CONTROLLED
AMENDMENT A-4 — MIGRATION 0181 NOT HOSTED — NO NEW COPY — TIER S / TIER P RUN ONCE: NOT ACCEPTED (FABRICATION 3 CONFIRMED BY
BOTH RATERS; THE DETERMINISTIC HALF MET) — PRODUCTION PUBLISHING CLOSED — NOT MERGED`. S8A-05 is not closed: CP4 has not
started, and BG-08 / BG-09 are reconciled at S8A-05's last checkpoint, not here  
**Date:** 2026-10-27  
**Branch / base:** `s8a/s8a-05-cp3` from `main` at `72898797b2e9596d4c9940fefeca6c987461108b`, the merge of PR #360 (S8A-05
CP2, merged 2026-10-27) — so the CP2 amendment (A-3 and the A-2(c) narrowing) is effective  
**Authority:** the Product Owner's *S8A-05 CP3 order* (2026-10-27), which applies the WP1 design with its binding WP1-R1
corrections; the candidate
[S8A-05 Public Semantic Placement Controlled Amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLIC_SEMANTIC_PLACEMENT_CONTROLLED_AMENDMENT_v1.0.md)
(A-4), which binds from this pull request's merge.

Merging, deploying, opening any publication gate, opening Public discussion, starting CP4 and any further paid model call
each need the Product Owner's explicit approval. None is done here. Every proof in §12.1 – §12.6 and §12.8 is free; the one paid
call set is the Tier S / Tier P run the Product Owner authorized (§12.7: 100 DeepSeek Flash calls, USD 0.0346). Synthetic
data only.

**Tier S / Tier P — RUN ONCE (2026-10-27) — NOT ACCEPTED.** Run on head `4e16b455` after GitHub CI passed on it, guard
round 25 (the Product Owner's ceiling: 100 attempts, USD 0.14): 100 attempts, every one HTTP 200, USD 0.0346 at peak. The
deterministic half is MET; the raters' half is NOT MET on fabrication (both raters independently found additions in S48,
S53 and S69; the criterion is 0). Nothing was re-tuned, re-run or relabelled.

### 12.1 Pre-implementation impact census

| Surface | Impact | Handling |
| --- | --- | --- |
| S5-03A (0144) interpretation contract | the placement intent becomes a closed region profile; the lens key becomes the dominant sub-region | V2 server commands beside the unchanged 0144 V1 commands; contract `PUBLIC_SEMANTIC_INTERPRETATION_V2`; a non-vocabulary lens key is never placed |
| S5-03B (0145) placement | the production place is the database's P-dom rule, not a provider | committed through the unchanged 0145 request / commit; the `PublicSpatialPlacer` port stays unbound and refusing; an earlier 0145 place is kept |
| Verifiers 0144 / 0145 / 0150 / 0175 / 0179 / 0180 | the new family, the new functions, the census of server commands | 0171 / 0174 / 0175 / 0176 re-anchored (each change marked RE-ANCHORED; no assertion weakened); the others pass unchanged |
| API (`apps/api/src/public-world/`) | interpreter port V2, the DeepSeek adapter, its composition, the repository's V2 RPCs, the publisher's attribution | §12.3 |
| Mobile / runtime-entry | none: the panel already shows the main and other themes; no region name is shown | NO NEW COPY (§12.6) |
| SQL classification and grants | 2 new `service_role` commands; every other new function executable by no application role | verifier 0181 B01 – B07 |
| Accounting / concurrency / retry | one family, one record per attempt; placement under the World singleton lock; a retried publication answers ALREADY_COMMITTED and never moves a place | verifier 0181 P05, K01 / K02; the AI-COST-01 contract |

### 12.2 Database — migration `0181_s8a_05_public_semantic_placement_v1.sql` (not hosted; the next is `0182`)

- **AI-COST-01:** the family `PUBLIC_SEMANTIC_INTERPRETATION` (the ledger CHECK now lists 14 families). The placement has
  no family.
- **`public_region_private`** (new private schema; `USAGE` for `service_role` only): `sub_regions` — the immutable
  vocabulary `QANDEEL_PUBLIC_REGIONS_V1` (46 rows: key, major, ordinal, lattice centre); `region_slots` — append-only, one
  row per assigned slot of the layout `public_region_dominant_v1`, the lattice point UNIQUE per layout (so no two places
  are closer than 8,000).
- **Internal derivations** (executable by no role): the profile rule and dominant sub-region, the spiral slot, the
  title-free 24 KB package text, the slot assignment.
- **Server channel** (`service_role`): `read_public_semantic_work_input_v2` (the same admissible work as 0144, served as one
  bounded text) and `record_public_semantic_work_outcome_v2` (the answer with its region profile; the database derives the
  dominant sub-region and records it as the 0144 lens key).
- **Publication-time placement:** `public_region_private.publish_public_experience_with_placement_v1`, executable by no
  role: under the World singleton lock it assigns the reviewed dominant sub-region's first free slot, commits it through
  the unchanged 0145 request and commit, and calls the unchanged 0121 publication in the same transaction. Publication is
  still closed (the CW2-08 seam answers `NOT_EVALUATED`), so production raises `55000` and the placement rolls back with it.
- Self-assertions G1 – G6 at the end of the migration (vocabulary size, grants, the one coordinate writer, no section,
  title, alias or popularity in any body).

### 12.3 API (NestJS, `apps/api/src/public-world/`)

- `public-semantic-regions.ts` — the vocabulary and centres (proved identical to the 0181 seed), the strict profile
  decoder, the dominant rule, the spiral and lattice mirror.
- `public-semantic-interpreter.ts` — contract V2: a `packageText` input and a region-profile placement intent, decoded
  strictly.
- `deepseek-public-semantic-interpreter.ts` — the DeepSeek Flash adapter: JSON Output, closed schemas (no coordinate, no
  unknown key, sub-region keys as an enum), the instructions of amendment §9, `escapeDeepSeekData` around the package, the
  configured timeout, `maxRetries: 0`, failures mapped to five bounded kinds; an invalid request never reaches the provider.
- `public-semantic-interpreter-provider(.config).ts` — the one composition: the test interpreter under `NODE_ENV=test`;
  otherwise DeepSeek Flash behind `SYNTHETIC_ONLY`, built on first use, through `accountedDeepSeekChatCompletionsClient`
  under `PUBLIC_SEMANTIC_INTERPRETATION`; 15 s (configurable 1 – 19 s, inside the service's 20 s), 1,024 output tokens, zero
  retries; no fallback and no synthetic answer.
- `public-semantic.service.ts` / `.controller.ts` / `.repository.ts` — the publisher's id is the attribution of every
  attempt (no id, no call); the repository calls the V2 commands.
- `public-spatial-placer.ts` — unchanged behaviour; its header records that CP3 places through the database.

### 12.4 Free proofs (no model)

- **Verifier 0181** (`npm run verify:public-semantic-placement:integration`, real PostgreSQL 17, rolled back): boundary
  B01 – B07; the family on the real ledger; geometry V01 – V04 (the vocabulary equals the API file; the nearest centres of
  different majors 1,068,747 apart; the SQL spiral equals the JS ring walk for slots 0 – 5,000 and 10¹²; the profile rule);
  the server channel I01 – I03 / R01 (V1 vs V2 text; `42501` for `authenticated`; invalid profiles `22023`; a second answer
  STALE with the first kept; the input equals 0180's minus the title line; a long topic cut to ≤ 24,576 bytes keeping the
  written and emphasized lines); placement P01 – P09 (a closed seam → `55000` and nothing placed; the first topic at its
  centre; a retry ALREADY_COMMITTED with no move; the next one lattice step away; a compound at its dominant centre over
  1 M from the other; a section that disagrees with the meaning has no effect; an older 0145 place kept with no slot; a
  non-vocabulary lens refused; append-only and the lattice point UNIQUE); capacity 500 / 2,000 / 5,000 topics in one
  sub-region (distinct points, contiguous slots, radius 328,028 at 5,000, spacing ≥ 8,000; 133 / 390 / 801 ms); concurrency
  K01 / K02 (a second connection waits on the singleton lock and never duplicates a slot).
- **Simulation** (`scripts/s8a-05/cp3/placement-sim.mjs`, results beside it; assumed interpreter errors, no model): on
  the TEST seeds, triplets 0.951 – 0.959 with the same result in another arrival order, major purity 0.952 – 0.964,
  sub-region purity about 0.876 (from the assumed 12 % sub-region error), every topic in its dominant sub-region, distant
  compounds in their dominant major 0.935 – 0.959; section, popularity and retry change nothing; minimum spacing 8,000;
  DEV and HOLDOUT2 agree.
- **Adapter and contract tests:** `deepseek-public-semantic-interpreter.spec.ts` (10), `public-semantic.spec.ts` (18, with
  the new rejection cases: a coordinate inside a region, an unknown or major-only key, weights that do not sum to 1, below
  0.1 or with three decimals, duplicates, more than three regions, a string weight, a stray lens key),
  `public-semantic-regions.spec.ts` (5), `accounted-provider-clients.spec.ts` (+1); the root contracts AI-COST-01 (the
  adapter's frozen blob, the family, the module) and S5-03A (the V2 server commands, the composition).

### 12.5 Privacy and AI-COST

- The interpreter's whole input is the exact public package as one text: no title, no section, no author or alias, no
  identifier, no Memory, no Personal or Shared knowledge, no unpublished text (amendment F-1).
- No real person's text reaches DeepSeek: the composition refuses outside `SYNTHETIC_ONLY` (`QAN-BL-AI-01` stays open).
- Every attempt is one `PUBLIC_SEMANTIC_INTERPRETATION` ledger record paid by the publisher who asked, with no session,
  turn, World or Shared message; a failed attempt is still one record; there is no retry to leave unaccounted. Nothing
  logs a package, an answer or a key.

### 12.6 Copy Gate — S8A-05 CP3: `NO NEW COPY`

CP3 adds no user-visible string. Evidence: no file under `apps/mobile/` changes (`git diff --stat origin/main -- apps/mobile`
is empty); no locale file changes; the panel's existing main and other themes carry the secondary meanings; region keys and
names are never rendered (amendment F-5). The CP1 / CP2 copy is unchanged. No row is proposed, so nothing awaits approval.

### 12.7 Tier S / Tier P — the paid quality evaluation: `RUN ONCE — NOT ACCEPTED`

Prepared in `scripts/s8a-05/cp3/`: `AUTHOR_BRIEF.md` and the independently authored `tier-s-cases.json` (80 packages, 20
corrections, 40 triplets, 10 compounds; reviewed blind before freezing), `PREREGISTRATION.md`, `RATER_RUBRIC.md`,
`tier-s-eval.ts`, `tier-s-score.mjs`, `tier-s-simulated.cjs`, `budget.ts` and `launch.mjs`.

**Authorization.** The Product Owner's Tier S/P decision (2026-10-27): ONE run on DeepSeek Flash, synthetic data only, the
preregistered cases and criteria, at most 100 attempts and USD 0.14, no automatic retry; the authorization committed
(`4e16b455`, the round 25 lock lifted at exactly that ceiling) and GitHub CI green on that head before the first call.

**The run** (`launch.mjs --live`, head `4e16b455`, a clean tree): 100 attempts (80 proposals, 20 assessments), every one
HTTP 200 and `finish_reason` stop, model `deepseek-flash`, thinking disabled; 218,962 input tokens (175,616 cache hits,
43,346 misses), 17,117 output tokens (median 202, at most 246 of 1,024); latency median 2.2 s, p90 2.5 s, at most 3.2 s;
**USD 0.0346** at the peak rate (the whole run fell in the peak window; budget expected 0.034, ceiling 0.14). The ledger is
sound: 100 `PUBLIC_SEMANTIC_INTERPRETATION` records, all paid by the synthetic publisher, nothing Shared.

**Deterministic half — MET**

| Criterion | Result | Accept |
| --- | --- | --- |
| Major | **78 / 80** (S30 invalid, S39) | ≥ 72 |
| Sub-region | **76 / 78** (S30, S39) | ≥ 75 % |
| Corrections, fair → `CONSISTENT` | **10 / 10** | ≥ 9 |
| Corrections, unsupported → `NOT_SUPPORTED_BY_PACKAGE` | **10 / 10** | ≥ 9 |
| Tier P similar-closer | **38 / 40** (T34, T35 — both through S39) | ≥ 34 |
| Compounds in their dominant major | **9 / 10** (S30 invalid) | ≥ 8 |
| Invalid | **1 / 100** (S30: an answer the strict decoder refused) | ≤ 2 |

Every trap held its major (section labels 3 / 3, injected instructions 4 / 4, thin 2 / 2, near misses 4 / 4, long 3 / 3,
QANDEEL-heavy 3 / 3). S39 (a new graduate's first weeks as a teacher) was read mainly as work pressure (0.5) with first
steps second (0.3). A fair correction's corrected profile stayed in the case's major 9 / 10.

**Raters' half — NOT MET** (two independent blind agent sessions, R1 and R2; DeepSeek never rated)

| Criterion | Result | Accept |
| --- | --- | --- |
| Fidelity, F = YES from both | **78 / 80** (S30 no proposal; S53) | ≥ 72 |
| Fabrication, A = YES or unresolved UNSURE from either | **8** — YES from both raters: **S48** (the meaning adds guilt the author never states), **S53** (a theme takes up QANDEEL's reading of anger that the author rejects), **S69** (a theme turns one shared laugh into daily laughter); UNSURE: S14 (a spouse's gender assumed, R1), S32 (disgust named, R1), S33 (injuries called minor, R2), S37 (deadlines "late" where the text says brought forward, both), S59 (a son where the text says a daughter, R1) | **0** |
| Compounds keep their secondary meaning, C = YES from both | **9 / 10** (S30 no proposal) | ≥ 8 |

The three both-YES additions cannot be resolved by the Product Owner's audit of the UNSURE verdicts, so the evaluation is
**NOT ACCEPTED as run** whatever that audit decides. **Reported, not criteria:** the meaning's language matched the topic in
29 / 35 Egyptian, 15 / 15 MSA, 14 / 15 mixed and **0 / 15 English** topics (every English topic was answered in Arabic;
some Egyptian topics in MSA); both raters also noted gender and small factual slips that they did not count as additions
(e.g. S06 / S11 masculine forms for a woman writing, S10, S17, S76).

The results and the raters' sheets are kept locally beside the run (`.s8a-05-reports/cp3/tier-s/`, outside the
repository), with the guard's spend state (`artifacts/evals/s8a-05-cp3/deepseek/`, ignored).

### 12.8 Verification

Every result below was read from its own exit code and full log, locally on Windows with Node 24 and PostgreSQL 17, on the
final tree, one suite at a time. GitHub CI on the pull request's head is the binding run.

| Gate | Result |
| --- | --- |
| Root contracts (`node --test tests/*.test.mjs`) | **1,639 / 1,639 pass**, exit 0 |
| Database static contracts (`npm run test:database`) | **1,310 / 1,310 pass**, exit 0 |
| Task-closure governance (`npm run test:task-closure-governance-contract`) | **24 / 24 pass**, exit 0 |
| API (`npm run test:api`) | **296 suites, 7,035 pass, 1 skipped**, exit 0 |
| API build and types | `npm run build:api` exit 0; `tsc --noEmit -p apps/api/tsconfig.json` exit 0 |
| PG17 verifiers, each on a fresh database with every migration through 0181 | **0181, 0180, 0179, 0176, 0175, 0174, 0171, 0169, 0168, 0164, 0150, 0147, 0146, 0145, 0144, 0143 — all pass** (exit 0) |
| Mobile | **Not run:** CP3 changes no file under `apps/mobile/`; CI runs it on the head |
| Placement simulation | `placement-sim.mjs`, deterministic, about 3 s; results in `placement-sim-results.txt` (§12.4) |

**Tier S / Tier P harness, zero cost** (every run under the network guard; nothing left the process):

| Run | Result |
| --- | --- |
| `launch.mjs --dry` | the guard refuses the first call (`fetch:dry-run`); 0 attempts; the run is INCOMPLETE, as it must be |
| Live lock | `QANDEEL_EVAL_ROUND=25` without dry / simulated mode: the guard throws at load, "round 25 is not authorized for a live run; nothing was sent" |
| `--simulate`, oracle stand-in (answers the fixed labels) | 100 attempts; major 80 / 80, sub-region 78 / 78, corrections 10 / 10 + 10 / 10, similar-closer 40 / 40, compounds 10 / 10, invalid 0; ledger sound (100 records, one family, all paid by the synthetic publisher, nothing Shared) — deterministic half MET. It also shows the 40 triplets agree with the fixed labels under P-dom |
| `--simulate`, lazy stand-in (everything `everyday.moments`, every correction CONSISTENT) | major 6 / 80, sub-region 1 / 78, unsupported corrections 0 / 10, similar-closer 16 / 40 — NOT MET, as it must be |
| `--simulate` with faults (HTTP 500, a malformed body, a cut-off answer, an invalid answer, a hang) | each fault is exactly one attempt and one ledger record, mapped to `PROVIDER_ERROR` / `INVALID_STRUCTURED_OUTPUT` / `TIMEOUT`, counted invalid (5 / 100), never retried |
| Rater packet and tally (rehearsal sheets) | the packet carries no label, weight or score; an unresolved `UNSURE` fabrication fails the tally; a written Product Owner overturn resolves it |
| `budget.ts` | 100 calls, request bytes 9,020 – 11,105; expected USD 0.034, pessimistic 0.127, all-worst-case reservation 0.411; **proposed ceiling 100 attempts and USD 0.14** (PREREGISTRATION.md §5) |

The case set was written by an independent agent session from `AUTHOR_BRIEF.md` alone and reviewed blind by a second
one before it was frozen (one defect fixed: S59; PREREGISTRATION.md §2).

### 12.9 Deliberately not implemented in CP3

- No paid call beyond the one authorized Tier S / Tier P run; no second run, no re-tuning of the instructions, cases or criteria.
- No production publishing, no Stage 9, no CW2-08 change, no placement before publication.
- No edit rules for a published topic and no successor-version placement change (CP4); no Public discussion, no `@qandeel`.
- No field camera, scale or expansion rule (`LA-SCALE-01`); no old place moved.
- No other model and no fallback; Replay and Voice untouched.

### 12.10 Backlog (BG-05 for CP3)

CP3 admits, tombstones and re-owns nothing. Read and left as they stand: `QAN-BL-AI-01` (real user data to DeepSeek —
`SYNTHETIC_ONLY` kept), `QAN-BL-PRIV-05`, `QAN-BL-ACCT-01` / `QAN-BL-PROD-09` (the region slots are bound to a published
Experience, and nothing can publish yet). The findings of amendment §8 are recorded there; F-2 (the camera) stays with the
S5-03B open gaps G04 / G05.
