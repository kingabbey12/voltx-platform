import { apiClient } from "./client";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  jobTitle: string | null;
  status: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface CurrentUser extends User {
  organizationId: string;
  membershipId: string;
  roles: string[];
  permissions: string[];
  onboardingCompleted: boolean;
}

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  roleKey: string;
  roleName: string;
  joinedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
  organizationId?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}

export const authApi = {
  login: (input: LoginInput) => apiClient.post<LoginResponse>("/auth/login", input, { authenticated: false }),

  register: (input: RegisterInput) =>
    apiClient.post<LoginResponse>("/auth/register", input, { authenticated: false }),

  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokens>("/auth/refresh", { refreshToken }, { authenticated: false }),

  logout: (refreshToken: string) =>
    apiClient.post<{ message: string }>("/auth/logout", { refreshToken }),

  me: () => apiClient.get<CurrentUser>("/auth/me"),

  myOrganizations: () => apiClient.get<OrganizationMembership[]>("/auth/my-organizations"),

  switchOrganization: (organizationId: string) =>
    apiClient.post<LoginResponse>("/auth/switch-organization", { organizationId }),

  requestPasswordReset: (email: string) =>
    apiClient.post<{ message: string }>(
      "/auth/request-password-reset",
      { email },
      { authenticated: false },
    ),

  resetPassword: (token: string, password: string) =>
    apiClient.post<{ message: string }>(
      "/auth/reset-password",
      { token, password },
      { authenticated: false },
    ),

  verifyEmail: (token: string) =>
    apiClient.post<{ message: string; emailVerifiedAt: string }>(
      "/auth/verify-email",
      { token },
      { authenticated: false },
    ),
};
