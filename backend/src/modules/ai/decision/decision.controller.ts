import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { ExecutiveDecisionsResponseDto } from './decision.dto';
import { ExecutiveDecisionsService } from './decision.service';

@ApiTags('AI Executive Decisions')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Controller('ai/decisions')
export class ExecutiveDecisionsController {
  constructor(private readonly decisions: ExecutiveDecisionsService) {}

  @Get()
  @Permissions('ai.agent.run')
  @ApiOperation({
    summary: 'Deterministic, evidence-backed business decisions derived from Executive Insights',
  })
  @ApiOkResponse({ type: ExecutiveDecisionsResponseDto })
  getDecisions(@CurrentUser() user: CurrentUserInterface) {
    return this.decisions.generate(user.permissions);
  }
}
