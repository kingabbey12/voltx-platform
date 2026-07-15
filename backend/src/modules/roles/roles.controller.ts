import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleListResponseDto, RoleResponseDto } from './dto/role-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleService } from './role.service';

class RoleSuccessResponseDto extends ApiSuccessResponseDto<RoleResponseDto> {}

class RoleListSuccessResponseDto extends ApiSuccessResponseDto<RoleListResponseDto> {}

@ApiTags('Roles')
@ApiBearerAuth('JWT')
@Controller('roles')
export class RolesController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('role.read')
  @ApiOperation({ summary: "List every system role plus this organization's custom roles" })
  @ApiOkResponse({ description: 'Role catalog', type: RoleListSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findAll(@CurrentUser() user: CurrentUserInterface): Promise<RoleListResponseDto> {
    return this.roleService.findAll(user.organizationId);
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('role.read')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiOkResponse({ description: 'Role details', type: RoleSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<RoleResponseDto> {
    return this.roleService.findOne(id, user.organizationId);
  }

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('role.create')
  @ApiOperation({ summary: 'Create a custom role for this organization' })
  @ApiCreatedResponse({ description: 'Role created', type: RoleSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<RoleResponseDto> {
    return this.roleService.create(user.organizationId, dto);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('role.update')
  @ApiOperation({ summary: "Update one of this organization's custom roles" })
  @ApiOkResponse({ description: 'Role updated', type: RoleSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiForbiddenResponse({ description: 'System roles cannot be modified' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<RoleResponseDto> {
    return this.roleService.update(id, user.organizationId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('role.delete')
  @ApiOperation({ summary: "Delete one of this organization's custom roles" })
  @ApiOkResponse({ description: 'Role deleted' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiForbiddenResponse({ description: 'System roles cannot be deleted' })
  @ApiConflictResponse({ description: 'Role still has active members assigned' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<void> {
    return this.roleService.delete(id, user.organizationId);
  }
}
