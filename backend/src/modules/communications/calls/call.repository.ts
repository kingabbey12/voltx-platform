import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  CommsCallDirection,
  CommsCallEntity,
  CommsCallRecordingEntity,
  CommsCallStatus,
  CommsTranscriptionEntity,
} from './entities/call.entity';

export interface CreateCommsCallData {
  connectionId: string;
  conversationId?: string;
  direction: CommsCallDirection;
  status: CommsCallStatus;
  fromNumber: string;
  toNumber: string;
  externalCallId?: string;
  startedAt?: Date;
}

export interface UpdateCommsCallData {
  status?: CommsCallStatus;
  conversationId?: string;
  durationSeconds?: number;
  notes?: string;
  startedAt?: Date;
  endedAt?: Date;
}

interface CommsCallRecord {
  id: string;
  organizationId: string;
  conversationId: string | null;
  connectionId: string;
  direction: CommsCallDirection;
  status: CommsCallStatus;
  fromNumber: string;
  toNumber: string;
  durationSeconds: number | null;
  externalCallId: string | null;
  notes: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

interface CommsCallRecordingRecord {
  id: string;
  organizationId: string;
  callId: string;
  storageUrl: string;
  durationSeconds: number | null;
  createdAt: Date;
}

interface CommsTranscriptionRecord {
  id: string;
  organizationId: string;
  callId: string;
  text: string;
  language: string | null;
  createdAt: Date;
}

interface CommsCallClient {
  create(args: { data: Record<string, unknown> }): Promise<CommsCallRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<CommsCallRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<CommsCallRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<CommsCallRecord>;
}

interface CommsCallRecordingClient {
  create(args: { data: Record<string, unknown> }): Promise<CommsCallRecordingRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<CommsCallRecordingRecord | null>;
}

interface CommsTranscriptionClient {
  create(args: { data: Record<string, unknown> }): Promise<CommsTranscriptionRecord>;
}

@Injectable()
export class CallRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateCommsCallData): Promise<CommsCallEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.createUnscoped(tenant.organizationId, data);
  }

  /** Inbound call webhooks run outside a request's tenant context — the connection lookup already resolved the right org. */
  async createUnscoped(
    organizationId: string,
    data: CreateCommsCallData,
  ): Promise<CommsCallEntity> {
    const record = await this.callClient().create({
      data: {
        organizationId,
        connectionId: data.connectionId,
        conversationId: data.conversationId,
        direction: data.direction,
        status: data.status,
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        externalCallId: data.externalCallId,
        startedAt: data.startedAt,
      },
    });
    return toCallEntity(record);
  }

  async findByExternalCallIdUnscoped(externalCallId: string): Promise<CommsCallEntity | null> {
    const record = await this.callClient().findFirst({ where: { externalCallId } });
    return record ? toCallEntity(record) : null;
  }

  async findById(id: string): Promise<CommsCallEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.callClient().findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toCallEntity(record) : null;
  }

  async findByConversation(conversationId: string): Promise<CommsCallEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.callClient().findMany({
      where: { conversationId, organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toCallEntity);
  }

  async findAll(params: { page: number; limit: number }): Promise<{
    items: CommsCallEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { organizationId: tenant.organizationId };
    const [records, total] = await Promise.all([
      this.callClient().findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.callClient().count({ where }),
    ]);
    return {
      items: records.map(toCallEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  async updateUnscoped(id: string, data: UpdateCommsCallData): Promise<CommsCallEntity> {
    const record = await this.callClient().update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.conversationId !== undefined ? { conversationId: data.conversationId } : {}),
        ...(data.durationSeconds !== undefined ? { durationSeconds: data.durationSeconds } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
        ...(data.endedAt !== undefined ? { endedAt: data.endedAt } : {}),
      },
    });
    return toCallEntity(record);
  }

  async createRecordingUnscoped(
    organizationId: string,
    callId: string,
    storageUrl: string,
    durationSeconds?: number,
  ): Promise<CommsCallRecordingEntity> {
    const record = await this.recordingClient().create({
      data: { organizationId, callId, storageUrl, durationSeconds },
    });
    return toRecordingEntity(record);
  }

  async findRecordingByCallId(callId: string): Promise<CommsCallRecordingEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.recordingClient().findFirst({
      where: { callId, organizationId: tenant.organizationId },
    });
    return record ? toRecordingEntity(record) : null;
  }

  async findRecordingByCallIdUnscoped(callId: string): Promise<CommsCallRecordingEntity | null> {
    const record = await this.recordingClient().findFirst({ where: { callId } });
    return record ? toRecordingEntity(record) : null;
  }

  async createTranscriptionUnscoped(
    organizationId: string,
    callId: string,
    text: string,
    language?: string,
  ): Promise<CommsTranscriptionEntity> {
    const record = await this.transcriptionClient().create({
      data: { organizationId, callId, text, language },
    });
    return {
      id: record.id,
      organizationId: record.organizationId,
      callId: record.callId,
      text: record.text,
      language: record.language,
      createdAt: record.createdAt,
    };
  }

  private callClient(): CommsCallClient {
    return (this.prisma.system as unknown as { commsCall: CommsCallClient }).commsCall;
  }

  private recordingClient(): CommsCallRecordingClient {
    return (this.prisma.system as unknown as { commsCallRecording: CommsCallRecordingClient })
      .commsCallRecording;
  }

  private transcriptionClient(): CommsTranscriptionClient {
    return (this.prisma.system as unknown as { commsTranscription: CommsTranscriptionClient })
      .commsTranscription;
  }
}

function toCallEntity(record: CommsCallRecord): CommsCallEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    conversationId: record.conversationId,
    connectionId: record.connectionId,
    direction: record.direction,
    status: record.status,
    fromNumber: record.fromNumber,
    toNumber: record.toNumber,
    durationSeconds: record.durationSeconds,
    externalCallId: record.externalCallId,
    notes: record.notes,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    createdAt: record.createdAt,
  };
}

function toRecordingEntity(record: CommsCallRecordingRecord): CommsCallRecordingEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    callId: record.callId,
    storageUrl: record.storageUrl,
    durationSeconds: record.durationSeconds,
    createdAt: record.createdAt,
  };
}
