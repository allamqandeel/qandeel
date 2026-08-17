# QANDEEL Safety Response Gate v1

The authenticated TEXT Conversation Orchestrator runs this deterministic, server-owned gate after bounded authoritative context is built and before model generation. It owns only the current turn's safety category, disposition, guidance, and deterministic BLOCK response.

The bounded taxonomy is `NONE`, `SELF_HARM_OR_SUICIDE`, `VIOLENCE_OR_HARM_TO_OTHERS`, `SEXUAL_CONTENT_MINOR`, `SEVERE_ILLEGAL_ACTIONABLE_HARM`, and `HIGH_STAKES_MEDICAL_CRISIS`.

- `ALLOW` preserves normal Behavioral Response Policy and Model Router behavior.
- `GUIDED` invokes the router exactly once. Compact server-owned `safetyGuidance` remains separate from `behavioralGuidance` and USER/ASSISTANT history; adapters translate the same guidance without adding provider policy.
- `BLOCK` skips Behavioral Response Policy and Model Router, then uses the existing atomic finalization operation for one compact deterministic Arabic or English response.

Classification uses explicit intent combinations such as method-seeking plus self-harm, imminent self-harm intent, violent action plus targeting/planning, explicit minor sexualization, actionable severe wrongdoing, and acute emergency symptoms. Isolated sensitive words do not trigger a block. Historical, news, fictional, ordinary sadness, anger, and non-emergency health discussions remain outside the gate unless an explicit high-risk pattern is present.

This v1 gate does not provide full moderation, external or model classification, persistent safety events, hotline/location lookup, dispatch, risk profiles, memory scoring, provider-specific policy, voice/realtime safety, tools, or UI behavior. It does not add a database schema or client-controlled safety fields.
