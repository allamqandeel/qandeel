import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation/conversation.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, ConversationModule],
})
export class AppModule {}
