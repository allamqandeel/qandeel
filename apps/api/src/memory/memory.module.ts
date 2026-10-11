import { Module } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryRepository } from './memory.repository';
import { MemoryRuntimeService } from './memory-runtime.service';
import { MemoryRetrieverService } from './memory-retriever.service';
import { MemoryWriteEvaluatorService } from './memory-write-evaluator.service';
import { EvidenceService } from './evidence.service';
import { MemoryControlRepository } from './memory-control.repository';
import { MemoryControlService } from './memory-control.service';

@Module({
  providers: [
    MemoryDataApiService, MemoryRepository, MemoryRuntimeService, MemoryRetrieverService,
    MemoryWriteEvaluatorService, EvidenceService, MemoryControlRepository, MemoryControlService,
  ],
  exports: [MemoryDataApiService, MemoryRuntimeService, MemoryRetrieverService, EvidenceService, MemoryControlService],
})
export class MemoryModule {}
