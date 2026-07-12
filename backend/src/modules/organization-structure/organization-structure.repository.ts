import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  BusinessUnitEntity,
  CostCenterEntity,
  DepartmentEntity,
  TeamEntity,
  toBusinessUnitEntity,
  toCostCenterEntity,
  toDepartmentEntity,
  toTeamEntity,
} from './entities/organization-structure.entity';

@Injectable()
export class OrganizationStructureRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Business Units ---
  async createBusinessUnit(
    organizationId: string,
    name: string,
    parentBusinessUnitId?: string,
  ): Promise<BusinessUnitEntity> {
    const record = await this.prisma.businessUnit.create({
      data: { organizationId, name, parentBusinessUnitId },
    });
    return toBusinessUnitEntity(record);
  }

  async listBusinessUnits(organizationId: string): Promise<BusinessUnitEntity[]> {
    const records = await this.prisma.businessUnit.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toBusinessUnitEntity);
  }

  async findBusinessUnitInOrg(
    organizationId: string,
    id: string,
  ): Promise<BusinessUnitEntity | null> {
    const record = await this.prisma.businessUnit.findFirst({ where: { id, organizationId } });
    return record ? toBusinessUnitEntity(record) : null;
  }

  async updateBusinessUnit(
    id: string,
    data: { name?: string; parentBusinessUnitId?: string | null },
  ): Promise<BusinessUnitEntity> {
    const record = await this.prisma.businessUnit.update({ where: { id }, data });
    return toBusinessUnitEntity(record);
  }

  async deleteBusinessUnit(id: string): Promise<void> {
    await this.prisma.businessUnit.delete({ where: { id } });
  }

  // --- Departments ---
  async createDepartment(
    organizationId: string,
    name: string,
    parentDepartmentId?: string,
  ): Promise<DepartmentEntity> {
    const record = await this.prisma.department.create({
      data: { organizationId, name, parentDepartmentId },
    });
    return toDepartmentEntity(record);
  }

  async listDepartments(organizationId: string): Promise<DepartmentEntity[]> {
    const records = await this.prisma.department.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toDepartmentEntity);
  }

  async findDepartmentInOrg(organizationId: string, id: string): Promise<DepartmentEntity | null> {
    const record = await this.prisma.department.findFirst({ where: { id, organizationId } });
    return record ? toDepartmentEntity(record) : null;
  }

  async updateDepartment(
    id: string,
    data: { name?: string; parentDepartmentId?: string | null },
  ): Promise<DepartmentEntity> {
    const record = await this.prisma.department.update({ where: { id }, data });
    return toDepartmentEntity(record);
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.prisma.department.delete({ where: { id } });
  }

  // --- Teams ---
  async createTeam(
    organizationId: string,
    name: string,
    departmentId?: string,
  ): Promise<TeamEntity> {
    const record = await this.prisma.team.create({ data: { organizationId, name, departmentId } });
    return toTeamEntity(record);
  }

  async listTeams(organizationId: string): Promise<TeamEntity[]> {
    const records = await this.prisma.team.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toTeamEntity);
  }

  async findTeamInOrg(organizationId: string, id: string): Promise<TeamEntity | null> {
    const record = await this.prisma.team.findFirst({ where: { id, organizationId } });
    return record ? toTeamEntity(record) : null;
  }

  async updateTeam(
    id: string,
    data: { name?: string; departmentId?: string | null },
  ): Promise<TeamEntity> {
    const record = await this.prisma.team.update({ where: { id }, data });
    return toTeamEntity(record);
  }

  async deleteTeam(id: string): Promise<void> {
    await this.prisma.team.delete({ where: { id } });
  }

  // --- Cost Centers ---
  async createCostCenter(
    organizationId: string,
    name: string,
    code?: string,
  ): Promise<CostCenterEntity> {
    const record = await this.prisma.costCenter.create({ data: { organizationId, name, code } });
    return toCostCenterEntity(record);
  }

  async listCostCenters(organizationId: string): Promise<CostCenterEntity[]> {
    const records = await this.prisma.costCenter.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toCostCenterEntity);
  }

  async findCostCenterInOrg(organizationId: string, id: string): Promise<CostCenterEntity | null> {
    const record = await this.prisma.costCenter.findFirst({ where: { id, organizationId } });
    return record ? toCostCenterEntity(record) : null;
  }

  async updateCostCenter(
    id: string,
    data: { name?: string; code?: string | null },
  ): Promise<CostCenterEntity> {
    const record = await this.prisma.costCenter.update({ where: { id }, data });
    return toCostCenterEntity(record);
  }

  async deleteCostCenter(id: string): Promise<void> {
    await this.prisma.costCenter.delete({ where: { id } });
  }

  // --- Membership tagging ---
  async tagMembership(
    organizationId: string,
    membershipId: string,
    data: { businessUnitId?: string | null; departmentId?: string | null; teamId?: string | null },
  ): Promise<void> {
    await this.prisma.system.membership.update({
      where: { id: membershipId, organizationId },
      data,
    });
  }

  /** Walks a self-referencing hierarchy's parent chain; used for cycle-prevention before writing a new parent link. */
  async getBusinessUnitParentChainIds(organizationId: string, startId: string): Promise<string[]> {
    return this.walkParentChain(organizationId, startId, (id) =>
      this.prisma.businessUnit
        .findFirst({
          where: { id, organizationId },
          select: { parentBusinessUnitId: true },
        })
        .then((r) => r?.parentBusinessUnitId ?? null),
    );
  }

  async getDepartmentParentChainIds(organizationId: string, startId: string): Promise<string[]> {
    return this.walkParentChain(organizationId, startId, (id) =>
      this.prisma.department
        .findFirst({
          where: { id, organizationId },
          select: { parentDepartmentId: true },
        })
        .then((r) => r?.parentDepartmentId ?? null),
    );
  }

  private async walkParentChain(
    _organizationId: string,
    startId: string,
    getParentId: (id: string) => Promise<string | null>,
  ): Promise<string[]> {
    const chain: string[] = [];
    let currentId: string | null = startId;
    const seen = new Set<string>();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      currentId = await getParentId(currentId);
      if (currentId) {
        chain.push(currentId);
      }
    }
    return chain;
  }
}
