# QANDEEL — AMB-01 Architecture Ruling
## Narrow Stage 5.5 Reopening — P5 `Go Live + Locate` Referent Binding

**Trigger:** Stage 5.6 `AMB-01`  
**Classification:** Genuine architecture ambiguity, not contradiction  
**Scope:** One clause in Stage 5.5 only  
**All other frozen Stage 5.1–5.5 contracts remain unchanged**

---

# Architecture Decision

## P5 uses **POST-LIVE ONE-SHOT BINDING**

`Go Live + Locate` is an atomic composite with an internal semantic order:

1. **Return to Live**
2. **Bind the Live Focus once**
3. **Attempt the one-shot locate**

The locate referent is therefore **not bound at overall action activation**, and it is also **not allowed to chase `LF` continuously until final presentation settle**.

Canonical sequence:

```text
P5 activation
    ↓
temporal sub-effect establishes FOLLOW_LIVE
    ↓
effective TC resolves to authoritative Live Head
    ↓
bind exactly once:
P5_LF* := LF_at_post-live-boundary
    ↓
at locate settle:
execute spatial locate iff
Locatable(P5_LF*, K(LH)) = true
```

`P5_LF*` is a transient act-local referent, not a member of canonical state `S`.

---

# Why this is the correct boundary

## 1. The meaning of the composite is sequential

The command is:

> **Go Live + Locate Live Focus**

The first semantic effect intentionally changes the temporal reference frame from historical to authoritative Live.

Therefore the spatial target must be selected from the Live state **after that temporal return has taken effect**.

Binding `LF` before returning Live could send the camera to something that is no longer the Live Focus at the moment the command has actually achieved “Go Live.”

---

## 2. Final-settle chasing is also rejected

Reading `LF` continuously until final spatial settle would let asynchronous Live-Focus changes retarget the same explicit command repeatedly.

That would blur a one-shot composite into moving-focus follow.

So P5 binds **once**, at the logical handoff between its temporal and spatial sub-effects.

---

## 3. This preserves D1 without copying D1

Stage 5.5 D1 remains unchanged:

### Return to Live Focus
```text
LF* := LF_at_activation
```

because it is a one-shot **spatial-only** command operating in the user's current temporal frame.

### Go Live + Locate
```text
P5_LF* := LF_at_post-live-boundary
```

because the explicit composite first changes the user's temporal frame to Live and only then resolves what “Live Focus” means for its spatial sub-effect.

The two actions therefore bind at different semantic boundaries for a principled reason.

Neither action persistently follows later LF changes.

---

# Required Race Outcomes

## Case A — Established → Emerging before Live return completes

At P5 activation:

```text
LF = A
A = Established / locatable
```

Before the temporal Live sub-effect reaches its authoritative Live boundary:

```text
LF = B
B = Emerging / pre-geographic
```

At post-live binding:

```text
P5_LF* = B
```

Result:

```text
FOLLOW_LIVE
TC = authoritative LH
no camera movement
```

because:

```text
Locatable(B, K(LH)) = false
```

The old `A` is NOT located merely because it was Live Focus at overall action activation.

---

## Case B — LF changes after post-live binding

At post-live boundary:

```text
P5_LF* = A
```

Then before spatial settle:

```text
LF changes A → B
```

The current P5 act does **not** chase B.

At locate settle:

```text
evaluate Locatable(P5_LF*, K(LH))
```

and either:

- locate `A` once if legitimate; or
- perform no camera movement if `A` is no longer locatable.

A later explicit P5 invocation may bind the then-current LF.

---

# Transaction / Return Semantics

P5 remains exactly **one explicit atomic RH transaction**.

The internal semantic order does NOT create:

- an intermediate RH checkpoint;
- an intermediate Back stop;
- a new temporal mode;
- a new canonical state member.

If the temporal part changes state but the locate part cannot execute, the P5 transaction still records the effective composite act according to the already-frozen RH rules.

Back restores the full pre-P5 checkpoint through:

```text
RestoreTemporal(C_RH) := PINNED(C_RH.capturedTC)
```

plus the captured spatial/inspection viewpoint.

---

# No-Hindsight / Geography Constraints

This clarification does not change:

- no-hindsight;
- historical projection;
- Thread Home loci;
- Emerging/pre-geographic semantics;
- Stage 4 locate authority;
- Stage 5.3 disclosure;
- accessibility parity.

The spatial sub-effect remains bounded by the existing Stage 4 / P5 locate authority.

No fabricated locus is permitted.

---

# Canonical Clause to Add to Stage 5.5

Add an equivalent of:

> **P5 Referent Binding — Go Live + Locate:** P5 is one atomic composite with ordered semantic sub-effects. Its temporal sub-effect first establishes `FOLLOW_LIVE` and resolves authoritative Live state. At that logical post-live boundary, the act snapshots the then-current Live Focus once as `P5_LF*`. The locate sub-effect subsequently executes only if `Locatable(P5_LF*, K(LH))` is true at locate settle. Later `LF` changes do not retarget the in-flight P5 act. If the bound focus is Emerging/pre-geographic or otherwise unlocatable, the temporal Live return remains valid and no camera movement occurs. No intermediate RH checkpoint is created.

---

# Freeze Effect

This is a **narrow Stage 5.5 clarification** resolving AMB-01.

No other Stage 5.5 rule is reopened.

After incorporation:

## Stage 5.5
returns immediately to:

**CLOSED / FROZEN**

with this clause included in its canonical record.

Stage 5.6 may then re-run only the proof slice affected by AMB-01.

---

# Required Stage 5.6 Targeted Re-Run

Do NOT repeat Stage 5.6 from scratch.

Create:

`QANDEEL_STAGE5_6_STAGE5_FREEZE_CANDIDATE_v2`

from v1, preserving all unaffected evidence.

Re-run/update only what is affected by this ruling, plus the final freeze summaries:

1. **Integrated adversarial attack #4**
   - Established LF at P5 activation
   - changes to Emerging before post-live binding
   - expected: FOLLOW_LIVE succeeds, no camera movement.

2. **Higher-order composition #11**
   - Emerging/pre-geographic LF + Go Live + Locate + RH
   - must now yield one deterministic outcome.

3. **FZ-03**
   - all required adversarial scenarios deterministic.

4. **AMB-01 report**
   - convert from blocker to `RESOLVED BY ARCHITECTURE RULING`;
   - retain the original finding as evidence that the higher-order audit worked.

5. **Global freeze summaries**
   - re-evaluate FZ-01…FZ-15 totals;
   - re-evaluate AT / integrated-attack counts accurately;
   - re-evaluate terminal class.

6. **Proof Board A**
   - replace the AMB row with the deterministic P5 race outcome.

7. **Proof Board B**
   - update FZ-03 / attack #4 / terminal recommendation / AMB panel.

8. **Proof Board C**
   - no content change required unless regeneration is needed for package consistency.

9. **§35 proposed Stage 5 Final Freeze Statement**
   - update from WITHHELD to **PROPOSED FOR ARCHITECTURE APPROVAL** only if all freeze criteria pass.
   - Claude still MUST NOT self-freeze Stage 5.

10. **Traceability**
    - add this P5 binding clause as Stage 5.5 authority for the affected rows.

11. Regenerate:
    - `START_HERE`
    - decision index where affected
    - `SHA256SUMS`
    - ZIP

---

# Stop Rule

If applying this ruling creates any new semantic ambiguity or contradiction:

**STOP and report it.**

Do not compensate by changing another frozen rule.

Otherwise return the v2 Freeze Candidate for final Architecture sign-off.
