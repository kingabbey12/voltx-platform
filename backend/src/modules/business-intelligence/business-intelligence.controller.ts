import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { BusinessIntelligenceService } from './business-intelligence.service';
import {
  BusinessIntelligenceResponseDto,
  BusinessIntelligenceScoreDto,
} from './business-intelligence.dto';

@ApiTags('Business Intelligence')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Controller('business-intelligence')
export class BusinessIntelligenceController {
  constructor(private readonly businessIntelligence: BusinessIntelligenceService) {}
  @Get() @Permissions('ai.agent.run') @ApiOkResponse({ type: BusinessIntelligenceResponseDto }) get(
    @CurrentUser() user: CurrentUserInterface,
  ) {
    return this.businessIntelligence.generate(user.permissions);
  }
  @Get('health')
  @Permissions('ai.agent.run')
  @ApiOkResponse({ type: BusinessIntelligenceScoreDto })
  async health(@CurrentUser() user: CurrentUserInterface) {
    return (await this.businessIntelligence.generate(user.permissions)).executiveHealth;
  }
  @Get('departments')
  @Permissions('ai.agent.run')
  @ApiOkResponse({ type: [BusinessIntelligenceScoreDto] })
  async departments(@CurrentUser() user: CurrentUserInterface) {
    return (await this.businessIntelligence.generate(user.permissions)).departments;
  }
  @Get('scores')
  @Permissions('ai.agent.run')
  @ApiOkResponse({ type: BusinessIntelligenceResponseDto })
  scores(@CurrentUser() user: CurrentUserInterface) {
    return this.businessIntelligence.generate(user.permissions);
  }
  @Get('explain/:scoreId')
  @Permissions('ai.agent.run')
  @ApiNotFoundResponse({ description: 'Unknown score id.' })
  explain(@CurrentUser() user: CurrentUserInterface, @Param('scoreId') scoreId: string) {
    return this.businessIntelligence.explain(scoreId, user.permissions);
  }
}
