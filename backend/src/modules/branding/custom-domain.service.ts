import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomDomainDto } from './dto/branding.dto';
import { CustomDomainEntity } from './entities/branding.entity';
import { CustomDomainRepository } from './custom-domain.repository';
import {
  generateDomainVerificationToken,
  verifyDomainOwnership,
} from './utils/dns-verification.util';

@Injectable()
export class CustomDomainService {
  constructor(
    private readonly repository: CustomDomainRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async create(organizationId: string, dto: CreateCustomDomainDto): Promise<CustomDomainEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const domain = dto.domain.toLowerCase();

    try {
      const entity = await this.repository.create(
        organizationId,
        domain,
        generateDomainVerificationToken(),
      );
      await this.auditService.record({
        action: 'create',
        resource: 'custom_domain',
        resourceId: entity.id,
        metadata: { organizationId, domain },
      });
      return entity;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This domain is already registered to an organization');
      }
      throw error;
    }
  }

  async list(organizationId: string): Promise<CustomDomainEntity[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    return this.repository.listByOrganization(organizationId);
  }

  async getOrThrow(organizationId: string, id: string): Promise<CustomDomainEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.findByIdInOrg(organizationId, id);
    if (!entity) {
      throw new NotFoundException('Custom domain not found');
    }
    return entity;
  }

  async verify(organizationId: string, id: string): Promise<CustomDomainEntity> {
    const entity = await this.getOrThrow(organizationId, id);

    const verified = await verifyDomainOwnership(entity.domain, entity.verificationToken);
    const result = verified
      ? await this.repository.markVerified(id)
      : await this.repository.markFailed(id);

    await this.auditService.record({
      action: 'verify',
      resource: 'custom_domain',
      resourceId: id,
      metadata: { organizationId, domain: entity.domain, verified },
    });

    return result;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.getOrThrow(organizationId, id);
    await this.repository.delete(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'custom_domain',
      resourceId: id,
      metadata: { organizationId },
    });
  }
}
