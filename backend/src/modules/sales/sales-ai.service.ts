import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentService } from '../ai/agents/agent.service';
import { ConversationService } from '../ai/conversations/conversation.service';
import { SalesAiActionDto, SalesAiActionResponseDto } from './dto/sales-ai.dto';

const SALES_ASSISTANT_NAME = 'Sales Assistant';

export interface RunSalesAiActionInput {
  title: string;
  prompt: string;
  workspaceContext: string[];
  action: string;
}

@Injectable()
export class SalesAiService {
  constructor(
    private readonly agentService: AgentService,
    private readonly conversationService: ConversationService,
  ) {}

  async run(
    input: RunSalesAiActionInput,
    dto?: SalesAiActionDto,
  ): Promise<SalesAiActionResponseDto> {
    const agent = await this.agentService.findAgentByName(SALES_ASSISTANT_NAME);
    if (!agent) {
      throw new NotFoundException(`Agent "${SALES_ASSISTANT_NAME}" not found`);
    }

    const conversation = await this.conversationService.createConversation({
      title: input.title,
      provider: agent.provider,
      model: agent.model,
    });

    const result = await this.agentService.runAgent(agent.id, {
      conversationId: conversation.id,
      prompt: dto?.prompt?.trim().length ? dto.prompt.trim() : input.prompt,
      workspaceContext: [...input.workspaceContext, ...(dto?.workspaceContext ?? [])],
      toolRequests: [
        {
          toolName: 'datetime',
          input: {
            timezone: 'UTC',
          },
        },
      ],
    });

    return {
      conversationId: conversation.id,
      agentRunId: result.run.id,
      outputText: result.assistantMessage?.content ?? '',
      assistantMessage: result.assistantMessage,
      toolMessages: result.toolMessages,
    };
  }
}
