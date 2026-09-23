# I-08B3.1-D2R — ACCESSIBILITY REQUIREMENTS

What this system must do to be usable, and what is already proved about it.

---

## 1. Nothing here is carried by colour alone

Apple's guidance: *"Convey information with more than color alone… Offer visual indicators, like
distinct shapes."*

| Distinction | Colour channel | Second channel |
|---|---|---|
| one topic from another | none — hue is composition and identifies nothing | **the topic's NAME**, written on it, in every world |
| near from far | lightness per layer | **number of contour lines** (3 / 2 / 1) and scale |
| which world is open | a uniform treatment | **the world's name in the header** |
| a meaning event happening | warm Light | **movement, and a structure that appears** |
| the settled result | neutral ink | **geometry that persists** — a locus and its links, a keel, a relation |
| membership in a pattern | none | **an identical mark at every member**, plus the link |

**I-08B3.1-D2 answered the first row differently and wrongly**, and the difference is worth
keeping visible. It said contour shape was the fine identity channel — a topic "recognisable
before its label is read". That was an identity guarantee the Product never granted. The correct
answer was simpler and was there all along: **the topic's name is written on it**, and guard
**S4** asserts that every topic is named in every world.

---

## 2. Contrast

| Element | Against | Ratio | Requirement |
|---|---|---|---|
| settled relation / membership link / keel `#8b8982` | World `#101010` | **5.44 : 1** | 3:1 — a graphical object under WCAG 2.2 SC 1.4.11 |
| analytical node `#d8d5ca` | World | 14.9 : 1 | 4.5:1 |
| topic label `#8b8982` | World | 5.44 : 1 | 4.5:1 |
| navigation machinery `#a58e6f` | Surface `#181818` | 5.66 : 1 | 3:1 (non-text) |
| Light `#d6caa9` at full | World | 11.67 : 1 | — |

**The relation stroke's ratio is a correction I-08B3.1-D1 made and this package re-measures at
build time.** It was `#4a4740` from D0 through D1 — **2.05 : 1**, failing the 3:1 that SC 1.4.11
carries for a graphical object, which the token's own `$description` names. Gate 3 in
`d2-build.mjs` throws if it ever drops below 3 again.

**The ring inks are not in this table, and the omission is deliberate.** A contour is atmosphere:
it carries no information that is not also carried by position and label, so it is not a
graphical object under 1.4.11. If a later Product decision makes a ring's shape or colour
*informative*, it acquires the 3:1 obligation, and that should be argued on the record rather
than inherited silently.

---

## 3. Reduced motion

Four real counterparts, designed rather than disabled — `D2R_MOTION_AND_REDUCED_MOTION.md` §3.

What implementation must get right:

- **`useReducedMotion` reports the setting as it was at app start** and does not update at
  runtime. A user who changes it mid-session gets the old behaviour until the app restarts. This
  is documented Reanimated behaviour and should be handled deliberately, not discovered.
- **No animated blur under the setting, anywhere** — including the inherited Connection, whose
  counterpart D2 corrected for exactly this.
- **The parallax differential goes; the parallax stays.** Removing panning would remove a
  product capability, not a decoration.
- **`withDecay` returns the current value**, so the map stops where the finger let go. Implement
  that, do not approximate it with a shorter glide.

---

## 4. Text, Arabic, and size

- **Line-height ≥ 1.7 on every Arabic-bearing element** on both surfaces. Arabic ascenders,
  descenders and diacritics clip below about 1.6, and Tailwind-style defaults sit at 1.43.
- **No letter-spacing anywhere an Arabic glyph can appear.** Arabic is a connected script and
  tracking visibly breaks the joins. It exists in exactly one place across both surfaces: the
  Latin direction letter on the review board.
- **No italics on Arabic**, which has no italic tradition and gets fake-slanted.
- **`dir="rtl" lang="ar"` at the root** of both surfaces. `lang` matters as much as `dir`: it
  drives Arabic font fallback and screen-reader voice selection.
- **Dynamic Type.** Apple asks for at least 200 % enlargement. This proof is at a fixed
  viewport, so it does not demonstrate it — that is a stated limitation, and layout spacing in
  production should scale with the text rather than being fixed px.

---

## 5. What a screen reader must get

**The canvas is one node.** A Skia `Canvas` exposes nothing inside it, so the analytical content
cannot live there. It must be real text views composed over the canvas:

- each topic: its name, and its disclosed quantities if the product exposes them elsewhere
- a new INSIGHT node: its text, announced when it arrives — and announced **once**
- a PATTERN: a sentence naming its members, because a hub and four links are not readable to
  anyone who cannot see them. **This is the largest accessibility obligation the system creates,
  and it is a Product copy decision rather than a visual one.** The sentence is now easier to
  write than it would have been in I-08B3.1-D2, and that is a real consequence of the REV-02
  correction: a member SET has an obvious reading — "four topics form one pattern: …" — where a
  fitted axis with residuals had no honest sentence at all.

**The Light itself needs no announcement.** It is a transient that carries no information the
settled state does not also carry — which is the same property that makes the settled state
readable with no animation.

---

## 6. Motion safety

- **Nothing oscillates.** No looping animation of any kind exists in this system, at any
  frequency, and 0.2 Hz — the frequency two Apple sources name as the one people are most
  sensitive to — is the specific reason the ambient field is still.
- **Nothing flashes.** The fastest luminance change in the system is a 260 ms rise.
- **No full-viewport moving background.** The field moves only under the user's own hand.
- **Peripheral motion is bounded.** Every meaning event happens at a located point in the
  analytical plane; nothing animates at the edges of the frame.

---

## 7. The review board

Verified on the rendered page, not asserted:

- heading outline is `h1` then `h2` throughout, with no skipped level
- every image carries Arabic alt text saying what it shows, not naming the file
- every video carries `controls` and an `aria-label`; **none autoplays**, and the page still
  cancels autoplay under a reduced-motion preference in script, because CSS cannot cancel one
- disclosure summaries have a visible focus ring
- the page is built on logical properties throughout, so it survives being rendered LTR

---

## 8. What this package does NOT establish

- **No screen-reader pass** was run on anything here.
- **No 200 % text-size rendering** exists in this package.
- **No colour-vision simulation** was applied to the six-hue palette. The argument that shape
  carries identity independently is structural, and it has not been tested with anyone.
- **No device.** Everything above is desktop-rendered.
