import { AIProviderName } from '../../models/ai-model.types';

export interface AgentConfiguration {
  kind?: 'system' | 'custom';
  systemAgentKey?: string;
  toolNames?: string[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Defaults to true when absent — see AgentFactory.canDelegate. */
  canDelegate?: boolean;
  /** Empty/absent means unrestricted — see AgentFactory.getAllowedDelegateAgentNames. */
  delegateToAgentNames?: string[];
}

export interface AgentEntity {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: AIProviderName;
  model: string;
  configuration: AgentConfiguration & Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
