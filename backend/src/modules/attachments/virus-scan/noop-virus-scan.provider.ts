import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { VirusScanProvider, VirusScanResult } from './virus-scan-provider.interface';

/**
 * Explicit no-op used whenever CLAMAV_HOST is unset — logs a warning on
 * boot and marks every result `skipped: true` rather than silently
 * pretending files were scanned. Selecting this provider never allows an
 * unscanned upload through: outside production it's a local-dev
 * convenience (there's nothing else uploading real user files), and in
 * production `AttachmentService` checks `virusScanProvider.name` and
 * refuses uploads with a 503 instead of ever calling `scan()` on this
 * provider for a real file. Configure CLAMAV_HOST + CLAMAV_PORT to switch
 * to ClamAvVirusScanProvider and re-enable uploads.
 */
@Injectable()
export class NoopVirusScanProvider implements VirusScanProvider, OnModuleInit {
  readonly name = 'noop';
  private readonly logger = new Logger(NoopVirusScanProvider.name);

  onModuleInit(): void {
    this.logger.warn(
      'CLAMAV_HOST is not set — attachment uploads will NOT be virus-scanned. In production, upload endpoints are disabled (503) until CLAMAV_HOST/CLAMAV_PORT are configured.',
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async for interface parity with ClamAvVirusScanProvider.
  async scan(_buffer: Buffer): Promise<VirusScanResult> {
    return { clean: true, skipped: true };
  }
}
