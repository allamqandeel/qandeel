# G3 Product proof — I-08B3.1-G3 (final: G3.2)

This folder holds the final accepted integrated Product-coherence proof of the G line. What was decided lives in the
canonical records, not in the preserved files:

- `docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`: G3 and parent G closure;
- `docs/design/i-08b3.1-g3/T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md`: the temporal line belongs to the
  Timeline;
- `docs/design/i-08b3.1-g3/G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md`: Q-LIGHT-SHELL resolved.

## What is here

**`g3.2/`: the complete reviewed G3.2 package, byte-exact.** It holds all 145 files of
`I-08B3.1-G3.2-TARGETED-COHERENCE-REFINEMENT.zip`, with only the outer ZIP container removed:

| Path | What it is |
|---|---|
| `g3.2/prototype/index.html` | the self-contained offline proof build, `10611f35…83d71`. Open it from disk in Chrome. `g3.2/README.md` lists its parameters |
| `g3.2/source/` | the build inputs, tools and vendored canon. It rebuilds the prototype byte-identically (`source/REGENERATE.md`), and it also rebuilds G3.1's reviewed prototype from `vendor/upstream-g31/` |
| `g3.2/data/` | the checks (29 / 29), the planted-build probes (10 / 10 rejected), the real-input run (38 / 38), the state matrix, and the motion truth logs |
| `g3.2/boards/` | the 12 review boards |
| `g3.2/motion/` | the 7 motion clips, H.264 at 30 fps |
| `g3.2/docs/` | the package's decisions, reconciliation, findings, open questions and Skill use, as reviewed |
| `g3.2/README.md`, `g3.2/MANIFEST.json` | the package's own README and integrity record (144 files by bytes and SHA-256) |

[`SOURCE-PROVENANCE.md`](SOURCE-PROVENANCE.md) records where it came from and how it was checked.
[`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256) lists every preserved file.

## Read before reuse

- **Status wording.** The package calls itself "READY FOR INDEPENDENT PRODUCT REVIEW … not closed, not frozen". The G3
  closure record is its lifecycle authority, and it binds on the merge of the pull request that carries it.
- **Decision wording.** `g3.2/docs/G3.2_PRODUCT_DECISIONS_PROVED.md` states Decisions A and B as candidates. The two
  amendments above are the canonical wording.
- **The world-floor number.** Two passages of candidate prose describe the tightest case as sitting on its 160 pt
  floor. The final check data (`g3.2/data/CHECKS.json`, K14) records 161 pt against 160 pt, and the canonical records
  use that.
- **Proof copy stays open.** The Matching proof lines and the other open copy are not frozen by being preserved here.
- **Browser evidence only.** VoiceOver / TalkBack, native status-bar behaviour and device background behaviour are not
  validated by this proof.
