import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MetricsScrapeGuard } from '../src/modules/metrics/metrics-scrape.guard';

function contextWithAuthHeader(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

function guardWithToken(token: string): MetricsScrapeGuard {
  return new MetricsScrapeGuard({ get: jest.fn().mockReturnValue(token) } as never);
}

describe('MetricsScrapeGuard', () => {
  const token = 'a'.repeat(40);

  it('leaves /metrics open when no token is configured', () => {
    // Dev and test keep working unchanged; production cannot reach this branch
    // because assertConfigured refuses to boot without a token.
    const guard = guardWithToken('');
    expect(guard.canActivate(contextWithAuthHeader())).toBe(true);
  });

  it('allows a scrape presenting the configured bearer token', () => {
    const guard = guardWithToken(token);
    expect(guard.canActivate(contextWithAuthHeader(`Bearer ${token}`))).toBe(true);
  });

  it.each([
    ['no Authorization header at all', undefined],
    ['a wrong token', 'Bearer wrong-token-value'],
    ['the right token without the Bearer scheme', 'a'.repeat(40)],
    ['Basic auth instead of Bearer', 'Basic YWRtaW46YWRtaW4='],
    ['an empty bearer value', 'Bearer '],
  ])('rejects a scrape with %s', (_case, header) => {
    const guard = guardWithToken(token);
    expect(() => guard.canActivate(contextWithAuthHeader(header))).toThrow(UnauthorizedException);
  });

  it('does not reveal validity through comparison length', () => {
    // Guards against a naive === on differing lengths; the implementation must
    // reject rather than throw from timingSafeEqual's length precondition.
    const guard = guardWithToken(token);
    expect(() => guard.canActivate(contextWithAuthHeader('Bearer short'))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('MetricsScrapeGuard.assertConfigured', () => {
  it('refuses to boot production without a token', () => {
    expect(() => MetricsScrapeGuard.assertConfigured('production', undefined)).toThrow(
      /METRICS_AUTH_TOKEN must be set in production/,
    );
  });

  it('rejects a token too short to be worth having', () => {
    expect(() => MetricsScrapeGuard.assertConfigured('production', 'short')).toThrow(
      /at least 32 characters/,
    );
  });

  it('accepts a sufficiently long production token', () => {
    expect(() => MetricsScrapeGuard.assertConfigured('production', 'a'.repeat(32))).not.toThrow();
  });

  it.each(['development', 'test'])('does not require a token in %s', (nodeEnv) => {
    expect(() => MetricsScrapeGuard.assertConfigured(nodeEnv, undefined)).not.toThrow();
  });
});
