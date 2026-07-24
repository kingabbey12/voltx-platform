import { Module } from '@nestjs/common';
import { AIModule } from '../ai.module';
import { AiCredentialTester } from './ai-credential-tester.service';
import { TenantAiCredentialResolverModule } from './tenant-ai-credential-resolver.module';
import { TenantAiCredentialsController } from './tenant-ai-credentials.controller';
import { TenantAiCredentialsService } from './tenant-ai-credentials.service';

/**
 * Tenant AI Credentials — "bring your own key" for the AI Gateway. Stores and
 * encrypts per-organization provider credentials, supports rotation, RBAC,
 * tenant isolation, audit, and live provider health checks. Imports AIModule
 * for the AI_PROVIDERS registry (health checks call the real adapters) and
 * TenantAiCredentialResolverModule for the shared repository + resolver;
 * PrismaService, TenantContextService, EncryptionService, and AuditService
 * come from their @Global modules. Re-exports the resolver module so the
 * gateway can adopt tenant keys on the request path.
 */
@Module({
  imports: [AIModule, TenantAiCredentialResolverModule],
  controllers: [TenantAiCredentialsController],
  providers: [TenantAiCredentialsService, AiCredentialTester],
  exports: [TenantAiCredentialResolverModule],
})
export class TenantAiCredentialsModule {}
