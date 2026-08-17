import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { HypothesisRepository } from './hypothesis.repository';
import { HypothesisService } from './hypothesis.service';
@Module({ imports: [MemoryModule], providers: [HypothesisRepository, HypothesisService], exports: [HypothesisService] })
export class HypothesisModule {}
