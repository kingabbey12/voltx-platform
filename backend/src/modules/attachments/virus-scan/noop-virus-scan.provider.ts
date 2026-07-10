import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { VirusScanProvider, VirusScanResult } from './virus-scan-provider.interface';

/**
 * Explicit no-op used only when CLAMAV_HOST is unset — logs a warning on
 * boot and marks every result `skipped: true` rather than silently
 * pretending files were scanned. Never select this in production;
 * configure CLAMAV_HOST to switch to ClamAvVirusScanProvider instead.
 */
@Injectable()
export class NoopVirusScanProvider implements VirusScanProvider, OnModuleInit {
  readonly name = 'noop';
  private readonly logger = new Logger(NoopVirusScanProvider.name);

  onModuleInit(): void {
    this.logger.warn(
      'CLAMAV_HOST is not set — attachment uploads will NOT be virus-scanned. Configure CLAMAV_HOST before accepting uploads in production.',
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async for interface parity with ClamAvVirusScanProvider.
  async scan(_buffer: Buffer): Promise<VirusScanResult> {
    return { clean: true, skipped: true };
  }
}
