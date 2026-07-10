import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  AttachmentEntity,
  AttachmentReferenceEntity,
  AttachmentReferenceType,
  AttachmentStatus,
  AttachmentVersionEntity,
} from './entities/attachment.entity';

export interface CreateAttachmentData {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  storageKey: string;
  status: AttachmentStatus;
  uploadedBy: string;
}

export interface UpdateAttachmentData {
  status?: AttachmentStatus;
  scanResult?: string | null;
  thumbnailKey?: string | null;
  width?: number | null;
  height?: number | null;
  extractedText?: string | null;
  checksumSha256?: string | null;
  metadata?: Record<string, unknown>;
  sizeBytes?: number;
}

export interface FindAttachmentsParams {
  page: number;
  limit: number;
  referenceType?: AttachmentReferenceType;
  referenceId?: string;
}

export interface PaginatedAttachments {
  items: AttachmentEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AttachmentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateAttachmentData): Promise<AttachmentEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.createUnscoped(tenant.organizationId, data);
  }

  /** For background/webhook contexts (e.g. ingesting a channel-message attachment) that have no HTTP-request tenant context to read organizationId from. */
  async createUnscoped(
    organizationId: string,
    data: CreateAttachmentData,
  ): Promise<AttachmentEntity> {
    const record = await this.prisma.system.attachment.create({
      data: {
        organizationId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        storageProvider: data.storageProvider,
        storageKey: data.storageKey,
        status: data.status,
        uploadedBy: data.uploadedBy,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<AttachmentEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.prisma.system.attachment.findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  async findByIdOrThrow(id: string): Promise<AttachmentEntity> {
    const attachment = await this.findById(id);
    if (!attachment) {
      throw new NotFoundException(`Attachment "${id}" not found`);
    }
    return attachment;
  }

  /** Bypasses tenant scoping — only for background processing jobs (BullMQ workers) that run outside an HTTP request's tenant context. */
  async findByIdUnscoped(id: string): Promise<AttachmentEntity | null> {
    const record = await this.prisma.system.attachment.findFirst({
      where: { id, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  async findByIds(ids: string[]): Promise<AttachmentEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.prisma.system.attachment.findMany({
      where: { id: { in: ids }, organizationId: tenant.organizationId, deletedAt: null },
    });
    return records.map(toEntity);
  }

  async update(id: string, data: UpdateAttachmentData): Promise<AttachmentEntity> {
    const record = await this.prisma.system.attachment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.scanResult !== undefined ? { scanResult: data.scanResult } : {}),
        ...(data.thumbnailKey !== undefined ? { thumbnailKey: data.thumbnailKey } : {}),
        ...(data.width !== undefined ? { width: data.width } : {}),
        ...(data.height !== undefined ? { height: data.height } : {}),
        ...(data.extractedText !== undefined ? { extractedText: data.extractedText } : {}),
        ...(data.checksumSha256 !== undefined ? { checksumSha256: data.checksumSha256 } : {}),
        ...(data.metadata !== undefined
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
    return toEntity(record);
  }

  async softDelete(id: string): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.prisma.system.attachment.updateMany({
      where: { id, organizationId: tenant.organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async findByReference(params: FindAttachmentsParams): Promise<PaginatedAttachments> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.AttachmentWhereInput = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.referenceType && params.referenceId
        ? {
            references: {
              some: { referenceType: params.referenceType, referenceId: params.referenceId },
            },
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.system.attachment.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.system.attachment.count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  /**
   * Full-text-ish search across an org's ready attachments by filename or
   * extracted content — what the AI attachments tool source needs to let
   * an agent find a document by name/topic rather than by id, which is
   * the only lookup findByReference/findById support today.
   */
  async search(params: {
    query?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedAttachments> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.AttachmentWhereInput = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      status: 'READY',
      ...(params.query
        ? {
            OR: [
              { fileName: { contains: params.query, mode: 'insensitive' } },
              { extractedText: { contains: params.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.system.attachment.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.system.attachment.count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  async addReference(
    attachmentId: string,
    referenceType: AttachmentReferenceType,
    referenceId: string,
  ): Promise<AttachmentReferenceEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.addReferenceUnscoped(
      tenant.organizationId,
      attachmentId,
      referenceType,
      referenceId,
    );
  }

  /** For background/webhook contexts — see createUnscoped. */
  async addReferenceUnscoped(
    organizationId: string,
    attachmentId: string,
    referenceType: AttachmentReferenceType,
    referenceId: string,
  ): Promise<AttachmentReferenceEntity> {
    const record = await this.prisma.system.attachmentReference.upsert({
      where: {
        attachmentId_referenceType_referenceId: { attachmentId, referenceType, referenceId },
      },
      create: {
        attachmentId,
        organizationId,
        referenceType,
        referenceId,
      },
      update: {},
    });
    return {
      id: record.id,
      attachmentId: record.attachmentId,
      organizationId: record.organizationId,
      referenceType: record.referenceType,
      referenceId: record.referenceId,
      createdAt: record.createdAt,
    };
  }

  async createVersion(
    attachmentId: string,
    data: {
      storageKey: string;
      sizeBytes: number;
      checksumSha256: string | null;
      createdBy: string;
    },
  ): Promise<AttachmentVersionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const lastVersion = await this.prisma.system.attachmentVersion.findFirst({
      where: { attachmentId },
      orderBy: { versionNumber: 'desc' },
    });

    const record = await this.prisma.system.attachmentVersion.create({
      data: {
        attachmentId,
        organizationId: tenant.organizationId,
        versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
        storageKey: data.storageKey,
        sizeBytes: data.sizeBytes,
        checksumSha256: data.checksumSha256,
        createdBy: data.createdBy,
      },
    });

    return {
      id: record.id,
      attachmentId: record.attachmentId,
      organizationId: record.organizationId,
      versionNumber: record.versionNumber,
      storageKey: record.storageKey,
      sizeBytes: record.sizeBytes,
      checksumSha256: record.checksumSha256,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
    };
  }
}

interface AttachmentRecord {
  id: string;
  organizationId: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  storageKey: string;
  checksumSha256: string | null;
  status: string;
  scanResult: string | null;
  thumbnailKey: string | null;
  width: number | null;
  height: number | null;
  extractedText: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

function toEntity(record: AttachmentRecord): AttachmentEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    uploadedBy: record.uploadedBy,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    storageProvider: record.storageProvider,
    storageKey: record.storageKey,
    checksumSha256: record.checksumSha256,
    status: record.status as AttachmentStatus,
    scanResult: record.scanResult,
    thumbnailKey: record.thumbnailKey,
    width: record.width,
    height: record.height,
    extractedText: record.extractedText,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}
