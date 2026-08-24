# Hypothesis Evidence Association Provider Binding v1

A2.2b binds the dormant `HypothesisEvidenceAssociationProvider` token to Gemini
`gemini-2.5-flash-lite`. It uses one candidate, thinking budget `0`, a five-second
timeout, 256 default output tokens (512 hard maximum), and zero retries, fallback,
or repair calls.

The provider accepts only the bounded association snapshot: one fresh `memory:<uuid>`
Evidence item and at most eight candidate Hypotheses (24,000 total candidate text
characters). Its strict JSON output is an array of at most four exact
`{ hypothesisId, evidenceRole }` objects, where IDs are limited to the supplied
candidate universe and roles are `SUPPORTING` or `CONTRADICTING`.

All supplied text is escaped, delimited untrusted data. No user token, service-role
credential, conversation history, unrelated Memory, hidden Confidence, or
authorization state reaches Gemini. The provider proposes only; existing server
authority revalidates and authorizes every proposal.

This binding performs no association invocation, persistence, Hypothesis mutation,
Update Loop invocation, or dispatcher integration. A2.2c is responsible for making
invocation reachable, and must first establish its own durable irreversible provider
effect claim when used from the at-least-once background dispatcher.
