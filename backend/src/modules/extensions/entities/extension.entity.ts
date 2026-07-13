import {
  ExtensionAiTool,
  ExtensionCustomNavEntry,
  ExtensionCustomPage,
  ExtensionCustomWidget,
  ExtensionWidgetPlacement,
  Prisma,
} from '@prisma/client';

export interface ExtensionCustomPageEntity {
  id: string;
  marketplaceAppVersionId: string;
  path: string;
  manifest: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export const toExtensionCustomPageEntity = (
  record: ExtensionCustomPage,
): ExtensionCustomPageEntity => ({
  id: record.id,
  marketplaceAppVersionId: record.marketplaceAppVersionId,
  path: record.path,
  manifest: record.manifest,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export interface ExtensionCustomWidgetEntity {
  id: string;
  marketplaceAppVersionId: string;
  placement: ExtensionWidgetPlacement;
  manifest: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export const toExtensionCustomWidgetEntity = (
  record: ExtensionCustomWidget,
): ExtensionCustomWidgetEntity => ({
  id: record.id,
  marketplaceAppVersionId: record.marketplaceAppVersionId,
  placement: record.placement,
  manifest: record.manifest,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export interface ExtensionCustomNavEntryEntity {
  id: string;
  marketplaceAppVersionId: string;
  label: string;
  icon: string | null;
  targetPath: string;
  createdAt: Date;
}

export const toExtensionCustomNavEntryEntity = (
  record: ExtensionCustomNavEntry,
): ExtensionCustomNavEntryEntity => ({
  id: record.id,
  marketplaceAppVersionId: record.marketplaceAppVersionId,
  label: record.label,
  icon: record.icon,
  targetPath: record.targetPath,
  createdAt: record.createdAt,
});

export interface ExtensionAiToolEntity {
  id: string;
  marketplaceAppVersionId: string;
  name: string;
  description: string;
  parametersSchema: Prisma.JsonValue;
  responseSchema: Prisma.JsonValue;
  endpointUrl: string;
  encryptedSigningSecret: string;
  createdAt: Date;
  updatedAt: Date;
}

export const toExtensionAiToolEntity = (record: ExtensionAiTool): ExtensionAiToolEntity => ({
  id: record.id,
  marketplaceAppVersionId: record.marketplaceAppVersionId,
  name: record.name,
  description: record.description,
  parametersSchema: record.parametersSchema,
  responseSchema: record.responseSchema,
  endpointUrl: record.endpointUrl,
  encryptedSigningSecret: record.encryptedSigningSecret,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
