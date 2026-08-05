import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RedisConnectionService } from './redis-connection.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisConnectionService],
  exports: [RedisConnectionService],
})
export class RedisClientModule {}
