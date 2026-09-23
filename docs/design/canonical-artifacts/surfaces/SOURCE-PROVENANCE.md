# Source provenance — I-08B3.1-B4R Surface / Content Hierarchy

## Authority

| Evidence | Value |
|---|---|
| Final package | `I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL`. Chain on the host: B0 → B0R → B1 → B1R → B2 → B2R → B3 → B3R → B4 → **B4R** |
| Which B4 / B4R records are jointly authoritative | **B4R alone.** B4R carries every B4 document forward. `B4_FREEZE_RECORD.md` says "Every canonical value in this record is byte-identical to B4's, verified file by file". B4R's changes are the DTCG resolver-document shape and a React Native API-scope correction. Re-verified by hash: `tokens/base/semantic.tokens.json` and `tokens/appearance/dark.tokens.json` are identical in B4 and B4R, and `qandeel-surface.resolver.json` differs, which is the B4R fix |
| Proposed freeze text | `docs/B4_FREEZE_RECORD.md` §1: "I-08B3.1-B — SURFACE / CONTENT HIERARCHY — CLOSED / FROZEN" (Surface `#181818`, PASSAGE scrim black at 0.50, OPAQUE MATTE, one-tone rule) |
| Downstream freeze ledger | `accessibility-appearance/i-08b3.1-f1r2/README.md`: `I-08B3.1-B4R  Surface  FROZEN` |
| Downstream use | B4R `semantic` and `dark` tokens are vendored **byte-exact** into the closed G1.1-R3 and G1.2 sources (`product-proofs/*/source/vendor/tokens/`) |

**Lifecycle, stated exactly.** FROZEN per the downstream ledger, which is also this package's
proposed freeze text. The package itself says "This document does not freeze anything. A freeze is
a Design Director decision." **The `B2R2` and `B3R2` packages named by the preservation brief are
NOT on this host.** B4R supersedes the proof chain they would belong to.

## Source archive (local, not in Git)

| Archive | Size (B) | Entries | SHA-256 |
|---|---:|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL.zip` | 2,202,819 | 72 | `68fb674ba392cf308f86f6c4f05cb6a68c94607c9e59349f737f39ad9728ee76` |

58 files were preserved, each byte-identical to its archive entry and to the loose folder. Hashes are
in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `review/integration/*.png`: 14 model-versus-token integration renders, 2.16 MB, kept in the
  archive. `B4_VALIDATION_RESULTS.md` records their byte-identity result.
- B0, B0R, B1, B1R, B2, B2R, B3, B3R and B4 packages and ZIPs: **superseded** proof and stress chain.
  B4R carries the surviving contract. B3R's accessibility-transformation contract continues in F1R2.

## Later amendments (binding)

- **G1.1 `UTTERANCE`**: `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md`
  §3. It adds the fifth Surface role, the alias
  `qandeel.role.utterance.fill = {qandeel.surface.functional}` and the amended earning-test clause
  ("Exactly one of `APPARATUS`, `ASIDE`, `PASSAGE`, `FIELD` or `UTTERANCE` must apply"). The
  preserved B4R files are **not** edited. G1.2 vendors the alias as
  `product-proofs/g1.2/source/vendor/tokens/base/g11.utterance.alias.tokens.json`.
- **I-08B3.1-F2R** fills B4R's declared-empty `light` appearance context
  (`accessibility-appearance/i-08b3.1-f2r/tokens/appearance/light/b4r.light.tokens.json`).
