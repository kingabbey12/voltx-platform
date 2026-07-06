import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkflowDefinition, WorkflowStepDefinition } from './workflow-definition.types';
import { findDependencyCycle } from './workflow-graph.util';

/**
 * Validates a workflow definition end-to-end before it's persisted as a
 * WorkflowVersion: unique/non-empty step ids, dependsOn references that
 * exist and don't form a cycle, and per-step-type required config fields.
 * Never mutates the definition — a passing validation is the only gate
 * between a draft and something the engine will actually execute, so
 * every check here is a hard failure (BadRequestException), not a
 * warning.
 */
@Injectable()
export class WorkflowDefinitionValidatorService {
  validate(definition: WorkflowDefinition): void {
    if (!definition.steps || definition.steps.length === 0) {
      throw new BadRequestException('Workflow definition must contain at least one step');
    }

    const ids = new Set<string>();
    for (const step of definition.steps) {
      if (!step.id || step.id.trim().length === 0) {
        throw new BadRequestException('Every workflow step must have a non-empty id');
      }
      if (ids.has(step.id)) {
        throw new BadRequestException(`Duplicate workflow step id "${step.id}"`);
      }
      ids.add(step.id);
    }

    for (const step of definition.steps) {
      this.validateDependencies(step, ids);
      this.validateCondition(step);
      this.validateCompensation(step);
      this.validateStepConfig(step);
      this.validateRetryPolicy(step);
    }

    const cycle = findDependencyCycle(definition.steps);
    if (cycle) {
      throw new BadRequestException(
        `Workflow definition contains a dependency cycle: ${cycle.join(' -> ')}`,
      );
    }
  }

  private validateDependencies(step: WorkflowStepDefinition, ids: Set<string>): void {
    for (const dependencyId of step.dependsOn ?? []) {
      if (dependencyId === step.id) {
        throw new BadRequestException(`Step "${step.id}" cannot depend on itself`);
      }
      if (!ids.has(dependencyId)) {
        throw new BadRequestException(
          `Step "${step.id}" depends on unknown step "${dependencyId}"`,
        );
      }
    }
  }

  private validateCondition(step: WorkflowStepDefinition): void {
    if (!step.condition) {
      return;
    }
    if (!step.condition.path || step.condition.path.trim().length === 0) {
      throw new BadRequestException(`Step "${step.id}" has a condition with an empty path`);
    }
  }

  private validateCompensation(step: WorkflowStepDefinition): void {
    if (!step.compensation) {
      return;
    }
    if (!step.compensation.toolName || step.compensation.toolName.trim().length === 0) {
      throw new BadRequestException(`Step "${step.id}" has a compensation hook with no toolName`);
    }
  }

  private validateRetryPolicy(step: WorkflowStepDefinition): void {
    if (!step.retryPolicy) {
      return;
    }
    if (step.retryPolicy.maxAttempts < 1) {
      throw new BadRequestException(`Step "${step.id}" retryPolicy.maxAttempts must be >= 1`);
    }
    if (step.retryPolicy.backoffMs < 0) {
      throw new BadRequestException(`Step "${step.id}" retryPolicy.backoffMs must be >= 0`);
    }
  }

  private validateStepConfig(step: WorkflowStepDefinition): void {
    switch (step.type) {
      case 'AGENT':
        if (!step.config.agentName || step.config.agentName.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (AGENT) requires config.agentName`);
        }
        if (!step.config.objective || step.config.objective.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (AGENT) requires config.objective`);
        }
        return;
      case 'TOOL':
        if (!step.config.toolName || step.config.toolName.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (TOOL) requires config.toolName`);
        }
        return;
      case 'API':
        if (!step.config.method) {
          throw new BadRequestException(`Step "${step.id}" (API) requires config.method`);
        }
        if (!step.config.url || step.config.url.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (API) requires config.url`);
        }
        return;
      case 'WEBHOOK':
        if (!step.config.url || step.config.url.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (WEBHOOK) requires config.url`);
        }
        return;
      case 'NOTIFICATION':
        if (!step.config.message || step.config.message.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (NOTIFICATION) requires config.message`);
        }
        if (step.config.channel === 'webhook' && !step.config.webhookUrl) {
          throw new BadRequestException(
            `Step "${step.id}" (NOTIFICATION) with channel "webhook" requires config.webhookUrl`,
          );
        }
        return;
      case 'APPROVAL':
        if (!step.config.message || step.config.message.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (APPROVAL) requires config.message`);
        }
        return;
      case 'DELAY':
        if (typeof step.config.delayMs !== 'number' || step.config.delayMs <= 0) {
          throw new BadRequestException(
            `Step "${step.id}" (DELAY) requires config.delayMs to be a positive number`,
          );
        }
        return;
      case 'INTEGRATION':
        if (!step.config.provider || step.config.provider.trim().length === 0) {
          throw new BadRequestException(`Step "${step.id}" (INTEGRATION) requires config.provider`);
        }
        if (!step.config.actionName || step.config.actionName.trim().length === 0) {
          throw new BadRequestException(
            `Step "${step.id}" (INTEGRATION) requires config.actionName`,
          );
        }
        return;
      default:
        throw new BadRequestException(
          `Step "${(step as WorkflowStepDefinition).id}" has an unknown step type. ` +
            'Valid types: AGENT, TOOL, API, WEBHOOK, NOTIFICATION, APPROVAL, DELAY, INTEGRATION',
        );
    }
  }
}
