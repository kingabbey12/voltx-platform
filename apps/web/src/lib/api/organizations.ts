import { apiClient } from "./client";

export type CompanySize =
  | "JUST_ME"
  | "EMPLOYEES_2_10"
  | "EMPLOYEES_11_50"
  | "EMPLOYEES_51_200"
  | "EMPLOYEES_201_500"
  | "EMPLOYEES_501_1000"
  | "EMPLOYEES_1000_PLUS";

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  email: string | null;
  website: string | null;
  industry: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  companySize: CompanySize | null;
  primaryGoals: string[];
  currency: string | null;
  language: string | null;
  phone: string | null;
  timezone: string;
  status: string;
  settings: Record<string, unknown>;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  email?: string;
  website?: string;
  industry?: string;
  country?: string;
  state?: string;
  city?: string;
  companySize?: CompanySize;
  primaryGoals?: string[];
  currency?: string;
  language?: string;
  phone?: string;
  timezone?: string;
}

export const organizationsApi = {
  get: (id: string) => apiClient.get<OrganizationProfile>(`/organizations/${id}`),

  update: (id: string, input: UpdateOrganizationInput) =>
    apiClient.patch<OrganizationProfile>(`/organizations/${id}`, input),

  completeOnboarding: (id: string) =>
    apiClient.post<OrganizationProfile>(`/organizations/${id}/complete-onboarding`),
};
