import { apiClient } from "./client";

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  industry: string | null;
  country: string | null;
  timezone: string;
  status: string;
  settings: Record<string, unknown>;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  industry?: string;
  country?: string;
  timezone?: string;
}

export const organizationsApi = {
  get: (id: string) => apiClient.get<OrganizationProfile>(`/organizations/${id}`),

  update: (id: string, input: UpdateOrganizationInput) =>
    apiClient.patch<OrganizationProfile>(`/organizations/${id}`, input),

  completeOnboarding: (id: string) =>
    apiClient.post<OrganizationProfile>(`/organizations/${id}/complete-onboarding`),
};
