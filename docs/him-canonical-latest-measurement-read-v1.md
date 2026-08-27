# HIM Canonical Latest Measurement Read v1

Authoritative contract for the canonical "latest measurement" read installed by
migration `0052_him_canonical_latest_measurement_read_semantics_v1.sql`
(QHIM-005 + QHIM-007 remediation). This document defines current-read
semantics only. It grants no new Runtime Consumption approval, changes no
Trend or Intelligence Snapshot eligibility, and calibrates nothing.

## Canonical latest vs history

- **Canonical latest** is one derived read:
  `public.read_him_latest_measurement_v1(p_user_id, p_metric_key,
  p_definition_version, p_context_kind, p_context_id)` returning at most one
  `him_metric_snapshots`-shaped row through the QHIM-001 structured-current
  view. It is the only canonical repository `getLatest` path
  (`HimRepository.getLatest` → this RPC, nothing else).
- **History** is a separate, explicit surface. `HimRepository.history(...)`
  and `HimRepository.listForContext(...)` remain raw
  `him_metric_snapshots` reads under their existing owner-scoped authority.
  Preserved legacy raw snapshots (for example pre-0051 Energy/SITUATION rows)
  stay durable audit history there and are **never** canonical latest
  authority. Canonical latest never falls back to raw snapshot history for
  any reason.

## Exact metric definition identity

Every canonical latest read names the exact persisted definition:
`(metric_key, definition_version)`. There is no implicit version, no
`definitionVersion = 1` default, and no "latest definition version"
inference. A future metric v2 coexists without changing the meaning of a v1
read: an event qualifies for a v1 read only through an observation carrying
exactly the requested `(metric_key, definition_version)`.

## Valid-context authority

The exact persisted definition's `valid_context_kinds` array is the only
context-eligibility authority. If the requested context kind is not in the
exact definition's list, the read fails closed with a stable sanitized error
— for every metric family, not only Energy (e.g. `hse.energy@1/SITUATION`,
`hbs.avoidance@1/CONVERSATION_SESSION`, `hrs.relationship-trust@1/SITUATION`,
`hgs.purpose-alignment@1/SITUATION` all reject). The application service
(`HimService.getLatest`) performs the same validation early for error
clarity, but the database RPC enforces it independently, so bypassing the
service cannot restore the defect. No hand-written metric/context matrix
exists in the repository layer.

## Context ownership

After eligibility, the exact context must belong to the authenticated caller
(`auth.uid()`, which must equal `p_user_id`):

- `CONVERSATION_SESSION` → `public.conversation_sessions` (id + user_id);
- `SITUATION`, `DECISION`, `GOAL`, `RELATIONSHIP` →
  `public.him_measurement_targets` (id + user_id + exact context_kind).

Unknown or cross-user contexts fail closed without revealing whether another
user's measurement exists. A valid owned context with no measurement is not
an error: the read returns zero rows.

## Measurement-event chronology

Canonical latest is **measurement chronology** — never calculation, snapshot,
snapshot-version, or result-insertion chronology. Across measurement events
the newest event is selected by:

```
him_measurement_events.created_at DESC, him_measurement_events.id DESC
```

The `id DESC` term is the deterministic tie-break for equal event
timestamps. A later recalculation of an older event (which legitimately
receives a higher `snapshot_version`) can never make that older event
"latest".

## Correction semantics

Explicit correction is not a new measurement event. A correction observation
stays attached to its original event and replaces the value **within** that
event (latest unsuperseded observation by `observation.created_at DESC,
observation.id DESC` inside the chosen event only). Correcting an older
event never makes it newer than a later event; correcting the newest event
keeps it newest with the corrected value once calculated.

## Binding-current semantics (within one observation)

Inside the chosen unsuperseded observation, the migration-0050 QHIM-001
selection stays authoritative and untouched: at most one current snapshot
per observation, ACTIVE-binding snapshot preferred, and exactly one
historical-fallback snapshot when no ACTIVE-binding snapshot exists yet
after a binding transition. Snapshot chronology (including
`snapshot_version`) is legitimate **only inside that one observation** as
the 0050 fallback mechanism. Binding compatibility selects within an
observation; it never reorders different measurement events.

## Latest event without a usable snapshot

- If the newest qualifying event's current observation has **no** current
  structured snapshot yet (e.g. a fresh correction or a not-yet-calculated
  observation), canonical latest returns **zero rows**. It never walks back
  to an older event's calculated value — an older measurement must never
  masquerade as current.
- If the newest event's current observation has only a historical
  retired-binding fallback snapshot, canonical latest returns exactly that
  snapshot. "Latest" is never redefined as "latest currently compatible
  calculation"; the returned row carries `canonical_binding_id` so callers
  can evaluate source-binding compatibility separately, exactly as
  Intelligence Snapshot does.

## Distinction from Trend

Trend (`read_him_trend_source_v1`) keeps its own approved temporal-sequence
contract and eligibility (five HSE metrics) and does not route through this
RPC. This contract governs single-current reads only.

## Parity with Intelligence Snapshot

`read_him_intelligence_snapshot_v1` already selects its per-slot event by
`me.created_at DESC, me.id DESC` and its observation within that event
before joining the structured-current view. The generic canonical latest
read encodes the identical frozen chronology, so both surfaces identify the
same latest `measurement_event_id` / `measurement_observation_id` for a
shared route; the 0052 verifier proves this parity, including under the
late-recalculation adversarial scenario.

## Legacy raw snapshots

Pre-structured raw `him_metric_snapshots` rows remain preserved, unmodified,
and reachable through the explicit history/audit reads only. Migration 0052
deletes nothing, backfills nothing, reinterprets nothing, and makes no
legacy Energy/SITUATION record current.
