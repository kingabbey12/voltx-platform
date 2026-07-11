import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * Standalone, @Global() home for EncryptionService — split out of
 * IntegrationModule so any module needing at-rest encryption (e.g.
 * WorkflowSecretService/WorkflowWebhookService) can inject it without
 * importing the whole IntegrationModule, which would cycle back
 * (IntegrationModule already imports WorkflowModule to register its
 * INTEGRATION step executor). Same rationale as WorkflowEventsModule's
 * @Global() split in v2.0's workflow event-bus wiring.
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
