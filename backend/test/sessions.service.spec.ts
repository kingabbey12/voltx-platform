import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { SessionRepository } from '../src/modules/auth/session.repository';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import { SessionsService } from '../src/modules/security/sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: SessionRepository,
          useValue: {
            listActiveForUserInOrganization: jest.fn(),
            listAllForUserInOrganizationPaginated: jest.fn(),
            findByIdForUserInOrganization: jest.fn(),
            revoke: jest.fn(),
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: MetricsService, useValue: { recordSessionRevocation: jest.fn() } },
      ],
    }).compile();

    service = module.get(SessionsService);
    sessionRepository = module.get(SessionRepository);
    auditService = module.get(AuditService);
  });

  it('lists only active sessions, scoped to the user + organization', async () => {
    sessionRepository.listActiveForUserInOrganization.mockResolvedValue([
      {
        id: 'session-1',
        userId: 'user-1',
        organizationId: 'org-1',
        deviceFingerprint: null,
        ipAddress: '203.0.113.7',
        userAgent: 'jest',
        lastActiveAt: new Date('2026-07-01T00:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.listActive('user-1', 'org-1');

    expect(sessionRepository.listActiveForUserInOrganization).toHaveBeenCalledWith(
      'user-1',
      'org-1',
    );
    expect(result).toEqual([
      {
        id: 'session-1',
        deviceFingerprint: null,
        ipAddress: '203.0.113.7',
        userAgent: 'jest',
        lastActiveAt: '2026-07-01T00:00:00.000Z',
        createdAt: '2026-07-01T00:00:00.000Z',
        revokedAt: null,
      },
    ]);
  });

  it('throws NotFoundException revoking a session that does not belong to the caller', async () => {
    sessionRepository.findByIdForUserInOrganization.mockResolvedValue(null);
    await expect(service.revoke('session-1', 'user-1', 'org-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sessionRepository.revoke).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException revoking an already-revoked session', async () => {
    sessionRepository.findByIdForUserInOrganization.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      organizationId: 'org-1',
      deviceFingerprint: null,
      ipAddress: null,
      userAgent: null,
      lastActiveAt: new Date(),
      revokedAt: new Date(),
      createdAt: new Date(),
    });
    await expect(service.revoke('session-1', 'user-1', 'org-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('revokes an active session owned by the caller and audits it', async () => {
    sessionRepository.findByIdForUserInOrganization.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      organizationId: 'org-1',
      deviceFingerprint: null,
      ipAddress: null,
      userAgent: null,
      lastActiveAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
    });

    await service.revoke('session-1', 'user-1', 'org-1');

    expect(sessionRepository.revoke).toHaveBeenCalledWith('session-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'session.revoked', resourceId: 'session-1' }),
    );
  });
});
