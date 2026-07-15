import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitationsApi, rolesApi, type CreateRoleInput, type UpdateRoleInput } from "@/lib/api/invitations";
import { permissionsApi } from "@/lib/api/permissions";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list() });
}

export function usePermissionCatalog() {
  return useQuery({ queryKey: ["permissions"], queryFn: () => permissionsApi.list() });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rolesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) => rolesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
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
