export type AIProviderName = 'openai' | 'anthropic' | 'google';

export type AIModelFamily = 'gpt-5' | 'claude' | 'gemini';

export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
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
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface AIProviderChatRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface AIChatResponse {
  id: string;
  provider: AIProviderName;
  model: string;
  outputText: string;
  finishReason?: string;
  usage?: AIUsage;
}

export interface AIEmbeddingRequest {
  model: string;
  input: string[];
  signal?: AbortSignal;
}

export interface AIEmbeddingResponse {
  provider: AIProviderName;
  model: string;
  vectors: number[][];
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
  toolResults?: Array<{
    toolName: string;
    content: string;
    isError?: boolean;
  }>;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}
