import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation/conversation.module';
import { HealthModule } from './health/health.module';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [HealthModule, ConversationModule, MemoryModule],
})
export class AppModule {}
