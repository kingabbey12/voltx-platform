import { useMutation } from "@tanstack/react-query";
import { authApi, type LoginInput, type LoginResponse, type RegisterInput } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/token-storage";
import { useAuthStore } from "@/lib/stores/auth-store";

/** Every session-establishing call returns a bare user (no
 * organizationId/roles/permissions/onboardingCompleted — those only exist
 * on /auth/me), so persist tokens then immediately re-fetch /auth/me for
 * the enriched session — mirrors the mobile app's api_auth_repository.dart
 * _persistSession() pattern exactly, for the same reason. */
async function persistSession(result: LoginResponse) {
  tokenStorage.save({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  const user = await authApi.me();
  useAuthStore.getState().setUser(user);
  return user;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => persistSession(await authApi.login(input)),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => persistSession(await authApi.register(input)),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      const refreshToken = tokenStorage.readRefreshToken();
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Local session still clears even if the remote revoke fails.
        }
      }
    },
    onSettled: () => {
      tokenStorage.clear();
      useAuthStore.getState().setUnauthenticated();
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
  });
}
