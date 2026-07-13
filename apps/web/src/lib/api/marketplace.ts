import { apiClient } from "./client";

export type MarketplaceAppCategory =
  | "PRODUCTIVITY"
  | "ANALYTICS"
  | "COMMUNICATION"
  | "SALES"
  | "FINANCE"
  | "OTHER";

export type MarketplaceAppStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "SUSPENDED";
export type MarketplaceAppVersionStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
export type MarketplaceInstallStatus = "ACTIVE" | "UNINSTALLED";
export type DeveloperConnectOnboardingStatus = "PENDING" | "ONBOARDING" | "COMPLETE";

export interface PublicMarketplaceApp {
  id: string;
  name: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  latestVersion: string | null;
  priceCents: number | null;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
}

export interface ListPublicAppsParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Matches PublicMarketplaceAppListResponseDto exactly — no `totalPages`
 * field, unlike the app's general-purpose PaginatedResult. */
export interface PublicMarketplaceAppListResult {
  items: PublicMarketplaceApp[];
  total: number;
  page: number;
  limit: number;
}

export interface MarketplaceApp {
  id: string;
  developerOrganizationId: string;
  name: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  status: MarketplaceAppStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketplaceAppInput {
  name: string;
  description?: string;
  category: MarketplaceAppCategory;
  iconUrl?: string;
}

export interface MarketplaceAppVersion {
  id: string;
  appId: string;
  version: string;
  manifest: unknown;
  changelog: string | null;
  priceCents: number;
  status: MarketplaceAppVersionStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketplaceAppVersionInput {
  version: string;
  manifest: Record<string, unknown>;
  changelog?: string;
  priceCents?: number;
}

export interface MarketplaceInstall {
  id: string;
  appId: string;
  installedVersionId: string;
  status: MarketplaceInstallStatus;
  createdAt: string;
}

export interface InstallAppResult {
  install: MarketplaceInstall | null;
  checkoutUrl: string | null;
}

export interface MarketplaceReview {
  id: string;
  appId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface OnboardingLinkResult {
  url: string;
}

export interface DeveloperConnectStatus {
  onboardingStatus: DeveloperConnectOnboardingStatus;
  payoutsEnabled: boolean;
}

export interface ExtensionAiTool {
  id: string;
  name: string;
  description: string;
  parametersSchema: unknown;
  responseSchema: unknown;
  endpointUrl: string;
  signingSecret: string;
}

export const marketplaceApi = {
  // Public browse — unauthenticated
  listPublished: (params: ListPublicAppsParams = {}) =>
    apiClient.get<PublicMarketplaceAppListResult>("/marketplace/public/apps", {
      query: { ...params },
      authenticated: false,
    }),
  getPublished: (appId: string) =>
    apiClient.get<PublicMarketplaceApp>(`/marketplace/public/apps/${appId}`, {
      authenticated: false,
    }),
  listPublicReviews: (appId: string) =>
    apiClient.get<MarketplaceReview[]>(`/marketplace/public/apps/${appId}/reviews`, {
      authenticated: false,
    }),

  // Developer app management — org-scoped
  listMyApps: (organizationId: string) =>
    apiClient.get<MarketplaceApp[]>(`/organizations/${organizationId}/marketplace/apps`),
  createApp: (organizationId: string, input: CreateMarketplaceAppInput) =>
    apiClient.post<MarketplaceApp>(`/organizations/${organizationId}/marketplace/apps`, input),
  getApp: (organizationId: string, appId: string) =>
    apiClient.get<MarketplaceApp>(`/organizations/${organizationId}/marketplace/apps/${appId}`),
  listVersions: (organizationId: string, appId: string) =>
    apiClient.get<MarketplaceAppVersion[]>(
      `/organizations/${organizationId}/marketplace/apps/${appId}/versions`,
    ),
  createVersion: (organizationId: string, appId: string, input: CreateMarketplaceAppVersionInput) =>
    apiClient.post<MarketplaceAppVersion>(
      `/organizations/${organizationId}/marketplace/apps/${appId}/versions`,
      input,
    ),
  listAiTools: (organizationId: string, appId: string) =>
    apiClient.get<ExtensionAiTool[]>(
      `/organizations/${organizationId}/marketplace/apps/${appId}/extensions/ai-tools`,
    ),

  // Installs — org-scoped
  listInstalled: (organizationId: string) =>
    apiClient.get<MarketplaceInstall[]>(`/organizations/${organizationId}/marketplace/installs`),
  install: (
    organizationId: string,
    appId: string,
    input: { successUrl?: string; cancelUrl?: string } = {},
  ) =>
    apiClient.post<InstallAppResult>(
      `/organizations/${organizationId}/marketplace/apps/${appId}/install`,
      input,
    ),
  uninstall: (organizationId: string, installId: string) =>
    apiClient.delete<{ message: string }>(
      `/organizations/${organizationId}/marketplace/installs/${installId}`,
    ),

  // Reviews — org-scoped
  createReview: (
    organizationId: string,
    appId: string,
    input: { rating: number; comment?: string },
  ) =>
    apiClient.post<MarketplaceReview>(
      `/organizations/${organizationId}/marketplace/apps/${appId}/reviews`,
      input,
    ),

  // Stripe Connect — org-scoped
  createOnboardingLink: (organizationId: string) =>
    apiClient.post<OnboardingLinkResult>(
      `/organizations/${organizationId}/marketplace/connect/onboarding-link`,
    ),
  getConnectStatus: (organizationId: string) =>
    apiClient.get<DeveloperConnectStatus>(`/organizations/${organizationId}/marketplace/connect/status`),
};
