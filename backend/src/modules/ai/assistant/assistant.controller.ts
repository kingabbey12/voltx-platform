import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { writeGatewayEventStreamToResponse } from '../streaming/write-gateway-stream-to-response';
import { AssistantService, AssistantSessionResult } from './assistant.service';

class AssistantSessionResponseDto implements AssistantSessionResult {
  conversationId!: string;
  agentId!: string;
  suggestedPrompts!: string[];
}

class AssistantSessionSuccessResponseDto extends ApiSuccessResponseDto<AssistantSessionResponseDto> {}

class AssistantRunDto {
  @IsUUID()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  objective!: string;
}

@ApiTags('AI Executive Assistant')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Controller('ai/assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('session')
  @ApiOperation({
    summary: 'Start an Executive Assistant session with a tenant-scoped conversation',
  })
  @ApiCreatedResponse({ type: AssistantSessionSuccessResponseDto })
  @Permissions('ai.agent.run')
  createSession(): Promise<AssistantSessionResult> {
    return this.assistantService.createSession();
  }

  @Post('run/stream')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run')
  @ApiOperation({ summary: 'Run the Executive Assistant with server-generated business context' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  async runStream(
    @Body() dto: AssistantRunDto,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeGatewayEventStreamToResponse(response, (signal) =>
      this.assistantService.runStream(dto, user.permissions, signal),
    );
  }
}
