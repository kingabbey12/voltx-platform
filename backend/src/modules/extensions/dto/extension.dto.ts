import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExtensionWidgetPlacement } from '@prisma/client';
import {
  ExtensionAiToolEntity,
  ExtensionCustomNavEntryEntity,
  ExtensionCustomPageEntity,
  ExtensionCustomWidgetEntity,
} from '../entities/extension.entity';

export class ExtensionPageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() path!: string;
  @ApiProperty({ type: Object }) manifest!: unknown;

  static fromEntity(entity: ExtensionCustomPageEntity): ExtensionPageResponseDto {
    const dto = new ExtensionPageResponseDto();
    dto.id = entity.id;
    dto.path = entity.path;
    dto.manifest = entity.manifest;
    return dto;
  }
}

export class ExtensionWidgetResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ExtensionWidgetPlacement }) placement!: ExtensionWidgetPlacement;
  @ApiProperty({ type: Object }) manifest!: unknown;

  static fromEntity(entity: ExtensionCustomWidgetEntity): ExtensionWidgetResponseDto {
    const dto = new ExtensionWidgetResponseDto();
    dto.id = entity.id;
    dto.placement = entity.placement;
    dto.manifest = entity.manifest;
    return dto;
  }
}

export class ExtensionNavEntryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiPropertyOptional({ nullable: true }) icon!: string | null;
  @ApiProperty() targetPath!: string;

  static fromEntity(entity: ExtensionCustomNavEntryEntity): ExtensionNavEntryResponseDto {
    const dto = new ExtensionNavEntryResponseDto();
    dto.id = entity.id;
    dto.label = entity.label;
    dto.icon = entity.icon;
    dto.targetPath = entity.targetPath;
    return dto;
  }
}

/** Everything an installing organization's web app needs to render its
 * installed apps' Custom Pages/Widgets/Nav — Custom AI Tools are
 * deliberately excluded here since those are only ever consumed by the
 * AI runtime (see ExtensionAiToolSourceService), never rendered. */
export class InstalledExtensionsResponseDto {
  @ApiProperty({ type: [ExtensionPageResponseDto] }) pages!: ExtensionPageResponseDto[];
  @ApiProperty({ type: [ExtensionWidgetResponseDto] }) widgets!: ExtensionWidgetResponseDto[];
  @ApiProperty({ type: [ExtensionNavEntryResponseDto] })
  navEntries!: ExtensionNavEntryResponseDto[];
}

/** Developer-facing view of their own app's materialized AI tools,
 * including the current decrypted signing secret the developer must
 * configure on their own endpoint to verify inbound calls — shown live
 * (not "once at creation") since it's the owning developer organization's
 * own secret being re-read from within its own tenant boundary. */
export class ExtensionAiToolResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: Object }) parametersSchema!: unknown;
  @ApiProperty({ type: Object }) responseSchema!: unknown;
  @ApiProperty() endpointUrl!: string;
  @ApiProperty() signingSecret!: string;

  static fromEntity(
    entity: ExtensionAiToolEntity,
    signingSecret: string,
  ): ExtensionAiToolResponseDto {
    const dto = new ExtensionAiToolResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.parametersSchema = entity.parametersSchema;
    dto.responseSchema = entity.responseSchema;
    dto.endpointUrl = entity.endpointUrl;
    dto.signingSecret = signingSecret;
    return dto;
  }
}
