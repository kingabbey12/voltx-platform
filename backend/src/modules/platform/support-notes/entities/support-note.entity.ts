import { SupportNote } from '@prisma/client';

export interface SupportNoteEntity {
  id: string;
  organizationId: string;
  authorId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export const toSupportNoteEntity = (record: SupportNote): SupportNoteEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  authorId: record.authorId,
  note: record.note,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
