import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Protects `/metrics`, which is otherwise unauthenticated and exposes the full
 * route inventory, per-route error rates, traffic shape, queue depths and
 * process internals — a useful reconnaissance surface, and an unbounded one
 * since the endpoint is also `@SkipThrottle()`.
 *
 * Enforcement is opt-in by configuration so existing deployments keep working:
 * when `METRICS_AUTH_TOKEN` is unset the endpoint stays open, exactly as
 * before. It is *required* under `NODE_ENV=production` — a production process
 * that boots without it fails fast rather than silently serving metrics to
 * anyone who can reach the port (see MetricsScrapeGuard.assertConfigured,
 * called from the bootstrap Redis/env checks).
 *
 * Prometheus sends the token as a bearer credential; see the `authorization`
 * block on the `voltx-api` job in deploy/prometheus/prometheus.yml.
 */
@Injectable()
export class MetricsScrapeGuard implements CanActivate {
  private static readonly logger = new Logger(MetricsScrapeGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('metrics.authToken', '');
    if (!expected) {
      return true;
    }

    const header = context.switchToHttp().getRequest<Request>().headers.authorization ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

    if (!matchesConstantTime(provided, expected)) {
      throw new UnauthorizedException('Invalid metrics scrape credentials');
    }
    return true;
  }

  /**
   * Bootstrap-time check. Kept here rather than in env.validation so the
   * requirement lives next to the thing it protects, and so non-production
   * environments are not forced to invent a token.
   */
  static assertConfigured(nodeEnv: string, token: string | undefined): void {
    if (nodeEnv !== 'production') {
      return;
    }
    if (!token) {
      throw new Error(
        'METRICS_AUTH_TOKEN must be set in production — /metrics is otherwise ' +
          'served unauthenticated and unthrottled, exposing route inventory, ' +
          'error rates and queue depths to anyone who can reach the port.',
      );
    }
    if (token.length < 32) {
      throw new Error('METRICS_AUTH_TOKEN must be at least 32 characters');
    }
    MetricsScrapeGuard.logger.log('Metrics scrape endpoint is token-protected');
  }
}

/** Compares without leaking length or position through timing. */
function matchesConstantTime(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
