import Redis from 'ioredis';

const PING_TIMEOUT_MS = 5000;

/**
 * Runs before NestFactory.create, so it fails the process before any
 * module attempts to register a BullMQ queue. Three modules
 * (communications, attachments, ai/agents) each independently fall back
 * to synchronous, un-retried, no-dead-letter execution whenever
 * REDIS_ENABLED isn't exactly "true" — acceptable for local dev/test, not
 * for production, where a transient failure in any of those background
 * jobs would otherwise be silently dropped with only a log line.
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
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: PING_TIMEOUT_MS,
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.connect().then(() => client.ping()),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Redis ping timed out')), PING_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `REDIS_ENABLED is "true" but Redis at "${redisUrl}" is not reachable: ${message}`,
    );
  } finally {
    clearTimeout(timeout);
    client.disconnect();
  }
}
