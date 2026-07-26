import { Global, Module } from '@nestjs/common';
import {
  DISTRIBUTED_LOCK_SERVICE,
  distributedLockServiceProvider,
} from './distributed-lock.service';

/**
 * Global so every module that registers a scheduled sweep can inject the lock
 * without restating the import, matching how CacheModule exposes CACHE_SERVICE.
 */
@Global()
@Module({
  providers: [distributedLockServiceProvider],
  exports: [DISTRIBUTED_LOCK_SERVICE],
})
export class SchedulerLockModule {}
