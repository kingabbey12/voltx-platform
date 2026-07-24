import { Module } from '@nestjs/common';
import { AIModule } from '../ai.module';
import { PromptResolverModule } from './prompt-resolver.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

/**
 * Prompt management — CRUD, lifecycle, immutable versioning, rollback, and
 * test execution. Imports AIModule for the AI Gateway (test runs execute
 * through the real runtime) and PromptResolverModule for the shared renderer,
 * repository, and resolver. AuditService, TenantContextService, and
 * PrismaService come from their @Global modules.
 *
 * The runtime read path lives in the lightweight PromptResolverModule, which
 * AIModule imports directly; this heavier module depends on AIModule, keeping
 * the dependency graph acyclic.
 */
@Module({
  imports: [AIModule, PromptResolverModule],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
