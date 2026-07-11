import { IntegrationWorkflowEventBridgeService } from '../src/modules/integrations/workflow/integration-workflow-event-bridge.service';
import { IntegrationBusEvent } from '../src/modules/integrations/events/integration-event-bus.service';

describe('IntegrationWorkflowEventBridgeService', () => {
  it('forwards every published integration event into the workflow event bus by type', () => {
    let capturedListener: ((event: IntegrationBusEvent) => void) | undefined;
    const integrationEventBus = {
      subscribe: jest.fn((listener: (event: IntegrationBusEvent) => void) => {
        capturedListener = listener;
        return () => undefined;
      }),
    };
    const workflowEventBus = { emit: jest.fn() };

    const bridge = new IntegrationWorkflowEventBridgeService(
      integrationEventBus as never,
      workflowEventBus as never,
    );
    bridge.onModuleInit();

    expect(integrationEventBus.subscribe).toHaveBeenCalledTimes(1);
    expect(capturedListener).toBeDefined();

    capturedListener?.({
      organizationId: 'org-1',
      connectionId: 'conn-1',
      type: 'EMAIL_RECEIVED',
      payload: { subject: 'Hello' },
      occurredAt: '2026-07-11T00:00:00.000Z',
    });

    expect(workflowEventBus.emit).toHaveBeenCalledWith('EMAIL_RECEIVED', {
      organizationId: 'org-1',
      connectionId: 'conn-1',
      occurredAt: '2026-07-11T00:00:00.000Z',
      subject: 'Hello',
    });
  });
});
