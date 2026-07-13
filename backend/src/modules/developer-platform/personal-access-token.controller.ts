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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreatePersonalAccessTokenDto,
  CreatePersonalAccessTokenResponseDto,
  PersonalAccessTokenResponseDto,
} from './dto/personal-access-token.dto';
import { PersonalAccessTokenService } from './personal-access-token.service';

class PersonalAccessTokenSuccessResponseDto extends ApiSuccessResponseDto<CreatePersonalAccessTokenResponseDto> {}
class PersonalAccessTokenListSuccessResponseDto extends ApiSuccessResponseDto<
  PersonalAccessTokenResponseDto[]
> {}

@ApiTags('Developer Platform — Personal Access Tokens')
@ApiBearerAuth('JWT')
@Controller('developer/personal-access-tokens')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Permissions('developer_platform.personal_access_token.manage')
export class PersonalAccessTokenController {
  constructor(private readonly service: PersonalAccessTokenService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a personal access token',
    description: 'The full token is returned exactly once in this response and never again.',
  })
  @ApiCreatedResponse({
    description: 'Personal access token created',
    type: PersonalAccessTokenSuccessResponseDto,
  })
  create(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreatePersonalAccessTokenDto,
  ): Promise<CreatePersonalAccessTokenResponseDto> {
    return this.service.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's own personal access tokens (redacted)" })
  @ApiOkResponse({
    description: 'Personal access tokens',
    type: PersonalAccessTokenListSuccessResponseDto,
  })
  list(@CurrentUser() user: CurrentUserInterface): Promise<PersonalAccessTokenResponseDto[]> {
    return this.service.list(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a personal access token' })
  @ApiOkResponse({ description: 'Personal access token revoked' })
  async revoke(
    @CurrentUser() user: CurrentUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.revoke(id, user.id);
    return { message: 'Personal access token revoked' };
  }
}
