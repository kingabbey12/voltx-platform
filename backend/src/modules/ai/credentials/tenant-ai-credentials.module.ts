import { Module } from '@nestjs/common';
import { AIModule } from '../ai.module';
import { AiCredentialTester } from './ai-credential-tester.service';
import { TenantAiCredentialResolver } from './tenant-ai-credential-resolver.service';
import { TenantAiCredentialsController } from './tenant-ai-credentials.controller';
import { TenantAiCredentialsRepository } from './tenant-ai-credentials.repository';
import { TenantAiCredentialsService } from './tenant-ai-credentials.service';

/**
 * Tenant AI Credentials — "bring your own key" for the AI Gateway. Stores and
 * encrypts per-organization provider credentials, supports rotation, RBAC,
 * tenant isolation, audit, and live provider health checks. Imports AIModule
 * for the AI_PROVIDERS registry (health checks call the real adapters);
 * PrismaService, TenantContextService, EncryptionService, and AuditService
 * come from their @Global modules. Exports the resolver so the gateway can
 * adopt tenant keys on the request path.
 */
@Module({
  imports: [AIModule],
  controllers: [TenantAiCredentialsController],
  providers: [
    TenantAiCredentialsRepository,
    TenantAiCredentialsService,
    TenantAiCredentialResolver,
    AiCredentialTester,
  ],
  exports: [TenantAiCredentialResolver],
})
export class TenantAiCredentialsModule {}
