import { InternalServerErrorException } from '@nestjs/common';
import { StepExecutorRegistry } from '../src/modules/workflows/executors/step-executor.registry';
import { StepExecutor } from '../src/modules/workflows/executors/step-executor.interface';

function stubExecutor(type: StepExecutor['type']): StepExecutor {
  return { type, execute: jest.fn() };
}

describe('StepExecutorRegistry', () => {
  let registry: StepExecutorRegistry;

  beforeEach(() => {
    registry = new StepExecutorRegistry(
      stubExecutor('AGENT') as never,
      stubExecutor('TOOL') as never,
      stubExecutor('API') as never,
      stubExecutor('WEBHOOK') as never,
      stubExecutor('NOTIFICATION') as never,
      stubExecutor('APPROVAL') as never,
      stubExecutor('DELAY') as never,
    );
  });

  it('resolves a statically registered executor by type', () => {
    expect(registry.get('TOOL').type).toBe('TOOL');
  });

  it('throws for an unregistered step type', () => {
    expect(() => registry.get('INTEGRATION')).toThrow(InternalServerErrorException);
  });

  describe('registerDynamicExecutor', () => {
    it('resolves a dynamically registered executor', () => {
      const integrationExecutor = stubExecutor('INTEGRATION');
      registry.registerDynamicExecutor('INTEGRATION', integrationExecutor);
      expect(registry.get('INTEGRATION')).toBe(integrationExecutor);
    });

    it('still resolves statically registered executors after a dynamic one is added', () => {
      registry.registerDynamicExecutor('INTEGRATION', stubExecutor('INTEGRATION'));
      expect(registry.get('AGENT').type).toBe('AGENT');
    });

    it('a later registration for the same type overrides the earlier one', () => {
      const first = stubExecutor('INTEGRATION');
      const second = stubExecutor('INTEGRATION');
      registry.registerDynamicExecutor('INTEGRATION', first);
      registry.registerDynamicExecutor('INTEGRATION', second);
      expect(registry.get('INTEGRATION')).toBe(second);
    });
  });
});
