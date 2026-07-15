export class RoleEntity {
  id!: string;
  key!: string;
  name!: string;
  description!: string | null;
  isSystem!: boolean;
  /** Null for system roles (shared across every organization). Set to the
   * owning organization's id for a custom role. */
  organizationId!: string | null;
  permissionKeys!: string[];
  createdAt!: Date;
  updatedAt!: Date;
}
