# B4_FREEZE_RECORD

**I-08B3.1-B4.13, carried into B4R unchanged in substance.** The freeze record, prepared because
every gate passed.

**This document does not freeze anything.** A freeze is a Design Director decision. This is the
record that decision would be made on, and it is written so that the boundary of what is being
frozen is impossible to mistake.

> **I-08B3.1-B4R status.** An independent freeze review passed every Product, visual and token
> conclusion below and raised two corrections, both now applied: a **DTCG Resolver conformance
> blocker** (the resolver document's shape — no value, token or raster affected) and a **React Native
> API-scope correction** (`onRequestClose` is not keyboard Escape). Every canonical value in this
> record is **byte-identical to B4's**, verified file by file. Nothing in the proposed freeze moved.
> See `B4R_REVISION_RECORD.md` and `B4R_SCHEMA_CONFORMANCE.md`.

---

## 1. The proposed freeze

> **I-08B3.1-B — SURFACE / CONTENT HIERARCHY — CLOSED / FROZEN**

**Canonical dark-expression Surface**

```
#181818
```

**Canonical dark PASSAGE scrim**

```
neutral black / 0.50 alpha
```

**Canonical material**

```
OPAQUE MATTE
```

**Canonical one-tone rule**

```
APPARATUS
ASIDE
PASSAGE
FIELD

all reference the same Surface token.
```

Not "all use the same value" — **all reference the same token**. `#181818` exists once in the
architecture, at `qandeel.expression.surface`, and every Product role reaches it through a
three-link alias chain. The distinction is the whole of INV-01 and the reason `tools/b4-dtcg.mjs`
keeps reference chains rather than only resolving them.

**Carried unchanged from I-08B3.1-A (already frozen):** WORLD `#101010`, primary reading `#d8d5ca`,
secondary `#afaca3`, tertiary `#8b8982`.

---

## 2. What the freeze is supported by

| claim | evidence |
|---|---|
| one shared semantic token | INV-01 — four roles, one terminal source, every chain through `qandeel.surface.functional`; probe `n1` (four equal hexes) rejected |
| the production token file reproduces the accepted appearance | 7 of 7 compositions byte-identical through the sealed B3R stylesheet, **0 pixels differing**, geometry and static focus topology unchanged |
| the 0.50 scrim works in the accepted PASSAGE contexts | 5 of 5 measurements exactly on predictions computed before the render |
| opaque matte, and Reduce Transparency changes nothing | INV-11 at the token layer; B3 measured 0 of 5,235,264 pixels at the raster layer; the API is iOS-only and needs no branch |
| no retired value survives anywhere | INV-03 over all 7 token files, needles assembled from halves at runtime so the scan covers its own source |
| the system cannot grow a ladder | INV-07 and INV-10 — exactly one literal Surface value, so an elevation function would have a domain and no range |
| the rules can actually reject things | 12 of 12 invariant probes, 6 of 6 validation probes, 4 of 4 cardification fixtures — the last four being the **sealed predecessor's own failure captures** |

---

## 3. What is explicitly NOT frozen — the boundary of B's authority

| item | status | owner |
|---|---|---|
| **Class S final COLOUR** | deferred. Its *rules* are frozen: load-bearing only, ≥ 3:1 where SC 1.4.11 applies, 1 logical/CSS px baseline, thickness/contrast may increase later. | **I-08B3.1-E / F** |
| **Focus indicator token** | deferred. The 2 px *area* reasoning under SC 2.4.13 is recorded; nothing is designed. | **I-08B3.1-E / F** |
| **Interaction and status colours** | deferred. B3 carried unavailability **lexically** rather than invent a status colour, and that stands. | **I-08B3.1-E** |
| **Accessibility alternate expressions** | deferred. The `contrast` modifier exists and is empty. | **I-08B3.1-F** |
| **Light appearance values** | deferred. The `appearance=light` context exists and contributes **zero** values; resolving into it fails loudly. | **I-08B3.1-F** / later theme work |
| **Living Brass** | untouched | **I-08B3.1-C** |
| **QANDEEL Light** | untouched | **I-08B3.1-D** |
| **Corner radius** | not frozen. Component/context-specific. *Corner radius is not personality.* | component work |
| **Shadow** | no token, no scale, no precedent. A future component-specific shadow needs its own justification. | component work |
| **Class O organisational edge** | **default NONE**; exists only if it independently passes the Edge Removal Test. No token. | — |

**No general border token exists**, and none may be created as a convenience.

---

## 4. Open dependencies carried into the freeze

These are not blockers for B, and they are not resolved by it either.

- **D-6 — the lifecycle evidence is keyboard-only, one engine.** B3R proved the PASSAGE focus
  lifecycle in one browser with keyboard input. Touch and pointer dismissal, and screen-reader
  announcement behaviour, remain unproven.
- **D-7 — the DOM → React Native mapping is partial.** `B4_SKILL_GATE.md` §1.1 closed part of it:
  the PASSAGE maps to `Modal` + `accessibilityViewIsModal` with the four lifecycle obligations, and
  a named hazard (`accessible={true}` collapsing focusable children) that has no DOM analogue.
  **The ASIDE half is still open**: React Native has no `menu`/`menuitem` pair with the ARIA
  contract and no analogue of `role="note"`. Not invented here.
- **D-8 — NEW. The PASSAGE boundary is 1.128:1 against the World it suspends.** Measured, not
  estimated. The scrim improves it by a factor of 1.053. That separation is small **by design** —
  the frozen mechanism is occlusion plus a uniform scrim plus modal behaviour, not edge contrast —
  and a one-tone system that separated by edge contrast would need a second tone. If a later
  accessibility expression requires this boundary to clear SC 1.4.11's 3:1, the answer is a **Class
  S line on the PASSAGE**, whose colour is E/F's. Raised here so the freeze is made with the number
  in view.
- **D-9 — NEW. `contrast` has no cross-platform input.** iOS surfaces
  `isDarkerSystemColorsEnabled()`; Android surfaces `isHighTextContrastEnabled()`. The modifier's
  input must be a product-level resolution of two single-platform signals. Owned by F.

---

## 5. What reverses from B0–B3R

**Nothing.**

No visual conclusion, no Product conclusion, no accepted finding and no retired direction changes.
B4 rendered seven accepted compositions and got the same pixels. The three corrections B4 does make
are all to **B4's own rules**, found by B4's own probes, and are recorded in `B4_INVARIANTS.md`
§3–§4.

Two things B4 restates rather than reverses, because both are corrections the predecessors already
made and both are easy to un-make in production:

- **PRODUCT ROLE ≠ ACCESSIBILITY ROLE** (B3R). A Product Surface role does not dictate an ARIA or
  native role.
- **Proof markup is not component architecture** (B3R, and B4's FIELD contract). B3's focusable
  `div` was adequate for a containment proof and is not a textbox specification.

---

## 6. Freeze checklist

| gate | status |
|---|---|
| Reference Gate verified, with failures and substitutions recorded | **YES** |
| Skill Gate verified, 86 skills hashed, 0 drift | **YES** |
| Token file DTCG 2025.10 conformant | **YES** — 11/11 checks |
| One-tone invariant mechanically enforceable | **YES** — structurally, on chains |
| Theme capability without renaming semantic roles | **YES** — and a missing theme fails loudly |
| No invented Light value | **YES** — and the absence is detectable |
| 50 % scrim verified in the accepted contexts | **YES** — 5/5 exact |
| Production token file reproduces the accepted appearance | **YES** — 7/7 byte-identical, 0 pixels |
| Invariants executable and proven to reject | **YES** — 12/12 and 12/12 |
| Anti-cardification guard proven to reject | **YES** — 4/4, on the predecessor's own failures |
| Proof-to-production classification complete | **YES** — and enforced by what the token file does not supply |
| Nothing outside B's authority frozen | **YES** — §3 |
| Predecessor archives byte-unchanged | **verified at packaging** |
| No stop condition triggered | **YES** |

---

## 7. The decision this record asks for

**Freeze I-08B3.1-B — SURFACE / CONTENT HIERARCHY — with `#181818`, opaque matte, and a neutral
black scrim at 0.50 alpha in the dark expression, all four Product Surface roles referencing one
token.**

Everything in §3 stays open, and the four dependencies in §4 travel with the freeze rather than
being closed by it.
