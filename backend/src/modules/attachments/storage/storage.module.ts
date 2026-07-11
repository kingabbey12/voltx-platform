import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AttachmentUrlSignerService } from './attachment-url-signer.service';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageProvider, STORAGE_PROVIDER } from './storage-provider.interface';

/**
 * Exported (not inlined in the factory below) so the production
 * fail-fast behavior — the actual point of this function — can be unit
 * tested without bootstrapping the whole module.
 */
export async function resolveStorageProvider(
  configService: ConfigService,
  local: LocalStorageProvider,
  s3: S3StorageProvider,
): Promise<StorageProvider> {
  const provider = configService.get<string>('attachments.storageProvider', 'local');
  const isProduction = configService.get<string>('nodeEnv', '') === 'production';

  if (isProduction) {
    // Local filesystem storage is dev-only — a multi-instance or
    // autoscaled production deployment loses uploads on container
    // recycle and 404s files uploaded to a different instance. Fail
    // startup rather than silently accepting that failure mode.
    if (provider !== 's3') {
      throw new Error(
        'ATTACHMENTS_STORAGE_PROVIDER must be "s3" in production — local filesystem storage does not survive container restarts or work across multiple instances.',
      );
    }
    await s3.verifyProductionReadiness();
    return s3;
  }

  return provider === 's3' ? s3 : local;
}

@Module({
  imports: [ConfigModule],
  providers: [
    AttachmentUrlSignerService,
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: resolveStorageProvider,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
    },
  ],
  exports: [STORAGE_PROVIDER, AttachmentUrlSignerService],
})
export class StorageModule {}
