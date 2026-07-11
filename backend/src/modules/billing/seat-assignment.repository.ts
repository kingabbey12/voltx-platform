import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { SeatAssignmentEntity } from './entities/seat-assignment.entity';

interface SeatAssignmentRecord {
  id: string;
  organizationId: string;
  subscriptionId: string;
  membershipId: string;
  assignedAt: Date;
  releasedAt: Date | null;
}

@Injectable()
export class SeatAssignmentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async findActiveByMembershipId(membershipId: string): Promise<SeatAssignmentEntity | null> {
    const record = await this.prisma.system.seatAssignment.findFirst({
      where: { membershipId, releasedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  async countActive(subscriptionId: string): Promise<number> {
    return this.prisma.system.seatAssignment.count({
      where: { subscriptionId, releasedAt: null },
    });
  }

  async countActiveForCurrentOrganization(subscriptionId: string): Promise<number> {
    this.tenantContextService.getOrThrow();
    return this.countActive(subscriptionId);
  }

  async assign(
    organizationId: string,
    subscriptionId: string,
    membershipId: string,
  ): Promise<SeatAssignmentEntity> {
    const record = await this.prisma.system.seatAssignment.create({
      data: { organizationId, subscriptionId, membershipId },
    });
    return toEntity(record);
  }

  async release(id: string): Promise<SeatAssignmentEntity> {
    const record = await this.prisma.system.seatAssignment.update({
      where: { id },
      data: { releasedAt: new Date() },
    });
    return toEntity(record);
  }

  async listActiveForOrganization(organizationId: string): Promise<SeatAssignmentEntity[]> {
    const records = await this.prisma.system.seatAssignment.findMany({
      where: { organizationId, releasedAt: null },
      orderBy: [{ assignedAt: 'asc' }],
    });
    return records.map(toEntity);
  }
}

function toEntity(record: SeatAssignmentRecord): SeatAssignmentEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    subscriptionId: record.subscriptionId,
    membershipId: record.membershipId,
    assignedAt: record.assignedAt,
    releasedAt: record.releasedAt,
  };
}
