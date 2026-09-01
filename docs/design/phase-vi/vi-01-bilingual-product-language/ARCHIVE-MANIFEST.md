# QANDEEL — VI-01 Archive Manifest

Integrity record for `docs/design/phase-vi/vi-01-bilingual-product-language/`. This manifest
exists for **archive integrity only** — it carries no product semantics and no design
authority. For what VI-01 decided, read [`README.md`](README.md) and the documents it lists.

- **Canonical source baseline:** `main` `4e83b1ce2d854f1ba49a6de15572f1025d196647`
- **Archive task:** `VI-01 FREEZE-01` (documentation only)
- **Archived deliverables:** 5 (+ `README.md`, + this manifest)
- **Total size of the five deliverables:** 249,807 bytes
- **Source workspace:** `prototypes/phase-vi/vi-01-bilingual-product-language/` — untracked,
  local, non-canonical. It was not cleaned, reset, stashed or deleted.

`SHA-256` is of the archived file as committed. Because every archived deliverable is a
byte-for-byte copy of its corrected source, the same digest identifies both. Verify with
`sha256sum` / `Get-FileHash -Algorithm SHA256`.

---

## Archived files

| Canonical archive path (relative to `docs/design/phase-vi/vi-01-bilingual-product-language/`) | Source workspace path | Role / purpose | Decision status | Bytes | SHA-256 |
|---|---|---|---|---|---|
| `QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md` | `prototypes/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md` | The language system: register architecture, truth/semantic guardrails, naming-minimization, gender policy, peer-scaling language constraints, provenance and accessibility invariants. Highest authority | **CLOSED / FROZEN AS LANGUAGE SYSTEM + SEMANTIC CONTRACTS**; `PROPOSED` / `OPEN` / `PROVISIONAL` items remain editable as marked | 110097 | `619e4cd946489c20bf922a3a46225ecb95b541b36aebe7227615cc86444225ba` |
| `QANDEEL_VI01_TERMINOLOGY_MATRIX.md` | `prototypes/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_TERMINOLOGY_MATRIX.md` | Per-concept decision record across 59 concept rows; governs individual terms, their register tier and their gender technique | **FROZEN AS A DECISION RECORD**; rows are `APPROVED` / `PROPOSED` / `OPEN` / `PROVISIONAL` exactly as marked in place | 41412 | `7c496bee620618d910fb9a87e31d8f925f24ca2ad26dd39a5b493e7ec7f118ed` |
| `QANDEEL_VI01_COPY_PATTERNS.md` | `prototypes/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_COPY_PATTERNS.md` | Reusable shapes for classes of copy, so new strings inherit settled semantics. The patterns are canonical; the example sentences are not | **PATTERNS + SEMANTIC CONTRACTS FROZEN**; example microcopy editable under the frozen contract | 24748 | `1365546e82e8526072b2b6c0373bdc5570af07d8afb0d247ff8adfb0829da8b7` |
| `QANDEEL_VI01_REJECTED_LANGUAGE.md` | `prototypes/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_REJECTED_LANGUAGE.md` | What may not ship and why, classified under the four rejection authorities that determine whether a rejection may ever be revisited | **REJECTION-AUTHORITY TAXONOMY FROZEN**; individual entries revisitable only through their own stated authority | 23398 | `d9a350ec136f1400cbac2501258e1c9cbc4b093cf7574418cab4c21663c91c53` |
| `QANDEEL_VI01_LANGUAGE_STRESS_TEST.md` | `prototypes/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_LANGUAGE_STRESS_TEST.md` | The evidence the freeze rests on: measured 375px label pressure, state and density gates, and the 31 recorded defects with their fixes | **SUPPORTING EVIDENCE — HISTORICAL.** Not the canonical rule; where it restates a rule the Foundation later scoped, the Foundation governs | 50152 | `4e30df2aa74c1480b082145b51ff5b5db1f7822bd49818c20e1af4293c5d739a` |
| `README.md` | — (created by `VI-01 FREEZE-01`) | The freeze meaning: what closed, what stays editable, what is carried forward, and the canonical authority order | **CANONICAL CLOSURE RECORD** for VI-01 | 6244 | `03fdc864b3ba642519178e03f72ea837eb6d34bc858486f24d9bde783914fb8a` |

---

## Copy fidelity

**One archived file differs from the freeze-candidate package it came from: the Foundation.**
`VI-01 FREEZE-01` applied exactly **three** Product / Creative Direction micro-corrections to
`QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md` and changed nothing else. The other
four deliverables were verified **byte-identical** to their
`QANDEEL_VI01_PRODUCT_LANGUAGE_FREEZE_CANDIDATE_v3.zip` entries.

**All other content was copied without semantic rewriting.** No section was re-authored, no
terminology row was re-decided, no rejection was re-classified and no new language exploration
was run.

### The three micro-corrections

| # | Location | What was withdrawn | What replaced it |
|---|---|---|---|
| **A** | Foundation executive summary — reading-identity recommendation | The rationale that «قراءة أ / ب / ج» is rejected *because letters are a sequence, and a sequence reads as a rank* — broader than the narrower rule already stated in §10.2 | «قراءة أ / ب / ج» remains `REJECT` because using a letter sequence **as the user-facing identity** makes order salient, can be mistaken for hierarchy, scales poorly for bilingual/accessibility use, and risks the sequence becoming the identity itself. The **A2** equality/unranked constraint, content-derived identity as the first direction to **test** in VI-02, and the absence of any new runtime label contract are all unchanged |
| **B** | Foundation §10.1, rule 1 | The same withdrawn assertion, repeated: *a letter series is a sequence, and a sequence reads as a rank* | Identity must not use an ordering scheme that can be mistaken for merit/hierarchy or become the reading's identity — **A2**. Letter/number series are rejected **for the current architecture** on that basis plus bilingual/accessibility scaling. The six frozen §10.2 constraints were not altered, and VI-02's navigation solution is not prescribed |
| **C** | Foundation §14, final terms line | An active assertion banning «مكالمة مباشرة» / "live call" outright, contradicting the immediately preceding rule that realtime/call naming is `PROVISIONAL / PHASE VII` | Current safe generic vocabulary includes «تسجيل صوتي» / "voice note" and «مكالمة» / "call". Whether «مكالمة مباشرة» / "live call" is accurate or desirable is **`PROVISIONAL / PHASE VII`** and depends on the actual realtime architecture. `"Live Context"` stays rejected as current context-panel vocabulary, `live`/`realtime` call terminology is **not** globally banned, and Phase VII retains authority over voice/realtime state naming |

A bounded consistency check confirmed that after these corrections the withdrawn assertions
`a sequence reads as a rank` and `never «مكالمة مباشرة»` appear **nowhere** in the five
deliverables, and that no remaining active statement claims either that every sequence
inherently equals rank or that `live call` is globally forbidden. Surviving mentions of
`live call` are `PROVISIONAL / PHASE VII` statements or historical defect records (`D28`)
explicitly marked as retracted.

### Status lines inside the documents

The five deliverables still carry `FREEZE CANDIDATE — FIX-03 CONSISTENCY SEAL APPLIED` status
lines. `VI-01 FREEZE-01` was authorized to make the three corrections above and nothing else,
so those lines were left exactly as written. **[`README.md`](README.md) is the authority on
VI-01's freeze state.**

### No byte-identity claim to earlier packages

**This manifest does not claim byte identity to the pre-`FIX-03` package or to
`QANDEEL_VI01_PRODUCT_LANGUAGE_FREEZE_CANDIDATE_v3.zip`.** The authoritative source is the
corrected five-file source set produced by `VI-01 FREEZE-01`, and the digests above are of
that set.

---

## Exclusions

**No ZIP file is committed to this archive.**

The source workspace contains review packages from earlier rounds
(`..._REVIEW_PACKAGE.zip`, `..._FINAL_FREEZE_REVIEW.zip`, `..._FINAL_FREEZE_REVIEW_v2.zip`,
`..._FREEZE_CANDIDATE_v3.zip`). They are stale and are deliberately **not** archived.

`VI-01 FREEZE-01` produced one final handoff archive:

| Evidence artifact | Bytes | SHA-256 |
|---|---|---|
| `prototypes/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_PRODUCT_LANGUAGE_FROZEN_SOURCE.zip` | 95850 | `5bd07a473228a9eec009dca5ad79a2552363e196ea6fbef4e14b7803dcd0b72e` |

It contains exactly the five corrected deliverables, flat, and every entry was verified by
SHA-256 round-trip against its source file. **It is handoff evidence only and is not
committed** — it lives in the untracked source workspace.

---

## Scope

`VI-01 FREEZE-01` changed **8 repository files** and nothing else:

- `docs/README.md` — added the Phase VI section; Phase VI is **not** closed by this change
- `docs/design/phase-vi/vi-01-bilingual-product-language/README.md`
- `docs/design/phase-vi/vi-01-bilingual-product-language/ARCHIVE-MANIFEST.md`
- the five archived VI-01 deliverables listed above

**No production code, runtime, database, migration, package, prototype, test or CI file was
changed.** No unrelated documentation was rewritten.
