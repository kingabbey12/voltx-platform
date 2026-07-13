import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { PersonalAccessTokenGuard } from './guards/personal-access-token.guard';

class PersonalAccessTokenWhoamiResponseDto {
  organizationId!: string;
  permissions!: string[];
}

class PersonalAccessTokenWhoamiSuccessResponseDto extends ApiSuccessResponseDto<PersonalAccessTokenWhoamiResponseDto> {}

/**
 * Demonstrates and exercises PersonalAccessTokenGuard as a genuine
 * drop-in alternative to AUTH_GUARDS, mirroring ApiKeyAuthController —
 * this route requires no JWT at all, only a valid X-Personal-Access-Token
 * + X-Organization-Id pair. Lets a developer verify a token's effective,
 * intersected permissions in a specific organization without needing to
 * already know them.
 */
@ApiTags('Developer Platform — Personal Access Tokens')
@ApiSecurity('PersonalAccessToken')
@Controller('developer/personal-access-tokens/whoami')
@UseGuards(PersonalAccessTokenGuard)
export class PersonalAccessTokenAuthController {
  @Get()
  @ApiOperation({
    summary:
      "Resolve the calling personal access token's effective organization and scoped permissions",
  })
  @ApiOkResponse({
    description: 'Resolved personal access token context',
    type: PersonalAccessTokenWhoamiSuccessResponseDto,
  })
  whoami(@CurrentUser() user: CurrentUserInterface): PersonalAccessTokenWhoamiResponseDto {
    return {
      organizationId: user.organizationId,
      permissions: user.permissions,
    };
  }
}
