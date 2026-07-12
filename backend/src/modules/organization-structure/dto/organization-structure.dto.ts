import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import {
  BusinessUnitEntity,
  CostCenterEntity,
  DepartmentEntity,
  TeamEntity,
} from '../entities/organization-structure.entity';

export class CreateBusinessUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentBusinessUnitId?: string;
}

export class UpdateBusinessUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentBusinessUnitId?: string | null;
}

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string | null;
}

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}

export class CreateCostCenterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;
}

export class UpdateCostCenterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;
}

export class TagMembershipDto {
  @IsOptional()
  @IsUUID()
  businessUnitId?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;
}

export class BusinessUnitResponseDto {
  id!: string;
  name!: string;
  parentBusinessUnitId!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: BusinessUnitEntity): BusinessUnitResponseDto {
    const dto = new BusinessUnitResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.parentBusinessUnitId = entity.parentBusinessUnitId;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class DepartmentResponseDto {
  id!: string;
  name!: string;
  parentDepartmentId!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: DepartmentEntity): DepartmentResponseDto {
    const dto = new DepartmentResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.parentDepartmentId = entity.parentDepartmentId;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class TeamResponseDto {
  id!: string;
  name!: string;
  departmentId!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: TeamEntity): TeamResponseDto {
    const dto = new TeamResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.departmentId = entity.departmentId;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class CostCenterResponseDto {
  id!: string;
  name!: string;
  code!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: CostCenterEntity): CostCenterResponseDto {
    const dto = new CostCenterResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.code = entity.code;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
