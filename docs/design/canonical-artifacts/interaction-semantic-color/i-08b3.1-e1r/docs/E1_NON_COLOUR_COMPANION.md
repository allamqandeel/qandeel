# E1_NON_COLOUR_COMPANION

**I-08B3.1-E1.** The channels that carry meaning when colour does not, cannot, or must not.

---

## 1. Why this is not a formality in QANDEEL

WCAG 2.2 SC 1.4.1 says colour must not be the only visual means. Its Understanding
document offers a way to satisfy that with colour alone: when two colours "differ not only
in their hue, but that also have a significant difference in lightness" at "a contrast
ratio of 3:1 or greater", that counts as an additional visual distinction.

**E1 measured that route and it is closed here.**

| the error ink against | contrast |
|---|---|
| SECONDARY reading ink `#afaca3` | **1.03:1** |
| TERTIARY reading ink `#8b8982` | **1.58:1** |

The error ink is the same *weight* of ink as the Product's own text. It announces itself by
hue and by nothing else. So in QANDEEL the non-colour channels are **load-bearing**, not
belt-and-braces, and that is a fact about this palette rather than a rule imported from
outside.

There is a second reason, and it is sharper. QANDEEL's reading ramp is not achromatic —
it sits at hue 91–94 with chroma 0.011–0.015. Under protanopia a red collapses toward that
warm neighbourhood, which is why the binding constraint on the whole error derivation was
the distance between the error ink and the Product's own reading ink *for a red-blind
reader*. Colour does less work here than it would in a cooler system.

---

## 2. The channel inventory

| channel | what it is good at | used by |
|---|---|---|
| **glyph / silhouette** | kind — *what sort of thing is this* | error, warning, success, informational |
| **copy** | consequence and remedy — *what happened, what to do* | error, warning, success, the disabled reason |
| **boundary** | commitment — *this is the line you cross* | error, warning |
| **position** | urgency without noise — *this is where you already are* | warning |
| **shape / attachment** | which system is speaking | focus (detached), selection (attached) |
| **type weight** | emphasis, and in Arabic the only typographic one available | selection |
| **rank in the reading ramp** | subordination | informational, unavailable |
| **behaviour** | permission — *you may not* | disabled: out of the tab ring |
| **programmatic state** | everything, for a screen reader | all of it |

---

## 3. The four status glyphs, chosen as silhouettes first

The requirement is not "an icon". It is a shape that survives desaturation, a 16 px
rendering and a dichromatic reader. So the four are drawn from four different families:

| role | silhouette | why this one |
|---|---|---|
| **ERROR** | a **circle with a cross** | an enclosure plus a cancelling mark. The only closed, crossed form in the set. |
| **WARNING** | a **triangle with a bar** | a different enclosure entirely. Triangle-vs-circle is the largest silhouette difference available at 16 px. |
| **SUCCESS** | a **bare check**, no enclosure | open, not enclosed — distinct from both at a glance and at any size. |
| **INFORMATIONAL** | a **bare letterform**, no enclosure | the quietest mark in the set, for the quietest role. |

Circle / triangle / open stroke / bare stroke. Board `b12-integrated-greyscale.png` is the
integrated screen with **every pixel's hue removed** — 0 chromatic pixels, 199 distinct
greys — and the four remain tellable apart.

---

## 4. Copy is a design material here, not decoration

Because copy is one of the channels the error role is *contractually required* to ship
with, it had to be written in Arabic structure rather than translated from English. The
full contract is in `E1_ARABIC_COPY_CONTRACT.md`; the rules that matter to this document:

- **Errors do not apologise and are never vague about what happened.** There is no
  «نأسف» anywhere in the package. «تعذّرت مزامنة العالَم» frames the *process* as having
  failed, not the product as confessing.
- **An error names what failed and then how to fix it**, in that order, in one breath:
  «تعذّرت مزامنة العالَم. تأكّد من اتصالك بالإنترنت ثمّ أعد المحاولة.»
- **A warning names the CONSEQUENCE, not the risk.** «سيصبح هذا العالَم عامًّا. يستطيع أيّ
  شخص قراءة ما تنشره فيه، ولا يمكن التراجع بعد النشر.»
- **An action keeps its name through the flow.** The commit is «اجعله عامًّا» and the
  confirmation is «أصبح العالَم عامًّا» — one root, carried through. For the success role,
  which has no colour at all, that repetition is a large part of what does the work.
- **A disabled control says why.** «اكتب اسمًا للعالَم قبل النشر.»

---

## 5. The programmatic channel, which is not optional

Every proof in this package carries the real attributes, not a painted resemblance:

| | |
|---|---|
| an invalid control | `aria-invalid="true"` |
| its message | `aria-describedby` from the control, `role="alert"` on the message |
| a disabled control | the real `disabled` attribute **and** `aria-disabled="true"` |
| a disabled commit | `aria-describedby` pointing at the reason, which is a real element |
| a selected item | `aria-current` |
| a decorative mark | `aria-hidden="true" focusable="false"` on every glyph and the canonical Q |

The behavioural probe **disabled-paint-without-the-attribute** exists because the ordinary
mistake is to paint a control disabled and forget the attribute: it then *looks*
unavailable and is still fully operable. The probe drops the attribute while keeping the
paint, and the tab-ring obligation rejects it.

---

## 6. What this does NOT claim

It does not claim a screen-reader announcement was verified — no screen reader ran. It
does not claim the Arabic wording is final; it claims the wording was composed under a
stated register and a stated set of failure modes, and `E1_KNOWN_LIMITATIONS.md` records
that a native reviewer has not signed it off. It does not claim the glyph set is a final
icon system: C3 freezes no icon geometry and neither does E1.
