# Post-Response Intelligence Dispatch Runtime v1

Conversation finalization now emits `ConversationTurnCompleted` v2 atomically with the exact server-owned Safety disposition. The foreground request returns after canonical finalization; Memory evaluation, Hypothesis eligibility and intent extraction, controlled candidate generation/persistence, and post-generation Confidence snapshots run only through the background dispatch boundary.

The runtime consumes the existing Redis Stream with a dedicated consumer group, bounded pending-entry reclaim, and explicit ACK. Failed and cancelled terminal events are acknowledged as no-ops. Legacy Completed v1 events are durably recorded as unsupported and never receive an inferred Safety value. `GUIDED` and `BLOCK` are durably skipped before enrichment.

Every Completed v2 event is re-authorized through `BackgroundIntelligenceAuthorityService`, including canonical session, source USER turn, and completed ASSISTANT ownership rereads. Only its unforgeable execution context can reach the background enrichment facade. No user JWT or general service-role adapter is exposed.

Migration 0022 adds an RLS-protected, service-role-only execution ledger and unique effect claims for Memory write, intent provider, candidate provider, Hypothesis persistence, and Confidence batch. A redelivery that finds a claimed but incomplete irreversible effect is quarantined as indeterminate and acknowledged; the effect is never repeated. Terminal executions and bounded-attempt exhaustion are also acknowledged without replaying effects.

This boundary adds no provider type, prompt, model selection, semantic classifier, foreground routing change, schema for domain intelligence, Question mutation, HIM mutation, or direct Evidence persistence. Redis unavailability degrades background dispatch without blocking API startup or an already-finalized foreground response.
