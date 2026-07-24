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
  /**
   * Optional managed-prompt reference. When set and the caller's organization
   * has a PUBLISHED prompt with this key, the AI Gateway resolves that prompt's
   * published version, renders it with `promptVariables` (plus auto-variables
   * like today/user/organization), and uses the result as the system prompt —
   * overriding `systemPrompt`. When unset, or no published prompt exists, the
   * request is unchanged and `systemPrompt` is used as-is (backwards
   * compatible).
   */
  promptKey?: string;
  /** Caller-supplied values for the managed prompt's variables. */
  promptVariables?: Record<string, string>;
  /**
   * Scopes automatic knowledge-context injection to one KnowledgeCollection
   * (the Agent builder's "Knowledge collection selection" field). Unset
   * means unscoped — every collection the org has is searchable, the
   * existing default behavior.
   */
  knowledgeCollectionId?: string;
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
  signal?: AbortSignal;
}

export interface AiGatewayToolExecutionOptions {
  agentId?: string;
  agentRunId?: string;
  grantedPermissions?: string[];
  /** Only ever set true by AgentRunResumeService, actually executing a tool call that was already approved — every other caller must go through the normal approval gate. */
  skipApprovalCheck?: boolean;
}
