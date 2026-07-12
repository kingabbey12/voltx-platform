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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  BusinessUnitResponseDto,
  CostCenterResponseDto,
  CreateBusinessUnitDto,
  CreateCostCenterDto,
  CreateDepartmentDto,
  CreateTeamDto,
  DepartmentResponseDto,
  TagMembershipDto,
  TeamResponseDto,
  UpdateBusinessUnitDto,
  UpdateCostCenterDto,
  UpdateDepartmentDto,
  UpdateTeamDto,
} from './dto/organization-structure.dto';
import { OrganizationStructureService } from './organization-structure.service';

@ApiTags('Enterprise Organization Structure')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/structure')
export class OrganizationStructureController {
  constructor(private readonly service: OrganizationStructureService) {}

  // --- Business Units ---
  @Post('business-units')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Create a business unit' })
  async createBusinessUnit(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateBusinessUnitDto,
  ): Promise<BusinessUnitResponseDto> {
    const entity = await this.service.createBusinessUnit(organizationId, dto);
    return BusinessUnitResponseDto.fromEntity(entity);
  }

  @Get('business-units')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.read')
  @ApiOperation({ summary: 'List business units' })
  async listBusinessUnits(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<BusinessUnitResponseDto[]> {
    const entities = await this.service.listBusinessUnits(organizationId);
    return entities.map((entity) => BusinessUnitResponseDto.fromEntity(entity));
  }

  @Patch('business-units/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Update a business unit' })
  async updateBusinessUnit(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessUnitDto,
  ): Promise<BusinessUnitResponseDto> {
    const entity = await this.service.updateBusinessUnit(organizationId, id, dto);
    return BusinessUnitResponseDto.fromEntity(entity);
  }

  @Delete('business-units/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Delete a business unit' })
  async deleteBusinessUnit(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.deleteBusinessUnit(organizationId, id);
    return { message: 'Business unit deleted' };
  }

  // --- Departments ---
  @Post('departments')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Create a department' })
  async createDepartment(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const entity = await this.service.createDepartment(organizationId, dto);
    return DepartmentResponseDto.fromEntity(entity);
  }

  @Get('departments')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.read')
  @ApiOperation({ summary: 'List departments' })
  async listDepartments(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<DepartmentResponseDto[]> {
    const entities = await this.service.listDepartments(organizationId);
    return entities.map((entity) => DepartmentResponseDto.fromEntity(entity));
  }

  @Patch('departments/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Update a department' })
  async updateDepartment(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const entity = await this.service.updateDepartment(organizationId, id, dto);
    return DepartmentResponseDto.fromEntity(entity);
  }

  @Delete('departments/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Delete a department' })
  async deleteDepartment(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.deleteDepartment(organizationId, id);
    return { message: 'Department deleted' };
  }

  // --- Teams ---
  @Post('teams')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Create a team' })
  async createTeam(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    const entity = await this.service.createTeam(organizationId, dto);
    return TeamResponseDto.fromEntity(entity);
  }

  @Get('teams')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.read')
  @ApiOperation({ summary: 'List teams' })
  async listTeams(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<TeamResponseDto[]> {
    const entities = await this.service.listTeams(organizationId);
    return entities.map((entity) => TeamResponseDto.fromEntity(entity));
  }

  @Patch('teams/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Update a team' })
  async updateTeam(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    const entity = await this.service.updateTeam(organizationId, id, dto);
    return TeamResponseDto.fromEntity(entity);
  }

  @Delete('teams/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Delete a team' })
  async deleteTeam(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.deleteTeam(organizationId, id);
    return { message: 'Team deleted' };
  }

  // --- Cost Centers ---
  @Post('cost-centers')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Create a cost center' })
  async createCostCenter(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateCostCenterDto,
  ): Promise<CostCenterResponseDto> {
    const entity = await this.service.createCostCenter(organizationId, dto);
    return CostCenterResponseDto.fromEntity(entity);
  }

  @Get('cost-centers')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.read')
  @ApiOperation({ summary: 'List cost centers' })
  async listCostCenters(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<CostCenterResponseDto[]> {
    const entities = await this.service.listCostCenters(organizationId);
    return entities.map((entity) => CostCenterResponseDto.fromEntity(entity));
  }

  @Patch('cost-centers/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Update a cost center' })
  async updateCostCenter(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCostCenterDto,
  ): Promise<CostCenterResponseDto> {
    const entity = await this.service.updateCostCenter(organizationId, id, dto);
    return CostCenterResponseDto.fromEntity(entity);
  }

  @Delete('cost-centers/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Delete a cost center' })
  async deleteCostCenter(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.deleteCostCenter(organizationId, id);
    return { message: 'Cost center deleted' };
  }

  // --- Membership tagging ---
  @Patch('memberships/:membershipId/tags')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.hierarchy.manage')
  @ApiOperation({ summary: 'Tag a membership with its business unit/department/team' })
  async tagMembership(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: TagMembershipDto,
  ): Promise<{ message: string }> {
    await this.service.tagMembership(organizationId, membershipId, dto);
    return { message: 'Membership tags updated' };
  }
}
