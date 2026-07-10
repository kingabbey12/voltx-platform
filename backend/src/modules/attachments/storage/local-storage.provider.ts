import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { AttachmentUrlSignerService } from './attachment-url-signer.service';
import { StoragePart, StorageProvider } from './storage-provider.interface';

/**
 * Filesystem-backed storage for local development — never used in
 * production (see S3StorageProvider), selected by
 * ATTACHMENTS_STORAGE_PROVIDER=local (the default). Multipart uploads are
 * simulated by writing each part to a scratch directory and concatenating
 * them on completion, since the filesystem has no native multipart API.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;
  private readonly signedUrlDefaultTtlSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly urlSigner: AttachmentUrlSignerService,
  ) {
    this.rootDir = resolve(
      process.cwd(),
      this.configService.get<string>('attachments.localRootDir', '.attachments-storage'),
    );
    this.publicBaseUrl = this.configService.get<string>('integrations.webhookBaseUrl', '');
    this.signedUrlDefaultTtlSeconds = this.configService.get<number>(
      'attachments.signedUrlTtlSeconds',
      900,
    );
  }

  private pathFor(key: string): string {
    return join(this.rootDir, key);
  }

  private multipartDir(uploadId: string): string {
    return join(this.rootDir, '.multipart', uploadId);
  }

  async upload(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  async getReadStream(key: string): Promise<NodeJS.ReadableStream> {
    const path = this.pathFor(key);
    try {
      await stat(path);
    } catch {
      throw new InternalServerErrorException(`Attachment content missing on disk: "${key}"`);
    }
    return createReadStream(path);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async for interface parity with S3StorageProvider, which does await here.
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number = this.signedUrlDefaultTtlSeconds,
    downloadFileName?: string,
  ): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = this.urlSigner.sign(key, expiresAt);
    const query = new URLSearchParams({ key, expires: String(expiresAt), sig: signature });
    if (downloadFileName) {
      query.set('filename', downloadFileName);
    }
    return `${this.publicBaseUrl}/api/v1/attachments/raw?${query.toString()}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async for interface parity with S3StorageProvider, which does await here.
  async initiateMultipartUpload(_key: string, _contentType: string): Promise<string> {
    return randomUUID();
  }

  async uploadPart(
    _key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer,
  ): Promise<StoragePart> {
    const dir = this.multipartDir(uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, String(partNumber).padStart(10, '0')), buffer);
    return { partNumber, etag: `local-${uploadId}-${partNumber}` };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: StoragePart[],
  ): Promise<{ sizeBytes: number }> {
    const dir = this.multipartDir(uploadId);
    const destPath = this.pathFor(key);
    await mkdir(dirname(destPath), { recursive: true });

    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const destHandle = await open(destPath, 'w');
    let sizeBytes = 0;
    try {
      for (const part of sortedParts) {
        const partPath = join(dir, String(part.partNumber).padStart(10, '0'));
        const partBuffer = await readFileBuffer(partPath);
        await destHandle.write(partBuffer);
        sizeBytes += partBuffer.length;
      }
    } finally {
      await destHandle.close();
    }

    await rm(dir, { recursive: true, force: true }).catch((error: unknown) => {
      this.logger.warn(
        `Failed to clean up multipart scratch dir for upload ${uploadId}: ${String(error)}`,
      );
    });

    return { sizeBytes };
  }

  async abortMultipartUpload(_key: string, uploadId: string): Promise<void> {
    await rm(this.multipartDir(uploadId), { recursive: true, force: true });
  }
}

async function readFileBuffer(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(size);
    await handle.read(buffer, 0, size, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}
