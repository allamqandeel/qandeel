# QANDEEL — E2E-01 Next Closure Waves v1

**Status:** `PROPOSED FOR PRODUCT OWNER REVIEW` — **planning evidence, not Product authority.**
**Baseline:** `d4b20344239654fea737afb3c03036d1bb4ef0d9`
**Revision:** E2E-01R targeted correction — the former nine-row W1 is split into W1A (authenticated Conversation core)
and W1B (account identity and first use); the Product Owner's visual-foundation sequencing instruction is recorded (§2).
E2E-01R2 — W1A reduced to its minimal core (B-03, B-04, B-07); B-01 moved to the adjacent shell track W1C; D-13 moved to
W3. No row's classification or bucket changed.

This file groups the [gap matrix](QANDEEL_E2E01_GAP_MATRIX_v1.md)'s 154 rows into small closure waves. It does **not**
decide the Product Owner's sequence, does **not** amend [`QANDEEL_PRODUCT_ROADMAP.md`](../../QANDEEL_PRODUCT_ROADMAP.md),
and opens **no** task. Every wave still needs its own Task Contract; a wave that includes implementation also needs the
Production Integration authorization the roadmap (§4) reserves for after the audit's closures.

The wave numbers are labels, not an order. §1 states the grouping criteria; §2 argues for one candidate first wave; the
Product Owner decides.

---

## 1. Grouping criteria

In the order the task names them:

1. **Dependency.** A wave contains only rows in one dependency bucket. Provider-blocked, economy-blocked, standalone and
   pre-launch rows are listed separately (§3–§5) and are never folded into a ready wave.
2. **User-journey coherence.** A wave closes something a user can do from start to finish, not a scatter of screens.
3. **Existing frozen authority.** A wave prefers rows whose Product decision is already frozen, so it consumes authority
   instead of creating it. Each wave lists the Product Owner decisions it touches (§6) so they can be taken first.
4. **Implementation readiness.** A wave prefers rows whose backend already exists.

Every one of the 74 `READY — PROVIDER-INDEPENDENT` rows is placed in exactly one wave below.

---

## 2. Provider-independent waves

The first candidate is split into a minimal core and three adjacent pieces. W1A is the provider-independent Conversation
core for a user who **already has an account and is already signed in**. W1B is the account-identity and first-use track
that a **new** user needs. W1C is the Global Shell, which waits on an open sequencing question. Memory through
Conversation (D-13) sits in W3, after the Conversation surface exists. They are separate because their dependencies
differ: W1A needs only what exists today (Supabase sign-in, the conversation API) and carries no open Product or
sequencing dependency; W1B needs a Name / Login ID store and sign-up that do not exist, and one of its rows waits on an
open Product Owner decision (A-10 email verification); W1C waits on what the Shared / Public destinations show before
their surfaces exist; D-13 waits on the Conversation surface and on end-to-end runtime verification.

### W1A — Authenticated Personal Conversation core — *candidate first implementation slice*

| Rows | 3 — E2E-B-03, B-04, B-07 |
|---|---|
| Who | an existing, already-authenticated user (T-14 Email sign-in exists today) |
| Journey | signed in → open Conversation from the Analysis it pairs with → write and send → read QANDEEL's reply and the conversation so far → switch to Analysis and back |
| Frozen authority consumed | G1.1 §1, §3 (Writing is Conversation-first; `UTTERANCE` role; speaker side independent of bidi); P4-C4 `door`, `doorName`, `backName` |
| Backend | exists: sessions, `POST …/turns`, temporal catch-up, historical projection ([`conversation.controller.ts`](../../apps/api/src/conversation/conversation.controller.ts)) |
| Proof | G1.1-R3 (Conversation, bidi); G3 (the Conversation ↔ Analysis pair) |
| Visual foundation | consumed from the first production implementation (see below); the relevant K-12 / K-13 primitives and the D-10 Dark default land before or with each W1A surface |
| Decisions to take with it (§6) | B-05 turn cancel; B-06 reply failure wording; K-01 loading state; K-05 / K-06 failure; K-14 returning-user landing |
| Not in it | first use and the named openers (W1B); Global Shell completion — the three-area Global Switcher (W1C); Memory-through-Conversation behaviour (D-13, W3); Voice (the composer is Writing only); Shared / Public implementation (W6, W7); relevance (`QAN-CTX-01`); the full I-08B1 world port (W4) |

**Why it is the strongest candidate, on repository truth alone:**

- **It is the one gap that makes QANDEEL unusable.** Today a signed-in user cannot say anything to QANDEEL. Every other
  Personal moment — the Living Analysis World, Understanding, Memory, proactive Activity, Replay — shows the result of a
  conversation the app cannot have. Without it the map stays empty ([master audit](QANDEEL_E2E01_COMPLETE_PRODUCT_JOURNEY_SURFACE_CENSUS_v1.md) §1).
- **It is frozen.** All 3 rows are `DECIDED — NOT IMPLEMENTED`. No row needs a new Product rule; the adjacent decisions are
  small and named.
- **It uses the existing backend path.** The Conversation API has existed since the Engineering Foundation; W1A adds a
  client, not a runtime.
- **It carries no unresolved dependency.** An existing account signs in through T-14 today, and none of its 3 rows uses
  `{display_name}`. Both frozen openers do — the normal opener (G1.1 §1, B-02) and the First Conversation Opening (A-14) —
  so both sit in W1B. Accounts created through T-14 today have no stored Name, so the named opener arrives with W1B;
  W1A invents no fallback greeting. It does not need the three-area switcher (W1C), and it claims no Memory behaviour
  that has not been verified (D-13).
- **It is provider-independent.** The turn path runs through the existing Model Router; the provider choice (QIR-001,
  coupled to the audit's benchmark) changes quality and cost, not the surface. W1A selects no provider.
- **It makes later evidence real.** The roadmap asks the benchmark to "reflect real QANDEEL use" (§3). A Conversation
  surface is the first place real QANDEEL use can happen. This is an observation about evidence, not a benchmark proposal.
### W1B — Account identity and first use — *adjacent prerequisite track*

| Rows | 5 — E2E-A-09, A-13, A-14, B-02, K-02 |
|---|---|
| Who | a new user, from account creation to the first conversation; and every user's named greeting |
| Journey | create an account (Name, Login ID, Password, verified Email) → first use (definition → Welcome → start) → the First Conversation Opening «أنا معك يا {display_name}.» → an empty world that says where to start; later, the normal opener «اهلا يا {display_name} ...» on each new conversation |
| Frozen authority consumed | P1 §4 (sign-up fields); I-08A4 §12–§15, §20 (first-use flow and text); G1.1 §1 and P4-C4 `opener` (normal opener); P4-C2 §5 (First Conversation Opening distinct from the normal opener) |
| Backend | Supabase auth exists; **no Name or Login ID store** — the DB trigger creates a bare `public.users` row. `{display_name}` has no source until A-09 lands |
| Proof | G1.1-R3 and P4-C3 opener boards. **Undrawn:** sign-up (`P4-GAP-020`, `-039`) and the first-use screens (`P4-GAP-034`, `-039`) |
| Depends on | A-09's Name / Login ID persistence for A-13, A-14 and B-02; the open email-verification decision (A-10, §6) for sign-up to complete; W1A's Conversation surface for A-14, B-02 and K-02 |
| Visual foundation | as W1A: consumed from the first production implementation |
| Note | A-07 (sign in with Login ID) stays in W2 but also depends on the Login ID store this track creates |

### W1C — Global Shell — *adjacent provider-independent shell track*

| Rows | 1 — E2E-B-01 |
|---|---|
| Journey | move between QANDEEL, «العالم المشترك» / Shared World and Public World through the Global Switcher |
| Frozen authority | I-08A4 §3–§4 as amended by G1.1 / G1.2 (Personal-centered shell, exactly three areas, switching ≠ pushing, local-only Back; area name «العالم المشترك» / Shared World, singular regardless of count, G1.2 §3); P4-C1 SW-3 Keyed Seam, Q-A; P2 navigation glyphs |
| Proof | P4-C (shell); P2 glyphs frozen |
| Open dependency | the Shared and Public destinations have no Product surface (W6, W7). What they show before those surfaces exist is an open sequencing question (master audit §7.7). This document invents no placeholder behaviour; B-01 is not dependency-free until that question is answered |
| Visual foundation | as W1A |
**Visual foundation — sequencing instruction from the Product Owner.** Any new production QANDEEL surface consumes the
already-frozen visual foundation from its **first** production implementation. No temporary generic UI is accepted as
the production realization of a surface, and nothing is built generic to be "skinned later". In practice:

- the visual-system primitives a surface needs — typography, Living Brass material, Dark / Light appearance rules,
  semantic and interaction colour, accessibility transformations, iconography (I-08B3.0-E3, I-08B3.1 A–F, P2, the G1 / G3
  shell and Conversation proofs) — land **before or with** that surface;
- production Conversation is built in QANDEEL's final visual language from day one;
- K-12, K-13 and D-10 keep their single placement below (W4, W3) for accounting; W1A / W1B / W1C realize the parts they need
  and do not wait for those waves to close;
- W4 still owns the **full** Living Analysis World (I-08B1) port and its stress proof, as its own bounded work. W1A does
  not have to absorb W4 before it can start.

This is an execution instruction. It changes no frozen visual value or contract.

### W2 — Get in and out: launch, sign-in, sign-out

| Rows | 5 — E2E-A-01, A-02, A-06, A-07, D-07 |
|---|---|
| Journey | install → launch with the QANDEEL brand → sign in with Login ID or Email → sign out |
| Frozen authority | P4-C2 §1–§2 and P4 §6 (brand, static launch / handoff); P1 §2–§3, §8.1; T-14 |
| Backend | Supabase auth exists; **no Login ID store** (created by W1B) |
| Proof | P4-C3 launch boards |
| Decisions to take with it (§6) | A-08 failure / Login ID help copy; A-11 password recovery; A-12 session-expired treatment |
| Out of it | account creation (W1B); the lantern moment (`QAN-BL-LANTERN-01`); credential hardening (`QAN-SEC-01`) |

### W3 — General Settings, identity, appearance and Understanding

| Rows | 9 — E2E-D-01, D-02, D-03, D-05, D-09, D-10, D-13, D-14, D-15 |
|---|---|
| Journey | open General Settings from Personal → see and edit my identity → choose Dark / Light / System → open «فهم قنديل» and disagree with an item → ask QANDEEL in conversation what it remembers, correct it, ask it to forget |
| Frozen authority | P1 §2, §6, §8, §9, §10–§12; P4-C1 S-B, U-A; P4-C4 group names, Public ID and confidence rows |
| Backend | Public ID tables (no application role); Memory / HIM runtime internal only; **no Understanding projection endpoint**; contested runtime (PG-01) absent |
| Proof | P4-C placement boards only. **Undrawn:** Settings screens, the Understanding surface (`P4-GAP-039`) |
| Decisions to take with it (§6) | D-04 email change; D-06 security controls; D-08 Shared ID format; D-11 language; D-12 accessibility preferences; D-16 export; D-17 account deletion |
| Depends on | W1A for the "talk to QANDEEL about this" path in D-15 and for D-13 |
| Memory through Conversation — D-13 | P1 §9 keeps Memory control in conversation; there is no Memory editor page in v1 and none is proposed. D-13 needs the W1A Conversation surface first, and whether the conversation runtime honours "what do you remember / correct / forget" end to end is an explicit unknown (master audit §7.2). It must be verified end to end before the capability is called complete |

### W4 — QANDEEL's own visual system on the implemented surfaces

| Rows | 15 — E2E-B-08, B-09, B-10, B-11, B-12, B-13, B-14, B-17, B-18, K-04, K-09, K-10, K-11, K-12, K-13 |
|---|---|
| Journey | the Analysis as one dark place; the I-08B1 world instead of grey circles; the P2 spine; approved AR / EN copy on the Timeline and temporal navigation; compact Return |
| Frozen authority | I-08B1; G3 §C (and §F's unimplemented list); I-08B3.0-E3 / I-08B3.1 A–F; P2; P4-C4 Timeline / preview / live rows; T-10, F1R2 |
| Backend | not needed — the client runtime exists |
| Note | this is the only wave whose rows are mostly **already implemented**: 11 of 15 are `IMPLEMENTED — PRODUCT/VISUAL FINALIZATION MISSING`. B-18 carries `QAN-BL-VIS-01`'s heavy-history proof, which the port may trigger by its own reopen condition |

### W5 — Activity, notifications and Direct Entry

| Rows | 14 — E2E-E-01 … E-07, E-09, E-11 … E-15, K-08 |
|---|---|
| Journey | notice something → open Activity → tap into the exact context → tune notifications, Quiet Hours and Lock Screen privacy |
| Frozen authority | I-08N-01; P3 (fully realized, 72 residual copy rows approved by P4-C4) |
| Backend | none — no Push transport, device token, feed store or proactive producer; the operational outbox is content-free and is not a user channel |
| Decisions to take with it (§6) | E-10 permission-education sheet copy |
| Coupling | Activity's sources are mostly Shared, Public and Introductions, which have no surface. After W1A only "From QANDEEL" and "System" would have producers. The Push provider (APNs / FCM) is infrastructure, not an AI provider |

### W6 — Shared World Product surface

| Rows | 11 — E2E-G-01, G-02, G-03, G-04, G-08, G-09, G-10, G-11, G-12, G-14, G-15 |
|---|---|
| Journey | open Shared → invite with a Shared ID → accept → birth → share context deliberately → govern, add history, leave, delete my words → return by link |
| Authority | I-08A4 IA; P1 §5; the Shared Product definition (vision); CW2-02, CW2-03, CW2-07 |
| Backend | closed / frozen in its backend scope (I-02 … I-04) and fail-closed; **four RPCs are directly callable by `authenticated`**; the rest are role-gated; no Nest Product route or module; no mobile surface |
| Needs first | a Product surface design for the whole family (no Shared screen is drawn); an Architecture decision on the application-role boundary (routes / grants) for the primitives that today no role can execute; CW2-08 / `I-09` for production serving |
| Decisions to take with it (§6) | G-05 Shared conversation and multi-human attribution; G-13 the closed world's name; G-18 former-member control |

### W7 — Public World Product surface

| Rows | 6 — E2E-H-01, H-03, H-04, H-08, H-09, H-11 |
|---|---|
| Journey | enter Public → search → open an Experience → choose alias or Name → meet a disappeared Experience; opt into Discovery |
| Backend | closed / frozen in its backend scope (I-05); readers `service_role` only; publication fails closed on `NOT_EVALUATED`; nothing can be served in production until CW2-08 / `I-09` |
| Decisions to take with it (§6) | H-02 lens ranking; H-05 discussion structure; H-06 reactions; H-07 publication, including `QAN-BL-CW-01`'s open ruling |
| Note | the smallest ready wave by user value until `I-09` clears serving; it can be designed now but not shipped |

### W8 — Replay entry, selection and preview

| Rows | 5 — E2E-J-01, J-02, J-03, J-05, J-07 |
|---|---|
| Owner today | `QAN-BL-NAV-02` — `OPEN — UNASSIGNED`; a wave here would give it an owner |
| Backend | I-06 closed / frozen in its backend scope; writers executable by no role; no media, storage or transport |
| Note | stops before playback (J-04, Voice-blocked) and sharing (J-06, `I-09`). Depends on W1A: there is nothing to replay until a conversation exists |

---

## 3. Blocked on the Voice runtime / provider — `QAN-BL-VOICE-01`

18 rows. None is placed in a ready wave; none is solved here; no provider is proposed.

| Rows | What waits |
|---|---|
| E2E-C-01 … C-14 | the whole Personal Voice Note and Live Call family: capture, playback, transcript, call start, in-call switching, signal morphology, state strings, background, interruption, microphone permission, finished-call record, spoken reply, voice choice, durable audio |
| E2E-E-08 | call-safe attention (needs a call authority) |
| E2E-G-06 | Shared World Voice Notes (media storage) |
| E2E-I-11 | Matching deferred during a Live Call (G3 §D) |
| E2E-J-04 | Replay playback (media and, for Personal, durable original audio) |

What is already frozen and waits only for the runtime: G1.2 §1–§5, P2 Call Rail A, the P4 non-signal Voice visuals, P3 §9.
What is gated and must not be faked: signal-bearing morphology and the Voice / call strings (P4-C2 §4–§5).

## 4. Blocked on the economy / provider cost

6 rows — E2E-F-01 … F-06: Plan / Usage entry, plan and entitlements, credits and usage, exhaustion, purchase,
premium-gated actions. The only binding law is CW2-08 §20 / §23. The census proposes no price, formula, unit, allowance,
rollover or top-up; the roadmap (§3) couples all of it to measured provider and workload evidence.

## 5. Standalone owned and pre-launch

### Standalone owned — 21 rows

| Owner | Rows |
|---|---|
| `QANDEEL — Lantern Gateway Identity Moment v1` (`QAN-BL-LANTERN-01`) | E2E-A-03 |
| `QAN-CTX-01` (`QAN-BL-CTX-01`) | E2E-B-16 |
| `QAN-SEC-01` (`QAN-BL-SEC-01`) | E2E-K-15 |
| Connected Worlds `I-08` | E2E-I-01 … I-10, I-12 |
| Connected Worlds `I-09` / CW2-08 | E2E-G-16, G-17, H-10, H-12, I-13, J-06, J-08 |

The Lantern moment is classified only; nothing of its design, motion, interaction or technology is proposed here.

### Pre-launch only — 3 rows

E2E-D-18 (support, help, legal, version), E2E-G-07 (human-to-human Shared call behind its legal gate), E2E-K-16 (device
validation and store release). Owned by Release Hardening & Launch ([ROADMAP](../../QANDEEL_PRODUCT_ROADMAP.md) §5), with
`I-09` for the legal gate.

---

## 6. Product Owner decisions the census found

32 rows carry `PRODUCT OWNER DECISION REQUIRED`: a Product decision is missing and cannot be inferred from frozen
authority. The census does not propose answers.

| Row | Decision needed | Nearest wave |
|---|---|---|
| E2E-A-04 | the Maintenance Mode user moment (`PO-OPS-16`) | — |
| E2E-A-05 | the Minimum Supported Version / upgrade experience (`PO-OPS-16`) | — |
| E2E-A-08 | final sign-in failure and Login ID help copy (`P4-GAP-031`) | W2 |
| E2E-A-10 | the email-verification mechanism and when it blocks use | W1B |
| E2E-A-11 | the password recovery / reset journey | W2 |
| E2E-A-12 | how a user learns their session ended | W2 |
| E2E-B-05 | whether and how a user cancels an in-flight reply | W1A |
| E2E-B-06 | Personal reply-failure wording and retry | W1A |
| E2E-B-15 | where explicit Context Activation lives now that the Live Context surface is retired | W1A / W3 |
| E2E-B-19 | whether and how earlier conversations are reachable (`QAN-BL-NAV-01`) | — |
| E2E-B-20 | whether bookmarks, coarse steps, object version jumps or a no-op acknowledgement belong in v1 | — |
| E2E-D-04 | the email-change re-verification flow | W3 |
| E2E-D-06 | which security controls v1 offers | W3 |
| E2E-D-08 | the human-facing Shared ID format | W3 / W6 |
| E2E-D-11 | whether the UI language is selectable in-app | W3 |
| E2E-D-12 | whether any in-app accessibility preference exists | W3 |
| E2E-D-16 | the data-export journey | W3 |
| E2E-D-17 | the account-deletion journey across all worlds | W3 |
| E2E-E-10 | notification permission-education sheet copy (`P4-GAP-030`) | W5 |
| E2E-G-05 | Shared conversation presentation and multi-human attribution (`P4-GAP-040`) | W6 |
| E2E-G-13 | the closed Shared World's name and presentation | W6 |
| E2E-G-18 | where a former member controls their own material | W6 |
| E2E-H-02 | Public lens / ranking policy | W7 |
| E2E-H-05 | Public discussion structure (threads, depth, ordering) | W7 |
| E2E-H-06 | whether Public reactions exist | W7 |
| E2E-H-07 | the publication flow, including `QAN-BL-CW-01`'s ruling on retained bytes | W7 |
| E2E-K-01 | the Product loading state after the launch handoff | W1A |
| E2E-K-03 | offline behaviour and wording | — |
| E2E-K-05 | recoverable failure and retry | W1A |
| E2E-K-06 | unrecoverable failure: what the user is offered | W1A |
| E2E-K-07 | interrupted actions outside calls | — |
| E2E-K-14 | what a returning user lands on after absence | W1A |

Two sequencing matters are not Product rules and are not counted above. One is open: what the Shared / Public
destinations show if the shell ships before their surfaces (master audit §7.7; §2 W1C, B-01). One is resolved by the
Product Owner: the frozen visual foundation is consumed from each surface's first production implementation (§2).

---

## 7. Tally

| Group | Rows |
|---|---:|
| W1A Authenticated Personal Conversation core | 3 |
| W1B Account identity and first use | 5 |
| W1C Global Shell | 1 |
| W2 Get in and out | 5 |
| W3 Settings, identity, Understanding, Memory through Conversation | 9 |
| W4 Visual system on implemented surfaces | 15 |
| W5 Activity, notifications, Direct Entry | 14 |
| W6 Shared World | 11 |
| W7 Public World | 6 |
| W8 Replay entry / selection / preview | 5 |
| **Ready, provider-independent** | **74** |
| Blocked — Voice | 18 |
| Blocked — economy | 6 |
| Standalone owned | 21 |
| Pre-launch only | 3 |
| Product Owner decision required | 32 |
| **Total** | **154** |
