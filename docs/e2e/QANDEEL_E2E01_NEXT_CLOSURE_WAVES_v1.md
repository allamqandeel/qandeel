# QANDEEL — E2E-01 Next Closure Waves v1

**Status:** `PROPOSED FOR PRODUCT OWNER REVIEW` — **planning evidence, not Product authority.**
**Baseline:** `d4b20344239654fea737afb3c03036d1bb4ef0d9`

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

### W1 — Personal core loop: first use and Conversation — *candidate first wave*

| Rows | 9 — E2E-A-13, A-14, B-01, B-02, B-03, B-04, B-07, D-13, K-02 |
|---|---|
| Journey | sign in → first use (definition → Welcome → start) → shell → write → read QANDEEL's reply → switch to Analysis and back → later, the normal opener |
| Frozen authority consumed | I-08A4 §3–§5, §12–§15, §20; G1.1 §1, §3; P4-C1 SW-3 / Q-A; P4-C4 `opener`, `door`, `doorName`, `backName`; P1 §9 |
| Backend | exists: sessions, `POST …/turns`, temporal catch-up, historical projection ([`conversation.controller.ts`](../../apps/api/src/conversation/conversation.controller.ts)) |
| Proof | G1.1-R3 (Conversation, openers, bidi); P4-C (shell). **Undrawn:** the first-use screens (`P4-GAP-034`, `-039`) |
| Decisions to take with it (§6) | B-05 turn cancel; B-06 reply failure wording; K-01 loading state; the Shared area label and what the Shared / Public areas show before their surfaces exist (master audit §6.1, §7.7) |
| Out of it | Voice (the composer is Writing only); relevance (`QAN-CTX-01`); the I-08B1 world port (W4) |

**Why it is the strongest candidate, on repository truth alone:**

- **It is the one gap that makes QANDEEL unusable.** Today a signed-in user cannot say anything to QANDEEL. Every other
  Personal moment — the Living Analysis World, Understanding, Memory, proactive Activity, Replay — shows the result of a
  conversation the app cannot have. Without W1 the map stays empty ([master audit](QANDEEL_E2E01_COMPLETE_PRODUCT_JOURNEY_SURFACE_CENSUS_v1.md) §1).
- **It is almost entirely frozen.** 8 of its 9 rows are `DECIDED — NOT IMPLEMENTED`; K-02 is implemented and resolves once
  first use exists. No row needs a new Product rule; four adjacent decisions are small and named.
- **Its backend already exists** and has since the Engineering Foundation; W1 adds a client, not a runtime.
- **It is provider-independent.** The turn path runs through the existing Model Router; the provider choice (QIR-001,
  coupled to the audit's benchmark) changes quality and cost, not the surface. W1 selects no provider.
- **It makes later evidence real.** The roadmap asks the benchmark to "reflect real QANDEEL use" (§3). A Conversation
  surface is the first place real QANDEEL use can happen. This is an observation about evidence, not a benchmark proposal.

**Sequencing question inside W1 for the Product Owner.** W1 builds non-Analysis surfaces. The frozen visual foundation
they would wear — typography, material, colour, appearance, icons (K-12, K-13, D-10) — sits in W4 and W3 below. Whether
that foundation lands before, with, or after W1 is a sequencing choice, not a Product rule, and is left to the Product
Owner.

### W2 — Get in and out: launch, account entry, sign-out

| Rows | 6 — E2E-A-01, A-02, A-06, A-07, A-09, D-07 |
|---|---|
| Journey | install → launch with the QANDEEL brand → create an account → sign in with Login ID or Email → sign out |
| Frozen authority | P4-C2 §1–§2 and P4 §6 (brand, static launch / handoff); P1 §2–§4, §8.1; T-14 |
| Backend | Supabase auth exists; **no Login ID or Name store** |
| Proof | P4-C3 launch boards. **Undrawn:** sign-up (`P4-GAP-020`, `-039`) |
| Decisions to take with it (§6) | A-08 failure / Login ID help copy; A-10 email verification; A-11 password recovery; A-12 session-expired treatment |
| Out of it | the lantern moment (`QAN-BL-LANTERN-01`); credential hardening (`QAN-SEC-01`) |

### W3 — General Settings, identity, appearance and Understanding

| Rows | 8 — E2E-D-01, D-02, D-03, D-05, D-09, D-10, D-14, D-15 |
|---|---|
| Journey | open General Settings from Personal → see and edit my identity → choose Dark / Light / System → open «فهم قنديل» and disagree with an item |
| Frozen authority | P1 §2, §6, §8, §10–§12; P4-C1 S-B, U-A; P4-C4 group names, Public ID and confidence rows |
| Backend | Public ID tables (no application role); Memory / HIM runtime internal only; **no Understanding projection endpoint**; contested runtime (PG-01) absent |
| Proof | P4-C placement boards only. **Undrawn:** Settings screens, the Understanding surface (`P4-GAP-039`) |
| Decisions to take with it (§6) | D-04 email change; D-06 security controls; D-08 Shared ID format; D-11 language; D-12 accessibility preferences; D-16 export; D-17 account deletion |
| Depends on | W1 for the "talk to QANDEEL about this" path in D-15 |

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
| Coupling | Activity's sources are mostly Shared, Public and Introductions, which have no surface. After W1 only "From QANDEEL" and "System" would have producers. The Push provider (APNs / FCM) is infrastructure, not an AI provider |

### W6 — Shared World Product surface

| Rows | 11 — E2E-G-01, G-02, G-03, G-04, G-08, G-09, G-10, G-11, G-12, G-14, G-15 |
|---|---|
| Journey | open Shared → invite with a Shared ID → accept → birth → share context deliberately → govern, add history, leave, delete my words → return by link |
| Authority | I-08A4 IA; P1 §5; the Shared Product definition (vision); CW2-02, CW2-03, CW2-07 |
| Backend | complete (I-02 … I-04) and fail-closed; **only four functions are user-callable**; no route, no Nest module |
| Needs first | a Product surface design for the whole family (no Shared screen is drawn); an Architecture decision on the application-role boundary (routes / grants) for the primitives that today no role can execute; CW2-08 / `I-09` for production serving |
| Decisions to take with it (§6) | G-05 Shared conversation and multi-human attribution; G-13 the closed world's name; G-18 former-member control |

### W7 — Public World Product surface

| Rows | 6 — E2E-H-01, H-03, H-04, H-08, H-09, H-11 |
|---|---|
| Journey | enter Public → search → open an Experience → choose alias or Name → meet a disappeared Experience; opt into Discovery |
| Backend | complete (I-05); readers `service_role` only; publication fails closed on `NOT_EVALUATED`; nothing can be served in production until CW2-08 / `I-09` |
| Decisions to take with it (§6) | H-02 lens ranking; H-05 discussion structure; H-06 reactions; H-07 publication, including `QAN-BL-CW-01`'s open ruling |
| Note | the smallest ready wave by user value until `I-09` clears serving; it can be designed now but not shipped |

### W8 — Replay entry, selection and preview

| Rows | 5 — E2E-J-01, J-02, J-03, J-05, J-07 |
|---|---|
| Owner today | `QAN-BL-NAV-02` — `OPEN — UNASSIGNED`; a wave here would give it an owner |
| Backend | I-06 complete; writers executable by no role; no media, storage or transport |
| Note | stops before playback (J-04, Voice-blocked) and sharing (J-06, `I-09`). Depends on W1: there is nothing to replay until a conversation exists |

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
| E2E-A-10 | the email-verification mechanism and when it blocks use | W2 |
| E2E-A-11 | the password recovery / reset journey | W2 |
| E2E-A-12 | how a user learns their session ended | W2 |
| E2E-B-05 | whether and how a user cancels an in-flight reply | W1 |
| E2E-B-06 | Personal reply-failure wording and retry | W1 |
| E2E-B-15 | where explicit Context Activation lives now that the Live Context surface is retired | W1 / W3 |
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
| E2E-K-01 | the Product loading state after the launch handoff | W1 |
| E2E-K-03 | offline behaviour and wording | — |
| E2E-K-05 | recoverable failure and retry | W1 |
| E2E-K-06 | unrecoverable failure: what the user is offered | W1 |
| E2E-K-07 | interrupted actions outside calls | — |
| E2E-K-14 | what a returning user lands on after absence | W1 |

Two sequencing questions are not Product rules and are not counted above: whether the visual foundation precedes W1
(§2 W1), and what the Shared / Public areas show if the shell ships first (master audit §7.7).

---

## 7. Tally

| Group | Rows |
|---|---:|
| W1 Personal core loop | 9 |
| W2 Get in and out | 6 |
| W3 Settings, identity, Understanding | 8 |
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
