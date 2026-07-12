import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { IdentityProviderEntity } from '../src/modules/identity/entities/identity-provider.entity';
import { IdentityProviderRepository } from '../src/modules/identity/identity-provider.repository';
import { JitProvisioningService } from '../src/modules/identity/jit/jit-provisioning.service';
import { OidcEngineService } from '../src/modules/identity/oidc/oidc-engine.service';
import { SamlEngineService } from '../src/modules/identity/saml/saml-engine.service';
import { SsoService } from '../src/modules/identity/sso.service';

function makeIdp(overrides: Partial<IdentityProviderEntity> = {}): IdentityProviderEntity {
  return {
    id: 'idp-1',
    organizationId: 'org-1',
    name: 'Test IdP',
    protocol: 'OIDC',
    preset: 'GENERIC',
    status: 'ACTIVE',
    isDefault: false,
    jitProvisioningEnabled: true,
    defaultRoleKey: 'member',
    roleMappingRules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    samlConfiguration: null,
    oidcConfiguration: {
      id: 'oidc-1',
      identityProviderId: 'idp-1',
      issuer: 'https://idp.example.com',
      clientId: 'client-1',
      clientSecret: 'encrypted-secret',
      authorizationEndpoint: 'https://idp.example.com/authorize',
      tokenEndpoint: 'https://idp.example.com/token',
      userinfoEndpoint: null,
      jwksUri: null,
      scopes: ['openid', 'email'],
      claimsMapping: {},
    },
    ...overrides,
  };
}

describe('SsoService', () => {
  let service: SsoService;
  let identityProviderRepository: jest.Mocked<IdentityProviderRepository>;
  let oidcEngineService: jest.Mocked<OidcEngineService>;

  // A tiny fake signer/verifier standing in for real JWT crypto — we're
  // testing SsoService's state-binding logic (payload shape, idp-match
  // enforcement), not JwtService/jsonwebtoken itself.
  const tokenStore = new Map<string, unknown>();
  let tokenCounter = 0;

  beforeEach(async () => {
    tokenStore.clear();
    tokenCounter = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        {
          provide: IdentityProviderRepository,
          useValue: { findByIdUnscoped: jest.fn() },
        },
        { provide: SamlEngineService, useValue: { getLoginRedirectUrl: jest.fn() } },
        {
          provide: OidcEngineService,
          useValue: {
            generateNonce: jest.fn(),
            getAuthorizationRequest: jest.fn(),
            handleCallback: jest.fn(),
          },
        },
        { provide: JitProvisioningService, useValue: { provisionAndIssueTokens: jest.fn() } },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn((payload: unknown) => {
              const token = `token-${tokenCounter++}`;
              tokenStore.set(token, payload);
              return Promise.resolve(token);
            }),
            verifyAsync: jest.fn((token: string) => {
              if (!tokenStore.has(token)) {
                return Promise.reject(new Error('invalid token'));
              }
              return Promise.resolve(tokenStore.get(token));
            }),
          },
        },
      ],
    }).compile();

    service = module.get(SsoService);
    identityProviderRepository = module.get(IdentityProviderRepository);
    oidcEngineService = module.get(OidcEngineService);
  });

  it('rejects an OIDC callback whose state token was minted for a different identity provider', async () => {
    const idpA = makeIdp({ id: 'idp-a' });
    const idpB = makeIdp({ id: 'idp-b' });

    identityProviderRepository.findByIdUnscoped.mockImplementation((id: string) =>
      Promise.resolve(id === 'idp-a' ? idpA : idpB),
    );
    oidcEngineService.generateNonce.mockReturnValue('nonce-1');
    oidcEngineService.getAuthorizationRequest.mockResolvedValue({
      url: 'https://idp.example.com/authorize?...',
      state: 'unused',
      nonce: 'nonce-1',
    });

    // Mint a state token scoped to idp-a...
    await service.initiateOidcLogin('idp-a');
    const mintedState = [...tokenStore.keys()][0];

    // ...then attempt to redeem it against idp-b's callback endpoint.
    await expect(
      service.handleOidcCallback('idp-b', { code: 'abc', state: mintedState }),
    ).rejects.toThrow(UnauthorizedException);

    expect(oidcEngineService.handleCallback).not.toHaveBeenCalled();
  });

  it('rejects an OIDC callback with a state value that was never signed by this server', async () => {
    const idp = makeIdp();
    identityProviderRepository.findByIdUnscoped.mockResolvedValue(idp);

    await expect(
      service.handleOidcCallback('idp-1', { code: 'abc', state: 'forged-state-value' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an OIDC callback missing the state parameter entirely', async () => {
    const idp = makeIdp();
    identityProviderRepository.findByIdUnscoped.mockResolvedValue(idp);

    await expect(service.handleOidcCallback('idp-1', { code: 'abc' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects login/callback attempts against a non-ACTIVE identity provider', async () => {
    const idp = makeIdp({ status: 'DRAFT' });
    identityProviderRepository.findByIdUnscoped.mockResolvedValue(idp);

    await expect(service.initiateOidcLogin('idp-1')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login for a protocol mismatch (SAML idp id used on the OIDC route)', async () => {
    const idp = makeIdp({ protocol: 'SAML', oidcConfiguration: null, samlConfiguration: null });
    identityProviderRepository.findByIdUnscoped.mockResolvedValue(idp);

    await expect(service.initiateOidcLogin('idp-1')).rejects.toThrow(UnauthorizedException);
  });

  it('successfully completes an OIDC callback when the state round-trips for the same idp', async () => {
    const idp = makeIdp();
    identityProviderRepository.findByIdUnscoped.mockResolvedValue(idp);
    oidcEngineService.generateNonce.mockReturnValue('nonce-1');
    oidcEngineService.getAuthorizationRequest.mockResolvedValue({
      url: 'https://idp.example.com/authorize?...',
      state: 'unused',
      nonce: 'nonce-1',
    });
    oidcEngineService.handleCallback.mockResolvedValue({
      subject: 'sub-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      groups: [],
      raw: {},
    });

    await service.initiateOidcLogin('idp-1');
    const mintedState = [...tokenStore.keys()][0];

    await service.handleOidcCallback('idp-1', { code: 'abc', state: mintedState });

    expect(oidcEngineService.handleCallback).toHaveBeenCalledWith(
      idp.oidcConfiguration,
      'idp-1',
      { code: 'abc', state: mintedState },
      { state: mintedState, nonce: 'nonce-1' },
    );
  });
});
