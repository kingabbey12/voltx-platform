import { Module } from '@nestjs/common';
import { OrganizationStructureController } from './organization-structure.controller';
import { OrganizationStructureRepository } from './organization-structure.repository';
import { OrganizationStructureService } from './organization-structure.service';

@Module({
  controllers: [OrganizationStructureController],
  providers: [OrganizationStructureRepository, OrganizationStructureService],
  exports: [OrganizationStructureRepository, OrganizationStructureService],
})
export class OrganizationStructureModule {}
