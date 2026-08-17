import { Module } from '@nestjs/common';
import { HypothesisModule } from '../hypothesis/hypothesis.module';
import { MemoryModule } from '../memory/memory.module';
import { QuestionRepository } from './question.repository';
import { QuestionService } from './question.service';
@Module({ imports: [MemoryModule, HypothesisModule], providers: [QuestionRepository, QuestionService], exports: [QuestionService] })
export class QuestionModule {}
