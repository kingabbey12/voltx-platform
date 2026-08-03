import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { writeGatewayEventStreamToResponse } from '../streaming/write-gateway-stream-to-response';
import { OrchestrateDto, OrchestrationResponseDto } from './orchestrator.dto';
import { OrchestratorService } from './orchestrator.service';

@ApiTags('AI Multi-Agent Orchestrator')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Controller('ai/orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run')
  @ApiOperation({
    summary: 'Coordinate the specialized agents deterministically over a business objective',
  })
  @ApiOkResponse({ type: OrchestrationResponseDto })
  run(@Body() dto: OrchestrateDto, @CurrentUser() user: CurrentUserInterface) {
    return this.orchestrator.orchestrate(dto.objective, user.permissions);
  }

  @Post('run/stream')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run')
  @ApiOperation({ summary: 'Stream orchestration progress over the shared SSE transport' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  async runStream(
    @Body() dto: OrchestrateDto,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeGatewayEventStreamToResponse(response, (signal) =>
      this.orchestrator.stream(dto.objective, user.permissions, signal),
    );
  }
}
