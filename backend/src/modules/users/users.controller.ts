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
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
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
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiOkResponse({ description: 'Current user profile', type: UserSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  @ApiNotFoundResponse({ description: 'User not found' })
  getMe(): Promise<UserResponseDto> {
    return this.usersService.getMe();
  }

  @Patch('me')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('user.update')
  @ApiOperation({ summary: 'Update the current authenticated user profile' })
  @ApiOkResponse({ description: 'Updated user profile', type: UserSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateMe(@Body() dto: UpdateCurrentUserDto): Promise<UserResponseDto> {
    return this.usersService.updateMe(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('user.read')
  @ApiOperation({ summary: 'List users in the current organization' })
  @ApiOkResponse({
    description: 'Paginated list of users',
    type: PaginatedUsersSuccessResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findAll(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get user by ID within the current organization' })
  @ApiOkResponse({ description: 'User details', type: UserSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }
}
