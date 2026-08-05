import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Global, Injectable, Module } from '@nestjs/common';
import { Queue } from 'bullmq';

import { RedisConnectionService } from './redis-connection.service';
import { RedisClientModule } from './redis-client.module';
import { REDIS_QUEUE_NAMES, RedisQueueName } from './redis-queue.constants';

export function createBullRootOptions(redisConnections: RedisConnectionService) {
  return {
    connection: redisConnections.requireClient(),
  };
}

const redisEnabled = process.env.REDIS_ENABLED === 'true';
const bullImports = redisEnabled
  ? [
      BullModule.forRootAsync({
        imports: [RedisClientModule],
        inject: [RedisConnectionService],
        useFactory: createBullRootOptions,
      }),
      BullModule.registerQueue(...REDIS_QUEUE_NAMES.map((name) => ({ name }))),
    ]
  : [];

/** Provides the seven already-registered Queue objects to observability code. */
@Injectable()
export class BullQueueRegistry {
  constructor(...queues: Queue[]) {
    this.queues = new Map(queues.map((queue) => [queue.name as RedisQueueName, queue]));
  }

  private readonly queues: ReadonlyMap<RedisQueueName, Queue>;

  entries(): IterableIterator<[RedisQueueName, Queue]> {
    return this.queues.entries();
  }
}

const registryProvider = redisEnabled
  ? {
      provide: BullQueueRegistry,
      useFactory: (...queues: Queue[]) => new BullQueueRegistry(...queues),
      inject: REDIS_QUEUE_NAMES.map((name) => getQueueToken(name)),
    }
  : null;

/**
 * The application's only BullMQ root and queue-registration boundary.
 * Exporting BullModule from this global module makes every producer token
 * available without repeating registerQueue in feature modules.
 */
@Global()
@Module({
  imports: [RedisClientModule, ...bullImports],
  providers: registryProvider ? [registryProvider] : [],
  exports: [RedisClientModule, ...(redisEnabled ? [BullModule, BullQueueRegistry] : [])],
})
export class BullQueueModule {}
