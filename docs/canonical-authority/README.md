# QANDEEL — Recovered Canonical Authority

**Status:** `PRESERVATION RECORD — CREATES NO NEW AUTHORITY, NO NEW PRODUCT SEMANTICS`

This directory holds byte-exact copies of canonical authority that was missing from GitHub. The first recovery
preserved upstream Experience Architecture and Connected Worlds sources on 2026-09-24; independent review on
2026-09-25 also recovered the final I-08A Product Shell / IA / Naming closure and the I-08N-01 Notification /
Proactive Attention Product contract from their original ChatGPT Library artifacts. All preserved source bytes
remain unchanged.

**Start here:** [`CANONICAL_AUTHORITY_INDEX.md`](CANONICAL_AUTHORITY_INDEX.md) locates every domain.
[`RECOVERY_PROVENANCE.md`](RECOVERY_PROVENANCE.md) records where each file came from and how it was
verified.

## What this directory is not

- **Not a current entry point.** It preserves authority that later work built on or still consumes. Some material
  is historical/upstream; I-08A and I-08N-01 are later frozen Product authority. Current orientation still begins
  at the root current-state and project-map locators.
- **Not an override.** A historical checkpoint or a frozen upstream source never outranks a later canonical
  record already in this repository: T-series amendments, the closed Connected Worlds runtime phases I-04 … I-07
  and their remediations, or the I-08B design closures. **Later amendments bind.**
- **Not the design-artifact store.** Final Product / design proofs (I-08B1, brand, typography, I-08B3.1 A–G)
  live in [`../design/canonical-artifacts/`](../design/canonical-artifacts/README.md). This directory holds the
  recovered Experience Architecture chain (Stages 0–6), Connected Worlds v2 architecture, and the recovered
  final I-08A / I-08N-01 Product authority.

## Rules this directory follows

1. **Bytes unchanged.** Each preserved source was hashed at the source, written, and hashed again. No line
   ending, BOM, encoding or whitespace was touched. [`.gitattributes`](.gitattributes) switches off
   line-ending conversion for the whole tree and whitespace checks for the preserved sources.
2. **Final authority plus the minimum support needed to read it.** Superseded candidates, proof boards,
   diagrams, task charters, readiness reports and outer ZIP containers were not admitted.
3. **Nothing is rebuilt.** Missing original containers are recorded as missing. No ZIP was recreated, and no
   document was paraphrased into a substitute.
4. **Provenance is explicit.** Each domain folder carries a `*_SOURCE_PROVENANCE.sha256` in `sha256sum -c`
   format. Paths in it are relative to that file's folder.

## Verify

```bash
cd docs/canonical-authority/connected-worlds-v2 && sha256sum -c CW2_SOURCE_PROVENANCE.sha256
cd docs/canonical-authority/experience-architecture/stage6 && sha256sum -c STAGE6_SOURCE_PROVENANCE.sha256
```

The same check applies to `core-checkpoint/`, `navigation-checkpoint/`, `stage5/`,
`final-product-experience/`, and to `docs/assurance/connected-worlds/`.

## Layout

| Folder | Holds |
|---|---|
| `connected-worlds-v2/` | Connected Worlds v2 master package: product vision, CW2-00, CW2-01 … CW2-08 (frozen), eight Final Freeze Reviews, architecture closure |
| `experience-architecture/core-checkpoint/` | `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` — historical upstream checkpoint (2026-09-03) |
| `experience-architecture/navigation-checkpoint/` | Navigation Canonical Checkpoint v1, the Stage 0–4 closure chain, with its Stage 3 foundation |
| `experience-architecture/stage5/` | Stage 5 Final Freeze Record, Stage 5.1 source package, approved final candidates, the 5.3 / 5.4 / 5.5 Architecture Freeze Addenda and the AMB-01 ruling |
| `experience-architecture/stage6/` | the 28 recovered Stage 6 authority files, the approved Stage 6.2 / 6.4 / 6.5 / 6.6 candidate sources, all eight Implementation Authority Bundle payload members (7 exact originals + 1 byte-exact equivalent), the recovery reconciliation and bundle map |
| `final-product-experience/i-08a/` | `I-08A4 — CLOSED / CANONICAL FREEZE COMPLETE`, the canonical Product Shell / IA / Naming foundation; later G1.1 / G1.2 amendments bind where they explicitly supersede it |
| `final-product-experience/i-08n/` | `I-08N-01 — CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN`; Product behavior only, not runtime implementation |

The Connected Worlds assurance finding `ASSURE-F05` is evidence, not authority. It is preserved separately in
[`../assurance/connected-worlds/`](../assurance/connected-worlds/README.md).
