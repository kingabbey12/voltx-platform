import { StripeWebhookQueueService } from '../src/modules/billing/jobs/stripe-webhook-queue.service';
import { BillingEventRepository } from '../src/modules/billing/billing-event.repository';
import { StripeWebhookDispatcherService } from '../src/modules/billing/stripe/stripe-webhook-dispatcher.service';

describe('StripeWebhookQueueService', () => {
  let billingEventRepository: jest.Mocked<BillingEventRepository>;
  let dispatcherService: jest.Mocked<StripeWebhookDispatcherService>;

  beforeEach(() => {
    billingEventRepository = {
      createIfNew: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      findByStripeEventId: jest.fn(),
      findById: jest.fn(),
    } as never;
    dispatcherService = { dispatch: jest.fn() } as never;
  });

  describe('enqueue (Redis disabled — no queue injected)', () => {
    it('processes the event inline', async () => {
      const service = new StripeWebhookQueueService(
        null,
        billingEventRepository,
        dispatcherService,
      );
      billingEventRepository.findById.mockResolvedValue({
        id: 'event-1',
        payload: { id: 'evt_123', type: 'checkout.session.completed' },
      } as never);

      await service.enqueue('event-1');

      expect(dispatcherService.dispatch).toHaveBeenCalledWith({
        id: 'evt_123',
        type: 'checkout.session.completed',
      });
      expect(billingEventRepository.markProcessed).toHaveBeenCalledWith('event-1');
    });
  });

  describe('enqueue (Redis enabled — queue injected)', () => {
    it('adds a job to the queue instead of processing inline', async () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const service = new StripeWebhookQueueService(
        queue as never,
        billingEventRepository,
        dispatcherService,
      );

      await service.enqueue('event-1', 'org-1');

      expect(queue.add).toHaveBeenCalledWith(
        'process_event',
        { billingEventId: 'event-1', organizationId: 'org-1' },
        expect.objectContaining({ jobId: 'billing-event:event-1' }),
      );
      expect(dispatcherService.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('processEvent', () => {
    it('warns and returns when the billing event no longer exists', async () => {
      const service = new StripeWebhookQueueService(
        null,
        billingEventRepository,
        dispatcherService,
      );
      billingEventRepository.findById.mockResolvedValue(null);

      await service.processEvent('missing-event');

      expect(dispatcherService.dispatch).not.toHaveBeenCalled();
    });

    it('marks the event failed and rethrows when dispatch throws', async () => {
      const service = new StripeWebhookQueueService(
        null,
        billingEventRepository,
        dispatcherService,
      );
      billingEventRepository.findById.mockResolvedValue({
        id: 'event-1',
        payload: { id: 'evt_123', type: 'invoice.paid' },
      } as never);
      dispatcherService.dispatch.mockRejectedValue(new Error('boom'));

      await expect(service.processEvent('event-1')).rejects.toThrow('boom');

      expect(billingEventRepository.markFailed).toHaveBeenCalledWith('event-1', 'boom');
      expect(billingEventRepository.markProcessed).not.toHaveBeenCalled();
    });
  });
});
