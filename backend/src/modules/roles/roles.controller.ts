import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../auth/guards/auth.guards';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RoleListResponseDto, RoleResponseDto } from './dto/role-response.dto';
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
  @ApiOperation({ summary: 'List all roles' })
  @ApiOkResponse({ description: 'Role catalog', type: RoleListSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findAll(): Promise<RoleListResponseDto> {
    return this.roleService.findAll();
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('role.read')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiOkResponse({ description: 'Role details', type: RoleSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RoleResponseDto> {
    return this.roleService.findOne(id);
  }
}
