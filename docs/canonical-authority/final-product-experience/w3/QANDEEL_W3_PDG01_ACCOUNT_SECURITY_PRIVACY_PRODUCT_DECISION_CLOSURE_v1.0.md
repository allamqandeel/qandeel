# QANDEEL — W3-PDG-01 Account, Security & Privacy — Product Decision Closure v1.0

**Status:** `CLOSED / FROZEN — PRODUCT DECISIONS` (effective on merge)
**Date:** 2026-09-30
**Track:** E2E-01 wave W3 — `W3-PDG-01 — Account, Security & Privacy Product Decision Gate`
**Baseline:** canonical `main` = `3c0ea458a22a17a2a50c616b708f097f5911fb34` (merge of PR #293, W3-MEGA-M)
**Rows decided:** `E2E-D-04`, `E2E-D-06`, `E2E-D-08`, `E2E-D-11`, `E2E-D-12`, `E2E-D-16`, `E2E-D-17`
**Authority:** the Product Owner explicitly approved the seven decision directions recorded in this closure. Only the
statements marked **PO** in §2 – §8 are Product authority. The underlying
[W3-PDG-01 decision package](../../../e2e/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_DECISION_PACKAGE_v1.md) remains
research / options evidence (`DECISION EVIDENCE / OPTIONS — NOT INDEPENDENT PRODUCT AUTHORITY`). It does not become
Product authority independently, and a recommendation or suggested answer in it is not a decision merely by appearing
there (§1.3).
**Authority class:** later, additive Product authority. It decides the Product journeys that
[P1](../../../qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) §8.1 placed and §16.1 deferred,
and rewrites nothing in P1 or in any earlier record.

---

## 1. Scope and reading rules

### 1.1 What this record closes

| Row | Product decision | Implementation | Classification after this record |
|---|---|---|---|
| `E2E-D-04` Change Email | **CLOSED** | none | `DECIDED — NOT IMPLEMENTED` |
| `E2E-D-06` Security & Login v1 | **CLOSED** | none | `DECIDED — NOT IMPLEMENTED` |
| `E2E-D-08` Shared ID | **CLOSED** | backend rotation only (I-04, migration `0081`); no surface | `DECIDED — NOT IMPLEMENTED` (surface sequenced to W6) |
| `E2E-D-11` App language | **CLOSED** | device locale only; no Language row | `DECIDED — NOT IMPLEMENTED` |
| `E2E-D-12` Accessibility preferences | **CLOSED** | platform signals partly honoured | `DECIDED — NOT IMPLEMENTED` (parity obligations §6.3) |
| `E2E-D-16` Export my data | **CLOSED** (journey + content principle) | none | `DECIDED — NOT IMPLEMENTED` |
| `E2E-D-17` Delete my account | **journey and principles CLOSED**; completeness **BLOCKED** (§8.5) | none | `DECIDED (JOURNEY / PRINCIPLES) — NOT IMPLEMENTED — EXPLICIT CONNECTED-WORLDS DELETION BLOCKER` |

No row is `COMPLETE / PRODUCTION-READY`. No implementation row is closed by this record, and none may be read as
implemented. **Delete Account is not production-ready** and this record does not claim it is.

### 1.2 What this record does not do

- It opens no implementation task. `W3-MEGA-A` and `W3-MEGA-S` are proposed sequencing only (§9) and are not opened.
- It changes no API, mobile, database, migration or runtime file.
- It does not open W6, design a Shared World surface, or decide any Connected Worlds deletion mechanism.
- It invents no remedy for `ON DELETE RESTRICT` foreign keys, immutable-history guards or retained derivatives.
- It freezes no provider call, token lifetime, code expiry, grace-period length, export format, archive technology,
  retention duration, download expiry or legal retention period. Those are implementation / legal detail.
- It converts no external best practice into a QANDEEL rule beyond what §2 – §8 state.

### 1.3 Precedence inside this record

1. **Product authority** is only the Product Owner's explicitly approved decision text (§2 – §8, marked **PO**).
2. Every other detail in this record carries one of these labels, and none of them is Product authority:
   - `IMPLEMENTATION CONSIDERATION — NOT FROZEN`: a detail a later implementation task may adopt or reject under its
     own Task Contract.
   - `EXTERNAL / STORE COMPLIANCE REQUIREMENT`: an obligation imposed from outside QANDEEL, recorded as a launch
     dependency rather than a Product decision.
   - `RESEARCH EVIDENCE — NOT PRODUCT AUTHORITY`: a package sub-recommendation kept only as a reference.
3. A package recommendation or suggested Response-Sheet answer that §2 – §8 do not state as **PO** is not decided by
   this record. §10 lists where the package's options differ from the approved decisions.

---

## 2. `E2E-D-04` — Change Email — **APPROVED**

**PO — final journey:**

1. The user re-enters the current password.
2. The user enters the new Email.
3. A 6-digit verification code is sent to the new Email.
4. Confirmation from the **old** Email is also required.
5. The Email changes only after **both** verifications succeed.
6. If the attempt expires, fails or is abandoned at any point, the old Email stays exactly as it was. There is no
   partial change.
7. The Login ID does not change.
8. After a successful change, the current session ends and the user returns to Sign in.
9. Failure behaviour preserves non-enumeration.

**PO — mechanism rule:** reuse the existing W1B / W2 mechanisms where they fit (the in-app 6-digit code, its resend
posture, the non-enumerating wording posture of W2-01). No substitute Product mechanism is invented.

**Consequence of rule 9:** a new Email that already belongs to another account must not be revealed as taken. The
package's sub-choice (i), a refusal that would say so, is not adopted (§10).

`IMPLEMENTATION CONSIDERATION — NOT FROZEN`: a notice to the old Email after a successful change; a Support route
when the old inbox is no longer reachable. The package suggested both (package §4.1.4). Neither is decided here.

**Dependency, not a Product choice:** live Email delivery is `EXTERNAL / NOT PROVED` (W2-01 record §8).

---

## 3. `E2E-D-06` — Security & Login v1 — **APPROVED — Minimal Security v1**

**PO — shown in v1:**

- Change Password.
- Sign out from other devices.
- The current Email and its status, as the recovery method.

**PO — not shown in v1:** Phone; 2FA; Passkeys; and no disabled or "Coming Soon" row for any of them.

**PO — additional decision:** changing **or** recovering the password ends **all other** sessions.

- **Change Password inside an authenticated session:** the current device may continue, if the secure implementation
  allows it.
- **Password Recovery:** follows the existing W2 ending, the signed-out state. No session opens automatically.

**PO — scope limit:** v1 does not expand into a device-management dashboard or a security activity log. If either is
strictly required to implement the decisions above, it is recorded as an implementation detail, not a Product
expansion.

`IMPLEMENTATION CONSIDERATION — NOT FROZEN`: security notification Emails for password changed, Email changed and
password reset (package §4.2.4). They are not decided here, and any such Email would depend on production Email
delivery.

---

## 4. `E2E-D-08` — Shared ID — **APPROVED**

**PO — Product format:** the human-facing Shared ID has the pattern `K7QM-4XWD-P9TR`. That is a pattern, not a
literal value.

**PO — rules:**

- 12 random characters, grouped as 3 × 4 for readability.
- Case-insensitive.
- Generated automatically.
- Private and non-searchable.
- Distinct from the Login ID, the Public ID and every internal ID.
- Copyable and regeneratable.
- Regeneration invalidates pending reachability according to the frozen Shared semantics (P1 §5.1 – §5.3; I-04,
  migration `0081`).
- A clear confirmation appears before Regenerate.
- No password re-entry is needed.
- After regeneration the old value is never shown.
- The interface exposes no internal architecture detail.

**PO — sequencing:** the Product format is fixed now. The Shared ID is **not** shown in General Settings until
Shared World invitations are actually usable, in W6. This record does not open W6 and designs no Shared World.

`IMPLEMENTATION CONSIDERATION — NOT FROZEN`: the exact alphabet, avoiding look-alike characters, and ignoring
separators when the ID is typed (package §4.3.4).

The package also recorded that the current backend lets the client supply the new secret (migration `0081`). Where
generation happens is an implementation matter for the task that surfaces the Shared ID. It is not a Product decision
taken here, beyond the **PO** rule that the ID is generated automatically.

---

## 5. `E2E-D-11` — App Language — **APPROVED**

**PO:**

- No separate language engine is built inside QANDEEL in v1.
- The app interface uses the app / system language that iOS / Android provide.
- General Settings may hold a `Language` row that sends the user to the system's per-app language setting, where the
  platform supports it.
- There is no custom Arabic / English toggle inside QANDEEL in v1.
- Changing the interface language does not force QANDEEL's conversational language.
- QANDEEL's reply language keeps following the conversation / the user, as the current runtime does.
- RTL / LTR comes from the current locale authority. No parallel authority is created.

The current locale authority is the one QAN-BL-T12-02 closed (`product-locale.ts` / `device-locale.ts`). P1 §8.1
places app language under QANDEEL & Conversation.

---

## 6. `E2E-D-12` — Accessibility Preferences — **APPROVED**

### 6.1 Decision (PO)

There are no QANDEEL-specific accessibility settings inside the app in v1. QANDEEL relies on the platform
accessibility settings and honours them.

### 6.2 Principle (PO)

QANDEEL does not duplicate system settings without a real Product reason. This decision does **not** mean that
accessibility is incomplete or optional.

### 6.3 Implementation obligations (PO)

Later implementation must actually verify support for the relevant platform signals, where they apply:

- Reduce Motion;
- Dynamic / scalable text;
- Screen Reader;
- Bold Text;
- Reduce Transparency / contrast-related platform behaviour.

Any current gap in reading these signals is an implementation obligation, never a reason to create an in-app
accessibility switch. At this baseline the package found Reduce Transparency, Bold Text and screen-reader-enabled
unread (package §2.3); that is evidence, not a closure.

`IMPLEMENTATION CONSIDERATION — NOT FROZEN`: whether the Settings group keeps its exact current name "Appearance &
Accessibility", and whether it gains a short informative line (package §4.5.4). Neither is decided here.

---

## 7. `E2E-D-16` — Export My Data — **APPROVED — Product Journey**

### 7.1 Entry (PO)

`General Settings → Privacy & Data`.

### 7.2 Journey (PO)

1. Request export.
2. Re-authentication / identity confirmation.
3. The package is prepared asynchronously.
4. A clear in-app state is shown while it is prepared.
5. When ready, the download happens inside the app.
6. The file is available for a limited period.
7. Emailing the file itself is **not** the primary route.

### 7.3 Content principle (PO)

Export what belongs to the user and is part of the user's data, respecting ownership and world boundaries. The
conceptual categories include:

- Account data.
- Personal conversation data.
- Memory data, including lifecycle-retained records while they are still actually held.
- QANDEEL Understanding / derived records, in a form the user can understand.
- The user's data in Shared / Public, only within the limits of actual ownership and authority.
- Replay / audio, when it exists in the future and the user has a right to that material.

`IMPLEMENTATION CONSIDERATION — NOT FROZEN`, within the **PO** content principle above:

- exactly how forgotten or disabled Memory records are handled and labelled (package §4.6.3);
- the exact wording that excludes other people's material and notes written about another person.

### 7.4 Not frozen (PO)

The final technical format; the archive technology; retention duration; exact expiry duration; legal retention
periods; the implementation schema. These are later implementation / legal details.

---

## 8. `E2E-D-17` — Delete Account — **APPROVED WITH EXPLICIT BLOCKER**

### 8.1 Product principle (PO)

Delete Account means **true deletion**, not Disable or merely hiding the account.

### 8.2 Journey (PO)

- It starts inside the app.
- It requires re-authentication.
- A short cancellation / grace period precedes final execution.
- After the grace period, the deletion is final.
- Sessions end.
- An account must never be described as deleted while its core personal data still works as an active user account.

The length of the grace period is not frozen.

`IMPLEMENTATION CONSIDERATION — NOT FROZEN`: the Settings location of the entry (the package suggested Privacy &
Data).

`EXTERNAL / STORE COMPLIANCE REQUIREMENT`: Google Play requires a web path for requesting account deletion. It is
recorded as an external launch / compliance dependency. It is not a Product decision taken through this approval, and
its form is not decided here.

### 8.3 Data direction (PO)

- Personal data, Personal Memory, Personal Understanding and Personal conversation history must enter the real
  deletion contract. The only exception is what must be retained for legal or security reasons, limited and
  justified.
- A deleted account's Login ID and Public ID are not reused directly for another user.
- For the user's content in Shared / Public, the preferred and approved Product direction is to remove the user's
  material as far as authority allows, rather than keep it under a "Former member" label.

### 8.4 What is frozen now (PO — exactly these nine)

1. The Delete Account journey.
2. The true-deletion-not-disable principle.
3. Re-authentication.
4. A short cancellation / grace period.
5. Final, irreversible deletion after the grace period.
6. Session termination.
7. The Personal-world deletion intent.
8. The preferred direction to remove the user's own Shared / Public material where authority allows.
9. **Launch Gate:** no Connected World may be considered production-ready for users if Account Deletion cannot meet
   its deletion contract there.

### 8.5 `EXPLICIT CONNECTED-WORLDS DELETION BLOCKER`

D-17 is **not** fully closed. The exact Shared / Public / Connected Worlds deletion behaviour is left open as the
`EXPLICIT CONNECTED-WORLDS DELETION BLOCKER`, because:

- `QAN-BL-CW-01` (`ASSURE-F05`) is still `OPEN — UNASSIGNED`: owner deletion does not reach the Public DRAFT
  source-content derivative.
- Shared, Public and the other Connected Worlds (Replay, Introductions) have no end-to-end account-deletion contract
  sufficient to prove that account deletion can be carried out completely, safely and truthfully. `ASSURE-O04`
  records that participants cannot be hard-deleted by any path today.

The blocker is carried in the canonical backlog as `QAN-BL-ACCT-01`, linked to `QAN-BL-CW-01`, together with any
authority that becomes necessary later. This record decides no mechanism for it.

### 8.6 Honest dependencies that remain

These are recorded so that nothing reads this record as "deletion works". They are not Product choices, and this
record resolves none of them.

- **Personal erasure against history preservation.** Implementing §8.3 for the Personal world requires a later
  controlled change to the immutable-history guards (package §4.7.1). That change is the "separately governed Product
  erasure policy" that the Stage 6.6 ruling reserved; this record is the Product side of it for the Personal world
  and decides no engineering mechanism.
- **The account split.** `auth.users` and `public.users` are joined by no foreign key.
- **Production Email delivery** is unproven.
- **Web deletion-request path:** none exists.

---

## 9. Proposed decomposition — sequencing only, NOT opened

The Product Owner named the proposed order `W3-MEGA-A — Account & Identity Completion`, then
`W3-MEGA-S — Personal Controls & Settings Integration`, and opened neither. The allocation below is
`SUGGESTION — NOT AUTHORITY`. Each task's own Task Contract decides its scope.

| Proposed task (not opened) | Suggested share of the **PO** decisions | Must not take |
|---|---|---|
| `W3-MEGA-A` | the re-authentication step; D-04 Change Email; D-06 Security & Login v1 (Change Password, Sign out from other devices, current Email + status as recovery, change / recovery ends other sessions); D-08's Product format in code, **without** a Settings surface | any Shared ID surface before W6; any device dashboard or security log as Product scope |
| `W3-MEGA-S` | D-11 Language row; D-12 platform-signal parity; the Privacy & Data entry; D-16 Export; D-17 journey, re-authentication, grace, session termination and **Personal-world** deletion, through its own controlled change to the history guards | any claim that deletion covers Connected Worlds; any Connected Worlds deletion mechanism |
| **Outside both** | the `EXPLICIT CONNECTED-WORLDS DELETION BLOCKER` (`QAN-BL-ACCT-01`, `QAN-BL-CW-01`, `ASSURE-O04`); the D-08 surface (W6); the store-required web deletion-request path and production Email delivery (external / release work) | — |

The `IMPLEMENTATION CONSIDERATION — NOT FROZEN` items in §2 – §8 go with whichever task owns their row, and are
decided there. Each proposed task still needs its own Task Contract and its own Anti-Duplication Gate. This table
authorizes nothing.

---

## 10. Where the package's options differ from the approved decisions

`RESEARCH EVIDENCE — NOT PRODUCT AUTHORITY`. The package is evidence only. These rows record where one of its
recommendations was not adopted, so that no reader takes the package's wording for a decision.

| Row | Package recommendation (evidence only) | Approved **PO** decision |
|---|---|---|
| D-04 | Q2 (i): refuse a taken new Email with a generic message that reveals it cannot be used | failure behaviour preserves non-enumeration; the taken state is not revealed |
| D-04 | after success, this device stays signed in; other devices are signed out | after success, the current session ends and the user returns to Sign in |
| D-17 | Q20: Login ID and Public ID "never reusable" | not reused directly for another user; any longer reservation policy is not frozen here |
| D-16 | a readable document plus a machine-readable file (e.g. HTML + JSON) | the technical format is not frozen |

---

## 11. Governance

- **BG-05.** The canonical backlog was read. No item names W3-PDG-01 as its Owner task. `QAN-BL-CW-01` is adjacent,
  and is linked, not re-owned.
- **BG-06 / BG-08.** One qualifying cross-task residue is admitted: `QAN-BL-ACCT-01`, the Connected Worlds deletion
  blocker. §8.5 of this canonical record defers it explicitly. No other item is admitted. The implementation rows are
  already tracked by the E2E-01 matrix, and §9 proposes their owners without opening them.
- **BG-07.** Nothing here authorizes implementation.
- **BG-09.** This record's own banner is final on merge. The decision package is marked as decided and pointing here
  in the same change.

---

## 12. Closure

`W3-PDG-01 — CLOSED / FROZEN — PRODUCT DECISIONS` (on merge). D-04, D-06, D-08, D-11, D-12 and D-16 are Product-closed.
D-17 is Product-closed for its journey and principles only; its implementation completeness remains blocked by
Connected Worlds deletion authority (`EXPLICIT CONNECTED-WORLDS DELETION BLOCKER`, `QAN-BL-ACCT-01`, `QAN-BL-CW-01`).
