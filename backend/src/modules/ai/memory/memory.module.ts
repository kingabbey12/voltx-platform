import { forwardRef, Module } from '@nestjs/common';
import { AIModule } from '../ai.module';
import { EmbeddingSemanticMemoryScorer } from './embedding-semantic-memory.scorer';
import { MemoryController } from './memory.controller';
import { MemoryRepository } from './memory.repository';
import { MemoryScorer, SEMANTIC_MEMORY_SCORER } from './memory.scorer';
import { MemorySelector } from './memory.selector';
import { MemoryService } from './memory.service';

@Module({
  imports: [forwardRef(() => AIModule)],
  controllers: [MemoryController],
  providers: [
    MemoryRepository,
    MemoryScorer,
    MemorySelector,
    MemoryService,
    EmbeddingSemanticMemoryScorer,
    {
      provide: SEMANTIC_MEMORY_SCORER,
      useExisting: EmbeddingSemanticMemoryScorer,
    },
  ],
  exports: [MemoryRepository, MemoryScorer, MemorySelector, MemoryService],
})
export class MemoryModule {}
