import { Injectable, Logger } from '@nestjs/common';
import { AiRequestType } from '@prisma/client';
import { calculateEstimatedCostUsd } from './ai-pricing.config';
import { AgentRunUsageSummary, AiUsageRepository } from './ai-usage.repository';

export interface RecordUsageInput {
  organizationId: string;
  userId: string;
  conversationId?: string;
  agentId?: string;
  agentRunId?: string;
  requestType: AiRequestType;
  provider?: string;
  model?: string;
  toolName?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  succeeded: boolean;
  errorMessage?: string;
}

/**
 * Records per-request AI usage and estimated cost. Never throws: a failure
 * to persist a usage log must never fail the underlying AI request.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly usageRepository: AiUsageRepository) {}

  async record(input: RecordUsageInput): Promise<void> {
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;
    const totalTokens = input.totalTokens ?? inputTokens + outputTokens;

    try {
      await this.usageRepository.create({
        organizationId: input.organizationId,
        userId: input.userId,
        conversationId: input.conversationId,
        agentId: input.agentId,
        agentRunId: input.agentRunId,
        requestType: input.requestType,
        provider: input.provider,
        model: input.model,
        toolName: input.toolName,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: calculateEstimatedCostUsd(input.model, inputTokens, outputTokens),
        durationMs: input.durationMs,
        succeeded: input.succeeded,
        errorMessage: input.errorMessage,
      });
    } catch (error) {
      this.logger.error(
        { err: error, requestType: input.requestType, organizationId: input.organizationId },
        'Failed to persist AI usage log',
      );
    }
  }

  /**
   * Never throws: observability must not be able to fail the run whose
   * outcome it's summarizing. Returns a zeroed summary on failure.
   */
  async summarizeForAgentRun(agentRunId: string): Promise<AgentRunUsageSummary> {
    try {
      return await this.usageRepository.summarizeForAgentRun(agentRunId);
    } catch (error) {
      this.logger.error({ err: error, agentRunId }, 'Failed to summarize AI usage for agent run');
      return { callCount: 0, totalTokens: 0, totalCostUsd: 0, totalDurationMs: 0 };
    }
  }

  /** Never throws: see summarizeForAgentRun. */
  async summarizeByRequestType(
    organizationId: string,
    requestType: AiRequestType,
    sinceMs: number,
  ): Promise<AgentRunUsageSummary> {
    try {
      return await this.usageRepository.summarizeByRequestType(
        organizationId,
        requestType,
        sinceMs,
      );
    } catch (error) {
      this.logger.error(
        { err: error, organizationId, requestType },
        'Failed to summarize AI usage',
      );
      return { callCount: 0, totalTokens: 0, totalCostUsd: 0, totalDurationMs: 0 };
    }
  }

  /** Never throws: see summarizeForAgentRun. */
  async summarizeForOrganization(
    organizationId: string,
    sinceMs: number,
  ): Promise<AgentRunUsageSummary> {
    try {
      return await this.usageRepository.summarizeForOrganization(organizationId, sinceMs);
    } catch (error) {
      this.logger.error({ err: error, organizationId }, 'Failed to summarize AI usage');
      return { callCount: 0, totalTokens: 0, totalCostUsd: 0, totalDurationMs: 0 };
    }
  }

  /** Never throws: see summarizeForAgentRun. */
  async summarizeByAgent(
    organizationId: string,
    sinceMs: number,
  ): Promise<
    Array<{ agentId: string | null; callCount: number; totalTokens: number; totalCostUsd: number }>
  > {
    try {
      return await this.usageRepository.summarizeByAgent(organizationId, sinceMs);
    } catch (error) {
      this.logger.error({ err: error, organizationId }, 'Failed to summarize AI usage by agent');
      return [];
    }
  }
}
