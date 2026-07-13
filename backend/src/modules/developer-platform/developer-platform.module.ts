import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { PersonalAccessTokenAuthController } from './personal-access-token-auth.controller';
import { PersonalAccessTokenController } from './personal-access-token.controller';
import { PersonalAccessTokenRepository } from './personal-access-token.repository';
import { PersonalAccessTokenService } from './personal-access-token.service';
import { ServiceAccountAuthController } from './service-account-auth.controller';
import { ServiceAccountController } from './service-account.controller';
import { ServiceAccountRepository } from './service-account.repository';
import { ServiceAccountService } from './service-account.service';
import { PersonalAccessTokenGuard } from './guards/personal-access-token.guard';
import { ServiceAccountGuard } from './guards/service-account.guard';
import { JwtOrPersonalAccessTokenGuard } from './guards/jwt-or-personal-access-token.guard';

/**
 * v2.3 Developer Platform (Phase 1) — Personal Access Tokens (user-scoped)
 * and Service Accounts (org-scoped, backed by a real Membership). Reuses
 * AuthContextService (AuthModule is @Global()) for permission resolution
 * rather than a bespoke authorization path, and the existing
 * PermissionRepository/PermissionService/RoleRepository for validation —
 * no parallel RBAC implementation.
 */
@Module({
  imports: [PermissionsModule, RolesModule],
  controllers: [
    PersonalAccessTokenController,
    PersonalAccessTokenAuthController,
    ServiceAccountController,
    ServiceAccountAuthController,
  ],
  providers: [
    PersonalAccessTokenRepository,
    PersonalAccessTokenService,
    PersonalAccessTokenGuard,
    ServiceAccountRepository,
    ServiceAccountService,
    ServiceAccountGuard,
    JwtOrPersonalAccessTokenGuard,
  ],
  exports: [PersonalAccessTokenGuard, ServiceAccountGuard, JwtOrPersonalAccessTokenGuard],
})
export class DeveloperPlatformModule {}
