import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AttachmentUrlSignerService } from '../src/modules/attachments/storage/attachment-url-signer.service';
import { LocalStorageProvider } from '../src/modules/attachments/storage/local-storage.provider';

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolvePromise(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

describe('LocalStorageProvider', () => {
  let rootDir: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'attachments-test-'));
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'attachments.localRootDir') return rootDir;
        if (key === 'integrations.webhookBaseUrl') return 'http://localhost:3000';
        if (key === 'attachments.signedUrlTtlSeconds') return 900;
        return fallback;
      }),
    };
    const urlSigner = new AttachmentUrlSignerService(configService as never);
    provider = new LocalStorageProvider(configService as never, urlSigner);
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('writes and reads back the exact bytes uploaded', async () => {
    const content = Buffer.from('hello attachment storage');
    await provider.upload('org-1/file.txt', content, 'text/plain');

    const stream = await provider.getReadStream('org-1/file.txt');
    const readBack = await streamToBuffer(stream);
    expect(readBack.equals(content)).toBe(true);
  });

  it('overwrites existing content when uploading to the same key', async () => {
    await provider.upload('org-1/file.txt', Buffer.from('version one'), 'text/plain');
    await provider.upload('org-1/file.txt', Buffer.from('version two'), 'text/plain');

    const stream = await provider.getReadStream('org-1/file.txt');
    const readBack = await streamToBuffer(stream);
    expect(readBack.toString()).toBe('version two');
  });

  it('deletes a stored file', async () => {
    await provider.upload('org-1/file.txt', Buffer.from('to be deleted'), 'text/plain');
    await provider.delete('org-1/file.txt');
    await expect(provider.getReadStream('org-1/file.txt')).rejects.toThrow();
  });

  it('generates a signed URL whose signature verifies against the same key', async () => {
    await provider.upload('org-1/file.txt', Buffer.from('signed'), 'text/plain');
    const url = await provider.getSignedDownloadUrl('org-1/file.txt', 900, 'file.txt');
    expect(url).toContain('key=org-1%2Ffile.txt');
    expect(url).toContain('sig=');
    expect(url).toContain('filename=file.txt');
  });

  it('reassembles a multipart upload from its parts in order regardless of upload order', async () => {
    const uploadId = await provider.initiateMultipartUpload(
      'org-1/big-file.bin',
      'application/octet-stream',
    );
    const part2 = await provider.uploadPart(
      'org-1/big-file.bin',
      uploadId,
      2,
      Buffer.from('-SECOND'),
    );
    const part1 = await provider.uploadPart(
      'org-1/big-file.bin',
      uploadId,
      1,
      Buffer.from('FIRST'),
    );

    await provider.completeMultipartUpload('org-1/big-file.bin', uploadId, [part2, part1]);

    const stream = await provider.getReadStream('org-1/big-file.bin');
    const readBack = await streamToBuffer(stream);
    expect(readBack.toString()).toBe('FIRST-SECOND');
  });

  it('removes multipart scratch files after abort', async () => {
    const uploadId = await provider.initiateMultipartUpload(
      'org-1/aborted.bin',
      'application/octet-stream',
    );
    await provider.uploadPart('org-1/aborted.bin', uploadId, 1, Buffer.from('partial'));
    await provider.abortMultipartUpload('org-1/aborted.bin', uploadId);

    // The destination key was never completed, so it should not exist.
    await expect(provider.getReadStream('org-1/aborted.bin')).rejects.toThrow();
  });
});
