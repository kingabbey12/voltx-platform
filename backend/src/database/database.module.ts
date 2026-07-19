import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SystemSeedService } from './seed/system-seed.service';
import { DatabaseSeedBootstrapService } from './seed/database-seed-bootstrap.service';

@Global()
@Module({
  providers: [PrismaService, SystemSeedService, DatabaseSeedBootstrapService],
  exports: [PrismaService, SystemSeedService],
})
export class DatabaseModule {}
