import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { WorkflowWebhookEntity } from '../entities/workflow-webhook.entity';

export class SetWorkflowWebhookEnabledDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;
}

export class WorkflowWebhookResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowId!: string;
  @ApiProperty() token!: string;
  @ApiProperty() enabled!: boolean;
  @ApiPropertyOptional() lastTriggeredAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowWebhookEntity): WorkflowWebhookResponseDto {
    const dto = new WorkflowWebhookResponseDto();
    dto.id = entity.id;
    dto.workflowId = entity.workflowId;
    dto.token = entity.token;
    dto.enabled = entity.enabled;
    dto.lastTriggeredAt = entity.lastTriggeredAt ? entity.lastTriggeredAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

/** Returned only once, at creation — the caller must copy it immediately, it is never retrievable again. */
export class WorkflowWebhookCreatedResponseDto extends WorkflowWebhookResponseDto {
  @ApiProperty({ example: 'a1b2c3...' }) secret!: string;
}

export class WorkflowWebhookSuccessResponseDto extends ApiSuccessResponseDto<WorkflowWebhookResponseDto> {}
export class WorkflowWebhookCreatedSuccessResponseDto extends ApiSuccessResponseDto<WorkflowWebhookCreatedResponseDto> {}
export class WorkflowWebhookListSuccessResponseDto extends ApiSuccessResponseDto<
  WorkflowWebhookResponseDto[]
> {}
