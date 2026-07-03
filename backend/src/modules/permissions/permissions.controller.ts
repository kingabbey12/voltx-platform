import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../auth/guards/auth.guards';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { Permissions } from './decorators/permissions.decorator';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionService } from './permission.service';

class PermissionListResponseDto extends ApiSuccessResponseDto<PermissionResponseDto[]> {}

@ApiTags('Permissions')
@ApiBearerAuth('JWT')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('permission.read')
  @ApiOperation({ summary: 'List all permissions' })
  @ApiOkResponse({ description: 'Permission catalog', type: PermissionListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findAll(): Promise<PermissionResponseDto[]> {
    return this.permissionService.findAll();
  }
}
