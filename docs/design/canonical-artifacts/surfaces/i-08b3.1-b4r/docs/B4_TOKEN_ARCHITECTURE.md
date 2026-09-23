# B4_TOKEN_ARCHITECTURE

**I-08B3.1-B4.1 and B4.2.** The semantic token model, and the theme capability built into it.

Authority: `tools/b4-tokens.mjs` authors it; `tokens/*.json` is what ships; `tools/b4-validate.mjs`
and `tools/b4-invariants.mjs` prove it. Format: DTCG **2025.10** (Format, Color and Resolver
Modules) — see `B4_REFERENCE_GATE.md` §§1–3.

---

## 1. The shape, in one view

```
TIER 1  qandeel.expression.*          APPEARANCE-SPECIFIC VALUES
        ├─ world                      #101010          the only tier that holds a colour
        ├─ surface                    #181818          <- THE ONE SURFACE VALUE, once, here
        ├─ content.primary            #d8d5ca
        ├─ content.secondary          #afaca3
        ├─ content.tertiary           #8b8982
        └─ scrim                      #000000 @ 0.50

TIER 2  qandeel.*                     APPEARANCE-INDEPENDENT SEMANTIC ROLES
        ├─ world.fill                 -> {qandeel.expression.world}
        ├─ surface.functional         -> {qandeel.expression.surface}      <- the junction
        ├─ content.primary            -> {qandeel.expression.content.primary}
        ├─ content.secondary          -> {qandeel.expression.content.secondary}
        ├─ content.tertiary           -> {qandeel.expression.content.tertiary}
        └─ passage.scrim              -> {qandeel.expression.scrim}

TIER 3  qandeel.role.*                THE FOUR FROZEN PRODUCT SURFACE ROLES
        ├─ apparatus.fill             -> {qandeel.surface.functional}
        ├─ aside.fill                 -> {qandeel.surface.functional}
        ├─ passage.fill               -> {qandeel.surface.functional}
        ├─ passage.scrim              -> {qandeel.passage.scrim}
        └─ field.fill                 -> {qandeel.surface.functional}
```

**17 tokens. 6 literal values. 11 aliases. One Surface value in the entire architecture.**

Every role fill's chain is exactly three links:

```
qandeel.role.<role>.fill  ->  qandeel.surface.functional  ->  qandeel.expression.surface
```

---

## 2. Why three tiers and not two

Two tiers would have worked for today. Three is what makes the theme capability true rather than
asserted.

With the values in tier 1 and the semantics in tiers 2–3, **a Light appearance replaces tier 1
only.** No Product role is renamed. No component is rewritten. The one-tone rule holds in an
appearance nobody has designed yet, because the four roles never referred to a colour — they
referred to `surface.functional`, which referred to whichever expression was loaded.

There is a shape of this architecture that would have looked identical and been quietly broken: put
the canonical values in the semantic layer and let an appearance set *override* them. Every check
would pass. Resolving into Light would silently return the **dark** values, and the package would
ship a light theme that was secretly dark with nothing anywhere to say so. The three-tier split is
what makes a missing appearance a **build error** instead.

---

## 3. The one-tone invariant is structural, not chromatic

This is the load-bearing idea in the package.

Four tokens each carrying the literal `#181818` resolve to four equal colours. Every value
comparison anyone could write would pass. That is **exactly the duplication the brief forbids** —
"Do NOT duplicate #181818 four times" — and it is indistinguishable from success unless something
keeps the reference chain.

So `tools/b4-dtcg.mjs` `resolve()` returns, for every token, the full chain of paths it travelled,
and **INV-01 is a statement about chains**: four role fills, each an alias, each passing through
`qandeel.surface.functional`, all terminating at one source, and that source being
`qandeel.expression.surface`. The colour identity follows from the structure rather than standing in
for it.

Negative probe **`n1`** is the four-equal-hexes case. It is rejected.

### 3.1 And "what counts as a Surface" had to be fixed

The first definition said: a Surface is a token that resolves to `qandeel.expression.surface`. That
is circular, and probe **`n2`** proved it — `n2` adds a *second* Surface value under a new name and
points a Product role at it. Under the first definition the newcomer resolved to a different source,
so it was not "a Surface", so the rules that count Surface values never saw it. **The system would
have had two tones and the invariant that exists to forbid a second tone would have reported one.**

The definition now in force is by **use**: a Surface is whatever a Product Surface role is painted
with, together with everything on the way there. Nothing can enter the system without being counted,
because the only way to enter the system is to be painted by a role.

---

## 4. Naming

Names describe **role and meaning**. There is no ladder, no numbered scale, no lightness word and no
elevation word anywhere in the tree.

**Approved families, as a closed list:** `expression`, `world`, `surface`, `content`, `passage`,
`role`. A new top-level group is a B-track decision; `APPROVED_FAMILIES` in
`tools/b4-invariants.mjs` is where it would have to be made, and V-08 rejects anything else.

**Forbidden in any token path**, enforced by word rather than by whole segment:

| forbidden | rule | why |
|---|---|---|
| `elevation`, `elevated`, `tonal`, `raised`, `sunken`, `level`, `layer`, `step`, `tier`, `depth`, `high`, `low`, `lowest`, `highest`, `dim`, `bright`, `nested`, `overlay`, `z`, `zindex` | INV-07, INV-10 | A ladder is a set of names for distinctions QANDEEL does not have — and the names would invite the distinctions. |
| `accent`, `brand`, `tint`, `hue`, `chroma`, `saturation` | INV-09 | No brand colour controls the Surface. |
| `confidence`, `evidence`, `importance`, `recency`, `far`, `mid`, `near` | INV-08 | SG-1: a Surface asserts nothing about the analysis inside it. |
| `dark`, `light`, `night`, `day`, `contrast` — outside `qandeel.expression.*` | INV-12 | An appearance hard-coded into an appearance-independent name is what forces a component rewrite later. |

### 4.1 Word matching, not segment matching — a probe found the hole

These scans originally compared whole path segments, and probe **`n8`** walked straight through:
`surface.functionalDark` hard-codes an appearance into an appearance-independent name, which is
precisely what INV-12 exists to catch, and INV-12 did not fire, because `'functionaldark'` is not
equal to `'dark'`. Another invariant caught the probe for an unrelated reason and the suite would
have reported a pass.

Segments are now split into words on camel-case humps and separators. It catches `functionalDark`
while staying narrower than a substring test — `highlight` is one word and does not contain `light`
under this rule — so the scan buys its precision without an exemption list.

---

## 5. What ships, file by file

| file | role | tokens |
|---|---|---|
| `tokens/qandeel-surface.tokens.json` | **The deliverable.** Semantic layer + dark expression, merged. Self-contained and fully resolvable. | 17 |
| `tokens/base/semantic.tokens.json` | Appearance-independent: tiers 2 and 3. Holds **zero** colour values and resolves to nothing on its own. | 11 |
| `tokens/appearance/dark.tokens.json` | The canonical dark expression. | 6 |
| `tokens/appearance/light.tokens.json` | **Deliberately empty.** See §6. | 0 |
| `tokens/contrast/standard.tokens.json` | Deliberately empty; the standard contrast context overrides nothing, and saying so with a set is clearer than an absent one. | 0 |
| `tokens/contrast/increased.tokens.json` | **Deliberately empty.** Owned by I-08B3.1-F. | 0 |
| `tokens/qandeel-surface.resolver.json` | DTCG Resolver 2025.10 manifest: 1 set, 2 modifiers, 4 representable combinations. **Corrected in I-08B3.1-B4R** — see §5.2. | — |
| `schemas/2025.10/**` + `PROVENANCE.json` | **Added in I-08B3.1-B4R.** The official DTCG 2025.10 JSON Schemas, vendored with provenance so conformance can be checked offline against an authority this package did not author. | 22 files |

Check **V-10** proves the deliverable is not a separate document that merely agrees: merging
`base/semantic` + `appearance/dark` reproduces `qandeel-surface.tokens.json` byte for byte.

### 5.2 The resolver document, corrected — I-08B3.1-B4R

An independent freeze review found the resolver document **non-conformant to the published 2025.10
Resolver Module**. B4 wrote `sets` and `modifiers` as arrays of named objects and `resolutionOrder`
as `{ type, name }` pairs. The specification declares `sets` as `Map[string, Set]` and `modifiers` as
`Map[string, Modifier]`, and references a root-declared member from `resolutionOrder` with a
**reference object**:

```json
{
  "sets": { "semantic": { "sources": [{ "$ref": "./base/semantic.tokens.json" }] } },
  "modifiers": {
    "appearance": { "default": "dark", "contexts": { "dark": [ … ], "light": [ … ] } },
    "contrast":   { "default": "standard", "contexts": { "standard": [ … ], "increased": [ … ] } }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/semantic" },
    { "$ref": "#/modifiers/appearance" },
    { "$ref": "#/modifiers/contrast" }
  ]
}
```

The `{ type, name }` form is real, but it belongs to a set or modifier declared **inline** in
`resolutionOrder`, where `name` and `type` are added *on top of* the body (`sources` / `contexts`).
B4 wrote the marker keys with neither the body nor a reference — a shape that is neither. The
official schema rejects the shipped document in **17 places**.

**Nothing about the token values changed.** The resolver says how sets *compose*; it holds no colour.
All six token files, including the canonical deliverable, are **byte-identical to B4** — and so are
all 14 integration rasters. Full account in `B4R_REVISION_RECORD.md`, conformance evidence in
`B4R_SCHEMA_CONFORMANCE.md`.

### 5.1 The values are derived, not transcribed

`tools/b4-tokens.mjs` imports `WORLD`, `PRIMARY`, `SECONDARY`, `TERTIARY`, `SURFACE` and
`SCRIM_BASELINE` **from the sealed I-08B3.1-B3R package**. No canonical value is typed in this
package. A transcription can drift by one hex digit and still look right in a document; a derivation
cannot drift at all, and if the sealed package moved, this file would stop building.

Components are computed from the sealed hex and the hex is recomputed from the components; the
generator **refuses to write the file if they disagree**. The Color Module makes `components`
normative and `hex` an optional fallback, so a disagreement would make a conforming reader and a
legacy reader paint different colours with nothing in the JSON looking wrong.

---

## 6. Theme capability, and the unresolved appearances

QANDEEL is **DARK-LED, NOT DARK-LOCKED.**

`tokens/appearance/light.tokens.json` is a valid DTCG document that declares the group and **not one
token**. That is the mechanism, not a placeholder.

Resolve the semantic layer against it and **all 11 semantic and role tokens come back
`UNRESOLVED`**, each naming the exact expression token it wanted — six of them:
`qandeel.expression.world`, `.surface`, `.content.primary`, `.content.secondary`, `.content.tertiary`,
`.scrim`. That is check **V-09**, and it is the load-bearing check of the whole theme-capability
claim.

> An unresolved reference is an error a build system stops on.
> An invented colour is a decision nobody made, shipped silently.

Probe **`v-n6`** is a *plausible* invented Light Surface — `#f7f7f7`, exactly what a reasonable
person would write. It is plausible on purpose: an implausible probe would only prove the check can
reject something obviously wrong. It is rejected.

The same applies to increased contrast, with one difference recorded in `B4_REFERENCE_GATE.md` §3:
increased contrast is an **override within** an appearance, not a third appearance, which is why the
resolver carries two modifiers rather than one.

---

## 7. What this architecture deliberately does not contain

- **No Light value**, and none may be invented. I-08B3.1-F.
- **No Class S colour.** The boundary's *rules* are frozen in `B4_CANONICAL_SURFACE_SPEC.md`; its
  colour belongs to I-08B3.1-E/F. There is **no general border token**.
- **No focus token.** SC 2.4.13 is an area criterion and the final indicator is E/F's.
- **No interaction or status colours.** I-08B3.1-E.
- **No radius, no shadow, no elevation.** Corner radius is component/context-specific; corner radius
  is not personality.
- **No Living Brass** (C), **no QANDEEL Light** (D).
- **No component tokens.** The DTCG naming guidance describes a component tier; QANDEEL has no
  components yet, and inventing their tokens now would freeze an architecture nobody has built.
