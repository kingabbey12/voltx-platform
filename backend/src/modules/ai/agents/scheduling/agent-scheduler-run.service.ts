import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { AuthContextRepository } from '../../../auth/auth-context.repository';
import { ConversationRepository } from '../../conversations/conversation.repository';
import { drainToReturnValue } from '../../streaming/drain-generator';
import { AgentRepository } from '../agent.repository';
import { AgentService } from '../agent.service';
import { AgentScheduleRepository } from './agent-schedule.repository';

/**
 * Executes one fired AgentSchedule: rebuilds a tenant context from the
 * schedule's owner (there's no HTTP request to inherit one from — same
 * problem AgentRunResumeService solves for approval-resume jobs), creates a
 * fresh conversation for the run to live in, then delegates to
 * AgentService.runAgentStream — the exact single-turn entry point the
 * manual /run endpoint uses, tagged with triggerType SCHEDULED/EVENT and
 * the firing schedule's id so the resulting AgentRun is distinguishable in
 * execution history. Invoked by both AgentTaskProcessor (the async BullMQ
 * path) and AgentTaskQueueService's synchronous fallback when Redis is off.
 */
@Injectable()
export class AgentSchedulerRunService {
  private readonly logger = new Logger(AgentSchedulerRunService.name);

  constructor(
    private readonly agentScheduleRepository: AgentScheduleRepository,
    private readonly agentRepository: AgentRepository,
    private readonly agentService: AgentService,
    private readonly conversationRepository: ConversationRepository,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async run(
    scheduleId: string,
    agentId: string,
    organizationId: string,
    input: Record<string, unknown>,
    attemptNumber = 1,
  ): Promise<void> {
    const schedule = await this.agentScheduleRepository.findByIdUnscoped(scheduleId);
    const agent = await this.agentRepository.findAgentByIdUnscoped(agentId);
    if (!schedule || !agent) {
      this.logger.warn({ scheduleId, agentId }, 'Scheduled agent run: schedule or agent not found');
      return;
    }
    if (!schedule.createdByUserId) {
      this.logger.warn({ scheduleId, agentId }, 'Scheduled agent run: schedule has no owner');
      return;
    }

    const membership = await this.authContextRepository.findActiveMembershipContext(
      schedule.createdByUserId,
      organizationId,
    );
    if (!membership) {
      this.logger.warn(
        { scheduleId, agentId },
        'Scheduled agent run: owner has no active membership in the organization',
      );
      return;
    }

    await this.tenantContextService.run(
      {
        organizationId,
        userId: schedule.createdByUserId,
        membershipId: membership.id,
        requestId: randomUUID(),
      },
      async () => {
        const conversation = await this.conversationRepository.createConversation({
          title: `Scheduled: ${agent.name}`,
          model: agent.model,
          provider: agent.provider,
        });

        const prompt =
          typeof input.objective === 'string' && input.objective.trim().length > 0
            ? input.objective
            : `Run scheduled objective for agent "${agent.name}".`;

        try {
          await drainToReturnValue(
            this.agentService.runAgentStream(agentId, { conversationId: conversation.id, prompt }, [], undefined, {
              triggerType: schedule.triggerType === 'CRON' ? 'SCHEDULED' : 'EVENT',
              scheduleId,
            }),
          );
        } catch (error) {
          this.logger.error(
            { err: error, scheduleId, agentId, attemptNumber },
            'Scheduled agent run failed',
          );
          throw error;
        }
      },
    );
  }
}
