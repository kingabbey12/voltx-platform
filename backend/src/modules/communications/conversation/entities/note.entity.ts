export interface CommsNoteEntity {
  id: string;
  organizationId: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}
