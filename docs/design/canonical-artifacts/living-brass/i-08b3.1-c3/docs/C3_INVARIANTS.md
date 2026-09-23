# C3_INVARIANTS

**I-08B3.1-C3.11.** The machine-testable rules, what each one is really guarding, and the corruption
that must make it fire.

Results — pass/fail, probe fired or not, and what each check found — are in
`C3_VALIDATION_RESULTS.md` §1, generated from the run. This document explains the rules.

---

## 1. An invariant here is a PAIR

```
check(package)  →  must PASS on the real package
probe(package)  →  returns a deliberately corrupted package on which check MUST FAIL
```

**A green row means two things were observed, not one:** that the package satisfies the rule, and that
the checker can tell when a package does not. An invariant whose probe passes is reported as a
**failure of the invariant** — because a guard that cannot fire is a sentence.

### 1.1 Why this is not optional here

I-08B3.1-C1 shipped nineteen checks, nineteen green, each with a paragraph explaining what it
protected. Two were decorative: one compared a constant with itself under a comment claiming it asked
the builder, and one described itself as a complete colour audit while scanning a notation that
excluded half the colours in the package. **Neither was found by reading the documents**, which
described the intended behaviour perfectly well. Both were found by reading the code against the
documents.

C2 went further and fed every guard an input that had to make it throw. C3 does the same for all
twenty-one.

### 1.2 The probes are the mistakes someone would actually make

Not nonsense. The hex pasted into a component token. A `selected` sibling of the navigation family. A
second body called `onSurface`, tuned for the Surface. A 60 % rung. The character tone stored as a
colour. The dark body copied into light because it looks fine. The material renamed to `accent`. The
body darkened *"so it stops looking like gold"* — the one move C2 was forbidden to make.

A probe nobody would write proves the checker rejects things nobody would write.

---

## 2. The twenty-one

### The brief's minimum, I-01 to I-15

| | Rule | What it is really guarding |
|---|---|---|
| **I-01** | exactly one dark Living Brass body literal exists | a second copy is indistinguishable by eye and completely different in kind: it can be changed without changing the material |
| **I-02** | identity aliases resolve to the one body | a semantic name that resolves elsewhere is a name that lies |
| **I-03** | navigation machinery resolves to the body **through `identity.material`** | the subtler failure: a navigation token that reaches Brass by its own route is no longer the same material story, and would survive any check that only compared colours |
| **I-04** | no state token resolves to the material; `qandeel.state` is empty | the failure is not a token called "selected" — it is a *sibling* of the navigation family, which is what gets added the afternoon a designer asks for a highlight |
| **I-05** | no status token aliases the material; `qandeel.status` is empty | Brass is forbidden as a status code. The namespace is reserved so this check has a surface to guard |
| **I-06** | no analytical token resolves to the material | the prohibition that has survived unchanged since C0 |
| **I-07** | no text or content token resolves to the material | **BRASS NEVER SETS TYPE.** A reading ramp with a warm member is a ramp whose rungs no longer mean only rank |
| **I-08** | no border, divider, rule or outline token resolves to the material | **BRASS NEVER ENCLOSES.** The fastest route from material identity to luxury relabel |
| **I-09** | no Brass opacity ladder | the most respectable-looking way to build four more Brasses without ever authoring a second hex — every rung is "the same colour" |
| **I-10** | no Brass lightness or chroma ladder; the character tone is derived | a two-value ladder is how a five-value ladder starts |
| **I-11** | retired bodies appear nowhere except the retirement record | a retired value that survives anywhere is one that can be resurrected by deleting a comment |
| **I-12** | no second Living Brass body under any name | I-01 counts *copies*; this counts **neighbours**. A `brass-on-surface` at a slightly different value passes a duplicate check and is still a second material |
| **I-13** | no Light appearance value is invented; light resolution fails loudly | the difference between dark-**led** and dark-**locked** is exactly this check |
| **I-14** | the QANDEEL Light namespace is reserved, empty and unaliased | the doctrine breaks by *collision*, not by argument: "QANDEEL Light" and "light appearance" share an English word |
| **I-15** | functional control families do not inherit the material | the boundary between P2 and "every icon gold" — and the way it dies is group inheritance |

### Beyond the minimum, I-16 to I-21

| | Rule | Why C3 added it |
|---|---|---|
| **I-16** | the sRGB literal round-trips from the authored OkLCh triple | if the two disagree, the production value and the value every C-stage document describes are different colours — and each is internally consistent, so the disagreement is invisible |
| **I-17** | every inherited file is byte-identical to the sealed package it came from | "vendored" has to mean UNCHANGED, or the freeze C3 claims to extend is a freeze of something else |
| **I-18** | no font binary and no forbidden token name ships | the font is a local runtime dependency, referenced and hashed, never redistributed. The names are the brief's list, each one telling a future reader the wrong thing about what this is |
| **I-19** | the material clears 3:1 on both frozen grounds | under P2 the navigation family is an ESSENTIAL UI COMPONENT VISUAL, so SC 1.4.11 applies. **Re-measured, not cited** — a spec that quotes a number it did not compute cannot notice when the number changes |
| **I-20** | every resolver `$ref` resolves to a file that exists | a resolver that silently drops a set produces a smaller system that still validates |
| **I-21** | the character tone derives from the AUTHORED triple, and the obvious derivation is wrong | asserts **both halves**, so the one-step divergence is a standing measurement rather than a remark that could go stale |

---

## 3. The two thresholds are DERIVED, not chosen

QANDEEL's frozen reading ramp is not perfectly achromatic — a warm-leaning neutral was a deliberate
A-stage decision. So "is this a second Brass?" cannot be answered with a hand-picked chroma cutoff.

**The first version of I-10 and I-12 used one**, at 0.012, and duly reported the frozen reading ramp
as two extra Brass bodies: a true result about the numbers and a false one about the system.

The floor is now computed from the system — halfway between the most chromatic frozen neutral
(C 0.0153) and the body (C 0.0516), giving **C 0.0334**. It cannot be quietly widened to make a future
check pass, and the margin on either side is a reported figure rather than an assurance.

The same discipline applies to the ink floor used in the footprint measurement; see
`C3_VALIDATION_RESULTS.md` §5, where that instrument's two corrections are recorded.

---

## 4. SCOPE — what these invariants do NOT cover

Stated plainly, because C1's colour audit described itself more broadly than it scanned, and that is
the failure mode of a document like this one.

**These are invariants about the TOKEN OUTPUT and the package's inherited sources.** They are not a
claim about any future component tree. A React Native component can hard-code `#a58e6f`, take the
navigator's injected tint, or paint an analytical node warm, and **no check in this package will ever
see it**.

`C3_REACT_NATIVE_MAPPING.md` §7 lists the five checks a component-level guard would have to make, and
says plainly that C3 makes none of them.

Also outside scope:

- **the rendered result.** Byte-identical reproduction (C3.12) is a separate layer with separate
  dependencies, and it proves fidelity of the mapping, not correctness of the design.
- **anything about Light, status, focus or disabled values**, which do not exist to be checked.
- **placement.** No invariant has an opinion about whether the canonical Q should appear on a given
  screen; the material contract grants material.

---

## 5. Three checks that fired during the build, and what was done

Recorded because a check with a failure in its history is a check known to work, and because in each
case the fix could have been an exemption and was not.

**I-09 fired on the package's own token file.** The noise field's coverage map was named
`character.alpha.gain` / `.bias`. The check hunts for an opacity ladder on the material, and a token
called `material…alpha` is exactly what it should stop on. **The name was wrong, not the check** — those
two numbers are the coverage of a noise field, never the opacity of the material. Renamed to
`character.coverage.*`; no exception added.

**I-11 fired on the retirement record.** The first version permitted a retired hex in any string that
also contained the word "retired" — a text heuristic standing in for a structural fact. In the real
record the hex is its own string and "retired" is in a sibling field. The check now locates the
retirement record **structurally**, by path, and rejects every occurrence outside it.

**I-04 reported GUARD-DEAD, and the probe was at fault.** Its first form nested `selected` *inside* the
`machinery` token. In DTCG a token is a leaf, so the nested child was never parsed as a token at all,
the check saw nothing, and reported PASS. **The probe was invalid, not the guard** — but the run could
not tell the difference between "the guard is asleep" and "the corruption was not expressible", which
is exactly why probes are run rather than reasoned about. The corruption is now a sibling, which is
what a real implementation would produce.

---

## 6. Running them

```
node tools/c3-invariants.mjs          # layer A alone — no Chrome, no font, no siblings
node tools/c3-validate.mjs            # all four layers, writes data/
node tools/c3-validate.mjs --no-render   # layers A and B only
node tools/c3-docs.mjs                # regenerates the three data-driven documents
```

Layer A runs in a bare extraction. That is deliberate: **the claims that matter most are the ones that
survive the barest environment.**
