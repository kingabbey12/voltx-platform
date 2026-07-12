import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { STORAGE_PROVIDER } from '../src/modules/attachments/storage/storage-provider.interface';
import { GdprService } from '../src/modules/compliance/gdpr/gdpr.service';
import { LegalHoldRepository } from '../src/modules/compliance/legal-hold/legal-hold.repository';
import { PiiRegistryService } from '../src/modules/compliance/pii/pii-registry.service';

describe('GdprService', () => {
  let service: GdprService;
  let prisma: {
    system: {
      user: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
      refreshToken: { count: jest.Mock; deleteMany: jest.Mock };
      verificationToken: { deleteMany: jest.Mock };
      membership: { findFirst: jest.Mock; count: jest.Mock };
    };
  };
  let legalHoldRepository: jest.Mocked<LegalHoldRepository>;
  let piiRegistryService: jest.Mocked<PiiRegistryService>;
  let auditService: jest.Mocked<AuditService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let storageProvider: { upload: jest.Mock; getSignedDownloadUrl: jest.Mock };

  beforeEach(async () => {
    prisma = {
      system: {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'target-user',
            email: 'target@example.com',
            firstName: 'Target',
            lastName: 'User',
            phoneNumber: null,
            jobTitle: null,
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        refreshToken: {
          count: jest.fn().mockResolvedValue(0),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        verificationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        membership: {
          findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }),
          count: jest.fn().mockResolvedValue(0),
        },
      },
    };

    legalHoldRepository = {
      findActiveForUser: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<LegalHoldRepository>;

    piiRegistryService = {
      exportForUser: jest.fn().mockResolvedValue([]),
      eraseForUser: jest
        .fn()
        .mockResolvedValue([
          { model: 'conversation', label: 'AI conversations', action: 'DELETE', affected: 2 },
        ]),
    };

    auditService = {
      record: jest.fn(),
      recordWithExplicitActor: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    tenantContextService = {
      getOrThrow: jest.fn().mockReturnValue({
        organizationId: 'org-1',
        userId: 'admin-user',
        membershipId: 'admin-membership',
        requestId: 'req-1',
      }),
      get: jest.fn(),
    } as unknown as jest.Mocked<TenantContextService>;

    storageProvider = {
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/signed-url'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantContextService, useValue: tenantContextService },
        { provide: PiiRegistryService, useValue: piiRegistryService },
        { provide: LegalHoldRepository, useValue: legalHoldRepository },
        { provide: AuditService, useValue: auditService },
        { provide: STORAGE_PROVIDER, useValue: storageProvider },
      ],
    }).compile();

    service = module.get(GdprService);
  });

  describe('deleteUserData', () => {
    it('throws NotFoundException if the target user is not a member of the calling organization', async () => {
      prisma.system.membership.findFirst.mockResolvedValue(null);
      await expect(service.deleteUserData('target-user')).rejects.toThrow(NotFoundException);
      expect(piiRegistryService.eraseForUser).not.toHaveBeenCalled();
    });

    it('blocks erasure when an active legal hold targets this user', async () => {
      legalHoldRepository.findActiveForUser.mockResolvedValue({
        id: 'hold-1',
        name: 'Litigation Matter #123',
        status: 'ACTIVE',
      } as never);

      await expect(service.deleteUserData('target-user')).rejects.toThrow(ConflictException);
      expect(piiRegistryService.eraseForUser).not.toHaveBeenCalled();
    });

    it('erases org-scoped PII via the registry when no legal hold blocks it', async () => {
      const result = await service.deleteUserData('target-user');

      expect(piiRegistryService.eraseForUser).toHaveBeenCalledWith(
        prisma.system,
        'org-1',
        'target-user',
      );
      expect(result.results).toHaveLength(1);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'compliance.gdpr.delete', resourceId: 'target-user' }),
      );
    });

    it('does NOT scrub the global User identity when the user still has active memberships elsewhere', async () => {
      prisma.system.membership.count.mockResolvedValue(2); // active elsewhere

      const result = await service.deleteUserData('target-user');

      expect(result.globalIdentityScrubbed).toBe(false);
      expect(prisma.system.user.update).not.toHaveBeenCalled();
      expect(prisma.system.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it("scrubs the global User identity and kills all sessions when this was the user's last active membership", async () => {
      prisma.system.membership.count.mockResolvedValue(0);

      const result = await service.deleteUserData('target-user');

      expect(result.globalIdentityScrubbed).toBe(true);
      const updateMock = prisma.system.user.update as jest.Mock<
        unknown,
        [{ where: { id: string }; data: Record<string, unknown> }]
      >;
      const [updateCallArgs] = updateMock.mock.calls[0];
      expect(updateCallArgs.where).toEqual({ id: 'target-user' });
      expect(updateCallArgs.data).toEqual(
        expect.objectContaining({
          firstName: 'Redacted',
          passwordHash: null,
          status: 'INACTIVE',
        }),
      );
      expect(prisma.system.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'target-user' },
      });
      expect(prisma.system.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'target-user' },
      });
    });
  });

  describe('exportUserData', () => {
    it('uploads a JSON payload via the storage provider and returns a signed download URL', async () => {
      const result = await service.exportUserData('target-user');

      expect(storageProvider.upload).toHaveBeenCalledWith(
        expect.stringContaining('compliance/gdpr-exports/org-1/target-user'),
        expect.any(Buffer),
        'application/json',
      );
      expect(result.downloadUrl).toBe('https://storage.example.com/signed-url');
      expect(result.excludedFromErasure.length).toBeGreaterThan(0);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'compliance.gdpr.export' }),
      );
    });

    it('throws NotFoundException if the target user is not a member of the calling organization', async () => {
      prisma.system.membership.findFirst.mockResolvedValue(null);
      await expect(service.exportUserData('target-user')).rejects.toThrow(NotFoundException);
    });
  });
});
