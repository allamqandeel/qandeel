# QANDEEL — I-08N-01
## Notification & Proactive Attention Product Contract
### Complete Review Package

**Major Phase:** `I-08 — Final Product Experience & Mobile Realization`  
**Track:** Notification / Proactive Attention  
**Task:** `I-08N-01 — Notification & Proactive Attention Product Contract`  
**Status:** `CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN`  
**Depends on:** `I-08A — Canonical Product Shell / IA / Naming Foundation — FROZEN`  
**Dependency status:** `VERIFIED / SATISFIED`  
**Scope:** Product behavior, attention policy, privacy, authority, delivery semantics, user controls, notification lifecycle  
**Does not define:** implementation schema, numeric thresholds, scoring weights, visual morphology, final notification UI, platform-specific code

---

# 1. Purpose

`I-08N-01` defines when QANDEEL may interrupt the user, how proactive re-engagement may work, what may appear outside the authenticated Product, how notification events map to Product contexts and authority, how attention should be budgeted, and how notification delivery differs from canonical Product truth.

The Product goal is:

> **QANDEEL should feel present enough that the user remembers he is there and wants to return to him — without ever feeling mechanically chased by the app.**

The governing re-engagement principle is:

> **Relationship-driven re-engagement = allowed and desirable.**

> **Engagement optimization detached from user value = not allowed.**

---

# 2. Non-Negotiable Notification Invariants

> **Notification ≠ Truth Source**

> **Notification ≠ Authority Expansion**

> **Notification cannot move information across World boundaries**

> **Notification tap must obey the frozen Direct Entry contract**

> **Frequency control must optimize relationship quality and user attention — not notification volume.**

> **Notification orchestration optimizes interruption quality, not delivery completion.**

> **Push is an interruption privilege, not the default delivery channel.**

> **User preference may reduce interruption, but must never silently expand disclosure or authority.**

---

# 3. Relationship-Driven Re-Engagement Principle

QANDEEL may intentionally use notifications to reopen the relationship, bring the user back into the app, and invite interaction — provided that the reason is grounded in genuine user context, continuity, care, or timely usefulness.

Legitimate examples include:

- meaningful absence relative to that user's established pattern;
- post-event check-ins;
- ongoing decisions, goals, commitments, or personal situations;
- unresolved conversational threads;
- meaningful progress or change;
- prior requests to revisit a topic;
- natural conversational moments worth reopening.

QANDEEL must never use:

- artificial urgency;
- guilt;
- FOMO;
- fabricated concern;
- random “come back” prompts;
- streak mechanics;
- generic engagement hooks;
- excessive persistence.

A legitimate relationship-continuity reason may itself be meaningful even without an external event or explicit practical task.

Natural conversational timing may itself make a notification useful now.

---

# 4. Proactive Gate

Every proactive notification candidate must pass a Product gate.

## `P1 — Meaningful`

There must be a legitimate reason grounded in the user's real context, relationship continuity, ongoing topic, established pattern, meaningful progress, decision, goal, or unresolved matter.

An external event or practical task is **not required**.

## `P2 — Useful Now`

The timing itself must add value.

This includes:

- urgency;
- a genuine time window;
- natural post-event follow-up;
- a natural relationship moment;
- a useful point to return to an ongoing topic.

## `P3 — Actionable or Reflectively Valuable`

The notification should enable meaningful action, useful reflection, or legitimate relationship continuation.

## `P4 — Sufficient Basis`

QANDEEL must have enough legitimate basis to justify requesting attention.

Notification wording must not convert a weak hypothesis into fact.

## `P5 — Privacy Safe`

The notification must respect the Disclosure Contract.

## `P6 — Non-Mechanical Repetition`

The same topic must not be repeated mechanically merely because the user did not respond.

## `P7 — Respectful Timing`

Quiet Hours, recent burden, current delivery suitability and user preferences apply.

---

# 5. Relationship Continuity Signals

The proactive system must support relationship-continuity signals including, but not limited to:

- expected interaction rhythm;
- meaningful absence relative to that user's own established pattern;
- unresolved conversational threads;
- known future events mentioned by the user;
- natural post-event follow-up windows;
- ongoing goals / decisions / commitments;
- meaningful progress or change;
- prior requests to revisit a topic.

These are:

> **inputs to the Proactive Gate, not automatic notification triggers.**

No exact thresholds, inactivity durations, scoring formulas, or numeric weights are frozen here.

---

# 6. Decision Record — Proactive Foundation

## `N-01-D01 — Proactive QANDEEL Allowed`

**APPROVED**

QANDEEL may initiate notifications without an explicit user-created reminder when the reason is grounded in genuine context, continuity, care, or timely usefulness.

Relationship-driven re-engagement is a legitimate Product behavior.

The purpose may include intentionally bringing the user back into the QANDEEL relationship.

What is not allowed is engagement optimization detached from user value.

---

## `N-01-D02 — Privacy-First Lock Screen`

**APPROVED**

The default Lock Screen posture is privacy-first.

Personal or sensitive Product content must not be exposed merely because a notification is legitimate.

Detailed disclosure is governed by `D14–D17`.

---

## `N-01-D03 — Public Discovery Push`

**APPROVED**

Public discovery Push is:

- opt-in;
- low-frequency;
- low interruption priority by default.

It must not become an engagement stream.

---

## `N-01-D04 — Important but Non-Urgent Proactive Push`

**APPROVED**

QANDEEL may send proactive Push about an important but non-urgent subject if it passes the Proactive Gate.

Eligible subject types include:

- patterns;
- goals;
- unresolved topics;
- meaningful follow-ups;
- relationship continuity;
- ongoing decisions;
- ongoing personal situations.

It is not restricted to appointments or near-term reminders.

---

## `N-01-D05 — Re-engagement After an Ignored Proactive Notification`

**APPROVED — DYNAMIC**

There is no universal rule of:

- never repeat; or
- repeat exactly once.

The decision is dynamic based on:

- importance;
- freshness;
- new context;
- interaction history;
- previous notification response;
- topic sensitivity;
- time elapsed;
- notification burden;
- whether continued silence changes relevance.

A second notification may be justified in some cases and inappropriate in others.

But:

> **Ignoring a notification must never by itself be interpreted as evidence about the user's emotional state, intention, relationship, or personal situation.**

Repeated follow-up becomes progressively harder to justify.

---

## `N-01-D06 — Quiet Hours`

**APPROVED**

Default rule:

> **Proactive QANDEEL notifications respect Quiet Hours.**

Default exceptions:

1. exact-time reminder explicitly requested by the user;
2. critical security/account event that genuinely requires timely attention.

Ordinary Personal proactive follow-ups, relationship continuity, analysis, Shared activity, Public activity, and Introductions activity wait until Quiet Hours end.

Future settings may explicitly allow broader QANDEEL interruption during Quiet Hours.

---

# 7. Frequency Budget Architecture

## `N-01-D07 — Hybrid Adaptive Budget`

**APPROVED**

Each user has an adaptive personal notification budget that can adapt to:

- usage pattern;
- response rate;
- notification types the user engages with;
- recent notification burden;
- topic sensitivity;
- nature of the ongoing QANDEEL relationship.

The adaptive layer remains within a:

> **hard safety ceiling**

that prevents excessive interruption even if adaptive logic or the model fails.

No numeric thresholds are frozen.

Core rule:

> **The notification budget is a ceiling, not a quota.**

Unused budget never creates a reason to send a notification.

---

## `N-01-D08 — Global Attention Budget + Category Sub-Budgets`

**APPROVED**

User attention is treated as one Product resource.

There is a:

> **Global Attention Budget**

with category sub-budgets including at least:

- Personal / Proactive QANDEEL;
- Shared Worlds;
- Public World;
- Introductions;
- System / Account.

The architecture must prevent independent systems from collectively overwhelming the user.

Higher-value attention may displace lower-value pending attention.

Outside ordinary budget competition:

- critical security/account notifications;
- exact-time reminders explicitly requested by the user.

These exceptions still obey privacy and authority.

---

## `N-01-D09 — Intelligent Coalescing`

**APPROVED**

The notification orchestrator may intelligently coalesce events when doing so preserves:

- meaning;
- urgency;
- ownership;
- authority;
- privacy;
- correct Direct Entry destination.

Coalescing is not mandatory.

Do not coalesce when it would:

- hide an important event;
- mix different Worlds;
- mix Personal / Shared / Public authority;
- increase disclosure;
- create ambiguous Direct Entry.

---

# 8. Prioritization / Interruption Hierarchy

## `N-01-D10 — Interruption Classes`

**APPROVED**

### Class 1 — Critical

Reserved for genuinely urgent events such as:

- critical security/account events;
- critical system events requiring timely user action.

Not used merely for relationship continuity, analysis, Shared activity, Public activity, or Introductions.

Never bypasses privacy or authority.

### Class 2 — Timely

A real timing window exists and delayed delivery materially reduces value.

Examples:

- exact-time reminder;
- natural post-event follow-up;
- time-sensitive Shared event;
- time-relevant Introductions event.

### Class 3 — Meaningful

Important but not immediately time-critical.

Examples:

- important pattern;
- unresolved thread;
- ongoing decision;
- progress worth acknowledging;
- relationship continuity;
- meaningful absence;
- ongoing goal or personal situation.

### Class 4 — Ambient / Discovery

Lowest interruption value.

Examples:

- Public discovery;
- optional exploration;
- low-priority social activity;
- low-value discovery content.

Core law:

> **Interruption Class describes the event's interruption value, not its Product category.**

---

## `N-01-D11 — Priority Ordering`

**APPROVED**

> **Priority is primarily event-value driven, with category bias — not category-only ranking.**

Priority factors include:

- interruption class;
- urgency / timing window;
- expected user value;
- personal relevance;
- freshness;
- consequence of delay;
- topic sensitivity;
- relationship continuity relevance;
- current attention burden;
- category bias.

No absolute fixed category ranking is frozen.

---

## `N-01-D12 — Interruption Surface Selection`

**APPROVED**

Possible delivery surfaces:

- Push notification;
- In-app notification/presentation;
- Inbox / Activity item;
- Badge only;
- Deferred until next conversation;
- Suppressed entirely.

Selection considers:

- interruption class;
- timing value;
- user value;
- privacy;
- attention budget;
- notification history;
- Product context.

Invariant:

> **Push is an interruption privilege, not the default delivery channel.**

---

## `N-01-D13 — Priority Override / Preemption`

**APPROVED**

> **A higher-value event may preempt, defer, coalesce, or suppress a lower-value pending notification when Product meaning, authority, privacy, and event truth remain intact.**

Preemption affects delivery, not canonical event truth.

Invariant:

> **Notification orchestration optimizes interruption quality, not delivery completion.**

---

# 9. Privacy + Lock-Screen Disclosure Matrix

## `N-01-D14 — Four Disclosure Levels`

**APPROVED**

- `L0 — Minimal`
- `L1 — Generic`
- `L2 — Bounded Context`
- `L3 — Content Preview`

Core law:

> **Disclosure level describes what may be revealed outside the authenticated Product surface — not event importance or Interruption Class.**

A Critical event does not automatically justify richer disclosure.

---

## `N-01-D15 — Default Disclosure Matrix`

**APPROVED**

| Category | Default disclosure |
|---|---|
| Personal / Proactive QANDEEL | `L1` |
| Shared Worlds | `L2` |
| Public interactions | `L2` |
| Public discovery | `L1` |
| Introductions | `L0` |
| User-requested reminders | `L2` |
| System / account | `L2` — minimum needed |
| Critical security | `L2` — even when Critical |

Special rule for Introductions:

> By default, the notification must not even reveal that the event relates to Introductions.

---

## `N-01-D16 — Explicit Per-Category Rich Preview Control`

**APPROVED**

The user may explicitly raise disclosure permission independently per category.

Notification engagement does not imply richer disclosure consent.

> **Richer disclosure requires explicit user permission.**

---

## `N-01-D17 — User Preference Is a Ceiling`

**APPROVED**

> **User disclosure preference defines the maximum permitted disclosure, not a required disclosure level.**

Even when `L3` is allowed, QANDEEL may downgrade to `L2`, `L1`, or `L0`.

QANDEEL may never exceed the user's permitted ceiling.

---

# 10. Disclosure-Safe Rendering Architecture

Conceptual flow:

```text
Event / Context
    ↓
Authority Check
    ↓
Disclosure Policy
    ↓
Bounded Safe Projection
    ↓
Notification Copy
```

Invariant:

> **The notification renderer receives only the disclosure-safe bounded projection required for that notification.**

Also:

> **No notification preview may combine disclosure across different Worlds or authorities.**

---

# 11. Notification Content + Copy Contract

## `N-01-D18 — Speaker Identity`

**APPROVED**

### QANDEEL Voice

Used when QANDEEL is genuinely initiating communication:

- Personal follow-up;
- relationship continuity;
- post-event check-in;
- unresolved thread;
- meaningful progress;
- proactive reflection.

Core law:

> **A notification speaks as QANDEEL only when QANDEEL is genuinely the actor initiating that communication.**

And:

> **QANDEEL Voice inherits the user's active QANDEEL conversational language/dialect profile.**

### Product / System Voice

Used for:

- Shared activity;
- Public activity;
- Introductions;
- account/security;
- technical/system status.

This uses localized neutral Product language.

Summary:

> **QANDEEL Voice = relational + dialect/persona localized**

> **System Voice = neutral Product localization**

---

## `N-01-D18A — Voice Profile Resolution`

**APPROVED**

Speaker-specific conceptual flow:

```text
Notification Candidate
    ↓
Speaker Identity
    ├── QANDEEL Voice
    │     ↓
    │   User Language / Dialect Profile
    │     ↓
    │   Authorized Relationship Style Profile
    │     ↓
    │   Disclosure-Safe Projection
    │     ↓
    │   Relationship-Personalized QANDEEL Copy
    │
    └── Product / System Voice
          ↓
        Neutral Localized Product Language
          ↓
        Disclosure-Safe Projection
          ↓
        System Copy
```

The Personalized Relationship Style Profile applies only to genuine QANDEEL Voice.

It must not be applied to Product / System Voice merely to make a system event feel conversational.

Speaker selection remains based on who is genuinely initiating the communication.

The system must not:

- hard-code Egyptian Arabic as universal Arabic;
- literally translate dialect phrases between dialects;
- switch dialect unpredictably between conversation and notification;
- infer a richer/more specific dialect than legitimately known.

If no conversational dialect/profile is established, fall back to the appropriate neutral localized language.

---

## `N-01-D18B — Personalized Relationship Voice`

**APPROVED**

QANDEEL has stable:

- principles;
- safety boundaries;
- epistemic rules;
- Product identity.

But his manner of speaking adapts to the user based on legitimate authorized understanding of communication preferences and relationship history.

Possible dimensions include:

- warmth vs formality;
- emotional softness vs directness;
- brevity vs detail;
- reassurance level;
- conversational energy;
- humor;
- familiarity;
- challenge style;
- follow-up gentleness;
- affectionate vs neutral vs professional vs concise tone.

This applies to:

- live conversation;
- voice;
- analysis explanations;
- proactive follow-ups;
- QANDEEL-authored notifications.

Core formula:

> **QANDEEL Voice = language/dialect profile + personalized relationship style + stable QANDEEL principles.**

Personalization may use only legitimate authorized Personal memory/context.

It must not:

- import style assumptions from another World without authority;
- infer sensitive traits solely from notification behavior;
- treat a temporary mood as permanent preference;
- manipulate emotional vulnerabilities;
- imitate intimacy that has not actually developed.

Adaptation is:

- evidence-based;
- revisable;
- user-correctable.

For genuine QANDEEL-authored notifications, the relationship-personalized branch is:

```text
Speaker Identity = QANDEEL Voice
    ↓
User Language / Dialect Profile
    ↓
Authorized Relationship Style Profile
    ↓
Disclosure-Safe Projection
    ↓
Relationship-Personalized QANDEEL Copy
```

Product / System Voice does not consume the Authorized Relationship Style Profile.

Invariants:

> **QANDEEL's principles are stable; his manner of speaking adapts to the person.**

> **Personalization may deepen the relationship, but must never exploit the user's emotional needs for engagement.**

> **The same user should recognize the same QANDEEL personality across conversation, voice, analysis, and notifications.**

No exact style dimensions, scoring, or memory schema are frozen.

---

## `N-01-D19 — Relationship Voice Is Allowed`

**APPROVED**

Warm, natural relationship language is allowed and should sound natural for the user's actual QANDEEL voice profile.

> **Warmth is allowed; fabricated emotion is not.**

---

## `N-01-D20 — No Manipulative Copy`

**APPROVED**

Notification copy must not use:

- guilt;
- FOMO;
- artificial urgency;
- emotional pressure;
- streak language;
- fake scarcity;
- fabricated concern;
- engagement bait.

> **Notification copy may invite relationship, but must never exploit the relationship.**

---

## `N-01-D21 — Contextual Specificity Inside Safe Projection`

**APPROVED**

Notification copy may personalize only from the disclosure-safe bounded projection it receives.

---

## `N-01-D22 — No Epistemic Overstatement`

**APPROVED**

> **Notification brevity never permits epistemic exaggeration.**

Global identity invariant:

> **QANDEEL must sound like the same QANDEEL whether the user is inside the conversation or seeing a notification outside the app.**

Language, dialect, warmth and relationship tone may adapt.

Truth, privacy, authority and epistemic rules do not.

---

# 12. Event Eligibility Matrix

## `N-01-D23 — Personal / Proactive QANDEEL`

**APPROVED**

Push-eligible, subject to the Proactive Gate:

- post-event follow-up;
- unresolved thread;
- meaningful absence;
- progress acknowledgement;
- ongoing goal follow-up;
- ongoing decision follow-up;
- pattern worth revisiting;
- prior request to revisit a topic;
- natural relationship-continuity check-in.

Invariant:

> **Eligible reason ≠ automatic trigger.**

---

## `N-01-D24 — Shared Worlds`

**APPROVED**

Potentially Push-eligible:

- direct reply / mention;
- meaningful member action;
- governance / permission change;
- time-sensitive Shared event;
- invitation / membership change;
- important shared decision/event.

Ordinary/passive/low-value activity is In-app / Activity by default.

> **Shared activity earns interruption based on user relevance, not merely because activity occurred.**

---

## `N-01-D25 — Public World`

**APPROVED**

Potentially Push-eligible:

- direct reply;
- meaningful user-related interaction;
- important moderation/account consequence related to the user's Public activity.

Usually Activity/Badge:

- generic reactions;
- ordinary engagement;
- low-value social activity.

Public discovery remains:

- opt-in;
- low-frequency;
- usually Class 4;
- first candidate for suppression.

---

## `N-01-D26 — Introductions`

**APPROVED WITH AUTHORITY CONSTRAINT**

Push-eligible:

- legitimate introduction proposal;
- acceptance;
- mutual acceptance;
- time-sensitive required action;
- important state change.

But:

> **Introduction notifications are eligible only when the user has legitimately enabled/entered the Introductions capability and the relevant authority/consent exists.**

The mere existence of the capability does not authorize proposal notifications.

Preserved:

- default disclosure = `L0`;
- no capability/person identity on Lock Screen by default;
- no marketing-style nudges;
- no romantic-pressure nudges.

---

## `N-01-D27 — System / Account`

**APPROVED**

Push is appropriate only for materially relevant user events such as:

- security;
- account access;
- required permission/action;
- Product-access-affecting failure;
- materially relevant billing/subscription event.

Routine internal/runtime state must not surface as Push.

> **System notifications support user control and Product reliability — they do not expose internal runtime noise.**

---

# 13. In-App Notification Center / Activity Architecture

## `N-01-D28 — Global Activity Surface`

**APPROVED**

There is a unified user-facing Activity surface across:

- Personal / QANDEEL;
- Shared Worlds;
- Public World;
- Introductions;
- System / Account.

Core law:

> **One Activity surface may aggregate visibility without aggregating truth, authority, ownership, or scope.**

Each Activity item retains:

- source;
- authority;
- ownership;
- disclosure boundary;
- Direct Entry destination.

Also:

> **Activity may expose an event, but actions on that event must execute under the originating Product context and authority.**

---

## `N-01-D29 — Activity ≠ Canonical Event Store`

**APPROVED**

The Activity surface is a user-facing projection, not the owner/source of truth for underlying events.

---

## `N-01-D30 — Semantic Category Separation`

**APPROVED**

Activity preserves semantic separation between:

- من قنديل / From QANDEEL;
- Shared Worlds;
- Public World;
- Introductions;
- System / Account.

The visual morphology is not frozen.

---

## `N-01-D31 — Seen / Read State`

**APPROVED**

> **Seen/read state is user attention state only.**

It does not mutate truth, authority, or canonical event lifecycle.

---

## `N-01-D32 — Activity Retention`

**APPROVED**

Retention depends on:

- event meaning;
- category;
- lifecycle.

> **Activity retention follows Product meaning, not one universal expiry rule.**

No numeric retention periods are frozen.

---

# 14. Notification Controls + User Preferences

## `N-01-D33 — Layered Controls`

**APPROVED**

Controls follow Product meaning:

- Personal / Proactive QANDEEL;
- Shared Worlds;
- Public World;
- Introductions;
- System / Account.

> **Notification control follows Product meaning, not implementation channels.**

---

## `N-01-D34 — Per-World / Per-Context Control`

**APPROVED**

A user may mute a specific Shared World or appropriate context without muting unrelated contexts.

> **Muting one context must not mutate or mute another context.**

---

## `N-01-D35 — Proactive QANDEEL User Control`

**APPROVED**

The user may allow, reduce, or disable Proactive QANDEEL interruption.

But:

> **Disabling proactive interruption does not disable QANDEEL's Memory, understanding, analysis, or ability to continue relevant context inside conversation.**

This controls interruption, not QANDEEL's underlying understanding.

---

## `N-01-D36 — Critical System Exception`

**APPROVED**

Critical security/account events do not obey normal in-app mute logic.

But:

> **This exception does not bypass OS-level notification permission or platform restrictions.**

Always preserve:

- privacy;
- minimal necessary disclosure;
- no marketing use.

---

## `N-01-D37 — Quiet Hours + Temporary Snooze`

**APPROVED**

Quiet Hours and temporary Snooze affect interruption only.

They do not:

- delete events;
- change truth;
- change authority;
- prevent later Activity presentation.

Default exceptions remain:

- exact-time reminder explicitly requested by the user;
- critical security/account event.

Invariant:

> **User preference may reduce interruption, but must never silently expand disclosure or authority.**

Notification frequency/control and Disclosure permission remain separate contracts.

---

# 15. Tap / Direct Entry + Notification Lifecycle

## `N-01-D38 — Tap Revalidates Everything`

**APPROVED**

At tap/open time, revalidate:

- target;
- current validity;
- availability;
- authority;
- owning context;
- current user eligibility.

> **Notification authority is evaluated at tap time, not assumed from send time.**

---

## `N-01-D39 — Invalid / Stale Target Handling`

**APPROVED**

No substitute guessing.

No random redirect.

Fallback is safe and tied to the originating Product context.

> **Stale notification ≠ permission to invent a replacement destination.**

---

## `N-01-D40 — Tap Does Not Equal Resolution`

**APPROVED**

> **Open/seen state ≠ event resolution.**

---

## `N-01-D41 — Semantic Notification Lifecycle`

**APPROVED**

Candidate evaluation comes before notification lifecycle.

Merely being considered does not make something Pending.

Semantic notification evidence concepts may include:

- `Pending`;
- `Delivered`;
- `Presented`;
- `Seen`;
- `Opened`;
- `Deferred`;
- `Suppressed`;
- `Expired / Stale`.

`Delivered`, `Presented`, `Seen`, and `Opened` are distinct concepts.

A platform may provide evidence for one without proving another.

Important:

> **Do not infer Delivered, Presented, Seen, or Opened without evidence available from the platform/Product.**

And:

> **Do not infer one of Delivered / Presented / Seen / Opened merely from another unless legitimate platform/Product evidence supports that transition.**

And:

> **Notification lifecycle = delivery/attention state, not canonical event state.**

This remains a semantic Product contract only. No implementation state machine/schema is frozen.

---

## `N-01-D42 — Notification Actions Execute in Origin Context`

**APPROVED**

Any Product action from a notification must use:

- current authority;
- current eligibility;
- originating context validation.

> **Notification action ≠ authority bypass.**

---

## `N-01-D43 — No Cross-World Resume Leakage`

**APPROVED**

Notification Direct Entry may change the visible Product context.

It must not merge/rewrite preserved state in another Area.

> **Direct Entry changes where the user is looking, not the truth or ownership of the contexts they came from.**

---

# 16. Badges + Notification Counts + Attention Indicators

## `N-01-D44 — Badge Meaning`

**APPROVED WITH REFINEMENT**

> **Badge state represents attention-worthy items that have not yet reached the appropriate user-attention state for that projection — not raw event volume and not canonical event resolution.**

---

## `N-01-D45 — Global + Category Indicators`

**APPROVED**

The Product semantically supports:

- Global attention indicator;
- Category/local indicators.

But:

> **Global attention state must be derived from eligible attention items, not a raw arithmetic sum of category counts.**

No visual morphology is frozen.

---

## `N-01-D46 — No Streak / Pressure Mechanics`

**APPROVED**

Forbidden:

- streaks;
- falling-behind pressure;
- artificial countdowns;
- escalating badge pressure;
- anxiety-generating return mechanics.

> **Attention indicators may inform; they must not coerce.**

---

## `N-01-D47 — Clearing Semantics`

**APPROVED**

Opening Activity/Area does not automatically clear all indicators.

Each item/category has an appropriate attention state that determines clearing.

> **Clearing attention state never resolves canonical event truth.**

---

## `N-01-D48 — Sensitive Count Disclosure`

**APPROVED**

Sensitive categories, especially Introductions, may use presence/dot without explicit count.

> **Count visibility is itself a disclosure decision.**

Counts must not make Introductions feel like a marketplace or candidate inventory.

Any badge/count outside the authenticated Product remains subject to the Disclosure Contract.

---

# 17. Delivery Channels + OS Integration

## `N-01-D49 — Product Intent Is Channel-Independent`

**APPROVED**

> **Delivery channel is a projection of notification intent, not the source of its meaning.**

Current channels:

- OS Push;
- In-app presentation;
- Activity;
- Badge.

Future channels such as Email/SMS require a separate Product contract before use.

---

## `N-01-D50 — OS Permission Is a Hard Delivery Boundary`

**APPROVED**

If the user refuses OS notification permission:

- Push is not available;
- event truth remains;
- Product eligibility remains;
- in-app/Activity may still be used where appropriate.

Permission request should be contextual, not automatically demanded on first app launch.

Also:

> **QANDEEL must not repeatedly pressure the user to enable OS notifications after refusal.**

A new request is appropriate only when:

- new legitimate context explains real value; or
- the user goes to settings intentionally.

---

## `N-01-D51 — Foreground Suppression / Surface Adaptation`

**APPROVED**

When the Product already has the user's attention, especially inside the originating context, do not repeat an unnecessary external OS Push.

> **Do not interrupt externally when the Product already has the user's attention and can communicate appropriately in-app.**

---

## `N-01-D52 — OS Categories Reflect Product Semantics`

**APPROVED**

Platform channels/categories may map to:

- Personal;
- Shared;
- Public;
- Introductions;
- System.

But:

> **Platform capability may shape delivery mechanics, but must not redefine Product notification semantics.**

---

## `N-01-D53 — Multi-Device Delivery + Deduplication`

**APPROVED**

Maintain separation between:

- **User-level attention state**
- **Per-device delivery evidence**

If Seen/Opened is proven on one device, user-level attention state may synchronize.

But another device must not be claimed to have received, presented, seen, or opened without device-specific evidence.

> **Cross-device coordination may reduce duplicate interruption, but must not fabricate per-device delivery evidence.**

Any OS quick action remains subject to `D42`.

---

# 18. Failure / Offline / Retry Behavior

## `N-01-D54 — Retry Preserves Original Intent`

**APPROVED — RECONCILED BY `N01-REV-01`**

> **Retry retries delivery, not Product meaning.**

Retry preserves:

- notification identity;
- underlying event basis;
- originating Product context;
- semantic notification intent.

Retry does **not** assume that the previous:

- authority;
- user eligibility;
- disclosure level;
- notification preference;
- privacy permission;
- delivery suitability

remain valid.

These are revalidated at retry time.

A retry may therefore:

- keep the same disclosure;
- downgrade disclosure;
- defer;
- change delivery surface;
- suppress delivery entirely.

Previously generated notification copy must not be reused when current disclosure policy no longer permits it.

Core rule:

> **Retry preserves notification intent, not stale authorization or stale disclosure permission.**

---

## `N-01-D55 — Revalidate Before Late Retry`

**APPROVED**

A delayed retry revalidates:

- relevance;
- timeliness;
- authority;
- user eligibility;
- disclosure policy;
- privacy permission;
- notification preference;
- attention budget;
- Quiet Hours;
- current delivery suitability.

> **A technically retryable notification may no longer be Product-eligible.**

`D54` preserves the semantic notification intent; `D55` re-establishes whether, how, and at what disclosure level that intent may still be delivered now.

---

## `N-01-D56 — Offline Does Not Create Evidence`

**APPROVED**

Do not infer:

- Delivered;
- Presented;
- Seen;
- Opened

without evidence.

> **Unknown delivery remains unknown.**

---

## `N-01-D57 — Duplicate Prevention`

**APPROVED WITH CLARIFICATION**

Use stable identity + deduplication semantics against duplication caused by:

- retries;
- reconnects;
- worker duplication;
- multi-device recovery.

Stable identity is tied to:

> **the same notification delivery intent**

not permanently to the underlying canonical event.

The same canonical event may later create a new notification only when there is:

> **new meaningful context + new Gate evaluation + legitimate new notification intent**

Invariant:

> **Technical repetition ≠ new notification opportunity.**

---

## `N-01-D58 — Failure Fallback`

**APPROVED**

Push failure may result in:

- Activity;
- in-app presentation;
- suppression;

depending on Product meaning.

But:

> **Push failure does not create an obligation to deliver through another channel.**

---

## `N-01-D59 — No Retry Past Semantic Expiry`

**APPROVED**

When the interruption's semantic timing window has expired, do not send it merely because a previous delivery attempt failed.

The canonical event may still exist independently.

> **Do not retry stale interruption merely because delivery previously failed.**

---

# 19. Consolidated Notification Orchestration Model

```text
Underlying Product Event / Relationship Signal
    ↓
Eligibility / Proactive Gate
    ↓
Origin Context + Authority Validation
    ↓
Interruption Class
    ↓
Global Attention Budget + Category Budget
    ↓
Priority / Preemption / Coalescing
    ↓
Delivery Surface Selection
    ↓
Speaker Identity
    ├── QANDEEL Voice
    │     ↓
    │   User Language / Dialect Profile
    │     ↓
    │   Authorized Relationship Style Profile
    │     ↓
    │   Disclosure Policy
    │     ↓
    │   Bounded Safe Projection
    │     ↓
    │   Relationship-Personalized QANDEEL Copy
    │
    └── Product / System Voice
          ↓
        Neutral Localized Product Language
          ↓
        Disclosure Policy
          ↓
        Bounded Safe Projection
          ↓
        System Copy
              ↓
       Quiet Hours / User Controls / OS Capability
              ↓
           Delivery
              ↓
 Evidence-based Notification Lifecycle
              ↓
      Tap / Action Revalidation
```

This is a Product contract, not a runtime schema.

---

# 20. Relationship vs Engagement Boundary

Allowed:

- natural follow-up;
- relationship continuity;
- meaningful re-opening of conversation;
- context-aware absence follow-up;
- progress acknowledgement;
- appropriate return to unfinished matters;
- bringing the user back to QANDEEL for a real reason.

Not allowed:

- notification volume optimization;
- arbitrary “come back” prompts;
- emotional manipulation;
- anxiety creation;
- fake concern;
- streak addiction;
- artificial scarcity;
- fabricated urgency;
- treating silence as psychological evidence.

The intended Product behavior is:

> **QANDEEL can reopen a meaningful relationship moment; he must not manufacture one for engagement.**

---

# 21. Explicit Deferrals

`I-08N-01` does **not** freeze:

## Numeric frequency rules

- daily limits;
- weekly limits;
- hard ceiling numbers;
- category budget numbers;
- inactivity durations;
- repeat intervals;
- cooldown values.

## Scoring / ranking implementation

- model scores;
- priority weights;
- threshold formulas;
- interruption score;
- sensitivity score;
- freshness score;
- exact preemption algorithm.

## Relationship-style implementation

- exact personalization dimensions;
- personality schema;
- style memory schema;
- style scoring;
- preference inference algorithm.

## Activity implementation

- database/storage schema;
- Activity retention durations;
- pagination;
- filters;
- read-state storage;
- exact event projection format.

## UI / visual design

- Activity morphology;
- tabs vs sections vs filters;
- badge visual style;
- badge numbers vs dots;
- notification iconography;
- notification colors;
- Lock Screen visual form;
- in-app banners/cards;
- animation/motion.

## Platform implementation

- iOS categories;
- Android channels;
- Push provider;
- APNs/FCM integration;
- token storage;
- device registration;
- background workers;
- retry queues;
- dedupe implementation;
- deep-link implementation;
- platform-specific permission wording.

## Future channels

- Email;
- SMS;
- WhatsApp;
- other external channels.

Each requires a separate Product contract before use.

---

# 22. Relationship to Frozen I-08A

`I-08N-01` preserves the frozen `I-08A` foundation.

Specifically:

- Personal / Shared / Public remain the primary Product Areas;
- Introductions remains capability-owned and not a fourth Area;
- Direct Entry remains authority-validating;
- visible Area changes do not rewrite World truth/ownership;
- notification entry does not create Back-history semantics outside the frozen contract;
- Shared World authority remains World-scoped;
- Public behavior does not silently become Personal inference;
- locale changes wording, not Product semantics.

Notifications are a Product-attention layer over the frozen architecture.

They do not redefine the architecture.

---

# 23. Review Checklist

Independent review should verify all of the following before `I-08N-01` may close.

## Architecture / Authority

- [ ] Notification is never treated as a truth source.
- [ ] Notification never expands authority.
- [ ] No notification moves information across World boundaries.
- [ ] Notification tap obeys frozen Direct Entry semantics.
- [ ] Origin-context authority is revalidated for notification actions.
- [ ] Shared/Public/Introductions boundaries remain intact.
- [ ] Introductions notifications require legitimate capability entry/consent.

## Proactivity / Relationship

- [ ] Relationship-driven re-engagement is allowed.
- [ ] Engagement optimization detached from user value is rejected.
- [ ] Meaningful absence is relative to the user's own established pattern.
- [ ] Relationship-continuity signals are gate inputs, not automatic triggers.
- [ ] Ignoring a notification is not psychological evidence.
- [ ] Repeat follow-up becomes progressively harder to justify.
- [ ] No streak, guilt, FOMO or artificial urgency mechanics exist.

## Frequency / Prioritization

- [ ] Budget is a ceiling, not a quota.
- [ ] Global Attention Budget prevents cross-category flooding.
- [ ] Category budgets exist conceptually.
- [ ] Priority is value-driven with category bias, not category-only.
- [ ] Push is not the default delivery channel.
- [ ] Higher-value events may preempt lower-value delivery.
- [ ] Preemption does not alter canonical event truth.
- [ ] Coalescing never mixes incompatible Worlds/authorities.

## Privacy / Disclosure

- [ ] `L0–L3` disclosure model is preserved.
- [ ] Critical importance does not automatically increase disclosure.
- [ ] Introductions defaults to `L0`.
- [ ] Rich previews require explicit user permission.
- [ ] User disclosure preference is a ceiling.
- [ ] Notification renderer receives only bounded safe projection.
- [ ] No notification preview combines different Worlds/authorities.

## Voice / Language / Personalization

- [ ] QANDEEL Voice is used only when QANDEEL is genuinely initiating.
- [ ] QANDEEL notification language follows the user's legitimate language/dialect profile.
- [ ] QANDEEL relationship style can personalize per user.
- [ ] Stable QANDEEL principles remain unchanged across users.
- [ ] System Voice stays neutral Product localization.
- [ ] Authorized Relationship Style Profile is applied only to genuine QANDEEL Voice, never to System Voice.
- [ ] Personalization uses authorized Personal context only.
- [ ] No fabricated intimacy or emotional exploitation is permitted.
- [ ] Notification brevity never creates epistemic overstatement.
- [ ] The same user experiences one recognizable QANDEEL personality across surfaces.

## Eligibility

- [ ] Personal reasons remain eligible but never automatic triggers.
- [ ] Shared Push requires meaningful user relevance.
- [ ] Public discovery remains opt-in + low-frequency.
- [ ] Introductions eligibility requires capability authority/consent.
- [ ] System Push excludes routine runtime noise.

## Activity

- [ ] Activity aggregates visibility only.
- [ ] Activity is not the canonical event store.
- [ ] Semantic category separation is preserved.
- [ ] Actions execute under origin context.
- [ ] Seen/read remains attention state only.
- [ ] Retention is meaning-dependent, not universal.

## Controls

- [ ] User controls follow Product categories.
- [ ] Per-World/context mute is supported conceptually.
- [ ] Disabling proactive Push does not disable QANDEEL understanding.
- [ ] Critical system exception does not bypass OS permission.
- [ ] Quiet Hours and Snooze affect interruption, not truth.
- [ ] Frequency controls never silently expand disclosure.

## Lifecycle / Direct Entry

- [ ] Tap revalidates current target/authority/eligibility.
- [ ] Stale target handling never guesses substitute object.
- [ ] Seen and Opened remain distinct.
- [ ] Delivered, Presented, Seen, and Opened remain distinct evidence concepts.
- [ ] None of Delivered / Presented / Seen / Opened is inferred from another without legitimate evidence.
- [ ] Delivery states are asserted only from available evidence.
- [ ] Notification lifecycle is separate from canonical event lifecycle.
- [ ] Direct Entry never merges another Area's preserved state.

## Badges

- [ ] Badge state represents attention state, not raw event volume.
- [ ] Global indicator is not a raw arithmetic sum.
- [ ] Badge clearing never resolves canonical truth.
- [ ] Sensitive count visibility is treated as disclosure.
- [ ] Introductions counts do not create marketplace semantics.

## OS / Multi-device

- [ ] OS permission is a hard Push boundary.
- [ ] Permission refusal is not repeatedly pressured.
- [ ] Foreground behavior avoids unnecessary duplicate external Push.
- [ ] Platform channels do not redefine Product semantics.
- [ ] User-level attention and per-device delivery evidence remain separate.
- [ ] Cross-device coordination never fabricates delivery evidence.

## Failure / Retry

- [ ] Retry preserves semantic notification intent, not stale authorization or stale disclosure permission.
- [ ] Retry revalidates authority, eligibility, disclosure, privacy permission, notification preference, and delivery suitability.
- [ ] Unknown delivery remains unknown.
- [ ] Stable identity prevents technical duplicates.
- [ ] Same canonical event requires new meaningful context + new gate for a new notification intent.
- [ ] Push failure does not require fallback delivery.
- [ ] Stale interruption is not retried past semantic expiry.

## Deferral Discipline

- [ ] No numeric thresholds are accidentally frozen.
- [ ] No scoring weights are accidentally frozen.
- [ ] No runtime schema is accidentally frozen.
- [ ] No visual morphology is accidentally frozen.
- [ ] No platform-specific implementation is accidentally frozen.
- [ ] Future external channels remain out of scope until separately contracted.

---

# 24. Closure Dependency Status

`I-08N-01` depends on the final frozen `I-08A` Product Shell / IA / Naming foundation.

Final independent review confirms the post-`A4-REV-05` `I-08A4` package.

Therefore:

> **`I-08A DEPENDENCY — VERIFIED / SATISFIED`**

The previous `PENDING INDEPENDENT VERIFICATION` status is superseded.

Final dependency closures:

> **`I-08A4 — CLOSED / CANONICAL FREEZE COMPLETE`**

> **`I-08A — CANONICAL PRODUCT SHELL / IA / NAMING FOUNDATION — FROZEN`**

No Product decision, threshold, implementation schema, visual morphology, or platform-specific implementation is reopened by this closure.

---

# 25. Final Review Result

Independent Product/Architecture review result:

> **APPROVED FOR CLOSURE**

`N01-REV-01`, `N01-REV-02`, and `N01-REV-03` are resolved.

Final closure:

> **`I-08N-01 — CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN`**

---

# CURRENT STATUS

> **`I-08N-01 — CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN`**
