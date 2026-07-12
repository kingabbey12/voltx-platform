import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus, SupportSessionStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SupportSessionRepository } from '../src/modules/auth/support-session.repository';
import { RoleRepository } from '../src/modules/roles/role.repository';
import { SupportSessionService } from '../src/modules/platform/support-sessions/support-session.service';

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'session-1',
    platformAdminUserId: 'admin-1',
    targetOrganizationId: 'org-1',
    reason: 'Investigating a billing complaint',
    status: SupportSessionStatus.ACTIVE,
    supportMembershipId: 'membership-jit-1',
    expiresAt: new Date(Date.now() + 60_000),
    endedAt: null,
    endedById: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('SupportSessionService', () => {
  let service: SupportSessionService;
  let supportSessionRepository: jest.Mocked<SupportSessionRepository>;
  let authService: jest.Mocked<AuthService>;
  let roleRepository: jest.Mocked<RoleRepository>;
  let auditService: jest.Mocked<AuditService>;
  let prisma: {
    system: {
      organization: { findFirst: jest.Mock };
      membership: { findFirst: jest.Mock; create: jest.Mock; delete: jest.Mock };
    };
  };

  beforeEach(async () => {
    prisma = {
      system: {
        organization: { findFirst: jest.fn() },
        membership: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportSessionService,
        {
          provide: SupportSessionRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findActiveForAdminInOrganization: jest.fn(),
            list: jest.fn(),
            end: jest.fn(),
            markExpired: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { issueImpersonationAccessToken: jest.fn() },
        },
        {
          provide: RoleRepository,
          useValue: { findByKeyOrThrow: jest.fn().mockResolvedValue({ id: 'role-admin' }) },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { recordWithExplicitActor: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, fallback: unknown) => fallback) },
        },
      ],
    }).compile();

    service = module.get(SupportSessionService);
    supportSessionRepository = module.get(SupportSessionRepository);
    authService = module.get(AuthService);
    roleRepository = module.get(RoleRepository);
    auditService = module.get(AuditService);
  });

  describe('start', () => {
    it('throws NotFoundException for an unknown target organization', async () => {
      prisma.system.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.start('admin-1', { targetOrganizationId: 'org-1', reason: 'Investigating' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects starting a second active session for the same admin/org pair', async () => {
      prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      supportSessionRepository.findActiveForAdminInOrganization.mockResolvedValue(makeSession());

      await expect(
        service.start('admin-1', { targetOrganizationId: 'org-1', reason: 'Investigating again' }),
      ).rejects.toThrow(ConflictException);
    });

    it('JIT-creates an admin-role membership when the platform admin has none in the target org', async () => {
      prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      supportSessionRepository.findActiveForAdminInOrganization.mockResolvedValue(null);
      prisma.system.membership.findFirst.mockResolvedValue(null);
      prisma.system.membership.create.mockResolvedValue({ id: 'membership-jit-1' });
      supportSessionRepository.create.mockResolvedValue(makeSession());
      authService.issueImpersonationAccessToken.mockResolvedValue({
        accessToken: 'token-abc',
        tokenType: 'Bearer',
        expiresIn: 2700,
      });

      const result = await service.start('admin-1', {
        targetOrganizationId: 'org-1',
        reason: 'Investigating a billing complaint',
      });

      expect(roleRepository.findByKeyOrThrow).toHaveBeenCalledWith('admin');
      expect(prisma.system.membership.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          organizationId: 'org-1',
          roleId: 'role-admin',
          status: MembershipStatus.ACTIVE,
        },
      });
      expect(supportSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ supportMembershipId: 'membership-jit-1' }),
      );
      expect(result.accessToken).toBe('token-abc');
      expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'support_session.started',
          organizationId: 'org-1',
          userId: 'admin-1',
        }),
      );
    });

    it('reuses a pre-existing active membership instead of creating a new one', async () => {
      prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      supportSessionRepository.findActiveForAdminInOrganization.mockResolvedValue(null);
      prisma.system.membership.findFirst.mockResolvedValue({
        id: 'membership-real',
        status: MembershipStatus.ACTIVE,
      });
      supportSessionRepository.create.mockResolvedValue(makeSession({ supportMembershipId: null }));
      authService.issueImpersonationAccessToken.mockResolvedValue({
        accessToken: 'token-abc',
        tokenType: 'Bearer',
        expiresIn: 2700,
      });

      await service.start('admin-1', { targetOrganizationId: 'org-1', reason: 'Investigating' });

      expect(prisma.system.membership.create).not.toHaveBeenCalled();
      expect(supportSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ supportMembershipId: null }),
      );
    });

    it('rejects starting a session when the admin has a non-active pre-existing membership', async () => {
      prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      supportSessionRepository.findActiveForAdminInOrganization.mockResolvedValue(null);
      prisma.system.membership.findFirst.mockResolvedValue({
        id: 'membership-real',
        status: MembershipStatus.INACTIVE,
      });

      await expect(
        service.start('admin-1', { targetOrganizationId: 'org-1', reason: 'Investigating' }),
      ).rejects.toThrow(ConflictException);
      expect(supportSessionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('end', () => {
    it('deletes the JIT membership it created and marks the session ENDED', async () => {
      supportSessionRepository.findById.mockResolvedValue(makeSession());
      supportSessionRepository.end.mockResolvedValue(
        makeSession({ status: SupportSessionStatus.ENDED, endedById: 'admin-1' }),
      );
      prisma.system.membership.delete.mockResolvedValue({});

      const result = await service.end('session-1', 'admin-1');

      expect(prisma.system.membership.delete).toHaveBeenCalledWith({
        where: { id: 'membership-jit-1' },
      });
      expect(result.status).toBe(SupportSessionStatus.ENDED);
      expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'support_session.ended', userId: 'admin-1' }),
      );
    });

    it('never deletes a pre-existing membership it did not create', async () => {
      supportSessionRepository.findById.mockResolvedValue(
        makeSession({ supportMembershipId: null }),
      );
      supportSessionRepository.end.mockResolvedValue(
        makeSession({ status: SupportSessionStatus.ENDED }),
      );

      await service.end('session-1', 'admin-1');

      expect(prisma.system.membership.delete).not.toHaveBeenCalled();
    });

    it('rejects ending a session that is already ended', async () => {
      supportSessionRepository.findById.mockResolvedValue(
        makeSession({ status: SupportSessionStatus.ENDED }),
      );

      await expect(service.end('session-1', 'admin-1')).rejects.toThrow(ConflictException);
      expect(supportSessionRepository.end).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown session id', async () => {
      supportSessionRepository.findById.mockResolvedValue(null);
      await expect(service.end('not-real', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('lazy expiry', () => {
    it('flips an ACTIVE-but-past-expiry session to EXPIRED and cleans up its JIT membership on read', async () => {
      const pastExpiry = makeSession({ expiresAt: new Date(Date.now() - 1000) });
      supportSessionRepository.findById.mockResolvedValue(pastExpiry);
      supportSessionRepository.markExpired.mockResolvedValue(
        makeSession({
          status: SupportSessionStatus.EXPIRED,
          expiresAt: pastExpiry.expiresAt,
        }),
      );
      prisma.system.membership.delete.mockResolvedValue({});

      const result = await service.getOrThrow('session-1');

      expect(supportSessionRepository.markExpired).toHaveBeenCalledWith('session-1');
      expect(prisma.system.membership.delete).toHaveBeenCalledWith({
        where: { id: 'membership-jit-1' },
      });
      expect(result.status).toBe(SupportSessionStatus.EXPIRED);
    });

    it('leaves a still-unexpired ACTIVE session untouched', async () => {
      supportSessionRepository.findById.mockResolvedValue(makeSession());

      const result = await service.getOrThrow('session-1');

      expect(supportSessionRepository.markExpired).not.toHaveBeenCalled();
      expect(result.status).toBe(SupportSessionStatus.ACTIVE);
    });
  });
});
