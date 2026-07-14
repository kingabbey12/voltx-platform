import { ConfigService } from '@nestjs/config';
import { resolveVirusScanProvider } from '../src/modules/attachments/virus-scan/virus-scan.module';
import { ClamAvVirusScanProvider } from '../src/modules/attachments/virus-scan/clamav-virus-scan.provider';
import { NoopVirusScanProvider } from '../src/modules/attachments/virus-scan/noop-virus-scan.provider';

function buildConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
}

describe('resolveVirusScanProvider', () => {
  const noop = {} as NoopVirusScanProvider;

  it('falls back to the no-op scanner in production when CLAMAV_HOST is unset, without crashing boot', async () => {
    const clamav = { ping: jest.fn() } as unknown as ClamAvVirusScanProvider;
    const configService = buildConfig({
      nodeEnv: 'production',
      'attachments.virusScan.clamavHost': '',
    });

    const resolved = await resolveVirusScanProvider(configService, clamav, noop);

    expect(resolved).toBe(noop);
    expect(clamav.ping).not.toHaveBeenCalled();
  });

  it('pings clamd and resolves to the real scanner in production when configured', async () => {
    const clamav = {
      ping: jest.fn().mockResolvedValue(undefined),
    } as unknown as ClamAvVirusScanProvider;
    const configService = buildConfig({
      nodeEnv: 'production',
      'attachments.virusScan.clamavHost': 'clamav.internal',
    });

    const resolved = await resolveVirusScanProvider(configService, clamav, noop);

    expect(resolved).toBe(clamav);
    expect(clamav.ping).toHaveBeenCalled();
  });

  it('propagates an unreachable-clamd failure in production', async () => {
    const clamav = {
      ping: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as ClamAvVirusScanProvider;
    const configService = buildConfig({
      nodeEnv: 'production',
      'attachments.virusScan.clamavHost': 'clamav.internal',
    });

    await expect(resolveVirusScanProvider(configService, clamav, noop)).rejects.toThrow(
      'connection refused',
    );
  });

  it('falls back to the no-op scanner outside production when unconfigured', async () => {
    const clamav = { ping: jest.fn() } as unknown as ClamAvVirusScanProvider;
    const configService = buildConfig({
      nodeEnv: 'development',
      'attachments.virusScan.clamavHost': '',
    });

    const resolved = await resolveVirusScanProvider(configService, clamav, noop);

    expect(resolved).toBe(noop);
    expect(clamav.ping).not.toHaveBeenCalled();
  });

  it('uses the real scanner outside production when configured, without a ping check', async () => {
    const clamav = { ping: jest.fn() } as unknown as ClamAvVirusScanProvider;
    const configService = buildConfig({
      nodeEnv: 'test',
      'attachments.virusScan.clamavHost': 'clamav.internal',
    });

    const resolved = await resolveVirusScanProvider(configService, clamav, noop);

    expect(resolved).toBe(clamav);
    expect(clamav.ping).not.toHaveBeenCalled();
  });
});
