import { Module } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryRepository } from './memory.repository';
import { MemoryRuntimeService } from './memory-runtime.service';
import { MemoryRetrieverService } from './memory-retriever.service';
import { MemoryWriteEvaluatorService } from './memory-write-evaluator.service';
import { MemoryWriteService } from './memory-write.service';
import { EvidenceService } from './evidence.service';

@Module({
  providers: [
    MemoryDataApiService, MemoryRepository, MemoryRuntimeService, MemoryRetrieverService,
    MemoryWriteEvaluatorService, MemoryWriteService, EvidenceService,
  ],
  exports: [MemoryRuntimeService, MemoryRetrieverService, MemoryWriteService, EvidenceService],
})
export class MemoryModule {}
