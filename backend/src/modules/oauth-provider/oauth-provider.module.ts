import { Module } from '@nestjs/common';
import { ToolModule } from '../ai/tools/tool.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { OAuthAccessTokenGuard } from './guards/oauth-access-token.guard';
import { OAuthApplicationController } from './oauth-application.controller';
import { OAuthApplicationRepository } from './oauth-application.repository';
import { OAuthApplicationService } from './oauth-application.service';
import { OAuthAuthorizationCodeRepository } from './oauth-authorization-code.repository';
import { OAuthAuthorizationService } from './oauth-authorization.service';
import { OAuthAuthorizeController } from './oauth-authorize.controller';
import { OAuthTokenAuthController } from './oauth-token-auth.controller';
import { OAuthTokenController } from './oauth-token.controller';
import { OAuthTokenRepository } from './oauth-token.repository';
import { OAuthTokenService } from './oauth-token.service';

/**
 * v2.3 Developer Platform (Phase 2) — Voltx as an OAuth 2.0 authorization
 * server. Reuses OutboundHttpGuardService (ToolModule) for redirect-URI
 * SSRF validation, PermissionRepository (PermissionsModule) for the
 * can't-exceed-caller scope check, and AuthContextService/AuditService
 * (both @Global()) exactly like the rest of the Developer Platform —
 * no parallel RBAC or credential-hashing implementation.
 */
@Module({
  imports: [PermissionsModule, ToolModule, WebhooksModule],
  controllers: [
    OAuthApplicationController,
    OAuthAuthorizeController,
    OAuthTokenController,
    OAuthTokenAuthController,
  ],
  providers: [
    OAuthApplicationRepository,
    OAuthApplicationService,
    OAuthAuthorizationCodeRepository,
    OAuthAuthorizationService,
    OAuthTokenRepository,
    OAuthTokenService,
    OAuthAccessTokenGuard,
  ],
  exports: [OAuthAccessTokenGuard],
})
export class OAuthProviderModule {}
