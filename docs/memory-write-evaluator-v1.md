# Memory Write Evaluator v1

## Boundary

The evaluator inspects only the authoritative current USER text turn. It returns `SKIP` or one `WRITE` candidate and never calls a model, provider, embedding service, or client confirmation flow. Memory Runtime remains responsible for validation and persistence; the Conversation Orchestrator remains the authoritative turn owner.

## WRITE and SKIP policy

`WRITE` requires one compact, explicit English or Arabic/Egyptian Arabic structure in a supported category. Greetings, acknowledgements, generic questions or world facts, transient emotions, jokes/exaggeration, speculative self-descriptions, clearly quoted third-party statements, advice requests without a durable fact, arbitrary remember instructions, and unsupported or ambiguous wording are `SKIP`.

The evaluator checks patterns in a deterministic order and returns at most one candidate per turn. It does not synthesize from conversation history or infer hidden meaning.

## Supported patterns and categories

- `INTERACTION_PREFERENCE`: “Speak/respond to me in …”; `كلمني …`, `اتكلم معايا …`, `رد عليا …`.
- `GOAL`: “My goal is …”; `هدفي …`.
- `DECISION_COMMITMENT`: “I decided to …”; `قررت …`.
- `PERSONAL_FACT`: “I live in …”; `أنا ساكن/عايش …`. A trailing explicit residence duration is omitted rather than interpreted.
- `RELATIONSHIP_CONTEXT`: a bounded arbitrary name followed by an explicit English or Arabic family/friend relation.
- `STABLE_PREFERENCE`: “I prefer/like …”; `أنا بفضل/بحب …`.
- `TEMPORARY_STATE`: travel tomorrow or next week; `مسافر … بكرة/الأسبوع الجاي`.

Explicit `remember that …`, `افتكر إني …`, and `خلي بالك إني …` cues raise extraction confidence only when the remaining text independently matches a supported structure.

Every automatic candidate uses `source = USER_STATED` and `status = ACTIVE`. The evaluator never emits `SYSTEM_DERIVED`, `USER_CONFIRMED`, or `DERIVED_INSIGHT`.

## Confidence and importance

Confidence measures extraction clarity, not truth. A supported fixed pattern uses `0.95`; a supported fact behind an explicit remember cue uses `0.98`.

Importance is a centralized category default:

| Type | Importance |
| --- | ---: |
| `INTERACTION_PREFERENCE` | 0.90 |
| `GOAL` | 0.85 |
| `DECISION_COMMITMENT` | 0.85 |
| `STABLE_PREFERENCE` | 0.75 |
| `RELATIONSHIP_CONTEXT` | 0.75 |
| `PERSONAL_FACT` | 0.65 |
| `TEMPORARY_STATE` | 0.50 |

Temporary travel tomorrow expires two days after evaluation; travel next week expires fourteen days after evaluation. No broader date parsing is attempted.

## Duplicate prevention and ownership

Before persistence, the writer requests at most 32 ACTIVE, unexpired memories through the existing user-scoped Memory Runtime. It skips an exact normalized duplicate when both canonical type and content match. Normalization is limited to Unicode/case/Arabic orthographic variants, terminal punctuation, and whitespace. There are no embeddings, fuzzy matches, or semantic duplicate decisions.

The authenticated `userId` and access token scope both lookup and creation, so another user's memory cannot suppress a write.

After a successful create, the writer returns the exact persisted Memory ID and mechanically derived `memory:<id>` Evidence identity. This internal identity handoff does not change evaluator classification or grant lasting Evidence eligibility; downstream consumers must still revalidate through the Evidence Layer when they use it.

## Sensitive-data denial

A small high-confidence boundary rejects obvious password/passcode labels, API/authentication keys or tokens, OTP/verification codes, common credential token shapes, payment-card-length digit sequences, and explicitly labelled government identifiers. Rejected raw content is neither logged nor returned. This is intentionally not a general PII engine; ambiguity defaults to `SKIP` where a deny pattern applies.

## Safety, timing, idempotency, and failure

`BLOCK` and `GUIDED` turns perform zero automatic writes. Safety category and disposition are never candidates, and Safety Response Gate semantics are unchanged.

For an `ALLOW` turn, retrieval, context assembly, generation, and atomic finalization occur before write evaluation. Therefore a new row can affect only future turns. The writer runs only after successful authoritative finalization. Completed/duplicate replays do not claim or evaluate the turn, stale/cancelled finalization does not write, and one claimed turn can create at most one row.

Evaluation or persistence failure is caught only at this non-authoritative boundary after finalization. It cannot fail the successful response, finalize twice, trigger a second provider call, or expose memory content/errors to the client. There is no unbounded retry.

## Deliberate limitations and future work

Correction/supersession is deferred: deterministic predecessor selection would expand the narrow v1 pattern boundary, while general contradiction resolution is explicitly out of scope. V1 also omits cross-turn synthesis, confirmation UX, inferred traits, broad PII classification, semantic duplicate detection, embeddings, public memory APIs, and multi-candidate extraction.

A future model-assisted evaluator may propose multiple candidates, confidence-aware confirmation, semantic duplicates, contradiction/correction candidates, and richer multilingual extraction, but must preserve user scope, provenance, Safety separation, and the rule that inference never silently becomes fact.
