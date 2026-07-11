import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentService } from '../../ai/agents/agent.service';
import { ConversationService as AiConversationService } from '../../ai/conversations/conversation.service';
import { WorkflowDefinitionValidatorService } from '../definition/workflow-definition-validator.service';
import { WorkflowDefinition } from '../definition/workflow-definition.types';
import { WorkflowService } from '../workflow.service';

const WORKFLOW_ASSISTANT_NAME = 'Workflow Assistant';

const DEFINITION_SCHEMA_PROMPT = `A WorkflowDefinition is a JSON object: { "steps": WorkflowStepDefinition[] }.

Every step has: "id" (unique, url-safe slug), "name" (human label), "type", "config" (shape depends on type), and optionally "dependsOn" (array of other step ids that must finish first — this is what makes steps run in sequence or in parallel; steps with no shared dependsOn chain run concurrently), "condition" (skip this step unless true — see below), "retryPolicy": { "maxAttempts": number, "backoffMs": number }, "timeoutMs": number.

Step types and their "config" shape:
- "AGENT": { "agentName": string, "objective": string } — runs an AI reasoning step.
- "TOOL": { "toolName": string, "input": object } — calls one named tool directly.
- "API": { "method": "GET"|"POST"|"PUT"|"PATCH"|"DELETE", "url": string, "headers"?: object, "body"?: object }
- "WEBHOOK": { "url": string, "payload": object, "headers"?: object }
- "NOTIFICATION": { "channel": "log"|"webhook"|"notification", "message": string, "userId"?: string, "title"?: string, "webhookUrl"?: string }
- "APPROVAL": { "message": string, "approverRole"?: string, "timeoutMs"?: number } — pauses the run until a human approves/rejects.
- "DELAY": { "delayMs": number }
- "INTEGRATION": { "provider": string, "actionName": string, "connectionId"?: string, "input": object }
- "LOOP": { "itemsPath": string (dot path into {input, context} resolving to an array), "steps": WorkflowStepDefinition[] (nested steps run once per item), "maxIterations"?: number }
- "SWITCH": { "path": string, "cases": [{ "value": any, "next": stepId }], "defaultNext"?: stepId }

"condition" is either a leaf { "path": string, "operator": "eq"|"neq"|"exists"|"not_exists"|"truthy"|"falsy"|"gt"|"lt"|"contains"|"starts_with"|"ends_with"|"regex"|"date_gt"|"date_lt"|"empty"|"not_empty", "value"?: any }, or a tree { "and": [...] } / { "or": [...] } / { "not": {...} } of such leaves. "path" is a dot path evaluated against { input, context } where context is keyed by step id (e.g. "context.check_stage.output.stage").

Rules: every step id must be unique and non-empty; dependsOn must reference ids that exist and must not form a cycle; a step cannot depend on itself.`;

function buildGeneratePrompt(description: string, priorError?: string): string {
  const retryNote = priorError
    ? `\n\nYour previous attempt was rejected by the validator with this error: "${priorError}". Fix the issue and return corrected JSON.`
    : '';
  return `Generate a workflow automation definition for this request:\n\n"${description}"\n\n${DEFINITION_SCHEMA_PROMPT}\n\nRespond with ONLY the JSON WorkflowDefinition object — no markdown code fences, no prose, no explanation.${retryNote}`;
}

function parseDefinitionOrThrow(raw: string): WorkflowDefinition {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`AI did not return valid JSON: ${stripped.slice(0, 500)}`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { steps?: unknown }).steps)
  ) {
    throw new Error('AI response is not a valid WorkflowDefinition (missing "steps" array)');
  }
  return parsed as WorkflowDefinition;
}

/**
 * Wires the workflow module into the existing AI agent/tool runtime for
 * generation/explain/debug/optimize — same find-agent-by-name,
 * throwaway-conversation, runAgent pattern as CommsAiService/SalesAiService.
 * generateWorkflowDefinition is the one genuinely new capability: it gates
 * the model's output through the same WorkflowDefinitionValidatorService
 * the REST update endpoint uses, with one retry-with-feedback attempt on
 * a validation failure, so a malformed generation can never reach a
 * persisted Workflow.
 */
@Injectable()
export class WorkflowAiService {
  constructor(
    private readonly agentService: AgentService,
    private readonly aiConversationService: AiConversationService,
    private readonly workflowService: WorkflowService,
    private readonly workflowDefinitionValidatorService: WorkflowDefinitionValidatorService,
  ) {}

  async generateWorkflowDefinition(description: string): Promise<WorkflowDefinition> {
    const first = parseDefinitionOrThrow(
      await this.runPrompt(buildGeneratePrompt(description), 3000),
    );
    try {
      this.workflowDefinitionValidatorService.validate(first);
      return first;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryRaw = await this.runPrompt(buildGeneratePrompt(description, message), 3000);
      const retry = parseDefinitionOrThrow(retryRaw);
      this.workflowDefinitionValidatorService.validate(retry);
      return retry;
    }
  }

  async explainWorkflow(workflowId: string): Promise<string> {
    const context = await this.gatherWorkflowContext(workflowId);
    return this.runPrompt(
      `Explain what this workflow does, in plain language for a non-technical business user. Describe the trigger, the sequence of actions, and any branching/conditions, without using JSON or code syntax in your answer.\n\n${context}`,
      1200,
    );
  }

  async debugWorkflow(workflowId: string): Promise<string> {
    const context = await this.gatherWorkflowContext(workflowId, { includeRecentRuns: true });
    return this.runPrompt(
      `Diagnose likely causes of failure in this workflow's recent runs, based on the run statuses and error messages below. Be specific about which step is implicated and what change would fix it.\n\n${context}`,
      1500,
    );
  }

  async optimizeWorkflow(workflowId: string): Promise<string> {
    const context = await this.gatherWorkflowContext(workflowId, { includeRecentRuns: true });
    return this.runPrompt(
      `Suggest concrete improvements to this workflow — reliability (retries/timeouts/error handling), speed (unnecessary sequential dependencies that could run in parallel), and cost. List specific, actionable changes.\n\n${context}`,
      1500,
    );
  }

  private async gatherWorkflowContext(
    workflowId: string,
    options: { includeRecentRuns?: boolean } = {},
  ): Promise<string> {
    const workflow = await this.workflowService.getWorkflowOrThrow(workflowId);
    const versions = await this.workflowService.listVersions(workflowId);
    const latest = versions[versions.length - 1];

    const lines = [
      `Workflow: ${workflow.name}`,
      workflow.description ? `Description: ${workflow.description}` : '',
      `Status: ${workflow.status}`,
      `Definition: ${JSON.stringify(latest?.definition ?? { steps: [] })}`,
    ];

    if (options.includeRecentRuns) {
      const runs = await this.workflowService.listRuns({ page: 1, limit: 5, workflowId });
      lines.push('Recent runs (most recent first):');
      for (const run of runs.items) {
        const timestamp = (run.startedAt ?? run.createdAt).toISOString();
        lines.push(`- ${run.status} at ${timestamp}${run.error ? ` — error: ${run.error}` : ''}`);
      }
      if (runs.items.length === 0) {
        lines.push('- No runs yet.');
      }
    }

    return lines.filter(Boolean).join('\n');
  }

  private async runPrompt(prompt: string, maxOutputTokens: number): Promise<string> {
    const agent = await this.agentService.findAgentByName(WORKFLOW_ASSISTANT_NAME);
    if (!agent) {
      throw new NotFoundException(`Agent "${WORKFLOW_ASSISTANT_NAME}" not found`);
    }

    const conversation = await this.aiConversationService.createConversation({
      title: 'Workflow AI task',
      provider: agent.provider,
      model: agent.model,
    });

    const result = await this.agentService.runAgent(agent.id, {
      conversationId: conversation.id,
      prompt,
      maxOutputTokens,
    });

    return result.assistantMessage?.content ?? '';
  }
}
