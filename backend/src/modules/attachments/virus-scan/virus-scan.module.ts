import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClamAvVirusScanProvider } from './clamav-virus-scan.provider';
import { NoopVirusScanProvider } from './noop-virus-scan.provider';
import { VirusScanProvider, VIRUS_SCAN_PROVIDER } from './virus-scan-provider.interface';

/**
 * Exported (not inlined in the factory below) so this resolution logic
 * can be unit tested without bootstrapping the whole module.
 *
 * ClamAV is an optional dependency — an unreachable or unconfigured
 * scanner must never prevent the app from booting (in any environment).
 * When it isn't configured, the no-op provider is selected here and
 * AttachmentService is responsible for refusing uploads at request time
 * (503) in production, so no file can ever be persisted unscanned.
 */
export async function resolveVirusScanProvider(
  configService: ConfigService,
  clamav: ClamAvVirusScanProvider,
  noop: NoopVirusScanProvider,
): Promise<VirusScanProvider> {
  const clamavHost = configService.get<string>('attachments.virusScan.clamavHost', '');
  const isProduction = configService.get<string>('nodeEnv', '') === 'production';

  if (!clamavHost) {
    return noop;
  }

  if (isProduction) {
    // Confirms clamd is actually reachable and responding at boot,
    // rather than deferring that discovery to the first real upload.
    await clamav.ping();
  }

  return clamav;
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
