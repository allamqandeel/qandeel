# QANDEEL — FAST / DEEP Runtime Decision Policy v2

**Phase:** QANDEEL — Integrated Intelligence Runtime & Hardening v1
**Task:** QIR-002 — FAST / DEEP Runtime Decision Policy v2
**Status: ACTIVE / NORMATIVE**
**Supersedes:** the pre-QIR-002 input-length-only routing rule
**Provider / LLM product selection:** EXPLICITLY DEFERRED

QIR-001 — Integrated Intelligence Runtime Contract v1 remains ACTIVE / NORMATIVE
and authoritative above this document. QIR-001 recorded the input-length-only
routing rule and its two reasons as *mutable census, not law*, and named QIR-002
as their owner. This document is the reviewed replacement.

## 1. Entry baseline

- Canonical `main` at task entry: `e687a803f056291011f33e0626f7eb07155ce801`
- Canonical tree at task entry: `bde76210d51aed56c03a23883a561eafd389af6c`
- Canonical merge identity: PR #177 — QIR-001 Integrated Intelligence Runtime Contract v1
- Post-merge canonical-main API CI: run `33299102946` — completed / success
- Latest migration at task entry: `0061_him_brain_context_bridge_v1.sql`

At entry the legal route pairs were owned independently in three places — the
orchestrator's private `content.length >= 1000` rule, the persisted
`conversation_turns_routing_reason_check`, and `runtime-event.types.ts` — and all
three accepted exactly `FAST + FAST_DEFAULT` and
`DEEP + INPUT_LENGTH_REQUIRES_DEEP_CONTEXT`.

## 2. Authority statement

FAST/DEEP is **execution / routing authority only.** It does not own truth,
Safety, Question authority, Hypothesis meaning, Confidence meaning, Human
Intelligence meaning, or product/provider selection, and **no subsystem gains
semantic authority from the routing decision.** The routing reason is
explanatory execution metadata, never a diagnosis, a Safety signal, a stakes or
urgency assessment, or a product claim.

## 3. Policy version

The Runtime Decision Policy version is **2**. Every decision object carries
`policyVersion: 2`, every new canonical claim carries a v2 reason, and the
routing telemetry carries `policy_version: "2"`.

## 4. Provider-neutral normalization

For routing analysis only, and never against canonical user content:

1. Unicode **NFC** normalize.
2. Trim leading/trailing Unicode whitespace.
3. Count Unicode **code points**, not UTF-16 code units.
4. The canonical user content is never mutated.

The policy depends on no vendor tokenizer, model name, word list, sentiment,
diagnosis, personality, clinical or stakes inference, and no Human Intelligence.

## 5. Exact deterministic signals

From the normalized current-turn content only:

- **`codePointCount`** — Unicode code-point count.
- **`questionCount`** — count of exactly `?` and Arabic `؟`.
- **`logicalUnitCount`** — split on one or more of `.` `!` `?` `؟` `;` `؛` `…`
  and newline, discard empty/whitespace-only pieces, count survivors. Empty
  normalized input gives 0. This is structural breadth only, not linguistic
  understanding.

## 6. Exact scoring

| `codePointCount` | input-scale points |
|---|---:|
| `<300` | 0 |
| `300–599` | 1 |
| `600–999` | 2 |
| `>=1000` | 3 |

| `questionCount` | question points |
|---|---:|
| `<2` | 0 |
| `2` | 1 |
| `>=3` | 2 |

| `logicalUnitCount` | logical-breadth points |
|---|---:|
| `<4` | 0 |
| `4–6` | 1 |
| `>=7` | 2 |

`complexityScore = inputScalePoints + questionPoints + logicalBreadthPoints`,
valid range `0..7`.

**Path rule.** Return `DEEP` if either `codePointCount >= 1000` **or**
`complexityScore >= 3`. Otherwise return `FAST`.

This deliberately preserves every pre-QIR-002 `>=1000` DEEP case while adding
bounded structural complexity for shorter multi-part turns.

## 7. Exact v2 reasons and legal pairs

```text
RUNTIME_ROUTING_V2_FAST_DEFAULT
RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE
RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION
RUNTIME_ROUTING_V2_DEEP_MULTI_PART
RUNTIME_ROUTING_V2_DEEP_COMPOSITE
```

Legal current pairs:

- FAST + `RUNTIME_ROUTING_V2_FAST_DEFAULT`
- DEEP + `RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE`
- DEEP + `RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION`
- DEEP + `RUNTIME_ROUTING_V2_DEEP_MULTI_PART`
- DEEP + `RUNTIME_ROUTING_V2_DEEP_COMPOSITE`

**DEEP reason precedence**, applied in this exact order:

1. `codePointCount >= 1000` → `RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE`
2. else `questionPoints >= 2` → `RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION`
3. else `logicalBreadthPoints >= 2` → `RUNTIME_ROUTING_V2_DEEP_MULTI_PART`
4. else → `RUNTIME_ROUTING_V2_DEEP_COMPOSITE`

FAST always uses `RUNTIME_ROUTING_V2_FAST_DEFAULT`.

## 8. The pure routing boundary

- `apps/api/src/intelligence-runtime/fast-deep-routing-contract.ts` — the ONE
  server-owned route-pair contract shared by the orchestrator, the repository
  claim boundary, the runtime-event validator and routing telemetry.
- `apps/api/src/intelligence-runtime/fast-deep-runtime-decision-policy-v2.ts` —
  the decision function.

The decision function is **synchronous, deterministic, CPU-only and
side-effect-free.** It contains no async/await, Promise, timer, database,
network, Redis, provider, model-registry, Memory, HIM, Hypothesis, Confidence,
Recommendation, Question, Safety or telemetry call, and the routing module
imports nothing but its own sibling contract. **No LLM classifier, embedding, or
learned model participates in routing, and routing adds zero provider calls and
zero intelligence-read latency.**

The decision shape is:

```ts
{ policyVersion: 2, path: 'FAST' | 'DEEP', reason: RuntimeRoutingV2Reason,
  complexityScore: 0..7, signals: { codePointCount, questionCount, logicalUnitCount } }
```

## 9. Frozen topology

`RECEIVED → pure CPU routing → canonical claim → ContextBuilder → Safety → intelligence → exactly one conversational provider call when authorized`

The v2 decision is computed **exactly once, before the canonical claim**, for an
eligible RECEIVED turn. Routing is never moved after ContextBuilder, Safety,
HIM, Memory, Hypothesis, Recommendation or Question by this task. Lost-claim and
replay paths start no provider work, create no competing canonical route, and
record no canonical routing decision. The successfully claimed turn remains the
durable routing authority, and the claim boundary carries only the route pair —
the signals and score never reach persistence or the provider.

The selected path keeps driving every existing downstream projection unchanged:
HIM density projection, the model-router path, the LOW/HIGH complexity mapping,
the current latency-budget values, and path telemetry.

## 10. Durable authority — migration 0062

`database/migrations/0062_fast_deep_runtime_decision_policy_v2.sql` splits the
durable routing contract in two, because reading history and authorizing new
work are not the same authority:

- The persisted `conversation_turns_routing_reason_check` is **widened** to
  `{null/null, both historical legacy pairs, all five v2 pairs}`, so every
  canonical row written before QIR-002 stays valid. Cross pairs, unknown
  reasons, path-only and reason-only states stay rejected.
- `claim_conversation_turn` is **narrowed**: a NEW claim accepts only the five
  v2 pairs and rejects the retired `FAST_DEFAULT` and
  `INPUT_LENGTH_REQUIRES_DEEP_CONTEXT`, unknown reasons, cross pairs and
  null/partial routing arguments with `INVALID_ROUTING`.

The gate is also made **total**. The migration-0025/0039 predicate was
three-valued: a NULL path or NULL reason collapsed every disjunct to NULL,
`NOT(NULL)` is NULL, and plpgsql treats a NULL `IF` condition as false — so the
`RAISE` was skipped and a NULL/NULL claim could transition `RECEIVED →
GENERATING` with no durable route at all (the table CHECK accepts null/null as
the legitimate pre-routing state, so nothing downstream caught it). The explicit
NULL guard closes that hole; it strengthens the gate and weakens nothing,
because a NULL routing argument was never a legal claim under any policy
version.

No historical migration is edited. The claim replacement preserves migration
0025/0039 authority exactly: service-role-only execution, SECURITY DEFINER with
an empty `search_path`, the NULL-user guard, explicit session/user ownership,
the USER + RECEIVED requirement, the `FOR UPDATE` one-claimant-wins row lock, the
server-owned generation lease, and no direct mutation grant on
`conversation_turns` for any request role.

`database/verify-migration-0062.mjs` proves all of it against real PostgreSQL,
including a two-connection row-lock race.

## 11. Runtime-event compatibility

The routing surface is versioned deliberately, without a new payload shape.
`runtime-event.types.ts` now validates the route pair through the ONE shared
server-owned contract instead of hard-coding reasons a second time. Event
validation accepts both historical legacy pairs and all five v2 pairs, and
rejects unknown reasons, cross pairs and null mismatches. **Historical durable
and pending events remain valid and recoverable**, and current claims produce
only v2 reasons. The payload key set, `event_version` and `schema_ref` are
unchanged: no completed-v2 or schema bump was necessary.

## 12. Routing telemetry

Metric `qandeel.routing.decisions`, with exactly four finite dimensions:

- `processing_path`: `FAST` | `DEEP`
- `routing_reason`: one of the five v2 reasons
- `policy_version`: `"2"`
- `complexity_score`: `"0"`..`"7"`

No user content, normalized text, arbitrary free text, identifier, unbounded
count, or vendor/model identity may become a label; anything that is not an
exact legal current pair, the exact policy version, and an in-range integer
score is dropped rather than emitted. Only the canonical successful claim winner
records a decision. Lost claim and replay record nothing, and telemetry failure
can never alter routing or the turn outcome.

## 13. Explicit non-goals

QIR-002 does **not** select a final Provider or LLM, add any model call, change
`model-profile.registry.ts` or any provider adapter, introduce provider fallback
or racing, alter Safety authority, alter QHIA metric/relevance semantics, or
change the frozen QHIA 300 ms Human Intelligence foreground topology. It adds no
semantic, stakes, emotional or keyword-based routing.

The following remain owned by later tasks and are **not** frozen here:
Memory → Hypothesis foreground acquisition ordering (QIR-003), the global
integrated context budget (QIR-004), background scheduling and provider-call
budgeting (QIR-005), and the Question / Information-Gap closed loop (QIR-006).
Vendor/model identifiers and provider SLA values remain deferred.

## 14. Acceptance

FAST/DEEP is chosen exactly once by a deterministic, Unicode-aware,
provider-neutral, CPU-only v2 policy before canonical claim; its decision is
durably authorized and propagated without event incompatibility; historical
routing remains readable; new claims use only v2 reasons; routing adds zero LLM
calls and zero intelligence-read latency; and no subsystem gains semantic
authority from the routing decision.
