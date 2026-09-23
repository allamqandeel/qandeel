# E1_ARABIC_COPY_CONTRACT

**I-08B3.1-E1.** Copy is one of the channels the status roles are contractually required
to ship with. That makes it a design material in this package, not decoration, and it has
to be written in Arabic structure rather than translated from English.

This document states the contract. **The final strings are a Product content decision and
a native reviewer has not signed them off** — see `E1_KNOWN_LIMITATIONS.md`.

---

## 1. Register

| context | register |
|---|---|
| errors, destructive confirmations, consent, account terms | **فصحى** — formal, not stiff |
| onboarding, empty states, nudges | warm; light colloquial is welcome |

Every string E1 ships is in the first row. A signage-grade word or a sermon verb in a
friendly nudge breaks the tone instantly, and the inverse is worse: a casual error reads as
the product not taking the failure seriously.

---

## 2. The rules, each with the string that obeys it

**An error frames the PROCESS as having failed, never the product as confessing.**

> ✅ «تعذّرت مزامنة العالَم. تأكّد من اتصالك بالإنترنت ثمّ أعد المحاولة.»
> ❌ «لم نتمكّن من مزامنة العالَم في الوقت الحالي. يُرجى التحقق من اتصالك والمحاولة مرة أخرى.»

`تعذّرت` puts the failure on the operation. `بالإنترنت` spells out the bare noun —
«اتصالك» alone is "your connection" to nothing. `ثمّ` sequences the two instructions
instead of a flat `و`. And there is **no «نأسف» anywhere in the package**: errors do not
apologise and are never vague about what happened.

**An error names what failed, then how to fix it, in that order.**

> ✅ «اسم العالَم قصير جدًّا. اكتب ثلاثة أحرف على الأقل.»

Gender agreement is not optional and is the commonest slip: «اسم» is masculine, so
«قصير», not «قصيرة». The companion string «هذا البريد غير صالح» agrees the same way.

**A warning names the CONSEQUENCE, not the risk.**

> ✅ «سيصبح هذا العالَم عامًّا. يستطيع أيّ شخص قراءة ما تنشره فيه، ولا يمكن التراجع بعد النشر.»

Three clauses: what becomes true, who that affects, and that it cannot be undone. No
«هل أنت متأكد» — that asks the user to audit their own certainty instead of telling them
what will happen. **This string is the warning role's colour**, in the sense that it is
what the role has instead of one.

**An action keeps its name through the whole flow.**

> commit «اجعله عامًّا» → confirmation «أصبح العالَم عامًّا.»

One root, carried through. For the success role — which has no colour at all — that
repetition does a large part of the work: the confirmation is the verb of the action in the
perfect tense, which says *it is done* more precisely than a green tick could.

**A disabled control says why.**

> ✅ «اكتب اسمًا للعالَم قبل النشر.»

Imperative, second person, and it names the missing precondition rather than restating that
the button is off.

**Informational states the fact and stops.**

> ✅ «يظهر هذا العالَم لأعضائه فقط.»

---

## 3. The eight failure modes, scanned

Every string above was checked against: register-mismatch, literal-idiom, weak-connector,
english-word-order, calque, awkward-idafa, wrong-preposition, robotic-tone.

The two that bit hardest were **robotic-tone** (the «لم نتمكّن» confession frame, removed)
and **wrong-preposition** (the bare «اتصالك», spelled out). **english-word-order** is the
one to watch in future strings: a fronted purpose clause — "For your security, …" →
«لأمان حسابك،» — reads as English wearing Arabic. Lead with the verb and let the purpose
trail.

---

## 4. Numerals, and why the proof pins one system

The proof uses **Eastern Arabic-Indic** digits throughout: «١٢ عضوًا», «٤ أعضاء»,
«٢٠٠٪».

Both systems are correct Arabic and CLDR's default legitimately varies by locale
(`ar-EG`/`ar-SA`/`ar-IQ` resolve Eastern; `ar-MA`/`ar-TN`/`ar-DZ` resolve Western). **The
Product's numeral policy is not E1's decision.** What is non-negotiable, and what the proof
demonstrates, is **consistency**: one system per user per view, including validation
messages, hints and inline examples. Mixing «٣ أحرف» in error copy with Western digits in
the input's example is a real observed failure, and it is exactly the kind of thing a
status system that leans on copy cannot afford.

Counted nouns follow the rule rather than a template: `٢` takes the dual («عضوان»), `3–10`
take the plural genitive («٤ أعضاء»), `11–99` take the singular accusative («١٢ عضوًا»).
Where a number is small and prose-like, it is spelled out — «ثلاثة أحرف» — which sidesteps
the question entirely.

---

## 5. Direction

The root is `dir="rtl" lang="ar"`. `lang` matters as much as `dir`: it drives Arabic font
fallback and screen-reader voice selection.

**LTR islands are inline and explicit.** The invitation e-mail field carries `dir="ltr"` on
the input itself — an e-mail address is inherently LTR, and an unisolated span scrambles it.
The island is on an inline element, never a block, because on a block it also flips which
edge the text aligns to.

**This rule caught a defect in E1's own boards.** The review annotation is English sitting
inside the RTL root, and its neutral punctuation was being reordered — the full stops and
the question mark jumped to the wrong end. Every English run in the board chrome is now an
isolated LTR island, which is the same rule the product copy obeys for its own.

**No letter-spacing anywhere, and no italics.** Letter-spacing visibly breaks the connected
script — including on a mixed span like «٢٥٠ كم», which contains Arabic glyphs — and Arabic
has no italic tradition, so browsers fake-slant it. That is why **weight** is the selected
state's typographic channel: the script leaves nothing else open.

**Line-height 1.65** everywhere. Below roughly 1.6 Arabic ascenders, descenders and
diacritics clip, and clipping risk doubles wherever text truncates.
