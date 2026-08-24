# Model-Assisted Hypothesis Association Authorization v1

A2.2c connects fresh Evidence from the post-response Memory handoff to the dormant
association provider while preserving the canonical authority hierarchy:

`Completed v2 event → background ownership authority → fresh Evidence → association preparation → ASSOCIATION_PROVIDER claim → provider proposal → canonical ownership reread → association reauthorization → transient commands`

Preparation and final authorization both use `HypothesisEvidenceAssociationAuthorityService`.
The background path supplies owner-scoped canonical Evidence and Hypotheses through the
existing execution-authority/service-role adapter; no user JWT or service-role credential
enters the association provider.

The dedicated migration-0023 `ASSOCIATION_PROVIDER` effect claim is acquired only after
preparation succeeds. Empty or unauthorized preparation makes no provider call. A claimed
indeterminate effect is quarantined on redelivery; a completed effect is never called again.
The provider remains advisory, and current ownership, session scope, Evidence eligibility,
Hypothesis version, duplicate targets, and role conflicts are revalidated after its response.

This task returns bounded transient `HypothesisUpdateRequest` commands only. It does not
invoke `HypothesisUpdateService`, attach Evidence, mutate Hypotheses, create Confidence
evaluations, or change HIM, Questions, routing, foreground latency, provider configuration,
retry, fallback, or repair behavior. Automatic mutation remains A2.3 scope.
