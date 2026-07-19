import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AgentApprovalService } from '../approvals/agent-approval.service';
import { isMutatingTool } from '../approvals/tool-approval-policy';
import { ToolApprovalRequiredError } from '../approvals/tool-approval-required.error';
import { AIEmbeddingResponse, AIStreamEvent, AIUsage } from '../models/ai-model.types';
import { AIRuntimeService } from '../runtime/ai-runtime.service';
import { ToolRegistry } from '../tools/tool.registry';
import { ExecuteToolRequest, ExecuteToolResponse } from '../tools/tool.service';
import { AiRateLimiterService } from './ai-rate-limiter.service';
import { AiToolPermissionService } from './ai-tool-permission.service';
import { AiUsageService } from './ai-usage.service';
import { UsageMeteringService } from '../../billing/usage-metering.service';
import {
  AiGatewayChatInput,
  AiGatewayEmbeddingInput,
  AiGatewayToolExecutionOptions,
} from './ai-gateway.types';
import { KnowledgeRetrieverService } from './knowledge-retriever.service';

/**
 * Single entry point for all AI requests: Controller/Service -> AIGatewayService -> AIRuntimeService -> Providers.
 *
 * Owns the cross-cutting concerns around an AI call (tenant/auth context,
 * rate limiting, tool permissions, knowledge-context injection, usage/cost
 * tracking, audit logging). It deliberately does not re-implement model
 * resolution, memory retrieval, or prompt assembly — those already live in
 * AIRuntimeService/ModelRegistryService/MemoryService/PromptBuilderService
 * and are reused unchanged.
 */
@Injectable()
export class AIGatewayService {
  private readonly logger = new Logger(AIGatewayService.name);

  constructor(
    @Inject(forwardRef(() => AIRuntimeService))
    private readonly aiRuntimeService: AIRuntimeService,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
    private readonly usageService: AiUsageService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly rateLimiterService: AiRateLimiterService,
    private readonly toolPermissionService: AiToolPermissionService,
    private readonly agentApprovalService: AgentApprovalService,
    private readonly toolRegistry: ToolRegistry,
    @Inject(forwardRef(() => KnowledgeRetrieverService))
    private readonly knowledgeRetrieverService: KnowledgeRetrieverService,
  ) {}

  async *streamChat(input: AiGatewayChatInput): AsyncIterable<AIStreamEvent> {
    const tenant = this.tenantContextService.getOrThrow();
    this.rateLimiterService.assertWithinLimit(tenant.organizationId);

    const startedAt = Date.now();
    const knowledgeContext = input.knowledgeContextProvided
      ? []
      : await this.knowledgeRetrieverService.retrieve({
          organizationId: tenant.organizationId,
          query: input.userPrompt,
        });
    const mergedWorkspaceContext = [...(input.workspaceContext ?? []), ...knowledgeContext];

    let resolvedProvider = input.provider;
    let resolvedModel = input.model;
    let usage: AIUsage | undefined;
    let finishReason: string | undefined;
    let succeeded = true;
    let errorMessage: string | undefined;

    try {
      for await (const event of this.aiRuntimeService.streamChat({
        conversationId: input.conversationId,
        provider: input.provider,
        model: input.model,
        systemPrompt: input.systemPrompt,
        workspaceContext: mergedWorkspaceContext,
        conversationHistory: input.conversationHistory,
        userPrompt: input.userPrompt,
        attachmentIds: input.attachmentIds,
        toolResults: input.toolResults,
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens ?? defaultMaxOutputTokens(input.requestType),
        signal: input.signal,
      })) {
        resolvedProvider = event.provider;
        resolvedModel = event.model;

        if (event.type === 'message_end') {
          finishReason = event.finishReason;
          usage = event.usage;
        }

        if (event.type === 'error') {
          succeeded = false;
          errorMessage = event.message;
        }

        yield event;
      }
    } catch (error) {
      succeeded = false;
      errorMessage = error instanceof Error ? error.message : 'AI gateway request failed';
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;

      // Fire-and-forget: telemetry must never add latency to the stream's
      // completion, and safelyRecordTelemetry already guarantees it can
      // never throw. Not awaited on purpose.
      void this.safelyRecordTelemetry(async () => {
        await this.usageService.record({
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          conversationId: input.conversationId,
          agentId: input.agentId,
          agentRunId: input.agentRunId,
          requestType: input.requestType,
          provider: resolvedProvider,
          model: resolvedModel,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          totalTokens: usage?.totalTokens,
          durationMs,
          succeeded,
          errorMessage,
        });

        if (succeeded) {
          await this.usageMeteringService.record(tenant.organizationId, 'ai_requests', 1);
          if (usage?.totalTokens) {
            await this.usageMeteringService.record(
              tenant.organizationId,
              'ai_tokens',
              usage.totalTokens,
            );
          }
        }

        await this.auditService.record({
          action: 'chat',
          resource: 'ai_gateway_request',
          resourceId: input.conversationId,
          metadata: {
            requestType: input.requestType,
            agentId: input.agentId,
            agentRunId: input.agentRunId,
            provider: resolvedProvider,
            model: resolvedModel,
            finishReason,
            durationMs,
            succeeded,
          },
        });
      });
    }
  }

  async executeTool(
    request: ExecuteToolRequest,
    options: AiGatewayToolExecutionOptions = {},
  ): Promise<ExecuteToolResponse> {
    const tenant = this.tenantContextService.getOrThrow();
    this.rateLimiterService.assertWithinLimit(tenant.organizationId);
    this.toolPermissionService.assertPermitted(request.toolName, options.grantedPermissions ?? []);

    if (!options.skipApprovalCheck && options.agentRunId) {
      let tool;
      try {
        tool = this.toolRegistry.get(request.toolName);
      } catch {
        tool = undefined;
      }

      if (isMutatingTool(request.toolName, tool)) {
        const approval = await this.agentApprovalService.findOrCreatePending(
          options.agentRunId,
          request.toolName,
          request.input,
        );
        throw new ToolApprovalRequiredError(approval.id, request.toolName);
      }
    }

    let succeeded = true;
    let errorMessage: string | undefined;
    let durationMs: number | undefined;

    try {
      const response = await this.aiRuntimeService.executeTool(request);
      durationMs = response.execution.durationMs ?? undefined;
      return response;
    } catch (error) {
      succeeded = false;
      errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
      throw error;
    } finally {
      // Fire-and-forget: see the comment in streamChat above.
      void this.safelyRecordTelemetry(async () => {
        await this.usageService.record({
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          conversationId: request.conversationId,
          agentId: options.agentId,
          agentRunId: options.agentRunId,
          requestType: 'TOOL_EXECUTION',
          toolName: request.toolName,
          durationMs,
          succeeded,
          errorMessage,
        });

        await this.auditService.record({
          action: 'execute',
          resource: 'ai_gateway_tool_request',
          resourceId: request.conversationId,
          metadata: {
            toolName: request.toolName,
            agentId: options.agentId,
            agentRunId: options.agentRunId,
            durationMs,
            succeeded,
          },
        });
      });
    }
  }

  /**
   * Generates embeddings through the same provider abstraction chat uses
   * (AIProvider.embeddings, resolved via ModelRegistryService) — this is
   * what makes the Knowledge Graph's embedding provider swappable without
   * any change to ingestion/retrieval code. Mirrors streamChat's tenant/
   * rate-limit/telemetry wrapping so embedding calls get the same
   * observability as chat calls, for free.
   */
  async embeddings(input: AiGatewayEmbeddingInput): Promise<AIEmbeddingResponse> {
    const tenant = this.tenantContextService.getOrThrow();
    this.rateLimiterService.assertWithinLimit(tenant.organizationId);

    const startedAt = Date.now();
    let resolvedProvider = input.provider;
    let resolvedModel = input.model;
    let succeeded = true;
    let errorMessage: string | undefined;

    try {
      const response = await this.aiRuntimeService.embeddings({
        provider: input.provider,
        model: input.model,
        input: input.input,
        signal: input.signal,
      });
      resolvedProvider = response.provider;
      resolvedModel = response.model;
      return response;
    } catch (error) {
      succeeded = false;
      errorMessage =
        error instanceof Error ? error.message : 'AI gateway embeddings request failed';
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;

      // Fire-and-forget: see the comment in streamChat above.
      void this.safelyRecordTelemetry(async () => {
        await this.usageService.record({
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          requestType: 'KNOWLEDGE_EMBEDDING',
          provider: resolvedProvider,
          model: resolvedModel,
          durationMs,
          succeeded,
          errorMessage,
        });

        await this.auditService.record({
          action: 'embeddings',
          resource: 'knowledge_embedding',
          resourceId: input.documentId ?? input.sourceId,
          metadata: {
            provider: resolvedProvider,
            model: resolvedModel,
            inputCount: input.input.length,
            durationMs,
            succeeded,
          },
        });
      });
    }
  }

  /**
   * Runs telemetry side effects (usage + audit recording) without ever
   * letting a failure escape — this executes inside a `finally` block of an
   * async generator/async function, and an uncaught rejection there would
   * surface as a spurious failure on an otherwise-successful AI response.
   */
  private async safelyRecordTelemetry(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to record AI gateway telemetry');
    }
  }
}

/**
 * Applied only when a caller doesn't pass an explicit maxOutputTokens —
 * without this, OpenAI/Google silently fall back to their own
 * provider-side default (tens of thousands of tokens for reasoning-style
 * models), which is where an unset limit was quietly costing far more than
 * any of these requests actually need. Callers with a genuinely larger
 * requirement should keep passing an explicit value; this only backstops
 * the ones that pass none.
 */
function defaultMaxOutputTokens(requestType: AiGatewayChatInput['requestType']): number {
  switch (requestType) {
    case 'CHAT':
    case 'CONVERSATION_MESSAGE':
      return 2048;
    case 'AGENT_RUN':
      return 2000;
    default:
      return 2048;
  }
}
