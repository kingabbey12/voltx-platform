import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { StoragePart, StorageProvider } from './storage-provider.interface';

/**
 * Works against any S3-compatible endpoint: real AWS S3 (leave `endpoint`
 * unset), Cloudflare R2, Supabase Storage, or self-hosted MinIO (set
 * `endpoint` + `forcePathStyle: true` for the latter three) — they all
 * implement the same S3 API, so one client configuration covers all of
 * them. Selected via ATTACHMENTS_STORAGE_PROVIDER=s3.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly signedUrlDefaultTtlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('attachments.s3.bucket', '');
    this.signedUrlDefaultTtlSeconds = this.configService.get<number>(
      'attachments.signedUrlTtlSeconds',
      900,
    );

    this.client = new S3Client({
      region: this.configService.get<string>('attachments.s3.region', 'auto'),
      endpoint: this.configService.get<string | undefined>('attachments.s3.endpoint', undefined),
      forcePathStyle: this.configService.get<boolean>('attachments.s3.forcePathStyle', false),
      credentials: {
        accessKeyId: this.configService.get<string>('attachments.s3.accessKeyId', ''),
        secretAccessKey: this.configService.get<string>('attachments.s3.secretAccessKey', ''),
      },
    });
  }

  private assertConfigured(): void {
    if (!this.bucket) {
      throw new InternalServerErrorException(
        'ATTACHMENTS_S3_BUCKET is not set — S3 storage provider is not configured',
      );
    }
  }

  /**
   * Called only by StorageModule's production boot check — confirms the
   * bucket actually exists and the configured credentials can reach it
   * (HeadBucket fails on both a missing bucket and insufficient
   * permissions), rather than deferring that discovery to the first real
   * upload in production.
   */
  async verifyProductionReadiness(): Promise<void> {
    this.assertConfigured();
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot reach S3 bucket "${this.bucket}" — check ATTACHMENTS_S3_BUCKET/REGION/ENDPOINT and credentials. Underlying error: ${message}`,
      );
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async getReadStream(key: string): Promise<NodeJS.ReadableStream> {
    this.assertConfigured();
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) {
      throw new InternalServerErrorException(`Attachment content missing in storage: "${key}"`);
    }
    return result.Body as Readable;
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number = this.signedUrlDefaultTtlSeconds,
    downloadFileName?: string,
  ): Promise<string> {
    this.assertConfigured();
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(downloadFileName
          ? { ResponseContentDisposition: `attachment; filename="${downloadFileName}"` }
          : {}),
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    this.assertConfigured();
    const result = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    );
    if (!result.UploadId) {
      throw new InternalServerErrorException('S3 did not return an UploadId for multipart upload');
    }
    return result.UploadId;
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer,
  ): Promise<StoragePart> {
    this.assertConfigured();
    const result = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      }),
    );
    if (!result.ETag) {
      throw new InternalServerErrorException(`S3 did not return an ETag for part ${partNumber}`);
    }
    return { partNumber, etag: result.ETag };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: StoragePart[],
  ): Promise<{ sizeBytes: number }> {
    this.assertConfigured();
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
    // CompleteMultipartUploadCommand's response has no ContentLength — ask
    // S3 directly for the real, assembled object size rather than trusting
    // anything the client claimed.
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return { sizeBytes: head.ContentLength ?? 0 };
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
    );
  }
}
