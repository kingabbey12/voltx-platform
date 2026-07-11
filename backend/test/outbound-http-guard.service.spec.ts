import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import {
  isBlockedIp,
  OutboundHttpGuardService,
} from '../src/modules/ai/tools/outbound-http-guard.service';
import { ToolExecutionError } from '../src/modules/ai/tools/tool.interface';

describe('isBlockedIp', () => {
  it('blocks loopback addresses', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
  });

  it('blocks the cloud metadata address', () => {
    expect(isBlockedIp('169.254.169.254')).toBe(true);
  });

  it('blocks RFC1918 private ranges', () => {
    expect(isBlockedIp('10.0.0.5')).toBe(true);
    expect(isBlockedIp('172.16.0.5')).toBe(true);
    expect(isBlockedIp('172.31.255.255')).toBe(true);
    expect(isBlockedIp('192.168.1.1')).toBe(true);
  });

  it('does not block adjacent-but-public ranges', () => {
    expect(isBlockedIp('172.32.0.1')).toBe(false);
    expect(isBlockedIp('172.15.0.1')).toBe(false);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
  });

  it('blocks carrier-grade NAT and unique-local IPv6', () => {
    expect(isBlockedIp('100.64.0.1')).toBe(true);
    expect(isBlockedIp('fc00::1')).toBe(true);
    expect(isBlockedIp('fd12:3456::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 metadata address', () => {
    expect(isBlockedIp('::ffff:169.254.169.254')).toBe(true);
  });

  it('allows a public IPv6 address', () => {
    expect(isBlockedIp('2001:4860:4860::8888')).toBe(false);
  });
});

describe('OutboundHttpGuardService', () => {
  let service: OutboundHttpGuardService;
  let auditService: jest.Mocked<AuditService>;
  const originalFetch = global.fetch;

  async function build(allowedHosts: string[] = []): Promise<void> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboundHttpGuardService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(allowedHosts) },
        },
        {
          provide: TenantContextService,
          useValue: {
            isComplete: jest.fn().mockReturnValue(true),
            getOrThrow: jest.fn().mockReturnValue({ organizationId: 'org-1' }),
          },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(OutboundHttpGuardService);
    auditService = module.get(AuditService);
  }

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('blocks a request to the cloud metadata address before any fetch happens', async () => {
    await build();
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as typeof fetch;

    await expect(
      service.fetch('http://169.254.169.254/latest/meta-data/', 'http_get', { method: 'GET' }),
    ).rejects.toBeInstanceOf(ToolExecutionError);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ai.tool.outbound_http' }),
    );
    const [recordedCall] = auditService.record.mock.calls[0];
    expect(recordedCall.metadata).toMatchObject({ outcome: 'blocked' });
  });

  it('blocks a request to a hostname that resolves to a private IP', async () => {
    await build();
    // "localhost" reliably resolves to a loopback address in every test env.
    await expect(
      service.fetch('http://localhost:1/', 'http_get', { method: 'GET' }),
    ).rejects.toBeInstanceOf(ToolExecutionError);
  });

  it('allows a public host and logs the allowed attempt', async () => {
    await build();
    const response = new Response('{}', { status: 200 });
    global.fetch = jest.fn().mockResolvedValue(response);

    const result = await service.fetch('https://example.com/api', 'http_get', { method: 'GET' });

    expect(result.status).toBe(200);
    const [recordedCall] = auditService.record.mock.calls[0];
    expect(recordedCall.metadata).toMatchObject({ outcome: 'allowed' });
  });

  it('rejects a host outside a configured allowlist even if publicly routable', async () => {
    await build(['api.trusted.com']);
    global.fetch = jest.fn();

    await expect(
      service.fetch('https://example.com/api', 'http_get', { method: 'GET' }),
    ).rejects.toBeInstanceOf(ToolExecutionError);
  });

  it('re-validates each redirect hop and blocks a redirect into a private address', async () => {
    await build();
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    });
    global.fetch = jest.fn().mockResolvedValue(redirectResponse);

    await expect(
      service.fetch('https://example.com/redirect', 'http_get', { method: 'GET' }),
    ).rejects.toBeInstanceOf(ToolExecutionError);
  });

  it('follows up to the redirect limit then throws', async () => {
    await build();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://example.com/next' } }),
      );
    global.fetch = fetchMock;

    await expect(
      service.fetch('https://example.com/start', 'http_get', { method: 'GET' }),
    ).rejects.toBeInstanceOf(ToolExecutionError);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});
