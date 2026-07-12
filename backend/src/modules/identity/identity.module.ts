import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { IdentityController } from './identity.controller';
import { IdentityProviderRepository } from './identity-provider.repository';
import { IdentityProviderService } from './identity-provider.service';
import { JitProvisioningService } from './jit/jit-provisioning.service';
import { OidcEngineService } from './oidc/oidc-engine.service';
import { SamlEngineService } from './saml/saml-engine.service';
import { IdentityMetadataPublicController, SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Module({
  imports: [UsersModule, RolesModule],
  controllers: [IdentityController, SsoController, IdentityMetadataPublicController],
  providers: [
    IdentityProviderRepository,
    IdentityProviderService,
    SamlEngineService,
    OidcEngineService,
    JitProvisioningService,
    SsoService,
  ],
  exports: [IdentityProviderRepository, IdentityProviderService],
})
export class IdentityModule {}
