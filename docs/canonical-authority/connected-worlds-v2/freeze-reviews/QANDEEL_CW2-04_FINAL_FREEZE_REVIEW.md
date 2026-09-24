# QANDEEL — Connected Worlds v2
## CW2-04 — Final Freeze Review

**Reviewed:** `CW2-04 Public World Runtime Architecture Proposal v0.2`  
**Review type:** Final Public World runtime freeze gate  
**Result:** PASS WITH THREE INCORPORATED ARCHITECTURAL TIGHTENINGS  
**Product question required:** NO  
**Implementation:** NOT STARTED

---

# 1. Freeze-review objective

The final review tested whether Public World runtime can freeze without turning:

- publication consent into Experience ownership;
- Public Alias into semantic content or contact identity;
- discussion activity into semantic truth;
- stale indexes into a privacy leak;
- source provenance into a backdoor to hidden Worlds.

No Product contradiction was found.

---

# 2. Tightening F1 — Experience control and source-material rights are separate

## Risk

A Shared-derived Public Experience may contain material from several people.

If every included material owner became an Experience owner automatically, publication consent would accidentally create shared control over the entire public object.

If only the publisher mattered, source-material rights could be lost.

## Freeze correction

Architecture separates:

```text
EXPERIENCE_CONTROL_AUTHORITY
CONTENT_RIGHTSHOLDER_SET
```

`EXPERIENCE_CONTROL_AUTHORITY` governs the Public Experience container, such as:

- creating a new Experience version;
- deleting the Experience from Public World;
- owner-only Replay creation from that Experience.

`CONTENT_RIGHTSHOLDER_SET` governs the protected included source portions under CW2-02.

Consent to include a source portion does not automatically create control over the Experience container.

Experience control does not erase source-material rights.

Any future source-right withdrawal/recall policy remains governed by explicit domain rules and is not invented here.

---

# 3. Tightening F2 — Public identity reference is stable; display label is mutable

## Risk

If public objects bind directly to alias text, changing an Alias could:

- break authorship linkage;
- duplicate identities;
- mutate semantic indexes;
- accidentally expose private account IDs.

## Freeze correction

Public authorship binds internally to stable:

`PUBLIC_IDENTITY_REF`

Public display uses a mutable:

`PUBLIC_DISPLAY_LABEL`

which may be pseudonym or chosen real name.

The stable ref:

- is not a public contact endpoint;
- is not the Shared invite credential;
- does not expose private account identity.

Historical label rendering remains deferred.

---

# 4. Tightening F3 — Public audience policy is a gate, not World identity

## Risk

Current Product direction says registered members can view, while signed-out behavior is unresolved.

Hard-wiring "registered users" into the identity of `PUBLIC_WORLD` would force redesign if signed-out viewing changes later.

## Freeze correction

`PUBLIC_WORLD` remains one logical World.

Visibility is controlled through:

`PUBLIC_AUDIENCE_POLICY`

Current v1 direction may resolve that policy to registered members.

Changing signed-out eligibility later does not create a new World or alter Experience identity/meaning.

---

# 5. Final non-regression check

With F1–F3 incorporated, the runtime preserves:

- one Public World;
- bounded publication;
- exact material-rights authority;
- stable semantic geography;
- no hidden private-context use;
- no DM/contact path;
- Public Alias separation;
- complete deletion from public projections;
- discussion dependence on parent Experience;
- Replay owner boundary;
- versioned semantic truth.

---

# 6. Freeze verdict

# `CW2-04 — Public World Runtime Architecture`
# **APPROVED / CLOSED / FROZEN**

Next:

`CW2-05 — Replay Runtime Architecture`

No implementation has been authorized by this freeze itself.
