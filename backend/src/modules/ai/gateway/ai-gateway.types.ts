import { AIMessage, AIProviderName } from '../models/ai-model.types';

export interface AiGatewayEmbeddingInput {
  input: string[];
  provider?: AIProviderName;
  model?: string;
  /** Correlation ids for usage/audit logging only — not sent to the provider. */
  sourceId?: string;
  documentId?: string;
  signal?: AbortSignal;
}

export interface AiGatewayChatInput {
  requestType: 'CHAT' | 'CONVERSATION_MESSAGE' | 'AGENT_RUN';
  conversationId?: string;
  agentId?: string;
  agentRunId?: string;
  provider?: AIProviderName;
  model?: string;
  systemPrompt?: string;
  workspaceContext?: string[];
  conversationHistory?: AIMessage[];
  userPrompt: string;
  /** Resolved into content parts (images, extracted document text) once the target model is known — see AIRuntimeService.prepareChatRequest. */
  attachmentIds?: string[];
  toolResults?: Array<{
    toolName: string;
    content: string;
    isError?: boolean;
  }>;
  temperature?: number;
  maxOutputTokens?: number;
  /** True when caller already merged knowledge context into workspaceContext. */
  knowledgeContextProvided?: boolean;
  signal?: AbortSignal;
}

export interface AiGatewayToolExecutionOptions {
  agentId?: string;
  agentRunId?: string;
  grantedPermissions?: string[];
  /** Only ever set true by AgentRunResumeService, actually executing a tool call that was already approved — every other caller must go through the normal approval gate. */
  skipApprovalCheck?: boolean;
}
