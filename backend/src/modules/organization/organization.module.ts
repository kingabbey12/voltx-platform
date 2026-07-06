import { Module } from '@nestjs/common';
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
  controllers: [OrganizationController, InvitationController, InvitationPublicController],
  providers: [OrganizationService, OrganizationRepository, InvitationService, InvitationRepository],
  exports: [OrganizationService, OrganizationRepository],
})
export class OrganizationModule {}
