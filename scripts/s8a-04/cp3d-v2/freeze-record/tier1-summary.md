# CP3-D V2 — Tier 1 cases: summary and self-check

File: `tier1-cases.json` (schema `QANDEEL_S8A04_CP3D_V2_TIER1_CASES_V1`, `synthetic: true`, UTF-8 without BOM, 2-space indentation).
150 cases, ids `T1-001` … `T1-150`, shuffled with a fixed seed: no two adjacent cases share a category, and the longest run of one label is 7.
Every case has the fields of the brief. There is one extra boolean field, `hardNegative`. It is `true` on the hard-negative ALLOW cases and `false` everywhere else, including every BLOCK case.

Source files, all in this folder: `block.js` and `allow.js` (the hand-written cases), `build.js` (assigns ids and keys, shuffles, writes the JSON) and `validate.js` (the mechanical checker).

## Counts

| category | expected | n | indirect | hardNegative | cases with a `claimable:false` item | languages |
|---|---|---|---|---|---|---|
| B_OTHER_MEMBER | BLOCK | 12 | 11 | – | 0 | EG 3, LEV 3, GULF 1, MSA 1, en 3, mixed 1 |
| B_OUTSIDE_OWNER | BLOCK | 12 | 5 | – | **7** | EG 4, LEV 3, GULF 1, MSA 1, en 2, mixed 1 |
| B_PRONOUN | BLOCK | 10 | 9 | – | 0 | EG 3, LEV 2, GULF 1, MSA 1, en 2, mixed 1 |
| B_CO_SUBJECT | BLOCK | 10 | 0 | – | 1 | EG 3, LEV 2, GULF 1, MSA 1, en 2, mixed 1 |
| B_ADDS | BLOCK | 10 | 0 | – | 1 | EG 3, LEV 2, GULF 1, MSA 1, en 2, mixed 1 |
| B_OTHER_ITEM | BLOCK | 6 | 0 | – | 0 | EG 2, LEV 1, MSA 1, en 1, mixed 1 |
| B_ANONYMOUS | BLOCK | 8 | 6 | – | 0 | EG 2, LEV 2, GULF 1, MSA 1, en 1, mixed 1 |
| B_ADDRESSEE | BLOCK | 6 | 3 | – | 0 | EG 2, LEV 1, GULF 1, en 1, mixed 1 |
| B_RECORD | BLOCK | 8 | 0 | – | 1 | EG 2, LEV 2, GULF 1, MSA 1, en 1, mixed 1 |
| B_QUOTE_PROVENANCE | BLOCK | 8 | 0 | – | 0 | EG 2, LEV 2, GULF 1, MSA 1, en 1, mixed 1 |
| A_SPAN | ALLOW | 16 | – | 6 | 1 | EG 5, LEV 3, GULF 1, MSA 1, en 4, mixed 2 |
| A_ADVICE | ALLOW | 14 | – | 9 | 2 | EG 4, LEV 3, GULF 1, MSA 1, en 3, mixed 2 |
| A_GROUP | ALLOW | 12 | – | 7 | 1 | EG 4, LEV 3, GULF 1, MSA 1, en 2, mixed 1 |
| A_MULTI | ALLOW | 10 | – | 4 | 1 | EG 3, LEV 2, GULF 1, MSA 1, en 2, mixed 1 |
| A_PLAIN | ALLOW | 8 | – | 0 | 2 | EG 2, LEV 2, GULF 1, en 2, mixed 1 |

**Labels:** BLOCK 90, ALLOW 60.

**Languages** (minimum required → actual, then BLOCK / ALLOW):

| language | min | actual | BLOCK | ALLOW |
|---|---|---|---|---|
| ar-EG | 40 | 44 | 26 | 18 |
| ar-LEV | 30 | 33 | 20 | 13 |
| ar-GULF | 10 | 14 | 9 | 5 |
| ar-MSA | 10 | 13 | 9 | 4 |
| en | 25 | 29 | 16 | 13 |
| mixed | 15 | 17 | 10 | 7 |

**Indirect:** 34 of the 90 BLOCK cases are indirect (the minimum is 30). They are spread over B_OTHER_MEMBER, B_PRONOUN, B_ANONYMOUS, B_OUTSIDE_OWNER and B_ADDRESSEE.

**Hard negatives:** 26 of the 60 ALLOW cases are hard negatives (the minimum is 20).

**`claimable: false`:** 17 items in 17 cases. Seven are B_OUTSIDE_OWNER cases (the minimum is 6). The other ten are spread over B_CO_SUBJECT, B_ADDS, B_RECORD, A_SPAN, A_ADVICE, A_GROUP, A_MULTI and A_PLAIN, where the item is used silently or not used at all.

**Spans:** 69 in total, 11 of them in the `@` form. Seven A_SPAN cases use `@` (the minimum is 5).

**Groups:** 141 cases have 3 members, 5 have 4 and 4 have 2. There are 65 distinct names (the minimum is 40), female and male, in Arabic and English. There are 175 items in all, 1–3 per case.

## Structural self-check (mechanical: `node validate.js`, result `VALIDATION: OK (0 errors)`)
For every case, `validate.js` checks:
- **Top level:** the schema string, `synthetic: true`, exactly 150 cases, sequential unique ids, and the exact field order of each case. The file has no BOM and is canonical 2-space JSON.
- **Counts:** category counts match the table exactly, and each category maps to its required `expected` label. The 90/60 split, every language minimum and the presence of every language under both labels are checked. So are indirect ≥ 30 (BLOCK only), hardNegative ≥ 20 (ALLOW only), B_OUTSIDE_OWNER with `claimable:false` ≥ 6, A_SPAN with `@` ≥ 5 and distinct names ≥ 40.
- **Members:** 2–4 per case, all distinct, and the sender is a member.
- **Items:** 1–3 per case with keys `R1…Rn`, the owner is a member, `claimable` is a boolean, the text is 1–120 characters and contains no `⟦`/`⟧`. B_OTHER_ITEM cases have at least 2 items.
- **Spans:** every span matches `⟦R<n>: …⟧` or `⟦R<n>@: …⟧` (U+27E6/U+27E7, a colon, a space). Its key is an item of this case with `claimable: true`, and each key appears in at most one span. The predicate is 1–240 characters with no `⟦`, `⟧` or `R<n>` text and no leading or trailing whitespace. No `claimable:false` item is ever spanned.
- **No member Name inside any span:** each Name of the case is checked as a whole word, including with the Arabic proclitics و ف ب ل ك (up to two), `ال` and `لل`. English names are matched case-insensitively.
- **Outside spans:** after the well-formed spans are removed, no `⟦`, `⟧` or `R<n>` text is left, so malformed spans are caught too. The message also contains none.
- **Shape of the reply:** B_CO_SUBJECT, B_ADDS, B_OTHER_ITEM and A_SPAN cases contain a span, while A_ADVICE, A_GROUP and A_PLAIN contain none. Each reply has 1–4 sentences by a rough count.

A mutation test confirmed that the checker catches each violation it is meant to catch. These violations were injected:
- a Name with a و prefix inside an Arabic span;
- a lower-cased English Name inside a span;
- `R1` outside a span;
- a span on a `claimable:false` item;
- a duplicated key;
- an unknown key;
- a span with no space after the colon;
- a 263-character predicate;
- a broken category count.

The checker caught all nine.

## Checked by hand (not mechanically)
- **Gender agreement:** in every Arabic span, the predicate agrees with its owner's gender. In the B_OTHER_ITEM cases, it agrees with the owner of the wrong key that was used.
- **One reason per BLOCK case:** each BLOCK case is unsafe for the reason its category names, and the rest of the reply is safe.
- **Clear ALLOW cases:** every ALLOW case is unambiguously safe. No ALLOW reply states, hints at or attributes an item outside a span, and none mentions memory, notes or provenance.
- **Items:** every item is written in the first person and covers an everyday topic. None is about health beyond allergy, motion sickness or sleep, and none is sexual, political or religious.

## Revision 1 (after the blind review)
Four cases were edited. Their ids, labels, languages and categories are unchanged, so every count above still holds.
- **T1-147:** the reply no longer names restaurants or delivery, so the budgeting advice is clearly generic.
- **T1-025:** the provenance clause is now "she told me so last week". It reveals provenance only and claims no conversation or record.
- **T1-101:** rewritten as a host asking for advice for herself, with a reply addressed to her alone. It is still A_ADVICE and still a hard negative.
- **T1-099:** "The Corner Kitchen" became "The café on the corner".

`node build.js` and `node validate.js` were re-run, with the result `VALIDATION: OK (0 errors)`.
