export type CredentialSource = 'PLATFORM' | 'TENANT';

export type AIProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'groq'
  | 'mistral'
  | 'deepseek'
  | 'ollama'
  | 'openrouter'
  | 'azure-openai';

/** Every provider name, in one place, for runtime validation and enumeration. */
export const AI_PROVIDER_NAMES = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'groq',
  'mistral',
  'deepseek',
  'ollama',
  'openrouter',
  'azure-openai',
] as const satisfies readonly AIProviderName[];

export type AIModelFamily =
  'gpt-5' | 'claude' | 'gemini' | 'grok' | 'llama' | 'mistral' | 'deepseek' | 'qwen';

export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type AIContentPart =
  { type: 'text'; text: string } | { type: 'image'; mimeType: string; base64Data: string };

/**
 * `content` is a plain string for every historical/system/tool message —
 * only the current turn's user message becomes an array when attachments
 * are attached (see PromptBuilderService + AttachmentContentBuilderService),
 * so provider message-mapping code must handle both.
 */
export interface AIMessage {
  role: AIMessageRole;
  content: string | AIContentPart[];
  name?: string;
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIModelDefinition {
  id: string;
  provider: AIProviderName;
  family: AIModelFamily;
  displayName: string;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  /** Whether this model accepts image content parts directly (native multimodal input). */
  supportsVision?: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

/**
 * A per-request override of the provider's env-configured credential, used by
 * the Tenant AI Credentials module to run a call with an organization's own
 * (decrypted) key. When present, it supersedes the provider's configured
 * apiKey/baseUrl for that single call.
 */
export interface AIProviderCredentialOverride {
  apiKey: string;
  baseUrl?: string;
}

export interface AIProviderChatRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  credentialOverride?: AIProviderCredentialOverride;
}

export interface AIChatResponse {
  id: string;
  provider: AIProviderName;
  model: string;
  outputText: string;
  finishReason?: string;
  usage?: AIUsage;
  /**
   * PLATFORM vs TENANT credential attribution. Populated by AIRuntimeService,
   * which is the layer that knows whether a tenant BYO key was applied — the
   * provider adapters only receive an opaque credentialOverride and never set
   * this. Optional here so provider adapters satisfy the interface; the
   * runtime re-declares it required on its own return type.
   */
  credentialSource?: CredentialSource;
}

export interface AIEmbeddingRequest {
  model: string;
  input: string[];
  signal?: AbortSignal;
  credentialOverride?: AIProviderCredentialOverride;
}

export interface AIEmbeddingResponse {
  provider: AIProviderName;
  model: string;
  vectors: number[][];
  /** See AIChatResponse.credentialSource — populated by AIRuntimeService. */
  credentialSource?: CredentialSource;
}

export interface AIStreamEventBase {
  provider: AIProviderName;
  model: string;
}

export type AIStreamEvent =
  | (AIStreamEventBase & {
      type: 'message_start';
      messageId: string;
    })
  | (AIStreamEventBase & {
      type: 'content_delta';
      delta: string;
    })
  | (AIStreamEventBase & {
      type: 'message_end';
      finishReason?: string;
      outputText?: string;
      usage?: AIUsage;
      /** See AIChatResponse.credentialSource — injected by AIRuntimeService. */
      credentialSource?: CredentialSource;
    })
  | (AIStreamEventBase & {
      type: 'error';
      code: string;
      message: string;
    });

export interface AIRuntimeChatInput {
  conversationId?: string;
  provider?: AIProviderName;
  model?: string;
  systemPrompt?: string;
  workspaceContext?: string[];
  conversationHistory?: AIMessage[];
  userPrompt: string;
  attachmentIds?: string[];
  toolResults?: Array<{
    toolName: string;
    content: string;
    isError?: boolean;
  }>;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  organizationId: string;
}
