import { ConfigService } from '@nestjs/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createPinoConfig } from '../src/config/pino-logger.config';

/**
 * Guards the fix for the 2026-07-26 production incident.
 *
 * pino-http's default serializers dump every request AND response header on
 * every log line. Helmet sets a ~600-byte CSP on each response, which made one
 * request log ~1450 bytes; at ~3500 req/s that is ~5 MB/s to stdout, more than
 * Docker's json-file driver could drain. The pending writes accumulated in the
 * V8 heap until it hit its 524 MB ceiling and the process died mid-load —
 * surfacing as exit 139 rather than 134 because musl has no backtrace().
 *
 * See docs/operations/incident-2026-07-26-api-oom.md. Re-adding headers to
 * these serializers reintroduces the crash.
 */
describe('request log volume (incident 2026-07-26)', () => {
  function serializers(nodeEnv = 'production') {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'nodeEnv' ? nodeEnv : key === 'logLevel' ? 'info' : fallback,
      ),
    } as unknown as ConfigService;

    const params = createPinoConfig(configService);
    const pinoHttp = params.pinoHttp as {
      serializers?: {
        req?: (req: unknown) => unknown;
        res?: (res: unknown) => unknown;
      };
    };
    return pinoHttp.serializers;
  }

  const request = {
    id: 'req-1',
    method: 'GET',
    url: '/readiness',
    headers: {
      authorization: 'Bearer super-secret-token',
      cookie: 'session=super-secret-session',
      'user-agent': 'k6/1.0',
      host: 'api:3000',
    },
  } as unknown as IncomingMessage;

  const response = {
    statusCode: 200,
    getHeaders: () => ({
      'content-security-policy':
        "default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline';img-src 'self' data: blob:;font-src 'self';connect-src 'self';object-src 'none';base-uri 'self';form-action 'self';upgrade-insecure-requests;frame-ancestors 'self'",
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
    }),
  } as unknown as ServerResponse;

  it('defines explicit serializers rather than inheriting pino-http defaults', () => {
    const s = serializers();
    expect(typeof s?.req).toBe('function');
    expect(typeof s?.res).toBe('function');
  });

  it('logs the fields needed to debug a request', () => {
    expect(serializers()?.req?.(request)).toEqual({
      id: 'req-1',
      method: 'GET',
      url: '/readiness',
    });
    expect(serializers()?.res?.(response)).toEqual({ statusCode: 200 });
  });

  it('serialises no headers at all, on either side', () => {
    // The header dump is what made each line ~1450 bytes. Excluding it also
    // makes credential leakage structurally impossible rather than redacted.
    const serialised = JSON.stringify([
      serializers()?.req?.(request),
      serializers()?.res?.(response),
    ]);

    expect(serialised).not.toMatch(/content-security-policy/i);
    expect(serialised).not.toMatch(/strict-transport-security/i);
    expect(serialised).not.toContain('super-secret-token');
    expect(serialised).not.toContain('super-secret-session');
    expect(serialised).not.toMatch(/headers/i);
  });

  it('keeps a serialised request line small enough to sustain production throughput', () => {
    const bytes = Buffer.byteLength(
      JSON.stringify({
        req: serializers()?.req?.(request),
        res: serializers()?.res?.(response),
      }),
    );

    // Measured at ~274 bytes for a full line including pino's own envelope.
    // The pre-incident line was ~1450. 400 leaves room for the envelope and
    // trace ids while still ruling out a header dump.
    expect(bytes).toBeLessThan(400);
  });

  it.each(['production', 'development'])('applies the serializers in %s too', (nodeEnv) => {
    // Development differs only by the pino-pretty transport; the volume
    // characteristics must not silently differ between environments.
    expect(typeof serializers(nodeEnv)?.req).toBe('function');
  });
});
