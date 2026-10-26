# QANDEEL — S8A-05 Public World: «اكتب موضوعك» / Write Your Topic — Implementation Record v1

**Task:** S8A-05 — Public World (Stage 8A). This record covers **CP1 — Write Your Topic** only
**Status:** `CP1 DELIVERED — R2 REVIEW CORRECTIONS APPLIED — AT THE S8A-05 CP1 FINAL REVIEW GATE — COPY GATE CLOSED (every row
APPROVED by the Product Owner, 2026-10-26) — NOT MERGED / NOT DEPLOYED / PRODUCTION PUBLISHING CLOSED (freeze seam NOT_EVALUATED; CW2-08 untouched) / CLOSED TO USERS`. S8A-05 is not
closed: CP2 – CP4 have not started, and BG-08 / BG-09 are reconciled at S8A-05's last checkpoint, not here  
**Date:** 2026-10-26  
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
