import { Module } from '@nestjs/common';
import { RecommendationGroundingService } from './recommendation-grounding.service';

@Module({
  providers: [RecommendationGroundingService],
  exports: [RecommendationGroundingService],
})
export class RecommendationModule {}
