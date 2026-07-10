import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AttachmentUrlSignerService } from './attachment-url-signer.service';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    AttachmentUrlSignerService,
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        configService: ConfigService,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
      ) =>
        configService.get<string>('attachments.storageProvider', 'local') === 's3' ? s3 : local,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
    },
  ],
  exports: [STORAGE_PROVIDER, AttachmentUrlSignerService],
})
export class StorageModule {}
