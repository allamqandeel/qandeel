import { Module } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryRepository } from './memory.repository';
import { MemoryRuntimeService } from './memory-runtime.service';

@Module({
  providers: [MemoryDataApiService, MemoryRepository, MemoryRuntimeService],
  exports: [MemoryRuntimeService],
})
export class MemoryModule {}
