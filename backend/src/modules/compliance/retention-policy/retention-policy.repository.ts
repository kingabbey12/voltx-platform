import { Injectable } from '@nestjs/common';
import { RetentionAction, RetentionPolicy, RetentionResourceType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateRetentionPolicyData {
  organizationId: string;
  resourceType: RetentionResourceType;
  retentionDays: number;
  action: RetentionAction;
  createdBy: string;
}

export interface UpdateRetentionPolicyData {
  retentionDays?: number;
  action?: RetentionAction;
  isActive?: boolean;
}

@Injectable()
export class RetentionPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws Prisma's P2002 unique-constraint error if a policy already
   * exists for (organizationId, resourceType) — one active policy per
   * resource type per org, surfaced by the service as a 409. */
  async create(data: CreateRetentionPolicyData): Promise<RetentionPolicy> {
    return this.prisma.retentionPolicy.create({
      data: {
        organizationId: data.organizationId,
        resourceType: data.resourceType,
        retentionDays: data.retentionDays,
        action: data.action,
        createdBy: data.createdBy,
      },
    });
  }

  async listByOrganization(organizationId: string): Promise<RetentionPolicy[]> {
    return this.prisma.retentionPolicy.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<RetentionPolicy | null> {
    return this.prisma.retentionPolicy.findFirst({ where: { id, organizationId } });
  }

  async update(id: string, data: UpdateRetentionPolicyData): Promise<RetentionPolicy> {
    return this.prisma.retentionPolicy.update({ where: { id }, data });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.prisma.retentionPolicy.deleteMany({ where: { id, organizationId } });
  }
}
