import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AgentService } from '../agents/agent.service';
import { ConversationService } from '../conversations/conversation.service';
import { ExecutiveContextBuilder } from '../context/context.builder';
import { ExecutiveContextService } from '../context/context.service';
import { RunAutonomousAgentDto } from '../agents/dto/autonomous-agent.dto';
import { ExecutiveDecisionsService } from '../decision/decision.service';
import { ExecutiveInsightsService } from '../insights/insights.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { AutonomousWorkflowPlansService } from '../workflow-engine/workflow-engine.service';
import { BusinessIntelligenceService } from '../../business-intelligence/business-intelligence.service';

export interface AssistantSessionResult {
  conversationId: string;
  agentId: string;
  suggestedPrompts: string[];
}

const EXECUTIVE_ASSISTANT_NAME = 'Executive Assistant';

const SUGGESTED_PROMPTS = [
  'What should my company do today?',
  'Coordinate sales and finance.',
  'Review the entire business.',
  'Find cross-department risks.',
  'Summarize executive priorities.',
  'What should I do today?',
  'What is my highest priority?',
  'What should I review first?',
  'What business risk needs attention?',
  'Summarize the current state of the business.',
  'Prepare a concise executive update for this week.',
  "Create a plan for today's priorities.",
  'Build an executive action plan.',
];

@Injectable()
export class AssistantService {
  constructor(
    private readonly agentService: AgentService,
    private readonly conversationService: ConversationService,
    private readonly contextService: ExecutiveContextService,
    private readonly insightsService: ExecutiveInsightsService,
    private readonly businessIntelligenceService: BusinessIntelligenceService,
    private readonly decisionsService: ExecutiveDecisionsService,
    private readonly orchestratorService: OrchestratorService,
    private readonly workflowPlansService: AutonomousWorkflowPlansService,
  ) {}

  async createSession(): Promise<AssistantSessionResult> {
    const agent = await this.agentService.findAgentByName(EXECUTIVE_ASSISTANT_NAME);
    if (!agent) {
      throw new ServiceUnavailableException(
        'The Executive Assistant is not available because no AI provider is configured.',
      );
    }

    const conversation = await this.conversationService.createConversation({
      title: 'Executive Assistant',
    });

    return {
      conversationId: conversation.id,
      agentId: agent.id,
      suggestedPrompts: SUGGESTED_PROMPTS,
    };
  }

  async *runStream(
    dto: Pick<RunAutonomousAgentDto, 'conversationId' | 'objective'>,
    permissions: string[],
    signal?: AbortSignal,
  ) {
    const [agent, context, , insights] = await Promise.all([
      this.agentService.findAgentByName(EXECUTIVE_ASSISTANT_NAME),
      this.contextService.getExecutiveContext({ permissions }),
      this.conversationService.getConversation(dto.conversationId),
      this.insightsService.generate(permissions),
    ]);
    if (!agent) {
      throw new ServiceUnavailableException(
        'The Executive Assistant is not available because no AI provider is configured.',
      );
    }
    // Decisions are derived from the context and insights already assembled
    // above, so one assistant turn never rebuilds context or re-runs either
    // rule set — and the assistant never restates the rules in a prompt.
    const [businessIntelligence, decisions] = await Promise.all([
      this.businessIntelligenceService.generateFromContext(context),
      this.decisionsService.generateFrom(context, insights),
    ]);
    // The assistant never coordinates agents itself: it delegates to the
    // orchestrator, which owns routing, execution and merging, and passes
    // the merged result through as evidence.
    const orchestration = await this.orchestratorService.orchestrateFrom(
      dto.objective,
      permissions,
      context,
      insights,
      decisions,
      signal,
    );
    // Plans are built from the decision set already assembled in this turn
    // — nothing is recomputed — and every plan stays awaiting_approval.
    const workflowPlans = await this.workflowPlansService.generateForAssistant(
      context,
      insights,
      decisions,
    );
    yield* this.agentService.runAutonomousAgentStream(
      agent.id,
      {
        conversationId: dto.conversationId,
        objective: dto.objective,
        workspaceContext: [
          ExecutiveContextBuilder.serializeForPrompt(context),
          `Deterministic business intelligence (evidence only; do not recalculate, transform into actions, or fabricate unavailable values): ${JSON.stringify(businessIntelligence)}`,
          `Deterministic executive insights (evidence only; recommendations require approval): ${JSON.stringify(insights)}`,
          `Deterministic executive decisions from the Decision Engine. Answer "what should I do", "what is my highest priority", "what should I review first" and "what risk needs attention" strictly from this ranked list. Do not invent, re-rank or execute anything; every decision with approvalRequired true must be presented as needing approval: ${JSON.stringify(decisions)}`,
          `Deterministic approval-gated workflow plans from the Workflow Engine. Use these for planning questions ("create a plan for today's priorities", "prepare next week's sales plan", "build an executive action plan", "generate a customer recovery workflow", "prepare an operational improvement plan"). Every plan is awaiting approval and none has been executed: report each plan's status and approvalId exactly as given, never describe a plan as done, started or executed, and never offer to run one: ${JSON.stringify(workflowPlans)}`,
          `Deterministic multi-agent orchestration from the Orchestrator. Use this for cross-department questions ("what should my company do today", "coordinate sales and finance", "review the entire business", "find cross-department risks"). Report the participating agents, the consensus score and every listed conflict rather than resolving conflicts yourself. Do not re-route, re-rank or execute anything: ${JSON.stringify(orchestration)}`,
        ],
      },
      permissions,
      signal,
    );
  }
}
