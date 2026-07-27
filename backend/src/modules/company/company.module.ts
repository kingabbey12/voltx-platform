import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { UsersModule } from '../users/users.module';
import { SalesModule } from '../sales/sales.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { CommunicationsModule } from '../communications/communications.module';
import { PromisesModule } from '../promises/promises.module';
import { AIModule } from '../ai/ai.module';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

/**
 * The Company Workspace (docs/design/COMPANY.md): no second runtime, no
 * parallel entity models — this module composes the same services
 * SalesModule, AttachmentsModule, CommunicationsModule, UsersModule,
 * OrganizationModule, PromisesModule, and AIModule (for approval history)
 * already expose to their own REST controllers.
 */
@Module({
  imports: [
    OrganizationModule,
    UsersModule,
    SalesModule,
    AttachmentsModule,
    CommunicationsModule,
    PromisesModule,
    AIModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}
