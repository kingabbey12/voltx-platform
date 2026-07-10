import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClamAvVirusScanProvider } from './clamav-virus-scan.provider';
import { NoopVirusScanProvider } from './noop-virus-scan.provider';
import { VIRUS_SCAN_PROVIDER } from './virus-scan-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    ClamAvVirusScanProvider,
    NoopVirusScanProvider,
    {
      provide: VIRUS_SCAN_PROVIDER,
      useFactory: (
        configService: ConfigService,
        clamav: ClamAvVirusScanProvider,
        noop: NoopVirusScanProvider,
      ) => (configService.get<string>('attachments.virusScan.clamavHost', '') ? clamav : noop),
      inject: [ConfigService, ClamAvVirusScanProvider, NoopVirusScanProvider],
    },
  ],
  exports: [VIRUS_SCAN_PROVIDER],
})
export class VirusScanModule {}
