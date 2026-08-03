import { Module } from '@nestjs/common';
import { StorageModule } from '../attachments/storage/storage.module';
import { MetricsModule } from '../metrics/metrics.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SystemHealthController } from './system-health.controller';

@Module({
  // Readiness reports object-storage health continuously; a boot-only
  // check let a container stay 'healthy' for days on revoked credentials.
  imports: [StorageModule, MetricsModule],
  controllers: [HealthController, SystemHealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
