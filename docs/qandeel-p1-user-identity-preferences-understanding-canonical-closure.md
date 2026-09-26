# QANDEEL — P1 User Identity, Preferences and QANDEEL Understanding
## Canonical Product Closure and Controlled Amendments

> **Status: `P1 — CLOSED / FROZEN — USER IDENTITY / PREFERENCES / QANDEEL UNDERSTANDING PRODUCT CONTRACT`**

| | |
|---|---|
| Roadmap track | `P1 — User Profile / Identity / Preferences / QANDEEL Understanding` ([`QANDEEL_PRODUCT_ROADMAP.md`](../QANDEEL_PRODUCT_ROADMAP.md) §2) |
| Canonical baseline | `ee03315cf24bc4529ecdc60e7b04b6e778de8bf4`, the merge of PR #271 (the finalization roadmap) |
| Decision source | Product Owner decisions, recorded here verbatim in substance. This record takes no Product decision of its own |
| Authority class | later, additive Product authority. It narrowly amends named statements of earlier frozen records (§15) and rewrites none of them |
| Lifecycle effect | the state above is the one this closing change encodes. It binds on the merge of the pull request that carries it, after independent review. This record carries no review or merge status of its own |
| Implementation | **none.** No runtime, SQL, migration, mobile, auth, storage or image code is created, changed or authorized (§17) |

Historical records keep their bytes. Where this record supersedes one of their statements, §15 quotes the older text
and says what it now reads as. Everything not named there stays in force.

---

## 1. Purpose

P1 closes the roadmap's first Product decision track. It freezes:

1. account identity and every user-facing identifier;
2. that QANDEEL has no traditional general Profile page;
3. one General Settings destination;
4. QANDEEL Memory versus **QANDEEL Understanding**, including the rename of `Readings / القراءات`;
5. the Personal / Shared / Public / Introductions exposure boundaries;
6. the appearance preference;
7. the Product semantics of sign-in;
8. Shared-ID reachability protection;
9. three-stage Introduction image disclosure.

---

## 2. Identity model

> **One human / account identity, with context-scoped Product projections. Identity continuity does not imply
> disclosure continuity.**

The internal `user_id` stays the private canonical identity. It is **never a user-facing identifier**, in any
context, for any purpose.

| Identifier | Created | Visibility | Changeable | Distinct from |
|---|---|---|---|---|
| internal `user_id` | by the system | never user-facing | no | everything below |
| **Login ID** | chosen by the user at account creation | private | at any time, after appropriate identity verification | `user_id`, Email, Shared ID, Public ID |
| **Email** | required at account creation, verified | private | yes; changing it does not change the Login ID | every other identifier |
| **Shared ID** | auto-generated | private credential the owner may copy and share | regeneratable at any time (§5) | `user_id`, Login ID, Public ID |
| **Public ID / alias** | auto-generated | the default Public identity | exactly **one** lifetime manual change (§6) | `user_id`, Login ID, Email, Shared ID |

### 2.1 Login ID

- chosen by the user during account creation;
- private, unique and case-insensitive;
- Latin letters and digits, with a small safe separator vocabulary. The exact grammar and regex are an implementation
  detail. A style such as `mohamed.allam87` is an example, not a format;
- not social and not searchable;
- never shown in a Shared World, the Public World, Introductions or QANDEEL Understanding;
- distinct from the internal `user_id`;
- changeable at any time after appropriate identity verification. There is no Product cooldown and no lifetime limit;
- the old Login ID stops working immediately after a successful change;
- sign-up shows **persistent help**, not a placeholder that disappears. It explains that the Login ID is a private
  QANDEEL sign-in identifier the user should keep carefully. The exact microcopy is open.

### 2.2 Email

- required at account creation, and verified;
- private security and recovery data;
- also a valid sign-in identifier (§3);
- changing the Email does not change the Login ID;
- never becomes a Public, Shared or Introductions identity.

### 2.3 Name

- one `Name` field. There is no mandatory First / Last split;
- QANDEEL uses it to address the user. It is the account display name that I-08A4 §12 renders as `{display_name}`.
  P1 freezes no automatic shortening of it;
- the default visible name in a Shared World, after membership acceptance;
- it does not automatically become a Public identity (§6).

### 2.4 Password, phone, two-factor authentication

- a password is required in the current launch model;
- a phone number is optional, as additional security and recovery. It is private;
- no mandatory two-factor authentication in current launch scope.

### 2.5 Account photo

- optional. It is not requested during basic sign-up;
- it can be added later from General Settings;
- visible to current Shared World members after membership acceptance;
- never exposed before Shared acceptance;
- not automatically reused in the Public World;
- the Introduction image is capability-owned. It need not equal the account photo unless its owner chooses so (§14).

---

## 3. Sign-in — controlled amendment to the T-14 Product requirement

The final Product sign-in is:

> **one identifier input accepting `Login ID OR Email`, plus Password.**

- Both routes reach the same account.
- There are no separate sign-in modes.
- Failure wording is generic. It must not reveal whether a Login ID or an Email exists. This extends T-14's own
  rule, "One sentence for a rejected credential, not two", to the Login ID.
- There is no client-visible Login-ID → Email directory. A client never learns which Email belongs to a Login ID.
- Secure identifier resolution and its authentication implementation belong to later Production Integration.

T-14 stays exactly what it is: the historical, implemented and `CLOSED / FROZEN` Product Sign-In Gateway. It is
Email-only. P1 changes none of its runtime, copy, tests or banner. What P1 supersedes is only the **final Product
requirement** for sign-in (§15.3).

---

## 4. Basic sign-up

Basic sign-up asks for exactly four things:

1. Name;
2. Login ID;
3. Password;
4. a required, verified Email.

It does **not** ask for a photo, age, occupation, gender, marital status, country, a long questionnaire or a Matching
questionnaire. This preserves I-08A4 §12: "No forced questionnaire before the real conversation", and "No unnecessary
second name question".

When the user later enables Introductions, the capability owns one specific self-authored field required by the
already-frozen pre-Match ceiling: **Introduction First Name** — the first name the user explicitly chooses to show in
Introductions. It is not inferred by splitting the account `Name`, and it is not part of basic sign-up. The Product
may prefill a suggestion from the account Name for convenience, but it is not authoritative until the user confirms
or replaces it. This field supplies CW2-06 §12's "first name" disclosure; the rest of the Introduction Profile field
catalogue remains Product-configurable.

---

## 5. Shared ID and the reachability law

### 5.1 Shared ID

The **Shared ID** is the Product name of the credential that CW2-01 §17 and CW2-03 §4 call the "secret Shared
invitation credential", and that `I-04A` implements as `shared_world_invite_credential_state` (migration `0081`).
P1 adds Product properties to it and changes none of the architecture's:

- auto-generated, and easy to copy and share;
- used for direct Shared reachability and invitation;
- distinct from the Login ID, the Public ID and the internal `user_id`;
- regeneratable at any time;
- after regeneration the old Shared ID is immediately invalid for new targeting;
- `PENDING` invitations bound to the old epoch become invalid;
- already-born Shared Worlds are not affected;
- before acceptance, a lookup reveals no name, photo, profile or contact detail, and stays non-enumerating.

"Private" (CW2-03 §4) and "easy to share" do not conflict. The Shared ID is account state that is never searchable
and never shown to anyone. Its owner may deliberately hand it to a person they want to be reachable by.

The last four properties already hold in the runtime. `I-04A` rotation moves every `PENDING` direct invitation bound
to an older epoch to `INVALIDATED`, and leaves born Worlds untouched. Submission resolves the target only from the
current credential reference and answers non-enumeratingly (`database/README.md`, migration `0081`). The human-facing
format is still unfrozen there, and P1 does not freeze it either.

### 5.2 The reachability law

> **Every new Shared membership reachability act targeting a person who is not currently a member — including
> invite / add / rejoin after departure — requires the target person's CURRENT Shared ID at the Product / application
> boundary.**

So none of these is enough to reach a non-member:

- knowing their `user_id`;
- a prior membership episode;
- an old Shared ID.

**An old relationship does not create a permanent invitation route.** Existing World history is not rewritten.
Current memberships are not disrupted by Shared-ID rotation.

### 5.3 Where the law lands

The law is a Product and application-boundary requirement. It changes no runtime.

- **Direct invitation (`I-04A`)** already satisfies it: the target is resolved only from the exact current credential
  reference.
- **Governed add-member and rejoin (`I-04E`, migration `0085`)** bind their target by `user_id` inside cores that no
  application role can execute. No authenticated Product route or application boundary exists for them today. When
  one is built, it must:
  - take the target person's current Shared ID;
  - never accept a client-supplied `user_id` or a prior-episode identity as the target.

  The frozen cores are consumed unchanged.
- Any not-yet-accepted add / rejoin invitation or equivalent reachability state that was established through an older
  Shared-ID epoch becomes non-actionable when the target rotates the Shared ID. A future application boundary must bind
  the current Shared-ID epoch and revalidate it before acceptance; rotation cannot leave an old reachability path alive.
  Existing born Worlds, current memberships and historical membership episodes remain unaffected.
- CW2-03 §16 (add-member governance), §17 (stale member invitations), §28 (rejoin) and §29 (rejoin history) stay in
  force. So do the unanimity requirements. P1 adds a precondition in front of them and relaxes none of them.
- Introduction-born Worlds keep CW2-03's rule that ordinary add / remove / leave mechanics are not used during an
  Introduction.

---

## 6. Public ID and Public identity

- a separate, auto-generated Public ID / alias, conceptually like `@nightlamp27`. The exact generation grammar is an
  implementation detail;
- the Public ID is unique across QANDEEL accounts in its normalized Public-ID namespace. Exact casing / normalization
  rules remain implementation detail;
- the alias is the default Public identity;
- the user gets exactly **one lifetime manual change** of it;
- before that one change is committed, the UI prominently warns that it is the only manual change and that it is
  permanent;
- in the Public World the user may display either the Public ID / alias or the account Name;
- choosing the account Name never exposes the Login ID, Email, phone, Shared ID or internal `user_id`;
- there is no separate Public Settings page or tab. The controls live in General Settings (§8);
- the account photo is not automatically Public. Any future Public avatar is a separate, explicit choice;
- a Public identity creates no direct-message route and no Shared-membership route;
- seeing a Public user never reveals their Shared ID.

This is consistent with CW2-04 §9. There, a display label "may be pseudonym or chosen real name", and
`PUBLIC_IDENTITY_REF` is distinct from the private account identifier, the Shared invite credential and any contact
endpoint.

It is also consistent with the `I-05` runtime (`database/README.md`), where display labels are `PSEUDONYM` or
`REAL_NAME`:
- the Public ID / alias is the `PSEUDONYM` choice;
- the account Name is the `REAL_NAME` choice;
- the internal `public_identity_ref` stays internal.

The uniqueness rule applies to the Public ID namespace, **not** to every Public display label. Real account names may
repeat, and the existing I-05 display-label relation remains unchanged until later Product integration adds the Public
ID boundary.

The one-change limit is a Product policy for a future application boundary. The `I-05` relation is unchanged.

The existing law is preserved: the Public World may use only Public / published material and permitted
Public-discussion context. It never uses hidden Personal or Shared context (CW2-04 §8; I-08A4 §17).

---

## 7. No traditional general Profile page

> **QANDEEL has no traditional general user Profile page as a primary Product surface.**

- Account identity fields live in General Settings (§8).
- There is no user-editable personality form duplicating what QANDEEL learns relationally.
- This does **not** remove the capability-owned `Introduction Profile` (CW2-01 §17; CW2-06 §10). That stays a bounded
  Introductions construct, configured inside Introductions.

---

## 8. One General Settings destination

There is exactly one General Settings destination. I-08A4 §7 already places it as "secondary Global Shell utility",
not a primary Product Area, and that placement is preserved.

- There is no separate Public Settings screen.
- There is no Settings page nested inside a Shared World. Shared-specific membership and governance operations stay
  contextual management and actions of the exact World governed (I-08A4 §7). They are not an in-World Settings
  destination.

### 8.1 Placement model

The groups below fix **placement**. Their final order, visual hierarchy, icons and copy stay open.

| Group | What lives there |
|---|---|
| **Account & Identity** | Name; optional account photo; Login ID and its change; Email, its change and verification; Shared ID copy / regenerate; Public ID, its lifetime-change state and the Public display choice |
| **Security & Login** | password; devices / sessions; sign out of other sessions / devices; recovery methods; optional phone. The exact lifecycle flows stay with the later end-to-end Account / Auth work |
| **QANDEEL & Conversation** | app language; selection of QANDEEL's voice when that choice is available |
| **Notifications** | placement only. `I-08N-01` stays the authority, and roadmap P3 owns the final realization |
| **Appearance & Accessibility** | Dark / Light / System (§12). The existing accessibility canon is preserved unchanged |
| **Privacy & Data** | placement for export, account deletion, legal / privacy and relevant device permissions. The exact lifecycles come later |
| **Introductions** | activation / pause only. The Introduction Profile, Matching preferences, hard dealbreakers and capability configuration stay inside Introductions (CW2-01 §17) |
| **Plan / Usage** | may live here once later economy work exists. P1 freezes no pricing or credit formula |
| **Support / App** | support, help, legal, version and sign-out may live here |

**Relationship style is not a Settings group.** Directness, brevity, warmth and how much QANDEEL asks are mainly
learned through conversation, not through dozens of toggles. This is consistent with `I-08N-01` D18B: adaptation is
"evidence-based; revisable; user-correctable".

"QANDEEL's voice" in the table means the choice of voice QANDEEL speaks with, where one is offered. It does not touch
`I-08N-01` D18 / D18A, whose "QANDEEL Voice" is a speaker identity rule.

### 8.2 The governing principle

> **Explicit controls for rights, privacy, deterministic settings and clear choices; learned adaptation for
> relationship / communication style.**

---

## 9. QANDEEL Memory

The existing selective, user-scoped, provenance-aware Memory capability is preserved:
- the Memory Runtime;
- I-08A4 §7, which places «ذاكرة قنديل / QANDEEL Memory» in the Personal domain and not as a Global Area.

P1 freezes the following:

- There is no dedicated Memory CRUD / editor page in v1.
- The user does not edit memory entries by hand.
- Memory works mainly in the background.
- The user can ask in conversation:
  - what QANDEEL remembers;
  - to correct a remembered fact;
  - that QANDEEL not rely on, or not remember, a matter again.

  All of this happens under existing authority: the Memory Runtime's supersession, `DISABLED` / `DELETED` lifecycle,
  "explicit remember request" write path and user-scoped authorization.
- Future transparency or review is not forbidden. P1 simply creates no primary Memory editor.

> **Memory and QANDEEL Understanding are not synonyms.**

Memory is what the Memory Runtime selects as worth carrying forward. QANDEEL Understanding (§11) is the user-facing
surface of QANDEEL's current understanding. P1 defines no data model linking the two.

---

## 10. Rename: `Readings / القراءات` → QANDEEL Understanding

For the Personal understanding surface frozen in §11, the canonical user-facing names are now:

| Language | Old | Now |
|---|---|---|
| English | `Readings` | **QANDEEL Understanding** |
| Arabic | «القراءات» | **«فهم قنديل»** |

The old singular `Reading / قراءة` is no longer the primary user-facing noun **for this surface**. The historical
records are unchanged (§15.1).

These supporting detail concepts are preserved where relevant, with their I-08A4 names:

- Analysis Details / «تفاصيل التحليل»
- Evidence / «الأدلة»
- Contradictions / «التناقضات»
- Alternatives / «البدائل»
- Unresolved Points / «نقاط غير محسومة»
- Analysis Evolution / «تطور التحليل»

**Scope of the rename.** It follows the Product Owner's decision for this Personal Understanding surface.

VI-01 and the G1.1 closure use «القراءات» / «قراءة» for a different concept: the **peer analytical readings inside a
Conversation's Analysis depth**. Their records:
- VI-01 Terminology Matrix O02, O06, S04 (contents), S06, A09 and T05–T07;
- G1.1 §2, «القراءات» "remains the analytical-content vocabulary inside that depth".

The implemented T-08 OrientationChrome copy uses it the same way.

P1 **intentionally preserves** that in-Analysis peer-reading vocabulary. «فهم قنديل / QANDEEL Understanding» names
the broader Personal Understanding surface; «قراءة / القراءات» continues to name equal, unranked analytical
interpretations inside Conversation Analysis. They are not synonyms and this is not an open Product question.

---

## 11. QANDEEL Understanding — the Product model

**«فهم قنديل / QANDEEL Understanding»** is a depth / surface of Personal QANDEEL.

- It lives inside Personal QANDEEL.
- It is **not** any of these:
  - a Global Area;
  - Settings;
  - a traditional Profile;
  - a metrics or personality-score dashboard;
  - a peer Product root.

  This agrees with I-08A4 §2, which keeps Living Understanding and Analysis as depths of the Personal domain, and with
  I-08A4 §19's rejected peer-root models.
- It has a stable, discoverable entry from Personal QANDEEL. The exact visual placement is later design work.

### 11.1 Scope

It may hold meaningful current understanding about:

- the user;
- important relationships;
- goals;
- major decisions;
- recurring patterns / themes.

It has no fixed empty category tabs created only to satisfy a taxonomy.

### 11.2 First view and detail

The first view puts the most important, current or recently changed understanding first. Each item carries a
human-readable title and a concise current summary.

The detail may show authorized, user-facing explanation:

- why QANDEEL currently sees it that way;
- supporting context / evidence;
- contradictory context / evidence;
- alternatives;
- unresolved points;
- evolution over time.

This is a user-facing explanation. It is **not** hidden model chain-of-thought.

### 11.3 Confidence

- There are no numeric confidence percentages and no psychometric scores.
- Confidence is a qualitative human state, conceptually one of:
  - clear;
  - forming;
  - mixed / contested;
  - needs more context.
- The exact wording is open copy, in both languages. The English words above are concept names, not copy.
- The state is said in words and is never carried by colour alone. This follows the existing accessibility canon
  (the E1R non-colour companion; T-14 §6, "errors are visible words, never a colour").

### 11.4 Correction and disagreement

- There is no direct field editor.
- Each item offers a route to **talk to QANDEEL about this**.
- An explicit disagreement makes the item contested / under review and causes re-evaluation. It does not delete the
  item automatically.

**Provenance.** The Product Owner's decision calls these "existing Contested / Under Review semantics". The only
repository authority that names them is I-08A4 §18, `PG-01 — User Interpretive Disagreement / Contested Reliance`. It
is recorded there as an unimplemented Product / runtime gap. P1 freezes the rule stated above and adds nothing to it.
`PG-01` stays a gap, and I-08A4 §18 still forbids pretending it is implemented.

### 11.5 Evolution

An understanding may:
- strengthen;
- weaken;
- change;
- become contested;
- be withdrawn.

Evolution belongs in the detail, not in a mandatory giant Timeline on the first view. `PG-02 — Personal Evidence
Invalidation → Derived Understanding Propagation` stays an unimplemented gap (I-08A4 §18).

### 11.6 Proactivity

Meaningful changes may be surfaced in conversation under the existing `I-08N-01` authority. Not every minor inference
becomes a notification. `I-08N-01` D35 is preserved: "Disabling proactive interruption does not disable QANDEEL's
Memory, understanding, analysis, or ability to continue relevant context inside conversation."

### 11.7 Privacy

- It is private by default.
- It is not copied automatically into a Shared World, the Public World or Introductions.
- `PG-04 — Selective Understanding Sharing` stays an unimplemented gap, and P1 creates no sharing capability.

The CW2-01 law is preserved:

> **Knowledge possession is not audience permission.**

Any cross-context reasoning or disclosure uses the existing authority of the target context:
- Shared: a Standing Context Grant (CW2-06 §42; `I-03`);
- Introductions: the Matching Context Grant and the currently authorized self-related context (CW2-06 F7, F20);
- Public: published material only (CW2-04 §8).

---

## 12. Appearance — controlled amendment to F2 / G2 / G3

### 12.1 The preference

The app appearance preference is one of:

- **Dark**
- **Light**
- **System**, which follows the OS appearance.

The new-user default is:

> **Dark**

Non-Analysis surfaces follow the preference the user selects. Examples:
- the Conversation;
- the private Matching proposal;
- the Shared World;
- General Settings.

Light and System stay fully available, so this is a user preference with a Dark default, not a forced app-wide dark
mode.

### 12.2 What is preserved without modification

> **The Analysis / Living Analysis experience remains the same dark immersive place under Dark, Light and System
> choices.**

- The G2 §F world law and the G2 / F2 Analysis-shell amendment §2 dark scope apply unchanged under all three
  preference values. The scope covers:
  - the status region;
  - the upper Analysis chrome;
  - the Replay entry;
  - the Timeline / Temporal Surface;
  - OrientationChrome;
  - the call line and call chrome;
  - the rail;
  - the home indicator and ground.
- There is no Light repaint of the world and no pale veil. No setting, including this one, repaints the Analysis place.
- The status-content legibility requirement (amendment §4) is unchanged.
- The Conversation ↔ Analysis boundary keeps F2's appearance-switch semantics wherever the two tones differ. That
  includes the Reduced Motion cut (amendment §3). P1 freezes no transition for the moment the user changes the
  preference itself. F2 stays the appearance-change authority.
- No F2 token and no preserved package byte changes. How a production token or configuration carries the preference,
  and its persistence and native behaviour, is later implementation work.
- The OS accessibility settings the existing canon honours are unaffected by the in-app choice.

F2 anticipated exactly this. `F2_APPEARANCE_SWITCH.md` records that "An explicit override is a Product preference
decision with its own surface, its own persistence and its own relationship to Settings QANDEEL does not yet have. It
is recorded as an open Product option rather than taken." P1 takes that option, and only for non-Analysis surfaces.

---

## 13. Exposure matrix

"Shared" is the `SHARED_WORLD` context, and "Introductions" is the Introductions capability together with the
`SHARED_WORLD / INTRODUCTION` it may create.

| Data / identity | Personal | Shared | Public | Introductions |
|---|---|---|---|---|
| internal `user_id` | hidden | hidden | hidden | hidden |
| Login ID | private | never | never | never |
| Email / phone | private | never | never | never; contact reaches a counterpart only as an owner-granted `CONTACT_METHOD` disclosure after Match (CW2-06 §44; `I-07D`) |
| Account Name | account / private | after membership acceptance | only if the user chooses real-name display | pre-Match: the separately confirmed Introduction First Name only (CW2-06 §12; §4). Later: only by the owner's progressive `FULL_NAME` disclosure |
| Account photo | optional / private | after membership acceptance | not automatic | not reused. The capability-owned Introduction image is shown only after Mutual Match (§14) |
| Shared ID | private credential the owner may share | new reachability only (§5) | never | never |
| Public ID | account-held Public alias | not a Shared route | default Public identity | never transferred automatically |
| QANDEEL Understanding | private | no automatic transfer | no hidden use | internal reasoning only under exact permission; no raw disclosure |

---

## 14. Introductions — three-stage progressive image disclosure

### 14.1 Before Mutual Match

The pre-Match law is preserved (CW2-06 §12, F12):

- no photo;
- no partial image;
- no blur;
- no visual profile.

### 14.2 After Mutual Match

Inside `SHARED_WORLD / INTRODUCTION`, an owner's Introduction image has exactly three user-visible stages:

1. **Strong Blur**
2. **Medium Blur**
3. **Clear / Full Image**

The exact blur radius or algorithm, image processing, animation, crop, caching and device rendering stay later craft.

### 14.3 Authority

Every advancement is controlled by the image owner. A transition may be prompted by:

- the owner choosing to reveal more;
- the counterpart asking for more;
- QANDEEL suggesting that the relationship or interaction has reached an appropriate moment.

But:

> **request / suggestion is not authority**

- No stage advances until the image owner explicitly approves it.
- The guided disclosure is sequential: **Strong Blur → Medium Blur → Clear**. One disclosure act advances at most one
  stage; there is no one-act skip from Strong Blur to Clear. If the owner wants to continue, the next stage requires a
  new explicit owner approval.
- Nothing reveals automatically on a hidden score or on elapsed time.
- P1 creates no request object and no pending grant. A counterpart's request carries zero authority, exactly as
  `I-07D` §35 already states for a QANDEEL suggestion.

### 14.4 Non-reciprocity

Each side progresses independently. One person's reveal never forces or advances the other's (CW2-06 §46, F36).

### 14.5 Runtime compatibility

P1 adds no backend resource type. The stages map onto the existing closed `I-07D` vocabulary:

| Product stage | Runtime resource |
|---|---|
| Strong Blur | a staged, owner-authorized `PARTIAL_IMAGE` resource version |
| Medium Blur | a further, separately owner-authorized `PARTIAL_IMAGE` resource version |
| Clear / Full Image | `FULL_IMAGE` |

This is what CW2-06 §45 means by "Staged image derivatives are separate bounded owner-authorized resources", and
`I-07D` already has the matching rule: "A partial image and a full image are two INDEPENDENT resource versions and
neither authorizes the other". Each stage is its own owner grant, bound to owner, resource version and exact
counterpart. No migration or schema changes.

---

## 15. Narrow precedence matrix

Each row names the older text, what it now reads as, and what stays in force. The older records are not edited.

### 15.1 I-08A4 — Product Shell / IA / Naming

| Older statement | Now reads | Preserved |
|---|---|---|
| §8 / §9 naming rows `Readings` = «القراءات», `Reading` = «قراءة» | for the Personal understanding surface: **QANDEEL Understanding / «فهم قنديل»** (§10) | every other §8 / §9 row, including Analysis Details, Evidence, Contradictions, Alternatives, Unresolved Points, Analysis Evolution and QANDEEL Memory |
| §7 "General settings may exist as secondary Global Shell utility" | exactly **one** General Settings destination; no Public Settings screen; no Settings page inside a Shared World (§8) | it is still secondary utility, not a primary Area. §19's rejection of "Settings as primary Area" stands |
| §7 "World governance belongs to the exact Shared World governed" | unchanged. Such operations are contextual management and actions of that World, not a Settings destination (§8) | the concept named «إعدادات العالم / World Settings» (§8 / §9) and its governed operations (CW2-03 §30; `I-04E`) keep their name and semantics. P1 decides no label |
| (no Profile concept existed) | **no traditional general Profile page** (§7) | the capability-owned Introduction Profile |
| §12 `{display_name}` | sourced from the account `Name` (§2.3) | no forced questionnaire; no unnecessary second name question |
| §18 `PG-01`, `PG-02`, `PG-04` | unchanged gaps; P1 states the Product rules that bear on them (§11.4, §11.5, §11.7) | "The Product must not pretend these gaps are implemented" |

### 15.2 F2 / G2 / G3 — appearance

| Older statement | Now reads | Preserved |
|---|---|---|
| F2 FINAL_CANONICAL "Default appearance follows the system" (`qandeel.appearance.system-appearance` = `follow-system-no-in-app-override`) | **for non-Analysis surfaces:** a user preference Dark / Light / System, new-user default **Dark**; System follows the OS (§12) | F2 stays the general appearance authority for everything else. No token or preserved byte changes |
| `F2_APPEARANCE_SWITCH.md`: an explicit override "is recorded as an open Product option rather than taken" | taken by P1, for non-Analysis surfaces | F2's appearance-switch semantics |
| G2 §F "No user-facing QANDEEL appearance override is introduced here" | still true of G2. P1 introduces the preference | the G2 §F world law, word for word |
| G2 / F2 Analysis-shell amendment §2 "Every surface that is not the Analysis keeps following the system appearance"; G3 §C.1 "Non-Analysis surfaces keep following the system appearance" | non-Analysis surfaces follow the **user's selected appearance** (System = the OS) | the whole Analysis dark scope, under all three values |
| the same amendment §2, "not a user appearance override, setting or toggle, in the Product or anywhere else"; G3 §C.1 "It is not … a user appearance override or toggle" | superseded **only** as to non-Analysis surfaces | for the Analysis place it still holds: no setting, P1's included, overrides or repaints it |
| the same amendment §5, "G2 §F's general F2 rule still governs every non-Analysis surface" | P1 §12 governs non-Analysis surfaces | — |
| G3 §F "No appearance setting, and no app-wide dark mode" | still true of G3, which implemented nothing. P1 is a Product decision, not an implementation, and a Dark default with Light and System available is not a forced app-wide dark mode | every other G3 §F item |

### 15.3 T-14 — Mobile Product Sign-In Gateway

| Older statement | Now reads | Preserved |
|---|---|---|
| §4 "Email input; password input; one submit …" as the entry; the failure copy "Email or password is incorrect." | the historical v1 implementation. The **final Product requirement** is one `Login ID OR Email` identifier input plus Password (§3); the final failure wording is open copy and stays generic | T-14's banner, runtime, copy and tests; its `CLOSED / FROZEN` lifecycle; its non-enumeration rule; its accessibility, keyboard and LTR-field decisions; `QAN-BL-SEC-01` |

### 15.4 Matching / Introductions — CW2-06 and `I-07`

| Older statement | Now reads | Preserved |
|---|---|---|
| CW2-06 §44 "partial image; full image"; §57 "exact progressive-image rendering method" deferred; `I-07D` §35 "The exact cropping, blurring and derivative-rendering algorithm stays deferred Product scope" | the semantic presentation is resolved: exactly three owner-controlled stages (§14) | the no-photo pre-Match law; owner authority; "Suggestion is not authority"; non-reciprocity; the five-type resource vocabulary; the schema. The numeric blur and the algorithm stay deferred |

### 15.5 Shared World — CW2-03 and `I-04`

| Older statement | Now reads | Preserved |
|---|---|---|
| CW2-03 §4 "Secret Shared invitation credential" | its Product name is **Shared ID** (§5.1) | private, non-searchable, distinct from Public Alias, rotatable, not World identity; the §5 epoch rule |
| CW2-03 §16 add-member "exact target proposal"; §28 rejoin | a new reachability act toward a non-member takes the target's **current Shared ID** at the application boundary (§5.2–§5.3) | born-World identity and history; unanimity; stale-invitation terminality; new-episode rejoin; `I-04` runtime unchanged |

### 15.6 Consumed unchanged

- G1.1 and G1.2, including G1.1 §2's in-Analysis «القراءات» (§10) and G1.2 §3's singular «العالم المشترك / Shared
  World».
- CW2-01, including §17 user-level state and A12.
- CW2-04 and `I-05`, apart from the Product policy in §6, which lands on a future boundary.
- `I-08N-01`, with no authority, privacy, interruption-class, Direct Entry or disclosure semantics reopened.
- The Memory Runtime.

---

## 16. Explicitly not frozen by P1

### 16.1 Deferred by the Product Owner's decision

- final Settings visual design, order and hierarchy;
- final icons;
- sign-up visual design and microcopy;
- the exact Login ID regex and the Public ID generation grammar;
- auth-resolution implementation;
- database migrations or schema;
- final export, delete-account and password-recovery journeys;
- media storage;
- the exact blur radius or algorithm;
- final Matching / Introduction mobile UI;
- the Matching algorithm;
- provider / model;
- pricing and the Credits formula;
- notification transport and UI beyond frozen authority;
- future 2FA and passkeys;
- Public avatar design;
- the exact QANDEEL Understanding entry-control visual.

### 16.2 Carry-forward implementation / runtime detail

P1 has **no remaining Product Owner decision question**. The reconciliation above resolves the Product semantics and
leaves only implementation-owned detail:

1. **Introduction First Name runtime seam.** The Product source is now the separately confirmed Introduction First Name
   (§4). The existing `I-07` seam `resolve_matching_canonical_first_name_v1` remains fail-closed until a later
   implementation task wires that Product field into the frozen boundary.
2. **Public ID persistence / namespace implementation.** The Product ID is unique (§6), but P1 creates no schema,
   index, normalization algorithm or migration.
3. **Shared-ID epoch enforcement for governed add / rejoin.** §5.3 freezes the Product requirement, including
   invalidation of not-yet-accepted reachability after rotation. The application/runtime enforcement is later work.
4. **Contested / Under Review runtime.** §11.4 freezes the Product meaning. The detailed lifecycle, reversal and
   downstream reliance behaviour remain with `PG-01`; `PG-02` and `PG-04` also remain unimplemented gaps.
5. **Progressive-image rendering craft.** §14 freezes the three sequential stages and owner approvals. Exact blur
   quantities, media derivatives, animation and device rendering remain later design / implementation craft.

None is permission to pretend the capability is already implemented.
---

## 17. Implementation status

**Nothing in this record is implemented by it.**

Today, on `main`:

| Area | State on `main` |
|---|---|
| mobile client | signs in by Email only (T-14) |
| Login ID, Shared-ID Product surface, Public ID policy | none of them exists |
| General Settings, sign-up, QANDEEL Understanding | none of them exists |
| appearance preference | none exists |
| Introduction image rendering | none exists |

Implementation follows the roadmap:
1. the End-to-End Product Experience Completeness Audit (including its complete account / authentication lifecycle
   review);
2. Production Integration.

Each still needs its own scoped Task Contract. This record authorizes none (roadmap §1 rule 2).

---

## 18. Governance — BG-05, BG-08 and BG-09

**Kickoff (BG-05).** [`docs/qandeel-canonical-backlog-v1.md`](qandeel-canonical-backlog-v1.md) was read in full at the
baseline. No item names P1, a Profile, Identity, Settings or Understanding task as its Owner task.

**Inherited: none.** The adjacent items are untouched and not claimed:

| Item | Why P1 does not touch it |
|---|---|
| `QAN-BL-SEC-01` | stays `DEFERRED — OWNED` by `QAN-SEC-01`. P1 changes no credential storage, backup policy or platform credential model |
| `QAN-BL-CW-01` | stays open. P1 decides no deletion remedy |
| `QAN-BL-VOICE-01` | no Voice decision here |
| `QAN-BL-NAV-01`, `QAN-BL-NAV-02` | navigation and Replay-surface items P1 neither implements nor blocks |
| `QAN-BL-VIS-01` | the Analysis world is unchanged |
| `OPEN-06`, `OPEN-08`, `OPEN-09`, `OPEN-19` | navigation and acknowledgement items P1 neither implements nor blocks |

**Admitted: none.** Each candidate residue was tested against BG-06's four admission routes, and none qualifies:

| Candidate | Why it is not admitted |
|---|---|
| the gap between the implemented Email-only T-14 gateway and the final sign-in requirement (§3) | a later implementation of a frozen decision. The roadmap already schedules the complete account / authentication lifecycle review in the End-to-End audit |
| the Shared-ID precondition at a future add / rejoin application boundary (§5.3) | lands on a boundary that does not exist yet. No current runtime violates it, because no application role can reach the governed cores |
| the §16.2 carry-forwards | implementation/runtime detail beneath Product decisions frozen here. The first-name seam is already fail-closed in CW2-06 / `I-07`; the Shared-ID boundary does not exist yet; `PG-01`, `PG-02` and `PG-04` are already named gaps in frozen I-08A4 §18 |

None of these carries an existing `OPEN` identifier. No canonical document defers any of them **as an obligation** to a
named future task; the roadmap phases are sequencing, not tasks. None is carried forward for validation, and
Architecture designated none.

**BG-01.** There are no current P1 blockers, so none was moved here. The task contract forbade runtime change, so no
runtime delta is a P1 defect.

This is not blocker laundering. Architecture remains free to designate any of the above under BG-06.

**No backlog closure record.** `tests/task-closure-governance-contract.test.mjs` governs `T-` tasks through index
tombstones and Connected Worlds `I-0N` phases through `### I-0N closure record` headings. P1 is neither and has no
backlog item, so the contract requires no P1 record and none is manufactured.

**BG-09.** This document is P1's primary canonical record. It carries its final lifecycle banner in the closing change
itself. The same change updates:
- [`QANDEEL_CURRENT_STATE.md`](../QANDEEL_CURRENT_STATE.md), [`QANDEEL_PROJECT_MAP.md`](../QANDEEL_PROJECT_MAP.md) and
  [`QANDEEL_PRODUCT_ROADMAP.md`](../QANDEEL_PRODUCT_ROADMAP.md);
- the "later amendments" columns of
  [`CANONICAL_AUTHORITY_INDEX.md`](canonical-authority/CANONICAL_AUTHORITY_INDEX.md) and
  [`QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md).

No successor task is left to synchronize any of them.

---

## 19. Closure method (Skills Gate)

The installed skills were inspected. None covers documentation governance or change control. Three bear on wording
this record had to get right. Repository canon and the Product Owner's decisions outranked each of them.

| Skill | Concrete effect on this record |
|---|---|
| `sibawayh:writing-eloquent-arabic` | No Arabic copy is authored here. The only new Arabic term is the Product Owner's «فهم قنديل», a natural iḍāfa with no calque. Settings groups and confidence states are written as English concept names and explicitly labelled open copy, so no unreviewed Arabic label can be read as canonical (§8.1, §11.3) |
| `sibawayh:designing-arabic-frontends` | Latin identifiers (Login ID, Shared ID, Public ID) shown in Arabic RTL surfaces are mixed-direction content. They are carried **by reference** to I-08A4 §16 ("mixed-direction content", "`{display_name}` rendering") and T-14 §5 (credential fields stay LTR), not restated as a new rule |
| `ui-ux-pro-max` (its reference rules; the search script needs Python, which this host lacks) | It confirmed that the frozen decisions match the fundamentals: persistent helper text rather than a placeholder (§2.1); a prominent warning before an irreversible change (§6); meaning never carried by colour alone (§11.3). Its generic "state the cause" error guidance is **outranked** by the non-enumeration rule for credential failures (§3). Settings order and the separation of destructive actions stay open, not frozen from generic advice (§8.1) |

No accessibility-specific skill is installed. Accessibility law is carried by reference to the existing canon, and none
is added.

---

## 20. Closure

> **P1 — CLOSED / FROZEN — USER IDENTITY / PREFERENCES / QANDEEL UNDERSTANDING PRODUCT CONTRACT**

This is binding on the merge of the pull request that carries this record. Production implementation remains open.
The next Product decision track is **P2 — Final Iconography System**.
