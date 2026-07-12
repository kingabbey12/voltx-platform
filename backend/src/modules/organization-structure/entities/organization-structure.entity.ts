import { BusinessUnit, CostCenter, Department, Team } from '@prisma/client';

export interface BusinessUnitEntity {
  id: string;
  organizationId: string;
  name: string;
  parentBusinessUnitId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentEntity {
  id: string;
  organizationId: string;
  name: string;
  parentDepartmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamEntity {
  id: string;
  organizationId: string;
  name: string;
  departmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostCenterEntity {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toBusinessUnitEntity = (record: BusinessUnit): BusinessUnitEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  name: record.name,
  parentBusinessUnitId: record.parentBusinessUnitId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const toDepartmentEntity = (record: Department): DepartmentEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  name: record.name,
  parentDepartmentId: record.parentDepartmentId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const toTeamEntity = (record: Team): TeamEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  name: record.name,
  departmentId: record.departmentId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const toCostCenterEntity = (record: CostCenter): CostCenterEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  name: record.name,
  code: record.code,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
