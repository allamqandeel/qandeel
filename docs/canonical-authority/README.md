# QANDEEL — Recovered Canonical Authority

**Status:** `PRESERVATION RECORD — CREATES NO NEW AUTHORITY, NO NEW PRODUCT SEMANTICS`

This directory holds byte-exact copies of upstream canonical authority. Current repository runtime and
design records cite this authority, but its source files were never in GitHub. It was recovered from the
Product Owner's laptop on 2026-09-24 and preserved here unchanged.

**Start here:** [`CANONICAL_AUTHORITY_INDEX.md`](CANONICAL_AUTHORITY_INDEX.md) locates every domain.
[`RECOVERY_PROVENANCE.md`](RECOVERY_PROVENANCE.md) records where each file came from and how it was
verified.

## What this directory is not

- **Not a current entry point.** It records upstream history that later work built on. The current project state
  and next task are outside its scope.
- **Not an override.** A historical checkpoint or a frozen upstream source never outranks a later canonical
  record already in this repository: T-series amendments, the closed Connected Worlds runtime phases I-04 … I-07
  and their remediations, or the I-08B design closures. **Later amendments bind.**
- **Not the design-artifact store.** Final Product / design proofs (I-08B1, brand, typography, I-08B3.1 A–G)
  live in [`../design/canonical-artifacts/`](../design/canonical-artifacts/README.md). This directory holds the
  Experience Architecture chain (Stages 0–6) and the Connected Worlds v2 architecture that those runtime and
  design records consume.

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

The same check applies to `core-checkpoint/`, `navigation-checkpoint/` and `stage5/`, and to
`docs/assurance/connected-worlds/`.

## Layout

| Folder | Holds |
|---|---|
| `connected-worlds-v2/` | Connected Worlds v2 master package: product vision, CW2-00, CW2-01 … CW2-08 (frozen), eight Final Freeze Reviews, architecture closure |
| `experience-architecture/core-checkpoint/` | `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` — historical upstream checkpoint (2026-09-03) |
| `experience-architecture/navigation-checkpoint/` | Navigation Canonical Checkpoint v1, the Stage 0–4 closure chain, with its Stage 3 foundation |
| `experience-architecture/stage5/` | Stage 5 Final Freeze Record and the approved final Stage 5 sources it names |
| `experience-architecture/stage6/` | the 28 recovered Stage 6 authority files, the approved Stage 6.2 / 6.4 / 6.5 / 6.6 candidate sources, the recovery reconciliation and the Implementation Authority Bundle map |

The Connected Worlds assurance finding `ASSURE-F05` is evidence, not authority. It is preserved separately in
[`../assurance/connected-worlds/`](../assurance/connected-worlds/README.md).
