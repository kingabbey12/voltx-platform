import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ExtensionWidgetPlacement, Prisma } from '@prisma/client';
import { EncryptionService } from '../integrations/security/encryption.service';
import { ExtensionRepository } from './extension.repository';
import { ExtensionManifest } from './utils/manifest-validator.util';

/**
 * Turns a MarketplaceAppVersion's already-validated `manifest` (see
 * manifest-validator.util.ts, enforced at submission time) into real
 * rows once platform-admin review approves that version (see
 * MarketplaceVersionReviewService.approve). Each version gets its own
 * set of rows — nothing is deleted from prior versions, since an
 * installing organization's MarketplaceInstall may still point at an
 * older installedVersionId until it upgrades.
 */
@Injectable()
export class ExtensionMaterializationService {
  constructor(
    private readonly repository: ExtensionRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  async materializeFromVersion(appId: string, versionId: string, manifest: unknown): Promise<void> {
    const parsed = (manifest ?? {}) as ExtensionManifest;

    await this.repository.createPages(
      versionId,
      (parsed.pages ?? []).map((page) => ({
        path: page.path,
        manifest: page as unknown as Prisma.InputJsonValue,
      })),
    );

    await this.repository.createWidgets(
      versionId,
      (parsed.widgets ?? []).map((widget) => ({
        placement: widget.placement as ExtensionWidgetPlacement,
        manifest: widget as unknown as Prisma.InputJsonValue,
      })),
    );

    await this.repository.createNavEntries(
      versionId,
      (parsed.navEntries ?? []).map((entry) => ({
        label: entry.label,
        icon: entry.icon,
        targetPath: entry.targetPath,
      })),
    );

    const aiTools = parsed.aiTools ?? [];
    const aiToolData = await Promise.all(
      aiTools.map(async (tool) => {
        const prior = await this.repository.findPriorAiToolByName(appId, tool.name);
        const encryptedSigningSecret =
          prior?.encryptedSigningSecret ??
          this.encryptionService.encrypt(`ext_signing_${randomBytes(24).toString('base64url')}`);

        return {
          name: tool.name,
          description: tool.description,
          parametersSchema: tool.parametersSchema as unknown as Prisma.InputJsonValue,
          responseSchema: tool.responseSchema as unknown as Prisma.InputJsonValue,
          endpointUrl: tool.endpointUrl,
          encryptedSigningSecret,
        };
      }),
    );
    await this.repository.createAiTools(versionId, aiToolData);
  }
}
