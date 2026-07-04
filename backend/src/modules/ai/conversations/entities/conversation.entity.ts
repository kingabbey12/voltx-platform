export class ConversationEntity {
  id!: string;
  organizationId!: string;
  userId!: string;
  title!: string;
  model!: string;
  provider!: string;
  pinned!: boolean;
  archived!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
}
