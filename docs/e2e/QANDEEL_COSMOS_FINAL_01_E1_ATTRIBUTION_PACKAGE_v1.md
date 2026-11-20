# COSMOS-FINAL-01 E-1 — Message Attribution: Amendment, Copy Gate and Privacy / Wire-Contract Review v1

**Status:** `PROPOSED — FOR THE PRODUCT OWNER'S REVIEW (2026-11-20). NOT IMPLEMENTED. COPY GATE OPEN (3 ROWS PROPOSED).`  
**Authority:** the Product Owner, *COSMOS-FINAL-01 Continuation After §29 Review* (2026-11-20), item 2 (Option A).  
**Canonical text:** [the E-1 controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_COSMOS_FINAL_01_E1_MESSAGE_ATTRIBUTION_CONTROLLED_AMENDMENT_v1.0.md) (PROPOSED).  
**Register:** COSMOS-INT-01 contract §20 E-1; §29.8 (the conflict); §30 (this continuation).

## 1. What the reader will see (Option A)

| World | Reader's own message | Another person's message | QANDEEL |
|---|---|---|---|
| Personal | unchanged: own edge, slab tone; announced «كلامك» / "You" | — (no other person) | unchanged: on the World; announced «قنديل» / "QANDEEL" |
| Shared (live, closed, Introduction World) | **new:** visible «أنت» / "You" (E1(a)) | their Name, or «شخص ما» / "Someone"; **new:** `Name (2)` only when that label is not unique for this reader (E1(c)) | unchanged: visible «قنديل» / "QANDEEL" |
| Shared place sources | unchanged: «أنت» / "You" (already shown) | as in the conversation, the same ordinal rule | unchanged |
| Public discussion | **new:** their Public display followed by the tag «أنت» / "You", seen by the reader only (E1(f)) | unchanged: the author's Public display (+ «صاحب الموضوع» / "Topic author" when A-5(b) applies) | unchanged |

## 2. The passages narrowed (quoted; they stay byte-identical in their records)

- **S4-02 record, the thread** (lines 193–195): "attribution APPROVED as implemented: the reader's words on the start edge on
  the utterance slab; another person's on the end edge on the functional surface under their legitimate Name; QANDEEL open on
  the World under «قنديل» / QANDEEL, no surface." → E1(a) adds the reader's visible «أنت» / "You"; E1(c) adds the
  collision-only ordinal after another person's Name.
- **S4-02 record, the read** (line 93): "`list_own_shared_world_material_v1` … adds only each human author's Name and whether
  THIS reader may delete." → E1(b) – E1(c) add the author's participant ordinal, sent only when the label collides.
- **S5-04, a post's author** (presentation; A-5(b) beside it): a post shows its author's Public display, and the topic
  author's tag when A-5(b) applies → E1(f) adds the reader-only self tag in the same place and form.
- **Not narrowed:** G1.1 R3 and its canonical closure; S8A-02 §5.3 (the model's request-local numbering, rule 4, "not stored,
  not shown to anyone by the server, and not stable between requests", stays exactly as it is and is not the ordinal); CW2-04
  §9 – §10 (Public identity); 0140's member handles.

## 3. Product Copy Gate — COSMOS-FINAL-01 E-1 (OPEN; 3 rows PROPOSED)

No new word is proposed. All three rows place approved words in a new visible position, or join them in a new visible form,
so each needs the Product Owner's approval of that use. The accessible labels follow from the visible text (W1A-01's own-row
label «كلامك: …» stays as it is).

| Row | Key / placement | Arabic | English | Source | Status |
|---|---|---|---|---|---|
| E1-01 | The reader's own row in a Shared conversation (live, closed, Introduction World): visible attribution, metadata role, the row's own edge | «أنت» | "You" | S4-01 `you` (APPROVED), REUSED | **PROPOSED** (visible placement) |
| E1-02 | Another participant whose label is not unique for this reader: `{label} ({n})`, `{n}` the participant ordinal in Western digits (as `digits()` does across the app); `{label}` is the Name or «شخص ما» / "Someone" (S4-01 `someone`, APPROVED, REUSED). Accessible label `{label} ({n}): {text}` through S4-02's `otherTurnName` | «{label} ({n})» | "{label} ({n})" | new form; words REUSED | **PROPOSED** (form) |
| E1-03 | The reader's own Public post: a tag beside the reader's Public display, in A-5(b)'s place and form; accessible label `{display} · أنت: {text}` / `{display} · You: {text}` | «أنت» | "You" | S4-01 `you` (APPROVED), REUSED | **PROPOSED** (visible placement) |

Copy rule: rows are imported from their owner modules (`shared-world/copy.ts`), never copied; the new form E1-02 lives in one
module under one `COSMOS_FINAL_01_E1_COPY_GATE` with per-row `status` / `enStatus`, pinned by a root contract test.

## 4. Privacy and wire-contract review

### 4.1 What crosses the wire, before and after

| Read | Today | After E-1 |
|---|---|---|
| Shared materials (`GET /shared/worlds/:id/materials`, older pages, `closed/:worldId`) | `materialId, producer (SELF/HUMAN/QANDEEL), authorName (HUMAN only), text, establishedAt, canDelete` | **+ `authorOrdinal: number \| null`** — non-null only for a HUMAN row whose label is not unique for this reader (E1(c)); always null for SELF and QANDEEL |
| Shared place sources (`/shared/worlds/:id/field/places/:id`) | `producer, authorName` per source | **+ `authorOrdinal`**, the same rule |
| Public discussion posts | `isOp, author {mode, label}, own` | **unchanged** (E1(f) uses `own`) |

The field is named `authorOrdinal`; S4-02's pin (`tests/s4-02-shared-conversation-material-contract.test.mjs:136`, no
`authorId|userId|audience|materialKind|viewer`) stays as it is and passes.

### 4.2 Findings

| # | Question | Finding | Control |
|---|---|---|---|
| P-1 | Does the ordinal identify a person? | No. It is a small per-World integer, assigned by join order, unrelated to any account, user id, member handle (0140), Shared ID, Public identity or contact endpoint. Many people in many Worlds hold "2". | E1(b); a database pin that the ordinal table holds no user-facing identifier and no route takes the ordinal as input |
| P-2 | Can it correlate one person across Worlds? | No. Ordinals are assigned per World independently, so the same person's ordinals in two Worlds are unrelated, and no read returns ordinals of more than one World. | E1(b); a test that a person's ordinals in two Worlds are assigned independently (different join positions give different ordinals) |
| P-3 | Is it exposed when not needed? | No. It leaves the server only for a label that is not unique for this reader. In a World where every label differs nothing new crosses. | E1(c); a test per surface that a unique label carries `authorOrdinal = null` |
| P-4 | What does it reveal that was not known? | When shown: the relative order in which two people with the same label first joined that World (lower = earlier). That is a new, small fact about those two people only. The alternative — numbering by the order of each person's first visible message, as S8A-02 rule 3 does for the model — reveals nothing new, but the number would change when a message is deleted or hidden and could differ between readers with different history grants (S4-03), so the same person would not keep one number. | Recommended: join order (stable). The PO decides (E-P1) |
| P-5 | Matching-born Worlds (S6-02 / 0155: the handoff first name or nothing before SUCCESS) | The label is computed from what THIS reader may see (`shared_person_name_v1`), so the ordinal never reveals a withheld Name and is computed the same before and after SUCCESS. A person with no visible Name is «شخص ما» / "Someone (n)". | E1(c); a test in a Matching-born World before SUCCESS |
| P-6 | A member whose Name equals QANDEEL's word | Treated as a collision: the human row always carries its ordinal, so it never reads as QANDEEL; QANDEEL's own rows also keep their edge and no surface. | E1(c), E1(e); a test |
| P-7 | Account deletion (ACCT-DEL-01/02) and erasure | The ordinal is World data of that person and is erased with it; it is never reused, so no later person inherits it. | E1(b); the erasure pin extended to the ordinal table |
| P-8 | Logging | No log line, metric or trace carries an ordinal with a World or user. | The existing no-log contract; a grep pin |
| P-9 | Public self tag | It uses `own`, already on the wire and per viewer; nothing new crosses, and others never see it. | E1(f) |
| P-10 | The model | The ordinal is not sent to any model; S8A-02 §5.3 is unchanged. | E1(g); the S8A-02 provider-request pins unchanged |

### 4.3 Wire-compatibility note
The app's decoders accept exactly the keys they know (`MATERIAL_KEYS` in `runtime-entry/shared-world-api.ts`, and the field
source decoder). The API and the app change in one pull request; an older app build would reject the new key. Nothing is
released, so no deployed client is affected; this is recorded so a hosted rollout keeps the server and the app together.

### 4.4 Storage
One new private table, `shared_private.shared_world_participant_ordinals (world_id, user_id, ordinal, assigned_at)`, unique
on `(world_id, user_id)` and `(world_id, ordinal)`, filled when a person's first membership episode in a World begins (the
existing World-birth and join paths), with a one-time backfill in join order for existing Worlds. Reads compute the
collision per reader and return the ordinal through the existing `SECURITY DEFINER` functions; no new route. Migration
`0197` (the next number on this branch).

## 5. Personal: the demonstration that G1.1 R3 satisfies E-1

E-1 asks that every displayed Personal message identify its author. The Personal conversation has two speakers; G1.1 R3 gives
each a fixed edge and ground and announces each turn's speaker. The demonstration, without changing anything:
- **iOS (native, BG-10):** one XCUITest in the World gate — every Personal turn in the seeded conversation exposes its
  speaker before its words («كلامك: …» / "You: …" or «قنديل: …» / "QANDEEL: …"), the reader's turns all lie on one edge and
  QANDEEL's on the other, and no turn is unattributed.
- **Android (emulator):** the same reading from the accessibility tree (uiautomator), en and ar.
- **Existing pins:** `tests/w1a-01-conversation-core-contract.test.mjs` (the labels) and the G1.1 Jest golden tests.

## 6. Implementation plan (after approval; nothing is implemented now)

1. Migration `0197`: the ordinal table, assignment in the join and birth paths, backfill, the collision-aware projection in
   `list_own_shared_world_material_v1` (and its closed-World and field-source reads), the erasure extension, and a verifier.
2. API: `authorOrdinal` in `SharedMaterialView` and the field source view; contract tests.
3. App: decoders; `SharedWorldThread` (own row «أنت» / "You"; another person's `{label} ({n})`); the field source list;
   `PublicDiscussion` (the self tag); the E-1 copy module and its gate pin.
4. Tests on both platforms: Jest (rendering and labels); the iOS World gate (Shared collision fixture, own-row word, Public
   self tag, the Personal demonstration); the Android emulator journey (the same, en and ar); Replay suites unchanged.

## 7. Decisions for the Product Owner

- **E-A:** approve the amendment text (E1(a) – E1(g)).
- **E-B:** approve Copy Gate rows E1-01 – E1-03 (ar and en).
- **E-C:** accept the privacy / wire-contract review, including **E-P1** (P-4): number by join order (recommended; stable;
  the relative join order of two same-label participants is visible when, and only when, their labels collide), or by first
  visible message (nothing new revealed; the number can change).
- On approval, implementation proceeds within COSMOS-FINAL-01 as §6, on both platforms, before the Release candidate.
