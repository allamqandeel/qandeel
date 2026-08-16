# QANDEEL — PROJECT SKELETON v1.0

## Decision
Begin the Qandeel Project Skeleton. The Tech Stack is approved for this stage; final text-model and realtime voice providers remain configurable until benchmarking.

## Repository Model
Use a single monorepo named `qandeel` because Mobile, Backend, Shared Contracts, AI Router, Speech Rendering, Shared Types, and Tests need to evolve together.

## Target Structure
```text
qandeel/
├── apps/
│   ├── mobile/        # React Native + Expo
│   └── api/           # NestJS
├── packages/
│   ├── contracts/     # API / Events / DTOs
│   ├── shared/
│   ├── ai-router/
│   ├── speech-rendering/
│   └── qandeel-behavior/
├── database/
│   ├── migrations/
│   └── seeds/
├── infra/
│   ├── docker/
│   └── deployment/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── golden/
├── docs/
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## Backend Skeleton
Start as a **Modular Monolith**, not many microservices.

Initial NestJS modules: auth, users, conversation, orchestrator, memory, model-router, voice, speech-rendering, safety, proactive, billing, admin, health.

## Skeleton Scope
1. Create repository structure.
2. Initialize NestJS backend.
3. Initialize React Native + Expo mobile app.
4. Configure PostgreSQL/Supabase and migration framework.
5. Configure Redis.
6. Create initial API/Event/DTO/Shared contracts and interfaces.
7. Set up CI, environment configuration, logging, and health checks.

## Core Runtime Boundary
`Mobile → Backend API → Conversation Orchestrator → Model Router → Provider`

Orchestrator also connects to Memory Runtime. Voice connects through Voice Adapter and Speech Rendering.

## Voice Boundary
Do not hard-code a single realtime voice provider. Use a Voice Adapter abstraction. Candidate paths include GPT Realtime, Gemini Live, and a cascaded `STT → Qandeel Runtime → Speech Rendering → TTS` architecture. Final choice is benchmark-driven.

## Model Router Boundary
Qandeel must not be architected as “GPT with a different interface.” Model Router provides a stable internal abstraction over GPT, Claude, Gemini, Kimi, and future providers.

## Explicitly Not in Skeleton
Full Personality Engine, full Memory Intelligence, final model selection, final voice-provider lock, Family, complex monetization, full proactive intelligence, complete UI/screens, or all ten ABS engines as production implementations.

## Implementation Principle
**ENGINEERING IMPLEMENTS THE CONTRACTS; IT DOES NOT INVENT MISSING PRODUCT LOGIC.**

## Next Gate
GitHub Repository → Repository Scaffold → Database Schema → Authentication → Conversation Runtime → Model Router → Memory Runtime → Text Chat → Voice Adapter → Speech Rendering → Behavioral Regression → Mobile UI → Deployment.
