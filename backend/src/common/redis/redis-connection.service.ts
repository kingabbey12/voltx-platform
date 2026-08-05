import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

import { EXPECTED_IDLE_REDIS_CONNECTIONS } from './redis-queue.constants';

const REDIS_RETRY_BASE_MS = 250;
const REDIS_RETRY_MAX_MS = 5_000;
const REDIS_RETRY_JITTER_MS = 250;

export function redisReconnectDelay(attempt: number, random: () => number = Math.random): number {
  const exponential = REDIS_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1);
  const boundedBase = Math.min(exponential, REDIS_RETRY_MAX_MS - REDIS_RETRY_JITTER_MS);
  const jitter = Math.floor(Math.max(0, Math.min(1, random())) * REDIS_RETRY_JITTER_MS);
  return Math.min(REDIS_RETRY_MAX_MS, boundedBase + jitter);
}

export function redactRedisCredentials(value: string, redisUrl?: string): string {
  let redacted = value.replace(/\b(rediss?):\/\/[^\s/@]+@/giu, '$1://[REDACTED]@');

  if (!redisUrl) {
    return redacted;
  }

  try {
    const parsed = new URL(redisUrl);
    for (const credential of [parsed.username, parsed.password]) {
      if (!credential) continue;
      for (const representation of [credential, decodeURIComponent(credential)]) {
        if (representation) {
          redacted = redacted.split(representation).join('[REDACTED]');
        }
      }
    }
  } catch {
    // Invalid URLs are rejected by ioredis. The scheme-based redaction above
    // still keeps a conventional Redis URI out of the resulting error log.
  }

  return redacted;
}

export function redisErrorMessage(error: unknown, redisUrl?: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactRedisCredentials(message, redisUrl);
}

export function createRedisOptions(connectionName: string): RedisOptions {
  return {
    lazyConnect: true,
    // BullMQ workers require null. Every producer and non-blocking worker
    // command reuses this one client; BullMQ creates only its unavoidable
    // duplicated blocking connection for each Worker.
    maxRetriesPerRequest: null,
    connectTimeout: 5_000,
    connectionName,
    retryStrategy: redisReconnectDelay,
  };
}

/**
 * Sole owner of the long-lived application Redis client. This provider is a
 * default-scope singleton in a global module: HTTP requests only borrow the
 * client and can never construct or close one themselves.
 */
@Injectable()
export class RedisConnectionService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RedisConnectionService.name);
  private readonly enabled: boolean;
  private readonly redisUrl: string;
  private readonly redisClient: Redis | null;

  constructor(configService: ConfigService) {
    this.enabled = configService.get<boolean>('redis.enabled', false);
    this.redisUrl = configService.get<string>('redis.url', 'redis://localhost:6379');
    this.redisClient = this.enabled
      ? new Redis(this.redisUrl, createRedisOptions('voltx-api-shared'))
      : null;

    this.redisClient?.on('error', (error: unknown) => {
      this.logger.warn(
        { redisError: redisErrorMessage(error, this.redisUrl) },
        'Redis connection error',
      );
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getClient(): Redis | null {
    return this.redisClient;
  }

  requireClient(): Redis {
    if (!this.redisClient) {
      throw new Error('Redis client requested while REDIS_ENABLED is false');
    }
    return this.redisClient;
  }

  errorMessage(error: unknown): string {
    return redisErrorMessage(error, this.redisUrl);
  }

  async ensureConnected(): Promise<Redis> {
    const client = this.requireClient();
    if (client.status === 'wait') {
      await client.connect();
    }
    if (client.status === 'end') {
      throw new Error('Redis client is closed');
    }
    return client;
  }

  onApplicationBootstrap(): void {
    if (this.enabled) {
      // Deliberately log only the budget. Never log the URL, host, username,
      // provider, or a serialized ioredis options object at startup.
      this.logger.log({ expectedRedisConnections: EXPECTED_IDLE_REDIS_CONNECTIONS });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.redisClient || this.redisClient.status === 'end') {
      return;
    }

    if (this.redisClient.status === 'wait') {
      this.redisClient.disconnect();
      return;
    }

    try {
      await this.redisClient.quit();
    } catch {
      this.redisClient.disconnect();
    }
  }
}
