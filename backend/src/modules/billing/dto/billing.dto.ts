import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { PlanEntity, PlanWithLimits } from '../entities/plan.entity';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { InvoiceEntity } from '../entities/invoice.entity';
import { PaymentMethodEntity } from '../entities/payment.entity';
import { CheckoutSessionEntity, CustomerPortalSessionEntity } from '../entities/session.entity';
import { UsageSnapshotEntity } from '../entities/usage.entity';

export class CreateCheckoutSessionDto {
  @ApiProperty({ example: 'professional' })
  @IsString()
  planKey!: string;

  @ApiPropertyOptional({ example: 5, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number = 1;

  @ApiProperty({ example: 'https://app.voltx.io/billing?checkout=success' })
  @IsUrl({ require_tld: false })
  successUrl!: string;

  @ApiProperty({ example: 'https://app.voltx.io/billing/upgrade?checkout=cancelled' })
  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}

export class CreatePortalSessionDto {
  @ApiProperty({ example: 'https://app.voltx.io/billing' })
  @IsUrl({ require_tld: false })
  returnUrl!: string;
}

export class ChangeSubscriptionPlanDto {
  @ApiProperty({ example: 'business' })
  @IsString()
  planKey!: string;

  @ApiPropertyOptional({ example: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number = 1;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Cancel at period end (default) instead of immediately',
  })
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean = true;
}

export class CreateSetupIntentResponseDto {
  @ApiProperty()
  clientSecret!: string;
}

export class AttachPaymentMethodDto {
  @ApiProperty({ example: 'pm_1NxABC2eZvKYlo2C0abcdefg' })
  @IsString()
  stripePaymentMethodId!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  makeDefault?: boolean = false;
}

export class RedeemPromotionCodeDto {
  @ApiProperty({ example: 'LAUNCH20' })
  @IsString()
  @MaxLength(100)
  code!: string;
}

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

const PLAN_KEYS = ['free', 'starter', 'professional', 'business', 'enterprise'];

export class PlanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PLAN_KEYS }) key!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiPropertyOptional() priceMonthlyUsd!: number | null;
  @ApiPropertyOptional() priceYearlyUsd!: number | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() trialDays!: number;
  @ApiPropertyOptional({
    description:
      'Present only on GET /billing/plans/:key — per-feature usage limits (null = unlimited).',
  })
  limits?: Array<{
    featureKey: string;
    unit: string;
    limit: number | null;
    softLimitPercent: number | null;
  }>;

  static fromEntity(entity: PlanEntity | PlanWithLimits): PlanResponseDto {
    const dto = new PlanResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.priceMonthlyUsd = entity.priceMonthlyUsd;
    dto.priceYearlyUsd = entity.priceYearlyUsd;
    dto.sortOrder = entity.sortOrder;
    dto.trialDays = entity.trialDays;
    if ('limits' in entity) {
      dto.limits = entity.limits;
    }
    return dto;
  }
}

const SUBSCRIPTION_STATUSES = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE',
  'UNPAID',
  'PAUSED',
];

export class SubscriptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() planId!: string;
  @ApiPropertyOptional() stripeSubscriptionId!: string | null;
  @ApiProperty({ enum: SUBSCRIPTION_STATUSES }) status!: string;
  @ApiProperty() seats!: number;
  @ApiProperty() currentPeriodStart!: string;
  @ApiProperty() currentPeriodEnd!: string;
  @ApiPropertyOptional() trialStart!: string | null;
  @ApiPropertyOptional() trialEnd!: string | null;
  @ApiProperty() cancelAtPeriodEnd!: boolean;
  @ApiPropertyOptional() canceledAt!: string | null;

  static fromEntity(entity: SubscriptionEntity): SubscriptionResponseDto {
    const dto = new SubscriptionResponseDto();
    dto.id = entity.id;
    dto.planId = entity.planId;
    dto.stripeSubscriptionId = entity.stripeSubscriptionId;
    dto.status = entity.status;
    dto.seats = entity.seats;
    dto.currentPeriodStart = entity.currentPeriodStart.toISOString();
    dto.currentPeriodEnd = entity.currentPeriodEnd.toISOString();
    dto.trialStart = entity.trialStart ? entity.trialStart.toISOString() : null;
    dto.trialEnd = entity.trialEnd ? entity.trialEnd.toISOString() : null;
    dto.cancelAtPeriodEnd = entity.cancelAtPeriodEnd;
    dto.canceledAt = entity.canceledAt ? entity.canceledAt.toISOString() : null;
    return dto;
  }
}

export class InvoiceResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() stripeInvoiceId!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() amountDue!: number;
  @ApiProperty() amountPaid!: number;
  @ApiProperty() amountRemaining!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() dueDate!: string | null;
  @ApiPropertyOptional() paidAt!: string | null;
  @ApiPropertyOptional() hostedInvoiceUrl!: string | null;
  @ApiPropertyOptional() pdfUrl!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: InvoiceEntity): InvoiceResponseDto {
    const dto = new InvoiceResponseDto();
    dto.id = entity.id;
    dto.stripeInvoiceId = entity.stripeInvoiceId;
    dto.status = entity.status;
    dto.amountDue = entity.amountDue;
    dto.amountPaid = entity.amountPaid;
    dto.amountRemaining = entity.amountRemaining;
    dto.currency = entity.currency;
    dto.dueDate = entity.dueDate ? entity.dueDate.toISOString() : null;
    dto.paidAt = entity.paidAt ? entity.paidAt.toISOString() : null;
    dto.hostedInvoiceUrl = entity.hostedInvoiceUrl;
    dto.pdfUrl = entity.pdfUrl;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedInvoicesResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] }) items!: InvoiceResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class PaymentMethodResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiPropertyOptional() brand!: string | null;
  @ApiPropertyOptional() last4!: string | null;
  @ApiPropertyOptional() expMonth!: number | null;
  @ApiPropertyOptional() expYear!: number | null;
  @ApiProperty() isDefault!: boolean;

  static fromEntity(entity: PaymentMethodEntity): PaymentMethodResponseDto {
    const dto = new PaymentMethodResponseDto();
    dto.id = entity.id;
    dto.type = entity.type;
    dto.brand = entity.brand;
    dto.last4 = entity.last4;
    dto.expMonth = entity.expMonth;
    dto.expYear = entity.expYear;
    dto.isDefault = entity.isDefault;
    return dto;
  }
}

export class CheckoutSessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;

  static fromEntity(entity: CheckoutSessionEntity): CheckoutSessionResponseDto {
    const dto = new CheckoutSessionResponseDto();
    dto.id = entity.id;
    dto.url = entity.url;
    return dto;
  }
}

export class PortalSessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;

  static fromEntity(entity: CustomerPortalSessionEntity): PortalSessionResponseDto {
    const dto = new PortalSessionResponseDto();
    dto.id = entity.id;
    dto.url = entity.url;
    return dto;
  }
}

export class ListUsageHistoryQueryDto {
  @ApiPropertyOptional({ example: 'ai_requests' })
  @IsOptional()
  @IsString()
  featureKey?: string;

  @ApiPropertyOptional({ example: 90, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  limit?: number = 90;
}

export class FeatureUsageResponseDto {
  @ApiProperty() featureKey!: string;
  @ApiProperty() currentUsage!: number;
  @ApiPropertyOptional({ description: 'null = unlimited on this plan' })
  limit!: number | null;
  @ApiPropertyOptional() remaining!: number | null;
  @ApiProperty() unit!: string;
}

export class UsageSnapshotResponseDto {
  @ApiProperty() featureKey!: string;
  @ApiProperty() periodStart!: string;
  @ApiProperty() periodEnd!: string;
  @ApiProperty() totalQuantity!: number;

  static fromEntity(entity: UsageSnapshotEntity): UsageSnapshotResponseDto {
    const dto = new UsageSnapshotResponseDto();
    dto.featureKey = entity.featureKey;
    dto.periodStart = entity.periodStart.toISOString();
    dto.periodEnd = entity.periodEnd.toISOString();
    dto.totalQuantity = entity.totalQuantity;
    return dto;
  }
}

export class PlanSuccessResponseDto extends ApiSuccessResponseDto<PlanResponseDto> {
  @ApiProperty({ type: PlanResponseDto }) declare data: PlanResponseDto;
}

export class UsageSuccessResponseDto extends ApiSuccessResponseDto<FeatureUsageResponseDto[]> {
  @ApiProperty({ type: [FeatureUsageResponseDto] }) declare data: FeatureUsageResponseDto[];
}

export class UsageHistorySuccessResponseDto extends ApiSuccessResponseDto<
  UsageSnapshotResponseDto[]
> {
  @ApiProperty({ type: [UsageSnapshotResponseDto] }) declare data: UsageSnapshotResponseDto[];
}

export class PlansSuccessResponseDto extends ApiSuccessResponseDto<PlanResponseDto[]> {
  @ApiProperty({ type: [PlanResponseDto] }) declare data: PlanResponseDto[];
}

export class SubscriptionSuccessResponseDto extends ApiSuccessResponseDto<SubscriptionResponseDto> {
  @ApiProperty({ type: SubscriptionResponseDto }) declare data: SubscriptionResponseDto;
}

export class InvoicesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedInvoicesResponseDto> {
  @ApiProperty({ type: PaginatedInvoicesResponseDto }) declare data: PaginatedInvoicesResponseDto;
}

export class PaymentMethodsSuccessResponseDto extends ApiSuccessResponseDto<
  PaymentMethodResponseDto[]
> {
  @ApiProperty({ type: [PaymentMethodResponseDto] }) declare data: PaymentMethodResponseDto[];
}

export class PaymentMethodSuccessResponseDto extends ApiSuccessResponseDto<PaymentMethodResponseDto> {
  @ApiProperty({ type: PaymentMethodResponseDto }) declare data: PaymentMethodResponseDto;
}

export class CheckoutSessionSuccessResponseDto extends ApiSuccessResponseDto<CheckoutSessionResponseDto> {
  @ApiProperty({ type: CheckoutSessionResponseDto }) declare data: CheckoutSessionResponseDto;
}

export class PortalSessionSuccessResponseDto extends ApiSuccessResponseDto<PortalSessionResponseDto> {
  @ApiProperty({ type: PortalSessionResponseDto }) declare data: PortalSessionResponseDto;
}

export class SetupIntentSuccessResponseDto extends ApiSuccessResponseDto<CreateSetupIntentResponseDto> {
  @ApiProperty({ type: CreateSetupIntentResponseDto }) declare data: CreateSetupIntentResponseDto;
}
