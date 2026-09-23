# Source provenance — G1.1-R3 and G1.2 Product proof sources

## G1.1: primary Product shell + Conversation + Navigation

| Evidence | Value |
|---|---|
| Closure | `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md`: **CLOSED / FROZEN** |
| Closure-recorded hash | "Reviewed R3 ZIP SHA-256: `0a56a2fbc836168f16fbb3860b1847002e1bdfb376188c7ce0e6b459b434fbcd`" |
| Local archive | `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-G1.1-R3-CONSOLIDATED-PRODUCT-CONVERSATION-REPLAY-CORRECTION.zip`, 34,054,775 B, 143 entries, SHA-256 **`0a56a2fbc836168f16fbb3860b1847002e1bdfb376188c7ce0e6b459b434fbcd`**, **equal** to the closure-recorded hash |
| Earlier G1.1 revisions | `…G1.1-PRIMARY-PRODUCT-SHELL-CONVERSATION-NAVIGATION-PROOF.zip` (`435a946d5a4932720c95e321c040a2fc14fbe14e52e775a6fb6d8c1c0ba04fac`) and `…G1.1-A1-CONVERSATION-SPEAKER-DIFFERENTIATION-CORRECTION.zip` (`0a7cff449a0279455651e0e716d6a2ee9d3c59843a07a82b7257cb0b498b2372`) are **superseded** by R3 and not preserved |

56 files were preserved under `g1.1-r3/`.

## G1.2: Voice + Live Conversation, background-safe

| Evidence | Value |
|---|---|
| Closure | `docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md`: **CLOSED / FROZEN AS PRODUCT + INTERACTION + BACKGROUND-CALL PROOF** |
| Closure-recorded hashes | reviewed proof ZIP `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96`, and final bounded **R1** correction ZIP `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11` |
| Local archive | `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-G1.2-VOICE-LIVE-CONVERSATION-BACKGROUND-SAFE-PROOF.zip`, 97,380,377 B, 283 entries, SHA-256 **`1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96`**, **equal** to the reviewed-proof hash |
| **R1 correction (final)** | `QANDEEL_I-08B3.1-G1.2-R1_DIRECT_CORRECTION.zip`, 43,890 B, SHA-256 **`2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11`**, **equal** to the closure-recorded R1 hash (also recorded in `docs/qandeel-canonical-backlog-v1.md`). It is in the project ChatGPT Library, was recovered by independent review, and is **not on the laptop**. Its `R1_MANIFEST.json` names the parent proof ZIP as `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96`, the archive preserved here |
| R1 content | stable singular **«العالم المشترك»** / **Shared World** regardless of count; no persistent normal-state call prose («الميكروفون شغّال», «الميكروفون مكتوم», «قنديل بيتكلم»), with transitional states still explained; normal call state carried by one dedicated assistive live-status channel (`#call-a11y`) and a mute control whose accessible label changes; microphone education on first need and recovery only. Icons, glyphs, the audio strip and the background / foreground call contract are byte-identical to the reviewed proof (R1-08 … R1-10) |
| R1 verified here | Applying `r1/R1_SOURCE_PATCH.diff` to the reviewed-proof `source/src/{build.mjs, content.mjs, runtime.js}` in a scratch copy yields **exactly** the three R1 files preserved here, byte for byte. All seven R1 files also match `r1/R1_MANIFEST.json` and the PR #265 patch manifest. `r1/R1_TARGETED_CHECKS.json` records 16/16 PASS; that run was **not** repeated here |

74 files are preserved under `g1.2/`:

- **Final R1 source:** `source/src/build.mjs`, `content.mjs`, `runtime.js`, replaced with the R1 bytes.
- **R1 record:** `r1/R1_CORRECTION_RECORD.md`, `R1_SOURCE_PATCH.diff`, `R1_TARGETED_CHECKS.json`,
  `R1_MANIFEST.json`, byte-exact from the R1 archive.
- **Reviewed proof (unchanged):** the other 67 files, byte-identical to their entry in the
  `1b297be9…` archive and to the loose folder. The closure keeps this proof as "the behavioral
  evidence of record".

**Pre-R1 build outputs kept as proof evidence.** R1 rebuilt the prototypes, but its archive carries
only the corrected source, so the rebuilt HTML is not preserved. The preserved
`prototype/index.html` and `prototype/index-voice-history.html` still show «مع الآخرين» and the
persistent «الميكروفون شغّال» line, and no prototype has the `#call-a11y` channel. They are rebuildable
from the R1 source with `source/REGENERATE.md`, and that was not done here because this task does
not build or render. Likewise `source/tools/checks.mjs` and `data/G12_CHECKS.json` still lock the
pre-R1 names (`shared: 'مع الآخرين'`). For the R1 source, `r1/R1_TARGETED_CHECKS.json` is the
verification of record.

The files that came through the PR #265 reconciliation patch are listed in
`../reconciliation/pr265-final-authority/PATCH_MANIFEST.json`. Hashes of every preserved file are in
[`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## What was preserved, and why that is enough

`prototype/*.html` (the built proof), `source/src`, `source/tools`, `source/REGENERATE.md`, the
`source/out/world/` crops (build **inputs**, cut byte-for-byte from F2's fixture renders),
`source/vendor/` (tokens byte-identical to the preserved B4R / C3 / D2R / E1R / F1R2 / F2R files,
the vendored `world.types.ts` canon, the colour and PNG helpers, and the Estedad OFL licence), `data/`, `source-notes/` and the reports. With these the prototypes can be
rebuilt and the checks re-run.

## Deliberately not preserved (still in the archives)

- `proof/**`: screens, boards and motion recordings. G1.1 has 32.6 MB, including 3 MP4s. G1.2 has
  95.8 MB, including 13 MP4s, which the G1.2 closure calls the behavioural evidence of record.
  Their hashes are in each package's `data/MANIFEST.json`.
- `source/vendor/Estedad-wght-v8.5.{ttf,woff2}`: font binaries, identified in
  `typography/SOURCE-PROVENANCE.md`.

## Superseded inside these sources (binding later records win)

| Preserved content | Superseded by |
|---|---|
| G1.1-R3 Product-area name «مع الآخرين» / "With others", count-dependent «عالم مشترك» / «عوالم مشتركة»; the same names in G1.2's pre-R1 prototypes, checks and reports | G1.2 closure §3, applied in the preserved G1.2 R1 source: stable singular **«العالم المشترك»** / **Shared World** |
| G1.2 pre-R1 persistent normal-call sentences («الميكروفون شغّال», «الميكروفون مكتوم», «قنديل بيتكلم») and duplicate live regions, still in the built prototypes | G1.2 closure §4 and §9, applied in the R1 source: prose removed; one assistive live-status channel |
| Any reading of G1.2 microphone education as repeating when permission is already granted | G1.2 closure §5 and §9. R1 records that the proof runtime already behaved as first-need / recovery only |
| G1.2 icons, glyphs and audio-strip morphology | G1.2 closure §6: **PROOF ONLY — NOT A VISUAL FREEZE** |
| Simplified Living Analysis image in both proofs | G1.1 closure §5: proof scaffolding. **G2** owns the spectacle |
| R3 Replay noun and selection / preview screens | G1.1 closure §5: the Replay noun stays editable, and `QAN-BL-NAV-02` stays open |
