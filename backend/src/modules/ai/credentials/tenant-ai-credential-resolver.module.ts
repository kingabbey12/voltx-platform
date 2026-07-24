import { Module } from '@nestjs/common';
import { TenantAiCredentialResolver } from './tenant-ai-credential-resolver.service';
import { TenantAiCredentialsRepository } from './tenant-ai-credentials.repository';

/**
 * The AI Gateway's read path for "bring your own key" — deliberately split out
 * of TenantAiCredentialsModule so it carries no AIModule dependency. AIModule
 * imports this to let AIRuntimeService adopt a tenant's decrypted key per
 * request, while TenantAiCredentialsModule (management: controller, tester,
 * service) keeps importing AIModule for the AI_PROVIDERS health-check
 * registry. Extracting the repository + resolver here is what breaks the
 * otherwise-circular AIModule <-> TenantAiCredentialsModule dependency.
 *
 * PrismaService, TenantContextService, and EncryptionService are all supplied
 * by their @Global modules, so this module needs no imports.
 */
@Module({
  providers: [TenantAiCredentialsRepository, TenantAiCredentialResolver],
  exports: [TenantAiCredentialsRepository, TenantAiCredentialResolver],
})
export class TenantAiCredentialResolverModule {}
