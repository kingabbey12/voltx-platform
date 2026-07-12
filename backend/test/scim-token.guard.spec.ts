import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ScimTokenStatus } from '@prisma/client';
import { ScimTokenGuard } from '../src/modules/scim/guards/scim-token.guard';
import { ScimTokenRepository } from '../src/modules/scim/scim-token.repository';
import { ScimAuthenticatedRequest } from '../src/modules/scim/interfaces/scim-request.interface';

function makeContext(authorizationHeader: string | undefined): {
  context: ExecutionContext;
  request: ScimAuthenticatedRequest;
} {
  const request = {
    headers: { authorization: authorizationHeader },
  } as unknown as ScimAuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ScimTokenGuard', () => {
  let guard: ScimTokenGuard;
  let repository: jest.Mocked<ScimTokenRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScimTokenGuard,
        {
          provide: ScimTokenRepository,
          useValue: { findActiveByTokenHash: jest.fn(), touchLastUsed: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get(ScimTokenGuard);
    repository = module.get(ScimTokenRepository);
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = makeContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a request whose bearer token does not match any active SCIM token', async () => {
    repository.findActiveByTokenHash.mockResolvedValue(null);
    const { context } = makeContext('Bearer not-a-real-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired SCIM token even if its status is still ACTIVE', async () => {
    repository.findActiveByTokenHash.mockResolvedValue({
      id: 'scim-token-1',
      organizationId: 'org-1',
      identityProviderId: null,
      name: 'Test token',
      tokenHash: 'hash',
      status: ScimTokenStatus.ACTIVE,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { context } = makeContext('Bearer some-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches organizationId/scimTokenId to the request and touches lastUsedAt on success', async () => {
    repository.findActiveByTokenHash.mockResolvedValue({
      id: 'scim-token-1',
      organizationId: 'org-1',
      identityProviderId: null,
      name: 'Test token',
      tokenHash: 'hash',
      status: ScimTokenStatus.ACTIVE,
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { context, request } = makeContext('Bearer some-token');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.scimContext).toEqual({ organizationId: 'org-1', scimTokenId: 'scim-token-1' });
    expect(repository.touchLastUsed).toHaveBeenCalledWith('scim-token-1');
  });
});
