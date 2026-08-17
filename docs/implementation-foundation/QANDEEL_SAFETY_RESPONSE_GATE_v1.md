# QANDEEL Safety Response Gate v1

The authenticated TEXT Conversation Orchestrator runs this deterministic, server-owned gate after bounded authoritative context is built and before model generation. It owns only the current turn's safety category, disposition, guidance, and deterministic BLOCK response.

The bounded taxonomy is `NONE`, `SELF_HARM_OR_SUICIDE`, `VIOLENCE_OR_HARM_TO_OTHERS`, `SEXUAL_CONTENT_MINOR`, `SEVERE_ILLEGAL_ACTIONABLE_HARM`, and `HIGH_STAKES_MEDICAL_CRISIS`.

- `ALLOW` preserves normal Behavioral Response Policy and Model Router behavior.
- `GUIDED` invokes the router exactly once. Compact server-owned `safetyGuidance` remains separate from `behavioralGuidance` and USER/ASSISTANT history; adapters translate the same guidance without adding provider policy.
- `BLOCK` skips Behavioral Response Policy and Model Router, then uses the existing atomic finalization operation for one compact deterministic Arabic or English response.

Classification distinguishes three levels. Ambiguous or figurative wording is ALLOW or GUIDED with clarification-oriented guidance and is not treated as confirmed danger. Credible non-imminent self-harm disclosure is GUIDED with one focused current-safety question and appropriate support. Explicit imminent self-harm or actionable violent/illegal harm is BLOCK.

The gate uses the bounded authoritative context already built by ContextBuilder only when the current turn is an incomplete harmful follow-up. It considers the most recent relevant prior USER turn; informational or figurative context does not persist as a user risk state or contaminate unrelated later turns.

Actionability takes precedence over fiction, news, documentary, history, or research framing. Those frames protect genuinely descriptive discussion but cannot bypass explicit creation, step-by-step, concealment, means, timing, or evasion signals. Common English and Egyptian Arabic exaggeration and laughter phrasing are protected unless explicit danger signals override them.

Classification otherwise uses explicit combinations such as method-seeking plus self-harm, decided intent plus timing/means, violent action plus means/timing/evasion, requested minor sexualization, actionable severe wrongdoing, and acute personal emergency symptoms. Isolated sensitive words do not trigger BLOCK.

This v1 gate does not provide full moderation, external or model classification, persistent safety events, hotline/location lookup, dispatch, risk profiles, memory scoring, provider-specific policy, voice/realtime safety, tools, or UI behavior. It does not add a database schema or client-controlled safety fields.
