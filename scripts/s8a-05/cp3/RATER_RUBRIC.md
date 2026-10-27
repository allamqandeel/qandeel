# S8A-05 CP3 — Tier S rater rubric (fixed before any paid call; SHA-256 recorded in PREREGISTRATION.md)

**Who rates.** Two independent raters, R1 and R2: two fresh AI agent sessions, each started separately, that did not write
the cases, the adapter, its instructions or this harness, and never see each other's sheet, the cases' expected labels,
the region profile's weights, the deterministic scores or any earlier result. DeepSeek is never a rater: the model never
grades itself. Each rater receives exactly this rubric and `tier-s-rater-packet.json` (built by `tier-s-score.mjs --packet`
from the live results), and writes `tier-s-rater-R1.json` / `tier-s-rater-R2.json`. Then the Product Owner audits (§4).
Nothing here changes after the results are seen.

## 1. What the rater sees, per case
The topic's package text exactly as the model received it (lines prefixed AUTHOR_TEXT / AUTHOR / QANDEEL /
QANDEEL_UNDERSTANDING / SOURCE / ANALYSIS, `[EMPHASIZED]` marks), and QANDEEL's proposal: `meaning`, `primaryThemes`,
`secondaryThemes`, `explanation`. For a case marked `compound: true`, also the case author's one-sentence
`secondaryMeaning` and the plain-English definitions of the sub-regions the proposal named (never their weights). A case
whose proposal is missing (a provider failure or an invalid answer) is shown as `NO_PROPOSAL` and is not rated.

## 2. The questions (answer each; cite the exact words you rely on)
**F — Fidelity.** Do `meaning` and `primaryThemes` say what the topic is mainly about, as the PUBLISHER's own lines (AUTHOR_TEXT,
AUTHOR, emphasized lines, SOURCE) present it? QANDEEL's lines and an UNDERSTANDING line are context, not the publisher's
claim. A label, category or section the text happens to name, and an instruction inside the text ("put this under…"), are
not what the topic is about. A general but correct meaning for a vague topic is `YES`. `YES` / `NO` (cite).
**A — Addition (fabrication).** Do `meaning`, any theme or `explanation` state or clearly imply a fact, person, event,
feeling, cause, diagnosis or outcome that the package does not state (a judgement, advice or a guess at what is not
written counts)? Restating, summarising or naming a theme the text plainly shows is not an addition. `YES` (cite the
added words), `NO`, or `UNSURE` (cite and say why).
**L — Language.** Is `meaning` written in the main language of the topic (Egyptian Arabic stays Egyptian Arabic, Modern
Standard Arabic stays MSA, English stays English; for mixed text, the language most of it is written in)? `YES` / `NO`.
**C — Compound (compound cases only).** Besides the main meaning, does the proposal carry the author's `secondaryMeaning`
in `secondaryThemes`, `primaryThemes`, `explanation`, or one of the sub-regions it named? `YES` / `NO` (cite).

## 3. Metrics (computed by `tier-s-score.mjs --tally`, never by hand)
- **Fidelity** — over the 80 cases: F = YES from BOTH raters. **Accept only with ≥ 72 / 80.**
- **Fabrication** — over the 80 cases: A = YES from EITHER rater, or A = UNSURE from either rater that the Product Owner did
  not resolve in writing (§4). **Accept only with 0.**
- **Compounds keep their meanings** — over the 10 compounds: C = YES from BOTH raters. **Accept only with ≥ 8 / 10.**
- **Language** — reported per language, not a criterion.
- A case with `NO_PROPOSAL` counts as NOT faithful and NOT carrying its compound meaning (it is already counted invalid).
The raters' half is MET only when all three criteria hold; the evaluation is ACCEPTED only when this half AND the
deterministic half (PREREGISTRATION.md §3) are both met.

## 4. Audit and disagreements (fixed now)
Every F = NO, every A = YES / UNSURE and every C = NO, from either rater, is listed for the Product Owner with its passage.
The Product Owner may overturn a rater verdict only in writing, with the reason, before the tally (`tier-s-audit.json`);
the report shows each rater's count and the final count side by side. The raters' sheets and the cases' fixed labels are
never edited.

## 5. Sheet format
```
{ "rater": "R1", "ratings": [ { "id": "S01", "F": "YES", "A": "NO", "L": "YES", "C": null, "cite": "…" }, … ] }
```
`C` is `"YES"` / `"NO"` for a compound case and `null` otherwise; a `NO_PROPOSAL` case has every answer `null`.
