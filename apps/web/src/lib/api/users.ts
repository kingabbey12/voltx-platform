import { apiClient } from "./client";
import type { User } from "./auth";
import type { PaginatedResult } from "./types";

export interface UpdateCurrentUserInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  jobTitle?: string;
}

export const usersApi = {
  list: (query: { page?: number; limit?: number; search?: string } = {}) =>
    apiClient.get<PaginatedResult<User>>("/users", { query: { page: 1, limit: 100, ...query } }),
  updateMe: (input: UpdateCurrentUserInput) => apiClient.patch<User>("/users/me", input),
};
