import { Injectable } from '@nestjs/common';
import { ModelRegistryService } from '../models/model-registry.service';
import { AgentFactory } from './agent.factory';
import { AgentRepository } from './agent.repository';

@Injectable()
export class AgentRegistry {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly agentFactory: AgentFactory,
    private readonly modelRegistryService: ModelRegistryService,
  ) {}

  async ensureSystemAgents(): Promise<void> {
    const { provider, model } = await this.modelRegistryService.resolveProviderAndModel(
      undefined,
      undefined,
      'chat',
    );
    const definitions = this.agentFactory.createSystemAgents(provider.name, model.id);

    for (const definition of definitions) {
      const existing = await this.agentRepository.findAgentByName(definition.name, true);
      if (existing) {
        continue;
      }

      await this.agentRepository.createAgent({
        name: definition.name,
        description: definition.description,
        systemPrompt: definition.systemPrompt,
        provider: definition.provider,
        model: definition.model,
        configuration: definition.configuration,
        enabled: definition.enabled,
      });
    }
  }
}
