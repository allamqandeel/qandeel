# B4R_REVISION_RECORD

**I-08B3.1-B4R — FINAL DTCG RESOLVER CONFORMANCE + RN DISMISSAL-SCOPE CORRECTION**

An independent Design Director freeze review passed B4's Product, visual and token conclusions and
raised **one standards blocker** and **one documentation/API-scope correction**. This package is B4
with both corrected, every suite re-run, and the original B4 archive left byte-untouched.

**No Surface decision was reopened.** `#181818`, `#101010`, the reading neutrals, opaque matte, the
0.50 PASSAGE scrim, the Surface ontology, the Surface Earning Test, the one-tone rule, the
anti-cardification doctrine and every deferral stand exactly as B4 froze them. No colour was
searched for, no board was rendered for a creative purpose, and **no Product value changed**.

---

## 1. B4R-REV-01 — the resolver document was not DTCG 2025.10 conformant

### What was wrong

`tokens/qandeel-surface.resolver.json` declared:

```json
"sets":      [ { "name": "semantic", … } ],
"modifiers": [ { "name": "appearance", … }, { "name": "contrast", … } ],
"resolutionOrder": [ { "type": "set", "name": "semantic" }, … ]
```

The published Resolver Module declares `sets` as **`Map[string, Set]`** and `modifiers` as
**`Map[string, Modifier]`** — *the name is the key* — and a root-declared member is named from
`resolutionOrder` by a **reference object**, `{ "$ref": "#/sets/semantic" }`.

The subtle part, and the reason this was easy to get wrong: **`{ type, name }` is a real form.** It
belongs to a set or modifier declared **inline** in `resolutionOrder`, where `name` and `type` are
added *on top of* the body (`sources` for a set, `contexts` for a modifier). B4 wrote the inline
form's marker keys with **neither the body nor a reference** — a shape that is neither of the two
the specification defines. The official schema rejects the shipped document in **17 places**.

### Why it happened, stated exactly

B4's Reference Gate could not reach `designtokens.org` and substituted the specification's own
repository at `main`, **disclosing in §0.1 that `main` is not a frozen 2025.10 snapshot.** That
disclosed risk then materialised. The mechanism is worth recording precisely, because it is general:

- the repository has **no `2025.10` tag** — its only tags are `first-public-draft`,
  `editors-drafts/1` and `editors-drafts/2`, so `main` is a moving editor's draft, not a release;
- `technical-reports/resolver/syntax.md` has been committed **four times since** the publication
  commit `f0f32a7dce0b` (2025-10-28, *"Publish 2025.10"*);
- reading `main` therefore meant reading **post-publication drafting**, not the stable report.

**A disclosed limitation is not a handled one.** B4 wrote the risk down and then relied on the source
anyway, because there was no other source it could reach. What was missing was not candour; it was a
*mechanism* — something in the package that would fail if the belief were wrong. That is what the
vendored schema now is.

### What was done

| | |
|---|---|
| **Authority** | The publication commit `f0f32a7dce0b` for the report text, and the **official JSON Schema** `https://www.designtokens.org/schemas/2025.10/resolver.json` plus its three sub-schemas. |
| **Vendored** | `schemas/2025.10/**` — 22 files (resolver ×4, format ×18) with `PROVENANCE.json`. |
| **Verified** | Each file's **git blob SHA-1 recomputed locally matches the blob sha the GitHub tree API reports** for the official repository — 22 of 22. `schemas/schemas.config.json` declares `outputDirs: [… "../www/public/schemas"]`, which is how these sources become the files `designtokens.org/schemas/` serves. |
| **Validator** | **ajv 8.18.0**, a third-party implementation resolved from the repository's own `node_modules`. Not authored here. |
| **Enforced by** | `tools/b4r-schema.mjs` — S-01…S-05, plus six probes run through **both** validators. |
| **Custom validator** | `validateResolver()` in `tools/b4-validate.mjs`, rewritten on the real model; V-11 is now a thin wrapper over it, so both suites test one implementation. |

### One place the pin is *not* authoritative — recorded because it cuts against the pin

At `f0f32a7dce0b` the report contradicts itself on the version literal: the root-property table says
the type is `YYYY-MM-DD` and the value must be `2025-10-01`; the prose immediately below says
`2025-11-01`. Neither is what the specification settled on. The official schema constrains `version`
to `const: "2025.10"`, and three later commits are the repair of exactly this. QANDEEL ships
`"version": "2025.10"` — **unchanged from B4, and correct.**

A pin is a defence against drift, not a claim that the pinned text is flawless. Where report text and
schema could differ on a syntax question, **the schema wins**; that is this package's standing rule
now, and it is the rule that would have prevented the defect.

### The finding inside the fix

The five probes the review asked for do **not** all behave the same way, and the difference is the
most useful thing learned here:

| probe | official schema | custom V-11 |
|---|---|---|
| **A** `sets` as an array | REJECT | REJECT |
| **B** `modifiers` as an array | REJECT | REJECT |
| **C** `{ type, name }` for a root-declared set | REJECT | REJECT |
| **D** `$ref` to an undeclared set | **ACCEPT** | REJECT |
| **E** modifier `default` naming a missing context | **ACCEPT** | REJECT |

D and E are not syntax. An undeclared `$ref` is a perfectly well-formed URI reference, and a
`default` naming a missing context is a plain string. **The official schema says so itself**, in
`$comment`, twice — these "must be performed at runtime by the implementation".

So the two validators **partition** the specification rather than duplicating it. A package that had
concluded "the official schema is strictly better than our own checker" and deleted V-11 would have
shipped both defects with a clean conformance report. Both suites now run, S-05 exists to report a
genuine disagreement rather than resolve one quietly, and **0 probes were caught by neither.**

### Two harness defects this exposed

1. **V-11 had no negative evidence behind it.** `build()` read the resolver straight from disk, so no
   probe could perturb it — the same defect `v-n1` exposed in this harness once already, in a
   different member. That is twice: *a check whose subject cannot be reached by the probe machinery
   is a check nobody has tested.* The resolver now flows through the override path, and five probes
   land on V-11.
2. **`WORK` pointed at `.i08b31-b4-work`.** Copied forward unchanged, B4R would have overwritten the
   artefacts B4's shipped results document was generated from — a correction quietly destroying the
   thing it is being compared against. Now `.i08b31-b4r-work`.

---

## 2. B4R-REV-02 — `onRequestClose` is not keyboard Escape

B4 wrote that `Modal.onRequestClose` is "the platform's Escape". React Native's own documentation
says it fires on **the Android hardware back button**, **the Apple TV menu button**, and on **iOS**
when a modal is dismissed by **drag gesture** with `presentationStyle` `pageSheet`/`formSheet`, or
when `allowSwipeDismissal` is enabled. **No keyboard Escape appears in that list.**

The correction narrows the **API claim** and leaves the **product obligation** where B3R put it:

- **Product obligation (unchanged):** a modal PASSAGE must offer a platform-appropriate way to
  dismiss it, and dismissal must restore a coherent focus context.
- **React Native:** `onRequestClose` covers the platform dismissal paths RN documents, and is
  required on Android and TV. While the modal is open, `BackHandler` events are not emitted.
- **Per-platform work, not an inherited guarantee:** hardware-keyboard Escape, the accessibility
  escape gesture, and any other dismissal path must be implemented and verified on each platform and
  input path the product supports.

**No keyboard API was invented.** Where RN documents none, the mapping says so rather than naming a
prop that would read as a guarantee.

**The ASIDE sentence was worse than imprecise.** B4 wrote "Escape (`onRequestClose`, or the platform
equivalent)" into the **nonmodal** role's contract. `onRequestClose` is a `Modal` prop; an ASIDE does
not use `Modal`, so the prop does not exist for it. Naming a modal API inside the nonmodal role's
contract is how an ASIDE becomes a PASSAGE one convenient prop at a time. **ASIDE remains nonmodal:**
the World stays live, nothing goes inert, nothing receives `accessibilityViewIsModal`, no scrim.

---

## 3. Impact — what changed, and what provably did not

| | |
|---|---|
| `tokens/qandeel-surface.resolver.json` | **changed** — 1,655 → 1,571 bytes |
| `tokens/qandeel-surface.tokens.json` | **byte-identical to B4** |
| `tokens/base/semantic.tokens.json` | **byte-identical** |
| `tokens/appearance/{dark,light}.tokens.json` | **byte-identical** |
| `tokens/contrast/{standard,increased}.tokens.json` | **byte-identical** |
| all 14 integration rasters | **byte-identical to B4's** |
| Product values | **none changed** — WORLD `#101010`, SURFACE `#181818`, PRIMARY `#d8d5ca`, SECONDARY `#afaca3`, TERTIARY `#8b8982`, PASSAGE scrim `#000000` @ 0.50 |
| alias topology | **unchanged** — four roles, one source, chain length 3 |

The resolver document describes how sets **compose**; it holds no colour. That is why a conformance
defect of this size had zero visual consequence — and also why it could sit undetected in a package
whose every other check passed.

## 4. Suites, re-run in full

| suite | result |
|---|---|
| **Official DTCG 2025.10 schema** (new) | **5/5** checks, **6/6** probes, 0 caught by neither |
| B4.9 token validation (custom) | **11/11** checks, **11/11** probes *(6 original + 5 new)* |
| B4.5 production invariants | **12/12**, **12/12** probes, full coverage |
| B4.8 anti-cardification | **5/5** clean, **4/4** violating fixtures rejected |
| B4.12 integration | **7/7** byte-identical, **0** pixels differ |
| B4.4 scrim (alpha 0.50) | **5/5** measurements match predictions computed before the render |
| Skill Gate | 86 skills, **0 drift**, 3 USED |
| Reference Gate | verified; §0.1.1 records this failure rather than hiding it |

**No stop condition triggered.** The canonical dark output is byte-identical, so no
serialisation-difference exemption was needed or claimed.
