# Source provenance — I-08B3.1-A World / Reading Neutral

## Authority

| Evidence | Value |
|---|---|
| Final package | **`I-08B3.1-A3R2-FINAL-STATUS-RECONCILIATION`**, applied over the local A3R package. Chain: A1 → A2 → A2R → A3 → A3R → **A3R2** |
| What A3R changed | a documentation correction only (A3R-REV-01): QANDEEL is **dark-led, not dark-locked**. A3R's revision record says all 22 rasters and `A3_MEASUREMENTS.csv` are byte-identical to A3 |
| What A3R2 changed | one package-status contradiction (A3R2-REV-01). `docs/A3_MANIFEST.md` no longer states the A3-era "P1 and P2 are candidates" row as the current state, `tools/a3-package.mjs` can no longer regenerate it, and `docs/A3R2_REVISION_RECORD.md` was added. Rasters 0 of 22 changed; measurements, colours and decisions unchanged; A3 historical evidence not rewritten |
| Director decisions after A3 | World `#101010` **selected**, Primary P1 `#d8d5ca` **selected**, P2 `#d2cfc4` retired. Secondary `#afaca3` remains. Tertiary `#8b8982` remains, but its application rule went to I-08B3.1-B and its accessibility expression to I-08B3.1-F |
| Where those decisions are durable | `../surfaces/i-08b3.1-b4r/docs/B4_FREEZE_RECORD.md` §1: "Carried unchanged from I-08B3.1-A (already frozen): WORLD `#101010`, primary reading `#d8d5ca`, secondary `#afaca3`, tertiary `#8b8982`". Also B4R `tokens/qandeel-surface.tokens.json` and B4 validation V-05 |
| Consistency check | A3R2's own `docs/A3_MANIFEST.md` lists 48 files with SHA-256. All 26 of them that are preserved here match byte for byte; the other 22 are the excluded `review/` rasters. The one preserved file the manifest does not list is the manifest itself |

**Lifecycle, stated exactly.** A3R2's own status line reads "FINAL STATUS RECONCILIATION COMPLETE /
READY FOR DESIGN DIRECTOR FREEZE REVIEW / NOT FROZEN". The freeze was the Director's, made after it,
and it is recorded by the next phase's freeze record quoted above. The selected values do not depend
on A3R2; A3R2 makes the package's own status wording agree with them.

## Source archives (not in Git)

| Archive | Where | Size (B) | SHA-256 |
|---|---|---:|---|
| `I-08B3.1-A3R-CANONICAL-STATE-CORRECTION.zip` | `E:\QANDEEL\QANDEEL PROJECT\` | 8,128,943 | `01b1b3cd94c021ac5cf6f822110430abeaea7934eaf9666851cb90de49cdaa6c` |
| `I-08B3.1-A3R2-FINAL-STATUS-RECONCILIATION.zip` | project ChatGPT Library (recovered by independent review; **not on the laptop**) | 8,131,270 | `9663164db8325a6e3fff40f70264e9b07fb2196fbd388c1c73e7d96f30c03ee8` |

27 files (`docs/`, `tools/`, `fonts-info/`) are preserved. 24 are byte-identical to their A3R archive
entry and to the loose folder. The three A3R2 files (`docs/A3R2_REVISION_RECORD.md`,
`docs/A3_MANIFEST.md`, `tools/a3-package.mjs`) came through the PR #265 reconciliation patch
(`../reconciliation/pr265-final-authority/`) and match its `PATCH_MANIFEST.json`. The A3R2 archive
hash above is the one that patch records; it was not re-hashed here because the archive is not on
this host. Hashes are in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `review/**`: 22 boards and failure captures, 8.63 MB, kept in the archive.
- A1, A2, A2R and A3 packages and ZIPs: **superseded**. A3R carries A3's documents forward with the
  one correction, and A1–A2R are thesis-selection history the Director closed.

## Later amendments

- **I-08B3.1-B4R** decides the Secondary-versus-Tertiary application rule and the Surface.
- **I-08B3.1-F2 (FINAL_CANONICAL)** derives the Light appearance of these values. Dark does not move.
