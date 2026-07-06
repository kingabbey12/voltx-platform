import { Injectable, OnModuleInit } from '@nestjs/common';
import { StepExecutorRegistry } from '../../workflows/executors/step-executor.registry';
import { IntegrationStepExecutor } from './integration-step-executor';

/** Registers IntegrationStepExecutor into the workflow engine's StepExecutorRegistry at boot — see registerDynamicExecutor's docstring for why this is a registration hook rather than a constructor-injected provider. */
@Injectable()
export class IntegrationWorkflowRegistrarService implements OnModuleInit {
  constructor(
    private readonly stepExecutorRegistry: StepExecutorRegistry,
    private readonly integrationStepExecutor: IntegrationStepExecutor,
  ) {}

  onModuleInit(): void {
    this.stepExecutorRegistry.registerDynamicExecutor('INTEGRATION', this.integrationStepExecutor);
  }
}
