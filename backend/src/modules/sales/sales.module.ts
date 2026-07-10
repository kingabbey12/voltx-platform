import { Module } from '@nestjs/common';
import { AgentModule } from '../ai/agents/agent.module';
import { AIModule } from '../ai/ai.module';
import { ToolModule } from '../ai/tools/tool.module';
import { CompaniesController } from './companies/companies.controller';
import { CompaniesRepository } from './companies/companies.repository';
import { CompaniesService } from './companies/companies.service';
import { ContactsController } from './contacts/contacts.controller';
import { ContactsRepository } from './contacts/contacts.repository';
import { ContactsService } from './contacts/contacts.service';
import { LeadsController } from './leads/leads.controller';
import { LeadsRepository } from './leads/leads.repository';
import { LeadsService } from './leads/leads.service';
import { OpportunitiesController } from './opportunities/opportunities.controller';
import { OpportunitiesRepository } from './opportunities/opportunities.repository';
import { OpportunitiesService } from './opportunities/opportunities.service';
import { ActivitiesController } from './activities/activities.controller';
import { ActivitiesRepository } from './activities/activities.repository';
import { ActivitiesService } from './activities/activities.service';
import { SalesAiService } from './sales-ai.service';
import { SalesToolSourceService } from './tools/sales-tool-source.service';

@Module({
  imports: [AIModule, AgentModule, ToolModule],
  controllers: [
    CompaniesController,
    ContactsController,
    LeadsController,
    OpportunitiesController,
    ActivitiesController,
  ],
  providers: [
    SalesAiService,
    SalesToolSourceService,
    CompaniesRepository,
    CompaniesService,
    ContactsRepository,
    ContactsService,
    LeadsRepository,
    LeadsService,
    OpportunitiesRepository,
    OpportunitiesService,
    ActivitiesRepository,
    ActivitiesService,
  ],
  exports: [SalesAiService, ContactsService],
})
export class SalesModule {}
