import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AgentService } from '../agents/agent.service';
import { ConversationService } from '../conversations/conversation.service';

export interface OperatorSessionResult {
  conversationId: string;
  readOnlyAgentId: string;
  fullAgentId: string;
}

const READ_ONLY_AGENT_NAME = 'Voltx Operator (Read-Only)';
const FULL_AGENT_NAME = 'Voltx Operator';

@Injectable()
export class OperatorService {
  constructor(
    private readonly agentService: AgentService,
    private readonly conversationService: ConversationService,
  ) {}

  async createSession(): Promise<OperatorSessionResult> {
    // Sequential, not Promise.all: each call provisions any missing system
    // agents first (AgentRegistry.ensureSystemAgents), which isn't safe
    // under concurrent invocation — two parallel calls can both see an
    // agent as "not yet created" and race to insert it, tripping the
    // (organizationId, name) unique constraint.
    const readOnlyAgent = await this.agentService.findAgentByName(READ_ONLY_AGENT_NAME);
    const fullAgent = await this.agentService.findAgentByName(FULL_AGENT_NAME);

    if (!readOnlyAgent || !fullAgent) {
      throw new ServiceUnavailableException(
        'The AI Command Center is not available yet — no AI provider is configured for this environment.',
      );
    }

    const conversation = await this.conversationService.createConversation({
      title: 'Command Center session',
    });

    return {
      conversationId: conversation.id,
      readOnlyAgentId: readOnlyAgent.id,
      fullAgentId: fullAgent.id,
    };
  }
}
