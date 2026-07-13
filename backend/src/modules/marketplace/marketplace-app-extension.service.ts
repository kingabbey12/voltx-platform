import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { ExtensionAiToolResponseDto } from '../extensions/dto/extension.dto';
import { ExtensionRepository } from '../extensions/extension.repository';
import { EncryptionService } from '../integrations/security/encryption.service';
import { MarketplaceAppRepository } from './marketplace-app.repository';

/** The developer-facing view of their own app's materialized Custom AI
 * Tools — surfaces the current decrypted signing secret the developer
 * must configure on their own endpoint, re-readable at any time (not
 * "shown once") since it's the owning developer organization reading its
 * own secret from within its own tenant boundary, not a third party. */
@Injectable()
export class MarketplaceAppExtensionService {
  constructor(
    private readonly appRepository: MarketplaceAppRepository,
    private readonly extensionRepository: ExtensionRepository,
    private readonly encryptionService: EncryptionService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async listAiTools(appId: string, organizationId: string): Promise<ExtensionAiToolResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const app = await this.appRepository.findByIdInOrganization(appId, organizationId);
    if (!app) {
      throw new NotFoundException('Marketplace app not found');
    }

    const latestVersion = await this.appRepository.findLatestPublishedVersion(appId);
    if (!latestVersion) {
      return [];
    }

    const tools = await this.extensionRepository.listAiToolsForVersion(latestVersion.id);
    return tools.map((tool) =>
      ExtensionAiToolResponseDto.fromEntity(
        tool,
        this.encryptionService.decrypt(tool.encryptedSigningSecret),
      ),
    );
  }
}
