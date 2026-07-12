import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentAuthPrincipal } from '../../auth/decorators/current-auth-principal.decorator';
import { AuthPrincipal } from '../../auth/interfaces/auth-principal.interface';
import {
  ListSupportSessionsQueryDto,
  StartSupportSessionDto,
  StartSupportSessionResponseDto,
  SupportSessionResponseDto,
} from './dto/support-session.dto';
import { SupportSessionService } from './support-session.service';

@ApiTags('Platform Admin — Customer Success')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/support-sessions')
export class SupportSessionController {
  constructor(private readonly service: SupportSessionService) {}

  @Post()
  @ApiOperation({
    summary:
      'Platform admin: start an impersonation session for an organization (mandatory reason)',
  })
  async start(
    @CurrentAuthPrincipal() principal: AuthPrincipal,
    @Body() dto: StartSupportSessionDto,
  ): Promise<StartSupportSessionResponseDto> {
    const result = await this.service.start(principal.userId, dto);
    return {
      session: SupportSessionResponseDto.fromEntity(result.session),
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Platform admin: list support sessions (the impersonation audit trail)',
  })
  async list(@Query() query: ListSupportSessionsQueryDto): Promise<SupportSessionResponseDto[]> {
    const sessions = await this.service.list(query);
    return sessions.map((session) => SupportSessionResponseDto.fromEntity(session));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Platform admin: get a support session by id' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<SupportSessionResponseDto> {
    const session = await this.service.getOrThrow(id);
    return SupportSessionResponseDto.fromEntity(session);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Platform admin: end a support session early — instantly revokes its impersonation access token',
  })
  async end(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuthPrincipal() principal: AuthPrincipal,
  ): Promise<SupportSessionResponseDto> {
    const session = await this.service.end(id, principal.userId);
    return SupportSessionResponseDto.fromEntity(session);
  }
}
