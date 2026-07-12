import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../src/modules/metrics/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, fallback: unknown) => fallback) },
        },
      ],
    }).compile();

    service = module.get(MetricsService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('records an SSO login and exposes it with protocol/outcome labels', async () => {
    service.recordSsoLogin('SAML', 'success');
    service.recordSsoLogin('OIDC', 'failure');

    const metrics = await service.getMetrics();

    expect(metrics).toContain('voltx_sso_login_total{protocol="SAML",outcome="success"} 1');
    expect(metrics).toContain('voltx_sso_login_total{protocol="OIDC",outcome="failure"} 1');
  });

  it('records SCIM operations with operation/status labels', async () => {
    service.recordScimOperation('CREATE_USER', 'SUCCESS');
    service.recordScimOperation('CREATE_USER', 'FAILED');

    const metrics = await service.getMetrics();

    expect(metrics).toContain(
      'voltx_scim_operations_total{operation="CREATE_USER",status="SUCCESS"} 1',
    );
    expect(metrics).toContain(
      'voltx_scim_operations_total{operation="CREATE_USER",status="FAILED"} 1',
    );
  });

  it('records MFA challenge outcomes', async () => {
    service.recordMfaChallenge('success');
    service.recordMfaChallenge('success');
    service.recordMfaChallenge('failure');

    const metrics = await service.getMetrics();

    expect(metrics).toContain('voltx_mfa_challenges_total{outcome="success"} 2');
    expect(metrics).toContain('voltx_mfa_challenges_total{outcome="failure"} 1');
  });

  it('records session revocations as an unlabeled counter', async () => {
    service.recordSessionRevocation();
    service.recordSessionRevocation();

    const metrics = await service.getMetrics();

    expect(metrics).toContain('voltx_session_revocations_total 2');
  });

  it('returns no queue depths when Redis is disabled', async () => {
    const depths = await service.getQueueDepths();
    expect(depths).toEqual({});
  });
});
