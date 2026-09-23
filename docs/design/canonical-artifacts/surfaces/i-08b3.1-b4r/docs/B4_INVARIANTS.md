# B4_INVARIANTS

**I-08B3.1-B4.5 and B4.8.** The frozen contract as executable tests.

Two suites:

- **INV-01 … INV-12** — the twelve production invariants, over the shipped token file.
  `tools/b4-invariants.mjs`.
- **C1 … C5** — the anti-cardification guard, over computed style in a rendered composition.
  `tools/b4-cardguard.mjs`.

Results: `B4_VALIDATION_RESULTS.md`. Machine-readable: `.i08b31-b4-work/invariants.json`,
`cardguard.json`.

---

## 0. Why every rule here has a probe

**Twelve invariants that pass prove nothing until something fails.** Every one of them would pass on
a file with no tokens in it.

So each invariant is also fired at a deliberately broken document built for it, and the suite fails
if the invariant does not reject its probe. The probes are not stylised. `n1` is the four-equal-hexes
duplication the brief names; `n2` is a second Surface arriving the way one actually arrives — someone
needing "the one that sits on top"; `n9` is a brand accent quietly taking control; `n12` is Material
3's mechanism arriving as metadata with no name change and no value change.

**Collateral is recorded, not hidden.** These rules overlap on purpose, so a probe usually trips more
than its target. Each probe names which extra rejections are expected and why. An **unexpected**
extra rejection is a finding about the rules and is printed as one — and three of them turned out to
be exactly that (§3).

The anti-cardification guard goes one better: its violating fixtures are **the sealed predecessor's
own cardification failure captures**, rendered through the sealed stylesheet with the sealed
switches. A guard that rejects markup written to be rejected proves the rule parses. A guard that
rejects the previous release's own recorded failures proves the rule is about QANDEEL.

---

## 1. The twelve production invariants

| # | invariant | how it is tested | probe |
|---|---|---|---|
| **INV-01** | All four Surface roles alias **one** Surface source token | four role fills exist, all `RESOLVED`, none a literal, every chain passes through `qandeel.surface.functional`, the set of terminal sources has size **1**, and that source is `qandeel.expression.surface` | `n2` |
| **INV-02** | No role-specific Surface hex exists | no token under `qandeel.role` carries a non-alias `$value` | `n1` |
| **INV-03** | No retired Surface value in the output | every `tokens/**.json` scanned for six retired/forbidden values, needles assembled from halves at runtime; plus the positive requirement that the canonical value appears exactly **once** | `n7` |
| **INV-04** | No chromatic Surface token | r = g = b for every Surface-family token and the scrim | `n3` |
| **INV-05** | No darker-than-World Surface token | relative luminance of every Surface token strictly above the World's | `n4` |
| **INV-06** | PASSAGE has a scrim token; ASIDE does not | `role.passage.scrim` exists; **no** scrim on APPARATUS, ASIDE or FIELD; exactly one in the role layer | `n5` |
| **INV-07** | Nesting adds no Surface tone | exactly **one** literal value in the Surface family, and no token path encodes a level, step, tier or depth | `n11` |
| **INV-08** | Surface fill encodes no analytical property | positive: every Surface/role token carries a `$description`. absence: no token **path** and no `$extensions` value contains confidence, evidence, importance, recency, far, mid or near | `n10` |
| **INV-09** | No generic brand accent controls the Surface | no accent/brand vocabulary in any path; the Surface source is a **literal** nothing aliases into; no unapproved token family | `n9` |
| **INV-10** | No elevation function derives a Surface from z-order | no z-order vocabulary; no colour-deriving expression in any `$extensions`; exactly one literal Surface value — a function would have a domain and no range | `n12` |
| **INV-11** | Reduce Transparency does not alter the Surface truth | every Surface token alpha 1; every alpha-bearing token resolves to the **scrim source** | `n6` |
| **INV-12** | Theme switching changes expression, not names | no appearance word in any appearance-independent path; the semantic set holds **zero** literal values and resolves to **nothing** on its own | `n8` |

**Coverage: 12 of 12 invariants have a dedicated probe.** The suite fails if any does not.

---

## 2. The anti-cardification guard

Runs on **computed style**, not source text. The eight failures B4.8 names are failures of *result*:
"every section boxed" is not a string anybody types, it is what a screen turns out to be after twelve
reasonable-looking commits. A grep for `background:` would catch the World and miss a card assembled
from a shared style object, which is how cardification actually arrives.

| # | rule | covers |
|---|---|---|
| **C1** | No shadow expresses rank — no `box-shadow` outside the diagnostic focus indicator | *shadow/elevation used as analytical rank* |
| **C2** | No unroled fill inside a plane | *analytical nodes inside cards*; *every section boxed* |
| **C3** | At most one Surface tone per frame | *multiple same-purpose Surface levels*; *Surface brightness used as importance* |
| **C4** | No fill outside a plane that is not a frozen role | *nested panels for hierarchy* |
| **C5** | No Surface that holds nothing — no text and no focusable descendant | *cards created for organisation*; *Surface token used because it exists* |

All eight named failures are covered by five measurable rules. Some of the brief's eight are not
statically decidable at all — *"Surface token used because it exists"* is a statement about intent —
and C5 approximates it by the one measurable consequence: an empty container. The remainder are
questions for `B4_SURFACE_EARNING_TEST.md` in review, which is where a human is required and the
guard says so instead of pretending.

---

## 3. What the probes found — three corrections to the rules themselves

These are recorded because in each case the *rule* was wrong and the probe was right. Rules were
fixed; expectations were not adjusted to match.

**3.1 `n8` walked through INV-12.** The scans compared whole path segments, so
`surface.functionalDark` — an appearance hard-coded into an appearance-independent name, precisely
what INV-12 exists to catch — did not match, because `'functionaldark'` is not `'dark'`. INV-01
caught the probe for an unrelated reason and the suite would have reported a pass. Segments are now
split into **words** on camel-case humps and separators, which catches it while staying narrower than
a substring test: `highlight` is one word and does not contain `light`, so the scan buys precision
without an exemption list.

**3.2 `n2` proved the Surface family was defined circularly.** The family was "tokens that resolve to
`qandeel.expression.surface`". `n2` adds a second Surface under a new name and points a role at it;
the newcomer resolved to a different source, so it was not "a Surface", so the rules that count
Surface values never saw it. **The system would have had two tones and the invariant forbidding a
second tone would have reported one.** A Surface is now defined by **use** — whatever a Product
Surface role is painted with, plus everything on the way there — so nothing can enter the system
without being counted.

**3.3 `n5` showed INV-11 was keyed on an allowlist.** Its second clause listed three token paths
allowed to carry alpha. `n5` adds `role.aside.scrim`, which INV-06 correctly rejects — and INV-11
rejected it too, for the wrong reason, and would have rejected any future legitimate scrim alias.
It is now keyed on the **source** a token resolves to. This is the same correction B3R's focus ledger
needed: key on the mechanism the thing is made of.

**And one that was not a rule defect.** `n1` also trips INV-07 and INV-10, which was not predicted.
Under the use-based family definition, a role's own literal **is** a second Surface value — equal
today, independently editable tomorrow. The rule is behaving better than the prediction, and the
prediction was corrected rather than the rule.

---

## 4. What the cardification guard found — two more

**4.1 A magic number was adjudicating Arabic copy length.** C5 originally asked whether a Surface
held more than fifteen characters. The N2 composition failed it: a nested scope menu whose four
Arabic labels are nine to fourteen characters each is a perfectly earned ASIDE, and a threshold was
the only thing saying otherwise — in a package whose entire content is short Arabic labels. C5 now
asks the question it meant to ask — **is this container empty** — which needs no threshold.

**4.2 C2 called an earned commit boundary cardification.** The dense Utility screen renders an
editable display name as an inline FIELD inside a settings row. C2 forbade any fill inside any plane
and flagged it. The rule was wrong, not the screen: what a plane may not contain is an **unroled**
fill. C2 now permits a frozen Product role inside a plane and rejects everything else — which still
rejects all four violating fixtures.

---

## 5. Running them

```bash
node tools/b4-tokens.mjs        # build tokens/ from the sealed accepted values
node tools/b4-validate.mjs      # B4.9 - document conformance, 11 checks + 6 probes
node tools/b4-invariants.mjs    # B4.5 - 12 invariants + 12 probes
node tools/b4-cardguard.mjs     # B4.8 - 5 rules, clean corpus + 4 violating fixtures
node tools/b4-integration.mjs   # B4.4 + B4.12 - scrim verification and the paired render
node tools/b4-results.mjs       # regenerate B4_VALIDATION_RESULTS.md from the artefacts
```

Each exits non-zero on any failure, including a probe that fails to be rejected.
