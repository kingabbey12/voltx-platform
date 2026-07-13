import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MarketplaceInstallStatus } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MarketplaceInstallEntity } from '../entities/marketplace-install.entity';

/** successUrl/cancelUrl are only required for paid apps (client-supplied
 * redirect targets after Stripe Checkout, same convention as
 * StripeCheckoutService.createCheckoutSession) — free apps ignore them. */
export class InstallMarketplaceAppDto {
  @ApiPropertyOptional({ example: 'https://app.voltx.example/marketplace/installed' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  successUrl?: string;

  @ApiPropertyOptional({ example: 'https://app.voltx.example/marketplace' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancelUrl?: string;
}

export class MarketplaceInstallResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() appId!: string;
  @ApiProperty() installedVersionId!: string;
  @ApiProperty({ enum: MarketplaceInstallStatus }) status!: MarketplaceInstallStatus;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: MarketplaceInstallEntity): MarketplaceInstallResponseDto {
    const dto = new MarketplaceInstallResponseDto();
    dto.id = entity.id;
    dto.appId = entity.appId;
    dto.installedVersionId = entity.installedVersionId;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

/** Returned by POST .../install. Free apps install synchronously (`install`
 * is populated, `checkoutUrl` is null); paid apps must complete a Stripe
 * Checkout session first (`checkoutUrl` is populated, `install` is null —
 * the real MarketplaceInstall row is only created once the webhook
 * confirms payment, see MarketplaceStripeWebhookDispatcherService). */
export class InstallAppResultDto {
  @ApiPropertyOptional({ nullable: true, type: MarketplaceInstallResponseDto })
  install!: MarketplaceInstallResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  checkoutUrl!: string | null;
}
