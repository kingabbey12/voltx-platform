import { Injectable } from '@nestjs/common';
import { ScimOperationType, ScimProvisionJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface RecordScimJobData {
  organizationId: string;
  scimTokenId: string;
  operation: ScimOperationType;
  externalId?: string;
  targetUserId?: string;
  targetMembershipId?: string;
  status: ScimProvisionJobStatus;
  requestPayload: unknown;
  responsePayload?: unknown;
  errorMessage?: string;
}

/** Every SCIM operation writes one row here — the audit trail the plan calls for, independent of AuditLog (which tracks authenticated-user actions, not IdP-driven provisioning). */
@Injectable()
export class ScimProvisionJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(data: RecordScimJobData): Promise<void> {
    await this.prisma.scimProvisionJob.create({
      data: {
        organizationId: data.organizationId,
        scimTokenId: data.scimTokenId,
        operation: data.operation,
        externalId: data.externalId,
        targetUserId: data.targetUserId,
        targetMembershipId: data.targetMembershipId,
        status: data.status,
        requestPayload: data.requestPayload as never,
        responsePayload: data.responsePayload as never,
        errorMessage: data.errorMessage,
      },
    });
  }

  async listByOrganization(organizationId: string, limit = 50) {
    return this.prisma.scimProvisionJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
