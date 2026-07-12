import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateBusinessUnitDto,
  CreateCostCenterDto,
  CreateDepartmentDto,
  CreateTeamDto,
  TagMembershipDto,
  UpdateBusinessUnitDto,
  UpdateCostCenterDto,
  UpdateDepartmentDto,
  UpdateTeamDto,
} from './dto/organization-structure.dto';
import {
  BusinessUnitEntity,
  CostCenterEntity,
  DepartmentEntity,
  TeamEntity,
} from './entities/organization-structure.entity';
import { OrganizationStructureRepository } from './organization-structure.repository';

@Injectable()
export class OrganizationStructureService {
  constructor(
    private readonly repository: OrganizationStructureRepository,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  // --- Business Units ---
  async createBusinessUnit(
    organizationId: string,
    dto: CreateBusinessUnitDto,
  ): Promise<BusinessUnitEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    if (dto.parentBusinessUnitId) {
      await this.getBusinessUnitOrThrow(organizationId, dto.parentBusinessUnitId);
    }
    const entity = await this.repository.createBusinessUnit(
      organizationId,
      dto.name,
      dto.parentBusinessUnitId,
    );
    await this.auditService.record({
      action: 'create',
      resource: 'business_unit',
      resourceId: entity.id,
      metadata: { organizationId },
    });
    return entity;
  }

  async listBusinessUnits(organizationId: string): Promise<BusinessUnitEntity[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    return this.repository.listBusinessUnits(organizationId);
  }

  async updateBusinessUnit(
    organizationId: string,
    id: string,
    dto: UpdateBusinessUnitDto,
  ): Promise<BusinessUnitEntity> {
    await this.getBusinessUnitOrThrow(organizationId, id);

    if (dto.parentBusinessUnitId) {
      if (dto.parentBusinessUnitId === id) {
        throw new BadRequestException('A business unit cannot be its own parent');
      }
      await this.getBusinessUnitOrThrow(organizationId, dto.parentBusinessUnitId);
      const ancestorIds = await this.repository.getBusinessUnitParentChainIds(
        organizationId,
        dto.parentBusinessUnitId,
      );
      if (ancestorIds.includes(id)) {
        throw new BadRequestException('This would create a cycle in the business unit hierarchy');
      }
    }

    const entity = await this.repository.updateBusinessUnit(id, {
      name: dto.name,
      parentBusinessUnitId: dto.parentBusinessUnitId,
    });
    await this.auditService.record({
      action: 'update',
      resource: 'business_unit',
      resourceId: id,
      metadata: { organizationId },
    });
    return entity;
  }

  async deleteBusinessUnit(organizationId: string, id: string): Promise<void> {
    await this.getBusinessUnitOrThrow(organizationId, id);
    await this.repository.deleteBusinessUnit(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'business_unit',
      resourceId: id,
      metadata: { organizationId },
    });
  }

  private async getBusinessUnitOrThrow(
    organizationId: string,
    id: string,
  ): Promise<BusinessUnitEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.findBusinessUnitInOrg(organizationId, id);
    if (!entity) {
      throw new NotFoundException('Business unit not found');
    }
    return entity;
  }

  // --- Departments ---
  async createDepartment(
    organizationId: string,
    dto: CreateDepartmentDto,
  ): Promise<DepartmentEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    if (dto.parentDepartmentId) {
      await this.getDepartmentOrThrow(organizationId, dto.parentDepartmentId);
    }
    const entity = await this.repository.createDepartment(
      organizationId,
      dto.name,
      dto.parentDepartmentId,
    );
    await this.auditService.record({
      action: 'create',
      resource: 'department',
      resourceId: entity.id,
      metadata: { organizationId },
    });
    return entity;
  }

  async listDepartments(organizationId: string): Promise<DepartmentEntity[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    return this.repository.listDepartments(organizationId);
  }

  async updateDepartment(
    organizationId: string,
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentEntity> {
    await this.getDepartmentOrThrow(organizationId, id);

    if (dto.parentDepartmentId) {
      if (dto.parentDepartmentId === id) {
        throw new BadRequestException('A department cannot be its own parent');
      }
      await this.getDepartmentOrThrow(organizationId, dto.parentDepartmentId);
      const ancestorIds = await this.repository.getDepartmentParentChainIds(
        organizationId,
        dto.parentDepartmentId,
      );
      if (ancestorIds.includes(id)) {
        throw new BadRequestException('This would create a cycle in the department hierarchy');
      }
    }

    const entity = await this.repository.updateDepartment(id, {
      name: dto.name,
      parentDepartmentId: dto.parentDepartmentId,
    });
    await this.auditService.record({
      action: 'update',
      resource: 'department',
      resourceId: id,
      metadata: { organizationId },
    });
    return entity;
  }

  async deleteDepartment(organizationId: string, id: string): Promise<void> {
    await this.getDepartmentOrThrow(organizationId, id);
    await this.repository.deleteDepartment(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'department',
      resourceId: id,
      metadata: { organizationId },
    });
  }

  private async getDepartmentOrThrow(
    organizationId: string,
    id: string,
  ): Promise<DepartmentEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.findDepartmentInOrg(organizationId, id);
    if (!entity) {
      throw new NotFoundException('Department not found');
    }
    return entity;
  }

  // --- Teams ---
  async createTeam(organizationId: string, dto: CreateTeamDto): Promise<TeamEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    if (dto.departmentId) {
      await this.getDepartmentOrThrow(organizationId, dto.departmentId);
    }
    const entity = await this.repository.createTeam(organizationId, dto.name, dto.departmentId);
    await this.auditService.record({
      action: 'create',
      resource: 'team',
      resourceId: entity.id,
      metadata: { organizationId },
    });
    return entity;
  }

  async listTeams(organizationId: string): Promise<TeamEntity[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    return this.repository.listTeams(organizationId);
  }

  async updateTeam(organizationId: string, id: string, dto: UpdateTeamDto): Promise<TeamEntity> {
    await this.getTeamOrThrow(organizationId, id);
    if (dto.departmentId) {
      await this.getDepartmentOrThrow(organizationId, dto.departmentId);
    }
    const entity = await this.repository.updateTeam(id, {
      name: dto.name,
      departmentId: dto.departmentId,
    });
    await this.auditService.record({
      action: 'update',
      resource: 'team',
      resourceId: id,
      metadata: { organizationId },
    });
    return entity;
  }

  async deleteTeam(organizationId: string, id: string): Promise<void> {
    await this.getTeamOrThrow(organizationId, id);
    await this.repository.deleteTeam(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'team',
      resourceId: id,
      metadata: { organizationId },
    });
  }

  private async getTeamOrThrow(organizationId: string, id: string): Promise<TeamEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.findTeamInOrg(organizationId, id);
    if (!entity) {
      throw new NotFoundException('Team not found');
    }
    return entity;
  }

  // --- Cost Centers ---
  async createCostCenter(
    organizationId: string,
    dto: CreateCostCenterDto,
  ): Promise<CostCenterEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.createCostCenter(organizationId, dto.name, dto.code);
    await this.auditService.record({
      action: 'create',
      resource: 'cost_center',
      resourceId: entity.id,
      metadata: { organizationId },
    });
    return entity;
  }

  async listCostCenters(organizationId: string): Promise<CostCenterEntity[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    return this.repository.listCostCenters(organizationId);
  }

  async updateCostCenter(
    organizationId: string,
    id: string,
    dto: UpdateCostCenterDto,
  ): Promise<CostCenterEntity> {
    await this.getCostCenterOrThrow(organizationId, id);
    const entity = await this.repository.updateCostCenter(id, { name: dto.name, code: dto.code });
    await this.auditService.record({
      action: 'update',
      resource: 'cost_center',
      resourceId: id,
      metadata: { organizationId },
    });
    return entity;
  }

  async deleteCostCenter(organizationId: string, id: string): Promise<void> {
    await this.getCostCenterOrThrow(organizationId, id);
    await this.repository.deleteCostCenter(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'cost_center',
      resourceId: id,
      metadata: { organizationId },
    });
  }

  private async getCostCenterOrThrow(
    organizationId: string,
    id: string,
  ): Promise<CostCenterEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.findCostCenterInOrg(organizationId, id);
    if (!entity) {
      throw new NotFoundException('Cost center not found');
    }
    return entity;
  }

  // --- Membership tagging ---
  async tagMembership(
    organizationId: string,
    membershipId: string,
    dto: TagMembershipDto,
  ): Promise<void> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    if (dto.businessUnitId) {
      await this.getBusinessUnitOrThrow(organizationId, dto.businessUnitId);
    }
    if (dto.departmentId) {
      await this.getDepartmentOrThrow(organizationId, dto.departmentId);
    }
    if (dto.teamId) {
      await this.getTeamOrThrow(organizationId, dto.teamId);
    }
    await this.repository.tagMembership(organizationId, membershipId, dto);
    await this.auditService.record({
      action: 'tag',
      resource: 'membership',
      resourceId: membershipId,
      metadata: { organizationId, ...dto },
    });
  }
}
