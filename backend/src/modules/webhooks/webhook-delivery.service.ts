import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookDeliveryStatus, WebhookEndpointStatus } from '@prisma/client';
import { signWebhookPayload } from '../../common/utils/hmac.util';
import { OutboundHttpGuardService } from '../ai/tools/outbound-http-guard.service';
import { EncryptionService } from '../integrations/security/encryption.service';
import { WebhookDeliveryRepository } from './webhook-delivery.repository';
import { WebhookEndpointRepository } from './webhook-endpoint.repository';

/**
 * Performs one delivery attempt and persists its outcome. Called
 * identically from WebhookDeliveryQueueService's Redis-disabled inline
 * fallback and from WebhookDeliveryProcessor's queued path — one
 * implementation, two entry points, matching the WorkflowRunQueueService/
 * WorkflowRunProcessor precedent.
 */
@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly endpointRepository: WebhookEndpointRepository,
    private readonly deliveryRepository: WebhookDeliveryRepository,
    private readonly outboundHttpGuard: OutboundHttpGuardService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * `attemptNumber` is 1-indexed ("this is attempt #N"); `maxAttempts` is
   * the total attempts the caller intends to allow (BullMQ's
   * `job.opts.attempts` when queued, or 1 in the Redis-disabled inline
   * fallback). Returns true on a successful (2xx) delivery. A false
   * return with `attemptNumber < maxAttempts` means the caller should let
   * BullMQ retry (this method has already recorded status FAILED); a
   * false return with `attemptNumber >= maxAttempts` means delivery has
   * been marked EXHAUSTED and must not be retried further.
   */
  async attemptDelivery(
    deliveryId: string,
    attemptNumber: number,
    maxAttempts: number,
  ): Promise<boolean> {
    const delivery = await this.deliveryRepository.findByIdUnscoped(deliveryId);
    if (!delivery) {
      this.logger.warn({ deliveryId }, 'Webhook delivery not found — skipping attempt');
      return true;
    }

    const endpoint = await this.endpointRepository.findByIdUnscoped(delivery.endpointId);
    if (!endpoint || endpoint.status !== WebhookEndpointStatus.ACTIVE) {
      await this.deliveryRepository.recordAttempt(deliveryId, {
        status: WebhookDeliveryStatus.EXHAUSTED,
        responseBody: 'Endpoint is missing or suspended',
      });
      return true;
    }

    const secret = this.encryptionService.decrypt(endpoint.encryptedSecret);
    const rawBody = JSON.stringify({ eventType: delivery.eventType, payload: delivery.payload });
    const signature = signWebhookPayload(secret, rawBody);
    const timeoutMs = this.configService.get<number>('webhooks.requestTimeoutMs', 10000);
    const isFinalAttempt = attemptNumber >= maxAttempts;

    try {
      const response = await this.outboundHttpGuard.fetch(endpoint.url, 'webhook_delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Voltx-Signature': signature,
          'X-Voltx-Event': delivery.eventType,
        },
        body: rawBody,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const responseBody = await response.text();

      if (response.ok) {
        await this.deliveryRepository.recordAttempt(deliveryId, {
          status: WebhookDeliveryStatus.SUCCEEDED,
          responseStatusCode: response.status,
          responseBody,
          deliveredAt: new Date(),
        });
        return true;
      }

      await this.deliveryRepository.recordAttempt(deliveryId, {
        status: isFinalAttempt ? WebhookDeliveryStatus.EXHAUSTED : WebhookDeliveryStatus.FAILED,
        responseStatusCode: response.status,
        responseBody,
      });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown delivery error';
      await this.deliveryRepository.recordAttempt(deliveryId, {
        status: isFinalAttempt ? WebhookDeliveryStatus.EXHAUSTED : WebhookDeliveryStatus.FAILED,
        responseBody: message,
      });
      return false;
    }
  }
}
