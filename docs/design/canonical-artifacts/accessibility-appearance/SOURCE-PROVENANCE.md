# Source provenance — I-08B3.1-F1R2 Accessibility and I-08B3.1-F2 FINAL_CANONICAL Light Appearance

## F1 / F2 authority resolution

| Question | Finding |
|---|---|
| Final F1 | `I-08B3.1-F1-ACCESSIBILITY-TRANSFORMATIONS-SEMANTIC-PARITY.zip`, **revised in place twice** (F1R, then F1R2). SHA-256 `48bdbf9d…a84179ce`, 131 entries. The package `README.md` is headed **I-08B3.1-F1R2**. No other F1 archive exists. **Unchanged by the reconciliation** |
| Final F2 | **`I-08B3.1-F2-LIGHT-APPEARANCE-CROSS-APPEARANCE-INTEGRATION_FINAL_CANONICAL.zip`**, SHA-256 `6ca4744d5402108f67edf629fd45b7d3e1290391d50d0f73647b009b3dff8aaa` (16,880,606 B). It is in the project ChatGPT Library, was recovered by independent review, and is **not on the laptop**. It supersedes the laptop's F2R state (`e2a358aa…47ff4d13`), which is **not** preserved as final |
| What FINAL_CANONICAL changes against F2R | 7 files, of which 5 are preserved here: `README.md` (probe count 38/38 → 39/39), `docs/F2_FREEZE_CANDIDATE.md` (the five derivation heuristics `chroma-order`, `hue-constancy`, `hierarchy-is-a-ratio`, `suppression-is-subtraction` and `meaning-has-a-source` are demoted from Product contract to **production-default**; the Product contracts are the semantic requirements they serve), `data/F2_MANIFEST.json` and `docs/F2_MANIFEST.md` (re-hashed), and `vendor/f1/tools/f1-cdp.mjs` (Chrome launcher only: a `/usr/bin/chromium` candidate and the `--no-sandbox` / `--disable-dev-shm-usage` flags). The other 2 are review renders (`review/parity/dark-default.html`, `review/regression/f1-default-rerendered.html`) and are excluded like all of `review/`. **No token file changed** |
| Was that verified here? | Yes, against the package's own manifest. FINAL_CANONICAL's `data/F2_MANIFEST.json` lists 300 files with SHA-256. All 118 preserved files it can vouch for match byte for byte, including every token file. 180 are excluded (`review/` 176, the font, and two vendored F1 review PNGs plus the vendored font). The two remaining entries are the manifest pair describing itself (`data/F2_MANIFEST.json`, `docs/F2_MANIFEST.md`), which cannot match, and the same was true of F2R |
| F2 builds on F1R2 | `i-08b3.1-f2r/vendor/f1/` equals the preserved F1R2 files in **58 of 59**, re-hashed. The one difference is `tools/f1-cdp.mjs`, the Chrome-launcher change above; F1R2's own copy is unchanged. `data/F2_VENDOR.json` records each vendored file's source hash |
| What the closed Product proofs consumed | Every F1 and F2 token file vendored into the closed G1.1-R3 and G1.2 sources is **byte-identical** to the files preserved here (F1: base, dark and dark increased-contrast. F2: base appearance, light increased-contrast and all five `light/*` contexts). Those token files are the same in F2R and FINAL_CANONICAL |
| Final Light appearance | World `#efeeeb`, Functional Surface `#e7e6e3`, Living Brass `#7a6446`, Error `#ad4739`, Meaning family `#fff6df` / `#ddd4be` / `#bcb39e`, all present in `i-08b3.1-f2r/tokens/appearance/light/`. **Dark remains unchanged** |
| Lifecycle | **F1 CLOSED / FROZEN. F2 CLOSED / FROZEN. I-08B3.1-F — ACCESSIBILITY + ALTERNATE EXPRESSIONS CLOSED / FROZEN** |

**Where the F closure is recorded, stated exactly.** The FINAL_CANONICAL package's own bytes keep
their candidate voice: `README.md` says "REVIEW CANDIDATE. NOTHING HERE IS FROZEN. F IS NOT DECLARED
CLOSED BY THIS PACKAGE." and `docs/F2_FREEZE_CANDIDATE.md` ends the same way. The closure is the
Product Owner and independent-review decision that followed it. That decision is recorded in the PR
#265 reconciliation instructions, preserved byte-exact at
[`../reconciliation/pr265-final-authority/APPLY_INSTRUCTIONS.md`](../reconciliation/pr265-final-authority/APPLY_INSTRUCTIONS.md).
No standalone F closure record file was supplied.

**Mandatory gates carried forward after the F freeze** (`docs/F2_FREEZE_CANDIDATE.md`): a real
VoiceOver and TalkBack run in both appearances; real-device validation of the Light appearance;
Android appearance-change integration validation; and exhaustive accessibility mapping against the
real canonical `V` schema. They are implementation / release gates, **not** blockers to the F design
freeze.

## Source archives (not in Git)

| Archive | Where | Size (B) | Entries | SHA-256 | Role |
|---|---|---:|---:|---|---|
| `I-08B3.1-F1-ACCESSIBILITY-TRANSFORMATIONS-SEMANTIC-PARITY.zip` | `E:\QANDEEL\QANDEEL PROJECT\` | 7,628,950 | 131 | `48bdbf9dfd6bc66db80f4217b6c7ecb4503407322b67760f27ee02a1a84179ce` | final F1 (F1R2) |
| `I-08B3.1-F2-LIGHT-APPEARANCE-CROSS-APPEARANCE-INTEGRATION_FINAL_CANONICAL.zip` | project ChatGPT Library | 16,880,606 | 300 files per its manifest | `6ca4744d5402108f67edf629fd45b7d3e1290391d50d0f73647b009b3dff8aaa` | **final F2** |
| `I-08B3.1-F2-LIGHT-APPEARANCE-CROSS-APPEARANCE-INTEGRATION.zip` | `E:\QANDEEL\QANDEEL PROJECT\` | 16,957,548 | 300 | `e2a358aa06da69935cac7a316ce4c7abe77f3564073c85e946ca0dc947ff4d13` | F2R, superseded; source of the 115 unchanged files |

Preserved: F1R2 92 files and F2 120 files. F1R2's 92 files and 115 of the F2 files are
byte-identical to their laptop archive entry and to the loose folder. The 5 FINAL_CANONICAL files came
through the PR #265 reconciliation patch (`../reconciliation/pr265-final-authority/`) and match its
`PATCH_MANIFEST.json`. The FINAL_CANONICAL archive hash above is the one that patch records; it was
not re-hashed here because the archive is not on this host. The loose F1 folder carries 84 more
files than its sealed archive (`review/src/**`, added after sealing). They were not taken, because
the sealed archive is the authority. Hashes are in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- F1: `review/**` (boards, parity, spectacle, screen-reader and inherited references, 8.58 MB with
  the font) and `fonts/Estedad[wght].ttf`.
- F2: `review/**` (24 boards, 32 parity renders, regression, switch and fixture sources, about
  20 MB), including the two review HTML files FINAL_CANONICAL changed; the vendored F1 review PNGs;
  and `fonts/Estedad[wght].ttf`.
- The F2R state as a separate copy: **superseded** by FINAL_CANONICAL for the 5 changed files.
- All of these remain in the archives above. The fonts are identified by hash in
  `typography/SOURCE-PROVENANCE.md`.

## Later amendments (binding)

- **G1.1 closure**: "system appearance — no in-app override". The scrim stays black (G1.1 source
  trace, inherited from F2R).
- **G1.2 closure / R1**: accessibility behaviour of the Live Call status (one assistive live-status
  channel). This is Product behaviour, and no F token changes.
- Real-device VoiceOver / TalkBack validation remains an implementation gate (G1.1 §5, G1.2 §7).
