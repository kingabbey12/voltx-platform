import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE, cacheServiceProvider } from './cache.service';

@Global()
@Module({
  providers: [cacheServiceProvider],
  exports: [CACHE_SERVICE],
})
export class CacheModule {}
