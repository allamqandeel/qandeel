# E1_KNOWN_LIMITATIONS

**I-08B3.1-E1.** What is open, what is weak, and what a reviewer might reasonably reject.
Nothing in this document is softened.

---

## 1. No device has seen one frame

Every measurement is headless Chrome at device-pixel-ratio 2, with LCD antialiasing and
subpixel positioning disabled, on Windows. The error ink, the unavailable ink, the press
wash and the focus indicator have never been rendered by a phone.

Device validation is a **mandatory implementation gate** and it is **not** an E1 freeze
blocker: the semantic contract and the device calibration are different claims, and the
product-contract / production-default split is what lets one close while the other stays
open. But nothing here is a claim about a screen anyone has held.

---

## 2. The red family is the one convention E1 kept, and it is the one thing most likely to
be wrong

Apple's Color guidance warns explicitly: *"red communicates danger in some cultures, but
has positive connotations in other cultures,"* illustrated with red as a **positive** trend
in the Chinese Stocks app. **QANDEEL is Arabic-native.**

E1's position: the illustration is about trend direction in finance, not about failure, and
error-red is well established in Arabic-language software. That is an argument, not
evidence. **No Arabic-speaking user was asked.** If the Product Owner's answer is that red
is wrong here, the derivation runs again with a different declared family and produces a
different value — the machinery is not attached to the answer, and that was deliberate.

---

## 3. For a red-blind reader, the error ink and Living Brass are the closest pair in QANDEEL

dEok 0.0554 after protanopic simulation, against a derived floor of 0.0513. It clears the
floor by less than any other pair in the system.

It is not fixable by choosing a different red: the floors already consume very nearly the
whole red region of the sRGB gamut at this lightness, and only 3 sampled points are
feasible. It is handled where it must be — the error always ships a glyph, copy and a
promoted boundary — and Living Brass is scarce by construction. But it is a real residual.

---

## 4. The value sits close to the sRGB gamut edge

`#fe907e` has a red channel of 254. The gamut edge is 0.0010 of chroma away at its
lightness. On a wide-gamut display the value is converted rather than clipped, so this is
not a rendering defect — but there is **no headroom** if a later requirement asks for more
chroma, and a display or pipeline that clips will clip this.

---

## 5. The dichromacy model is a design instrument, not a claim about perception

Viénot, Brettel & Mollon (1999), single plane, transcribed rather than taken from a
dependency. It is exercised by 26 property tests that do not depend on remembering the
constants — including idempotence, which fails loudly on any single mistyped value — and
**tritanopia is excluded from every floor** because the single-plane form is not validated
for it.

That is honest but it is still a model. Real dichromacy varies in severity; anomalous
trichromacy is not modelled at all; and no colour-blind person looked at the boards.

---

## 6. No screen reader was heard

Every programmatic attribute is present and correct — `aria-invalid`, `aria-describedby`,
`role="alert"`, real `disabled` plus `aria-disabled`, `aria-current`, `aria-hidden` on
every decorative mark. **None of the resulting announcements was verified.** And the
React Native equivalents are not uniform across platforms; `E1_REACT_NATIVE_MAPPING.md`
§3 names that as D-E1-3.

---

## 7. The behavioural proof is one engine, keyboard only

Real Tab, Shift+Tab and Enter events through Chrome. No touch dismissal, no pointer focus,
no RN focus manager, no TV remote. The obligations are correct for the semantics they
describe; they are not a claim about a device. Inherited in shape from B3R's D-6.

**And the DISCOVERABLE UNAVAILABLE pattern is the part of E1R this bites hardest.** On the
web it is fully proved — reached by a real Tab, refusing a real Enter, painted identically
to the native pattern. In React Native it is **specified and untested**, and the first-party
page that would settle it could not be reached from this host, so nothing is quoted for it.
`E1_REACT_NATIVE_MAPPING.md` D-E1-6. It is the largest unverified claim the revision adds.

---

## 8. The Arabic copy has not been reviewed by a native speaker

It was composed in Arabic structure under a stated register and scanned against eight named
failure modes, and the reasoning is in `E1_ARABIC_COPY_CONTRACT.md`. **Eloquence is a
judgement call and this is one executor's judgement.** The copy is load-bearing in this
system — it is one of the channels the status roles are required to ship with — so a weak
string is a weaker failure here than it would be in a product where colour carried more.

---

## 9. E1's own shape is on a published list of AI defaults

The `frontend-design` skill's calibration section names *"a near-black background with a
single bright acid-green or vermilion accent"* as one of three current AI-generated looks —
"defaults rather than choices". **A near-black ground with one bright accent is exactly
E1's shape.**

The dark foundation is frozen in I-08B3.0 and the brief's own words win there. The honest
response is not to deny the resemblance but to say where the difference is claimed to be:
**the accent was derived, and the derivation is reproducible and attackable** — the hue is
anchored to the display's red primary and moved 0.75°, the chroma is set by what a
protanope can still distinguish, the lightness was not pinned at all, and two platform
reds fail the same floors. **A reviewer may still find the result generic.** If so, the
argument for it is the derivation and not the look, and that is the correct place to attack
it.

---

## 10. Hover is undesigned and unreserved

Not an omission — QANDEEL ships touch-first and a touch device fires hover on tap, which
turns a hover expression into a false press. But if a pointer-device surface ever becomes a
Product requirement, hover is a **new decision with a channel problem**: every visual
channel already has an owner, so hover would have to take one by precedence or introduce a
sixth. E1 does not pre-answer that and does not reserve a namespace for it, because a
reserved namespace would imply the question had been thought through.

**And E1's version of this paragraph rested on an argument that is no longer available.** It
said the channels were allocated *and never shared*, which was the claim REV-02 withdrew.
Sharing a channel is now a thing the model can do — under a declared precedence rule — so
"there is no channel left" is a weaker objection to hover than it was. The decision still
has not been made; the reason for not making it is now honest about its own strength.

---

## 11. The three status refusals have now been audited, and two of them failed

**This was E1's largest open admission and I-08B3.1-E1R closed it — in the direction E1 did
not expect.** `E1R_PRODUCT_SURFACE_AUDIT.md` classified eight QANDEEL surface categories
against the three falsifiable conditions:

- **WARNING** — condition **MET**. Ambient service or connection degradation in a Shared or
  Public world is persistent, detached from any commit, and not a failure of anything the
  user just did. E1 had seen this case and dismissed it in a table row that contradicted its
  own overturn condition.
- **SUCCESS** — condition **MET**. A background analysis or replay that completes after the
  user has navigated away has no visible home, which is the condition verbatim.
- **INFORMATIONAL** — **not met**. The closest case, a privacy or authority boundary, reads
  correctly at secondary rank with a lock glyph.

**E1R creates no hue for either**, and gives its reasons: degradation must be noticed
without interrupting, and the hue QANDEEL has means *act now*; and a background result needs
a **place to land** before it needs a colour. Both are handed to Product with the evidence
named. **A reviewer may decide either way, and that is now sayable** — under E1's frozen
count it would have been a contradiction rather than a finding.

**What remains untested:** no user was asked, no surface for either case exists yet, and the
audit reads the record rather than the Product. Eight categories is a stress test, not an
inventory.

---

## 12. What E1 deliberately did not solve

Light Mode, Increase Contrast, Reduced Transparency, screen and tab transitions, navigation
choreography, Conversation ↔ Analysis transitions, semantic zoom, camera travel, Timeline
motion, Return to Live, the full micro-interaction system, the global Product motion
hierarchy, icon geometry, navigation form, and placement of anything including the
canonical Q.

---

## 13. One measurement in a frozen package is corrected, and one is not touched

**Corrected:** the *restatement* of the disabled collision in `C2_FINDINGS.md`, carried
into `C3_FREEZE_RECORD.md` §4.2 and `C3_ICONOGRAPHY_MATERIAL_CONTRACT.md` §6.4, does not
survive measurement. C1R's original statement is correct; the ink restatement is not. **No
frozen value moves and no sealed raster changes** — the diagnostic carrier was always
classified proof-only and assigned to E. But two frozen documents contain a sentence that
is measurably wrong, and the Director may want them annotated.

**Not touched:** C3's §6.2 measurement that the four interaction states contain exactly
2109 chromatic pixels each. E1's disabled expression touches no Brass-bearing control, so
that raster and that number stand unchanged.

---

## 14. Three of E1's own frozen contract statements were wrong, and one hid a live defect

**I-08B3.1-E1R withdrew four sentences I-08B3.1-E1 had frozen as Product contract.** One was
**false** on the day it was written (two states write the ink). One was an **absolute** with
a real accessibility cost, contradicted by sources E1 had already read. One was a
**navigation and entitlement law** a colour package had no authority to make. One was a
**cap on the Product's future** established on the evidence of a single role.

**And the navigation law was hiding something.** For two packages the shipping stylesheet
contained a rule repainting the navigation item's icon — Living Brass — to the unavailable
ink. It never rendered, because no board ever marked a navigation item unavailable, because
the law said that could not happen. **A rule that cannot be reached is a rule nobody reads,
and a Product law that removes a case also removes the reason to look at it.**

The rule is gone and check R30 rejects its return. But the general lesson is a limitation of
this package rather than a triumph: **E1 shipped 25 checks, 25 probes and 14 boards, and
none of them was pointed at its own prose.** The checks verified values, chains, rasters and
behaviour. The four sentences were verified by nobody, and three of them were the kind of
claim that decides what a Product may do later.
