# I-08B3.1-B4R — SURFACE SYSTEM: PRODUCTION SPECIFICATION + DTCG RESOLVER CONFORMANCE

**Status: DTCG RESOLVER CONFORMANCE COMPLETE / READY FOR FINAL DESIGN DIRECTOR FREEZE /
NOT YET FROZEN.**

B0, B1, B2, B3 and B3R are closed. **B4 searched for nothing.** It converts accepted evidence into a
production-ready, theme-capable, mechanically enforceable Surface system.

> **This package is B4 with the independent freeze review's two corrections applied.** The review
> passed B4's Product, visual and token conclusions and raised one standards blocker and one API-scope
> correction:
>
> - **B4R-REV-01** — the resolver document was **not conformant** to the published DTCG 2025.10
>   Resolver Module: `sets` and `modifiers` are **maps**, and `resolutionOrder` names a root-declared
>   member with a **reference object**. Corrected, and now enforced against the **official JSON
>   Schema**, vendored with provenance and run through **ajv** — a validator this package did not
>   author. Read **`B4R_SCHEMA_CONFORMANCE.md`**.
> - **B4R-REV-02** — `Modal.onRequestClose` was described as "the platform's Escape". It is not.
>   Narrowed to the dismissal paths React Native documents, with the B3R product obligation intact.
>
> **No Surface decision was reopened and no Product value changed.** All six token files and all
> fourteen rasters are **byte-identical to B4**. Full account: **`B4R_REVISION_RECORD.md`**.

---

## What B4 concluded, in six lines

1. **`#181818` can be represented as one shared semantic token**, and the one-tone rule is
   **structural**: `#181818` exists exactly once in the architecture, and four Product roles reach it
   through alias chains rather than through four equal copies.
2. **The selected 50 % neutral-black scrim passes**, with five of five measurements landing exactly
   on predictions computed before the render.
3. **The production token file reproduces the accepted B3 appearance exactly** — seven compositions,
   rendered through the sealed predecessor's own stylesheet, **byte-identical, 0 pixels differing**.
4. **No Light value was invented**, and the absence is *detectable*: resolving into Light leaves all
   eleven semantic tokens unresolved and names what is missing.
5. **Twelve production invariants and five anti-cardification rules pass**, and every one of them has
   been seen to reject something.
6. **No stop condition was triggered, and no A or B conclusion reverses.**

---

## Read in this order

| # | document | what it answers |
|---|---|---|
| 1 | **`B4_CANONICAL_SURFACE_SPEC.md`** | What would be frozen. The values, the one-tone rule, Class S, Class O, shadow, radius. |
| 2 | **`B4_TOKEN_ARCHITECTURE.md`** | The three-tier token model and how theme capability is built in. |
| 3 | **`B4_SURFACE_ROLE_CONTRACTS.md`** | One production contract per role. Usable in review. |
| 4 | **`B4_SURFACE_EARNING_TEST.md`** | May a Surface exist here. Short on purpose. |
| 5 | **`B4_VALIDATION_RESULTS.md`** | Every measurement, machine-generated from the artefacts. |
| 6 | **`B4_INVARIANTS.md`** | The rules as tests — and the five places a probe proved a rule wrong. |
| 7 | **`B4_PROOF_TO_PRODUCTION_MAP.md`** | Every diagnostic from B0–B3R classified, so none leaks. |
| 8 | **`B4_REACT_NATIVE_MAPPING.md`** | How tokens should be consumed. Builds nothing. |
| 9 | **`B4_REFERENCE_GATE.md`** | Primary sources, what was unreachable, and what is NOT inherited. |
| 10 | **`B4_SKILL_GATE.md`** | 86 skills enumerated, 3 used, 13 zero-return probes. |
| 11 | **`B4_FREEZE_RECORD.md`** | The freeze candidate, and the boundary of B's authority. |
| 12 | **`B4R_REVISION_RECORD.md`** | **What the independent review found, why, and what changed.** |
| 13 | **`B4R_SCHEMA_CONFORMANCE.md`** | Official DTCG schema validation, machine-generated. |
| 14 | `B4_SKILL_INVENTORY.md`, `B4_MANIFEST.md` | Machine-generated inventories. |

---

## The three things worth a reviewer's attention

**1. The one-tone invariant is a statement about chains, not colours.**
Four tokens each holding the literal `#181818` resolve to four equal colours. Every value comparison
anyone could write would pass. That is precisely the duplication the brief forbids, and it is
indistinguishable from success unless something keeps the reference chain. So `tools/b4-dtcg.mjs`
keeps chains, and negative probe `n1` is exactly that case. It is rejected.

**2. A missing theme is a build error; an invented one is silent.**
The canonical values live in an appearance layer that the semantic layer aliases *into*. Resolve
against the empty Light set and all eleven semantic tokens come back `UNRESOLVED`, naming the six
expression tokens they wanted. There is a shape of this architecture that would have looked identical
and silently returned the dark values for a light theme; the three-tier split is what makes the
difference. Probe `v-n6` is a *plausible* invented Light Surface — `#f7f7f7` — and it is rejected.

**3. Five rules in this package were wrong, and their own probes found them.**
`n8` walked through INV-12 because whole-segment matching does not see `functionalDark`. `n2` proved
the definition of "Surface" was circular — a second tone could have entered the system without being
counted. `n5` showed INV-11 was keyed on an allowlist instead of a mechanism. The cardification
guard's C5 was adjudicating Arabic copy length with a magic number, and its C2 called an earned
commit boundary cardification. In every case the rule was corrected, not the expectation.
`B4_INVARIANTS.md` §3–§4.

---

## What is in the package

```
docs/     15 documents (3 machine-generated)
tokens/   qandeel-surface.tokens.json  <- the deliverable
          qandeel-surface.resolver.json
          base/semantic.tokens.json
          appearance/{dark,light}.tokens.json
          contrast/{standard,increased}.tokens.json
schemas/  2025.10/  the OFFICIAL DTCG schemas, vendored - 22 files + PROVENANCE.json   [B4R]
tools/    b4-dtcg.mjs        DTCG 2025.10 parser, alias resolver, validator
          b4-tokens.mjs      authors every token file; imports values from the sealed B3R package
          b4-validate.mjs    B4.9  - 11 checks, 11 probes  (custom QANDEEL rules)
          b4r-schema.mjs     OFFICIAL schema validation via ajv - 5 checks, 6 probes      [B4R]
          b4-invariants.mjs  B4.5  - 12 invariants, 12 probes
          b4-cardguard.mjs   B4.8  - 5 rules over computed style
          b4-render.mjs      the renderer, pointed at B4R's own work directory
          b4-integration.mjs B4.4 + B4.12 - scrim verification, paired render
          b4-results.mjs     generates the two results documents from the artefacts
          b4-skills.mjs      skill gate inventory
          b4-manifest.mjs    reconciles every shipped file against the tool that made it
          b4r-package.ps1    the packager                                                 [B4R]
review/   integration/  14 PNGs - seven compositions, two variants each
```

**Conformance is settled by two validators that partition the specification**, not by one that
duplicates the other. The official schema owns syntax; `V-11` owns the obligations the schema states
in its own `$comment` that JSON Schema cannot express — a `default` that names a missing context, and
a `$ref` that lands on nothing. Two of the six probes are **accepted by the official schema and
rejected only by V-11**, which is why deleting the custom checker in favour of "the real thing" would
have been a downgrade disguised as rigour.

---

## Provenance, and why nothing here re-types a value

`tools/b4-tokens.mjs` imports `WORLD`, `PRIMARY`, `SECONDARY`, `TERTIARY`, `SURFACE` and
`SCRIM_BASELINE` **from the sealed I-08B3.1-B3R package on disk**. `tools/b4-integration.mjs` renders
through the sealed package's own product stylesheet and environments. `tools/b4-cardguard.mjs` fires
its rules at the sealed package's own cardification failure captures.

**Nothing in B4 writes into a predecessor**, including its work directory. The predecessors are the
reference set every "nothing changed" claim is measured against, and the cheapest way to keep that
claim honest is never to write anything near them. All eight predecessor archives are re-hashed at
packaging time and must be byte-unchanged.

---

## Reproducing

```bash
node tools/b4-tokens.mjs
node tools/b4-validate.mjs
node tools/b4-invariants.mjs
node tools/b4-cardguard.mjs
node tools/b4-integration.mjs
node tools/b4-skills.mjs
node tools/b4-results.mjs
node tools/b4-manifest.mjs
```

Requires Node 24, headless Chrome at the path in `b4-render.mjs`, and the sealed
`I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/` beside this package. Every tool exits
non-zero on any failure, **including a probe that fails to be rejected**.

---

## What B4 does not do

No Light values. No Class S colour. No focus token. No interaction or status colours. No radius, no
shadow, no elevation. No Living Brass, no QANDEEL Light. No components. No second Surface tone, and
no search for one.
