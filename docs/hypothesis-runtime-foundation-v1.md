# Hypothesis Runtime Foundation v1

## Boundary

A hypothesis is a structured provisional explanation, not a fact, conclusion, diagnosis, personality label, or truth probability. It can be supported within current evidence and scope, weakened, contradicted, rejected, retired, or reopened. V1 is internal infrastructure and never creates hypotheses automatically.

The future controlled pipeline is:

`Memory -> Evidence -> Hypothesis -> Confidence -> Human Model / HIM`

Only the Hypothesis Runtime foundation is added by this gate. No provider, model, embedding, Question Engine, Confidence Runtime, Human Model, HIM, context, or response integration exists.

## Object contract

Each user-owned row has a UUID, statement, explicit type, coarse domain, scope, origin, status, version, timestamps, separate supporting and contradicting evidence ID arrays, competing hypothesis IDs, assumptions, and disconfirming conditions. It contains no raw transcript, provider payload, hidden rationale, chain-of-thought, scratchpad, diagnosis, personality field, confidence score, or truth probability.

Types are `CAUSAL`, `BEHAVIORAL`, `MOTIVATIONAL`, `SITUATIONAL`, `RELATIONAL`, `DECISION`, `PREDICTIVE`, `INTERPRETIVE`, and `STRATEGIC`. Domains are `GENERAL`, `RELATIONSHIP`, `WORK`, `DECISION`, `GOAL`, and `INTERACTION`. Both domain and scope must be supplied; neither is inferred.

Origins are `SYSTEM_GENERATED`, `HUMAN_REVIEWED`, `USER_PROPOSED`, and `ADMIN_CONTROLLED`. Origin records provenance and never implies truth. V1 production code has no spontaneous creation path, including for `SYSTEM_GENERATED`.

## Lifecycle

Creation starts at version 1 in `CANDIDATE`. The centralized deterministic graph is:

- `CANDIDATE -> ACTIVE`
- `ACTIVE -> SUPPORTED | MIXED | WEAK | REJECTED | RETIRED`
- `SUPPORTED -> MIXED | WEAK | REJECTED | RETIRED`
- `MIXED -> SUPPORTED | WEAK | REJECTED | RETIRED`
- `WEAK -> ACTIVE | MIXED | REJECTED | RETIRED`
- `REJECTED | RETIRED -> REOPENED`
- `REOPENED -> ACTIVE`

There is no `CONFIRMED` state. Status is lifecycle state, not numeric confidence. Invalid jumps are rejected in both the service and atomic database operation.

## Evidence and competitors

EvidenceService is the eligibility authority. New links must resolve to currently eligible evidence owned by the authenticated user. Supporting and contradicting roles remain independent and the same evidence cannot occupy both roles. Historical IDs are retained when an underlying memory later expires, is deleted, or is superseded; reads separately report which linked IDs remain currently eligible. V1 assigns no evidence weight and reads no raw conversation.

Competition is same-user, non-self, duplicate-free, symmetric, atomic, bounded to 16 peers, and winner-free. Evidence is bounded to 32 links per role.

## Structured metadata, versions, and active set

Assumptions and disconfirming conditions are explicit metadata, not hidden reasoning. Each list is capped at 8 unique non-empty strings of at most 500 characters. Statements and scope are likewise bounded. Material transitions, evidence attachments, and competitor links increment the current-row version and timestamp. V1 deliberately does not implement event sourcing or a version-history table.

`listActiveForUser` returns at most 32 rows in `CANDIDATE`, `ACTIVE`, `SUPPORTED`, `MIXED`, `WEAK`, or `REOPENED`, ordered by `updated_at` descending then ID ascending. `REJECTED` and `RETIRED` are excluded.

## Ownership and privacy

The table has RLS and authenticated-owner policies. The service derives ownership from authenticated arguments; database operations derive it from `auth.uid()` and accept no caller-provided user ID. Cross-user reads, transitions, evidence links, and competitor links fail closed. There is no normal runtime service-role path and no public controller or client contract.

## Guarantees and limitations

V1 performs zero automatic generation, confidence calculation, provider or embedding calls, user exposure, logging of statements, and response-path changes. It does not automatically remove historical evidence links, rank hypotheses, choose a winner, generate questions, compute predictions, or retain a full audit event history. Controlled future gates own generation, confidence calibration, and any Human Model/HIM integration.
