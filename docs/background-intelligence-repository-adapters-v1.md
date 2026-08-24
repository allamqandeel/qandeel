# Background Intelligence Repository Adapters v1

This boundary makes the existing post-response Memory, Evidence, controlled Hypothesis generation, and Confidence semantics available to a future background dispatcher without retaining or replaying a user bearer token. It is dormant: this change adds no consumer, dispatch, retry, acknowledgement, idempotency, or orchestrator timing behavior.

`BackgroundIntelligenceAuthorityService` remains the sole issuer of `BackgroundIntelligenceExecutionContext` after canonical ownership verification. `BackgroundIntelligenceEnrichmentService` is the only additional exported Nest capability. Every method requires the branded execution context; pre-authorization, spread, and prototype-forged objects fail closed. The raw service-role data adapter remains private to `BackgroundIntelligenceModule`.

Memory evaluation reuses `MemoryWriteEvaluatorService` and `normalizeMemoryContent`. Evidence uses the canonical `projectEligibleEvidence` projection. Foreground and background generation share the same request normalization, collision key, and candidate validation policy. Confidence canonicalization remains database-authoritative.

Migration 0021 adds four explicit-owner `SECURITY DEFINER` functions for system Hypothesis creation, evidence attachment, competitor linking, and immutable Confidence creation. They never depend on `auth.uid()`, qualify database objects, constrain every target by the explicit owner, and grant execution only to `service_role`. They do not add table grants or change RLS policies.

The background facade accepts no access token or user JWT. Source-turn content is reread only after execution authority exists and is scoped by exact user, session, source turn, completed status, and USER role.
