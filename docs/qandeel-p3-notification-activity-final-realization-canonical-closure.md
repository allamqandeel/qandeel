# QANDEEL — P3 Notification & Activity Final Product Realization
## Canonical Product / Design Closure and Controlled Amendments

> **Status: `P3 — CLOSED / FROZEN — NOTIFICATION & ACTIVITY FINAL PRODUCT REALIZATION`**

| | |
|---|---|
| Roadmap track | `P3 — Notification Final Realization` ([`QANDEEL_PRODUCT_ROADMAP.md`](../QANDEEL_PRODUCT_ROADMAP.md) §2) |
| Canonical baseline | `bd71d664ee4c0038046fc2bf52323ae2c26d6224`, the merge of PR #275 (P3-A) |
| Evidence | the merged P3-A package, [`docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/`](design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/P3_READ_FIRST.md). At the baseline its Git tree is `354c2013f40a30d0ba79b707eb042814d2d3af1b`: 140 files, `MANIFEST.json` (SHA-256 `97021550…0fc63a43`) plus the 139 entries it lists by bytes and SHA-256, 33,614,783 B in total. Recomputed from the blobs on `main`: 0 mismatches, no unlisted file. Prototype `prototype/index.html` SHA-256 `7daecd28e495b5c38e7073793d13bfc190201935774871f056cfe23aade0f3db`, equal to the manifest's `prototypeSha256`. The Analysis page `prototype/g3.2/index.html` is G3.2's reviewed prototype byte-exact (`10611f35…d4983d71`, the hash the artifact index records for G3.2) |
| Review provenance | the P3-A reviewed branch head was `8ca22ecac7bc26e43c59062327d9d87dfd14fb92`, and the squash merge `bd71d66` has the same tree. The final reviewed review ZIP (local, not in Git) is 29,425,010 B with 140 entries, SHA-256 `6B18B22972078CA9289F902F72FAF99C6873EE5CB5162DA3F00A3B841DEA8674`. Each of its 140 entries is byte-equal to the file at the same path in the package on `main`. The ZIP is provenance only. The unpacked package on `main` is the durable evidence, and no reader needs the ZIP |
| Decision source | the Product Owner's selections, accepted after independent review of P3-A and its two refinements. This record takes no Product decision of its own |
| Authority class | later, additive Product / design authority. It consumes `I-08N-01` and narrowly closes the Product realization that `I-08N-01` explicitly left open (its §21). It rewrites no earlier record (§19) |
| Lifecycle effect | the state above is the one this closing change encodes. It binds on the merge of the pull request that carries it, after independent review. This record carries no review or merge status of its own |
| Implementation | **none.** No notification runtime, Push provider, native integration, database schema, production component or dependency is created, changed or authorized (§18) |

Historical records keep their bytes, and so does the P3-A package. Its own wording — "P3 remains NOT CLOSED / NOT
FROZEN", the `P3-A FINAL MICRO-REFINEMENT — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW` banner, and each document's
`PROOF SPECIFICATION — NOT FROZEN` / `EVIDENCE — NOT FROZEN` status — is superseded by this record, not edited. Where this
record supersedes an earlier statement, §19 names it. Everything not named there stays in force.

---

## 1. Scope

P3 closes the roadmap's third Product decision track: the final Product realization of notifications and Activity
over the frozen `I-08N-01` contract. It freezes:

1. the Activity destination, its entry and its place in the shell (§3);
2. the Activity item morphology and attention states (§4);
3. the two P3 glyph members, Open Ledger and Open Link (§5);
4. the attention marker, badges and counts (§6);
5. the ordinary in-app Attention Strip (§7);
6. the Analysis attention law (§8);
7. the Live Call attention law and the call-safe strip (§9);
8. the Lock Screen / privacy realization (§10);
9. permission education (§11);
10. General Settings → Notifications & Activity (§12);
11. the v1 Quiet Hours and Snooze defaults (§13);
12. the v1 frequency and cooldown ceilings (§14);
13. the foreground / background / Direct Entry presentation rules (§15);
14. the P3 application of the existing motion, direction and accessibility rules (§16).

It freezes **Product realization**: morphology, placement, presentation, the accepted names and the accepted numeric
defaults. It creates no truth, authority, privacy, interruption-class, Direct Entry, disclosure or speaker semantics.
Those stay `I-08N-01`'s.

**How the realization is frozen: by reference.** This record does not restate a second specification. The frozen
realization is what the merged P3-A package shows and decides:

| Frozen material | Where it lives in the package |
|---|---|
| the decision logic of every presentation rule | `source/src/model.mjs` (`decide`, `isCallSafe`, `reevaluatePending`, `project`, `indicators`, `CEILINGS`, `budgetVerdict`, `reevaluateAtQuietEnd`) and its fixtures `source/src/fixtures.mjs` (S1–S39, X1–X4, `OVERNIGHT`, `WEEK`) |
| the two P3 glyphs | `source/src/p3glyphs.mjs` (`INTRO_ACCEPTED = 'link'`), built on P2's `source/src/sig.mjs`, unchanged |
| the rendered Product surfaces | `source/src/app.js`, `source/src/build.mjs`, `prototype/index.html` |
| the per-domain realization | `docs/P3_ACTIVITY_VISUAL_SPEC.md`, `P3_ATTENTION_STRIP_SPEC.md`, `P3_PRIVACY_DISCLOSURE_PROOF.md`, `P3_NOTIFICATION_SETTINGS_PROOF.md`, `P3_PERMISSION_EDUCATION_PROOF.md`, `P3_FREQUENCY_QUIET_HOURS_PROOF.md`, `P3_STATE_MOTION_ACCESSIBILITY.md` |
| visual reference | boards `01`–`18` (start at `18-decision-summary.png`); clips `M01`–`M10` with their Reduced Motion counterparts |
| deterministic proof data | `data/CHECKS.json` (89 / 89 pass, 29 / 29 planted defects rejected), `data/SHOTS.json` (117 captures), `data/A11Y.json`, `data/BOARDS.json`, `data/COPY_TABLE.md`, `data/motion/`, `MANIFEST.json` |

Those documents' `NOT FROZEN` banners describe the proof, not this closure. What they label *craft*, proof
interpretation, `PROOF`, `OPEN` or `FIXTURE` stays exactly that (§16, §17, §18).

The comparison variants in the same package — the Quiet Bell entry glyph, the At the Door Introductions mark, and the
withdrawn two-opening Introductions drawing — are **comparison / history evidence only**. They are not open
alternatives. The former ordinary Analysis strip state `analysis-strip-shared` survives only as planted defect D24,
labelled REJECTED / PLANTED DEFECT — ORDINARY STRIP INSIDE ANALYSIS.

---

## 2. What the P3-A evidence proves, and what it does not

P3-A proved the realization inside the real accepted Product. The Conversation and Shared World use the G1.1 / G3.2
shell and the final P2 icon system. The Analysis is G3.2's own reviewed page, byte-exact, in a frame, with its world,
Timeline, Live Call and PINNED states. Every presentation outcome is decided by one deterministic model that the checks
also run.

| Evidence | Count / coverage |
|---|---|
| boards | 18, one Product question each (`data/BOARDS.json`) |
| motion clips | 14 at 30 fps: M01, M02, M03, M05, M06, M07, M08, M09, M10 and the Reduced Motion counterparts M01r, M04, M05r, M07r, M08r; M06 is board-drawn |
| Product captures | 117 at 2×, recorded in `data/SHOTS.json` and composed into the boards; 22 key captures kept as files in `captures/` |
| languages and appearances | Arabic RTL and English LTR; Dark, Light and System where the surface follows the preference |
| sizes | 320 × 568, 390 × 844, 430 × 932 |
| modes | Increased Contrast; Reduced Motion |
| checks | **89 / 89 pass; 29 / 29 planted defects rejected**, each by a named check |
| scenarios | 39 model scenarios and the Analysis-exit cases X1–X4 |

It is **browser evidence**. VoiceOver / TalkBack, device Reduce Motion and Increase Contrast, haptics, touch latency,
real Push delivery and the platforms' own permission and Lock Screen surfaces were not proved there. They are
implementation / device gates (§18).

The board-14 platform mapping example and the Apple / Android research gate (`docs/P3_PLATFORM_REFERENCE_GATE.md`) are
evidence that informed the proof. Neither is authority, and this record adopts no platform semantics from them.

---

## 3. Activity architecture

**Frozen:**

- **one global Product destination**, named **«النشاط»** in Arabic and **ACTIVITY** in English (title case, "Activity",
  in the interface);
- Activity is **not a World**, **not a fourth Global Switcher item** and **not a truth or authority scope**. The Global
  Switcher keeps exactly its three World destinations;
- **the entry is an independent icon-only control in the upper chrome of the non-Analysis Product shell** (the
  Personal Conversation, a Shared World). The accepted realization places it at the START edge and leaves
  «تحليل المحادثة» and Replay their G1.1 places (board 05). Its dimensions are craft;
- **there is no Activity entry inside the Analysis.** The Analysis chrome stays G3's composition. From the Analysis,
  Activity is one step away through «المحادثة»;
- opening Activity shows one full Activity page without the World navigation, because Activity is not a World. Back
  returns the user to where they were;
- the Activity surface is non-Analysis. It follows the P1 Dark / Light / System preference. It is never painted as the
  Analysis, which stays one dark immersive place;
- **one quiet chronological feed**, «الكل» / **All** by default;
- **lightweight semantic filters** over the one feed — From QANDEEL, Shared, Public, Introductions, System — not five
  permanent tab destinations;
- every Activity item keeps its semantic source / category (`I-08N-01` D28, D30).

P3 creates no new navigation ontology. The filters are a presentation of `I-08N-01` D30's categories, not new areas.

---

## 4. Activity item morphology

**Frozen:**

- a **quiet row / list** treatment on the page's ground, not a wall of cards;
- each row carries the source glyph / source-context identity, the time, one primary event sentence, and optional
  secondary context only when needed;
- **at most one explicit inline action**, when one is genuinely useful (for example reviewing a new sign-in).
  Otherwise the whole row is the Direct Entry into the originating context;
- the attention state is restrained. There is **no red unread wall** and **no coercive full-row alarm fill**;
- attention states are distinguished by more than colour: a new item carries the neutral attention mark; an item
  that still needs the user after being seen keeps a distinct waiting mark (the proof's hollow ring); an opened item
  quietens; a stale item says so in words and offers only a safe act into its own context (board 04).

**Coalescing:**

- low-value repetition in the **same** context may coalesce into one row;
- items from different Worlds or authorities are **never** coalesced into one item;
- coalescing never creates an ambiguous Direct Entry;
- coalescing creates no truth and no authority (`I-08N-01` D09).

**Lifecycle stays `I-08N-01`'s:** Seen / Opened is not source-event resolution (D31, D40); Activity is not the
canonical event store (D29); opening Activity does not clear everything (D47).

The proof's dwell time for "seen", its row paddings and its type sizes are craft (P3-A Activity spec §5, §7).

---

## 5. P3 iconography

Both glyphs are P3-required members frozen by reference to the P3-A package. They apply P2 and do not extend it.

### 5.1 Activity entry glyph

> **Open Ledger — final**

- drawn in P2's N1 "Open" geometry (`source/src/p3glyphs.mjs`, on P2's `sig.mjs`);
- Activity is **not** drawn as a World ring, because every ring in the P2 family is a World;
- rest ink in every state; never Living Brass; never mirrored;
- **Quiet Bell** is comparison / history evidence only.

### 5.2 Introductions Activity-row source mark

> **Open Link — final**

- P2-compatible, and inside P2's grammar with **no exception**. There is no ring, so P2's one-opening-per-ring rule
  gains no second exception;
- no face-reading: the two points sit on one diagonal, never side by side;
- it does not imply that a Shared World already exists. Before a Mutual Match the link is offered, not made;
- **At the Door** is comparison / history evidence only;
- the earlier two-opening drawing is rejected. It survives as history and as planted defect D23.

The checks measure these properties on the rendered glyphs (C-SEL-1, C-SEL-2, C-GLY-1…3).

**Authority.** P2 remains the icon-system grammar and geometry authority. P3 freezes only these two accepted members,
by reference to the P3-A package. P3 does not reopen or rewrite P2, and changes no P2 glyph.

---

## 6. Attention marker, badges and counts

**Frozen:**

- the global Activity indicator is a **neutral presence / attention mark**;
- no mandatory red; no error ink;
- **no Living Brass as status** (C3 §2C);
- **no global raw numeric count.** The global indicator is derived from eligible attention items, never an arithmetic
  sum (`I-08N-01` D45);
- state never relies on colour alone: the mark is a shape, and the entry's accessible name carries it;
- the mark never pulses.

Category behaviour inside Activity:

| Category | Indicator |
|---|---|
| Shared | may show a useful count when safe and meaningful (one coalesced row counts once) |
| Public | presence by default |
| Introductions | **presence only** — never a candidate or inventory count (`I-08N-01` D48) |
| System / Account | a count only for genuinely actionable multiple items |
| From QANDEEL | presence |

The platform app-icon badge is OS / platform-owned. It is not the semantic truth source, and its native behaviour is
an implementation detail (§18).

---

## 7. The ordinary in-app Attention Strip

An ordinary Attention Strip may appear **only** when all of the following hold:

1. the app is in the foreground;
2. the user is on a **non-Analysis** Product surface;
3. the user is **outside** the event's originating context;
4. the event remains eligible under current authority, mute and privacy;
5. the event deserves an interruption.

An ordinary strip is **not** shown:

- in the originating context: the event appears there in place;
- for Ambient / low-value discovery that does not deserve interruption;
- **inside the Analysis** (§8);
- **during an active Live Call** (§9);
- when mute, authority, privacy or current eligibility suppresses it.

**Form:**

- a restrained, ASIDE-like strip (B4R) attached to the upper chrome and emerging from it;
- nonmodal, with no scrim; no large floating card;
- no bounce, no pulse, no countdown, no progress indicator, no artificial urgency;
- the strip's readable hold does not run out while focus or a finger is on it;
- importance is carried by words, never by colour;
- under Reduced Motion the same strip, acts and meaning appear, fading instead of moving.

**Direct Entry.** The ordinary strip's body may be the Direct Entry into the originating context, when that
destination is still valid and currently authorized. It revalidates at tap (`I-08N-01` D38, D39). The strip also has a
dismiss control.

Exact proof timing — appear, hold, dismiss and entry durations — is craft, not frozen Product law (§16).

---

## 8. Analysis attention law

> **Ordinary notification attention never presents as an Attention Strip while the user is inside the Analysis.**

While the user is inside the Analysis:

- ordinary Shared, Public, Introductions, Proactive QANDEEL and ordinary System attention is **deferred** from
  transient presentation;
- no ordinary strip appears, and nothing ordinary is laid over the Analysis;
- no Activity entry is added to the Analysis;
- the deferral generates **no transient region and no announcement**;
- valid events stay represented in Activity, with the attention state that applies.

Critical security **outside** a Live Call has no separate Analysis exception. No frozen rule names another surface for
it there, so it waits and is re-evaluated like the rest (P3-A S36). The two call-safe exceptions of §9 apply only
during an active Live Call.

**When the user leaves the Analysis:**

- every deferred candidate is **re-evaluated** against current truth, authority, eligibility, context, mute, staleness
  and attention conditions;
- **at most one** currently eligible strip may appear;
- there is **no dump**. The others stay in Activity;
- a stale, muted or same-context candidate is not forced into a strip merely because it waited;
- while a Live Call continues, the candidates keep waiting (§9).

**Not frozen: the tie-break.** When more than one deferred candidate is strip-eligible on exit, the P3-A model chooses
the lowest Interruption Class and then the one that has waited longest. P3-A itself labels that ordering a proof
interpretation, a deterministic harness choice. It is **not** Product authority. This record freezes only three
things: re-evaluation, current-state validity and at most one transient presentation. Which eligible candidate is
presented stays with `I-08N-01`'s value-driven priority (D11, D13), whose ranking implementation is not frozen (§18).

---

## 9. Live Call attention law

**G3 §D is preserved:** a Matching / Introductions opportunity does not interrupt or replace an active Live Call.

P3 freezes the broader ordinary rule. During an active Live Call, the following are **deferred**:

- ordinary Shared attention;
- ordinary Public attention;
- Introductions;
- normal Proactive QANDEEL;
- ordinary System attention.

They stay represented in Activity. When the call ends they are re-evaluated with the same law as §8: current
validity, and at most one transient presentation.

**The only two call-safe exceptions:**

1. a genuinely **critical security / account** event;
2. an **exact-time reminder the user explicitly requested**.

A non-critical security notice or a reminder the user did not request still waits. For these two exceptions only,
during an active Live Call:

- a small **call-safe strip** may appear immediately;
- it has **no Direct Entry**. It is **dismiss only**;
- dismissing it does **not** resolve the event, does **not** end the call, and invents no navigation;
- it is nonmodal and never a takeover, a full-screen interruption or a replacement for the call;
- it never uses Living Brass as status, never uses red, and never pulses or bounces.

In the background during a call, those two exceptions follow the normal Push path; everything else waits.

### 9.1 The Analysis during a Live Call

For the two call-safe exceptions only:

> **Replay is the one temporarily and intentionally occluded frozen control.**

**Frozen:**

- temporary occlusion of the **Replay slot** is the one bounded exception. It lasts only while the strip shows.
  Replay is neither moved nor destroyed;
- the Conversation / Analysis switch («المحادثة») stays available and unobstructed;
- the Call Rail / call line stays available and unobstructed;
- the Timeline stays available and unobstructed;
- Return Live stays available and unobstructed;
- the Living Analysis world floor stays intact. Nothing is laid over the world;
- if Replay receives keyboard focus while occluded, the strip steps aside and stops obscuring the focus.

The strip therefore lives in the Analysis upper chrome row, between the Replay slot and «المحادثة». P3-A measured this
on G3's own elements at 320, 390 and 430, Arabic and English (C-CALL-3, C-CALL-7). Its geometry is craft measured from
G3's page, not a new Product dimension. On the Conversation, the call-safe strip takes the ordinary strip's place under
the upper chrome, and Call Rail A stays untouched.

This record does not say the call-safe strip covers no frozen control. It covers one — Replay — temporarily and
intentionally.

**Product class is not an OS interruption level.** The two call-safe exceptions and `I-08N-01`'s Classes 1–4 are
Product rules. P3 does not map them to Apple Critical Alerts, time-sensitive interruption levels or Android channel
importance (§18).

---

## 10. Privacy / Lock Screen realization

`I-08N-01` remains the semantic privacy authority. P3 freezes the human-facing Product realization.

The disclosure levels stay `L0 — Minimal`, `L1 — Generic`, `L2 — Bounded Context` and `L3 — Content Preview`
(`I-08N-01` D14). Normal users never see the internal codes. They see these accepted labels:

| Level | Arabic | English |
|---|---|---|
| L0 | **«خاصة جدًا»** | **Very private** |
| L1 | **«إظهار النوع»** | **Show type** — the notification's type / category only |
| L2 | **«إظهار السياق»** | **Show context** |
| L3 | **«إظهار المعاينة»** | **Show preview** |

**Frozen:**

- **L3 is never a default** for any category. The D15 default matrix is unchanged;
- richer disclosure requires the user's explicit permission, per category (D16);
- the user's setting is a **ceiling, not a requirement**, and QANDEEL may render less than the ceiling (D17);
- critical importance does **not** increase disclosure (D14);
- no preview ever combines Worlds or authorities (§10 of `I-08N-01`).

### 10.1 Introductions

- the default is **L0**;
- by default the external notification does not reveal that it concerns Introductions (D15);
- there is **no universal, permanent L1 cap** on Introductions;
- the user may explicitly raise the Introductions ceiling;
- an individual event's bounded safe projection may still permit less than the user's ceiling. For example, a pending
  proposal has no content preview to give, because nothing about the other person may be shown before both accept.
  That is a fact about the event, not a category rule.

### 10.2 Native outside, QANDEEL inside

> **Native outside, QANDEEL inside.**

- QANDEEL owns the notification copy and the bounded content decision;
- the operating system owns the outer Lock Screen / system notification frame;
- no proprietary QANDEEL Lock Screen card replaces the platform presentation.

QANDEEL never relies on the device to hide what its own level must not say.

---

## 11. Permission education

**Frozen:**

- notification permission is **not** requested automatically at first launch;
- it is requested only at a legitimate, contextual moment where the value is understandable. The accepted realization
  names three: the first entry into a Shared experience, choosing «سماح» / Allow for Proactive QANDEEL, and entering
  Introductions;
- QANDEEL's own education comes **before** the platform prompt, as a sheet that asks for a genuine decision;
- **"Not now"** keeps core Product use available;
- refusal removes Push availability. It does not erase valid Activity, the attention mark, the in-app strip or any
  other in-app Product state;
- after refusal, QANDEEL does not pressure repeatedly. A new request is appropriate only in a new legitimate context or
  when the user goes to settings (`I-08N-01` D50);
- **OS permission is a hard platform boundary.** No in-app setting overrides it.

Apple provisional authorization is recorded by the evidence as a platform option only. It is **not** adopted as P3
Product policy. The education sheet's wording is the Product Owner's direction as used in the proof and is not frozen
as final copy (§17). The platform prompt's wording and its native implementation stay open (§18).

---

## 12. Settings — General Settings → Notifications & Activity

> **General Settings → «الإشعارات والنشاط» / Notifications & Activity**

This is placed in P1's one General Settings destination, in the Notifications group P1 §8.1 reserved for P3. It is
organised by **Product meaning**, not by transport channel (`I-08N-01` D33). Where General Settings itself is entered
in the shell is not decided here (§17).

### 12.1 Proactive QANDEEL

One three-way control:

- **«سماح» / Allow**
- **«أقل» / Reduce**
- **«إيقاف» / Off**

Semantics:

- it controls **interruption only**. It does **not** disable Memory, QANDEEL Understanding, Analysis or relationship
  context (`I-08N-01` D35; P1 §11.6);
- **Reduce** freezes as a tighter interruption gate that favours the highest-value or strongest-timing moments;
- Reduce is **not** "Class 2 only", **not** Off, and **not** a numeric score or threshold;
- under Reduce, a strong Class 3 Meaningful candidate may still interrupt when the Proactive Gate finds that the moment
  genuinely deserves interruption now, and a Class 2 candidate may still wait;
- Class 4 never interrupts; Quiet Hours, ceilings, disclosure and authority still apply.

The proof shows Reduce with one fixture boolean, `reduceEligible`, which states what an already-run Gate found. That
boolean is **not** a production schema, field, score or threshold.

### 12.2 The other sections

| Section | Frozen Product structure |
|---|---|
| Shared Worlds | a global control, and a per-World mute. Muting one World mutes no other (D34) |
| Public | replies / interactions with the user; **Public Discovery is opt-in** (off until chosen) and low-frequency |
| Introductions | its controls appear **only after** the user legitimately enters / enables the capability |
| System / Account | critical behaviour is distinguished from ordinary Product attention, in words and by having no off switch for critical security — never by red. In-app settings do not override OS permission (D36) |
| Quiet Hours | §13 |
| Snooze | §13 |
| Lock Screen previews | one ceiling per category, in the §10 labels |
| Device Notification Settings | a separate handoff to the device for sound, alert style and the OS Lock Screen, which QANDEEL does not fake owning |

If OS permission is not granted, the page says so once, plainly, and Activity keeps working.

The proof's help sentences under these controls are not frozen (§17).

---

## 13. Quiet Hours and Snooze

**Frozen v1 Product default:**

> **Quiet Hours ON — 23:00 → 08:00, device-local time.**

The user may edit the window or turn Quiet Hours off.

The only exceptions stay exactly `I-08N-01`'s (D06, D37):

1. an exact-time reminder explicitly requested by the user;
2. a genuinely critical security / account event that requires timely attention.

**Snooze options:** 1 hour · 8 hours · 24 hours · Custom.

Quiet Hours and Snooze affect interruption only. They delete nothing and change no truth or authority (D37).

> **No morning notification dump.**

When Quiet Hours end, pending candidates are **re-evaluated**. The outcomes stay open to Product meaning: Push,
in-app, Activity only, coalesced, deferred, suppressed, or stale / expired.

**Not frozen:** the proof fixture's exact 08:00 outcome (board 12, clip M06), and its reading that a waiting candidate
earns a Push at 08:00 only if it is still timely then. P3-A labels that reading a proof interpretation. Only
re-evaluation and the absence of a dump are frozen.

---

## 14. Frequency and cooldown ceilings

**Frozen v1 safety ceilings.** They are **ceilings, never quotas**. This discharges the numeric-frequency deferral of
`I-08N-01` §21 for these values only.

| Ceiling | Value |
|---|---|
| ordinary interrupting Push, across all ordinary interrupting categories combined | at most **4** in any rolling 24 hours, and at most **12** in any rolling 7 days |
| Proactive QANDEEL | at most **1** in any rolling 24 hours, and at most **3** in any rolling 7 days |
| the same proactive thread after no engagement | no re-interruption before **48 hours** |
| a third interruption on the same subject | requires **new meaningful context** and a **new Proactive Gate evaluation** |
| Public Discovery | at most **1** interrupting Public Discovery Push per rolling 7 days; opt-in; low priority; first candidate for suppression |

Silence stays non-evidence about the user's psychology or intent (`I-08N-01` D05).

**Outside ordinary budget competition** stay `I-08N-01`'s two exceptions (D08): the exact-time reminder the user
explicitly requested, and a genuinely critical security / account event. They still obey privacy, authority and OS
permission / platform restrictions.

**Unused budget never creates a reason to send** (D07). The Product shows no meter, no remaining count and nothing that
implies a reason to notify.

**Not frozen:** scoring weights, ranking formulas, the preemption algorithm, the adaptive-budget algorithm and the
category sub-budget numbers other than those above (§18).

---

## 15. Foreground, background and Direct Entry

Product-level rules. They are not a production delivery state machine.

| Situation | Product behaviour |
|---|---|
| the same originating context is in the foreground | no duplicate Push, no redundant strip; the event appears naturally in place (D51) |
| a different eligible non-Analysis context is in the foreground | the ordinary Attention Strip may be used (§7) |
| the Analysis is in the foreground | ordinary transient attention is deferred and re-evaluated on exit (§8) |
| an active Live Call | ordinary attention is deferred; only the two call-safe exceptions may use the call-safe strip (§9) |
| the app is in the background | Push only when the event is eligible and the OS permits it |
| OS permission denied | Push unavailable; valid Activity and in-app state remain possible (D50) |
| a stale target | no guessed replacement destination; a safe fallback tied to the originating context (D39) |
| a tap / Direct Entry | revalidates current authority, eligibility and target at that moment (D38, D42) |

---

## 16. Motion, direction and accessibility

P3 applies existing authority. It creates no competing motion, direction or accessibility contract. It freezes only the
Product / design obligations P3-A demonstrated:

- **RTL / LTR layout follows meaning.** P2's direction grammar stays authoritative: the entry sits at the START edge in
  both scripts; the ledger, World and call glyphs never mirror; the strips follow layout direction;
- **attention state never relies on colour alone** (F1R2; E1R; C3 §2C);
- **icon-only controls and dismiss acts carry truthful accessible names**, in both languages;
- **decorative glyphs are hidden from assistive semantics** where the control owns the name;
- **minimum target obligations stay with the existing accessibility system** (44 pt). A glyph never grows to meet its
  target;
- **focus cannot stay visually hidden beneath the call-safe strip** (§9.1);
- **Reduced Motion preserves semantic parity**: the same states, acts and meaning, with movement removed;
- **the ordinary Analysis deferral produces no phantom transient announcement.** A strip is announced once, through
  the page's one polite region, and never through G1.2's call live-status channel;
- motion stays P2's Calm State Morphing: no bounce, no loop, no semantic pulse, no countdown, and no animation that
  creates event truth.

**Not frozen:** P3-A's milliseconds — the strip's appear / hold / dismiss durations, the mark's arrival, the seen-state
dwell — and every other value P3-A labels *craft*. They remain reviewed evidence and implementation reference. Feel is
judged on a device.

Real VoiceOver / TalkBack, OS Reduce Motion and Increased Contrast, haptics, touch latency and native device
notification behaviour remain implementation / device validation gates (§18).

---

## 17. Copy boundary

`data/COPY_TABLE.md` separates `CANON`, `APPROVED`, `DIRECTION`, `PROOF`, `OPEN` and `FIXTURE`. **P3 preserves that
distinction.** Closure freezes only:

- the Product names and labels the Product Owner explicitly accepted;
- the semantics of the accepted controls and surfaces.

| Frozen names | Arabic | English |
|---|---|---|
| the destination | «النشاط» (`APPROVED`) | ACTIVITY / Activity (`APPROVED`) |
| the default filter | «الكل» (`APPROVED`) | All (`APPROVED`) |
| the settings section | «الإشعارات والنشاط» (`APPROVED`) | Notifications & Activity (`APPROVED`) |
| the Lock Screen levels | «خاصة جدًا» · «إظهار النوع» · «إظهار السياق» · «إظهار المعاينة» (`APPROVED`) | Very private · Show type · Show context · Show preview (`APPROVED`) |
| the Proactive QANDEEL control | «سماح» · «أقل» · «إيقاف» (the Product Owner's `DIRECTION`, named again as the frozen control by the Task Contract of this closure) | Allow · Reduce · Off (`APPROVED`) |

The Snooze **durations** (1 h, 8 h, 24 h, Custom) are frozen as Product defaults (§13); their English labels are
`APPROVED`, and their Arabic words are still `PROOF`.

**Not made canonical by this closure:**

- every line still marked `PROOF`. Examples: the help lines under Allow / Reduce / Off; the accessible call-safe
  phrase «تنبيه أثناء المكالمة» / "Alert during your call"; the other settings help sentences; the section heading
  «قنديل يبادر معايا» (`DIRECTION` in Arabic, `PROOF` in English);
- the `DIRECTION` education sheet («خليني أوصلك لما يكون في حاجة تستاهل» and its acts), used as given but not final;
- the two `OPEN` strings the proof carries from earlier records;
- every `FIXTURE` event sentence. They are synthetic event text, never Product copy;
- QANDEEL Voice's per-user dialect and relationship style, which `I-08N-01` D18A / D18B govern.

These belong to the roadmap's P4 residual Product / visual / copy census, if P4 determines that they must close before
the End-to-End audit. This closure creates no backlog item merely because P4 will census them (§20).

The placement of the General Settings entry in the shell is likewise not answered here. P2 §11 leaves it to the
roadmap's P4 census, and P3-A drew none.

---

## 18. Explicit non-scope and implementation carry-forward

**Nothing in this record is implemented by it.** Frozen Product / design is not production code. Today on `main` no
notification runtime, Push transport, Activity surface or notification setting exists in `apps/`, and none is
established by this closure.

P3 does **not** freeze or implement:

| Area | Not frozen / not implemented |
|---|---|
| runtime / delivery | Push provider; APNs integration; FCM integration; device token registration and storage; background workers; retry queues; delivery deduplication; delivery receipts a platform does not provide; production deep-link implementation |
| data / Activity implementation | database / storage schema; the exact Activity event projection schema; pagination; retention durations; read-state storage; notification history storage; the exact event / coalescing schema |
| ranking / scoring | model scores; weights; the priority formula; sensitivity and freshness scores; the exact preemption algorithm; the exact adaptive-budget algorithm; the proof's exit tie-break (§8) |
| platform mapping | exact iOS categories; exact Android channels; mapping QANDEEL interruption classes to OS interruption levels; native notification-template implementation; platform-specific permission wording; native app-icon badge behaviour |
| relationship implementation | the personality / style schema; the preference-inference algorithm; style scoring |
| device validation | VoiceOver / TalkBack; physical Reduce Motion / Increased Contrast; haptics; touch latency; real Push delivery; platform permission and Lock Screen behaviour on physical devices |
| copy | the `PROOF`, `OPEN` and `FIXTURE` strings not explicitly accepted (§17) |
| proof craft | P3-A's timing constants, dimensions and the proof-context field `view` (`'analysis' | 'conversation' | …`), which is proof context, not a production schema |

`docs/P3_IMPLEMENTATION_FEASIBILITY.md` in the package records future seams and constraints. It is evidence, not an
implementation task.

Implementation follows the roadmap — the End-to-End Product Experience Completeness Audit, then Production
Integration — each through its own separately authorized Task Contract. This record authorizes none (roadmap §1 rule
2).

A change to frozen P3 Product behaviour — rather than device-driven implementation craft that keeps it — needs a
controlled change of this record.

**P3 closes with no remaining Product Owner decision question inside its frozen scope.**

---

## 19. Narrow precedence / supersession matrix

Each row names the older text, what it now reads as, and what stays in force. The older records are not edited. P3
supersedes no earlier record wholesale.

### 19.1 `I-08N-01` — Notification & Proactive Attention Product Contract

`I-08N-01` stays **foundational and frozen**. P3 does **not** supersede its:

- truth (Notification ≠ truth source; Activity ≠ canonical truth);
- authority (Notification ≠ authority expansion);
- World boundaries;
- privacy laws and disclosure semantics (L0–L3, D14–D17, the bounded safe projection);
- interruption classes (D10);
- Direct Entry law (D38–D43);
- speaker identity (D18–D18B);
- anti-manipulation rules (D20, D46);
- the Activity-versus-truth distinction (D28–D31);
- OS-permission boundary (D36, D50).

| `I-08N-01` §21 deferral | Now reads |
|---|---|
| UI / visual design: Activity morphology; tabs vs sections vs filters; badge visual style; badge numbers vs dots; notification iconography; notification colours; Lock Screen visual form; in-app banners / cards; animation / motion | **closed by P3** §3–§9, §10.2, §16, by reference to P3-A. P3's motion timings stay unfrozen |
| Numeric frequency rules: daily limits; weekly limits; hard ceiling numbers; repeat intervals; cooldown values | **closed by P3** §14 for the named ceilings. Other category sub-budget numbers and inactivity durations stay unfrozen |
| Activity implementation: filters | the **Product** filters are closed by P3 §3; their storage and query implementation stays open |
| Activity implementation: database / storage schema; retention durations; pagination; read-state storage; exact event projection format | **still open** (§18) |
| Scoring / ranking implementation | **still open** (§18) |
| Relationship-style implementation | **still open** (§18) |
| Platform implementation, including platform-specific permission wording | **still open** (§18) |
| Future channels (Email, SMS, WhatsApp, other) | **still out of scope**, each needing its own Product contract |

P3 also closes the Product realization `I-08N-01` names as its surfaces or controls without drawing them: the in-app
presentation surface (D12), the category / control presentation (D33–D35, D37), the permission education experience
(D50), the Product-level Quiet Hours and Snooze defaults (D06, D37), and the foreground, Analysis and Live Call
presentation rules (D51).

### 19.2 G3 §D — Matching during an active Live Call

| Older statement | Now reads | Preserved |
|---|---|---|
| G3 §D: a new Matching opportunity "must not interrupt or replace the active Live Call. The Matching Product moment is deferred and presented after that Live Call ends" | still binding, in full. P3 is **compatible and broader for notification attention**: ordinary Introductions attention stays deferred during the call (§9), and is re-evaluated after it with every other deferred candidate | G3 §D's rule, its reconciliation and its "does not define" list. The two call-safe exceptions are unrelated critical-security and requested-reminder events. They never carry a Matching moment into a call. The Matching Product moment itself, and its post-call placement, stay G3 §D's and Connected Worlds `I-08`'s. P3 governs only the notification attention presentation of an Introductions event |

P3 does not weaken the G3 Matching rule.

### 19.3 G3's historical notification statements

| Older statement | Now reads | Preserved |
|---|---|---|
| G3 §D reconciliation row: the repository "has **no** canonical notification runtime and **no** generic deferred-attention mechanism, so this record references none and invents none"; notification choreography `OUT-OF-SCOPE / LATER` | **true at G3's baseline.** The recovered `I-08N-01` is now the foundational frozen notification Product contract, and P3 is its final Product realization | G3's "no notification runtime" statement is **still true**: neither `I-08N-01` nor P3 creates one. It stays true until a later implementation task changes it. G3 is not rewritten |

### 19.4 I-08A4 and G1.1 — the Product shell

| Older statement | Now reads | Preserved |
|---|---|---|
| I-08A4 §3: the primary Global Switcher scope is QANDEEL, Shared, Public; Introductions is not a fourth area | unchanged. Activity is not a World and not a fourth Global Switcher item | exactly three World destinations; every existing World name and destination |
| (no Activity entry existed) | P3 adds one separate global Activity entry in the **non-Analysis** upper chrome (§3) | G1.1 §1: «تحليل المحادثة», «المحادثة» and Replay as an action on the current context keep their places. The Analysis gets no Activity entry |
| I-08A4 canonical term «الإشعارات» / Notifications | unchanged. The General Settings section is titled «الإشعارات والنشاط» / Notifications & Activity (§12) | the term itself |

### 19.5 P1 — appearance and General Settings

| Older statement | Now reads | Preserved |
|---|---|---|
| P1 §8.1 "Notifications — placement only. `I-08N-01` stays the authority, and roadmap P3 owns the final realization" | the group is realized as **«الإشعارات والنشاط» / Notifications & Activity**, with the §12 structure | one General Settings destination (P1 §8); P1's other groups; the placement of the General Settings entry (still open) |
| P1 §12: non-Analysis surfaces follow Dark / Light / System; the Analysis stays one dark place | Activity is a non-Analysis surface and follows the preference (§3) | the Analysis, unchanged, under every value |
| P1 §11.6: `I-08N-01` D35 preserved | the Proactive QANDEEL control (§12.1) states it | unchanged |

### 19.6 P2 — iconography

| Older statement | Now reads | Preserved |
|---|---|---|
| P2 §11 "Placement is not iconography": P2 does not place "the Activity entry or its badges"; P3 owns Activity | P3 places the Activity entry (§3) and freezes its badges (§6) | P2's placement boundary for everything else (the General Settings entry, the QANDEEL Understanding entry, the canonical Q's presence — P4) |
| P2 §14 item 9: "P3 will apply the P2 icon system to notifications and Activity" | applied: **Open Ledger** and **Open Link**, frozen by reference to P3-A (§5) | P2 as the grammar and geometry authority; every P2 glyph; N1; C3 material. Attention state is never Brass |
| P2 §13.7: "A future badge is a status mark and is never Brass (C3 §2C)" | realized: the neutral attention mark (§6) | unchanged |

Comparison variants (Quiet Bell, At the Door, the two-opening drawing) are evidence only.

### 19.7 C3, E1R, F1 / F2 — consumed unchanged

- C3's material permissions; Living Brass is not a status colour;
- E1R's interaction semantics (PRESSED on the ground, FOCUS as the detached perimeter, SELECTED as marker and weight);
- F1R2's accessibility transforms and F2's appearance tokens; Increased Contrast uses the F1 / F2 transforms;
- Activity follows P1's non-Analysis appearance.

**No token is changed.**

### 19.8 G1.2 — Voice + Live Call

Unchanged. P3 consumes G1.2's active call, on either surface, in the foreground or background. The call-safe strip
never uses the call's one assistive live-status channel, and never ends or pauses the call. Call Rail A stays P2's,
untouched.

---

## 20. Governance — BG-05, BG-08 and BG-09

**Kickoff (BG-05).** [`docs/qandeel-canonical-backlog-v1.md`](qandeel-canonical-backlog-v1.md) was read in full at the
baseline. No item names P3, notifications, Activity or any P3 task as its Owner task, and no item's source makes P3 its
required owner.

**Inherited: none.** The adjacent items are untouched and not claimed:

| Item | Why P3 does not touch it |
|---|---|
| `QAN-BL-VOICE-01` | stays `OPEN — UNASSIGNED`. §9 consumes its future truthful answer to "is a Live Call active?" and takes nothing from it |
| `QAN-BL-NAV-02` | the Product Replay surface. P3 occludes the Replay **slot** transiently during two call-safe exceptions and changes nothing about Replay |
| `QAN-BL-VIS-01` | the world is unchanged; P3 lays nothing over it |
| `QAN-BL-SEC-01` | stays `DEFERRED — OWNED` by `QAN-SEC-01`. A critical security / account notification is a Product attention rule and changes no credential storage |
| `QAN-BL-CW-01` | stays open; P3 has no bearing on it |
| `QAN-BL-NAV-01`, `OPEN-06`, `OPEN-08`, `OPEN-09`, `OPEN-19` | navigation and acknowledgement capabilities P3 neither implements nor blocks |

**Admitted: none.** Each candidate residue was tested against BG-06's four admission routes. None qualifies:

| Candidate | Why it is not admitted |
|---|---|
| the production notification runtime / Push provider | later implementation of a frozen contract, not a new Product obligation created by P3. The roadmap already sequences Production Integration ("notification / Activity runtime and presentation") |
| platform channels / categories and the Product-class → OS-level mapping | implementation mapping. `I-08N-01` D52 already governs it |
| storage, pagination, retention, read-state | implementation detail. `I-08N-01` §21 keeps them deferred |
| device validation (VoiceOver / TalkBack, Reduce Motion, Increased Contrast, haptics, real delivery) | release / implementation gates. G1.2 §7, G3 §F / §H and P2 §15 keep the same class of gate unadmitted |
| scoring / ranking | implementation beneath frozen Product semantics |
| the remaining `PROOF` / `OPEN` / `FIXTURE` copy | a P4 census candidate. That is roadmap sequencing, not a backlog obligation. No canonical document defers it to a named task **as an obligation** |
| the proof's exit tie-break "oldest waited first" | explicitly **not** frozen (§8). There is no Product obligation to preserve it |

None carries an existing `OPEN` identifier. No canonical document defers any of them **as an obligation** to a named
future task. None is carried forward for validation, and Architecture designated none.

**BG-01.** There are no current P3 blockers, so none was moved here. Every P3-A finding was resolved inside the proof
— the ordinary Analysis strip was removed and survives only as planted defect D24; the withdrawn two-opening drawing
survives only as D23 — or is recorded here as an explicit non-Product implementation or copy boundary (§17, §18).

This is not blocker laundering. Architecture remains free to designate any of the above under BG-06.

**No backlog closure record.** `tests/task-closure-governance-contract.test.mjs` governs `T-` tasks through index
tombstones and Connected Worlds `I-0N` phases through `### I-0N closure record` headings. P3 is neither and owns no
backlog item, so the contract requires no P3 record and none is manufactured. **The backlog is not changed.**

**BG-09.** This document is P3's primary canonical record, and it carries its final lifecycle banner in the closing
change itself. The same change updates:

- [`QANDEEL_PRODUCT_ROADMAP.md`](../QANDEEL_PRODUCT_ROADMAP.md), [`QANDEEL_CURRENT_STATE.md`](../QANDEEL_CURRENT_STATE.md)
  and [`QANDEEL_PROJECT_MAP.md`](../QANDEEL_PROJECT_MAP.md);
- [`CANONICAL_AUTHORITY_INDEX.md`](canonical-authority/CANONICAL_AUTHORITY_INDEX.md) and
  [`QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md).

The P3-A package bytes are not changed. Its "P3 remains NOT CLOSED / NOT FROZEN" wording is superseded by this record,
as G3 §I did for G3.2 and P2 did for P2-A. No successor task is left to synchronize any of these.

---

## 21. Closure method (Skills Gate)

The installed skills were inspected. None covers documentation governance or change control. Four bear on wording
this record had to get right. Repository canon and the Product Owner's selections outranked each of them.
`fixing-accessibility` and `apple-design` are not installed on this host, and nothing here is claimed from them.

| Skill | Concrete effect on this record |
|---|---|
| `animate-expo` | "Feel is judged on a release build on the slowest device" and "Reduced motion means fewer and gentler, not zero": §7 and §16 freeze the motion *language* (no bounce, loop, pulse or countdown; the same meaning under Reduced Motion) and explicitly do **not** freeze P3-A's durations. "Bounce only when the gesture carried momentum" agrees with the strip having no bounce, since no finger momentum is involved. Its haptics rules ("never the only feedback") are why haptics stay a device gate here rather than a Product rule |
| `ui-ux-pro-max` | Guideline rows read directly from its data. Row 100 ("Focus Not Obscured") became §9.1's frozen obligation that focus never stays hidden beneath the call-safe strip. Row 118 ("make every badge a competing live region" is the anti-pattern) supports §8 / §16: one polite region, and no phantom announcement from the Analysis deferral. Row 82 ("auto-dismiss after 3-5 seconds") differs from P3-A's 6 s hold, which is one reason the hold is recorded as craft, not frozen |
| `designing-arabic-frontends` | "Mirror by meaning": §16 freezes direction by meaning and states placement in START / END terms rather than left / right. Latin tokens in Arabic prose are kept as separate code spans. No Arabic copy is written or changed |
| `writing-eloquent-arabic` | Used only as a guard. Every Arabic string in this record is quoted from `data/COPY_TABLE.md` with its recorded status, and none is rephrased. The `PROOF` Arabic (for example «تنبيه أثناء المكالمة») is deliberately left unfrozen rather than polished here, since new copy is P4's to census |

---

## 22. Closure

> **P3 — CLOSED / FROZEN — NOTIFICATION & ACTIVITY FINAL PRODUCT REALIZATION**

- This is binding on the merge of the pull request that carries this record.
- Production notification and Activity implementation remains open.
- P3 has no remaining Product Owner decision question inside its frozen scope.
- Residual `PROOF` / `OPEN` / `FIXTURE` copy is not silently frozen. It stays visible to the P4 census.
- The next Product / visual decision track is **P4 — Remaining Product / Visual Gaps Census & Closure**, which this
  record does not open.
