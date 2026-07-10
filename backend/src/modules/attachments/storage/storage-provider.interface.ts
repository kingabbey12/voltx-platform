export interface StoragePart {
  partNumber: number;
  etag: string;
}

/**
 * Backend-agnostic file storage — one implementation per backend (local
 * filesystem for dev, S3-compatible for prod), selected via DI in
 * storage.module.ts so nothing outside this directory ever imports an
 * AWS SDK type or touches a filesystem path directly. Multipart methods
 * exist for large uploads; small uploads go through `upload()` directly.
 */
export interface StorageProvider {
  readonly name: 'local' | 's3';

  upload(key: string, buffer: Buffer, contentType: string): Promise<void>;

  getReadStream(key: string): Promise<NodeJS.ReadableStream>;

  /** Returns a URL a client can GET directly (no Authorization header) until it expires. */
  getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
    downloadFileName?: string,
  ): Promise<string>;

  delete(key: string): Promise<void>;

  initiateMultipartUpload(key: string, contentType: string): Promise<string>;

  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer,
  ): Promise<StoragePart>;

  completeMultipartUpload(key: string, uploadId: string, parts: StoragePart[]): Promise<void>;

  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
