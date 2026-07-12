import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
import { BillingEventRepository } from './billing-event.repository';
import { InvoiceRepository } from './invoice.repository';
import { PaymentRepository } from './payment.repository';
import { PaymentMethodRepository } from './payment-method.repository';
import { SessionRepository } from './session.repository';
import { CouponRepository } from './coupon.repository';
import { StripeClientService } from './stripe/stripe-client.service';
import { StripeCustomerService } from './stripe/stripe-customer.service';
import { StripeCheckoutService } from './stripe/stripe-checkout.service';
import { StripeSubscriptionService } from './stripe/stripe-subscription.service';
import { StripePaymentMethodService } from './stripe/stripe-payment-method.service';
import { StripeCouponService } from './stripe/stripe-coupon.service';
import { StripeWebhookDispatcherService } from './stripe/stripe-webhook-dispatcher.service';
import { STRIPE_WEBHOOK_QUEUE } from './jobs/stripe-webhook-queue.constants';
import { StripeWebhookQueueService } from './jobs/stripe-webhook-queue.service';
import { StripeWebhookProcessor } from './jobs/stripe-webhook.processor';
import { UsageRecordRepository } from './usage-record.repository';
import { UsageMeteringService } from './usage-metering.service';
import { BillingCronService } from './billing-cron.service';
import { QuotaService } from './quota.service';
import { FeatureGateGuard } from './guards/feature-gate.guard';
import { BillingController } from './billing.controller';
import { StripeWebhookController } from './stripe-webhook.controller';

// Same REDIS_ENABLED-gated BullMQ pattern as workflow.module.ts's
// WORKFLOW_RUN_QUEUE: with Redis enabled, an ingested Stripe event is
// enqueued and processed by StripeWebhookProcessor in a worker; without
// it, StripeWebhookQueueService.enqueue processes inline instead (dev/
// test are unaffected, matching every other queue-owning module here).
const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueImports = redisEnabled
  ? [
      BullModule.forRoot({
        connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      }),
      BullModule.registerQueue({ name: STRIPE_WEBHOOK_QUEUE }),
    ]
  : [];
const queueProcessors = redisEnabled ? [StripeWebhookProcessor] : [];

@Module({
  imports: [UsersModule, ...queueImports],
  // StripeWebhookController's route ('billing/webhooks/stripe') is more
  // specific than BillingController's bare 'billing' prefix, so it's
  // registered first — same ordering rationale WorkflowModule documents
  // for its own webhook controller.
  controllers: [StripeWebhookController, BillingController],
  providers: [
    PlanRepository,
    PlanService,
    BillingAccountRepository,
    BillingAccountService,
    SubscriptionRepository,
    SubscriptionService,
    SeatAssignmentRepository,
    SeatAssignmentService,
    BillingEventRepository,
    InvoiceRepository,
    PaymentRepository,
    PaymentMethodRepository,
    SessionRepository,
    CouponRepository,
    StripeClientService,
    StripeCustomerService,
    StripeCheckoutService,
    StripeSubscriptionService,
    StripePaymentMethodService,
    StripeCouponService,
    StripeWebhookDispatcherService,
    StripeWebhookQueueService,
    UsageRecordRepository,
    UsageMeteringService,
    BillingCronService,
    QuotaService,
    FeatureGateGuard,
    PlatformAdminGuard,
    ...queueProcessors,
  ],
  exports: [
    PlanService,
    BillingAccountService,
    SubscriptionService,
    SeatAssignmentService,
    UsageMeteringService,
    QuotaService,
    FeatureGateGuard,
  ],
})
export class BillingModule {}
