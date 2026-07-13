import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateMarketplaceAppInput,
  type CreateMarketplaceAppVersionInput,
  type ListPublicAppsParams,
  marketplaceApi,
} from "@/lib/api/marketplace";
import { useAuthStore } from "@/lib/stores/auth-store";

function useOrganizationId(): string | undefined {
  return useAuthStore((state) => state.user?.organizationId);
}

// ---------------------------------------------------------------------------
// Public browse
// ---------------------------------------------------------------------------

export function usePublishedApps(params: ListPublicAppsParams) {
  return useQuery({
    queryKey: ["marketplace", "public-apps", params],
    queryFn: () => marketplaceApi.listPublished(params),
  });
}

export function usePublishedApp(appId: string | undefined) {
  return useQuery({
    queryKey: ["marketplace", "public-app", appId],
    queryFn: () => marketplaceApi.getPublished(appId!),
    enabled: !!appId,
  });
}

export function usePublicReviews(appId: string | undefined) {
  return useQuery({
    queryKey: ["marketplace", "public-reviews", appId],
    queryFn: () => marketplaceApi.listPublicReviews(appId!),
    enabled: !!appId,
  });
}

// ---------------------------------------------------------------------------
// Installs
// ---------------------------------------------------------------------------

export function useInstalledApps() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["marketplace", "installed", organizationId],
    queryFn: () => marketplaceApi.listInstalled(organizationId!),
    enabled: !!organizationId,
  });
}

export function useInstallApp() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appId,
      successUrl,
      cancelUrl,
    }: {
      appId: string;
      successUrl?: string;
      cancelUrl?: string;
    }) => {
      if (!organizationId) throw new Error("No active organization");
      return marketplaceApi.install(organizationId, appId, { successUrl, cancelUrl });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "installed", organizationId] });
    },
  });
}

export function useUninstallApp() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (installId: string) => {
      if (!organizationId) throw new Error("No active organization");
      return marketplaceApi.uninstall(organizationId, installId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "installed", organizationId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export function useCreateReview() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appId,
      rating,
      comment,
    }: {
      appId: string;
      rating: number;
      comment?: string;
    }) => {
      if (!organizationId) throw new Error("No active organization");
      return marketplaceApi.createReview(organizationId, appId, { rating, comment });
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["marketplace", "public-reviews", variables.appId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["marketplace", "public-app", variables.appId],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Developer app management
// ---------------------------------------------------------------------------

export function useMyApps() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["marketplace", "my-apps", organizationId],
    queryFn: () => marketplaceApi.listMyApps(organizationId!),
    enabled: !!organizationId,
  });
}

export function useMyApp(appId: string | undefined) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["marketplace", "my-app", organizationId, appId],
    queryFn: () => marketplaceApi.getApp(organizationId!, appId!),
    enabled: !!organizationId && !!appId,
  });
}

export function useCreateApp() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMarketplaceAppInput) => {
      if (!organizationId) throw new Error("No active organization");
      return marketplaceApi.createApp(organizationId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "my-apps", organizationId] });
    },
  });
}

export function useAppVersions(appId: string | undefined) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["marketplace", "app-versions", organizationId, appId],
    queryFn: () => marketplaceApi.listVersions(organizationId!, appId!),
    enabled: !!organizationId && !!appId,
  });
}

export function useCreateAppVersion(appId: string) {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMarketplaceAppVersionInput) => {
      if (!organizationId) throw new Error("No active organization");
      return marketplaceApi.createVersion(organizationId, appId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["marketplace", "app-versions", organizationId, appId],
      });
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "my-app", organizationId, appId] });
    },
  });
}

export function useAppAiTools(appId: string | undefined) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["marketplace", "ai-tools", organizationId, appId],
    queryFn: () => marketplaceApi.listAiTools(organizationId!, appId!),
    enabled: !!organizationId && !!appId,
  });
}

// ---------------------------------------------------------------------------
// Stripe Connect payouts
// ---------------------------------------------------------------------------

export function useConnectStatus() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["marketplace", "connect-status", organizationId],
    queryFn: () => marketplaceApi.getConnectStatus(organizationId!),
    enabled: !!organizationId,
  });
}

export function useCreateOnboardingLink() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("No active organization");
      return marketplaceApi.createOnboardingLink(organizationId);
    },
  });
}
