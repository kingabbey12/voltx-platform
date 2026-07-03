import { Test, TestingModule } from '@nestjs/testing';
import { AuthContextRepository } from '../src/modules/auth/auth-context.repository';
import { AuthContextService } from '../src/modules/auth/auth-context.service';

describe('AuthContextService', () => {
  let service: AuthContextService;
  let repository: jest.Mocked<AuthContextRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthContextService,
        {
          provide: AuthContextRepository,
          useValue: {
            findActiveMembershipContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthContextService);
    repository = module.get(AuthContextRepository);
  });

  it('resolves current user from active membership', async () => {
    repository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleName: 'admin',
    });

    const result = await service.resolveCurrentUser('user-id', 'org-id');

    expect(result).toEqual({
      id: 'user-id',
      organizationId: 'org-id',
      membershipId: 'membership-id',
      roles: ['admin'],
      permissions: ['users:read', 'users:write', 'organizations:read', 'organizations:write'],
    });
  });

  it('returns null when membership is not found', async () => {
    repository.findActiveMembershipContext.mockResolvedValue(null);

    const result = await service.resolveCurrentUser('user-id');

    expect(result).toBeNull();
  });
});
