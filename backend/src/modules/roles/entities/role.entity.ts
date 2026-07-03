export class RoleEntity {
  id!: string;
  key!: string;
  name!: string;
  description!: string | null;
  isSystem!: boolean;
  permissionKeys!: string[];
  createdAt!: Date;
  updatedAt!: Date;
}
