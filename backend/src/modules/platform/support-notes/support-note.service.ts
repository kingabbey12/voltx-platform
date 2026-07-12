import { Injectable, NotFoundException } from '@nestjs/common';
import { SupportNoteEntity } from './entities/support-note.entity';
import { SupportNoteRepository } from './support-note.repository';

@Injectable()
export class SupportNoteService {
  constructor(private readonly repository: SupportNoteRepository) {}

  create(organizationId: string, authorId: string, note: string): Promise<SupportNoteEntity> {
    return this.repository.create({ organizationId, authorId, note });
  }

  list(organizationId: string): Promise<SupportNoteEntity[]> {
    return this.repository.listByOrganization(organizationId);
  }

  async delete(id: string): Promise<void> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException('Support note not found');
    }
    await this.repository.delete(id);
  }
}
