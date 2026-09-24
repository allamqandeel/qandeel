# QANDEEL — Connected Worlds v2
## CW2-08 — Safety, Moderation, Entitlements & Launch Integration v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Connected Worlds v2 launch-integration architecture  
**Depends on:** CW2-01 through CW2-07 — CLOSED / FROZEN  
**Supersedes:** CW2-08 v0.1 and v0.2 drafts  
**Implementation:** NOT STARTED

---

# 1. Final execution law

A protected Connected Worlds action executes only when all required dimensions allow it:

```text
PRIVACY / OWNERSHIP AUTHORITY
AND WORLD / LIFECYCLE STATE
AND SAFETY / MODERATION POLICY
AND COMMERCIAL ENTITLEMENT (where applicable)
AND FEATURE / LAUNCH GATE
```

No layer may manufacture missing authority in another.

---

# 2. Non-waivable privacy principle

No Safety, moderator, commercial, rollout or launch-governance mechanism may create missing human privacy/ownership authority.

The following are non-waivable:

- required human consent;
- material rights;
- audience boundaries;
- no-hindsight;
- source isolation;
- deleted-content non-serving;
- exact World taxonomy;
- single active Introduction;
- cross-world geography separation;
- stale-authority revalidation.

---

# 3. Safety restriction classes

Safety restrictions are typed:

```text
INTERACTION_RESTRICTION
VISIBILITY_RESTRICTION
DISTRIBUTION_RESTRICTION
ACCOUNT_RESTRICTION
```

There is no generic unscoped Safety boolean.

---

# 4. Safety result

Conceptually:

```text
SAFETY_ALLOW
SAFETY_DENY
SAFETY_RESTRICT
SAFETY_UNKNOWN
```

Required `UNKNOWN` fails closed.

Restrictions only narrow scope.

---

# 5. Restriction versioning

Safety/launch restrictions maintain current:

`RESTRICTION_VERSION`

and lifecycle/validity.

Historical restriction events remain auditable.

Lifting a restriction changes future eligibility without rewriting history.

---

# 6. Safety private operational state

Report/block/moderation operational data is:

`SAFETY_PRIVATE_OPERATIONAL_STATE`

It is excluded by default from:

- Personal semantic Memory;
- Shared reasoning;
- Public context;
- Matching reasoning;
- cross-world semantic analysis.

---

# 7. Report Case

`REPORT_CASE`

is protected operational state bound to an exact target/context.

Report evidence does not become ordinary World/Public material.

Reporter identity/internal reasoning is disclosed only under explicit policy.

---

# 8. Moderator operational access

Moderator access is:

`CASE_SCOPED_MODERATION_ACCESS`

bound to:

- exact case;
- evidence scope;
- purpose;
- authorized role/service/person;
- validity;
- audit.

No blanket private-World browsing follows from the moderator role itself.

---

# 9. Block relation

`BLOCK_RELATION`

is account-level Safety state.

It restricts future interactions/discovery according to domain policy.

Block alone does not:

- delete history;
- erase source material;
- delete Public Experience;
- rewrite Shared membership history.

---

# 10. Block anti-enumeration

Block can target identities the user legitimately knows through authorized Product context.

It cannot function as arbitrary account-search/discovery.

---

# 11. Public block invariant

Public interaction cannot be used as a direct-contact backdoor around Block.

Exact content-filtering behavior remains Product-policy configurable.

No DM exists independently.

---

# 12. Matching block invariant

Blocked pair is:

`PAIR_INELIGIBLE`

for:

- candidate proposal;
- Mutual Match;
- progressive disclosure.

Pending proposal closes neutrally.

No private Block reason is exposed.

---

# 13. Introduction Block launch requirement

User-facing behavior when Block occurs during active Introduction depends on:

`INTRODUCTION_BLOCK_POLICY`

This requirement is capability-scoped.

Until satisfied, the affected launch path remains disabled/fail-closed.

No hidden lifecycle default is invented.

---

# 14. Standard Shared Block launch requirement

Current-member Block semantics in Standard Shared World depend on:

`SHARED_WORLD_BLOCK_POLICY`

The policy must resolve future interaction/membership/history UX.

Until configured, the affected Block capability path remains gated.

---

# 15. Public moderation state

Public moderation serving state is distinct from owner deletion.

Conceptual moderation states may include:

```text
PUBLIC_VISIBLE
LIMITED
HIDDEN_BY_MODERATION
REMOVED_BY_MODERATION
```

Moderation controls public serving.

It does not rewrite source truth.

---

# 16. Owner deletion precedence

Owner deletion:

`ABSENT_FROM_PUBLIC_WORLD`

dominates any moderation restoration state.

A later moderator unhide cannot resurrect an owner-deleted Experience.

Only a new valid owner publication can create future public content.

---

# 17. Public Servable Context

Public QANDEEL/search/lenses/replies use only:

`PUBLIC_SERVABLE_CONTEXT`

Excluded:

- owner-deleted content;
- moderation-hidden/removed content;
- private operational data;
- sealed private provenance.

---

# 18. Canonical public serving gate

Every serving surface checks current:

- Public visibility;
- moderation state;
- audience policy.

Stale search/index/cache data cannot override canonical serving state.

---

# 19. Replay Safety composition

Replay distribution requires all applicable:

- material/source distribution authority;
- Safety allow;
- entitlement;
- destination feature/launch gate.

No paid tier or Safety approval substitutes for human distribution consent.

---

# 20. Entitlement semantics

Entitlement controls available actions, not underlying ownership.

Downgrade/credit exhaustion can restrict premium actions without deleting:

- Replay ownership;
- Public Experience control;
- own material;
- World history.

---

# 21. Public reply entitlement

Current Product direction:

`PUBLIC_REPLY / COMMENT`

requires Premium entitlement.

This remains separate from Public viewing policy and privacy authority.

---

# 22. Replay entitlement

Replay creation/ownership and Replay export entitlement are distinct.

Having one never implies the other.

---

# 23. Credits

Credits are resource/compute availability only.

They never modify consent, ownership or truth.

---

# 24. Feature flags

Server-canonical:

`FEATURE_FLAG_STATE`

may include:

```text
DISABLED
INTERNAL
LIMITED_ROLLOUT
ENABLED
EMERGENCY_DISABLED
```

Client flags are presentation hints only.

Feature enablement never grants privacy authority.

---

# 25. Launch Gate Snapshot

Consequential actions bind a current:

`LAUNCH_GATE_SNAPSHOT`

before irreversible commit/delivery.

Emergency disable or changed mandatory requirement invalidates stale in-flight launch eligibility.

---

# 26. Feature disable / rollback

Disabling a feature may:

- stop new actions;
- stop serving/distribution where required;
- retain safe history/read-only state.

It does not rewrite canonical World/material history.

---

# 27. Multi-user rollout consistency

Shared-state operations are governed by server-canonical semantics.

One participant's rollout cohort cannot impose unsupported state transitions on another participant.

---

# 28. Capability-scoped Launch Requirements

Every:

`LAUNCH_REQUIREMENT`

binds an exact:

`CAPABILITY_SCOPE`

An unresolved requirement blocks only the capabilities that depend on it.

Examples:

```text
SIGNED_OUT_PUBLIC_VIEW_POLICY
→ PUBLIC_SIGNED_OUT_VIEW

SHARED_HUMAN_LIVE_CALL_LEGAL_GATE
→ SHARED_HUMAN_LIVE_CALL

INTRODUCTION_BLOCK_POLICY
→ INTRODUCTION_BLOCK_HANDLING

SHARED_WORLD_BLOCK_POLICY
→ SHARED_MEMBER_BLOCK_HANDLING
```

---

# 29. Launch Requirement states

Conceptually:

```text
SATISFIED
UNSATISFIED
UNKNOWN
WAIVED_BY_AUTHORIZED_GOVERNANCE
```

But each requirement is classified:

```text
NON_WAIVABLE_INVARIANT
WAIVABLE_OPERATIONAL_REQUIREMENT
```

Non-waivable invariants cannot be bypassed by governance.

---

# 30. Shared human live call

Launch requires:

```text
FEATURE ENABLED
PRODUCT APPROVED
LEGAL / TELECOM CLEARED
RUNTIME CONTRACT FROZEN
SAFETY READY
```

Current capability status:

`LAUNCH_BLOCKED_PENDING_LEGAL_PRODUCT_GATE`

Text/voice-note Shared World architecture is unaffected.

---

# 31. Signed-out Public viewing

Signed-out access remains unresolved under:

`SIGNED_OUT_PUBLIC_VIEW_POLICY`

This blocks only signed-out Public viewing.

It does not require redesigning or globally blocking registered-member Public World architecture.

---

# 32. Abuse prevention

Rate limits may apply to:

- invalid invitation attempts;
- invitations;
- Matching proposals;
- Public replies;
- voice replies;
- @qandeel;
- reports;
- Replay distribution.

Rate limits change frequency, not semantic truth/ownership.

---

# 33. Invitation abuse

Secret credential attempts remain non-enumerating.

Abuse controls may throttle suspicious use without revealing account existence.

---

# 34. Matching abuse

Safety/abuse systems may pause proposal flow.

Counterparties do not receive private restriction reasons.

---

# 35. Public abuse

Posting/rate restrictions do not alter Experience meaning/geography.

---

# 36. Audit

Protected operational actions record minimal auditable metadata including:

- actor/role;
- target;
- case;
- policy basis;
- restriction class;
- decision;
- snapshot/version;
- timestamp.

---

# 37. User-visible policy explanation

Internal report/block/moderation reasons are not automatically exposed.

User-facing messages follow minimum necessary safe disclosure.

---

# 38. Version compatibility

Old/unknown client states fail safely.

Server checks current authority, entitlement, feature and launch gates at commit.

---

# 39. Capability launch matrix

Every capability tracks:

```text
architecture_status
implementation_status
test_status
product_policy_status
legal_status
safety_status
entitlement_status
feature_flag_status
mandatory_launch_requirements
launch_status
```

Architecture freeze alone yields:

`ARCHITECTURE_READY`

not `PUBLIC_LAUNCH_READY`.

---

# 40. Fail-closed launch law

Required:

```text
UNKNOWN
UNCONFIGURED
UNSATISFIED
UNTESTED
```

blocks the scoped capability.

No permissive guess.

---

# 41. Connected Worlds non-regression launch gate

Before enablement, capability must prove:

- no implicit audience widening;
- no hidden-source traversal;
- no Personal Living Analysis Map regression;
- no no-hindsight violation;
- no stale authority commit;
- no deleted/moderated Public resurfacing;
- no multiple active Matching Introductions;
- no cross-world coordinate conflation;
- no Safety/Matching operational state entering ordinary semantic Memory.

---

# 42. Operational telemetry

Rollout/incident metrics remain operational data.

They do not become:

- semantic World truth;
- candidate truth;
- Public importance/rank truth;
- user-visible social scoring.

---

# 43. Canonical invariants

`H1.` Safety/moderation/entitlement may restrict but never manufacture privacy authority.  
`H2.` Core privacy/truth invariants are non-waivable.  
`H3.` Safety restrictions are scope-typed and versioned.  
`H4.` Required UNKNOWN fails closed.  
`H5.` Safety operational state is private/non-semantic by default.  
`H6.` Reports are protected operational state.  
`H7.` Moderator access is case-scoped and auditable.  
`H8.` Block cannot be account-enumeration infrastructure.  
`H9.` Block restricts future interaction without automatically rewriting history.  
`H10.` Block behavior inside active Shared/Introduction requires explicit scoped Product policy.  
`H11.` Public moderation and owner deletion are distinct.  
`H12.` Owner deletion dominates later moderation restoration.  
`H13.` Public QANDEEL uses only Public Servable Context.  
`H14.` Stale indexes cannot re-expose hidden/deleted/moderated content.  
`H15.` Replay Safety/entitlement never substitutes for distribution consent.  
`H16.` Entitlement controls actions, never ownership.  
`H17.` Feature flags are server-canonical and grant no authority.  
`H18.` Consequential actions revalidate Launch Gate Snapshot before commit.  
`H19.` Disable/rollback preserves canonical data/history.  
`H20.` Multi-user shared semantics are server-canonical across rollout cohorts.  
`H21.` Launch Requirements are capability-scoped.  
`H22.` Non-waivable invariants cannot be waived by launch governance.  
`H23.` Shared human live call remains gated until all required launch dimensions pass.  
`H24.` Signed-out Public uncertainty does not redefine Public World identity or block unrelated Public capabilities.  
`H25.` Rate limits change frequency, not truth/ownership.  
`H26.` Unknown client/state fails safely.  
`H27.` Architecture freeze never equals implementation/public launch readiness.  
`H28.` Every launch capability passes Connected Worlds non-regression checks.

---

# 44. Open launch requirements at freeze

The following remain intentionally open and machine-gated:

1. `SIGNED_OUT_PUBLIC_VIEW_POLICY`
2. `SHARED_WORLD_BLOCK_POLICY`
3. `INTRODUCTION_BLOCK_POLICY`
4. `SHARED_HUMAN_LIVE_CALL_LEGAL_GATE`
5. detailed moderation/report UX + appeals
6. Replay export/download monetization policy
7. final Public discussion entitlement matrix

These do not prevent Architecture completion.

They prevent only the scoped launch capability until resolved.

---

# 45. Freeze status

# `CW2-08 — CLOSED / FROZEN`

Therefore:

# `QANDEEL Connected Worlds v2 Architecture — COMPLETE`

Next:

# `Connected Worlds v2 — Implementation Planning & Task Decomposition`
