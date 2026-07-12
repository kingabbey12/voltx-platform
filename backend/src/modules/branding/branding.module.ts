import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { StorageModule } from '../attachments/storage/storage.module';
import { BrandingPublicController } from './branding-public.controller';
import { BrandingPublicService } from './branding-public.service';
import { BrandThemeController } from './brand-theme.controller';
import { BrandThemeRepository } from './brand-theme.repository';
import { BrandThemeService } from './brand-theme.service';
import { CustomDomainController } from './custom-domain.controller';
import { CustomDomainRepository } from './custom-domain.repository';
import { CustomDomainService } from './custom-domain.service';

@Module({
  imports: [OrganizationModule, StorageModule],
  controllers: [BrandThemeController, CustomDomainController, BrandingPublicController],
  providers: [
    BrandThemeRepository,
    BrandThemeService,
    CustomDomainRepository,
    CustomDomainService,
    BrandingPublicService,
  ],
  exports: [BrandThemeRepository, CustomDomainRepository],
})
export class BrandingModule {}
