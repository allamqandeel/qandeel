import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation/conversation.module';
import { HealthModule } from './health/health.module';
import { MemoryModule } from './memory/memory.module';
import { HypothesisModule } from './hypothesis/hypothesis.module';
import { QuestionModule } from './question/question.module';
import { HimModule } from './human-model/him.module';

@Module({
  imports: [HealthModule, ConversationModule, MemoryModule, HypothesisModule, QuestionModule, HimModule],
})
export class AppModule {}
