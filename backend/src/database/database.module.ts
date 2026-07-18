import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseSeedBootstrapService } from './seed/database-seed-bootstrap.service';

@Global()
@Module({
  providers: [PrismaService, DatabaseSeedBootstrapService],
  exports: [PrismaService],
})
export class DatabaseModule {}
