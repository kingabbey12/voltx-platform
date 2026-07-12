import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SupportNoteEntity, toSupportNoteEntity } from './entities/support-note.entity';

export interface CreateSupportNoteData {
  organizationId: string;
  authorId: string;
  note: string;
}

@Injectable()
export class SupportNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSupportNoteData): Promise<SupportNoteEntity> {
    const record = await this.prisma.system.supportNote.create({ data });
    return toSupportNoteEntity(record);
  }

  async listByOrganization(organizationId: string): Promise<SupportNoteEntity[]> {
    const records = await this.prisma.system.supportNote.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toSupportNoteEntity);
  }

  async findById(id: string): Promise<SupportNoteEntity | null> {
    const record = await this.prisma.system.supportNote.findUnique({ where: { id } });
    return record ? toSupportNoteEntity(record) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.system.supportNote.delete({ where: { id } });
  }
}
