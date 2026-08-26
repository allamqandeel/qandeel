# Information Gap / Question Integration v1

Phase: Phase II — Intelligence Runtime Completion
Forward migration: `database/migrations/0038_information_gap_question_integration_v1.sql`
Real PostgreSQL verifier: `database/verify-migration-0038.mjs`
(`npm run verify:information-gap-question-integration:integration`)

## Architectural position

The frozen Question / Information Gap Runtime v1 (migration 0007) already
represents an explicit unknown before any question is proposed, and the
post-response runtime already produces canonical durable Confidence outputs:
the A2.3c `HYPOTHESIS_UPDATE_BATCH` exact-version receipts and the QAN-AUD-06
`CONFIDENCE_BATCH_EVALUATED` receipts. What was missing was exactly one
boundary: the live background runtime never materialized the safe structural
missing-information state of those durable Confidence outputs into Information
Gap state.

This task closes that boundary and nothing else. The existing Question
foundation was **preserved, not rebuilt**: the `information_gaps` /
`question_candidates` schemas, the candidate proposal/validation runtime, the
`VALIDATED`-only candidate lifecycle, the null utility/information-gain fields
and the `UNASSESSED` ranking state are all unchanged. The canonical ABS
principle stands: an Information Gap exists **before** a Question, and this
task connects live intelligence to Information Gap state — the canonical
prerequisite to any future Question selection — without faking the unresolved
Question policy.

## Durable Confidence sources and exact-version authority

The one synchronization command derives source Confidence **only** from the
same execution's durable typed effects:

- **Source A** — a completed `HYPOTHESIS_UPDATE_BATCH` / `UPDATES_APPLIED`:
  only receipts with `confidenceStatus = EVALUATED`, each contributing the
  exact `(confidenceEvaluationId, hypothesisId, afterVersion)`. A
  `PENDING_RETRY` receipt has no successful exact evaluation and contributes
  nothing; the missing A2.3c Confidence retry engine is not built here.
- **Source B** — a completed `CONFIDENCE_BATCH` / `CONFIDENCE_BATCH_EVALUATED`:
  the exact ordered receipts `(confidenceEvaluationId, hypothesisId,
  targetVersion)`. `NO_CONFIDENCE_TARGETS` contributes nothing.

There is no other source authority: no latest-Confidence scan, no
current-version substitution, no world-state inference, no caller-supplied
Confidence identities, and no foreground/manual Confidence history. Every
derived source is validated against the canonical `confidence_evaluations` row
— execution owner, `HYPOTHESIS` target type, exact target Hypothesis, **exact
durable target version**, canonical lifecycle/provenance/policy, and the
intentionally null score/band — before anything is written. A Hypothesis that
advanced after the original evaluation keeps its historical exact-version
source; the durable source is never retargeted to a later version. Any
malformed, missing, foreign or structurally inconsistent source — a
rejected/legacy/indeterminate durable batch and an unknown future
missing-information code included — returns the bounded
`{status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE'}` with zero writes
in that invocation. Validate first, materialize second.

## Why the calibration code is not a user gap

The canonical Confidence Runtime exposes four missing-information codes. Three
are actionable structural unknowns and may materialize an **internal**
Information Gap:

| code | `information_needed` |
| --- | --- |
| `NO_ELIGIBLE_EVIDENCE` | `Eligible evidence for the current Hypothesis version is missing.` |
| `UNVERIFIED_ASSUMPTIONS` | `One or more assumptions in the current Hypothesis remain unverified.` |
| `COMPETING_HYPOTHESES_UNASSESSED` | `Competing Hypotheses remain unassessed in the current Confidence snapshot.` |

Each gap's `why_it_matters` is `Confidence Runtime reported <code> for this
exact Hypothesis version.` The text is deterministic and fixed; no model or
provider writes it.

`CONFIDENCE_MODEL_UNCALIBRATED` is a statement about the model, not about the
user's world: alone it produces zero gaps, and mixed with actionable codes it
is filtered out. An unknown future code fails closed instead of being silently
ignored. Materializing a gap does **not** mean the user can answer it: every
automatic gap is created with `user_answerability = UNASSESSED`, a `NULL`
preferred Question type, exact single-Hypothesis linkage, exact canonical
Confidence-evaluation linkage, `status = OPEN`, `version = 1` and
`provenance = QANDEEL_QUESTION_RUNTIME`.

## Shared creation core and the service-role sync command

Migration 0038 does not duplicate the migration-0007 creation semantics.
`create_information_gap_core_v1(p_user_id uuid, p_gap jsonb)` carries the exact
0007 validation/creation behavior with an explicit trusted owner and no
`auth.uid()`; it is `SECURITY DEFINER`, `search_path`-hardened, and executable
by **no** application role (`PUBLIC`, `anon`, `authenticated`, `service_role`).
The authenticated `create_information_gap(jsonb)` keeps its exact signature,
`auth.uid()`-only ownership, validation, observable errors, result shape and
grants as a narrow wrapper over that core — the same core+wrapper pattern as
migrations 0036 and 0037.

`sync_post_response_information_gaps_v1(p_execution_id uuid)` is the ONE
service-role-only synchronization command. It accepts **only** the execution
identity — never a user, Hypothesis, version, Confidence identity, code, text,
token or JWT — and there is no generic service-role "create any gap" RPC. The
application boundary is one narrow repository method,
`PostResponseIntelligenceRepository.syncInformationGaps(executionId)`, using
the service-role database authority that repository already owns, with a
strict typed result parser (`information-gap-sync-result.ts`) that never
trusts HTTP 2xx alone.

## Source traceability and cross-execution idempotency

`information_gap_confidence_sources` durably binds each automatic gap to its
exact source tuple `(user_id, hypothesis_id, target_version,
missing_information_code)` plus the canonical `confidence_evaluation_id` and a
timestamp — nothing else: no Evidence content, Memory content, transcript,
provider payload, hidden reasoning, or diagnosis/personality field. The tuple
is the primary key (at most one automatic gap per exact structural source);
`UNIQUE(information_gap_id)` keeps one source row per automatic gap and
prevents rebinding a gap to a second tuple; every FK is an exact-owner
composite FK. The table is internal: RLS enabled, zero privileges for every
application role, no public/client API.

Materialization is deterministic and bounded: update receipts in durable
`commandOrdinal` order, then generation receipts in durable `ordinal` order,
each evaluation's stored `missing_information_codes` array order preserved,
the calibration-only code filtered, tuples deduplicated by first canonical
occurrence, and the current-contract maximum of 27 tuples (4 update + 5
generation receipts × 3 actionable codes) enforced fail-closed. Concurrent
executions materializing the same exact tuple are serialized by
transaction-scoped advisory locks keyed from the tuple and acquired in
globally sorted order (deadlock-free), with the primary key as the database
backstop: exactly one canonical gap/source pair survives and both syncs
resolve to the same gap identity — no read-then-insert race, no orphan gap. A
later execution that encounters the same exact tuple reuses the same gap.
Manual gaps created through the authenticated wrapper are not semantically
deduplicated against automatic gaps; no text matching exists.

## Post-response ordering and recovery

Update stage — after a successful or recovered `UPDATES_APPLIED` batch and
before any downstream provider activity:

```text
HYPOTHESIS_UPDATE_BATCH → exact-version update Confidence receipts
→ sync Information Gaps → Generation Eligibility → Intent → Candidate → ...
```

A sync transport failure returns non-terminal (non-ACK) with zero downstream
provider work; redelivery recovers the completed batch and reruns the
idempotent sync, never replaying the mutation or its Confidence evaluations. A
rejected/indeterminate durable Update result keeps the existing quarantine
behavior and no gap is created from an untrusted batch.

Generation stage — after `CONFIDENCE_BATCH` is durably completed and
validated:

```text
CONFIDENCE_BATCH → sync Information Gaps → terminal COMPLETED → Redis ACK
```

Synchronization must succeed before terminal success. On sync transport
failure the execution is not terminalized and not ACKed; the existing bounded
redelivery finds the durable Confidence result, replays zero upstream work
(zero Memory, Association, Update, Eligibility, Intent, Candidate,
Persistence, HIM and Confidence — the QAN-AUD-06 direct resume is preserved)
and reruns only the idempotent sync before terminalizing. If the network
response is lost after a sync commits, redelivery executes the same sync again
and resolves to the same canonical gap set: the domain state plus its exact
source table are the recovery truth, which is why **no new post-response
effect key, second ledger, queue, worker or scheduler exists**. A terminal
duplicate delivery remains an immediate no-op: zero sync, zero new gap/source
row, zero provider call.

## Boundaries preserved

- **Zero new provider/model calls.** The A2 smoke still performs exactly three
  deterministic provider calls (Association, Intent, Hypothesis Candidate) and
  production provider counts are unchanged.
- **No automatic Question Candidate generation.**
  `QuestionService.generateValidated(...)` is not invoked, no production
  `QuestionCandidateGenerator` is bound, and the integration creates zero
  `question_candidates` rows (proven in tests and the A2 smoke).
- **No selection or asking.** Nothing enters the foreground response, no
  public Question endpoint exists, and no candidate becomes
  Ranked/Selected/Asked.
- **No answer ingestion.** No answer persistence, no Question → Evidence /
  Memory / HIM / Hypothesis / Confidence mutation, and refusal is never
  evidence of anything.
- **HIM stays advisory generation input only** — never a gap-existence,
  ranking or suppression signal.
- **Hypothesis and Confidence authority unchanged** — the source table
  references exact history but owns no lifecycle or evaluation state.

## Explicit limitations and open Question policy

The canonical Question specification still leaves unresolved: the
information-gain and utility math, ranking weights, sensitivity/emotional-cost
/user-effort/timing scoring, question budget and stopping policy, high-stakes
thresholds, final selection, and the production LLM candidate-generation
strategy. This task deliberately implements none of them. Automatic gaps are
internal structural state with unassessed answerability; deciding whether,
when and how to ask remains a future controlled gate that must address safety,
privacy, timing, burden, ranking, selection, asking, refusal and answer
handling before any user-visible invocation.
