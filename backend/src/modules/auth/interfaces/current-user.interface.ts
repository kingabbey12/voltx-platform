export interface CurrentUser {
  id: string;
  organizationId: string;
  membershipId: string;
  roles: string[];
  permissions: string[];
}
