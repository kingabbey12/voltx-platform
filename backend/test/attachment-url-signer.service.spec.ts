import { AttachmentUrlSignerService } from '../src/modules/attachments/storage/attachment-url-signer.service';

function buildService(key = 'test-encryption-key-0123456789'): AttachmentUrlSignerService {
  const configService = { get: jest.fn().mockReturnValue(key) };
  return new AttachmentUrlSignerService(configService as never);
}

describe('AttachmentUrlSignerService', () => {
  it('verifies a signature it just produced for the same key/expiry', () => {
    const service = buildService();
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    const signature = service.sign('org-1/file.png', expiresAt);
    expect(service.verify('org-1/file.png', expiresAt, signature)).toBe(true);
  });

  it('rejects a signature once its expiry has passed', () => {
    const service = buildService();
    const expiresAt = Math.floor(Date.now() / 1000) - 10;
    const signature = service.sign('org-1/file.png', expiresAt);
    expect(service.verify('org-1/file.png', expiresAt, signature)).toBe(false);
  });

  it('rejects a signature for a different storage key (tamper detection)', () => {
    const service = buildService();
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    const signature = service.sign('org-1/file.png', expiresAt);
    expect(service.verify('org-1/other-file.png', expiresAt, signature)).toBe(false);
  });

  it('rejects a signature produced with a different secret', () => {
    const serviceA = buildService('key-one-0123456789');
    const serviceB = buildService('key-two-9876543210');
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    const signature = serviceA.sign('org-1/file.png', expiresAt);
    expect(serviceB.verify('org-1/file.png', expiresAt, signature)).toBe(false);
  });

  it('rejects a malformed/garbage signature rather than throwing', () => {
    const service = buildService();
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    expect(service.verify('org-1/file.png', expiresAt, 'not-a-real-signature')).toBe(false);
  });
});
