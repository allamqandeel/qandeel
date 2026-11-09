# QANDEEL MAP-VISUAL-REFRESH-01 — CP-A: Personal Map Topics (L0 / L1 / L2, N4, Replay V2): Contract Record v1

**Status:** `MAP-VISUAL-REFRESH-01 CP-A — DOCUMENTATION CONTRACT — DRAFT FOR PO REVIEW — NOT APPROVED — NOTHING IMPLEMENTED`
**Task:** MAP-VISUAL-REFRESH-01, the Personal Living Analysis map's art direction and information architecture. CP-A is its documentation contract checkpoint.
**Authority:** Product Owner decisions of 2026-11-09:
- the IA-GATE review;
- Annex 1;
- Annex 2;
- the decision on CAL-1 and the CP-A package, which authorizes this documentation-only Draft PR.

**Baseline:** `main` at `06f24a73`. **Branch:** `map/map-visual-refresh-01-cp-a`.

**Not authorized:**
- CP-B or any production CP;
- migrations or product code;
- changes to frozen contracts (the amendments in the companion document are **drafts, not effective**);
- paid AI calls or a CAL-2 run;
- V-3, or resuming Replay video work.

**Not merged; merge only on «ادمج».**

**Companion documents:**
- [Controlled Amendment drafts](QANDEEL_MAP_VISUAL_REFRESH_01_CP_A_CONTROLLED_AMENDMENT_DRAFTS_v1.md);
- [CAL-2 run plan](QANDEEL_MAP_VISUAL_REFRESH_01_CAL_2_RUN_PLAN_v1.md);
- [CAL-1 synthetic results](QANDEEL_MAP_VISUAL_REFRESH_01_CAL_1_SYNTHETIC_RESULTS_v1.md).

---

## 1. Scope and authority
- **This record proposes an implementation contract.** Once the Product Owner approves it, it governs the later CPs listed in §10. Until then it **binds nothing.**
- It changes no Product or runtime semantics in force. In particular, it does **not** edit:
  - `docs/historical-projection-v1.md` (D-12 / D-13);
  - the VPORT-01 record;
  - LA-VIS-01;
  - I-08B1;
  - `docs/replay-runtime-v1.md`;
  - `docs/post-response-intelligence-scheduler-provider-budget-v1.md` (QIR-005);
  - any migration.
- Each needed change to those contracts is listed as a **draft** Controlled Amendment.

**Engineering facts cited here** were read from `main` at `06f24a73`:
- the AI call paths;
- the four-effect ceiling;
- the permits;
- the pricing basis;
- the Replay pins.

**The art-direction study is kept outside the product tree,** in `E:\QANDEEL_REPORTS\MAP-VISUAL-REFRESH-01`:
- D-1..D-5;
- R2 and AD-1..AD-4 (AD-4 is the temporary visual base);
- the IA-GATE report;
- Annexes 1–2 and their simulations;
- CAL-1.

None of it is product code.

## 2. Product Owner decisions recorded (2026-11-09)
1. **AD-4** is kept as a **temporary** visual base. There is no AD-5 and no V-3.
2. **Meaning grows gradually from Qandeel's understanding:**
   - no fixed life domains;
   - a Thread is not a life domain;
   - Home proximity and background colour never imply membership;
   - Homes never move.
3. **Option 2,** a historical record of topics with their sources and corrections, is the preferred architecture. There is **no automatic merge.**
4. **The Annex-1 rules R1–R6 are dropped.** The counter-cases showed:
   - order dependence;
   - a user attach silently undone;
   - a named group silently vanishing.
5. **L0 / L1 / L2 separation is adopted** (§3).
   - **Ego sets** are the L1 candidate evidence packages.
   - **Maximal cliques** stay out of the production path unless an independent benefit is proven.
   - **K / S are not approved.** CAL-1's Q1 failure stands as recorded.
6. **Only L2 topics are the understood topics visible on the map.**
   - Sources: the user, or a Qandeel proposal (N4).
   - Proposals are visible as `PROPOSED` with a non-colour marker.
   - A meaningful map must not depend on the user approving every proposal.
   - A user-confirmed topic never changes membership silently.
   - A rejected proposal is never repeated on the same evidence.
7. **N4 has two paths:** **Single-Thread** and **Multi-Thread** (§6). Preparing its contract is approved; running it is not. Separating it from the post-response dispatcher is **not** a way around the four-effect policy (§6.10).
8. **N3 is not adopted.**
9. **N2 is deferred.** At most it is a quoted descriptor shown on inspection, never an automatic overview title. 0066 / 0068 are not changed for it now.
10. **Forgetting:**
    - **an earlier confirmation is not an independent basis**;
    - derived text without an independent basis is not kept (§7);
    - Replay V2 prefers limited redaction of the affected topic layer, under a historical verification mechanism (§9).
11. **Trust & Privacy** owns the B1/B2 Privacy Gate review; final approval stays with the PO.
    - WORLD is a disclosure rung inside the Personal World, not Public.
    - Nothing moves to Shared or Public worlds automatically.
12. **Order of work:**
    - CP-A fixes N4's requirements and evaluation before any final database design;
    - a decision point (**DP-1**) follows CAL-2 and precedes any data or interface layer that depends on topic quality;
    - Replay historical compatibility is designed in from the start;
    - video work is not resumed.

## 3. Layers
| Layer | Name | Nature | Source | Semantic claim |
|---|---|---|---|---|
| **L0** | Shared analytical identity | fact | existing `thread_reading_bindings` (0072) | "the same Reading appears in these Threads" |
| **L1** | Analytical association | derived, pure function | L0 + withheld set + user vetoes, at TC | **none.** Never called a topic, never named, never coloured as a group |
| **L2** | Qandeel topic | ledger entity | user act, or a Qandeel proposal (N4, §6) | "an understood life topic". `PROPOSED` until the user confirms |

## 4. L1: analytical association (contract)
- **Pair predicate.** `REL(a,b)` ⇔ at least **K** current (not withheld) Readings bind both *a* and *b*, in at least **S** distinct Sessions, and the user has not vetoed the pair.
  - **K and S are not approved.** CAL-1 showed that a count cannot separate repeated incidental links from real ones.
  - Values are decided only after CAL-2, at DP-1.
- **Candidate evidence packages = ego sets.** For each Thread with at least one association: the Thread plus every Thread associated with it. Only maximal sets are kept.
  - At most one package per Thread, so the number is bounded.
  - **A package is evidence offered to N4 (path B) or to the user, never a topic.**
  - Maximal cliques are excluded from the production path: they split multi-facet topics (CAL-1 H3) and explode on adversarial graphs.
- **Purity.** L1 at TC is a function of the facts at TC plus the pinned **L1 rule version** (predicate + K/S + extraction).
  - It is never stored as membership.
  - **Order invariance is a hard gate.**
- **User correction at L1:** `PAIR_VETOED_BY_USER` and its withdrawal. Both are anchored events, and a veto is sticky.
- **Display:** never at overview. On selection only, at the rung decided at DP-1 (THREAD is proposed), behind the Privacy Gate.

## 5. L2: the topic ledger and its presentation
- **Entities:**
  - `personal_topics`: user-scoped, with a stable id and `state` ∈ {PROPOSED, CONFIRMED, WITHDRAWN, REJECTED, DISSOLVED_BY_USER};
  - an append-only `personal_topic_events`, anchored by `(session_id, session_position, same_sp_event_sequence)`, or by `world_version` for acts outside a Session.
- **Isolation:** user isolation and default deny, with no direct grant; reads go through the definer projection only (the 0072 pattern).
- **The final schema is designed only after DP-1.** The table names here are contract names, not migrations.
- **Every membership and every name carries a provenance class:** **U** (user-independent), **QC** (Qandeel-inferred, user-confirmed) or **QP** (Qandeel-inferred, unconfirmed). See §7.

**Events:**
- `TOPIC_PROPOSED` (path A/B, members, name, citations, model and prompt version, evidence fingerprint);
- `MEMBER_PROPOSED`, `RENAME_PROPOSED`;
- `PROPOSAL_ACCEPTED`;
- `PROPOSAL_REJECTED` (stores a content-free rejection key, §6.6);
- `TOPIC_CREATED_BY_USER`, `NAMED_BY_USER`, `RENAMED_BY_USER`;
- `MEMBER_ATTACHED_BY_USER`, `MEMBER_DETACHED_BY_USER` (sticky);
- `MERGED_BY_USER`, `SPLIT_BY_USER`, `DISSOLVED_BY_USER`;
- `BASIS_WITHDRAWN` (§7).

**Invariants:**
- No silent membership change, merge or split of a CONFIRMED topic. New evidence produces proposals only.
- No re-proposal of a rejected topic on the same evidence (§6.6).
- **Names never carry** a diagnosis, motive, personality trait or judgement without a basis and a contract that allow it.

**Presentation of proposals:**
- `PROPOSED` topics are shown inside the Personal World clearly as proposals.
- They may carry a **temporary colour and visual identity**, and they **must** carry a **non-colour marker** that distinguishes them from CONFIRMED (for example, an open or dashed outline and an «مقترح» tag; the final form is decided by the Copy Gate and the design).
- Accepting them is never required for the map to be meaningful.
- Colour is never the only carrier of membership. The others are the name, the selection state, PT-03 identity marks and accessibility.

## 6. N4: Qandeel topic proposal (contract boundaries; preparing it is approved, running it is not)

> **N4 is not authorized to run.** No AI call is made or authorized by this record. Activation needs all of:
> - the evaluation (§6.11) and DP-1 (§10);
> - a separate PO decision on the four-effect policy (§6.10);
> - the Privacy Gate for whatever it displays (§8).

### 6.1 Two paths
| | **A: Single-Thread Topic Proposal** | **B: Multi-Thread Topic Proposal** |
|---|---|---|
| Question asked | "Does the knowledge inside **this one Thread** amount to an understood life topic?" | "Do **these Threads** together form one wider understood topic?" |
| Input package | one Thread (no L1 association needed) | one L1 **ego-set package** (§4) |
| Output | `PROPOSE` a topic with members = {that Thread}, or `ABSTAIN` | `PROPOSE` a topic with members ⊆ the package (≥ 2), **or** propose extending an existing topic (`MEMBER_PROPOSED`), or `ABSTAIN` |
| What it is not | **not** "name every Thread". N4 must show an understood topic or abstain | **not** "associated = same topic". Counted association is an invitation to judge, never the judgement |

**Interaction between the paths:**
- **A then B:** if a Single-Thread topic {T} exists (any state) and path B finds {T, U, …}, the output must be an **extension proposal** of the existing topic (`MEMBER_PROPOSED`, plus an optional `RENAME_PROPOSED`), not a second topic. A CONFIRMED topic is never changed silently.
- **B then A:** a Thread already inside a topic is offered to path A only for a distinct topic, which N4 must justify against the existing one (§6.6).
- **Overlap:** a Thread may belong to more than one topic. Each membership needs its own citations.

### 6.2 When a proposal is requested (eligibility)
- **Path A:** the Thread has ≥ `A_MIN_READINGS` current Readings bound to it, over ≥ `A_MIN_SESSIONS` Sessions (values TBD after CAL-2).
- **Path B:** an ego-set package with ≥ 2 Threads.
- **Both paths:**
  - the package's **evidence fingerprint** is not suppressed (§6.6);
  - **no active call** for the user;
  - the Session is closed, plus an idle debounce `N4_DEBOUNCE` (TBD);
  - the caps in §6.7 are not exceeded;
  - the live-pressure gate in §6.9 is open.
- **Material change:** a changed fingerprint re-triggers only when it **adds** evidence. Withdrawals trigger re-validation only (§6.5, §7).

### 6.3 Evidence and citations
- **Allowed input:**
  - (a) the `statement` of current Readings: those bound to the Thread (A), or those binding ≥ 2 package members (B), plus each member's own bound Readings, up to a size cap;
  - (b) each member's grounding `anchor_text` (the user's own words, 0066), **as model input only**. Displaying it is N2, which is deferred;
  - (c) names and member ids of the user's existing topics in every state, including rejected ones, used for duplicate avoidance only.
- **Forbidden input:**
  - withheld or forgotten items;
  - Memory content;
  - transcripts beyond anchors;
  - other users' data;
  - Shared or Public content;
  - rejected proposals' cited text.
- **Output citations:** every member must cite ≥ 1 current Reading.
  - In path B, at least one cited Reading per member must bind it to another proposed member.
  - The name must cite the Readings or anchors that support it.
- **Routing:** through Model Router adapters (provider-replaceable). Inputs and outputs are not logged in plain text (AGENTS.md §5).

### 6.4 Abstention (the model must abstain; the server also enforces it)
`decision: PROPOSE | ABSTAIN`, with a closed `abstainReason` enum:
- `NO_UNIFYING_SUBJECT`: only incidental or one-off links (CAL-1 A1: L1 cannot abstain; N4 must);
- `MENTION_ONLY`: a person, place or object with no understood topic around it (path A guard against "name every Thread");
- `NEEDS_INFERENCE`: a name would require a diagnosis, motive, personality trait or judgement not stated by the user;
- `SENSITIVE_CATEGORY_NOT_STATED`: a name would introduce a sensitive category the user did not themselves state;
- `CONTESTED_EVIDENCE`: the supporting Readings are contested or MIXED;
- `DUPLICATE_OF_EXISTING`: §6.6.

### 6.5 Validation (deterministic, versioned; failure means no proposal, and there is no retry loop)
- The schema and enums are exact.
- Members:
  - path A has exactly 1;
  - path B has ≥ 2 and they form a subset of the package.
- Every citation exists, is current, belongs to the user, and satisfies §6.3.
- Name:
  - Arabic script;
  - length within `NAME_MAX` (TBD, short);
  - no rule-set violation (closed, versioned list maintained through the Copy and conduct review);
  - not equal, after normalization, to an existing or rejected topic name (§6.6).
- **Re-validation:** when evidence is withdrawn, an existing proposal or QC topic is re-checked against §6.3–6.5 without a model call. If it fails, §7 applies.

### 6.6 Duplicates, even when evidence fingerprints differ
A proposal is a **duplicate** if any of the following holds:
- (a) **Member overlap:** its member set overlaps an existing topic (PROPOSED or CONFIRMED) at ≥ `DUP_OVERLAP` (TBD). It is then converted into an extension or rename proposal of that topic, or dropped.
- (b) **Normalized name equality:** it equals an existing or rejected name after deterministic Arabic normalization (diacritics, alef and yaa forms, taa marbuta, tatweel, the definite article, whitespace). No semantic matching is claimed.
- (c) **Model declaration:** N4 sees the existing topic names (c-input above) and must answer `sameAsTopicId`. The server accepts that answer only if (a) or (b) also holds, or uses it to suppress the proposal.

**Rejection memory:**
- A `PROPOSAL_REJECTED` event stores the content-free key (member ids, normalized-name hash, evidence fingerprint).
- **The same proposal is never re-proposed on the same evidence.**
- A re-proposal of a rejected topic is allowed only when ≥ `REPROPOSE_NEW_EVIDENCE` (TBD) **new** current Readings are cited that were absent from the rejected fingerprint, and after `REPROPOSE_COOLDOWN` (TBD).
- When the rejected evidence is forgotten, its key is purged with it (§7).

### 6.7 Caps (values TBD by the PO; none is measured)
- Per user: ≤ `N4_PER_USER_DAY` calls per day and ≤ `N4_PER_USER_WEEK` per week; at most 1 in flight.
- Globally: ≤ `N4_GLOBAL_DAY` calls per day and a `N4_GLOBAL_USD_DAY` spend ceiling. Reaching either pauses N4 until the next window. There is no backlog burst.
- Per trigger: exactly 1 call. A transient provider failure is retried at most once, then the trigger is dropped until the next material change.

### 6.8 Accounting and model cost
- Every call goes through the accounted provider clients.
- It uses a **new ai-usage feature family** (`TOPIC_PROPOSAL`). The family enum is closed, so this needs a migration in a later CP.
- Attribution: user, world, path (A/B), trigger fingerprint, and model and prompt version.
- **The model is chosen in the N4 contract CP, after CAL-2.** Cost per call comes from the repository's pricing table. It is **not estimated here.**

### 6.9 Priority, isolation and back-off under Live Voice pressure
- **Priority:** N4 is the lowest-priority intelligence work.
- **Isolation:**
  - its own queue, worker and permit kind, with `respectCriticalWindow: true`;
  - it never takes CALL_ANALYSIS, TEXT_SEMANTIC_ANALYSIS or Live Voice resources;
  - it never runs during the user's active call;
  - it is never on the reply, First Audio or text-delivery path.
- **Back-off even though provider quota is shared.** N4 runs only while **all** of the following hold:
  - live call concurrency system-wide is below `N4_LIVE_CALL_CEILING`;
  - there has been no provider rate-limit (429) or timeout signal on live paths within `N4_PRESSURE_WINDOW`;
  - provider request headroom stays above `N4_RESERVE` for live traffic.

  Any breach pauses N4 at once, with exponential resume. In-flight N4 calls are not cancelled mid-call; no new ones start. Values are TBD; the mechanism is mandatory.

### 6.10 Relation to the four-effect ceiling
- The Founder's ceiling ("أربعة مؤثرات مزود كحد أقصى"; `post-response-provider-budget.ts`, `POST_RESPONSE_PROVIDER_EFFECTS_V2`) caps provider-backed **post-response effects per completed turn**.
- **N4 is not placed in that dispatcher, and that placement is not a way around the policy.** This record does **not** decide whether the policy's intent also covers world-level model work such as N4.
- **N4 cannot be activated until the PO decides one of:**
  - (i) N4 is outside the ceiling's scope, with its own caps (§6.7);
  - (ii) N4 counts against an amended policy;
  - (iii) N4 is not activated.
- Any budget or effects-policy expansion is a separate, versioned decision.

### 6.11 Evaluation method (fixed here, before any database design is finalized)
- N4 is evaluated in **CAL-2** (its own plan; paid; separately authorized).
- **Both paths are measured separately, and also against each other on shared scenarios.**
- **Hard gates** (any failure blocks activation):
  - 0 fabricated names (a name unsupported by its citations, per independent reviewers);
  - 0 unsupported personal inferences (diagnosis, motive, trait);
  - 100% citation validity (validator);
  - 0 re-proposals of rejected topics on the same evidence;
  - 0 runs during a live call, and 0 First Audio impact in the concurrency test.
- **Thresholds,** preregistered by the PO before the run:
  - proposal precision (correct members and an acceptable Arabic name);
  - topic coverage;
  - abstention correctness on should-abstain cases;
  - duplicate detection;
  - name acceptability (independent rubric).
- CAL-1 results do **not** count as N4 evidence.

## 7. Forgetting and correction (consumes existing Memory signals; does not change Memory policy)
**Triggers** (all already existing):
- a Memory leaves ACTIVE (forget or correct);
- a dependent Reading is withheld (INTEL-TM-01, 0151);
- a Reading is withdrawn or contested.

**Every membership and every name carries one provenance class:**

| Class | Meaning | Its own basis |
|---|---|---|
| **U** | created independently by the user (topic, typed name, attach) | the user's act |
| **QC** | inferred by Qandeel, then confirmed by the user | the cited evidence; **the confirmation alone is not an independent basis** |
| **QP** | inferred by Qandeel, not confirmed | the cited evidence |

| Class | When part of its evidence is withdrawn | When its **only** basis is withdrawn |
|---|---|---|
| U | unaffected | unaffected. The user deletes it, or account erasure removes it |
| QC | deterministic re-validation (§6.5); kept only if it still validates | `BASIS_WITHDRAWN`: the confirmed status ends, **the derived name text is purged** (removed, not hidden), and the membership ends. The topic shell remains only if other members keep an independent basis |
| QP | re-validation, or withdrawal | withdrawn; text purged |

**Further rules:**
- **No sensitive derivative survives its basis.** Purged text, rejection keys tied to forgotten evidence, and model outputs citing only forgotten evidence are deleted.
- The ledger keeps **content-free** tombstones only: ids, event kind and anchor.
- **No prompt may show a purged name** (for example, "keep this name?"). If the user wants the topic again, they create it in their own words, as class U.
- **Account erasure (0130) and export (PRIV-05)** must cover topics, events, vetoes and rejection keys.

## 8. Disclosure and the Privacy Gate
- **Owner:** **Trust & Privacy** reviews the B1 and B2 gates; **final approval stays with the PO.**
- **WORLD** is a disclosure rung **inside the Personal World**. It is not the Public World and not publication.
- **Nothing reaches Shared or Public worlds automatically:** no topic name, no relation, no topology. Publishing anything from a shared chat stays subject to every concerned participant's consent, under that feature's own contracts.

| Gate | Scope it must review | Opens |
|---|---|---|
| **B1** | topics at WORLD (id, state, name, colour identity, member Thread ids): exposure on screen and in screenshots, Replay and its source video, notifications, logs, export, erasure; masking of sensitive-category names at overview; a visibility setting | CP-D |
| **B2** | **appearance topology** at WORLD (`bindingId, threadId, readingId, boundSp`, no analytical content): which subjects are linked, how densely and when, on every surface listed for B1; the density proof (`QAN-BL-VIS-01`) | CP-F |

**Recorded limitation:** a Replay video already **downloaded or shared outside Qandeel cannot be recalled or deleted remotely.** Forgetting and redaction apply to what Qandeel stores and serves. User-facing copy must say so (Copy Gate).

## 9. Replay V2 (historical, verifiable, never breaking V1)
- **V1 is untouched**, including its re-derivation and every existing fingerprint (0102 / 0169). Old points are never re-pinned.
- **The V2 projection** has a separate schema id and its own pins:
  - the L1 rule version (predicate + K/S + extraction method);
  - the L2 ledger state at TC;
  - the N4 proposal records, which are stored and therefore pinned by storage;
  - the evidence state at TC;
  - activation anchoring at the activation `world_version`, so no earlier Replay ever shows topics.
- **Limited redaction of the affected topic layer** (the PO's preference), made verifiable:
  1. **At pin time,** the V2 topic layer is pinned as an **itemized digest**: an ordered list of per-item digests, one per topic, membership and name item, plus a layer digest over that list.
     - Item digests are **keyed per user**, with a key destroyed on account erasure, so a short name cannot be recovered by guessing.
     - The rest of V2, and V1, keep their own whole-layer digests.
  2. **On forgetting,** an append-only, content-free **redaction record** replaces the affected item digests with tombstones. It records the item slot, the reason class and the anchor.
  3. **At read time,** the topic layer is re-derived. The moment is served only if:
     - every present item matches its pinned item digest;
     - every tombstoned slot is absent;
     - **no item appears that was not pinned.**

     Any other mismatch makes **only the topic layer** of that moment unavailable. The rest of V2, and V1, are unaffected.
  4. **Result:** forgotten data never reappears, nothing future enters the past, and the historical check stays exact. The design is subject to the B1 Privacy Gate and a Replay contract amendment (Annex).
- **The Replay Media Pool stays isolated from the Live Voice Pool.** V2 rendering uses replay media resources only.
- **Video work is not resumed by this record.**

## 10. Order of work, dependencies, and the decision point DP-1
| # | Step | Kind | Depends on | Authorized now? |
|---|---|---|---|---|
| 1 | **CP-A** (this record + amendment drafts + CAL-2 plan) | documentation | — | **yes (Draft PR)** |
| 2 | **CAL-2** stage 2a (pipeline) + stage 2b (N4 prototype, both paths) | paid synthetic evaluation, non-production harness | CP-A approval; a separate run authorization; labels frozen after independent review | **no** |
| 3 | **DP-1: decision point after CAL-2** | PO decision | CAL-2 results | — |
| 4 | Ceiling-policy decision for N4 (§6.10) | PO decision | may be taken at DP-1 | — |
| 5 | **CP-B**: final data design (L1 pure module, L2 ledger, vetoes, forget cascade, erasure and export) | migration + API | DP-1 | **no** |
| 6 | **CP-C**: Replay V2 projection, itemized topic-layer digest and redaction verification (no UI) | DB + API | CP-B | **no** |
| 7 | Privacy Gate **B1** (Trust & Privacy review, PO approval) | gate | CP-C design | **no** |
| 8 | **CP-D**: B1 interface (topics including PROPOSED, corrections, Copy Gate, PT-03 mark) | mobile | CP-C, B1 gate | **no** |
| 9 | **CP-E**: the N4 lane (contract CP, accounting migration, worker and permit, validation, back-off) | API + DB | DP-1, step 4, CAL-2 hard gates passed | **no** |
| 10 | Privacy Gate **B2** + the density proof (`QAN-BL-VIS-01`) | gate + proof | CP-D | **no** |
| 11 | **CP-F**: B2 (appearance topology at WORLD) | API + mobile | step 10 | **no** |
| 12 | Visual integration of the art direction (AD-4 base), i.e. V-3 | design + mobile | CP-D at the earliest | **no** |

**DP-1 decides, from the CAL-2 results:**
- whether N4 path A and/or path B meet the hard gates, and the preregistered thresholds;
- K / S, or keeping them open;
- the eligibility values in §6.2;
- the duplicate values in §6.6;
- the cap values in §6.7;
- whether CP-B proceeds with N4-dependent fields, or with user-made topics only.

**No large topic-ledger implementation starts on CAL-1 alone.**

## 11. Controlled Amendments needed (drafts only)
The drafts and their rationale are in [the companion document](QANDEEL_MAP_VISUAL_REFRESH_01_CP_A_CONTROLLED_AMENDMENT_DRAFTS_v1.md). Each is `PROPOSED — NOT APPROVED — NOT EFFECTIVE`:
- **CA-1**, historical projection: D-12 / D-13;
- **CA-2**, VPORT-01 (territories blocker, rung/zoom coincidence, text on the canvas);
- **CA-3**, LA-VIS-01 colour meaning;
- **CA-4**, the MapCanvas tether-only rule (PT-03 identity mark);
- **CA-5**, Replay V2 pins and topic-layer redaction (`docs/replay-runtime-v1.md`; 0102 / 0169 extension);
- **CA-6**, erasure (0130) and export coverage;
- **CA-7**, AI usage feature family `TOPIC_PROPOSAL` and an N4 permit kind;
- **CA-8**, a QIR-005 cross-reference note, pending the ceiling-policy decision.

0066 / 0068 and I-08B1 are **not** amended.

## 12. Evidence: CAL-1 (synthetic, preregistered, single run)
Full results are in [the CAL-1 record](QANDEEL_MAP_VISUAL_REFRESH_01_CAL_1_SYNTHETIC_RESULTS_v1.md).
- **Hard gates PASS:**
  - order invariance (1,260 checks);
  - no duplicates;
  - vetoes never recur;
  - corrections raise precision from 0.529 to 0.846.
- **Q1 FAIL:** association precision 0.699 against ≥ 0.75. **This is kept as recorded and not lowered.**
- **Ego sets beat cliques:** topic recovery 0.439 vs 0.249; multi-facet topics 0.591 vs 0.348.
- **L1 cannot abstain:** 3.23 candidates per should-abstain persona.
- **What it does not show:** real binding behaviour, and anything about N4.

## 13. Backlog interaction (BG-05 / BG-06)
**No backlog item is inherited, re-owned, admitted or tombstoned at CP-A.** The index stays at 108 items. Related items stay with their owners, unchanged:
- `QAN-BL-VIS-01` (density and LOD proof, owned by LA-SCALE-01) is a prerequisite of step 10.
- `QAN-BL-PRIV-05` (export, PRIV-EXPORT-01) must cover the new tables when they exist.
- `QAN-BL-ACCT-03` and `QAN-BL-PRIV-06` (Replay distribution) apply to any distributed V2 video.
- `QAN-BL-NAV-01` (cross-Session timeline) is untouched.

**Admission at closure.** Any residue that this task's later CPs leave behind must be admitted under BG-06 / BG-08 at the CP that creates it; it cannot survive only in this record.

## 14. Real decisions remaining before CP-B
| ID | Decision |
|---|---|
| D-B1 | **Approve this CP-A contract** (with or without edits), including the N4 two-path contract (§6) and the forgetting policy (§7) |
| D-B2 | **Authorize the CAL-2 run:** the plan version, the USD 6.00 hard cap, the designated independent label reviewer(s) and raters, and the preregistered thresholds |
| D-B3 | **The four-effect ceiling policy for N4** (§6.10): (i) outside its scope with N4's own caps, (ii) counted under an amended policy, or (iii) N4 not activated |
| D-B4 | **The values at DP-1:** K/S (or kept open), N4 eligibility, duplicate and cap values, from the CAL-2 results |
| D-B5 | **The CP-B scope at DP-1:** a full ledger with N4-dependent fields, or user-made topics first |
| D-B6 | **The approval route for each draft Controlled Amendment (CA-1..CA-8),** and when each takes effect (no earlier than the CP that needs it) |

## 15. Not done in CP-A
- No migration, product code, frozen-contract edit, AI call, CAL-2 run or CP-B.
- No backlog change; no V-3; no Replay video work.
- The working checkout on `s8a/s8a-04-cp3` and its local changes were not touched. This record was prepared in a clean worktree from `main`.
