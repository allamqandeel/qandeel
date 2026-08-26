# Memory Runtime v1 — Persistence and Ownership

Issue #32 establishes durable memory storage without changing generated responses. Conversation turns remain the authoritative record of what was said; a memory is a separate, selective record worth carrying forward. No conversation turn is copied into durable memory automatically.

## Record and ownership

`public.memories` uses an application-generated UUID and is owned by one authenticated `user_id`. Its only v1 scope is `USER`. The record contains type, content, source, confidence, importance, lifecycle status, version, timestamps, optional expiration, and optional predecessor lineage. It contains no transcript, embedding, model, or provider field.

RLS is enabled and the authenticated policy compares `user_id` with `auth.uid()` for select. Ownership cannot be transferred across users. Anonymous access and physical `DELETE` privileges are denied.

Migration 0026 (Memory Authority Hardening) makes Memory writes server-only. Ownership RLS proves tenancy but not authority, so provenance, lifecycle, scoring, version, and timestamps could otherwise be forged inside a caller's own tenant and then flow into Evidence, Hypothesis, and Confidence. An authenticated client now holds `SELECT` and no `INSERT`, `UPDATE`, or `DELETE`; the permissive insert/update policies are dropped; and the legacy generic `supersede_memory` RPC is no longer executable by an ordinary client. The production repository reads with the caller's access token and writes only through three narrow `SECURITY DEFINER` commands — `server_create_memory_v1`, `server_mark_memory_deleted_v1`, and `server_supersede_memory_v1` — reached over an explicit service-role channel that never accepts a caller token and fails closed when server authority is unconfigured.

## Canonical vocabulary

Types are exactly `STABLE_PREFERENCE`, `PERSONAL_FACT`, `GOAL`, `DECISION_COMMITMENT`, `RELATIONSHIP_CONTEXT`, `INTERACTION_PREFERENCE`, `TEMPORARY_STATE`, and `DERIVED_INSIGHT`.

Sources are exactly `USER_STATED`, `USER_CONFIRMED`, `SYSTEM_DERIVED`, `IMPORTED`, and `ADMIN_CONTROLLED`. Source expresses provenance; confidence is a separate bounded estimate and does not grant authority.

Statuses are exactly `ACTIVE`, `SUPERSEDED`, `EXPIRED`, `DELETED`, `DISABLED`, and `PENDING_CONFIRMATION`. System-derived records default to `PENDING_CONFIRMATION`, and both runtime and database constraints reject a `SYSTEM_DERIVED` record that attempts to become `ACTIVE` silently.

Confidence and importance are finite numbers from 0 through 1. Importance indicates likely future value, not truth. Database checks and runtime validation reject values outside that interval and invalid numeric values.

## Lifecycle

Explicit correction uses one atomic, server-authoritative database operation. It locks an owned active predecessor, creates a new successor that inherits the predecessor's owner and scope with `version + 1` and `supersedes_memory_id`, then marks the predecessor `SUPERSEDED`. The old content remains for lineage. Self-supersession, multiple successors, and cross-user supersession fail closed.

An optional `expires_at` must be later than creation. `TEMPORARY_STATE` can use it, as can another intentionally temporary memory. No scheduler is required: active queries select only `ACTIVE` rows whose expiration is absent or still in the future.

V1 deletion is a lifecycle update to `DELETED`; it is not a physical-retention policy. Any owned record is a legitimate target whatever its current status, and only `status` and `updated_at` move: provenance, scoring, version, content, `created_at`, and lineage are preserved, so a superseded predecessor can be marked deleted while keeping its row and its lineage link. Active queries therefore exclude deleted, disabled, superseded, expired, and pending records. Permanent account deletion/export semantics remain a separate controlled gate.

## Internal server boundary

`MemoryRuntimeService` validates deterministic write and lifecycle invariants and generates IDs; its mutation methods take no access token, because a caller credential is never the authority for an authoritative Memory write. `MemoryRepository` owns owner-scoped authenticated reads and routes every write to the server-only commands through `MemoryServiceRoleApiService`; it has no generic column-update path. The background-intelligence Memory writer still requires its opaque `BackgroundIntelligenceExecutionContext` and creates through the same narrow command, taking the owner from that context rather than from the input. There is no public memory controller or UI. Conversation Orchestrator, ContextBuilder, Behavioral Response Policy, Safety Response Gate, Model Router, and provider adapters do not depend on memory persistence.

## Deliberately deferred

Memory Retrieval v1 will decide when retrieval helps, implement bounded structured/semantic candidate selection and ranking, and pass selected records to ContextBuilder. This gate does not add automatic extraction, LLM classification, embeddings, vector dimensions, semantic search, contradiction detection, response-context injection, provider calls, shared memory, safety memory, proactive behavior, or voice behavior.
