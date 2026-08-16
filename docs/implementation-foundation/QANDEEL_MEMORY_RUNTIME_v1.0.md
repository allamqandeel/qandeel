# QANDEEL — MEMORY RUNTIME v1.0

## Purpose
Memory Runtime defines how Qandeel stores, retrieves, updates, supersedes, expires, and deletes user memory so memory remains useful, selective, private, auditable, and cost-controlled rather than becoming a transcript.

## Core Principle
**Memory exists to improve the current interaction — not to remember everything.**

## Scope
All persistent memory is user-scoped. `user_id` is the primary ownership boundary. No cross-user retrieval. Authorization applies before retrieval/update/export/deletion. Shared/family memory requires a separate explicit scope and consent model. Session state is not automatically permanent memory.

## Categories
Stable Preference, Personal Fact, Goal, Decision/Commitment, Relationship Context, Interaction Preference, Temporary State, Derived Insight. An inference never silently becomes a fact merely because a model generated it.

## Memory Record
Represent memory ID, user ID, scope, type, content, source, confidence, importance, timestamps, status, expiration, and version.

## Sources
`USER_STATED`, `USER_CONFIRMED`, `SYSTEM_DERIVED`, `IMPORTED`, `ADMIN_CONTROLLED`. User-stated/confirmed information generally has stronger authority than system-derived inference.

## Retrieval Policy
Retrieve only when likely to materially improve the turn. Use semantic relevance, topic, recency, importance, confidence, goal/session relevance, prior successful use, and explicit references.

## Retrieval Pipeline
1. Decide whether retrieval is necessary.
2. Generate query.
3. Retrieve candidates using semantic and/or structured filters.
4. Apply user/scope authorization.
5. Rank candidates.
6. Remove stale, contradictory, low-confidence, or irrelevant candidates where appropriate.
7. Bound memory count/context size.
8. Preserve provenance where relevant.
9. Pass selected memory to Context Builder.

## Bounded Retrieval
Use top-K/size limits, prefer high-value memories, avoid duplicates, do not retrieve merely because memory exists, and do not expose unrelated sensitive information.

## Write Policy
Not every message creates memory. Candidates normally require a stable fact/preference, explicit remember request, meaningful goal/commitment, likely future value, or sufficient confidence/longevity. Do not store transient emotion, speculation-as-fact, unnecessary sensitive data, short-lived details, or duplicates by default.

## Confirmation, Confidence & Lifecycle
Uncertain derived information should generally be confirmed before durable storage without interrupting the user's story unnecessarily. Support `ACTIVE`, `SUPERSEDED`, `EXPIRED`, `DELETED`, `DISABLED`, `PENDING_CONFIRMATION`. Newer statements may supersede older memories. Temporary state expires appropriately.

## Persistence & Retrieval Technology
Use hybrid structured + semantic retrieval. PostgreSQL + `pgvector` is the recommended V1 persistence layer.

## Privacy
Least data, least access, least retention, user-scoped authorization, no unnecessary raw-memory logging, no cross-user retrieval, and deletion propagation to active indexes.

## History vs Memory vs Context
History answers “What was said?” Memory answers “What information is worth carrying forward?” Stored memory is not automatically model context; Memory Runtime selects candidates and Context Builder packages only what is needed.

## Events
MemoryCandidateCreated, MemoryCreated, MemoryUpdated, MemorySuperseded, MemoryExpired, MemoryDeleted, MemoryRetrieved, MemoryRetrievalSkipped.

## Interfaces
MemoryRuntime, MemoryRetriever, MemoryRanker, MemoryWriteEvaluator, MemoryStore, MemoryVectorIndex, MemoryConflictResolver, MemoryLifecycleManager, MemoryAuthorizationPolicy.

## Must NOT
Decide personality, replace Orchestrator, blindly store every turn, convert hypotheses to facts without safeguards, expose unrelated memories, bypass authorization, or make permanent retention the default.

## Definition of Done
User-scoped storage; structured records; retrieval can be skipped; bounded relevant retrieval; evaluated writes; source/confidence; update/supersession; expiration; deletion; verified cross-user isolation; Core Runtime integration; tests for retrieval/isolation/contradiction/expiration/deletion.

## Final Principle
**QANDEEL SHOULD REMEMBER WHAT MATTERS, RETRIEVE WHAT HELPS, FORGET WHAT SHOULD EXPIRE, AND NEVER CONFUSE AN INFERENCE WITH A FACT.**
