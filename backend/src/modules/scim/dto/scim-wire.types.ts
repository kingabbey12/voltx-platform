/** SCIM 2.0 (RFC 7643/7644) wire-format types — only the subset this integration supports. */

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
export const SCIM_LIST_RESPONSE_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_PATCH_OP_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

export interface ScimName {
  givenName?: string;
  familyName?: string;
  formatted?: string;
}

export interface ScimEmail {
  value: string;
  primary?: boolean;
}

export interface ScimUserResource {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name?: ScimName;
  emails?: ScimEmail[];
  active: boolean;
  meta: { resourceType: 'User'; created: string; lastModified: string };
}

export interface ScimGroupMember {
  value: string;
  display?: string;
}

export interface ScimGroupResource {
  schemas: string[];
  id: string;
  displayName: string;
  members?: ScimGroupMember[];
  meta: { resourceType: 'Group'; created: string; lastModified: string };
}

export interface ScimListResponse<T> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface ScimPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path?: string;
  value?: unknown;
}

export interface ScimPatchOpRequest {
  schemas: string[];
  Operations: ScimPatchOperation[];
}
