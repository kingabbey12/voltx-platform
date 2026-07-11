import { ConfigService } from '@nestjs/config';
import { resolveStorageProvider } from '../src/modules/attachments/storage/storage.module';
import { LocalStorageProvider } from '../src/modules/attachments/storage/local-storage.provider';
import { S3StorageProvider } from '../src/modules/attachments/storage/s3-storage.provider';

function buildConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
}

describe('resolveStorageProvider', () => {
  const local = {} as LocalStorageProvider;

  it('refuses to start in production unless the provider is s3', async () => {
    const s3 = { verifyProductionReadiness: jest.fn() } as unknown as S3StorageProvider;
    const configService = buildConfig({
      nodeEnv: 'production',
      'attachments.storageProvider': 'local',
    });

    await expect(resolveStorageProvider(configService, local, s3)).rejects.toThrow(
      /ATTACHMENTS_STORAGE_PROVIDER must be "s3"/,
    );
    expect(s3.verifyProductionReadiness).not.toHaveBeenCalled();
  });

  it('verifies bucket connectivity and resolves to s3 in production when correctly configured', async () => {
    const s3 = {
      verifyProductionReadiness: jest.fn().mockResolvedValue(undefined),
    } as unknown as S3StorageProvider;
    const configService = buildConfig({
      nodeEnv: 'production',
      'attachments.storageProvider': 's3',
    });

    const resolved = await resolveStorageProvider(configService, local, s3);

    expect(resolved).toBe(s3);
    expect(s3.verifyProductionReadiness).toHaveBeenCalled();
  });

  it('propagates a bucket connectivity failure in production', async () => {
    const s3 = {
      verifyProductionReadiness: jest.fn().mockRejectedValue(new Error('bucket unreachable')),
    } as unknown as S3StorageProvider;
    const configService = buildConfig({
      nodeEnv: 'production',
      'attachments.storageProvider': 's3',
    });

    await expect(resolveStorageProvider(configService, local, s3)).rejects.toThrow(
      'bucket unreachable',
    );
  });

  it('allows local storage outside production regardless of configuration', async () => {
    const s3 = { verifyProductionReadiness: jest.fn() } as unknown as S3StorageProvider;
    const configService = buildConfig({
      nodeEnv: 'development',
      'attachments.storageProvider': 'local',
    });

    const resolved = await resolveStorageProvider(configService, local, s3);

    expect(resolved).toBe(local);
    expect(s3.verifyProductionReadiness).not.toHaveBeenCalled();
  });

  it('allows s3 outside production without a readiness check', async () => {
    const s3 = { verifyProductionReadiness: jest.fn() } as unknown as S3StorageProvider;
    const configService = buildConfig({ nodeEnv: 'test', 'attachments.storageProvider': 's3' });

    const resolved = await resolveStorageProvider(configService, local, s3);

    expect(resolved).toBe(s3);
    expect(s3.verifyProductionReadiness).not.toHaveBeenCalled();
  });
});
