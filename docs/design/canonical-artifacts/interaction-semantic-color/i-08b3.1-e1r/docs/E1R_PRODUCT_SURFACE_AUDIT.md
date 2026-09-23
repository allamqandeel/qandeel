# E1R_PRODUCT_SURFACE_AUDIT

**I-08B3.1-E1R.** A **bounded** semantic audit of the QANDEEL Product categories most
likely to stress the status-colour policy. **Not a new design phase, and not a survey.**

Each category is classified as ERROR, WARNING, SUCCESS, INFORMATIONAL or NOT A STATUS.
Then one question is answered: **does the current neutral policy still work?**

---

## 1. Why this audit exists

I-08B3.1-E1 refused a dedicated hue to three of its four status roles and wrote a
falsifiable condition into each refusal. It then admitted, in its own limitations document,
that **those conditions had never been audited against a real Product surface.** A
falsifiable claim nobody has tried to falsify is not evidence; it is a promise.

The audit is bounded on purpose. It reads the categories, classifies them, and tests the
three conditions. **It does not design anything**, and where a condition turns out to be met
it hands the case up rather than answering it with a colour.

---

## 2. What was read

The categories were taken from QANDEEL's own record — the Connected Worlds track (privacy
and authority boundaries, audience and consent, publication and disappearance, membership
and governance, replay and analytical projection) and the Product task track. **No new
Product research was done and no new surface was invented.**

---

## 3. The eight categories

### 3.1 Destructive delete / irreversible action

**WARNING at the commit; ERROR if it fails.**

Attached to a commit the user is performing, which is the exact shape the warning refusal
describes. The boundary they are committing across is already the carrier and the frozen
Surface contract already owns it. Apple puts the same restraint on the pattern —
confirmation belongs to *"genuinely destructive, irreversible actions (use sparingly;
overusing it trains people to click through)"*.

**The neutral policy works.**

### 3.2 Public publication / disclosure

**WARNING at the commit; SUCCESS on completion.**

The most consequential warning QANDEEL has, and the one board `b07` is built on: publishing
a world publicly cannot be undone. Still attached to a commit. The confirmation resolves
into a state the user is looking at — the world is now public, and it says so in the perfect
tense of the verb the commit used.

**The neutral policy works** — and this is the case independent review should attack
hardest, because a promoted boundary, a triangle and a sentence is all that stands between
a user and an irreversible public disclosure.

### 3.3 Privacy / authority boundary

**INFORMATIONAL — and at the edge of NOT A STATUS.**

*Who can see this* is usually not a status at all: it is a standing property of the object,
like its name. Where it is surfaced as a statement — «يظهر هذا العالَم لأعضائه فقط» — it is
information that is a **distinct kind** rather than a subordinate detail, which is the
informational overturn condition. **The condition points at a glyph, and the glyph is what
it gets**: a lock at secondary rank.

**The neutral policy works, and the condition is NOT met.**

### 3.4 Shared / Public permission change

**WARNING at the commit; SUCCESS on completion; INFORMATIONAL as a standing statement.**

Three roles on one flow, and each lands where 3.1–3.3 put it. Worth recording because it is
the case that most tempts a designer toward a colour per role: the flow would then carry
three hues in three seconds.

**The neutral policy works.**

### 3.5 Entitlement or gated action

**NOT A STATUS.**

This is the finding worth having. An action the user is not entitled to perform is
**UNAVAILABLE** — an interaction state about availability, not a system status about
something that happened. It is expressed by the unavailable ink, the programmatic disabled
state, suppressed activation, and a stated reason.

**And it is the strongest case for the DISCOVERABLE UNAVAILABLE pattern**, because the
control's *existence* is the information: a capability the user is meant to know about and
does not yet have. Removing it from the focus order hides the capability from exactly the
users least able to find it another way.

**Not a status-colour question at all.** It is REV-01's question, and REV-01 is why it now
has an answer.

### 3.6 Feature / launch unavailable state

**NOT A STATUS.** Same as 3.5.

Where the unavailable thing is a **persistent navigation destination**, E1R supplies no
expression: the object carries Living Brass, the material is state-invariant in appearance,
and how availability is shown around an identity object is a navigation-contract decision.
See `E1_DISABLED_COLLISION_RESOLUTION.md` §2.

### 3.7 Transient connection / service degradation

**WARNING — and this is the case that meets the condition.**

| | |
|---|---|
| attached to a commit the user is performing? | **no** |
| persistent? | **yes**, for as long as the condition lasts |
| a failure of something the user just did? | **no** — so it is not an error |
| does it change what the user should believe? | **yes** — that what they are writing may not be reaching anyone |

Every clause of the warning refusal — *in QANDEEL a warning is never ambient; it is always
attached to a commit the user is making* — is false of this case. **The overturn condition
written into `qandeel.status.warning` is met.**

E1 had seen this and disposed of it in one table row, as *"a persistent system condition,
not a per-action status … if it ever has to interrupt, it is an error and already has a
colour."* That row and that overturn condition contradict each other, and under E1's frozen
absolute there was nowhere to record the contradiction.

**E1R does not create a hue for it.** Degradation must be *noticed without interrupting*,
which is the thing a status hue is worst at, and the one hue QANDEEL has means *act on this
now*. The likely answer is a persistent banner carried by position, a glyph and copy. **But
that is a Product judgement about a real surface and it is handed up as one** — with the
evidence a hue would require recorded in the token.

### 3.8 Background completion whose result may not remain visible in place

**SUCCESS — and this is the second case that meets its condition.**

QANDEEL has this shape in the record already: replay distribution, analytical projection,
post-finalisation source availability. The success refusal rests entirely on the result
resolving *into a state the user is looking at*. **When the user has navigated away, it does
not**, which is the success overturn condition verbatim.

**E1R does not create a hue for it**, and the reason is that a hue is not the first missing
thing. The first missing thing is **a place for the result to land**: where does a completed
background result go, and what does the user see when they come back? Until that is
answered a colour would be decorating a gap. **Handed up.**

---

## 4. Result

| | |
|---|---|
| categories audited | **8** |
| classified NOT A STATUS | **2** — entitlement, and feature unavailability. Both are availability, which is REV-01's subject |
| refusals whose overturn condition is **NOT** met | **INFORMATIONAL** |
| refusals whose overturn condition **IS** met | **WARNING** (§3.7) and **SUCCESS** (§3.8) |
| hues created by this audit | **0** |
| cases handed to Product with evidence named | **2** |

**Does the current neutral WARNING / SUCCESS / INFORMATIONAL policy still work?**

**Yes, for every surface QANDEEL currently draws — and two of its three refusals are no
longer automatic.** The expressions on board `b07` are unchanged and remain the default. What
changed is that two of them now carry a named real case against them, which a reviewer can
accept, reject, or ask for a different answer to.

**The single most useful thing this audit produced is not about colour.** It is §3.5: the
two categories that looked most like a missing status role turned out to be availability,
and E1's frozen contract could not express one of the two patterns they need.

---

## 5. What this audit is not

- It is **not** a Product surface inventory. Eight categories were chosen because they
  stress the policy, not because they are all of QANDEEL.
- It is **not** a design of the two handed-up cases. No banner, no placement, no motion.
- It **did not** ask a user, a native Arabic reader, or the Product Owner anything. It reads
  the record and reasons from the contracts already frozen.
- It **cannot** settle §3.7 or §3.8. Both require a decision about surfaces that do not yet
  exist, and that decision is not an executor's.
