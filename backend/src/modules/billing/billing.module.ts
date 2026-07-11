import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PlanRepository } from './plan.repository';
import { PlanService } from './plan.service';
import { BillingAccountRepository } from './billing-account.repository';
import { BillingAccountService } from './billing-account.service';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionService } from './subscription.service';
import { SeatAssignmentRepository } from './seat-assignment.repository';
import { SeatAssignmentService } from './seat-assignment.service';

@Module({
  imports: [UsersModule],
  providers: [
    PlanRepository,
    PlanService,
    BillingAccountRepository,
    BillingAccountService,
    SubscriptionRepository,
    SubscriptionService,
    SeatAssignmentRepository,
    SeatAssignmentService,
    PlatformAdminGuard,
  ],
  exports: [PlanService, BillingAccountService, SubscriptionService, SeatAssignmentService],
})
export class BillingModule {}
