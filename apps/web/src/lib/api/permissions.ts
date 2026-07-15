import { apiClient } from "./client";

export interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export const permissionsApi = {
  list: () => apiClient.get<Permission[]>("/permissions"),
};
