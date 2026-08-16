# QANDEEL — Recommended TECH STACK v1.0

## Executive Recommendation
Qandeel needs a practical stack that preserves Runtime, Memory, Realtime Voice, security, cost control, and provider replaceability.

**Recommended baseline:** TypeScript + NestJS + PostgreSQL/pgvector/Supabase + Redis/Upstash + React Native/Expo + Voice Adapter + Qandeel Model Router + Supabase Auth/RLS + Railway + Sentry/OpenTelemetry + GitHub.

Final text-model and voice-provider choices remain benchmark-driven.

## Backend
**TypeScript + NestJS**, initially as a **Modular Monolith**. Do not start with many microservices.

## Database & Memory
- Primary DB: PostgreSQL
- Vector Memory: pgvector
- Cache / hot state: Redis
- Managed V1 infrastructure: Supabase

PostgreSQL is source of truth for users, profiles, conversations, turns, memory, consent, commerce, entitlements, and audit data. Memory retrieval is hybrid rather than vector similarity alone.

## Supabase
Use Supabase in V1 for PostgreSQL, pgvector, Authentication, Row Level Security, and Storage. Qandeel business/runtime/memory contracts remain inside the backend; Supabase is infrastructure, not Qandeel's architecture.

User isolation path: `Client → Supabase Auth → NestJS Authorization → Resource-level authorization → PostgreSQL RLS`. Do not rely on RLS alone.

## Realtime Voice
Use a **Voice Provider Abstraction**. Candidate paths include GPT Realtime, Gemini Live, and a cascaded `STT → Qandeel Runtime → Speech Rendering → TTS` architecture. Final choice is benchmark-driven.

## Qandeel Speech Rendering
Do not use a simplistic `LLM → TTS` path. Use `Qandeel Semantic Response → Speech Rendering → Arabic Normalization → Pronunciation Handling → Voice`.

Speech Rendering handles ambiguous word diacritization when needed, numbers, names, places, foreign words, terminology, dialect words, pauses, intonation, and spoken sentence shape. Do **not** automatically diacritize all Arabic; add tashkeel only where it prevents ambiguity or mispronunciation.

## AI / Model Routing
Qandeel is not equal to GPT. Model/provider is an implementation choice behind Qandeel Model Router. Candidate adapters: GPT, Claude, Gemini, Kimi, plus fallback/hybrid routing.

Router decisions consider conversation mode, complexity, safety, latency budget, cost budget, capability, context size, and provider health. Final selection uses Qandeel benchmarks for naturalness, next-turn value, hypothesis restraint, question discipline, analysis quality, safety, cost, latency, and runtime efficiency.

## Authentication & Security
- Authentication: Supabase Auth
- Authorization: NestJS + PostgreSQL RLS
- Default deny / least privilege / user-scoped resources
- Encryption in transit and at rest
- Secrets outside code
- No provider API keys in mobile
- Consent, export, deletion, audit, admin controls, sensitive-data minimization

## Frontend
**Mobile First:** React Native + Expo + Expo Router + TypeScript. iOS + Android first; web is secondary.

## Hosting / Deployment
- Mobile: Expo EAS
- Backend V1: Railway
- Database: Supabase
- Redis: Managed Redis / Upstash
- Object Storage: Supabase Storage V1

## Async Jobs & Events
BullMQ + Redis for proactive jobs, notifications, memory background processing, cleanup, schedules, retries. Start events with PostgreSQL Outbox + Redis-based jobs/streams; do not add Kafka on day one.

## Observability
Sentry + OpenTelemetry. Correlation chain: `request_id → session_id → turn_id → orchestration_id → engine_call_id → provider_call_id`. Track TTFA, p50/p95/p99, turn completion, interruption success, provider errors, fallback, queue depth, memory retrieval, notification success, billing reconciliation, and cost/session. Do not log raw audio or unnecessary private transcripts.

## Recommended Repository Structure
Monorepo with `apps/mobile`, `apps/api`, shared packages (`contracts`, `shared`, `qandeel-behavior`, `speech-rendering`, `ai-router`), `docs`, `tests`, `infra`, environment templates, and root package configuration.

## Freeze Now
TypeScript, NestJS, Modular Monolith, PostgreSQL, pgvector, Redis, Supabase, React Native, Expo, GitHub, Sentry, OpenTelemetry, Model Router abstraction, Voice Adapter abstraction, Qandeel Speech Rendering, Mobile First.

## Keep Configurable
Final Text Model and Final Voice Provider remain behind Router/Adapter until benchmarked for Egyptian Arabic, Saudi Arabic, naturalness, pronunciation, interruption, latency, cost, and reliability.

## Implementation Gate
`GitHub Repository → Repository Scaffold → Database Schema → Auth → Conversation Runtime → Model Router → Memory → Text Chat → Voice Adapter → Speech Rendering → Behavioral Regression → Mobile UI → Deployment`
