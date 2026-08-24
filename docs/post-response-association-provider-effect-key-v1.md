# Post-Response Association Provider Effect Key v1

The durable post-response effect registry now represents the Association Provider with its own `ASSOCIATION_PROVIDER` key. It cannot reuse `CANDIDATE_PROVIDER`: candidate generation and evidence association are independent potentially irreversible provider effects, and sharing a claim would let one suppress the other during redelivery or process recovery.

The canonical registry is exactly:

1. `MEMORY_WRITE`
2. `INTENT_PROVIDER`
3. `CANDIDATE_PROVIDER`
4. `ASSOCIATION_PROVIDER`
5. `HYPOTHESIS_PERSISTENCE`
6. `CONFIDENCE_BATCH`

Migration 0023 extends only the existing effect-key check constraint. The existing composite primary key `(execution_id, effect_key)`, generic service-role-only claim/complete/list RPCs, RLS, ACLs, and `NOT_PRESENT → CLAIMED → COMPLETED` lifecycle remain unchanged. A duplicate claim remains idempotently rejected, and a redelivery that observes a claimed but incomplete effect remains indeterminate rather than retryable.

This extension makes the key representable; it does not invoke or connect the Association Provider. It adds no Hypothesis or Confidence mutation and changes no Redis, dispatcher, Orchestrator, retry, reset, or provider behavior. A2.2c is the intended future consumer of this key.
