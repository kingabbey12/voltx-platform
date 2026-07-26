import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class AttachmentUrlSignerService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.getOrThrow<string>('integrations.encryptionKey');
    this.key = createHash('sha256').update(secret).digest();
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
