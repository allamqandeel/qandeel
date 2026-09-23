# Font provenance — I-08B3.0-E3

**The typeface is not under test in E3.** Estedad v8.5 is the accepted QANDEEL typography foundation and
this package tests only the type *system* proposed around it. This directory exists so the boards can be
reproduced from exactly the binary that made them.

## No binary is redistributed here

The SIL Open Font License 1.1 would permit redistribution — Estedad carries no Reserved Font Name, so even a
modified derivative could be shipped under a different name. It is omitted anyway, because the review need is
the boards and the report, and provenance plus a hash reproduces the exact input without shipping 284 KB of
font into a review package. `LICENSE-OFL.txt` is the licence as distributed with the family, kept here so the
terms travel with the provenance.

If a reviewer needs the binary, `SOURCES.lock.json` gives the release tag and the SHA-256 to verify against.

## What was used

| | |
|---|---|
| Family | Estedad |
| Version | `Version 8.5`, read from the binary's own `name` table (ID 5) |
| Source of record | `github.com/aminabedi68/Estedad`, release tag `8.5` |
| File | `Estedad[wght].ttf` — the variable font, `wght` 100..900 |
| Bytes | 284,180 |
| SHA-256 | `3134E31A27D58E615967E714C7799FBFA2DE952876F8597B33DC57FFE0E99D03` |
| Weights instantiated | 400, 500, 600 only |
| Licence | SIL OFL 1.1, read from `name` ID 13 — free, open-source, embeddable in a commercial app |

## A note on which copy

Estedad is also published on Google Fonts. That copy reports the same `Version 8.5` and the same glyph count
but is **not byte-identical** to the upstream release (328,340 bytes against 284,180). This package used the
**upstream release binary**, hashed above. If the product later loads the Google Fonts copy — via a hosted
webfont or a platform font provider — the version string will match but the bytes will not, so the hash here
is the one that identifies what produced these boards.

## Known issues inspected

Four open upstream issues were read. Two were reproduced and measured in this package rather than repeated:
**#39 (mark-to-base)** — confirmed, with the issue's codepoint corrected — and **#44 (Latin `i`)** — does not
reproduce in a modern shaping engine. Findings are in `SOURCES.lock.json` and §12 of the report.
