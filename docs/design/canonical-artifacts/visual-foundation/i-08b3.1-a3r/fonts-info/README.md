# Font provenance — I-08B3.1-A1

The font binary is **not redistributed in this package.** Only its identity, its hash and
its licence travel here, which is enough to verify that the boards in `review/` were set in
the face they claim and to reproduce them from a local copy.

## The face

| | |
|---|---|
| Family | Estedad |
| Version | **v8.5** |
| File | `Estedad[wght].ttf` — variable, `wght` axis 100–900 |
| SHA-256 | `3134e31a27d58e615967e714c7799fbfa2de952876f8597b33dc57ffe0e99d03` |
| Size | 284,180 bytes |
| Upstream | https://github.com/aminabedi68/Estedad |
| Licence | SIL Open Font License 1.1 — see `LICENSE-OFL.txt` |
| Copyright | 2022 The Estedad Project Authors |

Estedad v8.5 is frozen by the I-08B3.0 Visual Foundation Contract. This package does not
choose it, evaluate it or vary it; it only needs it to be demonstrably present, because a
World and a reading neutral can only be judged against the actual letterforms that will sit
on them.

## Why a hash and not the file

The OFL permits redistribution, so shipping the binary would have been allowed. It is left
out because this is an analytical review package: the font is an input to the boards, not a
deliverable of them, and a reviewer comparing colours has no use for a 278 KB binary. The
hash lets anyone confirm they are reproducing with the identical file.

To rebuild the boards, place the file at the path `tools/ui.mjs` expects — or edit the `TTF`
constant to point at a local copy — and check the hash matches before trusting any output.

## How activation is proved, every time

Chrome activates an `@font-face` only when something in the *parsed* document already uses
the family. `document.fonts.ready` resolves and `document.fonts.check()` returns `true` even
when the face was never fetched, so a board can lay out, rasterise and look completely
finished while set in a substituted system face. That failure has shipped silently in this
project before.

So every page in this package embeds a hidden probe that sets one Arabic string at 100px in
weights 400, 500 and 600, and the renderer refuses to accept a screenshot unless the three
measured widths match a pinned fingerprint:

```
weights   [400,     500,     600    ]
expected  [1695.5,  1702.31, 1706.5 ]   ± 1.0 px
```

Three *different* expected widths is itself part of the check — if the variable `wght` axis
were not being applied, all three would come back identical. This host's fallback face
measures 1386.58px, which is tested for by name so the failure message can say what went
wrong rather than just that a number was off.

Measured during the run that produced `review/`: **`[1695.5, 1702.31, 1706.5]`, zero drift.**

Run `node tools/verify-host.mjs` to re-check activation, and the colour fidelity of the
renderer, before trusting a rebuild.
