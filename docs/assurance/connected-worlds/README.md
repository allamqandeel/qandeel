# Connected Worlds — Assurance Evidence

**Status:** `ASSURANCE EVIDENCE ONLY — NOT PRODUCT AUTHORITY`

[`QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md`](QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md) is the
`QAN-CW-ASSURE-01` findings register. It was assessed at baseline `5de5271b`, migration tip `0118`.

- **Identity.** It is preserved byte-exact: 57,604 B, SHA-256
  `53ccf85f4939ef050f30af95732f6cf687c7e363e73c6e84d10c168bf68d8fe4`. See
  [`ASSURANCE_SOURCE_PROVENANCE.sha256`](ASSURANCE_SOURCE_PROVENANCE.sha256).
- **Why it is here.** It is the only full description of `ASSURE-F05`, a HIGH finding: owner deletion never
  reaches the Public DRAFT source-content-bearing derivative, and the `service_role` review boundary keeps
  serving the deleted text.

What this preservation does and does not mean:

- **Evidence only.** The register records defects against frozen contracts. It creates no Product semantics,
  and its "remediation direction" paragraphs are not decisions.
- **Unresolved.** `ASSURE-F05` is not implemented on `main`. Migrations `0121` and `0122` state explicitly
  that they implement no part of it, and their tests assert that (`database/tests/*-v1.test.mjs`).
- **The runtime already acknowledges the boundary.** Those migrations refuse to let owner deletion reach
  Public derivative state.
- **The backlog is the governance locator.** The open work is backlog item
  [`QAN-BL-CW-01`](../../qandeel-canonical-backlog-v1.md). The register's other findings are dispositioned by the
  `QAN-CW-REM-01` … `REM-03` records (migrations `0119`–`0122`, `database/README.md`). This preservation does not
  re-evaluate them.
