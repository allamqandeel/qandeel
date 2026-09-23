# QANDEEL — Local-Only Canonical Artifact Audit

**Status:** `AUDIT RECORD — PRESERVATION TASK, 2026-09-23. NO REDESIGN, NO RENDER.`

**Scope:** `E:\QANDEEL\QANDEEL PROJECT`, searched recursively. `E:\QANDEEL` and the user's Downloads
folder were checked only for the named packages the brief expected and the root did not contain.
**Canonical `main` at audit:** `d1be3263cf91b969e4c29456e325ec8eece10d8b`.

## A. Root inventory (Phase A, read-only)

| Category | Count | Notes |
|---|---:|---|
| Archives at the project root | 42 | 478,691,566 B. 40 are `I-08B2.x` / `I-08B3.x` packages and 2 are Phase VI-03-04 / 04R |
| Archives in `design-workshops\` | 10 | 387,522,210 B. I-08B1 WS4–WS7R, the MID / NEAR / FAR baselines and the closure |
| External `*.manifest.txt` in `design-workshops\` | 4 | closure, FAR, MID-WS7R-R and superseded MID |
| Extracted `I-08*` package folders at the root | 40 | one per archive |
| `.i08b*-work\` folders | 28 | build and work scratch, including reruns and render outputs. Never an authority |
| `design-workshops\I-08B1-WS*\` folders | 5 | WS4, WS5, WS6, WS7, WS7R |
| Untracked Markdown reports at the root | 12 | `CW01_*` (5), `CW02_*` (3), `QANDEEL_CONNECTED_WORLDS_*` (3), `QANDEEL_VI03_03_*` (1) |
| Untracked files overall (outside `node_modules`, `.git`, `dist`) | ≈25,400 | mostly `.i08b*-work` outputs and extracted packages |

Every candidate archive was hashed (SHA-256). The hashes appear in the table in section B and in
each domain's `SOURCE-PROVENANCE.md`.

### Chronology by domain (last-write time, all 2026)

| Domain | Chain on disk (→ = later) |
|---|---|
| I-08B1 Living Analysis | WS4 (09-19 20:26) → WS5 → WS6 → WS7 (22:24) → WS7R (09-20 00:28) → NEAR baseline (01:58) → MID baseline, superseded (03:15) → MID WS7R-R (13:51) → FAR WS7R-F (14:32) → **CANONICAL-CLOSURE (14:33)** |
| I-08B2 Brand | B2.2 (09-20 15:08) → B2.2-REV1 (15:29) → B2.3 (16:14) → B2.4 (16:58) → **B2.5 (17:25)** |
| I-08B3.0 Typography | E1 comparative (18:25) → **E3 system (19:09)** |
| I-08B3.1-A | A1 (20:01) → A2 (20:50) → A2R (21:01) → A3 (21:32) → **A3R (21:42)** |
| I-08B3.1-B | B0 (22:19) → B0R (22:47) → B1 (23:48) → B1R (09-21 00:19) → B2 (08:57) → B2R (09:16) → B3 (10:28) → B3R (11:02) → B4 (11:37) → **B4R (12:35)** |
| I-08B3.1-C | C0 (18:23) → C0R (18:46) → C1 (19:28) → C1R (20:01) → C2 (20:56) → **C3 (21:53)** |
| I-08B3.1-D | D0 (23:17) → D0R (23:53) → D1 (09-22 01:01) → D2 (02:46) → **D2R (09:28)** |
| I-08B3.1-E | **E1, revised in place to E1R (11:14)** |
| I-08B3.1-F | **F1, revised in place to F1R and then F1R2 (13:35)** → **F2, revised in place to F2R (09-23 01:05)** |
| I-08B3.1-G1.1 | primary (10:08) → A1 speaker correction (10:56) → **R3 consolidated (12:31)** |
| I-08B3.1-G1.2 | **reviewed proof (14:30)**. R1 not present |

## B. Authority table (Phase B)

`PRESERVE FINAL` was the only decision that led to copying. The **evidence** column names the
strongest proof. Timestamps never decided anything.

| Domain / layer | Final authority candidate | SHA-256 | Closure evidence | Already in GitHub? | Decision |
|---|---|---|---|---|---|
| A · I-08B1 unified source + closure | `I-08B1-CANONICAL-CLOSURE.zip` | `9872271d7c7f8006078e076e164ade67dfe3f4151897887ddf870d80e1819c62` | `I-08B1-CANONICAL-STATE.md`: CLOSED / FROZEN. External manifest | No | **PRESERVE FINAL** |
| A · FAR | unified source + FAR manifest + reference hero | `279e4a10c8bec9b337443ea6a559ebada84e8a819b769316ced8b899818651df` (archive) | FAR manifest: APPROVED / FROZEN / CANONICAL | No | **PRESERVE FINAL** (source, manifest, hero, tools) |
| A · MID baseline `6d8efdbc…` | `I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` | `733d01750fbcb1553c4f53b36e99374abbe09136ddcea1713ac127864501fa15` | closure: baselines "NOT superseded" | No | **HISTORY REQUIRED** (baseline prototype + manifest) |
| A · NEAR baseline `7d7d5b55…` | `I-08B1-NEAR-BASELINE-APPROVED.zip` | `5a7f8e6d1a5e66b7bc4128c1894ff151b79b4849b13155fe80a5e415b81c85ea` | same | No | **HISTORY REQUIRED** (baseline prototype) |
| A · superseded MID `5225b460…` | `I-08B1-MID-BASELINE-APPROVED.zip` | `01fe469ceac18821bc9c468216cdf1ebb26b3ceb8355b7804dc1f2028c3c00f5` | closure: "SUPERSEDED MID … historical / non-canonical" | No | **SUPERSEDED — DO NOT PRESERVE** |
| A · WS4–WS7R workshops | `I-08B1-WS4.zip` … `I-08B1-WS7R.zip` | recorded in `zip` inventory | intermediate | No | **SUPERSEDED — DO NOT PRESERVE** |
| B · Brand | `I-08B2.5-FINAL-BRAND-ASSET-PACKAGE.zip` | `00c8082feb61674e374f6f374023e82878b85ce1c48fc3687374a5be900d962e` | package: final production review. Masters consumed by closed G1.1. B2.4 icon frozen and carried byte-identically | No | **PRESERVE FINAL** (no standalone brand closure record) |
| B · B2.2, B2.2-REV1, B2.3, B2.4 | four archives | `2dc8dcb2…b1f80c26`, `0635ba14…1f3a3a1a`, `74dec6db…36f84cf9`, `6faf74ba…c3b6f6f3` | outputs contained byte-identically in B2.5 | No | **SUPERSEDED — DO NOT PRESERVE** |
| C · Typography | `I-08B3.0-E3-TYPOGRAPHY-SYSTEM-PROOF.zip` | `f074d1057231ae4ad8550288a836f8e2e423fa1cda127458f117bb1eda0a78c5` | F1R2 ledger: "I-08B3.0 … FROZEN". Roles consumed by closed G1.1 | No | **PRESERVE FINAL** (no font binary) |
| C · E1 comparative proof | `I-08B3.0-E1-ARABIC-TYPOGRAPHY-COMPARATIVE-PROOF.zip` | `15f57f14848aa2e75f433a98fde04d580c8ed344e6e065aaff3e491c2cd86b4b` | face selection, restated by E3 | No | **SUPERSEDED — DO NOT PRESERVE** |
| D · Visual foundation | `I-08B3.1-A3R-CANONICAL-STATE-CORRECTION.zip` | `01b1b3cd94c021ac5cf6f822110430abeaea7934eaf9666851cb90de49cdaa6c` | B4 freeze record: "I-08B3.1-A (already frozen)". Values in B4R tokens | No | **PRESERVE FINAL**, with the **A3R2 record NOT FOUND** |
| D · A1, A2, A2R, A3 | four archives | `5c14a7af…968cf9e8`, `807331af…bd8e57e6`, `3dae620a…f77eea6f`, `603dc611…7fe17fd5` | superseded by A3R | No | **SUPERSEDED — DO NOT PRESERVE** |
| E · Surface | `I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL.zip` | `68fb674ba392cf308f86f6c4f05cb6a68c94607c9e59349f737f39ad9728ee76` | F1R2 ledger: "B4R Surface FROZEN". Tokens vendored byte-exact into closed G1.1 / G1.2 | No (the `UTTERANCE` amendment is) | **PRESERVE FINAL**, with **B2R2 / B3R2 NOT FOUND** |
| E · B0 … B4 | nine archives | see chronology | superseded by B4R | No | **SUPERSEDED — DO NOT PRESERVE** |
| F · Living Brass | `I-08B3.1-C3-LIVING-BRASS-PRODUCTION-SPEC-FREEZE.zip` | `e4b6676366a050382d689737f97fdd264c7cad7999e3fa08bc7e9ede84a756c9` | F1R2 ledger: "C3 Living Brass FROZEN". Tokens vendored byte-exact into closed G1.1 / G1.2 | No | **PRESERVE FINAL**, with **C0R2 / C3R NOT FOUND** |
| F · C0 … C2 | five archives | see chronology | superseded by C3 | No | **SUPERSEDED — DO NOT PRESERVE** |
| G · QANDEEL Light | `I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM.zip` (the **only** D2R copy) | `be89b41a011a67a39dfe20f732457801abf930ab0240ee819a4dd92d42829e1a` | F1R2 ledger: "D CLOSED / FROZEN (D2R governing)". D2R (not D2) tokens vendored into closed G1 | No | **PRESERVE FINAL** |
| G · D0, D0R, D1, D2 | four archives | D2 `6046b691d770db9914ac1235bead09d690a91fe313c10923df1862fb6e688851` | D2 rejected in part by D2R | No | **SUPERSEDED — DO NOT PRESERVE** |
| H · Interaction / semantic colour | `I-08B3.1-E1-INTERACTION-SYSTEM-SEMANTIC-COLOR.zip` (E1R state; the **only** copy) | `7bb00f86cf6b1762f373bb19c7811a85d3490a0d93e448cdf661e203483ebfc9` | F1R2 ledger: "E CLOSED / FROZEN (E1R governing)" | No | **PRESERVE FINAL** |
| I · Accessibility F1 | `I-08B3.1-F1-ACCESSIBILITY-TRANSFORMATIONS-SEMANTIC-PARITY.zip` (F1R2 state) | `48bdbf9dfd6bc66db80f4217b6c7ecb4503407322b67760f27ee02a1a84179ce` | F2 brief: F1 "CLOSED / FROZEN". Consumed byte-exact by closed G1 | No | **PRESERVE FINAL** |
| I · Light appearance F2 | `I-08B3.1-F2-…-INTEGRATION.zip` (F2R state) | `e2a358aa06da69935cac7a316ce4c7abe77f3564073c85e946ca0dc947ff4d13` | consumed byte-exact by closed G1. **No F closure on host** | No | **PRESERVE FINAL (latest local)**, with **`FINAL_CANONICAL` NOT FOUND**, so this domain is **partially blocked** |
| J · Matching runtime | `docs/matching-introduction-runtime-v1.md` | — | `**Phase:** I-07 — CLOSED / FROZEN` | **Yes** | **ALREADY DURABLE** |
| J · Matching Product / visual layers | none found | — | — | — | **NOT FOUND LOCALLY.** Nothing preserved and nothing invented |
| K · Replay runtime | `docs/replay-runtime-v1.md` | — | `**Phase:** I-06 — CLOSED / FROZEN` | **Yes** | **ALREADY DURABLE** |
| K · Replay placement | G1.1 closure §1 + R3 source | `0a56a2fb…b434fbcd` | G1.1 CLOSED / FROZEN | closure yes, source no | **PRESERVE FINAL** (as part of G1.1) |
| K · Replay selection | R3 proof screens | — | proof only. `QAN-BL-NAV-02` open | — | **OPEN — DO NOT CANONICALIZE** |
| K · Replay preview / player, render / export, return / source anchor | none found | — | — | — | **OPEN — NO LOCAL SOURCE** |
| K · Replay media | — | — | `QAN-BL-VOICE-01`, `QAN-BL-NAV-02` open | backlog yes | **OPEN — DO NOT CANONICALIZE** |
| L · G1.1 | `…G1.1-R3-CONSOLIDATED-…-CORRECTION.zip` | `0a56a2fbc836168f16fbb3860b1847002e1bdfb376188c7ce0e6b459b434fbcd` | **equals** the closure-recorded hash | closure yes, source no | **PRESERVE FINAL** |
| L · G1.1 primary, G1.1-A1 | two archives | `435a946d…0ba04fac`, `0a7cff44…498b2372` | superseded by R3 | No | **SUPERSEDED — DO NOT PRESERVE** |
| L · G1.2 reviewed proof | `…G1.2-VOICE-LIVE-CONVERSATION-BACKGROUND-SAFE-PROOF.zip` | `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96` | **equals** the closure-recorded reviewed-proof hash | closure yes, source no | **PRESERVE FINAL** (behavioural evidence of record) |
| L · G1.2 R1 correction | not on host | `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11` (closure) | G1.2 closure §9 | closure yes, source no | **AMBIGUOUS — BLOCK THIS LAYER** (source absent) |
| M · Connected Worlds assurance (`QANDEEL_CONNECTED_WORLDS_*_v1.md`, 3 files) | root, untracked | — | "COMPLETE — REMEDIATION REQUIRED". Findings admitted to the backlog as `ASSURE-F0x` and being remediated (`QAN-CW-REM-0x`) | findings yes, reports no | **OPEN — DO NOT CANONICALIZE.** Not a Product / design artifact. **Single-copy risk reported** |
| M · CW-01 / CW-02 architecture reports (8 files) | root, untracked | — | each says "NOT FROZEN / NOT SELF-APPROVED" | No | **OPEN — DO NOT CANONICALIZE.** Candidates, not authority |
| M · Phase VI-03-03 brief, VI-03-04 / 04R archives | root, untracked | `7baa25a1…f547dd17`, `433da977…898585b0` | exploration, superseded by I-08B1 | No | **SUPERSEDED — DO NOT PRESERVE** |
| M · `E:\QANDEEL\QANDEEL DOCUMENTS\QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` and the Navigation Canonical Checkpoint | **outside the declared root**. G1.1's SOURCE_TRACE cites them as out-of-repo canon | — | canonical (per G1.1) | No | **REPORTED, NOT PRESERVED.** Outside this task's root, and needs a Product Owner decision |

No other local `CLOSED / FROZEN`, `CANONICAL CLOSURE`, `FINAL CANONICAL`, `FREEZE COMPLETE`,
`APPROVED BASELINE`, `CANONICAL STATE` or `PRODUCTION SPEC FREEZE` authority was found under the
root beyond the rows above. The phrases occur elsewhere only inside the packages already classified,
in their build outputs, or in tracked repository files.

## C. Named packages the brief expected, and not found

Each was searched for by name (`*A3R2*`, `*B2R2*`, `*B3R2*`, `*C0R2*`, `*C3R*`, `*FINAL_CANONICAL*`,
`*FINAL-CANONICAL*`, `*(1)*`, `*(2)*`, `*(3)*`, `*R1*`) across `E:\QANDEEL\QANDEEL PROJECT`
(recursive), `E:\QANDEEL` (top level) and Downloads. None exists on this host.

| Expected | Status on this host | Effect |
|---|---|---|
| `I-08B3.1-A3R2 FINAL-STATUS-RECONCILIATION` | absent | A preserved from A3R. The status wording is unreconciled |
| `I-08B3.1-B2R2`, `I-08B3.1-B3R2` | absent | none: B4R supersedes that proof chain |
| `I-08B3.1-C0R2`, `I-08B3.1-C3R FINAL-CLOSURE-RECONCILIATION` | absent | C preserved from C3. The closure wording is unreconciled |
| `D2R` copies `(1)`, `(2)`, `(3)` | absent: one D2R only | none. No choice was needed |
| E1 later duplicate / correction copy | absent: one E1 (E1R state) only | none. No choice was needed |
| F1 multiple revisions | revised **in place**. One archive only | none |
| `…F2-…-INTEGRATION_FINAL_CANONICAL.zip` | absent | F2 preserved from F2R. **F closure unreconciled** |
| G1.2 R1 correction ZIP `2e5e0ac4…` | absent | **R1-corrected source not preserved** |

## D. Files intentionally excluded from preserved packages

Excluded under the final-only policy and still present in the sealed archives: review boards, frame
captures and contact sheets, proof screens, motion recordings (MP4), and upstream font binaries
(`Estedad[wght].ttf`, `Estedad-wght-v8.5.{ttf,woff2}`). The loose F1 folder's `review/src/**`
(84 files added after sealing) was also left out. Each domain's `SOURCE-PROVENANCE.md` lists what
was left in its archive, with size.

## E. Remaining single-copy risk after this branch

Laptop-only, and **not** represented in Git by this change:

1. All 52 archives, including the excluded review / motion evidence of every final package. The
   largest are G1.2 (97.4 MB) and G1.1-R3 (34.1 MB), whose proof renders and MP4s are each closure's
   visual evidence of record.
2. The superseded chains listed in section B, by policy.
3. The Connected Worlds assurance reports and the CW-01 / CW-02 reports at the root.
4. `E:\QANDEEL\QANDEEL DOCUMENTS\` canon (core and navigation checkpoints, backend contract
   `.docx` set), which is outside this task's root.
5. Anything held only on another machine. That covers every package in section C. The G1.2 R1
   source in particular is recorded on `main` by hash only.
