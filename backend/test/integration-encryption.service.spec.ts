import { InternalServerErrorException } from '@nestjs/common';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';

function buildService(key = 'test-encryption-key-0123456789'): EncryptionService {
  const configService = { get: jest.fn().mockReturnValue(key) };
  const service = new EncryptionService(configService as never);
  service.onModuleInit();
  return service;
}

describe('EncryptionService', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const service = buildService();
    const ciphertext = service.encrypt('super-secret-token');
    expect(ciphertext).not.toContain('super-secret-token');
    expect(service.decrypt(ciphertext)).toBe('super-secret-token');
  });

  it('round-trips JSON payloads', () => {
    const service = buildService();
    const payload = {
      accessToken: 'abc',
      refreshToken: 'def',
      expiresAt: '2026-01-01T00:00:00.000Z',
    };
    const ciphertext = service.encryptJson(payload);
    expect(service.decryptJson(ciphertext)).toEqual(payload);
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const service = buildService();
    const a = service.encrypt('same-value');
    const b = service.encrypt('same-value');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same-value');
    expect(service.decrypt(b)).toBe('same-value');
  });

  it('fails to decrypt with a different key (wrong-key tamper detection)', () => {
    const serviceA = buildService('key-one-0123456789');
    const serviceB = buildService('key-two-9876543210');
    const ciphertext = serviceA.encrypt('secret');
    expect(() => serviceB.decrypt(ciphertext)).toThrow();
  });

  it('rejects a malformed ciphertext payload', () => {
    const service = buildService();
    expect(() => service.decrypt('not-a-valid-payload')).toThrow(InternalServerErrorException);
  });

  it('rejects a tampered ciphertext (auth tag mismatch)', () => {
    const service = buildService();
    const ciphertext = service.encrypt('secret-value');
    const [iv, authTag, data] = ciphertext.split(':');
    const tamperedData = data.slice(0, -2) + (data.slice(-2) === '00' ? '01' : '00');
    expect(() => service.decrypt(`${iv}:${authTag}:${tamperedData}`)).toThrow();
  });

  describe('safeEqual', () => {
    it('returns true for identical strings', () => {
      expect(EncryptionService.safeEqual('abc123', 'abc123')).toBe(true);
    });

    it('returns false for different strings of the same length', () => {
      expect(EncryptionService.safeEqual('abc123', 'abc124')).toBe(false);
    });

    it('returns false for strings of different lengths', () => {
      expect(EncryptionService.safeEqual('short', 'a-much-longer-string')).toBe(false);
    });
  });
});
