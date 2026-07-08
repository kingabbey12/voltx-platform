import { apiClient } from "./client";
import type { User } from "./auth";

export interface UpdateCurrentUserInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  jobTitle?: string;
}

export const usersApi = {
  updateMe: (input: UpdateCurrentUserInput) => apiClient.patch<User>("/users/me", input),
};
