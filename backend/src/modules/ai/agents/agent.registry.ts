import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ModelRegistryService } from '../models/model-registry.service';
import { AgentFactory } from './agent.factory';
import { AgentRepository } from './agent.repository';

@Injectable()
export class AgentRegistry {
  private readonly logger = new Logger(AgentRegistry.name);

  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly agentFactory: AgentFactory,
    private readonly modelRegistryService: ModelRegistryService,
  ) {}

  // Called from listAgents()/findAgentByName() — every read of the agent
  // list, not just creation — so a tenant with no AI provider configured
  // yet (a perfectly valid state, e.g. a fresh beta org) must still be able
  // to see its (possibly empty) agent list. Auto-provisioning system agents
  // is a nice-to-have on top of that read, not a precondition for it.
  async ensureSystemAgents(): Promise<void> {
    let provider;
    let model;
    try {
      ({ provider, model } = await this.modelRegistryService.resolveProviderAndModel(
        undefined,
        undefined,
        'chat',
      ));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn('Skipping system agent provisioning: no AI provider is enabled yet');
        return;
      }
      throw error;
    }
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
