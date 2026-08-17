import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { HypothesisRepository } from './hypothesis.repository';
import { HypothesisGenerationService } from './hypothesis-generation.service';
import { HypothesisService } from './hypothesis.service';
@Module({ imports: [MemoryModule], providers: [HypothesisRepository, HypothesisService, HypothesisGenerationService], exports: [HypothesisService, HypothesisGenerationService] })
export class HypothesisModule {}
