# Source provenance — I-08B3.1-F1R2 Accessibility and I-08B3.1-F2R Light Appearance

## F1 / F2 authority resolution

| Question | Finding |
|---|---|
| Final F1 on this host | `I-08B3.1-F1-ACCESSIBILITY-TRANSFORMATIONS-SEMANTIC-PARITY.zip`, **revised in place twice** (F1R, then F1R2). SHA-256 `48bdbf9d…a84179ce`, 131 entries. The package `README.md` is headed **I-08B3.1-F1R2**. No other F1 archive exists on disk |
| Final F2 on this host | `I-08B3.1-F2-LIGHT-APPEARANCE-CROSS-APPEARANCE-INTEGRATION.zip`, **revised in place by F2R**. SHA-256 `e2a358aa…47ff4d13`, 300 entries. It carries `docs/F2R_REVISION.md` and `docs/F2R_CLEAN_EXTRACTION.md`. The pre-F2R F2 archive (`3a103fa6…`, 298 entries) no longer exists on disk |
| F2R builds on F1R2 | `i-08b3.1-f2r/vendor/f1/` is **byte-identical** to the preserved F1R2 files (59 of 59 re-hashed), and `data/F2_VENDOR.json` records each one's source hash |
| **`…_FINAL_CANONICAL.zip`** | **NOT ON THIS HOST.** A recursive search found no file named `*FINAL_CANONICAL*`, `*FINAL-CANONICAL*` or `(1)/(2)/(3)` under `E:\QANDEEL\QANDEEL PROJECT`, `E:\QANDEEL` or Downloads |
| What the closed Product proofs consumed | G1.1's source trace names "I-08B3.1-F1 / F1R2" and "I-08B3.1-F2 / F2R". Every F1 and F2 token file vendored into the closed G1.1-R3 and G1.2 sources is **byte-identical** to the files preserved here (F1: base, dark and dark increased-contrast. F2: base appearance, light increased-contrast and all five `light/*` contexts) |
| Lifecycle | F1: "treated as CLOSED / FROZEN per the F2 brief" (F2 `README.md`). F1R2's own voice is "REVIEW CANDIDATE". F2R's own voice is "REVIEW CANDIDATE … F IS NOT DECLARED CLOSED BY THIS PACKAGE". **No record on this host closes I-08B3.1-F.** The F2 closure is presumably the missing `FINAL_CANONICAL` package |

**Decision.** The F1R2 and F2R sealed states are preserved as the **latest local authority**. They are
exactly the bytes the closed G1 proofs run on. Treat the domain as **PARTIALLY BLOCKED**. If the
`FINAL_CANONICAL` package exists elsewhere and differs from `e2a358aa…47ff4d13`, it supersedes F2R and
must be preserved in its place.

## Source archives (local, not in Git)

| Archive | Size (B) | Entries | SHA-256 |
|---|---:|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-F1-ACCESSIBILITY-TRANSFORMATIONS-SEMANTIC-PARITY.zip` | 7,628,950 | 131 | `48bdbf9dfd6bc66db80f4217b6c7ecb4503407322b67760f27ee02a1a84179ce` |
| `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-F2-LIGHT-APPEARANCE-CROSS-APPEARANCE-INTEGRATION.zip` | 16,957,548 | 300 | `e2a358aa06da69935cac7a316ce4c7abe77f3564073c85e946ca0dc947ff4d13` |

Preserved: F1R2 92 files and F2R 120 files. Each is byte-identical to its archive entry and to the
loose folder, and the hashes are in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256). The loose
F1 folder carries 84 more files than its sealed archive (`review/src/**`, added after sealing). They
were not taken, because the sealed archive is the authority.

## Deliberately not preserved

- F1: `review/**` (boards, parity, spectacle, screen-reader and inherited references, 8.58 MB with
  the font) and `fonts/Estedad[wght].ttf`.
- F2: `review/**` (24 boards, 32 parity renders, regression, switch and fixture sources, about
  20 MB), the vendored F1 review PNGs and `fonts/Estedad[wght].ttf`.
- All of these remain in the two archives above. The fonts are identified by hash in
  `typography/SOURCE-PROVENANCE.md`.

## Later amendments (binding)

- **G1.1 closure**: "system appearance — no in-app override". The scrim stays black (G1.1 source
  trace, inherited from F2R).
- **G1.2 closure**: accessibility behaviour of the Live Call status (one assistive live-status
  channel). This is Product behaviour, and no F token changes.
- Real-device VoiceOver / TalkBack validation remains an implementation gate (G1.1 §5, G1.2 §7).
