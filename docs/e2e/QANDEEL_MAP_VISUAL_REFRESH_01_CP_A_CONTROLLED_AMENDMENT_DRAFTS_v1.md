# QANDEEL MAP-VISUAL-REFRESH-01 — CP-A: Controlled Amendment Drafts v1

**Status:** `PROPOSED — DRAFT CONTROLLED AMENDMENTS — NOT APPROVED — NOT EFFECTIVE — NOTHING IMPLEMENTED`
**Parent:** [CP-A contract record](QANDEEL_MAP_VISUAL_REFRESH_01_CP_A_PERSONAL_MAP_TOPICS_CONTRACT_RECORD_v1.md) §11.

**Rule:** **no frozen or normative document is edited by this PR.**
- Each draft states the clause it would change, the proposed wording, and the earliest CP at which it may take effect.
- When approved, an amendment is issued as its own Controlled Amendment under the repository's amendment route, and registered where that route requires (`docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md`, Project Map §1).
- Until then, the frozen text governs, unchanged.

---

## CA-1: Historical projection, D-12 / D-13 (`docs/historical-projection-v1.md`)
**Current text** (frozen):
- **D-12** discloses five rungs. WORLD carries "Threads + LF"; THREAD adds the Thread ↔ Reading appearances.
- **D-13** says the wire has "no score, no label".

**Proposed:**
- **A new, separately versioned projection** (V2) whose WORLD rung **additionally** carries the L2 topics, after the B1 gate: id, state, name, colour identity, member Thread ids, provenance class.
- After the B2 gate, it also carries the **appearance topology** only (`bindingId, threadId, readingId, boundSp`), with no analytical content.
- L1 associations are disclosed on selection only, at the rung decided at DP-1.
- **D-13's "no label"** gains one exception, for the **topic** name only: user-stated, or a validated N4 proposal shown as such. **Threads stay label-free.**
- **V1 is not changed.** `get_session_historical_projection_v1` and its disclosure stay byte-for-byte.

**Earliest effect:** CP-C (V2 projection), with B1 at CP-D and B2 at CP-F.

## CA-2: VPORT-01 (`docs/e2e/QANDEEL_VPORT_01_LIVING_ANALYSIS_WORLD_PRODUCTION_VISUAL_PORT_v1.md`)
**Current:**
- §8 marks "Territories / life domains" as `VISUAL PORT BLOCKER — REQUIRED SEMANTIC FACT NOT PRESENT`;
- §9 ties FAR / MID / NEAR to camera distance;
- the visual contract test asserts that MapCanvas draws no text.

**Proposed:**
- The blocker is lifted **only for L2 topics**, the one sanctioned "group".
- **Territories, hulls and life domains stay blocked.** A topic is never drawn as an enclosure, and never inferred from Home proximity or background colour.
- **§9 is unchanged:** FAR / MID / NEAR stay camera distance.
- Text on the canvas is permitted **for topic names only**: proposed (with the non-colour marker) and confirmed.

**Earliest effect:** CP-D.

## CA-3: LA-VIS-01 colour meaning (S5-03B record §27; `apps/mobile/src/map/visual/world-chroma.ts` "A colour here MEANS NOTHING")
**Current:** world colour is a function of the address only, with no meaning.

**Proposed:**
- The world's address chroma keeps meaning nothing.
- **An L2 topic may carry a stable visual identity colour in the user's own context.** It is assigned at creation and never forms a global category (green ≠ health).
- It is **never the only carrier**: name, selection, marker and accessibility carry it too.
- A `PROPOSED` topic's colour is **temporary**, and it carries a non-colour marker.

**Earliest effect:** CP-D.

## CA-4: MapCanvas tether-only rule (VPORT-01; `tests/vport-01-world-visual-contract.test.mjs`)
**Current:** the canvas draws exactly one relation, the Home → appearance tether.

**Proposed:**
- Add **one** further mark: the **PT-03 identity mark**, joining the appearances of the **same Reading**. It is visibly not a relation.
- No other inter-Thread line.
- L1 associations are never drawn as a web at overview.

**Earliest effect:** CP-D.

## CA-5: Replay V2 (`docs/replay-runtime-v1.md`; migrations 0102 / 0169 by extension)
**Current:**
- Replay pins a digest of V1 per point and re-derives at read time.
- A mismatch means the analysis is not currently available.

**Proposed:**
- **V2 points** pin a separate schema id and, in addition, the following:
  - the L1 rule version;
  - the L2 ledger state;
  - the evidence state.
- **The topic layer is pinned as an itemized digest,** keyed per user, with the key destroyed on account erasure.
- **Redaction records** (append-only, content-free) tombstone the items affected by forgetting.
- **At read time,** a moment is served only if:
  - present items match their pins;
  - tombstoned slots are absent;
  - no unpinned item appears.

  Otherwise **only the topic layer** is unavailable.
- **V1 points, their re-derivation and their digests are untouched.** Old points are never re-pinned.
- Activation is anchored at the activation `world_version`.
- The Replay Media Pool stays isolated from the Live Voice Pool.

**Earliest effect:** CP-C.

## CA-6: Erasure and export coverage
**Current:**
- account erasure: 0130 (W3-MEGA-S record §5);
- export: `QAN-BL-PRIV-05`, owned by PRIV-EXPORT-01.

**Proposed:**
- Erasure covers the topics, topic events, vetoes, rejection keys, redaction records and the per-user digest key.
- Export includes the user's topics and their provenance class, **never** purged text.
- `QAN-BL-PRIV-05` keeps its owner. This only adds the new tables to its scope when they exist.

**Earliest effect:** CP-B.

## CA-7: AI usage feature family and the N4 permit (AI-COST-01 record; migrations 0135 / 0184; S8B-05 record §11.10.6; `background-permits.ts`)
**Current:**
- The feature families form a closed enum.
- The permit kinds are CALL_ANALYSIS, TEXT_SEMANTIC_ANALYSIS and POST_RESPONSE_INTELLIGENCE.

**Proposed:**
- A new family, `TOPIC_PROPOSAL`.
- A new permit kind for N4:
  - lowest priority, with `respectCriticalWindow: true`;
  - per-user concurrency 1;
  - never drawing on live-call capacity;
  - paused by the live-pressure gate (contract record §6.9).

**Earliest effect:** CP-E. It is conditional on D-B3.

## CA-8: QIR-005 four-effect ceiling (`docs/post-response-intelligence-scheduler-provider-budget-v1.md`, ACTIVE / NORMATIVE; v2 by the S8A-03 CP2 amendment)
**Current:** at most four provider-backed post-response effects per completed turn, the Founder's ceiling.

**Proposed:** **no change to the ceiling.** It depends on the PO's decision D-B3:
- (i) a cross-reference note saying that world-level N4 work is outside the per-turn ceiling and has its own caps; or
- (ii) an amended policy that counts N4.

Under option (iii), nothing is issued. **This draft does not presume the answer.**

**Earliest effect:** with D-B3.

## Not amended
- 0066 / 0068: N2 is deferred and N3 is not adopted.
- I-08B1: topic cohesion and lighting must stay within its halo rules. To be verified at CP-D.
- `docs/historical-projection-v1.md` V1 semantics.
- Any Memory policy.
