import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * AES-256-GCM at-rest encryption for OAuth tokens, API keys, and webhook
 * secrets — nothing reusable existed in the codebase for this (only
 * one-way password/token hashing under auth/). The key is derived via
 * SHA-256 from INTEGRATIONS_ENCRYPTION_KEY so operators can supply any
 * passphrase length rather than needing an exact 32-byte hex/base64
 * value. Ciphertext is stored as `${ivHex}:${authTagHex}:${cipherHex}` —
 * self-describing so decrypt never needs a separate IV column.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const secret = this.configService.get<string>('integrations.encryptionKey', '');
    if (!secret) {
      this.logger.warn(
        'INTEGRATIONS_ENCRYPTION_KEY is not set — integration credentials cannot be encrypted. Set this before connecting any integration in production.',
      );
    }
    this.key = createHash('sha256')
      .update(secret || 'insecure-development-key')
      .digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Malformed encrypted payload');
    }
    const [ivHex, authTagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
      throw new InternalServerErrorException('Malformed encrypted payload');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  encryptJson(value: Record<string, unknown>): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T = Record<string, unknown>>(ciphertext: string): T {
    return JSON.parse(this.decrypt(ciphertext)) as T;
  }

  /** Constant-time comparison for webhook signature verification — never use `===` on attacker-supplied signatures. */
  static safeEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) {
      return false;
    }
    return timingSafeEqual(bufferA, bufferB);
  }
}
