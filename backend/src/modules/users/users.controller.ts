import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AUTH_GUARDS } from '../auth/guards/auth.guards';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { ListUsersQueryDto, PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UpdateCurrentUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

class UserSuccessResponseDto extends ApiSuccessResponseDto<UserResponseDto> {}

class PaginatedUsersSuccessResponseDto extends ApiSuccessResponseDto<PaginatedUsersDto> {}

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(...AUTH_GUARDS)
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiOkResponse({ description: 'Current user profile', type: UserSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  @ApiNotFoundResponse({ description: 'User not found' })
  getMe(@CurrentUser() user: CurrentUserInterface): Promise<UserResponseDto> {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @UseGuards(...AUTH_GUARDS)
  @ApiOperation({ summary: 'Update the current authenticated user profile' })
  @ApiOkResponse({ description: 'Updated user profile', type: UserSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateMe(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: UpdateCurrentUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateMe(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({
    description: 'Paginated list of users',
    type: PaginatedUsersSuccessResponseDto,
  })
  findAll(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiOkResponse({ description: 'User details', type: UserSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }
}
