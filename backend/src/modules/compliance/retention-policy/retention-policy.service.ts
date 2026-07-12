import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RetentionPolicy } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateRetentionPolicyData,
  RetentionPolicyRepository,
  UpdateRetentionPolicyData,
} from './retention-policy.repository';

@Injectable()
export class RetentionPolicyService {
  constructor(
    private readonly retentionPolicyRepository: RetentionPolicyRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    data: Omit<CreateRetentionPolicyData, 'organizationId' | 'createdBy'>,
  ): Promise<RetentionPolicy> {
    const tenant = this.tenantContextService.getOrThrow();

    try {
      const policy = await this.retentionPolicyRepository.create({
        ...data,
        organizationId: tenant.organizationId,
        createdBy: tenant.userId,
      });

      await this.auditService.record({
        action: 'compliance.retention.create',
        resource: 'retention_policy',
        resourceId: policy.id,
        metadata: { resourceType: policy.resourceType, retentionDays: policy.retentionDays },
      });

      return policy;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `A retention policy for resource type "${data.resourceType}" already exists for this organization`,
        );
      }
      throw error;
    }
  }

  async list(): Promise<RetentionPolicy[]> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.retentionPolicyRepository.listByOrganization(tenant.organizationId);
  }

  async getOrThrow(id: string): Promise<RetentionPolicy> {
    const tenant = this.tenantContextService.getOrThrow();
    const policy = await this.retentionPolicyRepository.findByIdInOrg(tenant.organizationId, id);
    if (!policy) {
      throw new NotFoundException('Retention policy not found');
    }
    return policy;
  }

  async update(id: string, data: UpdateRetentionPolicyData): Promise<RetentionPolicy> {
    await this.getOrThrow(id);
    const updated = await this.retentionPolicyRepository.update(id, data);
    await this.auditService.record({
      action: 'compliance.retention.update',
      resource: 'retention_policy',
      resourceId: id,
    });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.getOrThrow(id);
    await this.retentionPolicyRepository.delete(tenant.organizationId, id);
    await this.auditService.record({
      action: 'compliance.retention.delete',
      resource: 'retention_policy',
      resourceId: id,
    });
  }
}
