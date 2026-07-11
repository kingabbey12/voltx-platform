import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  AttachPaymentMethodDto,
  CancelSubscriptionDto,
  ChangeSubscriptionPlanDto,
  CreateCheckoutSessionDto,
  CreatePortalSessionDto,
  InvoiceResponseDto,
  ListInvoicesQueryDto,
  PaymentMethodResponseDto,
  PlanResponseDto,
  RedeemPromotionCodeDto,
  SubscriptionResponseDto,
  CheckoutSessionResponseDto,
  PortalSessionResponseDto,
  CreateSetupIntentResponseDto,
  PaginatedInvoicesResponseDto,
} from './dto/billing.dto';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { InvoiceRepository } from './invoice.repository';
import { PaymentMethodRepository } from './payment-method.repository';
import { StripeCheckoutService } from './stripe/stripe-checkout.service';
import { StripeSubscriptionService } from './stripe/stripe-subscription.service';
import { StripePaymentMethodService } from './stripe/stripe-payment-method.service';
import { StripeCouponService } from './stripe/stripe-coupon.service';

@ApiTags('Billing')
@ApiBearerAuth('JWT')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly planService: PlanService,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly stripeCheckoutService: StripeCheckoutService,
    private readonly stripeSubscriptionService: StripeSubscriptionService,
    private readonly stripePaymentMethodService: StripePaymentMethodService,
    private readonly stripeCouponService: StripeCouponService,
  ) {}

  @Get('plans')
  @UseGuards(...AUTH_GUARDS)
  @ApiOperation({ summary: "List Voltx's plan catalog" })
  async listPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.planService.listPlans();
    return plans.map((plan) => PlanResponseDto.fromEntity(plan));
  }

  @Get('plans/:key')
  @UseGuards(...AUTH_GUARDS)
  @ApiOperation({ summary: 'Get one plan with its feature limits' })
  async getPlan(@Param('key') key: string): Promise<PlanResponseDto> {
    const plan = await this.planService.getPlanWithLimitsByKeyOrThrow(key);
    return PlanResponseDto.fromEntity(plan);
  }

  @Get('subscription')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.subscription.read')
  @ApiOperation({ summary: "Get the organization's current subscription" })
  async getSubscription(
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionService.getCurrentForOrganizationOrThrow(
      user.organizationId,
    );
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Post('checkout')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.subscription.manage')
  @ApiOperation({ summary: 'Start Stripe Checkout to move onto a paid plan' })
  async createCheckoutSession(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponseDto> {
    const session = await this.stripeCheckoutService.createCheckoutSession(
      user.organizationId,
      dto.planKey,
      dto.seats ?? 1,
      dto.successUrl,
      dto.cancelUrl,
    );
    return CheckoutSessionResponseDto.fromEntity(session);
  }

  @Post('portal')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.portal.access')
  @ApiOperation({ summary: 'Launch the Stripe-hosted Customer Portal' })
  async createPortalSession(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreatePortalSessionDto,
  ): Promise<PortalSessionResponseDto> {
    const session = await this.stripeCheckoutService.createPortalSession(
      user.organizationId,
      dto.returnUrl,
    );
    return PortalSessionResponseDto.fromEntity(session);
  }

  @Post('subscription/upgrade')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.subscription.manage')
  @ApiOperation({ summary: 'Move to a higher plan (with proration)' })
  async upgradeSubscription(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: ChangeSubscriptionPlanDto,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.stripeSubscriptionService.changePlan(
      user.organizationId,
      dto.planKey,
      dto.seats ?? 1,
      user.id,
    );
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Post('subscription/downgrade')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.subscription.manage')
  @ApiOperation({ summary: 'Move to a lower plan (with proration)' })
  async downgradeSubscription(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: ChangeSubscriptionPlanDto,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.stripeSubscriptionService.changePlan(
      user.organizationId,
      dto.planKey,
      dto.seats ?? 1,
      user.id,
    );
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Post('subscription/cancel')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.subscription.manage')
  @ApiOperation({ summary: 'Cancel the subscription (default: at period end)' })
  async cancelSubscription(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.stripeSubscriptionService.cancel(
      user.organizationId,
      dto.atPeriodEnd ?? true,
      user.id,
    );
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Post('subscription/resume')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.subscription.manage')
  @ApiOperation({ summary: 'Resume a subscription pending cancellation at period end' })
  async resumeSubscription(
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.stripeSubscriptionService.resume(user.organizationId, user.id);
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Get('invoices')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.invoice.read')
  @ApiOperation({ summary: "List the organization's invoices" })
  async listInvoices(@Query() query: ListInvoicesQueryDto): Promise<PaginatedInvoicesResponseDto> {
    const result = await this.invoiceRepository.findForCurrentOrganization({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    return {
      items: result.items.map((invoice) => InvoiceResponseDto.fromEntity(invoice)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('payment-methods')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.payment_method.manage')
  @ApiOperation({ summary: "List the organization's saved payment methods" })
  async listPaymentMethods(): Promise<PaymentMethodResponseDto[]> {
    const methods = await this.paymentMethodRepository.listForCurrentOrganization();
    return methods.map((method) => PaymentMethodResponseDto.fromEntity(method));
  }

  @Post('payment-methods/setup-intent')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.payment_method.manage')
  @ApiOperation({ summary: 'Create a SetupIntent for collecting a new payment method client-side' })
  async createSetupIntent(
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<CreateSetupIntentResponseDto> {
    return this.stripePaymentMethodService.createSetupIntent(user.organizationId);
  }

  @Post('payment-methods')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.payment_method.manage')
  @ApiOperation({ summary: 'Attach a client-confirmed payment method to the organization' })
  async attachPaymentMethod(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: AttachPaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const method = await this.stripePaymentMethodService.attachConfirmedPaymentMethod(
      user.organizationId,
      dto.stripePaymentMethodId,
      dto.makeDefault ?? false,
    );
    return PaymentMethodResponseDto.fromEntity(method);
  }

  @Post('payment-methods/:id/default')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.payment_method.manage')
  @ApiOperation({ summary: 'Set a payment method as the default' })
  async setDefaultPaymentMethod(
    @CurrentUser() user: CurrentUserInterface,
    @Param('id') id: string,
  ): Promise<PaymentMethodResponseDto> {
    const method = await this.stripePaymentMethodService.setDefault(user.organizationId, id);
    return PaymentMethodResponseDto.fromEntity(method);
  }

  @Delete('payment-methods/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.payment_method.manage')
  @ApiOperation({ summary: 'Remove a saved payment method' })
  async removePaymentMethod(
    @CurrentUser() user: CurrentUserInterface,
    @Param('id') id: string,
  ): Promise<{ removed: true }> {
    await this.stripePaymentMethodService.remove(user.organizationId, id);
    return { removed: true };
  }

  @Post('coupons/redeem')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('billing.subscription.manage')
  @ApiOperation({ summary: 'Redeem a promotion code against the current subscription' })
  async redeemPromotionCode(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: RedeemPromotionCodeDto,
  ): Promise<{ redeemed: true }> {
    const subscription = await this.subscriptionService.getCurrentForOrganizationOrThrow(
      user.organizationId,
    );
    await this.stripeCouponService.redeemPromotionCode(
      user.organizationId,
      dto.code,
      subscription.stripeSubscriptionId,
    );
    return { redeemed: true };
  }
}
