import { useQuery } from "@tanstack/react-query";
import { extensionsApi } from "@/lib/api/extensions";
import { useAuthStore } from "@/lib/stores/auth-store";

/** Every installed marketplace app's Custom Pages/Widgets/Nav for the
 * current organization — a single shared query so the sidebar (nav
 * entries) and any page/widget host both read from the same cache
 * instead of firing duplicate requests. */
export function useInstalledExtensions() {
  const organizationId = useAuthStore((state) => state.user?.organizationId);

  return useQuery({
    queryKey: ["extensions", "installed", organizationId],
    queryFn: () => extensionsApi.getInstalled(organizationId!),
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}
