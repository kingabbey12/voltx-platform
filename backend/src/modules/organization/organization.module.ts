import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import {
  InvitationController,
  InvitationPublicController,
} from './invitations/invitation.controller';
import { InvitationRepository } from './invitations/invitation.repository';
import { InvitationService } from './invitations/invitation.service';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

@Module({
  imports: [BillingModule],
  controllers: [OrganizationController, InvitationController, InvitationPublicController],
  providers: [OrganizationService, OrganizationRepository, InvitationService, InvitationRepository],
  exports: [OrganizationService, OrganizationRepository],
})
export class OrganizationModule {}
