import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { LoginHistoryQueryDto, PaginatedSessionsDto, SessionResponseDto } from './dto/session.dto';
import { SessionsService } from './sessions.service';

class SessionListSuccessResponseDto extends ApiSuccessResponseDto<SessionResponseDto[]> {}
class PaginatedSessionsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedSessionsDto> {}

@ApiTags('Security — Sessions')
@ApiBearerAuth('JWT')
@Controller('security/sessions')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Permissions('security.session.manage')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's active sessions in this organization" })
  @ApiOkResponse({ description: 'Active sessions', type: SessionListSuccessResponseDto })
  list(@CurrentUser() user: CurrentUserInterface): Promise<SessionResponseDto[]> {
    return this.sessionsService.listActive(user.id, user.organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a session — immediately rejects every refresh token under it' })
  @ApiOkResponse({ description: 'Session revoked' })
  async revoke(
    @CurrentUser() user: CurrentUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.sessionsService.revoke(id, user.id, user.organizationId);
    return { message: 'Session revoked' };
  }
}

@ApiTags('Security — Sessions')
@ApiBearerAuth('JWT')
@Controller('security/login-history')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Permissions('security.session.manage')
export class LoginHistoryController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: "The authenticated user's login history in this organization" })
  @ApiOkResponse({
    description: 'Paginated login history',
    type: PaginatedSessionsSuccessResponseDto,
  })
  history(
    @CurrentUser() user: CurrentUserInterface,
    @Query() query: LoginHistoryQueryDto,
  ): Promise<PaginatedSessionsDto> {
    return this.sessionsService.loginHistory(user.id, user.organizationId, query);
  }
}
