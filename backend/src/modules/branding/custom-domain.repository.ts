import { Injectable } from '@nestjs/common';
import { CustomDomainSslStatus, CustomDomainVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CustomDomainEntity, toCustomDomainEntity } from './entities/branding.entity';

@Injectable()
export class CustomDomainRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    domain: string,
    verificationToken: string,
  ): Promise<CustomDomainEntity> {
    const record = await this.prisma.customDomain.create({
      data: { organizationId, domain, verificationToken },
    });
    return toCustomDomainEntity(record);
  }

  async listByOrganization(organizationId: string): Promise<CustomDomainEntity[]> {
    const records = await this.prisma.customDomain.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toCustomDomainEntity);
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<CustomDomainEntity | null> {
    const record = await this.prisma.customDomain.findFirst({ where: { id, organizationId } });
    return record ? toCustomDomainEntity(record) : null;
  }

  /** Unscoped — used by the public branding endpoint to resolve a hostname to its organization. Only a VERIFIED domain is ever matched. */
  async findVerifiedByDomain(domain: string): Promise<CustomDomainEntity | null> {
    const record = await this.prisma.customDomain.findFirst({
      where: { domain, verificationStatus: CustomDomainVerificationStatus.VERIFIED },
    });
    return record ? toCustomDomainEntity(record) : null;
  }

  async markVerified(id: string): Promise<CustomDomainEntity> {
    const record = await this.prisma.customDomain.update({
      where: { id },
      data: {
        verificationStatus: CustomDomainVerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        sslStatus: CustomDomainSslStatus.PENDING,
      },
    });
    return toCustomDomainEntity(record);
  }

  async markFailed(id: string): Promise<CustomDomainEntity> {
    const record = await this.prisma.customDomain.update({
      where: { id },
      data: { verificationStatus: CustomDomainVerificationStatus.FAILED },
    });
    return toCustomDomainEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customDomain.delete({ where: { id } });
  }
}
