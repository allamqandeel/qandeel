# HIM Metric Calculation / Calibration Runtime v1

## Architectural position

This internal, provider-neutral substrate sits after canonical HIM definitions and before any future derived view. HIF still owns construct meaning; HIM owns measurement. It adds contracts and integrity boundaries, not a production measurement model. It has no controller, UI, Context Builder, orchestrator, provider, realtime, or automatic recalculation integration.

## Calculation model and lifecycle

A versioned model binds an exact model ID/version to an exact metric key/definition version. Bounded metadata covers lifecycle (`DRAFT`, `VALIDATED`, `CALIBRATED`, `RETIRED`), production/test environment, canonical owner/source, method and implementation identifiers, scale reference, explicit required inputs/evidence, exact supported contexts, missing/conflict behavior, metric-confidence integration, timestamps, and optional retirement/supersession.

`VALIDATED` means only that structural validation passed. `CALIBRATED` requires a separately supplied, protected approval artifact. Calibration rows, test success, evidence count, or authorship never cause promotion. Ordinary authenticated users have no model-write or promotion RPC. The approving authority remains a governance gap, so no production model is promoted in v1.

Test fixtures use the reserved `test.synthetic.*` namespace. Code and database constraints prohibit test-only models from targeting production keys and production models from targeting test keys. No synthetic definition is added to the 17-metric catalog.

## Calculation port and result

`HimMetricCalculator` is deterministic and provider-neutral. Input and result carry exact metric/model versions, exact context, separate bounded supporting and contradictory evidence references, explicit missing inputs, provenance, timestamp, trace ID, and update reason. Persistence must validate calculator output rather than trust it.

Missing is never zero: absent required inputs produce `UNASSESSED` with `numericValue = null`. Contradictions are preserved as `PRESENT_UNRESOLVED`; because no canonical conflict-resolution rule exists, they are not averaged. Context must be explicitly supported and exact; there is no fallback or cross-context promotion.

Metric confidence is separate from value. V1 permits only `UNASSESSED` with a null reference. It neither imports hypothesis confidence nor creates a second confidence formula.

## Calibration artifact and persistence

Append-only calibration evaluations bind an owned result to the exact model/version, metric/version, and context, plus an explicitly supplied structured reference outcome. Comparison, bias, and confidence-calibration states remain structurally unassessed. No thresholds, statistics, sample-size rules, or automatic mutation are defined.

PostgreSQL stores immutable model definitions, calculation history, and calibration evaluations with foreign-key version binding. User-scoped results/evaluations use owner-select RLS and default-deny writes. Canonical model definitions are invisible to ordinary authenticated mutation. There is intentionally no authenticated creation or promotion RPC in v1; a future server-controlled path must validate evidence ownership, exact context, canonical provenance, finite values, scale compatibility, and protected governance approval before persistence.

## Open decisions and readiness

Exact formulas, production scales, thresholds, bands, weights, dependency edges, temporal decay, update cadence, materiality, confidence formula, calibration methodology, acceptable error/bias, minimum sample size, and promotion authority remain unresolved canonical decisions.

All 17 canonical production definitions are unchanged: 5 HSE mappings remain `STATE`, Purpose Alignment remains `ALIGNMENT`, and 11 mappings remain `UNRESOLVED`. **0 are `CALIBRATED`; 17 are `UNCALIBRATED`.** HIM Trends is therefore still not safe. The next gate is an approved measurement-model specification and deterministic implementation for at least one canonical metric, including scale, metric-confidence bridge, calibration method, and governance approval.

This runtime makes zero Claude, OpenAI, Gemini, embedding, vector-search, or paid calls. It invents zero formulas, scales, thresholds, bands, decay functions, or trend values.
