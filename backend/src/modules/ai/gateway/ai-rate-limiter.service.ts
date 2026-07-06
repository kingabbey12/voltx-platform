import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerException } from '@nestjs/throttler';

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;

/**
 * Per-organization request admission control for AI Gateway traffic.
 *
 * This is an in-memory, per-process token bucket: correct for a single
 * backend instance, but each replica in a multi-instance deployment would
 * enforce its own independent limit rather than a shared one. Move the
 * bucket store to Redis before scaling horizontally.
 */
@Injectable()
export class AiRateLimiterService {
  private readonly limit: number;
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(configService: ConfigService) {
    this.limit = configService.get<number>('ai.rateLimit.requestsPerMinute', 120);
  }

  assertWithinLimit(organizationId: string): void {
    const now = Date.now();
    const bucket = this.buckets.get(organizationId);

    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      this.buckets.set(organizationId, { count: 1, windowStart: now });
      return;
    }

    if (bucket.count >= this.limit) {
      throw new ThrottlerException('AI request rate limit exceeded for this organization');
    }

    bucket.count += 1;
  }
}
