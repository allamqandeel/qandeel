# Intelligence Evidence Layer v1

## Memory and Evidence

Memory answers what information is worth carrying forward. Evidence answers which currently valid, provenance-bearing memory may support or challenge a future intelligence hypothesis. V1 is an internal read projection over Memory Runtime; it creates no evidence table and duplicates no durable personal content.

## Contract and eligibility

`EvidenceItem` carries a stable memory-derived evidence ID, mechanical evidence kind, original memory type and statement, source, memory confidence, importance, observed/updated timestamps, and originating memory ID. It is not a public client contract.

Only authenticated-user-owned, `ACTIVE`, unexpired `USER_STATED` or `USER_CONFIRMED` memory is eligible. `DERIVED_INSIGHT`, `SYSTEM_DERIVED`, imported/admin memory, and every non-active lifecycle state are excluded. Memory Runtime and database RLS remain the primary ownership boundary; the projection also verifies `user_id` defensively.

The mechanical mapping is:

- `PERSONAL_FACT` → `USER_STATED_FACT`
- `STABLE_PREFERENCE` → `USER_STATED_PREFERENCE`
- `GOAL` → `USER_STATED_GOAL`
- `DECISION_COMMITMENT` → `USER_STATED_COMMITMENT`
- `RELATIONSHIP_CONTEXT` → `USER_STATED_RELATIONSHIP_CONTEXT`
- `INTERACTION_PREFERENCE` → `USER_STATED_INTERACTION_PREFERENCE`
- `TEMPORARY_STATE` → `USER_STATED_TEMPORARY_STATE`

## Provenance and confidence

Source is preserved so future consumers can distinguish user-stated from user-confirmed information. Memory confidence remains extraction confidence, not truth probability. Importance remains utility metadata, not evidence strength. V1 computes no composite score.

## Bounds, order, duplicates, and conflicts

The server-owned candidate and output caps are both 64. Ordering is deterministic: `updatedAt` descending, then originating memory ID ascending. Exact type/source/content duplicates after Unicode normalization, whitespace collapse, and trim retain the first item in that order. Similar wording is not clustered. Conflicting eligible memories remain separate; this layer does not decide which is true.

## Safety and inference boundary

V1 reads no raw conversation, Safety classification or log. It creates no safety risk, personality, behavior pattern, diagnosis, motive, hypothesis, confidence metric, or Human Model value. It has no provider, model, embedding, vector-search, Context Builder, FAST/DEEP, Behavioral Policy, or response-generation integration and therefore makes no paid calls or visible response changes.

The deliberately future-only pipeline is:

`Memory → Evidence → Hypothesis → Confidence → Human Model / HIM`

Only `Memory → Evidence` is implemented here; later controlled gates must define the remaining algorithms.
