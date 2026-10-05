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
import { PostResponseIntelligenceModule } from './post-response-intelligence/post-response-intelligence.module';
import { AccountModule } from './account/account.module';
import { UnderstandingModule } from './understanding/understanding.module';
import { HttpSecurityModule } from './http-security/http-security.module';
import { ActivityModule } from './activity/activity.module';
import { PushModule } from './push/push.module';
import { SharedWorldModule } from './shared-world/shared-world.module';

@Module({
  imports: [HttpSecurityModule,SentryModule.forRoot(),ObservabilityModule,RuntimeEventsModule,BackgroundIntelligenceModule,PostResponseIntelligenceModule,HealthModule, ConversationModule, MemoryModule, HypothesisModule, QuestionModule, HimModule, ActivityModule, PushModule, SharedWorldModule, AccountModule, UnderstandingModule],
  providers:[{provide:APP_FILTER,useClass:SentryGlobalFilter}],
})
export class AppModule {}
