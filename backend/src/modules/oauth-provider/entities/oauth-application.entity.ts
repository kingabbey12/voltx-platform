import { OAuthApplication, OAuthApplicationStatus, OAuthRedirectUri } from '@prisma/client';

export interface OAuthApplicationEntity {
  id: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  clientId: string;
  clientSecretHash: string;
  clientSecretPrefix: string;
  scopes: string[];
  status: OAuthApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const toOAuthApplicationEntity = (record: OAuthApplication): OAuthApplicationEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  ownerUserId: record.ownerUserId,
  name: record.name,
  description: record.description,
  logoUrl: record.logoUrl,
  clientId: record.clientId,
  clientSecretHash: record.clientSecretHash,
  clientSecretPrefix: record.clientSecretPrefix,
  scopes: record.scopes,
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export interface OAuthRedirectUriEntity {
  id: string;
  applicationId: string;
  uri: string;
  createdAt: Date;
}

export const toOAuthRedirectUriEntity = (record: OAuthRedirectUri): OAuthRedirectUriEntity => ({
  id: record.id,
  applicationId: record.applicationId,
  uri: record.uri,
  createdAt: record.createdAt,
});

export interface OAuthApplicationWithRedirectUrisEntity extends OAuthApplicationEntity {
  redirectUris: OAuthRedirectUriEntity[];
}
