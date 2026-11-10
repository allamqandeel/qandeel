# QANDEEL MAP-VISUAL-REFRESH-01 — CP-A: Personal Map Topics (L0 / L1 / L2, N4, Replay V2): Contract Record v1

**Status:** `MAP-VISUAL-REFRESH-01 CP-A — PLANNING REFERENCE — DIRECTION APPROVED BY THE PO — CLOSED AS PLANNING ONLY (2026-11-10) — NOTHING IMPLEMENTED — AUTHORIZES NO N4, CAL-2 OR CP-B`
**Task:** MAP-VISUAL-REFRESH-01, the Personal Living Analysis map's art direction and information architecture. CP-A is its documentation contract checkpoint.
**Revision:** **R1 (2026-11-10)** applies the Product Owner's review of Draft PR #388, correcting §5, §6.1, §6.6, §6.8–6.11, §7, §9, §10 and §14.
**Planning closure (2026-11-10, MAP-CLOSE-01 Step 1)** updates §1, §2 (item 14), §10 (row 1), §13 and §14. It changes no contract content.
**Authority:** Product Owner decisions of 2026-11-09 and 2026-11-10:
- the IA-GATE review;
- Annex 1;
- Annex 2;
- the decision on CAL-1 and the CP-A package, which authorizes this documentation-only Draft PR;
- the review of Draft PR #388 (2026-11-10). It asks for the R1 corrections and **does not approve merging**;
- MAP-CLOSE-01 Step 1 (2026-11-10). It closes CP-A as a planning reference whose direction is approved, and **it authorizes no implementation.**

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
- **This record is a planning reference whose direction the Product Owner approved on 2026-11-10.** It is closed as planning only.
  - **It authorizes no implementation**: no N4, CAL-2 run, CP-B or later CP.
  - Each later CP in §10 needs its own authorization.
  - A clause here binds a CP only when that CP's authorization adopts it, together with the §14 decisions the CP needs.
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
13. **The review of Draft PR #388 (2026-11-10)** accepts the general engineering direction. It confirms the PR is documentation only, and it does **not** approve merging. R1 corrects four points:
    - overlapping topics in N4 (§6.1, §6.6);
    - forgetting against the event history, and what Replay V2 must prove (§5, §7, §9);
    - N4 against live calls (§6.9);
    - the CAL-2 preconditions (CAL-2 plan §9).

    The PO's **initial** direction on the four-effect ceiling is recorded in §6.10. It is not final and activates nothing.
14. **MAP-CLOSE-01 Step 1 (2026-11-10)** closes CP-A **as planning only.**
    - The direction is approved and this record is kept as the planning reference.
    - Topic-intelligence work does not continue now: no N4, no CAL-2 run, no CP-B.
    - The Controlled Amendment drafts stay `NOT EFFECTIVE`, and CAL-1 and the CAL-2 plan are kept unchanged.
    - The decisions deferred in §14 gate later steps, **not this closure.**

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
  - `personal_topics`: user-scoped, with a stable id and `state` ∈ {PROPOSED, CONFIRMED, WITHDRAWN, REJECTED, DISSOLVED_BY_USER}.
  - **The event spine `personal_topic_events`: append-only and content-free.**
    - A row holds only:
      - ids (topic, member Thread, content reference);
      - the event kind;
      - the actor (USER or QANDEEL);
      - the provenance class;
      - a reason class where relevant;
      - the anchor: `(session_id, session_position, same_sp_event_sequence)`, or `world_version` for acts outside a Session.
    - **It never holds** a name, a normalized name, a hash of a name, a citation, a Reading id or a model output.
  - **Content rows: separate and deletable.**
    - `personal_topic_content`: a name text and its normalized form, per topic version.
    - `personal_topic_citations`: a content row → its cited Reading ids.
    - `personal_topic_rejection_keys` (§6.6).

    The spine refers to content rows by id only.
  - **N4's raw model output is never stored.** On receipt it is validated (§6.5). A valid output is split into content and citation rows, and the raw output is discarded.
- **"Append-only" applies to the spine only.** Purging content is a **hard delete** of content rows, recorded by appending a content-free `CONTENT_PURGED` spine event. The spine is never rewritten (§7).
- **Isolation:** user isolation and default deny, with no direct grant; reads go through the definer projection only (the 0072 pattern).
- **The final schema is designed only after DP-1.** The table names here are contract names, not migrations.
- **Every membership and every name carries a provenance class:** **U** (user-independent), **QC** (Qandeel-inferred, user-confirmed) or **QP** (Qandeel-inferred, unconfirmed). See §7.

**Events:**
- `TOPIC_PROPOSED`: path A/B, the relation to existing topics (§6.1), member ids, and model and prompt version. The name and citations are by content reference;
- `MEMBER_PROPOSED`, `RENAME_PROPOSED`;
- `PROPOSAL_ACCEPTED`;
- `PROPOSAL_REJECTED`: refers to a rejection key by id (§6.6);
- `TOPIC_CREATED_BY_USER`, `NAMED_BY_USER`, `RENAMED_BY_USER`;
- `MEMBER_ATTACHED_BY_USER`, `MEMBER_DETACHED_BY_USER` (sticky);
- `MERGED_BY_USER`, `SPLIT_BY_USER`, `DISSOLVED_BY_USER`;
- `BASIS_WITHDRAWN`, `CONTENT_PURGED` (§7).

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

**Interaction between the paths, and overlapping topics (R1):**
- **A Thread may belong to more than one topic.** Each membership carries its own citations. **No proposal ever removes a Thread from another topic.**
- **Sharing a Thread decides nothing.** Neither path is forced into an extension because a Thread is shared. Neither path creates a second topic for the same subject.
- **When the input contains a Thread already in an existing topic** (any state except REJECTED or DISSOLVED_BY_USER), N4 must state its relation to that topic in an explicit `relation` field:
  - **`EXTENDS(topicId)`.** The cited evidence shows that the new Threads are about **the same subject**. The output is an extension proposal: `MEMBER_PROPOSED`, plus an optional `RENAME_PROPOSED`. A CONFIRMED topic changes only if the user accepts.
  - **`DISTINCT_FROM(topicIds)`.** The cited evidence shows **a different subject** that the shared Thread also belongs to. The output is a new, independent topic proposal. The existing topic is untouched, and the shared Thread keeps its existing membership.
  - **`SAME_AS(topicId)`.** A true duplicate (§6.6). Nothing is proposed.
- **Server checks.** They are deterministic and constrain the model's choice without replacing it:
  - **`EXTENDS`:** every new member cites ≥ 1 current Reading that binds it to a member of the existing topic.
  - **`DISTINCT_FROM`:** all three must hold:
    - the proposal is not a true duplicate (§6.6);
    - its normalized name differs from the existing topic's name;
    - it cites ≥ `DISTINCT_MIN_NEW_CITATIONS` (TBD) current Readings that are **not** in the existing topic's cited basis.

    A `DISTINCT_FROM` whose citations are only the existing topic's basis fails validation.
  - **The semantic choice between `EXTENDS` and `DISTINCT_FROM` is the model's**, and the server cannot verify it. It is measured in CAL-2, through the overlap units in plan §5.1. **It is never claimed from structure alone.**
- **Path A on a Thread that is already a member** is allowed only as `DISTINCT_FROM`, under the same checks.
- **Production rules do not change.** None exists yet. This is the contract that the N4 CP (CP-E) must implement.

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
  - (c) names and member ids of the user's existing topics (PROPOSED and CONFIRMED), for duplicate avoidance only. **Rejected names are never sent:** their text is deleted at rejection (§6.6). They are matched only by the server, using the keyed hash.
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
  - not equal, after normalization, to an existing topic name, nor (by keyed hash) to a rejected one (§6.6).
- **Re-validation:** when evidence is withdrawn, an existing proposal or QC topic is re-checked against §6.3–6.5 without a model call. If it fails, §7 applies.

### 6.6 Duplicates, even when evidence fingerprints differ
A proposal is a **true duplicate** if any of the following holds:
- (a) **Same membership:** its member set equals, or is contained in, the member set of an existing PROPOSED or CONFIRMED topic, and it does not pass the `DISTINCT_FROM` checks (§6.1).
  - **Partial overlap, such as one shared Thread, is not a duplicate.**
  - A high overlap (≥ `DUP_OVERLAP`, TBD) declared as neither `EXTENDS` nor `DISTINCT_FROM` is **suppressed as unresolved**. It is never converted silently.
- (b) **Normalized name equality:** it equals an existing or rejected name after deterministic Arabic normalization (diacritics, alef and yaa forms, taa marbuta, tatweel, the definite article, whitespace). No semantic matching is claimed.
- (c) **Model declaration:** N4 sees the existing topic names (c-input above) and may answer `SAME_AS(topicId)`. The server uses that answer only to suppress.

A true duplicate is suppressed (`DUPLICATE_OF_EXISTING`). **Nothing is ever merged automatically.**

**Rejection memory:**
- A `PROPOSAL_REJECTED` spine event refers to a **rejection key** row. The row holds:
  - member ids;
  - the evidence fingerprint, computed over Reading ids and versions only;
  - a **keyed** hash of the normalized name: an HMAC under a per-user key, which is destroyed on account erasure.
- **At rejection, the rejected name text is hard-deleted** (`CONTENT_PURGED`, reason `REJECTED_BY_USER`). The keyed hash is still a derivative, so it lives only as long as its evidence.
- **The same proposal is never re-proposed on the same evidence.**
- A re-proposal of a rejected topic needs both:
  - ≥ `REPROPOSE_NEW_EVIDENCE` (TBD) **new** current Readings cited that were absent from the rejected fingerprint;
  - the passing of `REPROPOSE_COOLDOWN` (TBD).
- **When rejected evidence is forgotten:**
  - the key is recomputed over the remaining current evidence ids, so the rejection still covers what remains;
  - when none of its evidence remains, the key is deleted, name hash included (§7).

### 6.7 Caps (values TBD by the PO; none is measured)
- Per user: ≤ `N4_PER_USER_DAY` calls per day and ≤ `N4_PER_USER_WEEK` per week; at most 1 in flight.
- Globally: ≤ `N4_GLOBAL_DAY` calls per day and a `N4_GLOBAL_USD_DAY` spend ceiling. Reaching either pauses N4 until the next window. There is no backlog burst.
- Per trigger: exactly 1 call. A transient provider failure is retried at most once, then the trigger is dropped until the next material change.

### 6.8 Accounting and model cost
- Every call goes through the accounted provider clients.
- It uses a **new ai-usage feature family** (`TOPIC_PROPOSAL`). The family enum is closed, so this needs a migration in a later CP.
- Attribution: user, world, path (A/B), and model and prompt version. The accounting row holds no evidence fingerprint and no content.
- **The model is chosen in the N4 contract CP, after CAL-2.** Cost per call comes from the repository's pricing table. It is **not estimated here.**

### 6.9 Live calls: admitting new work, work in flight, and provider capacity (R1)
**Facts on `main` at `06f24a73`:**
- The live call's REALTIME reply, which precedes First Audio, uses DeepSeek through its own router (`live-call-model-router.ts`): first token 2,000 ms, 5,000 ms, `max_tokens` 160.
- The repository configures one `DEEPSEEK_API_KEY`, so live replies and background work **share one provider account** unless a separate key is configured.
- The background permit pool (0191: B_total 16, B_min 2, k 2, two per person) has three kinds: CALL_ANALYSIS, TEXT_SEMANTIC_ANALYSIS and POST_RESPONSE_INTELLIGENCE.
- **The repository has no DeepSeek rate limiter and no provider-capacity reservation.**

**The earlier wording conflicted.** It said both "never runs during the user's active call" and "in-flight N4 calls are not cancelled". Three separate controls replace it.

**N4 priority is unchanged:** it is the lowest-priority intelligence work, and it is never on the reply, First Audio or text-delivery path.

| Control | Rule | What it guarantees | What it does not |
|---|---|---|---|
| **1. Admitting new work** | An N4 job is admitted, and its single provider request sent, only while the gate is open (see below). The gate is checked at admission **and again immediately before the request is sent.** A closed gate defers the job, without queueing it for a later burst. | **no N4 request starts** under pressure | anything about requests already in flight |
| **2. Work in flight** | Every N4 request carries a hard timeout `N4_MAX_INFLIGHT_MS` and a small `max_tokens`. When the **user's own** call starts, their in-flight N4 request is aborted client-side and its result discarded; the attempt is still accounted. Under pressure from **other users'** calls, in-flight requests end within `N4_MAX_INFLIGHT_MS`, and none starts. | a **bounded** overlap: at most `N4_GLOBAL_CONCURRENCY` requests, each for at most `N4_MAX_INFLIGHT_MS` | that the provider stops computing or billing an aborted request |
| **3. Provider capacity** | N4 has its **own pool** of `N4_GLOBAL_CONCURRENCY` slots (proposed default 1), counted across all API instances. It never draws from the 0191 pool, the Live Voice Pool or any call resource, and none of those ever waits on it. **With the shared key,** N4 may send only while the in-flight provider requests of all classes number fewer than `PROVIDER_CAPACITY − LIVE_RESERVE`. **With a separate N4 key,** the provider-account quota is isolated too (D-B7). | N4 never takes capacity reserved for calls in progress, **as counted by Qandeel** | provider-side isolation under a shared key. A shared account can still be throttled as a whole |

**The gate (control 1) is open only while all of the following hold:**
- the user has no active call;
- live calls system-wide number fewer than `N4_LIVE_CALL_CEILING`;
- no 429, 5xx or timeout on live paths within `N4_PRESSURE_WINDOW`;
- control 3 has a free N4 slot.

When any condition breaks, the gate closes at once and reopens after an exponential back-off.

**Values.** All are TBD, and the mechanism is mandatory. Neither `PROVIDER_CAPACITY` nor `LIVE_RESERVE` is known in the repository; both must be measured.

**Two different tests prove this. Neither substitutes for the other.**
- **ST, the synthetic scheduling test.** It uses no provider and costs nothing. It covers:
  - the gate and its re-check before sending;
  - the cross-instance N4 slot count;
  - the abort on the user's own call;
  - the timeouts;
  - that N4 holds no permit from any other pool.

  **It proves the scheduling logic only**, and nothing about provider behaviour or First Audio.
- **RT, the real-call performance test.** It uses real providers and synthetic users, in a local or test environment, under its own authorization and cost cap.
  - It measures First Audio p50 / p95, plus live-reply errors and timeouts, under two conditions: N4 off, and N4 at its maximum admitted load on the same key. Both run at `N4_LIVE_CALL_CEILING` concurrent calls.
  - **Pass:**
    - the First Audio difference is within a PO-set `ΔFA`;
    - live-path 429s, 5xx and timeouts do not increase.
  - **Isolation is claimed only from RT.** RT is a precondition of N4 activation, at the exit of CP-E. **It is not part of CAL-2.**

### 6.10 Relation to the four-effect ceiling
- The Founder's ceiling ("أربعة مؤثرات مزود كحد أقصى"; `post-response-provider-budget.ts`, `POST_RESPONSE_PROVIDER_EFFECTS_V2`) caps provider-backed **post-response effects per completed turn**.
- **N4 is not placed in that dispatcher, and that placement is not a way around the policy.** This record does **not** decide whether the policy's intent also covers world-level model work such as N4.
- **N4 cannot be activated until the PO decides one of:**
  - (i) N4 is outside the ceiling's scope, with its own caps (§6.7);
  - (ii) N4 counts against an amended policy;
  - (iii) N4 is not activated.
- Any budget or effects-policy expansion is a separate, versioned decision.
- **The PO's initial direction (2026-11-10) is option (i).** N4 is a separate world-level task with explicit financial and operational caps (§6.7, §6.9). It is **not** one of the four per-turn effects.
  - **This is not final.** It takes effect only after the PO's final approval, documented through governance (CA-8 option (i), issued as a Controlled Amendment).
  - Even then, it activates nothing alone: §6.11 and RT still apply.

### 6.11 Evaluation method (fixed here, before any database design is finalized)
- N4 is evaluated in **CAL-2** (its own plan; paid; separately authorized).
- **Both paths are measured separately, and also against each other on shared scenarios.**
- **Hard gates** (any failure blocks activation):
  - 0 fabricated names (a name unsupported by its citations, per independent reviewers);
  - 0 unsupported personal inferences (diagnosis, motive, trait);
  - 100% citation validity (validator);
  - 0 re-proposals of rejected topics on the same evidence;
  - 0 N4 requests admitted while the gate is closed (ST, §6.9);
  - 0 memberships removed by a `DISTINCT_FROM` proposal, and 0 true duplicates admitted (§6.1, §6.6);
  - before activation, **RT** passes (§6.9). A scheduling test alone never meets this gate.
- **Thresholds,** preregistered by the PO before the run:
  - proposal precision (correct members and an acceptable Arabic name);
  - topic coverage;
  - abstention correctness on should-abstain cases;
  - duplicate detection;
  - on overlap units, the choice between `EXTENDS` and `DISTINCT_FROM`;
  - name acceptability (independent rubric).
- The proposed numeric values, the reviewers and the INCOMPLETE rule are in CAL-2 plan §9.
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

**How deletion fits an append-only history (R1).**
- The spine (§5) is append-only and content-free; content rows are deletable.
- Forgetting **never rewrites the spine.** It hard-deletes the affected content rows and appends `CONTENT_PURGED`, which carries the content reference id and a reason class: `MEMORY_FORGOTTEN`, `READING_WITHHELD`, `READING_WITHDRAWN`, `REJECTED_BY_USER` or `USER_DELETED`.
- The forgotten Reading's id is never written into the spine.
- **What stays:**
  - that a topic existed;
  - its state transitions;
  - member Thread ids;
  - provenance classes;
  - anchors.

  That is enough for the history and for Replay ordering. **What goes:**

| Derived item | Deleted when |
|---|---|
| a QC or QP name text, with its normalized form | its only basis is withdrawn; or the proposal is rejected |
| citation rows | the cited Reading is forgotten, withheld or withdrawn |
| N4 raw model output | never stored; discarded after validation (§5) |
| a rejection key's evidence fingerprint | recomputed over the remaining evidence when part of it is forgotten (§6.6) |
| a rejection key, with its keyed name hash | none of its evidence remains, or the account is erased |
| Replay V2 item salts of the affected items | the item's content is purged (§9) |
| accounting rows (`ai_provider_calls`) | **kept.** They hold no content and no evidence fingerprint (§6.8) |

**Further rules:**
- **No sensitive derivative survives its basis.**
- **No prompt may show a purged name** (for example, "keep this name?"). If the user wants the topic again, they create it in their own words, as class U.
- **Account erasure (0130) and export (PRIV-05)** must cover:
  - the topics and the spine;
  - content rows;
  - vetoes;
  - rejection keys and the per-user HMAC key;
  - Replay V2 salts and redaction records.

**Limits recorded for Trust & Privacy (B1):**
- Database backups, and the provider's own retention of request data, lie outside this deletion. Their retention must be reviewed.
- The spine keeps the opaque Thread ids of QC and QP memberships. Whether those ids must also leave the spine on forgetting is open (D-B8).

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
- **Limited redaction of the affected topic layer** (the PO's preference).
- **Status: `DESIGNED — NOT PROVEN`.** Writing the design down proves nothing. The proof obligations RV2-P1..P7 below must pass at CP-C, before the B1 gate.
  1. **At pin time:**
     - every topic-layer item (topic, membership, name) gets a fresh random 256-bit **salt**, held in a deletable salt row;
     - the item digest is H(salt ‖ canonical item);
     - the point pins the ordered list of item digests, plus a layer digest over that list;
     - the rest of V2, and V1, keep their own whole-layer digests.
  2. **On forgetting:**
     - the affected items' **salts are deleted at every pinned point**, together with their content rows (§7);
     - an append-only, content-free **redaction record** names the slot, the reason class and the anchor.

     The item digest stays in the pinned list, so the layer digest still verifies. **Without its salt, though, the digest can no longer be matched against any candidate name.**

     *R1 change:* this replaces the per-user keyed digest. Anyone holding a per-user key could still test guesses of a short name.
  3. **At read time:**
     - verify the layer digest over the pinned list;
     - re-derive the topic layer from the spine and the surviving content rows;
     - remove the slots that redaction records name.

     The moment is served only if:
     - every non-redacted slot matches its pinned digest under its salt;
     - every redacted slot is absent;
     - **no item appears that was not pinned.**

     Any other result makes **only the topic layer** of that moment unavailable. The rest of V2, and V1, are unaffected.
- **Proof obligations** (CP-C; local PostgreSQL; synthetic fixtures; **none run by this record**):

| Id | Obligation | Pass |
|---|---|---|
| RV2-P1 | V1 unchanged | V1 projection bytes and every V1 digest are identical before and after V2 is installed, and before and after the fixture's forgetting events; no diff to 0102, 0169 or V1's files |
| RV2-P2 | re-reading the past after forgetting | a moment pinned before forgetting is served, with the forgotten item absent and every other item verified |
| RV2-P3 | no leak | after forgetting, the purged name and its normalized variants occur 0 times in the API response, the server logs, and a full database dump (spine, redaction records, accounting included) |
| RV2-P4 | no recovery by guessing | for a redacted slot, a test dictionary that contains the true name matches no stored value, because the salt is absent from every table |
| RV2-P5 | tampering | an altered item, an unpinned item or an altered pinned list each makes only the topic layer unavailable; the rest of V2, and V1, are served |
| RV2-P6 | nothing future in the past | a topic created after TC never appears at TC; moments before activation show no topic layer |
| RV2-P7 | erasure | after account erasure, no salt, content row, rejection key or spine row of the user remains |

- **The design remains subject to** the B1 Privacy Gate and a Replay contract amendment (CA-5). **Backups keep salts until their retention expires;** that goes to Trust & Privacy at B1 (§7).
- **The Replay Media Pool stays isolated from the Live Voice Pool.** V2 rendering uses replay media resources only.
- **Video work is not resumed by this record.**

## 10. Order of work, dependencies, and the decision point DP-1
| # | Step | Kind | Depends on | Authorized now? |
|---|---|---|---|---|
| 1 | **CP-A** (this record + amendment drafts + CAL-2 plan) | documentation | — | **closed as planning only (2026-11-10)** |
| 2 | **CAL-2** stage 2a (pipeline) + stage 2b (N4 prototype, both paths) | paid synthetic evaluation, non-production harness | CP-A approval; a separate run authorization; **every precondition in plan §9 evidenced** (spend-guard proof, run-day price review, numeric thresholds, named reviewers and label sign-off) | **no** |
| 3 | **DP-1: decision point after CAL-2** | PO decision | CAL-2 results | — |
| 4 | Ceiling-policy decision for N4 (§6.10) | PO decision | may be taken at DP-1 | — |
| 5 | **CP-B**: final data design (L1 pure module, L2 ledger, vetoes, forget cascade, erasure and export) | migration + API | DP-1 | **no** |
| 6 | **CP-C**: Replay V2 projection, salted itemized topic-layer digest and redaction verification (no UI); **RV2-P1..P7 must pass** (§9) | DB + API | CP-B | **no** |
| 7 | Privacy Gate **B1** (Trust & Privacy review, PO approval) | gate | CP-C design | **no** |
| 8 | **CP-D**: B1 interface (topics including PROPOSED, corrections, Copy Gate, PT-03 mark) | mobile | CP-C, B1 gate | **no** |
| 9 | **CP-E**: the N4 lane (contract CP, accounting migration, worker, own pool and gate, validation, back-off); ST inside CP-E; **RT before any activation** (§6.9) | API + DB | DP-1; step 4 approved and documented; CAL-2 hard gates passed | **no** |
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

**Deferred work and BG-08.** CP-A's planning closure is a checkpoint, not the closure of MAP-VISUAL-REFRESH-01, so BG-08 reconciliation does not run now.
- The deferred work **stays owned by MAP-VISUAL-REFRESH-01**:
  - CAL-2 and DP-1;
  - CP-B..CP-F;
  - ST and RT;
  - RV2-P1..P7;
  - the decisions D-B2..D-B8 (§14).
- **If that task, or MAP-CLOSE-01, closes without delivering this work, the closing change must admit every qualifying item under BG-06 / BG-08.** None of it may survive only in this record.
- Any residue a later CP leaves behind is admitted at the CP that creates it.

## 14. Decisions: D-B1 resolved; the rest deferred to the steps they gate
**None of D-B2..D-B8 blocks CP-A's closure as planning.** Each is needed only before the step it gates.

| ID | Decision | State | Needed before |
|---|---|---|---|
| D-B1 | **Approve this CP-A contract** (with or without edits), including the N4 two-path contract (§6) and the forgetting policy (§7) | **RESOLVED (2026-11-10):** direction approved; closed as a planning reference (MAP-CLOSE-01 Step 1). Each clause is adopted for implementation by the CP that implements it | — |
| D-B2 | **Authorize the CAL-2 run.** This covers: the plan version; the USD 6.00 hard cap; and every precondition in plan §9 (the spend-guard proof, the run-day price review, the numeric thresholds, the named independent label reviewers and raters, and their sign-off method) | deferred | any paid CAL-2 call |
| D-B3 | **The four-effect ceiling policy for N4** (§6.10). The PO's **initial** direction is option (i), N4 as a separate world-level task with its own caps. Final approval, and its documentation as CA-8 (i), are still required | deferred (initial direction recorded) | CP-E, and any N4 activation |
| D-B4 | **The values at DP-1:** K/S (or kept open), N4 eligibility, duplicate and cap values, from the CAL-2 results | deferred | DP-1 |
| D-B5 | **The CP-B scope at DP-1:** a full ledger with N4-dependent fields, or user-made topics first | deferred | CP-B |
| D-B6 | **The approval route for each draft Controlled Amendment (CA-1..CA-8),** and when each takes effect (no earlier than the CP that needs it) | deferred | the CP that needs each amendment |
| D-B7 | **N4 provider-capacity isolation** (§6.9): a separate DeepSeek key for N4, or the shared key with measured `PROVIDER_CAPACITY` / `LIVE_RESERVE`; plus the RT pass value `ΔFA` | deferred | CP-E's RT, and any N4 activation |
| D-B8 | **Trust & Privacy items raised by R1** (§7, §9): backup and provider-side retention against deletion; and whether the Thread ids of QC / QP memberships leave the spine on forgetting | deferred | the B1 gate |

## 15. Not done in CP-A
- No migration, product code, frozen-contract edit, AI call, CAL-2 run or CP-B.
- No backlog change; no V-3; no Replay video work.
- R1 only documents the spend-guard proof, ST, RT and RV2-P1..P7. **None of them was run, and none is claimed.**
- The working checkout on `s8a/s8a-04-cp3` and its local changes were not touched. This record was prepared in a clean worktree from `main`.
