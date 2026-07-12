import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationRepository } from '../organization/organization.repository';
import {
  mergeOrganizationSecurityPolicy,
  parseOrganizationSecurityPolicy,
} from '../organization/utils/organization-security-policy.util';
import { SecurityPolicyResponseDto, UpdateSecurityPolicyDto } from './dto/security-policy.dto';

@Injectable()
export class SecurityPolicyService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async get(organizationId: string): Promise<SecurityPolicyResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const organization = await this.organizationRepository.findById();
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return parseOrganizationSecurityPolicy(organization.settings);
  }

  async update(
    organizationId: string,
    dto: UpdateSecurityPolicyDto,
  ): Promise<SecurityPolicyResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const organization = await this.organizationRepository.findById();
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const mergedSettings = mergeOrganizationSecurityPolicy(organization.settings, dto);
    const updated = await this.organizationRepository.update({ settings: mergedSettings });
    if (!updated) {
      throw new NotFoundException('Organization not found');
    }

    await this.auditService.record({
      action: 'security_policy.updated',
      resource: 'organization',
      resourceId: updated.id,
      metadata: dto as Record<string, unknown>,
    });

    return parseOrganizationSecurityPolicy(updated.settings);
  }
}
