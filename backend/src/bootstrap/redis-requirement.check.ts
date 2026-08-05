import Redis from 'ioredis';
import { createRedisOptions, redisErrorMessage } from '../common/redis/redis-connection.service';

const PING_TIMEOUT_MS = 5000;

/**
 * Runs before NestFactory.create, so it fails the process before any
 * module attempts to register a BullMQ queue. Three modules
 * (communications, attachments, ai/agents) each independently fall back
 * to synchronous, un-retried, no-dead-letter execution whenever
 * REDIS_ENABLED isn't exactly "true" — acceptable for local dev/test, not
 * for production, where a transient failure in any of those background
 * jobs would otherwise be silently dropped with only a log line.
 *
 * It is also what makes cross-replica scheduler locking safe to default:
 * DISTRIBUTED_LOCK_SERVICE degrades to an in-process lock without Redis,
 * which would let every replica run every cron/@Interval sweep. Because
 * production cannot boot without Redis, that degraded mode is unreachable
 * there — do not relax this check without replacing that guarantee.
 */
export async function assertRedisRequirement(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const redisEnabled = process.env.REDIS_ENABLED === 'true';

  if (nodeEnv === 'production' && !redisEnabled) {
    throw new Error(
      'REDIS_ENABLED must be set to "true" in production — comms AI processing, ' +
        'attachment processing, and AI agent-run resume all silently degrade to ' +
        'synchronous, un-retried, no-dead-letter execution without it.',
    );
  }

  if (!redisEnabled) {
    return;
  }

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(redisUrl, {
    ...createRedisOptions('voltx-api-startup-check'),
    maxRetriesPerRequest: 1,
  });
  client.on('error', () => undefined);

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.connect().then(() => client.ping()),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Redis ping timed out')), PING_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    throw new Error(
      `REDIS_ENABLED is "true" but Redis is not reachable: ${redisErrorMessage(error, redisUrl)}`,
    );
  } finally {
    clearTimeout(timeout);
    client.disconnect();
  }
}
