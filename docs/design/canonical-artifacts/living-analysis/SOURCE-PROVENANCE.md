# Source provenance — I-08B1 Living Analysis World (FAR / MID / NEAR)

## Authority

| Evidence | Value |
|---|---|
| Closure record | `I-08B1-CANONICAL-STATE.md`: **I-08B1 — CORE VISUAL THESIS / VISIBLE MIND — CLOSED / FROZEN**, 2026-09-20 |
| Closure manifest | `manifests/I-08B1-CANONICAL-CLOSURE.manifest.txt`, kept outside the ZIP it describes |
| Final unified source | `wf-living-constellation.html`, 388,374 B, SHA-256 `4dfd9d27d752c3a445168c0cc7067d71df4ada84bc61b806d12c8bb3202bc413`, the value recorded in all three manifests |
| FAR (A = 0) | APPROVED / FROZEN / CANONICAL at the unified SHA. Notes §26 (reconstruction), §27 (motion review PASS), §28 (freeze) |
| MID (A = 0.5) | APPROVED / FROZEN / CANONICAL baseline `6d8efdbcf155bcf6bdcb83caf9f32d54f88aac3e8eb6585312048b23a1aebff6`. Notes §25 |
| NEAR (A = 1) | APPROVED / FROZEN baseline `7d7d5b5502d7b18d6d35f89f8a2db74213a55851f65dc98068fec6a726e39a34`. Notes §16 |
| Reproduction proof | the unified source reproduces MID and NEAR to **0 of 2,480,100 px**. The FAR window is exactly 0 for every A ≥ 0.12 (eleven values of A, 0 of 1,101,800 px each) |

Lineage re-verified on disk. WS7 → WS7R / WS7R-C → WS7R-V / V2 (NEAR baseline) → WS7R-M / M2 / M2b
(first MID baseline `5225b460…`, later **superseded by Product override**) → WS7R-Q (**rejected**,
never archived) → WS7R-R (accepted MID) → WS7R-F (accepted FAR + unified prototype) → I-08B1
closure (same unified prototype). The closure manifest records all of this, and every hash cited
above was recomputed from the sealed archives.

## Sources

| Preserved path (under `i-08b1/`) | Taken from (sealed archive ! entry) |
|---|---|
| `wf-living-constellation.html`, `I-08B1-CANONICAL-STATE.md`, `I-08B1-WS7R-NOTES.md`, `I-08B1-WS7R-SKILL-USE.md`, `ws7rf-far-hero.png`, `ws7rr-mid-hero.png`, `ws7rv2-near-hero.png` | `design-workshops\I-08B1-CANONICAL-CLOSURE.zip` (all 7 entries: the closure's own minimum set) |
| `tools/board-server.mjs`, `tools/ws7rq-measure.js`, `tools/ws7rr-boards.js` | `design-workshops\I-08B1-FAR-BASELINE-APPROVED-WS7R-F.zip` |
| `baselines/mid-6d8efdbc/wf-living-constellation.html` | `design-workshops\I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` |
| `baselines/near-7d7d5b55/wf-living-constellation.html` | `design-workshops\I-08B1-NEAR-BASELINE-APPROVED.zip` |
| `manifests/*.manifest.txt` | loose files in `design-workshops\`. They are kept outside the archives by design |

| Archive (local, **not in Git**) | Size (B) | SHA-256 |
|---|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\design-workshops\I-08B1-CANONICAL-CLOSURE.zip` | 15,966,242 | `9872271d7c7f8006078e076e164ade67dfe3f4151897887ddf870d80e1819c62` |
| `…\design-workshops\I-08B1-FAR-BASELINE-APPROVED-WS7R-F.zip` | 35,175,221 | `279e4a10c8bec9b337443ea6a559ebada84e8a819b769316ced8b899818651df` |
| `…\design-workshops\I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` | 33,017,826 | `733d01750fbcb1553c4f53b36e99374abbe09136ddcea1713ac127864501fa15` |
| `…\design-workshops\I-08B1-NEAR-BASELINE-APPROVED.zip` | 30,975,534 | `5a7f8e6d1a5e66b7bc4128c1894ff151b79b4849b13155fe80a5e415b81c85ea` |

Every preserved file is byte-identical to its archive entry and to the loose copy in
`design-workshops\I-08B1-WS7R\`. Per-file SHA-256 values are in
[`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Non-final material kept, and why

- **`baselines/mid-6d8efdbc/` and `baselines/near-7d7d5b55/`.** Product ruled at closure that a
  distance's baseline is an accepted **state**. A unified file that reproduces that state to 0 px
  does not retire the SHA that recorded it (closure manifest: "The NEAR and MID baselines are NOT
  superseded by the unified prototype carrying a later hash"). Without these two files the
  reproduction claim could not be re-checked.
- **`tools/`.** These are the measurement and board harnesses the preservation diffs ran on
  (`__qDiff`, `__qSettle`, `__rParity`). Without them the 0-px claim could not be reproduced.

## Deliberately not preserved (still on the laptop)

- Superseded MID baseline `5225b460…` and its archive `I-08B1-MID-BASELINE-APPROVED.zip`
  (38,476,144 B, `01fe469ceac18821bc9c468216cdf1ebb26b3ceb8355b7804dc1f2028c3c00f5`): historical,
  non-canonical.
- Workshop archives `I-08B1-WS4.zip`, `-WS5`, `-WS6`, `-WS7`, `-WS7R` and the folders
  `I-08B1-WS4` to `I-08B1-WS7`: intermediate.
- Old WS7R-C / WS7R-M / WS7R-Q / WS7R-V boards and heroes in `I-08B1-WS7R\`: superseded, not final
  evidence.
- Continuity boards `ws7rf-far-to-mid.png` and `ws7rf-old-vs-new.png`, and Product reference images
  `ws7rr-reference-01.png` and `ws7rr-reference-02-micro.png`. These informed the design but are not
  needed to verify the final source. They remain inside the FAR and MID archives above.

## Later amendments

None to the visual thesis. The closure is **not** a port. The Skia / Reanimated port,
responsive / device-class work and downstream Product tasks remain open. G1.1 §5 records that
**G2** owns the final Living Analysis spectacle in the Product. The reopen rule in
`I-08B1-CANONICAL-STATE.md` still binds.
