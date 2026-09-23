# C3_TOKEN_ARCHITECTURE

**I-08B3.1-C3.1.** The canonical material token architecture.

Format: **DTCG 2025.10**, validated against the official schemas vendored in
`vendor/schemas/2025.10/`. Conformance result in `C3_VALIDATION_RESULTS.md` §2.

---

## 1. The decision that shapes everything else

**C3 does not create a second token system. It extends the one QANDEEL already has.**

I-08B3.1-B4R froze the Surface system as DTCG 2025.10 with a resolver, an appearance modifier and a
contrast modifier. A Living Brass token file standing *beside* it would have been a second
architecture with its own conventions, its own appearance handling and its own idea of what "dark"
means — and the first time the two disagreed, the disagreement would have been invisible, because
nothing would have been resolving them together.

So C3's resolver names **B4R's sets and C3's sets in one resolution order**. The B4R files are
vendored **exact-byte** and referenced rather than copied-and-edited; invariant **I-17** verifies that
byte-identity against the sealed B4R package rather than trusting the directory name.

Living Brass and the frozen neutrals it is judged against come out of **one resolution**. That is the
only way the claim *"the material sits inside the frozen system"* can be checked rather than asserted.

---

## 2. The three tiers

```
EXPRESSION   qandeel.expression.material.living-brass.body   = #a58e6f   ← THE ONE LITERAL
             qandeel.expression.content.tertiary             = #8b8982   (B4R, frozen)
                       ▲
SEMANTIC     qandeel.identity.material  ──────────────────────┘
                       ▲
PERMISSION   qandeel.identity.mark  ·  qandeel.identity.moment  ·  qandeel.navigation.machinery
```

**Resolved chains, as the build reports them:**

```
qandeel.identity.material     → qandeel.expression.material.living-brass.body            #a58e6f
qandeel.identity.mark         → qandeel.identity.material → …                            #a58e6f
qandeel.identity.moment       → qandeel.identity.material → …                            #a58e6f
qandeel.navigation.machinery  → qandeel.identity.material → …                            #a58e6f
qandeel.control.functional    → qandeel.content.tertiary  → qandeel.expression.content.tertiary   #8b8982
qandeel.analysis.node         → qandeel.content.primary   → …                            #d8d5ca
qandeel.analysis.relation     → qandeel.content.tertiary  → …                            #8b8982
```

Note that `navigation.machinery` reaches the body **through `identity.material`**, not directly. That
is load-bearing and invariant **I-03** probes for exactly the subtler failure: a navigation token that
still resolves to Brass but by its own route is no longer part of the same material story, and would
survive any check that only compared colours.

---

## 3. Naming

The brief forbids `gold`, `amber`, `yellow`, `accent`, `brandAccent`, `selectedColor`. Invariant
**I-18** scans for them.

The reason is not squeamishness about words. **A name is the first thing a future implementer reads,
and each of those names tells them the wrong thing about what this is:**

| forbidden | what it would imply | what is true |
|---|---|---|
| `gold` / `amber` / `yellow` | a hue with luxury or warning connotations | a material, 2.3–3.2× less chromatic than census golds |
| `accent` / `brandAccent` | something applied to controls for emphasis | material identity, never emphasis |
| `selectedColor` | that it turns on with state | it is state-invariant by construction |

**The tree is organised by PERMISSION CLASS**, not by screen or by component. C2 proved a *coverage*
policy, and a coverage policy is a statement about which classes of object are made of the material.
So the entire policy can be read off the alias targets: the names that reach the material **are** P2,
and the names that reach a neutral are everything P2 excludes.

---

## 4. The permission classes

| Token | Resolves to | Permission |
|---|---|---|
| `qandeel.identity.material` | the body | the one semantic name for Living Brass |
| `qandeel.identity.mark` | the body | the canonical Q as the product mark — **material granted, placement not** |
| `qandeel.identity.moment` | the body | a rare, large, exceptional identity moment — the only place the character may exist |
| `qandeel.navigation.machinery` | the body | the persistent navigation icon family, **as one family, at every state** |
| `qandeel.control.functional` | `#8b8982` | ordinary functional and action controls — **neutral by default** |
| `qandeel.analysis.node` | `#d8d5ca` | an analytical node — **neutral, permanently** |
| `qandeel.analysis.relation` | `#8b8982` | an analytical relation stroke — **neutral, permanently** |

**There is deliberately no sibling of `navigation.machinery` for any interaction state.** That is how
*"Brass never turns on because an item is selected"* is made unavailable rather than merely forbidden
— there is no token to reach for.

---

## 5. The reserved namespaces, and why they are not simply absent

```
qandeel.state          RESERVED · EMPTY · owned by I-08B3.1-E
qandeel.status         RESERVED · EMPTY · owned by I-08B3.1-E
qandeel.illumination   RESERVED · EMPTY · owned by I-08B3.1-D   ← this is QANDEEL LIGHT
```

Two reasons, and the second is the one that matters.

**A future implementer finds a door with a sign on it** rather than an absence they fill however they
like. Each carries a description saying who owns it and what may never be true of it.

**And a check against an empty namespace has a real surface to guard.** An invariant that passes
because nothing exists is the "check that cannot fail" this project has shipped before. `I-04`,
`I-05` and `I-14` each guard one of these groups *and* run a probe that adds a member aliasing the
material, requiring the check to fire.

### 5.1 The naming hazard, recorded deliberately

**"QANDEEL Light" and "light appearance" are different things that share an English word**, and they
are kept in different places on purpose:

- **`qandeel.illumination`** — the Product's later illumination and meaning system. A *semantic*
  namespace.
- **`appearance: light`** — a theme context. A *modifier* context.

An implementer who conflates them wires illumination to the material without ever deciding to.
Invariant **I-14** guards the namespace by name for exactly that reason.

---

## 6. DARK-LED, NOT DARK-LOCKED

`appearance/light.material.tokens.json` is **deliberately empty, and the emptiness is the
deliverable.**

Resolving the semantic layer against the light appearance leaves every Living Brass name
**UNRESOLVED and names what is missing**:

```
UNRESOLVED qandeel.identity.material     → references {qandeel.expression.material.living-brass.body}, not a token in this document
UNRESOLVED qandeel.identity.mark         → …
UNRESOLVED qandeel.identity.moment       → …
UNRESOLVED qandeel.navigation.machinery  → …
```

A `light` set containing a copy of the dark body would be a **Light Brass invented by accident**,
shipping under a name someone trusted. The difference between dark-led and dark-locked is exactly
this check, and invariant **I-13** probes it by copying the dark body into light — the corruption an
implementer would actually commit, because "it looks fine".

**A light Brass is not a lighter Brass.** The body was selected against a near-black World on evidence
gathered entirely in the dark; on a light ground the same value is a different material perceptually,
its contrast relationships invert, and P2 was never tested there. Owned by F, informed by D.

---

## 7. What is a token and what is not

The material behaviour rules — *quiet satin*, *subtractive-only*, *permission-not-size*,
*authored-oklch* — live in the `living-brass` group's `$extensions`, **not** as tokens.

They were first authored as tokens with `$type: "other"`. DTCG 2025.10 defines exactly thirteen types
and `other` is not among them, so schema validation rejected them — which is why this package
validates against the vendored schemas instead of assuming its own JSON is conformant.

**The fix is better than the original.** A DTCG token carries a *design value* that a build consumes.
*"The character may only darken"* is not a value; it is a contract a human obeys. Forcing it into a
token type would have used the format to make a rule look like data.

The **numbers** stayed tokens — amplitude, frequencies, octaves, seed, coverage gain and bias, tone
depth ratio, and the proof-era constant as a `dimension` — because a build really does consume those.

---

## 8. Files

| File | Authored by | Contents |
|---|---|---|
| `tokens/base/material.tokens.json` | **C3** | permission classes, material behaviour contract, reserved namespaces |
| `tokens/appearance/dark.material.tokens.json` | **C3** | the one literal, with provenance |
| `tokens/appearance/light.material.tokens.json` | **C3** | deliberately empty |
| `tokens/qandeel-living-brass.resolver.json` | **C3** | one resolution order over both systems |
| `vendor/b4r/semantic.tokens.json` | B4R, frozen | the four Surface roles and the reading ramp |
| `vendor/b4r/dark.tokens.json` | B4R, frozen | the frozen neutral expression |
| `vendor/b4r/light.tokens.json` | B4R, frozen | deliberately empty |
| `vendor/b4r/standard.tokens.json` · `increased.tokens.json` | B4R, frozen | contrast contexts |

**The `$ref` paths are load-bearing documentation.** Anything under `../vendor/` is inherited and
byte-identical to the sealed package it came from; anything under `./` is authored by C3. A reviewer
can see which is which without reading a word of prose — and invariant **I-20** verifies every `$ref`
resolves to a file that exists, because a resolver that silently drops a set produces a smaller system
that still validates.
