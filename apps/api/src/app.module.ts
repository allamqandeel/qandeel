import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { ConversationModule } from './conversation/conversation.module';
import { HealthModule } from './health/health.module';
import { MemoryModule } from './memory/memory.module';
import { HypothesisModule } from './hypothesis/hypothesis.module';
import { QuestionModule } from './question/question.module';
import { HimModule } from './human-model/him.module';
import { ObservabilityModule } from './observability/observability.module';
import { RuntimeEventsModule } from './runtime-events/runtime-events.module';
import { BackgroundIntelligenceModule } from './background-intelligence/background-intelligence.module';

@Module({
  imports: [SentryModule.forRoot(),ObservabilityModule,RuntimeEventsModule,BackgroundIntelligenceModule,HealthModule, ConversationModule, MemoryModule, HypothesisModule, QuestionModule, HimModule],
  providers:[{provide:APP_FILTER,useClass:SentryGlobalFilter}],
})
export class AppModule {}
