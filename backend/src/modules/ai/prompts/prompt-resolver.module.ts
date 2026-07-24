import { Module } from '@nestjs/common';
import { PromptRendererService } from './prompt-renderer.service';
import { PromptResolverService, PROMPT_RESOLVER } from './prompt-resolver.service';
import { PromptsRepository } from './prompts.repository';

/**
 * The AI Gateway's read path for prompt management — deliberately split out of
 * PromptsModule so it carries no AIModule dependency. AIModule imports this to
 * let AIGatewayService resolve and render an organization's published prompt
 * per request, while the full PromptsModule (management: controller, service,
 * test execution) imports AIModule for the runtime. Extracting the renderer,
 * repository, and resolver here is what keeps the AIModule <-> PromptsModule
 * relationship acyclic — mirrors TenantAiCredentialResolverModule.
 *
 * PrismaService and TenantContextService are supplied by their @Global
 * modules, so this module needs no imports.
 *
 * PROMPT_RESOLVER is bound with useExisting so the gateway can depend on the
 * PromptResolverPort interface (via @Optional() @Inject(PROMPT_RESOLVER))
 * without a hard compile-time edge to this module.
 */
@Module({
  providers: [
    PromptRendererService,
    PromptsRepository,
    PromptResolverService,
    { provide: PROMPT_RESOLVER, useExisting: PromptResolverService },
  ],
  exports: [PromptRendererService, PromptsRepository, PromptResolverService, PROMPT_RESOLVER],
})
export class PromptResolverModule {}
