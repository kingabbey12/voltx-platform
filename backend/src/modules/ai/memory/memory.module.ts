import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryRepository } from './memory.repository';
import { MemoryScorer, NoopSemanticMemoryScorer, SEMANTIC_MEMORY_SCORER } from './memory.scorer';
import { MemorySelector } from './memory.selector';
import { MemoryService } from './memory.service';

@Module({
  controllers: [MemoryController],
  providers: [
    MemoryRepository,
    MemoryScorer,
    MemorySelector,
    MemoryService,
    NoopSemanticMemoryScorer,
    {
      provide: SEMANTIC_MEMORY_SCORER,
      useExisting: NoopSemanticMemoryScorer,
    },
  ],
  exports: [MemoryRepository, MemoryScorer, MemorySelector, MemoryService],
})
export class MemoryModule {}
