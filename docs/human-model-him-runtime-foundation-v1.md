# Human Model / HIM Runtime Foundation v1

## Boundary and ownership

This gate adds the provider-neutral internal foundation for Human Intelligence Metrics (HIM). HIF owns human-construct meaning, HIM owns measurement definitions, the HIM Integration specification owns the runtime bridge, ABS consumes approved metrics, PDS owns product expression, and ES/runtime owns storage and execution. Runtime code cannot redefine a construct or metric.

The module is not connected to Conversation Orchestrator, Context Builder, Behavioral Policy, Safety response handling, Model Router, FAST/DEEP routing, provider payloads, mobile, Profile, SENA, dashboards, or My Intelligence. It has no controller and produces no user-visible output or normal response-path change.

## Empty definition registry

The definition registry deliberately contains zero production metrics. A definition contract carries stable key and version, canonical name/definition/source, one of the eight semantic types, a scale reference, valid context kinds, required-input and future confidence references, consumer/source metadata, and only explicitly supplied dependency IDs.

Registration rejects malformed fields, unsupported semantic or context values, duplicate identity/version, duplicate dependencies, self-dependency, unresolved references, and cycles. It provides infrastructure only; it defines no actual edges. The database definition table is likewise empty after migration and cannot be written by an authenticated client.

## Semantic types

The bounded canonical set is `STATE`, `TRAIT`, `CAPABILITY`, `READINESS`, `ALIGNMENT`, `UNCERTAINTY`, `PROGRESS`, and `LOAD`. These tags are semantic identities, not formulas or psychological conclusions. In particular, a `STATE` snapshot cannot be promoted to a trait or personality judgment by this runtime.

## Metric observations and snapshots

Snapshots are user-owned, append-only records bound to an exact definition identity/version and semantic type. They carry explicit value state, bounded supporting and contradicting evidence references, a server-derived canonical source engine, exact context, scope, server timestamp, optional structural evidence window, validity, server-derived per-context snapshot version, caller-authored descriptive update metadata, and server-derived canonical provenance.

`UNASSESSED` always stores `NULL`; it is distinct from assessed numeric zero. `ASSESSED` requires a finite numeric value. The foundation assigns no values and implements no production scale, formula, weight, threshold, band, composite, or calculation.

## Exact context behavior

Supported context kinds are `GLOBAL`, `RELATIONSHIP`, `DECISION`, `GOAL`, `CONVERSATION_SESSION`, and `SITUATION`, following the canonical bridge. Global identity is exactly `GLOBAL`; relationship, decision, goal, and conversation/session identities are UUIDs; situation identity follows the chosen bounded non-empty identifier contract and cannot equal `GLOBAL`. Both service and database RPC enforce these rules. Every read supplies both context kind and context identity, and indexes/history keys include both. A contextual value never falls back or generalizes to another context or global state.

## Provenance and evidence

HIM consumes the existing Memory/Evidence boundary; it neither creates nor mutates evidence. Persisted supporting, contradicting, and descriptive update references are bounded, role-disjoint where applicable, and verified by the database as active, unexpired, same-user memory references. Conflict is retained. The caller may explain an update through `descriptive_update_reason` and owned `descriptive_update_reference_ids`; neither is canonical provenance. The RPC derives canonical `source_engines = [QANDEEL_HIM_RUNTIME]` and `canonical_provenance = QANDEEL_HIM_RUNTIME_FOUNDATION_V1`, and rejects caller attempts to supply either.

The schema has no chain-of-thought, scratchpad, provider payload, raw transcript, diagnosis, unrestricted rationale, or personality-label field. No Memory, Evidence, Hypothesis, Confidence, Question, or Information Gap row is mutated.

## Confidence boundary

Metric value and metric confidence remain separate. V1 persists metric confidence only as `UNASSESSED` with a null reference. It defines no metric-confidence formula and does not copy, map, or equate the hypothesis-oriented Qandeel Confidence Runtime with metric confidence.

## Versioning and history

Definition versions are immutable identities and snapshots retain the exact referenced version. Snapshot history is append-only and deterministically ordered by a server-derived version scoped to user + metric + exact context. An advisory transaction lock prevents concurrent version allocation races. Ownership, semantic type, observation time, creation time, and version are derived or verified server-side; authenticated roles receive no insert/update/delete table privileges.

## Security and privacy

Snapshot reads use RLS and default-deny cross-user access. Creation is available only through a security-definer function that derives `auth.uid()`, verifies definition identity/version and exact context identity, canonicalizes semantic type, confidence state, source engine and provenance, validates evidence ownership, and derives history metadata. Definitions cannot be created by the authenticated role. The real PostgreSQL verifier exercises invalid UUID-bound contexts, forged canonical source/provenance, other direct-RPC forgery, and cross-user failure cases.

## Deliberately open

Production metric namespace/list, mathematical definitions, confidence formulas, update cadence, temporal decay, context hierarchy, materiality thresholds, actual dependency graph, realtime caching, user-visible policy, high-impact governance, calibration, and derived-metric privacy/deletion policy remain open. V1 has no trend computation, materiality events, recalculation engine, subscriptions, Intelligence Snapshot, or temporal decay.

## Provider and cost neutrality

The module imports no provider adapter and performs zero Claude, OpenAI, Gemini, embedding, vector-search, or paid calls. It contains no provider-specific calculator or interpreter.

## Next gate

The next controlled gate is **Initial HIM Metrics**, where canonical definitions may be reviewed and introduced without changing this foundation's ownership, missingness, context, provenance, confidence, versioning, or security boundaries.
