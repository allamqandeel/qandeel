# QANDEEL — S5-04 Public Discussion + @qandeel + Public Activity / Direct Entry + Final Public Integration — Implementation Record v1

**Status:** `CLOSED / READY FOR PRODUCT OWNER MERGE DECISION — NOT MERGED`

**Stage 5:** `ACTIVE` pending S5-04's merge. **ON MERGE OF S5-04: Stage 5 becomes DONE / MERGED.** By the Product Owner's
sequencing, **QAN-BL-CW-03 / SHARED-VIS-01 becomes NEXT** after that merge. It is not started here. Stages 6–9 are not opened.

**S5-04 PRODUCT COPY GATE:** `CLOSED — 12 / 12 APPROVED` (Product Owner, 2026-10-08; row 11 Arabic as revised by the Owner; §14). Merge waits only for the Product Owner's «ادمج».

| | |
|---|---|
| Baseline | `729fe4d8b5afa15d2b0c6ae3eba627b25450132f` (the merge of PR #318, S5-03C), verified as `origin/main` at kickoff |
| Branch | `feat/s5-04-public-discussion-qandeel-final-integration` |
| Migration | `0147_public_discussion_qandeel_activity_integration_v1.sql` (one, additive) |
| Product Owner decisions | the S5-04 Decision Gate, D1–D7 (2026-10-08), §3 |
| Owns | S5-03B G08 (discussion, replies, Public QANDEEL, Public Activity / Push, vitality / instant rendering); S5-03C G03 (relation-request notifications) |
| Does not touch | Shared (SHARED-VIS-01), Stage 6 Matching, Stage 7 Replay, Stage 8A provider binding, Stage 8B Voice, Stage 9 economy / CW2-08 / `PUBLISHED`, signed-out viewing, reactions (`QAN-BL-CW-04`), scale / LOD (`QAN-BL-VIS-01`), account deletion (`QAN-BL-ACCT-01`) |

---

## 1. Current-truth reconciliation

`origin/main` was `729fe4d` at kickoff, exactly the expected baseline: PR #318 (S5-03C) is merged. S5-03C is therefore
**DONE / MERGED through PR #318 at `729fe4d8b5afa15d2b0c6ae3eba627b25450132f`**. Its record keeps its pre-merge banner as
evidence. `QANDEEL_CURRENT_STATE.md` and `QANDEEL_PROJECT_MAP.md` now tell current truth (S5-03C merged; S5-04 the current
task, closed and awaiting the merge decision). No separate docs task was used.

## 2. Anti-Duplication Table (written before implementation)

| Capability | Already existed — consumed, never rebuilt | Genuinely missing — built here |
|---|---|---|
| Discussion posts / replies | `0096` `public_discussion_posts` + commands; `post_public_discussion_v1` (author `auth.uid()`, Public Identity resolved, version derived from visibility, parent on the visible version, idempotent per command) | an application-reachable wrapper — the frozen writer is executable by NO role, service_role included |
| Public QANDEEL responses | `0096` `public_qandeel_responses` + commands; `record_public_qandeel_response_v1` (machine-only, version-bound, context fingerprint) | invocation semantics (none existed), one-response-per-post, a generation lease, a Public-only context read |
| Discussion reads | `resolve_public_discussion_v1` / `resolve_public_qandeel_responses_v1` (visibility + admission + visible version; Public Identity labels joined live) | a viewer read on the caller's token (the frozen resolvers take a viewer id and are service_role only), paged |
| Vitality | `0097` `recompute_public_experience_vitality_v1`; the S5-03B panel already carries `publishedAt` / `discussionCount` / `qandeelResponseCount` | a caller: nothing ever recomputed vitality, so counts stayed 0 — 0147 recomputes after every commit; the mobile panel renders the date and the human count (D7) |
| Disappearance | `0098` canonical visibility, `0099` disappearance (history survives internally, serving stops) | nothing — every new read, command and source composes the same visibility |
| Activity / Push | A3-01 `ActivityPublisher`, `PUBLIC_INTERACTION` / `PUBLIC_DISCOVERY`, preferences, L2 / L1, ceilings, Lock Screen copy; A3-02 Push, native taps through Activity `open` | the Public source producer, a server-channel recipient derivation (S4-04 pattern), Public sentences |
| Direct Entry | `PUBLIC_WORLD` typed (requires `entry_ref`); `POST /activity/items/:id/open`; the S5-03B viewer read; the S5-03C owner relation read | `PUBLIC_WORLD` executable: open-time revalidation, the mobile decoder and composition branch, an exact-Experience field entry |
| Generation | `SafetyResponseGateService`, `MODEL_ROUTER` (provider-neutral; refuses when no provider is bound), `runWithAiUsageAttribution`, the 10 s provider bound | a Public lease (0131 is Personal, 0139 Shared — no generic lease exists), the Public-only assembler, orchestration |
| Entitlement | nothing anywhere | the smallest fail-closed seam (§6) |

No second discussion, reply, response, vitality, stale-content, Activity, Push, device, budget, Quiet Hours, Snooze or
settings system exists. The verifier proves the three 0147 tables hold no text (B05) and the contract proves 0147 creates no
discussion / response / vitality table and writes them only through the frozen writers (contract 2).

## 3. Product Owner decisions (S5-04 Decision Gate, 2026-10-08) — applied exactly

- **D1 @qandeel:** canonical token `@qandeel`; matched case-insensitively; a standalone token, never a substring; the user's
  words are kept verbatim; valid from a top-level post and from a reply; ONE committed invoking post produces AT MOST ONE
  durable Public QANDEEL response, however many tokens it holds; idempotency through the generation-work lease.
- **D2 thread shape:** one visible depth (top-level posts with replies beneath), canonical ordinal order, no ranking, no
  nested tree; a reply to a reply joins the same thread root; 0096 storage unchanged.
- **D3 reactions:** the approved Product direction (lightweight reactions on Experiences and on individual replies) stands;
  vocabulary / UI / count visibility / ranking effect / negative reactions are undecided. Not implemented here, not described
  as rejected; `PG-07` admitted exactly once as `QAN-BL-CW-04`, owner `PUBLIC-REACTIONS-01`. *(This corrects the First
  Report, which had called reactions undecided as a direction.)*
- **D4 entitlement:** the minimum Stage-9-bindable seam, `NOT_EVALUATED` / fail closed in production; no fake Premium, price,
  Credits, plan or bypass; validation replaces it only inside proof scope; @qandeel does not bypass it; the separate
  generation work / rate bound is kept.
- **D5 Activity matrix:** §9. *(This corrects the First Report: a top-level post on one's own Experience is Class 4 ambient,
  never a Push.)*
- **D6 scale ownership:** `QAN-BL-VIS-01` re-owned to `LA-SCALE-01 — Living Analysis Heavy-History / Dense-World Scale & LOD
  Proof`; G04 / G05 and the bounded-v1 family reconciled under it; no duplicate; S5-04 solves none of it.
- **D7 vitality / instant:** the published date in the panel; the human count only inside the Discussion entry
  («النقاش · n»); `qandeelResponseCount` never shown as a social metric; no popularity / trending / importance / truth
  wording; counts never move geography.

## 4. Architecture implemented

```
mobile panel (NEAR) ── «النقاش · n» ──▶ discussion (same chrome band, same field; Back → panel → field)
    │  post / reply { commandId, text, replyTo }         read ?after=n
    ▼
API PublicDiscussionService ──(caller token)──▶ 0147 post_own_public_discussion_v1 ──▶ FROZEN 0096 post_public_discussion_v1
    │                                              ├─ admitted viewer (frozen gate) · served version (S5-03B entry)
    │                                              ├─ entitlement seam (NOT_EVALUATED → NOT_ENTITLED)
    │                                              ├─ reply → thread root (D2) · S5-02 identity provisioning
    │                                              └─ @qandeel → invocation row · FROZEN 0097 vitality recompute
    ├─▶ PublicActivityProducer ──(server)──▶ 0147 server_read_public_activity_source_v1 ──▶ ActivityPublisher (A3-01) ──▶ A3-02 Push
    └─▶ PublicQandeelReplyService ──(server)──▶ begin lease → PUBLIC context → Safety Gate → Public assembler
                                                 → MODEL_ROUTER (attributed, AI-COST-01) → complete (revalidated)
                                                 → FROZEN 0096 record_public_qandeel_response_v1 → vitality → end lease
Activity open ── PUBLIC_WORLD discussion:<id> | relations:<id> ──▶ revalidated NOW on the caller's token ──▶ the same Public
entry controller → the SAME field, exact Experience at NEAR (or the reader's own Experience's relations)
```

## 5. Migration 0147 — the one additive boundary

Schema `public_discussion_private`. Every function is a pinned postgres-owned SECURITY DEFINER; `public` wrappers are
SECURITY INVOKER one-liners. Deploy-time self-assertions K1–K6 fail the migration if the boundary drifts.

| Object | Role | Executable by |
|---|---|---|
| `resolve_public_discussion_entitlement_v1(uuid)` | the entitlement seam: `NOT_EVALUATED` | nobody |
| `qandeel_invocations` (post, Experience, instant, the ONE response, last-unavailable instant) | D1 invocation record; guarded: response linked once, nothing deleted | nobody |
| `qandeel_work_leases`, `qandeel_work_grants`, `qandeel_work_policy_v1()` (2 in flight; 20 / 10 min; 200 / 24 h — **implementation safety policy — NOT frozen Product law**; tunable later by replacing the function, without a Product-semantic migration) | the generation-work lease and bound | nobody |
| `invokes_qandeel_v1`, `is_entitled_v1`, `is_admitted_v1`, `served_version_v1`, `guard_invocation_v1` | derivations | nobody |
| `post_own_public_discussion_v1(commandId, experienceId, replyToPostId, body)` | the human post / reply | `authenticated` |
| `read_public_discussion_posts_v1(experienceId, afterOrdinal)`, `read_public_discussion_capability_v1(experienceId)` | the viewer reads (≤ 100 posts per page) | `authenticated` |
| `begin_` / `read_public_qandeel_context_` / `complete_` / `end_public_qandeel_work_v1` | the server QANDEEL work | `service_role` |
| `server_read_public_activity_source_v1(kind, id)` | Activity recipients from Public truth | `service_role` |

The frozen `0096` / `0097` primitives keep their grants exactly (none / service_role-only resolvers). No `commit_%` name, no
`resolve_public_` / `search_public_` name (the 0071 and 0098 census families are untouched). No historical migration is edited.

## 6. Entitlement posture

No canonical entitlement seam existed. CW2-04 §20 / D22 states Premium-only reply / comment as current Product direction;
CW2-04 §36 and CW2-08 §44 item 7 leave its implementation to the launch / economy work (Stage 9). 0147 creates the smallest
seam, `resolve_public_discussion_entitlement_v1`, answering `NOT_EVALUATED`; contribution requires an exact `ENTITLED`, checked
at commit, at work begin and at completion. In production every human post answers `NOT_ENTITLED` and writes nothing, and the
mobile composer is absent (the capability read answers false). Verifiers replace the seam body only inside a rolled-back
transaction (verifier E01–E02, X01). This changes nothing about publication: `PUBLISHED` stays unreachable in production
(the CW2-08 publication seam still answers `NOT_EVALUATED`). **Stage 5 DONE does not mean Public World launch-ready.**

## 7. @qandeel — trigger and response journey

1. A human commits a post or reply. 0147 detects the standalone, case-insensitive `@qandeel` token
   (`(^|[^[:alnum:]_@.])@qandeel($|[^[:alnum:]_@.]|[.]($|[^[:alnum:]_@]))`) and writes ONE invocation row; the words are stored
   verbatim by the frozen writer. `mail@qandeel.com`, `@qandeel.com`, `qandeel.com`, `@qandeelish`, `@@qandeel` invoke nothing;
   ordinary punctuation still invokes (`@qandeel,`, sentence-final `@qandeel.`, `(@qandeel)`, `@qandeel؟`, `@qandeel،`); two
   tokens make one invocation (verifier Q01–Q03, Q02b). A full stop followed by anything word-like makes the token part of an
   address, not an invocation (independent-review correction, Product class A, fixed before merge).
2. The API asks for the one response: `begin` (GRANTED / IN_PROGRESS / LIMITED / ALREADY_COMMITTED / UNAVAILABLE — only the
   invoking author, only while the post's Experience is served at that version, the author admitted and entitled).
3. Under the live lease, the PUBLIC context is read NOW (§8). Nothing is readable without the lease (W03).
4. The canonical Safety Response Gate; BLOCK answers with its deterministic words and calls no provider.
5. The Public-only assembler; the provider-neutral `MODEL_ROUTER` inside `runWithAiUsageAttribution({ userId })` — the
   invoking human is accounting authority only and never enters the request (API spec).
6. The answer is bounded (≤ 4000). `complete` re-validates the served version, the invoking post, admission, entitlement and
   every consumed post; anything moved → `STALE`, the result is discarded and the invocation is marked unanswered (W04, G02).
7. The frozen `record_public_qandeel_response_v1` records it, in reply to the invoking post; vitality is recomputed.
8. The lease always ends; a failed attempt is shown truthfully («تعذّر إكمال رد قنديل.»); the invoker may ask again (Retry).

The human post never disappears because generation failed; one invocation never spends twice concurrently (the lease) and
never records a second response (`UNIQUE (response_id)`, W06). **No provider is selected** (Stage 8A): with no provider
bound, the router refuses and the discussion says "unavailable" — QANDEEL's words are never invented (API spec "no provider
bound"). Outside tests no fake router stands in (contract 4).

## 8. Public-only model-context proof

The context read returns only: the exact served version id (for revalidation), its reviewed S5-03A meaning and themes, its
public package items through the frozen 0095 serving resolver, the served discussion up to and including the invoking post
(the last 40), earlier served Public QANDEEL responses (the last 20), and the reviewed MEANING of each CURRENT active explicit
related Experience (≤ 24) — the minimum relation fact, never the related Experience's content. It carries no author, Public
display, account, contact, Personal / Shared / memory / human-model / hypothesis / Matching / Introduction / Standing Context,
sealed provenance or source World. Proven structurally three ways: the migration's K3 assertion, the verifier (B06; W03
proves a Personal analysis sentence, an unpublished Shared sentence, another publisher's private sentence and every Public
display label are absent from the served context), and the API spec / contract 4 (the assembler's input type has no such
field and its source imports nothing private; the Shared assembler is not used). The invoking post is labelled "The
participant asking you now"; every other human is "A participant".

## 9. Public Activity event matrix (implemented exactly as D5)

| Event | Activity | Push-eligible | Class | Actionable | Recipient (derived by 0147) | Direct Entry | Disclosure |
|---|---|---|---|---|---|---|---|
| Direct human reply to my post | yes | yes (D25 direct reply) | 3 | no | the parent post's author, never the actor, admitted only | `discussion:<experience>` | L2, no content, no name |
| New top-level post on my Experience | yes | **no** (Class 4 ambient) | 4 | no | every controller of the Experience, never the actor | `discussion:<experience>` | L2, the reused generic Public line |
| Incoming relation request | yes | yes | 3 | **yes** | every controller of the target Experience | `relations:<relation>` | L2 |
| Relation accepted | yes | yes | 3 | no | every controller of the requesting Experience; the request item is withdrawn | `relations:<relation>` | L2 |
| Relation declined / cancelled / removed | **none** | — | — | — | the pending request item is withdrawn | — | — |
| @qandeel response completed | **none** — it appears where it was asked | — | — | — | — | — | — |
| Public discovery | **none** — no canonical discovery source exists | — | — | — | — | — | — |

Idempotency: `candidateKey` `s5-04:<kind>:<fact id>`, `sourceRef` `public:<kind>:<fact id>` — a retried command is a DUPLICATE.
The client never names a recipient. Preferences (`publicInteractions`), Quiet Hours, Snooze, ceilings and the Lock Screen are
A3-01 / A3-02's, unchanged. Activity is a projection only: no item creates, accepts, declines or keeps alive a relation (S5-03C
human commands remain the only authority).

## 10. Public Direct Entry

`PUBLIC_WORLD` joins `EXECUTABLE_DESTINATIONS`. At open, on the caller's own token: `discussion:<id>` enters only while the
existing S5-03B viewer read still serves exactly that Experience (admission, canonical visibility, exact version);
`relations:<id>` enters only while that relation is still one of the reader's own current relations (REQUEST_RECEIVED or
ACTIVE), naming the reader's own Experience. Otherwise `UNAVAILABLE` with no fallback, no reason, no tombstone, no substitute.
On mobile the destination goes through the SAME Public entry controller as the switcher and `qandeel://public`: on ALLOW the
field enters the World as a whole, asks the server for exactly that Experience, focuses it at NEAR and opens its discussion
(or the workspace opens the reader's own Experience's relations); a stale target is the S5-03B neutral absence. No new deep-link
grammar, screen, graph or geography exists (contract 6). Back: discussion → panel → field.

## 11. Discussion, reply and vitality Product journeys

Public World → select an Experience (NEAR) → the panel shows the publication date («نُشرت في …») and «النقاش · n» → the
discussion (same chrome band): top-level posts with replies beneath, each attributed to its author's CURRENT Public display
(«شخص ما» / Someone when the label is absent), a QANDEEL response in its own labelled block («قنديل» / QANDEEL — never a human
identity, never colour alone), pending / unavailable states, «عرض المزيد من المشاركات» paging → Reply (sets the thread root;
the composer shows «ردّ على …» with Cancel) → the composer (hint: how to ask QANDEEL, and that its answer is public) → Send →
everything is read again → Back returns to the same panel in the same field. There is no like, follower, ranking, badge,
contact or private-message affordance. The count shown is the human discussion count of the served version only; QANDEEL's
count is decoded and dropped. Counts are read-only facts in the panel and move nothing (verifier D06).

## 12. Visibility / disappearance proof

Verifier G01–G04, against real PostgreSQL: once the owner removes the Experience from the Public World (0099), the discussion
read and the capability read return nothing (no tombstone), a post answers `UNAVAILABLE` and writes nothing, the context read
goes dark under a live lease, a completion is `STALE` and discarded, a new begin is `UNAVAILABLE`, and the Activity source
answers nothing for its posts and relations — while the internal 0096 history survives (serving stops; nothing is erased by
S5-04). The mobile discussion empties on an `ABSENT` read and the field forgets the Experience at once.

## 13. Privacy, security and accessibility

- No S5-04 route or RPC accepts a viewer, actor, author, Public identity ref, version, visibility / admission claim,
  recipient, QANDEEL producer identity, timestamp, ordinal or entitlement verdict (verifier B03, API spec, contract 2).
- Nothing logs discussion content, prompts, context or model output (contract 4). No broad service_role privilege: exactly the
  five server functions (verifier B04). No mobile table access; no private-to-Public bridge.
- Route classes: the discussion read `AUTHENTICATED`; posting and the QANDEEL retry `SECURITY_SENSITIVE` (census).
- Accessibility: every action is a button with a name and a ≥ 44 pt target; each post reads as one element «author: words»;
  the QANDEEL response reads «قنديل: …» / "QANDEEL: …"; pending / failed states are polite live regions; the reading order is
  thread order; QANDEEL's block is distinguished by a text label, not colour; no decorative Living Analysis element is
  announced; Reduced Motion is untouched (no new motion). An unavailable Experience leaks nothing through accessibility text.

## 14. S5-04 PRODUCT COPY GATE — CLOSED (12 / 12 APPROVED)

Census first: reused byte-exact — «قنديل» / QANDEEL (CANON, I-08A4); composer placeholder, Send, «قنديل: …», waiting for
QANDEEL's reply, QANDEEL's reply could not be completed, send unconfirmed / refused (W1A-01); Back, Cancel, Try again, «شخص ما»
(S4-01); the no-longer-in-Public-World and cannot-be-shown lines (S5-03B); the generic Public Lock Screen line (A3-02,
p3.generic.public) for the ambient post item. Genuinely new rows — the Product Owner approved rows 1–10 and 12 exactly as
proposed and revised ONLY row 11's Arabic (from «طلب علاقة جديد مع إحدى تجاربك في العالم العام.»); English unchanged (2026-10-08):

| # | Key | Arabic | English | Context | Accessibility use |
|---|---|---|---|---|---|
| 1 | `discussion` | النقاش | Discussion | panel entry with no posts yet; the discussion heading | button name; header |
| 2 | `discussionWithCount` | النقاش · {0} | Discussion · {0} | panel entry; {0} = human post count of the served version only | button name |
| 3 | `noPosts` | لا مشاركات بعد. | No posts yet. | empty discussion | read as text |
| 4 | `composerName` | مشاركتك في هذا النقاش | Your post in this discussion | composer | input's accessible name |
| 5 | `reply` | ردّ | Reply | under each post when the reader may contribute | button name |
| 6 | `replyingTo` | ردّ على {0} | Replying to {0} | above the composer; {0} = the post author's Public display or «شخص ما» | read as text |
| 7 | `invokeHint` | اكتب ‎@qandeel لتسأل قنديل هنا، وردّه يظهر للجميع. | Write @qandeel to ask QANDEEL here. Its answer is visible to everyone. | above the composer | read as text |
| 8 | `publishedOn` | نُشرت في {0} | Published {0} | panel; {0} = the publication date (Gregorian, Product locale) | read as text |
| 9 | `morePosts` | عرض المزيد من المشاركات | Show more posts | after a full page | button name |
| 10 | `replyToOwnPost` (server) | ردّ أحدهم على مشاركتك في النقاش. | Someone replied to your post in the discussion. | Activity body, Class 3 | Activity row / Lock Screen at L2 |
| 11 | `relationRequest` (server) | هناك طلب علاقة جديد لإحدى تجاربك في العالم العام. | A new relation request for one of your Experiences in the Public World. | Activity body, Class 3, actionable | Activity row / Lock Screen at L2 |
| 12 | `relationAccepted` (server) | قُبل طلب العلاقة الذي أرسلته. | Your relation request was accepted. | Activity body, Class 3 | Activity row / Lock Screen at L2 |

Rows 1–9 live in `apps/mobile/src/public-world/field/discussion-copy.ts`; rows 10–12 in
`apps/api/src/public-world/public-activity-copy.ts`. Both gates read CLOSED; every row is marked APPROVED and none PROPOSED (contract 8).

## 15. Backlog reconciliation (BG-05 at kickoff, BG-08 at closure)

- **Inherited by owner:** none (no item names S5-04).
- **QAN-BL-VIS-01:** re-owned to `LA-SCALE-01`, `DEFERRED — OWNED`, at the Product Owner's D6 decision; G04 / G05 and S5-03C's
  read bounds reconciled under it; no duplicate.
- **QAN-BL-CW-04 (new):** Public Lightweight Reactions Runtime (`PG-07`), owner `PUBLIC-REACTIONS-01`, `MEDIUM`,
  `DEFERRED — OWNED`, admitted at the Product Owner's D3 designation.
- **QAN-BL-VOICE-01:** unchanged; it owns Public `VOICE_REPLY` (CW2-04 §19). S5-04 implements the TEXT path only and fakes no
  Voice Reply.
- **QAN-BL-ACCT-01:** `HIGH`, `OPEN — UNASSIGNED`, scope unchanged; current-truth note added (S5-04's footprint).
- **QAN-BL-CW-03 / SHARED-VIS-01:** unchanged; NEXT only after S5-04 merges; not started.
- **QAN-BL-NOTIF-02 … 05:** unchanged.
- Register: **45** items — 19 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 8 `OPEN — UNASSIGNED`, 18 `CLOSED — TOMBSTONE`; 27
  `HIGH`, 17 `MEDIUM`, 1 `LOW` (counted mechanically from the §4 index).

## 16. Final Stage-5 completeness / anti-omission sweep (Gap Matrix)

Classes: 1 prior S5 task (consume) · 2 S5-04 · 3 existing backlog owner · 4 later Stage owner · 5 new residue → Product Owner ·
6 anti-scope.

| Area | Class | Owner / disposition |
|---|---|---|
| Entry (switcher, `qandeel://public`, entry verdict) | 1 | S5-01 |
| Identity / display (PSEUDONYM / REAL_NAME, one Public Identity) | 1 | S5-01 / S5-02 (S5-04 provisions it at first post exactly as S5-02) |
| Authoring, rights / approvals, Draft → READY_FOR_REVIEW | 1 | S5-02 |
| Semantic interpretation / publisher review | 1 | S5-03A (provider: Stage 8A — class 4) |
| Spatial placement; FAR / MID / NEAR viewer; search; Experience panel | 1 | S5-03B (placer provider: Stage 8A — class 4) |
| Explicit relations | 1 | S5-03C |
| Discussion; replies (TEXT); @qandeel; Public QANDEEL responses | 2 | S5-04 (Public QANDEEL provider: Stage 8A — class 4) |
| Voice Reply | 3 | `QAN-BL-VOICE-01` (Stage 8B) |
| Vitality / published-instant rendering | 2 | S5-04 (D7) |
| Public Activity; relation-request notification; Public Direct Entry | 2 | S5-04 |
| Public discovery notifications | 6 | no canonical discovery source exists; nothing produced (D5) |
| Public reactions (`PG-07`) | 3 | `QAN-BL-CW-04` → `PUBLIC-REACTIONS-01` (D3) |
| Premium / discussion entitlement; `PUBLISHED`; moderation; signed-out viewing | 4 | CW2-08 / Stage 9 (fail-closed seams) |
| Scale: `LIMIT 400`, dense aggregation, field / search at scale, heavy history, LOD, real-device performance (G04 / G05 + S5-03C bounds) | 3 | `QAN-BL-VIS-01` → `LA-SCALE-01` (D6) |
| Deletion / disappearance; source loss | 1 | I-05 (0098 / 0099), S5-02 (ASSURE-F05), S5-03A–C integrity; S5-04 composes it (§12) |
| Account deletion across Connected Worlds | 3 | `QAN-BL-ACCT-01` |
| Accessibility | 2 (own surfaces) / 1 | §13; earlier surfaces by their tasks |
| Bilingual Product copy | 2 | §14 Copy Gate (CLOSED 12 / 12) |
| Native Push physical-device proof | 3 | `QAN-BL-NOTIF-05` |
| Shared semantic World | 3 | `QAN-BL-CW-03` / SHARED-VIS-01 (NEXT after merge) |

**Orphan gaps = 0.** No later-stage work was absorbed to make the table empty.

## 17. Validation (proportional; local)

| Family | Result |
|---|---|
| `database/verify-migration-0147.mjs` on real PostgreSQL 17 (local embedded, fresh from bootstrap through 0147) | **PASS** — boundary, entitlement, discussion, @qandeel, work lease, context firewall, Activity source, disappearance, launch closure |
| Historical authority-sensitive verifiers against the 0147 database: 0096, 0097, 0098, 0099, 0139, 0140, 0141, 0142, 0143, 0144, 0145, 0146 | **12 / 12 PASS** — no census or ceiling drift |
| API jest: `src/public-world`, `src/activity`, `src/http-security` (route census), `src/shared-world` | **PASS** (280 tests; S5-04 spec 20 / 20) |
| API typecheck | PASS |
| Mobile typecheck; lint | PASS; 0 errors (warnings pre-existing) |
| Mobile jest: `public-world`, `public-authoring`, `activity`, `push`, `runtime-entry`, `shared-world`, `integration` | PASS except 6 tests in `depth.test.tsx` / `w2-account-access.test.tsx`, which fail identically on the committed baseline without S5-04 (local environment, class C) |
| Static contracts: a3-01, a3-02, s4-02, s4-04, s5-01, s5-02, s5-03a, s5-03b, s5-03c, ai-cost-01, s5-04 | PASS |
| `test:task-closure-governance-contract`; T-12P runtime-entry contract | PASS (24 / 24; 23 / 23) |
| `test:forward-safety-contract` | 25 pass / 10 fail — every failure is the mirror's `expo install --check` / `expo-doctor` leg, which fails IDENTICALLY (25 / 10, the same tests) on the untouched `origin/main` baseline on this machine (class C); the same expo contract passes 6 / 6 in the real repository; every S5-04 and historical contract survives in the mirror |

The broad integration proof is GitHub CI on the one pushed head; its result is reported on the Draft PR, not here.

## 18. Failure classification

| # | Finding | Class | Disposition |
|---|---|---|---|
| F1 | S5-03C static test forbade any `activity` token in the relation service — true for S5-03C, whose notifications were S5-04's | B | re-anchored: only the S5-04 producer projection is allowed; no recipient, table or Push |
| F2 | S5-03B isolation test: Arabic literals only in `field-copy.ts`; `/Line\b/i` matched a TextInput's `multiline` | B | re-anchored for the S5-04 copy module and the `multiline` prop; the Personal `Thread` ban is honoured (type renamed) |
| F3 | a3-01 test 7 / s4-04 test 4 pinned the executable-destination set | B | re-anchored to include `PUBLIC_WORLD` |
| F4 | S5-01 tests 4 / 5, S5-02 test 5, S5-03C test 5, S5-03B test 7 pinned the Public module / runtime composition | B | re-anchored to their original invariants (one Public module; no faked content; one field creation) |
| F5 | the runtime-entry barrel census (`scope.test.ts`) | B | resolved without a re-anchor: S5-04 adds no runtime-barrel value (types only) |
| F6 | panel fixtures lacked the D7 fields | B | fixtures completed (validation only) |
| F7 | `depth.test.tsx` / `w2-account-access.test.tsx` (6 tests) | C | reproduce on the baseline without S5-04; not touched |
| F8 | the S5-01 contract on `main` contains literal backspace bytes in one regex (pre-existing) | — | left byte-exact; not S5-04's to change |
| F9 | the discussion surface deep-imported a runtime-entry submodule (T-12P barrel rule) | A (structural) | fixed in Product code: the bound lives in the discussion controller; tests reach the transport through the barrel |
| F10 | the S5-04 contract read the root locators in the forward-safety mirror, which carries only source trees | B | guarded with `existsSync`, as the S5 contracts do |
| F11 | forward-safety mirror: expo-doctor leg | C | reproduces on `origin/main` without S5-04; not touched |
| F12 | independent review: the `@qandeel` detector accepted a domain-like token (`@qandeel.com`) because `.` satisfied the right boundary | A | fixed narrowly in `invokes_qandeel_v1` (a full stop ends the token only when nothing word-like follows); verifier Q02 / Q02b cover the address, handle and punctuation cases; no mention-parser redesign |
| F13 | GitHub CI on `5cac179`: the 0114 Matching verifier's C08 failed its lock-wait barrier (the Match was in fact blocked on `matching_setup_locks` until `lock_timeout`) and C09 cascaded with `MATCHING_STALE_STATE` | B (pre-existing, latent; files unchanged since `729fe4d`; first seen on this run) | the shared barrier `waitForLockWait` (`database/matching-match-verifier-support.mjs`) polls `pg_stat_activity` from the primary connection INSIDE its open transaction, where PostgreSQL snapshots `state` at the first read but reads `wait_event_type` live: a first poll landing before the competitor's backend starts its statement freezes `idle` and the barrier can never fire. Fixed by discarding the snapshot (`pg_stat_clear_snapshot()`) before each poll; C08–C14's `authorityRace` now rolls back T2 and cleans up when its barrier fails, so one failure cannot cascade. Proven: forcing the interleaving (Match sent 100 ms late) fails the old helper with the CI signature and passes the fixed one 16 / 16; no timeout raised, no assertion weakened, no Matching Product change |

No Product, Security or Privacy defect was found in the frozen runtime or in S5-01 … S5-03C.

**Independent-review corrections (2026-10-08).** F12 above; the Product Copy Gate closed 12 / 12 (row 11 Arabic revised by
the Owner, §14); the @qandeel numeric work bounds are recorded as an implementation safety policy — NOT frozen Product law
(§6). Re-validated locally only on the affected scope: the 0147 verifier on real PostgreSQL, the S5-04 API spec, the S5-04
mobile discussion test and the S5-04 contract; GitHub CI on the corrected head is the broad proof.

## 19. Native proof

Planned after green CI: ONE bounded Android smoke through the existing proof fixture (Public World → Experience → Discussion →
post → reply → @qandeel → response → Back → Activity Direct Entry). The CW2-08 seams keep production unreachable, so the smoke
needs the validation-only fixture path; the emulator's known Skia / swiftshader stall (S5-03C) allows one bounded
infrastructure attempt only, then **NOT PROVEN (C)**. Physical-phone performance remains `QAN-BL-VIS-01` / release evidence.

**Native proof fixture (B, Product Owner authorized, 2026-10-08).** The existing S4-01 proof world had no discussion, `@qandeel`
or `/activity/*` answers, so the journey could not run on a device. `apps/mobile/src/integration/__validation__/s401-proof-world.ts`
now answers them after `qandeel://s401-proof/public/seed` only (the discussion as 0147 / the API do, one visible depth,
idempotent; `@qandeel` by 0147's detector, mirrored, with a VALIDATION-ONLY deterministic response; the fixture stands in for
an entitled reader and never touches the production NOT_EVALUATED seam), and `qandeel://s401-proof/public/peer-reply` makes a
synthetic other person reply to the reader's latest own post, producing the Class 3 PUBLIC item whose open answers
`PUBLIC_WORLD` → `DISCUSSION` of exactly that Experience. Guarded by `src/integration/__tests__/s5-04-proof-fixture.test.ts`
through the production strict clients. No Product code, migration, API or runtime changed. The device result is reported on
the Draft PR.

## 20. Closure governance

AGENTS.md §10 followed: the backlog read in full at kickoff and closure; every inherited / observed item reconciled (§15); new
residue admitted (QAN-BL-CW-04) or re-owned (QAN-BL-VIS-01) at the Product Owner's designation; this record carries its final
pre-merge lifecycle state; `npm run test:task-closure-governance-contract` passes. No successor task must finish anything here.
S5-04 is a task, not a Connected Worlds phase: no `I-0N closure record` heading is added.

## 21. Remaining later-stage blockers (unchanged by S5-04)

Stage 8A (production provider: Public QANDEEL, interpreter, placer); Stage 8B (Voice / `VOICE_REPLY`); Stage 9 / CW2-08
(Premium entitlement, `PUBLISHED`, moderation, signed-out viewing, Launch Gate); `QAN-BL-ACCT-01`; `QAN-BL-VIS-01` /
`LA-SCALE-01`; `QAN-BL-CW-04` / `PUBLIC-REACTIONS-01`; `QAN-BL-NOTIF-05`. **ON MERGE OF S5-04: Stage 5 becomes DONE / MERGED,
and QAN-BL-CW-03 / SHARED-VIS-01 becomes NEXT.**
