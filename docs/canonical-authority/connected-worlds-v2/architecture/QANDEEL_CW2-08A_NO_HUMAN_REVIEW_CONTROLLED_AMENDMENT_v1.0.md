# QANDEEL — Connected Worlds v2
## CW2-08A — No Human Review of Private Conversation Content — Controlled Amendment to CW2-08 v1.0

**Status:** `CANONICAL CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`  
**Amends:** [CW2-08](QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md) §8 and H7; and §44 item 5
only insofar as any future work under it must obey the boundary below  
**Does not amend:** every other CW2-08 section and invariant (§6 below)  
**Reason:** `P4-DQ-10` — the Product Owner's No Human Review law ([P4 Decision Queue](../../../p4/P4_PRODUCT_OWNER_DECISION_QUEUE.md))  
**Task:** P4-B, 2026-09-26. This is a controlled amendment to CW2-08. It is not CW2-09 and not a new Connected Worlds
phase  
**Implementation:** none. No code, schema, service, model, vendor, queue, tool or workflow is created or chosen

This record is additive. The original CW2-08 file remains the historical frozen record; its bytes are not changed and
its entry in `CW2_SOURCE_PROVENANCE.sha256` stays valid. For the narrow human-review question below, this later
controlled amendment is authoritative. The binding takes effect on the merge of the pull request that carries it.

---

# 1. Why an amendment is needed

The Product Owner decided, and this amendment does not reopen:

> **No routine or exceptional human review of private QANDEEL conversation content is authorized through Company
> Operations or safety-monitoring flows.**

Historical CW2-08 wording, quoted for traceability only:

- §8: moderator access is `CASE_SCOPED_MODERATION_ACCESS`, bound to exact case, evidence scope, purpose,
  "authorized role/service/person", validity and audit; "No blanket private-World browsing follows from the
  moderator role itself."
- H7: "Moderator access is case-scoped and auditable."
- §7 supplies the protected `REPORT_CASE` evidence such access is scoped to.

Read together, that wording let an authorized **person** reach case-scoped evidence and excluded only **blanket**
browsing. Where the case evidence is private QANDEEL conversation content, that is exceptional human review, which the
Product Owner law forbids. P4-A recorded the conflict as `P4-DQ-10`. This amendment resolves exactly that conflict.

---

# 2. Private QANDEEL conversation content

For this amendment, **private QANDEEL conversation content** includes at minimum:

- private Conversation text;
- private Voice Note audio;
- private Live Call audio;
- transcripts derived from private conversations or calls;
- Memory content derived from private conversations;
- Analysis / QANDEEL Understanding content derived from private conversations;
- private-World conversation payloads.

The term is limited to private conversation content. It does not extend this amendment to all user data.

---

# 3. The binding rule

> **No human role or person may receive, inspect or review private QANDEEL conversation content under Safety /
> Moderation authority, routinely or exceptionally.**

None of the following creates an exception:

- case scoping;
- incident severity;
- escalation;
- audit requirements.

## 3.1 Automated Safety processing remains allowed

This amendment does not disable or narrow QANDEEL's automated Safety processing. Where Safety / Moderation needs to
process private conversation content, that processing:

- may remain automated, under existing Safety authority (the
  [Safety Runtime](../../../implementation-foundation/QANDEEL_SAFETY_RUNTIME_v1.0.md) and CW2-08);
- remains purpose-limited;
- remains least-data, least-access and least-retention;
- does not turn private content into ordinary telemetry.

## 3.2 `ESCALATE`

`ESCALATE` is a Safety Runtime decision class. It does **not**, by itself, authorize human access to private
conversation content, and it must not be read as a human-review route because of its name.

## 3.3 What this amendment does not create

This amendment freezes a **human-access prohibition**, not a replacement system. It defines, selects or implies none of
the following:

- a moderation service or service topology;
- an AI moderator, classifier or model;
- an external moderation vendor;
- a review queue or moderator dashboard;
- a human escalation replacement;
- appeal processing;
- an evidence-redaction pipeline;
- a report evidence or submission schema;
- a human support workflow.

Each of those belongs to its existing owner or to later Product work, which must obey §3.

---

# 4. Exact supersession

For future interpretation, the historical CW2-08 wording is read as follows.

## 4.1 CW2-08 §8

**Preserved unchanged:**

- `CASE_SCOPED_MODERATION_ACCESS` as a conceptual Safety / Moderation authority;
- exact case;
- evidence scope;
- purpose;
- validity;
- audit;
- no blanket private-World browsing.

**Narrowed — the actor / access part only.** When the evidence scope contains private QANDEEL conversation content:

> the historical "authorized role/service/person" wording does **not** authorize a human role or person to receive,
> inspect or review that content.

The only authority over that content is:

> **authorized non-human Safety / Moderation processing**, under existing Safety authority.

That phrase is a boundary, not an implementation design. It prescribes no service topology or processing architecture.

**Not decided — evidence that is not private QANDEEL conversation content.** For such evidence this amendment does not
decide whether a human moderation actor exists. Public moderation, reporting and appeals remain governed by their own
authority and open requirements. Nothing here prohibits, permits or freezes human or automated Public moderation.

## 4.2 CW2-08 H7

Historical: "Moderator access is case-scoped and auditable."

Amended meaning:

> **H7. Moderation access / processing remains case-scoped and auditable. Human review of private QANDEEL conversation
> content is not authorized.**

Where private conversation content is involved, case scope, purpose, validity and audit still apply to the authorized
automated processing. Auditability is not weakened.

## 4.3 CW2-08 §44 item 5

Historical item 5, "detailed moderation/report UX + appeals", **remains open** and machine-gated as §44 states.

This amendment adds only one boundary:

> any future moderation / report UX and appeals must comply with the No Human Review law for private conversation
> content.

It does not design moderator tools or appeals, decide report evidence submission, decide support sharing, or decide
whether Public content gets human review.

---

# 5. User-initiated support is outside this amendment

APP-OPS-01's boundary is unchanged: operational telemetry is always content-free, and APP-OPS-01 establishes no
Company Operations path for receiving private user content.

A future user-initiated support flow in which the user deliberately shares selected content is **outside this
amendment**. It needs separate, explicit Product authority. This amendment does not infer that such a flow exists, that
it is human-reviewed, that it is Safety / Moderation or Company Operations, or that it is prohibited forever.

---

# 6. Explicit non-amendments

Everything in CW2-08 other than §8's actor / access wording, H7's wording and the §44 item 5 boundary above is
preserved unchanged, including:

- §1–§7, except the access consequence of §7 evidence under amended §8;
- Safety restriction typing and versioning (§3–§5);
- `SAFETY_PRIVATE_OPERATIONAL_STATE` (§6);
- `REPORT_CASE` as protected operational state (§7);
- the Block relation and anti-enumeration (§9–§14);
- Public moderation serving state (§15);
- owner deletion precedence (§16);
- Public Servable Context and the canonical public serving gate (§17–§18);
- Replay Safety and distribution-consent boundaries (§19);
- entitlement law and Credits (§20–§23);
- feature flags (§24);
- the Launch Gate and Launch Gate Snapshot (§25–§29);
- rollout (§27);
- shared human live call gating (§30);
- signed-out Public viewing and abuse prevention (§31–§35);
- §36 audit metadata;
- §37 minimum necessary disclosure;
- version compatibility, the capability launch matrix and fail-closed required `UNKNOWN` (§38–§40);
- the Connected Worlds non-regression launch gate (§41);
- operational telemetry as non-semantic state (§42);
- every H-invariant except H7's superseded wording;
- §44 items 1–4 and 6–7.

---

# 7. Implementation status

This amendment freezes a Product / Architecture boundary only. It claims no runtime implementation. No moderation,
report or appeal runtime exists today, and none is authorized by this record. Any future implementation belongs to
its existing owner — Connected Worlds `I-09` / CW2-08 launch work, or Production Integration — and must obey §3.

> **CW2-08A — NO HUMAN REVIEW CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE**
