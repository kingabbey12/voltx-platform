import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PromptRendererService } from './prompt-renderer.service';
import { PromptsRepository } from './prompts.repository';

/** DI token for the gateway's optional prompt-resolution dependency. */
export const PROMPT_RESOLVER = Symbol('PROMPT_RESOLVER');

export interface PromptResolutionContext {
  organizationId: string;
  userId?: string;
}

/**
 * The AI Gateway's hook into prompt management. Resolves an organization's
 * published prompt by key and renders it into a system prompt string, ready
 * to inject before the provider call. Returns null when the org has no
 * published prompt for the key, so the gateway falls back to whatever system
 * prompt the request already carried (fully backwards compatible).
 */
export interface PromptResolverPort {
  resolveSystemPrompt(
    context: PromptResolutionContext,
    key: string,
    variables: Record<string, string>,
  ): Promise<string | null>;
}

@Injectable()
export class PromptResolverService implements PromptResolverPort {
  constructor(
    private readonly repository: PromptsRepository,
    private readonly renderer: PromptRendererService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveSystemPrompt(
    context: PromptResolutionContext,
    key: string,
    variables: Record<string, string>,
  ): Promise<string | null> {
    const published = await this.repository.findPublishedByKey(context.organizationId, key);
    if (!published) {
      return null;
    }
    return this.renderTemplate(context, published.version.template, variables);
  }

  /**
   * Renders an arbitrary template with the caller's variables plus the
   * auto-resolved built-ins (today/user/organization). Shared by the gateway
   * read path (resolveSystemPrompt) and the prompt "test" path so both fill
   * variables identically — the test endpoint exercises exactly what runtime
   * will. Throws BadRequestException (via the renderer) on a missing or
   * invalid variable.
   */
  async renderTemplate(
    context: PromptResolutionContext,
    template: string,
    variables: Record<string, string>,
  ): Promise<string> {
    const values = await this.buildValues(context, template, variables);
    return this.renderer.render(template, values);
  }

  /**
   * Merges caller-provided variables with the auto-resolved built-ins
   * (`today` always; `organization`/`user` looked up on demand only when the
   * template references them and the caller didn't already supply them).
   */
  private async buildValues(
    context: PromptResolutionContext,
    template: string,
    provided: Record<string, string>,
  ): Promise<Record<string, string>> {
    const referenced = new Set(this.renderer.extractReferences(template));
    const values: Record<string, string> = {
      today: new Date().toISOString().slice(0, 10),
      ...provided,
    };

    if (referenced.has('organization') && !('organization' in values)) {
      const org = await this.prisma.system.organization.findUnique({
        where: { id: context.organizationId },
        select: { name: true },
      });
      if (org) {
        values.organization = org.name;
      }
    }

    if (referenced.has('user') && context.userId && !('user' in values)) {
      const user = await this.prisma.system.user.findUnique({
        where: { id: context.userId },
        select: { firstName: true, lastName: true, email: true },
      });
      if (user) {
        values.user = `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    return values;
  }
}
