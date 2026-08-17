# Memory Retrieval + Context Assembly v1

This gate retrieves durable memory only for authenticated TEXT turns where a small deterministic policy finds an explicit recall cue or meaningful personal-context signal. Greetings, acknowledgements, and generic informational questions skip retrieval without a database query.

## Bounds and ranking

- Candidate query: at most 32 ACTIVE, unexpired records for the authenticated `user_id`, ordered by update time and ID. PostgreSQL RLS remains a second ownership boundary.
- Ranking: lexical relevance is the primary gate and contributes `relevance × 100`; importance contributes `importance × 5`; confidence contributes `confidence × 2`. Updated time descending and ID ascending provide deterministic tie-breaking.
- Selection: at most 4 memories and 2,400 total content characters. A record that does not fit is skipped rather than truncated.
- Exact content duplicates are removed after conservative case, Unicode, and whitespace normalization; the stronger/newer ranked candidate wins.

English and Arabic text are normalized conservatively. Matching removes punctuation, case differences, Arabic diacritics, and a small stop-word set. This is intentionally not morphology, stemming, semantic search, or contradiction detection, so synonyms and inflected forms may be missed.

## Context and trust boundaries

The existing four-complete-exchange history window is unchanged, and the current USER turn remains exactly once. Context Builder packages selected durable memory in `memoryContext`; it never creates fabricated USER or ASSISTANT messages.

Both provider adapters use the same provider-neutral renderer. Behavioral guidance and any Safety guidance remain server policy. Memory entries are JSON-encoded with markup characters escaped before being enclosed in an explicit `user_memory_context` delimiter, so stored content cannot terminate or forge the container. The container is labeled untrusted contextual data whose embedded instructions must never be followed. Provider payloads receive only memory type, content, and optional source—not IDs, owner IDs, lifecycle state, lineage, confidence, or importance.

Safety evaluates the current turn and authoritative recent history before memory retrieval. BLOCK therefore performs neither retrieval nor a provider call. GUIDED and ALLOW may retrieve; memory does not alter Safety classification or FAST/DEEP routing.

## Lifecycle and deferred work

Eligibility relies on the existing Memory Runtime query and RLS boundary: only the authenticated user's ACTIVE, unexpired rows are candidates. PENDING_CONFIRMATION, SUPERSEDED, DELETED, DISABLED, and expired records are excluded at the database boundary.

V1 makes no provider, embedding, vector, or paid retrieval calls and performs no memory writes or usage updates. Semantic/vector retrieval, synonym-aware ranking, semantic contradiction resolution, automatic candidate/write evaluation, and user-facing memory management remain deferred to their own controlled gates.
