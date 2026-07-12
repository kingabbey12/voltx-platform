import { Injectable } from '@nestjs/common';
import { ConsentRecord, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateConsentRecordData {
  organizationId: string;
  userId: string;
  consentType: string;
  granted: boolean;
  metadata?: Record<string, unknown>;
}

export interface FindConsentHistoryParams {
  organizationId: string;
  userId?: string;
  consentType?: string;
}

@Injectable()
export class ConsentRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every grant/revoke inserts a new row — this is an append-only history,
   * never an update-in-place, so the full timeline is always reconstructable. */
  async create(data: CreateConsentRecordData): Promise<ConsentRecord> {
    const now = new Date();
    return this.prisma.consentRecord.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        consentType: data.consentType,
        granted: data.granted,
        grantedAt: data.granted ? now : null,
        revokedAt: data.granted ? null : now,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findHistory(params: FindConsentHistoryParams): Promise<ConsentRecord[]> {
    return this.prisma.consentRecord.findMany({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
        consentType: params.consentType,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<ConsentRecord | null> {
    return this.prisma.consentRecord.findFirst({ where: { id, organizationId } });
  }
}
