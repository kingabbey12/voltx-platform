import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-signs time-limited download tokens for the local storage provider,
 * so a browser can GET a file directly (e.g. an <img src>) without an
 * Authorization header, the same way an S3 presigned URL works. Reuses
 * INTEGRATIONS_ENCRYPTION_KEY rather than requiring a second secret —
 * this service only signs opaque tokens, it never encrypts/decrypts
 * attachment content itself.
 */
@Injectable()
export class AttachmentUrlSignerService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('integrations.encryptionKey', '');
    this.key = createHash('sha256')
      .update(secret || 'insecure-development-key')
      .digest();
  }

  sign(storageKey: string, expiresAtEpochSeconds: number): string {
    return createHmac('sha256', this.key)
      .update(`${storageKey}:${expiresAtEpochSeconds}`)
      .digest('hex');
  }

  verify(storageKey: string, expiresAtEpochSeconds: number, signature: string): boolean {
    if (Math.floor(Date.now() / 1000) > expiresAtEpochSeconds) {
      return false;
    }

    const expected = Buffer.from(this.sign(storageKey, expiresAtEpochSeconds), 'hex');
    const provided = Buffer.from(signature, 'hex');
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }
}
