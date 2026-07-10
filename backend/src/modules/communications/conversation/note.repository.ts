import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { CommsNoteEntity } from './entities/note.entity';

interface CommsNoteRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CommsNoteClient {
  create(args: { data: Record<string, unknown> }): Promise<CommsNoteRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<CommsNoteRecord[]>;
}

@Injectable()
export class NoteRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(conversationId: string, authorId: string, body: string): Promise<CommsNoteEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: { organizationId: tenant.organizationId, conversationId, authorId, body },
    });
    return toEntity(record);
  }

  async findByConversation(conversationId: string): Promise<CommsNoteEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { conversationId, organizationId: tenant.organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toEntity);
  }

  private client(): CommsNoteClient {
    return (this.prisma.system as unknown as { commsNote: CommsNoteClient }).commsNote;
  }
}

function toEntity(record: CommsNoteRecord): CommsNoteEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    conversationId: record.conversationId,
    authorId: record.authorId,
    body: record.body,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
