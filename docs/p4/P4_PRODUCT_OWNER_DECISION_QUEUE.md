# QANDEEL — P4 Product Owner Decision Queue

**Status:** `P4-A DECISION QUEUE — QUESTIONS ONLY — NO ANSWER HERE IS A DECISION`

| | |
|---|---|
| Track | P4, task P4-A |
| Canonical baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` |
| Rule | every open row is a choice existing authority does **not** settle. P4-A answers none of them. Where the evidence supports one, a **recommended option** is given. A recommendation is not a decision |
| Open decisions | **16**: `P4-DQ-01` … `09` and `P4-DQ-11` … `17` |
| Resolved records | **1**: `P4-DQ-10`, **RESOLVED BY CONTROLLED CW2-08A AMENDMENT** (P4-B). It is kept for traceability and blocks nothing. IDs are not renumbered |
| Excluded on purpose | an unknown implementation detail is not a Product decision. Such items are in the [Carry-Forward Matrix](P4_CARRY_FORWARD_MATRIX.md) instead |
| Traceability | each row cites its [census](P4_RESIDUAL_GAP_CENSUS.md) rows and, for APP-OPS, its [contract candidate](APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md) section |

The last two fields of each row mean:

- **Blocks** — whether closing P4, or closing APP-OPS-01, needs the answer first.
- **Proof** — whether the answer needs a visual proof before it can be frozen.

---

## Index

| ID | Question | Blocks P4 closure | Blocks APP-OPS-01 closure | Visual proof |
|---|---|---|---|---|
| `P4-DQ-01` | Where is the General Settings entry placed in the shell? | yes | — | yes |
| `P4-DQ-02` | Where is the QANDEEL Understanding entry, and what form does it take? | yes | — | yes |
| `P4-DQ-03` | Does the canonical Q appear on every screen, and where? | yes | — | yes |
| `P4-DQ-04` | Final small chrome: Global Switcher container form, tab depth and active-indicator geometry; «سياق الكلام» placement | yes | — | yes |
| `P4-DQ-05` | Ratify the I-08B2.5 brand package, and settle its open items | yes | — | partly |
| `P4-DQ-06` | Launch / splash / gateway brand application, including the lantern: P4 or audit? | yes (the sequencing answer) | — | if P4 takes it |
| `P4-DQ-07` | Boundary: which undrawn screens P4 designs, and which the audit carries | yes | — | no (it is a boundary) |
| `P4-DQ-08` | Voice visual language: what closes now, and what waits for runtime truth | yes | — | yes |
| `P4-DQ-09` | Residual copy: which clusters freeze before the audit | yes | — | copy in context |
| `P4-DQ-10` | **RESOLVED BY CONTROLLED CW2-08A AMENDMENT** — the CW2-08 §8 / H7 human case-evidence access conflict with the No Human Review law | no (resolved) | no (resolved) | no |
| `P4-DQ-11` | `IDENTITY / RETENTION / ACCESS MODEL FOR USER-SPECIFIC OPERATIONAL DIAGNOSTICS` | — | the access principle: yes | no |
| `P4-DQ-12` | Ratings / reviews: the exact boundary | — | no, if the narrower default is kept | no |
| `P4-DQ-13` | Control-state freshness, integrity and audit, outside CW2-08 | — | no | no |
| `P4-DQ-14` | Maintenance Mode / Minimum Supported Version: user-facing behavior | — | no, if it is handed to the audit | later |
| `P4-DQ-15` | Do CW2-08's flag, snapshot and fail-closed laws reach capabilities outside Connected Worlds? | — | yes | no |
| `P4-DQ-16` | The Approved Remote Configuration family register and its guarantees | — | no (yes, before any Remote Configuration exists) | no |
| `P4-DQ-17` | Code delivery (store release or over-the-air) against "no generic remote execution" | — | no | no |

---

## A. Residual Product / visual / copy canon

### `P4-DQ-01` — General Settings entry placement

| Field | |
|---|---|
| Question | Where in the shell does the one General Settings destination get entered? |
| Why it matters | every account, privacy, appearance and notification control hangs off it. The End-to-End audit cannot walk "Profile / Settings" without an entry to walk from |
| Existing authority | P1 §8: exactly one destination, "secondary Global Shell utility" (I-08A4 §7). P3 places a separate Activity entry in the non-Analysis upper chrome, and none in the Analysis. P2 §11 / P3 §17 / §19.5 and the artifact index hand the placement to P4 |
| Viable options | **A.** An entry in the non-Analysis upper chrome, beside P3's Activity entry. **B.** An entry reached from Personal QANDEEL's own surface. **C.** Another utility location that proof shows to be more discoverable |
| Architecture consequences | none at runtime. It is a shell composition choice. It must stay outside the Analysis, which P3 keeps free of global entries, and must respect I-08A4's local-only Back |
| Recommended | **no recommendation.** The evidence does not favour one option without a visual proof. A and B each have precedent: P3's non-Analysis upper chrome for A, the Understanding entry "from Personal QANDEEL" for B |
| Blocks | P4 closure: **yes**. The roadmap names "final small chrome", and P2 / P3 hand this item to P4 |
| Proof | **yes.** Integrated AR / EN and RTL / LTR shell proof beside the Activity entry |
| Census | P4-GAP-001 |

### `P4-DQ-02` — QANDEEL Understanding entry placement and form

| Field | |
|---|---|
| Question | Where exactly does the Understanding entry sit on Personal QANDEEL, and what control is it? |
| Why it matters | P1 froze that the entry is "stable, discoverable … from Personal QANDEEL". The audit's "Memory / Understanding inspection" moment needs its entry |
| Existing authority | P1 §10, §11, §16.1; P2 §11, §13.5 (the glyph comes from P2 once placed); P3 §19.6 |
| Viable options | **A.** A persistent control on the Personal QANDEEL surface. **B.** An entry inside the Conversation / Analysis context. B must not collide with the in-Analysis «القراءات» vocabulary, which P1 preserves. **C.** A General Settings item, which would be weaker than P1's "stable, discoverable" rule |
| Architecture consequences | none at runtime |
| Recommended | exclude **C**, because it conflicts with P1's "stable, discoverable entry from Personal QANDEEL". Choose between A and B by visual proof |
| Blocks | P4 closure: **yes** |
| Proof | **yes** |
| Census | P4-GAP-002 |

### `P4-DQ-03` — Canonical Q presence and placement

| Field | |
|---|---|
| Question | Does the canonical Q appear on every screen? If not, where does it appear? |
| Why it matters | this is brand presence across the whole Product. C3 §8 calls it "a **placement** question" that material law cannot resolve |
| Existing authority | C3 §8 (open); P2 §13.2 ("not answered"); P3 §19.6; the artifact index. G2.3 §1 already fixes the Q at the Matching attention moment. C3 §8 cites Apple's HIG against pervasive logo display |
| Viable options | **A.** No persistent Q; the Q only at named identity moments: launch, gateway, Matching (already frozen), empty states. **B.** A persistent Q in the shell chrome. **C.** A persistent Q on Personal QANDEEL only |
| Architecture consequences | none at runtime. The Q's material is governed by C3 (`qandeel.identity.mark`) wherever it appears |
| Recommended | **A**, weakly. It is the option C3 §8's cited guidance supports, and it is consistent with G2.3's one frozen placement. It still needs proof |
| Blocks | P4 closure: **yes** |
| Proof | **yes** |
| Census | P4-GAP-003 |

### `P4-DQ-04` — Final small chrome

| Field | |
|---|---|
| Question | (a) the Global Switcher's container form, tab depth and active-indicator geometry, beyond what P2 froze; (b) where «سياق الكلام» sits in the Analysis |
| Why it matters | the roadmap's "final small chrome". Without it the shell cannot be drawn to production truth |
| Existing authority | C3 freeze record ("Final selected-tab design", "Tab geometry, tab container form, tab depth" → Product / UI integration); I-08A4 §21; P2 §5 (the glyph family, glyph above the word, SELECTED shown by the E1R marker and word weight); G3 §G for (b) ("VI-01 / Product; not decided") |
| Viable options | (a) container forms are proof-driven; no option is pre-set by canon. (b) placement inside the existing G3 Analysis shell composition |
| Architecture consequences | none at runtime |
| Recommended | **none.** The answer comes from visual proof. It must consume P2 / E1R unchanged and invent no new status colour (P2 §11) |
| Blocks | P4 closure: **yes** |
| Proof | **yes** |
| Census | P4-GAP-004, P4-GAP-005 |

### `P4-DQ-05` — Brand package ratification and its open items

| Field | |
|---|---|
| Question | (a) Is the I-08B2.5 package ratified as the final brand authority? (b) L-1: keep the stale "NOT approved, NOT frozen" header comment inside the frozen icon SVG, or correct it? (c) confirm or redirect the Android 48 dp adaptive-icon framing; (d) do iOS 18 dark / tinted variants ship in v1? |
| Why it matters | downstream closures already consume the package as authority, yet it has no lifecycle record. That makes brand the one Product domain whose lifecycle is "NOT ESTABLISHED" |
| Existing authority | brand SOURCE-PROVENANCE; the review manifest L-1 … L-5; the asset report §13; the artifact index. Variant B was frozen at I-08B2.4 |
| Viable options | (a) ratify, or ratify with named exceptions. (b) **keep**: the hash stays equal to the frozen I-08B2.4 artefact, and the comment is recorded as superseded by the ratification. **Correct**: the hash changes, and new provenance is recorded. (c) confirm, or redirect with a render. (d) include, or defer to release |
| Architecture consequences | (b) "correct" changes a canonical byte-identity. The provenance chain must record it |
| Recommended | (a) **ratify**, because the package is already consumed as canon. (b) **keep** the bytes and record the supersession, which preserves the byte-identity chain G1.1, C3 and P2 rely on. (c) and (d): **no recommendation**; they are Product judgements |
| Blocks | P4 closure: **yes** for (a). (b)–(d) could be carried forward with owners if the Product Owner prefers |
| Proof | (c) adaptive-icon renders; (d) variant proof if adopted |
| Census | P4-GAP-012 … 015 |

### `P4-DQ-06` — Launch / splash / gateway brand application

| Field | |
|---|---|
| Question | Does P4 close the launch / splash / gateway brand application, including whether the lantern gateway moment exists in v1? Or does the End-to-End audit carry it as an undecided moment? |
| Why it matters | the roadmap lists "app icon / launch-brand application" as a P4 example **and** "app launch / splash / brand entry" as audit coverage. The P4 purpose is to stop the audit halting on a known-undecided area |
| Existing authority | roadmap §2, §3; C3 headroom §4 (the lantern is authorized, "C3 does not design it"); T-14 §7, §11 (excluded); no canonical splash record |
| Viable options | **A.** P4 closes the static launch brand application now: which mark, which surface, whether the lantern appears. The audit walks it as decided. **B.** The audit carries the whole moment as `UNDECIDED`, and a later Product task closes it |
| Architecture consequences | none at runtime. Native splash constraints are implementation |
| Recommended | **A** for the static brand application, which fits P4's stated purpose. Whether the lantern **animation** is v1 is a Product call; no recommendation on that |
| Blocks | P4 closure: **yes**, for the sequencing answer |
| Proof | yes, if A |
| Census | P4-GAP-018, 019 |

### `P4-DQ-07` — Boundary for undrawn screens

| Field | |
|---|---|
| Question | Which never-drawn screens, if any, must P4 design before the audit? Candidates: General Settings (order, hierarchy), the Understanding surface, sign-up, the first-use welcome screen, and Shared / Public conversation surfaces (including multi-human attribution) |
| Why it matters | without a line, P4 could grow into full screen design, or the audit could halt on screens nobody owns |
| Existing authority | P1 §8.1, §16.1; I-08A4 §21; G1.1 §5; the roadmap §3 audit, which is designed to classify moments as `PARTIALLY DEFINED` / `UNDECIDED` |
| Viable options | **A.** P4 designs none; the audit classifies them and produces scoped closures. **B.** P4 designs a named subset, for example General Settings and Understanding, because P4 is already placing their entries (`P4-DQ-01` / `P4-DQ-02`) |
| Architecture consequences | none |
| Recommended | **A.** The roadmap limits P4 to "residual decisions in the Product/design canon already created". These screens were never opened as design tracks. The entries (`P4-DQ-01`, `P4-DQ-02`) are enough for the audit to walk |
| Blocks | P4 closure: **yes**, as a boundary statement |
| Proof | no |
| Census | P4-GAP-039, 040 |

### `P4-DQ-08` — Voice visual language: close now vs wait for runtime

| Field | |
|---|---|
| Question | Which parts of the Voice visual language does P4 freeze now, and which wait for Voice runtime truth? |
| Why it matters | G1.2 §6 and P2 §13.1 leave the audio strip, waveform, activity morphology and broader Voice visual language unfrozen. P2 §15 hands them to the P4 census |
| Existing authority | G1.2 §1–§5 and §7 (frozen interaction); P2 (call controls, Call Rail A); P2 §11.1 and F-P2-05: **no fake speaking or activity signal**; `QAN-BL-VOICE-01` requires "truthful microphone and route state" |
| Viable options | **A. Split.** Freeze now the parts that carry no live signal: the Voice Note history representation, the finished-call history record, the recording / idle / sent states and non-signal call-surface composition. Every signal-bearing morphology (waveform, activity, speaking) waits for `QAN-BL-VOICE-01`. **B.** Defer everything to the Voice runtime track |
| Architecture consequences | A creates no runtime dependency. The signal-bearing half stays gated by an existing backlog item, and no new alias is needed |
| Recommended | **A.** It is the only option consistent with both P2's truthfulness law and P2 §15's handoff to P4 |
| Blocks | P4 closure: **yes**, for the non-signal half |
| Proof | **yes.** Integrated Voice / Live Call proof, AR / EN |
| Census | P4-GAP-021, 022. The gated rows are P4-GAP-023 … 026 and 035 |

### `P4-DQ-09` — Residual copy disposition

| Field | |
|---|---|
| Question | For each open-copy cluster: freeze in P4 before the audit, hand to the audit, or leave gated? **P4-A writes no copy** |
| Why it matters | P3 §17 hands its residual copy to P4 "if P4 determines that they must close before the End-to-End audit". G3 §G leaves core surface labels as `OPEN COPY` |
| Existing authority | G3 §G; G2 §G 1–6; P3 §17; P1 §2.1, §6, §11.3, §15.3, §19; VI-01 (the carried table, `PROVISIONAL / PHASE VII`); G1.1 §1–§2; I-08A4 §13–§15 |
| Viable options | per cluster, below |
| Architecture consequences | none |
| Blocks | P4 closure: **yes**, for the clusters marked "freeze in P4" |
| Proof | copy in rendered context, AR / EN |
| Census | P4-GAP-028 … 034. Gated: P4-GAP-035 |

Per cluster:

| Cluster | Census | Recommended disposition | Reason |
|---|---|---|---|
| Core Conversation / Analysis labels: the Arabic Replay noun and entry names, the English Conversation → Analysis label, the Timeline accessible name and preview routes, the Live-edge wording | 028 | **freeze in P4** | they name the core surfaces every audit moment passes through |
| Matching proof lines and English Matching copy | 029 | **freeze in P4, or hand to the audit** — Product Owner's call | the owner is "Product copy owner" (G3 §G), not Connected Worlds `I-08` |
| P3 `PROOF` / `DIRECTION` / `OPEN` lines; the Arabic Snooze words | 030 | **freeze in P4** the lines on surfaces P3 froze: Settings help lines, the call-safe phrase, the section heading, Snooze words. Leave the education sheet to the audit's permission-education moment | P3 froze the surfaces, so the words are the remaining gap |
| P1 open copy: confidence states, Settings group names, the Public ID warning | 031 | **freeze in P4** | the surfaces' Product rules are frozen by P1 |
| P1 open copy: sign-in failure wording, Login ID help | 031 | **hand to the audit**, under the account / auth lifecycle review (roadmap §3) | it belongs to the account journey the audit owns |
| VI-01 `PROPOSED` / `OPEN` residue | 032 | **hand to the audit**, as a rendered-language pass | the owner is orphaned, and most rows sit on surfaces the audit will walk |
| QANDEEL English casing | 033 | **confirm "QANDEEL"** | every frozen English canon string already uses it: I-08A4 §13–§15, P1 §10, P3 §12 |
| G1.1 normal opener vs I-08A4 §15 First Conversation Opening; the missing English normal opener | 034 | **confirm** that they are separate moments, and write the English normal opener in P4 | a compatible reading exists but is unstated |
| Voice / call state strings | 035 | **stay gated** on `QAN-BL-VOICE-01` | VI-01: "A state string must name what the architecture actually does" |

---

## B. APP-OPS-01

### `P4-DQ-10` — RESOLVED BY CONTROLLED CW2-08A AMENDMENT

This is a resolved traceability record, not an open decision.

| Field | |
|---|---|
| State | **RESOLVED BY CONTROLLED CW2-08A AMENDMENT** (P4-B), effective on the merge of the change that carries it |
| Product Owner law (not reopened) | **No routine or exceptional human review of private QANDEEL conversation content is authorized through Company Operations or safety-monitoring flows** |
| Historical conflict | CW2-08 §8 bound `CASE_SCOPED_MODERATION_ACCESS` to exact case, evidence scope, purpose, "authorized role/service/person", validity and audit, and excluded only **blanket** private-World browsing; H7 read "Moderator access is case-scoped and auditable"; §7 supplies protected `REPORT_CASE` evidence. So an authorized person could reach case-scoped private conversation content, which the Product Owner law forbids |
| Amendment path | an additive controlled amendment, [CW2-08A](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md). The original CW2-08 stays frozen, historical and byte-identical |
| Exact supersession | **§8:** case, evidence scope, purpose, validity, audit and no blanket browsing are preserved; where the evidence scope contains private QANDEEL conversation content, "authorized role/service/person" authorizes no human role or person to receive, inspect or review it — only authorized non-human Safety / Moderation processing under existing Safety authority. **H7:** "Moderation access / processing remains case-scoped and auditable. Human review of private QANDEEL conversation content is not authorized." **§44 item 5** stays open; any future moderation / report UX and appeals must obey the law. `ESCALATE` does not by itself authorize human access |
| Not decided | human or automated moderation of content that is not private conversation content, including Public moderation; any user-initiated support-sharing flow |
| Implementation | none. No replacement moderation mechanism, service, classifier, vendor, queue, dashboard, appeal process or schema was selected |
| Blocks | P4 closure: **no**. APP-OPS-01 closure: **no** |
| Proof | none |
| Census / candidate | P4-GAP-057 (`ALREADY CLOSED / SUPERSEDED`); APP-OPS-01 candidate §6.4, §18 |

### `P4-DQ-11` — `IDENTITY / RETENTION / ACCESS MODEL FOR USER-SPECIFIC OPERATIONAL DIAGNOSTICS`

| Field | |
|---|---|
| Question | How are user-specific operational diagnostics identified, retained and accessed? |
| Why it matters | `PO-OPS-04` admits user-specific diagnostics. Existing telemetry deliberately minimizes user linkage |
| Existing authority, and what it already fixes | **fixed:** no content, no semantic profiling, no Company Operations human review, purpose limited to troubleshooting / support / reliability (`PO-OPS-02` … `04`). **Fixed:** correlation IDs never become metric labels (Telemetry v1). **Fixed:** the internal `user_id` is never user-facing (P1 §13). **Fixed:** Safety Runtime "Least Data, Least Access, Least Retention, Purpose Limitation". **Existing fact:** outbox envelopes already carry opaque user / session / turn IDs, classed `SENSITIVE`, with `OPERATIONAL_EVENT_V1` retention (Outbox v1). **Not fixed:** see the classification below |
| Classification of the parts | (1) **Access principle.** Who may view one user's operational state, and on what trigger. For example: only on a user-initiated support request, or for reliability triage by the App Operations role. **P4 must decide; it is a Product / privacy boundary.** (2) **Identifier format, hashing / pseudonymization, storage location, query mechanism.** **Security / privacy implementation after the audit**, within (1). (3) **Retention duration.** **Security / privacy implementation**, bounded by Least Retention. (4) **Whether aggregate domains (feature usage, cost) may carry per-user linkage at all.** Part of (1) |
| Viable options, for (1) | **A.** User-linked operational state is viewable only after a user-initiated support request, scoped to that user. **B.** It is viewable by the App Operations role for reliability triage without a user request, audited. **C.** A combination: automated per-user reliability rules without human viewing; human viewing only on a user request |
| Architecture consequences | A and C need a support-request trigger that is not designed today. B needs audited role access (Production Integration: RBAC, audit log) |
| Recommended | **C.** It follows Least Access and fits `PO-OPS-06` (deterministic rules first). The Product Owner confirms |
| Blocks | APP-OPS-01 closure: **yes** for (1). No for (2) and (3) |
| Proof | no |
| Candidate | §7 |

### `P4-DQ-12` — Ratings / reviews boundary

| Field | |
|---|---|
| Question | Within "ratings / reviews": is store-review **text** ingested? May a store review be **linked** to a QANDEEL account? How are public store signals kept apart from private in-product content? |
| Why it matters | "Reviews" could otherwise be read as permission to collect content |
| Existing authority | `PO-OPS-04` (the domain); `PO-OPS-03` (no private content); candidate §5.3 (store / marketplace signals only) |
| Viable options | **A.** Aggregate ratings plus public review text as the store publishes it. No account linkage. **B.** Option A, plus linkage only where the reviewer identifies themselves through support. **C.** Aggregate ratings only |
| Architecture consequences | B needs an identity-linkage path governed by `P4-DQ-11` |
| Recommended | **A.** Public store text is already public. Declining linkage avoids joining a public review to a private account |
| Blocks | APP-OPS-01 closure: **no**, if the closure keeps §5.3's narrower default |
| Proof | no |
| Candidate | §5.3 |

### `P4-DQ-13` — Control-state freshness, integrity and audit (outside CW2-08)

| Field | |
|---|---|
| Question | For the control families CW2-08 does not already govern (Maintenance, Minimum Version, Remote Configuration, Route Hold, and the non-Connected-Worlds reach of Kill Switch): what is required for versioning, expiry / TTL, last-known-good vs revert-to-default, signing / authentication, and audit retention? |
| Why it matters | the approved law "outage ≠ Kill Switch" needs a defined answer for stale or conflicting control state |
| Existing authority, and what it already forces | **forced:** a control acts only when valid, authenticated and currently effective (approved outage-isolation law). **Forced:** the effective state is runtime-held (candidate §10.1). **Forced:** CW2-08 §5 / §36 give versioning and audit to Safety / launch restrictions. **Forced:** CW2-08 §38 makes old / unknown client state fail safely |
| Viable options | **A.** Freeze only the principles now. Production Integration's security design chooses TTL, signing, last-known-good and retention. **B.** Freeze specific guarantees now, for example every control versioned and audited, and every Remote Config value expiring to its default |
| Architecture consequences | B commits the control plane before the audit has named its User Moments |
| Recommended | **A**, with one addition the Product Owner may wish to freeze now: **every control family is versioned and audited**, extending CW2-08 §5 / §36 to every currently approved family. That is low-risk and matches existing law |
| Blocks | APP-OPS-01 closure: **no** |
| Proof | no |
| Candidate | §10.1, §15 |

### `P4-DQ-14` — Maintenance Mode / Minimum Supported Version: user-facing behavior

| Field | |
|---|---|
| Question | What does a user experience under Maintenance Mode or a Minimum Supported Version gate? For example: is own history readable during maintenance, and how is the upgrade asked for? |
| Why it matters | these are the two controls users see directly |
| Existing authority | candidate §11 (both are intentional, scoped restrictions that never delete history); CW2-08 §26 (disable may retain safe history / read-only state); CW2-08 §38 (old clients fail safely); CW2-02 §47 (minimum-necessary error disclosure). The task excludes exact screens from P4-A |
| Viable options | **A.** Hand the user moments to the audit ("version / maintenance gates" is already one of its illustrative moments), and freeze only the laws above. **B.** P4 decides the behavior now, with a visual proof |
| Architecture consequences | none until Production Integration |
| Recommended | **A** |
| Blocks | APP-OPS-01 closure: **no**, if A |
| Proof | later, in the audit's closure |
| Candidate | §11 (families 3, 5) |

### `P4-DQ-15` — The reach of CW2-08's flag and launch laws beyond Connected Worlds

| Field | |
|---|---|
| Question | Do CW2-08 §24–§28, §38 and §40 also bind Personal conversation, Voice, Analysis and the rest of the App? Those laws are: server-canonical flags; client flags as hints; the Launch Gate Snapshot and emergency-disable invalidation; history-preserving disable; multi-user consistency; capability-scoped requirements; fail-safe old clients; fail-closed unknown state |
| Why it matters | Feature Flags, Kill Switch and Rollout Control are approved app-wide (`PO-OPS-07`). CW2-08 is written for Connected Worlds. Without an answer, a non-Connected-Worlds kill switch has no stated semantics |
| Existing authority | CW2-08 (Connected Worlds scope); `PO-OPS-07` / `PO-OPS-08` (the approved families; no generic remote execution); the candidate §10 / §13. The may-not limits of candidate §10.2 are `FORCED BY` CW2-08 / CW2-02 in Connected Worlds scope and only **CANDIDATE** outside it |
| Viable options | **A.** Yes: the same laws apply app-wide, with CW2-08 unchanged as their source for Connected Worlds. **B.** Only the candidate §10.2 may-not limits apply outside Connected Worlds; the flag and snapshot mechanics are chosen per capability later |
| Architecture consequences | A gives one control model across the App and no second flag authority. B risks two models |
| Recommended | **A** |
| Blocks | APP-OPS-01 closure: **yes** |
| Proof | no |
| Candidate | §11 (families 1, 2, 4), §13 |

### `P4-DQ-16` — The Approved Remote Configuration family register

| Field | |
|---|---|
| Question | Who approves a Remote Configuration family, where is the register kept, and which families (if any) are approved initially? |
| Why it matters | "approved Remote Configuration" is empty until a family is approved |
| Existing authority | candidate §11 (the rules and the ceiling); Foundation Freeze "Configurable Without Breaking Freeze"; AGENTS §9 (material contract changes need controlled change) |
| Viable options | **A.** Families are approved by Product Owner + Architecture through controlled change, recorded in APP-OPS-01's closure or a successor. The initial set is chosen during Production Integration. **B.** Name an initial set in P4 |
| Architecture consequences | none until built |
| Recommended | **A** |
| Blocks | APP-OPS-01 closure: **no**. **Yes before any Remote Configuration exists** |
| Proof | no |
| Candidate | §11 (family 6) |

### `P4-DQ-17` — Code delivery against "no generic remote execution"

| Field | |
|---|---|
| Question | Is delivering new App code (store release, or any over-the-air bundle mechanism) a **release** governed by release process, entirely outside the control plane? |
| Why it matters | an over-the-air bundle update is remote delivery of executable code. `PO-OPS-08` forbids generic remote execution through the control plane, but releases are how code legitimately changes |
| Existing authority | `PO-OPS-08`; the candidate §12. No over-the-air mechanism exists in `apps/mobile/` (no `expo-updates` dependency). Release Hardening is a later roadmap layer |
| Viable options | **A.** Code delivery of any kind is a release, owned by the App Operations & Release Lead under release governance. It is never a Company → App control. Whether over-the-air updates are used at all is a release-operations decision. **B.** Forbid over-the-air code delivery entirely now |
| Architecture consequences | B constrains Release Hardening before evidence exists |
| Recommended | **A** |
| Blocks | APP-OPS-01 closure: **no** |
| Proof | no |
| Candidate | §12 |

---

## C. Candidates tested and **not** queued

The Task Contract §30 suggested these as likely candidates. Each was tested and is not a Product Owner decision now:

| Candidate | Why not queued |
|---|---|
| Runtime-dependent speaking indicator | P2 §11.1 already decides what can be decided: no fake signal, and truth waits on `QAN-BL-VOICE-01`. What remains is dependency-gated, not a choice (P4-GAP-023) |
| Stale / unavailable operational-control behavior | the principle is forced by the approved outage law and CW2-08 §40 (candidate §15). Only the mechanism is open, and it sits in `P4-DQ-13` |
| Exact human-review scope versus CW2-08 moderation | the conflict P4-A confirmed is resolved by the CW2-08A controlled amendment (`P4-DQ-10`, resolved record). No replacement mechanism is chosen |
| Native call behaviors, spoken-reply control, Voice Note transcript | dependency-gated on Voice runtime and provider evidence (P4-GAP-024 … 026) |
