# Source provenance — I-08B3.1-A World / Reading Neutral

## Authority

| Evidence | Value |
|---|---|
| Final local package | `I-08B3.1-A3R-CANONICAL-STATE-CORRECTION`. Chain on the host: A1 → A2 → A2R → A3 → **A3R** |
| What A3R changed | a documentation correction only (A3R-REV-01): QANDEEL is **dark-led, not dark-locked**. A3R's revision record says all 22 rasters and `A3_MEASUREMENTS.csv` are byte-identical to A3 |
| Director decisions after A3 | World `#101010` **selected**, Primary P1 `#d8d5ca` **selected**, P2 `#d2cfc4` retired. Secondary `#afaca3` remains. Tertiary `#8b8982` remains, but its application rule went to I-08B3.1-B and its accessibility expression to I-08B3.1-F |
| Where those decisions are durable | `../surfaces/i-08b3.1-b4r/docs/B4_FREEZE_RECORD.md` §1: "Carried unchanged from I-08B3.1-A (already frozen): WORLD `#101010`, primary reading `#d8d5ca`, secondary `#afaca3`, tertiary `#8b8982`". Also B4R `tokens/qandeel-surface.tokens.json` and B4 validation V-05 |

**Lifecycle, stated exactly.** I-08B3.1-A is recorded as frozen by the next phase's freeze record.
A3R's own documents describe the evidence, **not** the Director's selection, which came after them.
**The `A3R2 FINAL-STATUS-RECONCILIATION` package named by the preservation brief is NOT on this
host.** A recursive search found it under neither `E:\QANDEEL\QANDEEL PROJECT`, `E:\QANDEEL` nor
Downloads. If it exists elsewhere, it is the authority for A's final status wording, and this record
should be reconciled against it. Neither the values nor the evidence depend on it.

## Source archive (local, not in Git)

| Archive | Size (B) | Entries | SHA-256 |
|---|---:|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-A3R-CANONICAL-STATE-CORRECTION.zip` | 8,128,943 | 48 | `01b1b3cd94c021ac5cf6f822110430abeaea7934eaf9666851cb90de49cdaa6c` |

26 files (`docs/`, `tools/`, `fonts-info/`) were preserved, each byte-identical to its archive entry
and to the loose folder. Hashes are in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `review/**`: 22 boards and failure captures, 8.63 MB, kept in the archive.
- A1, A2, A2R and A3 packages and ZIPs: **superseded**. A3R carries A3's documents forward with the
  one correction, and A1–A2R are thesis-selection history the Director closed.

## Later amendments

- **I-08B3.1-B4R** decides the Secondary-versus-Tertiary application rule and the Surface.
- **I-08B3.1-F2R** derives the Light appearance of these values. Dark does not move.
