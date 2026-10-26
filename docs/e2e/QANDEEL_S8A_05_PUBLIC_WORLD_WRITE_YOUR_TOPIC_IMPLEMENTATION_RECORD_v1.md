# QANDEEL — S8A-05 Public World: «اكتب موضوعك» / Write Your Topic — Implementation Record v1

**Task:** S8A-05 — Public World (Stage 8A). This record covers **CP1 — Write Your Topic** only
**Status:** `CP1 DELIVERED — AT THE S8A-05 CP1 REVIEW GATE — COPY GATE OPEN (every new row PROPOSED) — NOT MERGED / NOT
DEPLOYED / PRODUCTION PUBLISHING CLOSED (freeze seam NOT_EVALUATED; CW2-08 untouched) / CLOSED TO USERS`. S8A-05 is not
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
mobile client shows the honest outcome (`PUBLICATION_NOT_OPEN` → «النشر في العالم العام لم يُفتح بعد. المسودة محفوظة كما
هي.», a PROPOSED row).

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
  exactly the visible version + section, ≤ 400 served ids) and `read_public_topic_title_matches_v1` (≤ 20, through the one
  0145 visibility predicate).
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
  meaning matches, deduplicated, at most 20. The 0145 reads are unchanged.

## 4. Mobile (`apps/mobile/src/`)

- `runtime-entry/public-compose-api.ts` — the strict transport client; `public-world-api.ts` composes it as `compose`. The
  runtime-entry barrel adds the topic types and exactly four values (`PUBLIC_TOPIC_SECTIONS`, `PUBLIC_TOPIC_TEXT_MAX`,
  `PUBLIC_TOPIC_TITLE_MAX`, `publicEntryLabel`), recorded in its scope census; consumers import only through the barrel.
- `public-compose/` — `copy.ts` (§6), `public-compose-controller.ts` (screens LIST / EDIT / PREVIEW, one command id per
  act until a definite answer, STALE reloads, save before preview and on Back, discard = «العودة إلى المسودة», delete with
  confirmation), `PublicComposeWorkspace.tsx`.
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

## 6. Copy Gate — S8A-05 CP1 Product Copy Gate: `OPEN`

Every new row is `PROPOSED` in Arabic and English; nothing is approved by being shipped. Reused, already approved rows:
`save` (S7-02), `back`, `retry`, `actionUnavailable` (S4-01), and the publisher display heading reused through `publicAuthoringCopy().shownAs` (S5-01 Product Copy Gate).

| Key | Arabic (PROPOSED) | English (PROPOSED) |
| --- | --- | --- |
| entry | موضوع جديد | New topic |
| draftsHeading | مسوداتي | My drafts |
| noDrafts | لا توجد مسودات بعد. | No drafts yet. |
| newDraft | كتابة موضوع جديد | Write a new topic |
| untitled | بلا عنوان | Untitled |
| privateNote | المسودة محفوظة في الحساب، ولا يراها غير صاحبها. | The draft is saved to the account, and only its author can see it. |
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
| previewHeading | هكذا سيظهر الموضوع في العالم العام | This is how the topic would appear in Public World |
| publicWarning | كل ما في العنوان والنص سيصبح عامًا يقرؤه الناس. | Everything in the title and text would become public for people to read. |
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
| notOpen | النشر في العالم العام لم يُفتح بعد. المسودة محفوظة كما هي. | Publishing in Public World isn't open yet. The draft is kept as it is. |
| preparedState | مُجهّز للنشر، ولم يُنشر بعد | Prepared for publishing, not published yet |
| backToDraft | العودة إلى المسودة | Back to the draft |
| backToDraftNote | تُمحى النسخة المجهّزة، وتبقى المسودة. | The prepared copy is erased; the draft stays. |
| delete | حذف المسودة | Delete draft |
| deleteConfirm | حذف نهائي | Delete permanently |
| deleteNote | يُمحى العنوان والنص نهائيًا. | The title and text are erased permanently. |
| deleted | حُذفت المسودة. | The draft was deleted. |

Section names (WP1 §2.2, PROPOSED): love الحب والارتباط · marriage الزواج والطلاق · family الأهل والعائلة · parenting
الأبناء والتربية · people الأصدقاء والناس · work_money العمل والمال · study_future الدراسة والمستقبل · inner_self النفس
والمشاعر · health_body الصحة والجسد · loss_crisis الفقد والأزمات · faith_meaning الإيمان والمعنى · life_changes الغربة
والتحولات · open حكايات مفتوحة (English: Love and relationships · Marriage and divorce · Parents and family · Children and
parenting · Friends and people · Work and money · Study and the future · The self and feelings · Health and the body · Loss
and crises · Faith and meaning · Living abroad and big changes · Open stories).

## 7. Verification (all run locally on 2026-10-26; CI results are read on the pull request)

**Real PostgreSQL 17 (local harness, fresh database per verifier).** The new `database/verify-migration-0179.mjs` passes:
boundary B01 – B10, the second-session restore S01 / S02, private drafts D01 – D08, and — inside one transaction that it
rolls back, with the freeze seam replaced by a probe and restored byte for byte — the controlled path F01 – F08 and L01 –
L03 (the CW2-08 seam simulated only there). The focused group `s8a-05-cp1` (23 verifiers) was run: 22 pass; `0130` fails
on one millisecond-scale assertion ("grace period", 7.0000000347 against 7) caused by clock skew between PostgreSQL
`clock_timestamp()` and Node `Date.now()` on the Windows harness. It fails identically on the `main` state without 0179
(`SPLIT=0180`), so it is a harness flake, not caused by this change; CI runs it on Linux.

Re-anchored verifiers (validation only, each with a dated comment): `0121` (five lifecycle movers), `0143` B08 (two
destroyers), `0153` and `0168` (the live Export My Data builder is the 0179 re-statement; it equals the 0168 body plus the
one marked `publicTopicDrafts` section).

**API.** Full jest: 294 suites passed, 7,007 tests passed (1 skipped); `nest build` and `tsc` clean. New
`public-compose.spec.ts` (service validation and outcomes, title merge in field / search / panel, the static boundary and
the route census). Re-anchored: `public-field.spec.ts` (the viewer RPC list gains the two title reads), `public-relation.spec.ts`
(its field mock gains them).

**Mobile.** `tsc` clean. New `public-compose.test.tsx` (16 tests). Re-anchored: `s5-01-public-world.test.tsx` (the heading's
buttons now include `qandeel-public-compose-entry`) and the runtime-entry `scope.test.ts` census (the four values above), and the proof-world stand-in guard `s8a-05-proof-compose.test.ts` (new, 2 tests). Full jest: 231 of 233 suites and 2,930 of 2,936 tests passed. The failures in `depth.test` and
`w2-account-access` (6 tests) occur identically on the S8A-04 baseline `3987f6a1` (= the tree of `main` `9459245e`) and are
not caused by this change.

**Root contracts.** `node --test tests/*.test.mjs`: 1,639 of 1,639 passed. `npm run test:task-closure-governance-contract`: 24 of 24 passed.

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

## 9. Deliberately not implemented in CP1

- No production publishing, no Public Identity before the gates, no CW2-08 change, no Public discussion or commenting.
- No topic from a QANDEEL conversation, no long-conversation path, and no discard of a topic that holds non-authored
  items (CP2).
- No Public semantic / spatial binding: placement at publication is CP3's. A placement committed through the unchanged
  S5-03B path before a discard would leave its integer coordinates (no text); production cannot reach that before Stage 9.
- No revision of a published topic and no edit note (CP4).
- No mobile control to change the section of a prepared topic: the command exists in the database and the API only.
- No section filter or lens on the map (A-1 §3.2 item 4); the section appears as a label in the panel only.
- Search matches the human title (and, as before, the meaning), not the body.
- The explicit-relations management list (`PublicRelations`) still names related topics by `meaning`: the relation API
  carries no title. Its search results use the title.
- A legacy topic without a human title keeps showing its `meaning`.
- Compare-and-set revisions and command identities are used instead of a separate command ledger.
- No Replay, no Voice, no paid model call, no DeepSeek.

## 10. Backlog (BG-05 at kickoff)

S8A-05 owns no backlog item at kickoff. CP1 admits, tombstones and re-owns nothing. Observed and left as they stand:
`QAN-BL-PRIV-05` (Export My Data across worlds — CP1 adds the reader's own drafts as `publicTopicDrafts`; the item stays
with its owner), `QAN-BL-ACCT-01` and `QAN-BL-PROD-09` (`topic_drafts` is `ACCOUNT_CASCADE`, registered in the
account-deletion coverage census; a prepared topic exists only after the closed gate opens and then follows the Public
residue owner, `ACCT-DEL-02`).
