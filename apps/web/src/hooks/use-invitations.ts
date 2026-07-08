import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitationsApi, rolesApi } from "@/lib/api/invitations";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list() });
}

export function useInvitations() {
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  return useQuery({
    queryKey: ["invitations", organizationId],
    queryFn: () => invitationsApi.list(organizationId!),
    enabled: !!organizationId,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  return useMutation({
    mutationFn: (input: { email: string; roleId: string }) => {
      if (!organizationId) throw new Error("No active organization");
      return invitationsApi.create(organizationId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations", organizationId] }),
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  return useMutation({
    mutationFn: (invitationId: string) => {
      if (!organizationId) throw new Error("No active organization");
      return invitationsApi.resend(organizationId, invitationId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations", organizationId] }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  return useMutation({
    mutationFn: (invitationId: string) => {
      if (!organizationId) throw new Error("No active organization");
      return invitationsApi.revoke(organizationId, invitationId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations", organizationId] }),
  });
}
