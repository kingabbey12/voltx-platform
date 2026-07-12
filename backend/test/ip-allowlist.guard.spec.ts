import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import { IpAllowlistGuard } from '../src/modules/security/guards/ip-allowlist.guard';

function makeContext(currentUser: unknown, ip: string | undefined): ExecutionContext {
  const request = { currentUser, ip };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('IpAllowlistGuard', () => {
  let guard: IpAllowlistGuard;
  let prisma: { system: { organization: { findUnique: jest.Mock } } };

  beforeEach(() => {
    prisma = { system: { organization: { findUnique: jest.fn() } } };
    guard = new IpAllowlistGuard(prisma as unknown as PrismaService);
  });

  it('rejects when no authentication principal is present', async () => {
    const context = makeContext(undefined, '203.0.113.7');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows the request when the organization has no allowlist configured', async () => {
    prisma.system.organization.findUnique.mockResolvedValue({ settings: {} });
    const context = makeContext({ organizationId: 'org-1' }, '203.0.113.7');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows a request whose IP is on the allowlist', async () => {
    prisma.system.organization.findUnique.mockResolvedValue({
      settings: { security: { ipAllowlist: ['10.0.0.0/8'] } },
    });
    const context = makeContext({ organizationId: 'org-1' }, '10.1.2.3');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a request whose IP is not on the allowlist', async () => {
    prisma.system.organization.findUnique.mockResolvedValue({
      settings: { security: { ipAllowlist: ['10.0.0.0/8'] } },
    });
    const context = makeContext({ organizationId: 'org-1' }, '203.0.113.7');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when request.ip is missing but an allowlist is configured', async () => {
    prisma.system.organization.findUnique.mockResolvedValue({
      settings: { security: { ipAllowlist: ['10.0.0.0/8'] } },
    });
    const context = makeContext({ organizationId: 'org-1' }, undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is not spoofable via a forged X-Forwarded-For — it only ever reads request.ip', async () => {
    // request.ip is what configure-app.ts's `trust proxy` setting produces;
    // this guard never reads X-Forwarded-For itself. Simulate an attacker's
    // IP being correctly resolved as the untrusted socket address despite a
    // forged header (which Express would have already ignored upstream).
    prisma.system.organization.findUnique.mockResolvedValue({
      settings: { security: { ipAllowlist: ['203.0.113.7'] } },
    });
    const context = makeContext({ organizationId: 'org-1' }, '198.51.100.99');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
