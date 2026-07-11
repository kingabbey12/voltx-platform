import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
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
const MIN_KEY_LENGTH = 16;

/**
 * AES-256-GCM at-rest encryption for OAuth tokens, API keys, and webhook
 * secrets — nothing reusable existed in the codebase for this (only
 * one-way password/token hashing under auth/). The key is derived via
 * SHA-256 from INTEGRATIONS_ENCRYPTION_KEY so operators can supply any
 * passphrase length rather than needing an exact 32-byte hex/base64
 * value. Ciphertext is stored as `${ivHex}:${authTagHex}:${cipherHex}` —
 * self-describing so decrypt never needs a separate IV column.
 *
 * There is deliberately no insecure fallback key: a missing or too-short
 * INTEGRATIONS_ENCRYPTION_KEY fails application boot rather than silently
 * encrypting every OAuth credential with a value anyone reading this
 * source file would know.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private key!: Buffer;
  private previousKey: Buffer | undefined;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const secret = this.configService.get<string>('integrations.encryptionKey', '');
    if (!secret || secret.length < MIN_KEY_LENGTH) {
      throw new Error(
        `INTEGRATIONS_ENCRYPTION_KEY must be set to a value at least ${MIN_KEY_LENGTH} characters long — it encrypts every stored OAuth token, API key, and webhook secret at rest. Refusing to start without it.`,
      );
    }
    this.key = deriveKey(secret);

    const previousSecret = this.configService.get<string>('integrations.encryptionKeyPrevious', '');
    this.previousKey = previousSecret ? deriveKey(previousSecret) : undefined;
  }

  encrypt(plaintext: string): string {
    return encryptWithKey(this.key, plaintext);
  }

  /**
   * Tries the current key first; if decryption fails (e.g. the auth tag
   * doesn't match) and INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS is configured,
   * retries with that key before giving up — lets already-encrypted rows
   * keep working uninterrupted while a key rotation is in progress (see
   * docs/operations/key-rotation.md and the reencrypt-secrets script,
   * which re-encrypts everything under the new key so the previous key
   * can eventually be removed).
   */
  decrypt(ciphertext: string): string {
    try {
      return decryptWithKey(this.key, ciphertext);
    } catch (error) {
      if (this.previousKey) {
        return decryptWithKey(this.previousKey, ciphertext);
      }
      throw error;
    }
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

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptWithKey(key: Buffer, ciphertext: string): string {
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

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
