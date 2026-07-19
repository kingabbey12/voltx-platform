import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { UsersModule } from '../users/users.module';
import { ApiKeyAuthController } from './api-key-auth.controller';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IpAllowlistGuard } from './guards/ip-allowlist.guard';
import { MfaController } from './mfa.controller';
import { MfaRepository } from './mfa.repository';
import { MfaService } from './mfa.service';
import { LoginHistoryController, SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SecurityPolicyController } from './security-policy.controller';
import { SecurityPolicyService } from './security-policy.service';
import { TrustedDevicesController } from './trusted-devices.controller';
import { TrustedDevicesService } from './trusted-devices.service';

/**
 * v2.2 Security Center — MFA, sessions, trusted devices, API keys, IP
 * allowlists, and org-level security policy. Deliberately does not
 * re-implement anything AuthModule already owns: Session/TrustedDevice
 * Prisma access (SessionRepository/TrustedDeviceRepository) live in the
 * auth module and are injected here as-is (AuthModule is @Global()), since
 * they're also read/written directly by AuthService.login()/refresh()
 * before any Security Center endpoint is ever involved.
 */
@Module({
  imports: [OrganizationModule, UsersModule],
  controllers: [
    MfaController,
    SessionsController,
    LoginHistoryController,
    TrustedDevicesController,
    ApiKeysController,
    ApiKeyAuthController,
    SecurityPolicyController,
  ],
  providers: [
    MfaRepository,
    MfaService,
    SessionsService,
    TrustedDevicesService,
    ApiKeyRepository,
    ApiKeysService,
    SecurityPolicyService,
    ApiKeyGuard,
    IpAllowlistGuard,
  ],
  exports: [ApiKeysService, ApiKeyGuard, IpAllowlistGuard],
})
export class SecurityModule {}
