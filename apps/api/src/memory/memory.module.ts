import { Module } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryRepository } from './memory.repository';
import { MemoryRuntimeService } from './memory-runtime.service';
import { MemoryRetrieverService } from './memory-retriever.service';

@Module({
  providers: [MemoryDataApiService, MemoryRepository, MemoryRuntimeService, MemoryRetrieverService],
  exports: [MemoryRuntimeService, MemoryRetrieverService],
})
export class MemoryModule {}
