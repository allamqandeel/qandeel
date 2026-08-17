# QANDEEL Brain Bake-off Harness v1

This local, evaluation-only harness compares Anthropic FAST with OpenAI FAST and Anthropic DEEP with OpenAI DEEP across 24 deterministic synthetic QANDEEL conversations. It reuses the production model profiles, provider adapters, output-token bounds, and `BehavioralResponsePolicyService`. It does not use production data, databases, client contracts, fallback, retries, provider-specific prompt tuning, or production routing.

## Commands

- `npm run eval:brain:validate` validates suite/configuration, the deterministic 48-request plan, adapter fairness constraints, and the ignored artifact path. It requires no credentials and makes zero provider calls.
- `npm run eval:brain:dry-run` is an alias-like explicit zero-call preview.
- `npm run eval:brain:run` is the only paid path. It prints the planned request count and cost warning, then requires `QANDEEL_ALLOW_PAID_EVAL=1`, `ANTHROPIC_API_KEY`, and `OPENAI_API_KEY` before constructing clients.
- `npm run eval:brain:summarize` reads completed local results and edited blinded review scores, then writes evidence-only summary metrics.

Generated files live under ignored `artifacts/evals/`: `results.json`, `blinded-review.json`, `provider-map.json`, and `summary.json`. Keep `provider-map.json` separate until the blind review is complete. Score each rubric dimension from 1 through 5 and set `overallPreference` to `A`, `B`, or `Tie`.

Pricing rates are intentionally `null` and marked unverified in the centralized evaluation-only pricing file. Verify official input/output rates immediately before the first paid bake-off and update that configuration; measured tokens remain distinct from estimated cost. No real bake-off was run while implementing v1.
