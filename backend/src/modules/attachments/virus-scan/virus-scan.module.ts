import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClamAvVirusScanProvider } from './clamav-virus-scan.provider';
import { NoopVirusScanProvider } from './noop-virus-scan.provider';
import { VirusScanProvider, VIRUS_SCAN_PROVIDER } from './virus-scan-provider.interface';

/**
 * Exported (not inlined in the factory below) so the production
 * fail-fast behavior — the actual point of this function — can be unit
 * tested without bootstrapping the whole module.
 */
export async function resolveVirusScanProvider(
  configService: ConfigService,
  clamav: ClamAvVirusScanProvider,
  noop: NoopVirusScanProvider,
): Promise<VirusScanProvider> {
  const clamavHost = configService.get<string>('attachments.virusScan.clamavHost', '');
  const isProduction = configService.get<string>('nodeEnv', '') === 'production';

  if (isProduction) {
    // The no-op provider marks every upload "clean" without ever
    // scanning it — fine for local dev, never acceptable once real
    // user-uploaded files are accepted in production.
    if (!clamavHost) {
      throw new Error('CLAMAV_HOST must be set in production — uploads cannot go unscanned.');
    }
    await clamav.ping();
    return clamav;
  }

  return clamavHost ? clamav : noop;
}

@Module({
  imports: [ConfigModule],
  providers: [
    ClamAvVirusScanProvider,
    NoopVirusScanProvider,
    {
      provide: VIRUS_SCAN_PROVIDER,
      useFactory: resolveVirusScanProvider,
      inject: [ConfigService, ClamAvVirusScanProvider, NoopVirusScanProvider],
    },
  ],
  exports: [VIRUS_SCAN_PROVIDER],
})
export class VirusScanModule {}
