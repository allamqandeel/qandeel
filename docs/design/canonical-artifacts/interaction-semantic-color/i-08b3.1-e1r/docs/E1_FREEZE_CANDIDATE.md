# E1_FREEZE_CANDIDATE

**I-08B3.1-E — INTERACTION + SYSTEM SEMANTIC COLORS.**
**Revised by I-08B3.1-E1R — TARGETED INTERACTION / STATUS CONTRACT CORRECTION.**

**RECOMMENDED READY FOR FINAL INDEPENDENT PRODUCT AND DESIGN FREEZE REVIEW.**
**NOT DECLARED FROZEN. Independent review owns closure.**

---

## 0. What I-08B3.1-E1R changed

**No token value moved.** `#fe907e` and `#696762` are byte-identical to what E1 shipped, as
is every alias. **No accepted expression was redesigned.** Four sentences frozen as Product
contract were corrected, one stylesheet rule was removed, and one state combination that had
been declared impossible now has an expression.

| | what was wrong | what it is now |
|---|---|---|
| **REV-01** | an unavailable control was frozen as never focusable | **DISABLED describes AVAILABILITY**; two named control patterns, visually identical, differing only in focus-order membership |
| **REV-02** | the exclusivity rule about visual channels was **false** — two states write the ink | the **composition / ownership model**: three owned channels, one shared and resolved by precedence, one override, all sixteen combinations enumerated |
| **REV-03** | the **number** of status hues was frozen as a cap on the evidence of one role | **STATUS COLOUR IS EARNED**; ERROR currently owns the only hue; the others have an overturn condition and a Product-evidence route |
| **Brass** | a universal navigation and entitlement law with no canonical authority behind it | **LIVING BRASS IS STATE-INVARIANT in value and in appearance**; E1R supplies no unavailable expression for a Brass-bearing object and hands the question up |

The withdrawn wording, with what was wrong with each, is in `E1R_REVISION_RECORD.md` — the
one document permitted to quote it.

---

## 1. The candidate, in full

### The grammar

```
BRASS IS MATTER.               (frozen, I-08B3.1-C3)
LIGHT IS MEANING.              (freeze candidate, I-08B3.1-D2R)
ACTIVITY IS PROCESS.           (frozen, and it has no visual expression)
STATE IS THE USER'S POSITION.  ← E1
STATUS IS WHAT NEEDS ATTENTION. ← E1
```

### The five interaction states, and the channels they write

| | channel | attachment |
|---|---|---|
| REST | — | the absence of state |
| PRESSED | the ground | transient, on pointer-down |
| FOCUS | a perimeter, detached by a gap | outside the control |
| SELECTED | a marker on the anchored edge, the type weight, **and the ink** | attached to the control |
| DISABLED | availability, **and the ink** — which is the shared channel | an override on the control as a unit |

Resolved by three precedence rules. **All sixteen combinations carry a verdict**: nine
reachable, four unreachable (all four because availability suppresses the press response),
three conditional on the control pattern or the control type.

### The four status roles, and the one hue earned so far

| | classification | resolves to | overturn condition |
|---|---|---|---|
| ERROR | **dedicated hue, earned** | `#fe907e` | — |
| WARNING | has not earned a hue | the primary reading ink | **met once** |
| SUCCESS | has not earned a hue | the primary reading ink | **met once** |
| INFORMATIONAL | has not earned a hue | the secondary reading ink | not met |

### The two values E1 adds

```
qandeel.expression.status.error    #fe907e   oklch(0.7675 0.1370 29.98)
qandeel.expression.state.disabled  #696762   oklch(0.5151 0.0080 93.14)
```

The first is the one colour. The second is the frozen reading ramp extended by its own
rung — not a status colour, and not an opacity.

---

## 2. The evidence

| | |
|---|---|
| checks | **32 / 32** |
| negative probes fired | **32 / 32** |
| behavioural obligations, real key events | **15 / 15** |
| behavioural probes fired | **5 / 5** |
| dichromacy model property tests | **26 / 26** |
| proof boards | **15** |
| inherited artefacts vendored exact-byte and re-verified | **16** |
| Skill Gate | **PASS**, 85 files inventoried and hashed, 5 USED with a named consequence each |
| Reference Gate | **8 sources** at I-08B3.1-E1, **+2** read at their URLs for I-08B3.1-E1R, and one first-party source that could not be reached — recorded as a limitation rather than paraphrased |
| cross-artefact consistency | **10 / 10 withdrawn claims absent, 10 / 10 probes fired** — and the guard named four stale surfaces during this revision, including the shipping token file, where the revision record had quoted the withdrawn sentences verbatim |

Layer A of the check suite is pure Node and runs from a bare extraction with no project
root, no siblings and no browser. **The claims that matter most survive the barest
environment.**

---

## 3. The success conditions, answered

| the brief's condition | answer |
|---|---|
| 1. Interaction states are semantically distinct | Yes — three owned channels, one shared and resolved by precedence, and sixteen combinations each with a verdict. `b01`, `b02`, `b17` |
| 2. Focus and Selection are clearly different | Yes — detached versus attached, and they compose. `b04`, and a magnification of the raster shows two objects with ground between them |
| 3. Pressed and Selection are clearly different | Yes — the ground versus the object; a press leaves no residue. `b05` |
| 4. Disabled is clear without needless colour | Yes — the reading ramp extended by its own rung, plus channels that are not paint. And since E1R, availability is separated from focusability: two patterns, visually identical. `b15`, checks R09, R26, R31 |
| 5. Functional roles exist only where QANDEEL needs them | Four roles kept, one with a hue, each refusal with a falsifiable condition **and a bounded audit against eight real Product categories**. Material 3 independently ships the same shape |
| 6. Critical meaning does not depend on colour alone | Yes, and here it is measured: the lightness escape route WCAG offers reaches 1.03:1 and is unavailable |
| 7. Error is immediately understandable | 8.61:1 on the World; the most chromatic value in the system by 2.6×; a crossed-circle glyph; copy that names the failure and the remedy |
| 8. Living Brass retains identity scarcity | Yes — R01 walks every hop of every chain, and since E1R **R30 parses the shipping stylesheet** and rejects any rule that paints a Brass-bearing element under a state selector. That check found a rule E1 had shipped for two packages |
| 9. QANDEEL Light retains meaning-emergence exclusivity | Yes — R01 by prefix, and the deeper separation is behavioural: Light has a lifecycle and nothing in E1 does |
| 10. The dark Product remains visually authored | `b10` is the board to judge this on. E1 adds one colour and spends the rest on form |
| 11. It works in real QANDEEL UI, not swatches | Every board is real UI. Where a chip appears it is beside the control that carries it |
| 12. Accessibility baseline is credible | Two WCAG criteria addressed separately and correctly, dichromacy as a derivation floor, a behavioural focus proof that caught a real defect, and the limits stated |
| 13. Implementation boundaries are clear | `E1_IMPLEMENTATION_BOUNDARIES.md`, and every token carries its freeze class |
| 14. No major question remains unresolved | The remaining questions are Product-Owner and navigation-contract questions, listed in `E1R_REVISION_RECORD.md` §6 and `E1_REVIEW_BOARD.md` §6. **E1R increased that list on purpose**: three of the questions were previously "answered" by absolutes this package had no authority to state |

---

## 4. The failure conditions, answered

| | |
|---|---|
| Living Brass becomes the universal accent | No. R01, every hop, with a probe |
| Meaning Light reused as Focus / Selected / Success | No. R01 by prefix, with a probe |
| every state gets a new hue by habit | No. **Interaction state introduces no colour at all** — R02 |
| Success is green because convention says so | No. Success has no colour, and the condition that would overturn that is written into the token |
| Warning is orange because convention says so | No — and the refusal is partly a *measurement*: an amber sits inside the 19.4° band QANDEEL already occupies |
| Info is blue because convention says so | No |
| Error relies on colour alone | No, and the alternative WCAG offers was measured and found closed |
| Focus is subtle but invisible | No. 12.95:1 change-of-contrast, 13/13 adjacency coverage, and 15/15 behavioural obligations |
| Selected and Focus indistinguishable | No. `b04` |
| Pressed and Selected indistinguishable | No. `b05` |
| Selected and Selected-but-unavailable indistinguishable | No, and it is measured off the computed style: two channels against plain unavailable, one against plain selected, plus the reason sentence. `b17` |
| Disabled unreadable | No. 3.14:1 on the Surface, better than the retired diagnostic carrier's 2.57:1, plus channels that are not paint |
| Disabled undiscoverable | **This was a real defect and E1R fixed it.** E1 froze that an unavailable control is never focusable, which hides it from exactly the users least able to find it another way |
| dark semantics are inverted light colours | No. Every floor is a statement about a near-black ground, and the light appearance is deliberately empty |
| traffic-light UI | No. One hue, and the prohibition on a generic traffic-light palette is the part E1R kept frozen |
| visually sterile | The board to judge it on is `b10`. §9 of `E1_KNOWN_LIMITATIONS.md` records the strongest argument against |
| the Owner asked to choose microscopic values | No. `E1_REVIEW_BOARD.md` §7 |
| arbitrary craft numbers over-frozen | No. 13 product-contract tokens, 7 production-default, `classify()` throws on anything unclassified |
| **Product law over-frozen** | **This was the E1 defect E1R exists to fix.** Three of the four corrected statements were rulings about navigation, entitlement or future Product need that a colour package had no authority to make |
| Phase F or full Motion pulled in | No |
| Skill Gate performative | No — 5 USED rows, each with the principle read and a decision that would have been different |
| Reference Gate missing | No — 8 sources at E1, 2 more at E1R, one of them **argues against E1** and is recorded as such, and one first-party source could not be reached and is recorded as a limitation rather than paraphrased |
| final evidence is colour chips | No — 15 boards of real UI |

---

## 5. What independent review should attack first

1. **The two overturn conditions the audit found MET** (`E1R_PRODUCT_SURFACE_AUDIT.md`
   §3.7, §3.8). E1R declines to answer either with a hue and gives its reasons. Both are
   Product decisions and both can go the other way.
2. **The red family** (`E1_KNOWN_LIMITATIONS.md` §2) — the one convention kept, in an
   Arabic-native product, with a first-party source flagging cultural colour meaning. The
   value itself is Product-Owner approved; the *family* is still the open question.
3. **The warning expression** — a promoted boundary, a triangle and a sentence. Is that
   enough weight for publishing a world publicly?
4. **The DISCOVERABLE UNAVAILABLE pattern on React Native** (`E1_REACT_NATIVE_MAPPING.md`
   D-E1-6). The web half is proved under real keys; the native half is specified and
   untested, and it is the largest unverified claim the revision adds.
5. **Where SELECTED + UNAVAILABLE is reachable.** E1R rules it at four control types and
   leaves one — a list row that is the current destination — explicitly Product-owned.
6. **The correction to two frozen documents** (`E1_DISABLED_COLLISION_RESOLUTION.md` §1) —
   no value moves, but two sealed packages contain a sentence that is measurably wrong.
7. **Whether E1 owes more identity than it delivered.** C3 reported the Life Test
   INCOMPLETE and named D, E and the motion / navigation-form work as owing it. E1's answer
   is that a status system is the wrong place to pay that debt, and that adding hue here
   would have cost the separations this package exists to hold. That answer can be rejected.

---

## 6. Status

```
I-08B3.1-E1 — INTERACTION + SYSTEM SEMANTIC COLORS
I-08B3.1-E1R — TARGETED INTERACTION / STATUS CONTRACT CORRECTION
RECOMMENDED READY FOR FINAL INDEPENDENT FREEZE REVIEW
NOT FROZEN · NOTHING DECLARED CANONICAL · NO STOP CONDITION MET
```

The executor does not declare this frozen. Independent Product and Design review owns
closure.

**One thing a reviewer should weigh before closure.** This revision made the package's
claims **weaker and its checks stronger**. Three absolutes were withdrawn, the open-question
list grew, and two of the status refusals now carry a named real case against them. That is
the correct direction — but it means the package now says less about the Product's future
than it did, and a reviewer who wanted those questions settled here will find them handed
back. They were not settled before; they were asserted.
