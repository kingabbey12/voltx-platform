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

  /**
   * Cheap liveness probe for continuous health reporting — metadata only,
   * never a write, so it can run on every readiness scrape. Resolves when
   * the backend is reachable and rejects otherwise.
   *
   * This exists because storage was previously verified *only* at boot: a
   * container that started successfully kept reporting healthy for days
   * after its credentials were revoked, which is exactly the silent
   * false-health condition health checks are supposed to prevent.
   */
  checkHealth(): Promise<void>;

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

  /**
   * Returns the real, assembled object size — callers must treat this as
   * the source of truth (not whatever size the client claimed at
   * initiate time) so the max-file-size limit can't be bypassed by
   * uploading more/larger parts than originally declared.
   */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: StoragePart[],
  ): Promise<{ sizeBytes: number }>;

  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
