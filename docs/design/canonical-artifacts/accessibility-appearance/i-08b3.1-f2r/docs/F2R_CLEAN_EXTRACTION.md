# I-08B3.1-F2R — VERIFICATION FROM A CLEAN EXTRACTION

## What went wrong

An independent extraction of the F2 archive on Linux produced **30/33**, while every record *inside*
that archive said PASS. The three failures were `D-01`, `P-01` and `S-01` — the delegated gates —
and none of them was about the design.

Each asserted that a delegated record was **newer than the token tree it was about**. That is a
freshness test built on filesystem modification times, and a ZIP entry carries a whole-second DOS
timestamp; this archive writes a **zero** timestamp, so every extracted file lands on the same
instant. Whether the ordering survives depends on the unzip tool, the filesystem's timestamp
resolution and the order the entries happened to be written.

> **An mtime ordering is a claim about the machine that produced the files, not about the files.**

The underlying gates had all passed. The package failed a reviewer's extraction for a reason that had
nothing to do with what it claims.

## What replaced it

`tokenTreeDigest()` in `tools/f2-resolve.mjs`: a sha256 over every file under `tokens/`, each
contributing its **path and its bytes**, sorted, with separators normalised to `/` so a Windows tree
and a Linux tree of the same content hash identically.

Four gates stamp that digest into their records — `tools/f2-regression.mjs`, `tools/f2-parity.mjs`,
`tools/f2-switch.mjs` and `tools/f2-boards.mjs` — and `tools/f2-verify.mjs` compares the stamp
against the digest of the tree in front of it. **Every use of `mtime` is gone.**

Check `K-04` asserts the binding and probes it by mutating one byte of one token file: the digest has
to move, or the mechanism is a field in a JSON file rather than a test.

> **This is not only portable, it is stricter.** During F2R's own final pass the verifier reported
> `D-01` and `P-01` as being about an older tree — correctly, because two token files had been edited
> for prose after those gates ran. An mtime ordering would have been *satisfied* by exactly that
> situation, since the records were older than the edits in the direction it wanted. Content identity
> caught a real staleness the clock-based rule was built to miss.

## The proof

Not a simulation of the failure condition — the failure condition itself, made worse on purpose.

### 1. The archive

**300 entries.** Its SHA-256 is deliberately *not* quoted here, and the reason is worth a sentence:
**an archive cannot contain its own hash.** Writing the figure into this document changes the
document, which changes the archive, which changes the figure. `tools/f2-zip.mjs` prints the digest
of the archive it has just built, and that is where the number belongs — in the transmittal, not in
the payload. `data/F2_MANIFEST.json` carries a hash for every *file*, which is the part that can be
self-describing without contradiction.

The proof below was run twice: once on the archive as it stood before this document existed, and
again on the shipped archive, which differs from it only by this file. Both produced the same result.

### 2. Extracted into an empty directory

300 files, and the timestamps came out exactly as the Linux report implies. Grouping every extracted
file by its modification time returns **one group**:

```
1979-12-31T22:00:00.0000000Z   x300
```

**Every file in the package carries the same modification time** — the zero DOS timestamp this
archive writes, read back through the extractor's local offset. There is no ordering to read.

> **One correction belongs here rather than being quietly fixed.** An earlier draft of this document
> quoted a transcript line reading `distinct modification times: 1`, and the script had printed
> `300`. The *fact* was right and the *quotation* was invented: PowerShell returns a single
> `GroupInfo`'s own `Count` when you ask a scalar for `.Count`, so the measurement script was reading
> the size of the one group rather than the number of groups. The figure above is the re-measured
> one. A package that has just added a guard against quoted numbers nobody measured
> (`tools/f2-consistency.mjs`, claim C7) should say when it catches itself doing it in a place that
> guard cannot see — C7 checks `dEok` figures, and this was a file count in a fenced block.

### 3. Then the ordering was INVERTED

Reproducing "the mtimes are equal" only shows the old rule has nothing to read. So the extracted copy
was stamped adversarially:

```
data/**   -> 2020-01-01   (the records)
tokens/** -> 2030-01-01   (the tree they are about)
```

Every token file is now **ten years newer** than every record about it. Under the ordering F2 shipped,
`D-01` / `P-01` / `S-01` fail here by construction — not by chance, and not depending on the unzip
tool.

### 4. The verifier, run inside the extracted copy

```
38/38 checks, 39/39 probes rejecting — PASS
verifier exit code: 0
```

`D-01`, `P-01`, `S-01` and `K-04` all pass, because the question they now ask is *"is this record
about the bytes in front of me"* and the answer does not depend on a clock, a filesystem, an operating
system or an archiver.

## What this does and does not establish

- **It does establish** that extraction on a platform where mtimes are equal, unordered, or inverted
  no longer affects the result, and that the check which used to fail is the check that now passes.
- **It does not establish** that the package was run on Linux. The extraction and the verification
  were both performed on the same Windows host, with the timestamp semantics of the failing case
  reproduced deliberately and then made stricter. The *cause* is removed and demonstrated removed;
  an independent Linux run remains the reviewer's to make, and is expected to produce 38/38.
- **It does not need a browser.** The verifier is arithmetic over the resolved token tree plus the
  four delegated records, so a clean extraction can be verified without Chrome. Reproducing the
  *rendered* evidence — the boards, the parity matrix, the switch proof — does need one.
