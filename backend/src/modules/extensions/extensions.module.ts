import { Module } from '@nestjs/common';
import { ToolModule } from '../ai/tools/tool.module';
import { ExtensionAiToolSourceService } from './extension-ai-tool-source.service';
import { ExtensionInstalledController } from './extension-installed.controller';
import { ExtensionInstalledService } from './extension-installed.service';
import { ExtensionMaterializationService } from './extension-materialization.service';
import { ExtensionRepository } from './extension.repository';

/**
 * v2.3 Developer Platform (Phase 8) — Extension Framework. Deliberately
 * declarative only: Custom Pages/Widgets/Nav are JSON manifests rendered
 * by the web app's own fixed component palette (manifest-renderer.tsx),
 * never arbitrary developer code; Custom AI Tools are HMAC-signed HTTPS
 * calls to the developer's own endpoint via the existing
 * ToolRegistry.registerDynamicSource() extension point. Exports
 * ExtensionRepository and ExtensionMaterializationService so
 * MarketplaceModule can materialize a version's manifest on approval and
 * read a developer's own AI tool signing secrets — kept a strictly
 * one-way Marketplace-depends-on-Extensions dependency to avoid a
 * circular module import.
 */
@Module({
  imports: [ToolModule],
  controllers: [ExtensionInstalledController],
  providers: [
    ExtensionRepository,
    ExtensionMaterializationService,
    ExtensionInstalledService,
    ExtensionAiToolSourceService,
  ],
  exports: [ExtensionRepository, ExtensionMaterializationService],
})
export class ExtensionsModule {}
