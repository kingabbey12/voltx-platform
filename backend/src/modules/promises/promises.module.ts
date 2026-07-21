import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { ToolModule } from '../ai/tools/tool.module';
import { PromisesController } from './promises.controller';
import { PromisesRepository } from './promises.repository';
import { PromisesService } from './promises.service';
import { PromisesToolSourceService } from './tools/promises-tool-source.service';

/**
 * The Promises module (docs/design/COMPANY.md §2): the Promise primitive
 * built directly, not approximated. Exported services are consumed by
 * CompanyModule's timeline aggregation and by the Ask tool-source/record
 * resolver — no parallel business logic anywhere else.
 */
@Module({
  imports: [AIModule, ToolModule],
  controllers: [PromisesController],
  providers: [PromisesRepository, PromisesService, PromisesToolSourceService],
  exports: [PromisesRepository, PromisesService],
})
export class PromisesModule {}
