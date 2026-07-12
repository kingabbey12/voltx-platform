import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SystemHealthController } from './system-health.controller';

@Module({
  controllers: [HealthController, SystemHealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
